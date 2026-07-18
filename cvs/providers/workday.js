const path = require('path');

const DELAYS = { short: 500, medium: 1500, long: 3000, page: 5000 };

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForSelector(page, selector, timeout = 15000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch { return false; }
}

async function typeInField(page, selector, value) {
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value, { delay: 30 });
}

async function getVerificationCode(email, waitMs = 30000) {
  // Dynamic import of email MCP check — called externally via the MCP tools
  // For now, pause and log — the main script will be invoked from Claude Code
  // which has MCP access to read the inbox
  console.log(`  [waiting] Verification code needed — checking ${email} inbox...`);
  await wait(waitMs);
  return null; // Will be overridden when called from Claude Code context
}

async function apply(page, { draft, profile, applyUrl, submit, screenshot }) {
  console.log('  [workday] Starting application...');

  // Step 1: Navigate to apply URL
  console.log('  [workday] Navigating to apply page...');
  await page.goto(applyUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(DELAYS.page);
  await screenshot('01_landing');

  // Step 2: Check if we need to create account or sign in
  const hasSignIn = await waitForSelector(page, '[data-automation-id="signInLink"], [data-automation-id="createAccountLink"]', 10000);

  if (hasSignIn) {
    console.log('  [workday] Account required. Attempting sign up...');
    await handleAccountCreation(page, profile, screenshot);
  }

  // Step 3: Check for "autofill with resume" option
  const hasAutofill = await waitForSelector(page, '[data-automation-id="useMyLastApplication"], input[type="file"]', 10000);

  if (hasAutofill) {
    console.log('  [workday] Uploading CV for autofill...');
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(draft.target.cv_pdf);
      await wait(DELAYS.long);
      console.log('  [workday] CV uploaded, waiting for autofill...');
      await wait(DELAYS.page);
      await screenshot('02_after_autofill');
    }
  }

  // Step 4: Fill any remaining standard fields
  console.log('  [workday] Filling standard fields...');
  await fillStandardFields(page, profile, draft);
  await screenshot('03_fields_filled');

  // Step 5: Look for additional questions / custom fields
  console.log('  [workday] Checking for additional questions...');
  await fillAdditionalQuestions(page, profile, draft);
  await screenshot('04_questions_answered');

  // Step 6: Navigate through pages if multi-step
  const nextButton = await page.$('[data-automation-id="bottom-navigation-next-button"]');
  if (nextButton) {
    console.log('  [workday] Multi-step form detected, advancing...');
    let stepCount = 1;
    while (true) {
      const next = await page.$('[data-automation-id="bottom-navigation-next-button"]');
      if (!next) break;
      await next.click();
      await wait(DELAYS.page);
      stepCount++;
      await screenshot(`05_step_${stepCount}`);
      await fillStandardFields(page, profile, draft);
      await fillAdditionalQuestions(page, profile, draft);

      // Safety: don't loop forever
      if (stepCount > 10) break;
    }
  }

  // Step 7: Final review before submit
  await screenshot('06_pre_submit');

  if (submit) {
    const submitBtn = await page.$('[data-automation-id="bottom-navigation-next-button"], [data-automation-id="submit-button"], button[type="submit"]');
    if (submitBtn) {
      const btnText = await page.evaluate(el => el.textContent, submitBtn);
      if (btnText.toLowerCase().includes('submit')) {
        console.log('  [workday] Submitting application...');
        await submitBtn.click();
        await wait(DELAYS.page);
        await screenshot('07_submitted');
      } else {
        console.log(`  [workday] Final button says "${btnText.trim()}" — not clicking. Manual submit required.`);
      }
    }
  } else {
    console.log('  [workday] Dry run — stopping before submit.');
  }
}

async function handleAccountCreation(page, profile, screenshot) {
  // Fill email field
  const emailFields = await page.$$('input[type="text"], input[type="email"]');
  for (const field of emailFields) {
    const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || el.getAttribute('data-automation-id') || '', field);
    if (ariaLabel.toLowerCase().includes('email') || (await page.evaluate(el => {
      const label = el.closest('.css-1wc0j0t, .css-1n0e2d3, div')?.querySelector('label');
      return label?.textContent || '';
    }, field)).toLowerCase().includes('email')) {
      await field.click({ clickCount: 3 });
      await field.type(profile.email, { delay: 30 });
      console.log(`  [workday] Filled email: ${profile.email}`);
      break;
    }
  }

  // Fill password fields
  const password = generatePassword();
  const passwordFields = await page.$$('input[type="password"]');
  for (const field of passwordFields) {
    await field.click({ clickCount: 3 });
    await field.type(password, { delay: 30 });
  }
  if (passwordFields.length > 0) {
    console.log(`  [workday] Password set (${passwordFields.length} fields filled)`);
    process.env._WORKDAY_PW = password;
  }

  // Tick privacy/consent checkbox
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const isChecked = await page.evaluate(el => el.checked, cb);
    if (!isChecked) {
      await cb.click();
      console.log('  [workday] Ticked consent checkbox');
    }
  }

  await screenshot('account_form_filled');

  // Click "Create Account" button
  const createBtn = await page.$('button[data-automation-id="createAccountSubmitButton"], div[data-automation-id="createAccountSubmitButton"]');
  if (createBtn) {
    await createBtn.click();
    console.log('  [workday] Clicked Create Account');
    await wait(DELAYS.page);
  } else {
    // Try finding button by text
    const buttons = await page.$$('button, div[role="button"]');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.trim() === 'Create Account') {
        await btn.click();
        console.log('  [workday] Clicked Create Account (by text)');
        await wait(DELAYS.page);
        break;
      }
    }
  }

  await screenshot('account_after_create');

  // Check if verification code is needed
  await wait(DELAYS.long);
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('verification') || pageText.includes('Verification') || pageText.includes('verify your email')) {
    console.log('  [workday] Email verification required — waiting for code via MCP...');
    await screenshot('account_verification_needed');
    // Write a signal file that the calling context can read
    const fs = require('fs');
    fs.writeFileSync('/tmp/workday-needs-verification.txt', JSON.stringify({
      email: profile.email,
      timestamp: new Date().toISOString(),
      status: 'awaiting_code'
    }));
    // Wait for the code to be written back
    let code = null;
    for (let i = 0; i < 12; i++) {
      await wait(5000);
      try {
        const signal = fs.readFileSync('/tmp/workday-verification-code.txt', 'utf-8').trim();
        if (signal && signal.length >= 4) { code = signal; break; }
      } catch {}
      console.log(`  [workday] Waiting for verification code... (${(i+1)*5}s)`);
    }

    if (code) {
      console.log(`  [workday] Got verification code: ${code}`);
      const codeInput = await page.$('input[data-automation-id="verificationCode"], input[type="text"]');
      if (codeInput) {
        await codeInput.click({ clickCount: 3 });
        await codeInput.type(code, { delay: 50 });
        // Submit verification
        const verifyBtn = await page.$('button[data-automation-id="verifyButton"]');
        if (verifyBtn) await verifyBtn.click();
        else {
          const btns = await page.$$('button');
          for (const b of btns) {
            const t = await page.evaluate(el => el.textContent, b);
            if (t.includes('Verify') || t.includes('Submit') || t.includes('Confirm')) { await b.click(); break; }
          }
        }
        await wait(DELAYS.page);
      }
    } else {
      console.log('  [workday] No verification code received within 60s. Pausing...');
    }

    await screenshot('account_verified');
  }
}

async function fillStandardFields(page, profile, draft) {
  const fieldMappings = [
    { selector: '[data-automation-id="legalNameSection_firstName"]', value: profile.first_name },
    { selector: '[data-automation-id="legalNameSection_lastName"]', value: profile.last_name },
    { selector: '[data-automation-id="email"]', value: profile.email },
    { selector: '[data-automation-id="phone-number"]', value: profile.phone },
    { selector: '[data-automation-id="addressSection_addressLine1"]', value: profile.location.city },
    { selector: '[data-automation-id="linkedinQuestion"]', value: profile.linkedin },
    { selector: '[data-automation-id="websiteQuestion"]', value: profile.website },
  ];

  for (const { selector, value } of fieldMappings) {
    const field = await page.$(selector);
    if (field) {
      const currentValue = await page.evaluate(el => el.value, field);
      if (!currentValue || currentValue.trim() === '') {
        await typeInField(page, selector, value);
      }
    }
  }
}

async function fillAdditionalQuestions(page, profile, draft) {
  // Look for text areas (cover letter, additional info)
  const textareas = await page.$$('textarea');
  for (const ta of textareas) {
    const label = await page.evaluate(el => {
      const labelEl = el.closest('.css-1wc0j0t')?.querySelector('label') ||
                      el.parentElement?.querySelector('label') ||
                      el.closest('[data-automation-id]')?.querySelector('label');
      return labelEl?.textContent || '';
    }, ta);

    const currentVal = await page.evaluate(el => el.value, ta);
    if (currentVal && currentVal.trim() !== '') continue;

    if (label.toLowerCase().includes('cover letter') || label.toLowerCase().includes('why')) {
      const coverText = draft.body_email || `${draft.opening}\n\n${draft.body}\n\n${draft.closing}`;
      await ta.click();
      await ta.type(coverText, { delay: 10 });
      console.log(`  [workday] Filled: ${label.slice(0, 50)}`);
    }
  }

  // Look for "How did you hear" dropdowns
  const hearAbout = await page.$('[data-automation-id="source"], [data-automation-id="howDidYouHear"]');
  if (hearAbout) {
    await hearAbout.click();
    await wait(DELAYS.short);
    const linkedinOption = await page.$('li[data-automation-id*="LinkedIn"], [data-value*="LinkedIn"]');
    if (linkedinOption) await linkedinOption.click();
  }
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pw = 'Sm4ll3y!';
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];

  // ALWAYS persist immediately before using
  const fs = require('fs');
  const credPath = require('path').resolve(__dirname, '../../mcp/social/.env');
  const envContent = fs.existsSync(credPath) ? fs.readFileSync(credPath, 'utf-8') : '';
  if (!envContent.includes('WORKDAY_PASSWORD=')) {
    fs.appendFileSync(credPath, `\n# Workday ATS credentials (auto-generated)\nWORKDAY_PASSWORD=${pw}\n`);
  } else {
    const updated = envContent.replace(/WORKDAY_PASSWORD=.*/, `WORKDAY_PASSWORD=${pw}`);
    fs.writeFileSync(credPath, updated);
  }
  console.log(`  [workday] Password persisted to .env`);
  return pw;
}

module.exports = { apply };

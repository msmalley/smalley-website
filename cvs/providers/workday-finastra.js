const puppeteer = require('puppeteer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CREDS = { email: process.env.WORKDAY_EMAIL || 'mark@smalley.my', password: process.env.WORKDAY_PASSWORD };
const PROFILE = {
  firstName: 'Mark',
  lastName: 'Smalley',
  address: '111 Kershaw Crescent',
  city: 'Halifax',
  postcode: 'HX2 6NR',
  phone: '7526 860262',
  howHeard: 'LinkedIn',
  prefix: 'Mr.'
};
const CV_PATH = path.resolve(__dirname, '../dist/Mark-Smalley-CV-CTO.pdf');
const SCREENSHOTS = path.resolve(__dirname, '../screenshots');
const APPLY_URL = 'https://finastra.wd3.myworkdayjobs.com/en-US/FINC/job/London/Director---AI---Innovation_REQ0625_0034225/apply/autofillWithResume';

const wait = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, label) {
  const file = `${SCREENSHOTS}/finastra_${label}.png`;
  try {
    await page.screenshot({ path: file, fullPage: true });
  } catch (e) {
    try { await page.screenshot({ path: file }); } catch (_) {}
  }
  return file;
}

async function getCurrentStep(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    if (text.includes('Something went wrong')) return 'crash';
    // Check for the main content heading (appears after the progress bar)
    const headings = [...document.querySelectorAll('h1, h2, h3')];
    const stepHeadings = ['My Information', 'My Experience', 'Application Questions', 'Voluntary Disclosures', 'Review'];
    for (const h of headings) {
      const ht = h.textContent.trim();
      if (stepHeadings.includes(ht)) return ht;
    }
    // Fallback: check progress bar aria-current
    const current = document.querySelector('[aria-current="step"]');
    if (current) return current.textContent.trim();
    return 'unknown';
  });
}

async function checkForCrash(page) {
  const text = await page.evaluate(() => document.body.innerText);
  return text.includes('Something went wrong');
}

async function recoverFromCrash(page) {
  console.log('  [RECOVERING] Page crashed, refreshing...');
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000);
  if (await checkForCrash(page)) {
    console.log('  [RECOVERING] Still crashed, navigating to apply URL...');
    await page.goto(APPLY_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000);
  }
  return !(await checkForCrash(page));
}

async function signIn(page) {
  await page.goto(APPLY_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2000);

  // Wait for Workday SPA to render (loading spinner can persist)
  for (let i = 0; i < 12; i++) {
    const signInBtn = await page.$('[data-automation-id="signInLink"]');
    if (signInBtn) break;
    // Also check if we're already signed in (redirected to form)
    const step = await getCurrentStep(page);
    if (step !== 'unknown' && step !== 'crash') {
      console.log('[OK] Already signed in, on:', step);
      return;
    }
    console.log('  Waiting for page render... (' + (i + 1) + '/12)');
    await wait(2000);
  }

  const signInBtn = await page.$('[data-automation-id="signInLink"]');
  if (!signInBtn) {
    await shot(page, 'no_signin_link');
    throw new Error('No Sign In link found after 60s wait');
  }
  await signInBtn.click();
  await wait(3000);

  const emailEl = await page.$('[data-automation-id="email"]');
  const pwEl = await page.$('[data-automation-id="password"]');
  if (!emailEl || !pwEl) throw new Error('No email/password fields');
  await emailEl.click({ clickCount: 3 });
  await emailEl.type(CREDS.email, { delay: 20 });
  await pwEl.click({ clickCount: 3 });
  await pwEl.type(CREDS.password, { delay: 20 });

  const submitBtn = await page.$('[data-automation-id="signInSubmitButton"]');
  if (!submitBtn) throw new Error('No submit button');
  await submitBtn.click();
  await wait(3000);

  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 200));
  if (!pageText.includes('mark@smalley.my')) throw new Error('Sign-in failed: ' + pageText.slice(0, 100));
  console.log('[OK] Signed in');
}

async function skipAutofill(page) {
  // Check if page crashed
  if (await checkForCrash(page)) {
    const recovered = await recoverFromCrash(page);
    if (!recovered) throw new Error('Cannot recover from crash after sign-in');
  }

  // We might already be past autofill (resuming a partial application)
  const step = await getCurrentStep(page);
  if (step !== 'unknown' && step !== 'crash') {
    console.log('[OK] Already past autofill, on:', step);
    return;
  }

  // Click Continue on autofill step
  for (const btn of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent.trim(), btn);
    if (text === 'Continue') { await btn.click(); break; }
  }
  await wait(3000);

  if (await checkForCrash(page)) {
    const recovered = await recoverFromCrash(page);
    if (!recovered) throw new Error('Crash after autofill skip');
  }
  console.log('[OK] Passed Autofill step');
}

async function fillMyInformation(page) {
  // Check if the page is in an error state before starting
  if (await checkForCrash(page)) {
    console.log('[CRASH] Step 2 page crashed on load, recovering...');
    const recovered = await recoverFromCrash(page);
    if (!recovered) return false;
    await wait(3000);
  }

  // Verify we're actually on Step 2 (My Information)
  const step = await getCurrentStep(page);
  if (step !== 'My Information') {
    console.log('[FAIL] Not on My Information, currently on:', step);
    return false;
  }

  // Wait for form to fully render (skeleton placeholders disappear)
  await page.waitForSelector('input[name="legalName--firstName"], input[name="legalNameSection_firstName"]', { timeout: 15000 }).catch(() => null);
  await wait(2000);

  // 1. How Did You Hear - hierarchical multiselect: Social Media > LinkedIn
  const howHeardFilled = await page.evaluate(() => {
    // Check multiple ways if already filled
    const selected = document.querySelector('[data-automation-id="selectedItem"]');
    if (selected && selected.getAttribute('aria-label')?.includes('LinkedIn')) return 'filled';
    const container = document.querySelector('[data-automation-id="formField-source"]');
    if (container && container.querySelector('[data-automation-id="selectedItem"]')) return 'filled';
    // Check if the pill text shows LinkedIn
    const pills = document.querySelectorAll('[data-automation-id="promptOption"]');
    for (const p of pills) { if (p.textContent.includes('LinkedIn')) return 'filled'; }
    if (!container) return 'no_container';
    return 'empty';
  });

  if (howHeardFilled === 'filled' || howHeardFilled === 'no_container') {
    console.log('  How Heard:', howHeardFilled === 'filled' ? 'already set' : 'container not found (likely already set from previous run)');
  } else {
    // Open dropdown via prompt icon
    const promptIcon = await page.$('[data-automation-id="formField-source"] [data-automation-id="promptIcon"]');
    if (promptIcon) await promptIcon.click();
    else { const inp = await page.$('input#source--source'); if (inp) await inp.click(); }
    await wait(2000);
    // Must use Puppeteer ElementHandle.click() — JS .click() doesn't trigger React navigation
    const smItem = await page.$('[data-automation-id="menuItem"][aria-label*="Social Media"]');
    if (!smItem) throw new Error('How Heard: Social Media menuItem not found');
    await smItem.click();
    console.log('  How Heard: clicked Social Media (via Puppeteer click)');
    await wait(3000);
    // Now LinkedIn should appear as a sub-item
    const liItem = await page.$('[data-automation-id="menuItem"][aria-label*="LinkedIn"]');
    if (!liItem) {
      const visible = await page.evaluate(() => [...document.querySelectorAll('[data-automation-id="menuItem"]')].map(el => el.getAttribute('aria-label')).join(', '));
      throw new Error('How Heard: LinkedIn not found. Visible: ' + visible);
    }
    await liItem.click();
    console.log('  How Heard: selected LinkedIn');
    await wait(1000);
  }

  // 2. Previously worked - No (radio name=candidateIsPreviousWorker value=false)
  await page.evaluate(() => {
    const radio = document.querySelector('input[name="candidateIsPreviousWorker"][value="false"]');
    if (radio) { radio.click(); return true; }
    // Fallback: find label with "No" text near the radio group
    const container = document.querySelector('[data-automation-id="formField-candidateIsPreviousWorker"]');
    if (container) {
      const labels = [...container.querySelectorAll('label')];
      const no = labels.find(l => l.textContent.trim() === 'No');
      if (no) no.click();
    }
  });
  console.log('  Previous worker: No');
  await wait(500);

  // 3. Prefix - Euronext form does not have this field
  await wait(500);

  // Set input value via React's native setter (bypasses typing issues with pre-filled fields)
  async function setInputValue(selector, value) {
    const exists = await page.$(selector);
    if (!exists) { console.log('    skip', selector, '(not found, likely pre-filled)'); return; }
    const current = await page.$eval(selector, el => el.value).catch(() => null);
    if (current === value) {
      console.log('    skip', selector, '(already correct)');
      return;
    }
    await page.$eval(selector, (el, val) => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    console.log('    set', selector, '=', value);
  }

  // 4-9. Fill text fields (skip if already correct)
  await setInputValue('input[name="legalName--firstName"]', PROFILE.firstName);
  await setInputValue('input[name="legalName--lastName"]', PROFILE.lastName);
  await setInputValue('input[name="addressLine1"]', PROFILE.address);
  await setInputValue('input[name="city"]', PROFILE.city);
  await setInputValue('input[name="postalCode"]', PROFILE.postcode);
  await setInputValue('input[name="phoneNumber"]', PROFILE.phone);

  // Phone Device Type - exact selector: button#phoneNumber--phoneType
  const phoneBtn = await page.$('button#phoneNumber--phoneType');
  if (!phoneBtn) { console.log('  Phone Device Type: button not found (likely pre-filled)'); }
  else {
    const phoneVal = await page.evaluate(el => el.textContent.trim(), phoneBtn);
    if (phoneVal !== 'Select One') {
      console.log('  Phone Device Type: already set to', phoneVal);
    } else {
      await phoneBtn.click();
      await wait(2000);
      const selected = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('[role="option"]')];
        const mobile = opts.find(el => el.textContent.trim() === 'Mobile');
        if (mobile) { mobile.click(); return 'Mobile'; }
        return null;
      });
      if (!selected) console.log('  Phone Device Type: Mobile option not found');
      else console.log('  Phone Device Type:', selected);
      await wait(1000);
    }
  }

  console.log('  Text fields filled');
  await shot(page, 'step2_prefilled');

  // Save and Continue
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);
  for (const btn of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent.trim(), btn);
    if (text === 'Save and Continue') { await btn.click(); break; }
  }
  await wait(3000);
  await shot(page, 'step2_after_save');

  // Check if we advanced (use page heading, not step number since autofill step disappears)
  if (await checkForCrash(page)) {
    console.log('[CRASH] Page crashed after save, attempting recovery...');
    const recovered = await recoverFromCrash(page);
    if (!recovered) { console.log('[FAIL] Could not recover'); return false; }
  }

  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('Errors Found')) {
    const errors = await page.evaluate(() => {
      const box = document.querySelector('[data-automation-id="errorBanner"]');
      return box ? box.innerText : 'unknown';
    });
    console.log('[FAIL] Step 2 errors:', errors.slice(0, 200));
    return false;
  }

  const afterStep = await getCurrentStep(page);
  if (afterStep === 'My Experience') {
    console.log('[OK] Step 2 complete - on My Experience');
    return true;
  }

  console.log('[UNKNOWN] Page state after save, step:', afterStep);
  await shot(page, 'step2_unknown');
  return false;
}

// Skills relevant to Mark's profile + this LSEG AI Director role
const SKILLS = [
  'Engineering Leadership', 'Blockchain', 'AI', 'Cloud Architecture',
  'JavaScript', 'Node.js', 'API Design', 'Agile', 'Team Leadership',
  'Distributed Systems'
];

async function fillMyExperience(page) {
  await shot(page, 'step3_start');

  // Check if CV already uploaded (look for a filename display)
  const alreadyUploaded = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Mark-Smalley') && text.includes('.pdf');
  });

  if (alreadyUploaded) {
    console.log('  CV: already uploaded');
  } else {
    // Upload CV via the hidden file input (Workday uses one behind "Select files")
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(CV_PATH);
      console.log('  CV uploaded:', path.basename(CV_PATH));
      await wait(3000);
    } else {
      console.log('  WARNING: No file input found');
    }
  }

  // LinkedIn URL field
  const linkedinInput = await page.evaluateHandle(() => {
    const labels = [...document.querySelectorAll('label, p, span')];
    const linkedinLabel = labels.find(l => l.textContent.includes('LinkedIn'));
    if (!linkedinLabel) return null;
    let container = linkedinLabel.parentElement;
    for (let i = 0; i < 3 && container; i++) {
      const input = container.querySelector('input');
      if (input) return input;
      container = container.parentElement;
    }
    return null;
  });
  const linkedinEl = linkedinInput.asElement ? linkedinInput.asElement() : linkedinInput;
  if (linkedinEl) {
    const currentVal = await page.evaluate(el => el.value, linkedinEl);
    if (currentVal && currentVal.includes('linkedin.com')) {
      console.log('  LinkedIn URL: already set');
    } else {
      await page.evaluate((el, val) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, linkedinEl, 'https://www.linkedin.com/in/mgsmalley');
      console.log('  LinkedIn URL: set');
    }
  } else {
    console.log('  LinkedIn URL: no input found (optional)');
  }

  // Skills - type each, only select if Workday offers a match (skip otherwise)
  const skillsContainer = await page.$('[data-automation-id="multiselectInputContainer"]');
  if (skillsContainer) {
    const existingCount = await page.evaluate(() =>
      document.querySelectorAll('[data-automation-id="selectedItem"]').length
    );
    if (existingCount > 0) {
      console.log('  Skills: already have', existingCount);
    } else {
      const skillInput = await skillsContainer.$('input');
      if (skillInput) {
        let added = 0;
        for (const skill of SKILLS) {
          // Clear field first
          await skillInput.click();
          await wait(200);
          await page.evaluate(el => {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, '');
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }, skillInput);
          await wait(200);

          // Type skill
          await skillInput.type(skill, { delay: 40 });
          await wait(2000);

          // Check if autocomplete offers an option (not "No Items")
          const option = await page.$('[data-automation-id="promptOption"]');
          if (option) {
            await option.click();
            console.log('  Skill added:', skill);
            added++;
            await wait(500);
          } else {
            // No match - clear and move on
            await page.evaluate(el => {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(el, '');
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }, skillInput);
          }
          if (added >= 5) break;
        }
        if (added === 0) console.log('  Skills: none matched Workday list (optional field, skipping)');
      }
    }
  } else {
    console.log('  Skills: optional, no container');
  }

  await wait(2000);
  await shot(page, 'step3_filled');

  // Save and Continue
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);
  for (const btn of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent.trim(), btn);
    if (text === 'Save and Continue') { await btn.click(); break; }
  }
  await wait(3000);
  await shot(page, 'step3_after_save');

  if (await checkForCrash(page)) {
    const recovered = await recoverFromCrash(page);
    if (!recovered) return false;
  }

  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('Errors Found')) {
    const errors = await page.evaluate(() => {
      const box = document.querySelector('[data-automation-id="errorBanner"]');
      return box ? box.innerText : 'unknown';
    });
    console.log('[FAIL] Step 3 errors:', errors.slice(0, 300));
    return false;
  }

  const step = await getCurrentStep(page);
  if (step === 'Application Questions') {
    console.log('[OK] Step 3 complete - on Application Questions');
    return true;
  }
  if (step !== 'My Experience') {
    console.log('[OK] Step 3 complete - moved to', step);
    return true;
  }
  console.log('[UNKNOWN] Step 3 state:', step);
  return false;
}

async function fillApplicationQuestions(page) {
  await shot(page, 'step4_start');

  // Finastra application questions:
  // 1. Non-compete agreement preventing hiring? → No
  // 2. Authorized to work in the country? → Yes
  // 3. Require sponsorship? → No
  // 4. Confirm statements are accurate? → first affirmative option (I Agree/I Accept/Yes)
  const answers = ['No', 'Yes', 'No', '__FIRST_OPTION__'];

  // Always find the FIRST remaining "Select One" dropdown, select answer, repeat
  for (let i = 0; i < answers.length; i++) {
    const btn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button[aria-haspopup="listbox"]')];
      return buttons.find(b => b.textContent.trim() === 'Select One') || null;
    });
    const btnEl = btn.asElement ? btn.asElement() : btn;
    if (!btnEl) {
      console.log('  Q' + (i + 1) + ': no more unanswered dropdowns');
      break;
    }

    await btnEl.click();
    await wait(2000);

    // Find and click the target option
    const opts = await page.$$('[role="option"]');
    let selected = false;
    if (answers[i] === '__FIRST_OPTION__') {
      // Select first non-empty option (for confirmation dropdowns with unknown text)
      for (const opt of opts) {
        const t = await page.evaluate(el => el.textContent.trim(), opt);
        if (t && t !== 'Select One') {
          await opt.click();
          console.log('  Q' + (i + 1) + ':', t, '(first option)');
          selected = true;
          break;
        }
      }
    } else {
      for (const opt of opts) {
        const t = await page.evaluate(el => el.textContent.trim(), opt);
        if (t === answers[i]) {
          await opt.click();
          console.log('  Q' + (i + 1) + ':', answers[i]);
          selected = true;
          break;
        }
      }
    }
    if (!selected) {
      const available = await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].map(el => el.textContent.trim()).join(', '));
      console.log('  Q' + (i + 1) + ': FAILED. Available options:', available);
    }
    await wait(2000);
  }

  // Salary expectations textarea - use actual typing so Workday persists it
  const textarea = await page.$('textarea');
  if (textarea) {
    const currentVal = await page.evaluate(el => el.value, textarea);
    if (currentVal && currentVal.length > 10) {
      console.log('  Salary: already filled');
    } else {
      await textarea.click();
      await wait(300);
      const salaryText = 'Above market average (GBP) if required to relocate to London permanently. Below market average if able to work predominantly remote from Yorkshire with periodic London visits.';
      await textarea.type(salaryText, { delay: 5 });
      console.log('  Salary: typed');
    }
  }

  await wait(2000);
  await shot(page, 'step4_filled');

  // Save and Continue
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);
  for (const btn of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent.trim(), btn);
    if (text === 'Save and Continue') { await btn.click(); break; }
  }
  await wait(3000);
  await shot(page, 'step4_after_save');

  if (await checkForCrash(page)) {
    const recovered = await recoverFromCrash(page);
    if (!recovered) return false;
  }

  const step = await getCurrentStep(page);
  if (step === 'Voluntary Disclosures') {
    console.log('[OK] Step 4 complete - on Voluntary Disclosures');
    return true;
  }
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('Errors Found')) {
    const errors = await page.evaluate(() => {
      const box = document.querySelector('[data-automation-id="errorBanner"]');
      return box ? box.innerText : 'unknown';
    });
    console.log('[FAIL] Step 4 errors:', errors.slice(0, 300));
    return false;
  }
  console.log('[UNKNOWN] Step 4 state:', step);
  return false;
}

async function fillVoluntaryDisclosures(page) {
  await shot(page, 'step5_start');

  // Required: Accept Applicant Terms checkbox
  const termsCheckbox = await page.evaluateHandle(() => {
    const labels = [...document.querySelectorAll('label')];
    const termsLabel = labels.find(l => l.textContent.includes('I have read') || l.textContent.includes('certify'));
    if (termsLabel) return termsLabel;
    // Try checkbox inputs
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const parent = cb.closest('[data-automation-id]') || cb.parentElement;
      if (parent && parent.textContent.includes('Applicant Terms')) return cb;
    }
    return null;
  });
  const termsEl = termsCheckbox.asElement ? termsCheckbox.asElement() : termsCheckbox;
  if (termsEl) {
    await termsEl.click();
    console.log('  Applicant Terms: accepted');
    await wait(500);
  } else {
    // Fallback: find any unchecked checkbox near "Terms"
    const checkboxes = await page.$$('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const checked = await page.evaluate(el => el.checked, cb);
      if (!checked) {
        await cb.click();
        console.log('  Checkbox: clicked (assumed Terms)');
        break;
      }
    }
  }

  // Skip voluntary demographic fields (Gender, Race, etc.)
  console.log('  Demographics: skipping (all optional)');

  await wait(2000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);
  for (const btn of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent.trim(), btn);
    if (text === 'Save and Continue') { await btn.click(); break; }
  }
  await wait(3000);
  await shot(page, 'step5_after_save');

  if (await checkForCrash(page)) {
    const recovered = await recoverFromCrash(page);
    if (!recovered) return false;
  }

  const step = await getCurrentStep(page);
  if (step === 'Review') {
    console.log('[OK] Step 5 complete - on Review');
    return true;
  }
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('Errors Found')) {
    const errors = await page.evaluate(() => {
      const box = document.querySelector('[data-automation-id="errorBanner"]');
      return box ? box.innerText : 'unknown';
    });
    console.log('[FAIL] Step 5 errors:', errors.slice(0, 300));
    return false;
  }
  console.log('[UNKNOWN] Step 5 state:', step);
  return false;
}

async function reviewAndSubmit(page) {
  await shot(page, 'step6_review');
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('  Review page content:', pageText.slice(0, 800));

  // Submit the application
  console.log('[SUBMITTING] Clicking Submit...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(2000);

  let submitted = false;
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const t = await page.evaluate(el => el.textContent.trim(), btn);
    if (t === 'Submit') {
      await btn.click();
      submitted = true;
      console.log('[OK] Submit clicked');
      break;
    }
  }

  if (!submitted) {
    console.log('[FAIL] No Submit button found');
    return false;
  }

  await wait(15000);
  await shot(page, 'after_submit');

  const resultText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('[RESULT]', resultText.slice(0, 300));

  if (resultText.includes('Thank') || resultText.includes('submitted') || resultText.includes('received')) {
    console.log('[SUCCESS] Application submitted!');
    return true;
  }
  return true;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1440, height: 1200 },
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  try {
    await signIn(page);
    await skipAutofill(page);

    // Detect which step we're on via page heading (Workday saves progress)
    if (await checkForCrash(page)) {
      const recovered = await recoverFromCrash(page);
      if (!recovered) throw new Error('Unrecoverable crash');
    }

    const stepName = await getCurrentStep(page);
    let currentStep = 2;
    if (stepName === 'My Experience') currentStep = 3;
    else if (stepName === 'Application Questions') currentStep = 4;
    else if (stepName === 'Voluntary Disclosures') currentStep = 5;
    else if (stepName === 'Review') currentStep = 6;
    console.log('[INFO] Starting from step', currentStep, '(' + stepName + ')');

    if (currentStep <= 2) {
      console.log('\n=== STEP 2: My Information ===');
      const step2ok = await fillMyInformation(page);
      if (!step2ok) throw new Error('Step 2 failed');
    }

    if (currentStep <= 3) {
      console.log('\n=== STEP 3: My Experience ===');
      const step3ok = await fillMyExperience(page);
      if (!step3ok) throw new Error('Step 3 failed');
    }

    if (currentStep <= 4) {
      console.log('\n=== STEP 4: Application Questions ===');
      const step4ok = await fillApplicationQuestions(page);
      if (!step4ok) throw new Error('Step 4 failed');
    }

    if (currentStep <= 5) {
      console.log('\n=== STEP 5: Voluntary Disclosures ===');
      const step5ok = await fillVoluntaryDisclosures(page);
      if (!step5ok) throw new Error('Step 5 failed');
    }

    if (currentStep <= 6) {
      console.log('\n=== STEP 6: Review ===');
      await reviewAndSubmit(page);
    }

  } catch (e) {
    await shot(page, 'error');
    console.error('ERROR:', e.message);
  }

  console.log('\nBrowser open for inspection.');
  await wait(5000);
}

main();

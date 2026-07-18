const puppeteer = require('puppeteer');
const path = require('path');

const CREDS = { email: 'mark@smalley.my', password: 'Sm4ll3y!Wd2026' };
const PROFILE = {
  firstName: 'Mark',
  lastName: 'Smalley',
  address: '111 Kershaw Crescent',
  city: 'Halifax',
  postcode: 'HX2 6NR',
  phone: '7526860262',
  howHeard: 'LinkedIn',
  prefix: 'Mr.'
};
const CV_PATH = path.resolve(__dirname, '../dist/Mark-Smalley-CV-CTO.pdf');
const SCREENSHOTS = path.resolve(__dirname, '../screenshots');
const APPLY_URL = 'https://lseg.wd3.myworkdayjobs.com/en-US/Careers/job/London%2C-United-Kingdom/AI-Engineering-Enablement-Director_R0116809-1/apply/autofillWithResume';

const wait = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, label) {
  const file = `${SCREENSHOTS}/lseg_${label}.png`;
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function signIn(page) {
  await page.goto(APPLY_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(5000);

  const signInBtn = await page.$('[data-automation-id="signInLink"]');
  if (!signInBtn) throw new Error('No Sign In link found');
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
  await wait(8000);

  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 200));
  if (!pageText.includes('mark@smalley.my')) throw new Error('Sign-in failed: ' + pageText.slice(0, 100));
  console.log('[OK] Signed in');
}

async function skipAutofill(page) {
  for (const btn of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent.trim(), btn);
    if (text === 'Continue') { await btn.click(); break; }
  }
  await wait(8000);
  console.log('[OK] Passed Autofill step');
}

async function fillMyInformation(page) {
  // 1. How Did You Hear - click the browse/list icon button
  const msContainers = await page.$$('[data-automation-id="multiselectInputContainer"]');
  if (msContainers[0]) {
    const browseBtn = await msContainers[0].$('button');
    if (browseBtn) {
      await browseBtn.click();
      await wait(3000);
      await shot(page, 'howheard_popup');

      // Look for checkboxes or clickable options in the popup
      const popupOptions = await page.$$('[data-automation-id="promptOption"]');
      if (popupOptions.length > 0) {
        for (const opt of popupOptions) {
          const text = await page.evaluate(el => el.textContent.trim(), opt);
          if (text.includes('LinkedIn')) {
            await opt.click();
            console.log('  How Heard: clicked', text);
            break;
          }
        }
        await wait(1000);
        // Confirm/close the popup
        for (const btn of await page.$$('button')) {
          const text = await page.evaluate(el => el.textContent.trim(), btn);
          if (['OK', 'Done', 'Confirm', 'Apply', 'Save'].includes(text)) {
            await btn.click();
            console.log('  How Heard: confirmed with', text);
            break;
          }
        }
      } else {
        // Try the input approach instead
        console.log('  No popup options, trying input approach');
        await page.keyboard.press('Escape');
        await wait(500);
        const msInput = await msContainers[0].$('input');
        if (msInput) {
          await msInput.click();
          await wait(500);
          await msInput.type('LinkedIn', { delay: 50 });
          await wait(2000);
          await shot(page, 'howheard_typed');
          // Try arrow down + enter
          await page.keyboard.press('ArrowDown');
          await wait(300);
          await page.keyboard.press('Enter');
          await wait(500);
          console.log('  How Heard: typed + ArrowDown + Enter');
        }
      }
      await wait(1000);
    }
  }

  // 2. Previously worked - No
  const radioContainer = await page.$('[data-automation-id="formField-candidateIsPreviousWorker"]');
  if (radioContainer) {
    const labels = await radioContainer.$$('label');
    for (const label of labels) {
      const text = await page.evaluate(el => el.textContent.trim(), label);
      if (text === 'No') {
        await label.click();
        console.log('  Previous worker: No');
        break;
      }
    }
  }
  await wait(500);

  // 3. Prefix - Mr.
  const allDropdowns = await page.$$('button[aria-haspopup="listbox"]');
  for (const dd of allDropdowns) {
    const text = await page.evaluate(el => el.textContent.trim(), dd);
    if (text === 'Select One' || text === 'Ms' || text === 'Ms.') {
      await dd.click();
      await wait(1500);
      const options = await page.$$('[data-automation-id="promptOption"]');
      for (const opt of options) {
        const t = await page.evaluate(el => el.textContent.trim(), opt);
        if (t === 'Mr.' || t === 'Mr') {
          await opt.click();
          console.log('  Prefix: Mr.');
          break;
        }
      }
      break;
    }
  }
  await wait(500);

  // 4. First Name
  const fnInput = await page.$('input[name="legalName--firstName"]');
  if (fnInput) { await fnInput.click({ clickCount: 3 }); await fnInput.type(PROFILE.firstName, { delay: 20 }); }

  // 5. Last Name
  const lnInput = await page.$('input[name="legalName--lastName"]');
  if (lnInput) { await lnInput.click({ clickCount: 3 }); await lnInput.type(PROFILE.lastName, { delay: 20 }); }

  // 6. Address
  const addrInput = await page.$('input[name="addressLine1"]');
  if (addrInput) { await addrInput.click({ clickCount: 3 }); await addrInput.type(PROFILE.address, { delay: 20 }); }

  // 7. City
  const cityInput = await page.$('input[name="city"]');
  if (cityInput) { await cityInput.click({ clickCount: 3 }); await cityInput.type(PROFILE.city, { delay: 20 }); }

  // 8. Postcode
  const pcInput = await page.$('input[name="postalCode"]');
  if (pcInput) { await pcInput.click({ clickCount: 3 }); await pcInput.type(PROFILE.postcode, { delay: 20 }); }

  // 9. Phone
  const phoneInput = await page.$('input[name="phoneNumber"]');
  if (phoneInput) { await phoneInput.click({ clickCount: 3 }); await phoneInput.type(PROFILE.phone, { delay: 20 }); }

  console.log('  Text fields filled');
  await shot(page, 'step2_prefilled');

  // Save and Continue
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);
  for (const btn of await page.$$('button')) {
    const text = await page.evaluate(el => el.textContent.trim(), btn);
    if (text === 'Save and Continue') { await btn.click(); break; }
  }
  await wait(10000);
  await shot(page, 'step2_after_save');

  // Check if we advanced
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('Errors Found')) {
    const errors = await page.evaluate(() => {
      const box = document.querySelector('[data-automation-id="errorBanner"]') ||
                  document.querySelector('.css-1uux5fi');
      return box ? box.innerText : 'unknown errors';
    });
    console.log('[FAIL] Step 2 errors:', errors.slice(0, 200));
    return false;
  }

  if (pageText.includes('current step 3') || pageText.includes('My Experience')) {
    console.log('[OK] Step 2 complete - on My Experience');
    return true;
  }

  console.log('[UNKNOWN] Page state after save');
  return false;
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
    const step2ok = await fillMyInformation(page);

    if (step2ok) {
      console.log('\n=== STEP 3: My Experience ===');
      await shot(page, 'step3');
      const text = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      console.log(text.slice(0, 500));
    }
  } catch (e) {
    await shot(page, 'error');
    console.error('ERROR:', e.message);
  }

  console.log('\nBrowser open for inspection.');
  await wait(600000);
}

main();

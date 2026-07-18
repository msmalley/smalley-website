const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const PROFILE_PATH = path.resolve(__dirname, 'applicant-profile.json');
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function loadProfile() {
  return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'));
}

function loadDraft(draftPath) {
  return JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
}

function detectPlatform(url) {
  if (url.includes('myworkdayjobs.com') || url.includes('wd3.') || url.includes('wd5.')) return 'workday';
  if (url.includes('greenhouse.io')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('ashbyhq.com')) return 'ashby';
  if (url.includes('hibob.com')) return 'hibob';
  if (url.includes('successfactors')) return 'successfactors';
  if (url.includes('recruitee.com')) return 'recruitee';
  if (url.includes('workable.com')) return 'workable';
  return 'unknown';
}

async function screenshot(page, label) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${timestamp}_${label}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  [screenshot] ${filename}`);
  return filepath;
}

async function apply(draftPath, options = {}) {
  const { submit = false, headed = true } = options;
  const draft = loadDraft(draftPath);
  const profile = loadProfile();
  const applyUrl = draft.target.source_url;
  const platform = detectPlatform(applyUrl);

  console.log(`\n=== Job Application ===`);
  console.log(`  Company: ${draft.target.company}`);
  console.log(`  Role: ${draft.target.role}`);
  console.log(`  Platform: ${platform}`);
  console.log(`  URL: ${applyUrl}`);
  console.log(`  Submit: ${submit ? 'YES' : 'DRY RUN (no submit)'}`);
  console.log(`  CV: ${draft.target.cv_pdf}`);
  console.log('');

  let provider;
  try {
    provider = require(`./providers/${platform}.js`);
  } catch (e) {
    console.error(`No adapter for platform: ${platform}`);
    console.error(`Supported: workday, greenhouse, lever, ashby, hibob`);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: !headed,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    await provider.apply(page, { draft, profile, applyUrl, submit, screenshot: (label) => screenshot(page, label) });

    if (!submit) {
      console.log('\n  ✓ Dry run complete. All fields filled, NOT submitted.');
      console.log('  Run with --submit to actually submit the application.');
    } else {
      console.log('\n  ✓ Application submitted.');
    }
  } catch (e) {
    await screenshot(page, 'error');
    console.error(`\n  ✗ Error: ${e.message}`);
  } finally {
    if (!headed) await browser.close();
    else console.log('\n  Browser left open for inspection. Close manually when done.');
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const draftPath = args.find(a => !a.startsWith('--'));
  const submit = args.includes('--submit');
  const headless = args.includes('--headless');

  if (!draftPath) {
    console.log(`Apply for a job via Puppeteer form automation.

Usage:
  node apply-job.js <draft.json>              Dry run (fill but don't submit)
  node apply-job.js <draft.json> --submit     Fill and submit
  node apply-job.js <draft.json> --headless   Run without visible browser

The script:
  1. Detects the ATS platform from the job URL
  2. Loads the appropriate provider adapter
  3. Navigates, signs up/logs in, fills fields, uploads CV
  4. Screenshots each step for audit trail
  5. Stops before submit (unless --submit flag)
`);
    process.exit(0);
  }

  apply(draftPath, { submit, headed: !headless });
}

module.exports = { apply, detectPlatform };

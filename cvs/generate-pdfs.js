const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const cvs = [
  { file: 'cv_cto.html', pdf: 'Mark-Smalley-CV-CTO.pdf', screenshot: 'cv_cto.png' },
  { file: 'cv_regtech.html', pdf: 'Mark-Smalley-CV-RegTech.pdf', screenshot: 'cv_regtech.png' },
  { file: 'cv_devrel.html', pdf: 'Mark-Smalley-CV-DevRel.pdf', screenshot: 'cv_devrel.png' },
  { file: 'cv_fullstack.html', pdf: 'Mark-Smalley-CV-FullStack.pdf', screenshot: 'cv_fullstack.png' },
  { file: 'cv_generic.html', pdf: 'Mark-Smalley-CV.pdf', screenshot: 'cv_generic.png' },
  { file: 'cv_ai_engineer.html', pdf: 'Mark-Smalley-AI-Engineer.pdf', screenshot: 'cv_ai_engineer.png' },
  { file: 'cv_digital_assets_product.html', pdf: 'Mark-Smalley-Digital-Assets-Product.pdf', screenshot: 'cv_digital_assets_product.png' },
  { file: 'cv_ai_product_manager.html', pdf: 'Mark-Smalley-AI-Product-Manager.pdf', screenshot: 'cv_ai_product_manager.png' },
  { file: 'cv_senior_engineer_fintech.html', pdf: 'Mark-Smalley-Senior-Engineer-Fintech.pdf', screenshot: 'cv_senior_engineer_fintech.png' },
  { file: 'cv_tech_lead_devex.html', pdf: 'Mark-Smalley-Tech-Lead-DevEx.pdf', screenshot: 'cv_tech_lead_devex.png' },
  { file: 'cv_crypto_policy_specialist.html', pdf: 'Mark-Smalley-Crypto-Policy-Specialist.pdf', screenshot: 'cv_crypto_policy_specialist.png' },
  { file: 'cv_digital_money_product.html', pdf: 'Mark-Smalley-Digital-Money-Product.pdf', screenshot: 'cv_digital_money_product.png' },
];

// Pass names to rebuild only those CVs, e.g. `node generate-pdfs.js ai_product_manager`.
// A name matches when it appears in the HTML file name; no names rebuilds every CV.
const only = process.argv.slice(2).map(a => a.toLowerCase().replace(/\.html$/, ''));
const selected = only.length ? cvs.filter(cv => only.some(name => cv.file.toLowerCase().includes(name))) : cvs;
if (only.length && !selected.length) {
  console.error(`No CV matches: ${only.join(', ')}`);
  process.exit(1);
}

const htmlDir = path.resolve(__dirname, 'html');
const outDir = path.resolve(__dirname, 'dist');

async function generate() {
  // Only clear the CV artefacts this script regenerates. Cover letters also
  // live in dist/ and must survive a CV rebuild.
  fs.mkdirSync(outDir, { recursive: true });
  for (const cv of selected) {
    for (const name of [cv.pdf, cv.screenshot]) {
      const target = path.join(outDir, name);
      if (fs.existsSync(target)) fs.rmSync(target);
    }
  }

  const browser = await puppeteer.launch({ headless: true });

  for (const cv of selected) {
    const page = await browser.newPage();
    const filePath = path.join(htmlDir, cv.file);
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: path.join(outDir, cv.pdf),
      preferCSSPageSize: true,
      printBackground: true,
    });

    await page.setViewport({ width: 880, height: 1200 });
    await page.screenshot({
      path: path.join(outDir, cv.screenshot),
      fullPage: true,
    });

    console.log(`Generated: ${cv.pdf} + ${cv.screenshot}`);
    await page.close();
  }

  await browser.close();
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});

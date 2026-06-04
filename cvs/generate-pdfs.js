const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const cvs = [
  { file: 'cv_cto.html', pdf: 'Mark-Smalley-CV-CTO.pdf', screenshot: 'cv_cto.png' },
  { file: 'cv_regtech.html', pdf: 'Mark-Smalley-CV-RegTech.pdf', screenshot: 'cv_regtech.png' },
  { file: 'cv_devrel.html', pdf: 'Mark-Smalley-CV-DevRel.pdf', screenshot: 'cv_devrel.png' },
];

const htmlDir = path.resolve(__dirname, 'html');
const outDir = path.resolve(__dirname, 'dist');

async function generate() {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });

  for (const cv of cvs) {
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

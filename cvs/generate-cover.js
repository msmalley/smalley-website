const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const templatePath = path.resolve(__dirname, 'html/cover-letter-template.html');
const outDir = path.resolve(__dirname, 'dist');

const VARIANT_HEADLINES = {
  cto: 'Chief Technology Officer · Blockchain Protocol Architect · Engineering Leader',
  regtech: 'RegTech Engineering · Compliance Infrastructure · Digital Asset Policy',
  devrel: 'Developer Relations · SDK Architecture · Technical Advocacy'
};

function formatDate(dateStr) {
  if (dateStr) return dateStr;
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildProofPointsHtml(proofPoints) {
  return proofPoints.map(pp =>
    `<li><span class="requirement">${pp.requirement}:</span> <span class="evidence">${pp.evidence}</span></li>`
  ).join('\n        ');
}

function fillTemplate(template, data) {
  const headline = VARIANT_HEADLINES[data.variant] || VARIANT_HEADLINES.cto;

  return template
    .replace(/\{\{HEADLINE\}\}/g, headline)
    .replace(/\{\{DATE\}\}/g, formatDate(data.date))
    .replace(/\{\{COMPANY_NAME\}\}/g, data.company)
    .replace(/\{\{ROLE_TITLE\}\}/g, data.role)
    .replace(/\{\{OPENING_HOOK\}\}/g, data.opening)
    .replace(/\{\{PROOF_POINTS\}\}/g, buildProofPointsHtml(data.proof_points))
    .replace(/\{\{BODY_PARAGRAPH\}\}/g, data.body || '')
    .replace(/\{\{CLOSING_PARAGRAPH\}\}/g, data.closing);
}

async function generate(matchFile) {
  if (!matchFile) {
    console.error('Usage: node generate-cover.js <match-result.json>');
    console.error('       node generate-cover.js --stdin  (reads JSON from stdin)');
    process.exit(1);
  }

  let matchData;
  if (matchFile === '--stdin') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    matchData = JSON.parse(Buffer.concat(chunks).toString());
  } else {
    matchData = JSON.parse(fs.readFileSync(matchFile, 'utf-8'));
  }

  const template = fs.readFileSync(templatePath, 'utf-8');
  const filled = fillTemplate(template, matchData);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const slug = `${matchData.company.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${matchData.variant}`;
  const htmlOut = path.join(outDir, `cover-${slug}.html`);
  const pdfOut = path.join(outDir, `cover-${slug}.pdf`);

  fs.writeFileSync(htmlOut, filled);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${htmlOut}`, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: pdfOut,
    preferCSSPageSize: true,
    printBackground: true,
  });

  await browser.close();

  console.log(`Generated: ${pdfOut}`);
  return { html: htmlOut, pdf: pdfOut };
}

const arg = process.argv[2];
if (arg) {
  generate(arg).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { generate, fillTemplate };

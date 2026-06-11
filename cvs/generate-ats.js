const fs = require('fs');
const path = require('path');

const htmlDir = path.resolve(__dirname, 'html');
const atsDir = path.resolve(__dirname, 'ats');

const cvs = [
  { file: 'cv_cto.html', out: 'Mark-Smalley-CV-CTO.txt' },
  { file: 'cv_regtech.html', out: 'Mark-Smalley-CV-RegTech.txt' },
  { file: 'cv_devrel.html', out: 'Mark-Smalley-CV-DevRel.txt' },
];

function stripHtml(html) {
  html = html.replace(/<head[\s\S]*?<\/head>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<span class="sep">[^<]*<\/span>/gi, ' · ');
  html = html.replace(/<div class="contact-bar-inner">([\s\S]*?)<\/div>/gi, (m, inner) => {
    let line = inner.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1');
    line = line.replace(/<span[^>]*>([^<]*)<\/span>/gi, '$1');
    line = line.replace(/\s+/g, ' ').trim();
    return line + '\n';
  });
  html = html.replace(/<span class="job-title">([^<]*?)(<em[^>]*>[^<]*<\/em>)?<\/span>\s*<span class="job-company">([^<]*)<\/span>/gi, (m, title, em, company) => `${title.trim()} — ${company.trim()}`);
  html = html.replace(/<span class="job-dates">([^<]*)<\/span>/gi, ' ($1)');
  html = html.replace(/<div class="section-title">([^<]*)<\/div>/gi, '\n\n=== $1 ===\n');
  html = html.replace(/<div class="job-header">/gi, '\n');
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/p>/gi, '\n\n');
  html = html.replace(/<\/li>/gi, '\n');
  html = html.replace(/<\/div>/gi, '\n');
  html = html.replace(/<\/h[1-6]>/gi, '\n');
  html = html.replace(/<li[^>]*>/gi, '  • ');
  html = html.replace(/<h1[^>]*>/gi, '\n');
  html = html.replace(/<h2[^>]*>/gi, '\n');
  html = html.replace(/<em[^>]*>/gi, '');
  html = html.replace(/<\/em>/gi, '');
  html = html.replace(/<strong>/gi, '');
  html = html.replace(/<\/strong>/gi, '');
  html = html.replace(/<a[^>]*>/gi, '');
  html = html.replace(/<\/a>/gi, '');
  html = html.replace(/<code>/gi, '');
  html = html.replace(/<\/code>/gi, '');
  html = html.replace(/<[^>]+>/g, '');
  html = html.replace(/&nbsp;/g, ' ');
  html = html.replace(/&amp;/g, '&');
  html = html.replace(/&lt;/g, '<');
  html = html.replace(/&gt;/g, '>');
  html = html.replace(/&#8212;/g, '—');
  html = html.replace(/&mdash;/g, '—');
  html = html.replace(/&ndash;/g, '–');
  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.replace(/[ \t]+/g, ' ');
  html = html.replace(/^ +/gm, '');
  return html.trim();
}

function formatForAts(html) {
  let text = stripHtml(html);
  const lines = text.split('\n').map(l => l.trim()).filter((l, i, arr) => {
    if (l === '' && i > 0 && arr[i - 1] === '') return false;
    return true;
  });
  return lines.join('\n');
}

if (!fs.existsSync(atsDir)) fs.mkdirSync(atsDir, { recursive: true });

for (const cv of cvs) {
  const html = fs.readFileSync(path.join(htmlDir, cv.file), 'utf-8');
  const text = formatForAts(html);
  fs.writeFileSync(path.join(atsDir, cv.out), text, 'utf-8');
  console.log(`Generated: ${cv.out} (${text.length} chars)`);
}

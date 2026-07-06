const fs = require('fs');
const path = require('path');

const CV_DIR = path.resolve(__dirname, 'html');

const CV_FILES = {
  cto: 'cv_cto.html',
  regtech: 'cv_regtech.html',
  devrel: 'cv_devrel.html'
};

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProofPoints(variant) {
  const file = CV_FILES[variant];
  if (!file) throw new Error(`Unknown CV variant: ${variant}`);

  const htmlPath = path.join(CV_DIR, file);
  const html = fs.readFileSync(htmlPath, 'utf-8');

  const proofs = [];

  // Extract all <li> items — these are the bullet points in job sections
  const liRegex = /<li>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (text.length > 20 && text.length < 500) {
      proofs.push({ text, source: 'cv' });
    }
  }

  // Extract job summaries
  const summaryRegex = /<div class="job-summary">([\s\S]*?)<\/div>/gi;
  while ((match = summaryRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (text.length > 30) {
      proofs.push({ text, source: 'summary' });
    }
  }

  // Extract skills/domain values
  const skillValueRegex = /<span class="(?:skill|stack|domain)-value">([\s\S]*?)<\/span>/gi;
  while ((match = skillValueRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (text.length > 10) {
      proofs.push({ text, source: 'skills' });
    }
  }

  // Extract profile/summary paragraph
  const profileRegex = /<div class="section (?:profile|summary)">\s*<div class="section-title">[^<]+<\/div>\s*<p>([\s\S]*?)<\/p>/gi;
  while ((match = profileRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (text.length > 30) {
      proofs.push({ text, source: 'profile' });
    }
  }

  // Extract regulatory credentials list (regtech-specific)
  const regListRegex = /<ul class="reg-list">([\s\S]*?)<\/ul>/gi;
  while ((match = regListRegex.exec(html)) !== null) {
    const innerLi = /<li>([\s\S]*?)<\/li>/gi;
    let inner;
    while ((inner = innerLi.exec(match[1])) !== null) {
      const text = stripHtml(inner[1]);
      if (text.length > 20) {
        proofs.push({ text, source: 'credentials' });
      }
    }
  }

  // Extract content list items (devrel-specific)
  const contentListRegex = /<ul class="content-list">([\s\S]*?)<\/ul>/gi;
  while ((match = contentListRegex.exec(html)) !== null) {
    const innerLi = /<li>([\s\S]*?)<\/li>/gi;
    let inner;
    while ((inner = innerLi.exec(match[1])) !== null) {
      const text = stripHtml(inner[1]);
      if (text.length > 20) {
        proofs.push({ text, source: 'content' });
      }
    }
  }

  // Deduplicate by text content
  const seen = new Set();
  return proofs.filter(p => {
    const key = p.text.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Cache parsed results per session
const cache = {};

function getProofPoints(variant) {
  if (!cache[variant]) {
    cache[variant] = extractProofPoints(variant);
  }
  return cache[variant];
}

function clearCache() {
  Object.keys(cache).forEach(k => delete cache[k]);
}

if (require.main === module) {
  const variant = process.argv[2] || 'cto';
  const proofs = getProofPoints(variant);
  console.log(`\n${variant.toUpperCase()} CV: ${proofs.length} proof points extracted\n`);
  proofs.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.source}] ${p.text.slice(0, 100)}...`);
  });
  console.log(`  ... and ${proofs.length - 10} more\n`);
}

module.exports = { getProofPoints, clearCache, extractProofPoints };

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://smalley.my';

const portfolio = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/portfolio.json'), 'utf8'));
const opensource = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/opensource.json'), 'utf8'));
const speaking = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/speaking.json'), 'utf8'));
const thoughts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/thoughts.json'), 'utf8'));

// ── RSS Feed ──
function buildRSS() {
  var items = [];

  for (const t of thoughts) {
    items.push({
      title: t.title,
      link: `${DOMAIN}/thoughts/${t.slug}/`,
      date: t.date,
      desc: t.excerpt,
      category: 'Writing'
    });
  }

  for (const p of portfolio) {
    if (!p.slug) continue;
    items.push({
      title: p.title,
      link: `${DOMAIN}/portfolio/${p.slug}/`,
      date: p.year.includes('–') ? p.year.split('–')[0] + '-01-01' : p.year + '-01-01',
      desc: p.summary,
      category: 'Portfolio'
    });
  }

  for (const o of opensource) {
    if (!o.slug) continue;
    items.push({
      title: o.title,
      link: `${DOMAIN}/open-source/${o.slug}/`,
      date: '2025-01-01',
      desc: o.description,
      category: 'Open Source'
    });
  }

  const seen = new Set();
  for (const s of speaking) {
    if (!s.slug || seen.has(s.slug)) continue;
    seen.add(s.slug);
    items.push({
      title: s.title,
      link: `${DOMAIN}/speaking/${s.slug}/`,
      date: s.year + '-01-01',
      desc: s.description,
      category: 'Speaking'
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  function escXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toRFC822(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toUTCString();
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Mark Smalley</title>
  <link>${DOMAIN}/</link>
  <description>Protocol design, AI-augmented engineering, and building in public.</description>
  <language>en</language>
  <atom:link href="${DOMAIN}/feed.xml" rel="self" type="application/rss+xml"/>
`;

  for (const item of items) {
    xml += `  <item>
    <title>${escXml(item.title)}</title>
    <link>${item.link}</link>
    <guid>${item.link}</guid>
    <pubDate>${toRFC822(item.date)}</pubDate>
    <category>${item.category}</category>
    <description>${escXml(item.desc)}</description>
  </item>
`;
  }

  xml += `</channel>
</rss>
`;

  fs.writeFileSync(path.join(ROOT, 'feed.xml'), xml);
  console.log(`Generated feed.xml (${items.length} items)`);
}

// ── Sitemap ──
function buildSitemap() {
  const pages = [];

  // Find all index.html files (excluding node_modules and cvs internals)
  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'build') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip cvs/html and cvs/dist (not public pages)
        if (prefix === '/cvs/' && (entry.name === 'html' || entry.name === 'dist' || entry.name === 'node_modules')) continue;
        walk(full, prefix + entry.name + '/');
      } else if (entry.name === 'index.html') {
        pages.push(prefix);
      }
    }
  }

  walk(ROOT, '/');

  // Add non-index pages
  pages.push('/feed.xml');

  pages.sort();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const page of pages) {
    const priority = page === '/' ? '1.0' : page.split('/').length <= 3 ? '0.8' : '0.6';
    xml += `  <url>
    <loc>${DOMAIN}${page}</loc>
    <priority>${priority}</priority>
  </url>
`;
  }

  xml += `</urlset>
`;

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
  console.log(`Generated sitemap.xml (${pages.length} URLs)`);
}

buildRSS();
buildSitemap();

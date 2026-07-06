const fs = require('fs');
const path = require('path');
const { matchJob } = require('./match-job.js');

const jobsPath = path.resolve(__dirname, 'jobs.json');

function loadJobs() {
  return JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));
}

function saveJobs(data) {
  fs.writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n');
}

async function followRedirect(url) {
  const res = await fetch(url, { redirect: 'manual' });
  if (res.status === 302 || res.status === 301) {
    return res.headers.get('location');
  }
  return url;
}

async function fetchWeb3CareerJD(url) {
  const pageUrl = await followRedirect(url);
  if (!pageUrl.includes('web3.career')) return null;

  const res = await fetch(pageUrl);
  if (!res.ok) return null;
  const html = await res.text();

  // Prefer JSON-LD structured data (clean, no HTML noise)
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      if (ld.description && ld.description.length > 100) {
        return ld.description.replace(/\s+/g, ' ').trim();
      }
    } catch (e) { /* fall through to HTML extraction */ }
  }

  // Fallback: extract from og:description
  const ogMatch = html.match(/<meta property="og:description" content="([^"]*)"/i);
  if (ogMatch && ogMatch[1].length > 100) {
    return ogMatch[1].replace(/\s+/g, ' ').trim();
  }

  return null;
}

async function backfill() {
  const all = process.argv.includes('--all');
  const data = loadJobs();
  const jobs = data.jobs || data;

  const targets = jobs.filter(j => {
    if (!j.source_url || !j.source_url.includes('web3.career')) return false;
    if (all) return true;
    const conf = j.confidence || (j.requirements_found >= 8 ? 'high' : j.requirements_found >= 5 ? 'medium' : 'low');
    return conf === 'low';
  });

  console.log(`Backfilling ${targets.length} low-confidence jobs with web3.career URLs...\n`);

  let fetched = 0;
  let scored = 0;

  for (const job of targets) {
    try {
      const jd = await fetchWeb3CareerJD(job.source_url);
      if (!jd) {
        console.log(`  SKIP ${job.company} - ${job.role} (no JD found)`);
        continue;
      }
      fetched++;

      const result = matchJob(jd);
      job.score = result.score;
      job.scores = result.scores;
      job.confidence = result.confidence;
      job.variant = result.variant;
      job.requirements_found = result.requirements_found;
      job.matched = result.matched;
      job.gaps = result.gaps;
      job.proof_points = result.proof_points;

      const spread = Math.max(result.scores.cto, result.scores.regtech, result.scores.devrel) -
                     Math.min(result.scores.cto, result.scores.regtech, result.scores.devrel);
      console.log(`  [${result.confidence}] ${job.company} - ${job.role} | CTO:${result.scores.cto} REG:${result.scores.regtech} DEV:${result.scores.devrel} (spread:${spread})`);
      scored++;

      await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
    } catch (e) {
      console.log(`  ERROR ${job.company} - ${job.role}: ${e.message}`);
    }
  }

  if (Array.isArray(data)) {
    fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2) + '\n');
  } else {
    saveJobs(data);
  }

  console.log(`\nDone. Fetched: ${fetched}, Scored: ${scored}/${targets.length}`);
}

backfill().catch(e => { console.error(e); process.exit(1); });

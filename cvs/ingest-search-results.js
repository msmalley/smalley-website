const fs = require('fs');
const path = require('path');
const { classifyAll, fetchAndEnrich } = require('./enrich-jobs.js');
const { matchJob } = require('./match-job.js');

const jobsPath = path.resolve(__dirname, 'jobs.json');

function loadJobs() {
  return JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));
}

function saveJobs(data) {
  fs.writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n');
}

function generateId(company, role) {
  const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `${slug}-${Date.now().toString(36)}`;
}

const COMPANY_ALIASES = {
  'tether operations limited': 'tether',
  'cow dao (cow swap)': 'cow dao',
  'cow protocol (cow swap)': 'cow dao',
  'cow dao': 'cow dao',
};

function normCompany(s) {
  const lower = (s || '').toLowerCase().trim();
  return COMPANY_ALIASES[lower] || lower.replace(/[^a-z0-9]/g, '');
}

function normRole(s) {
  return (s || '').toLowerCase()
    .replace(/\(100%\s*remote.*?\)/g, '')
    .replace(/\(remote.*?\)/g, '')
    .replace(/worldwide/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isDuplicate(existing, candidate) {
  const candCompany = normCompany(candidate.company);
  const candRole = normRole(candidate.title);

  for (const job of existing) {
    const jobLid = job.linkedin_job_id || (job.channel && job.channel.linkedin_job_id);
    if (jobLid && candidate.job_id && String(jobLid) === String(candidate.job_id)) return true;
    const cMatch = normCompany(job.company) === candCompany;
    const rMatch = normRole(job.role) === candRole;
    if (cMatch && rMatch && candCompany) return true;
  }
  return false;
}

function loadArchive() {
  const archivePath = path.resolve(__dirname, 'jobs-archive.json');
  if (!fs.existsSync(archivePath)) return [];
  const data = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
  return data.jobs || [];
}

const REJECT_COMPANIES = [
  'tether', 'tether operations limited',
];

const REJECT_TITLES = [
  // Sales / BD / marketing
  'business development', 'sales director', 'sales manager', 'account executive',
  'account manager', 'country manager', 'marketing lead', 'marketing manager',
  'marketing strategy', 'growth manager',
  // Content / social / design
  'content creator', 'social media', 'social account manager', 'graphic design',
  'ui/ux designer', 'ux researcher', 'copywriter',
  // HR / legal / finance / ops
  'recruiter', 'talent acquisition', 'people technology',
  'legal counsel', 'legal lead', 'legal operations', 'corporate counsel', 'litigator', 'paralegal',
  'accountant', 'bookkeeper', 'finance lead', 'finance manager', 'head of finance', 'finance director',
  'customer support', 'customer success',
  // Junior / intern
  'intern', 'junior developer', 'junior engineer', 'junior front-end',
  'junior social', 'junior ip',
  // IC dev roles (no leadership)
  'rust developer', 'rust engineer', 'solidity developer', 'smart contract engineer',
  'solana developer', 'blockchain developer', 'blockchain engineer',
  'qa engineer', 'quality engineer', 'test engineer', 'sdet', 'security engineer',
  'data scientist', 'data analyst', 'data engineer', 'ml engineer', 'machine learning engineer',
  'mobile engineer', 'android developer', 'ios developer',
  'devops engineer', 'sre', 'site reliability',
  'full stack developer', 'frontend developer', 'backend developer',
  'integrations engineer', 'software architect', 'technical architect',
  // Analyst-level roles
  'governance analyst', 'compliance analyst', 'compliance case analyst',
  'research analyst', 'risk analyst'
];

const REJECT_PATTERNS = [
  /^senior\s+(software|blockchain|data|backend|frontend|full.?stack|smart contract|mobile|platform)\s+engineer/i,
  /^staff\s+(software|blockchain|data|backend|frontend|mobile)\s+engineer/i,
  /^principal\s+.*engineer/i,
  /^(senior|staff|lead)\s+.*developer$/i,
  /product\s+engineer$/i,
  /technical product manager/i,
  /product owner/i,
  /\blegal\b/i,
  /co-?founder/i
];

function isIrrelevantRole(title, company) {
  if (company && REJECT_COMPANIES.some(r => company.toLowerCase().includes(r))) return true;
  if (!title) return false;
  const t = title.toLowerCase();
  if (REJECT_TITLES.some(r => t.includes(r))) return true;
  if (REJECT_PATTERNS.some(rx => rx.test(title))) return true;
  return false;
}

const US_LOCATIONS = [
  'united states', ', us', ' us ', 'new york', 'san francisco', 'austin', 'dallas',
  'tampa', 'jersey city', 'durham', 'indiana', 'california', 'boston', 'seattle',
  'chicago', 'miami', 'denver', 'atlanta', 'phoenix', 'washington dc', 'los angeles',
  'portland', ' tx ', ' ny ', ' ca ', ' fl ', ' co ', ' wa ', ' ma ', ' ga ', ' az ',
  'north carolina', 'virginia', 'maryland', 'connecticut', 'pennsylvania'
];

function isIrrelevantLocation(location) {
  if (!location) return false;
  const loc = location.toLowerCase().trim();
  // Allow "Remote" even if it mentions US (might be globally remote)
  if (loc === 'remote' || loc === 'worldwide' || loc === 'global') return false;
  // Filter US-only locations (not remote)
  if (US_LOCATIONS.some(us => loc.includes(us))) {
    // But allow if also marked remote/global
    if (loc.includes('remote') || loc.includes('global') || loc.includes('worldwide')) return false;
    return true;
  }
  return false;
}

function ingest(searchResults) {
  const data = loadJobs();
  const existing = data.jobs;
  const archived = loadArchive();
  const allKnown = existing.concat(archived);
  let added = 0;
  let skipped = 0;
  const newIds = [];

  const candidates = Array.isArray(searchResults) ? searchResults : (searchResults.jobs || []);

  let filtered = 0;
  for (const c of candidates) {
    if (isDuplicate(allKnown, c)) {
      skipped++;
      continue;
    }

    if (isIrrelevantRole(c.title, c.company)) {
      filtered++;
      continue;
    }

    if (isIrrelevantLocation(c.location)) {
      filtered++;
      continue;
    }

    const id = generateId(c.company || 'unknown', c.title || 'unknown');

    // Score immediately if description available from API (web3.career, etc)
    let scored = null;
    if (c.description && c.description.length > 50) {
      scored = matchJob(c.description);
    }

    const job = {
      id,
      added: new Date().toISOString().split('T')[0],
      status: scored ? (scored.score >= 50 ? 'new' : 'low_match') : 'discovered',
      company: c.company || '',
      role: c.title || '',
      location: c.location || '',
      variant: scored ? scored.variant : null,
      score: scored ? scored.score : null,
      scores: scored ? scored.scores : null,
      confidence: scored ? scored.confidence : null,
      requirements_found: scored ? scored.requirements_found : null,
      matched: scored ? scored.matched : null,
      gaps: scored ? scored.gaps : [],
      proof_points: scored ? scored.proof_points : [],
      source_url: (c.url || '').replace(/^(https?:\/\/)uk\.linkedin\.com/, '$1www.linkedin.com')
        || (c.job_id ? `https://www.linkedin.com/jobs/view/${c.job_id}/` : ''),
      source: c.source || 'unknown',
      linkedin_job_id: c.job_id || ((c.url || '').match(/(\d{10,})/) || [])[1] || null,
      cover_letter: null,
      notes: `Auto-discovered ${new Date().toISOString().split('T')[0]}. Posted: ${c.posted || 'unknown'}.`
    };

    existing.push(job);
    newIds.push(id);
    added++;
  }

  saveJobs(data);
  classifyAll(true);

  return { added, skipped, filtered, total: existing.length, newIds: newIds };
}

async function fetchAndScore(newIds) {
  if (!newIds || newIds.length === 0) return { fetched: 0, scored: 0 };

  let load;
  try {
    ({ load } = await import('cheerio'));
  } catch {
    const cheerioPath = path.resolve(__dirname, '../mcp/social/node_modules/cheerio/dist/commonjs/index.js');
    ({ load } = require(cheerioPath));
  }

  const data = loadJobs();
  const targetJobs = data.jobs.filter(j => newIds.includes(j.id) && j.linkedin_job_id);
  let fetched = 0;
  let scored = 0;

  for (const job of targetJobs) {
    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${job.linkedin_job_id}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (response.status === 999) {
        console.log(`  Rate limited at job ${fetched + 1}. Stopping fetch.`);
        break;
      }
      if (!response.ok) {
        console.log(`  ${job.company} - ${job.role}: HTTP ${response.status}`);
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
        continue;
      }

      const html = await response.text();
      const $ = load(html);
      const description = $('div.description__text, div.show-more-less-html__markup').text().trim();
      fetched++;

      if (description && description.length > 50) {
        const result = matchJob(description);
        job.score = result.score;
        job.scores = result.scores;
        job.confidence = result.confidence;
        job.variant = result.variant;
        job.requirements_found = result.requirements_found;
        job.matched = result.matched;
        job.gaps = result.gaps;
        job.proof_points = result.proof_points;
        job.status = result.score >= 50 ? 'new' : 'low_match';
        scored++;
        console.log(`  [${result.score}] ${job.company} - ${job.role} (${result.variant}, ${result.confidence})`);
      }

      if (job.channel) job.channel._fetched = true;
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    } catch (e) {
      console.log(`  ${job.company} - ${job.role}: error - ${e.message}`);
    }
  }

  saveJobs(data);
  return { fetched, scored };
}

const MIN_REQUIREMENTS = 10;

async function validateAndRefetch() {
  let load;
  try {
    ({ load } = await import('cheerio'));
  } catch {
    const cheerioPath = path.resolve(__dirname, '../mcp/social/node_modules/cheerio/dist/commonjs/index.js');
    ({ load } = require(cheerioPath));
  }

  const data = loadJobs();
  const underScored = data.jobs.filter(j =>
    j.requirements_found != null && j.requirements_found < MIN_REQUIREMENTS && j.linkedin_job_id
  );

  if (!underScored.length) {
    console.log('All jobs have adequate requirement extraction (>= ' + MIN_REQUIREMENTS + ').');
    return { refetched: 0, improved: 0, still_thin: 0 };
  }

  console.log(`Validating ${underScored.length} jobs with <${MIN_REQUIREMENTS} requirements...`);
  let refetched = 0, improved = 0, still_thin = 0;

  for (const job of underScored) {
    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${job.linkedin_job_id}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (response.status === 999) {
        console.log(`  Rate limited after ${refetched} fetches.`);
        break;
      }
      if (!response.ok) continue;

      const html = await response.text();
      const $ = load(html);
      const description = $('div.description__text, div.show-more-less-html__markup').text().trim();
      refetched++;

      if (description && description.length > 100) {
        const result = matchJob(description);
        if (result.requirements_found >= MIN_REQUIREMENTS) {
          const oldReqs = job.requirements_found;
          job.score = result.score;
          job.scores = result.scores;
          job.confidence = result.confidence;
          job.variant = result.variant;
          job.requirements_found = result.requirements_found;
          job.matched = result.matched;
          job.gaps = result.gaps;
          job.proof_points = result.proof_points;
          job.status = result.score >= 50 ? 'new' : 'low_match';
          improved++;
          console.log(`  ✓ [${oldReqs}->${result.requirements_found} reqs] ${job.company}: ${job.role} (${result.score}, ${result.variant})`);
        } else {
          still_thin++;
          job.status = 'needs_jd';
          console.log(`  ✗ ${job.company}: ${job.role} — still thin (${result.requirements_found} reqs), marked needs_jd`);
        }
      } else {
        still_thin++;
        job.status = 'needs_jd';
        console.log(`  ✗ ${job.company}: ${job.role} — no description available, marked needs_jd`);
      }

      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    } catch (e) {
      console.log(`  ${job.company}: ${job.role} — error: ${e.message}`);
    }
  }

  saveJobs(data);
  console.log(`\nValidation complete: ${improved} improved, ${still_thin} still thin, ${refetched} fetched.`);
  return { refetched, improved, still_thin };
}

function ingestFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const results = JSON.parse(raw);
  return ingest(results);
}

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.log(`Ingest search results into job pipeline.

Usage:
  node ingest-search-results.js <results.json>     Ingest from file
  echo '{"jobs":[...]}' | node ingest-search-results.js --stdin   Ingest from stdin
  node ingest-search-results.js --validate         Re-fetch jobs with <${MIN_REQUIREMENTS} requirements
  node ingest-search-results.js --score-pending    Score all discovered/unscored jobs
  node ingest-search-results.js --check-open       Verify all LinkedIn jobs are still open

Options:
  --no-score       Skip fetching descriptions and scoring (classify only)
  --validate       Re-fetch and re-score under-extracted jobs
  --score-pending  Fetch descriptions and score jobs stuck in discovered/new
  --check-open     Hit LinkedIn API to verify jobs are still accepting applications
`);
    process.exit(0);
  }

  if (arg === '--check-open') {
    (async () => {
      const data = loadJobs();
      const withId = data.jobs.filter(j => j.linkedin_job_id);
      console.log(`Checking ${withId.length} jobs for liveness...`);
      const closed = [];
      for (const j of withId) {
        try {
          const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${j.linkedin_job_id}`;
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } });
          if (res.status === 404 || res.status === 403) { closed.push(j); console.log(`  CLOSED: ${j.company} — ${j.role}`); }
          else if (res.status === 999) { console.log('  Rate limited, stopping.'); break; }
          else {
            const html = await res.text();
            if (html.includes('No longer accepting') || html.includes('no longer available')) { closed.push(j); console.log(`  CLOSED: ${j.company} — ${j.role}`); }
          }
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) { /* skip */ }
      }
      if (closed.length > 0) {
        const archivePath = path.resolve(__dirname, 'jobs-archive.json');
        let archive = { jobs: [], updated: '' };
        if (fs.existsSync(archivePath)) archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
        for (const j of closed) {
          j.status = 'closed';
          archive.jobs.push(j);
          data.jobs = data.jobs.filter(x => x.id !== j.id);
        }
        archive.updated = new Date().toISOString().split('T')[0];
        fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2) + '\n');
        saveJobs(data);
      }
      console.log(`\nDone: ${closed.length} closed, ${data.jobs.length} remaining.`);
    })();
  } else if (arg === '--validate') {
    validateAndRefetch().catch(e => console.error(e.message));
  } else if (arg === '--score-pending') {
    const data = loadJobs();
    const pending = data.jobs.filter(j => j.id && (j.status === 'discovered' || (j.status === 'new' && j.score == null)));
    const ids = pending.map(j => j.id);
    console.log(`Scoring ${ids.length} pending jobs (discovered + unscored new)...`);
    if (ids.length === 0) { console.log('Nothing to score.'); process.exit(0); }
    fetchAndScore(ids).then(r => {
      console.log(`\nScored: ${r.scored}/${r.fetched} fetched jobs.`);
    }).catch(e => console.error(e.message));
  } else {
    const noScore = process.argv.includes('--no-score');

    let result;
    if (arg === '--stdin') {
      const input = fs.readFileSync(0, 'utf-8');
      result = ingest(JSON.parse(input));
    } else {
      result = ingestFromFile(arg);
    }

    console.log(`Ingested: ${result.added} new, ${result.skipped} duplicates, ${result.filtered} irrelevant filtered. Total pipeline: ${result.total}`);

    if (result.added > 0 && !noScore) {
      console.log(`\nFetching descriptions and scoring ${result.added} new jobs...`);
      fetchAndScore(result.newIds).then(async (scoreResult) => {
        console.log(`Scored: ${scoreResult.scored}/${scoreResult.fetched} fetched jobs.`);
        console.log(`\nRunning validation pass...`);
        await validateAndRefetch();
      }).catch(e => {
        console.error(`Scoring error: ${e.message}`);
      });
    }
  }
}

module.exports = { ingest, isDuplicate, fetchAndScore, validateAndRefetch };

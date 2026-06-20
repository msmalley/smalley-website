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

function isDuplicate(existing, candidate) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const job of existing) {
    const jobLid = job.linkedin_job_id || (job.channel && job.channel.linkedin_job_id);
    if (jobLid && candidate.job_id && String(jobLid) === String(candidate.job_id)) return true;
    const cMatch = norm(job.company) === norm(candidate.company);
    const rMatch = norm(job.role) === norm(candidate.title);
    if (cMatch && rMatch && norm(job.company)) return true;
  }
  return false;
}

function ingest(searchResults) {
  const data = loadJobs();
  const existing = data.jobs;
  let added = 0;
  let skipped = 0;
  const newIds = [];

  const candidates = Array.isArray(searchResults) ? searchResults : (searchResults.jobs || []);

  for (const c of candidates) {
    if (isDuplicate(existing, c)) {
      skipped++;
      continue;
    }

    const id = generateId(c.company || 'unknown', c.title || 'unknown');
    const job = {
      id,
      added: new Date().toISOString().split('T')[0],
      status: 'discovered',
      company: c.company || '',
      role: c.title || '',
      location: c.location || '',
      variant: null,
      score: null,
      requirements_found: null,
      matched: null,
      gaps: [],
      proof_points: [],
      source_url: (c.url || '').replace(/^(https?:\/\/)uk\.linkedin\.com/, '$1www.linkedin.com'),
      source: c.source || 'unknown',
      linkedin_job_id: c.job_id || null,
      cover_letter: null,
      notes: `Auto-discovered ${new Date().toISOString().split('T')[0]}. Posted: ${c.posted || 'unknown'}.`
    };

    existing.push(job);
    newIds.push(id);
    added++;
  }

  saveJobs(data);
  classifyAll(true);

  return { added, skipped, total: existing.length, newIds: newIds };
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
        job.variant = result.variant;
        job.requirements_found = result.requirements_found;
        job.matched = result.matched;
        job.gaps = result.gaps;
        job.proof_points = result.proof_points;
        job.status = result.score >= 50 ? 'new' : 'low_match';
        scored++;
        console.log(`  [${result.score}] ${job.company} - ${job.role} (${result.variant})`);
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

Options:
  --no-score    Skip fetching descriptions and scoring (classify only)
`);
    process.exit(0);
  }

  const noScore = process.argv.includes('--no-score');

  let result;
  if (arg === '--stdin') {
    const input = fs.readFileSync(0, 'utf-8');
    result = ingest(JSON.parse(input));
  } else {
    result = ingestFromFile(arg);
  }

  console.log(`Ingested: ${result.added} new, ${result.skipped} duplicates skipped. Total pipeline: ${result.total}`);

  if (result.added > 0 && !noScore) {
    console.log(`\nFetching descriptions and scoring ${result.added} new jobs...`);
    fetchAndScore(result.newIds).then(scoreResult => {
      console.log(`\nScored: ${scoreResult.scored}/${scoreResult.fetched} fetched jobs.`);
    }).catch(e => {
      console.error(`Scoring error: ${e.message}`);
    });
  }
}

module.exports = { ingest, isDuplicate, fetchAndScore };

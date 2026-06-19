const fs = require('fs');
const path = require('path');
const { classifyAll } = require('./enrich-jobs.js');

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
  const normCompany = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normRole = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const job of existing) {
    if (job.linkedin_job_id && candidate.job_id && job.linkedin_job_id === candidate.job_id) return true;
    const cMatch = normCompany(job.company) === normCompany(candidate.company || '');
    const rMatch = normRole(job.role) === normRole(candidate.title || '');
    if (cMatch && rMatch) return true;
  }
  return false;
}

function ingest(searchResults) {
  const data = loadJobs();
  const existing = data.jobs;
  let added = 0;
  let skipped = 0;

  const candidates = Array.isArray(searchResults) ? searchResults : (searchResults.jobs || []);

  for (const c of candidates) {
    if (isDuplicate(existing, c)) {
      skipped++;
      continue;
    }

    const job = {
      id: generateId(c.company || 'unknown', c.title || 'unknown'),
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
    added++;
  }

  saveJobs(data);
  classifyAll(true);

  return { added, skipped, total: existing.length };
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
`);
    process.exit(0);
  }

  let result;
  if (arg === '--stdin') {
    const input = fs.readFileSync(0, 'utf-8');
    result = ingest(JSON.parse(input));
  } else {
    result = ingestFromFile(arg);
  }

  console.log(`Ingested: ${result.added} new, ${result.skipped} duplicates skipped. Total pipeline: ${result.total}`);
}

module.exports = { ingest, isDuplicate };

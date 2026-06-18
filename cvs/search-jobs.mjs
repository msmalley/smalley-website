import { searchLinkedInJobs, fetchLinkedInJobDescription } from '../mcp/social/providers/linkedin-jobs.js';
import { searchCryptoJobs } from '../mcp/social/providers/job-boards.js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const jobsPath = resolve(import.meta.dirname, 'jobs.json');

function loadJobs() {
  return JSON.parse(readFileSync(jobsPath, 'utf-8'));
}

function saveJobs(data) {
  writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n');
}

function dedupKey(job) {
  return `${job.title}|${job.company}`.toLowerCase();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Title-based filtering: reject roles that are clearly wrong level or domain
const TITLE_REJECT_PATTERNS = [
  /\bjunior\b/i,
  /\bintern\b/i,
  /\bgraduate\b/i,
  /\bentry.level\b/i,
  /\bmid.level\b/i,
  /\bassistant\b/i,
  /\btrainee\b/i,
  /\bapprentice\b/i,
  /\baccountant\b/i,
  /\bnurse\b/i,
  /\bteacher\b/i,
  /\bsales rep\b/i,
  /\bcustomer service\b/i,
  /\brecruiter\b/i,
  /\bhr manager\b/i,
  /\bmarketing manager\b/i,
  /\boperations manager\b/i,
  /\boffice manager\b/i,
  /\bwarehouse\b/i,
  /\bdriver\b/i,
  /\bcleaner\b/i,
  /\breceptionist\b/i,
  /\badmin\b/i,
  /\bbook.?keeper\b/i,
  /\bchef\b/i,
  /\bbarista\b/i,
];

// Titles that strongly suggest relevance
const TITLE_ACCEPT_PATTERNS = [
  /\bcto\b/i,
  /\bchief.?tech/i,
  /\bhead of engineering\b/i,
  /\bvp.?engineer/i,
  /\bengineering director\b/i,
  /\btechnical director\b/i,
  /\bhead of.*(platform|product|r&d|innovation|ai|protocol)\b/i,
  /\bprincipal engineer\b/i,
  /\bstaff engineer\b/i,
  /\bfounding engineer\b/i,
  /\bblockchain\b/i,
  /\bcrypto\b/i,
  /\bweb3\b/i,
  /\bprotocol\b/i,
  /\bdevrel\b/i,
  /\bdeveloper.?relat/i,
  /\bdeveloper.?advoc/i,
  /\btechnical.?evangel/i,
  /\bdeveloper.?experience\b/i,
  /\bsdk\b/i,
  /\bregtech\b/i,
  /\bcompliance.*(tech|engineer|lead)\b/i,
  /\bdigital.?asset/i,
  /\bfintech\b/i,
  /\barchitect\b/i,
  /\bhead of\b/i,
  /\bdirector\b/i,
  /\blead engineer\b/i,
];

function isRelevantTitle(title) {
  if (!title) return false;
  if (TITLE_REJECT_PATTERNS.some(p => p.test(title))) return false;
  if (TITLE_ACCEPT_PATTERNS.some(p => p.test(title))) return true;
  // If neither reject nor accept matched, include it (might be a generic "CTO" with no qualifier)
  return true;
}

function loadDiscoveryHistory() {
  const historyPath = resolve(import.meta.dirname, 'jobs-discovery-history.json');
  try {
    return JSON.parse(readFileSync(historyPath, 'utf-8'));
  } catch {
    return { sweeps: [], all_seen_keys: [] };
  }
}

function saveDiscoveryHistory(history) {
  const historyPath = resolve(import.meta.dirname, 'jobs-discovery-history.json');
  writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');
}

async function runSearch(search, config, timeWindow) {
  const pages = config.pages_per_search || 6;
  const perPage = config.results_per_page || 25;
  const delay = config.delay_between_requests_ms || 3000;
  const allResults = [];

  for (let page = 0; page < pages; page++) {
    try {
      const opts = {
        keywords: search.keywords,
        location: search.location,
        posted_within: timeWindow,
        start: page * perPage
      };
      if (search.workplace) opts.workplace = search.workplace;
      if (config.experience_level) opts.experience = config.experience_level;

      const results = await searchLinkedInJobs(opts);
      allResults.push(...results.jobs);
      if (results.jobs.length < 5) break;
      if (page < pages - 1) await sleep(delay);
    } catch (e) {
      if (e.message.includes('999')) {
        console.log(`  ⚠ Rate limited on page ${page + 1}, stopping this search`);
        break;
      }
      console.log(`  ✗ Error page ${page + 1}: ${e.message}`);
      break;
    }
  }

  return allResults;
}

async function main() {
  const data = loadJobs();
  const { searches, search_config: config } = data.config;
  const history = loadDiscoveryHistory();

  const existingKeys = new Set([
    ...data.jobs.map(j => dedupKey(j)),
    ...history.all_seen_keys
  ]);
  const sessionKeys = new Set();
  const newJobs = [];
  let filtered = 0;

  const lastSweep = config.last_full_sweep;
  const timeWindow = lastSweep ? '7d' : '30d';

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Job Search Sweep                            ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Searches: ${String(searches.length).padEnd(4)} | Pages: ${config.pages_per_search}   | Window: ${timeWindow.padEnd(4)} ║`);
  console.log(`║  Known: ${String(existingKeys.size).padEnd(6)} | Experience: ${(config.experience_level || 'any').padEnd(10)} ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  for (let i = 0; i < searches.length; i++) {
    const search = searches[i];
    const label = `[${String(i + 1).padStart(2)}/${searches.length}]`;
    process.stdout.write(`${label} "${search.keywords}" → ${search.location}${search.workplace ? ' [' + search.workplace + ']' : ''} ... `);

    const results = await runSearch(search, config, timeWindow);
    let added = 0;
    let rejected = 0;

    for (const job of results) {
      const key = dedupKey(job);
      if (existingKeys.has(key) || sessionKeys.has(key)) continue;

      if (!isRelevantTitle(job.title)) {
        rejected++;
        filtered++;
        continue;
      }

      sessionKeys.add(key);
      newJobs.push({
        title: job.title,
        company: job.company,
        location: job.location,
        posted: job.posted,
        url: job.url,
        job_id: job.job_id,
        variant: search.variant,
        search_keywords: search.keywords
      });
      added++;
    }

    const msg = `${results.length} found, ${added} new` + (rejected > 0 ? `, ${rejected} filtered` : '');
    console.log(msg);

    if (i < searches.length - 1) await sleep(config.delay_between_requests_ms || 3000);
  }

  // Also check crypto.jobs
  process.stdout.write(`\n[crypto.jobs] RSS feed ... `);
  try {
    const cj = await searchCryptoJobs({ keywords: 'CTO engineering head devrel architect protocol' });
    let cjAdded = 0;
    for (const job of cj.jobs) {
      const key = dedupKey(job);
      if (existingKeys.has(key) || sessionKeys.has(key)) continue;
      if (!isRelevantTitle(job.title)) { filtered++; continue; }
      sessionKeys.add(key);
      newJobs.push({
        title: job.title,
        company: job.company,
        location: job.location,
        posted: job.posted,
        url: job.url,
        job_id: null,
        variant: 'cto',
        search_keywords: 'crypto.jobs RSS'
      });
      cjAdded++;
    }
    console.log(`${cj.count} found, ${cjAdded} new`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  console.log(`\n══════════════════════════════════════════════`);
  console.log(`  New jobs discovered: ${newJobs.length}`);
  console.log(`  Title-filtered out:  ${filtered}`);
  console.log(`  Already known:       ${existingKeys.size + sessionKeys.size - newJobs.length}`);
  console.log(`══════════════════════════════════════════════`);

  // Update discovery history
  const allSeenKeys = new Set([...history.all_seen_keys, ...sessionKeys]);
  history.sweeps.push({
    date: new Date().toISOString(),
    searches_run: searches.length,
    time_window: timeWindow,
    new_found: newJobs.length,
    filtered_out: filtered
  });
  history.all_seen_keys = [...allSeenKeys];
  saveDiscoveryHistory(history);

  if (newJobs.length === 0) {
    console.log('\nNo new jobs to process.');
    return;
  }

  // Save raw discovery for review
  const discoveryPath = resolve(import.meta.dirname, 'jobs-discovery.json');
  const discovery = {
    searched: new Date().toISOString(),
    searches_run: searches.length,
    new_jobs: newJobs.length,
    jobs: newJobs
  };
  writeFileSync(discoveryPath, JSON.stringify(discovery, null, 2) + '\n');

  console.log(`\nSaved to jobs-discovery.json`);
  console.log(`\nTop discoveries:`);
  newJobs.slice(0, 20).forEach(j =>
    console.log(`  • ${j.title} @ ${j.company} | ${j.location}`)
  );

  // Update last sweep date
  data.config.search_config.last_full_sweep = new Date().toISOString().split('T')[0];
  saveJobs(data);
}

main().catch(e => { console.error(e); process.exit(1); });

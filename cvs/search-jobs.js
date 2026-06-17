import { searchLinkedInJobs } from '../mcp/social/providers/linkedin-jobs.js';
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

async function runSearch(search, config) {
  const pages = config.pages_per_search || 4;
  const perPage = config.results_per_page || 25;
  const delay = config.delay_between_requests_ms || 4000;
  const allResults = [];

  for (let page = 0; page < pages; page++) {
    try {
      const results = await searchLinkedInJobs({
        keywords: search.keywords,
        location: search.location,
        posted_within: '30d',
        start: page * perPage
      });
      allResults.push(...results.jobs);
      if (results.jobs.length < 5) break;
      if (page < pages - 1) await sleep(delay);
    } catch (e) {
      if (e.message.includes('999')) {
        console.log(`  Rate limited on page ${page + 1}, stopping this search`);
        break;
      }
      console.log(`  Error page ${page + 1}: ${e.message}`);
      break;
    }
  }

  return allResults;
}

async function main() {
  const data = loadJobs();
  const { searches, search_config: config } = data;
  const existingKeys = new Set(data.jobs.map(j => dedupKey(j)));
  const sessionKeys = new Set();
  const newJobs = [];

  console.log(`Running ${searches.length} searches with up to ${config.pages_per_search} pages each...\n`);

  for (let i = 0; i < searches.length; i++) {
    const search = searches[i];
    console.log(`[${i + 1}/${searches.length}] "${search.keywords}" in ${search.location}`);

    const results = await runSearch(search, config);
    let added = 0;

    for (const job of results) {
      const key = dedupKey(job);
      if (existingKeys.has(key) || sessionKeys.has(key)) continue;
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

    console.log(`  Found ${results.length} results, ${added} new`);

    if (i < searches.length - 1) await sleep(config.delay_between_requests_ms || 4000);
  }

  // Also check crypto.jobs
  console.log(`\n[crypto.jobs] Checking RSS feed...`);
  try {
    const cj = await searchCryptoJobs({ keywords: 'CTO engineering head devrel architect' });
    let cjAdded = 0;
    for (const job of cj.jobs) {
      const key = dedupKey(job);
      if (existingKeys.has(key) || sessionKeys.has(key)) continue;
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
    console.log(`  Found ${cj.count} results, ${cjAdded} new`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total new jobs found: ${newJobs.length}`);

  if (newJobs.length === 0) {
    console.log('No new jobs to add.');
    return;
  }

  // Save as a separate discovery file for review
  const discoveryPath = resolve(import.meta.dirname, 'jobs-discovery.json');
  const discovery = {
    searched: new Date().toISOString(),
    searches_run: searches.length,
    new_jobs: newJobs.length,
    jobs: newJobs
  };
  writeFileSync(discoveryPath, JSON.stringify(discovery, null, 2) + '\n');

  console.log(`\nSaved to jobs-discovery.json for review.`);
  console.log(`Top finds:`);
  newJobs.slice(0, 15).forEach(j =>
    console.log(`  ${j.title} @ ${j.company} | ${j.location}`)
  );

  // Update last sweep date
  data.search_config.last_full_sweep = new Date().toISOString().split('T')[0];
  saveJobs(data);
}

main().catch(e => { console.error(e); process.exit(1); });

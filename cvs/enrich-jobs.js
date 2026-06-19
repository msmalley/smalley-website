const fs = require('fs');
const path = require('path');

const jobsPath = path.resolve(__dirname, 'jobs.json');

function loadJobs() {
  return JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));
}

function saveJobs(data) {
  fs.writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n');
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractLinkedInJobId(url) {
  if (!url) return null;
  const numericMatch = url.match(/linkedin\.com\/jobs\/view\/(\d{7,})/);
  if (numericMatch) return numericMatch[1];
  const slugMatch = url.match(/linkedin\.com\/jobs\/view\/[^/]*?(\d{7,})/);
  if (slugMatch) return slugMatch[1];
  return null;
}

function normaliseLinkedInUrl(url) {
  if (!url) return url;
  return url.replace(/^(https?:\/\/)uk\.linkedin\.com/, '$1www.linkedin.com');
}

function classifySource(job) {
  const url = job.source_url || '';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('crypto.jobs')) return 'crypto.jobs';
  if (url.includes('web3.career')) return 'web3.career';
  if (job.source) return job.source;
  return 'unknown';
}

function estimateFreshness(job) {
  const added = job.added || job.date_found;
  if (!added) return { status: 'unknown', days_old: null };

  const addedDate = new Date(added);
  const now = new Date();
  const daysOld = Math.floor((now - addedDate) / (1000 * 60 * 60 * 24));

  let status;
  if (daysOld <= 3) status = 'fresh';
  else if (daysOld <= 7) status = 'recent';
  else if (daysOld <= 14) status = 'aging';
  else if (daysOld <= 30) status = 'stale';
  else status = 'expired';

  return { status, days_old: daysOld, added };
}

function classifyApplicationMethod(job) {
  const source = classifySource(job);
  const linkedinJobId = extractLinkedInJobId(job.source_url);

  const channel = {
    source,
    method: null,
    apply_url: null,
    contact_email: null,
    linkedin_job_id: linkedinJobId,
    freshness: estimateFreshness(job),
    action: null,
    notes: null
  };

  if (source === 'linkedin') {
    channel.method = 'linkedin_apply';
    channel.apply_url = normaliseLinkedInUrl(job.source_url);
    channel.action = 'check_easy_apply';
  } else if (source === 'crypto.jobs') {
    channel.method = 'direct_url';
    channel.apply_url = job.source_url;
    channel.action = 'visit_and_apply';
  } else if (source === 'web3.career') {
    channel.method = 'direct_url';
    channel.apply_url = job.source_url;
    channel.action = 'visit_and_apply';
  }

  return channel;
}

function enrichFromDescription(channel, description) {
  if (!description) return channel;

  const emails = description.match(EMAIL_REGEX) || [];
  const validTlds = ['com', 'co', 'io', 'org', 'net', 'uk', 'ai', 'xyz', 'dev', 'tech', 'jobs'];
  const validEmails = emails
    .map(e => {
      e = e.replace(/[.,;:!?)]+$/, '');
      const parts = e.split('@');
      if (parts.length !== 2) return null;
      const domainParts = parts[1].split('.');
      const cleaned = [];
      for (const part of domainParts) {
        if (part.match(/^[a-z0-9\-]+$/i)) cleaned.push(part);
        else break;
      }
      if (cleaned.length < 2) return null;
      return parts[0] + '@' + cleaned.join('.');
    })
    .filter(e => {
      if (!e) return false;
      const tld = e.split('.').pop().toLowerCase();
      return validTlds.includes(tld) &&
        !e.includes('example.com') &&
        !e.includes('noreply') &&
        !e.includes('no-reply') &&
        !e.includes('donotreply') &&
        !e.includes('accommodations');
    });

  if (validEmails.length > 0) {
    channel.contact_email = validEmails[0];
    channel.method = 'email_direct';
    channel.action = 'send_application_email';
  }

  const easyApplyIndicators = [
    'easy apply', 'apply now', 'quick apply',
    'one-click apply', '1-click apply'
  ];
  const descLower = description.toLowerCase();
  if (easyApplyIndicators.some(i => descLower.includes(i))) {
    if (!channel.contact_email) {
      channel.method = 'easy_apply';
      channel.action = 'use_easy_apply';
    }
  }

  const companyPageMatch = description.match(/apply\s+(?:at|on|via)\s+(https?:\/\/[^\s,)]+)/i);
  if (companyPageMatch) {
    channel.apply_url = companyPageMatch[1];
    channel.method = 'company_direct';
    channel.action = 'apply_on_company_site';
  }

  return channel;
}

function classifyAll(force = false) {
  const data = loadJobs();
  const jobs = data.jobs;
  let enriched = 0;

  for (const job of jobs) {
    if (!job.channel || force) {
      const existing = job.channel || {};
      job.channel = classifyApplicationMethod(job);
      if (existing.contact_email) job.channel.contact_email = existing.contact_email;
      if (existing._fetched) job.channel._fetched = existing._fetched;
      if (existing.method === 'email_direct') job.channel.method = existing.method;
      enriched++;
    }
  }

  saveJobs(data);
  return { total: jobs.length, enriched };
}

async function fetchAndEnrich(options = {}) {
  let load;
  try {
    ({ load } = await import('cheerio'));
  } catch {
    const cheerioPath = path.resolve(__dirname, '../mcp/social/node_modules/cheerio/dist/commonjs/index.js');
    ({ load } = require(cheerioPath));
  }
  const data = loadJobs();
  const jobs = data.jobs;

  const limit = options.limit || 10;
  const targetJobs = jobs
    .filter(j => j.channel && j.channel.linkedin_job_id && j.channel.method === 'linkedin_apply')
    .filter(j => !j.channel._fetched)
    .slice(0, limit);

  console.log(`Fetching descriptions for ${targetJobs.length} LinkedIn jobs...`);
  let fetched = 0;
  let emailsFound = 0;

  for (const job of targetJobs) {
    const jobId = job.channel.linkedin_job_id;
    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (response.status === 999) {
        console.log(`  Rate limited at job ${fetched + 1}. Stopping.`);
        break;
      }

      if (!response.ok) {
        console.log(`  ${job.company} - ${job.role}: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = load(html);
      const description = $('div.description__text, div.show-more-less-html__markup').text().trim();

      job.channel = enrichFromDescription(job.channel, description);
      job.channel._fetched = true;
      fetched++;

      if (job.channel.contact_email) {
        emailsFound++;
        console.log(`  ${job.company} - ${job.role}: found email ${job.channel.contact_email}`);
      } else {
        console.log(`  ${job.company} - ${job.role}: no email, method=${job.channel.method}`);
      }

      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    } catch (e) {
      console.log(`  ${job.company} - ${job.role}: error - ${e.message}`);
    }
  }

  saveJobs(data);
  console.log(`\nDone. Fetched: ${fetched}, emails found: ${emailsFound}`);
  return { fetched, emailsFound };
}

function summary() {
  const data = loadJobs();
  const jobs = data.jobs;

  const stats = {
    total: jobs.length,
    with_channel: 0,
    by_method: {},
    by_freshness: {},
    with_email: 0,
    with_apply_url: 0,
    actionable: 0
  };

  for (const job of jobs) {
    if (job.channel) {
      stats.with_channel++;
      const method = job.channel.method || 'unclassified';
      stats.by_method[method] = (stats.by_method[method] || 0) + 1;
      const fresh = job.channel.freshness?.status || 'unknown';
      stats.by_freshness[fresh] = (stats.by_freshness[fresh] || 0) + 1;
      if (job.channel.contact_email) stats.with_email++;
      if (job.channel.apply_url) stats.with_apply_url++;
      if (job.channel.action && job.channel.freshness?.status !== 'expired') stats.actionable++;
    }
  }

  return stats;
}

function findByEmail() {
  const data = loadJobs();
  return data.jobs.filter(j => j.channel?.contact_email);
}

function findActionable(options = {}) {
  const data = loadJobs();
  let jobs = data.jobs.filter(j => {
    if (!j.channel || !j.channel.action) return false;
    if (j.channel.contact_email) return true;
    return j.status !== 'closed' && j.status !== 'rejected';
  });

  if (options.method) {
    jobs = jobs.filter(j => j.channel.method === options.method);
  }
  if (options.fresh_only) {
    jobs = jobs.filter(j =>
      j.channel.contact_email || ['fresh', 'recent'].includes(j.channel.freshness?.status)
    );
  }
  if (options.min_score) {
    jobs = jobs.filter(j => j.score >= options.min_score);
  }

  return jobs.sort((a, b) => (b.score || 0) - (a.score || 0));
}

async function checkLiveness(options = {}) {
  let load;
  try {
    ({ load } = await import('cheerio'));
  } catch {
    const cheerioPath = path.resolve(__dirname, '../mcp/social/node_modules/cheerio/dist/commonjs/index.js');
    ({ load } = require(cheerioPath));
  }

  const data = loadJobs();
  const jobs = data.jobs;
  const limit = options.limit || 20;
  const targets = options.jobIds
    ? jobs.filter(j => options.jobIds.includes(j.id))
    : jobs.filter(j => j.channel?.linkedin_job_id && j.status !== 'closed' && j.status !== 'rejected')
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);

  console.log(`Checking liveness for ${targets.length} jobs...`);
  let closed = 0;
  let active = 0;

  for (const job of targets) {
    const jobId = job.channel?.linkedin_job_id;
    if (!jobId) continue;

    try {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html'
        }
      });

      if (response.status === 999) {
        console.log(`  Rate limited. Stopping.`);
        break;
      }

      if (response.status === 404) {
        job.status = 'closed';
        job.channel.freshness.status = 'expired';
        closed++;
        console.log(`  CLOSED: ${job.company} - ${job.role}`);
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
        continue;
      }

      if (!response.ok) {
        console.log(`  ${job.company}: HTTP ${response.status}`);
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
        continue;
      }

      const html = await response.text();
      const $ = load(html);
      const pageText = $('body').text().toLowerCase();

      if (pageText.includes('no longer accepting') || pageText.includes('no longer available')) {
        job.status = 'closed';
        job.channel.freshness.status = 'expired';
        closed++;
        console.log(`  CLOSED: ${job.company} - ${job.role}`);
      } else {
        active++;
        console.log(`  MAYBE ACTIVE: ${job.company} - ${job.role} (guest API only - may be stale)`);
      }

      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    } catch (e) {
      console.log(`  ${job.company}: error - ${e.message}`);
    }
  }

  saveJobs(data);
  console.log(`\nResults: ${active} active, ${closed} closed`);
  return { active, closed };
}

const command = process.argv[2];

switch (command) {
  case 'classify': {
    const force = process.argv[3] === '--force';
    const result = classifyAll(force);
    console.log(`Classified ${result.enriched} of ${result.total} jobs.`);
    const stats = summary();
    console.log('\nSummary:');
    console.log(JSON.stringify(stats, null, 2));
    break;
  }

  case 'fetch': {
    const limit = parseInt(process.argv[3]) || 10;
    classifyAll();
    fetchAndEnrich({ limit }).catch(e => { console.error(e); process.exit(1); });
    break;
  }

  case 'summary': {
    const stats = summary();
    console.log(JSON.stringify(stats, null, 2));
    break;
  }

  case 'emails': {
    const jobs = findByEmail();
    if (jobs.length === 0) {
      console.log('No jobs with contact emails found. Run "fetch" to scan job descriptions.');
    } else {
      console.log(`\nJobs with contact emails (${jobs.length}):\n`);
      for (const j of jobs) {
        console.log(`  ${j.company} - ${j.role} (score: ${j.score})`);
        console.log(`    email: ${j.channel.contact_email}`);
        console.log(`    url: ${j.source_url}`);
        console.log();
      }
    }
    break;
  }

  case 'actionable': {
    const minScore = parseInt(process.argv[3]) || 50;
    const jobs = findActionable({ min_score: minScore });
    console.log(`\nActionable jobs with score >= ${minScore} (${jobs.length}):\n`);
    console.log(`${'Score'.padEnd(6)} ${'Method'.padEnd(16)} ${'Fresh'.padEnd(8)} ${'Company'.padEnd(20)} Role`);
    console.log('-'.repeat(80));
    for (const j of jobs.slice(0, 30)) {
      const c = j.channel;
      console.log(`${String(j.score).padEnd(6)} ${(c.method || '?').padEnd(16)} ${(c.freshness?.status || '?').padEnd(8)} ${j.company.slice(0, 18).padEnd(20)} ${j.role}`);
    }
    if (jobs.length > 30) console.log(`  ... and ${jobs.length - 30} more`);
    break;
  }

  case 'outreach': {
    const data = loadJobs();
    const outreach = data.jobs.filter(j => j.status === 'outreach' || j.status === 'closed_email_viable');
    console.log(`\nCold outreach / speculative list (${outreach.length}):\n`);
    for (const j of outreach) {
      const c = j.channel || {};
      console.log(`  ${j.company} - ${j.role} (score: ${j.score})`);
      console.log(`    email: ${c.contact_email}`);
      console.log(`    reason: ${c.notes || j.status}`);
      console.log(`    url: ${j.source_url}`);
      console.log();
    }
    if (outreach.length === 0) console.log('  No outreach contacts yet.');
    break;
  }

  case 'check': {
    const limit = parseInt(process.argv[3]) || 20;
    checkLiveness({ limit }).catch(e => { console.error(e); process.exit(1); });
    break;
  }

  default:
    console.log(`Job Enrichment — Usage:
  node enrich-jobs.js classify           Auto-classify all jobs by source + method
  node enrich-jobs.js fetch [limit]      Fetch LinkedIn descriptions for email/method detection
  node enrich-jobs.js check [limit]      Check if jobs are still accepting applications
  node enrich-jobs.js summary            Show enrichment statistics
  node enrich-jobs.js emails             List jobs with contact emails
  node enrich-jobs.js actionable [min]   List actionable jobs by score (default min: 50)
`);
}

module.exports = { classifyAll, fetchAndEnrich, summary, findByEmail, findActionable, enrichFromDescription };

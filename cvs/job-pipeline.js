const fs = require('fs');
const path = require('path');
const { matchJob } = require('./match-job.js');
const { generate } = require('./generate-cover.js');

const jobsPath = path.resolve(__dirname, 'jobs.json');
const archivePath = path.resolve(__dirname, 'jobs-archive.json');

function loadJobs() {
  return JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));
}

function loadArchive() {
  if (!fs.existsSync(archivePath)) return { jobs: [], updated: '' };
  return JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
}

function saveArchive(archive) {
  archive.updated = new Date().toISOString().split('T')[0];
  fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2) + '\n');
}

function saveJobs(data) {
  fs.writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n');
}

function generateId(company, role) {
  const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `${slug}-${Date.now().toString(36)}`;
}

function addJob(jobDescription, options = {}) {
  const match = matchJob(jobDescription, options);
  const data = loadJobs();

  const job = {
    id: generateId(match.company, match.role),
    added: new Date().toISOString().split('T')[0],
    status: 'matched',
    company: match.company,
    role: match.role,
    location: match.location,
    variant: match.variant,
    score: match.score,
    scores: match.scores,
    confidence: match.confidence,
    requirements_found: match.requirements_found,
    matched: match.matched,
    gaps: match.gaps,
    proof_points: match.proof_points,
    source_url: options.url || null,
    cover_letter: null,
    notes: ''
  };

  data.jobs.push(job);
  saveJobs(data);

  console.log(`\nAdded: ${match.role} @ ${match.company}`);
  console.log(`Score: ${match.score}/100 (${match.matched}/${match.requirements_found} requirements matched)`);
  console.log(`Variant: ${match.variant}`);
  if (match.gaps.length > 0) {
    console.log(`\nGaps (${match.gaps.length}):`);
    match.gaps.forEach(g => console.log(`  - ${g}`));
  }
  console.log(`\nTop proof points:`);
  match.proof_points.forEach(p => console.log(`  [${p.requirement}] → ${p.evidence.slice(0, 80)}...`));
  console.log(`\nJob ID: ${job.id}`);
  console.log(`Status: matched → run 'node job-pipeline.js cover <id>' to generate cover letter`);

  return job;
}

async function generateCover(jobId, letterData) {
  const data = loadJobs();
  const job = data.jobs.find(j => j.id && (j.id === jobId || j.id.startsWith(jobId)));

  if (!job) {
    console.error(`Job not found: ${jobId}`);
    process.exit(1);
  }

  const coverData = {
    company: job.company,
    role: job.role,
    variant: job.variant,
    ref: letterData?.ref || job.channel?.linkedin_job_id || job.linkedin_job_id || null,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    proof_points: job.proof_points,
    opening: letterData?.opening || `I am writing regarding the ${job.role} position. My background in blockchain infrastructure, protocol design, and engineering leadership maps directly to what you are building.`,
    body: letterData?.body || '',
    closing: letterData?.closing || `I am available immediately and based in the UK, open to remote or hybrid arrangements. I would welcome the opportunity to discuss how my experience building production blockchain systems can contribute to your team.`
  };

  const tmpFile = path.resolve(__dirname, `dist/.tmp-cover-${jobId}.json`);
  const distDir = path.resolve(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(tmpFile, JSON.stringify(coverData, null, 2));

  const result = await generate(tmpFile);
  fs.unlinkSync(tmpFile);

  job.cover_letter = result.pdf;
  job.status = 'approved';
  saveJobs(data);

  console.log(`Cover letter generated: ${result.pdf}`);
  console.log(`Status updated: approved`);
  return result;
}

function listJobs(filter) {
  const data = loadJobs();
  let jobs = data.jobs;

  if (filter) {
    jobs = jobs.filter(j => j.status === filter || j.variant === filter);
  }

  if (jobs.length === 0) {
    console.log('No jobs found.');
    return;
  }

  console.log(`\n${'ID'.padEnd(30)} ${'Score'.padEnd(6)} ${'Status'.padEnd(10)} ${'Role'.padEnd(30)} Company`);
  console.log('-'.repeat(100));
  for (const job of jobs) {
    const id = job.id || '(no id)';
    const role = job.role || job.title || '(no role)';
    const status = job.status || '?';
    console.log(`${id.slice(0, 28).padEnd(30)} ${String(job.score).padEnd(6)} ${status.padEnd(10)} ${role.slice(0, 28).padEnd(30)} ${job.company}`);
  }
  console.log(`\nTotal: ${jobs.length} jobs`);
}

// The dashboard computes response time from applied_at -> declined_date, so a
// decline must stamp its own date or the response never gets measured. The date
// is explicit where known, because a decline email usually predates us logging
// it and stamping today would understate every response time.
function stampOutcomeDate(job, newStatus, outcomeDate) {
  const today = new Date().toISOString().split('T')[0];
  if (newStatus === 'applied') job.applied_at = outcomeDate || today;
  if (newStatus === 'declined') job.declined_date = outcomeDate || today;
}

function updateStatus(jobId, newStatus, outcomeDate) {
  const data = loadJobs();
  const matches = j => j.id && (j.id === jobId || j.id.startsWith(jobId));

  const job = data.jobs.find(matches);
  if (job) {
    job.status = newStatus;
    stampOutcomeDate(job, newStatus, outcomeDate);
    archiveIfTerminal(data, job);
    saveJobs(data);
    console.log(`Updated ${job.role} @ ${job.company} → ${newStatus}`);
    return job;
  }

  // An application that already reached a terminal status lives in the archive,
  // so a later outcome on it (applied -> declined) has to be editable there too.
  // Without this the only way to log a decline was to hand-edit the JSON.
  const archive = loadArchive();
  const archived = archive.jobs.find(matches);
  if (!archived) {
    console.error(`Job not found: ${jobId}`);
    process.exit(1);
  }

  archived.status = newStatus;
  stampOutcomeDate(archived, newStatus, outcomeDate);

  if (ARCHIVE_STATUSES.includes(newStatus)) {
    saveArchive(archive);
    console.log(`Updated ${archived.role} @ ${archived.company} → ${newStatus} (archived)`);
  } else {
    // Back to a live status, so the job rejoins the active pipeline.
    archive.jobs = archive.jobs.filter(j => !matches(j));
    saveArchive(archive);
    data.jobs.push(archived);
    saveJobs(data);
    console.log(`Restored ${archived.role} @ ${archived.company} → ${newStatus} (now active)`);
  }
  return archived;
}

const ARCHIVE_STATUSES = ['closed', 'rejected', 'applied', 'withdrawn', 'declined'];

// Terminal statuses belong in jobs-archive.json regardless of which command set
// them, so the same status never lives in two files depending on the path taken.
function archiveIfTerminal(data, job) {
  if (!ARCHIVE_STATUSES.includes(job.status)) return false;
  // Match on identity as well as id: older records carry no id, and comparing
  // undefined to undefined would sweep every id-less record out of both files.
  const sameRecord = j => j === job || (job.id && j.id === job.id);
  const archive = loadArchive();
  archive.jobs = archive.jobs.filter(j => !sameRecord(j));
  archive.jobs.push(job);
  saveArchive(archive);
  data.jobs = data.jobs.filter(j => !sameRecord(j));
  console.log(`Archived ${job.role} @ ${job.company} → jobs-archive.json`);
  return true;
}

// A mis-parsed job description yields a record with the wrong company and role
// (the parser takes whatever the page put first, which can be a button label).
// Correcting it by hand means editing jobs.json directly, so both fixes are here.
function findAnywhere(jobId) {
  const matches = j => j.id && (j.id === jobId || j.id.startsWith(jobId));
  const data = loadJobs();
  const inJobs = data.jobs.find(matches);
  if (inJobs) return { job: inJobs, data, archive: null, matches };
  const archive = loadArchive();
  const inArchive = archive.jobs.find(matches);
  if (inArchive) return { job: inArchive, data, archive, matches };
  return null;
}

function removeJob(jobId) {
  const found = findAnywhere(jobId);
  if (!found) { console.error(`Job not found: ${jobId}`); process.exit(1); }
  const { job, data, archive, matches } = found;
  if (archive) {
    archive.jobs = archive.jobs.filter(j => !matches(j));
    saveArchive(archive);
  } else {
    data.jobs = data.jobs.filter(j => !matches(j));
    saveJobs(data);
  }
  console.log(`Removed ${job.role} @ ${job.company} (${archive ? 'archive' : 'jobs.json'})`);
  return job;
}

function retitleJob(jobId, opts) {
  const found = findAnywhere(jobId);
  if (!found) { console.error(`Job not found: ${jobId}`); process.exit(1); }
  const { job, data, archive } = found;
  const before = `${job.role} @ ${job.company}`;
  if (opts.company) job.company = opts.company;
  if (opts.role) job.role = opts.role;
  if (opts.variant) job.variant = opts.variant;
  if (archive) saveArchive(archive); else saveJobs(data);
  console.log(`Retitled: ${before}\n      ->  ${job.role} @ ${job.company}${opts.variant ? ` (variant ${job.variant})` : ''}`);
  return job;
}

function recordOutcome(opts) {
  const data = loadJobs();
  const archive = loadArchive();
  const norm = v => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const sameJob = j =>
    norm(j.company) === norm(opts.company) && norm(j.role) === norm(opts.role);

  // A job that already reached a terminal status sits in the archive, so look
  // there as well or recording its later outcome creates a second record of the
  // same application and double-counts it in every total.
  const existing = data.jobs.find(sameJob);
  const archived = existing ? null : archive.jobs.find(sameJob);
  const job = existing || archived || { id: generateId(opts.company, opts.role) };
  const isNew = !existing && !archived;
  // Records imported before ids existed need one, or no other command can reach them
  if (!job.id) job.id = generateId(opts.company, opts.role);

  Object.assign(job, {
    added: opts.applied || job.added || new Date().toISOString().split('T')[0],
    company: opts.company,
    role: opts.role,
    location: opts.location || job.location || null,
    status: opts.status,
    source_url: opts.url || job.source_url || null,
    reference: opts.ref || job.reference || null,
    notes: opts.notes || job.notes || ''
  });

  // A job we never captured a description for must not carry match data. Scoring
  // a reconstructed description would put invented requirements into the pipeline
  // and skew every average that reads score. A job already in the pipeline keeps
  // the match data it earned from its real description.
  if (isNew) {
    Object.assign(job, {
      jd_verified: false,
      score: null,
      scores: null,
      confidence: null,
      requirements_found: null,
      matched: null,
      proof_points: [],
      gaps: []
    });
  }

  if (opts.applied) job.applied_at = opts.applied;
  if (opts.outcomeDate && opts.status === 'declined') job.declined_date = opts.outcomeDate;

  if (archived) {
    saveArchive(archive);
  } else {
    if (!existing) data.jobs.push(job);
    archiveIfTerminal(data, job);
    saveJobs(data);
  }

  const verb = isNew ? 'Recorded' : 'Updated';
  console.log(`${verb}: ${job.role} @ ${job.company} → ${job.status}`);
  if (isNew) console.log(`  no verified JD, so score and match data are left null`);
  console.log(`  id: ${job.id}`);
  return job;
}

const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'add': {
    if (!arg) { console.error('Usage: node job-pipeline.js add <jd-file.txt>'); process.exit(1); }
    const jd = arg === '--stdin'
      ? require('fs').readFileSync(0, 'utf-8')
      : fs.readFileSync(arg, 'utf-8');
    const url = process.argv[4] || null;
    addJob(jd, { url });
    break;
  }
  case 'cover': {
    if (!arg) { console.error('Usage: node job-pipeline.js cover <job-id>'); process.exit(1); }
    generateCover(arg).catch(e => { console.error(e); process.exit(1); });
    break;
  }
  case 'list': {
    listJobs(arg);
    break;
  }
  case 'record': {
    const flag = n => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : null; };
    const company = flag('company'), role = flag('role'), status = flag('status');
    if (!company || !role || !status) {
      console.error('Usage: node job-pipeline.js record --company X --role Y --status declined [--ref R] [--applied YYYY-MM-DD] [--outcome-date YYYY-MM-DD] [--location L] [--url U] [--notes "..."]');
      process.exit(1);
    }
    recordOutcome({
      company, role, status,
      ref: flag('ref'), applied: flag('applied'), outcomeDate: flag('outcome-date'),
      location: flag('location'), url: flag('url'), notes: flag('notes')
    });
    break;
  }
  case 'remove': {
    if (!arg) { console.error('Usage: node job-pipeline.js remove <job-id>'); process.exit(1); }
    removeJob(arg);
    break;
  }
  case 'retitle': {
    const flag = n => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : null; };
    if (!arg) { console.error('Usage: node job-pipeline.js retitle <job-id> [--company X] [--role Y] [--variant V]'); process.exit(1); }
    retitleJob(arg, { company: flag('company'), role: flag('role'), variant: flag('variant') });
    break;
  }
  case 'status': {
    if (!arg || !process.argv[4]) { console.error('Usage: node job-pipeline.js status <job-id> <new-status> [outcome-date YYYY-MM-DD]'); process.exit(1); }
    updateStatus(arg, process.argv[4], process.argv[5] || null);
    break;
  }
  case 'enrich': {
    const { classifyAll, fetchAndEnrich, summary } = require('./enrich-jobs.js');
    const subcommand = arg || 'classify';
    if (subcommand === 'classify') {
      classifyAll(process.argv[4] === '--force');
      const stats = summary();
      console.log(JSON.stringify(stats, null, 2));
    } else if (subcommand === 'fetch') {
      classifyAll();
      fetchAndEnrich({ limit: parseInt(process.argv[4]) || 20 }).catch(e => { console.error(e); process.exit(1); });
    } else if (subcommand === 'emails') {
      const { findByEmail } = require('./enrich-jobs.js');
      const jobs = findByEmail();
      for (const j of jobs) {
        console.log(`${j.company} - ${j.role} (${j.score}) → ${j.channel.contact_email}`);
      }
    }
    break;
  }
  default:
    console.log(`Job Pipeline — Usage:
  node job-pipeline.js add <jd-file.txt> [source-url]   Add and match a job
  node job-pipeline.js cover <job-id>                   Generate cover letter
  node job-pipeline.js list [status|variant]            List tracked jobs
  node job-pipeline.js status <job-id> <new-status> [YYYY-MM-DD]
                                                        Update job status, dating the
                                                        outcome from the decline itself
  node job-pipeline.js record --company X --role Y --status S   Record a historical
                                                        outcome with no verified JD
  node job-pipeline.js remove <job-id>                   Delete a mis-parsed record
  node job-pipeline.js retitle <job-id> [--company X] [--role Y] [--variant V]
                                                        Fix a wrongly parsed company/role
  node job-pipeline.js enrich [classify|fetch|emails]   Enrich jobs with channel data
`);
}

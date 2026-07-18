const fs = require('fs');
const path = require('path');
const { matchJob } = require('./match-job.js');
const { generate } = require('./generate-cover.js');

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
    console.log(`${job.id.slice(0, 28).padEnd(30)} ${String(job.score).padEnd(6)} ${job.status.padEnd(10)} ${job.role.slice(0, 28).padEnd(30)} ${job.company}`);
  }
  console.log(`\nTotal: ${jobs.length} jobs`);
}

function updateStatus(jobId, newStatus) {
  const data = loadJobs();
  const job = data.jobs.find(j => j.id && (j.id === jobId || j.id.startsWith(jobId)));
  if (!job) {
    console.error(`Job not found: ${jobId}`);
    process.exit(1);
  }
  job.status = newStatus;
  if (newStatus === 'applied') job.applied_at = new Date().toISOString().split('T')[0];

  // Auto-archive terminal statuses
  const archiveStatuses = ['closed', 'rejected', 'applied', 'withdrawn'];
  if (archiveStatuses.includes(newStatus)) {
    const archivePath = path.resolve(__dirname, 'jobs-archive.json');
    let archive = { jobs: [], updated: '' };
    if (fs.existsSync(archivePath)) {
      archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
    }
    archive.jobs.push(job);
    archive.updated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2) + '\n');
    data.jobs = data.jobs.filter(j => j.id !== job.id);
    console.log(`Archived ${job.role} @ ${job.company} → jobs-archive.json`);
  }

  saveJobs(data);
  console.log(`Updated ${job.role} @ ${job.company} → ${newStatus}`);
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
  case 'status': {
    if (!arg || !process.argv[4]) { console.error('Usage: node job-pipeline.js status <job-id> <new-status>'); process.exit(1); }
    updateStatus(arg, process.argv[4]);
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
  node job-pipeline.js status <job-id> <new-status>    Update job status
  node job-pipeline.js enrich [classify|fetch|emails]   Enrich jobs with channel data
`);
}

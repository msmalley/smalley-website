// Terminal statuses belong in jobs-archive.json. job-pipeline.js archived on
// every status change, but other writers (enrich-jobs.js fetch marking dead
// listings closed) saved straight to jobs.json, so the same status ended up
// living in two files depending on which script set it. Every writer now runs
// its jobs through sweepTerminal before saving.

const fs = require('fs');
const path = require('path');

const archivePath = path.resolve(__dirname, 'jobs-archive.json');

const ARCHIVE_STATUSES = ['closed', 'rejected', 'applied', 'withdrawn', 'declined'];

function loadArchive() {
  if (!fs.existsSync(archivePath)) return { jobs: [], updated: '' };
  return JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
}

function saveArchive(archive) {
  archive.updated = new Date().toISOString().split('T')[0];
  fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2) + '\n');
}

const norm = v => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Older records carry no id, so fall back to company + role. Comparing
// undefined ids would treat every id-less record as the same job.
function sameJob(a, b) {
  if (a.id && b.id) return a.id === b.id;
  return norm(a.company) === norm(b.company) && norm(a.role) === norm(b.role);
}

// Moves every terminal-status job out of data.jobs into the archive. When the
// archive already holds the job, the pipeline copy is the more recent update
// (an applied job later declined), so its fields win over the archived ones.
function sweepTerminal(data) {
  const terminal = data.jobs.filter(j => ARCHIVE_STATUSES.includes(j.status));
  if (terminal.length === 0) return [];

  const archive = loadArchive();
  for (const job of terminal) {
    const idx = archive.jobs.findIndex(a => sameJob(a, job));
    if (idx >= 0) archive.jobs[idx] = Object.assign({}, archive.jobs[idx], job);
    else archive.jobs.push(job);
  }
  saveArchive(archive);

  data.jobs = data.jobs.filter(j => !terminal.includes(j));
  return terminal;
}

module.exports = { ARCHIVE_STATUSES, loadArchive, saveArchive, sweepTerminal };

if (require.main === module) {
  const jobsPath = path.resolve(__dirname, 'jobs.json');
  const data = JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));
  const moved = sweepTerminal(data);
  fs.writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n');
  for (const j of moved) console.log(`Archived ${j.role} @ ${j.company} (${j.status})`);
  console.log(`\n${moved.length} moved to jobs-archive.json, ${data.jobs.length} remain in jobs.json`);
}

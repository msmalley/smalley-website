import { fetchLinkedInJobDescription } from '../mcp/social/providers/linkedin-jobs.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const filteredPath = resolve(import.meta.dirname, 'jobs-filtered.json');
const jobsPath = resolve(import.meta.dirname, 'jobs.json');
const scoredPath = resolve(import.meta.dirname, 'jobs-scored.json');

function loadJobs() {
  return JSON.parse(readFileSync(jobsPath, 'utf-8'));
}

function saveJobs(data) {
  writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n');
}

function generateId(company, role) {
  const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `${slug}-${Date.now().toString(36)}`;
}

function matchJobCJS(jdText) {
  const tmpPath = resolve(import.meta.dirname, '.tmp-jd-input.txt');
  writeFileSync(tmpPath, jdText);
  try {
    const result = execSync(`node ${resolve(import.meta.dirname, 'match-job.js')} ${tmpPath}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      cwd: import.meta.dirname
    });
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Phase 1: Title-based pre-scoring (no API calls)
function titleScore(job) {
  const title = job.title.toLowerCase();
  const company = (job.company || '').toLowerCase();
  const keywords = (job.search_keywords || '').toLowerCase();
  let score = 0;

  // Role match bonuses
  if (/\bcto\b|chief.?tech/.test(title)) score += 30;
  if (/\bhead of engineering\b/.test(title)) score += 28;
  if (/\bvp.{0,5}engineer|vice president.{0,5}engineer/.test(title)) score += 25;
  if (/\bengineering director|director.{0,10}engineer/.test(title)) score += 24;
  if (/\btechnical director\b/.test(title)) score += 22;
  if (/\bfounding engineer\b/.test(title)) score += 22;
  if (/\bdeveloper.?relat|devrel\b/.test(title)) score += 26;
  if (/\bdeveloper.?advoc/.test(title)) score += 24;
  if (/\bhead of.{0,15}(platform|protocol|product)\b/.test(title)) score += 20;
  if (/\bprotocol engineer\b/.test(title)) score += 18;
  if (/\barchitect\b/.test(title)) score += 15;
  if (/\bstaff engineer|principal\b/.test(title)) score += 14;
  if (/\bengineering (manager|lead)\b/.test(title)) score += 12;
  if (/\btechnical lead|tech lead\b/.test(title)) score += 12;

  // Domain match bonuses
  if (/\bblockchain|crypto|web3|defi|ordinals\b/.test(title)) score += 20;
  if (/\bdigital.?asset/.test(title)) score += 18;
  if (/\bfintech\b/.test(title)) score += 12;
  if (/\bregtech|compliance\b/.test(title)) score += 12;
  if (/\bprotocol\b/.test(title)) score += 12;
  if (/\bsdk\b/.test(title)) score += 10;
  if (/\bdlt|distributed ledger\b/.test(title)) score += 10;
  if (/\bai\b/.test(title)) score += 8;
  if (/\bstartup\b/.test(title)) score += 5;
  if (/\bremote\b/.test(title)) score += 3;

  // Crypto/blockchain companies get a bonus
  if (/\bcrypto|chain|block|defi|token|coin|bit|web3|ordinal|protocol/.test(company)) score += 10;

  // Negative signals
  if (/\bjunior\b/.test(title)) score -= 50;
  if (/\bintern\b/.test(title)) score -= 50;
  if (/\bsales|marketing|hr\b/.test(title)) score -= 30;

  return Math.max(0, Math.min(100, score));
}

async function main() {
  if (!existsSync(filteredPath)) {
    console.error('No jobs-filtered.json found. Run filter-discoveries.mjs first.');
    process.exit(1);
  }

  const filtered = JSON.parse(readFileSync(filteredPath, 'utf-8'));
  const data = loadJobs();
  const existingKeys = new Set(data.jobs.map(j => `${j.company}|${j.role}`.toLowerCase()));

  // Combine tier 1 and tier 2
  const allJobs = [...filtered.tier1, ...filtered.tier2];

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Phase 1: Title Pre-Score                    ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Candidates: ${String(allJobs.length).padEnd(5)}                        ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  // Phase 1: Score all by title
  const preScored = allJobs
    .filter(j => {
      const key = `${j.company}|${j.title}`.toLowerCase();
      return !existingKeys.has(key);
    })
    .map(job => ({ ...job, titleScore: titleScore(job) }))
    .sort((a, b) => b.titleScore - a.titleScore);

  console.log(`Pre-scored: ${preScored.length} (after removing existing pipeline jobs)`);
  console.log(`\nScore distribution:`);
  const brackets = [50, 40, 30, 20, 10, 0];
  for (const min of brackets) {
    const count = preScored.filter(j => j.titleScore >= min && j.titleScore < min + 10).length;
    console.log(`  ${min}-${min + 9}: ${count} jobs`);
  }
  const above50 = preScored.filter(j => j.titleScore >= 50).length;
  console.log(`  50+:  ${above50} jobs`);

  // Take top candidates for JD fetching (title score >= 20)
  const candidates = preScored.filter(j => j.titleScore >= 20);
  console.log(`\nCandidates for JD fetch (score >= 20): ${candidates.length}`);
  console.log(`\nTop 30 by title score:`);
  candidates.slice(0, 30).forEach(j =>
    console.log(`  ${String(j.titleScore).padStart(3)} | ${j.title} @ ${j.company} | ${j.location}`)
  );

  // Phase 2: Fetch JDs and full-match for candidates
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Phase 2: JD Fetch & Full Match              ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Fetching top ${String(candidates.length).padEnd(4)} candidates              ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  const added = [];
  let fetched = 0;
  let fetchErrors = 0;
  let emptyJDs = 0;
  let rateLimited = false;

  for (let i = 0; i < candidates.length; i++) {
    const job = candidates[i];
    const label = `[${String(i + 1).padStart(3)}/${candidates.length}]`;

    if (!job.job_id) {
      console.log(`${label} ${job.title} @ ${job.company} — no job ID`);
      continue;
    }

    if (rateLimited) {
      // Still add to pipeline with title score only, mark as unscored
      const pipelineJob = {
        id: generateId(job.company, job.title),
        added: new Date().toISOString().split('T')[0],
        status: 'new',
        company: job.company,
        role: job.title,
        location: job.location,
        variant: job.variant,
        score: job.titleScore,
        requirements_found: 0,
        matched: 0,
        gaps: [],
        proof_points: [],
        source_url: job.url || `https://www.linkedin.com/jobs/view/${job.job_id}/`,
        cover_letter: null,
        notes: `Title-scored only (rate limited). Keywords: ${job.search_keywords}`
      };
      data.jobs.push(pipelineJob);
      added.push(pipelineJob);
      continue;
    }

    process.stdout.write(`${label} ${job.title.slice(0, 40).padEnd(40)} @ ${job.company.slice(0, 20).padEnd(20)} ... `);

    try {
      const detail = await fetchLinkedInJobDescription(job.job_id);
      fetched++;

      if (!detail.description || detail.description.length < 50) {
        console.log('empty JD');
        emptyJDs++;
        // Still add with title score
        const pipelineJob = {
          id: generateId(job.company, job.title),
          added: new Date().toISOString().split('T')[0],
          status: 'new',
          company: job.company,
          role: job.title,
          location: job.location,
          variant: job.variant,
          score: job.titleScore,
          requirements_found: 0,
          matched: 0,
          gaps: [],
          proof_points: [],
          source_url: job.url || `https://www.linkedin.com/jobs/view/${job.job_id}/`,
          cover_letter: null,
          notes: `Title-scored only (empty JD). Keywords: ${job.search_keywords}`
        };
        data.jobs.push(pipelineJob);
        added.push(pipelineJob);
        await sleep(2000);
        continue;
      }

      const match = matchJobCJS(detail.description);
      if (!match) {
        console.log('match error');
        await sleep(2000);
        continue;
      }

      // Combined score: weight JD match heavily but keep title relevance as tiebreaker
      const combinedScore = match.score > 0
        ? Math.round(match.score * 0.8 + job.titleScore * 0.2)
        : job.titleScore;

      const pipelineJob = {
        id: generateId(job.company, job.title),
        added: new Date().toISOString().split('T')[0],
        status: 'new',
        company: job.company,
        role: job.title,
        location: job.location,
        variant: match.variant || job.variant,
        score: combinedScore,
        requirements_found: match.requirements_found,
        matched: match.matched,
        gaps: match.gaps || [],
        proof_points: match.proof_points || [],
        source_url: job.url || `https://www.linkedin.com/jobs/view/${job.job_id}/`,
        cover_letter: null,
        notes: `Full match. Title: ${job.titleScore}, JD: ${match.score}. Keywords: ${job.search_keywords}`
      };
      data.jobs.push(pipelineJob);
      added.push(pipelineJob);
      console.log(`${combinedScore} (JD:${match.score} T:${job.titleScore}) ${match.matched}/${match.requirements_found} reqs`);

      await sleep(2500);
    } catch (e) {
      if (e.message.includes('999') || e.message.includes('429')) {
        console.log('RATE LIMITED');
        rateLimited = true;
        // Add remaining with title scores
        const pipelineJob = {
          id: generateId(job.company, job.title),
          added: new Date().toISOString().split('T')[0],
          status: 'new',
          company: job.company,
          role: job.title,
          location: job.location,
          variant: job.variant,
          score: job.titleScore,
          requirements_found: 0,
          matched: 0,
          gaps: [],
          proof_points: [],
          source_url: job.url || `https://www.linkedin.com/jobs/view/${job.job_id}/`,
          cover_letter: null,
          notes: `Title-scored only (rate limited). Keywords: ${job.search_keywords}`
        };
        data.jobs.push(pipelineJob);
        added.push(pipelineJob);
      } else {
        console.log(`error: ${e.message.slice(0, 50)}`);
        fetchErrors++;
        await sleep(3000);
      }
    }
  }

  // Save pipeline
  if (added.length > 0) {
    saveJobs(data);
  }

  // Save scored report
  writeFileSync(scoredPath, JSON.stringify({
    scored_at: new Date().toISOString(),
    total_candidates: candidates.length,
    jds_fetched: fetched,
    empty_jds: emptyJDs,
    fetch_errors: fetchErrors,
    rate_limited: rateLimited,
    added_to_pipeline: added.length,
    pipeline_total: data.jobs.length
  }, null, 2) + '\n');

  console.log(`\n══════════════════════════════════════════════`);
  console.log(`  JDs fetched:         ${fetched}`);
  console.log(`  Empty JDs:           ${emptyJDs}`);
  console.log(`  Fetch errors:        ${fetchErrors}`);
  console.log(`  Rate limited:        ${rateLimited ? 'YES' : 'No'}`);
  console.log(`  Added to pipeline:   ${added.length}`);
  console.log(`  Total pipeline jobs: ${data.jobs.length}`);
  console.log(`══════════════════════════════════════════════`);

  if (added.length > 0) {
    console.log(`\nTop scored additions:`);
    added.sort((a, b) => b.score - a.score).slice(0, 20).forEach(j =>
      console.log(`  ${String(j.score).padStart(3)} | ${j.role} @ ${j.company} | ${j.location}`)
    );
  }
}

main().catch(e => { console.error(e); process.exit(1); });

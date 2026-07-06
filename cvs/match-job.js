const fs = require('fs');
const path = require('path');
const { getProofPoints } = require('./parse-cv-proofs');

const profilePath = path.resolve(__dirname, '../data/profile.json');

function loadProfile() {
  return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
}

function detectVariant(requirements) {
  const text = requirements.join(' ').toLowerCase();
  const scores = { cto: 0, regtech: 0, devrel: 0 };

  const ctoSignals = ['cto', 'head of engineering', 'vp engineering', 'technical leader', 'team', 'architecture', 'startup', 'series a', 'series b', 'fundrais'];
  const regtechSignals = ['compliance', 'regtech', 'regulatory', 'kyc', 'aml', 'fintech', 'fca', 'policy', 'risk', 'audit'];
  const devrelSignals = ['developer relations', 'devrel', 'advocacy', 'community', 'sdk', 'documentation', 'evangelist', 'content', 'open source'];

  ctoSignals.forEach(s => { if (text.includes(s)) scores.cto++; });
  regtechSignals.forEach(s => { if (text.includes(s)) scores.regtech++; });
  devrelSignals.forEach(s => { if (text.includes(s)) scores.devrel++; });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : 'cto';
}

function normalizeJobText(text) {
  let normalized = text
    .replace(/([a-z])([A-Z])/g, '$1\n$2')
    .replace(/(Requirements|Qualifications|What you|Must have|Nice to have|Responsibilities|About the role|About you|Skills|Experience|What we('re| are) looking for|You will|You('ll| will) bring|Essential|Desirable)/gi, '\n$1')
    .replace(/(Benefits|Perks|We offer|How to apply|About us|Why join|Salary|Compensation|What we offer|Our culture|Equal opportunity|Diversity)/gi, '\n$1')
    .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
    .replace(/[•●○◦▪▸►]/g, '\n- ')
    .replace(/\s{2,}/g, '\n')
    .replace(/(\d+)\+?\s*years/gi, '\n$&')
    .replace(/;\s*/g, '\n');

  return normalized.split('\n').map(l => l.trim()).filter(Boolean);
}

function extractRequirements(jobDescription) {
  const lines = normalizeJobText(jobDescription);
  const requirements = [];
  let inRequirements = false;

  const startHeaders = ['requirement', 'what you', 'must have', 'qualif', 'experience needed',
    'skills', 'looking for', 'ideal candidate', 'nice to have', 'desired', 'what we need',
    'about you', 'you will need', 'you should have', 'key skills'];
  const endHeaders = ['benefit', 'we offer', 'perks', 'about us', 'how to apply',
    'why join', 'what we provide', 'our culture', 'salary', 'compensation',
    'what we offer', 'join us'];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (startHeaders.some(h => lower.includes(h))) {
      inRequirements = true;
      continue;
    }
    if (inRequirements && endHeaders.some(h => lower.includes(h))) {
      inRequirements = false;
      continue;
    }
    if (inRequirements && (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || /^\d+[\.\)]/.test(line))) {
      const cleaned = line.replace(/^[-•*\d.)\s]+/, '').trim();
      if (cleaned.length > 10) requirements.push(cleaned);
    } else if (inRequirements && line.length > 20 && line.length < 200) {
      requirements.push(line);
    }
  }

  if (requirements.length === 0) {
    for (const line of lines) {
      if ((line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) && line.length > 20) {
        requirements.push(line.replace(/^[-•*\s]+/, '').trim());
      }
    }
  }

  if (requirements.length < 3) {
    const fullText = jobDescription.toLowerCase();
    const yearMatches = fullText.match(/\d+\+?\s*years[^.;]+/g) || [];
    const expMatches = fullText.match(/experience (?:in|with|of|building|leading|managing|developing)[^.;]+/g) || [];
    const skillMatches = fullText.match(/(?:proficien|strong|deep|proven|expert|solid|demonstrat|hands-on)[^.;]+/g) || [];
    const knowledgeMatches = fullText.match(/(?:knowledge of|familiar|understanding of)[^.;]+/g) || [];
    const abilityMatches = fullText.match(/(?:ability to|capable of|track record)[^.;]+/g) || [];
    const existing = new Set(requirements.map(r => r.toLowerCase()));
    const extras = [...yearMatches, ...expMatches, ...skillMatches, ...knowledgeMatches, ...abilityMatches]
      .filter(m => m.length > 15 && m.length < 200 && !existing.has(m.trim()));
    requirements.push(...extras.slice(0, 10));
  }

  return requirements;
}

function extractMetadata(jobDescription) {
  const lines = jobDescription.split('\n').map(l => l.trim()).filter(Boolean);
  let company = '';
  let role = '';
  let location = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!role && /^(role|position|job title)\s*:/i.test(line)) {
      role = line.replace(/^(role|position|job title)\s*:\s*/i, '').trim();
    }
    if (!company && /^company\s*:/i.test(line)) {
      company = line.replace(/^company\s*:\s*/i, '').trim();
    }
    if (!location && /^location\s*:/i.test(line)) {
      location = line.replace(/^location\s*:\s*/i, '').trim();
    }
  }

  if (!role) {
    const roleKeywords = ['cto', 'head of', 'engineer', 'developer', 'devrel', 'lead',
      'director', 'architect', 'manager', 'compliance', 'vp', 'officer', 'relations'];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('about') || lower.startsWith('requirement') || lower.startsWith('benefit')) continue;
      if (line.length < 80 && roleKeywords.some(k => lower.includes(k))) {
        role = line;
        break;
      }
    }
  }
  if (!role && lines.length > 0) role = lines[0];

  if (!company) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line === role) continue;
      const lower = line.toLowerCase();
      if (lower.startsWith('about') || lower.startsWith('requirement')) continue;
      if (line.length < 100 && !line.startsWith('-') && !line.startsWith('•')) {
        company = line.replace(/\s*\(.*\)\s*$/, '').trim();
        break;
      }
    }
  }

  if (!location) {
    const fullText = jobDescription.toLowerCase();
    if (fullText.includes('remote')) location = 'Remote';
    if (fullText.includes('uk') || fullText.includes('london')) location += (location ? ', ' : '') + 'UK';
  }

  return { company, role, location };
}

// Each variant gets its own expansion map reflecting that person's unique story.
// CTO person: builds companies, scales teams, raises funding, ships products.
// RegTech person: navigates regulation, builds compliance systems, advises institutions.
// DevRel person: teaches developers, builds communities, creates content, open-sources.
const VARIANT_EXPANSIONS = {
  cto: {
    'blockchain': ['bitcoin', 'ethereum', 'utxo', 'ordinals', 'taproot', 'web3', 'crypto', 'digital asset'],
    'bitcoin': ['utxo', 'ordinals', 'taproot', 'psbt', 'schnorr', 'inscription', 'runes', 'bitcoinjs'],
    'ethereum': ['solidity', 'evm', 'erc-20', 'erc-721', 'smart contract', 'ethersjs', 'defi'],
    'production': ['shipped', 'built', 'deployed', 'launched', 'live', 'shipping', 'released', 'commits'],
    'team': ['engineers', 'hiring', 'managed', 'founded', 'cross-functional', 'moonshot', 'onboarding', 'mentoring', 'sprint'],
    'leadership': ['cto', 'head of', 'led', 'managed', 'founded', 'director', 'vp', 'engineering leader', 'tech lead'],
    'startup': ['seed', 'series', '500 startups', 'antler', 'founder', 'co-founded', 'early-stage', 'pre-seed', 'mvp', 'draper'],
    'fundrais': ['draper', 'investment', 'raised', 'seed', 'series', 'investor', 'pitch', 'due diligence'],
    'architecture': ['extensible', 'plugin', 'framework', 'designed', 'infrastructure', 'scalable', 'microservices', 'modular', 'system'],
    'protocol': ['sado', 'dn-key', 'everstore', 'ordit', 'bip32', 'specification', 'standard'],
    'delivery': ['shipped', 'commits', 'deployed', 'launched', 'ci/cd', 'sprint', 'agile', 'velocity'],
    'security': ['cryptographic', 'passkey', 'webauthn', 'key management', 'encryption', 'custody'],
    'management': ['hiring', 'onboarding', 'sprint', 'roadmap', 'stakeholder', 'performance', 'okr'],
    'ai': ['llm', 'machine learning', 'ml', 'mcp', 'agent', 'ai-augmented', 'automation', 'generative'],
    'node': ['javascript', 'typescript', 'express', 'esm', 'npm', 'backend'],
    'javascript': ['typescript', 'node', 'react', 'vue', 'full-stack', 'esm'],
    'typescript': ['javascript', 'node', 'full-stack'],
    'full-stack': ['frontend', 'backend', 'node', 'react', 'api', 'database'],
    'cloud': ['aws', 'cloudflare', 'docker', 'kubernetes', 'infrastructure', 'serverless', 'workers'],
    'identity': ['passkey', 'webauthn', 'authentication', 'key management'],
    'strategy': ['roadmap', 'vision', 'planning', 'stakeholder', 'board', 'investor', 'growth'],
    'custody': ['wallet', 'key management', 'multi-sig', 'cold storage', 'digital asset'],
    'scale': ['growth', 'distributed', 'multi-site', 'global', 'enterprise', 'high-availability'],
    'investor': ['draper', 'raised', 'seed', 'pitch', 'due diligence', 'funding', 'series'],
    'remote': ['distributed', 'global', 'multiple countries', 'cross-timezone'],
    'fintech': ['payment', 'financial', 'banking', 'custody', 'digital asset'],
  },
  regtech: {
    'compliance': ['kyc', 'aml', 'regulatory', 'sandbox', 'securities commission', 'soc 2', 'pci', 'fca', 'mica', 'licensed', 'audit'],
    'regulatory': ['compliance', 'sandbox', 'securities commission', 'fca', 'mica', 'policy', 'framework', 'oversight', 'regulator'],
    'kyc': ['aml', 'cdd', 'customer due diligence', 'identity verification', 'transaction monitoring', 'onboarding'],
    'aml': ['kyc', 'financial crime', 'sanctions', 'transaction monitoring', 'suspicious activity', 'compliance'],
    'fintech': ['payment', 'financial', 'banking', 'custody', 'digital asset', 'kyc', 'aml', 'regulated', 'neobank'],
    'regulated': ['compliance', 'regulatory', 'sandbox', 'securities', 'kyc', 'aml', 'audit', 'soc', 'licensed', 'oversight'],
    'blockchain': ['digital asset', 'distributed ledger', 'dlt', 'crypto', 'custody', 'tokenisation'],
    'digital asset': ['cryptocurrency', 'token', 'custody', 'blockchain', 'distributed ledger', 'licensed'],
    'custody': ['custodian', 'safekeeping', 'digital asset', 'wallet', 'cokeeps', 'institutional'],
    'risk': ['compliance', 'audit', 'governance', 'controls', 'oversight', 'framework', 'assurance'],
    'governance': ['policy', 'framework', 'controls', 'audit', 'board', 'oversight', 'risk'],
    'security': ['cryptographic', 'key management', 'encryption', 'data protection', 'audit'],
    'institutional': ['enterprise', 'bank', 'dbs', 'financial institution', 'advisory', 'stakeholder'],
    'advisory': ['consulting', 'training', 'engagement', 'institutional', 'dbs bank', 'baker hostetler'],
    'sandbox': ['regulatory', 'securities commission', 'pilot', 'innovation', 'experimental'],
    'policy': ['regulatory', 'framework', 'governance', 'legislation', 'guideline', 'standard'],
    'audit': ['assurance', 'controls', 'soc 2', 'pci', 'evidence', 'attestation'],
    'fca': ['uk regulation', 'financial conduct authority', 'authorised', 'regulated', 'mica'],
    'data protection': ['gdpr', 'privacy', 'data governance', 'retention', 'consent'],
    'financial crime': ['aml', 'sanctions', 'fraud', 'transaction monitoring', 'suspicious activity'],
    'identity': ['kyc', 'verification', 'onboarding', 'cdd', 'passkey', 'webauthn'],
    'ai': ['automation', 'machine learning', 'monitoring', 'detection', 'analytics'],
    'stakeholder': ['regulator', 'board', 'executive', 'institutional', 'central bank'],
  },
  devrel: {
    'developer': ['community', 'documentation', 'sdk', 'api', 'tutorial', 'workshop', 'ecosystem', 'contributor'],
    'community': ['developer', 'contributor', 'open source', 'ecosystem', 'forum', 'meetup', 'ambassador'],
    'documentation': ['technical writing', 'api docs', 'sdk', 'tutorial', 'guide', 'reference', 'readme'],
    'sdk': ['toolkit', 'api', 'library', 'npm', 'package', 'developer tooling', 'consumer sdk', 'integration'],
    'open source': ['github', 'repository', 'npm', 'contributor', 'backpress', 'oss', 'community', 'public repo'],
    'content': ['writing', 'blog', 'documentation', 'tutorial', 'video', 'speaking', 'thought leadership', 'article'],
    'speaking': ['conference', 'tedx', 'webcamp', 'meetup', 'presentation', 'keynote', 'workshop', 'slideshare'],
    'conference': ['tedx', 'webcamp', 'finnovasia', 'mdec', 'speaker', 'presentation', 'summit'],
    'advocacy': ['evangelism', 'developer relations', 'community', 'education', 'outreach', 'engagement'],
    'tutorial': ['workshop', 'training', 'curriculum', 'guide', 'hands-on', 'startingblock', 'hackathon'],
    'blockchain': ['bitcoin', 'ethereum', 'web3', 'crypto', 'digital asset', 'ordinals', 'protocol'],
    'protocol': ['sado', 'dn-key', 'everstore', 'ordit', 'specification', 'standard', 'open-source'],
    'ai': ['llm', 'mcp', 'agent', 'ai-augmented', 'generative', 'model context protocol'],
    'gaming': ['game engine', 'moddable', 'chess', 'hexmap', 'variant', 'plugin', 'modding'],
    'javascript': ['typescript', 'node', 'esm', 'npm', 'frontend', 'full-stack'],
    'node': ['javascript', 'typescript', 'esm', 'npm', 'backend'],
    'education': ['training', 'workshop', 'curriculum', 'startingblock', 'hackathon', 'hack-pack'],
    'hackathon': ['dbs bank', 'hack-pack', 'workshop', 'developer event', 'hands-on'],
    'video': ['youtube', 'recording', 'livestream', 'demo', 'screencast'],
    'writing': ['article', 'whitepaper', 'blog', 'publication', 'islamic finance news', 'byline'],
    'integration': ['sdk', 'api', 'webhook', 'plugin', 'embed', 'third-party'],
    'remote': ['distributed', 'global', 'async'],
  },
};

function expandKeywords(text, variant) {
  const lower = text.toLowerCase();
  const expanded = new Set(lower.split(/\s+/).filter(w => w.length > 3));
  const expansions = VARIANT_EXPANSIONS[variant] || VARIANT_EXPANSIONS.cto;

  for (const [trigger, synonyms] of Object.entries(expansions)) {
    if (lower.includes(trigger)) {
      synonyms.forEach(s => expanded.add(s));
    }
  }

  return expanded;
}


function matchProofPoints(requirements, profile, variant) {
  // Load proof points directly from the CV HTML for this variant.
  // Each CV tells the same career story differently — CTO emphasises leadership,
  // DevRel emphasises community/content, RegTech emphasises compliance.
  const cvProofs = getProofPoints(variant);

  const matches = [];
  const unmatchedReqs = [];
  const usedProofs = new Set();

  for (const req of requirements) {
    const reqKeywords = expandKeywords(req, variant);

    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < cvProofs.length; i++) {
      if (usedProofs.has(i)) continue;
      const proof = cvProofs[i];
      const proofLower = proof.text.toLowerCase();
      let score = 0;

      for (const keyword of reqKeywords) {
        if (proofLower.includes(keyword)) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { text: proof.text, source: proof.source, index: i };
      }
    }

    if (bestMatch && bestScore >= 4) {
      matches.push({ requirement: req, evidence: bestMatch.text, source: bestMatch.source, score: bestScore });
      usedProofs.add(bestMatch.index);
    } else {
      unmatchedReqs.push(req);
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return { matches, gaps: unmatchedReqs };
}

function scoreMatch(matches, gaps, totalRequirements) {
  if (totalRequirements === 0) return 0;

  // Cap denominator: if parser found 30+ "requirements", many are noise.
  // Real JDs have 5-15 actual requirements. Use the lower of actual count or 15.
  const effectiveDenominator = Math.min(totalRequirements, 15);
  const matchRatio = Math.min(matches.length / effectiveDenominator, 1.0);

  const avgStrength = matches.length > 0
    ? matches.reduce((sum, m) => sum + Math.min(m.score, 20), 0) / matches.length / 20
    : 0;

  // Bonus for absolute match count (5+ strong matches is a good sign regardless of total)
  const countBonus = Math.min(matches.length * 3, 15);

  const raw = (matchRatio * 55) + (avgStrength * 30) + countBonus;
  return Math.round(Math.min(raw, 100));
}

function matchJob(jobDescription, options = {}) {
  const profile = loadProfile();
  const requirements = options.requirements || extractRequirements(jobDescription);
  const metadata = options.metadata || extractMetadata(jobDescription);
  const bestVariant = options.variant || detectVariant(requirements);

  // Score against all three CVs
  const scores = {};
  const variants = ['cto', 'regtech', 'devrel'];
  let bestScore = 0;
  let bestResult = null;

  for (const v of variants) {
    const { matches, gaps: rawGaps } = matchProofPoints(requirements, profile, v);
    const score = scoreMatch(matches, rawGaps, requirements.length);
    scores[v] = score;

    if (v === bestVariant) {
      const gaps = rawGaps.filter(g =>
        g.length > 25 && g.length < 200 &&
        !g.match(/^(Leadership|Strategy|About|Tasks|Responsibilities|Communication|Security)/i)
      ).slice(0, 8);
      const topProofs = matches.slice(0, 5).map(m => ({
        requirement: m.requirement,
        evidence: m.evidence
      }));
      bestResult = { matches, gaps, topProofs };
    }

    if (score > bestScore) bestScore = score;
  }

  // Use the detected variant's detailed results for gaps/proofs
  const { gaps, topProofs } = bestResult;

  // Confidence based on data quality: how much evidence the score is built on
  const MIN_REQS_FOR_CONFIDENCE = 5;
  let confidence;
  if (requirements.length >= 8 && bestResult.matches.length >= 4) confidence = 'high';
  else if (requirements.length >= MIN_REQS_FOR_CONFIDENCE) confidence = 'medium';
  else confidence = 'low';

  return {
    company: metadata.company || 'Unknown Company',
    role: metadata.role || 'Unknown Role',
    location: metadata.location || '',
    variant: bestVariant,
    score: scores[bestVariant],
    scores,
    confidence,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    requirements_found: requirements.length,
    matched: bestResult.matches.length,
    gaps,
    proof_points: topProofs,
    opening: '',
    body: '',
    closing: ''
  };
}

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node match-job.js <job-description.txt>');
    console.error('       node match-job.js --stdin');
    process.exit(1);
  }

  let jd;
  if (arg === '--stdin') {
    const chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => {
      jd = Buffer.concat(chunks).toString();
      const result = matchJob(jd);
      console.log(JSON.stringify(result, null, 2));
    });
  } else {
    jd = fs.readFileSync(arg, 'utf-8');
    const result = matchJob(jd);
    console.log(JSON.stringify(result, null, 2));
  }
}

module.exports = { matchJob, extractRequirements, detectVariant, loadProfile };

const fs = require('fs');
const path = require('path');

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
    .replace(/(Requirements|Qualifications|What you|Must have|Nice to have|Responsibilities|About the role|About you|Skills|Experience)/gi, '\n$1')
    .replace(/(Benefits|Perks|We offer|How to apply|About us|Why join|Salary|Compensation)/gi, '\n$1')
    .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
    .replace(/•/g, '\n- ')
    .replace(/•/g, '\n- ')
    .replace(/(\d+)\+?\s*years/gi, '\n$&');

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

  if (requirements.length === 0) {
    const fullText = jobDescription.toLowerCase();
    const yearMatches = fullText.match(/\d+\+?\s*years[^.]+/g) || [];
    const expMatches = fullText.match(/experience (?:in|with)[^.]+/g) || [];
    const skillMatches = fullText.match(/(?:proficien|strong|deep|proven|expert)[^.]+/g) || [];
    requirements.push(...yearMatches.slice(0, 5), ...expMatches.slice(0, 5), ...skillMatches.slice(0, 5));
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

const KEYWORD_EXPANSIONS = {
  'blockchain': ['bitcoin', 'ethereum', 'utxo', 'ordinals', 'taproot', 'protocol', 'web3', 'crypto', 'digital asset'],
  'production': ['shipped', 'built', 'deployed', 'launched', 'live', 'production', 'shipping'],
  'team': ['engineers', 'hiring', 'managed', 'led', 'founded', 'cross-functional', 'moonshot', 'onboarding'],
  'leadership': ['cto', 'head of', 'led', 'managed', 'founded', 'director', 'vp', 'engineering leader'],
  'sdk': ['toolkit', 'api', 'library', 'npm', 'package', 'developer tooling', 'consumer sdk'],
  'startup': ['seed', 'series', '500 startups', 'antler', 'founder', 'co-founded', 'early-stage'],
  'fundrais': ['draper', 'investment', 'raised', 'seed', 'series', '$500k', '$300k', 'investor', 'pitch'],
  'protocol': ['sado', 'dn-key', 'everstore', 'ordit', 'bip32', 'psbt'],
  'architecture': ['extensible', 'plugin', 'framework', 'designed', 'infrastructure', 'system', 'scalable'],
  'open source': ['github', 'repository', 'npm', 'contributor', 'backpress', 'open-source'],
  'compliance': ['kyc', 'aml', 'regulatory', 'sandbox', 'securities commission', 'soc 2', 'pci'],
  'devrel': ['documentation', 'developer', 'community', 'advocacy', 'speaking', 'content'],
  'fintech': ['payment', 'financial', 'banking', 'custody', 'digital asset', 'kyc', 'aml', 'regulated'],
  'regulated': ['compliance', 'regulatory', 'sandbox', 'securities', 'kyc', 'aml', 'audit', 'soc'],
  'remote': ['distributed', 'async', 'global', 'multiple countries', 'cross-timezone'],
  'distributed': ['remote', 'global', 'multiple countries', 'malaysia', 'singapore', 'uk'],
  'delivery': ['shipped', 'commits', 'deployed', 'launched', 'production', 'ci/cd', 'sprint'],
  'security': ['cryptographic', 'custody', 'passkey', 'webauthn', 'key management', 'audit'],
  'investor': ['draper', 'raised', 'seed', 'pitch', 'due diligence', 'funding'],
  'management': ['hiring', 'onboarding', 'sprint', 'roadmap', 'stakeholder', 'performance'],
};

function expandKeywords(text) {
  const lower = text.toLowerCase();
  const expanded = new Set(lower.split(/\s+/).filter(w => w.length > 3));

  for (const [trigger, synonyms] of Object.entries(KEYWORD_EXPANSIONS)) {
    if (lower.includes(trigger)) {
      synonyms.forEach(s => expanded.add(s));
    }
  }

  return expanded;
}

function matchProofPoints(requirements, profile, variant) {
  const allProofs = [];

  for (const job of profile.work_history) {
    for (const point of job.proof_points) {
      allProofs.push({ source: `${job.company} (${job.title})`, text: point, tech: job.tech || [] });
    }
  }
  for (const proto of profile.protocols) {
    allProofs.push({ source: proto.name, text: `${proto.description}. ${proto.adoption}`, tech: [] });
  }
  for (const ach of profile.achievements) {
    allProofs.push({ source: 'Achievement', text: ach, tech: [] });
  }

  const matches = [];
  const unmatchedReqs = [];
  const usedProofs = new Set();

  for (const req of requirements) {
    const reqKeywords = expandKeywords(req);

    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < allProofs.length; i++) {
      if (usedProofs.has(i)) continue;
      const proof = allProofs[i];
      const proofLower = proof.text.toLowerCase();
      const techLower = proof.tech.map(t => t.toLowerCase()).join(' ');
      const proofFull = proofLower + ' ' + techLower;
      let score = 0;

      for (const keyword of reqKeywords) {
        if (proofFull.includes(keyword)) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { ...proof, index: i };
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
  if (totalRequirements === 0) return 50;
  const matchRatio = matches.length / totalRequirements;
  const avgStrength = matches.length > 0
    ? matches.reduce((sum, m) => sum + Math.min(m.score, 20), 0) / matches.length / 20
    : 0;
  return Math.round((matchRatio * 70) + (avgStrength * 30));
}

function matchJob(jobDescription, options = {}) {
  const profile = loadProfile();
  const requirements = options.requirements || extractRequirements(jobDescription);
  const metadata = options.metadata || extractMetadata(jobDescription);
  const variant = options.variant || detectVariant(requirements);

  const { matches, gaps } = matchProofPoints(requirements, profile, variant);
  const score = scoreMatch(matches, gaps, requirements.length);

  const topProofs = matches.slice(0, 5).map(m => ({
    requirement: m.requirement,
    evidence: m.evidence
  }));

  return {
    company: metadata.company || 'Unknown Company',
    role: metadata.role || 'Unknown Role',
    location: metadata.location || '',
    variant,
    score,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    requirements_found: requirements.length,
    matched: matches.length,
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

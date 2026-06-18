import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const discoveryPath = resolve(import.meta.dirname, 'jobs-discovery.json');
const filteredPath = resolve(import.meta.dirname, 'jobs-filtered.json');

const discovery = JSON.parse(readFileSync(discoveryPath, 'utf-8'));

// Tier 1: Strong relevance — fetch and score these first
const TIER1_PATTERNS = [
  /\bcto\b/i,
  /\bchief.?tech/i,
  /\bhead of engineering\b/i,
  /\bvp.{0,5}engineer/i,
  /\bengineering director\b/i,
  /\bdirector.{0,10}engineer/i,
  /\btechnical director\b/i,
  /\bblockchain\b/i,
  /\bcrypto(?:currency)?\b/i,
  /\bweb3\b/i,
  /\bdigital.?asset/i,
  /\bprotocol\b/i,
  /\bdevrel\b/i,
  /\bdeveloper.?relat/i,
  /\bdeveloper.?advoc/i,
  /\btechnical.?evangel/i,
  /\bfounding engineer\b/i,
  /\bhead of.{0,15}(platform|protocol|product|r&d|innovation)\b/i,
  /\bfintech\b/i,
  /\bregtech\b/i,
  /\bcompliance.{0,10}(tech|engineer|lead|head|director)\b/i,
  /\bsdk\b/i,
  /\bdefi\b/i,
  /\bordinals\b/i,
  /\bdlt\b/i,
  /\bdistributed ledger\b/i,
];

// Tier 2: Probably relevant — generic senior leadership that may match
const TIER2_PATTERNS = [
  /\bhead of\b/i,
  /\bdirector\b/i,
  /\bvp\b/i,
  /\bvice president\b/i,
  /\barchitect\b/i,
  /\blead engineer\b/i,
  /\bengineering lead\b/i,
  /\bengineering manager\b/i,
  /\btechnical lead\b/i,
  /\btech lead\b/i,
  /\bprincipal\b/i,
  /\bstaff engineer\b/i,
  /\bstaff.{0,10}engineer\b/i,
  /\bfounding\b/i,
  /\bstartup\b/i,
  /\b(ai|ml|machine learning)\b/i,
  /\bco-?founder\b/i,
  /\bcio\b/i,
];

// Reject: these snuck through the initial filter
const REJECT_PATTERNS = [
  /\bjunior\b/i,
  /\bintern\b/i,
  /\bgraduate\b/i,
  /\baccountant\b/i,
  /\bnurse\b/i,
  /\bteacher\b/i,
  /\bsales\b/i,
  /\bcustomer.?service/i,
  /\bhr\b/i,
  /\bmarketing\b/i,
  /\boperations\b/i,
  /\boffice manager/i,
  /\bwarehouse\b/i,
  /\bdriver\b/i,
  /\brecruiter\b/i,
  /\badmin\b/i,
  /\breceptionist\b/i,
];

const tier1 = [];
const tier2 = [];
const rejected = [];

for (const job of discovery.jobs) {
  const title = job.title;

  if (REJECT_PATTERNS.some(p => p.test(title))) {
    rejected.push(job);
    continue;
  }

  if (TIER1_PATTERNS.some(p => p.test(title))) {
    tier1.push(job);
  } else if (TIER2_PATTERNS.some(p => p.test(title))) {
    tier2.push(job);
  } else {
    rejected.push(job);
  }
}

const output = {
  filtered_at: new Date().toISOString(),
  tier1_count: tier1.length,
  tier2_count: tier2.length,
  rejected_count: rejected.length,
  tier1: tier1,
  tier2: tier2
};

writeFileSync(filteredPath, JSON.stringify(output, null, 2) + '\n');

console.log(`\n╔══════════════════════════════════════════════╗`);
console.log(`║  Discovery Filter Results                    ║`);
console.log(`╠══════════════════════════════════════════════╣`);
console.log(`║  Tier 1 (strong): ${String(tier1.length).padEnd(5)}                      ║`);
console.log(`║  Tier 2 (likely): ${String(tier2.length).padEnd(5)}                      ║`);
console.log(`║  Rejected:        ${String(rejected.length).padEnd(5)}                      ║`);
console.log(`║  Total to score:  ${String(tier1.length + tier2.length).padEnd(5)}                      ║`);
console.log(`╚══════════════════════════════════════════════╝`);

console.log(`\nTier 1 sample:`);
tier1.slice(0, 20).forEach(j => console.log(`  ${j.title} @ ${j.company}`));

console.log(`\nTier 2 sample:`);
tier2.slice(0, 15).forEach(j => console.log(`  ${j.title} @ ${j.company}`));

console.log(`\nRejected sample:`);
rejected.slice(0, 10).forEach(j => console.log(`  ${j.title} @ ${j.company}`));

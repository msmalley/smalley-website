import { load } from 'cheerio';

const CRYPTO_JOBS_RSS = 'https://crypto.jobs/feed/rss';

function parseRssXml(xml) {
  const $ = load(xml, { xmlMode: true });
  const jobs = [];

  $('item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('title').text().trim();
    const link = $el.find('link').text().trim();
    const pubDate = $el.find('pubDate').text().trim();
    const category = $el.find('category').text().trim();
    const description = $el.find('description').text().trim();

    const companyMatch = description.match(/<strong>Company:<\/strong>\s*([^<]+)/);
    const locationMatch = description.match(/<strong>Location:<\/strong>\s*([^<]+)/);
    const salaryMatch = description.match(/<strong>Salary:<\/strong>\s*([^<]+)/);
    const typeMatch = description.match(/<strong>Type:<\/strong>\s*([^<]+)/);
    const skillsMatch = description.match(/<strong>Skills:<\/strong>\s*([^<]+)/);

    jobs.push({
      title,
      company: companyMatch ? companyMatch[1].trim() : extractCompanyFromTitle(title),
      location: locationMatch ? locationMatch[1].trim() : '',
      salary: salaryMatch ? salaryMatch[1].trim() : null,
      type: typeMatch ? typeMatch[1].trim() : '',
      skills: skillsMatch ? skillsMatch[1].trim() : '',
      category,
      posted: pubDate,
      url: link.split('?')[0],
      source: 'crypto.jobs'
    });
  });

  return jobs;
}

function extractCompanyFromTitle(title) {
  const atMatch = title.match(/at\s+(.+)$/i);
  return atMatch ? atMatch[1].trim() : '';
}

export async function searchCryptoJobs(options = {}) {
  const response = await fetch(CRYPTO_JOBS_RSS, {
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
  });

  if (!response.ok) {
    throw new Error(`crypto.jobs RSS error: ${response.status}`);
  }

  const xml = await response.text();
  let jobs = parseRssXml(xml);

  if (options.keywords) {
    const keywords = options.keywords.toLowerCase().split(/\s+/);
    jobs = jobs.filter(job => {
      const text = `${job.title} ${job.company} ${job.skills} ${job.category}`.toLowerCase();
      return keywords.some(k => text.includes(k));
    });
  }

  if (options.location) {
    const loc = options.location.toLowerCase();
    jobs = jobs.filter(job => job.location.toLowerCase().includes(loc) || loc === 'remote');
  }

  return {
    count: jobs.length,
    jobs: jobs.slice(0, options.limit || 25),
    source: 'crypto_jobs_rss',
    feed_url: CRYPTO_JOBS_RSS
  };
}

import { load } from 'cheerio';

const BASE_URL = 'https://uk.indeed.com/jobs';
const VIEW_URL = 'https://uk.indeed.com/viewjob';

const FROMAGE = {
  '24h': '1',
  '7d': '7',
  '30d': '30'
};

export function buildSearchUrl(options) {
  const params = new URLSearchParams();
  if (options.keywords) params.set('q', options.keywords);
  if (options.location) params.set('l', options.location);
  params.set('sort', 'date');
  if (options.posted_within && FROMAGE[options.posted_within]) {
    params.set('fromage', FROMAGE[options.posted_within]);
  }
  if (options.start) params.set('start', String(options.start));
  return `${BASE_URL}?${params}`;
}

export function parseJobCards(html) {
  const $ = load(html);
  const jobs = [];

  $('div.job_seen_beacon, div.resultContent, div.cardOutline').each((_, el) => {
    const $el = $(el);

    const titleEl = $el.find('h2.jobTitle a, a[data-jk], span[id^="jobTitle"]');
    const companyEl = $el.find('[data-testid="company-name"], span.companyName, span.css-1h7lukg');
    const locationEl = $el.find('[data-testid="text-location"], div.companyLocation, div.css-1restlb');
    const salaryEl = $el.find('div.salary-snippet-container, div.metadata.salary-snippet-container, [data-testid="attribute_snippet_testid"]');
    const dateEl = $el.find('span.date, span[data-testid="myJobsStateDate"]');

    const title = titleEl.text().trim();
    const company = companyEl.text().trim();

    if (!title || !company) return;

    const linkEl = $el.find('a[data-jk], h2.jobTitle a');
    const jobId = linkEl.attr('data-jk') || '';
    const href = linkEl.attr('href') || '';
    const idFromHref = href.match(/jk=([a-f0-9]+)/)?.[1];
    const finalId = jobId || idFromHref || '';

    const url = finalId
      ? `https://uk.indeed.com/viewjob?jk=${finalId}`
      : (href.startsWith('http') ? href : `https://uk.indeed.com${href}`);

    const salaryText = salaryEl.text().trim();
    const dateText = dateEl.text().trim().replace(/^posted\s*/i, '');

    jobs.push({
      title,
      company,
      location: locationEl.text().trim(),
      posted: dateText || null,
      salary: salaryText || null,
      url,
      job_id: finalId,
      source: 'indeed'
    });
  });

  return jobs;
}

export async function searchIndeed(options = {}) {
  const url = buildSearchUrl(options);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9'
    }
  });

  if (response.status === 403) {
    return {
      count: 0,
      jobs: [],
      source: 'indeed_uk',
      search_url: url,
      blocked: true,
      note: 'Cloudflare Turnstile active. Use WebFetch on the search_url during Claude Code sessions to get results.'
    };
  }

  if (!response.ok) {
    throw new Error(`Indeed search error: ${response.status}`);
  }

  const html = await response.text();

  if (html.includes('Just a moment')) {
    return {
      count: 0,
      jobs: [],
      source: 'indeed_uk',
      search_url: url,
      blocked: true,
      note: 'Cloudflare challenge page returned. Use WebFetch on the search_url during Claude Code sessions.'
    };
  }

  const rawJobs = parseJobCards(html);

  const seen = new Set();
  const jobs = rawJobs.filter(j => {
    const key = `${j.title}|${j.company}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    count: jobs.length,
    jobs,
    source: 'indeed_uk',
    search_url: url
  };
}

export async function fetchIndeedJobDescription(jobId) {
  const url = `${VIEW_URL}?jk=${jobId}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9'
    }
  });

  if (response.status === 403) {
    return {
      url,
      source: 'indeed',
      blocked: true,
      note: 'Cloudflare Turnstile active. Use WebFetch on this URL during Claude Code sessions.'
    };
  }

  if (!response.ok) {
    throw new Error(`Indeed job detail error: ${response.status}`);
  }

  const html = await response.text();

  if (html.includes('Just a moment')) {
    return {
      url,
      source: 'indeed',
      blocked: true,
      note: 'Cloudflare challenge page. Use WebFetch on this URL.'
    };
  }

  const $ = load(html);

  const title = $('h1.jobsearch-JobInfoHeader-title, h1[data-testid="jobsearch-JobInfoHeader-title"]').text().trim() ||
                $('h1').first().text().trim();
  const company = $('div[data-testid="inlineHeader-companyName"] a, div.jobsearch-InlineCompanyRating a').first().text().trim();
  const location = $('div[data-testid="inlineHeader-companyLocation"], div.jobsearch-JobInfoHeader-subtitle div').last().text().trim();
  const description = $('div#jobDescriptionText, div.jobsearch-JobComponent-description').text().trim();
  const salary = $('div#salaryInfoAndJobType span, [data-testid="attribute_snippet_testid"]').first().text().trim();

  return {
    title,
    company,
    location,
    salary: salary || null,
    description,
    url,
    source: 'indeed'
  };
}

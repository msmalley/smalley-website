import { load } from 'cheerio';

const GUEST_API = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';

const GEO_IDS = {
  uk: '101165590',
  london: '102257491',
  singapore: '102454443',
  usa: '103644278',
  europe: '100506914',
  remote: ''
};

const TIME_FILTERS = {
  '24h': 'r86400',
  '7d': 'r604800',
  '30d': 'r2592000'
};

const EXPERIENCE_LEVELS = {
  director: '5',
  executive: '6'
};

const WORKPLACE_TYPES = {
  remote: '2',
  hybrid: '3',
  onsite: '1'
};

function buildSearchUrl(options) {
  const params = new URLSearchParams();

  if (options.keywords) params.set('keywords', options.keywords);
  if (options.location) params.set('location', options.location);

  const geoId = options.geoId || GEO_IDS[options.location?.toLowerCase()];
  if (geoId) params.set('geoId', geoId);

  if (options.posted_within && TIME_FILTERS[options.posted_within]) {
    params.set('f_TPR', TIME_FILTERS[options.posted_within]);
  }

  if (options.experience) {
    const level = EXPERIENCE_LEVELS[options.experience.toLowerCase()];
    if (level) params.set('f_E', level);
  }

  if (options.workplace) {
    const type = WORKPLACE_TYPES[options.workplace.toLowerCase()];
    if (type) params.set('f_WT', type);
  }

  if (options.job_type === 'fulltime') params.set('f_JT', 'F');
  if (options.job_type === 'contract') params.set('f_JT', 'C');

  params.set('sortBy', options.sort === 'relevance' ? 'R' : 'DD');
  params.set('start', String(options.start || 0));

  return `${GUEST_API}?${params}`;
}

function parseJobCards(html) {
  const $ = load(html);
  const jobs = [];

  $('div.base-search-card, li').each((_, el) => {
    const $el = $(el);

    const titleEl = $el.find('h3.base-search-card__title, .base-search-card__title');
    const companyEl = $el.find('h4.base-search-card__subtitle a, .base-search-card__subtitle a');
    const locationEl = $el.find('span.job-search-card__location, .job-search-card__location');
    const dateEl = $el.find('time.job-search-card__listdate, time');
    const salaryEl = $el.find('span.job-search-card__salary-info, .job-search-card__salary-info');
    const linkEl = $el.find('a.base-card__full-link, a[href*="/jobs/view/"]');

    const title = titleEl.text().trim();
    const company = companyEl.text().trim();

    if (!title || !company) return;

    const url = linkEl.attr('href') || '';
    const jobIdMatch = url.match(/\/jobs\/view\/(\d+)/);

    jobs.push({
      title,
      company,
      location: locationEl.text().trim(),
      posted: dateEl.attr('datetime') || dateEl.text().trim(),
      salary: salaryEl.text().trim() || null,
      url: url.split('?')[0],
      job_id: jobIdMatch ? jobIdMatch[1] : null
    });
  });

  return jobs;
}

export async function searchLinkedInJobs(options) {
  const url = buildSearchUrl(options);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (response.status === 999) {
    throw new Error('LinkedIn rate limited (HTTP 999). Wait 30-60 seconds before retrying.');
  }

  if (!response.ok) {
    throw new Error(`LinkedIn guest API error: ${response.status}`);
  }

  const html = await response.text();
  const rawJobs = parseJobCards(html);

  const seen = new Set();
  const jobs = rawJobs.filter(j => {
    const key = `${j.title}|${j.company}|${j.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    count: jobs.length,
    jobs,
    source: 'linkedin_guest_api',
    search_url: `https://www.linkedin.com/jobs/search/?${new URLSearchParams({ keywords: options.keywords || '', location: options.location || '' })}`
  };
}

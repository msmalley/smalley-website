const BASE_URL = 'https://web3.career/api/v1';

export async function searchWeb3Career(options = {}) {
  const token = process.env.WEB3_CAREER_API_TOKEN;
  if (!token) {
    throw new Error('WEB3_CAREER_API_TOKEN not configured. Register at web3.career for a free API token.');
  }

  const params = new URLSearchParams();
  params.set('token', token);

  if (options.limit) params.set('limit', String(Math.min(options.limit, 100)));
  if (options.remote) params.set('remote', 'true');

  const tagMap = {
    'blockchain': 'blockchain',
    'web3': 'web3',
    'solidity': 'solidity',
    'rust': 'rust',
    'typescript': 'typescript',
    'react': 'react',
    'node': 'node',
    'defi': 'defi',
    'ai': 'ai'
  };

  if (options.tag && tagMap[options.tag.toLowerCase()]) {
    params.set('tag', tagMap[options.tag.toLowerCase()]);
  }

  const url = `${BASE_URL}?${params}`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  if (response.status === 429) {
    throw new Error('web3.career rate limited. Wait before retrying.');
  }

  if (!response.ok) {
    throw new Error(`web3.career API error: ${response.status}`);
  }

  const data = await response.json();
  let raw = Array.isArray(data) ? data : (data.jobs || []);
  // API returns [infoString, infoString, [actual jobs array]]
  if (raw.length && Array.isArray(raw[raw.length - 1])) {
    raw = raw[raw.length - 1];
  } else {
    raw = raw.filter(item => typeof item === 'object' && item !== null);
  }
  let jobs = raw;

  jobs = jobs.map(j => {
    const descHtml = j.description || '';
    const descText = descHtml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').replace(/&[a-z]+;/g, '').replace(/\s+/g, ' ').trim();
    return {
      title: j.title || '',
      company: j.company || j.company_name || '',
      location: j.location || '',
      salary: j.salary || j.compensation || null,
      salary_min: j.salary_min_value || j.estimated_min_salary || null,
      salary_max: j.salary_max_value || j.estimated_max_salary || null,
      posted: j.date || j.published_at || j.created_at || '',
      url: j.apply_url || j.url || '',
      skills: j.tags ? j.tags.join(', ') : (j.skills || ''),
      description: descText.length > 50 ? descText : null,
      source: 'web3.career'
    };
  });

  if (options.keywords) {
    const keywords = options.keywords.toLowerCase().split(/\s+/);
    jobs = jobs.filter(job => {
      const text = `${job.title} ${job.company} ${job.skills} ${job.location}`.toLowerCase();
      return keywords.some(k => text.includes(k));
    });
  }

  if (options.location) {
    const loc = options.location.toLowerCase();
    if (loc !== 'remote') {
      jobs = jobs.filter(job =>
        job.location.toLowerCase().includes(loc) ||
        job.location.toLowerCase().includes('remote')
      );
    }
  }

  return {
    count: jobs.length,
    jobs: jobs.slice(0, options.limit || 25),
    source: 'web3_career_api',
    api_url: BASE_URL
  };
}

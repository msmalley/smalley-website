const API_BASE = 'https://api.linkedin.com/v2';
const RESTLI_BASE = 'https://api.linkedin.com/rest';

function getCredentials() {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;

  if (!accessToken || accessToken === 'your_access_token_here') {
    throw new Error(
      'LinkedIn not configured. To set up:\n' +
      '1. Go to linkedin.com/developers → create app (or use existing)\n' +
      '2. Add products: "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect"\n' +
      '3. Generate a 3-legged OAuth2 token with scopes: openid, profile, email, w_member_social\n' +
      '4. Set LINKEDIN_ACCESS_TOKEN in mcp/social/.env\n' +
      'Note: tokens expire after 60 days — refresh via the OAuth2 refresh flow.'
    );
  }

  return { accessToken };
}

async function linkedinRequest(method, url, body = null) {
  const { accessToken } = getCredentials();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202405'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 201 || response.status === 204) {
    const location = response.headers.get('x-restli-id') || response.headers.get('location');
    return { success: true, id: location };
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`LinkedIn API error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function getPersonUrn() {
  const { accessToken } = getCredentials();

  const response = await fetch(`${API_BASE}/userinfo`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to get LinkedIn profile: ${response.status}`);
  }

  const data = await response.json();
  return `urn:li:person:${data.sub}`;
}

export async function postLinkedIn(content, linkUrl = null) {
  if (content.length > 3000) {
    throw new Error(`LinkedIn post exceeds 3000 characters (${content.length}).`);
  }

  const authorUrn = await getPersonUrn();

  const shareContent = {
    shareCommentary: { text: content },
    shareMediaCategory: linkUrl ? 'ARTICLE' : 'NONE'
  };

  if (linkUrl) {
    shareContent.media = [{
      status: 'READY',
      originalUrl: linkUrl
    }];
  }

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const result = await linkedinRequest('POST', `${API_BASE}/ugcPosts`, body);

  return {
    success: true,
    id: result.id,
    url: `https://www.linkedin.com/feed/update/${result.id}/`,
    content
  };
}

export async function commentOnPost(activityUrn, text, parentCommentUrn = null) {
  if (text.length > 1250) {
    throw new Error(`LinkedIn comment exceeds 1250 characters (${text.length}).`);
  }

  const authorUrn = await getPersonUrn();

  const body = {
    actor: authorUrn,
    message: { text }
  };

  if (parentCommentUrn) {
    // LinkedIn requires format: urn:li:comment:(urn:li:activity:123,commentId)
    // Normalise from shorthand format if needed
    if (parentCommentUrn.includes('activity:') && !parentCommentUrn.includes('urn:li:activity:')) {
      parentCommentUrn = parentCommentUrn.replace('activity:', 'urn:li:activity:');
    }
    body.parentComment = parentCommentUrn;
  }

  const encoded = encodeURIComponent(activityUrn);
  const result = await linkedinRequest('POST', `${API_BASE}/socialActions/${encoded}/comments`, body);

  return {
    success: true,
    id: result.id,
    urn: result.$URN || null,
    activityUrn,
    parentComment: parentCommentUrn || null,
    text
  };
}

export async function searchJobs(keywords, location, postedWithin) {
  const params = new URLSearchParams({ keywords });

  if (location) params.append('location', location);

  if (postedWithin) {
    const timeMap = { '24h': 86400, '7d': 604800, '30d': 2592000 };
    const seconds = timeMap[postedWithin];
    if (seconds) params.append('f_TPR', `r${seconds}`);
  }

  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}${location ? '&location=' + encodeURIComponent(location) : ''}${postedWithin ? '&f_TPR=r' + ({ '24h': 86400, '7d': 604800, '30d': 2592000 }[postedWithin] || '') : ''}`;

  try {
    const result = await linkedinRequest(
      'GET',
      `${RESTLI_BASE}/jobSearch?${params}`
    );
    return result;
  } catch (error) {
    return {
      error: 'Job search requires LinkedIn Recruiter or Partner API access (not available with personal OAuth tokens).',
      search_url: searchUrl,
      tip: 'Open the search_url directly, or use Twitter search for job posts mentioning these keywords.'
    };
  }
}

export async function deletePost(shareUrn) {
  const encoded = encodeURIComponent(shareUrn);
  await linkedinRequest('DELETE', `${API_BASE}/ugcPosts/${encoded}`);
  return { success: true, deleted: shareUrn };
}

export async function getProfile(url) {
  if (url) {
    return {
      note: 'Fetching other profiles requires LinkedIn Recruiter API access.',
      profile_url: url
    };
  }

  const { accessToken } = getCredentials();

  const response = await fetch(`${API_BASE}/userinfo`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`LinkedIn API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    name: data.name,
    email: data.email,
    picture: data.picture,
    sub: data.sub
  };
}

const VOYAGER_BASE = 'https://www.linkedin.com/voyager/api';

function getVoyagerCredentials() {
  const liAt = process.env.LINKEDIN_LI_AT;
  const jsessionId = process.env.LINKEDIN_JSESSIONID;
  const lidc = process.env.LINKEDIN_LIDC;
  const bcookie = process.env.LINKEDIN_BCOOKIE;

  if (!liAt || liAt === 'your_li_at_cookie_here') {
    throw new Error(
      'LinkedIn Voyager not configured. To set up:\n' +
      '1. Open linkedin.com in Chrome, log in\n' +
      '2. DevTools → Application → Cookies → linkedin.com\n' +
      '3. Copy these cookie values into .env:\n' +
      '   LINKEDIN_LI_AT, LINKEDIN_JSESSIONID, LINKEDIN_LIDC, LINKEDIN_BCOOKIE'
    );
  }

  if (!jsessionId || !lidc || !bcookie) {
    throw new Error(
      'Missing Voyager cookies. All four are required in .env:\n' +
      'LINKEDIN_LI_AT, LINKEDIN_JSESSIONID, LINKEDIN_LIDC, LINKEDIN_BCOOKIE'
    );
  }

  return { liAt, jsessionId, lidc, bcookie };
}

function voyagerHeaders() {
  const { liAt, jsessionId, lidc, bcookie } = getVoyagerCredentials();
  const csrfToken = jsessionId.startsWith('ajax:') ? jsessionId : `ajax:${jsessionId}`;

  return {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'csrf-token': csrfToken,
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'x-restli-protocol-version': '2.0.0',
    'x-li-lang': 'en_US',
    'x-li-track': JSON.stringify({
      clientVersion: '1.13.42372',
      osName: 'web',
      timezoneOffset: 0,
      deviceFormFactor: 'DESKTOP',
      mpName: 'voyager-web'
    }),
    'x-requested-with': 'XMLHttpRequest',
    'cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}"; lidc=${lidc}; bcookie="${bcookie}"`
  };
}

async function voyagerRequest(path) {
  const url = `${VOYAGER_BASE}${path}`;
  const response = await fetch(url, { headers: voyagerHeaders(), redirect: 'manual' });

  if (response.status === 302) {
    throw new Error('LinkedIn session expired. Run ./refresh-cookies.sh to fix.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('LinkedIn CSRF check failed. Ensure JSESSIONID matches your li_at session.');
  }
  if (response.status === 429) {
    throw new Error('LinkedIn rate limited. Wait a few minutes before retrying.');
  }
  if (!response.ok) {
    throw new Error(`Voyager API error (${response.status}): ${response.statusText}`);
  }

  return response.json();
}

async function voyagerMutation(path, body) {
  const { liAt, jsessionId, lidc, bcookie } = getVoyagerCredentials();
  const csrfToken = jsessionId.startsWith('ajax:') ? jsessionId : `ajax:${jsessionId}`;

  const url = `${VOYAGER_BASE}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'origin': 'https://www.linkedin.com',
      'referer': 'https://www.linkedin.com/feed/',
      'csrf-token': csrfToken,
      'content-type': 'application/json',
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-track': JSON.stringify({
        clientVersion: '1.13.42372',
        osName: 'web',
        timezoneOffset: 0,
        deviceFormFactor: 'DESKTOP',
        mpName: 'voyager-web'
      }),
      'x-requested-with': 'XMLHttpRequest',
      'cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}"; lidc=${lidc}; bcookie="${bcookie}"`
    },
    body: JSON.stringify(body)
  });

  if (response.status === 302) {
    throw new Error('LinkedIn session expired. Run ./refresh-cookies.sh to fix.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('LinkedIn CSRF check failed on mutation. Run ./refresh-cookies.sh to fix.');
  }
  if (response.status === 429) {
    throw new Error('LinkedIn rate limited. Wait a few minutes before retrying.');
  }

  return response;
}

const REACT_QUERY_ID = process.env.LINKEDIN_REACT_QUERY_ID ||
  'voyagerSocialDashReactions.b731222600772fd42464c0fe19bd722b';

const URL_PREVIEW_QUERY_ID = 'voyagerContentcreationDashUpdateUrlPreview.8bcffc41bebe79cade03f6e7740ca941';

export async function warmUrlPreview(url) {
  const encoded = encodeURIComponent(url);
  const path = `/graphql?variables=(url:${encoded})&queryId=${URL_PREVIEW_QUERY_ID}`;
  const result = await voyagerRequest(path);
  return result;
}

export async function reactToContent(targetUrn, reactionType = 'LIKE') {
  const validReactions = ['LIKE', 'PRAISE', 'INTEREST', 'CURIOSITY', 'EMPATHY'];
  if (!validReactions.includes(reactionType)) {
    throw new Error(`Invalid reaction type. Must be one of: ${validReactions.join(', ')}`);
  }

  const response = await voyagerMutation(
    `/graphql?action=execute&queryId=${REACT_QUERY_ID}`,
    {
      includeWebMetadata: true,
      queryId: REACT_QUERY_ID,
      variables: {
        threadUrn: targetUrn,
        entity: { reactionType }
      }
    }
  );

  if (response.status === 200) {
    const data = await response.json();
    const result = data?.value?.data?.createSocialDashReactions;
    if (result?.resourceKey) {
      return {
        success: true,
        reactionUrn: result.resourceKey,
        targetUrn,
        reactionType
      };
    }
    const error = data?.value?.errors?.[0]?.message;
    if (error) throw new Error(error);
  }

  if (response.status === 404) {
    throw new Error(
      'Reaction queryId has rotated (LinkedIn deploys new hashes periodically).\n' +
      'To fix: like any post/comment in Firefox → DevTools → Network → filter "graphql" →\n' +
      'find the request with "voyagerSocialDashReactions" → copy the queryId value →\n' +
      'set LINKEDIN_REACT_QUERY_ID in .env'
    );
  }

  if (response.status === 409) {
    return { success: false, error: 'Already reacted to this content' };
  }

  const text = await response.text();
  throw new Error(`React failed (${response.status}): ${text.substring(0, 200)}`);
}

function extractShareId(urnOrUrl) {
  const shareMatch = urnOrUrl.match(/urn:li:share:(\d+)/);
  if (shareMatch) return shareMatch[1];

  const updateMatch = urnOrUrl.match(/update\/urn:li:share:(\d+)/);
  if (updateMatch) return updateMatch[1];

  const activityMatch = urnOrUrl.match(/urn:li:activity:(\d+)/);
  if (activityMatch) return activityMatch[1];

  const urlMatch = urnOrUrl.match(/activity[:-](\d+)/);
  if (urlMatch) return urlMatch[1];

  return urnOrUrl;
}

export async function getPostInsights(postIdentifier) {
  const id = extractShareId(postIdentifier);

  const shareUrn = `urn:li:share:${id}`;
  const data = await voyagerRequest(
    `/feed/updatesV2?q=backendUrnOrNss&urnOrNss=${encodeURIComponent(shareUrn)}&commentsCount=20&likesCount=20`
  );

  const included = data?.included || [];
  const hasActivityCounts = included.some(i =>
    i.$type === 'com.linkedin.voyager.feed.shared.SocialActivityCounts' &&
    i.urn?.startsWith('urn:li:activity:')
  );

  if (!hasActivityCounts) {
    const activityUrn = `urn:li:activity:${id}`;
    const retryData = await voyagerRequest(
      `/feed/updatesV2?q=backendUrnOrNss&urnOrNss=${encodeURIComponent(activityUrn)}&commentsCount=20&likesCount=20`
    );
    return parseResponse(retryData);
  }

  return parseResponse(data);
}

function parseResponse(data) {
  const included = data?.included || [];

  const activityCounts = included.find(i =>
    i.$type === 'com.linkedin.voyager.feed.shared.SocialActivityCounts' &&
    i.urn?.startsWith('urn:li:activity:') &&
    !i.urn?.includes('comment')
  );

  if (!activityCounts) {
    throw new Error('Post not found or no engagement data available.');
  }

  const comments = included.filter(i => i.$type === 'com.linkedin.voyager.feed.Comment');

  const commentsList = comments.map(c => ({
    author: c.commenterForDashConversion?.title?.text || 'Unknown',
    subtitle: c.commenterForDashConversion?.subtitle || null,
    text: c.commentV2?.text || c.comment?.values?.[0]?.value || '',
    created: c.createdTime || null,
    permalink: c.permalink || null
  }));

  const reactions = {};
  if (activityCounts.reactionTypeCounts?.length) {
    for (const r of activityCounts.reactionTypeCounts) {
      reactions[r.reactionType] = r.count;
    }
  }

  return {
    likes: activityCounts.numLikes || 0,
    comments: activityCounts.numComments || 0,
    shares: activityCounts.numShares || 0,
    impressions: activityCounts.numImpressions || null,
    reactions: Object.keys(reactions).length > 0 ? reactions : undefined,
    commentsList: commentsList.length > 0 ? commentsList : undefined,
    activityUrn: activityCounts.urn
  };
}

export async function verifySession() {
  const data = await voyagerRequest('/me');
  return {
    authenticated: true,
    name: `${data?.localizedFirstName || ''} ${data?.localizedLastName || ''}`.trim() || data?.data?.localizedFirstName || 'OK',
    entityUrn: data?.entityUrn || data?.data?.entityUrn || null
  };
}

const SHARE_QUERY_ID = process.env.LINKEDIN_SHARE_QUERY_ID ||
  'voyagerContentcreationDashShares.279996efa5064c01775d5aff003d9377';

export async function voyagerPost(content, linkUrl = null) {
  let mediaUrn = null;

  if (linkUrl) {
    const previewData = await warmUrlPreview(linkUrl);
    mediaUrn = previewData?.included?.[0]?.metadata?.shareMediaUrn ||
      previewData?.included?.[0]?.metadata?.backendUrn || null;

    if (!mediaUrn) {
      throw new Error(
        `URL preview warm succeeded but no article URN returned for: ${linkUrl}\n` +
        `LinkedIn may not be able to crawl this URL. Check OG tags are accessible.`
      );
    }
  }

  const post = {
    allowedCommentersScope: 'ALL',
    commentary: {
      attributesV2: [],
      text: content
    },
    intendedShareLifeCycleState: 'PUBLISHED',
    origin: 'FEED',
    visibilityDataUnion: {
      visibilityType: 'ANYONE'
    }
  };

  if (mediaUrn) {
    post.media = {
      category: 'URN_REFERENCE',
      mediaUrn: mediaUrn,
      originalUrl: null
    };
  }

  const body = {
    includeWebMetadata: true,
    queryId: SHARE_QUERY_ID,
    variables: { post }
  };

  const response = await voyagerMutation(
    `/graphql?action=execute&queryId=${SHARE_QUERY_ID}`,
    body
  );

  if (response.status === 404) {
    throw new Error(
      'Share queryId has rotated (LinkedIn deploys new hashes periodically).\n' +
      'To fix: post anything in Firefox → DevTools → Network → filter "graphql" →\n' +
      'find the request with "voyagerContentcreationDashShares" → copy the queryId value →\n' +
      'set LINKEDIN_SHARE_QUERY_ID in .env'
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Voyager post failed (${response.status}): ${text.substring(0, 300)}`);
  }

  const data = await response.json();
  const shareUrn = data?.value?.data?.createContentcreationDashShares?.urn ||
    data?.data?.data?.createContentcreationDashShares?.urn;

  return {
    success: true,
    id: shareUrn,
    url: shareUrn ? `https://www.linkedin.com/feed/update/${shareUrn}/` : null,
    content,
    method: 'voyager'
  };
}

import crypto from 'crypto';

const OFFICIAL_API = 'https://api.x.com/2';
const GRAPHQL_BASE = 'https://x.com/i/api/graphql';

// GraphQL query IDs — extracted from X's frontend bundle.
// To refresh: curl https://abs.twimg.com/responsive-web/client-web/main.*.js
//   then grep for: queryId:"...",operationName:"CreateTweet|SearchTimeline|DeleteTweet"
// Last updated: 2026-06-15
const QUERY_IDS = {
  CreateTweet: 'DQIp0b4mKIciCAZ3bfrwAA',
  SearchTimeline: 'yIphfmxUO-hddQHKIOk9tA',
  DeleteTweet: 'nxpZCY2K-I6QoFHAHeojFQ'
};

// Detect which auth method is available
function getAuthMethod() {
  const hasOfficial = process.env.TWITTER_API_KEY &&
    process.env.TWITTER_API_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_TOKEN_SECRET;

  const hasCookie = process.env.TWITTER_AUTH_TOKEN;

  if (hasOfficial) return 'official';
  if (hasCookie) return 'cookie';

  throw new Error(
    'No Twitter credentials configured. Set either:\n' +
    '  - TWITTER_API_KEY + TWITTER_API_SECRET + TWITTER_ACCESS_TOKEN + TWITTER_ACCESS_TOKEN_SECRET (official API, requires credits)\n' +
    '  - TWITTER_AUTH_TOKEN (cookie-based, free, from browser DevTools → Cookies → auth_token)'
  );
}

// --- Official API auth (OAuth 1.0a) ---

function generateOAuthHeader(method, url, params = {}) {
  const key = process.env.TWITTER_API_KEY;
  const secret = process.env.TWITTER_API_SECRET;
  const token = process.env.TWITTER_ACCESS_TOKEN;
  const tokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  const oauthParams = {
    oauth_consumer_key: key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0'
  };

  const allParams = { ...oauthParams, ...params };
  const paramString = Object.keys(allParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString)
  ].join('&');

  const signingKey = `${encodeURIComponent(secret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');
}

async function officialRequest(method, endpoint, body = null) {
  const url = `${OFFICIAL_API}${endpoint}`;
  const auth = generateOAuthHeader(method, url);

  const options = {
    method,
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json'
    }
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twitter API error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function officialPostTweet(content, replyToId = null) {
  const body = { text: content };
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

  const result = await officialRequest('POST', '/tweets', body);
  const tweetId = result.data.id;

  return {
    success: true,
    id: tweetId,
    url: `https://x.com/m_smalley/status/${tweetId}`,
    content,
    method: 'official'
  };
}

async function officialSearchTweets(query, count = 10) {
  const params = new URLSearchParams({
    query,
    max_results: Math.min(count, 100).toString(),
    'tweet.fields': 'created_at,author_id,public_metrics'
  });

  const result = await officialRequest('GET', `/tweets/search/recent?${params}`);

  return {
    count: result.data?.length || 0,
    tweets: (result.data || []).map(t => ({
      id: t.id,
      text: t.text,
      created_at: t.created_at,
      metrics: t.public_metrics
    })),
    method: 'official'
  };
}

// --- Cookie-based auth (free, no API credits needed) ---

function getCookieHeaders() {
  const authToken = process.env.TWITTER_AUTH_TOKEN;
  const csrfToken = process.env.TWITTER_CSRF_TOKEN || crypto.randomBytes(16).toString('hex');

  return {
    'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    'Cookie': `auth_token=${authToken}; ct0=${csrfToken}`,
    'X-Csrf-Token': csrfToken,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Twitter-Active-User': 'yes',
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'X-Twitter-Client-Language': 'en'
  };
}

// Feature flags required by X GraphQL endpoints.
// Source: https://abs.twimg.com/responsive-web/client-web/main.*.js
// These rotate periodically — if endpoints return 404, re-extract from the main bundle.
// Last updated: 2026-06-15
const TWEET_FEATURES = {
  rweb_video_screen_enabled: true,
  rweb_cashtags_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: true,
  responsive_web_grok_analyze_post_followups_enabled: true,
  rweb_cashtags_composer_attachment_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  rweb_conversational_replies_downvote_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: true,
  responsive_web_enhance_cards_enabled: false
};

const FIELD_TOGGLES = {
  withPayments: true,
  withAuxiliaryUserLabels: false,
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withArticleSummaryText: false,
  withArticleVoiceOver: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false
};

async function cookiePostTweet(content, replyToId = null, attempt = 1) {
  const variables = {
    tweet_text: content,
    dark_request: false,
    media: { media_entities: [], possibly_sensitive: false },
    semantic_annotation_ids: []
  };

  if (replyToId) {
    variables.reply = { in_reply_to_tweet_id: replyToId, exclude_reply_user_ids: [] };
  }

  const body = {
    variables,
    features: TWEET_FEATURES,
    queryId: QUERY_IDS.CreateTweet
  };

  const response = await fetch(`${GRAPHQL_BASE}/${QUERY_IDS.CreateTweet}/CreateTweet`, {
    method: 'POST',
    headers: getCookieHeaders(),
    body: JSON.stringify(body)
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Twitter returned non-JSON response (${response.status}). ` +
      'Cookie tokens have likely expired.\n' +
      'To refresh: open x.com in browser → DevTools → Application → Cookies → copy auth_token and ct0 values into .env'
    );
  }

  if (!response.ok || data.errors) {
    const errMsg = data.errors?.[0]?.message || JSON.stringify(data);
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Twitter auth failed (${response.status}): ${errMsg}\n` +
        'To refresh: open x.com in browser → DevTools → Application → Cookies → copy auth_token and ct0 values into .env'
      );
    }
    throw new Error(`Twitter error (${response.status}): ${errMsg}`);
  }

  const result = data?.data?.create_tweet?.tweet_results?.result;
  const tweetId = result?.rest_id;

  if (!tweetId) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return cookiePostTweet(content, replyToId, attempt + 1);
    }
    throw new Error(
      'Tweet silently dropped by Twitter (no ID returned after 3 attempts). ' +
      'This usually means rate limiting or anti-spam filtering. Try again later.'
    );
  }

  return {
    success: true,
    id: tweetId,
    url: `https://x.com/m_smalley/status/${tweetId}`,
    content,
    method: 'cookie'
  };
}

async function cookieSearchTweets(query, count = 10) {
  const variables = {
    rawQuery: query,
    count: Math.min(count, 20),
    querySource: 'typed_query',
    product: 'Latest'
  };

  const body = JSON.stringify({
    variables,
    features: TWEET_FEATURES,
    fieldToggles: FIELD_TOGGLES,
    queryId: QUERY_IDS.SearchTimeline
  });

  const response = await fetch(`${GRAPHQL_BASE}/${QUERY_IDS.SearchTimeline}/SearchTimeline`, {
    method: 'POST',
    headers: getCookieHeaders(),
    body
  });

  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Twitter auth failed (${response.status}). Cookie tokens have likely expired.\n` +
        'To refresh: open x.com in browser → DevTools → Application → Cookies → copy auth_token and ct0 values into .env'
      );
    }
    throw new Error(`Twitter search error (${response.status}): ${text.slice(0, 500)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Twitter returned non-JSON response (${response.status}, ${text.length} bytes). ` +
      `Likely a login redirect — auth_token cookie has expired.\n` +
      'To refresh: open x.com in browser → DevTools → Application → Cookies → copy auth_token and ct0 values into .env'
    );
  }

  const instructions = data?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];
  const addEntries = instructions.find(i => i.type === 'TimelineAddEntries');
  const entries = addEntries?.entries || [];

  const tweets = entries
    .filter(e => e.entryId?.startsWith('tweet-'))
    .map(e => {
      const tweet = e.content?.itemContent?.tweet_results?.result;
      return {
        id: tweet?.rest_id,
        text: tweet?.legacy?.full_text,
        created_at: tweet?.legacy?.created_at,
        metrics: {
          likes: tweet?.legacy?.favorite_count,
          retweets: tweet?.legacy?.retweet_count,
          replies: tweet?.legacy?.reply_count
        }
      };
    });

  return { count: tweets.length, tweets, method: 'cookie' };
}

// --- Public API (auto-selects auth method) ---

export async function postTweet(content, replyToId = null) {
  if (content.length > 280) {
    throw new Error(`Tweet exceeds 280 characters (${content.length}). Shorten the content.`);
  }

  const method = getAuthMethod();

  if (method === 'official') {
    return officialPostTweet(content, replyToId);
  }
  return cookiePostTweet(content, replyToId);
}

export async function postThread(tweets, replyToId = null) {
  if (!Array.isArray(tweets) || tweets.length === 0) {
    throw new Error('Thread must contain at least one tweet.');
  }

  for (let i = 0; i < tweets.length; i++) {
    if (tweets[i].length > 280) {
      throw new Error(`Tweet ${i + 1} exceeds 280 characters (${tweets[i].length}).`);
    }
  }

  const results = [];
  let previousId = replyToId;

  for (let i = 0; i < tweets.length; i++) {
    const result = await postTweet(tweets[i], previousId);
    if (!result.id) {
      throw new Error(`Thread broken at tweet ${i + 1}: no ID returned. ${results.length} tweets posted before failure.`);
    }
    results.push(result);
    previousId = result.id;
    if (i < tweets.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  return {
    success: true,
    thread_url: results[0].url,
    tweets: results
  };
}

export async function searchTweets(query, count = 10) {
  const method = getAuthMethod();

  if (method === 'official') {
    return officialSearchTweets(query, count);
  }
  return cookieSearchTweets(query, count);
}

export async function deleteTweet(tweetId) {
  const body = JSON.stringify({
    variables: { tweet_id: tweetId, dark_request: false },
    queryId: QUERY_IDS.DeleteTweet
  });

  const response = await fetch(`${GRAPHQL_BASE}/${QUERY_IDS.DeleteTweet}/DeleteTweet`, {
    method: 'POST',
    headers: getCookieHeaders(),
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to delete tweet (${response.status}): ${text.slice(0, 300)}`);
  }

  return { success: true, deleted_id: tweetId };
}

import crypto from 'crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OFFICIAL_API = 'https://api.x.com/2';
const GRAPHQL_BASE = 'https://x.com/i/api/graphql';

// GraphQL query IDs — extracted from X's frontend bundle.
// To refresh: curl https://abs.twimg.com/responsive-web/client-web/main.*.js
//   then grep for: queryId:"...",operationName:"CreateTweet|SearchTimeline|DeleteTweet"
// Last updated: 2026-07-20
const QUERY_IDS = {
  CreateTweet: 'hIL9XdleMYEtVXOZVbr8Bg',
  SearchTimeline: 'hz_94eVAtrtQo_vO3my7Rw',
  DeleteTweet: 'nxpZCY2K-I6QoFHAHeojFQ',
  TweetResultByRestId: '4hhGRbehkcUVTKf8n0f0xw'
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

const ACCOUNTS = {
  personal: { prefix: 'TWITTER_', username: 'm_smalley' },
  moddable: { prefix: 'TWITTER_MODDABLE_', username: 'ModdableGames' }
};

function getAccountConfig(account = 'personal') {
  const config = ACCOUNTS[account];
  if (!config) throw new Error(`Unknown Twitter account: ${account}. Available: ${Object.keys(ACCOUNTS).join(', ')}`);
  return config;
}

function getCookieHeaders(account = 'personal') {
  const { prefix } = getAccountConfig(account);
  const authToken = process.env[`${prefix}AUTH_TOKEN`];
  const csrfToken = process.env[`${prefix}CSRF_TOKEN`] || crypto.randomBytes(16).toString('hex');
  const twid = process.env[`${prefix}TWID`] || '';
  const guestId = process.env[`${prefix}GUEST_ID`] || '';
  const personalizationId = process.env[`${prefix}PERSONALIZATION_ID`] || '';
  const cfClearance = process.env[`${prefix}CF_CLEARANCE`] || '';

  let cookieStr = `auth_token=${authToken}; ct0=${csrfToken}`;
  if (twid) cookieStr += `; twid=${twid}`;
  if (guestId) cookieStr += `; guest_id=${guestId}`;
  if (personalizationId) cookieStr += `; personalization_id=${personalizationId}`;
  if (cfClearance) cookieStr += `; cf_clearance=${cfClearance}`;

  return {
    'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    'Cookie': cookieStr,
    'X-Csrf-Token': csrfToken,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Origin': 'https://x.com',
    'Referer': 'https://x.com',
    'X-Twitter-Active-User': 'yes',
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'X-Twitter-Client-Language': 'en',
    'X-Client-Transaction-Id': crypto.randomBytes(32).toString('base64url'),
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"macOS"',
    'DNT': '1'
  };
}

async function sendViewerContext() {
  const csrfToken = process.env.TWITTER_CSRF_TOKEN;
  const now = Date.now();
  const body = new URLSearchParams({
    debug: 'true',
    log: JSON.stringify([{
      _category_: 'client_event',
      format_version: 2,
      triggered_on: now,
      items: [],
      event_namespace: {
        page: 'compose',
        section: 'composition',
        element: 'send_tweet',
        action: 'click',
        client: 'm5'
      },
      client_event_sequence_start_timestamp: now - 5000,
      client_event_sequence_number: Math.floor(Math.random() * 200) + 50,
      client_app_id: '3033300'
    }])
  });

  try {
    await fetch('https://x.com/i/api/1.1/graphql/viewer_context.json', {
      method: 'POST',
      headers: {
        ...getCookieHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
  } catch {}
}

// Feature flags required by X GraphQL endpoints.
// Source: https://abs.twimg.com/responsive-web/client-web/main.*.js
// These rotate periodically — if endpoints return 404, re-extract from the main bundle.
// Last updated: 2026-07-20
const TWEET_FEATURES = {
  articles_preview_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  content_disclosure_indicator_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  longform_notetweets_consumption_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  longform_notetweets_rich_text_read_enabled: true,
  post_ctas_fetch_enabled: false,
  premium_content_api_read_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_grok_analysis_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_grok_analysis_button_from_backend: true,
  responsive_web_grok_annotations_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_profile_redirect_enabled: false,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  rweb_cashtags_composer_attachment_enabled: true,
  rweb_cashtags_enabled: true,
  rweb_conversational_replies_downvote_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  verified_phone_label_enabled: false,
  view_counts_everywhere_api_enabled: true
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

async function cookiePostTweet(content, replyToId = null, attempt = 1, account = 'personal') {
  const { username } = getAccountConfig(account);
  const variables = {
    tweet_text: content,
    disallowed_reply_options: null,
    media: { media_entities: [], possibly_sensitive: false },
    semantic_annotation_ids: [],
    semantic_annotation_options: { source: 'Profile' }
  };

  if (replyToId) {
    variables.reply = { in_reply_to_tweet_id: replyToId, exclude_reply_user_ids: [] };
  }

  const body = {
    variables,
    features: TWEET_FEATURES,
    fieldToggles: FIELD_TOGGLES,
    queryId: QUERY_IDS.CreateTweet
  };

  const response = await fetch(`${GRAPHQL_BASE}/${QUERY_IDS.CreateTweet}/CreateTweet`, {
    method: 'POST',
    headers: getCookieHeaders(account),
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
    const is226 = data.errors?.[0]?.code === 226;
    if (is226) {
      throw new Error(
        `Twitter anti-automation triggered (226): ${errMsg}\n` +
        'This session is rate-limited. Wait 5-10 minutes before retrying. ' +
        'Do NOT retry immediately — each failed attempt extends the cooldown.'
      );
    }
    throw new Error(`Twitter error (${response.status}): ${errMsg}`);
  }

  const result = data?.data?.create_tweet?.tweet_results?.result;
  const tweetId = result?.rest_id;

  if (!tweetId) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return cookiePostTweet(content, replyToId, attempt + 1, account);
    }
    throw new Error(
      'Tweet silently dropped by Twitter (no ID returned after 3 attempts). ' +
      'This usually means rate limiting or anti-spam filtering. Try again later.'
    );
  }

  return {
    success: true,
    id: tweetId,
    url: `https://x.com/${username}/status/${tweetId}`,
    content,
    method: 'cookie',
    account
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

export async function postTweet(content, replyToId = null, account = 'personal') {
  if (content.length > 280) {
    throw new Error(`Tweet exceeds 280 characters (${content.length}). Shorten the content.`);
  }

  const method = getAuthMethod();

  if (method === 'official' && account === 'personal') {
    return officialPostTweet(content, replyToId);
  }
  return cookiePostTweet(content, replyToId, 1, account);
}

export async function postThread(tweets, replyToId = null, account = 'personal') {
  if (!Array.isArray(tweets) || tweets.length === 0) {
    throw new Error('Thread must contain at least one tweet.');
  }

  for (let i = 0; i < tweets.length; i++) {
    if (tweets[i].length > 280) {
      throw new Error(`Tweet ${i + 1} exceeds 280 characters (${tweets[i].length}).`);
    }
  }

  const firstResult = await postTweet(tweets[0], replyToId, account);
  if (!firstResult.id) {
    throw new Error('Thread failed: first tweet returned no ID.');
  }

  if (tweets.length > 1) {
    scheduleRemainingTweets(tweets.slice(1), firstResult.id);
  }

  return {
    success: true,
    mode: tweets.length > 1 ? 'async' : 'complete',
    thread_url: firstResult.url,
    first_tweet: firstResult,
    remaining: tweets.length - 1,
    status_file: tweets.length > 1 ? 'mcp/social/thread-status.json' : null,
    message: tweets.length > 1
      ? `First tweet posted. ${tweets.length - 1} remaining tweets queued with 3-5 min delays. Check thread-status.json for progress.`
      : 'Single tweet thread posted.'
  };
}

function scheduleRemainingTweets(tweets, firstId) {
  const statusPath = fileURLToPath(new URL('../thread-status.json', import.meta.url));
  const status = {
    started: new Date().toISOString(),
    total: tweets.length + 1,
    posted: [{ index: 0, id: firstId, time: new Date().toISOString() }],
    pending: tweets.map((text, i) => ({ index: i + 1, text, status: 'queued' })),
    errors: []
  };
  writeStatusFile(statusPath, status);

  (async () => {
    let previousId = firstId;
    for (let i = 0; i < tweets.length; i++) {
      const delay = 300000 + Math.floor(Math.random() * 300000);
      status.pending[i].status = `waiting ${Math.round(delay / 1000)}s`;
      writeStatusFile(statusPath, status);
      await new Promise(r => setTimeout(r, delay));

      try {
        const result = await postTweet(tweets[i], previousId);
        if (!result.id) throw new Error('No ID returned');
        status.posted.push({ index: i + 1, id: result.id, url: result.url, time: new Date().toISOString() });
        status.pending[i].status = 'posted';
        previousId = result.id;
      } catch (err) {
        status.pending[i].status = 'failed';
        status.errors.push({ index: i + 1, error: err.message, time: new Date().toISOString() });
        break;
      }
      writeStatusFile(statusPath, status);
    }
    status.completed = new Date().toISOString();
    writeStatusFile(statusPath, status);
  })();
}

function writeStatusFile(path, data) {
  try {
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch {}
}

export async function searchTweets(query, count = 10) {
  const method = getAuthMethod();

  if (method === 'official') {
    return officialSearchTweets(query, count);
  }
  return cookieSearchTweets(query, count);
}

export async function getTweetById(tweetId) {
  const variables = { tweetId, withCommunity: false, includePromotedContent: false, withVoice: false };
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(TWEET_FEATURES),
    fieldToggles: JSON.stringify(FIELD_TOGGLES)
  });

  const response = await fetch(
    `${GRAPHQL_BASE}/${QUERY_IDS.TweetResultByRestId}/TweetResultByRestId?${params}`,
    { headers: getCookieHeaders() }
  );

  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Twitter auth failed. Cookie tokens have likely expired.');
    }
    throw new Error(`Twitter API error (${response.status}): ${text.slice(0, 300)}`);
  }

  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error('Twitter returned non-JSON response. Auth token likely expired.');
  }

  const tweet = data?.data?.tweetResult?.result;
  if (!tweet) {
    throw new Error(`Tweet ${tweetId} not found or unavailable.`);
  }

  const legacy = tweet.legacy || {};
  return {
    id: tweet.rest_id,
    text: legacy.full_text,
    created_at: legacy.created_at,
    metrics: {
      likes: legacy.favorite_count || 0,
      retweets: legacy.retweet_count || 0,
      replies: legacy.reply_count || 0,
      quotes: legacy.quote_count || 0,
      bookmarks: legacy.bookmark_count || 0,
      views: parseInt(tweet.views?.count) || null
    }
  };
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

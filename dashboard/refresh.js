#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MODDABLE = resolve(ROOT, '../../MODDABLE');
const SOCIAL_DIR = resolve(ROOT, 'mcp/social');
const start = Date.now();

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

function daysBetween(dateStr) {
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function thisWeek(dateStr) {
  return daysBetween(dateStr) <= 7;
}

// --- JOBS COLLECTOR ---
function collectJobs() {
  const data = readJSON(resolve(ROOT, 'cvs/jobs.json'));
  if (!data) return null;
  const jobs = data.jobs;

  const funnel = { discovered: 0, scored: 0, applied: 0, rejected: 0, closed: 0 };
  const byVariant = { cto: { total: 0, applied: 0, scores: [] }, regtech: { total: 0, applied: 0, scores: [] }, devrel: { total: 0, applied: 0, scores: [] } };
  const scoreBuckets = [0, 0, 0, 0, 0, 0];
  let weekLeads = 0, weekApps = 0, weekRejects = 0;

  // Merge archive counts into funnel
  const archiveData = readJSON(resolve(ROOT, 'cvs/jobs-archive.json'));
  if (archiveData && archiveData.jobs) {
    for (const j of archiveData.jobs) {
      funnel.discovered++;
      const s = j.status || 'closed';
      if (s === 'applied') funnel.applied++;
      else if (s === 'rejected') funnel.rejected++;
      else funnel.closed++;
    }
  }

  const statusMap = { needs_jd: 'scored', low_match: 'rejected', new: 'scored' };
  for (const j of jobs) {
    funnel.discovered++;
    const raw = j.status || 'scored';
    const s = statusMap[raw] || raw;
    if (s === 'scored' || s === 'new') funnel.scored++;
    else if (s === 'applied') funnel.applied++;
    else if (s === 'rejected') funnel.rejected++;
    else if (s === 'closed') funnel.closed++;
    else funnel.scored++;

    if (j.score != null) {
      const idx = j.score >= 80 ? 5 : j.score >= 70 ? 4 : j.score >= 60 ? 3 : j.score >= 50 ? 2 : j.score >= 30 ? 1 : 0;
      scoreBuckets[idx]++;
    }

    const v = j.variant;
    if (v && byVariant[v]) {
      byVariant[v].total++;
      if (s === 'applied') byVariant[v].applied++;
      if (j.score != null) byVariant[v].scores.push(j.score);
    }

    if (j.added && thisWeek(j.added)) weekLeads++;
    if (s === 'applied' && j.added && thisWeek(j.added)) weekApps++;
    if (s === 'rejected' && j.added && thisWeek(j.added)) weekRejects++;
  }

  const bestScore = j => j.score || (j.scores ? Math.max(j.scores.cto || 0, j.scores.regtech || 0, j.scores.devrel || 0) : 0);
  const topLeads = jobs
    .filter(j => bestScore(j) >= 60 && ['new', 'scored', 'matched'].includes(j.status))
    .sort((a, b) => bestScore(b) - bestScore(a))
    .map(j => ({
      company: j.company, role: j.role, score: j.score,
      scores: j.scores || null,
      confidence: j.confidence || (j.requirements_found >= 8 && j.matched >= 4 ? 'high' : j.requirements_found >= 5 ? 'medium' : 'low'),
      variant: j.variant, days_old: daysBetween(j.added),
      location: j.location || '',
      channel_method: j.channel?.method || 'unknown',
      freshness: j.channel?.freshness?.status || 'unknown',
      url: j.source_url || j.url || null,
      proof_points: (j.proof_points || []).slice(0, 3),
      gaps: (j.gaps || []).slice(0, 3)
    }));

  const variants = {};
  for (const [k, v] of Object.entries(byVariant)) {
    variants[k] = { total: v.total, applied: v.applied, avg_score: v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : null };
  }

  return {
    funnel,
    conversion_rates: {
      discovered_to_scored: funnel.discovered ? +(funnel.scored / funnel.discovered).toFixed(3) : 0,
      scored_to_applied: funnel.scored ? +(funnel.applied / funnel.scored).toFixed(3) : 0,
      applied_to_interview: funnel.applied ? +(funnel.interview / funnel.applied).toFixed(3) : 0
    },
    score_distribution: [
      { range: '0-29', count: scoreBuckets[0] },
      { range: '30-49', count: scoreBuckets[1] },
      { range: '50-59', count: scoreBuckets[2] },
      { range: '60-69', count: scoreBuckets[3] },
      { range: '70-79', count: scoreBuckets[4] },
      { range: '80+', count: scoreBuckets[5] }
    ],
    top_leads: topLeads,
    activity_this_week: { applications_sent: weekApps, new_leads_ingested: weekLeads, rejections: weekRejects },
    by_variant: variants
  };
}

// --- SOCIAL COLLECTOR ---
function collectSocial() {
  const pipeline = readJSON(resolve(ROOT, 'mcp/social/pipeline.json'));
  if (!pipeline) return null;
  const posts = pipeline.posts || [];

  let totalImpressions = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
  const postData = [];
  const statusCounts = { backlog: 0, ready: 0, posted: 0, draft: 0 };

  for (const p of posts) {
    const s = p.status || 'backlog';
    if (statusCounts[s] !== undefined) statusCounts[s]++;

    if (s === 'posted' || p.metrics || p.metrics_linkedin || p.metrics_twitter) {
      const m = p.metrics_linkedin || p.metrics_twitter || p.metrics || {};
      const impressions = m.impressions || m.views || 0;
      const likes = m.likes || 0;
      const comments = m.comments || m.replies || 0;
      const shares = m.shares || m.retweets || 0;

      totalImpressions += impressions;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;

      const commentsList = m.commentsList || p.metrics_linkedin?.commentsList || [];

      const reactionsList = m.reactionsList || [];
      const recentReactions = reactionsList.length
        ? reactionsList.slice(0, 10).map(r => ({ author: r.author, type: r.type || 'LIKE', occupation: r.occupation, post_preview: (p.content || '').slice(0, 40) }))
        : Object.entries(m.reactions || {}).flatMap(([type, count]) => [{ type, count: count, post_preview: (p.content || '').slice(0, 40) }]);

      postData.push({
        id: p.id || p.platform_id || 'unknown',
        platform: p.platform || (p.url?.includes('linkedin') ? 'linkedin' : 'twitter'),
        posted: p.posted || p.created || null,
        url: p.url || null,
        content_preview: (p.content || '').slice(0, 80),
        metrics: { impressions, likes, comments, shares },
        deltas: p.deltas || null,
        recent_comments: commentsList.slice(-5).map(c => ({ author: c.author, text: (c.text || '').slice(0, 120) })),
        recent_reactions: recentReactions.length ? recentReactions : undefined
      });
    }
  }

  const postedPosts = posts.filter(p => p.status === 'posted' && p.posted);
  const sortedDates = postedPosts.map(p => new Date(p.posted)).sort((a, b) => b - a);
  const daysSinceLastPost = sortedDates.length ? daysBetween(sortedDates[0].toISOString()) : 999;
  const postsThisWeek = postedPosts.filter(p => thisWeek(p.posted)).length;

  postData.sort(function(a, b) {
    if (!a.posted) return 1;
    if (!b.posted) return -1;
    return new Date(b.posted) - new Date(a.posted);
  });

  return {
    posts: postData,
    aggregate: {
      total_impressions: totalImpressions,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      engagement_rate: totalImpressions > 0 ? +((totalLikes + totalComments) / totalImpressions).toFixed(4) : 0
    },
    cadence: {
      total_posts: postedPosts.length,
      posts_this_week: postsThisWeek,
      days_since_last_post: daysSinceLastPost
    },
    pipeline_status: statusCounts
  };
}

// --- SOCIAL METRICS REFRESH ---
async function refreshSocialMetrics() {
  const pipelinePath = resolve(ROOT, 'mcp/social/pipeline.json');
  if (!existsSync(pipelinePath)) return { updated: 0, linkedinFailed: false, twitterFailed: false };

  const envPath = resolve(SOCIAL_DIR, '.env');
  if (!existsSync(envPath)) return { updated: 0, linkedinFailed: false, twitterFailed: false };

  // Load .env for social providers
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }

  let getPostInsights, getTweetById;
  try {
    ({ getPostInsights } = await import(resolve(SOCIAL_DIR, 'providers/linkedin-voyager.js')));
    ({ getTweetById } = await import(resolve(SOCIAL_DIR, 'providers/twitter.js')));
  } catch (e) {
    console.log(`  Social providers import failed: ${e.message}`);
    return { updated: 0, linkedinFailed: false, twitterFailed: false };
  }

  const pipeline = JSON.parse(readFileSync(pipelinePath, 'utf8'));
  const posts = pipeline.posts || [];
  let updated = 0;
  let linkedinFailed = false;
  let twitterFailed = false;

  for (const post of posts) {
    if (post.status !== 'posted') continue;
    if (!post.platform_id && !post.thread_ids?.length) continue;

    const platforms = post.platforms || (post.url?.includes('linkedin') ? ['linkedin'] : post.url?.includes('x.com') || post.url?.includes('twitter') ? ['twitter'] : []);

    // LinkedIn posts
    if ((platforms.includes('linkedin') || post.platform_id?.startsWith('urn:li:')) && getPostInsights) {
      try {
        const insights = await getPostInsights(post.platform_id);
        const prev = post.metrics_linkedin || {};
        post.metrics_linkedin = {
          impressions: insights.impressions || prev.impressions || 0,
          likes: insights.likes || 0,
          comments: insights.comments || 0,
          shares: insights.shares || 0,
          reactions: insights.reactions || prev.reactions,
          commentsList: insights.commentsList || prev.commentsList,
          reactionsList: insights.reactionsList || prev.reactionsList
        };
        if (prev.impressions != null && insights.impressions != null) {
          post.deltas = { impressions: (insights.impressions || 0) - (prev.impressions || 0), likes: (insights.likes || 0) - (prev.likes || 0) };
        }
        updated++;
      } catch (e) {
        linkedinFailed = true;
        if (!linkedinFailed) console.log(`  LinkedIn Voyager error: ${e.message}`);
      }
    }

    // Twitter posts
    if ((platforms.includes('twitter') || (post.url && (post.url.includes('x.com') || post.url.includes('twitter.com')))) && getTweetById && !post.platform_id?.startsWith('urn:li:')) {
      // Resolve platform_id for threads (stored in thread_ids, not top-level)
      const tweetId = post.platform_id || post.thread_ids?.[0]?.platform_id;
      if (!tweetId) continue;
      try {
        const tweet = await getTweetById(tweetId);
        if (tweet) {
          const m = tweet.metrics || tweet;
          post.metrics_twitter = {
            impressions: m.views || m.impression_count || 0,
            likes: m.likes || m.favorite_count || m.like_count || 0,
            comments: m.replies || m.reply_count || 0,
            shares: m.retweets || m.retweet_count || 0
          };
          updated++;
        }
      } catch (e) {
        twitterFailed = true;
      }
    }
  }

  // Auto-refresh cookies if sessions expired, then retry
  if (linkedinFailed || twitterFailed) {
    const refreshScript = resolve(SOCIAL_DIR, 'refresh-cookies.sh');
    if (existsSync(refreshScript)) {
      const platforms = [];
      if (linkedinFailed) platforms.push('linkedin');
      if (twitterFailed) platforms.push('twitter');

      for (const platform of platforms) {
        console.log(`  Attempting auto-refresh for ${platform} cookies...`);
        try {
          // Pipe empty input to skip interactive JSESSIONID prompt if it fires
          execSync(`echo "" | bash "${refreshScript}" ${platform}`, { timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
          console.log(`  ✓ ${platform} cookies refreshed from Firefox`);
          if (platform === 'linkedin') linkedinFailed = false;
          if (platform === 'twitter') twitterFailed = false;
        } catch (e) {
          console.log(`  ✗ ${platform} cookie refresh failed — likely not logged in to Firefox`);
        }
      }

      // If cookies were refreshed, reload env and retry failed posts
      if (!linkedinFailed || !twitterFailed) {
        const freshEnv = readFileSync(envPath, 'utf8');
        for (const line of freshEnv.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex === -1) continue;
          process.env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
        }

        // Reimport providers with fresh creds
        try {
          if (!linkedinFailed) {
            const liMod = await import(resolve(SOCIAL_DIR, 'providers/linkedin-voyager.js') + '?retry');
            getPostInsights = liMod.getPostInsights;
          }
        } catch {}
        try {
          if (!twitterFailed) {
            const twMod = await import(resolve(SOCIAL_DIR, 'providers/twitter.js') + '?retry');
            getTweetById = twMod.getTweetById;
          }
        } catch {}

        // Retry failed posts
        for (const post of posts) {
          if (post.metrics_linkedin || post.metrics_twitter) continue;
          if (post.status !== 'posted') continue;
          const tweetId = post.platform_id || post.thread_ids?.[0]?.platform_id;
          const platforms2 = post.platforms || (post.url?.includes('linkedin') ? ['linkedin'] : post.url?.includes('x.com') || post.url?.includes('twitter') ? ['twitter'] : []);

          if (!linkedinFailed && (platforms2.includes('linkedin') || post.platform_id?.startsWith('urn:li:')) && getPostInsights && post.platform_id) {
            try {
              const insights = await getPostInsights(post.platform_id);
              post.metrics_linkedin = { impressions: insights.impressions || 0, likes: insights.likes || 0, comments: insights.comments || 0, shares: insights.shares || 0 };
              updated++;
            } catch { linkedinFailed = true; }
          }
          if (!twitterFailed && (platforms2.includes('twitter') || (post.url && (post.url.includes('x.com') || post.url.includes('twitter.com')))) && getTweetById && tweetId && !tweetId.startsWith('urn:li:')) {
            try {
              const tweet = await getTweetById(tweetId);
              if (tweet) { const m = tweet.metrics || tweet; post.metrics_twitter = { impressions: m.views || 0, likes: m.likes || 0, comments: m.replies || 0, shares: m.retweets || 0 }; updated++; }
            } catch { twitterFailed = true; }
          }
        }
      }
    }
  }

  if (updated > 0) {
    writeFileSync(pipelinePath, JSON.stringify(pipeline, null, 2) + '\n');
    console.log(`  Social metrics refreshed: ${updated} posts updated`);
  }

  if (linkedinFailed) console.log('  ⚠️  LinkedIn Voyager session still expired — log into linkedin.com in Firefox, then run: cd mcp/social && ./refresh-cookies.sh linkedin');
  if (twitterFailed) console.log('  ⚠️  Twitter auth still expired — log into x.com in Firefox, then run: cd mcp/social && ./refresh-cookies.sh twitter');

  return { updated, linkedinFailed, twitterFailed };
}

// --- GA4 COLLECTOR ---
async function collectGA4() {
  const credPath = resolve(ROOT, 'mcp/social/credentials/claude-ga4-reader.json');
  if (!existsSync(credPath)) return null;

  try {
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
    const client = new BetaAnalyticsDataClient({ keyFilename: credPath });
    const properties = { smalley_my: '541382225', moddable_games: '510929763' };
    const result = {};

    for (const [key, propId] of Object.entries(properties)) {
      try {
        const [reportCur] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }, { name: 'activeUsers' }]
        });

        const [reportPrev] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate: '14daysAgo', endDate: '8daysAgo' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }, { name: 'activeUsers' }]
        });

        const curRow = reportCur.rows?.[0];
        const prevRow = reportPrev.rows?.[0];

        const cur = { page_views: +(curRow?.metricValues?.[0]?.value || 0), sessions: +(curRow?.metricValues?.[1]?.value || 0), users: +(curRow?.metricValues?.[2]?.value || 0) };
        const prv = { page_views: +(prevRow?.metricValues?.[0]?.value || 0), sessions: +(prevRow?.metricValues?.[1]?.value || 0), users: +(prevRow?.metricValues?.[2]?.value || 0) };

        const pct = (c, p) => p > 0 ? +((c - p) / p).toFixed(3) : c > 0 ? 1 : 0;

        const [topPagesRaw] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'screenPageViews' }],
          dimensions: [{ name: 'pagePath' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 20
        });

        const topPages = { rows: (topPagesRaw.rows || []).filter(r => {
          const path = r.dimensionValues[0].value;
          return !path.includes('/personal/') && !path.includes('/MODDABLE/') && !path.startsWith('/localhost');
        }).slice(0, 8) };

        const [sources] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'sessions' }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 5
        });

        const [referrers] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          metrics: [{ name: 'sessions' }],
          dimensions: [{ name: 'sessionSource' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 8
        });

        const [engagementRaw] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'engagedSessions' }],
          dimensions: [{ name: 'pagePath' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 30
        });

        const engagement = { rows: (engagementRaw.rows || []).filter(r => {
          const path = r.dimensionValues[0].value;
          return !path.includes('/personal/') && !path.includes('/MODDABLE/') && !path.startsWith('/localhost');
        }).slice(0, 10) };

        // Custom events breakdown (button clicks, interactions)
        const [eventsRaw] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          metrics: [{ name: 'eventCount' }],
          dimensions: [{ name: 'eventName' }],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 20
        });

        const builtinEvents = ['page_view', 'user_engagement', 'session_start', 'first_visit', 'scroll', 'click'];
        const events = (eventsRaw.rows || [])
          .map(r => ({ event: r.dimensionValues[0].value, count: +r.metricValues[0].value }))
          .filter(e => !builtinEvents.includes(e.event));

        const engagementPeriods = { '7d': '7daysAgo', '90d': '90daysAgo' };
        const engagementByPeriod = {};
        for (const [period, startDate] of Object.entries(engagementPeriods)) {
          try {
            const [raw] = await client.runReport({
              property: `properties/${propId}`,
              dateRanges: [{ startDate, endDate: 'today' }],
              metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'engagedSessions' }],
              dimensions: [{ name: 'pagePath' }],
              orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
              limit: 30
            });
            engagementByPeriod[period] = (raw.rows || []).filter(r => {
              const path = r.dimensionValues[0].value;
              return !path.includes('/personal/') && !path.includes('/MODDABLE/') && !path.startsWith('/localhost');
            }).slice(0, 10).map(r => ({ path: r.dimensionValues[0].value, views: +r.metricValues[0].value, avg_duration_s: Math.round(+r.metricValues[1].value), engaged: +r.metricValues[2].value }));
          } catch { engagementByPeriod[period] = []; }
        }

        result[key] = {
          period_7d: cur,
          period_7d_previous: prv,
          change_pct: { page_views: pct(cur.page_views, prv.page_views), sessions: pct(cur.sessions, prv.sessions), users: pct(cur.users, prv.users) },
          top_pages: (topPages.rows || []).map(r => ({ path: r.dimensionValues[0].value, views: +r.metricValues[0].value })),
          traffic_sources: (sources.rows || []).map(r => ({ source: r.dimensionValues[0].value, sessions: +r.metricValues[0].value })),
          referrers_30d: (referrers.rows || []).map(r => ({ source: r.dimensionValues[0].value, sessions: +r.metricValues[0].value })),
          top_pages_7d: engagementByPeriod['7d'] || [],
          top_pages_30d: (engagement.rows || []).map(r => ({ path: r.dimensionValues[0].value, views: +r.metricValues[0].value, avg_duration_s: Math.round(+r.metricValues[1].value), engaged: +r.metricValues[2].value })),
          top_pages_90d: engagementByPeriod['90d'] || [],
          events_30d: events
        };
      } catch (e) {
        result[key] = { error: e.message, period_7d: { page_views: 0, sessions: 0, users: 0 }, period_7d_previous: { page_views: 0, sessions: 0, users: 0 }, change_pct: {}, top_pages: [], traffic_sources: [] };
      }
    }
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

// --- GIT COLLECTOR ---
function collectGit() {
  const repos = [
    { name: 'smalley-website', path: ROOT },
    { name: 'moddable-chess', path: resolve(MODDABLE, 'moddable-chess') },
    { name: 'moddable-website', path: resolve(MODDABLE, 'moddable-website') },
    { name: 'moddable-hexmaps', path: resolve(MODDABLE, 'moddable-hexmaps') },
    { name: 'moddable-rules', path: resolve(MODDABLE, 'moddable-rules') },
    { name: 'moddable-decks', path: resolve(MODDABLE, 'moddable-decks') },
    { name: 'moddable-engine', path: resolve(MODDABLE, 'moddable-engine') }
  ];

  let weekTotal = 0, monthTotal = 0;
  const byRepo = [];

  for (const repo of repos) {
    if (!existsSync(resolve(repo.path, '.git'))) continue;
    try {
      const weekCount = +execSync(`git -C "${repo.path}" rev-list --count --since="7 days ago" HEAD 2>/dev/null`).toString().trim();
      const monthCount = +execSync(`git -C "${repo.path}" rev-list --count --since="30 days ago" HEAD 2>/dev/null`).toString().trim();
      weekTotal += weekCount;
      monthTotal += monthCount;
      if (weekCount > 0) byRepo.push({ repo: repo.name, commits: weekCount });
    } catch { /* skip */ }
  }

  return {
    commits_this_week: { total: weekTotal, by_repo: byRepo.sort((a, b) => b.commits - a.commits) },
    commits_this_month: { total: monthTotal }
  };
}

// --- AGENTS COLLECTOR ---
function collectAgents() {
  let pass = 0, partial = 0, fail = 0;
  const history = [];
  const pipeline = [];

  // Fetch pipeline-log from moddable-ops (authoritative source per issue #28)
  try {
    const logRaw = execSync('gh api repos/Moddable-Games/moddable-ops/contents/.moddable/pipeline-log.md --jq .content 2>/dev/null').toString().trim();
    const logContent = Buffer.from(logRaw, 'base64').toString();

    // Parse entries: ### date -- Routine -- issue -- title
    const entries = logContent.split(/^### /m).slice(1);
    for (const entry of entries) {
      const headerMatch = entry.match(/^(\d{4}-\d{2}-\d{2})[\s\d:A-Z]*\s*--\s*(.+?)\s*--\s*(.+?)\s*--\s*(.+?)$/m);
      const schedulerMatch = entry.match(/^(\d{4}-\d{2}-\d{2})[\s\d:A-Z]*\s*--\s*Scheduler\s*--\s*(?:scheduled|nightly)\s*run/m);
      const statusMatch = entry.match(/\*\*Status:\*\*\s*(.+?)$/m);

      const date = headerMatch?.[1] || schedulerMatch?.[1];
      if (!date) continue;

      const routine = headerMatch?.[2] || 'Scheduler';
      const issue = headerMatch?.[3] || 'scheduled run';
      const title = headerMatch?.[4] || '';
      const status = statusMatch?.[1]?.trim().toLowerCase() || '';

      // Determine pass/fail from status
      let quality = 'pass';
      if (status.includes('needs-decision') || status.includes('no-op')) {
        quality = 'partial';
      } else if (status.includes('fail') || status.includes('error') || status.includes('blocked')) {
        quality = 'fail';
      }

      if (quality === 'pass') pass++;
      else if (quality === 'partial') partial++;
      else fail++;

      // Track pipeline stage progress
      const stageMatch = status.match(/stage:([\w-]+)/);
      if (stageMatch) {
        const stageMap = { 'content-done': 1, 'diagrams-done': 2 };
        const stageNum = stageMap[stageMatch[1]] || 0;
        pipeline.push({ issue, title, stage: stageNum, maxStage: 3, date });
      }

      history.push({ date, routine, issue, title, status, quality });
    }
  } catch { /* gh not available or rate limited */ }

  let routines = [];
  let queue = [];
  try {
    const registryRaw = execSync('gh api repos/Moddable-Games/moddable-ops/contents/.moddable/registry.json --jq .content 2>/dev/null').toString().trim();
    const registry = JSON.parse(Buffer.from(registryRaw, 'base64').toString());
    routines = (registry.routines || []).map(r => ({
      name: r.name, trigger: r.trigger_label, status: r.status, fallback: r.fallback || false
    }));

    const issuesRaw = execSync('gh issue list --repo Moddable-Games/moddable-ops --state open --json number,title,labels --limit 30 2>/dev/null').toString().trim();
    const issues = JSON.parse(issuesRaw || '[]');
    queue = issues.map(i => ({
      number: i.number,
      title: i.title,
      labels: (i.labels || []).map(l => l.name)
    }));
  } catch { /* gh not available or rate limited */ }

  return {
    routine_runs: { total: pass + partial + fail, pass, partial, fail, history: history.slice(0, 20) },
    pipeline,
    routines,
    queue
  };
}

// --- ECOSYSTEM COLLECTOR ---
function collectEcosystem() {
  const ecoRepos = ['moddable-website', 'moddable-chess', 'moddable-hexmaps', 'moddable-rules', 'moddable-engine'];
  for (const repo of ecoRepos) {
    const repoPath = resolve(MODDABLE, repo);
    if (existsSync(resolve(repoPath, '.git'))) {
      try { execSync(`git -C "${repoPath}" pull --ff-only -q 2>/dev/null`, { timeout: 10000 }); }
      catch { /* offline or conflicts — use whatever's local */ }
    }
  }

  const gamesSync = readJSON(resolve(MODDABLE, 'moddable-website/data/games-sync.json'));
  if (!gamesSync) return null;

  const games = Object.values(gamesSync);
  let live = 0, dev = 0, playtest = 0;
  for (const g of games) {
    const s = (g.status || '').toLowerCase();
    if (s === 'live') live++;
    else if (s === 'playtest') playtest++;
    else dev++;
  }

  const engines = [];
  const chessEngine = readJSON(resolve(MODDABLE, 'moddable-chess/package.json'));
  const hexEngine = readJSON(resolve(MODDABLE, 'moddable-hexmaps/package.json'));
  const rulesEngine = readJSON(resolve(MODDABLE, 'moddable-rules/package.json'));
  const unifiedEngine = readJSON(resolve(MODDABLE, 'moddable-engine/package.json'));
  if (chessEngine) engines.push({ name: 'Moddable Chess Engine', version: chessEngine.version || null });
  if (hexEngine) engines.push({ name: 'Hexmap Framework', version: hexEngine.version || null });
  if (rulesEngine) engines.push({ name: 'Moddable Rules', version: rulesEngine.version || null });
  if (unifiedEngine) engines.push({ name: 'Moddable Engine (unified)', version: unifiedEngine.version || null });

  let rulesStats = null;
  const rulesGamesDir = resolve(MODDABLE, 'moddable-rules/games');
  if (existsSync(rulesGamesDir)) {
    try {
      const variantCount = +execSync(`find "${rulesGamesDir}" -path "*/content/variants/*" -name "*.md" | wc -l`).toString().trim();
      const rulebookCount = +execSync(`find "${rulesGamesDir}" -name "rulebook.md" | wc -l`).toString().trim();
      const pdfCount = +execSync(`find "${rulesGamesDir}" -path "*/pdf/*.pdf" | wc -l`).toString().trim();
      const familyCount = +execSync(`find "${rulesGamesDir}" -maxdepth 1 -type d | wc -l`).toString().trim() - 1;
      const indexPath = resolve(MODDABLE, 'moddable-rules/dist/rules-index.json');
      const indexEntries = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')).length : 0;
      rulesStats = { families: familyCount, variants: variantCount, rulebooks: rulebookCount, pdfs: pdfCount, index_entries: indexEntries };
    } catch { /* skip */ }
  }

  // Convergence tracking: how close moddable-engine is to replacing chess + hexmaps + rules
  let convergence = null;
  const enginePath = resolve(MODDABLE, 'moddable-engine');
  if (existsSync(enginePath)) {
    try {
      const pluginsDir = resolve(enginePath, 'packages');
      const enginePlugins = existsSync(pluginsDir) ? +execSync(`find "${pluginsDir}" -maxdepth 1 -type d -name "plugin-*" | wc -l`).toString().trim() : 0;
      const rulesFamilies = rulesStats ? rulesStats.families : 0;
      const chessVariantsDir = resolve(MODDABLE, 'moddable-chess/js/variants');
      const chessVariants = existsSync(chessVariantsDir)
        ? +execSync(`find "${chessVariantsDir}" -name "*.js" 2>/dev/null | wc -l`).toString().trim() : 0;
      const hexGamesDir = resolve(MODDABLE, 'moddable-hexmaps/js/games');
      const hexGames = existsSync(hexGamesDir)
        ? +execSync(`find "${hexGamesDir}" -maxdepth 1 -name "*.js" 2>/dev/null | wc -l`).toString().trim() : 0;
      const targetTotal = rulesFamilies + chessVariants + hexGames;
      const weekCommits = +execSync(`git -C "${enginePath}" rev-list --count --since="7 days ago" HEAD 2>/dev/null`).toString().trim();
      const monthCommits = +execSync(`git -C "${enginePath}" rev-list --count --since="30 days ago" HEAD 2>/dev/null`).toString().trim();
      convergence = {
        engine_plugins: enginePlugins,
        rules_families: rulesFamilies,
        chess_variants: chessVariants,
        hex_games: hexGames,
        target_total: targetTotal,
        pct: targetTotal > 0 ? Math.round((enginePlugins / targetTotal) * 100) : 0,
        commits_this_week: weekCommits,
        commits_this_month: monthCommits
      };
    } catch { /* skip */ }
  }

  let contentThisMonth = { articles: 0, rulebooks: 0, posts: 0 };
  try {
    const rulesPath = resolve(MODDABLE, 'moddable-rules');
    if (existsSync(resolve(rulesPath, '.git'))) {
      contentThisMonth.rulebooks = +execSync(`git -C "${rulesPath}" log --since="30 days ago" --diff-filter=A --name-only --pretty="" -- "*/rulebook.md" | wc -l`).toString().trim();
    }
    const websitePath = resolve(MODDABLE, 'moddable-website');
    if (existsSync(resolve(websitePath, '.git'))) {
      contentThisMonth.articles = +execSync(`git -C "${websitePath}" log --since="30 days ago" --diff-filter=A --name-only --pretty="" -- "news/*.json" "news/*.md" | wc -l`).toString().trim();
    }
    const pipelinePath = resolve(ROOT, 'mcp/social/pipeline.json');
    if (existsSync(pipelinePath)) {
      const pipeline = JSON.parse(readFileSync(pipelinePath, 'utf8'));
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      contentThisMonth.posts = (pipeline.posts || []).filter(p => p.status === 'posted' && p.posted_at > thirtyDaysAgo).length;
    }
  } catch { /* best effort */ }

  return {
    games: { total: games.length, live, development: dev, playtest },
    engines,
    convergence,
    rules: rulesStats,
    content_this_month: contentThisMonth
  };
}

// --- GITHUB COLLECTOR ---
function collectGitHub() {
  const repos = [
    'msmalley/smalley-website',
    'Moddable-Games/moddable-chess',
    'Moddable-Games/moddable-website',
    'Moddable-Games/moddable-hexmaps',
    'Moddable-Games/moddable-rules',
    'Moddable-Games/moddable-decks',
    'Moddable-Games/moddable-engine',
    'Moddable-Games/moddable-ops',
    'Moddable-Games/dungeon-chess'
  ];

  const repoStats = [];
  const allIssues = [];

  for (const repo of repos) {
    try {
      const info = JSON.parse(execSync(`gh api repos/${repo} --jq '{stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count}' 2>/dev/null`).toString().trim());
      repoStats.push({ repo: repo.split('/')[1], ...info });
    } catch { /* skip */ }

    try {
      const issues = JSON.parse(execSync(`gh issue list --repo ${repo} --state open --json number,title,labels,updatedAt --limit 15 2>/dev/null`).toString().trim() || '[]');
      for (const i of issues) {
        allIssues.push({
          repo: repo.split('/')[1],
          number: i.number,
          title: i.title,
          labels: (i.labels || []).map(l => ({ name: l.name, color: l.color || null })),
          updated: i.updatedAt?.split('T')[0] || null,
          url: `https://github.com/${repo}/issues/${i.number}`
        });
      }
    } catch { /* skip */ }
  }

  allIssues.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

  return {
    repos: repoStats,
    total_stars: repoStats.reduce((s, r) => s + (r.stars || 0), 0),
    total_open_issues: allIssues.length,
    issues: allIssues.slice(0, 30)
  };
}

// --- CLOUDFLARE COLLECTOR ---
async function collectCloudflare() {
  const configPath = resolve(process.env.HOME, 'Library/Preferences/.wrangler/config/default.toml');
  if (!existsSync(configPath)) return null;

  const config = readFileSync(configPath, 'utf8');
  const tokenMatch = config.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!tokenMatch) return null;
  const token = tokenMatch[1];
  const accountId = '52066e47a6c7b705baee636a1dff5387';

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const query = `{ viewer { accounts(filter: {accountTag: "${accountId}"}) { workersInvocationsAdaptive(limit: 50, filter: {date_geq: "${weekAgo}", date_leq: "${today}"}) { sum { requests errors subrequests } dimensions { scriptName date } } } } }`;

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    const rows = data?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];

    const byScript = {};
    let totalRequests = 0, totalErrors = 0;
    for (const row of rows) {
      const name = row.dimensions.scriptName;
      if (!byScript[name]) byScript[name] = { requests: 0, errors: 0 };
      byScript[name].requests += row.sum.requests;
      byScript[name].errors += row.sum.errors;
      totalRequests += row.sum.requests;
      totalErrors += row.sum.errors;
    }

    return {
      period: '7d',
      total_requests: totalRequests,
      total_errors: totalErrors,
      error_rate: totalRequests > 0 ? +(totalErrors / totalRequests).toFixed(4) : 0,
      by_worker: Object.entries(byScript).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.requests - a.requests)
    };
  } catch (e) {
    return { error: e.message };
  }
}

// --- INVESTMENT COLLECTOR ---
function collectInvestment() {
  const manual = readJSON(resolve(__dirname, 'data/investment.json'));
  if (manual) return manual;

  return {
    applications: [
      { name: 'Outlier Ventures Post Web Base Camp', status: 'submitted', submitted: '2026-06-22', angle: 'MCP tools as agentic gaming infrastructure' },
      { name: 'a16z Speedrun', status: 'identified', notes: 'Up to $1M + $7M credits, rolling, shipping-velocity focus' },
      { name: 'NVIDIA Inception', status: 'identified', notes: 'Free, no equity, GPU credits. Position as gaming AI tooling' },
      { name: 'CDL AI Stream', status: 'identified', notes: 'Non-profit, Paris/Montreal/Toronto, mentorship + capital' }
    ],
    contacts: [],
    status_summary: 'Outlier Ventures submitted 2026-06-22, awaiting response. 3 others identified.'
  };
}

// --- INDICATORS ---
function computeIndicators(employment, social, agents) {
  const jobStatus = employment?.activity_this_week?.new_leads_ingested > 0 ? 'green' : 'yellow';
  const jobDetail = `${employment?.activity_this_week?.new_leads_ingested || 0} new leads this week`;

  const daysSince = social?.cadence?.days_since_last_post ?? 999;
  const socialStatus = daysSince <= 3 ? 'green' : daysSince <= 7 ? 'yellow' : 'red';
  const socialDetail = daysSince < 999 ? `Last post ${daysSince} days ago` : 'No posts tracked';

  const applied = employment?.funnel?.applied || 0;
  const interview = employment?.funnel?.interview || 0;
  const responseRate = applied > 0 ? interview / applied : 0;
  const appStatus = applied === 0 ? 'yellow' : responseRate >= 0.2 ? 'green' : responseRate >= 0.1 ? 'yellow' : 'red';
  const appDetail = applied === 0 ? 'No applications sent yet' : `${interview}/${applied} responses (${Math.round(responseRate * 100)}%)`;

  const runs = agents?.routine_runs || {};
  const agentRate = runs.total > 0 ? runs.pass / runs.total : 0;
  const agentStatus = runs.total === 0 ? 'yellow' : agentRate >= 0.8 ? 'green' : agentRate >= 0.5 ? 'yellow' : 'red';
  const agentDetail = runs.total === 0 ? 'No routine data' : `${Math.round(agentRate * 100)}% pass rate (${runs.total} runs)`;

  const contentStatus = daysSince <= 3 ? 'green' : daysSince <= 7 ? 'yellow' : 'red';
  const contentDetail = `${social?.cadence?.total_posts || 0} posts total, ${social?.cadence?.posts_this_week || 0} this week`;

  return {
    job_pipeline: { status: jobStatus, label: 'Job pipeline', detail: jobDetail },
    social_engagement: { status: socialStatus, label: 'Social engagement', detail: socialDetail },
    application_response: { status: appStatus, label: 'Application response', detail: appDetail },
    agent_success: { status: agentStatus, label: 'Agent operations', detail: agentDetail },
    content_cadence: { status: contentStatus, label: 'Content cadence', detail: contentDetail }
  };
}

// --- ALERTS COLLECTOR ---
function collectAlerts({ employment, social, analytics, cloudflare, sourcesFailed, metricsRefreshed, socialRefreshResult }) {
  const alerts = [];

  // Content cadence — critical if 14+ days
  const daysSincePost = social?.cadence?.days_since_last_post;
  if (daysSincePost != null && daysSincePost >= 14) {
    alerts.push({
      level: 'critical',
      category: 'content',
      title: `${daysSincePost} days without posting`,
      detail: 'Social visibility is dead. Every day without a post widens the DevRel CV gap and reduces inbound opportunity. Post something today.',
      cta: { label: 'Draft a post now', action: 'prompt', command: 'Ask Claude: "Draft an X thread about chess variant puzzle generation"' }
    });
  } else if (daysSincePost != null && daysSincePost >= 7) {
    alerts.push({
      level: 'warning',
      category: 'content',
      title: `${daysSincePost} days since last post`,
      detail: 'Approaching content silence. The 2-3/week cadence has lapsed.',
      cta: { label: 'Check pipeline', action: 'prompt', command: 'Review pipeline.json ready queue and post the next item' }
    });
  }

  // Job applications stalled
  const applied = employment?.funnel?.applied || 0;
  const appsThisWeek = employment?.activity_this_week?.applications_sent || 0;
  if (applied > 0 && appsThisWeek === 0) {
    const daysSinceApp = 7;
    alerts.push({
      level: 'warning',
      category: 'jobs',
      title: 'No applications sent this week',
      detail: `${applied} total applications but none sent recently. Pipeline has ${employment?.funnel?.scored || 0} scored leads waiting.`,
      cta: { label: 'Apply to top lead', action: 'prompt', command: 'Start cover letter for the highest-scored unapplied job' }
    });
  }

  // Zero applications ever
  if (applied === 0 && (employment?.funnel?.scored || 0) > 5) {
    alerts.push({
      level: 'critical',
      category: 'jobs',
      title: 'No applications sent yet',
      detail: `${employment.funnel.scored} scored jobs in pipeline but zero applications submitted.`,
      cta: { label: 'Apply to top lead', action: 'prompt', command: 'Start cover letter for the highest-scored job' }
    });
  }

  // GA4 credentials missing
  const ga4CredPath = resolve(ROOT, 'mcp/social/credentials/claude-ga4-reader.json');
  if (!existsSync(ga4CredPath)) {
    alerts.push({
      level: 'warning',
      category: 'infra',
      title: 'GA4 service account missing',
      detail: 'No credentials at mcp/social/credentials/claude-ga4-reader.json. Analytics data will not populate.',
      cta: { label: 'Setup GA4', action: 'link', url: 'https://github.com/msmalley/smalley-website/issues/27' }
    });
  } else if (sourcesFailed.includes('ga4')) {
    alerts.push({
      level: 'warning',
      category: 'infra',
      title: 'GA4 data fetch failed',
      detail: 'Credentials exist but GA4 returned an error. Service account permissions may have been revoked.',
      cta: { label: 'Check GCP console', action: 'link', url: 'https://console.cloud.google.com/iam-admin/serviceaccounts' }
    });
  }

  // Cloudflare token expired
  const wranglerConfig = resolve(process.env.HOME, 'Library/Preferences/.wrangler/config/default.toml');
  if (!existsSync(wranglerConfig)) {
    alerts.push({
      level: 'warning',
      category: 'infra',
      title: 'Wrangler not authenticated',
      detail: 'No Wrangler config found. Cloudflare Worker stats will not populate.',
      cta: { label: 'Run wrangler login', action: 'bash', command: 'wrangler login' }
    });
  } else if (sourcesFailed.includes('cloudflare')) {
    alerts.push({
      level: 'warning',
      category: 'infra',
      title: 'Cloudflare API failed',
      detail: 'OAuth token likely expired. Worker stats will be missing from the snapshot.',
      cta: { label: 'Re-authenticate', action: 'bash', command: 'wrangler login' }
    });
  }

  // LinkedIn Voyager cookies expired (check .env freshness)
  const envPath = resolve(ROOT, 'mcp/social/.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const hasVoyager = envContent.includes('LINKEDIN_LI_AT=') && !envContent.match(/LINKEDIN_LI_AT=\s*$/m);
    if (!hasVoyager) {
      alerts.push({
        level: 'warning',
        category: 'infra',
        title: 'LinkedIn Voyager cookies not set',
        detail: 'LINKEDIN_LI_AT is empty in .env. Post insights/reactions/comments will not work.',
        cta: { label: 'Refresh cookies', action: 'bash', command: 'cd mcp/social && ./refresh-cookies.sh linkedin' }
      });
    }
    const hasTwitter = envContent.includes('TWITTER_AUTH_TOKEN=') && !envContent.match(/TWITTER_AUTH_TOKEN=\s*$/m);
    if (!hasTwitter) {
      alerts.push({
        level: 'warning',
        category: 'infra',
        title: 'Twitter auth token not set',
        detail: 'TWITTER_AUTH_TOKEN is empty in .env. Twitter posting and search will not work.',
        cta: { label: 'Refresh cookies', action: 'bash', command: 'cd mcp/social && ./refresh-cookies.sh twitter' }
      });
    }
  } else {
    alerts.push({
      level: 'critical',
      category: 'infra',
      title: 'Social MCP .env missing',
      detail: 'No .env file found at mcp/social/.env. All social tools (posting, insights, jobs) are non-functional.',
      cta: { label: 'Create from template', action: 'bash', command: 'cp mcp/social/.env.example mcp/social/.env && echo "Edit mcp/social/.env with credentials"' }
    });
  }

  // Web3.career API token
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const hasWeb3 = envContent.includes('WEB3_CAREER_API_TOKEN=') && !envContent.match(/WEB3_CAREER_API_TOKEN=\s*$/m);
    if (!hasWeb3) {
      alerts.push({
        level: 'info',
        category: 'infra',
        title: 'Web3.career API token not configured',
        detail: 'Job search results will be missing web3.career listings. Free registration at web3.career.',
        cta: { label: 'Register', action: 'link', url: 'https://web3.career' }
      });
    }
  }

  // Social metrics stale — only alert if auto-refresh failed
  if (!metricsRefreshed && social?.posts?.length) {
    const hasLinkedIn = existsSync(resolve(ROOT, 'mcp/social/.env')) &&
      readFileSync(resolve(ROOT, 'mcp/social/.env'), 'utf8').match(/LINKEDIN_LI_AT=.+/);
    alerts.push({
      level: 'warning',
      category: 'content',
      title: 'Social metrics refresh failed',
      detail: hasLinkedIn
        ? 'Auto-refresh ran but could not update metrics. Voyager session may have expired.'
        : 'Cannot auto-refresh metrics — LinkedIn Voyager credentials missing.',
      cta: hasLinkedIn
        ? { label: 'Refresh cookies', action: 'bash', command: 'cd mcp/social && ./refresh-cookies.sh linkedin' }
        : { label: 'Setup Voyager', action: 'bash', command: 'cd mcp/social && ./refresh-cookies.sh linkedin' }
    });
  }

  // Specific token expiry alerts — only shows if auto-refresh from Firefox also failed
  if (socialRefreshResult?.linkedinFailed) {
    alerts.push({
      level: 'warning',
      category: 'infra',
      title: 'LinkedIn Voyager session expired',
      detail: 'Auto-refresh attempted but failed. You need to log into linkedin.com in Firefox first, then the next refresh will pick up the fresh cookies automatically.',
      cta: { label: 'Manual refresh', action: 'bash', command: 'cd mcp/social && ./refresh-cookies.sh linkedin' }
    });
  }
  if (socialRefreshResult?.twitterFailed) {
    alerts.push({
      level: 'warning',
      category: 'infra',
      title: 'Twitter session expired',
      detail: 'Auto-refresh attempted but failed. You need to log into x.com in Firefox first, then the next refresh will pick up the fresh cookies automatically.',
      cta: { label: 'Manual refresh', action: 'bash', command: 'cd mcp/social && ./refresh-cookies.sh twitter' }
    });
  }

  return alerts;
}

// --- MAIN ---
async function main() {
  console.log('Refreshing dashboard snapshot...');
  const sourcesOk = [];
  const sourcesFailed = [];

  const employment = collectJobs();
  employment ? sourcesOk.push('jobs') : sourcesFailed.push('jobs');

  // Refresh social metrics from live APIs before reading pipeline.json
  let metricsRefreshed = false;
  let socialRefreshResult = {};
  try {
    socialRefreshResult = await refreshSocialMetrics();
    metricsRefreshed = socialRefreshResult.updated > 0;
  } catch (e) {
    console.log(`  Social refresh skipped: ${e.message}`);
  }

  const social = collectSocial();
  social ? sourcesOk.push('social') : sourcesFailed.push('social');

  const git = collectGit();
  git ? sourcesOk.push('git') : sourcesFailed.push('git');

  const agents = collectAgents();
  sourcesOk.push('agents');

  const ecosystem = collectEcosystem();
  sourcesOk.push('ecosystem');

  const investment = collectInvestment();
  sourcesOk.push('investment');

  let github = null;
  try {
    github = collectGitHub();
    github ? sourcesOk.push('github') : sourcesFailed.push('github');
  } catch { sourcesFailed.push('github'); }

  let analytics = null;
  try {
    analytics = await collectGA4();
    if (analytics && !analytics.error) sourcesOk.push('ga4');
    else sourcesFailed.push('ga4');
  } catch {
    sourcesFailed.push('ga4');
  }

  let cloudflare = null;
  try {
    cloudflare = await collectCloudflare();
    if (cloudflare && !cloudflare.error) sourcesOk.push('cloudflare');
    else sourcesFailed.push('cloudflare');
  } catch { sourcesFailed.push('cloudflare'); }

  const indicators = computeIndicators(employment, social, agents);
  const alerts = collectAlerts({ employment, social, analytics, cloudflare, sourcesFailed, metricsRefreshed, socialRefreshResult });

  const snapshot = {
    _meta: {
      generated_at: new Date().toISOString(),
      refresh_duration_ms: Date.now() - start,
      sources_ok: sourcesOk,
      sources_failed: sourcesFailed
    },
    alerts,
    indicators,
    employment,
    social,
    analytics,
    agents: { ...agents, ...git },
    ecosystem,
    github,
    cloudflare,
    investment
  };

  const outPath = resolve(__dirname, 'data/snapshot.json');
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');

  const today = new Date().toISOString().split('T')[0];
  const historyPath = resolve(__dirname, `data/snapshot-${today}.json`);
  writeFileSync(historyPath, JSON.stringify(snapshot, null, 2) + '\n');

  console.log(`Done in ${snapshot._meta.refresh_duration_ms}ms`);
  console.log(`Sources OK: ${sourcesOk.join(', ')}`);
  if (sourcesFailed.length) console.log(`Sources FAILED: ${sourcesFailed.join(', ')}`);

  // Print alerts to console
  if (alerts.length) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ALERTS (${alerts.length})`);
    console.log(`${'='.repeat(60)}`);
    for (const a of alerts) {
      const icon = a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️ ' : 'ℹ️ ';
      console.log(`\n  ${icon} [${a.category}] ${a.title}`);
      console.log(`     ${a.detail}`);
      if (a.cta) {
        if (a.cta.action === 'bash') console.log(`     → Run: ${a.cta.command}`);
        else if (a.cta.action === 'link') console.log(`     → ${a.cta.url}`);
        else if (a.cta.action === 'prompt') console.log(`     → ${a.cta.command}`);
      }
    }
    console.log(`\n${'='.repeat(60)}`);
  }

  console.log('\nIndicators:');
  for (const [k, v] of Object.entries(indicators)) {
    const icon = v.status === 'green' ? '🟢' : v.status === 'yellow' ? '🟡' : '🔴';
    console.log(`  ${icon} ${v.label}: ${v.detail}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node

import './env.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { postTweet, postThread, searchTweets, deleteTweet, getTweetById } from './providers/twitter.js';
import { postLinkedIn, commentOnPost, deletePost as deleteLinkedIn, searchJobs, getProfile } from './providers/linkedin.js';
import { getPostInsights, reactToContent, verifySession as verifyLinkedInSession } from './providers/linkedin-voyager.js';
import { searchLinkedInJobs, fetchLinkedInJobDescription } from './providers/linkedin-jobs.js';
import { searchCryptoJobs } from './providers/job-boards.js';
import { searchWeb3Career } from './providers/web3-career.js';
import { listInbox, searchMessages, readMessage, archiveMessages, trashMessages, replyToMessage, sendEmail } from './providers/email.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_PATH = join(__dirname, 'pipeline.json');

const server = new Server(
  { name: 'social-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: 'social_post',
    description: 'Post content to X/Twitter or LinkedIn. Returns the URL of the published post. Use reply_to to reply to an existing tweet. Use account to post from @ModdableGames instead of @m_smalley.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['twitter', 'linkedin'],
          description: 'Which platform to post to'
        },
        content: {
          type: 'string',
          description: 'The post content. Twitter: max 280 chars. LinkedIn: max 3000 chars.'
        },
        reply_to: {
          type: 'string',
          description: 'Tweet ID to reply to (Twitter only). Makes this post a reply in that thread.'
        },
        account: {
          type: 'string',
          enum: ['personal', 'moddable'],
          description: 'Twitter account to post from. personal=@m_smalley (default), moddable=@ModdableGames.'
        },
        link_url: {
          oneOf: [
            { type: 'string' },
            {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'The article URL' },
                title: { type: 'string', description: 'Card title (avoids relying on crawler)' },
                description: { type: 'string', description: 'Card description' },
                thumbnail: { type: 'string', description: 'Thumbnail image URL (must be accessible)' }
              },
              required: ['url']
            }
          ],
          description: 'URL or {url, title, description, thumbnail} for link preview card (LinkedIn only).'
        }
      },
      required: ['platform', 'content']
    }
  },
  {
    name: 'social_thread',
    description: 'Post a thread (multiple connected posts) to X/Twitter. Each item becomes one tweet in a reply chain. Use reply_to to attach the thread as replies to an existing tweet.',
    inputSchema: {
      type: 'object',
      properties: {
        tweets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of tweet texts. Each must be <= 280 chars. Posted as a reply chain.'
        },
        reply_to: {
          type: 'string',
          description: 'Tweet ID to reply to. The first tweet in the array will be a reply to this ID, and subsequent tweets chain from there.'
        }
      },
      required: ['tweets']
    }
  },
  {
    name: 'social_search_jobs',
    description: 'Search job listings across multiple sources: LinkedIn (public guest API), crypto.jobs (RSS), web3.career (API). Returns job titles, companies, locations, and links.',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'string',
          description: 'Job search keywords (e.g. "CTO blockchain", "DevRel crypto")'
        },
        location: {
          type: 'string',
          description: 'Location filter (e.g. "London", "Remote", "UK")'
        },
        posted_within: {
          type: 'string',
          enum: ['24h', '7d', '30d'],
          description: 'Time filter for when job was posted'
        },
        source: {
          type: 'string',
          enum: ['linkedin', 'crypto.jobs', 'web3.career', 'all'],
          description: 'Which source to search. Default: all (searches LinkedIn guest API + crypto.jobs RSS + web3.career API)'
        },
        workplace: {
          type: 'string',
          enum: ['remote', 'hybrid', 'onsite'],
          description: 'Workplace type filter (LinkedIn only)'
        },
        experience: {
          type: 'string',
          enum: ['director', 'executive'],
          description: 'Experience level filter (LinkedIn only)'
        }
      },
      required: ['keywords']
    }
  },
  {
    name: 'social_search_posts',
    description: 'Search posts/tweets on X/Twitter by query.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['twitter'],
          description: 'Platform to search'
        },
        query: {
          type: 'string',
          description: 'Search query'
        },
        count: {
          type: 'number',
          description: 'Number of results (default 10, max 100)'
        }
      },
      required: ['platform', 'query']
    }
  },
  {
    name: 'social_profile',
    description: 'Get profile information from LinkedIn (own profile or others by URL).',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'LinkedIn profile URL. Omit to get own profile.'
        }
      }
    }
  },
  {
    name: 'social_delete',
    description: 'Delete a post by ID. For Twitter, pass the tweet ID. For LinkedIn, pass the share URN.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['twitter', 'linkedin'],
          description: 'Which platform to delete from'
        },
        post_id: {
          type: 'string',
          description: 'The post ID to delete (tweet ID for Twitter, share URN for LinkedIn)'
        }
      },
      required: ['platform', 'post_id']
    }
  },
  {
    name: 'social_job_detail',
    description: 'Fetch the full job description for a LinkedIn job by its numeric ID (from search results). Returns title, company, location, and full description text.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'string',
          description: 'LinkedIn job numeric ID (from search results job_id field or URL)'
        }
      },
      required: ['job_id']
    }
  },
  {
    name: 'social_insights',
    description: 'Get engagement metrics for a post with delta tracking. Supports LinkedIn (share/activity URN or URL) and Twitter (tweet ID or x.com URL). Returns current totals AND what changed since last check. Auto-updates baseline in pipeline.json.',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'Post identifier. LinkedIn: URL, share URN, or activity URN. Twitter: tweet ID or x.com/status URL.'
        },
        platform: {
          type: 'string',
          enum: ['linkedin', 'twitter'],
          description: 'Platform (auto-detected from post_id if omitted)'
        }
      },
      required: ['post_id']
    }
  },
  {
    name: 'social_insights_all',
    description: 'Refresh engagement metrics for ALL tracked posts in pipeline.json. Returns a summary table with current stats and deltas since last check for every posted item (Twitter + LinkedIn).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'social_react',
    description: 'React (like, celebrate, love, etc.) to a LinkedIn post or comment. Uses Voyager API.',
    inputSchema: {
      type: 'object',
      properties: {
        target_urn: {
          type: 'string',
          description: 'URN of the post or comment to react to. Post: urn:li:activity:123 or urn:li:share:123. Comment: urn:li:comment:(activity:123,456)'
        },
        reaction: {
          type: 'string',
          enum: ['LIKE', 'PRAISE', 'INTEREST', 'CURIOSITY', 'EMPATHY'],
          description: 'Reaction type. LIKE=👍, PRAISE=🙌, INTEREST=🤔, CURIOSITY=🔥, EMPATHY=❤️. Default: LIKE'
        }
      },
      required: ['target_urn']
    }
  },
  {
    name: 'social_comment',
    description: 'Comment on a LinkedIn post, or reply to a specific comment. Uses the official OAuth API.',
    inputSchema: {
      type: 'object',
      properties: {
        activity_urn: {
          type: 'string',
          description: 'The activity URN of the post to comment on (urn:li:activity:123)'
        },
        text: {
          type: 'string',
          description: 'Comment text (max 1250 chars)'
        },
        parent_comment: {
          type: 'string',
          description: 'Optional: URN of the comment to reply to (urn:li:comment:(activity:123,456)). Omit to comment directly on the post.'
        }
      },
      required: ['activity_urn', 'text']
    }
  },
  {
    name: 'email_inbox',
    description: 'List messages in Gmail inbox. Returns sender, subject, date, read/unread status, and UID for each message.',
    inputSchema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Email address or domain hint (e.g. "smalley.my"). Omit for default account.'
        },
        limit: {
          type: 'number',
          description: 'Max messages to return (default 20)'
        },
        unread_only: {
          type: 'boolean',
          description: 'Only show unread messages (default false)'
        }
      }
    }
  },
  {
    name: 'email_search',
    description: 'Search emails by sender, subject, date, or text content.',
    inputSchema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Email address or domain hint. Omit for default account.'
        },
        from: {
          type: 'string',
          description: 'Filter by sender address or name'
        },
        subject: {
          type: 'string',
          description: 'Filter by subject text'
        },
        text: {
          type: 'string',
          description: 'Search message body text'
        },
        since: {
          type: 'string',
          description: 'Messages after this date (YYYY-MM-DD)'
        },
        before: {
          type: 'string',
          description: 'Messages before this date (YYYY-MM-DD)'
        },
        unread_only: {
          type: 'boolean',
          description: 'Only unread messages'
        },
        folder: {
          type: 'string',
          description: 'IMAP folder to search (default: INBOX)'
        },
        limit: {
          type: 'number',
          description: 'Max results (default 20)'
        }
      }
    }
  },
  {
    name: 'email_read',
    description: 'Read the full content of an email by UID. Returns body text, attachments list, and threading headers.',
    inputSchema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Email address or domain hint. Omit for default account.'
        },
        uid: {
          type: 'number',
          description: 'Message UID (from email_inbox or email_search results)'
        },
        folder: {
          type: 'string',
          description: 'IMAP folder to read from (default: INBOX). Use "[Gmail]/Trash" for deleted messages, "[Gmail]/All Mail" for all.'
        }
      },
      required: ['uid']
    }
  },
  {
    name: 'email_archive',
    description: 'Archive messages (move from Inbox to All Mail). Messages remain searchable but leave the inbox.',
    inputSchema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Email address or domain hint. Omit for default account.'
        },
        uids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of message UIDs to archive'
        }
      },
      required: ['uids']
    }
  },
  {
    name: 'email_trash',
    description: 'Move messages to Trash (auto-deleted after 30 days).',
    inputSchema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Email address or domain hint. Omit for default account.'
        },
        uids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of message UIDs to trash'
        }
      },
      required: ['uids']
    }
  },
  {
    name: 'email_reply',
    description: 'Reply to an email by UID. Preserves threading (In-Reply-To, References headers).',
    inputSchema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Email address or domain hint. Omit for default account.'
        },
        uid: {
          type: 'number',
          description: 'UID of the message to reply to'
        },
        body: {
          type: 'string',
          description: 'Reply body text'
        },
        reply_all: {
          type: 'boolean',
          description: 'Reply to all recipients (default false)'
        }
      },
      required: ['uid', 'body']
    }
  },
  {
    name: 'email_send',
    description: 'Send a new email. Supports file attachments (PDFs, etc) via absolute file paths.',
    inputSchema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Email address or domain hint. Omit for default account.'
        },
        to: {
          type: 'string',
          description: 'Recipient email address'
        },
        subject: {
          type: 'string',
          description: 'Email subject'
        },
        body: {
          type: 'string',
          description: 'Email body text'
        },
        attachments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of absolute file paths to attach (e.g. ["/path/to/cv.pdf"])'
        }
      },
      required: ['to', 'subject', 'body']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'social_post':
        if (args.platform === 'twitter') {
          result = await postTweet(args.content, args.reply_to || null, args.account || 'personal');
        } else if (args.platform === 'linkedin') {
          result = await postLinkedIn(args.content, args.link_url || null);
        } else {
          throw new Error(`Unsupported platform: ${args.platform}`);
        }
        // Auto-persist platform_id back to pipeline.json
        if (result && (result.id || result.tweet_id)) {
          try {
            const pl = JSON.parse(readFileSync(PIPELINE_PATH, 'utf8'));
            if (pl.posts) {
              const platformId = result.id || result.tweet_id;
              const contentSnippet = args.content.substring(0, 80);
              const match = pl.posts.find(p =>
                p.status === 'ready' &&
                p.platforms?.includes(args.platform) &&
                p.content?.substring(0, 80) === contentSnippet
              );
              if (match) {
                match.status = 'posted';
                match.posted = new Date().toISOString();
                match.posted_by = 'pipeline';
                match.platform_id = platformId;
                if (result.url) match.url = result.url;
                if (result.method) match.method = result.method;
                writeFileSync(PIPELINE_PATH, JSON.stringify(pl, null, 2));
              }
            }
          } catch {}
        }
        break;

      case 'social_thread':
        result = await postThread(args.tweets, args.reply_to || null);
        break;

      case 'social_search_jobs': {
        const source = args.source || 'all';
        const results = { sources: [], total: 0, jobs: [] };

        if (source === 'linkedin' || source === 'all') {
          try {
            const li = await searchLinkedInJobs({
              keywords: args.keywords,
              location: args.location,
              posted_within: args.posted_within,
              workplace: args.workplace,
              experience: args.experience
            });
            results.sources.push('linkedin_guest_api');
            results.jobs.push(...li.jobs.map(j => ({ ...j, source: 'linkedin' })));
          } catch (e) {
            results.sources.push(`linkedin_guest_api (error: ${e.message})`);
          }
        }

        if (source === 'crypto.jobs' || source === 'all') {
          try {
            const cj = await searchCryptoJobs({
              keywords: args.keywords,
              location: args.location
            });
            results.sources.push('crypto_jobs_rss');
            results.jobs.push(...cj.jobs);
          } catch (e) {
            results.sources.push(`crypto_jobs_rss (error: ${e.message})`);
          }
        }

        if (source === 'web3.career' || source === 'all') {
          try {
            const w3 = await searchWeb3Career({
              keywords: args.keywords,
              location: args.location,
              remote: args.workplace === 'remote'
            });
            results.sources.push('web3_career_api');
            results.jobs.push(...w3.jobs);
          } catch (e) {
            results.sources.push(`web3_career_api (error: ${e.message})`);
          }
        }

        results.total = results.jobs.length;
        result = results;
        break;
      }

      case 'social_search_posts':
        if (args.platform === 'twitter') {
          result = await searchTweets(args.query, args.count || 10);
        } else {
          throw new Error(`Search not supported for: ${args.platform}`);
        }
        break;

      case 'social_profile':
        result = await getProfile(args.url);
        break;

      case 'social_delete':
        if (args.platform === 'twitter') {
          result = await deleteTweet(args.post_id || args.tweet_id);
        } else if (args.platform === 'linkedin') {
          result = await deleteLinkedIn(args.post_id);
        } else {
          throw new Error(`Unsupported platform: ${args.platform}`);
        }
        break;

      case 'social_job_detail':
        result = await fetchLinkedInJobDescription(args.job_id);
        break;

      case 'social_insights': {
        const isTwitter = args.platform === 'twitter' ||
          args.post_id.includes('x.com') ||
          args.post_id.includes('twitter.com') ||
          /^\d{15,}$/.test(args.post_id);

        let current;
        let platformKey;

        if (isTwitter) {
          const tweetId = args.post_id.match(/(\d{15,})/)?.[1];
          if (!tweetId) throw new Error('Could not extract tweet ID from: ' + args.post_id);
          current = await getTweetById(tweetId);
          platformKey = 'twitter';
        } else {
          current = await getPostInsights(args.post_id);
          platformKey = 'linkedin';
        }

        let pipeline;
        try { pipeline = JSON.parse(readFileSync(PIPELINE_PATH, 'utf8')); } catch { pipeline = null; }

        let delta = null;
        if (pipeline?.posts) {
          const inputId = args.post_id.match(/\d{10,}/)?.[0];
          const activityId = current.activityUrn?.match(/\d{10,}/)?.[0] || inputId;
          const post = pipeline.posts.find(p => {
            const pId = (typeof p.platform_id === 'string' ? p.platform_id : '')
              .match(/\d{10,}/)?.[0];
            const urlId = (p.url || '').match(/\d{10,}/)?.[0];
            return (pId && (pId === inputId || pId === activityId)) ||
                   (urlId && (urlId === inputId || urlId === activityId));
          });

          if (post?.metrics) {
            const prev = platformKey === 'twitter' ? post.metrics : post.metrics;
            if (platformKey === 'twitter') {
              delta = {
                new_likes: (current.metrics.likes || 0) - (prev.likes || 0),
                new_retweets: (current.metrics.retweets || 0) - (prev.retweets || 0),
                new_replies: (current.metrics.replies || 0) - (prev.replies || 0),
                new_views: current.metrics.views && prev.views
                  ? current.metrics.views - prev.views : null
              };
            } else {
              const prevCommentAuthors = (prev.commentsList || []).map(c => c.author + ':' + c.text);
              const newComments = (current.commentsList || []).filter(c =>
                !prevCommentAuthors.includes(c.author + ':' + c.text)
              );
              delta = {
                new_reactions: (current.likes || 0) - (prev.likes || 0),
                new_comments: (current.comments || 0) - (prev.comments || 0),
                new_shares: (current.shares || 0) - (prev.shares || 0),
                impression_growth: current.impressions && prev.impressions
                  ? current.impressions - prev.impressions : null,
                new_comment_authors: newComments.map(c => ({
                  author: c.author,
                  subtitle: c.subtitle,
                  text: c.text
                }))
              };
            }
          }

          if (post) {
            if (platformKey === 'twitter') {
              post.metrics = {
                ...current.metrics,
                last_checked: new Date().toISOString()
              };
            } else {
              post.metrics = {
                likes: current.likes,
                comments: current.comments,
                shares: current.shares,
                impressions: current.impressions || null,
                reactions: current.reactions || null,
                commentsList: current.commentsList || [],
                last_checked: new Date().toISOString()
              };
            }
            try { writeFileSync(PIPELINE_PATH, JSON.stringify(pipeline, null, 2)); } catch {}
          }
        }

        result = { ...current, delta };
        break;
      }

      case 'social_insights_all': {
        let pipeline;
        try { pipeline = JSON.parse(readFileSync(PIPELINE_PATH, 'utf8')); } catch {
          throw new Error('Could not read pipeline.json');
        }

        const posted = (pipeline.posts || []).filter(p => p.status === 'posted');
        const results = [];

        for (const post of posted) {
          const platforms = post.platforms || [];
          const prev = post.metrics || {};

          if (platforms.includes('twitter') && post.url?.includes('x.com')) {
            const tweetId = post.url.match(/(\d{15,})/)?.[1] || (typeof post.platform_id === 'string' ? post.platform_id : null);
            if (tweetId) {
              try {
                const tw = await getTweetById(tweetId);
                const delta = {
                  new_likes: (tw.metrics.likes || 0) - (prev.likes || 0),
                  new_retweets: (tw.metrics.retweets || 0) - (prev.retweets || 0),
                  new_replies: (tw.metrics.replies || 0) - (prev.replies || 0),
                  new_views: tw.metrics.views && prev.views ? tw.metrics.views - prev.views : null
                };
                post.metrics = { ...tw.metrics, last_checked: new Date().toISOString() };
                results.push({ platform: 'twitter', id: tweetId, content: (post.content || '').slice(0, 80), ...tw.metrics, delta });
              } catch (e) {
                results.push({ platform: 'twitter', id: tweetId, error: e.message });
              }
            }
          }

          if (platforms.includes('linkedin')) {
            const pidStr = typeof post.platform_id === 'string' ? post.platform_id : '';
            const liUrn = pidStr.includes('urn:li:') ? pidStr : null;
            const liId = liUrn || post.url?.match(/(urn:li:(?:share|activity):\d+)/)?.[1];
            if (liId) {
              try {
                const li = await getPostInsights(liId);
                const prevLi = post.metrics_linkedin || {};
                const delta = {
                  new_reactions: (li.likes || 0) - (prevLi.likes || 0),
                  new_comments: (li.comments || 0) - (prevLi.comments || 0),
                  impression_growth: li.impressions && prevLi.impressions ? li.impressions - prevLi.impressions : null
                };
                post.metrics_linkedin = {
                  likes: li.likes, comments: li.comments, shares: li.shares,
                  impressions: li.impressions, reactions: li.reactions,
                  commentsList: li.commentsList || [],
                  last_checked: new Date().toISOString()
                };
                results.push({ platform: 'linkedin', id: liId, content: (post.content || '').slice(0, 80), likes: li.likes, comments: li.comments, impressions: li.impressions, delta });
              } catch (e) {
                results.push({ platform: 'linkedin', id: liId, error: e.message });
              }
            }
          }
        }

        try { writeFileSync(PIPELINE_PATH, JSON.stringify(pipeline, null, 2)); } catch {}
        result = { posts_checked: results.length, results };
        break;
      }

      case 'social_react':
        result = await reactToContent(args.target_urn, args.reaction || 'LIKE');
        break;

      case 'social_comment':
        result = await commentOnPost(args.activity_urn, args.text, args.parent_comment || null);
        break;

      case 'email_inbox':
        result = await listInbox(args.account, args.limit || 20, args.unread_only || false);
        break;

      case 'email_search':
        result = await searchMessages(args.account, {
          from: args.from,
          subject: args.subject,
          text: args.text,
          since: args.since,
          before: args.before,
          unread_only: args.unread_only,
          folder: args.folder,
          limit: args.limit
        });
        break;

      case 'email_read':
        result = await readMessage(args.account, args.uid, args.folder || 'INBOX');
        break;

      case 'email_archive':
        result = await archiveMessages(args.account, args.uids);
        break;

      case 'email_trash':
        result = await trashMessages(args.account, args.uids);
        break;

      case 'email_reply':
        result = await replyToMessage(args.account, args.uid, args.body, args.reply_all || false);
        break;

      case 'email_send':
        result = await sendEmail(args.account, args.to, args.subject, args.body, args.attachments || null);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);

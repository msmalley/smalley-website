#!/usr/bin/env node

import './env.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { postTweet, postThread, searchTweets, deleteTweet } from './providers/twitter.js';
import { postLinkedIn, deletePost as deleteLinkedIn, searchJobs, getProfile } from './providers/linkedin.js';

const server = new Server(
  { name: 'social-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: 'social_post',
    description: 'Post content to X/Twitter or LinkedIn. Returns the URL of the published post. Use reply_to to reply to an existing tweet.',
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
    description: 'Search LinkedIn job listings by keywords, location, and filters.',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'string',
          description: 'Job search keywords (e.g. "CTO blockchain")'
        },
        location: {
          type: 'string',
          description: 'Location filter (e.g. "London", "Remote")'
        },
        posted_within: {
          type: 'string',
          enum: ['24h', '7d', '30d'],
          description: 'Time filter for when job was posted'
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
          result = await postTweet(args.content, args.reply_to || null);
        } else if (args.platform === 'linkedin') {
          result = await postLinkedIn(args.content);
        } else {
          throw new Error(`Unsupported platform: ${args.platform}`);
        }
        break;

      case 'social_thread':
        result = await postThread(args.tweets, args.reply_to || null);
        break;

      case 'social_search_jobs':
        result = await searchJobs(args.keywords, args.location, args.posted_within);
        break;

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

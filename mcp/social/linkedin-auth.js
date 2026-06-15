#!/usr/bin/env node

/**
 * LinkedIn OAuth2 token generator.
 *
 * Usage:
 *   node linkedin-auth.js
 *
 * Prerequisites (do these in browser first):
 *   1. Create app at linkedin.com/developers
 *   2. Add products: "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect"
 *   3. Add redirect URL: http://localhost:3000/callback
 *   4. Copy Client ID and Client Secret into mcp/social/.env
 *
 * This script:
 *   - Starts a local server on port 3000
 *   - Opens the LinkedIn OAuth consent page in your browser
 *   - Catches the callback and exchanges the code for an access token
 *   - Writes the token to .env automatically
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');

function loadEnv() {
  const vars = {};
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      vars[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
    }
  } catch {}
  return vars;
}

function saveToken(token) {
  let content = readFileSync(envPath, 'utf-8');

  if (content.includes('LINKEDIN_ACCESS_TOKEN=')) {
    content = content.replace(
      /LINKEDIN_ACCESS_TOKEN=.*/,
      `LINKEDIN_ACCESS_TOKEN=${token}`
    );
  } else {
    content += `\nLINKEDIN_ACCESS_TOKEN=${token}\n`;
  }

  writeFileSync(envPath, content);
}

const env = loadEnv();
const clientId = env.LINKEDIN_CLIENT_ID;
const clientSecret = env.LINKEDIN_CLIENT_SECRET;

if (!clientId || clientId === 'your_client_id_here') {
  console.error('\n  Missing LINKEDIN_CLIENT_ID in .env');
  console.error('  Get it from: linkedin.com/developers → your app → Auth tab\n');
  process.exit(1);
}

if (!clientSecret || clientSecret === 'your_client_secret_here') {
  console.error('\n  Missing LINKEDIN_CLIENT_SECRET in .env');
  console.error('  Get it from: linkedin.com/developers → your app → Auth tab\n');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'openid profile email w_member_social';
const STATE = Math.random().toString(36).slice(2);

const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
  `response_type=code&` +
  `client_id=${clientId}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `scope=${encodeURIComponent(SCOPES)}&` +
  `state=${STATE}`;

const server = createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost:3000');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>Error: ${error}</h2><p>${url.searchParams.get('error_description')}</p>`);
    console.error(`\n  OAuth error: ${error}`);
    server.close();
    process.exit(1);
  }

  if (state !== STATE) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>State mismatch — possible CSRF. Try again.</h2>');
    server.close();
    process.exit(1);
  }

  try {
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || JSON.stringify(tokenData));
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;
    const expiryDays = Math.floor(expiresIn / 86400);

    saveToken(accessToken);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h2 style="color: green">LinkedIn token saved</h2>
      <p>Token written to <code>.env</code></p>
      <p>Expires in ${expiryDays} days. You can close this tab.</p>
    `);

    console.log(`\n  Token saved to .env (expires in ${expiryDays} days)`);
    console.log('  LinkedIn is now configured. Restart Claude Code to use it.\n');

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2>Token exchange failed</h2><pre>${err.message}</pre>`);
    console.error(`\n  Token exchange failed: ${err.message}`);
  }

  server.close();
});

server.listen(3000, () => {
  console.log('\n  LinkedIn OAuth2 token generator');
  console.log('  ─────────────────────────────────');
  console.log(`  Opening browser for authorization...`);
  console.log(`  (If it doesn't open, visit this URL manually):\n`);
  console.log(`  ${authUrl}\n`);
  console.log('  Waiting for callback on http://localhost:3000/callback ...\n');

  try {
    execSync(`open "${authUrl}"`);
  } catch {
    // open command failed — user will click the URL manually
  }
});

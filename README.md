# smalley.my

Personal portfolio and CV site for Mark Smalley — engineering leader, protocol architect, and AI-native builder.

## Structure

```
├── index.html          Home page
├── cvs/                Three CV variants (CTO, RegTech, DevRel) with PDF generation
├── portfolio/          Case studies (Ordzaar, CoKeeps, Neuroware, etc.)
├── thoughts/           Blog/writing section
├── speaking/           Speaking engagements and media
├── workflow/           AI-augmented engineering methodology and live demos
├── regtech/            Regulatory credentials and advisory track record
├── explore/            Filterable content grid by tech tag
├── open-source/        Open source contributions and protocol pages
├── mcp/social/         Social + jobs MCP server (Twitter, LinkedIn, job search, posting)
├── css/                Stylesheets (_sm.css base + page-specific)
├── js/                 JavaScript (SM framework: loader, core, navbar, footer, animations)
├── data/               JSON data files driving all pages
├── fonts/              Self-hosted typefaces
└── img/                Images and assets
```

## Development

Static site — no build step. Runs on any local server (MAMP, Live Server, `python -m http.server`).

The JS framework auto-detects the base path from `location.pathname`. On production (GitHub Pages), it resolves to `/`. On local MAMP, it detects `/personal/smalley-website`.

## Versioning

Single-source version in `version.txt`. Bump with:

```bash
./bump.sh patch   # 1.0.0 → 1.0.1
./bump.sh minor   # 1.0.0 → 1.1.0
./bump.sh major   # 1.0.0 → 2.0.0
```

Propagates to all `?v=` query strings in HTML, `sm-loader.js`, and `sm-core.js`.

## Deployment

GitHub Pages with custom domain (`smalley.my`). Push to `main` to deploy.

## Changelog

#### 2026-07-06
- Job pipeline hygiene: role-type filter on ingest (rejects IC devs, sales, marketing, junior roles), company alias dedup (Tether/Tether Operations Limited), regex patterns for edge cases. Pipeline 351 → 210 relevant jobs.
- Variant-specific keyword expansion maps in match-job.js (CTO/RegTech/DevRel each have their own semantic neighbourhood)
- Dashboard: tri-score support in top_leads filter, search includes title field
- Blog article "Building the Machine That Builds Your Career": transparency angle, expansion map section, sidebar tags/nav
- 6 fresh leads ingested and auto-scored (Xapo Bank 79, Wintermute 80, Google 70, Kast 69, Ciklo 79)

#### 2026-06-19
- First job application sent via automated pipeline (Deel Head of Engineering, email-direct with CTO CV attached)
- Email attachment support added to MCP email_send tool (nodemailer + file paths)
- web3.career job search provider added (3 sources now: LinkedIn Guest API, crypto.jobs, web3.career)
- Job enrichment engine: channel classification, email detection, freshness scoring (cvs/enrich-jobs.js)
- Search result ingestion tool for bulk import (cvs/ingest-search-results.js)
- Cover letter draft system: structured JSON in cvs/drafts/ with target metadata and status tracking
- Pipeline status tracking: new → ready → applied with dates and cover letter references
- Portal form-fill automation planned (issue #25) for non-email applications

#### 2026-06-17
- Built job application engine (cvs/): master profile.json, job matcher, cover letter templates, pipeline CLI
- Added multi-source job search to MCP: LinkedIn Guest API (no auth) + crypto.jobs RSS
- Added social_job_detail tool for fetching full LinkedIn job descriptions by ID
- Reply-to threading support on social_post and social_thread tools
- Migrated drafts.json → pipeline.json with full post lifecycle tracking
- Comeback posts published (Twitter + LinkedIn); reply queued pending rate limit reset
- Created issue #24 (MCP expansion: additional job sources, email IMAP/SMTP)

#### 2026-06-15
- Added social MCP server (mcp/social/) — unified Twitter + LinkedIn posting, search, threads, delete
- Twitter supports both official API and cookie-based auth; LinkedIn uses OAuth2 with local token generator
- Content pipeline established: cross-project triggers auto-generate drafts in mcp/social/pipeline.json
- Created issue #23 tracking content cadence and platform expansion

#### 2026-06-14
- Rewrote "The Other 14 Days" section of 16-days post with cloud agent pipeline narrative
- Added step 06 (Autonomous Pipeline) to workflow page
- Added automation infrastructure bullet to CTO and DevRel CVs
- Regenerated all CV PDFs and ATS text versions

#### 2026-06-12
- Site is LIVE at https://smalley.my (GitHub Pages + Cloudflare DNS)
- HTTPS enforced, SSL cert provisioned
- Removed all But/And sentence-starters from thoughts pages (22 instances); global rule added
- Rewrote 16-days-one-ecosystem: front-loaded scope, removed version numbers, tightened sections
- Added inline proof links (SC media release, Blueprint PDF, CoKeeps) to thoughts pages
- Added figures with figcaptions linking to live projects on all thought page images
- Added Dungeon Chess screenshot, replaced Ordzaar hero with marketplace screenshot
- Reduced hero canvas opacity for subtlety
- Fixed sm-base meta tags (removed — broke production paths including RSS feed 404)
- Fixed all favicon paths to absolute /favicon.ico
- Added text-wrap: balance to all hero-tagline variants
- Regenerated all OG images from build/gen-og.py; added unique CVs OG images
- Added full OG/Twitter meta tags to individual CV pages
- Created issues in Moddable repos for But/And cleanup (#106, #100, #56)
- Various copy trims across protocol-design-lessons, what-regulators-need, vanilla-js, cardinal-sins

#### 2026-06-10
- External proof links: verified and added 15+ third-party sources that name us (issue #18)
- Portfolio pages (Neuroware, CoKeeps, Project Castor) now link to press coverage and official citations
- Speaking pages (BFM Radio, Conferences) now link to episode pages and event listings
- Added SC Malaysia media release (names Mark Smalley), Deloitte directory, VentureBeat, Digital News Asia, Mashable SEA, The Edge, FOSS Asia 2015 speaker listing, REDmoney events
- Updated media.json, speaking.json, portfolio.json with verified URLs
- Major cross-project sync: updated all Moddable content to reflect current state of sibling repos
- Chess Engine: v0.7.1 → v0.9.1 (native ESM, MCP server, 7 AI-callable tools)
- Hexmaps: v0.5.1 → v0.8.1 (Consumer SDK, 6 games, 6 MCP tools)
- Added tools.moddable.games / MCP server content across all relevant pages
- Updated 16 Days article with MCP server section, Consumer SDK details, 6 games
- Updated portfolio/moddable case study: 6 games, 15 MCP tools, Consumer SDKs, Developers section
- Updated open-source/chess and open-source/hexmaps pages with current capabilities
- Updated both CVs (CTO + DevRel) with MCP server, tools.moddable.games proof point, current versions
- Fixed workflow page: old stats (64 variants, 4 hexmap games) → current (70 variants, 6 games, 15 MCP tools)
- Fixed stale web.moddable.games URL on workflow page → moddable.games
- Updated homepage chess variant count from 64 to 70
- Updated PDF pagination engine: 64 → 100+ variant PDFs
- Updated data/thoughts.json and data/opensource.json and data/portfolio.json with current stats

#### 2026-06-04
- Resolved issue #17: renamed css/process.css to css/workflow.css with all class names updated
- Renamed OG images: process.jpg to workflow.jpg, thoughts-game-engines.jpg to thoughts-16-days.jpg
- Removed dead timeline code: data/timeline.json, timeline OG image, timeline CSS from pages.css
- CV Tier 1 improvements across all three variants (CTO, RegTech, DevRel)
- CTO CV: Moddable reframed as AI-augmented engineering methodology, bullets tightened to impact-first
- RegTech CV: executive summary trimmed to 3 sentences, Moddable reframed as algorithmic decision systems, regulatory framework bridge added
- DevRel CV: SlideShare line updated with verified metrics (21 presentations, 59K+ views, 31.5K on "Introducing Bitcoin")
- Added hyperlinks to verifiable claims across all CVs (SADO, DN-Key, Everstore, TEDx)
- Added PDF download buttons alongside View CV links on all CTA callouts and CVs index page
- Renamed CV files: removed a/b/c prefix (cv_cto, cv_regtech, cv_devrel)
- Tightened print styles so all CVs fit cleanly on 2 pages
- Updated README structure to reflect current site pages
- Speaking page: made "Content That Travels" intro text full-width single line
- Removed all em dashes from paragraph/content text across the site (replaced with colons, commas, full stops)
- Removed dead .portfolio-intro CSS
- Mobile alignment pass: centre-aligned all cards, tags, milestones, sidebars, and credentials at 768px across every page
- Justified paragraphs on all sub-pages (case studies and thoughts articles)
- Fixed demo controls (chess/hexmaps) stretching on mobile with flex-wrap
- Added wrap-around prev/next navigation to thoughts articles (matching portfolio/open-source pattern)
- Internal cross-links added to "Protocol Design Lessons" article (Everstore, DN-Key, SADO, Ordit, Oviato, Project Castor)
- Replaced game logo images with actual tool screenshots in "16 Days" article
- Added visual break (hr) between chess and hexmaps sections in "16 Days" article
- Moved .case-nav to shared _sm.css; nav stacks vertically on mobile
- Explore page heading updated to "Everything I've built and said"

#### 2026-06-01
- New article: "Four Protocols, Nine Years, One Design Philosophy" — Everstore, DN-Key, SADO, Oviato design lessons
- New page: /open-source/everstore/ — complete relational database engine on UTXO chains (2016, pre-EVM)
- Updated DN-Key page with SC Malaysia blueprint citation and full 9-year adoption arc
- Updated Oviato page with Ovi ID, agentic payments, additional investors, DN-Key connection
- Updated all 3 CVs: Everstore added, DN-Key arc strengthened, pre-EVM claim stated
- Code block upgrade: Prism.js syntax highlighting, copy-to-clipboard, full-width dark blocks site-wide
- OG images generated for new pages
- Version: 1.0.22

#### 2026-05-31
- Design elevation: staggered animations, hexagonal hero canvas, typography scale, micro-interactions, noise texture
- Dark/light theme toggle with animated transition (persists to localStorage)
- Social sharing buttons on article sidebar (X, Facebook, LinkedIn, Copy)
- Font swap: Syne → Space Grotesk for display headings
- Nav responsiveness: truncated labels below 1100px, RSS icon, theme toggle
- Mobile pass: centred footer, heroes, stats; sidebar collapses at 1100px
- Interactive hexagonal grid in homepage hero (mouse-reactive, teal nodes)
- Primary CTA shimmer animation, secondary button teal border hover
- Animated link underlines site-wide (slide from left)
- RegTech article drafted with Malaysia vs Singapore regulatory comparison
- Ecosystem cards on /process/ now clickable, workflow section centred
- RegTech credential cards now full clickable links, milestones centred
- Open source cards link to sub-pages, demos, or repos
- Hexmap embed fixes (awaiting moddable-hexmaps#33 for bg colour)
- Timeline dots hidden on mobile to prevent clipping
- Stats grid orphan item spans full width on mobile
- Version: 1.0.13

#### 2026-05-29
- Added /regtech/ credibility page consolidating all regulatory expertise with CV callout
- Added /process/ page: "How I Build" — AI-augmented engineering process with live stats and demos
- Added live interactive embeds (chess engine + hexmap generator) to portfolio/moddable, tools/chess, tools/hexmaps
- Added "How I Build" and "RegTech" to site navigation and homepage
- Unified tools and open-source index pages into card-grid layout (matching portfolio/speaking)
- CV callouts: CTO on /process/, DevRel on /speaking/, RegTech on /regtech/
- Fixed orphan words site-wide: text-wrap balance on all short text, pretty on body
- Moved btn-primary/btn-secondary and cta-box to shared _sm.css
- Added 13 sub-pages (portfolio, tools, open-source, speaking) — every timeline entry now links to a detail page
- Created /explore/ page: filterable grid of all content by tech tag with search and highlighting
- Full-bleed parallax hero images with scroll-driven blur/brightness reveal
- 25 images from source sites, 52+ internal cross-links between pages
- Restructured speaking section into card grid with 5 sub-pages (TEDx, WebCamp KL, Conferences, BFM Radio, Blockchain for Developers)
- Conference page with SlideShare embeds (FOSS Asia, Bitcoin World Conf, MDEC FinTech)
- Tech pills on all sub-pages linking to /explore/?tag=X
- Sharpened CVs with verified data (15 SlideShares, BloqVerse architecture, Project Castor evolution)
- Fixed WebCamp KL attribution, StartingBlock attribution
- Homepage updates: 2x2 featured grid, timeline card, stats strip cleanup, centred intro with quote marks
- Fixed bump.sh for macOS, polished footer, added Explore to nav
- Removed all inline style attributes — hero backgrounds now use data-bg + JS
- Added OG and Twitter Card meta tags to all 33 pages with dedicated OG image
- Pushed to GitHub (msmalley/smalley-website)

#### 2026-05-28
- Merged CVs into main site, added thoughts/blog section

#### 2026-05-27
- Initial site build: all pages, data, and infrastructure

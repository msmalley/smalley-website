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
├── css/                Stylesheets (_sm.css base + page-specific)
├── js/                 JavaScript (SM framework: loader, core, navbar, footer, animations)
├── data/               JSON data files driving all pages
├── fonts/              Self-hosted typefaces
└── img/                Images and assets
```

## Development

Static site — no build step. Runs on any local server (MAMP, Live Server, `python -m http.server`).

The `sm-base` meta tag in each HTML file sets the path prefix for local development. On production (GitHub Pages with custom domain), the base is `/`.

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

#### 2026-06-04
- Resolved issue #17: renamed css/process.css to css/workflow.css with all class names updated
- Renamed OG images: process.jpg to workflow.jpg, thoughts-game-engines.jpg to thoughts-16-days.jpg
- Removed dead timeline code: data/timeline.json, timeline OG image, timeline CSS from pages.css
- CV Tier 1 improvements across all three variants (CTO, RegTech, DevRel)
- CTO CV: Moddable reframed as AI-augmented engineering methodology, bullets tightened to impact-first
- RegTech CV: executive summary trimmed to 3 sentences, Moddable reframed as algorithmic decision systems, regulatory framework bridge added
- DevRel CV: SlideShare line updated with verified metrics (21 presentations, 59K+ views, 31.5K on "Introducing Bitcoin")
- Added hyperlinks to verifiable claims across all CVs (SADO, DN-Key, Everstore, TEDx)
- Updated README structure to reflect current site pages

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

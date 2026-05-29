# smalley.my

Personal portfolio and CV site for Mark Smalley — engineering leader, protocol architect, and AI-native builder.

## Structure

```
├── index.html          Home page
├── cvs/                Three CV variants (CTO, RegTech, DevRel) with PDF generation
├── portfolio/          Case studies (Ordzaar, CoKeeps, Neuroware, etc.)
├── thoughts/           Blog/writing section
├── speaking/           Speaking engagements and media
├── timeline/           Career timeline
├── tools/              Developer tools showcase
├── open-source/        Open source contributions
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

#### 2026-05-29
- Added /process/ page: "How I Build" — AI-augmented engineering process with live stats and demos
- Added live interactive embeds (chess engine + hexmap generator) to portfolio/moddable, tools/chess, tools/hexmaps
- Added "How I Build" to site navigation and homepage featured section
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

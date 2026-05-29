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

#### 2025-05-29
- Extracted inline script from thoughts page into `js/sm-thoughts.js`
- Added README

#### 2025-05-28
- Merged CVs into main site, added thoughts/blog section

#### 2025-05-27
- Initial site build: all pages, data, and infrastructure

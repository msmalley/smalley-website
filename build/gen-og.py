#!/usr/bin/env python3
"""Generate OG images (1200x630) for all pages on smalley.my.

Uses the same gradient + grain aesthetic as the CSS hero sections.
Accent colours: violet (creative/Moddable), teal (crypto/protocol), gold (institutional/regulatory).

Usage: python3 build/gen-og.py
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WIDTH, HEIGHT = 1200, 630
BG = (11, 15, 26)

ACCENTS = {
    'violet': {
        'primary': (139, 92, 246),
        'secondary': (99, 102, 241),
    },
    'teal': {
        'primary': (45, 212, 191),
        'secondary': (6, 182, 212),
    },
    'gold': {
        'primary': (251, 191, 36),
        'secondary': (245, 158, 11),
    },
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(ROOT, 'img', 'og')


def load_font(size, bold=False):
    paths = [
        '/System/Library/Fonts/Supplemental/Helvetica Neue.ttc',
        '/System/Library/Fonts/Helvetica.ttc',
        '/System/Library/Fonts/SFNSText.ttf',
    ]
    for p in paths:
        try:
            idx = 4 if bold else 0
            return ImageFont.truetype(p, size, index=idx)
        except (OSError, IndexError):
            try:
                return ImageFont.truetype(p, size, index=0)
            except OSError:
                continue
    return ImageFont.load_default()


def make_grain(width, height, opacity=30):
    """Generate a noise/grain texture layer."""
    import random
    grain = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    pixels = grain.load()
    random.seed(42)
    for y in range(height):
        for x in range(width):
            v = random.randint(0, 255)
            pixels[x, y] = (v, v, v, opacity)
    return grain


def base_image(accent='violet'):
    """Create base image with gradient orbs and grain overlay."""
    img = Image.new('RGBA', (WIDTH, HEIGHT), (*BG, 255))
    colors = ACCENTS[accent]

    # Primary orb — upper left area
    orb1 = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw1 = ImageDraw.Draw(orb1)
    cx1, cy1, r1 = 280, 200, 350
    draw1.ellipse([cx1 - r1, cy1 - r1, cx1 + r1, cy1 + r1],
                  fill=(*colors['primary'], 40))
    orb1 = orb1.filter(ImageFilter.GaussianBlur(radius=120))
    img = Image.alpha_composite(img, orb1)

    # Secondary orb — lower right area
    orb2 = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw2 = ImageDraw.Draw(orb2)
    cx2, cy2, r2 = 900, 450, 300
    draw2.ellipse([cx2 - r2, cy2 - r2, cx2 + r2, cy2 + r2],
                  fill=(*colors['secondary'], 25))
    orb2 = orb2.filter(ImageFilter.GaussianBlur(radius=100))
    img = Image.alpha_composite(img, orb2)

    # Grain overlay
    grain = make_grain(WIDTH, HEIGHT, opacity=18)
    img = Image.alpha_composite(img, grain)

    return img


def add_text(img, eyebrow, title, subtitle='', accent='violet'):
    """Add eyebrow, title, and subtitle text to the image."""
    draw = ImageDraw.Draw(img)
    colors = ACCENTS[accent]

    y_cursor = 240

    # Eyebrow
    if eyebrow:
        font_eyebrow = load_font(14, bold=True)
        draw.text((80, y_cursor), eyebrow.upper(), fill=(*colors['primary'], 220), font=font_eyebrow)
        y_cursor += 36

    # Title
    font_title = load_font(48, bold=True)
    # Word-wrap title if too long
    lines = wrap_text(title, font_title, WIDTH - 160)
    for line in lines:
        draw.text((80, y_cursor), line, fill=(240, 242, 245, 255), font=font_title)
        y_cursor += 58

    # Subtitle
    if subtitle:
        y_cursor += 8
        font_sub = load_font(18)
        draw.text((80, y_cursor), subtitle, fill=(139, 146, 165, 255), font=font_sub)

    # Bottom accent line
    draw.line([(80, 560), (280, 560)], fill=(*colors['primary'], 180), width=3)

    # Site URL bottom right
    font_url = load_font(14)
    draw.text((WIDTH - 200, 568), 'smalley.my', fill=(139, 146, 165, 180), font=font_url)

    return img


def wrap_text(text, font, max_width):
    """Simple word-wrap for title text."""
    words = text.split()
    lines = []
    current = ''
    for word in words:
        test = (current + ' ' + word).strip()
        bbox = font.getbbox(test)
        if bbox[2] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    return lines


def save(img, filename):
    """Save image to the OG output directory as optimised JPEG."""
    filename = filename.replace('.png', '.jpg')
    path = os.path.join(OUT_DIR, filename)
    img.convert('RGB').save(path, 'JPEG', quality=85, optimize=True)
    size_kb = os.path.getsize(path) // 1024
    print(f'  {filename} ({size_kb}KB)')


def generate_all():
    """Generate OG images for every page."""
    os.makedirs(OUT_DIR, exist_ok=True)

    pages = [
        # Homepage
        ('og-default.png', 'violet', 'Mark Smalley',
         'Engineering Leader · Protocol Architect · AI-Native Builder',
         'CTO, RegTech, and Developer Relations'),

        # Portfolio pages
        ('portfolio.png', 'teal', 'Portfolio',
         'Portfolio', '15 years of blockchain infrastructure, from first principles'),
        ('portfolio-ordzaar.png', 'teal', 'CakeDefi · 2023',
         'Ordzaar', "Bitcoin's leading Ordinals marketplace"),
        ('portfolio-sado.png', 'teal', 'R1 (contracted by Cake) · 2023',
         'SADO Protocol', 'Decentralised trading protocol for Bitcoin Ordinals'),
        ('portfolio-oviato.png', 'teal', 'Oviato · 2025',
         'Oviato', 'Passkey-native wallet infrastructure'),
        ('portfolio-moddable.png', 'violet', 'Moddable Limited · 2025',
         'Moddable Games', 'Open-source games studio using AI-augmented engineering'),
        ('portfolio-cokeeps.png', 'gold', 'R1 · 2018–2023',
         'CoKeeps', "Malaysia's first regulated Digital Asset Custodian"),
        ('portfolio-r1.png', 'gold', 'Founded 2012 · Malaysia',
         'R1', '13 years of blockchain infrastructure'),
        ('portfolio-neuroware.png', 'gold', 'Neuroware Inc · 2013–2018',
         'Neuroware', '500 Startups-funded blockchain compliance infrastructure'),
        ('portfolio-eden.png', 'teal', 'R1 · 2024',
         'Project Eden', 'Weekend hackathon to passkey wallet prototype'),
        ('portfolio-castor.png', 'gold', 'Securities Commission Malaysia · 2018',
         'Project Castor', 'SC Malaysia blockchain blueprint'),
        ('portfolio-bloqverse.png', 'teal', 'R1 / Neuroware · 2019',
         'BloqVerse', 'Fully serverless Ethereum game infrastructure'),

        # Tools pages
        ('tools.png', 'violet', 'Developer Tools',
         'Dev Tools', 'PDF pagination, 70-variant chess engine, hex map framework'),
        ('tools-chess.png', 'violet', 'Moddable Games · 2025',
         'Moddable Chess Engine', '70 variants · AI with opening books · PostMessage embed API'),
        ('tools-hexmaps.png', 'violet', 'Moddable Games · 2025',
         'Moddable Hexmaps', 'Seeded procedural hex maps with JSON export'),
        ('tools-pdf.png', 'violet', 'Moddable Games · 2025',
         'PDF Pagination Engine', 'Intelligent document pagination with orphan prevention'),

        # Open Source pages
        ('opensource.png', 'teal', 'Open Source',
         'Protocols & SDKs', 'Open-source contributions in production'),
        ('opensource-ordit.png', 'teal', 'sadoprotocol · 2023',
         'Ordit SDK', 'Open-source toolkit for Bitcoin Ordinals and Inscriptions'),
        ('opensource-embassy.png', 'gold', 'R1 · 2016',
         'Blockchain Embassy of Asia', "ASEAN's first public blockchain consortium"),
        ('opensource-dnkey.png', 'gold', 'R1 · 2016',
         'DN-Key Protocol', 'Decentralised key management via DNS TXT records'),

        # Section pages
        ('process.png', 'violet', 'Engineering Process',
         'How I Build', 'AI-augmented engineering at startup speed'),
        ('regtech.png', 'gold', 'RegTech & Compliance',
         'I speak both languages', '13 years building blockchain for regulated markets'),
        ('speaking.png', 'teal', 'Speaking & Media',
         'TEDx to Boardrooms', 'Blockchain, compliance, and developer education'),
        ('speaking-cost-of-cash.png', 'teal', 'TEDx Sarawak · 2017',
         'The Cost of Cash', 'Demystifying Bitcoin and decentralised money'),
        ('speaking-blockchain-devs.png', 'teal', 'Neuroware · 2016',
         'Blockchain Infrastructure for Developers', 'Developer and institutional audiences'),
        ('speaking-conferences.png', 'gold', 'Speaking',
         'Conference Circuit', 'Financial Crime Summit, Finnovasia, MDEC FinTech'),
        ('speaking-bfm-radio.png', 'gold', 'BFM Radio · 2016',
         'BFM Radio', "Live on Malaysia's English business radio"),
        ('speaking-webcamp-kl.png', 'teal', 'WebCamp KL · 2011–2013',
         'WebCamp KL', 'Regular speaker from 2011 — MongoDB, Bitcoin, web dev'),
        ('explore.png', 'teal', 'Explore',
         "Everything I've built", 'Filter by technology, year, or domain'),
        ('timeline.png', 'gold', 'Career',
         'The journey so far', '15 years from first Bitcoin transaction to AI-native engineering'),
        ('thoughts.png', 'teal', 'Thoughts',
         'Writing', 'On architecture, blockchain, and building in public'),
        ('thoughts-vanilla-js.png', 'violet', 'Thoughts',
         'The Case for Vanilla JS in 2026', '70-variant chess engine, zero frameworks, zero build steps'),
        ('thoughts-game-engines.png', 'violet', 'Thoughts',
         'Building Two Open-Source Game Engines (With AI)', '70 chess variants and infinite hex maps'),
        ('thoughts-regulators.png', 'gold', 'Thoughts',
         'What Regulators Actually Need from Blockchain Teams', "After 2 years advising Malaysia's Securities Commission"),
        ('thoughts-ordinals.png', 'teal', 'Thoughts',
         'The Cardinal Sins of Bitcoin Ordinals', 'What the ecosystem gets wrong about digital artifacts'),
    ]

    for entry in pages:
        filename, accent, eyebrow, title, subtitle = entry
        img = base_image(accent)
        add_text(img, eyebrow, title, subtitle, accent)
        save(img, filename)


if __name__ == '__main__':
    print('Generating OG images for smalley.my...')
    generate_all()
    print(f'Done. {len(os.listdir(OUT_DIR))} images in img/og/')

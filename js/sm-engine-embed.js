/**
 * Moddable engine embeds, driven by the Tools SDK.
 *
 * Replaces the hand-rolled iframe builders in sm-chess-embed.js and
 * sm-hex-embed.js, which each carried a hardcoded variant list. Those lists went
 * stale the moment a variant was added: the chess embed offered 6 of the 135
 * variants the engine actually serves.
 *
 * Families and variants are now fetched from the Tools API at load, so an embed
 * always offers everything the engine can play.
 *
 * Usage — markup only, no inline script:
 *
 *   <div data-engine-embed="play"></div>
 *   <div data-engine-embed="play" data-definition="true"></div>
 *   <div data-engine-embed="hex"></div>
 *
 * Options:
 *   data-family      initial family for play mode      (default: chess)
 *   data-variant     initial variant for play mode     (default: standard)
 *   data-definition  show the live frontmatter panel   (default: false)
 *   data-height      iframe height in px               (default: 560)
 */
import { ModdableTools } from './moddable-tools-sdk.js';

const engineBase = location.hostname === 'localhost'
  ? location.origin + '/MODDABLE/moddable-engine'
  : 'https://engine.moddable.games';

const tools = new ModdableTools({ base: 'https://tools.moddable.games', engineBase });

/** Hex maps are generators rather than rule variants, so they are not in the play API. */
const HEX_GAMES = [
  { key: 'nukes',    label: 'Nukes',    desc: 'Area control across volcanic terrain', styles: ['artistic', 'classic', 'kenney', 'realistic'] },
  { key: 'talisman', label: 'Talisman', desc: '5-ring fantasy adventure map',         styles: ['artistic', 'classic'] },
  { key: 'twilight', label: 'Twilight', desc: 'Galactic strategy, planetary systems', styles: ['artistic', 'classic'] },
  { key: 'colony',   label: 'Colony',   desc: 'Settlements, ports, and trade routes', styles: ['classic', 'kenney', 'realistic'] }
];

function title(s) {
  return String(s).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function select(onChange) {
  const el = document.createElement('select');
  el.className = 'engine-embed__select';
  el.addEventListener('change', onChange);
  return el;
}

function fill(el, items, selected) {
  el.innerHTML = '';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.value;
    opt.textContent = item.label;
    if (item.value === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

function scaffold(container) {
  const controls = document.createElement('div');
  controls.className = 'engine-embed__controls';
  container.appendChild(controls);

  const definition = document.createElement('pre');
  definition.className = 'engine-embed__definition';
  definition.hidden = true;
  const code = document.createElement('code');
  definition.appendChild(code);
  container.appendChild(definition);

  const frame = document.createElement('div');
  frame.className = 'engine-embed__frame';
  container.appendChild(frame);

  const caption = document.createElement('p');
  caption.className = 'engine-embed__caption';
  container.appendChild(caption);

  return { controls, definition, code, frame, caption };
}

/** Render the variant's real frontmatter, trimmed of generated bulk. */
function toYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      out += v.every(x => typeof x !== 'object')
        ? pad + k + ': [' + v.join(', ') + ']\n'
        : pad + k + ':\n' + v.map(i => pad + '  - ' + (typeof i === 'object' ? JSON.stringify(i) : i) + '\n').join('');
    } else if (typeof v === 'object') {
      out += pad + k + ':\n' + toYaml(v, indent + 1);
    } else if (typeof v === 'string' && (v.includes('/') || v.includes(' '))) {
      out += pad + k + ': "' + v + '"\n';
    } else {
      out += pad + k + ': ' + v + '\n';
    }
  }
  return out;
}

async function showDefinition(code, family, variant) {
  try {
    const result = await tools.play.getDefinition({ family, variant });
    const def = (result.result || result).definition;
    if (!def) { code.textContent = '# No definition available'; return; }
    const clean = { ...def };
    delete clean.meta;
    if (clean.render?.ops) delete clean.render.ops;
    if (clean.plugins) {
      const fam = Object.keys(clean.plugins)[0];
      if (fam && clean.plugins[fam]?.openingBook) delete clean.plugins[fam].openingBook;
    }
    code.textContent = '---\n' + toYaml(clean) + '---';
  } catch (e) {
    code.textContent = '# Failed to load definition';
  }
}

async function initPlay(container) {
  const { controls, definition, code, frame, caption } = scaffold(container);
  const wantDefinition = container.dataset.definition === 'true';
  const height = parseInt(container.dataset.height, 10) || 560;
  definition.hidden = !wantDefinition;

  const familyEl = select(async () => { await loadVariants(); });
  const variantEl = select(() => update());
  controls.append(familyEl, variantEl);

  function update() {
    tools.embed.play(frame, {
      params: { game: familyEl.value, variant: variantEl.value },
      title: 'Moddable Engine: ' + title(familyEl.value) + ', ' + title(variantEl.value),
      height
    });
    if (wantDefinition) showDefinition(code, familyEl.value, variantEl.value);
  }

  async function loadVariants() {
    const res = await tools.play.listVariants({ family: familyEl.value });
    const variants = (res.result || res).variants || [];
    fill(variantEl, variants.map(v => ({ value: v.slug, label: title(v.slug) })),
         container.dataset.variant || 'standard');
    // Say "through the play API" explicitly: the engine registers a few more
    // variants per family than the play endpoint exposes, and a bare count here
    // reads as a contradiction next to the engine totals elsewhere on the page.
    caption.textContent = variants.length + ' ' + title(familyEl.value) +
      ' variants playable through the Tools API, each a frontmatter definition ' +
      'rather than variant-specific code.';
    update();
  }

  try {
    const res = await tools.play.listFamilies();
    const families = (res.result || res).families || [];
    fill(familyEl, families.map(f => ({ value: f.name, label: title(f.name) })),
         container.dataset.family || 'chess');
    await loadVariants();
  } catch (e) {
    // The engine surface still works without the tools API, so fall back to a
    // plain playable board rather than leaving an empty box.
    controls.remove();
    tools.embed.play(frame, { params: { game: 'chess', variant: 'standard' }, height });
    caption.textContent = 'Live variant list unavailable. Showing standard chess.';
  }
}

function initHex(container) {
  const { controls, frame, caption } = scaffold(container);
  const height = parseInt(container.dataset.height, 10) || 560;

  const gameEl = select(() => { syncStyles(); update(); });
  const styleEl = select(() => update());
  controls.append(gameEl, styleEl);
  fill(gameEl, HEX_GAMES.map(g => ({ value: g.key, label: g.label })), HEX_GAMES[0].key);

  function current() {
    return HEX_GAMES.find(g => g.key === gameEl.value) || HEX_GAMES[0];
  }
  function syncStyles() {
    const g = current();
    fill(styleEl, g.styles.map(s => ({ value: s, label: title(s) })), g.styles[0]);
  }
  function update() {
    const g = current();
    tools.embed.play(frame, {
      params: { game: g.key, style: styleEl.value, random: '1' },
      title: 'Moddable Engine: ' + g.label,
      height
    });
    caption.textContent = g.desc;
  }

  syncStyles();
  update();
}

document.querySelectorAll('[data-engine-embed]').forEach(el => {
  if (el.dataset.engineEmbed === 'hex') initHex(el);
  else initPlay(el);
});

window.SM = (() => {
  const VERSION = '1.0.24';
  const META_BASE = (document.querySelector('meta[name="sm-base"]') || {}).content;
  const BASE = META_BASE != null ? META_BASE
    : location.pathname.includes('/personal/smalley-website')
      ? '/personal/smalley-website' : '';
  function url(path) { return BASE + path; }

  const T = {
    deep: '#0B0F1A',
    surface: '#141824',
    surfaceAlt: '#1C2235',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(255,255,255,0.16)',
    text: '#F0F2F5',
    muted: '#8B92A5',
    faint: '#4A5168',
    teal: '#0E7490',
    tealGlow: '#22D3EE',
    gold: '#9A6F2E',
    goldGlow: '#F59E0B',
    violet: '#6D28D9',
    violetGlow: '#A78BFA',
    link: '#6FB5FF',
    success: '#34D399',
  };

  const F = {
    display: '"Syne", system-ui, sans-serif',
    heading: '"Space Grotesk", system-ui, sans-serif',
    body: '"DM Sans", system-ui, sans-serif',
    mono: '"JetBrains Mono", monospace',
  };

  function el(tag, attrs, ...children) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (k === 'style' && typeof v === 'object') {
          Object.assign(e.style, v);
        } else if (k === 'html') {
          e.innerHTML = v;
        } else if (k.startsWith('on')) {
          e.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          e.setAttribute(k, v);
        }
      }
    }
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  var dataCache = {};
  function getData(name) {
    if (dataCache[name]) return dataCache[name];
    dataCache[name] = fetch(url('/data/' + name + '.json'))
      .then(function(r) { return r.json(); });
    return dataCache[name];
  }

  function fillLastRow(grid, selector) {
    var cols = 3;
    var w = grid.offsetWidth;
    if (w < 640) cols = 1;
    else if (w < 960) cols = 2;
    var cards = grid.querySelectorAll(selector);
    var remainder = cols > 1 ? (cards.length % cols) : 0;
    if (remainder === 1) {
      cards[cards.length - 1].style.gridColumn = 'span ' + cols;
    } else if (remainder === 2 && cols === 3) {
      cards[cards.length - 2].style.gridColumn = 'span 2';
    }
  }

  return { VERSION, BASE, url, T, F, el, getData, fillLastRow };
})();

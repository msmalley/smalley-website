window.SM = (() => {
  const VERSION = '1.0.9';
  const META_BASE = (document.querySelector('meta[name="sm-base"]') || {}).content;
  const BASE = META_BASE != null ? META_BASE
    : location.pathname.includes('/personal/smalley-rebuild')
      ? '/personal/smalley-rebuild' : '';
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

  return { VERSION, BASE, url, T, F, el, getData };
})();

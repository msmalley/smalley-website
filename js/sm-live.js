/**
 * Live Moddable statistics.
 *
 * Single source of truth for every Moddable number on this site is the stats
 * endpoint, never a figure typed into a page or a data file. Counts move every
 * week, so anything hardcoded is wrong within days of being written.
 *
 * Two ways to bind a value:
 *
 *   1. Markup      <span data-stat="tools">89</span>
 *      The inner text is the fallback, shown until the fetch resolves and kept
 *      if it never does.
 *
 *   2. Token       "... {{stat:tools|89}} AI-callable tools ..."
 *      For prose held in data/*.json, which renders as text nodes and cannot
 *      carry markup. The token is swapped for a data-stat span in place.
 *
 * Both degrade to the fallback when the endpoint is unreachable, so a page is
 * never left showing a raw token or an empty gap.
 */
(function() {
  var CACHE_KEY = 'sm-live-moddable';
  var CACHE_TTL = 60 * 60 * 1000;
  var API_URL = 'https://tools.moddable.games/api/stats';
  var TOKEN = /\{\{stat:([a-zA-Z]+)(?:\|([^}]*))?\}\}/g;

  var current = null;

  function fmt(n) {
    return Number(n).toLocaleString();
  }

  function dig(obj) {
    for (var i = 1; i < arguments.length; i++) {
      if (obj == null) return null;
      obj = obj[arguments[i]];
    }
    return obj == null ? null : obj;
  }

  /** Flatten the endpoint's nested payload into the keys pages bind to. */
  function normalise(s) {
    return {
      games:        dig(s, 'rules', 'games', 'total'),
      gamesLive:    dig(s, 'rules', 'games', 'byStatus', 'live'),
      variants:     dig(s, 'engine', 'playableVariants'),
      families:     dig(s, 'engine', 'playableFamilies'),
      pieces:       dig(s, 'engine', 'pieces'),
      boards:       dig(s, 'engine', 'boards'),
      puzzles:      dig(s, 'engine', 'puzzles'),
      tests:        dig(s, 'engine', 'tests'),
      testSuites:   dig(s, 'engine', 'testSuites'),
      ruleVariants: dig(s, 'rules', 'content', 'variants'),
      rulePages:    dig(s, 'rules', 'content', 'totalRulePages'),
      pdfs:         dig(s, 'rules', 'pdfs', 'total'),
      pages:        dig(s, 'rules', 'pdfs', 'totalPages'),
      oracleTables: dig(s, 'rules', 'data', 'oracleTables'),
      entities:     dig(s, 'rules', 'data', 'entities'),
      rpgSystems:   dig(s, 'rules', 'data', 'rpgSystems'),
      diagrams:     dig(s, 'rules', 'diagrams', 'total'),
      htmlPages:    dig(s, 'rules', 'site', 'htmlPages'),
      apiEndpoints: dig(s, 'rules', 'site', 'apiEndpoints'),
      tools:        dig(s, 'tools', 'tools'),
      endpoints:    dig(s, 'tools', 'endpoints'),
      // Per-family playable counts, for pages that speak about one family.
      chessVariants:    dig(s, 'engine', 'playableByFamily', 'chess'),
      hexVariants:      dig(s, 'engine', 'playableByFamily', 'hex'),
      draughtsVariants: dig(s, 'engine', 'playableByFamily', 'draughts'),
      shogiVariants:    dig(s, 'engine', 'playableByFamily', 'shogi'),
      goVariants:       dig(s, 'engine', 'playableByFamily', 'go')
    };
  }

  /**
   * Replace {{stat:key|fallback}} tokens with bindable spans. Runs before any
   * network call so the fallback paints immediately, and the span is what the
   * later update writes into.
   */
  function expandTokens(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var pending = [];
    var node;
    while ((node = walker.nextNode())) {
      TOKEN.lastIndex = 0;
      if (TOKEN.test(node.nodeValue)) pending.push(node);
    }

    pending.forEach(function(textNode) {
      var frag = document.createDocumentFragment();
      var text = textNode.nodeValue;
      var last = 0;
      var m;
      TOKEN.lastIndex = 0;
      while ((m = TOKEN.exec(text)) !== null) {
        if (m.index > last) {
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        }
        var span = document.createElement('span');
        span.className = 'live-stat';
        span.setAttribute('data-stat', m[1]);
        span.textContent = m[2] != null ? m[2] : '';
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      if (last < text.length) {
        frag.appendChild(document.createTextNode(text.slice(last)));
      }
      if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function render(data, root) {
    if (!data) return;
    var scope = root || document;

    // Legacy homepage grid, addressed by id rather than data-stat.
    var ids = {
      'live-games': data.games, 'live-variants': data.variants,
      'live-tools': data.tools, 'live-pages': data.pages,
      'stat-games': data.games, 'stat-variants': data.variants,
      'stat-tools': data.tools, 'stat-pages': data.pages
    };
    Object.keys(ids).forEach(function(id) {
      var e = document.getElementById(id);
      if (e && ids[id] != null) e.textContent = fmt(ids[id]);
    });

    var nodes = scope.querySelectorAll('[data-stat]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-stat');
      if (data[key] != null) nodes[i].textContent = fmt(data[key]);
    }
  }

  var fetched = false;

  function process(root) {
    expandTokens(root);
    if (current) render(current, root);
    // The module loads site-wide, so only reach for the network once a page
    // actually binds something. Bindings can arrive late with JSON-rendered cards.
    if (!fetched && document.querySelector('[data-stat]')) {
      fetched = true;
      fetchStats();
    }
  }

  function fetchStats() {
    var cached = null;
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        cached = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL) {
          current = cached.data;
          render(current);
          return;
        }
      }
    } catch (e) {}

    fetch(API_URL)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(stats) {
        if (!stats) {
          if (cached) { current = cached.data; render(current); }
          return;
        }
        current = normalise(stats);
        render(current);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: current }));
        } catch (e) {}
      })
      .catch(function() {
        // Stale cache beats an empty number.
        if (cached) { current = cached.data; render(current); }
      });
  }

  function init() {
    process(document.body);

    // Card content renders from data/*.json after this script runs, so watch for
    // late-arriving nodes rather than requiring every renderer to call back in.
    if (window.MutationObserver) {
      var queued = false;
      new MutationObserver(function(records) {
        if (queued) return;
        for (var i = 0; i < records.length; i++) {
          if (records[i].addedNodes.length) {
            queued = true;
            requestAnimationFrame(function() {
              queued = false;
              process(document.body);
            });
            return;
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

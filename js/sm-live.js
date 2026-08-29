(function() {
  var CACHE_KEY = 'sm-live-moddable';
  var CACHE_TTL = 60 * 60 * 1000;
  var API_URL = 'https://tools.moddable.games/api/stats';

  function fmt(n) {
    return Number(n).toLocaleString();
  }

  function render(data) {
    var map = {
      'live-games': data.games,
      'live-variants': data.variants,
      'live-tools': data.tools,
      'live-pages': data.pages,
      'stat-games': data.games,
      'stat-variants': data.variants,
      'stat-tools': data.tools,
      'stat-pages': data.pages
    };
    Object.keys(map).forEach(function(id) {
      var el = document.getElementById(id);
      if (el && map[id] != null) el.textContent = fmt(map[id]);
    });
  }

  function fetchStats() {
    var cached = null;
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        cached = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL) {
          render(cached.data);
          return;
        }
      }
    } catch(e) {}

    fetch(API_URL)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(stats) {
        if (!stats) {
          if (cached) render(cached.data);
          return;
        }

        var data = {
          games: stats.rules && stats.rules.games ? stats.rules.games.total : null,
          variants: stats.engine ? stats.engine.playableVariants : null,
          tools: stats.tools ? stats.tools.tools : null,
          pages: stats.rules && stats.rules.pdfs ? stats.rules.pdfs.totalPages : null
        };

        render(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
        } catch(e) {}
      })
      .catch(function() {
        if (cached) render(cached.data);
      });
  }

  if (document.getElementById('live-grid')) fetchStats();
})();

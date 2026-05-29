(function() {
  var CACHE_KEY = 'sm-live-github';
  var CACHE_TTL = 60 * 60 * 1000;
  var ORG = 'moddable-games';
  var REPOS = ['moddable-chess', 'moddable-hexmaps', 'moddable-website', 'moddable-rules', 'moddable-decks', 'dungeon-chess'];

  function render(data) {
    var el = document.getElementById('live-commits');
    if (el) el.textContent = data.commits || '535+';
    el = document.getElementById('live-repos');
    if (el) el.textContent = data.repos || '6';
    el = document.getElementById('live-variants');
    if (el) el.textContent = data.variants || '64';
    el = document.getElementById('live-lastcommit');
    if (el) el.textContent = data.lastCommit || 'today';
  }

  function timeAgo(dateStr) {
    var d = new Date(dateStr);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function fetchLive() {
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

    var promises = REPOS.map(function(repo) {
      return fetch('https://api.github.com/repos/' + ORG + '/' + repo)
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });
    });

    Promise.all(promises).then(function(results) {
      var repos = results.filter(Boolean);
      if (!repos.length) {
        if (cached) render(cached.data);
        return;
      }

      var totalCommits = 0;
      var latest = '';
      var variantCount = 64;

      for (var i = 0; i < repos.length; i++) {
        totalCommits += repos[i].size ? Math.round(repos[i].size / 5) : 0;
        if (repos[i].pushed_at && repos[i].pushed_at > latest) {
          latest = repos[i].pushed_at;
        }
      }

      fetch('https://api.github.com/repos/' + ORG + '/moddable-chess/contents/js/variants')
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(files) {
          if (files && files.length) {
            variantCount = files.filter(function(f) { return f.name !== 'index.js'; }).length;
          }
        })
        .catch(function() {})
        .finally(function() {
          var commitPromises = REPOS.map(function(repo) {
            return fetch('https://api.github.com/repos/' + ORG + '/' + repo + '/commits?per_page=1')
              .then(function(r) {
                if (!r.ok) return 0;
                var link = r.headers.get('Link');
                if (link) {
                  var match = link.match(/page=(\d+)>; rel="last"/);
                  if (match) return parseInt(match[1], 10);
                }
                return 1;
              })
              .catch(function() { return 0; });
          });

          Promise.all(commitPromises).then(function(counts) {
            var total = 0;
            for (var c = 0; c < counts.length; c++) total += counts[c];
            if (total < 100) total = 535;

            var data = {
              commits: total.toLocaleString(),
              repos: repos.length.toString(),
              variants: variantCount.toString(),
              lastCommit: latest ? timeAgo(latest) : 'today'
            };

            render(data);
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
            } catch(e) {}
          });
        });
    });
  }

  if (document.getElementById('live-grid')) fetchLive();
})();

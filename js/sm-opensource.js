(function() {
  SM.getData('opensource').then(function(items) {
    var groups = { engine: [], protocol: [], infrastructure: [] };

    for (var i = 0; i < items.length; i++) {
      var cat = items[i].category;
      if (groups[cat]) groups[cat].push(items[i]);
    }

    renderGroup(groups.engine, document.getElementById('oss-engines-grid'));
    renderGroup(groups.protocol, document.getElementById('oss-protocols-grid'));
    renderGroup(groups.infrastructure, document.getElementById('oss-infrastructure-grid'));

    SM.observe();
  });

  function renderGroup(items, grid) {
    if (!grid || !items.length) return;

    for (var i = 0; i < items.length; i++) {
      var o = items[i];
      var status = o.status || 'production';

      var stats = SM.el('div', { class: 'tool-card-stats' });
      if (o.stats) {
        for (var s = 0; s < o.stats.length; s++) {
          stats.appendChild(SM.el('span', { class: 'tool-card-stat', 'data-accent': o.accent }, o.stats[s].value + ' ' + o.stats[s].label));
        }
      }

      var href = o.slug ? SM.url('/open-source/' + o.slug + '/') : (o.demo || o.repo || null);
      var tag = href ? 'a' : 'div';
      var attrs = { class: 'project-card reveal' };
      if (href) {
        attrs.href = href;
        if (!o.slug) { attrs.target = '_blank'; attrs.rel = 'noopener'; }
      }

      var card = SM.el(tag, attrs,
        SM.el('div', { class: 'card' },
          SM.el('div', { class: 'oss-card-header' },
            SM.el('div', { class: 'project-card-eyebrow', 'data-accent': o.accent }, o.role),
            SM.el('span', { class: 'oss-badge oss-badge-' + status }, status)
          ),
          SM.el('div', { class: 'project-card-title' }, o.title),
          SM.el('div', { class: 'project-card-desc' }, o.tagline),
          SM.el('div', { class: 'project-card-desc' }, o.description),
          stats
        )
      );
      grid.appendChild(card);
    }

    SM.fillLastRow(grid, '.project-card');
  }
})();

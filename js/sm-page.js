(function() {
  var page = document.body.dataset.page;
  if (!page) return;

  var renderers = {
    portfolio: renderPortfolio,
    cvs: renderCvs,
    speaking: renderSpeaking,
    opensource: renderOpenSource,
    tools: renderTools,
    timeline: renderTimeline
  };

  if (renderers[page]) renderers[page]();

  function renderPortfolio() {
    SM.getData('portfolio').then(function(projects) {
      var grid = document.querySelector('.project-grid');
      if (!grid) return;
      for (var i = 0; i < projects.length; i++) {
        var p = projects[i];
        var card = SM.el('a', { class: 'project-card reveal', href: SM.url('/portfolio/' + p.slug + '/') },
          SM.el('div', { class: 'card' },
            SM.el('div', { class: 'project-card-eyebrow', 'data-accent': p.accent }, p.company + ' · ' + p.year),
            SM.el('div', { class: 'project-card-title' }, p.title),
            SM.el('div', { class: 'project-card-role' }, p.role),
            SM.el('div', { class: 'project-card-desc' }, p.summary),
            SM.el('div', { class: 'project-card-outcome' }, p.outcome)
          )
        );
        grid.appendChild(card);
      }
      SM.observe();
    });
  }

  function renderCvs() {}

  function renderSpeaking() {
    SM.getData('speaking').then(function(talks) {
      var list = document.querySelector('.talk-list');
      if (!list) return;
      for (var i = 0; i < talks.length; i++) {
        var t = talks[i];
        var badges = SM.el('div', null);
        if (t.type) badges.appendChild(SM.el('span', { class: 'talk-badge' }, t.type));
        if (t.videoId) badges.appendChild(SM.el('a', { class: 'talk-badge', href: 'https://www.youtube.com/watch?v=' + t.videoId, target: '_blank', rel: 'noopener' }, 'video'));
        var item = SM.el('li', { class: 'talk-item reveal' },
          SM.el('div', { class: 'talk-year' }, String(t.year)),
          SM.el('div', null,
            SM.el('div', { class: 'talk-title' }, t.title),
            SM.el('div', { class: 'talk-event' }, t.event),
            SM.el('div', { class: 'talk-desc' }, t.description),
            badges
          )
        );
        list.appendChild(item);
      }
      SM.observe();
    });
  }

  function renderOpenSource() {
    SM.getData('opensource').then(function(items) {
      var list = document.querySelector('.oss-list');
      if (!list) return;
      for (var i = 0; i < items.length; i++) {
        var o = items[i];
        var links = SM.el('div', { class: 'oss-links' });
        if (o.repo) links.appendChild(SM.el('a', { href: o.repo, target: '_blank', rel: 'noopener' }, 'Repository'));
        if (o.demo) links.appendChild(SM.el('a', { href: o.demo, target: '_blank', rel: 'noopener' }, 'Live Demo'));
        var status = o.status || 'production';
        var item = SM.el('li', { class: 'oss-item reveal' },
          SM.el('div', { class: 'oss-title' }, o.title),
          SM.el('div', { class: 'oss-role' }, o.role),
          SM.el('div', { class: 'oss-desc' }, o.description),
          links,
          SM.el('span', { class: 'oss-badge oss-badge-' + status }, status)
        );
        list.appendChild(item);
      }
      SM.observe();
    });
  }

  function renderTools() {
    SM.getData('tools').then(function(tools) {
      var container = document.querySelector('.tools-list');
      if (!container) return;
      for (var i = 0; i < tools.length; i++) {
        var t = tools[i];
        var stats = SM.el('div', { class: 'tool-stats' });
        for (var s = 0; s < t.stats.length; s++) {
          stats.appendChild(SM.el('div', null,
            SM.el('div', { class: 'tool-stat-value', 'data-accent': t.accent }, t.stats[s].value),
            SM.el('div', { class: 'tool-stat-label' }, t.stats[s].label)
          ));
        }
        var links = SM.el('div', { class: 'tool-links' });
        if (t.demo) links.appendChild(SM.el('a', { class: 'btn-secondary', href: t.demo, target: '_blank', rel: 'noopener' }, 'Live Demo'));
        if (t.repo) links.appendChild(SM.el('a', { class: 'btn-secondary', href: t.repo, target: '_blank', rel: 'noopener' }, 'Repository'));
        var card = SM.el('div', { class: 'tool-card reveal' },
          SM.el('div', { class: 'card' },
            SM.el('div', { class: 'tool-card-title' }, t.title),
            SM.el('div', { class: 'tool-card-tagline' }, t.tagline),
            SM.el('div', { class: 'tool-card-desc' }, t.description),
            stats,
            links
          )
        );
        container.appendChild(card);
      }
      SM.observe();
    });
  }

  function renderTimeline() {
    SM.getData('timeline').then(function(entries) {
      var list = document.querySelector('.timeline-list');
      if (!list) return;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var highlights = SM.el('ul', { class: 'timeline-highlights' });
        for (var h = 0; h < e.highlights.length; h++) {
          highlights.appendChild(SM.el('li', null, e.highlights[h]));
        }
        var item = SM.el('li', { class: 'timeline-item reveal', 'data-accent': e.accent },
          SM.el('div', { class: 'timeline-year' }, e.year),
          SM.el('div', { class: 'timeline-title' }, e.title),
          SM.el('div', { class: 'timeline-company' }, e.company + (e.location ? ' — ' + e.location : '')),
          highlights
        );
        list.appendChild(item);
      }
      SM.observe();
    });
  }
})();

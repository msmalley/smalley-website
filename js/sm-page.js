(function() {
  var page = document.body.dataset.page;
  if (!page) return;

  var renderers = {
    portfolio: renderPortfolio,
    cvs: renderCvs,
    speaking: renderSpeaking,
    opensource: renderOpenSource,
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
        if (t.slug) badges.appendChild(SM.el('a', { class: 'talk-badge talk-badge-link', href: SM.url('/speaking/' + t.slug + '/') }, 'read more'));
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
      var grid = document.querySelector('.oss-grid');
      if (!grid) return;
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
        var tag = e.link ? 'a' : 'li';
        var attrs = { class: 'timeline-item reveal', 'data-accent': e.accent };
        if (e.link) attrs.href = SM.url(e.link);
        var item = SM.el(tag, attrs,
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

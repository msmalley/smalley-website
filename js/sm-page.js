(function() {
  var page = document.body.dataset.page;
  if (!page) return;

  var renderers = {
    portfolio: renderPortfolio,
    cvs: renderCvs,
    speaking: renderSpeaking
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
      SM.fillLastRow(grid, '.project-card');
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

})();

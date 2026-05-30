(function() {
  var container = document.querySelector('.related-writing');
  if (!container) return;

  var slugs = (container.getAttribute('data-slugs') || '').split(',').map(function(s) { return s.trim(); });
  if (!slugs.length) return;

  SM.getData('thoughts').then(function(posts) {
    var matches = posts.filter(function(p) { return slugs.indexOf(p.slug) !== -1; });
    if (!matches.length) return;

    var section = SM.el('section', { class: 'related-section' },
      SM.el('div', { class: 'eyebrow' }, 'Related Writing'),
      SM.el('div', { class: 'section-title' }, 'From the blog')
    );

    var grid = SM.el('div', { class: 'related-grid' });
    for (var i = 0; i < matches.length; i++) {
      var p = matches[i];
      var meta = p.date;
      if (p.readingTime) meta += ' · ' + p.readingTime;
      grid.appendChild(SM.el('a', { class: 'related-card', href: SM.url('/thoughts/' + p.slug + '/') },
        SM.el('div', { class: 'related-card-meta' }, meta),
        SM.el('div', { class: 'related-card-title' }, p.title),
        SM.el('div', { class: 'related-card-excerpt' }, p.excerpt)
      ));
    }

    section.appendChild(grid);
    container.appendChild(section);
  });
})();

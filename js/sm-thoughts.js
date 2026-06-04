SM.getData('thoughts').then(function(posts) {
  var list = document.getElementById('thoughts-list');
  var featuredEl = document.getElementById('featured-article');
  var featuredTitle = document.getElementById('featured-title');
  var featuredExcerpt = document.getElementById('featured-excerpt');
  var featuredMeta = document.getElementById('featured-meta');
  var featuredTags = document.getElementById('featured-tags');

  if (featuredEl && posts.length > 0) {
    var f = posts[0];
    featuredEl.href = SM.url('/thoughts/' + f.slug + '/');
    featuredTitle.textContent = f.title;
    featuredExcerpt.textContent = f.excerpt;
    var meta = f.date;
    if (f.readingTime) meta += ' · ' + f.readingTime;
    featuredMeta.textContent = meta;
    if (f.tags && f.tags.length) {
      for (var t = 0; t < f.tags.length; t++) {
        featuredTags.appendChild(SM.el('span', { class: 'pill' }, f.tags[t]));
      }
    }
  }

  var startIdx = featuredEl ? 1 : 0;
  for (var i = startIdx; i < posts.length; i++) {
    var p = posts[i];
    var meta = p.date;
    if (p.readingTime) meta += ' · ' + p.readingTime;
    var tags = null;
    if (p.tags && p.tags.length) {
      tags = SM.el('div', { class: 'thought-card-tags' });
      for (var t = 0; t < p.tags.length; t++) {
        tags.appendChild(SM.el('span', { class: 'pill' }, p.tags[t]));
      }
    }
    var card = SM.el('a', { class: 'thought-card', href: SM.url('/thoughts/' + p.slug + '/') },
      SM.el('div', { class: 'thought-card-number' }, '0' + (i + 1)),
      SM.el('div', { class: 'thought-card-body' },
        SM.el('div', { class: 'thought-card-date' }, meta),
        SM.el('div', { class: 'thought-card-title' }, p.title),
        SM.el('div', { class: 'thought-card-excerpt' }, p.excerpt),
        tags
      )
    );
    list.appendChild(card);
  }
});

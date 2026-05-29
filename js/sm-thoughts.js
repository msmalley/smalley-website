SM.getData('thoughts').then(function(posts) {
  var list = document.getElementById('thoughts-list');
  for (var i = 0; i < posts.length; i++) {
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
      SM.el('div', { class: 'thought-card-date' }, meta),
      SM.el('div', { class: 'thought-card-title' }, p.title),
      SM.el('div', { class: 'thought-card-excerpt' }, p.excerpt),
      tags
    );
    list.appendChild(card);
  }
});

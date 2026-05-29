SM.getData('thoughts').then(function(posts) {
  var list = document.getElementById('thoughts-list');
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    var card = SM.el('a', { class: 'thought-card', href: SM.url('/thoughts/' + p.slug + '/') },
      SM.el('div', { class: 'thought-card-date' }, p.date),
      SM.el('div', { class: 'thought-card-title' }, p.title),
      SM.el('div', { class: 'thought-card-excerpt' }, p.excerpt)
    );
    list.appendChild(card);
  }
});

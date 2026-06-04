SM.getData('thoughts').then(function(posts) {
  var list = document.getElementById('thoughts-list');
  var featuredEl = document.getElementById('featured-article');
  var featuredTitle = document.getElementById('featured-title');
  var featuredExcerpt = document.getElementById('featured-excerpt');
  var featuredMeta = document.getElementById('featured-meta');
  var featuredTags = document.getElementById('featured-tags');
  var sidebarTags = document.getElementById('sidebar-tags');

  var allTags = {};
  for (var i = 0; i < posts.length; i++) {
    var tags = posts[i].tags || [];
    for (var t = 0; t < tags.length; t++) {
      allTags[tags[t]] = (allTags[tags[t]] || 0) + 1;
    }
  }
  if (sidebarTags) {
    var sorted = Object.keys(allTags).sort(function(a, b) { return allTags[b] - allTags[a]; });
    for (var i = 0; i < sorted.length; i++) {
      sidebarTags.appendChild(SM.el('a', { class: 'pill', href: SM.url('/explore/?tag=' + encodeURIComponent(sorted[i])) }, sorted[i]));
    }
  }

  if (featuredEl && posts.length > 0) {
    var f = posts[0];
    featuredEl.href = SM.url('/thoughts/' + f.slug + '/');
    featuredTitle.textContent = f.title;
    featuredExcerpt.textContent = f.excerpt;
    var fParts = f.date.split('-');
    var fDateStr = fParts[2] + '.' + fParts[1];
    document.getElementById('featured-number').textContent = fDateStr;
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
    var parts = p.date.split('-');
    var dateShort = parts[2] + '.' + parts[1];
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
      SM.el('div', { class: 'thought-card-date-big' }, dateShort),
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

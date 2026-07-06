SM.getData('thoughts').then(function(allPosts) {
  var posts = allPosts.filter(function(p) { return !p.draft; });
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

  var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  if (featuredEl && posts.length > 0) {
    var f = posts[0];
    featuredEl.href = SM.url('/thoughts/' + f.slug + '/');
    featuredTitle.textContent = f.title;
    featuredExcerpt.textContent = f.excerpt;
    var fParts = f.date.split('-');
    var featNumEl = document.getElementById('featured-number');
    featNumEl.innerHTML = '<span class="date-month">' + months[parseInt(fParts[1], 10) - 1] + '</span><span class="date-year">' + fParts[0] + '</span>';
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
    var meta = p.date;
    if (p.readingTime) meta += ' · ' + p.readingTime;
    var tags = null;
    if (p.tags && p.tags.length) {
      tags = SM.el('div', { class: 'thought-card-tags' });
      for (var t = 0; t < p.tags.length; t++) {
        tags.appendChild(SM.el('span', { class: 'pill' }, p.tags[t]));
      }
    }
    var dateBlock = SM.el('div', { class: 'thought-card-date-big' },
      SM.el('span', { class: 'date-month' }, months[parseInt(parts[1], 10) - 1]),
      SM.el('span', { class: 'date-year' }, parts[0])
    );
    var card = SM.el('a', { class: 'thought-card', href: SM.url('/thoughts/' + p.slug + '/') },
      dateBlock,
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

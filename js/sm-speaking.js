SM.getData('speaking').then(function(talks) {
  var grid = document.getElementById('speaking-grid');
  if (!grid) return;

  var pages = [];
  var seen = {};

  for (var i = 0; i < talks.length; i++) {
    var t = talks[i];
    if (!t.slug) continue;
    if (seen[t.slug]) {
      seen[t.slug].events.push(t.event + ' (' + t.year + ')');
      var existing = seen[t.slug].tags;
      var newTags = t.tags || [];
      for (var j = 0; j < newTags.length; j++) {
        if (existing.indexOf(newTags[j]) === -1) existing.push(newTags[j]);
      }
      continue;
    }
    var entry = {
      slug: t.slug,
      title: t.title,
      event: t.event,
      year: t.year,
      type: t.type,
      description: t.description,
      videoId: t.videoId,
      tags: (t.tags || []).slice(),
      events: [t.event + ' (' + t.year + ')']
    };
    seen[t.slug] = entry;
    pages.push(entry);
  }

  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    var badge = p.type === 'keynote' ? 'keynote' : p.type === 'radio' ? 'radio' : p.events.length > 1 ? p.events.length + ' events' : p.type;

    var pills = SM.el('div', { class: 'speaking-card-tags' });
    for (var t = 0; t < p.tags.length; t++) {
      pills.appendChild(SM.el('a', { class: 'pill', href: SM.url('/explore/?tag=' + encodeURIComponent(p.tags[t])) }, p.tags[t]));
    }

    var card = SM.el('a', { class: 'speaking-card', href: SM.url('/speaking/' + p.slug + '/') },
      SM.el('div', { class: 'speaking-card-badge' }, badge),
      SM.el('div', { class: 'speaking-card-title' }, p.events.length > 1 ? 'Conference Circuit (' + p.events.length + ' events)' : p.title),
      SM.el('div', { class: 'speaking-card-event' }, p.events.length > 1 ? p.events.join(' · ') : p.event + ' · ' + p.year),
      SM.el('div', { class: 'speaking-card-desc' }, p.description),
      pills
    );
    grid.appendChild(card);
  }
});

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
      events: [t.event + ' (' + t.year + ')']
    };
    seen[t.slug] = entry;
    pages.push(entry);
  }

  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    var badge = p.type === 'keynote' ? 'keynote' : p.type === 'radio' ? 'radio' : p.events.length > 1 ? p.events.length + ' events' : p.type;

    var card = SM.el('a', { class: 'speaking-card', href: SM.url('/speaking/' + p.slug + '/') },
      SM.el('div', { class: 'speaking-card-badge' }, badge),
      SM.el('div', { class: 'speaking-card-title' }, p.events.length > 1 ? 'Conference Circuit (' + p.events.length + ' events)' : p.title),
      SM.el('div', { class: 'speaking-card-event' }, p.events.length > 1 ? p.events.join(' · ') : p.event + ' · ' + p.year),
      SM.el('div', { class: 'speaking-card-desc' }, p.description)
    );
    grid.appendChild(card);
  }
});

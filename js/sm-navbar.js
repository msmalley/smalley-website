(function() {
  var nav = document.getElementById('nav-root');
  if (!nav) return;

  var links = [
    { label: 'Portfolio', href: '/portfolio/' },
    { label: 'CVs', href: '/cvs/' },
    { label: 'How I Build', href: '/process/' },
    { label: 'RegTech', href: '/regtech/' },
    { label: 'Speaking', href: '/speaking/' },
    { label: 'Open Source', href: '/open-source/' },
    { label: 'Tools', href: '/tools/' },
    { label: 'Thoughts', href: '/thoughts/' },
    { label: 'Timeline', href: '/timeline/' },
    { label: 'Explore', href: '/explore/' },
  ];

  var currentPath = location.pathname.replace(SM.BASE, '');

  var inner = SM.el('div', { class: 'sm-nav-inner' },
    SM.el('a', { class: 'sm-nav-brand', href: SM.url('/') }, 'Mark Smalley'),
    SM.el('button', { class: 'sm-nav-toggle', 'aria-label': 'Menu', onClick: toggleMenu }, SM.el('span', { class: 'sm-nav-hamburger' }))
  );

  var linkList = SM.el('div', { class: 'sm-nav-links' });
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    var isActive = currentPath.startsWith(l.href) ? ' active' : '';
    linkList.appendChild(SM.el('a', { class: 'sm-nav-link' + isActive, href: SM.url(l.href) }, l.label));
  }
  inner.appendChild(linkList);

  var rssLink = SM.el('a', { class: 'sm-nav-rss', href: SM.url('/feed.xml'), title: 'RSS Feed', 'aria-label': 'RSS Feed', html: '<svg width="16" height="16" viewBox="0 0 448 448" fill="currentColor"><circle cx="80" cy="368" r="80"/><path d="M0 176v80c132.5 0 240 107.5 240 240h80C320 310.8 185.2 176 0 176z"/><path d="M0 0v80c220.9 0 400 179.1 400 400h48C448 215 233 0 0 0z"/></svg>' });
  inner.appendChild(rssLink);

  var navbar = SM.el('nav', { class: 'sm-nav' }, inner);
  nav.appendChild(navbar);

  function toggleMenu() {
    navbar.classList.toggle('open');
  }

  var lastScroll = 0;
  window.addEventListener('scroll', function() {
    var y = window.scrollY;
    if (y > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    lastScroll = y;
  });
})();

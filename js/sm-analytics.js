(function() {
  var GA_ID = 'G-XSS0C0P856';
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);

  function track(event, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, params || {});
    }
  }

  window.SM = window.SM || {};
  window.SM.track = track;

  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link) return;

    var href = link.getAttribute('href') || '';
    var label = link.textContent.trim().slice(0, 80);

    if (link.classList.contains('btn-primary') || link.classList.contains('btn-secondary')) {
      track('cta_click', { label: label, url: href });
    }

    if (href.startsWith('http') && link.target === '_blank') {
      track('outbound_click', { url: href, label: label });
    }

    if (link.closest('.featured-card') || link.closest('.project-card')) {
      track('select_content', { content_type: 'card', item_id: href, label: label });
    }

    if (link.closest('.sm-nav')) {
      track('navigation', { item: label, url: href });
    }

    if (link.closest('.sm-footer')) {
      track('footer_click', { label: label, url: href });
    }

    if (link.closest('.talk-item')) {
      track('select_content', { content_type: 'talk', item_id: href, label: label });
    }

    if (link.closest('.thought-card') || link.closest('.related-card')) {
      track('select_content', { content_type: 'article', item_id: href, label: label });
    }
  });
})();

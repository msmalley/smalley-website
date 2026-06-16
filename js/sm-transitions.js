(function() {
  var body = document.body;
  body.style.opacity = '1';
  body.style.transition = 'opacity 0.15s ease';

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;
    if (a.target === '_blank') return;
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;

    e.preventDefault();
    body.style.opacity = '0';
    setTimeout(function() {
      window.location.href = a.href;
    }, 150);
  });

  window.addEventListener('pageshow', function() {
    body.style.opacity = '1';
  });
})();

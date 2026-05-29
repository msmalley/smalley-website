(function() {
  var observer = new IntersectionObserver(function(entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        entries[i].target.classList.add('revealed');
        observer.unobserve(entries[i].target);
      }
    }
  }, { threshold: 0.1 });

  function observe() {
    var els = document.querySelectorAll('.reveal');
    for (var i = 0; i < els.length; i++) {
      observer.observe(els[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }

  window.SM.observe = observe;
})();

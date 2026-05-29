document.addEventListener('DOMContentLoaded', function() {
  var bg = document.querySelector('.case-hero-bg');
  if (!bg) return;

  var hero = bg.parentElement;
  var speed = 0.6;
  var ticking = false;
  var maxBlur = 8;
  var maxDarken = 0.4;
  var brightBoost = 0.4;

  function update() {
    var scrollY = window.pageYOffset;
    var heroH = hero.offsetHeight;
    var progress = Math.min(scrollY / (heroH * 0.7), 1);

    var blur = maxBlur * (1 - progress);
    var brightness = (1 - maxDarken) + ((maxDarken + brightBoost) * progress);

    bg.style.transform = 'translate3d(0, ' + Math.round(scrollY * speed) + 'px, 0) scale(1.15)';
    bg.style.filter = 'blur(' + blur.toFixed(1) + 'px) brightness(' + brightness.toFixed(2) + ')';

    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  bg.style.transform = 'translate3d(0, 0, 0) scale(1.15)';
  bg.style.filter = 'blur(' + maxBlur + 'px) brightness(' + (1 - maxDarken) + ')';
});

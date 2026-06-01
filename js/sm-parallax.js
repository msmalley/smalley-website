document.addEventListener('DOMContentLoaded', function() {
  var bg = document.querySelector('.case-hero-bg');
  if (!bg) return;

  var eyebrow = document.querySelector('.case-hero-eyebrow[data-accent]');
  if (eyebrow) {
    bg.setAttribute('data-accent', eyebrow.getAttribute('data-accent'));
  }

  var hero = bg.parentElement;
  var ticking = false;

  function update() {
    var scrollY = window.pageYOffset;
    var heroH = hero.offsetHeight;
    var progress = Math.min(scrollY / heroH, 1);

    var x1 = 20 + progress * 40;
    var y1 = 30 + progress * 50;
    var x2 = 80 - progress * 45;
    var y2 = 70 - progress * 55;

    bg.style.transform = 'translate3d(0, ' + Math.round(scrollY * 0.3) + 'px, 0)';
    bg.style.opacity = 1 - (progress * progress);
    bg.style.background =
      'radial-gradient(ellipse 80% 60% at ' + x1 + '% ' + y1 + '%, var(--hero-accent, rgba(99, 102, 241, 0.15)) 0%, transparent 70%), ' +
      'radial-gradient(ellipse 60% 80% at ' + x2 + '% ' + y2 + '%, var(--hero-accent-2, rgba(45, 212, 191, 0.1)) 0%, transparent 70%), ' +
      'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255, 255, 255, 0.02) 0%, transparent 80%)';

    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
});

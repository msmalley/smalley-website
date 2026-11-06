/* ═══════════════════════════════════════════════════════
   SM Audio Samples — play buttons for short audio clips
   ═══════════════════════════════════════════════════════

   Markup:
     <button class="audio-sample" type="button"
             data-audio="../../img/thoughts/x/clip.mp3"
             aria-label="Play: jazz noir lounge"></button>

   One clip plays at a time on a shared Audio element. Pressing
   the playing clip's button pauses it; pressing another switches.
   Nothing is downloaded until a button is pressed.
*/

(function () {
  'use strict';

  var player = new Audio();
  player.preload = 'none';
  var current = null;

  function setState(button, playing) {
    button.classList.toggle('is-playing', playing);
    var label = button.getAttribute('aria-label') || '';
    var name = label.replace(/^(Play|Pause): /, '');
    button.setAttribute('aria-label', (playing ? 'Pause: ' : 'Play: ') + name);
  }

  function stop() {
    if (!current) return;
    setState(current, false);
    current = null;
  }

  player.addEventListener('ended', stop);
  player.addEventListener('pause', function () {
    if (current) setState(current, false);
  });
  player.addEventListener('play', function () {
    if (current) setState(current, true);
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest('.audio-sample');
    if (!button) return;

    if (button === current) {
      if (player.paused) player.play();
      else player.pause();
      return;
    }

    stop();
    current = button;
    player.src = button.getAttribute('data-audio');
    player.play().catch(stop);
  });
})();

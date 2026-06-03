(function() {
  var containers = document.querySelectorAll('[id^="chess-demo"]');
  if (!containers.length) return;

  var VARIANTS = [
    { key: 'atomic', label: 'Atomic Chess', desc: 'Pieces explode on capture, destroying everything in a 3x3 radius' },
    { key: 'fogOfWar', label: 'Fog of War', desc: 'You can only see squares your pieces attack' },
    { key: 'kingOfTheHill', label: 'King of the Hill', desc: 'Get your king to the centre 4 squares to win' },
    { key: 'threeCheck', label: 'Three-Check', desc: 'Check your opponent three times to win' },
    { key: 'antichess', label: 'Antichess', desc: 'Lose all your pieces to win — captures are forced' },
    { key: 'racingKings', label: 'Racing Kings', desc: 'Race your king to rank 8 — no checks allowed' }
  ];

  var THEMES = [
    { key: 'transparent', label: 'Transparent' },
    { key: 'cosmic', label: 'Cosmic Dark' },
    { key: 'classic', label: 'Classic' },
    { key: 'wood', label: 'Wood' },
    { key: 'marble', label: 'Marble' },
    { key: 'neon', label: 'Neon' },
    { key: 'minimal', label: 'Minimal' }
  ];

  var DIFFICULTIES = [
    { key: 'beginner', label: 'Beginner' },
    { key: 'easy', label: 'Easy' },
    { key: 'medium', label: 'Medium' },
    { key: 'hard', label: 'Hard' },
    { key: 'expert', label: 'Expert' }
  ];

  var BASE = location.hostname === 'localhost'
    ? '/MODDABLE/moddable-chess/play/'
    : 'https://chess.moddable.games/play/';

  function getBG() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'F8F9FC' : '0B0F1A';
  }

  containers.forEach(function(container) {
    var currentIdx = 0;
    var currentThemeIdx = 0;
    var iframe = null;

    var controls = document.createElement('div');
    controls.className = 'demo-controls';

    var select = document.createElement('select');
    for (var i = 0; i < VARIANTS.length; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = VARIANTS[i].label;
      select.appendChild(opt);
    }
    select.addEventListener('change', function() {
      currentIdx = parseInt(this.value, 10);
      switchVariant();
    });
    controls.appendChild(select);

    var themeSelect = document.createElement('select');
    for (var i = 0; i < THEMES.length; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = THEMES[i].label;
      themeSelect.appendChild(opt);
    }
    themeSelect.addEventListener('change', function() {
      currentThemeIdx = parseInt(this.value, 10);
      switchTheme();
    });
    controls.appendChild(themeSelect);

    var diffSelect = document.createElement('select');
    for (var i = 0; i < DIFFICULTIES.length; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = DIFFICULTIES[i].label;
      if (DIFFICULTIES[i].key === 'medium') opt.selected = true;
      diffSelect.appendChild(opt);
    }
    diffSelect.addEventListener('change', function() {
      var d = DIFFICULTIES[parseInt(this.value, 10)];
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'chess:setDifficulty', difficulty: d.key }, '*');
      }
    });
    controls.appendChild(diffSelect);

    var newGameBtn = document.createElement('button');
    newGameBtn.textContent = 'New Game';
    newGameBtn.className = 'demo-btn';
    newGameBtn.addEventListener('click', function() {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'chess:newGame' }, '*');
      }
    });
    controls.appendChild(newGameBtn);

    var descEl = document.createElement('span');
    descEl.className = 'demo-caption';
    descEl.style.margin = '0';
    descEl.style.marginLeft = '12px';
    descEl.style.alignSelf = 'center';

    controls.appendChild(descEl);
    container.insertBefore(controls, container.firstChild);

    function buildIframe() {
      var v = VARIANTS[currentIdx];
      var t = THEMES[currentThemeIdx];
      iframe = document.createElement('iframe');
      var bg = getBG();
      iframe.src = BASE + '?variant=' + v.key + '&embed=1&boardonly=1&mode=solo&theme=' + t.key + '&bg=' + bg + '&radius=8px';
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('loading', 'lazy');
      iframe.style.aspectRatio = '1 / 1';
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.display = 'block';
      iframe.style.background = '#' + bg;
      container.appendChild(iframe);
      descEl.textContent = v.desc;
    }

    function switchVariant() {
      var v = VARIANTS[currentIdx];
      descEl.textContent = v.desc;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'chess:setVariant', variant: v.key }, '*');
      }
    }

    function switchTheme() {
      var t = THEMES[currentThemeIdx];
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'chess:setTheme', theme: t.key }, '*');
      }
    }

    buildIframe();

    new MutationObserver(function() {
      var bg = getBG();
      if (iframe) {
        iframe.style.background = '#' + bg;
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'chess:setBg', bg: bg }, '*');
        }
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  });
})();

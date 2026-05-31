(function() {
  var containers = document.querySelectorAll('[id^="hex-demo"]');
  if (!containers.length) return;

  var GAMES = [
    { key: 'nukes', label: 'Nukes', desc: 'Area control — capture territory across volcanic terrain', styles: ['artistic', 'classic', 'kenney', 'realistic'] },
    { key: 'talisman', label: 'Talisman', desc: '5-ring fantasy adventure map', styles: ['artistic', 'classic'] },
    { key: 'twilight', label: 'Twilight', desc: 'Galactic strategy — planetary systems and anomalies', styles: ['artistic', 'classic'] },
    { key: 'colony', label: 'Colony', desc: 'Resource management — settlements, ports, and trade routes', styles: ['classic', 'kenney', 'realistic'] }
  ];

  var BASE = location.hostname === 'localhost'
    ? '/MODDABLE/moddable-hexmaps/generate/'
    : 'https://hex.moddable.games/generate/';

  var BG = '0B0F1A';

  containers.forEach(function(container) {
    var currentGameIdx = 0;
    var currentStyleIdx = 0;
    var iframe = null;

    var controls = document.createElement('div');
    controls.className = 'demo-controls';

    var gameSelect = document.createElement('select');
    for (var i = 0; i < GAMES.length; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = GAMES[i].label;
      gameSelect.appendChild(opt);
    }
    gameSelect.addEventListener('change', function() {
      currentGameIdx = parseInt(this.value, 10);
      currentStyleIdx = 0;
      buildStyleSelect();
      buildIframe();
    });
    controls.appendChild(gameSelect);

    var styleSelect = document.createElement('select');
    styleSelect.addEventListener('change', function() {
      currentStyleIdx = parseInt(this.value, 10);
      var style = GAMES[currentGameIdx].styles[currentStyleIdx];
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'hexmap:setStyle', style: style }, '*');
      }
      updateDesc();
    });
    controls.appendChild(styleSelect);

    var descEl = document.createElement('span');
    descEl.className = 'demo-caption';
    descEl.style.margin = '0';
    descEl.style.marginLeft = '12px';
    descEl.style.alignSelf = 'center';
    controls.appendChild(descEl);

    container.insertBefore(controls, container.firstChild);

    function buildStyleSelect() {
      var game = GAMES[currentGameIdx];
      styleSelect.innerHTML = '';
      for (var i = 0; i < game.styles.length; i++) {
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = game.styles[i].charAt(0).toUpperCase() + game.styles[i].slice(1);
        styleSelect.appendChild(opt);
      }
      styleSelect.value = '0';
    }

    function updateDesc() {
      descEl.textContent = GAMES[currentGameIdx].desc;
    }

    function buildIframe() {
      var game = GAMES[currentGameIdx];
      var style = game.styles[currentStyleIdx];
      var existing = container.querySelector('iframe');
      if (existing) existing.remove();

      iframe = document.createElement('iframe');
      iframe.src = BASE + '?game=' + game.key + '&boardonly=1&size=4&seed=smalley-demo&bg=' + BG + '&style=' + style;
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('loading', 'lazy');
      iframe.className = 'hex-embed';
      iframe.style.aspectRatio = '1 / 1';
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.display = 'block';
      iframe.style.background = '#' + BG;

      container.appendChild(iframe);
      updateDesc();
    }

    buildStyleSelect();
    buildIframe();
  });
})();

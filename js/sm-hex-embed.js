(function() {
  var containers = document.querySelectorAll('[id^="hex-demo"]');
  if (!containers.length) return;

  var GAMES = [
    { key: 'nukes', label: 'Nukes', desc: 'Area control — capture territory across volcanic terrain', styles: ['artistic', 'classic', 'kenney', 'realistic'], sizes: [2, 3, 4, 5, 6], defaultSize: 4 },
    { key: 'talisman', label: 'Talisman', desc: '5-ring fantasy adventure map', styles: ['artistic', 'classic'], sizes: [3, 4, 5], defaultSize: 3 },
    { key: 'twilight', label: 'Twilight', desc: 'Galactic strategy — planetary systems and anomalies', styles: ['artistic', 'classic'], layouts: ['3p', '4p', '5p', '6p', '7p', '8p', '8p-pok'], defaultLayout: '6p' },
    { key: 'colony', label: 'Colony', desc: 'Resource management — settlements, ports, and trade routes', styles: ['classic', 'kenney', 'realistic'], sizes: [3, 4], defaultSize: 3 }
  ];

  var BASE = location.hostname === 'localhost'
    ? '/MODDABLE/moddable-hexmaps/generate/'
    : 'https://hex.moddable.games/generate/';

  function getBG() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'F8F9FC' : '0B0F1A';
  }

  containers.forEach(function(container) {
    var currentGameIdx = 0;
    var currentStyleIdx = 0;
    var currentSize = GAMES[0].defaultSize;
    var currentLayout = null;
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
      var game = GAMES[currentGameIdx];
      currentSize = game.defaultSize || null;
      currentLayout = game.defaultLayout || null;
      buildStyleSelect();
      buildSizeSelect();
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'hexmap:setGame', game: game.key, style: game.styles[0] }, '*');
      }
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

    var sizeSelect = document.createElement('select');
    sizeSelect.addEventListener('change', function() {
      var game = GAMES[currentGameIdx];
      if (game.layouts) {
        currentLayout = this.value;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'hexmap:regenerate', layout: currentLayout }, '*');
        }
      } else {
        currentSize = parseInt(this.value, 10);
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'hexmap:regenerate', size: currentSize }, '*');
        }
      }
    });
    controls.appendChild(sizeSelect);

    var randomBtn = document.createElement('button');
    randomBtn.textContent = 'Randomise';
    randomBtn.className = 'demo-btn';
    randomBtn.addEventListener('click', function() {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'hexmap:regenerate', random: true }, '*');
      }
    });
    controls.appendChild(randomBtn);

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

    function buildSizeSelect() {
      var game = GAMES[currentGameIdx];
      sizeSelect.innerHTML = '';
      if (game.layouts) {
        for (var i = 0; i < game.layouts.length; i++) {
          var opt = document.createElement('option');
          opt.value = game.layouts[i];
          opt.textContent = game.layouts[i].toUpperCase();
          sizeSelect.appendChild(opt);
        }
        sizeSelect.value = game.defaultLayout;
      } else if (game.sizes) {
        for (var i = 0; i < game.sizes.length; i++) {
          var opt = document.createElement('option');
          opt.value = game.sizes[i];
          opt.textContent = game.sizes[i] + ' rings';
          sizeSelect.appendChild(opt);
        }
        sizeSelect.value = game.defaultSize;
      }
    }

    function updateDesc() {
      descEl.textContent = GAMES[currentGameIdx].desc;
    }

    function buildIframe() {
      var game = GAMES[currentGameIdx];
      var style = game.styles[currentStyleIdx];
      var existing = container.querySelector('iframe');
      if (existing) existing.remove();

      var bg = getBG();
      var src = BASE + '?game=' + game.key + '&boardonly=1&mode=edit&bg=' + bg + '&style=' + style + '&random=1';
      if (game.layouts) {
        src += '&layout=' + (currentLayout || game.defaultLayout);
      } else {
        src += '&size=' + (currentSize || game.defaultSize);
      }

      iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('loading', 'lazy');
      iframe.className = 'hex-embed';
      iframe.style.aspectRatio = '1 / 1';
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.display = 'block';
      iframe.style.background = '#' + bg;

      container.appendChild(iframe);
      updateDesc();
    }

    buildStyleSelect();
    buildSizeSelect();
    buildIframe();

    new MutationObserver(function() {
      var bg = getBG();
      if (iframe) {
        iframe.style.background = '#' + bg;
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'hexmap:setBg', bg: bg }, '*');
        }
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  });
})();

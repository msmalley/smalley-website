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

  var BASE = location.hostname === 'localhost'
    ? '/MODDABLE/moddable-chess/play/'
    : 'https://chess.moddable.games/play/';

  var BG = '0B0F1A';

  containers.forEach(function(container) {
    var currentIdx = 0;
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

    var descEl = document.createElement('span');
    descEl.className = 'demo-caption';
    descEl.style.margin = '0';
    descEl.style.marginLeft = '12px';
    descEl.style.alignSelf = 'center';

    controls.appendChild(descEl);
    container.insertBefore(controls, container.firstChild);

    function buildIframe() {
      var v = VARIANTS[currentIdx];
      iframe = document.createElement('iframe');
      iframe.src = BASE + '?variant=' + v.key + '&embed=1&boardonly=1&mode=solo&theme=transparent&bg=' + BG + '&radius=8px';
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('loading', 'lazy');
      iframe.style.aspectRatio = '1 / 1';
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.display = 'block';
      iframe.style.background = '#' + BG;
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

    buildIframe();
  });
})();

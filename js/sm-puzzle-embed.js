(function() {
  var API = 'https://tools.moddable.games/api/call';

  var boardEmbeds = document.querySelectorAll('.chess-board-embed');
  boardEmbeds.forEach(function(container) {
    var variant = container.getAttribute('data-variant') || 'standard';
    var label = container.getAttribute('data-label') || variant;
    var caption = container.getAttribute('data-caption') || '';
    var wrapper = document.createElement('div');
    wrapper.className = 'puzzle-embed';
    var tagEl = document.createElement('div');
    tagEl.className = 'puzzle-embed__meta';
    tagEl.innerHTML = '<span class="puzzle-embed__tag">' + label + '</span><span class="puzzle-embed__tag">paradox</span>';
    var boardEl = document.createElement('div');
    boardEl.className = 'puzzle-embed__board';
    boardEl.innerHTML = '<div class="puzzle-embed__loading">Loading board...</div>';
    var captionEl = document.createElement('div');
    captionEl.className = 'puzzle-embed__caption';
    captionEl.textContent = caption;
    wrapper.appendChild(tagEl);
    wrapper.appendChild(boardEl);
    wrapper.appendChild(captionEl);
    container.appendChild(wrapper);

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'chess_generate_puzzle', args: { variant: variant, include_svg: false } })
    }).then(function(r) { return r.json(); }).then(function(json) {
      var p = json.result || json;
      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'chess_render_svg', args: { variant: variant, fen: p.fen, theme: 'classic' } })
      }).then(function(r2) { return r2.json(); }).then(function(svgJson) {
        boardEl.innerHTML = (svgJson.result || svgJson).svg || '<div class="puzzle-embed__error">Could not render board</div>';
      });
    }).catch(function() {
      boardEl.innerHTML = '<div class="puzzle-embed__error">Could not load board</div>';
    });
  });

  var containers = document.querySelectorAll('.chess-puzzle-embed');
  if (!containers.length) return;

  containers.forEach(function(container) {
    var variant = container.getAttribute('data-variant');
    var caption = container.getAttribute('data-caption') || 'Find the winning move.';

    var wrapper = document.createElement('div');
    wrapper.className = 'puzzle-embed';

    var boardEl = document.createElement('div');
    boardEl.className = 'puzzle-embed__board';
    boardEl.innerHTML = '<div class="puzzle-embed__loading">Loading puzzle...</div>';

    var metaEl = document.createElement('div');
    metaEl.className = 'puzzle-embed__meta';

    var captionEl = document.createElement('div');
    captionEl.className = 'puzzle-embed__caption';
    captionEl.textContent = caption;

    var controls = document.createElement('div');
    controls.className = 'puzzle-embed__controls';

    wrapper.appendChild(metaEl);
    wrapper.appendChild(boardEl);
    wrapper.appendChild(captionEl);
    wrapper.appendChild(controls);
    container.appendChild(wrapper);

    function loadPuzzle() {
      boardEl.innerHTML = '<div class="puzzle-embed__loading">Loading puzzle...</div>';
      metaEl.innerHTML = '';
      controls.innerHTML = '';

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'chess_generate_puzzle', args: { variant: variant, include_svg: false } })
      })
      .then(function(r) { return r.json(); })
      .then(function(json) {
        var p = json.result || json;
        return fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'chess_render_svg', args: { variant: variant, fen: p.fen, theme: 'classic' } })
        }).then(function(r2) { return r2.json(); }).then(function(svgJson) {
          p.svg = (svgJson.result || svgJson).svg;
          return p;
        });
      })
      .then(function(p) {
        boardEl.innerHTML = p.svg || '<div class="puzzle-embed__error">No board available</div>';

        var tags = [];
        if (p.variant) tags.push(p.variant);
        if (p.type) tags.push(p.type);
        if (p.rating) tags.push('Rating: ' + p.rating);
        metaEl.innerHTML = tags.map(function(t) {
          return '<span class="puzzle-embed__tag">' + t + '</span>';
        }).join('');

        var solBtn = document.createElement('button');
        solBtn.className = 'puzzle-embed__btn puzzle-embed__btn--outline';
        solBtn.textContent = 'Show solution';
        solBtn.addEventListener('click', function() {
          var sol = Array.isArray(p.solution) ? p.solution : [p.solution || ''];
          var moveStr = sol[0] || '';
          var highlights = [];
          if (moveStr.length >= 4) highlights = [moveStr.slice(0, 2), moveStr.slice(2, 4)];

          fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'chess_render_svg', args: { variant: variant, fen: p.fen, theme: 'classic', highlights: highlights } })
          }).then(function(r) { return r.json(); }).then(function(svgJson) {
            var svg = (svgJson.result || svgJson).svg;
            if (svg) boardEl.innerHTML = svg;
          });

          var solText = sol.join(' → ');
          solBtn.replaceWith(Object.assign(document.createElement('span'), {
            className: 'puzzle-embed__solution',
            textContent: solText
          }));
        });

        var newBtn = document.createElement('button');
        newBtn.className = 'puzzle-embed__btn puzzle-embed__btn--primary';
        newBtn.textContent = 'New puzzle';
        newBtn.addEventListener('click', loadPuzzle);

        controls.innerHTML = '';
        controls.appendChild(solBtn);
        controls.appendChild(newBtn);
      })
      .catch(function() {
        boardEl.innerHTML = '<div class="puzzle-embed__error">Could not load puzzle. Try again.</div>';
        var retry = document.createElement('button');
        retry.className = 'puzzle-embed__btn puzzle-embed__btn--primary';
        retry.textContent = 'Retry';
        retry.addEventListener('click', loadPuzzle);
        controls.innerHTML = '';
        controls.appendChild(retry);
      });
    }

    loadPuzzle();
  });
})();

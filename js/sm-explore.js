document.addEventListener('DOMContentLoaded', function() {
  var items = [];
  var allTags = {};
  var activeTags = [];
  var searchTerm = '';

  var grid = document.getElementById('explore-grid');
  var tagsContainer = document.getElementById('explore-tags');
  var searchInput = document.getElementById('explore-search');
  var emptyMsg = document.getElementById('explore-empty');

  var params = new URLSearchParams(window.location.search);
  var preselected = params.getAll('tag');
  for (var i = 0; i < preselected.length; i++) {
    if (preselected[i] && activeTags.indexOf(preselected[i]) === -1) {
      activeTags.push(preselected[i]);
    }
  }

  Promise.all([
    SM.getData('portfolio'),
    SM.getData('opensource'),
    SM.getData('speaking')
  ]).then(function(results) {
    var portfolio = results[0];
    var opensource = results[1];
    var speaking = results[2];

    for (var i = 0; i < portfolio.length; i++) {
      var p = portfolio[i];
      items.push({
        title: p.title,
        desc: p.summary || p.tagline,
        tags: p.tech || [],
        type: 'Portfolio',
        accent: p.accent,
        url: SM.url('/portfolio/' + p.slug + '/')
      });
      addTags(p.tech);
    }

    for (var i = 0; i < opensource.length; i++) {
      var o = opensource[i];
      items.push({
        title: o.title,
        desc: o.description,
        tags: o.tech || [],
        type: 'Open Source',
        accent: o.accent || 'teal',
        url: o.slug ? SM.url('/open-source/' + o.slug + '/') : null
      });
      addTags(o.tech);
    }

    for (var i = 0; i < speaking.length; i++) {
      var s = speaking[i];
      items.push({
        title: s.title,
        desc: s.description,
        tags: s.tags || [],
        type: 'Speaking',
        accent: 'gold',
        url: s.slug ? SM.url('/speaking/' + s.slug + '/') : null
      });
      addTags(s.tags);
    }

    renderTags();
    render();
  });

  function addTags(arr) {
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      allTags[arr[i]] = (allTags[arr[i]] || 0) + 1;
    }
  }

  function renderTags() {
    var sorted = Object.keys(allTags).sort(function(a, b) {
      return allTags[b] - allTags[a];
    });
    tagsContainer.innerHTML = '';
    for (var i = 0; i < sorted.length; i++) {
      var tag = sorted[i];
      var el = document.createElement('span');
      el.className = 'explore-tag' + (activeTags.indexOf(tag) > -1 ? ' active' : '');
      el.textContent = tag;
      el.setAttribute('data-tag', tag);
      el.addEventListener('click', toggleTag);
      tagsContainer.appendChild(el);
    }
  }

  function toggleTag(e) {
    var tag = e.target.getAttribute('data-tag');
    var idx = activeTags.indexOf(tag);
    if (idx > -1) {
      activeTags.splice(idx, 1);
      e.target.classList.remove('active');
    } else {
      activeTags.push(tag);
      e.target.classList.add('active');
    }
    updateURL();
    render();
  }

  searchInput.addEventListener('input', function() {
    searchTerm = this.value.toLowerCase();
    if (searchTerm) {
      activeTags = [];
      var tagEls = tagsContainer.querySelectorAll('.explore-tag');
      for (var i = 0; i < tagEls.length; i++) {
        tagEls[i].classList.remove('active');
      }
      updateURL();
    }
    render();
  });

  function updateURL() {
    var url = new URL(window.location);
    url.searchParams.delete('tag');
    for (var i = 0; i < activeTags.length; i++) {
      url.searchParams.append('tag', activeTags[i]);
    }
    history.replaceState(null, '', url.toString());
  }

  function highlight(text, term) {
    if (!term) return text;
    var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
  }

  function render() {
    grid.innerHTML = '';
    var count = 0;
    var cards = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (activeTags.length > 0) {
        var match = false;
        for (var t = 0; t < activeTags.length; t++) {
          if (item.tags.indexOf(activeTags[t]) > -1) { match = true; break; }
        }
        if (!match) continue;
      }

      if (searchTerm) {
        var haystack = (item.title + ' ' + item.desc + ' ' + item.tags.join(' ')).toLowerCase();
        if (haystack.indexOf(searchTerm) === -1) continue;
      }

      cards.push(item);
      count++;
    }

    var cols = 3;
    var gridWidth = grid.offsetWidth;
    if (gridWidth < 640) cols = 1;
    else if (gridWidth < 960) cols = 2;

    var remainder = cols > 1 ? (count % cols) : 0;

    for (var i = 0; i < cards.length; i++) {
      var item = cards[i];

      var tagPills = '';
      for (var t = 0; t < item.tags.length; t++) {
        tagPills += '<span class="pill">' + item.tags[t] + '</span>';
      }

      var title = searchTerm ? highlight(item.title, searchTerm) : item.title;
      var desc = searchTerm ? highlight(item.desc || '', searchTerm) : (item.desc || '');

      var card = document.createElement(item.url ? 'a' : 'div');
      card.className = 'explore-card';
      if (item.url) card.href = item.url;

      if (remainder === 1 && i === cards.length - 1) {
        card.style.gridColumn = 'span ' + cols;
      } else if (remainder === 2 && cols === 3 && i === cards.length - 2) {
        card.style.gridColumn = 'span 2';
      }

      card.innerHTML =
        '<div class="explore-card-type" data-accent="' + item.accent + '">' + item.type + '</div>' +
        '<div class="explore-card-title">' + title + '</div>' +
        '<div class="explore-card-desc">' + desc + '</div>' +
        '<div class="explore-card-tags">' + tagPills + '</div>';

      grid.appendChild(card);
    }

    emptyMsg.className = 'explore-empty' + (count === 0 ? ' visible' : '');
  }
});

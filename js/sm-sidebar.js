(function() {
  var content = document.querySelector('.case-content');
  var article = document.querySelector('.article-content');

  if (content) buildCaseSidebar(content);
  if (article) buildArticleSidebar(article);

  function buildCaseSidebar(content) {
    var container = content.parentElement;
    var tech = content.querySelector('.case-tech');
    var links = content.querySelector('.case-links');
    var outcome = content.querySelector('.case-outcome');

    if (!tech && !links && !outcome) return;

    var sidebar = document.createElement('aside');
    sidebar.className = 'case-sidebar';

    if (outcome) {
      var sec = document.createElement('div');
      sec.className = 'case-sidebar-section';
      sec.appendChild(outcome);
      sidebar.appendChild(sec);
    }

    if (tech) {
      var secT = document.createElement('div');
      secT.className = 'case-sidebar-section';
      var label = document.createElement('div');
      label.className = 'case-sidebar-label';
      label.textContent = 'Technologies';
      secT.appendChild(label);
      secT.appendChild(tech);
      sidebar.appendChild(secT);
    }

    if (links) {
      var secL = document.createElement('div');
      secL.className = 'case-sidebar-section';
      var labelL = document.createElement('div');
      labelL.className = 'case-sidebar-label';
      labelL.textContent = 'Links';
      secL.appendChild(labelL);
      secL.appendChild(links);
      sidebar.appendChild(secL);
    }

    container.appendChild(sidebar);
  }

  function buildArticleSidebar(article) {
    var container = article.parentElement;
    var tags = article.querySelector('.article-tags');
    var related = article.querySelector('.related-writing');

    if (!tags) return;

    container.classList.add('article-layout');

    var sidebar = document.createElement('aside');
    sidebar.className = 'article-sidebar';

    if (tags) {
      var secT = document.createElement('div');
      secT.className = 'article-sidebar-section';
      var label = document.createElement('div');
      label.className = 'article-sidebar-label';
      label.textContent = 'Topics';
      secT.appendChild(label);
      secT.appendChild(tags);
      sidebar.appendChild(secT);
    }

    var shareSection = buildShareButtons();
    if (shareSection) sidebar.appendChild(shareSection);

    if (related) {
      sidebar.appendChild(related);
    }

    container.appendChild(sidebar);
  }

  function buildShareButtons() {
    var pageUrl = encodeURIComponent(window.location.href);
    var pageTitle = encodeURIComponent(document.title);
    var shares = [
      { label: 'X', icon: '𝕏', href: 'https://x.com/intent/tweet?url=' + pageUrl + '&text=' + pageTitle },
      { label: 'Facebook', icon: 'f', href: 'https://www.facebook.com/sharer/sharer.php?u=' + pageUrl },
      { label: 'LinkedIn', icon: 'in', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + pageUrl },
      { label: 'Copy', icon: '⎘', action: 'copy' }
    ];

    var sec = document.createElement('div');
    sec.className = 'article-sidebar-section';
    var label = document.createElement('div');
    label.className = 'article-sidebar-label';
    label.textContent = 'Share';
    sec.appendChild(label);

    var btns = document.createElement('div');
    btns.className = 'share-btns';

    for (var i = 0; i < shares.length; i++) {
      var s = shares[i];
      if (s.action === 'copy') {
        var b = document.createElement('button');
        b.className = 'share-btn';
        b.setAttribute('aria-label', 'Copy link');
        b.setAttribute('title', 'Copy link');
        b.textContent = s.icon;
        (function(btn, icon) {
          btn.addEventListener('click', function() {
            navigator.clipboard.writeText(window.location.href).then(function() {
              btn.textContent = '✓';
              setTimeout(function() { btn.textContent = icon; }, 2000);
            });
          });
        })(b, s.icon);
        btns.appendChild(b);
      } else {
        var a = document.createElement('a');
        a.className = 'share-btn';
        a.href = s.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.setAttribute('aria-label', 'Share on ' + s.label);
        a.setAttribute('title', 'Share on ' + s.label);
        a.textContent = s.icon;
        btns.appendChild(a);
      }
    }

    sec.appendChild(btns);
    return sec;
  }
})();

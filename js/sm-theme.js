(function() {
  var STORAGE_KEY = 'sm-theme';
  var root = document.documentElement;

  var lightTokens = {
    '--sm-deep': '#F8F9FC',
    '--sm-surface': '#FFFFFF',
    '--sm-surface-alt': '#F0F1F5',
    '--sm-border': 'rgba(0,0,0,0.08)',
    '--sm-border-hover': 'rgba(0,0,0,0.16)',
    '--sm-text': '#1A1D2B',
    '--sm-muted': '#5A6070',
    '--sm-faint': '#9CA3B4',
    '--sm-teal': '#0E7490',
    '--sm-teal-glow': '#0891B2',
    '--sm-gold': '#9A6F2E',
    '--sm-gold-glow': '#D97706',
    '--sm-violet': '#6D28D9',
    '--sm-violet-glow': '#7C3AED',
    '--sm-link': '#2563EB',
    '--sm-success': '#059669'
  };

  var darkTokens = {
    '--sm-deep': '#0B0F1A',
    '--sm-surface': '#141824',
    '--sm-surface-alt': '#1C2235',
    '--sm-border': 'rgba(255,255,255,0.08)',
    '--sm-border-hover': 'rgba(255,255,255,0.16)',
    '--sm-text': '#F0F2F5',
    '--sm-muted': '#8B92A5',
    '--sm-faint': '#4A5168',
    '--sm-teal': '#0E7490',
    '--sm-teal-glow': '#22D3EE',
    '--sm-gold': '#9A6F2E',
    '--sm-gold-glow': '#F59E0B',
    '--sm-violet': '#6D28D9',
    '--sm-violet-glow': '#A78BFA',
    '--sm-link': '#6FB5FF',
    '--sm-success': '#34D399'
  };

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function applyTheme(theme, animate) {
    var tokens = theme === 'light' ? lightTokens : darkTokens;

    if (animate) {
      root.style.transition = 'background-color 0.5s ease, color 0.4s ease';
      document.body.style.transition = 'background-color 0.5s ease, color 0.4s ease';
      var cards = document.querySelectorAll('.card, .sm-nav, .sm-footer, .cta-box, .number-card, .live-stat, .credential-card, .demo-embed, .thought-card, .related-card, .evidence-link');
      for (var i = 0; i < cards.length; i++) {
        cards[i].style.transition = 'background-color 0.5s ease, border-color 0.5s ease, color 0.4s ease, box-shadow 0.5s ease';
      }
      setTimeout(function() {
        root.style.transition = '';
        document.body.style.transition = '';
        for (var i = 0; i < cards.length; i++) {
          cards[i].style.transition = '';
        }
      }, 600);
    }

    for (var key in tokens) {
      root.style.setProperty(key, tokens[key]);
    }

    root.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);

    var btn = document.querySelector('.sm-theme-toggle');
    if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function createToggle() {
    var nav = document.querySelector('.sm-nav-inner');
    if (!nav) return;

    var btn = document.createElement('button');
    btn.className = 'sm-theme-toggle';
    btn.setAttribute('aria-label', 'Switch theme');
    btn.innerHTML = '<svg class="sm-theme-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg><svg class="sm-theme-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';

    btn.addEventListener('click', function() {
      var current = getTheme();
      var next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });

    var rss = nav.querySelector('.sm-nav-rss');
    if (rss) {
      nav.insertBefore(btn, rss);
    } else {
      nav.appendChild(btn);
    }
  }

  applyTheme(getTheme(), false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createToggle);
  } else {
    createToggle();
  }
})();

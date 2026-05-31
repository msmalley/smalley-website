(function() {
  var root = document.getElementById('footer-root');
  if (!root) return;

  var footer = SM.el('footer', { class: 'sm-footer' },
    SM.el('div', { class: 'sm-footer-inner' },
      SM.el('div', { class: 'sm-footer-col' },
        SM.el('div', { class: 'sm-footer-label' }, 'Contact'),
        SM.el('a', { href: 'mailto:mark@smalley.my' }, 'mark@smalley.my'),
        SM.el('span', null, '+44 (0) 7526 860 262')
      ),
      SM.el('div', { class: 'sm-footer-col' },
        SM.el('div', { class: 'sm-footer-label' }, 'Links'),
        SM.el('a', { href: 'https://github.com/msmalley', target: '_blank', rel: 'noopener' }, 'GitHub'),
        SM.el('a', { href: 'https://linkedin.com/in/msmalley', target: '_blank', rel: 'noopener' }, 'LinkedIn'),
        SM.el('a', { href: 'https://x.com/m_smalley', target: '_blank', rel: 'noopener' }, 'X / Twitter')
      ),
      SM.el('div', { class: 'sm-footer-col' },
        SM.el('div', { class: 'sm-footer-label' }, 'Projects'),
        SM.el('a', { href: 'https://moddable.games', target: '_blank', rel: 'noopener' }, 'Games'),
        SM.el('a', { href: 'https://chess.moddable.games', target: '_blank', rel: 'noopener' }, 'Chess'),
        SM.el('a', { href: 'https://hex.moddable.games', target: '_blank', rel: 'noopener' }, 'Maps')
      ),
      SM.el('div', { class: 'sm-footer-col' },
        SM.el('div', { class: 'sm-footer-label' }, 'Hiring?'),
        SM.el('a', { href: SM.url('/process/') }, 'CTO'),
        SM.el('a', { href: SM.url('/regtech/') }, 'RegTech'),
        SM.el('a', { href: SM.url('/speaking/') }, 'DevRel')
      )
    ),
    SM.el('div', { class: 'sm-footer-bottom' },
      SM.el('span', null, 'v' + SM.VERSION),
      SM.el('span', { class: 'sm-footer-copy' }, 'Mark Smalley')
    )
  );

  root.appendChild(footer);
})();

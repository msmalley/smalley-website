SM.getData('portfolio').then(function(projects) {
  var currentSlugs = ['ordzaar', 'sado-protocol', 'oviato', 'project-eden', 'moddable'];
  var currentGrid = document.getElementById('portfolio-current-grid');
  var institutionalGrid = document.getElementById('portfolio-institutional-grid');
  if (!currentGrid || !institutionalGrid) return;

  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    var isCurrent = currentSlugs.indexOf(p.slug) !== -1;
    var target = isCurrent ? currentGrid : institutionalGrid;

    var card = SM.el('a', { class: 'project-card reveal', href: SM.url('/portfolio/' + p.slug + '/') },
      SM.el('div', { class: 'card' },
        SM.el('div', { class: 'project-card-eyebrow', 'data-accent': p.accent }, p.company + ' · ' + p.year),
        SM.el('div', { class: 'project-card-title' }, p.title),
        SM.el('div', { class: 'project-card-role' }, p.role),
        SM.el('div', { class: 'project-card-desc' }, p.summary),
        SM.el('div', { class: 'project-card-outcome' }, p.outcome)
      )
    );
    target.appendChild(card);
  }

  fillLastRow2Col(currentGrid);
  fillLastRow2Col(institutionalGrid);
  SM.observe();
});

function fillLastRow2Col(grid) {
  var cols = grid.offsetWidth < 768 ? 1 : 2;
  var cards = grid.querySelectorAll('.project-card');
  if (cols === 2 && cards.length % 2 === 1) {
    cards[cards.length - 1].style.gridColumn = 'span 2';
  }
}

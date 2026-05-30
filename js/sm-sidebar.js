(function() {
  var content = document.querySelector('.case-content');
  if (!content) return;
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
})();

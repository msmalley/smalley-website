function switchCV(id) {
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('[data-cv="' + id + '"]').classList.add('active');
  document.querySelectorAll('.viewport iframe').forEach(function(f) { f.classList.remove('active'); });
  document.getElementById('frame-' + id).classList.add('active');
}

function printCV() {
  var active = document.querySelector('.viewport iframe.active');
  if (active) active.contentWindow.print();
}

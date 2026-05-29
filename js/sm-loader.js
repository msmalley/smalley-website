(function() {
  var V = '1.0.8';
  var scripts = document.querySelectorAll('script[src*="sm-loader.js"]');
  var src = scripts[scripts.length - 1].getAttribute('src');
  var base = src.replace(/sm-loader\.js.*$/, '');
  var cssBase = base.replace(/js\/$/, 'css/');
  var styles = ['navbar.css', 'footer.css'];
  for (var s = 0; s < styles.length; s++) {
    document.write('<link rel="stylesheet" href="' + cssBase + styles[s] + '?v=' + V + '">');
  }
  var modules = [
    'sm-core.js',
    'sm-navbar.js',
    'sm-footer.js',
    'sm-animations.js',
    'sm-parallax.js'
  ];
  for (var i = 0; i < modules.length; i++) {
    document.write('<script src="' + base + modules[i] + '?v=' + V + '"><\/script>');
  }
})();

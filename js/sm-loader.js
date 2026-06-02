(function() {
  var V = '1.0.23';
  var scripts = document.querySelectorAll('script[src*="sm-loader.js"]');
  var src = scripts[scripts.length - 1].getAttribute('src');
  var base = src.replace(/sm-loader\.js.*$/, '');
  var cssBase = base.replace(/js\/$/, 'css/');
  var rootBase = cssBase.replace(/css\/$/, '');
  document.write('<link rel="alternate" type="application/rss+xml" title="Mark Smalley — Thoughts" href="' + rootBase + 'feed.xml">');
  var styles = ['navbar.css', 'footer.css'];
  for (var s = 0; s < styles.length; s++) {
    document.write('<link rel="stylesheet" href="' + cssBase + styles[s] + '?v=' + V + '">');
  }
  var modules = [
    'sm-core.js',
    'sm-theme.js',
    'sm-navbar.js',
    'sm-footer.js',
    'sm-animations.js',
    'sm-parallax.js',
    'sm-related.js',
    'sm-sidebar.js',
    'sm-codeblocks.js'
  ];
  for (var i = 0; i < modules.length; i++) {
    document.write('<script src="' + base + modules[i] + '?v=' + V + '"><\/script>');
  }
})();

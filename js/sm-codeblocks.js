(function() {
  var blocks = document.querySelectorAll('.article-content pre, .case-content pre');
  if (!blocks.length) return;

  var base = document.querySelector('script[src*="sm-loader.js"]');
  var jsBase = base ? base.getAttribute('src').replace(/sm-loader\.js.*$/, '') : '';
  var cssBase = jsBase.replace(/js\/$/, 'css/');

  var v = (window.SM && SM.VERSION) ? SM.VERSION : '1';
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssBase + 'prism-smalley.css?v=' + v;
  document.head.appendChild(link);

  var script = document.createElement('script');
  script.src = jsBase + 'vendor/prism.min.js';
  script.onload = function() {
    for (var i = 0; i < blocks.length; i++) {
      var code = blocks[i].querySelector('code');
      if (code && !code.className) {
        code.className = 'language-javascript';
      }
      if (code) Prism.highlightElement(code);
    }
  };
  document.body.appendChild(script);

  for (var i = 0; i < blocks.length; i++) {
    var pre = blocks[i];
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', (function(el) {
      return function(e) {
        var b = e.currentTarget;
        var code = el.querySelector('code');
        var text = code ? code.textContent : el.textContent;
        navigator.clipboard.writeText(text).then(function() {
          b.textContent = 'Copied';
          b.classList.add('copied');
          setTimeout(function() {
            b.textContent = 'Copy';
            b.classList.remove('copied');
          }, 2000);
        });
      };
    })(pre));
    pre.appendChild(btn);
  }
})();

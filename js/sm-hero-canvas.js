(function() {
  function init() {
    var heroSection = document.querySelector('.hero');
    var heroBg = document.querySelector('.hero-bg');
    if (!heroSection || !heroBg) return;

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    heroBg.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var hexSize = 28;
    var nodes = [];
    var mouse = { x: -1000, y: -1000 };
    var raf = null;

    function resize() {
      canvas.width = heroSection.offsetWidth;
      canvas.height = heroSection.offsetHeight;
      nodes = [];

      var w = Math.sqrt(3) * hexSize;
      var h = hexSize * 1.5;
      var cols = Math.ceil(canvas.width / w) + 2;
      var rows = Math.ceil(canvas.height / h) + 2;

      for (var r = -1; r < rows; r++) {
        for (var c = -1; c < cols; c++) {
          var x = c * w + (r % 2 === 0 ? 0 : w * 0.5);
          var y = r * h;
          nodes.push({ x: x, y: y, baseX: x, baseY: y, vx: 0, vy: 0 });
        }
      }
    }

    function hexPath(cx, cy, size) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var angle = Math.PI / 3 * i - Math.PI / 6;
        var hx = cx + size * Math.cos(angle);
        var hy = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var dx = mouse.x - n.x;
        var dy = mouse.y - n.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 300) {
          var force = (1 - dist / 300) * 40;
          n.vx -= (dx / dist) * force * 0.04;
          n.vy -= (dy / dist) * force * 0.04;
        }

        n.vx += (n.baseX - n.x) * 0.04;
        n.vy += (n.baseY - n.y) * 0.04;
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;
      }

      ctx.strokeStyle = 'rgba(14, 116, 144, 0.1)';
      ctx.lineWidth = 0.5;

      for (var i = 0; i < nodes.length; i++) {
        hexPath(nodes[i].x, nodes[i].y, hexSize * 0.9);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(34, 211, 238, 0.2)';
      for (var i = 0; i < nodes.length; i++) {
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    heroSection.addEventListener('mousemove', function(e) {
      var rect = heroSection.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    heroSection.addEventListener('mouseleave', function() {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    resize();
    draw();

    window.addEventListener('resize', resize);

    var scrollObs = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        if (!raf) draw();
      } else {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
      }
    });
    scrollObs.observe(heroSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

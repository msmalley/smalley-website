(function() {
  function init() {
    var heroSection = document.querySelector('.hero');
    var heroBg = document.querySelector('.hero-bg');
    if (!heroSection || !heroBg) return;

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    heroBg.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var cellSize = 52;
    var cols, rows, nodes = [];
    var mouse = { x: -1000, y: -1000 };
    var raf = null;

    function resize() {
      canvas.width = heroSection.offsetWidth;
      canvas.height = heroSection.offsetHeight;
      cols = Math.ceil(canvas.width / cellSize) + 1;
      rows = Math.ceil(canvas.height / cellSize) + 1;
      nodes = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          nodes.push({
            x: c * cellSize,
            y: r * cellSize,
            baseX: c * cellSize,
            baseY: r * cellSize,
            vx: 0,
            vy: 0
          });
        }
      }
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

      ctx.strokeStyle = 'rgba(14, 116, 144, 0.25)';
      ctx.lineWidth = 0.5;

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var idx = r * cols + c;
          var n = nodes[idx];

          if (c < cols - 1) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(nodes[idx + 1].x, nodes[idx + 1].y);
            ctx.stroke();
          }
          if (r < rows - 1) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(nodes[idx + cols].x, nodes[idx + cols].y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
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

(function() {
  var hero = document.querySelector('.hero-bg');
  if (!hero) return;

  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0.4;';
  hero.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var cols, rows, cellSize = 48;
  var nodes = [];
  var mouse = { x: -1000, y: -1000 };
  var raf;

  function resize() {
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
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
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.15)';
    ctx.lineWidth = 0.5;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var dx = mouse.x - n.x;
      var dy = mouse.y - n.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var maxDist = 200;

      if (dist < maxDist) {
        var force = (1 - dist / maxDist) * 8;
        n.vx -= (dx / dist) * force * 0.02;
        n.vy -= (dy / dist) * force * 0.02;
      }

      n.vx += (n.baseX - n.x) * 0.03;
      n.vy += (n.baseY - n.y) * 0.03;
      n.vx *= 0.9;
      n.vy *= 0.9;
      n.x += n.vx;
      n.y += n.vy;
    }

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var idx = r * cols + c;
        var n = nodes[idx];

        if (c < cols - 1) {
          var right = nodes[idx + 1];
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(right.x, right.y);
          ctx.stroke();
        }
        if (r < rows - 1) {
          var below = nodes[idx + cols];
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(below.x, below.y);
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(34, 211, 238, 0.2)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    raf = requestAnimationFrame(draw);
  }

  hero.addEventListener('mousemove', function(e) {
    var rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  hero.addEventListener('mouseleave', function() {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  resize();
  draw();

  window.addEventListener('resize', function() {
    resize();
  });

  var scrollObs = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) {
      if (!raf) draw();
    } else {
      cancelAnimationFrame(raf);
      raf = null;
    }
  });
  scrollObs.observe(hero.parentElement);
})();

// gemini-lines.js — self-running "data flow" animation for the Gemini-style lines.
// The colored lines stay fully drawn; a bright pulse travels along each one, left to
// right, continuously (no scroll needed). Pauses when offscreen or the tab is hidden.
// window.initGeminiLines(section) -> void
(function () {
  window.initGeminiLines = function (section) {
    if (!section) return;
    var lines = section.querySelectorAll('path.ggl-line');
    if (!lines.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // make the base lines solid + fully visible, and add a traveling pulse over each
    var pulses = [];
    Array.prototype.forEach.call(lines, function (p) {
      var L = p.getTotalLength();
      p.style.strokeDasharray = 'none';
      p.style.strokeDashoffset = '0';

      var q = p.cloneNode(false);
      q.setAttribute('class', 'ggl-pulse');
      var seg = Math.max(70, L * 0.14);              // length of the bright travelling segment
      q.style.strokeDasharray = seg + ' ' + (L + seg);
      q.style.strokeDashoffset = seg;                // start just off the left edge
      var col = p.getAttribute('stroke') || '#7CFFB0';
      q.setAttribute('stroke-width', '3.6');
      q.style.filter = 'drop-shadow(0 0 5px ' + col + ')';
      p.parentNode.insertBefore(q, p.nextSibling);
      pulses.push({ el: q, L: L, seg: seg });
    });

    // ---- align the side labels to the lines ----
    var svg = section.querySelector('svg.ggl-svg');
    var sticky = section.querySelector('.ggl-sticky') || section;
    function positionLabels() {
      if (!svg) return;
      var ctm = svg.getScreenCTM();
      if (!ctm) return;
      var srect = sticky.getBoundingClientRect();
      function screenY(vy) {
        var pt = svg.createSVGPoint(); pt.x = 0; pt.y = vy;
        return pt.matrixTransform(ctm).y - srect.top;
      }
      var startYs = [], endYs = [];
      Array.prototype.forEach.call(lines, function (p) {
        startYs.push(p.getPointAtLength(0).y);
        endYs.push(p.getPointAtLength(p.getTotalLength()).y);
      });
      startYs.sort(function (a, b) { return a - b; });
      endYs.sort(function (a, b) { return a - b; });
      // left: one label per line, top to bottom
      var ls = section.querySelectorAll('.ggl-io-l span');
      for (var i = 0; i < ls.length && i < startYs.length; i++) ls[i].style.top = screenY(startYs[i]) + 'px';
      // right: between the top pair / the middle / the bottom pair
      var n = endYs.length;
      var rY = [(endYs[0] + endYs[1]) / 2, (endYs[0] + endYs[n - 1]) / 2, (endYs[n - 2] + endYs[n - 1]) / 2];
      var rs = section.querySelectorAll('.ggl-io-r span');
      for (var j = 0; j < rs.length && j < rY.length; j++) rs[j].style.top = screenY(rY[j]) + 'px';
      // center the logo container on the middle of the line spread (the gap centre)
      var badge = section.querySelector('.ggl-badge');
      if (badge && startYs.length) badge.style.top = screenY((startYs[0] + startYs[startYs.length - 1]) / 2) + 'px';
    }
    positionLabels();
    setTimeout(positionLabels, 120);
    window.addEventListener('load', positionLabels);
    window.addEventListener('resize', positionLabels);

    if (reduce) return;   // static solid lines, no motion

    var starts = [0, 0.2, 0.4, 0.6, 0.8];            // stagger each line's pulse
    var DUR = 3800;                                  // ms for one edge-to-edge pass
    var raf = null, running = false, visible = false, t0 = null;

    function frame(now) {
      if (!running) return;
      if (t0 == null) t0 = now;
      var base = (now - t0) / DUR;
      for (var i = 0; i < pulses.length; i++) {
        var ph = (((base + (starts[i] || 0)) % 1) + 1) % 1;   // 0..1
        var pl = pulses[i];
        // offset seg (off-left) -> -(L) (off-right): the bright segment sweeps left to right
        pl.el.style.strokeDashoffset = pl.seg - ph * (pl.L + pl.seg);
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running) return; running = true; t0 = null; raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    var io = new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }, { threshold: 0 });
    io.observe(section);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (visible) start(); });
  };
})();

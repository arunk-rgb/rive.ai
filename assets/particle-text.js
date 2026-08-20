// particle-text.js — vanilla port of React Bits' <ParticleText />.
// Samples text into an offscreen glyph canvas, then animates particles that scatter,
// gather into the letters, drift, and repel from the cursor. Pauses when offscreen/hidden.
// window.initParticleText(container, opts) -> { destroy() }
(function () {
  function hexToRgb(hex) {
    var c = (hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
    return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
  }
  function mix(a, b, t) { return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) }; }
  function rgbCss(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function resolveFontSize(value, container, fw, ff) {
    if (typeof value === 'number') return value;
    var p = document.createElement('span');
    p.textContent = 'M';
    p.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;font-size:' + value + ';font-weight:' + fw + ';font-family:' + ff;
    container.appendChild(p);
    var s = parseFloat(getComputedStyle(p).fontSize) || 96;
    p.remove();
    return s;
  }
  function waitForFonts(font) {
    if (!('fonts' in document)) return Promise.resolve();
    return document.fonts.load(font).catch(function () {}).then(function () { return document.fonts.ready; });
  }

  window.initParticleText = function (container, opts) {
    opts = opts || {};
    var text = opts.text != null ? opts.text : 'React Bits';
    var particleSize = opts.particleSize != null ? opts.particleSize : 2;
    var density = opts.density != null ? opts.density : 4;
    var color = opts.color || '#ffffff';
    var highlightColor = opts.highlightColor || '#8b5cf6';
    var scatter = opts.scatter != null ? opts.scatter : 180;
    var gatherDuration = opts.gatherDuration != null ? opts.gatherDuration : 1600;
    var stagger = opts.stagger != null ? opts.stagger : 420;
    var pointerRepel = opts.pointerRepel != null ? opts.pointerRepel : 40;
    var repelRadius = opts.repelRadius != null ? opts.repelRadius : 120;
    var idleDrift = opts.idleDrift != null ? opts.idleDrift : 0.7;
    var trigger = opts.trigger || 'mount';
    var fontSize = opts.fontSize != null ? opts.fontSize : 'clamp(3rem, 12vw, 8rem)';
    var fontWeight = opts.fontWeight != null ? opts.fontWeight : 800;
    var fontFamily = opts.fontFamily || 'inherit';
    var glow = opts.glow !== false;

    if (!container) return { destroy: function () {} };
    var canvas = document.createElement('canvas');
    canvas.className = 'ptx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) return { destroy: function () {} };

    var particles = [], animationFrame = null, resizeFrame = null, buildId = 0, gathering = false, gatherStart = 0;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var width = 0, height = 0, dpr = 1;
    var pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 };

    function startGather(fromScatter) {
      if (!particles.length) return;
      var now = performance.now();
      var spread = reduced ? 0 : scatter;
      particles.forEach(function (p) {
        if (fromScatter) {
          var ang = p.seed * Math.PI * 2;
          var dist = spread * (0.35 + p.depth * 0.75);
          p.x = p.targetX + Math.cos(ang) * dist + (p.depth - 0.5) * spread * 0.55;
          p.y = p.targetY + Math.sin(ang) * dist + (p.seed - 0.5) * spread * 0.55;
        }
        p.startX = p.x; p.startY = p.y; p.delay = reduced ? 0 : p.seed * stagger;
      });
      gatherStart = now; gathering = true;
    }
    function draw(p) {
      var s = p.size; ctx.fillStyle = p.color;
      if (s <= 2.1) { ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); return; }
      ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2); ctx.fill();
    }
    function render(now) {
      ctx.clearRect(0, 0, width, height);
      if (glow && !reduced) { ctx.shadowBlur = particleSize * 3; ctx.shadowColor = highlightColor; } else ctx.shadowBlur = 0;
      pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
      pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;
      var complete = true;
      particles.forEach(function (p) {
        var bx = p.targetX, by = p.targetY, prog = 1;
        if (gathering) {
          var local = (now - gatherStart - p.delay) / Math.max(1, reduced ? 1 : gatherDuration);
          prog = clamp(local, 0, 1);
          var e = easeOutCubic(prog);
          bx = p.startX + (p.targetX - p.startX) * e;
          by = p.startY + (p.targetY - p.startY) * e;
          if (prog < 1) complete = false;
        } else if (!reduced && idleDrift > 0) {
          var dt = now * 0.001;
          bx += Math.sin(dt * 0.9 + p.seed * 10) * idleDrift * p.depth;
          by += Math.cos(dt * 0.75 + p.depth * 10) * idleDrift * p.depth;
        }
        if (pointer.active && !reduced && pointerRepel > 0 && repelRadius > 0) {
          var dx = bx - pointer.smoothX, dy = by - pointer.smoothY, d = Math.hypot(dx, dy);
          if (d > 0 && d < repelRadius) { var f = Math.pow(1 - d / repelRadius, 2) * pointerRepel; bx += (dx / d) * f; by += (dy / d) * f; }
        }
        var follow = reduced ? 1 : 0.22;
        p.x += (bx - p.x) * follow; p.y += (by - p.y) * follow;
        ctx.globalAlpha = clamp(0.35 + prog * 0.65, 0, 1);
        draw(p);
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (gathering && complete) gathering = false;
      animationFrame = requestAnimationFrame(render);
    }
    function ensureLoop() { if (animationFrame === null) animationFrame = requestAnimationFrame(render); }

    function sampleText() {
      var currentBuild = ++buildId;
      var rect = container.getBoundingClientRect();
      width = Math.floor(rect.width); height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = '100%'; canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var comp = getComputedStyle(container);
      var fam = fontFamily === 'inherit' ? (comp.fontFamily || 'sans-serif') : fontFamily;
      var size = resolveFontSize(fontSize, container, fontWeight, fam);
      var font = fontWeight + ' ' + size + 'px ' + fam;

      waitForFonts(font).then(function () {
        if (currentBuild !== buildId) return;
        var off = document.createElement('canvas');
        var oc = off.getContext('2d', { willReadFrequently: true });
        if (!oc) return;
        var content = String(text || ' ');
        var maxW = width * 0.92;
        oc.font = font;
        var m = oc.measureText(content);
        var mw = Math.max(1, m.width);

        function build() {
          var left = Math.ceil(m.actualBoundingBoxLeft || 0);
          var right = Math.ceil(m.actualBoundingBoxRight || m.width);
          var asc = Math.ceil(m.actualBoundingBoxAscent || size * 0.78);
          var desc = Math.ceil(m.actualBoundingBoxDescent || size * 0.22);
          var pad = Math.max(12, Math.ceil(size * 0.08));
          var tw = Math.max(1, left + right), th = Math.max(1, asc + desc);
          off.width = tw + pad * 2; off.height = th + pad * 2;
          oc.clearRect(0, 0, off.width, off.height);
          oc.font = font; oc.textAlign = 'left'; oc.textBaseline = 'alphabetic'; oc.fillStyle = '#ffffff';
          oc.fillText(content, pad - left, pad + asc);
          var img = oc.getImageData(0, 0, off.width, off.height);
          var targets = [], step = Math.max(2, Math.floor(density));
          for (var y = 0; y < off.height; y += step) {
            for (var x = 0; x < off.width; x += step) {
              var a = img.data[(y * off.width + x) * 4 + 3];
              if (a > 40) targets.push({ x: width / 2 - off.width / 2 + x, y: height / 2 - off.height / 2 + y, alpha: a / 255 });
            }
          }
          var maxP = Math.max(900, Math.min(5200, Math.floor((width * height) / 90)));
          var stride = Math.max(1, Math.ceil(targets.length / maxP));
          var baseRgb = hexToRgb(color), hiRgb = hexToRgb(highlightColor);
          var sel = targets.filter(function (_, i) { return i % stride === 0; });
          particles = sel.map(function (t, index) {
            var seed = ((index * 9301 + 49297) % 233280) / 233280;
            var depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
            var blend = (baseRgb && hiRgb) ? clamp(t.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1) : 0;
            var pc = (baseRgb && hiRgb) ? rgbCss(mix(baseRgb, hiRgb, blend)) : color;
            var ang = seed * Math.PI * 2;
            var dist = (reduced ? 0 : scatter) * (0.35 + depth * 0.75);
            var sx = t.x + Math.cos(ang) * dist + (seed - 0.5) * scatter * 0.45;
            var sy = t.y + Math.sin(ang) * dist + (depth - 0.9) * scatter * 0.45;
            return {
              x: reduced ? t.x : sx, y: reduced ? t.y : sy, startX: sx, startY: sy,
              targetX: t.x, targetY: t.y, size: Math.max(0.6, particleSize * (0.75 + t.alpha * 0.45)),
              color: pc, seed: seed, depth: depth, delay: seed * stagger
            };
          });
          pointer.x = width / 2; pointer.y = height / 2; pointer.smoothX = pointer.x; pointer.smoothY = pointer.y;
          if (reduced) {
            particles.forEach(function (p) { p.x = p.targetX; p.y = p.targetY; p.startX = p.targetX; p.startY = p.targetY; p.delay = 0; });
            gathering = false;
          } else startGather(false);
          ensureLoop();
        }

        if (mw > maxW) {
          size = Math.max(18, size * (maxW / mw));
          font = fontWeight + ' ' + size + 'px ' + fam;
          waitForFonts(font).then(function () { if (currentBuild !== buildId) return; oc.font = font; m = oc.measureText(content); build(); });
        } else build();
      });
    }

    function queueSample() { if (resizeFrame) cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(sampleText); }
    function pmove(e) { var r = canvas.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true; }
    function pleave() { pointer.active = false; }
    function penter(e) { pmove(e); if (trigger === 'hover') startGather(true); }
    function pclick() { if (trigger === 'click') startGather(true); }
    var rmq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    function rmchange(e) { reduced = e.matches; sampleText(); }
    if (rmq && rmq.addEventListener) rmq.addEventListener('change', rmchange);
    canvas.addEventListener('pointerenter', penter);
    canvas.addEventListener('pointermove', pmove);
    canvas.addEventListener('pointerleave', pleave);
    canvas.addEventListener('click', pclick);
    var ro = new ResizeObserver(queueSample);
    ro.observe(container);
    sampleText();

    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) { if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; } }
      else if (!document.hidden) ensureLoop();
    }, { threshold: 0 });
    io.observe(container);
    function onVis() { if (document.hidden) { if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; } } else ensureLoop(); }
    document.addEventListener('visibilitychange', onVis);

    return {
      destroy: function () {
        buildId += 1; ro.disconnect(); io.disconnect();
        if (rmq && rmq.removeEventListener) rmq.removeEventListener('change', rmchange);
        canvas.removeEventListener('pointerenter', penter);
        canvas.removeEventListener('pointermove', pmove);
        canvas.removeEventListener('pointerleave', pleave);
        canvas.removeEventListener('click', pclick);
        document.removeEventListener('visibilitychange', onVis);
        if (animationFrame) cancelAnimationFrame(animationFrame);
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
      }
    };
  };
})();

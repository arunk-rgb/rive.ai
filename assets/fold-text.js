// fold-text.js — vanilla port of React Bits' <FoldText />.
// Splits text into char/word/line panels that unfold from a 3D hinge with a staggered
// cascade and a fading crease shade. Driven by CSS transitions + IntersectionObserver
// (no GSAP). window.initFoldText(el, opts) -> void
(function () {
  var HINGE = {
    top:    { origin: '50% 0%',   rx: -92, ry: 0 },
    bottom: { origin: '50% 100%', rx: 92,  ry: 0 },
    left:   { origin: '0% 50%',   rx: 0,   ry: 92 },
    right:  { origin: '100% 50%', rx: 0,   ry: -92 }
  };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  window.initFoldText = function (el, opts) {
    if (!el) return;
    opts = opts || {};
    var text = opts.text != null ? opts.text : (el.getAttribute('data-fold-text') || el.textContent || '');
    var splitBy = opts.splitBy || 'char';
    var hinge = opts.hinge || 'top';
    var duration = opts.duration != null ? opts.duration : 0.65;
    var stagger = opts.stagger != null ? opts.stagger : 0.045;
    var perspective = Math.max(120, opts.perspective != null ? opts.perspective : 700);
    var crease = clamp(opts.creaseShading != null ? opts.creaseShading : 0.55, 0, 1);
    var trigger = opts.trigger || 'mount';
    var hc = HINGE[hinge] || HINGE.top;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var dur = reduce ? Math.min(duration, 0.22) : duration;
    var stg = reduce ? Math.min(stagger, 0.02) : stagger;

    el.classList.add('fold-text');
    el.textContent = '';
    var sr = document.createElement('span'); sr.className = 'fold-text-sr-only'; sr.textContent = text; el.appendChild(sr);
    var vis = document.createElement('span'); vis.className = 'fold-text-visual'; vis.setAttribute('aria-hidden', 'true'); el.appendChild(vis);

    var pieces = [];
    function makeSeg(content, split) {
      var seg = document.createElement('span');
      seg.className = 'fold-text-segment';
      seg.setAttribute('data-fold-split', split || splitBy);
      seg.style.perspective = perspective + 'px';
      var piece = document.createElement('span');
      piece.className = 'fold-text-piece';
      piece.setAttribute('data-fold-hinge', hinge);
      piece.style.transformOrigin = hc.origin;
      piece.textContent = content || ' ';
      seg.appendChild(piece);
      pieces.push(piece);
      return seg;
    }

    if (splitBy === 'line') {
      text.split('\n').forEach(function (line) {
        var l = document.createElement('span'); l.className = 'fold-text-line';
        l.appendChild(makeSeg(line || ' ', 'line')); vis.appendChild(l);
      });
    } else if (splitBy === 'word') {
      text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) vis.appendChild(document.createTextNode(' '));
        else vis.appendChild(makeSeg(part));
      });
    } else {
      Array.prototype.forEach.call(text, function (ch) {
        if (ch === '\n') { vis.appendChild(document.createElement('br')); return; }
        vis.appendChild(makeSeg(ch === ' ' ? ' ' : ch));
      });
    }

    function setFolded(p, i) {
      p.style.transition = 'transform ' + dur + 's cubic-bezier(.22,1,.36,1) ' + (i * stg) + 's, opacity ' + dur + 's ease ' + (i * stg) + 's';
      p.style.setProperty('--fold-crease', String(crease));
      p.style.setProperty('--fold-crease-dur', dur + 's');
      p.style.setProperty('--fold-crease-delay', (i * stg) + 's');
      p.style.opacity = '0';
      p.style.transform = 'rotateX(' + hc.rx + 'deg) rotateY(' + hc.ry + 'deg)';
      p.classList.remove('in');
    }
    function unfold() {
      pieces.forEach(function (p) { p.style.opacity = '1'; p.style.transform = 'none'; p.classList.add('in'); });
    }

    if (reduce) { unfold(); return; }

    pieces.forEach(setFolded);

    function refoldThenUnfold() {
      pieces.forEach(function (p, i) { p.style.transition = 'none'; setFolded(p, i); });
      void el.offsetWidth;
      pieces.forEach(function (p, i) {
        p.style.transition = 'transform ' + dur + 's cubic-bezier(.22,1,.36,1) ' + (i * stg) + 's, opacity ' + dur + 's ease ' + (i * stg) + 's';
      });
      requestAnimationFrame(function () { requestAnimationFrame(unfold); });
    }

    if (trigger === 'scroll') {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { unfold(); io.disconnect(); }
        }, { threshold: 0, rootMargin: '0px 0px -16% 0px' });
        io.observe(el);
      } else unfold();
    } else if (trigger === 'hover') {
      unfold();
      el.addEventListener('mouseenter', refoldThenUnfold);
    } else if (trigger === 'loop') {
      var span = dur * 1000 + pieces.length * stg * 1000 + 750;
      var loop = function () { refoldThenUnfold(); setTimeout(loop, span); };
      loop();
    } else {
      requestAnimationFrame(function () { requestAnimationFrame(unfold); });
    }
  };
})();

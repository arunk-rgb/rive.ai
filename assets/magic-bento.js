// magic-bento.js — vanilla port of React Bits' <MagicBento />.
// Builds the bento grid, and wires stars, spotlight, border-glow, tilt, magnetism
// and click ripple. Uses the global `gsap` (loaded from CDN); degrades to static
// cards + CSS hover if gsap is missing or animations are disabled.
// window.initMagicBento(gridEl, opts) -> void
(function () {
  var MOBILE_BREAKPOINT = 768;

  function calcSpot(radius) { return { proximity: radius * 0.5, fade: radius * 0.75 }; }

  function makeParticle(x, y, color) {
    var el = document.createElement('div');
    el.className = 'particle';
    el.style.cssText =
      'position:absolute;width:4px;height:4px;border-radius:50%;' +
      'background:rgba(' + color + ',1);box-shadow:0 0 6px rgba(' + color + ',.6);' +
      'pointer-events:none;z-index:100;left:' + x + 'px;top:' + y + 'px';
    return el;
  }

  function setGlow(card, mx, my, glow, radius) {
    var r = card.getBoundingClientRect();
    card.style.setProperty('--glow-x', ((mx - r.left) / r.width) * 100 + '%');
    card.style.setProperty('--glow-y', ((my - r.top) / r.height) * 100 + '%');
    card.style.setProperty('--glow-intensity', String(glow));
    card.style.setProperty('--glow-radius', radius + 'px');
  }

  // ---- per-card behaviours (stars/tilt/magnetism/click) ----
  function wireCard(card, o) {
    var gsap = window.gsap;
    var particles = [], timeouts = [], memo = [], inited = false, hovered = false, magnetTween = null;

    function initParticles() {
      if (inited) return;
      var r = card.getBoundingClientRect();
      for (var i = 0; i < o.particleCount; i++) {
        memo.push(makeParticle(Math.random() * r.width, Math.random() * r.height, o.glowColor));
      }
      inited = true;
    }
    function clearParticles() {
      timeouts.forEach(clearTimeout); timeouts = [];
      if (magnetTween) magnetTween.kill();
      particles.forEach(function (p) {
        gsap.to(p, {
          scale: 0, opacity: 0, duration: .3, ease: 'back.in(1.7)',
          onComplete: function () { if (p.parentNode) p.parentNode.removeChild(p); }
        });
      });
      particles = [];
    }
    function animateParticles() {
      if (!hovered) return;
      if (!inited) initParticles();
      memo.forEach(function (p, idx) {
        var t = setTimeout(function () {
          if (!hovered) return;
          var clone = p.cloneNode(true);
          card.appendChild(clone); particles.push(clone);
          gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .3, ease: 'back.out(1.7)' });
          gsap.to(clone, {
            x: (Math.random() - .5) * 100, y: (Math.random() - .5) * 100, rotation: Math.random() * 360,
            duration: 2 + Math.random() * 2, ease: 'none', repeat: -1, yoyo: true
          });
          gsap.to(clone, { opacity: .3, duration: 1.5, ease: 'power2.inOut', repeat: -1, yoyo: true });
        }, idx * 100);
        timeouts.push(t);
      });
    }

    card.addEventListener('mouseenter', function () {
      hovered = true;
      if (o.enableStars) animateParticles();
      if (o.enableTilt) gsap.to(card, { rotateX: 5, rotateY: 5, duration: .3, ease: 'power2.out', transformPerspective: 1000 });
    });
    card.addEventListener('mouseleave', function () {
      hovered = false;
      if (o.enableStars) clearParticles();
      if (o.enableTilt) gsap.to(card, { rotateX: 0, rotateY: 0, duration: .3, ease: 'power2.out' });
      if (o.enableMagnetism) gsap.to(card, { x: 0, y: 0, duration: .3, ease: 'power2.out' });
    });
    card.addEventListener('mousemove', function (e) {
      if (!o.enableTilt && !o.enableMagnetism) return;
      var r = card.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top, cx = r.width / 2, cy = r.height / 2;
      if (o.enableTilt) {
        gsap.to(card, {
          rotateX: ((y - cy) / cy) * -10, rotateY: ((x - cx) / cx) * 10,
          duration: .1, ease: 'power2.out', transformPerspective: 1000
        });
      }
      if (o.enableMagnetism) {
        magnetTween = gsap.to(card, { x: (x - cx) * .05, y: (y - cy) * .05, duration: .3, ease: 'power2.out' });
      }
    });
    card.addEventListener('click', function (e) {
      if (!o.clickEffect) return;
      var r = card.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var maxD = Math.max(
        Math.hypot(x, y), Math.hypot(x - r.width, y),
        Math.hypot(x, y - r.height), Math.hypot(x - r.width, y - r.height)
      );
      var ripple = document.createElement('div');
      ripple.style.cssText =
        'position:absolute;width:' + (maxD * 2) + 'px;height:' + (maxD * 2) + 'px;border-radius:50%;' +
        'background:radial-gradient(circle,rgba(' + o.glowColor + ',.4) 0%,rgba(' + o.glowColor + ',.2) 30%,transparent 70%);' +
        'left:' + (x - maxD) + 'px;top:' + (y - maxD) + 'px;pointer-events:none;z-index:1000';
      card.appendChild(ripple);
      gsap.fromTo(ripple, { scale: 0, opacity: 1 },
        { scale: 1, opacity: 0, duration: .8, ease: 'power2.out', onComplete: function () { ripple.remove(); } });
    });
  }

  // ---- global spotlight ----
  function wireSpotlight(grid, section, o) {
    var gsap = window.gsap;
    var spot = document.createElement('div');
    spot.className = 'global-spotlight';
    spot.style.cssText =
      'position:fixed;width:800px;height:800px;border-radius:50%;pointer-events:none;z-index:200;opacity:0;' +
      'transform:translate(-50%,-50%);mix-blend-mode:screen;background:radial-gradient(circle,' +
      'rgba(' + o.glowColor + ',.15) 0%,rgba(' + o.glowColor + ',.08) 15%,rgba(' + o.glowColor + ',.04) 25%,' +
      'rgba(' + o.glowColor + ',.02) 40%,rgba(' + o.glowColor + ',.01) 65%,transparent 70%)';
    document.body.appendChild(spot);

    var sv = calcSpot(o.spotlightRadius);
    document.addEventListener('mousemove', function (e) {
      var rect = section.getBoundingClientRect();
      var inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      var cards = grid.querySelectorAll('.magic-bento-card');
      if (!inside) {
        gsap.to(spot, { opacity: 0, duration: .3, ease: 'power2.out' });
        cards.forEach(function (c) { c.style.setProperty('--glow-intensity', '0'); });
        return;
      }
      var minD = Infinity;
      cards.forEach(function (c) {
        var cr = c.getBoundingClientRect();
        var cxp = cr.left + cr.width / 2, cyp = cr.top + cr.height / 2;
        var d = Math.hypot(e.clientX - cxp, e.clientY - cyp) - Math.max(cr.width, cr.height) / 2;
        var ed = Math.max(0, d);
        minD = Math.min(minD, ed);
        var g = 0;
        if (ed <= sv.proximity) g = 1;
        else if (ed <= sv.fade) g = (sv.fade - ed) / (sv.fade - sv.proximity);
        setGlow(c, e.clientX, e.clientY, g, o.spotlightRadius);
      });
      gsap.to(spot, { left: e.clientX, top: e.clientY, duration: .1, ease: 'power2.out' });
      var op = minD <= sv.proximity ? 0.8 : minD <= sv.fade ? ((sv.fade - minD) / (sv.fade - sv.proximity)) * 0.8 : 0;
      gsap.to(spot, { opacity: op, duration: op > 0 ? .2 : .5, ease: 'power2.out' });
    });
    document.addEventListener('mouseleave', function () {
      grid.querySelectorAll('.magic-bento-card').forEach(function (c) { c.style.setProperty('--glow-intensity', '0'); });
      gsap.to(spot, { opacity: 0, duration: .3, ease: 'power2.out' });
    });
  }

  window.initMagicBento = function (grid, opts) {
    if (!grid) return;
    var o = Object.assign({
      cards: [], textAutoHide: true, enableStars: true, enableSpotlight: true, enableBorderGlow: true,
      enableTilt: false, enableMagnetism: true, clickEffect: true, disableAnimations: false,
      spotlightRadius: 300, particleCount: 12, glowColor: '47, 216, 255'
    }, opts || {});

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    var off = o.disableAnimations || reduce || mobile || !window.gsap;

    grid.style.setProperty('--glow-color', o.glowColor);

    // build cards
    o.cards.forEach(function (data) {
      var card = document.createElement('div');
      card.className = 'magic-bento-card' +
        (o.textAutoHide ? ' magic-bento-card--text-autohide' : '') +
        (o.enableBorderGlow ? ' magic-bento-card--border-glow' : '');
      card.style.setProperty('--glow-color', o.glowColor);
      card.innerHTML =
        '<div class="magic-bento-card__header"><div class="magic-bento-card__label">' + data.label + '</div></div>' +
        '<div class="magic-bento-card__content">' +
          '<h3 class="magic-bento-card__title">' + data.title + '</h3>' +
          '<p class="magic-bento-card__description">' + data.description + '</p>' +
        '</div>';
      grid.appendChild(card);
      if (!off) wireCard(card, o);
    });

    if (!off && o.enableSpotlight) wireSpotlight(grid, grid, o);
  };
})();

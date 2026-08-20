// nav.js — adaptive global header.
// - Auto-detects the background beneath the header (per scroll frame) and switches
//   the header between a light theme (dark text on light glass) and a dark theme
//   (light text on dark glass) so it stays legible over any background.
// - Sections with a media/image/canvas background (transparent to the sampler) can
//   force a theme with data-nav-bg="dark" | "light".
// - Adds a compact .scrolled state and marks the current page's nav link.
(function () {
  var nav = document.querySelector('nav.bar');
  if (!nav) return;

  // ---- mark the active page link ----
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  Array.prototype.forEach.call(nav.querySelectorAll('.nav-links a, .nav-menu a'), function (a) {
    var href = (a.getAttribute('href') || '').split('#')[0].toLowerCase();
    if (href && href === page) a.setAttribute('aria-current', 'page');
  });

  // ---- mobile: the "Book a demo" CTA is hidden on small screens, so add it to the menu ----
  var mobMenu = nav.querySelector('.nav-menu');
  if (mobMenu && !mobMenu.querySelector('a[href="book-a-demo.html"]')) {
    var cta = document.createElement('a');
    cta.href = 'book-a-demo.html';
    cta.textContent = 'Book a demo';
    cta.className = 'nav-menu-cta';
    mobMenu.appendChild(cta);
  }

  // ---- background sampling ----
  function parseColor(str) {
    if (!str) return null;
    var m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (v) { return parseFloat(v); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  // returns true (dark bg), false (light bg) or null (undetermined) at viewport y
  function isDarkAt(y) {
    var W = window.innerWidth;
    var xs = [W * 0.5, W * 0.18, W * 0.82];
    for (var i = 0; i < xs.length; i++) {
      var stack = document.elementsFromPoint(Math.round(xs[i]), Math.round(y));
      for (var j = 0; j < stack.length; j++) {
        var el = stack[j];
        if (el === nav || nav.contains(el)) continue;          // ignore the header itself
        var forced = el.closest && el.closest('[data-nav-bg]'); // explicit override wins
        if (forced) return forced.getAttribute('data-nav-bg') === 'dark';
        var c = parseColor(getComputedStyle(el).backgroundColor);
        if (c && c.a >= 0.5) {
          var lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
          return lum < 0.52;
        }
      }
    }
    return null;
  }

  var lastDark = null, lastScrolled = null;
  function update() {
    var scrolled = window.scrollY > 24;
    if (scrolled !== lastScrolled) { lastScrolled = scrolled; nav.classList.toggle('scrolled', scrolled); }
    var r = nav.getBoundingClientRect();
    var dark = isDarkAt(r.top + r.height / 2);
    if (dark === null) return;                                 // keep current theme
    if (dark !== lastDark) { lastDark = dark; nav.setAttribute('data-theme', dark ? 'dark' : 'light'); }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { update(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  requestAnimationFrame(update);
  setTimeout(update, 80);   // re-check once late-loading backgrounds (video/canvas) settle
})();

/* ---- Mega-menu dropdowns for Platform & Solutions ----
   Ported from a shadcn/Radix NavigationMenu to vanilla JS/CSS. It only enhances the
   existing Platform / Solutions nav links (hover to open a panel, click still navigates);
   the header markup and styling are otherwise untouched. Desktop only (>900px). */
(function () {
  var nav = document.querySelector('nav.bar');
  var linksWrap = nav && nav.querySelector('.nav-links');
  if (!nav || !linksWrap) return;

  function ic(paths) {
    return '<svg class="nm-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICONS = {
    graph: ic('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>'),
    cpu: ic('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>'),
    target: ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
    activity: ic('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
    check: ic('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    zap: ic('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
    plug: ic('<path d="M12 22v-5M9 8V2M15 8V2M18 8v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
    layers: ic('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
    wrench: ic('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    grid: ic('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    server: ic('<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><line x1="6" y1="7" x2="6.01" y2="7"/><line x1="6" y1="17" x2="6.01" y2="17"/>'),
    flask: ic('<path d="M9 3h6M10 3v6L4.6 18.4A1 1 0 0 0 5.5 20h13a1 1 0 0 0 .9-1.6L14 9V3"/>'),
    factory: ic('<path d="M2 20h20V9l-6 4V9l-6 4V5H4a2 2 0 0 0-2 2z"/><path d="M6 20v-4M10 20v-4M14 20v-4M18 20v-4"/>'),
    box: ic('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>'),
    building: ic('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/>'),
    briefcase: ic('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    mail: ic('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>'),
    calendar: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    book: ic('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    arrow: ic('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
    caret: '<svg class="nm-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>'
  };

  var MENUS = {
    'platform.html': {
      featured: [
        { t: 'Knowledge graph', h: 'platform.html', d: 'Every asset, sensor, and work order on one graph.', i: 'graph' },
        { t: 'Agent factory', h: 'platform.html', d: 'Purpose-built agents that run your operation.', i: 'cpu' },
        { t: 'Decision intelligence', h: 'platform.html', d: 'The best next action, with the reasoning.', i: 'target' }
      ],
      links: [
        { t: 'Detect', h: 'platform.html', i: 'activity' },
        { t: 'Decide', h: 'platform.html', i: 'check' },
        { t: 'Execute', h: 'platform.html', i: 'zap' },
        { t: 'Integrations', h: 'platform.html', i: 'plug' },
        { t: 'Ontology', h: 'platform.html', i: 'layers' }
      ]
    },
    'research.html': {
      featured: [
        { t: 'Predictive maintenance', h: 'research.html', d: 'Act on failures before they happen.', i: 'wrench' },
        { t: 'Asset orchestration', h: 'research.html', d: 'Coordinate assets across the operation.', i: 'grid' }
      ],
      links: [
        { t: 'High-tech manufacturing', h: './#industries', i: 'cpu' },
        { t: 'Data centers', h: './#industries', i: 'server' },
        { t: 'Power & utilities', h: './#industries', i: 'zap' },
        { t: 'Life sciences', h: './#industries', i: 'flask' },
        { t: 'Process manufacturing', h: './#industries', i: 'factory' },
        { t: 'Consumer packaged goods', h: './#industries', i: 'box' }
      ]
    },
    'company.html': {
      featured: [
        { t: 'About Rive', h: 'company.html', d: 'Our mission and the principles behind Rive.', i: 'building' },
        { t: 'Careers', h: 'careers.html', d: 'Help build the future of industrial operations.', i: 'briefcase' }
      ],
      casesMore: './#cases',
      cases: [
        { t: 'Orchestrating maintenance at industrial scale', d: 'Oil & gas', h: 'case-orchestrating-maintenance.html', i: 'wrench' },
        { t: 'AI-powered asset digitization', d: 'Data center', h: 'case-data-center.html', i: 'server' }
      ],
      links: [
        { t: 'Careers', h: 'careers.html', i: 'briefcase' },
        { t: 'Contact us', h: 'contact.html', i: 'mail' },
        { t: 'Book a demo', h: 'book-a-demo.html', i: 'calendar' }
      ]
    }
  };

  var NM_CSS = `
  .nav-links{position:relative}
  .nm-trigger{display:inline-flex;align-items:center;gap:4px}
  .nm-svg{width:100%;height:100%;display:block}
  .nm-caret{width:12px;height:12px;opacity:.65;cursor:pointer;box-sizing:content-box;padding:9px 8px 9px 5px;margin:-9px -6px -9px -3px;transition:transform .3s ease}
  .nm-trigger[aria-expanded="true"] .nm-caret{transform:rotate(180deg)}
  .bar{--nm-bg:rgba(251,251,249,.98);--nm-bd:rgba(0,0,0,.08);--nm-card:#fff;--nm-cbd:rgba(0,0,0,.08);--nm-ink:#1a1614;--nm-muted:#6b6862;--nm-grid:rgba(0,0,0,.06);--nm-hover:rgba(0,0,0,.045);--nm-shadow:0 30px 70px -24px rgba(18,18,22,.42),0 6px 18px -8px rgba(18,18,22,.22),inset 0 1px 0 rgba(255,255,255,.75)}
  .bar[data-theme="dark"]{--nm-bg:rgba(17,19,25,.975);--nm-bd:rgba(255,255,255,.12);--nm-card:rgba(255,255,255,.05);--nm-cbd:rgba(255,255,255,.11);--nm-ink:#fff;--nm-muted:rgba(255,255,255,.62);--nm-grid:rgba(255,255,255,.08);--nm-hover:rgba(255,255,255,.07);--nm-shadow:0 34px 80px -24px rgba(0,0,0,.62),0 6px 20px -8px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.06)}
  .nm-panel{position:absolute;top:calc(100% + 14px);left:50%;z-index:70;width:min(880px,calc(100vw - 48px));padding:14px;
    border-radius:22px;background:var(--nm-bg);border:1px solid var(--nm-bd);box-shadow:var(--nm-shadow);
    backdrop-filter:blur(30px) saturate(1.6);-webkit-backdrop-filter:blur(30px) saturate(1.6);
    opacity:0;visibility:hidden;pointer-events:none;transform:translateX(-50%) translateY(-6px) scale(.985);transform-origin:top center;
    transition:opacity .24s ease,transform .24s ease,visibility .24s}
  .nm-panel::before{content:"";position:absolute;left:0;right:0;top:-16px;height:16px}
  .nm-panel.open{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0) scale(1)}
  .nm-grid2{display:grid;grid-template-columns:1fr .66fr;gap:14px}
  .nm-featured{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-right:14px}
  .nm-featured::after{content:"";position:absolute;top:-14px;bottom:-14px;right:0;width:1px;background:var(--nm-bd);pointer-events:none}
  .nm-featured.two{grid-template-columns:repeat(2,1fr)}
  .nm-panel .nm-card{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;gap:24px;min-height:126px;
    padding:14px;border-radius:14px;background:var(--nm-card);border:1px solid var(--nm-cbd);color:var(--nm-ink);
    transition:border-color .2s ease,transform .2s ease}
  .nm-panel .nm-card:hover{border-color:var(--green,#00A21E);transform:translateY(-1px);background:var(--nm-card)}
  .nm-panel .nm-card::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.75;transform:translateY(9px);transition:transform .3s ease;
    background-image:linear-gradient(var(--nm-grid) 1px,transparent 1px),linear-gradient(90deg,var(--nm-grid) 1px,transparent 1px);background-size:22px 22px;
    -webkit-mask-image:linear-gradient(215deg,#000,transparent 68%);mask-image:linear-gradient(215deg,#000,transparent 68%)}
  .nm-panel .nm-card:hover::after{transform:translateY(0)}
  .nm-card .nm-ico{position:relative;width:20px;height:20px;color:var(--nm-ink);opacity:.85}
  .nm-card .nm-ct{position:relative;z-index:1}
  .nm-card .nm-t{display:block;font-size:14px;font-weight:600;color:var(--nm-ink)}
  .nm-card .nm-d{display:block;margin-top:6px;font-size:12px;line-height:1.42;color:var(--nm-muted)}
  .nm-panel .nm-left{position:relative;display:flex;flex-direction:column;gap:14px;padding-right:14px}
  .nm-panel .nm-left::after{content:"";position:absolute;top:-14px;bottom:-14px;right:0;width:1px;background:var(--nm-bd);pointer-events:none}
  .nm-panel .nm-left .nm-featured{padding-right:0}
  .nm-panel .nm-left .nm-featured::after{display:none}
  .nm-cases-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
  .nm-cases-t{font-size:12px;font-weight:600;letter-spacing:0;color:var(--nm-muted)}
  .nm-more{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--nm-ink);transition:color .18s ease}
  .nm-more svg{width:13px;height:13px}
  .nm-more:hover{color:var(--green,#00A21E)}
  .nm-cases-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .nm-list{display:flex;flex-direction:column;gap:2px}
  .nm-panel .nm-item{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:10px;color:var(--nm-ink);transition:background .18s ease}
  .nm-panel .nm-item:hover{background:var(--nm-hover)}
  .nm-item .nm-ico{width:16px;height:16px;color:var(--nm-muted);flex:0 0 auto}
  .nm-item .nm-t{font-size:13.5px;font-weight:500}
  .nm-item .nm-arrow{margin-left:auto;width:15px;height:15px;color:var(--nm-muted);opacity:0;transform:translateX(-6px);transition:opacity .2s ease,transform .2s ease}
  .nm-item:hover .nm-arrow{opacity:1;transform:none}
  @media(max-width:1040px){.nm-grid2{grid-template-columns:1fr}.nm-featured{padding-right:0;border-bottom:1px solid var(--nm-bd);padding-bottom:12px}.nm-featured::after{display:none}
    .nm-panel .nm-left{padding-right:0;padding-bottom:12px;border-bottom:1px solid var(--nm-bd)}.nm-panel .nm-left::after{display:none}.nm-panel .nm-left .nm-featured{border-bottom:0;padding-bottom:0}}
  .nav-menu .nav-menu-cta{margin-top:8px;background:var(--nav-btn-bg,#1b1815);color:var(--nav-btn-text,#f6f4f0)!important;font-weight:600}
  .nav-menu .nav-menu-cta:hover{background:var(--nav-btn-hover,#2c2723)}
  @media(max-width:900px){.nm-panel{display:none!important}.nm-caret{display:none}}
  /* mobile header: brand + hamburger only; the CTA moves into the menu */
  @media(max-width:900px){nav.bar .nav-right{display:none}nav.bar .nav-actions{gap:0}}
  @media(prefers-reduced-motion:reduce){.nm-panel,.nm-caret,.nm-card::after,.nm-item .nm-arrow{transition:none}}
  `;

  if (!document.getElementById('nm-styles')) {
    var st = document.createElement('style');
    st.id = 'nm-styles';
    st.textContent = NM_CSS;
    document.head.appendChild(st);
  }

  function cardHTML(f) {
    return '<a class="nm-card" href="' + f.h + '"><span class="nm-ico">' + ICONS[f.i] + '</span>' +
      '<span class="nm-ct"><span class="nm-t">' + f.t + '</span>' + (f.d ? '<span class="nm-d">' + f.d + '</span>' : '') + '</span></a>';
  }
  function itemHTML(l) {
    return '<a class="nm-item" href="' + l.h + '"><span class="nm-ico">' + ICONS[l.i] + '</span><span class="nm-t">' + l.t + '</span><span class="nm-arrow">' + ICONS.arrow + '</span></a>';
  }
  function panelHTML(m) {
    var fc = 'nm-featured' + (m.featured.length === 2 ? ' two' : '');
    var featured = '<div class="' + fc + '">' + m.featured.map(cardHTML).join('') + '</div>';
    var left = featured;
    if (m.cases && m.cases.length) {
      left = '<div class="nm-left">' + featured +
        '<div class="nm-cases"><div class="nm-cases-head"><span class="nm-cases-t">Case studies</span>' +
        '<a class="nm-more" href="' + (m.casesMore || '#') + '">View more' + ICONS.arrow + '</a></div>' +
        '<div class="nm-cases-grid">' + m.cases.map(cardHTML).join('') + '</div></div></div>';
    }
    return '<div class="nm-grid2">' + left + '<div class="nm-list">' + m.links.map(itemHTML).join('') + '</div></div>';
  }

  var current = null, closeT = null;
  function openE(e) { clearTimeout(closeT); if (current && current !== e) shut(current); current = e; e.panel.classList.add('open'); e.trigger.setAttribute('aria-expanded', 'true'); }
  function shut(e) { e.panel.classList.remove('open'); e.trigger.setAttribute('aria-expanded', 'false'); if (current === e) current = null; }

  var built = 0;
  Array.prototype.forEach.call(linksWrap.querySelectorAll('a'), function (a) {
    var href = (a.getAttribute('href') || '').split('#')[0];
    var m = MENUS[href];
    if (!m) return;
    a.classList.add('nm-trigger');
    a.setAttribute('aria-haspopup', 'true');
    a.setAttribute('aria-expanded', 'false');
    a.insertAdjacentHTML('beforeend', ICONS.caret);
    var caretEl = a.querySelector('.nm-caret');
    if (caretEl) { caretEl.setAttribute('role', 'button'); caretEl.setAttribute('aria-label', (a.textContent || '').trim() + ' menu'); }
    var panel = document.createElement('div');
    panel.className = 'nm-panel';
    panel.innerHTML = panelHTML(m);
    linksWrap.appendChild(panel);
    var e = { trigger: a, panel: panel };
    a.addEventListener('click', function (ev) {
      // chevron toggles the menu; the label navigates to the page
      var onCaret = caretEl && (ev.target === caretEl || caretEl.contains(ev.target));
      if (!onCaret) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (current === e) shut(e); else openE(e);
    });
    built++;
  });

  if (built) {
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && current) shut(current); });
    document.addEventListener('click', function (ev) { if (current && !current.panel.contains(ev.target) && !current.trigger.contains(ev.target)) shut(current); });
  }
})();

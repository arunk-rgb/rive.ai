// careers.js — functional careers page: filter/search roles, role detail modal,
// and a client-side application form (validates + confirms; front-end only).
(function () {
  var ROLES = [
    {
      id: 'founding-swe', title: 'Founding software engineer', dept: 'Engineering',
      loc: 'Mountain View / Remote', type: 'Full-time',
      blurb: 'Own core platform systems end to end, from ingestion and the knowledge graph to the execution layer that writes back into SAP, Maximo, and SCADA.',
      resp: ['Design and ship services across ingestion, the knowledge graph, and execution.', 'Turn messy industrial data into a reliable, queryable model.', 'Set engineering standards and mentor as one of the first hires.'],
      req: ['5+ years building production backend systems.', 'Strong systems fundamentals and a bias for pragmatism.', 'Comfort with ambiguity and direct customer contact.']
    },
    {
      id: 'ml-agents', title: 'ML engineer, industrial agents', dept: 'Research',
      loc: 'Mountain View', type: 'Full-time',
      blurb: 'Build the agents that detect, decide, and act across live industrial operations.',
      resp: ['Develop agent workflows grounded in real customer systems.', 'Evaluate and harden models for reliability in the field.', 'Partner with deployment on live operations.'],
      req: ['Experience with LLM / agent systems in production.', 'Solid ML engineering and evaluation skills.', 'Bias toward measurable, real-world impact.']
    },
    {
      id: 'fdse', title: 'Forward-deployed solutions architect', dept: 'Field',
      loc: 'Remote (US)', type: 'Full-time',
      blurb: 'Embed with industrial customers to stand up Rive on their operation and prove value fast.',
      resp: ['Own technical delivery from pilot through production.', 'Integrate Rive with plant systems and data sources.', 'Translate field learnings back into the product.'],
      req: ['Strong technical and customer-facing background.', 'Willingness to travel to industrial sites.', 'Experience with industrial or enterprise systems a plus.']
    },
    {
      id: 'designer', title: 'Product designer', dept: 'Design',
      loc: 'Mountain View / Remote', type: 'Full-time',
      blurb: 'Shape how operators experience decision intelligence, from the graph to the moment of action.',
      resp: ['Design end-to-end flows for complex industrial workflows.', 'Prototype and validate with real operators.', 'Own the design system alongside engineering.'],
      req: ['Portfolio of shipped, complex product work.', 'Strong systems thinking and craft.', 'Comfort in a fast, ambiguous environment.']
    },
    {
      id: 'gtm', title: 'Founding go-to-market lead', dept: 'Field',
      loc: 'Mountain View', type: 'Full-time',
      blurb: 'Build the motion that brings Rive to the world’s most demanding operations.',
      resp: ['Own pipeline from first conversation to signed pilot.', 'Craft the narrative for industrial buyers.', 'Lay the foundation for the go-to-market team.'],
      req: ['Enterprise or industrial sales experience.', 'Technical fluency and executive presence.', 'A founder mentality.']
    }
  ];

  var list = document.getElementById('roleList');
  var empty = document.getElementById('roleEmpty');
  var countEl = document.getElementById('roleCount');
  var chipsWrap = document.getElementById('deptChips');
  var overlay = document.getElementById('roleModal');
  var body = document.getElementById('cmBody');
  var closeBtn = document.getElementById('cmClose');
  if (!list || !overlay) return;

  var state = { dept: 'all' };
  var lastFocus = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ARROW = '<svg class="role-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  function filtered() {
    return ROLES.filter(function (r) { return state.dept === 'all' || r.dept === state.dept; });
  }

  function render() {
    var rows = filtered();
    list.innerHTML = rows.map(function (r) {
      return '<button class="role-row" type="button" data-id="' + r.id + '">' +
        '<span class="role-dept">' + esc(r.dept) + '</span>' +
        '<span class="role-title">' + esc(r.title) + '</span>' +
        ARROW + '</button>';
    }).join('');
    empty.hidden = rows.length !== 0;
    list.hidden = rows.length === 0;
    if (countEl) countEl.textContent = ROLES.length;
  }

  // ---- modal ----
  function openModal(html) {
    lastFocus = document.activeElement;
    body.innerHTML = html;
    overlay.hidden = false;
    document.body.classList.add('cm-lock');
    requestAnimationFrame(function () { overlay.classList.add('open'); });
    var f = body.querySelector('input, textarea, button');
    if (f) f.focus();
    wireForm();
  }
  function closeModal() {
    overlay.classList.remove('open');
    document.body.classList.remove('cm-lock');
    setTimeout(function () { overlay.hidden = true; body.innerHTML = ''; }, 250);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function applyFormHTML(roleTitle) {
    return '<form class="cm-form" novalidate data-role="' + esc(roleTitle) + '">' +
      '<div class="frow two">' +
        '<div class="cm-field"><label>Full name</label><input type="text" name="name" placeholder="Your name" required></div>' +
        '<div class="cm-field"><label>Email</label><input type="email" name="email" placeholder="you@email.com" required></div>' +
      '</div>' +
      '<div class="frow"><div class="cm-field"><label>Portfolio or LinkedIn</label><input type="url" name="link" placeholder="https://" required></div></div>' +
      '<div class="frow"><div class="cm-field"><label>Why Rive?</label><textarea name="note" placeholder="A few lines on what draws you to this role" required></textarea></div></div>' +
      '<button type="submit" class="cm-submit">Submit application</button>' +
    '</form>';
  }

  function roleModalHTML(r) {
    return '<p class="cm-kicker">' + esc(r.dept) + '</p>' +
      '<h2 class="cm-title" id="cmTitle">' + esc(r.title) + '</h2>' +
      '<p class="cm-meta">' + esc(r.loc) + ' &middot; ' + esc(r.type) + '</p>' +
      '<div class="cm-sec"><p>' + esc(r.blurb) + '</p></div>' +
      '<div class="cm-sec"><h4>What you’ll do</h4><ul>' + r.resp.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="cm-sec"><h4>What we look for</h4><ul>' + r.req.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="cm-divider"></div>' +
      '<div class="cm-sec"><h4>Apply</h4></div>' +
      applyFormHTML(r.title);
  }

  function generalModalHTML() {
    return '<p class="cm-kicker">General application</p>' +
      '<h2 class="cm-title" id="cmTitle">Tell us how you’d contribute</h2>' +
      '<p class="cm-meta">Rive Labs, Inc. &middot; Mountain View / Remote</p>' +
      '<div class="cm-sec"><p>We’re always glad to meet exceptional people, even without a matching role. Share what you’d want to build.</p></div>' +
      '<div class="cm-divider"></div>' +
      applyFormHTML('General application');
  }

  function wireForm() {
    var form = body.querySelector('.cm-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var role = form.getAttribute('data-role') || 'your application';
      body.innerHTML = '<div class="cm-done"><div class="ico">&#10003;</div>' +
        '<h3>Application received</h3>' +
        '<p>Thanks for applying to <strong>' + esc(role) + '</strong>. We’ll review and be in touch by email.</p>' +
        '<button type="button" class="cm-submit" id="cmDoneClose" style="max-width:200px;margin:22px auto 0">Close</button></div>';
      var b = document.getElementById('cmDoneClose');
      if (b) { b.addEventListener('click', closeModal); b.focus(); }
    });
  }

  // ---- events ----
  function setDept(dept) {
    state.dept = dept;
    Array.prototype.forEach.call(chipsWrap.querySelectorAll('.rp'), function (c) { c.classList.toggle('is-active', c.getAttribute('data-dept') === dept); });
    render();
  }
  list.addEventListener('click', function (e) {
    var btn = e.target.closest('.role-row');
    if (!btn) return;
    var r = ROLES.filter(function (x) { return x.id === btn.getAttribute('data-id'); })[0];
    if (r) openModal(roleModalHTML(r));
  });
  chipsWrap.addEventListener('click', function (e) {
    var chip = e.target.closest('.rp');
    if (chip) setDept(chip.getAttribute('data-dept'));
  });
  var reset = document.getElementById('roleReset');
  if (reset) reset.addEventListener('click', function () { setDept('all'); });
  var gen = document.getElementById('generalApply');
  if (gen) gen.addEventListener('click', function () { openModal(generalModalHTML()); });

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

  render();
})();

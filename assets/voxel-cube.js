// voxel-cube.js — scroll-driven voxel-fragment cube assembly (Three.js, vanilla ESM)
// Exports init(container, options) and destroy(). Decorative background only.
//
// Concept: scattered voxel fragments assemble into a porous cube as scroll goes
// 0 -> 1, then compact into a tighter solid; reversing scrubs it backward. Scroll
// position drives the timeline directly (damped), not a time loop.

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ---------------------------------------------------------------------------
// TUNABLES
// ---------------------------------------------------------------------------
const CONFIG = {
  instanceCap: 1400,           // hard ceiling on instances
  grid: [11, 11, 11],          // central lattice dimensions (desktop)
  gridSmall: [9, 9, 9],        // degraded lattice on small viewports
  fillRatio: 0.72,             // fraction of lattice cells kept (voids -> porous)
  cubeSize: 0.42,              // edge length of each small cube
  porousSpacing: 0.64,         // cell spacing in the porous (assembled) state
  solidSpacing: 0.45,          // cell spacing after compaction (near-touching)
  scatterRadius: 6,            // fragments start as a loose cloud near the cube (gentle gather, no chaos)
  clusterCount: 20,            // scattered clusters
  clusterSpread: 1.2,          // jitter within a cluster
  seed: 20260219,              // mulberry32 seed -> identical layout every load
  cameraAzimuthDeg: 45,        // three-quarter
  cameraElevationDeg: 35,      // ~35 deg looking down
  orthoZoom: 6.6,              // half-height of ortho frustum (smaller = bigger cube)
  beamCount: 9,
  beamY: -0.2,
  rotSpeedSettled: 0.12,       // rad/s slow Y spin when settled
  damp: 0.1,                   // scroll smoothing factor
  dprCap: 2,
  palette: {
    grayA: 0xd6d6de, grayB: 0xe7e5ee, lavender: 0xcbc5e6,
    indigo: 0x8a80d8, beam: 0x36e4ff,
    bgInner: 0x24262d, bgOuter: 0x141519,
  },
  // phase-timing data model (scroll progress ranges)
  phases: {
    idleEnd: 0.02,
    assembleStart: 0.0, assembleEnd: 0.44, staggerSpan: 0.30, pieceDur: 0.22,
    beamStart: 0.55, beamEnd: 0.80,
    compactStart: 0.70, compactEnd: 0.90,
    settleStart: 0.90,
  },
};

// ---------------------------------------------------------------------------
// MATH HELPERS
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
// ease-out-back (overshoot / snap)
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function randomQuat(rng, q) {
  const u1 = rng(), u2 = rng(), u3 = rng();
  const s1 = Math.sqrt(1 - u1), s2 = Math.sqrt(u1);
  q.set(s1 * Math.sin(2 * Math.PI * u2), s1 * Math.cos(2 * Math.PI * u2),
        s2 * Math.sin(2 * Math.PI * u3), s2 * Math.cos(2 * Math.PI * u3));
  return q;
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------
export function init(container, options = {}) {
  const opts = Object.assign({ zIndex: -1, fadeWithView: true }, options);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // canvas (fullscreen fixed, behind content)
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: String(opts.zIndex), pointerEvents: 'none', display: 'block',
    opacity: opts.fadeWithView ? '0' : '1', transition: 'opacity .45s ease',
  });
  document.body.appendChild(canvas);

  // WebGL availability check -> clean fallback
  let gl = null;
  try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch (e) { gl = null; }
  if (!gl) {
    canvas.style.background =
      'radial-gradient(120% 120% at 50% 42%, #24262d 0%, #141519 70%)';
    canvas.style.opacity = '1';
    return { destroy() { canvas.remove(); } };
  }

  const P = CONFIG.phases;
  const small = Math.min(window.innerWidth, window.innerHeight) < 760;
  const grid = small ? CONFIG.gridSmall : CONFIG.grid;

  // ---- renderer / scene / camera ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.dprCap));
  renderer.setClearColor(CONFIG.palette.bgOuter, 1);

  const scene = new THREE.Scene();
  scene.background = makeRadialBackground();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const az = THREE.MathUtils.degToRad(CONFIG.cameraAzimuthDeg);
  const el = THREE.MathUtils.degToRad(CONFIG.cameraElevationDeg);
  const dist = 40;
  camera.position.set(
    dist * Math.cos(el) * Math.cos(az),
    dist * Math.sin(el),
    dist * Math.cos(el) * Math.sin(az)
  );
  camera.lookAt(0, 0, 0);

  // ---- lights (matte plastic) ----
  scene.add(new THREE.HemisphereLight(0xf2f0ff, 0x30323a, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(6, 12, 8); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfc6ff, 0.35);
  fill.position.set(-8, 3, -6); scene.add(fill);
  const glowLight = new THREE.PointLight(CONFIG.palette.indigo, 0.0, 9, 2);
  scene.add(glowLight);

  // ---- instances ----
  const rng = mulberry32(CONFIG.seed);
  const cx = (grid[0] - 1) / 2, cy = (grid[1] - 1) / 2, cz = (grid[2] - 1) / 2;

  // pick filled lattice cells (porous)
  const cells = [];
  for (let x = 0; x < grid[0]; x++)
    for (let y = 0; y < grid[1]; y++)
      for (let z = 0; z < grid[2]; z++)
        if (rng() < CONFIG.fillRatio) cells.push([x, y, z]);
  if (cells.length > CONFIG.instanceCap) cells.length = CONFIG.instanceCap;
  const N = cells.length;

  // scattered cluster centers (various depths)
  const clusters = [];
  for (let c = 0; c < CONFIG.clusterCount; c++) {
    const r = CONFIG.scatterRadius * (0.78 + 0.32 * rng()); // keep them beyond the frustum
    const a = rng() * Math.PI * 2;
    clusters.push(new THREE.Vector3(
      Math.cos(a) * r,
      (rng() - 0.5) * CONFIG.scatterRadius * 1.3,
      Math.sin(a) * r * 0.8 + (rng() - 0.5) * 3
    ));
  }

  // flat precomputed buffers
  const startPos = new Float32Array(N * 3);
  const startQuat = new Float32Array(N * 4);
  const endPorous = new Float32Array(N * 3);
  const endSolid = new Float32Array(N * 3);
  const stagger = new Float32Array(N);
  const tq = new THREE.Quaternion();

  let maxR = 0.0001;
  for (let i = 0; i < N; i++) {
    const [gx, gy, gz] = cells[i];
    const ex = (gx - cx), ey = (gy - cy), ez = (gz - cz);
    endPorous[i * 3] = ex * CONFIG.porousSpacing;
    endPorous[i * 3 + 1] = ey * CONFIG.porousSpacing;
    endPorous[i * 3 + 2] = ez * CONFIG.porousSpacing;
    endSolid[i * 3] = ex * CONFIG.solidSpacing;
    endSolid[i * 3 + 1] = ey * CONFIG.solidSpacing;
    endSolid[i * 3 + 2] = ez * CONFIG.solidSpacing;
    maxR = Math.max(maxR, Math.hypot(ex, ey, ez));
  }
  for (let i = 0; i < N; i++) {
    // scatter from a cluster
    const cl = clusters[i % clusters.length];
    startPos[i * 3] = cl.x + (rng() - 0.5) * CONFIG.clusterSpread * 2;
    startPos[i * 3 + 1] = cl.y + (rng() - 0.5) * CONFIG.clusterSpread * 2;
    startPos[i * 3 + 2] = cl.z + (rng() - 0.5) * CONFIG.clusterSpread * 2;
    randomQuat(rng, tq);
    startQuat[i * 4] = tq.x; startQuat[i * 4 + 1] = tq.y;
    startQuat[i * 4 + 2] = tq.z; startQuat[i * 4 + 3] = tq.w;
    // outer fragments start earlier -> smaller offset
    const nr = Math.hypot(endSolid[i * 3], endSolid[i * 3 + 1], endSolid[i * 3 + 2]) / (maxR * CONFIG.solidSpacing);
    stagger[i] = 1 - clamp(nr, 0, 1);
  }

  // geometry + material + instanced mesh
  const geo = new THREE.BoxGeometry(CONFIG.cubeSize, CONFIG.cubeSize, CONFIG.cubeSize);
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.82, metalness: 0.02,
    emissive: new THREE.Color(CONFIG.palette.indigo), emissiveIntensity: 0.0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // per-instance colours (inner -> lavender/indigo, outer -> gray)
  const cGray = new THREE.Color(CONFIG.palette.grayA);
  const cGray2 = new THREE.Color(CONFIG.palette.grayB);
  const cLav = new THREE.Color(CONFIG.palette.lavender);
  const cIndigo = new THREE.Color(CONFIG.palette.indigo);
  const tmpC = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const inner = 1 - Math.hypot(endSolid[i * 3], endSolid[i * 3 + 1], endSolid[i * 3 + 2]) / (maxR * CONFIG.solidSpacing);
    tmpC.copy(rng() < 0.5 ? cGray : cGray2).lerp(cLav, 0.35 * rng());
    if (inner > 0.62) tmpC.lerp(cIndigo, (inner - 0.62) * 1.4 * rng());
    mesh.setColorAt(i, tmpC);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  // ---- fake soft contact shadow ----
  const shadowTex = makeRadialShadow();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex, transparent: true, depthWrite: false, opacity: 0,
    blending: THREE.NormalBlending,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  const solidExtent = maxR * CONFIG.solidSpacing;
  shadow.position.y = -solidExtent - CONFIG.cubeSize;
  shadow.scale.setScalar(solidExtent * 4.5);
  scene.add(shadow);

  // ---- cyan beam lattice ----
  const beamGroup = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: CONFIG.palette.beam, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beamLen = 9.5;
  for (let k = 0; k < CONFIG.beamCount; k++) {
    const along = k % 2 === 0;
    const off = ((k % 5) - 2) * 1.6;
    const g = new THREE.BoxGeometry(along ? beamLen : 0.035, 0.035, along ? 0.035 : beamLen);
    const b = new THREE.Mesh(g, beamMat);
    b.position.set(along ? 0 : off, CONFIG.beamY, along ? off : 0);
    beamGroup.add(b);
  }
  scene.add(beamGroup);

  // ---------------------------------------------------------------------
  // per-frame state
  // ---------------------------------------------------------------------
  const _pos = new THREE.Vector3();
  const _sPos = new THREE.Vector3();
  const _ePos = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _qs = new THREE.Quaternion();
  const _qe = new THREE.Quaternion(0, 0, 0, 1);
  const _scale = new THREE.Vector3(1, 1, 1);
  const _m = new THREE.Matrix4();
  const _driftAxis = new THREE.Vector3();

  let smoothed = reduced ? 1 : 0;
  let lastRendered = -1;
  let raf = 0, running = false, visible = !opts.fadeWithView;
  let elapsed = 0, lastT = 0, settleClock = 0;

  function rawProgress() {
    const rect = container.getBoundingClientRect();
    const denom = rect.height - window.innerHeight;
    if (denom <= 0) return 0;
    return clamp(-rect.top / denom, 0, 1);
  }

  function writeInstances(s, drift) {
    for (let i = 0; i < N; i++) {
      // outer fragments start earlier (small stagger), inner land last
      const pieceStart = P.assembleStart + stagger[i] * P.staggerSpan;
      const local = clamp((s - pieceStart) / P.pieceDur, 0, 1);
      const eased = local <= 0 ? 0 : (local >= 1 ? 1 : easeOutBack(local));

      // compaction: porous -> solid
      const c = smoothstep(P.compactStart, P.compactEnd, s);
      _ePos.set(
        lerp(endPorous[i * 3], endSolid[i * 3], c),
        lerp(endPorous[i * 3 + 1], endSolid[i * 3 + 1], c),
        lerp(endPorous[i * 3 + 2], endSolid[i * 3 + 2], c)
      );
      _sPos.set(startPos[i * 3], startPos[i * 3 + 1], startPos[i * 3 + 2]);

      // idle drift on the scattered fragments
      if (drift > 0.0001) {
        _driftAxis.set(
          Math.sin(elapsed * 0.5 + i * 1.3),
          Math.cos(elapsed * 0.4 + i * 0.7),
          Math.sin(elapsed * 0.45 + i * 2.1)
        );
        _sPos.addScaledVector(_driftAxis, drift * 0.28);
      }

      _pos.lerpVectors(_sPos, _ePos, eased);

      _qs.set(startQuat[i * 4], startQuat[i * 4 + 1], startQuat[i * 4 + 2], startQuat[i * 4 + 3]);
      _q.slerpQuaternions(_qs, _qe, eased);

      _m.compose(_pos, _q, _scale);
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function renderFrame(s) {
    const idle = 1 - smoothstep(0, P.idleEnd, s);           // 1 at rest, 0 by idleEnd
    const settleF = smoothstep(P.settleStart, 1.0, s);

    writeInstances(s, idle);

    // beams: idle pulse, then retract to center + fade (beamStart..beamEnd)
    const retract = smoothstep(P.beamStart, P.beamEnd, s);
    const pulse = 0.75 + 0.25 * Math.sin(elapsed * 2.2) * idle;
    beamGroup.scale.setScalar(lerp(1, 0.02, retract));
    beamMat.opacity = clamp((1 - retract) * pulse * (0.35 + 0.55 * (1 - idle * 0.4)), 0, 1);

    // indigo interior glow: intensify 0.70..0.90, then settle + breathe
    const rise = smoothstep(P.compactStart, 0.86, s);
    const fallToSettle = smoothstep(0.86, 1.0, s);
    let glow = 0.15 + rise * 1.7 - fallToSettle * 0.85;
    const breathe = 0.12 * Math.sin(elapsed * 1.3) * settleF;
    glowLight.intensity = Math.max(0, glow + breathe * 1.2);
    mat.emissiveIntensity = Math.max(0, 0.05 + glow * 0.35 + breathe);

    // contact shadow fades in as the cube forms
    shadowMat.opacity = smoothstep(0.2, 0.72, s) * 0.5;

    // settled slow Y spin
    mesh.rotation.y = settleF * elapsed * CONFIG.rotSpeedSettled;

    renderer.render(scene, camera);
    lastRendered = s;
  }

  function frame(now) {
    if (!running) return;
    const dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 0.016;
    lastT = now; elapsed += dt;

    const target = reduced ? 1 : rawProgress();
    smoothed += (target - smoothed) * CONFIG.damp;

    const inIdlePhase = smoothed < P.idleEnd || smoothed > P.settleStart;
    const delta = Math.abs(smoothed - lastRendered);
    if (delta >= 0.0001 || inIdlePhase) renderFrame(smoothed);

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true; lastT = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // ---- sizing ----
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const hh = CONFIG.orthoZoom, hw = hh * aspect;
    camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
    camera.updateProjectionMatrix();
    lastRendered = -1; // force a redraw
  }
  resize();

  // ---- reduced motion: one static settled frame, no scroll response ----
  if (reduced) {
    canvas.style.opacity = '1';
    smoothed = 1;
    renderFrame(1);
    const onResizeStatic = () => { resize(); renderFrame(1); };
    window.addEventListener('resize', onResizeStatic);
    return {
      destroy() {
        window.removeEventListener('resize', onResizeStatic);
        disposeAll();
      },
    };
  }

  // ---- pause when offscreen / tab hidden ----
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (opts.fadeWithView) canvas.style.opacity = visible ? '1' : '0';
    if (visible && !document.hidden) start(); else stop();
  }, { threshold: 0 });
  io.observe(container);

  function onVisibility() {
    if (document.hidden) stop();
    else if (visible) start();
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', resize);

  // ---- helpers that need closure scope ----
  function makeRadialBackground() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(256, 220, 40, 256, 256, 380);
    g.addColorStop(0, '#' + CONFIG.palette.bgInner.toString(16).padStart(6, '0'));
    g.addColorStop(1, '#' + CONFIG.palette.bgOuter.toString(16).padStart(6, '0'));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function makeRadialShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  function disposeAll() {
    stop();
    geo.dispose(); mat.dispose();
    beamGroup.children.forEach((b) => b.geometry.dispose());
    beamMat.dispose();
    shadow.geometry.dispose(); shadowMat.dispose(); shadowTex.dispose();
    if (scene.background && scene.background.dispose) scene.background.dispose();
    renderer.dispose();
    canvas.remove();
  }

  // kick off (start immediately if we aren't gating on view)
  if (!opts.fadeWithView) start();

  return {
    destroy() {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      disposeAll();
    },
  };
}

export default { init };

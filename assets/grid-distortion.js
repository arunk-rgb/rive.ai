// grid-distortion.js — vanilla port of React Bits' <GridDistortion /> (Three.js).
// Renders an image on a plane and warps it with a mouse-driven data-texture grid.
// Expects window.THREE to be set (loaded as an ES module by the host page).
// window.initGridDistortion(container, opts) -> { destroy() }
(function () {
  window.initGridDistortion = function (container, opts) {
    var THREE = window.THREE;
    if (!container || !THREE) return { destroy: function () {} };
    opts = opts || {};
    var grid = opts.grid || 15;
    var mouse = opts.mouse != null ? opts.mouse : 0.1;
    var strength = opts.strength != null ? opts.strength : 0.15;
    var relaxation = opts.relaxation != null ? opts.relaxation : 0.9;
    var interactive = opts.interactive !== false;
    var imageSrc = opts.imageSrc;

    var vertexShader =
      'uniform float time;varying vec2 vUv;varying vec3 vPosition;' +
      'void main(){vUv=uv;vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
    var fragmentShader =
      'uniform sampler2D uDataTexture;uniform sampler2D uTexture;uniform vec4 resolution;' +
      'uniform float uContainerAspect;uniform float uImageAspect;varying vec2 vUv;' +
      'void main(){float cA=uContainerAspect;float iA=uImageAspect;vec2 uv=vUv;' +
      'if(cA>iA){uv.y=(uv.y-0.5)*(iA/cA)+0.5;}else{uv.x=(uv.x-0.5)*(cA/iA)+0.5;}' +
      'vec4 offset=texture2D(uDataTexture,vUv);gl_FragColor=texture2D(uTexture,uv-0.02*offset.rg);}';

    var scene = new THREE.Scene();
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    var camera = new THREE.OrthographicCamera(0, 0, 0, 0, -1000, 1000);
    camera.position.z = 2;

    var uniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector4() },
      uTexture: { value: null },
      uDataTexture: { value: null },
      uContainerAspect: { value: 1 },
      uImageAspect: { value: 1 }
    };

    var loader = new THREE.TextureLoader();
    loader.load(imageSrc, function (texture) {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      uniforms.uImageAspect.value = texture.image.width / texture.image.height;
      uniforms.uTexture.value = texture;
      resize();
    });

    var size = grid;
    var data = new Float32Array(4 * size * size);
    if (interactive) {
      for (var i = 0; i < size * size; i++) {
        data[i * 4] = Math.random() * 255 - 125;
        data[i * 4 + 1] = Math.random() * 255 - 125;
      }
    }
    var dataTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    dataTexture.needsUpdate = true;
    uniforms.uDataTexture.value = dataTexture;

    var material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: uniforms,
      vertexShader: vertexShader, fragmentShader: fragmentShader, transparent: true
    });
    var geometry = new THREE.PlaneGeometry(1, 1, size - 1, size - 1);
    var plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    function resize() {
      var rect = container.getBoundingClientRect();
      var w = rect.width, h = rect.height;
      if (w === 0 || h === 0) return;
      var containerAspect = w / h;
      renderer.setSize(w, h);
      plane.scale.set(containerAspect, 1, 1);
      var frustumHeight = 1;
      var frustumWidth = frustumHeight * containerAspect;
      camera.left = -frustumWidth / 2; camera.right = frustumWidth / 2;
      camera.top = frustumHeight / 2; camera.bottom = -frustumHeight / 2;
      camera.updateProjectionMatrix();
      uniforms.resolution.value.set(w, h, 1, 1);
      uniforms.uContainerAspect.value = containerAspect;
    }

    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(container); }
    else window.addEventListener('resize', resize);

    var ms = { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0 };
    function onMove(e) {
      var rect = container.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width;
      var y = 1 - (e.clientY - rect.top) / rect.height;
      ms.vX = x - ms.prevX; ms.vY = y - ms.prevY;
      ms.x = x; ms.y = y; ms.prevX = x; ms.prevY = y;
    }
    function onLeave() { dataTexture.needsUpdate = true; ms.x = ms.y = ms.prevX = ms.prevY = ms.vX = ms.vY = 0; }
    if (interactive) {
      container.addEventListener('mousemove', onMove);
      container.addEventListener('mouseleave', onLeave);
    }

    resize();

    var raf = null, running = false, visible = false;
    function frame() {
      if (!running) return;
      uniforms.time.value += 0.05;
      var d = dataTexture.image.data;
      for (var i = 0; i < size * size; i++) { d[i * 4] *= relaxation; d[i * 4 + 1] *= relaxation; }
      var gmx = size * ms.x, gmy = size * ms.y, maxDist = size * mouse;
      for (var a = 0; a < size; a++) {
        for (var b = 0; b < size; b++) {
          var distSq = Math.pow(gmx - a, 2) + Math.pow(gmy - b, 2);
          if (distSq < maxDist * maxDist) {
            var idx = 4 * (a + size * b);
            var power = Math.min(maxDist / Math.sqrt(distSq), 10);
            d[idx] += strength * 100 * ms.vX * power;
            d[idx + 1] -= strength * 100 * ms.vY * power;
          }
        }
      }
      dataTexture.needsUpdate = true;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running) return; running = true; raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    var io = new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }, { threshold: 0 });
    io.observe(container);
    function onVis() { if (document.hidden) stop(); else if (visible) start(); }
    document.addEventListener('visibilitychange', onVis);

    return {
      destroy: function () {
        stop(); io.disconnect();
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVis);
        container.removeEventListener('mousemove', onMove);
        container.removeEventListener('mouseleave', onLeave);
        try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
        if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        geometry.dispose(); material.dispose(); dataTexture.dispose();
        if (uniforms.uTexture.value) uniforms.uTexture.value.dispose();
      }
    };
  };
})();

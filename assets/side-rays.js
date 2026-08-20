// side-rays.js — vanilla WebGL port of React Bits' <SideRays /> (originally ogl-based).
// Fullscreen-triangle fragment shader. Time-driven volumetric light rays from a corner.
// window.initSideRays(canvas, host, opts) -> { destroy() }.  host = sizing/pause element.
(function () {
  var VERT = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}';

  var FRAG = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`;

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
  }
  function originToFlip(origin) {
    switch (origin) {
      case 'top-left': return [1, 0];
      case 'bottom-right': return [0, 1];
      case 'bottom-left': return [1, 1];
      default: return [0, 0]; // top-right
    }
  }

  window.initSideRays = function (canvas, host, opts) {
    opts = opts || {};
    var P = {
      speed:      opts.speed      != null ? opts.speed      : 2.5,
      rayColor1:  opts.rayColor1  || '#EAB308',
      rayColor2:  opts.rayColor2  || '#96c8ff',
      intensity:  opts.intensity  != null ? opts.intensity  : 2,
      spread:     opts.spread     != null ? opts.spread     : 2,
      origin:     opts.origin     || 'top-right',
      tilt:       opts.tilt       != null ? opts.tilt       : 0,
      saturation: opts.saturation != null ? opts.saturation : 1.5,
      blend:      opts.blend      != null ? opts.blend      : 0.75,
      falloff:    opts.falloff    != null ? opts.falloff    : 1.6,
      opacity:    opts.opacity    != null ? opts.opacity    : 1.0
    };

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false }) ||
           canvas.getContext('experimental-webgl', { antialias: false, alpha: true, premultipliedAlpha: false });
    } catch (e) { gl = null; }
    if (!gl) { return { destroy: function () {} }; }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var vertices = [-1, -1, 3, -1, -1, 3]; // fullscreen triangle
    var program, vs, fs, buffer, U = {};

    function compile(sh, src) {
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error('side-rays:', gl.getShaderInfoLog(sh));
    }
    function setup() {
      vs = gl.createShader(gl.VERTEX_SHADER); fs = gl.createShader(gl.FRAGMENT_SHADER);
      compile(vs, VERT); compile(fs, FRAG);
      program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error('side-rays:', gl.getProgramInfoLog(program));
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      var pos = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      ['iTime','iResolution','iSpeed','iRayColor1','iRayColor2','iIntensity','iSpread',
       'iFlipX','iFlipY','iTilt','iSaturation','iBlend','iFalloff','iOpacity'].forEach(function (n) {
        U[n] = gl.getUniformLocation(program, n);
      });
      gl.useProgram(program);
      var flip = originToFlip(P.origin);
      gl.uniform1f(U.iSpeed, P.speed);
      gl.uniform3fv(U.iRayColor1, hexToRgb(P.rayColor1));
      gl.uniform3fv(U.iRayColor2, hexToRgb(P.rayColor2));
      gl.uniform1f(U.iIntensity, P.intensity);
      gl.uniform1f(U.iSpread, P.spread);
      gl.uniform1f(U.iFlipX, flip[0]);
      gl.uniform1f(U.iFlipY, flip[1]);
      gl.uniform1f(U.iTilt, P.tilt);
      gl.uniform1f(U.iSaturation, P.saturation);
      gl.uniform1f(U.iBlend, P.blend);
      gl.uniform1f(U.iFalloff, P.falloff);
      gl.uniform1f(U.iOpacity, P.opacity);
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.floor(host.clientWidth * dpr));
      var h = Math.max(1, Math.floor(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform2f(U.iResolution, canvas.width, canvas.height);
    }
    function render(now) {
      if (!program) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.uniform1f(U.iTime, now * 1e-3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var raf = null, running = false, visible = false;
    function loop(now) { if (!running) return; render(now); raf = requestAnimationFrame(loop); }
    function start() { if (running) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    setup(); resize();
    window.addEventListener('resize', resize);
    var io = new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }, { threshold: 0 });
    io.observe(host);
    function onVis() { if (document.hidden) stop(); else if (visible) start(); }
    document.addEventListener('visibilitychange', onVis);

    return {
      destroy: function () {
        stop(); io.disconnect();
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVis);
        try {
          var lose = gl.getExtension('WEBGL_lose_context');
          if (lose) lose.loseContext();
        } catch (e) {}
        if (program) gl.deleteProgram(program);
        if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs);
        if (buffer) gl.deleteBuffer(buffer);
      }
    };
  };
})();

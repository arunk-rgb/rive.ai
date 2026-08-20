// shader-cta.js — vanilla port of the animated WebGL2 shader hero background.
// Shader by Matthias Hurrle (@atzedent). Time-driven only.
// window.initShaderCTA(canvas, host) -> { destroy() }.  host = the section (used for sizing + pause).
(function () {
  var VERT = '#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}';

  var FRAG = `#version 300 es
/*********
* made by Matthias Hurrle (@atzedent)
*/
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
float noise(in vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  float
  a=rnd(i),
  b=rnd(i+vec2(1,0)),
  c=rnd(i+vec2(0,1)),
  d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p) {
  float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);
  for (int i=0; i<5; i++) {
    t+=a*noise(p);
    p*=2.*m;
    a*=.5;
  }
  return t;
}
float clouds(vec2 p) {
	float d=1., t=.0;
	for (float i=.0; i<3.; i++) {
		float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
		t=mix(t,d,a);
		d=a;
		p*=2./(i+1.);
	}
	return t;
}
void main(void) {
	vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);
	vec3 col=vec3(0);
	float bg=clouds(vec2(st.x+T*.5,-st.y));
	uv*=1.-.3*(sin(T*.2)*.5+.5);
	for (float i=1.; i<12.; i++) {
		uv+=.1*cos(i*vec2(.1+.01*i, .8)+i*i+T*.5+.1*uv.x);
		vec2 p=uv;
		float d=length(p);
		col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);
		float b=noise(i+p+bg*1.731);
		col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
		col=mix(col,vec3(bg*.25,bg*.137,bg*.05),d);
	}
	O=vec4(col,1);
}`;

  window.initShaderCTA = function (canvas, host) {
    var gl = null;
    try { gl = canvas.getContext('webgl2', { antialias: false, alpha: false }); } catch (e) { gl = null; }
    if (!gl) { host.style.background = 'radial-gradient(120% 120% at 50% 40%, #12100c 0%, #000 70%)'; return { destroy: function () {} }; }

    var dpr = Math.max(1, 0.5 * (window.devicePixelRatio || 1));
    var vertices = [-1, 1, -1, -1, 1, 1, 1, -1];
    var program, vs, fs, buffer, uRes, uTime;

    function compile(sh, src) {
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error('shader-cta:', gl.getShaderInfoLog(sh));
    }
    function setup() {
      vs = gl.createShader(gl.VERTEX_SHADER); fs = gl.createShader(gl.FRAGMENT_SHADER);
      compile(vs, VERT); compile(fs, FRAG);
      program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error('shader-cta:', gl.getProgramInfoLog(program));
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      var pos = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      uRes = gl.getUniformLocation(program, 'resolution');
      uTime = gl.getUniformLocation(program, 'time');
    }
    function resize() {
      var w = Math.max(1, Math.floor(host.clientWidth * dpr));
      var h = Math.max(1, Math.floor(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function render(now) {
      if (!program) return;
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 1e-3);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
        if (program) { gl.deleteProgram(program); }
        if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs);
        if (buffer) gl.deleteBuffer(buffer);
      }
    };
  };
})();

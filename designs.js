// ============================================================
// 🎨 DESIGNS — ilova uchun 5 ta dizayn (mavzu) tizimi:
//   default  — Klassik (oddiy, avvalgi ko'rinish)
//   rings    — Magic Rings     (konsentrik porlovchi halqalar)
//   blinds   — Gradient Blinds (gradient "parda" plankalari)
//   grid     — Grid Scan       (perspektiv to'r tunnel + skaner nuri)
//   prism    — Prismatic Burst (aylanuvchi prizmatik nurlar)
// Har bir animatsion dizayn: bitta fixed <canvas id="design-bg"> (UI ortida,
// pointer-events:none) + xom WebGL fragment shader. WebGL bo'lmasa — statik
// CSS gradient. Tanlov localStorage 'appTheme' da, animatsiya — 'designAnim'.
// Bu fayl <head> ichida (script.js dan OLDIN) yuklanadi, shunda dizayn
// atributi birinchi chizishdan oldin qo'yiladi (miltillash bo'lmaydi).
// ============================================================
(function () {
  'use strict';

  var IDS = ['default', 'rings', 'blinds', 'grid', 'prism'];
  var LS_KEY = 'appTheme', ANIM_KEY = 'designAnim';
  var root = document.documentElement;

  function L(uz, en, ru) {
    try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {}
    return en;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ---------- Dizaynlar ta'rifi ----------
  var D = {
    default: { name: function () { return L('Klassik', 'Classic', 'Классика'); }, desc: function () { return L('Avvalgi oddiy ko\'rinish', 'The original clean look', 'Исходный простой вид'); }, base: '#0E0E12', meta: '#7C5CFC' },
    rings: { name: function () { return 'Magic Rings'; }, desc: function () { return L('Porlovchi sehrli halqalar', 'Glowing magic rings', 'Светящиеся кольца'); }, base: '#07050f', meta: '#130b24', scale: 0.6, idleHover: 0 },
    blinds: { name: function () { return 'Gradient Blinds'; }, desc: function () { return L('Yumshoq gradient pardalar', 'Soft gradient blinds', 'Мягкие градиентные жалюзи'); }, base: '#0b0618', meta: '#160b30', scale: 0.5, idleHover: 0.75 },
    grid: { name: function () { return 'Grid Scan'; }, desc: function () { return L('Skanerlovchi 3D to\'r', 'Scanning 3D grid', 'Сканирующая 3D-сетка'); }, base: '#07080c', meta: '#0b0d14', scale: 0.75, idleHover: 0.5 },
    prism: { name: function () { return 'Prismatic Burst'; }, desc: function () { return L('Prizmatik nur portlashi', 'Prismatic light burst', 'Призматическая вспышка'); }, base: '#06040d', meta: '#120a26', scale: 0.5, idleHover: 0.35 }
  };

  // ---------- Saqlangan tanlov + eski qiymatlar migratsiyasi ----------
  function normalize(id) { return IDS.indexOf(id) !== -1 ? id : 'default'; }
  var saved = lsGet(LS_KEY);
  var current = normalize(saved);
  if (saved !== null && saved !== current) lsSet(LS_KEY, current); // cyberpunk/ocean/sunset/forest/royal → default
  var animOn = lsGet(ANIM_KEY) !== '0';
  var reduceMQ = null;
  try { reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) {}
  function reducedMotion() { return !!(reduceMQ && reduceMQ.matches); }
  function isFx(id) { return id !== 'default'; }

  function setRootAttrs(id) {
    root.setAttribute('data-design', id);
    root.removeAttribute('data-theme');
    root.classList.toggle('design-fx', isFx(id));
    root.classList.toggle('design-forced-dark', isFx(id));
    try {
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', D[id].meta);
    } catch (e) {}
  }
  setRootAttrs(current);

  // ============================================================
  //  WebGL renderer
  // ============================================================
  var VERT = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  var HEAD = [
    '#ifdef GL_OES_standard_derivatives',
    '#extension GL_OES_standard_derivatives : enable',
    '#endif',
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uHover;',
    'uniform float uIntro;uniform float uPx;uniform float uCount;uniform vec4 uBursts[4];',
    'vec2 toUv(vec2 p){return (p-0.5*uRes)/min(uRes.x,uRes.y);}',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float band(float d,float w){return 1.0-smoothstep(0.0,w,abs(d));}',
    ''
  ].join('\n');

  // --- 1) Magic Rings: color #A855F7 → #6366F1, pulse, 6 rings, thickness 2, glow 1, hoverScale 1.2, clickBurst
  var FS_RINGS = HEAD + [
    'const vec3 C1=vec3(0.659,0.333,0.969);const vec3 C2=vec3(0.388,0.400,0.945);',
    'void main(){',
    '  vec2 uv=toUv(gl_FragCoord.xy);',
    '  vec2 c=vec2(0.0,0.06);',
    '  vec2 dv=uv-c; float d=length(dv); float ang=atan(dv.y,dv.x);',
    '  vec2 m=toUv(uMouse); float md=length(m-c);',
    '  vec3 col=vec3(0.020,0.012,0.045);',
    '  col+=mix(C1,C2,0.4)*0.16*exp(-d*2.6);',
    '  float lw=2.0*uPx;',
    '  for(int i=0;i<6;i++){',
    '    float fi=float(i); float k=fi/5.0;',
    '    float ph=uTime*1.7-fi*0.85;',
    '    float pulse=0.5+0.5*sin(ph);',
    '    float r0=0.10+fi*0.135;',
    '    float wob=(0.010*sin(ang*3.0+uTime*0.6+fi*1.3)+0.006*sin(ang*5.0-uTime*0.45+fi*2.1))*(r0*1.5);',
    '    float r=r0*(1.0+0.05*pulse)+wob;',
    '    float near=exp(-pow((md-r)/0.075,2.0))*uHover;',
    '    r*=mix(1.0,1.2,near*0.5);',
    '    float ad=abs(d-r);',
    '    float core=1.0-smoothstep(0.0,lw*(1.0+near),ad);',
    '    float halo=exp(-ad*34.0)*0.30+0.0035/(ad+0.03);',
    '    vec3 rc=mix(C1,C2,k);',
    '    col+=rc*(core*0.95+halo)*(0.45+0.55*pulse)*(1.0+near*1.2);',
    '  }',
    '  for(int j=0;j<4;j++){',
    '    vec4 b=uBursts[j];',
    '    if(b.z>=0.0&&b.z<2.0){',
    '      vec2 bp=toUv(b.xy); float bd=length(uv-bp);',
    '      for(int q=0;q<3;q++){',
    '        float a=b.z-float(q)*0.12; if(a<0.0) continue;',
    '        float br=a*0.55; float fade=exp(-a*2.4)*b.w;',
    '        float e=abs(bd-br);',
    '        col+=mix(C1,C2,float(q)/2.0)*((1.0-smoothstep(0.0,lw*1.6,e))*0.9+exp(-e*40.0)*0.35)*fade;',
    '      }',
    '    }',
    '  }',
    '  col*=1.0-0.45*smoothstep(0.35,1.25,length(uv));',
    '  col=1.0-exp(-col*1.25);',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  // --- 2) Gradient Blinds: ['#FF9FFC','#5227FF'], angle 20, blindCount 16 (min width 60px), spotlight 0.5,
  //        shine 0.4, relief 0.5, glow 0.4, sway 0.35, hoverTilt 0.6, ripple, noise 0.3
  var FS_BLINDS = HEAD + [
    'const vec3 GA=vec3(1.000,0.624,0.988);const vec3 GB=vec3(0.322,0.153,1.000);',
    'void main(){',
    '  vec2 p=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y;',
    '  vec2 q=vec2((p.x-0.5)*asp,p.y-0.5);',
    '  float an=radians(20.0); float ca=cos(an), sa=sin(an);',
    '  vec2 r=vec2(ca*q.x-sa*q.y, sa*q.x+ca*q.y);',
    '  vec2 mq=vec2((uMouse.x/uRes.x-0.5)*asp,uMouse.y/uRes.y-0.5);',
    '  vec2 mr=vec2(ca*mq.x-sa*mq.y, sa*mq.x+ca*mq.y);',
    '  float span=asp*ca+sa;',
    '  float sway=0.35*(0.055*sin(r.y*3.2+uTime*1.05)+0.025*sin(r.y*7.0-uTime*0.8));',
    '  float rip=0.0; float ripGlow=0.0;',
    '  for(int j=0;j<4;j++){',
    '    vec4 b=uBursts[j];',
    '    if(b.z>=0.0&&b.z<2.5){',
    '      vec2 bq=vec2((b.x/uRes.x-0.5)*asp,b.y/uRes.y-0.5);',
    '      float dd=length(q-bq); float w=b.z*0.7; float env=exp(-pow((dd-w)*7.0,2.0))*exp(-b.z*1.4)*b.w;',
    '      rip+=sin((dd-w)*38.0)*env; ripGlow+=env;',
    '    }',
    '  }',
    '  float x=r.x+sway+rip*0.025;',
    '  float sx=(x/span+0.5)*uCount; float idx=floor(sx); float f=fract(sx);',
    '  float mx=(mr.x/span+0.5)*uCount;',
    '  float inf=exp(-pow((idx+0.5-mx)/2.2,2.0))*exp(-pow((r.y-mr.y)/0.55,2.0))*uHover;',
    '  float tilt=0.6*inf*clamp(idx+0.5-mx,-1.0,1.0)*0.5;',
    '  float nx=(f-0.5)*2.0+tilt;',
    '  float relief=0.5;',
    '  float shade=1.0-relief*(0.5+0.5*nx)*0.95;',
    '  float gap=smoothstep(0.0,0.05,f)*(1.0-smoothstep(0.93,1.0,f));',
    '  float g=clamp((idx+0.5)/uCount*0.85+(r.y+0.5)*0.25-0.05,0.0,1.0);',
    '  vec3 base=mix(GA,GB,smoothstep(0.0,1.0,g));',
    '  float sd=length(q-mq);',
    '  float spot=exp(-pow(sd/0.5,2.0)*2.2)*(0.35+0.65*uHover);',
    '  float spec=pow(max(0.0,1.0-abs(f-0.28+tilt*0.25)*4.5),6.0)*0.4*(0.35+1.4*spot);',
    '  vec3 col=base*(0.10+0.55*shade)*gap*(0.45+0.9*spot);',
    '  col+=vec3(1.0,0.92,1.0)*spec*gap;',
    '  col+=base*0.4*spot*0.35;',
    '  col+=mix(GA,GB,0.5)*ripGlow*0.25;',
    '  col*=1.0-0.4*smoothstep(0.45,1.1,length(q));',
    '  col+=(hash(gl_FragCoord.xy+fract(uTime*7.13)*91.7)-0.5)*0.3*0.10;',
    '  col=clamp(col,0.0,1.0)*0.82;',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  // --- 3) Grid Scan: linesColor #4d4757, scanColor #7dd3fc, cells 8, depth 3, scanDuration 2.4, scanDelay 1.6, ping
  var FS_GRID = HEAD + [
    'const vec3 LC=vec3(0.302,0.278,0.341);const vec3 SC=vec3(0.490,0.827,0.988);',
    'float gridLine(vec2 s,float z){',
    '  vec2 g=abs(fract(s-0.5)-0.5);',
    '#ifdef GL_OES_standard_derivatives',
    '  vec2 w=fwidth(s)*1.2;',
    '#else',
    '  vec2 w=vec2(0.02+z*0.012);',
    '#endif',
    '  vec2 l=1.0-smoothstep(vec2(0.0),w,g);',
    '  return max(l.x,l.y);',
    '}',
    'void main(){',
    '  vec2 uv=toUv(gl_FragCoord.xy);',
    '  vec2 m=toUv(uMouse);',
    '  vec2 look=m*0.18*uHover;',
    '  vec3 rd=normalize(vec3(uv-look,0.85));',
    '  float HX=1.0, HY=0.8, LEN=3.0*2.0;',
    '  float tx=HX/max(abs(rd.x),1e-4); float ty=HY/max(abs(rd.y),1e-4);',
    '  float t=min(tx,ty); vec3 ph=rd*t; float cs=2.0*HX/8.0;',
    '  vec2 s; float z; float back=0.0;',
    '  if(ph.z>LEN){ t=LEN/rd.z; ph=rd*t; s=ph.xy/cs; z=LEN; back=1.0; }',
    '  else { z=ph.z; s=(tx<ty)? vec2(ph.y,ph.z)/cs : vec2(ph.x,ph.z)/cs; }',
    '  float line=gridLine(s,z);',
    '  float fog=exp(-z*0.32);',
    '  vec3 col=vec3(0.018,0.020,0.030)+vec3(0.03,0.032,0.045)*fog;',
    '  col+=LC*line*(0.4+0.9*fog)*(1.0-back*0.35);',
    '  float cyc=mod(uTime,4.0); float pr=clamp(cyc/2.4,0.0,1.0);',
    '  float act=(1.0-smoothstep(2.1,2.4,cyc))*smoothstep(0.0,0.15,cyc);',
    '  float zs=mix(0.9,LEN,pr*pr*(3.0-2.0*pr));',
    '  float bandv=exp(-pow((z-zs)/(0.32+zs*0.06),2.0))*(1.0-back*0.6);',
    '  float edge=exp(-pow((z-zs)/0.05,2.0))*(1.0-back);',
    '  col+=SC*act*(bandv*(line*1.25+0.05)+edge*0.18)*(0.25+0.6*fog)*smoothstep(0.4,1.6,z);',
    '  col+=SC*0.05*exp(-length(uv-look*0.5)*3.0);',
    '  for(int j=0;j<4;j++){',
    '    vec4 b=uBursts[j];',
    '    if(b.z>=0.0&&b.z<1.8){',
    '      vec2 bp=toUv(b.xy); float bd=length(uv-bp);',
    '      float br=b.z*0.45; float e=abs(bd-br); float fade=exp(-b.z*2.2)*b.w;',
    '      col+=SC*((1.0-smoothstep(0.0,2.0*uPx,e))*0.9+exp(-e*30.0)*0.3+line*0.6*(1.0-smoothstep(0.0,br,bd)))*fade;',
    '      col+=SC*exp(-bd*18.0)*fade*0.5*(1.0-smoothstep(0.0,0.3,b.z));',
    '    }',
    '  }',
    '  col*=1.0-0.35*smoothstep(0.5,1.3,length(uv));',
    '  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);',
    '}'
  ].join('\n');

  // --- 4) Prismatic Burst: ['#A855F7','#7C3AED','#6366F1'], rotate3d, intensity 2, speed 0.5, zoom 1,
  //        rayWidth 1, twist 0, mouseInteraction, clickBurst, intro
  var FS_PRISM = HEAD + [
    'const vec3 P1=vec3(0.659,0.333,0.969);const vec3 P2=vec3(0.486,0.227,0.929);const vec3 P3=vec3(0.388,0.400,0.945);',
    'vec3 pal(float t){t=fract(t)*3.0; vec3 a=mix(P1,P2,clamp(t,0.0,1.0)); a=mix(a,P3,clamp(t-1.0,0.0,1.0)); return mix(a,P1,clamp(t-2.0,0.0,1.0));}',
    'float rays(float a,float r,float t){',
    '  float tw=0.0*r;',
    '  float v=pow(0.5+0.5*sin(a*9.0+t*0.9+tw),6.0);',
    '  v+=0.65*pow(0.5+0.5*sin(a*15.0-t*1.3+1.7+tw),12.0);',
    '  v+=0.45*pow(0.5+0.5*sin(a*4.0+t*0.5+3.1),3.0);',
    '  return v;',
    '}',
    'void main(){',
    '  vec2 uv=toUv(gl_FragCoord.xy);',
    '  float intro=uIntro; float zoom=1.0*mix(2.2,1.0,intro);',
    '  vec2 m=toUv(uMouse);',
    '  vec2 c=mix(vec2(0.0,0.10),m,0.45*uHover);',
    '  vec2 p=(uv-c)*zoom;',
    '  float t=uTime*0.5;',
    '  float ax=0.55*sin(t*0.73), ay=0.55*cos(t*0.51);',
    '  vec3 rd=normalize(vec3(p,1.0));',
    '  float cx=cos(ax), sx=sin(ax), cy=cos(ay), sy=sin(ay);',
    '  rd=vec3(rd.x, cx*rd.y-sx*rd.z, sx*rd.y+cx*rd.z);',
    '  rd=vec3(cy*rd.x+sy*rd.z, rd.y, -sy*rd.x+cy*rd.z);',
    '  vec2 pp=rd.xy/max(rd.z,0.15);',
    '  float r=length(pp); float a=atan(pp.y,pp.x)+t*0.6;',
    '  float boost=0.0; vec3 flash=vec3(0.0);',
    '  for(int j=0;j<4;j++){',
    '    vec4 b=uBursts[j];',
    '    if(b.z>=0.0&&b.z<2.0){',
    '      float k=exp(-b.z*2.6)*b.w; boost+=k;',
    '      vec2 bp=toUv(b.xy); float bd=length(uv-bp); float e=abs(bd-b.z*0.7);',
    '      flash+=pal(b.z*0.3+float(j)*0.2)*(exp(-e*26.0)*0.55+exp(-bd*10.0)*0.6*(1.0-smoothstep(0.0,0.35,b.z)))*k;',
    '    }',
    '  }',
    '  float disp=0.022+0.02*boost;',
    '  vec3 rv=vec3(rays(a+disp,r,uTime),rays(a,r,uTime),rays(a-disp,r,uTime));',
    '  float fall=1.0/(1.0+r*r*2.2);',
    '  vec3 tint=pal(a/6.2831+t*0.08);',
    '  vec3 col=rv*mix(tint,vec3(1.0),0.18)*fall*(2.0*0.30)*(1.0+boost*0.8);',
    '  col+=tint*exp(-r*5.0)*0.55*(1.0+boost);',
    '  col+=vec3(1.0,0.95,1.0)*exp(-r*16.0)*0.35;',
    '  col+=flash;',
    '  col*=intro;',
    '  col*=1.0-0.35*smoothstep(0.45,1.3,length(uv));',
    '  col=1.0-exp(-col*1.1);',
    '  col=col*0.85+vec3(0.022,0.012,0.045);',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  var SHADERS = { rings: FS_RINGS, blinds: FS_BLINDS, grid: FS_GRID, prism: FS_PRISM };

  var R = {
    canvas: null, gl: null, prog: null, progId: null, buf: null, u: null, failed: false, lost: false,
    raf: 0, running: false, last: 0, time: 0, w: 0, h: 0, scale: 0.6,
    mouse: { x: 0, y: 0, tx: 0, ty: 0, hover: 0, th: 0, lastMove: -1e9, inited: false },
    bursts: [], introStart: -1, introDone: {}, frameN: 0, modalOpen: false
  };
  function isMobile() {
    try { return window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 700; } catch (e) { return false; }
  }

  function ensureCanvas() {
    if (R.canvas || !document.body) return R.canvas;
    var c = document.createElement('canvas');
    c.id = 'design-bg';
    c.setAttribute('aria-hidden', 'true');
    c.tabIndex = -1;
    document.body.insertBefore(c, document.body.firstChild);
    R.canvas = c;
    c.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); R.lost = true; R.prog = null; R.progId = null; R.buf = null; R.u = null; stopLoop();
    }, false);
    c.addEventListener('webglcontextrestored', function () {
      R.lost = false; R.gl = null; refresh();
    }, false);
    return c;
  }

  function getGL() {
    if (R.gl && !R.lost) return R.gl;
    if (R.failed || !R.canvas) return null;
    var gl = null;
    var opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    try { gl = R.canvas.getContext('webgl', opts) || R.canvas.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
    if (!gl) { R.failed = true; root.classList.add('design-nogl'); return null; }
    try { gl.getExtension('OES_standard_derivatives'); } catch (e) {}
    R.gl = gl;
    return gl;
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      console.warn('[designs] shader:', gl.getShaderInfoLog(s));
      gl.deleteShader(s); return null;
    }
    return s;
  }

  function useProgram(id) {
    var gl = getGL(); if (!gl) return false;
    if (R.progId === id && R.prog) return true;
    if (R.prog) { try { gl.deleteProgram(R.prog); } catch (e) {} R.prog = null; R.progId = null; }
    var vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, SHADERS[id]);
    if (!vs || !fs) { R.failed = !gl.isContextLost(); if (R.failed) root.classList.add('design-nogl'); return false; }
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('[designs] link:', gl.getProgramInfoLog(p));
      gl.deleteProgram(p); if (!gl.isContextLost()) { R.failed = true; root.classList.add('design-nogl'); } return false;
    }
    if (!R.buf) {
      R.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, R.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    }
    gl.useProgram(p);
    var loc = gl.getAttribLocation(p, 'aPos');
    gl.bindBuffer(gl.ARRAY_BUFFER, R.buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    R.u = {};
    ['uRes', 'uTime', 'uMouse', 'uHover', 'uIntro', 'uPx', 'uCount', 'uBursts'].forEach(function (n) {
      R.u[n] = gl.getUniformLocation(p, n === 'uBursts' ? 'uBursts[0]' : n);
    });
    R.prog = p; R.progId = id;
    return true;
  }

  function resize() {
    if (!R.canvas || !isFx(current)) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    R.scale = dpr * (D[current].scale || 0.6) * (isMobile() ? 1 : 0.9);
    var cw = window.innerWidth, ch = window.innerHeight;
    var w = Math.max(2, Math.round(cw * R.scale)), h = Math.max(2, Math.round(ch * R.scale));
    if (w !== R.w || h !== R.h) {
      R.w = w; R.h = h; R.canvas.width = w; R.canvas.height = h;
      if (!R.mouse.inited) { R.mouse.x = R.mouse.tx = w * 0.5; R.mouse.y = R.mouse.ty = h * 0.55; R.mouse.inited = true; }
    }
    if (!R.running) draw();
  }

  function animating() { return animOn && !reducedMotion(); }

  function draw() {
    if (!isFx(current) || R.lost) return;
    var gl = getGL(); if (!gl || !useProgram(current)) return;
    var M = R.mouse, u = R.u;
    // Sichqoncha uzoq vaqt qimirlamasa — "idle" yo'l bo'ylab sekin harakat (telefonlarda ham jonli ko'rinsin)
    var idle = (performance.now() - M.lastMove) > 3500;
    if (idle) {
      var tt = R.time;
      M.tx = R.w * (0.5 + 0.28 * Math.sin(tt * 0.31)); M.ty = R.h * (0.55 + 0.2 * Math.sin(tt * 0.23 + 1.3));
      M.th = D[current].idleHover || 0;
    }
    var k = R.running ? 0.12 : 1;
    M.x += (M.tx - M.x) * k; M.y += (M.ty - M.y) * k; M.hover += (M.th - M.hover) * (R.running ? 0.06 : 1);
    var intro = 1;
    if (current === 'prism' && R.introStart >= 0 && animating()) {
      intro = Math.min(1, (R.time - R.introStart) / 1.8); intro = 1 - Math.pow(1 - intro, 3);
      if (intro >= 1) R.introStart = -1;
    }
    gl.viewport(0, 0, R.w, R.h);
    gl.uniform2f(u.uRes, R.w, R.h);
    gl.uniform1f(u.uTime, R.time);
    gl.uniform2f(u.uMouse, M.x, M.y);
    gl.uniform1f(u.uHover, M.hover);
    gl.uniform1f(u.uIntro, intro);
    gl.uniform1f(u.uPx, R.scale / Math.min(R.w, R.h));
    gl.uniform1f(u.uCount, Math.max(4, Math.min(16, Math.floor(window.innerWidth / 60))));
    var arr = new Float32Array(16);
    for (var i = 0; i < 4; i++) {
      var b = R.bursts[i];
      arr[i * 4] = b ? b.x : 0; arr[i * 4 + 1] = b ? b.y : 0;
      arr[i * 4 + 2] = b ? (R.time - b.t) : -1; arr[i * 4 + 3] = b ? b.s : 0;
    }
    gl.uniform4fv(u.uBursts, arr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    R.raf = requestAnimationFrame(loop);
    if (++R.frameN % 20 === 0) R.modalOpen = !!document.querySelector('.modal-overlay.open, .x-ov.open');
    var fps = R.modalOpen ? 15 : (isMobile() ? 30 : 60);
    var dt = now - R.last;
    if (dt < 1000 / fps - 2) return;
    R.last = now;
    R.time += Math.min(dt, 100) / 1000;
    for (var i = R.bursts.length - 1; i >= 0; i--) if (R.time - R.bursts[i].t > 2.5) R.bursts.splice(i, 1);
    draw();
  }
  function startLoop() {
    if (R.running || document.hidden || !animating() || !isFx(current) || R.failed || R.lost) return;
    R.running = true; R.last = performance.now();
    R.raf = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (R.raf) cancelAnimationFrame(R.raf);
    R.raf = 0; R.running = false;
  }

  function refresh() {
    stopLoop();
    if (!isFx(current)) return;
    if (!ensureCanvas()) return;
    if (!getGL()) return;
    R.w = R.h = 0; resize();
    if (animating()) startLoop();
    else { if (R.time < 3) R.time = 3.2; draw(); }
  }

  // ---------- Pointer (window darajasida, UI ni bloklamaydi) ----------
  function toCanvas(e) {
    return { x: e.clientX * (R.w / Math.max(1, window.innerWidth)), y: R.h - e.clientY * (R.h / Math.max(1, window.innerHeight)) };
  }
  window.addEventListener('pointermove', function (e) {
    if (!R.running) return;
    var p = toCanvas(e);
    R.mouse.tx = p.x; R.mouse.ty = p.y; R.mouse.th = 1; R.mouse.lastMove = performance.now();
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (!R.running) return;
    var tg = e.target && e.target.closest ? e.target : null;
    if (tg && tg.closest('input, textarea, select, [contenteditable="true"]')) return; // yozish paytida — hech narsa
    var subtle = tg && tg.closest('button, a, label, [onclick], [role="button"], [role="switch"], .modal, .x-box');
    var p = toCanvas(e);
    R.mouse.tx = p.x; R.mouse.ty = p.y; R.mouse.th = 1; R.mouse.lastMove = performance.now();
    R.bursts.push({ x: p.x, y: p.y, t: R.time, s: subtle ? 0.35 : 1 });
    if (R.bursts.length > 4) R.bursts.shift();
  }, { passive: true });
  window.addEventListener('pointerleave', function () { R.mouse.lastMove = -1e9; }, { passive: true });

  var rzT = 0;
  function onResize() { clearTimeout(rzT); rzT = setTimeout(resize, 120); }
  window.addEventListener('resize', onResize, { passive: true });
  try { if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize, { passive: true }); } catch (e) {}
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop(); else startLoop();
  });
  if (reduceMQ) {
    var onRM = function () { refresh(); renderPicker(); };
    if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onRM); else if (reduceMQ.addListener) reduceMQ.addListener(onRM);
  }

  // ============================================================
  //  Qo'llash (apply) + Light rejim
  // ============================================================
  function syncLightClass() {
    if (!document.body) return;
    var wantLight = false;
    try { wantLight = typeof S !== 'undefined' && S && S.themeMode === 'light'; } catch (e) {}
    document.body.classList.toggle('light', wantLight && !isFx(current));
    try { if (typeof updateThemeToggleUI === 'function') updateThemeToggleUI(); } catch (e) {}
  }

  function apply(id, opts) {
    id = normalize(id);
    var changed = id !== current;
    current = id;
    lsSet(LS_KEY, id);
    setRootAttrs(id);
    if (id === 'prism' && changed) R.introStart = R.time; // har safar tanlanganda intro
    syncLightClass();
    refresh();
    renderPicker();
    if (changed && !(opts && opts.silent)) {
      try { if (typeof scheduleAppStateSync === 'function') scheduleAppStateSync(); } catch (e) {}
    }
  }

  function setAnim(on) {
    animOn = !!on;
    lsSet(ANIM_KEY, animOn ? '1' : '0');
    refresh();
    renderPicker();
  }

  // ============================================================
  //  Sozlamalar: dizayn tanlash kartalari + animatsiya toggle
  // ============================================================
  function esc2(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function renderPicker() {
    var host = document.getElementById('design-picker-root');
    if (!host) return;
    var html = '<div class="dz-title">🎨 ' + esc2(L('Dizayn mavzusi', 'Design theme', 'Тема оформления')) + '</div>' +
      '<div class="dz-grid" role="radiogroup" aria-label="' + esc2(L('Dizayn', 'Design', 'Дизайн')) + '">';
    IDS.forEach(function (id) {
      var sel = id === current;
      html += '<button type="button" class="dz-card' + (sel ? ' sel' : '') + '" role="radio" aria-checked="' + sel + '" data-design-pick="' + id + '">' +
        '<span class="dz-prev dz-prev-' + id + '"><span class="dz-prev-in"></span>' + (sel ? '<span class="dz-check">✓</span>' : '') + '</span>' +
        '<span class="dz-name">' + esc2(D[id].name()) + '</span>' +
        '<span class="dz-desc">' + esc2(D[id].desc()) + '</span></button>';
    });
    html += '</div>';
    var rm = reducedMotion();
    html += '<div class="dz-row">' +
      '<div style="min-width:0"><div class="dz-row-t">✨ ' + esc2(L('Animatsiya', 'Animation', 'Анимация')) + ': ' +
      esc2(animOn ? L('yoqilgan', 'on', 'включена') : L('o\'chirilgan', 'off', 'выключена')) + '</div>' +
      '<div class="dz-row-d">' + esc2(rm ? L('Tizimda "harakatni kamaytirish" yoqilgan — fon harakatsiz.', 'System "reduce motion" is on — the background stays still.', 'Включено «уменьшение движения» — фон статичен.')
        : L('O\'chirsangiz fon to\'xtaydi — batareya tejaladi.', 'Turn off to freeze the background and save battery.', 'Выключите, чтобы остановить фон и сберечь батарею.')) + '</div></div>' +
      '<div class="dz-switch' + (animOn ? ' on' : '') + '" role="switch" tabindex="0" aria-checked="' + animOn + '" data-design-anim="1"><div class="dz-knob"></div></div></div>';
    if (isFx(current)) {
      html += '<div class="dz-note">🌙 ' + esc2(L('Animatsion dizaynlar faqat tungi rejimda ishlaydi. Yorug\' rejim uchun "Klassik"ni tanlang.',
        'Animated designs always use dark mode. Pick "Classic" for light mode.', 'Анимированные темы всегда тёмные. Для светлой выберите «Классика».')) + '</div>';
    }
    host.innerHTML = html;
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-design-pick], [data-design-anim]') : null;
    if (!t) return;
    if (t.hasAttribute('data-design-pick')) {
      apply(t.getAttribute('data-design-pick'));
      try { if (typeof SFX !== 'undefined' && SFX.click) SFX.click(); } catch (e2) {}
    } else setAnim(!animOn);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.hasAttribute && e.target.hasAttribute('data-design-anim')) { e.preventDefault(); setAnim(!animOn); }
  });

  function darkNote() {
    var m = L('🌙 Animatsion dizaynda faqat tungi rejim. Yorug\' rejim uchun "Klassik" dizaynni tanlang.',
      '🌙 Animated designs are dark-only. Choose "Classic" to use light mode.', '🌙 Анимированные темы только тёмные. Выберите «Классика» для светлой.');
    try { if (typeof toast === 'function') { toast(m); return; } } catch (e) {}
  }

  // ---------- Global API ----------
  window.LUDesign = {
    apply: apply, current: function () { return current; }, list: IDS.slice(),
    forcesDark: function () { return isFx(current); }, setAnim: setAnim, anim: function () { return animOn; },
    darkNote: darkNote, renderPicker: renderPicker, syncLight: syncLightClass
  };
  window.changeAppTheme = function (id) { apply(id); }; // eski nom bilan moslik

  function boot() {
    if (current === 'prism') R.introStart = 0;
    refresh();
    renderPicker();
    // Til o'zgarganda kartalar matni ham yangilansin
    try {
      if (typeof window.applyLanguage === 'function' && !window.applyLanguage._dz) {
        var orig = window.applyLanguage;
        var wrapped = function () { var r = orig.apply(this, arguments); try { renderPicker(); } catch (e) {} return r; };
        wrapped._dz = true; window.applyLanguage = wrapped;
      }
    } catch (e) {}
    syncLightClass();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // Ilova S.themeMode ni keyinroq (loadTheme) qo'llaydi — animatsion dizaynda light'ni qaytaramiz
  window.addEventListener('load', function () { syncLightClass(); });
})();

// ============================================================
// 🎨 DESIGNS — ilova uchun 6 ta dizayn (mavzu) tizimi:
//   galaxy   — Galaxy          (yulduzlar maydoni + warp; WebGL2 bo'lsa #version 300 es, shaffof)
//   default  — Klassik (oddiy, avvalgi ko'rinish)
//   rings    — Magic Rings     (konsentrik porlovchi halqalar)
//   blinds   — Gradient Blinds (gradient "parda" plankalari)
//   grid     — Grid Scan       (perspektiv to'r tunnel + skaner nuri)
//   prism    — Prismatic Burst (aylanuvchi prizmatik nurlar)
// Har bir animatsion dizayn: bitta fixed <canvas id="design-bg"> (UI ortida,
// pointer-events:none) + xom WebGL fragment shader. WebGL bo'lmasa — statik
// CSS gradient. Tanlov localStorage 'appTheme' da, animatsiya — 'designAnim'.
// 🛍 Pullik dizaynlar (D[id].price) do'kondan sotib olinadi; faqat bepul yoki
// sotib olingan dizaynni qo'llash mumkin (Galaxy va Klassik — bepul).
// Bu fayl <head> ichida (script.js dan OLDIN) yuklanadi, shunda dizayn
// atributi birinchi chizishdan oldin qo'yiladi (miltillash bo'lmaydi).
// ============================================================
(function () {
  'use strict';

  var IDS = ['galaxy', 'default', 'rings', 'blinds', 'grid', 'prism'];
  var LS_KEY = 'appTheme', ANIM_KEY = 'designAnim';
  var root = document.documentElement;

  function L(uz, en, ru) {
    try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {}
    return en;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ---------- Dizaynlar ta'rifi ----------
  // n/d: [uz, en, ru]. price: { coins } yoki { gems } — yo'q bo'lsa bepul.
  var D = {
    galaxy: { n: ['Galaxy', 'Galaxy', 'Galaxy'], d: ['Yulduzlar orasida parvoz', 'Fly through the stars', 'Полёт среди звёзд'], base: '#04050f', meta: '#070a1c', scale: 0.7 },
    default: { n: ['Klassik', 'Classic', 'Классика'], d: ['Avvalgi oddiy ko\'rinish', 'The original clean look', 'Исходный простой вид'], base: '#0E0E12', meta: '#7C5CFC' },
    rings: { n: ['Magic Rings', 'Magic Rings', 'Magic Rings'], d: ['Porlovchi sehrli halqalar', 'Glowing magic rings', 'Светящиеся кольца'], base: '#07050f', meta: '#130b24', scale: 0.6, idleHover: 0, price: { coins: 250 } },
    blinds: { n: ['Gradient Blinds', 'Gradient Blinds', 'Gradient Blinds'], d: ['Yumshoq gradient pardalar', 'Soft gradient blinds', 'Мягкие градиентные жалюзи'], base: '#0b0618', meta: '#160b30', scale: 0.5, idleHover: 0.75, price: { coins: 300 } },
    grid: { n: ['Grid Scan', 'Grid Scan', 'Grid Scan'], d: ['Skanerlovchi 3D to\'r', 'Scanning 3D grid', 'Сканирующая 3D-сетка'], base: '#07080c', meta: '#0b0d14', scale: 0.75, idleHover: 0.5, price: { gems: 25 } },
    prism: { n: ['Prismatic Burst', 'Prismatic Burst', 'Prismatic Burst'], d: ['Prizmatik nur portlashi', 'Prismatic light burst', 'Призматическая вспышка'], base: '#06040d', meta: '#120a26', scale: 0.5, idleHover: 0.35, price: { gems: 35 } }
  };
  Object.keys(D).forEach(function (k) {
    var o = D[k];
    o.name = function () { return L(o.n[0], o.n[1], o.n[2]); };
    o.desc = function () { return L(o.d[0], o.d[1], o.d[2]); };
  });

  // ---------- 🛍 Egalik: S.shop.owned ichida 'd_<id>' (app_state orqali sinxronlanadi) ----------
  function appS() { try { return (typeof S !== 'undefined' && S) ? S : null; } catch (e) { return null; } }
  function isFree(id) { return !D[id] || !D[id].price; }
  function isOwned(id) {
    if (isFree(id)) return true;
    var s = appS(), st = s && s.shop;
    return !!(st && Array.isArray(st.owned) && st.owned.indexOf('d_' + id) !== -1);
  }
  function priceTxt(id) { var p = D[id] && D[id].price; return !p ? '' : p.gems ? p.gems + ' 💎' : p.coins + ' 🪙'; }

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
  function isGalaxy(id) { return id === 'galaxy'; }

  function setRootAttrs(id) {
    if (root.getAttribute('data-design') !== id) root.classList.remove('design-live'); // yangi dizayn chizilguncha uning statik rasmi
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

  // --- 5) Galaxy (React Bits Galaxy porti): density 1, glowIntensity 0.3, flareIntensity 1, starSpeed 0.5,
  //        mouseRepulsion, repulsionStrength 2, clickWarp, intro, hueShift 140, saturation 0, twinkle 0.3,
  //        rotationSpeed 0.1, layers 4 (mobil 3), transparent. PALETTE/REPEL/WARP variantlari — define
  //        o'rniga uniform'lar (uColorCount>0, push>0, uWarp>0) bilan; bitta dastur.
  //        WebGL2 bo'lsa '#version 300 es', aks holda GLSL ES 1.00 (FRAG makrosi bilan).
  var GAL_BODY = [
    'uniform float uTime;uniform vec3 uResolution;uniform vec2 uFocal;uniform vec2 uRotation;',
    'uniform float uGloss;uniform float uDepth;uniform float uDensity;uniform float uHueShift;uniform float uSpeed;',
    'uniform vec2 uMouse;uniform float uStarGlow;uniform float uFlareGain;uniform float uSquash;uniform float uSaturation;',
    'uniform float uMouseRepulsion;uniform float uTwinkleIntensity;uniform float uRotationAngle;uniform float uRepulsionStrength;',
    'uniform float uMouseActiveFactor;uniform float uAutoCenterRepulsion;uniform float uLayers;uniform vec3 uColors[4];',
    'uniform float uColorCount;uniform float uWarp;uniform float uReveal;uniform float uMode;uniform vec3 uBackground;uniform float uOpacity;',
    '#define MAT45 mat2(0.7071,-0.7071,0.7071,0.7071)',
    '#define PERIOD 3.0',
    '#define STAR_COLOR_CUTOFF 0.2',
    'float Hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float tri(float x){return abs(fract(x)*2.0-1.0);}',
    'float tris(float x){float t=fract(x);return 1.0-smoothstep(0.0,1.0,abs(2.0*t-1.0));}',
    'float trisn(float x){float t=fract(x);return 2.0*(1.0-smoothstep(0.0,1.0,abs(2.0*t-1.0)))-1.0;}',
    'vec3 hsv2rgb(vec3 c){vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);}',
    // GLSL ES 1.00 da uniform massivni o'zgaruvchan indeks bilan o'qib bo'lmaydi — sikl bilan tanlaymiz
    'vec3 pickColor(float h){int idx=int(h*uColorCount);vec3 c=uColors[0];for(int k=1;k<4;k++){if(k==idx)c=uColors[k];}return c;}',
    'float Star(vec2 uv,float flare,vec2 radial,float invReach){',
    '  float d;',
    '  if(uWarp>0.0){float along=dot(uv,radial);d=sqrt(max(dot(uv,uv)-uSquash*along*along,0.0));}',
    '  else d=length(uv);',
    '  float m=uStarGlow/max(d,1e-4);',
    '  float rays=smoothstep(0.0,1.0,1.0-abs(uv.x*uv.y*1000.0));',
    '  m+=rays*flare*uFlareGain;',
    '  uv*=MAT45;',
    '  rays=smoothstep(0.0,1.0,1.0-abs(uv.x*uv.y*1000.0));',
    '  m+=rays*0.3*flare*uFlareGain;',
    '  m*=smoothstep(1.0,0.2,d*invReach);',
    '  if(uWarp>0.0) m*=mix(1.0,smoothstep(1.0,0.55,length(uv)*invReach),min(uWarp*4.0,1.0));',
    '  return m;',
    '}',
    'vec3 StarLayer(vec2 uv,vec2 radial,vec2 repelAt,float pushCells,float spread){',
    '  vec3 col=vec3(0.0);',
    '  vec2 gv=fract(uv)-0.5; vec2 id=floor(uv);',
    '  for(int y=-1;y<=1;y++){',
    '    for(int x=-1;x<=1;x++){',
    '      vec2 offset=vec2(float(x),float(y)); vec2 si=id+offset;',
    '      float seed=Hash21(si);',
    '      float size=fract(seed*345.32);',
    '      float glossLocal=tri(uGloss/(PERIOD*seed+1.0));',
    '      float flareSize=smoothstep(0.9,1.0,size)*glossLocal;',
    '      vec3 base;',
    '      if(uColorCount>0.5){ base=pickColor(Hash21(si+7.0)); }',
    '      else {',
    '        float red=smoothstep(STAR_COLOR_CUTOFF,1.0,Hash21(si+1.0))+STAR_COLOR_CUTOFF;',
    '        float blu=smoothstep(STAR_COLOR_CUTOFF,1.0,Hash21(si+3.0))+STAR_COLOR_CUTOFF;',
    '        float grn=min(red,blu)*seed;',
    '        base=vec3(red,grn,blu);',
    '        float hue=atan(base.g-base.r,base.b-base.r)/(2.0*3.14159)+0.5;',
    '        hue=fract(hue+uHueShift/360.0);',
    '        float sat=length(base-vec3(dot(base,vec3(0.299,0.587,0.114))))*uSaturation;',
    '        float val=max(max(base.r,base.g),base.b);',
    '        base=hsv2rgb(vec3(hue,sat,val));',
    '      }',
    '      vec2 pad=vec2(tris(seed*34.0+uTime*uSpeed/10.0),tris(seed*38.0+uTime*uSpeed/30.0))-0.5;',
    '      vec2 shift=vec2(0.0); float invReach=1.0;',
    '      if(pushCells>0.0){',
    '        vec2 away=si+0.5+pad-repelAt; float dist=length(away); float q=dist*spread;',
    '        float cells=pushCells*exp(-q*q);',
    '        float moved=cells*inversesqrt(1.0+cells*cells*2.78);',
    '        shift=away*(moved/max(dist,1e-4)); invReach=1.0/(1.0-moved);',
    '      }',
    '      float star=Star(gv-offset-pad-shift,flareSize,radial,invReach);',
    '      float twinkle=mix(1.0,trisn(uTime*uSpeed+seed*6.2831)*0.5+1.0,uTwinkleIntensity);',
    '      col+=star*twinkle*size*base;',
    '    }',
    '  }',
    '  return col;',
    '}',
    'void main(){',
    '  vec2 focalPx=uFocal*uResolution.xy;',
    '  vec2 uv=(gl_FragCoord.xy-focalPx)/uResolution.y;',
    '  vec2 repelAt=vec2(0.0); float push=0.0; float strength=0.0;',
    '  if(uAutoCenterRepulsion>0.0){ strength=uAutoCenterRepulsion; push=strength*0.05; }',
    '  else if(uMouseRepulsion>0.5){',
    '    repelAt=(uMouse*uResolution.xy-focalPx)/uResolution.y;',
    '    strength=max(uRepulsionStrength,0.0); push=strength*0.05*uMouseActiveFactor;',
    '  } else { uv+=(uMouse-vec2(0.5))*0.1*uMouseActiveFactor; }',
    '  float radius=0.16+0.04*strength;',
    '  float ul=length(uv); vec2 radial=ul>1e-5?uv/ul:vec2(0.0,1.0);',
    '  float ca=cos(uRotationAngle), sa=sin(uRotationAngle);',
    '  mat2 autoRot=mat2(ca,-sa,sa,ca);',
    '  mat2 rot=mat2(uRotation.x,-uRotation.y,uRotation.y,uRotation.x);',
    '  uv=rot*(autoRot*uv); radial=rot*(autoRot*radial); repelAt=rot*(autoRot*repelAt);',
    '  vec3 col=vec3(0.0);',
    '  for(int k=0;k<8;k++){',
    '    if(float(k)>=uLayers) break;',
    '    float i=float(k)/uLayers;',
    '    float depth=fract(i+uDepth);',
    '    float scale=mix(20.0*uDensity,0.5*uDensity,depth);',
    '    float fade=depth*smoothstep(1.0,0.9,depth);',
    '    vec2 offset=vec2(i*453.32);',
    '    col+=StarLayer(uv*scale+offset,radial,repelAt*scale+offset,push*scale,1.0/(scale*radius))*fade;',
    '  }',
    '  col*=uReveal;',
    '  if(uMode>0.5){',
    '    float alpha=min(smoothstep(0.0,0.3,length(col)),1.0)*uOpacity;',
    '    FRAG=vec4(col*alpha,alpha);',
    '  } else {',
    '    FRAG=vec4(uBackground+col,1.0);',
    '  }',
    '}'
  ].join('\n');
  var GAL_FS2 = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\n#define FRAG fragColor\n' + GAL_BODY;
  var GAL_FS1 = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n#define FRAG gl_FragColor\n' + GAL_BODY;
  var VERT2 = '#version 300 es\nin vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';
  var GAL_UNIFORMS = ['uTime', 'uResolution', 'uFocal', 'uRotation', 'uGloss', 'uDepth', 'uDensity', 'uHueShift', 'uSpeed', 'uMouse',
    'uStarGlow', 'uFlareGain', 'uSquash', 'uSaturation', 'uMouseRepulsion', 'uTwinkleIntensity', 'uRotationAngle', 'uRepulsionStrength',
    'uMouseActiveFactor', 'uAutoCenterRepulsion', 'uLayers', 'uColors', 'uColorCount', 'uWarp', 'uReveal', 'uMode', 'uBackground', 'uOpacity'];
  var STD_UNIFORMS = ['uRes', 'uTime', 'uMouse', 'uHover', 'uIntro', 'uPx', 'uCount', 'uBursts'];

  // Galaxy sozlamalari (React Bits prop'lari) + kadr holati
  var GCFG = {
    focal: [0.5, 0.5], rotation: [1.0, 0.0], starSpeed: 0.5, density: 1, hueShift: 140, speed: 1.0,
    glowIntensity: 0.3, flareIntensity: 1, starSize: 1, saturation: 0, mouseRepulsion: true, repulsionStrength: 2,
    twinkleIntensity: 0.3, rotationSpeed: 0.1, autoCenterRepulsion: 0, clickWarp: true, intro: true, opacity: 1,
    colors: [] // bo'sh — PALETTE o'chiq (hue/saturation bilan rang)
  };
  var G = { reveal: 1, boost: 0, time: 0, gloss: 0, depth: 0, angle: 0, mx: 0.5, my: 0.5, tx: 0.5, ty: 0.5, active: 0, tActive: 0 };
  function galaxyIntro() { if (GCFG.intro) { G.reveal = 0; G.boost = Math.max(G.boost, 1.4); } }
  function galaxyStep(dt) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    if (GCFG.intro && G.reveal < 1) {
      G.reveal = Math.min(1, G.reveal + dt / 2.2);
      G.boost = Math.max(G.boost, Math.pow(1 - G.reveal, 2) * 1.4);
    }
    var flight = GCFG.starSpeed / 10;
    G.time += dt;
    G.gloss += dt * flight;
    G.depth += dt * flight * GCFG.speed * (1 + G.boost * 14);
    G.angle += dt * GCFG.rotationSpeed;
    G.boost *= Math.exp(-dt * 1.3);
    if (G.boost < 1e-4) G.boost = 0;
    var follow = 1 - Math.exp(-dt / 0.325);
    G.mx += (G.tx - G.mx) * follow; G.my += (G.ty - G.my) * follow;
    G.active += (G.tActive - G.active) * follow;
    if (G.depth > 1000) G.depth -= 1000; // aniqlik yo'qolmasin (fract davriy)
  }

  var SHADERS = { rings: FS_RINGS, blinds: FS_BLINDS, grid: FS_GRID, prism: FS_PRISM };

  var R = {
    canvas: null, gl: null, kind: null, gl2: false, prog: null, progId: null, buf: null, u: null, failed: false, lost: false,
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
      e.preventDefault();
      if (c !== R.canvas) return; // almashtirilgan eski canvas — e'tiborsiz
      R.lost = true; R.prog = null; R.progId = null; R.buf = null; R.u = null; stopLoop();
    }, false);
    c.addEventListener('webglcontextrestored', function () {
      if (c !== R.canvas) return;
      R.lost = false; R.gl = null; refresh();
    }, false);
    return c;
  }

  // Kontekst turi: Galaxy — shaffof (alpha) + WebGL2 (bo'lsa); qolganlari — shaffofmas WebGL1
  // (ular GLSL 1.00 + OES_standard_derivatives ishlatadi, WebGL2 da bu kengaytma yo'q).
  // Canvas konteksti turini o'zgartirib bo'lmaydi — tur almashsa canvas qayta yaratiladi.
  function wantKind() { return isGalaxy(current) ? 'alpha' : 'opaque'; }
  function swapCanvas() {
    var old = R.canvas;
    try { var ext = R.gl && R.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {}
    R.canvas = null; R.gl = null; R.kind = null; R.gl2 = false; R.prog = null; R.progId = null; R.buf = null; R.u = null; R.lost = false;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    R.w = R.h = 0;
    ensureCanvas();
  }
  function getGL() {
    var kind = wantKind();
    if (R.gl && !R.lost && R.kind === kind) return R.gl;
    if (R.failed || !R.canvas) return null;
    if (R.gl && R.kind !== kind) { swapCanvas(); if (!R.canvas) return null; }
    if (R.lost) return null;
    var gl = null, gl2 = false;
    var opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    if (kind === 'alpha') {
      opts.alpha = true; opts.premultipliedAlpha = true;
      try { gl = R.canvas.getContext('webgl2', opts); gl2 = !!gl; } catch (e) { gl = null; }
    }
    if (!gl) { try { gl = R.canvas.getContext('webgl', opts) || R.canvas.getContext('experimental-webgl', opts); } catch (e) { gl = null; } }
    if (!gl) { R.failed = true; root.classList.add('design-nogl'); return null; }
    if (!gl2) { try { gl.getExtension('OES_standard_derivatives'); } catch (e) {} }
    R.gl = gl; R.kind = kind; R.gl2 = gl2;
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
    var gal = isGalaxy(id);
    var vsSrc = gal && R.gl2 ? VERT2 : VERT;
    var fsSrc = gal ? (R.gl2 ? GAL_FS2 : GAL_FS1) : SHADERS[id];
    var vs = compile(gl, gl.VERTEX_SHADER, vsSrc), fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
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
    (gal ? GAL_UNIFORMS : STD_UNIFORMS).forEach(function (n) {
      R.u[n] = gl.getUniformLocation(p, (n === 'uBursts' || n === 'uColors') ? n + '[0]' : n);
    });
    R.prog = p; R.progId = id;
    if (gal) {
      gl.disable(gl.BLEND); // shader o'zi premultiplied alpha beradi
      gl.clearColor(0, 0, 0, 0);
    }
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

  function hex3(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16) || 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function drawGalaxy(gl) {
    var u = R.u, c = GCFG;
    var layers = isMobile() ? 3 : 4;
    var stretch = 1 + G.boost * 5;
    var rv = Math.min(1, G.reveal / 0.35); rv = rv * rv * (3 - 2 * rv);
    gl.viewport(0, 0, R.w, R.h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.uTime, G.time);
    gl.uniform3f(u.uResolution, R.w, R.h, R.w / R.h);
    gl.uniform2f(u.uFocal, c.focal[0], c.focal[1]);
    gl.uniform2f(u.uRotation, c.rotation[0], c.rotation[1]);
    gl.uniform1f(u.uGloss, G.gloss);
    gl.uniform1f(u.uDepth, G.depth);
    gl.uniform1f(u.uDensity, c.density);
    gl.uniform1f(u.uHueShift, c.hueShift);
    gl.uniform1f(u.uSpeed, c.speed);
    gl.uniform2f(u.uMouse, G.mx, G.my);
    gl.uniform1f(u.uStarGlow, 0.05 * c.glowIntensity * c.starSize / Math.pow(1 + G.boost * 5, 0.6));
    gl.uniform1f(u.uFlareGain, c.glowIntensity * c.flareIntensity);
    gl.uniform1f(u.uSquash, 1 - 1 / (stretch * stretch));
    gl.uniform1f(u.uSaturation, c.saturation);
    gl.uniform1f(u.uMouseRepulsion, c.mouseRepulsion ? 1 : 0);
    gl.uniform1f(u.uTwinkleIntensity, c.twinkleIntensity);
    gl.uniform1f(u.uRotationAngle, G.angle);
    gl.uniform1f(u.uRepulsionStrength, c.repulsionStrength);
    gl.uniform1f(u.uMouseActiveFactor, G.active);
    gl.uniform1f(u.uAutoCenterRepulsion, c.autoCenterRepulsion);
    gl.uniform1f(u.uLayers, layers);
    var cols = new Float32Array(12), cc = Math.min(4, c.colors.length);
    for (var i = 0; i < cc; i++) { var rgb = hex3(c.colors[i]); cols[i * 3] = rgb[0]; cols[i * 3 + 1] = rgb[1]; cols[i * 3 + 2] = rgb[2]; }
    gl.uniform3fv(u.uColors, cols);
    gl.uniform1f(u.uColorCount, cc);
    gl.uniform1f(u.uWarp, G.boost);
    gl.uniform1f(u.uReveal, rv);
    gl.uniform1f(u.uMode, 1); // shaffof (ilova foni ustida)
    gl.uniform3f(u.uBackground, 0, 0, 0);
    gl.uniform1f(u.uOpacity, c.opacity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function draw() {
    if (!isFx(current) || R.lost) return;
    var gl = getGL(); if (!gl || !useProgram(current)) return;
    if (isGalaxy(current)) {
      if (!R.running) { // harakatsiz kadr (reduce motion / animatsiya o'chiq / pauza)
        if (!animating()) { G.reveal = 1; G.boost = 0; if (G.time < 1) { G.time = 6.5; G.gloss = 0.33; G.depth = 0.37; G.angle = 0.6; } }
      }
      drawGalaxy(gl);
      markLive();
      return;
    }
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
    markLive();
  }
  function markLive() { if (!root.classList.contains('design-live')) requestAnimationFrame(function () { root.classList.add('design-live'); }); }

  function loop(now) {
    R.raf = requestAnimationFrame(loop);
    if (++R.frameN % 20 === 0) R.modalOpen = !!document.querySelector('.modal-overlay.open, .x-ov.open');
    var fps = R.modalOpen ? 15 : (isMobile() ? 30 : 60);
    var dt = now - R.last;
    if (dt < 1000 / fps - 2) return;
    R.last = now;
    var sec = Math.min(dt, 100) / 1000;
    R.time += sec;
    if (isGalaxy(current)) galaxyStep(sec);
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
  function galaxyPointer(e) {
    G.tx = e.clientX / Math.max(1, window.innerWidth);
    G.ty = 1 - e.clientY / Math.max(1, window.innerHeight); // y teskari
    G.tActive = 1;
  }
  window.addEventListener('pointermove', function (e) {
    if (!R.running) return;
    if (isGalaxy(current)) { galaxyPointer(e); return; }
    var p = toCanvas(e);
    R.mouse.tx = p.x; R.mouse.ty = p.y; R.mouse.th = 1; R.mouse.lastMove = performance.now();
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (!R.running) return;
    var tg = e.target && e.target.closest ? e.target : null;
    if (tg && tg.closest('input, textarea, select, [contenteditable="true"]')) return; // yozish paytida — hech narsa
    var subtle = tg && tg.closest('button, a, label, [onclick], [role="button"], [role="switch"], .modal, .x-box');
    if (isGalaxy(current)) {
      galaxyPointer(e);
      // clickWarp: bo'sh joyga bosish — to'liq warp sakrash; tugma/kartalarda — yengil (UI chalg'itmasin)
      if (GCFG.clickWarp) G.boost = Math.min(1.6, G.boost + (subtle ? 0.35 : 1));
      return;
    }
    var p = toCanvas(e);
    R.mouse.tx = p.x; R.mouse.ty = p.y; R.mouse.th = 1; R.mouse.lastMove = performance.now();
    R.bursts.push({ x: p.x, y: p.y, t: R.time, s: subtle ? 0.35 : 1 });
    if (R.bursts.length > 4) R.bursts.shift();
  }, { passive: true });
  function pointerGone() { R.mouse.lastMove = -1e9; G.tActive = 0; }
  window.addEventListener('pointerleave', pointerGone, { passive: true });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) pointerGone(); }, { passive: true });
  window.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') G.tActive = 0; }, { passive: true });
  window.addEventListener('pointercancel', function () { G.tActive = 0; }, { passive: true });
  window.addEventListener('blur', function () { G.tActive = 0; });

  var rzT = 0;
  function onResize() { clearTimeout(rzT); rzT = setTimeout(resize, 120); }
  window.addEventListener('resize', onResize, { passive: true });
  try { if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize, { passive: true }); } catch (e) {}
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop(); else startLoop();
  });
  if (reduceMQ) {
    var onRM = function () { refresh(); renderPicker(); notify(); };
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

  function notify() {
    root.classList.toggle('lu-still', !animating()); // CSS effektlar/preview'lar uchun
    try { window.dispatchEvent(new CustomEvent('lu:design', { detail: { id: current, anim: animating() } })); } catch (e) {}
  }

  // Qulflangan (sotib olinmagan) dizayn — do'konga yo'naltiramiz
  function openShopFor(id) {
    var nm = D[id] ? D[id].name() : id;
    try { if (typeof toast === 'function') toast('🔒 ' + nm + ' — ' + priceTxt(id) + '. ' + L('Do\'kondan sotib oling', 'Buy it in the Shop', 'Купите в магазине')); } catch (e) {}
    try { if (typeof window.xOpenShopItem === 'function') window.xOpenShopItem('d_' + id); } catch (e) {}
  }

  function apply(id, opts) {
    id = normalize(id);
    // Faqat bepul yoki sotib olingan dizayn (ilova holati S yuklangan bo'lsa tekshiriladi)
    if (!(opts && opts.force) && appS() && !isOwned(id)) { openShopFor(id); return false; }
    var changed = id !== current;
    current = id;
    lsSet(LS_KEY, id);
    setRootAttrs(id);
    if (id === 'prism' && changed) R.introStart = R.time; // har safar tanlanganda intro
    if (isGalaxy(id) && changed) galaxyIntro();           // warp'dan chiqib kelish
    syncLightClass();
    refresh();
    renderPicker();
    notify();
    if (changed && !(opts && opts.silent)) {
      try { if (typeof scheduleAppStateSync === 'function') scheduleAppStateSync(); } catch (e) {}
    }
    return true;
  }

  // Ilova holati yuklangach: joriy dizayn sotib olinmagan bo'lsa — Klassik'ga qaytaramiz.
  // Migratsiya: pullik dizaynlar paydo bo'lishidan oldin tanlangan dizayn bir marta "sovg'a" qilinadi
  // (S.shop.dzGrand), aks holda eski foydalanuvchilar dizaynini to'satdan yo'qotardi.
  function enforce() {
    var s = appS(); if (!s) return;
    if (!s.shop || typeof s.shop !== 'object') s.shop = { owned: [] };
    if (!Array.isArray(s.shop.owned)) s.shop.owned = [];
    if (!s.shop.dzGrand) {
      s.shop.dzGrand = 1;
      // Faqat haqiqatan sovg'a berilganda saqlaymiz (yangi foydalanuvchining birinchi ishga tushishini buzmaslik uchun)
      if (!isFree(current) && s.shop.owned.indexOf('d_' + current) === -1) {
        s.shop.owned.push('d_' + current);
        try { if (typeof save === 'function') save(); } catch (e) {}
      }
    }
    if (!isOwned(current)) apply('default', { force: true, silent: true });
    else renderPicker();
  }

  function setAnim(on) {
    animOn = !!on;
    lsSet(ANIM_KEY, animOn ? '1' : '0');
    refresh();
    renderPicker();
    notify();
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
      var sel = id === current, own = isOwned(id);
      var attr = own ? 'role="radio" aria-checked="' + sel + '" data-design-pick="' + id + '"'
        : 'data-design-buy="' + id + '" aria-label="' + esc2(D[id].name() + ' — ' + L('qulflangan', 'locked', 'заблокировано') + ', ' + priceTxt(id)) + '"';
      html += '<button type="button" class="dz-card' + (sel ? ' sel' : '') + (own ? '' : ' locked') + '" ' + attr + '>' +
        '<span class="dz-prev dz-prev-' + id + '"><span class="dz-prev-in"></span>' + (sel ? '<span class="dz-check">✓</span>' : '') +
        (own ? (isFree(id) && id === 'galaxy' ? '<span class="dz-tag">' + esc2(L('Yangi', 'New', 'Новое')) + '</span>' : '')
          : '<span class="dz-lock">🔒</span><span class="dz-price">' + esc2(priceTxt(id)) + '</span>') + '</span>' +
        '<span class="dz-name">' + esc2(D[id].name()) + '</span>' +
        (own ? '<span class="dz-desc">' + esc2(D[id].desc()) + '</span>'
          : '<span class="dz-buy">🛍 ' + esc2(L('Shop\'da sotib olish', 'Buy in Shop', 'Купить в магазине')) + '</span>') + '</button>';
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
    // ✨ UI effektlar (effects.js) — yoqish/o'chirish
    try { if (window.LUFx && typeof window.LUFx.settingsHtml === 'function') html += window.LUFx.settingsHtml(); } catch (e) {}
    host.innerHTML = html;
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-design-pick], [data-design-anim], [data-design-buy]') : null;
    if (!t) return;
    if (t.hasAttribute('data-design-pick')) {
      apply(t.getAttribute('data-design-pick'));
      try { if (typeof SFX !== 'undefined' && SFX.click) SFX.click(); } catch (e2) {}
    } else if (t.hasAttribute('data-design-buy')) {
      openShopFor(t.getAttribute('data-design-buy'));
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
    animating: animating, reducedMotion: reducedMotion,
    darkNote: darkNote, renderPicker: renderPicker, syncLight: syncLightClass,
    // 🛍 do'kon uchun
    isOwned: isOwned, isFree: isFree, enforce: enforce, priceText: priceTxt,
    catalog: function () {
      return IDS.map(function (id) { var o = D[id]; return { id: id, n: o.n.slice(), d: o.d.slice(), price: o.price ? { coins: o.price.coins, gems: o.price.gems } : null }; });
    }
  };
  window.changeAppTheme = function (id) { apply(id); }; // eski nom bilan moslik

  function boot() {
    if (current === 'prism') R.introStart = 0;
    if (isGalaxy(current)) galaxyIntro();
    root.classList.toggle('lu-still', !animating());
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
  // Ilova to'liq yuklanib bo'lgach (birinchi ishga tushirish tugagach) tekshiramiz
  window.addEventListener('load', function () {
    syncLightClass();
    var n = 0;
    (function wait() {
      if (!window._appBooted && n++ < 150) return setTimeout(wait, 100);
      setTimeout(function () { try { enforce(); } catch (e) {} }, 300);
    })();
  });
})();
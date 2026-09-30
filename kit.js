'use strict';
/* =========================================================
   KIT — общая часть детских игр:
   язык, озвучка, звуки, холст, разметка экрана, частицы, лица.
   Игра описывает объект GAME и вызывает kitStart(GAME).
   ========================================================= */

/* ---------- язык ---------- */
let lang = 'ru';
try { const l = localStorage.getItem('kids_lang'); if (l === 'kk' || l === 'ru') lang = l; } catch (e) {}
// L({ru:'..',kk:'..'}) — строка на текущем языке
const L = o => o == null ? '' : (typeof o === 'string' ? o : (o[lang] !== undefined ? o[lang] : o.ru));

/* ---------- утилиты ---------- */
const $ = s => document.querySelector(s);
const pick = a => a[Math.floor(Math.random()*a.length)];
function shuffle(a){ for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random()*(b - a);
const lerp = (a, b, t) => a + (b - a)*t;
const ease = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeBack = t => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); };

const PRAISE = {ru:['Молодец!','Правильно!','Ура, получилось!','Отлично!','Умница!'], kk:['Жарайсың!','Дұрыс!','Керемет!','Бәрекелді!','Тамаша!']};
const TRY_AGAIN = {ru:'Попробуй ещё!', kk:'Тағы байқап көр!'};
const FIVE = {ru:'Пять звёздочек! Ты молодец!', kk:'Бес жұлдыз! Жарайсың!'};
const praise = () => pick(PRAISE[lang]);

/* ---------- озвучка ---------- */
let voices = [];
function loadVoices(){ try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
// Если на устройстве нет казахского голоса, текст читает русский голос,
// а буквы, которых нет в русском, заменяются на близкие по звучанию.
const KK2RU = {'ә':'э','ғ':'г','қ':'к','ң':'н','ө':'о','ұ':'у','ү':'у','һ':'х','і':'и',
               'Ә':'Э','Ғ':'Г','Қ':'К','Ң':'Н','Ө':'О','Ұ':'У','Ү':'У','Һ':'Х','І':'И'};
function findVoice(prefix){
  const list = voices.filter(v => (v.lang || '').toLowerCase().replace('_','-').startsWith(prefix));
  return list.find(v => v.localService) || list[0] || null;
}
let speakId = 0, subTimer = 0, elSub = null;
function speak(text, onEnd){
  if (!started) return;   // до нажатия «Играть» молчим
  const id = ++speakId;
  if (elSub) { clearTimeout(subTimer); elSub.textContent = text; elSub.classList.add('show'); }
  let done = false;
  const fin = () => {
    if (done) return; done = true;
    if (id !== speakId) return;
    clearTimeout(subTimer);
    subTimer = setTimeout(() => { if (id === speakId && elSub) elSub.classList.remove('show'); }, 1400);
    if (onEnd) onEnd();
  };
  const safety = setTimeout(fin, 2200 + text.length * 85);
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    if (!voices.length) loadVoices();
    let say = text, v;
    if (lang === 'kk') {
      v = findVoice('kk');
      if (!v) { v = findVoice('ru'); say = text.replace(/[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/g, c => KK2RU[c]); }
    } else v = findVoice('ru');
    const u = new SpeechSynthesisUtterance(say);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang === 'kk' ? 'kk-KZ' : 'ru-RU';
    u.rate = 0.9; u.pitch = 1.15; u.volume = 1;
    u.onend = () => { clearTimeout(safety); setTimeout(fin, 150); };
    u.onerror = () => { clearTimeout(safety); setTimeout(fin, 150); };
    speechSynthesis.speak(u);
  } catch (e) {}
}
function stopSpeak(){
  speakId++;
  try { speechSynthesis.cancel(); } catch (e) {}
  if (elSub) elSub.classList.remove('show');
}

/* ---------- звуки и музыка (Web Audio) ---------- */
let ac = null, master = null, musicOn = true, nextNote = 0;
function audio(){
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    } catch (e) { return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, dur, {type='sine', vol=.12, when=0, to=null, attack=.01}={}){
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + .05);
}
function noise(dur, f0, f1, vol=.1){
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, ac.currentTime); f.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur);
  g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start();
}
const sfx = {
  tap(){ tone(660,.14,{vol:.1}); tone(990,.12,{vol:.05,when:.04}); },
  open(){ tone(440,.25,{type:'triangle',vol:.1,to:880}); },
  success(){ [523,659,784,1047].forEach((f,i)=>tone(f,.35,{type:'triangle',vol:.11,when:i*.09})); },
  big(){ [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.5,{type:'triangle',vol:.1,when:i*.1})); },
  soft(){ tone(330,.28,{type:'triangle',vol:.08,to:240}); },
  pick(){ tone(520,.1,{vol:.08,to:700}); },
  whoosh(){ noise(1.1, 300, 2000, .12); },
  splash(){ noise(.5, 1800, 500, .12); },
  sparkle(){ [1319,1568,1760,2093].forEach((f,i)=>tone(f,.25,{vol:.05,when:i*.06})); },
  boing(){ tone(180,.35,{type:'triangle',vol:.14,to:720}); },
  chomp(){ tone(170,.09,{type:'square',vol:.06}); tone(140,.09,{type:'square',vol:.06,when:.13}); },
  growl(){ tone(95,.4,{type:'sawtooth',vol:.05,to:70}); },
  giggle(){ [880,1100,920,1180,980].forEach((f,i)=>tone(f,.09,{vol:.08,when:i*.08})); },
  meow(){ tone(780,.32,{type:'triangle',vol:.1,to:520}); },
  quack(){ tone(420,.09,{type:'square',vol:.05}); tone(380,.11,{type:'square',vol:.05,when:.12}); },
  honk(){ tone(350,.2,{type:'square',vol:.05}); },
  siren(){ for (let i = 0; i < 6; i++) tone(i % 2 ? 640 : 860, .27, {type:'triangle', vol:.08, when:i*.27}); },
  brush(){ noise(.12, 2500, 3500, .05); }
};
const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
function musicTick(){
  if (!ac || !musicOn || document.hidden || now < nextNote) return;
  const f = pick(SCALE);
  tone(f, 2.8, {vol:.026, attack:.4});
  if (Math.random() < .35) tone(f/2, 3.5, {vol:.018, attack:.6});
  nextNote = now + .9 + Math.random()*1.3;
}

/* ---------- холст и разметка ---------- */
let cv = null, ctx = null, W = 0, H = 0, DPR = 1, now = 0, frameDt = 0;
let land = false, topBarBottom = 70, barH = 0, subLift = 0, subTop = false;
let safe = {t:0, r:0, b:0, l:0};
// area — часть экрана для игры (без меню режимов и верхней панели)
const area = {x0:0, y0:0, x1:0, y1:0, w:0, h:0, cx:0, cy:0};
const ptr = {x:0, y:0, down:false};
let GAME = null, mode = null, started = false, stars = 0;

function kitLayout(){
  W = innerWidth; H = innerHeight; DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  land = W > H*1.15 && H < 560;
  document.body.classList.toggle('land', land);
  const cs = getComputedStyle($('#safe'));
  safe = {t:parseFloat(cs.paddingTop)||0, r:parseFloat(cs.paddingRight)||0, b:parseFloat(cs.paddingBottom)||0, l:parseFloat(cs.paddingLeft)||0};
  const modes = $('#modes'), hasModes = modes.style.display !== 'none';
  const mw = land && hasModes ? modes.offsetWidth : 0;
  document.documentElement.style.setProperty('--mw', mw + 'px');
  topBarBottom = $('#top').offsetHeight + 6;
  barH = land || !hasModes ? 0 : modes.offsetHeight;
  area.x0 = land ? Math.max(mw, safe.l) : 0; area.x1 = W - (land ? safe.r : 0);
  area.y0 = topBarBottom; area.y1 = H - barH - (barH ? 0 : safe.b);
  area.w = area.x1 - area.x0; area.h = area.y1 - area.y0;
  area.cx = (area.x0 + area.x1)/2; area.cy = (area.y0 + area.y1)/2;
  if (GAME && GAME.layout) GAME.layout();
  placeSub();
}
function placeSub(){
  elSub.style.left = area.cx + 'px';
  elSub.style.maxWidth = Math.min(560, area.w - 24) + 'px';
  if (subTop) { elSub.style.top = (topBarBottom + 4) + 'px'; elSub.style.bottom = 'auto'; }
  else { elSub.style.top = 'auto'; elSub.style.bottom = (H - area.y1 + 10 + subLift) + 'px'; }
}

/* ---------- звёздочки ---------- */
function addStar(x, y){
  stars++;
  $('#starsN').textContent = stars;
  $('#stars').style.display = 'flex';
  try { localStorage.setItem('stars_' + GAME.key, String(stars)); } catch (e) {}
  if (x !== undefined) burst(x, y, 22, 1.1);
  if (stars % 5 === 0) { setTimeout(celebrate, 350); return true; }
  return false;
}

/* ---------- частицы ---------- */
const parts = [];
const COLORS = ['#ffd23f','#ff8fa3','#7fe3ff','#b8ff7a','#ffffff','#c9a0ff'];
function starPath(c, x, y, r, rot){
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + i*Math.PI/5 - Math.PI/2, rr = i % 2 ? r*.45 : r;
    c.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr);
  }
  c.closePath();
}
function burst(x, y, n = 18, power = 1, colors = COLORS){
  for (let i = 0; i < n; i++) {
    const a = Math.random()*Math.PI*2, sp = (60 + Math.random()*160) * power;
    parts.push({x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1, decay:.7 + Math.random()*.5, g:0,
      r:3 + Math.random()*5*power, rot:Math.random()*6, vr:(Math.random()-.5)*8, col:pick(colors), star:true});
  }
}
function puff(x, y, col = '#ffffff', n = 1, o = {}){
  for (let i = 0; i < n; i++) parts.push({x:x + rand(-4,4), y:y + rand(-4,4), vx:o.vx !== undefined ? o.vx + rand(-20,20) : rand(-30,30),
    vy:o.vy !== undefined ? o.vy + rand(-20,20) : rand(-30,30), life:1, decay:o.decay || 1.5, g:o.g || 0, r:o.r || rand(2,5), col, star:false});
}
// всплывающая надпись или эмодзи
function floatText(x, y, text, size = 40, col = '#fff'){
  parts.push({x, y, vx:0, vy:-40, life:1, decay:.7, g:0, text, size, col});
}
function celebrate(){
  sfx.big();
  for (let i = 0; i < 6; i++) setTimeout(() => burst(area.x0 + area.w*rand(.15,.85), area.y0 + area.h*rand(.2,.7), 26, 1.3), i*220);
}
function updateParts(dt){
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += (p.g || 0)*dt;
    p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= .97; p.vy *= .97; p.rot = (p.rot || 0) + (p.vr || 0)*dt;
    p.life -= p.decay*dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
function drawParts(c){
  for (const p of parts) {
    c.globalAlpha = clamp(p.life*1.5, 0, 1);
    if (p.text) {
      c.font = `900 ${p.size}px Nunito, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = p.size*.16; c.strokeStyle = 'rgba(30,15,70,.85)'; c.strokeText(p.text, p.x, p.y);
      c.fillStyle = p.col; c.fillText(p.text, p.x, p.y);
    } else if (p.star) { c.fillStyle = p.col; starPath(c, p.x, p.y, p.r, p.rot); c.fill(); }
    else { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r*(.4 + .6*p.life), 0, 7); c.fill(); }
  }
  c.globalAlpha = 1;
}

/* Защита: при анимации появления размер может выйти чуть меньше нуля,
   а холст на отрицательный радиус бросает ошибку. Обрезаем до нуля. */
(() => {
  const P = CanvasRenderingContext2D.prototype, arc = P.arc, arcTo = P.arcTo, ellipse = P.ellipse, grad = P.createRadialGradient;
  P.createRadialGradient = function(x0, y0, r0, x1, y1, r1){ return grad.call(this, x0, y0, Math.max(0, r0), x1, y1, Math.max(0, r1)); };
  P.arc = function(x, y, r, ...rest){ return arc.call(this, x, y, Math.max(0, r), ...rest); };
  P.arcTo = function(x1, y1, x2, y2, r){ return arcTo.call(this, x1, y1, x2, y2, Math.max(0, r)); };
  P.ellipse = function(x, y, rx, ry, ...rest){ return ellipse.call(this, x, y, Math.max(0, rx), Math.max(0, ry), ...rest); };
})();

/* ---------- рисование: общие фигуры ---------- */
function rr(c, x, y, w, h, r){
  r = Math.max(0, Math.min(r, w/2, h/2));
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function ell(c, x, y, rx, ry, col, rot = 0){ c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, 7); c.fill(); }
function circ(c, x, y, r, col){ c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.abs(r), 0, 7); c.fill(); }
function shadow(c, x, y, rx){ ell(c, x, y, rx, rx*.22, 'rgba(0,0,0,.22)'); }
function shade(c, x, y, r){ // блик на круглом теле
  const g = c.createRadialGradient(x - r*.35, y - r*.4, r*.1, x, y, r*1.05);
  g.addColorStop(0,'rgba(255,255,255,.32)'); g.addColorStop(.5,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(10,10,50,.22)');
  return g;
}
// подсказка: пульсирующее кольцо вокруг цели
function ring(c, x, y, r){
  const k = .5 + .5*Math.sin(now*6);
  c.lineWidth = 5; c.strokeStyle = `rgba(255,225,90,${.45 + .4*k})`;
  c.beginPath(); c.arc(x, y, r*(1 + .08*k), 0, 7); c.stroke();
}
const blinkNow = seed => ((now*.37 + (seed || 0)*1.7) % 3) < .1;

/* Лицо. mood: normal | happy | angry | scared | sleep | yuck.  s — размер лица. */
function drawFace(c, x, y, s, o = {}){
  const mood = o.mood || 'normal', ink = o.ink || '#2b1b3d';
  let lx = (o.lookX !== undefined ? o.lookX : ptr.x) - x, ly = (o.lookY !== undefined ? o.lookY : ptr.y) - y;
  const d = Math.hypot(lx, ly) || 1; lx /= d; ly /= d;
  const ex = s*.36, ey = y - s*.12, er = s*(mood === 'scared' ? .27 : .22);
  const blink = blinkNow(o.seed);
  c.lineCap = 'round';
  for (const sd of [-1, 1]) {
    const px = x + sd*ex;
    if (mood === 'happy') {
      c.strokeStyle = ink; c.lineWidth = Math.max(1.5, s*.08);
      c.beginPath(); c.arc(px, ey + er*.4, er*.75, Math.PI*1.15, Math.PI*1.85); c.stroke();
    } else if (mood === 'sleep') {
      c.strokeStyle = ink; c.lineWidth = Math.max(1.5, s*.08);
      c.beginPath(); c.arc(px, ey - er*.2, er*.75, Math.PI*.15, Math.PI*.85); c.stroke();
    } else if (blink && mood !== 'scared') {
      c.strokeStyle = ink; c.lineWidth = Math.max(1.5, s*.08);
      c.beginPath(); c.moveTo(px - er*.8, ey); c.lineTo(px + er*.8, ey); c.stroke();
    } else {
      circ(c, px, ey, er, '#fff');
      const pr = er*(mood === 'scared' ? .34 : .58), k = er*.34;
      circ(c, px + lx*k, ey + ly*k, pr, ink);
      circ(c, px + lx*k - pr*.35, ey + ly*k - pr*.38, pr*.32, '#fff');
    }
    if (mood === 'angry') {
      c.strokeStyle = ink; c.lineWidth = Math.max(2, s*.1);
      c.beginPath(); c.moveTo(px + sd*er*1.15, ey - er*1.75); c.lineTo(px - sd*er*.9, ey - er*.85); c.stroke();
    }
    if (!o.noCheeks && mood !== 'angry') circ(c, x + sd*s*.62, y + s*.2, s*.14, 'rgba(255,110,150,.4)');
  }
  if (o.noMouth) return;
  const my = y + s*.32;
  if (mood === 'happy') {
    c.fillStyle = '#7a2d3d'; c.beginPath(); c.arc(x, my - s*.08, s*.24, 0, Math.PI); c.closePath(); c.fill();
    c.fillStyle = '#ff8fa3'; c.beginPath(); c.arc(x, my + s*.08, s*.11, Math.PI, 0); c.fill();
  } else if (mood === 'angry') {
    rr(c, x - s*.34, my - s*.1, s*.68, s*.3, s*.12); c.fillStyle = '#5a1d2d'; c.fill();
    c.fillStyle = '#fff';
    for (const tx of [-.2, 0, .2]) { c.beginPath(); c.moveTo(x + (tx - .09)*s, my - s*.1); c.lineTo(x + tx*s, my + s*.06); c.lineTo(x + (tx + .09)*s, my - s*.1); c.fill(); }
  } else if (mood === 'scared') {
    ell(c, x, my, s*.15, s*.2, '#5a1d2d');
  } else if (mood === 'sleep') {
    ell(c, x, my, s*.07, s*.06, '#5a1d2d');
  } else if (mood === 'yuck') {
    c.strokeStyle = ink; c.lineWidth = Math.max(1.5, s*.08);
    c.beginPath(); c.arc(x, my + s*.12, s*.2, Math.PI*1.2, Math.PI*1.8); c.stroke();
    ell(c, x + s*.05, my + s*.1, s*.1, s*.13, '#ff8fa3');
  } else {
    c.strokeStyle = ink; c.lineWidth = Math.max(1.5, s*.08);
    c.beginPath(); c.arc(x, my - s*.18, s*.22, Math.PI*.2, Math.PI*.8); c.stroke();
  }
}

/* ---------- запуск ---------- */
function applyKitLang(){
  document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
  document.title = L(GAME.title);
  $('#btnLang').textContent = lang === 'ru' ? 'Қаз' : 'Рус';
  $('#againTxt').textContent = lang === 'ru' ? 'Ещё раз' : 'Тағы бір рет';
  $('#startTitle').textContent = L(GAME.title);
  $('#startBtn').textContent = lang === 'ru' ? '▶ Играть' : '▶ Ойнау';
  document.querySelectorAll('.mode').forEach((b, i) => { b.querySelector('span').textContent = L(GAME.modes[i].name); });
}
function setMode(m){
  mode = m;
  $('#again').classList.remove('show');
  parts.length = 0; subLift = 0; subTop = false;
  document.querySelectorAll('.mode').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  kitLayout();
  GAME.setMode(m);
  placeSub();
}
let againCb = null;
function showAgain(cb){ againCb = cb; $('#again').classList.add('show'); }

function kitStart(game){
  GAME = game;
  try { stars = parseInt(localStorage.getItem('stars_' + game.key) || '0', 10) || 0; } catch (e) {}
  const modesHtml = game.modes.map(m => `<button class="mode" data-mode="${m.id}">${m.icon}<span></span></button>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `
    <canvas id="c"></canvas><div id="safe"></div>
    <div id="top">
      <div class="side"><a id="home" class="round" href="index.html" aria-label="Меню">🏠</a><div id="stars">⭐ <b id="starsN">${stars}</b></div></div>
      <div class="side"><button id="btnLang" class="round txt"></button><button id="btnMusic" class="round">🎵</button></div>
    </div>
    <button id="again">🔄 <span id="againTxt"></span></button>
    <div id="sub"></div>
    <nav id="modes"${game.modes.length < 2 ? ' style="display:none"' : ''}>${modesHtml}</nav>
    <div id="start"><div class="box"><div class="ico">${game.icon}</div><div><h1 id="startTitle"></h1><button id="startBtn" class="big"></button></div></div></div>`);
  cv = $('#c'); ctx = cv.getContext('2d'); elSub = $('#sub');
  if (stars) $('#stars').style.display = 'flex';
  mode = game.modes[0].id;
  applyKitLang();

  cv.addEventListener('pointerdown', e => {
    if (!started) return;
    audio(); ptr.x = e.clientX; ptr.y = e.clientY; ptr.down = true;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    if (GAME.down) GAME.down(e.clientX, e.clientY, e);
  });
  cv.addEventListener('pointermove', e => {
    if (!started) return;
    ptr.x = e.clientX; ptr.y = e.clientY;
    if (GAME.move) GAME.move(e.clientX, e.clientY, e);
  });
  const up = e => { if (!started) return; ptr.down = false; if (GAME.up) GAME.up(e.clientX, e.clientY, e); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { audio(); sfx.tap(); stopSpeak(); setMode(b.dataset.mode); }));
  $('#btnLang').addEventListener('click', () => {
    audio(); sfx.tap();
    lang = lang === 'ru' ? 'kk' : 'ru';
    try { localStorage.setItem('kids_lang', lang); } catch (e) {}
    applyKitLang();
    if (started && GAME.lang) GAME.lang();
  });
  $('#btnMusic').addEventListener('click', e => { audio(); musicOn = !musicOn; e.currentTarget.classList.toggle('off', !musicOn); if (musicOn) nextNote = now; });
  $('#again').addEventListener('click', () => { audio(); sfx.tap(); $('#again').classList.remove('show'); if (againCb) againCb(); });
  const begin = m => {
    started = true; audio();
    $('#start').style.display = 'none';
    // iOS: «разбудить» синтез речи внутри жеста пользователя
    try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (e) {}
    setMode(m || game.modes[0].id);
  };
  $('#startBtn').addEventListener('click', () => begin());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { try { speechSynthesis.cancel(); } catch (e) {} if (ac) ac.suspend(); }
    else if (ac && started) ac.resume();
  });
  addEventListener('resize', kitLayout);
  addEventListener('orientationchange', () => setTimeout(kitLayout, 250));
  addEventListener('pagehide', () => { try { speechSynthesis.cancel(); } catch (e) {} });

  kitLayout();
  ptr.x = W/2; ptr.y = H/2;
  if (GAME.init) GAME.init();
  GAME.setMode(mode, true);   // нарисовать сцену под стартовым экраном, без озвучки
  let last = performance.now();
  const frame = ts => {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (ts - last)/1000); last = ts; now += dt; frameDt = dt;
    try { kitStep(dt); } catch (e) { console.error(e); }   // сбой одного кадра не должен останавливать игру
  };
  requestAnimationFrame(frame);

  // для проверки: ?start=<режим>&lang=kk
  const qs = new URLSearchParams(location.search);
  if (qs.get('lang')) { lang = qs.get('lang') === 'kk' ? 'kk' : 'ru'; applyKitLang(); }
  if (qs.get('start')) begin(qs.get('start'));
}
function kitStep(dt){
  GAME.update(dt);
  updateParts(dt);
  musicTick();
  GAME.render();
  drawParts(ctx);
  if (GAME.overlay) GAME.overlay();
}

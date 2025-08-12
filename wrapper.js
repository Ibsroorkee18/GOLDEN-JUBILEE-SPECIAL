(() => {
  // ---------- DOM ----------
  const frame = document.getElementById('gameframe');
  const gate = document.getElementById('gate');
  const enterFS = document.getElementById('enterFS');
  const topbar = document.getElementById('topbar');
  const controls = document.getElementById('controls');
  const placement = document.getElementById('placement');
  const placeSet = document.getElementById('placeSet');
  const placeDefaults = document.getElementById('placeDefaults');
  const toast = document.getElementById('toast');

  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const landscapeBtn = document.getElementById('landscape');
  const openPlacement = document.getElementById('openPlacement');
  const resetBtn = document.getElementById('resetBtn');

  // Controls
  const padDock = document.getElementById('padDock');
  const pad = document.getElementById('pad');
  const padKnob = document.querySelector('.padKnob');

  const startDock = document.getElementById('startDock');
  const startBtn = document.getElementById('startBtn');

  // Editor
  const editorOverlay = document.getElementById('editorOverlay');
  const editorTitle = document.getElementById('editorTitle');
  const editSize = document.getElementById('editSize');
  const editOpacity = document.getElementById('editOpacity');
  const editorDone = document.getElementById('editorDone');

  // ---------- Game URL ----------
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // ---------- Utilities ----------
  const css = (k,v)=>document.documentElement.style.setProperty(k,v);
  const getCSS = k => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k));
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  function toastMsg(msg){ toast.textContent = msg; toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>toast.classList.remove('show'), 1400); }
  function focusGame(){ try { frame.focus(); frame.contentWindow?.focus(); } catch(e){} }

  // Device-aware defaults
  (function deviceTune(){
    const shortSide = Math.min(screen.width, screen.height);
    const ua = navigator.userAgent || '';
    let padScale = 1.20, startScale = 1.00;
    if (shortSide <= 360) { padScale = 1.28; startScale = 1.10; }   // small phones
    if (/iPhone|iPad|iPod/i.test(ua)) padScale += 0.06;             // iOS slight bump
    css('--pad-scale', padScale);
    css('--start-scale', startScale);
  })();

  // ---------- Fullscreen + orientation gate ----------
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  const isLandscape = () => window.matchMedia('(orientation: landscape)').matches || (innerWidth > innerHeight);

  async function enterFullscreen(){
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch {}
  }
  async function tryLockLandscape(){
    try {
      if (!isFullscreen()) await enterFullscreen();
      if (screen.orientation?.lock) await screen.orientation.lock('landscape');
      toastMsg('Landscape locked');
    } catch {}
  }
  function updateGate(){
    const ok = isFullscreen() && isLandscape();
    gate.classList.toggle('hidden', ok);
    document.getElementById('stage').setAttribute('aria-hidden', ok ? 'false' : 'true');
    controls.setAttribute('aria-hidden', ok ? 'false' : 'true');
    topbar.style.visibility = ok ? 'visible' : 'hidden';
  }
  addEventListener('resize', updateGate);
  document.addEventListener('fullscreenchange', updateGate);
  document.addEventListener('webkitfullscreenchange', updateGate);
  updateGate();

  enterFS.addEventListener('click', async () => {
    await enterFullscreen();
    await tryLockLandscape();
    updateGate();
    startPlacement(); // ALWAYS on load
    focusGame();
  });
  fullscreenBtn.addEventListener('click', async () => {
    if (isFullscreen()) { try { await document.exitFullscreen?.(); } catch {} }
    else { await enterFullscreen(); }
    updateGate();
  });
  landscapeBtn.addEventListener('click', tryLockLandscape);

  // ---------- Placement state ----------
  let placing = false;
  // A control is “set” if user either dragged it once OR pressed Done in editor
  const setFlags = { pad:false, start:false };
  function bothSet(){ return setFlags.pad && setFlags.start; }
  function updateSetButton(){ placeSet.disabled = !bothSet(); }

  function startPlacement(){
    placing = true;
    document.body.classList.add('placing');
    placement.classList.remove('hidden');
    showStartBtn(false); // cannot start during placement
    setFlags.pad = false; setFlags.start = false; updateSetButton();
    // ensure editors closed
    closeEditor();
  }
  function endPlacement(){
    placing = false;
    document.body.classList.remove('placing');
    placement.classList.add('hidden');
    closeEditor();
    showStartBtn(true); // reveal START
    focusGame();
  }

  // ---------- Drag controls (vw/vh) ----------
  function beginDrag(e){
    if (!placing) return;
    const type = e.currentTarget.getAttribute('data-drag'); // 'pad'|'start'
    const id = e.pointerId;
    const startX = e.clientX, startY = e.clientY;
    const baseX = getCSS(type==='pad'?'--pad-x':'--start-x');
    const baseY = getCSS(type==='pad'?'--pad-y':'--start-y');
    e.currentTarget.setPointerCapture(id);

    function move(ev){
      if (ev.pointerId !== id) return;
      const dx_vw = (ev.clientX - startX) / window.innerWidth * 100;
      const dy_vh = (ev.clientY - startY) / window.innerHeight * 100;
      if (type==='pad'){
        css('--pad-x', clamp(baseX + dx_vw, -20, 20) + 'vw');
        css('--pad-y', clamp(baseY + dy_vh, -12, 12) + 'vh');
        setFlags.pad = true;
      } else {
        css('--start-x', clamp(baseX + dx_vw, -30, 30) + 'vw');
        css('--start-y', clamp(baseY + dy_vh, -15, 15) + 'vh');
        setFlags.start = true;
      }
      updateSetButton();
      ev.preventDefault();
    }
    function up(ev){
      if (ev.pointerId !== id) return;
      e.currentTarget.removeEventListener('pointermove', move);
      e.currentTarget.removeEventListener('pointerup', up);
      e.currentTarget.removeEventListener('pointercancel', up);
      ev.preventDefault();
    }
    e.currentTarget.addEventListener('pointermove', move);
    e.currentTarget.addEventListener('pointerup', up);
    e.currentTarget.addEventListener('pointercancel', up);
    e.preventDefault();
  }
  padDock.addEventListener('pointerdown', beginDrag);
  startDock.addEventListener('pointerdown', beginDrag);

  // ---------- Centered editor ----------
  let editing = null; // 'pad' | 'start' | null
  function openEditor(type){
    if (!placing) return;
    editing = type;
    editorTitle.textContent = type === 'pad' ? 'Edit Touchpad' : 'Edit START';
    editSize.value = getCSS(type==='pad'?'--pad-scale':'--start-scale') || (type==='pad'?1.2:1.0);
    editOpacity.value = getCSS(type==='pad'?'--pad-opacity':'--start-opacity') || 0.9;
    editorOverlay.classList.remove('hidden');
  }
  function closeEditor(){ editorOverlay.classList.add('hidden'); editing = null; }

  // Tap to edit
  pad.addEventListener('click', () => openEditor('pad'));
  startBtn.addEventListener('click', (e) => { if (placing){ openEditor('start'); e.stopPropagation(); } });

  // Sliders → CSS
  editSize.addEventListener('input', e => {
    const v = clamp(parseFloat(e.target.value)||1, 0.9, 1.6);
    if (editing==='pad') css('--pad-scale', v);
    else if (editing==='start') css('--start-scale', v);
  });
  editOpacity.addEventListener('input', e => {
    const v = clamp(parseFloat(e.target.value)||0.9, 0.3, 1.0);
    if (editing==='pad') css('--pad-opacity', v);
    else if (editing==='start') css('--start-opacity', v);
  });

  editorDone.addEventListener('click', () => {
    if (editing==='pad') setFlags.pad = true;
    if (editing==='start') setFlags.start = true;
    updateSetButton();
    closeEditor();
  });

  // Defaults (also marks both set)
  placeDefaults.addEventListener('click', () => {
    css('--pad-x','0vw'); css('--pad-y','0vh'); css('--pad-scale',1.20); css('--pad-opacity',0.9);
    css('--start-x','0vw'); css('--start-y','0vh'); css('--start-scale',1.00); css('--start-opacity',0.9);
    setFlags.pad = true; setFlags.start = true; updateSetButton();
  });

  // SET → lock + reveal START
  placeSet.addEventListener('click', () => {
    if (!bothSet()) { toastMsg('Set both controls first'); return; }
    endPlacement();
    toastMsg('Controls set — press START');
  });

  // Allow re-open placement later via gear
  openPlacement.addEventListener('click', () => startPlacement());

  // ---------- START (Space) ----------
  let startUsed = false;
  function showStartBtn(show){ startBtn.classList.toggle('hidden', !show); }
  showStartBtn(false); // only after SET
  bindPress(startBtn, 'Space', () => {
    if (!placing && !startUsed) {
      startUsed = true;
      showStartBtn(false); // hide after first press
      toastMsg('Start hidden (RESET to restore)');
    }
  });

  // Bind helper for on-screen buttons
  function bindPress(el, name, onUp){
    let active=false;
    const downH = e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active=true; keyDown(name); };
    const upH   = e=>{ if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active=false; keyUp(name); onUp && onUp(); };
    el.addEventListener('pointerdown', downH);
    window.addEventListener('pointerup', upH);
    window.addEventListener('pointercancel', upH);
    el.addEventListener('pointerout', e=>{ if(active) upH(e); });
  }

  // ---------- Key injection ----------
  const keyMap = {
    ArrowUp:    { key:'ArrowUp',   code:'ArrowUp',   keyCode:38, which:38 },
    ArrowDown:  { key:'ArrowDown', code:'ArrowDown', keyCode:40, which:40 },
    ArrowLeft:  { key:'ArrowLeft', code:'ArrowLeft', keyCode:37, which:37 },
    ArrowRight: { key:'ArrowRight',code:'ArrowRight',keyCode:39, which:39 },
    Space:      { key:' ',         code:'Space',     keyCode:32, which:32 }
  };
  const down = new Set();
  function dispatch(to, type, data){
    const ev = new KeyboardEvent(type, { key:data.key, code:data.code, keyCode:data.keyCode, which:data.which, bubbles:true, cancelable:true });
    Object.defineProperty(ev, 'keyCode', { get: () => data.keyCode });
    Object.defineProperty(ev, 'which',   { get: () => data.which });
    to.dispatchEvent(ev);
  }
  function keyDown(name){
    if (placing) return;
    const d = keyMap[name]; if(!d || down.has(name)) return;
    down.add(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keydown',d); dispatch(frame.contentWindow,'keydown',d);
      if (navigator.vibrate) navigator.vibrate(6);
    } catch {}
  }
  function keyUp(name){
    if (placing) return;
    const d = keyMap[name]; if(!d || !down.has(name)) return;
    down.delete(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keyup',d); dispatch(frame.contentWindow,'keyup',d);
    } catch {}
  }

  // ---------- Joystick ----------
  let tracking=false, pid=null;
  let tx=0, ty=0, x=0, y=0;
  const OUTER = 0.92;
  // threshold tuned by screen size
  const baseTH = Math.min(screen.width, screen.height) <= 360 ? 0.26 : 0.28;

  function padRect(){ return pad.getBoundingClientRect(); }
  function setTargetFromEvent(e){
    const r = padRect();
    const cx = r.left + r.width/2; const cy = r.top + r.height/2;
    let dx = (e.clientX - cx) / (r.width*0.5*OUTER);
    let dy = (e.clientY - cy) / (r.height*0.5*OUTER);
    const mag = Math.hypot(dx,dy) || 1;
    dx = (dx/mag) * Math.min(1, Math.abs(dx));
    dy = (dy/mag) * Math.min(1, Math.abs(dy));
    tx = Math.max(-1, Math.min(1, dx));
    ty = Math.max(-1, Math.min(1, dy));
  }
  function centerTarget(){ tx=0; ty=0; moveKnob(0,0,true); }
  function moveKnob(nx,ny,instant=false){
    const r = padRect();
    const px = (r.width/2) + nx * (r.width*0.5*OUTER);
    const py = (r.height/2)+ ny * (r.height*0.5*OUTER);
    padKnob.style.left = px + 'px'; padKnob.style.top = py + 'px';
    if (instant){ x=nx; y=ny; }
  }

  pad.addEventListener('pointerdown', e => { if(placing) return; tracking=true; pid=e.pointerId; setTargetFromEvent(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if(placing || !tracking || e.pointerId!==pid) return; setTargetFromEvent(e); e.preventDefault(); });
  const end = e=>{ if(placing || !tracking || (pid!==null && e.pointerId && e.pointerId!==pid)) return; tracking=false; pid=null; centerTarget(); e.preventDefault(); };
  pad.addEventListener('pointerup', end, {passive:false});
  pad.addEventListener('pointercancel', end, {passive:false});
  window.addEventListener('pointerup', end, {passive:false});

  function tick(){
    const SMOOTH = 0.22;
    x += (tx - x) * SMOOTH; y += (ty - y) * SMOOTH;

    const m = Math.hypot(x,y); const nx = m>1 ? x/m : x; const ny = m>1 ? y/m : y;
    moveKnob(nx, ny);

    const TH = baseTH;
    const L = nx < -TH, R = nx > TH, U = ny < -TH, D = ny > TH;
    L ? keyDown('ArrowLeft')  : keyUp('ArrowLeft');
    R ? keyDown('ArrowRight') : keyUp('ArrowRight');
    U ? keyDown('ArrowUp')    : keyUp('ArrowUp');
    D ? keyDown('ArrowDown')  : keyUp('ArrowDown');

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- START / RESET ----------
  resetBtn.addEventListener('click', () => {
    showStartBtn(true); startUsed = false;
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].forEach(k => keyUp(k));
    centerTarget();
    try { const src = frame.src; frame.src = src; } catch {}
    toastMsg('Game reset');
  });

  // Don’t trap clicks; we already use CSS touch-action to stop scrolling
  // Keep clicks working for buttons & editor.
  // Focus when game loads
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  // Same-origin hint
  try { void frame.contentDocument; } catch { toastMsg('Host game & wrapper on same origin'); }

  // helper: show/hide START
  function showStartBtn(show){ startBtn.classList.toggle('hidden', !show); }

})();

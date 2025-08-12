(() => {
  // ===== DOM =====
  const frame = document.getElementById('gameframe');
  const startBtn = document.getElementById('startBtn');
  const goFull = document.getElementById('goFull');
  const starter = document.getElementById('starter');

  const openSettings = document.getElementById('openSettings');
  const settingsDlg = document.getElementById('settings');
  const rotateBlocker = document.getElementById('rotateBlocker');

  const landscapeBtn = document.getElementById('landscape');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const toast = document.getElementById('toast');

  const spaceBtn = document.getElementById('spaceBtn');

  // Right pad / variants
  const padDock = document.getElementById('padDock');
  const touchpad = document.getElementById('touchpad');
  const ring = document.getElementById('ring');
  const knob = document.getElementById('knob');
  const dpad = document.getElementById('dpad');

  // ===== Settings controls =====
  const modeSel = document.getElementById('mode');
  const snapSel = document.getElementById('snap');
  const sensInp = document.getElementById('sensitivity');
  const uiSizeInp = document.getElementById('uisize');
  const uiOpacityInp = document.getElementById('uiopacity');
  const padScaleInp = document.getElementById('padscale');
  const padXInp = document.getElementById('padx');
  const padYInp = document.getElementById('pady');
  const vibrateChk = document.getElementById('vibrate');
  const resetPrefs = document.getElementById('resetPrefs');

  // ===== Game URL =====
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // ===== Helpers =====
  function focusGame(){ try { frame.focus(); frame.contentWindow && frame.contentWindow.focus(); } catch(e){} }
  function toastMsg(msg){ toast.textContent = msg; toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>toast.classList.remove('show'), 1400); }

  // Orientation overlay
  function updateRotateOverlay(){
    const portrait = window.matchMedia('(orientation: portrait)').matches || (innerHeight > innerWidth);
    rotateBlocker.style.display = portrait ? 'grid' : 'none';
  }
  updateRotateOverlay();
  addEventListener('resize', updateRotateOverlay);

  async function tryLockLandscape(){
    try {
      if (!document.fullscreenElement) await frame.requestFullscreen?.();
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
      toastMsg('Landscape locked');
    } catch(e) { /* iOS/Safari may reject; overlay handles it */ }
  }

  // ===== Key injection =====
  const keyMap = {
    ArrowUp:    { key:'ArrowUp',   code:'ArrowUp',   keyCode:38, which:38 },
    ArrowDown:  { key:'ArrowDown', code:'ArrowDown', keyCode:40, which:40 },
    ArrowLeft:  { key:'ArrowLeft', code:'ArrowLeft', keyCode:37, which:37 },
    ArrowRight: { key:'ArrowRight',code:'ArrowRight',keyCode:39, which:39 },
    Space:      { key:' ',         code:'Space',     keyCode:32, which:32 },
    Enter:      { key:'Enter',     code:'Enter',     keyCode:13, which:13 }
  };
  const down = new Set();
  function dispatch(to, type, data){
    const ev = new KeyboardEvent(type, { key:data.key, code:data.code, keyCode:data.keyCode, which:data.which, bubbles:true, cancelable:true });
    Object.defineProperty(ev, 'keyCode', { get: () => data.keyCode });
    Object.defineProperty(ev, 'which',   { get: () => data.which });
    to.dispatchEvent(ev);
  }
  function keyDown(name){
    const d = keyMap[name]; if(!d || down.has(name)) return;
    down.add(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keydown',d); dispatch(frame.contentWindow,'keydown',d);
      if (P.vibrate && navigator.vibrate) navigator.vibrate(8);
    } catch(e){}
  }
  function keyUp(name){
    const d = keyMap[name]; if(!d || !down.has(name)) return;
    down.delete(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keyup',d); dispatch(frame.contentWindow,'keyup',d);
    } catch(e){}
  }

  // Bind on-screen SPACE and D-Pad keys
  function bindDataKey(el){
    const name = el.getAttribute('data-key'); let active=false;
    const activate = e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active=true; keyDown(name); };
    const deactivate = e=>{ if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active=false; keyUp(name); };
    el.addEventListener('pointerdown', activate);
    window.addEventListener('pointerup', deactivate);
    window.addEventListener('pointercancel', deactivate);
    el.addEventListener('pointerout', e=>{ if(active) deactivate(e); });
  }
  bindDataKey(spaceBtn);
  dpad.querySelectorAll('[data-key]').forEach(bindDataKey);

  // ===== Preferences (persist) =====
  const P = {
    mode:        localStorage.getItem('wrap_mode') || 'touchpad',
    snap:        localStorage.getItem('wrap_snap') || 'smart',
    sensitivity: parseFloat(localStorage.getItem('wrap_sens') || '1.0'),
    uiSize:      parseFloat(localStorage.getItem('wrap_ui') || '1.35'),
    uiOpacity:   parseFloat(localStorage.getItem('wrap_opacity') || '0.98'),
    padScale:    parseFloat(localStorage.getItem('wrap_padscale') || '1.0'),
    padX:        parseFloat(localStorage.getItem('wrap_padx') || '0'),
    padY:        parseFloat(localStorage.getItem('wrap_pady') || '0'),
    vibrate:     localStorage.getItem('wrap_vibrate') !== '0', // default on
  };

  function applyPrefsToUI(){
    modeSel.value = P.mode;
    snapSel.value = P.snap;
    sensInp.value = String(P.sensitivity);
    uiSizeInp.value = String(P.uiSize);
    uiOpacityInp.value = String(P.uiOpacity);
    padScaleInp.value = String(P.padScale);
    padXInp.value = String(P.padX * 100 / 100); // keep same numeric
    padYInp.value = String(P.padY * 100 / 100);
    vibrateChk.checked = !!P.vibrate;

    // show/hide pad variants
    const isTouch = P.mode === 'touchpad';
    touchpad.hidden = !isTouch;
    dpad.hidden = isTouch;

    // CSS variables
    document.documentElement.style.setProperty('--ui-scale', String(P.uiSize));
    document.documentElement.style.setProperty('--ui-opacity', String(P.uiOpacity));
    document.documentElement.style.setProperty('--pad-scale', String(P.padScale));
    document.documentElement.style.setProperty('--pad-offset-x', P.padX + 'vw');
    document.documentElement.style.setProperty('--pad-offset-y', P.padY + 'vh');
  }

  function savePrefs(){
    localStorage.setItem('wrap_mode', P.mode);
    localStorage.setItem('wrap_snap', P.snap);
    localStorage.setItem('wrap_sens', String(P.sensitivity));
    localStorage.setItem('wrap_ui', String(P.uiSize));
    localStorage.setItem('wrap_opacity', String(P.uiOpacity));
    localStorage.setItem('wrap_padscale', String(P.padScale));
    localStorage.setItem('wrap_padx', String(P.padX));
    localStorage.setItem('wrap_pady', String(P.padY));
    localStorage.setItem('wrap_vibrate', P.vibrate ? '1' : '0');
  }

  applyPrefsToUI();

  // ===== Touchpad engine (super smooth) =====
  // EMA smoothing + hysteresis + snap options
  let tracking=false, pid=null;
  let cx=0, cy=0;              // touch origin (px in padDock coords)
  let tx=0, ty=0;              // target vec -1..1
  let x=0,  y=0;               // filtered vec

  // Cached rects
  let rectDock = null, rectPad = null;
  const ro = new ResizeObserver(()=>{
    rectDock = padDock.getBoundingClientRect();
    rectPad = touchpad.getBoundingClientRect();
  });
  ro.observe(padDock); ro.observe(touchpad);

  // Baselines
  const BASE_SMOOTH = 0.24;
  const BASE_DZ     = 0.28;

  function currentSmoothing(){ // higher sens = snappier => reduce smoothing a bit
    const s = P.sensitivity;               // 0.6..1.5
    return Math.max(0.14, Math.min(0.34, BASE_SMOOTH - (s - 1) * 0.08));
  }
  function currentDeadzone(){ // higher sens = smaller deadzone
    const s = P.sensitivity;               // 0.6..1.5
    const dz = BASE_DZ / Math.max(0.7, s); // clamp
    return { enter: dz, exit: dz * 0.72 };
  }

  function setOrigin(px, py){
    if (!rectPad) rectPad = touchpad.getBoundingClientRect();
    cx = Math.max(rectPad.left, Math.min(rectPad.right, px)) - rectPad.left;
    cy = Math.max(rectPad.top,  Math.min(rectPad.bottom,py)) - rectPad.top;
    const rx = (cx / rectPad.width)  * 100;
    const ry = (cy / rectPad.height) * 100;
    ring.style.left = rx + '%'; ring.style.top = ry + '%';
    knob.style.left = rx + '%'; knob.style.top = ry + '%';
  }
  function vectorFrom(px, py){
    if (!rectPad) rectPad = touchpad.getBoundingClientRect();
    const OUTER = 0.90;
    const rx = rectPad.width*0.5*OUTER, ry = rectPad.height*0.5*OUTER;
    const dx = (px - (rectPad.left + cx)) / rx;
    const dy = (py - (rectPad.top  + cy)) / ry;
    const mag = Math.hypot(dx,dy) || 1;
    // normalize into unit circle
    const nx = Math.max(-1, Math.min(1, dx / mag)) * Math.min(1, Math.abs(dx));
    const ny = Math.max(-1, Math.min(1, dy / mag)) * Math.min(1, Math.abs(dy));
    // sensitivity scales magnitude (before clamp)
    const scale = Math.max(0.6, Math.min(1.5, P.sensitivity));
    return { nx: nx * Math.min(1, mag*scale), ny: ny * Math.min(1, mag*scale) };
  }
  function setTargetFromEvent(e){ const v = vectorFrom(e.clientX, e.clientY); tx = v.nx; ty = v.ny; }
  function centerTarget(){ tx = 0; ty = 0; }

  // Pointer listeners (only when touchpad visible)
  function enableTouchpadListeners(enable){
    if (enable) {
      touchpad.addEventListener('pointerdown', onPadDown, {passive:false});
      touchpad.addEventListener('pointermove', onPadMove, {passive:false});
      touchpad.addEventListener('pointerup', onPadEnd, {passive:false});
      touchpad.addEventListener('pointercancel', onPadEnd, {passive:false});
      window.addEventListener('pointerup', onPadEnd, {passive:false});
    } else {
      touchpad.removeEventListener('pointerdown', onPadDown);
      touchpad.removeEventListener('pointermove', onPadMove);
      touchpad.removeEventListener('pointerup', onPadEnd);
      touchpad.removeEventListener('pointercancel', onPadEnd);
      window.removeEventListener('pointerup', onPadEnd);
    }
  }
  function onPadDown(e){ tracking=true; pid=e.pointerId; setOrigin(e.clientX, e.clientY); setTargetFromEvent(e); e.preventDefault(); }
  function onPadMove(e){ if(!tracking || e.pointerId!==pid) return; setTargetFromEvent(e); e.preventDefault(); }
  function onPadEnd(e){ if(!tracking || (pid!==null && e.pointerId && e.pointerId!==pid)) return; tracking=false; pid=null; centerTarget(); e.preventDefault(); }

  // D-Pad listeners (when enabled)
  function enableDpadListeners(enable){
    dpad.querySelectorAll('[data-key]').forEach(el => {
      if (enable) bindDataKey(el);
      else el.replaceWith(el.cloneNode(true)); // quickest unbind: replace node
    });
  }

  // Direction logic
  const dir = { L:false, R:false, U:false, D:false };
  function updateKeysWithSnap(nx, ny){
    const { enter, exit } = currentDeadzone();

    function hyster(axisValue, posKey, negKey){
      const posPressed = dir[posKey], negPressed = dir[negKey];
      if (!posPressed && axisValue >  enter) { dir[posKey] = true;  keyDown(posKey); }
      if ( posPressed && axisValue <= exit)  { dir[posKey] = false; keyUp(posKey);   }
      if (!negPressed && axisValue < -enter) { dir[negKey] = true;  keyDown(negKey); }
      if ( negPressed && axisValue >= -exit) { dir[negKey] = false; keyUp(negKey);   }
    }

    // Snap modes
    const snap = P.snap; // "smart" | "four" | "eight" | "off"
    if (snap === 'four' || P.mode === 'dpad'){
      const ax = Math.abs(nx), ay = Math.abs(ny);
      const s = (ax > ay)
        ? { L: nx < -enter, R: nx > enter, U:false, D:false }
        : { L:false, R:false, U: ny < -enter, D: ny > enter };
      [['ArrowLeft','L'],['ArrowRight','R'],['ArrowUp','U'],['ArrowDown','D']]
        .forEach(([k,c]) => { if (s[c]) keyDown(k); else keyUp(k); });
      return;
    }
    if (snap === 'eight'){
      [['ArrowLeft', nx < -enter], ['ArrowRight', nx > enter], ['ArrowUp', ny < -enter], ['ArrowDown', ny > enter]]
        .forEach(([k,on]) => on ? keyDown(k) : keyUp(k));
      return;
    }
    if (snap === 'smart'){ // dominant-axis (prevents accidental diagonals)
      const ax = Math.abs(nx), ay = Math.abs(ny);
      const s = (ax > ay)
        ? { L: nx < -enter, R: nx > enter, U:false, D:false }
        : { L:false, R:false, U: ny < -enter, D: ny > enter };
      [['ArrowLeft','L'],['ArrowRight','R'],['ArrowUp','U'],['ArrowDown','D']]
        .forEach(([k,c]) => { if (s[c]) keyDown(k); else keyUp(k); });
      return;
    }
    // off: free + hysteresis
    hyster(nx, 'ArrowRight', 'ArrowLeft');
    hyster(ny, 'ArrowDown',  'ArrowUp');
  }

  function tick(){
    // Smoothing toward target
    const SMOOTH = currentSmoothing();
    x += (tx - x) * SMOOTH;
    y += (ty - y) * SMOOTH;

    // Clamp to unit circle
    const m = Math.hypot(x,y); let nx=x, ny=y;
    if (m > 1e-6 && m > 1){ nx = x/m; ny = y/m; }

    // Move knob
    if (!rectPad) rectPad = touchpad.getBoundingClientRect();
    const OUTER = 0.90;
    const rx = rectPad.width*0.5*OUTER, ry = rectPad.height*0.5*OUTER;
    const px = (cx + nx*rx) / rectPad.width * 100;
    const py = (cy + ny*ry) / rectPad.height * 100;
    knob.style.left = px + '%'; knob.style.top = py + '%';

    // Update keys
    if (P.mode === 'touchpad') updateKeysWithSnap(nx, ny);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ===== Settings behavior =====
  function applyPrefs(){
    // visibility
    touchpad.hidden = P.mode !== 'touchpad';
    dpad.hidden = P.mode !== 'dpad';
    enableTouchpadListeners(P.mode === 'touchpad');
    enableDpadListeners(P.mode === 'dpad');

    // CSS vars
    document.documentElement.style.setProperty('--ui-scale', String(P.uiSize));
    document.documentElement.style.setProperty('--ui-opacity', String(P.uiOpacity));
    document.documentElement.style.setProperty('--pad-scale', String(P.padScale));
    document.documentElement.style.setProperty('--pad-offset-x', P.padX + 'vw');
    document.documentElement.style.setProperty('--pad-offset-y', P.padY + 'vh');
  }

  // UI inputs → prefs
  modeSel.addEventListener('change', e => { P.mode = e.target.value; savePrefs(); applyPrefs(); toastMsg(P.mode === 'touchpad' ? 'Touchpad' : 'D-Pad'); });
  snapSel.addEventListener('change', e => { P.snap = e.target.value; savePrefs(); toastMsg('Snap: ' + P.snap); });
  sensInp.addEventListener('input', e => { P.sensitivity = parseFloat(e.target.value||'1'); savePrefs(); });
  uiSizeInp.addEventListener('input', e => { P.uiSize = parseFloat(e.target.value||'1.35'); savePrefs(); applyPrefs(); });
  uiOpacityInp.addEventListener('input', e => { P.uiOpacity = parseFloat(e.target.value||'0.98'); savePrefs(); applyPrefs(); });
  padScaleInp.addEventListener('input', e => { P.padScale = parseFloat(e.target.value||'1'); savePrefs(); applyPrefs(); });
  padXInp.addEventListener('input', e => { P.padX = parseFloat(e.target.value||'0'); savePrefs(); applyPrefs(); });
  padYInp.addEventListener('input', e => { P.padY = parseFloat(e.target.value||'0'); savePrefs(); applyPrefs(); });
  vibrateChk.addEventListener('change', e => { P.vibrate = !!e.target.checked; savePrefs(); });

  resetPrefs.addEventListener('click', () => {
    P.mode='touchpad'; P.snap='smart'; P.sensitivity=1.0; P.uiSize=1.35; P.uiOpacity=0.98; P.padScale=1.0; P.padX=0; P.padY=0; P.vibrate=true;
    savePrefs(); applyPrefs(); applyPrefsToUI(); toastMsg('Settings reset');
  });

  // Open/close settings
  openSettings.addEventListener('click', () => settingsDlg.showModal());
  settingsDlg.addEventListener('close', () => focusGame());

  // ===== UX: starter / fullscreen / landscape =====
  startBtn.addEventListener('click', async () => {
    focusGame();
    await tryLockLandscape();
    setTimeout(()=>{ starter.style.display='none'; focusGame(); }, 50);
  });
  goFull.addEventListener('click', async () => { try{ if(!document.fullscreenElement) await frame.requestFullscreen?.(); }catch(e){} });

  fullscreenBtn.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (frame.requestFullscreen) await frame.requestFullscreen(); } catch(e){}
    focusGame();
  });
  landscapeBtn.addEventListener('click', tryLockLandscape);

  // Game focus on load
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  // Prevent page scroll while using controls
  ['touchstart','touchmove','touchend'].forEach(t =>
    document.getElementById('controls').addEventListener(t, e => e.preventDefault(), { passive:false })
  );

  // Same-origin hint (so key events can reach the game)
  try { void frame.contentDocument; } catch(e){ toastMsg('Host game on same domain so keys work'); }

  // Init settings UI & listeners
  applyPrefsToUI(); applyPrefs();
})();

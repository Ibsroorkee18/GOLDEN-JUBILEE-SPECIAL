(() => {
  // ---------- DOM ----------
  const frame = document.getElementById('gameframe');

  const gate = document.getElementById('gate');
  const enterFS = document.getElementById('enterFS');

  const topbar = document.getElementById('topbar');
  const controls = document.getElementById('controls');
  const openSettings = document.getElementById('openSettings');
  const settingsDlg = document.getElementById('settings');
  const landscapeBtn = document.getElementById('landscape');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const toast = document.getElementById('toast');

  const spaceBtn = document.getElementById('spaceBtn');

  const padDock = document.getElementById('padDock');
  const touchpad = document.getElementById('touchpad');
  const ring = document.getElementById('ring');
  const knob = document.getElementById('knob');
  const dpad = document.getElementById('dpad');

  // Settings inputs
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

  // ---------- Game URL ----------
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // ---------- Helpers ----------
  function isFullscreen(){
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }
  async function enterFullscreen(){
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch(e){}
  }
  async function tryLockLandscape(){
    try {
      if (!isFullscreen()) await enterFullscreen();
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
      toastMsg('Landscape locked');
    } catch(e){}
  }
  function isLandscape(){
    return window.matchMedia('(orientation: landscape)').matches || (innerWidth > innerHeight);
  }
  function updateGate(){
    const ok = isFullscreen() && isLandscape();
    gate.classList.toggle('hidden', ok);
    // when allowed, enable stage + controls
    document.getElementById('stage').setAttribute('aria-hidden', ok ? 'false' : 'true');
    controls.setAttribute('aria-hidden', ok ? 'false' : 'true');
    topbar.style.visibility = ok ? 'visible' : 'hidden';
  }
  addEventListener('resize', updateGate);
  document.addEventListener('fullscreenchange', updateGate);
  document.addEventListener('webkitfullscreenchange', updateGate);

  function toastMsg(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>toast.classList.remove('show'), 1400);
  }
  function focusGame(){ try { frame.focus(); frame.contentWindow?.focus(); } catch(e){} }

  // ---------- Fullscreen / orientation gate ----------
  enterFS.addEventListener('click', async () => {
    await enterFullscreen();
    await tryLockLandscape();
    updateGate();
    focusGame();
  });
  fullscreenBtn.addEventListener('click', async () => {
    if (isFullscreen()) {
      try { await document.exitFullscreen?.(); } catch(e){}
    } else {
      await enterFullscreen();
    }
    updateGate();
  });
  landscapeBtn.addEventListener('click', tryLockLandscape);

  // Show gate initially
  updateGate();

  // ---------- Key injection ----------
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
      if (P.vibrate && navigator.vibrate) navigator.vibrate(7);
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

  // On-screen buttons
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

  // ---------- Preferences ----------
  const P = {
    mode:        localStorage.getItem('wrap_mode') || 'touchpad',
    snap:        localStorage.getItem('wrap_snap') || 'smart',
    sensitivity: parseFloat(localStorage.getItem('wrap_sens') || '1.0'),
    uiSize:      parseFloat(localStorage.getItem('wrap_ui') || '1.35'),
    uiOpacity:   parseFloat(localStorage.getItem('wrap_opacity') || '0.98'),
    padScale:    parseFloat(localStorage.getItem('wrap_padscale') || '1.0'),
    padX:        parseFloat(localStorage.getItem('wrap_padx') || '0'),
    padY:        parseFloat(localStorage.getItem('wrap_pady') || '0'),
    vibrate:     localStorage.getItem('wrap_vibrate') !== '0',
  };
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
  function applyPrefsToUI(){
    modeSel.value = P.mode;
    snapSel.value = P.snap;
    sensInp.value = String(P.sensitivity);
    uiSizeInp.value = String(P.uiSize);
    uiOpacityInp.value = String(P.uiOpacity);
    padScaleInp.value = String(P.padScale);
    padXInp.value = String(P.padX);
    padYInp.value = String(P.padY);
    vibrateChk.checked = !!P.vibrate;

    // CSS vars
    document.documentElement.style.setProperty('--ui-scale', String(P.uiSize));
    document.documentElement.style.setProperty('--ui-opacity', String(P.uiOpacity));
    document.documentElement.style.setProperty('--pad-scale', String(P.padScale));
    document.documentElement.style.setProperty('--pad-offset-x', P.padX + 'vw');
    document.documentElement.style.setProperty('--pad-offset-y', P.padY + 'vh');

    // Pad flavor
    const isTouch = P.mode === 'touchpad';
    touchpad.hidden = !isTouch;
    dpad.hidden = isTouch;
    enableTouchpadListeners(isTouch);
    enableDpadListeners(!isTouch);
  }
  function resetDefaults(){
    P.mode='touchpad'; P.snap='smart'; P.sensitivity=1.0; P.uiSize=1.35; P.uiOpacity=0.98; P.padScale=1.0; P.padX=0; P.padY=0; P.vibrate=true;
  }

  // ---------- Settings listeners ----------
  openSettings.addEventListener('click', () => settingsDlg.showModal());
  settingsDlg.addEventListener('close', () => focusGame());
  modeSel.addEventListener('change', e => { P.mode = e.target.value; savePrefs(); applyPrefsToUI(); toastMsg(P.mode === 'touchpad' ? 'Touchpad' : 'D-Pad'); });
  snapSel.addEventListener('change', e => { P.snap = e.target.value; savePrefs(); toastMsg('Snap: ' + P.snap); });
  sensInp.addEventListener('input', e => { P.sensitivity = parseFloat(e.target.value||'1'); savePrefs(); });
  uiSizeInp.addEventListener('input', e => { P.uiSize = parseFloat(e.target.value||'1.35'); savePrefs(); applyPrefsToUI(); });
  uiOpacityInp.addEventListener('input', e => { P.uiOpacity = parseFloat(e.target.value||'0.98'); savePrefs(); applyPrefsToUI(); });
  padScaleInp.addEventListener('input', e => { P.padScale = parseFloat(e.target.value||'1'); savePrefs(); applyPrefsToUI(); });
  padXInp.addEventListener('input', e => { P.padX = parseFloat(e.target.value||'0'); savePrefs(); applyPrefsToUI(); });
  padYInp.addEventListener('input', e => { P.padY = parseFloat(e.target.value||'0'); savePrefs(); applyPrefsToUI(); });
  vibrateChk.addEventListener('change', e => { P.vibrate = !!e.target.checked; savePrefs(); });
  resetPrefs.addEventListener('click', () => { resetDefaults(); savePrefs(); applyPrefsToUI(); toastMsg('Settings reset'); });

  // ---------- Touchpad engine (super smooth) ----------
  let tracking=false, pid=null;
  let cx=0, cy=0;              // origin within pad
  let tx=0, ty=0;              // target vector
  let x=0,  y=0;               // filtered vector
  let rectPad = null;

  const ro = new ResizeObserver(()=>{ rectPad = touchpad.getBoundingClientRect(); });
  ro.observe(touchpad);

  function currentSmoothing(){ // higher sens -> snappier (lower smoothing)
    const s = P.sensitivity;
    return Math.max(0.14, Math.min(0.34, 0.24 - (s - 1) * 0.08));
  }
  function currentDeadzone(){
    const s = P.sensitivity;
    const enter = 0.28 / Math.max(0.7, s);
    return { enter, exit: enter * 0.72 };
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
    // normalize into unit circle then apply sensitivity
    const nx = Math.max(-1, Math.min(1, dx / mag)) * Math.min(1, Math.abs(dx));
    const ny = Math.max(-1, Math.min(1, dy / mag)) * Math.min(1, Math.abs(dy));
    const scale = Math.max(0.6, Math.min(1.5, P.sensitivity));
    return { nx: nx * Math.min(1, mag*scale), ny: ny * Math.min(1, mag*scale) };
  }
  function setTargetFromEvent(e){ const v = vectorFrom(e.clientX, e.clientY); tx = v.nx; ty = v.ny; }
  function centerTarget(){ tx = 0; ty = 0; }

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
  function onPadDown(e){ tracking=true; pid=e.pointerId; setOrigin(e.clientX,e.clientY); setTargetFromEvent(e); e.preventDefault(); }
  function onPadMove(e){ if(!tracking || e.pointerId!==pid) return; setTargetFromEvent(e); e.preventDefault(); }
  function onPadEnd(e){ if(!tracking || (pid!==null && e.pointerId && e.pointerId!==pid)) return; tracking=false; pid=null; centerTarget(); e.preventDefault(); }

  // D-Pad listeners
  function enableDpadListeners(enable){
    dpad.querySelectorAll('[data-key]').forEach(el => {
      const clone = el.cloneNode(true);
      if (enable) {
        const name = el.getAttribute('data-key'); let active=false;
        const activate = e=>{ e.preventDefault(); e.stopPropagation(); clone.classList.add('active'); active=true; keyDown(name); };
        const deactivate = e=>{ if(!active) return; e && (e.preventDefault(), e.stopPropagation()); clone.classList.remove('active'); active=false; keyUp(name); };
        clone.addEventListener('pointerdown', activate);
        window.addEventListener('pointerup', deactivate);
        window.addEventListener('pointercancel', deactivate);
        clone.addEventListener('pointerout', e=>{ if(active) deactivate(e); });
      }
      el.replaceWith(clone);
    });
  }

  // Direction state
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
    if (snap === 'smart'){ // dominant axis (prevents accidental diagonals)
      const ax = Math.abs(nx), ay = Math.abs(ny);
      const s = (ax > ay)
        ? { L: nx < -enter, R: nx > enter, U:false, D:false }
        : { L:false, R:false, U: ny < -enter, D: ny > enter };
      [['ArrowLeft','L'],['ArrowRight','R'],['ArrowUp','U'],['ArrowDown','D']]
        .forEach(([k,c]) => { if (s[c]) keyDown(k); else keyUp(k); });
      return;
    }
    // off: free with hysteresis
    hyster(nx, 'ArrowRight', 'ArrowLeft');
    hyster(ny, 'ArrowDown',  'ArrowUp');
  }

  function tick(){
    // Smooth toward target
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

    // Keys
    if (P.mode === 'touchpad') updateKeysWithSnap(nx, ny);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- Apply prefs & init ----------
  function applyPrefsToUI(){
    document.documentElement.style.setProperty('--ui-scale', String(P.uiSize));
    document.documentElement.style.setProperty('--ui-opacity', String(P.uiOpacity));
    document.documentElement.style.setProperty('--pad-scale', String(P.padScale));
    document.documentElement.style.setProperty('--pad-offset-x', P.padX + 'vw');
    document.documentElement.style.setProperty('--pad-offset-y', P.padY + 'vh');

    const isTouch = P.mode === 'touchpad';
    touchpad.hidden = !isTouch;
    dpad.hidden = isTouch;
    enableTouchpadListeners(isTouch);
    enableDpadListeners(!isTouch);

    // form values
    modeSel.value = P.mode; snapSel.value = P.snap; sensInp.value = String(P.sensitivity);
    uiSizeInp.value = String(P.uiSize); uiOpacityInp.value = String(P.uiOpacity);
    padScaleInp.value = String(P.padScale); padXInp.value = String(P.padX); padYInp.value = String(P.padY);
    vibrateChk.checked = !!P.vibrate;
  }
  applyPrefsToUI();

  // ---------- Settings interactions ----------
  openSettings.addEventListener('click', () => settingsDlg.showModal());
  settingsDlg.addEventListener('close', () => focusGame());

  modeSel.addEventListener('change', e => { P.mode = e.target.value; savePrefs(); applyPrefsToUI(); toastMsg(P.mode==='touchpad'?'Touchpad':'D-Pad'); });
  snapSel.addEventListener('change', e => { P.snap = e.target.value; savePrefs(); toastMsg('Snap: '+P.snap); });
  sensInp.addEventListener('input', e => { P.sensitivity = parseFloat(e.target.value||'1'); savePrefs(); });
  uiSizeInp.addEventListener('input', e => { P.uiSize = parseFloat(e.target.value||'1.35'); savePrefs(); applyPrefsToUI(); });
  uiOpacityInp.addEventListener('input', e => { P.uiOpacity = parseFloat(e.target.value||'0.98'); savePrefs(); applyPrefsToUI(); });
  padScaleInp.addEventListener('input', e => { P.padScale = parseFloat(e.target.value||'1'); savePrefs(); applyPrefsToUI(); });
  padXInp.addEventListener('input', e => { P.padX = parseFloat(e.target.value||'0'); savePrefs(); applyPrefsToUI(); });
  padYInp.addEventListener('input', e => { P.padY = parseFloat(e.target.value||'0'); savePrefs(); applyPrefsToUI(); });
  vibrateChk.addEventListener('change', e => { P.vibrate = !!e.target.checked; savePrefs(); });
  resetPrefs.addEventListener('click', () => {
    P.mode='touchpad'; P.snap='smart'; P.sensitivity=1.0; P.uiSize=1.35; P.uiOpacity=0.98; P.padScale=1.0; P.padX=0; P.padY=0; P.vibrate=true;
    savePrefs(); applyPrefsToUI(); toastMsg('Settings reset');
  });

  // ---------- Prevent page scroll while using controls ----------
  ['touchstart','touchmove','touchend'].forEach(t =>
    controls.addEventListener(t, e => e.preventDefault(), { passive:false })
  );

  // ---------- Final touches ----------
  frame.addEventListener('load', () => setTimeout(focusGame, 60));
  // Hint if cross-origin breaks input
  try { void frame.contentDocument; } catch(e){ toastMsg('Host game on same domain so input works'); }
})();

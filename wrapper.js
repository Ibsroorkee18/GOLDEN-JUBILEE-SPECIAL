(() => {
  // ---------- DOM ----------
  const frame = document.getElementById('gameframe');

  const gate = document.getElementById('gate');
  const enterFS = document.getElementById('enterFS');

  const topbar = document.getElementById('topbar');
  const controls = document.getElementById('controls');
  const openSettings = document.getElementById('openSettings');
  const settingsDlg = document.getElementById('settings');
  const resetBtn = document.getElementById('resetBtn');
  const landscapeBtn = document.getElementById('landscape');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const toast = document.getElementById('toast');

  const spaceDock = document.getElementById('spaceDock');
  const spaceBtn = document.getElementById('spaceBtn');

  const padDock = document.getElementById('padDock');
  const touchpad = document.getElementById('touchpad');
  const ring = document.getElementById('ring');
  const knob = document.getElementById('knob');

  const placement = document.getElementById('placement');
  const placeSave = document.getElementById('placeSave');
  const placeSkip = document.getElementById('placeSkip');
  const placeReset = document.getElementById('placeReset');

  // Settings inputs
  const snapSel = document.getElementById('snap');
  const sensInp = document.getElementById('sensitivity');
  const uiSizeInp = document.getElementById('uisize');
  const uiOpacityInp = document.getElementById('uiopacity');
  const padScaleInp = document.getElementById('padscale');
  const padXInp = document.getElementById('padx');
  const padYInp = document.getElementById('pady');
  const spaceScaleInp = document.getElementById('spacescale');
  const spaceXInp = document.getElementById('spacex');
  const spaceYInp = document.getElementById('spacey');
  const vibrateChk = document.getElementById('vibrate');
  const resetPrefs = document.getElementById('resetPrefs');
  const adjustNow = document.getElementById('adjustNow');

  // ---------- Game URL ----------
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // ---------- Helpers ----------
  const isFullscreen = () =>
    !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
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
  const isLandscape = () => window.matchMedia('(orientation: landscape)').matches || (innerWidth > innerHeight);

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

  function toastMsg(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>toast.classList.remove('show'), 1400);
  }
  function focusGame(){ try { frame.focus(); frame.contentWindow?.focus(); } catch(e){} }

  // ---------- Preferences ----------
  const P = {
    snap:        localStorage.getItem('wrap_snap') || 'eight',
    sensitivity: parseFloat(localStorage.getItem('wrap_sens') || '1.0'),
    uiSize:      parseFloat(localStorage.getItem('wrap_ui') || '1.45'),
    uiOpacity:   parseFloat(localStorage.getItem('wrap_opacity') || '0.92'),
    padScale:    parseFloat(localStorage.getItem('wrap_padscale') || '1.1'),
    padX:        parseFloat(localStorage.getItem('wrap_padx') || '0'),
    padY:        parseFloat(localStorage.getItem('wrap_pady') || '0'),
    spaceScale:  parseFloat(localStorage.getItem('wrap_spacescale') || '1'),
    spaceX:      parseFloat(localStorage.getItem('wrap_spacex') || '0'),
    spaceY:      parseFloat(localStorage.getItem('wrap_spacey') || '0'),
    vibrate:     localStorage.getItem('wrap_vibrate') !== '0',
    placed:      localStorage.getItem('wrap_placed') === '1'
  };
  function savePrefs(){
    localStorage.setItem('wrap_snap', P.snap);
    localStorage.setItem('wrap_sens', String(P.sensitivity));
    localStorage.setItem('wrap_ui', String(P.uiSize));
    localStorage.setItem('wrap_opacity', String(P.uiOpacity));
    localStorage.setItem('wrap_padscale', String(P.padScale));
    localStorage.setItem('wrap_padx', String(P.padX));
    localStorage.setItem('wrap_pady', String(P.padY));
    localStorage.setItem('wrap_spacescale', String(P.spaceScale));
    localStorage.setItem('wrap_spacex', String(P.spaceX));
    localStorage.setItem('wrap_spacey', String(P.spaceY));
    localStorage.setItem('wrap_vibrate', P.vibrate ? '1' : '0');
  }
  function applyPrefsToUI(){
    // sliders/inputs
    snapSel.value = P.snap;
    sensInp.value = String(P.sensitivity);
    uiSizeInp.value = String(P.uiSize);
    uiOpacityInp.value = String(P.uiOpacity);
    padScaleInp.value = String(P.padScale);
    padXInp.value = String(P.padX);
    padYInp.value = String(P.padY);
    spaceScaleInp.value = String(P.spaceScale);
    spaceXInp.value = String(P.spaceX);
    spaceYInp.value = String(P.spaceY);
    vibrateChk.checked = !!P.vibrate;

    // css vars
    document.documentElement.style.setProperty('--ui-scale', String(P.uiSize));
    document.documentElement.style.setProperty('--ui-opacity', String(P.uiOpacity));
    document.documentElement.style.setProperty('--pad-scale', String(P.padScale));
    document.documentElement.style.setProperty('--pad-offset-x', P.padX + 'vw');
    document.documentElement.style.setProperty('--pad-offset-y', P.padY + 'vh');
    document.documentElement.style.setProperty('--space-scale', String(P.spaceScale));
    document.documentElement.style.setProperty('--space-offset-x', P.spaceX + 'vw');
    document.documentElement.style.setProperty('--space-offset-y', P.spaceY + 'vh');
  }
  function resetDefaults(){
    P.snap='eight'; P.sensitivity=1.0; P.uiSize=1.45; P.uiOpacity=0.92;
    P.padScale=1.1; P.padX=0; P.padY=0;
    P.spaceScale=1.0; P.spaceX=0; P.spaceY=0;
    P.vibrate=true;
  }
  applyPrefsToUI();

  // ---------- Fullscreen / orientation gate ----------
  enterFS.addEventListener('click', async () => {
    await enterFullscreen();
    await tryLockLandscape();
    updateGate();
    // Placement step on first run or if ?place=1
    const forcePlace = (new URLSearchParams(location.search).get('place') === '1');
    if (!P.placed || forcePlace) startPlacement();
    focusGame();
  });
  fullscreenBtn.addEventListener('click', async () => {
    if (isFullscreen()) { try { await document.exitFullscreen?.(); } catch(e){} }
    else { await enterFullscreen(); }
    updateGate();
  });
  landscapeBtn.addEventListener('click', tryLockLandscape);
  updateGate();

  // ---------- Key injection (blocked during placement) ----------
  let placementActive = false;

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
    if (placementActive) return; // don't send keys while placing
    const d = keyMap[name]; if(!d || down.has(name)) return;
    down.add(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keydown',d); dispatch(frame.contentWindow,'keydown',d);
      if (P.vibrate && navigator.vibrate) navigator.vibrate(7);
    } catch(e){}
  }
  function keyUp(name){
    if (placementActive) return;
    const d = keyMap[name]; if(!d || !down.has(name)) return;
    down.delete(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keyup',d); dispatch(frame.contentWindow,'keyup',d);
    } catch(e){}
  }

  // Bind START (SPACE)
  (function bindDataKey(el){
    const name = el.getAttribute('data-key'); let active=false;
    const activate = e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active=true; keyDown(name); };
    const deactivate = e=>{ if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active=false; keyUp(name); };
    el.addEventListener('pointerdown', activate);
    window.addEventListener('pointerup', deactivate);
    window.addEventListener('pointercancel', deactivate);
    el.addEventListener('pointerout', e=>{ if(active) deactivate(e); });
  })(spaceBtn);

  // START hides after first complete press
  let spaceUsed = localStorage.getItem('wrap_space_used') === '1';
  function updateSpaceVisibility(){ spaceBtn.classList.toggle('hidden', spaceUsed); }
  updateSpaceVisibility();
  spaceBtn.addEventListener('pointerup', () => {
    if (!spaceUsed && !placementActive) {
      spaceUsed = true;
      localStorage.setItem('wrap_space_used','1');
      updateSpaceVisibility();
      toastMsg('Start hidden (use RESET to restore)');
    }
  });

  // ---------- Super-smooth touchpad ----------
  let tracking=false, pid=null;
  let cx=0, cy=0;              // origin within pad
  let tx=0, ty=0;              // target vector
  let x=0,  y=0;               // filtered vector
  let rectPad = null;

  const ro = new ResizeObserver(()=>{ rectPad = touchpad.getBoundingClientRect(); });
  ro.observe(touchpad);

  function currentSmoothing(){ // higher sens -> snappier (lower smoothing)
    const s = P.sensitivity;  // 0.6..1.5
    return Math.max(0.14, Math.min(0.34, 0.24 - (s - 1) * 0.08));
  }
  function currentDeadzone(){
    const s = P.sensitivity;
    const enter = 0.26 / Math.max(0.7, s);     // small DZ: good for diagonals
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

  function onPadDown(e){ if(placementActive) return; tracking=true; pid=e.pointerId; setOrigin(e.clientX,e.clientY); setTargetFromEvent(e); e.preventDefault(); }
  function onPadMove(e){ if(placementActive) return; if(!tracking || e.pointerId!==pid) return; setTargetFromEvent(e); e.preventDefault(); }
  function onPadEnd(e){ if(placementActive) return; if(!tracking || (pid!==null && e.pointerId && e.pointerId!==pid)) return; tracking=false; pid=null; centerTarget(); e.preventDefault(); }
  touchpad.addEventListener('pointerdown', onPadDown, {passive:false});
  touchpad.addEventListener('pointermove', onPadMove, {passive:false});
  touchpad.addEventListener('pointerup', onPadEnd, {passive:false});
  touchpad.addEventListener('pointercancel', onPadEnd, {passive:false});
  window.addEventListener('pointerup', onPadEnd, {passive:false});

  const dir = { L:false, R:false, U:false, D:false };
  function updateKeys(nx, ny){
    if (placementActive) return;
    const { enter } = currentDeadzone();
    // default: 8-way
    [['ArrowLeft', nx < -enter], ['ArrowRight', nx > enter], ['ArrowUp', ny < -enter], ['ArrowDown', ny > enter]]
      .forEach(([k,on]) => on ? keyDown(k) : keyUp(k));
    if (P.snap === 'smart'){
      const ax = Math.abs(nx), ay = Math.abs(ny);
      const s = (ax > ay)
        ? { L: nx < -enter, R: nx > enter, U:false, D:false }
        : { L:false, R:false, U: ny < -enter, D: ny > enter };
      [['ArrowLeft','L'],['ArrowRight','R'],['ArrowUp','U'],['ArrowDown','D']]
        .forEach(([k,c]) => { if (s[c]) keyDown(k); else keyUp(k); });
    } else if (P.snap === 'off'){
      // simple hysteresis
      const exit = enter * 0.72;
      function hyster(axisValue, posKey, negKey){
        const posPressed = dir[posKey], negPressed = dir[negKey];
        if (!posPressed && axisValue >  enter) { dir[posKey] = true;  keyDown(posKey); }
        if ( posPressed && axisValue <= exit)  { dir[posKey] = false; keyUp(posKey);   }
        if (!negPressed && axisValue < -enter) { dir[negKey] = true;  keyDown(negKey); }
        if ( negPressed && axisValue >= -exit) { dir[negKey] = false; keyUp(negKey);   }
      }
      hyster(nx, 'ArrowRight', 'ArrowLeft');
      hyster(ny, 'ArrowDown',  'ArrowUp');
    }
  }

  function tick(){
    // Smooth toward target (EMA)
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
    updateKeys(nx, ny);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- Placement mode (drag & pinch) ----------
  let dragState = null; // { type:'pad'|'space', id, startX, startY, baseX, baseY }
  let pinchState = null; // { startDist, baseScale }

  function startPlacement(){
    placementActive = true;
    document.body.classList.add('placing');
    placement.classList.remove('hidden');
    // Make sure UI is visible
    updateGate();
  }
  function endPlacement(save=true){
    placementActive = false;
    document.body.classList.remove('placing');
    placement.classList.add('hidden');
    if (save){
      P.placed = true;
      localStorage.setItem('wrap_placed','1');
      savePrefs();
      applyPrefsToUI();
      focusGame();
    }
  }

  // Drag start
  function onDragStart(e){
    const target = e.currentTarget.getAttribute('data-drag'); // 'pad' or 'space'
    const id = e.pointerId;
    dragState = {
      type: target, id,
      startX: e.clientX, startY: e.clientY,
      baseX: target==='pad' ? P.padX : P.spaceX,
      baseY: target==='pad' ? P.padY : P.spaceY
    };
    e.currentTarget.setPointerCapture(id);
    e.preventDefault();
  }
  function onDragMove(e){
    if (!dragState || e.pointerId !== dragState.id) return;
    const dx_vw = (e.clientX - dragState.startX) / window.innerWidth * 100;
    const dy_vh = (e.clientY - dragState.startY) / window.innerHeight * 100;
    if (dragState.type === 'pad'){
      P.padX = clamp(dragState.baseX + dx_vw, -20, 20);
      P.padY = clamp(dragState.baseY + dy_vh, -12, 12);
    } else {
      P.spaceX = clamp(dragState.baseX + dx_vw, -30, 30);
      P.spaceY = clamp(dragState.baseY + dy_vh, -15, 15);
    }
    applyPrefsToUI();
    e.preventDefault();
  }
  function onDragEnd(e){
    if (!dragState || e.pointerId !== dragState.id) return;
    dragState = null;
    e.preventDefault();
  }

  // Pinch to scale the PAD
  const activePointers = new Map();
  function onPadPointerDown(e){
    if (e.pointerType !== 'touch') return; // pinch only for touch
    activePointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (activePointers.size === 2){
      const pts = [...activePointers.values()];
      pinchState = { startDist: dist(pts[0], pts[1]), baseScale: P.padScale };
    }
  }
  function onPadPointerMove(e){
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (pinchState && activePointers.size === 2){
      const pts = [...activePointers.values()];
      const d = dist(pts[0], pts[1]);
      const ratio = d / Math.max(1, pinchState.startDist);
      P.padScale = clamp(pinchState.baseScale * ratio, 0.9, 1.5);
      applyPrefsToUI();
    }
  }
  function onPadPointerUp(e){
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchState = null;
  }
  function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  // Attach drag listeners (only meaningful while placing)
  padDock.addEventListener('pointerdown', onDragStart);
  padDock.addEventListener('pointermove', onDragMove);
  padDock.addEventListener('pointerup', onDragEnd);
  padDock.addEventListener('pointercancel', onDragEnd);

  spaceDock.addEventListener('pointerdown', onDragStart);
  spaceDock.addEventListener('pointermove', onDragMove);
  spaceDock.addEventListener('pointerup', onDragEnd);
  spaceDock.addEventListener('pointercancel', onDragEnd);

  // Pinch listeners on pad dock
  padDock.addEventListener('pointerdown', onPadPointerDown);
  padDock.addEventListener('pointermove', onPadPointerMove);
  padDock.addEventListener('pointerup', onPadPointerUp);
  padDock.addEventListener('pointercancel', onPadPointerUp);
  window.addEventListener('pointerup', onPadPointerUp);

  // Placement buttons
  placeSave.addEventListener('click', () => endPlacement(true));
  placeSkip.addEventListener('click', () => endPlacement(true));
  placeReset.addEventListener('click', () => { resetDefaults(); applyPrefsToUI(); });

  // Settings “Adjust by Dragging”
  adjustNow.addEventListener('click', () => { settingsDlg.close(); startPlacement(); });

  // ---------- Settings ----------
  function saveAndApply(){ savePrefs(); applyPrefsToUI(); }
  openSettings.addEventListener('click', () => settingsDlg.showModal());
  settingsDlg.addEventListener('close', () => focusGame());
  snapSel.addEventListener('change', e => { P.snap = e.target.value; savePrefs(); toastMsg('Snap: ' + P.snap); });
  sensInp.addEventListener('input', e => { P.sensitivity = parseFloat(e.target.value||'1'); savePrefs(); });
  uiSizeInp.addEventListener('input', e => { P.uiSize = parseFloat(e.target.value||'1.45'); saveAndApply(); });
  uiOpacityInp.addEventListener('input', e => { P.uiOpacity = parseFloat(e.target.value||'0.92'); saveAndApply(); });
  padScaleInp.addEventListener('input', e => { P.padScale = parseFloat(e.target.value||'1.1'); saveAndApply(); });
  padXInp.addEventListener('input', e => { P.padX = parseFloat(e.target.value||'0'); saveAndApply(); });
  padYInp.addEventListener('input', e => { P.padY = parseFloat(e.target.value||'0'); saveAndApply(); });
  spaceScaleInp.addEventListener('input', e => { P.spaceScale = parseFloat(e.target.value||'1'); saveAndApply(); });
  spaceXInp.addEventListener('input', e => { P.spaceX = parseFloat(e.target.value||'0'); saveAndApply(); });
  spaceYInp.addEventListener('input', e => { P.spaceY = parseFloat(e.target.value||'0'); saveAndApply(); });
  vibrateChk.addEventListener('change', e => { P.vibrate = !!e.target.checked; savePrefs(); });
  resetPrefs.addEventListener('click', () => { resetDefaults(); saveAndApply(); toastMsg('Settings reset'); });

  // ---------- Reset game & restore START ----------
  resetBtn.addEventListener('click', () => {
    spaceUsed = false;
    localStorage.setItem('wrap_space_used','0');
    updateSpaceVisibility();

    // release held keys & recenter
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].forEach(keyUp);
    centerTarget();

    // reload game
    try { const src = frame.src; frame.src = src; } catch(e){}
    toastMsg('Game reset');
  });

  // Prevent page scroll while using overlay
  ['touchstart','touchmove','touchend'].forEach(t =>
    controls.addEventListener(t, e => e.preventDefault(), { passive:false })
  );

  // Focus when ready
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  // Same-origin hint (so key events reach game)
  try { void frame.contentDocument; } catch(e){ toastMsg('Host game & wrapper on same origin'); }
})();

(() => {
  // ---------- DOM ----------
  const frame = document.getElementById('gameframe');
  const gate = document.getElementById('gate');
  const enterFS = document.getElementById('enterFS');
  const topbar = document.getElementById('topbar');
  const controls = document.getElementById('controls');
  const placement = document.getElementById('placement');
  const toast = document.getElementById('toast');

  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const landscapeBtn = document.getElementById('landscape');
  const openPlacement = document.getElementById('openPlacement');
  const resetBtn = document.getElementById('resetBtn');

  const placeSet = document.getElementById('placeSet');
  const placeDefaults = document.getElementById('placeDefaults');
  const forceStart = document.getElementById('forceStart');

  // Checklist bits
  const padStatus = document.getElementById('padStatus');
  const startStatus = document.getElementById('startStatus');
  const editPadBtn = document.getElementById('editPad');
  const movePadBtn = document.getElementById('movePad');
  const editStartBtn = document.getElementById('editStart');
  const moveStartBtn = document.getElementById('moveStart');

  // Editor
  const editorOverlay = document.getElementById('editorOverlay');
  const editorTitle = document.getElementById('editorTitle');
  const editSize = document.getElementById('editSize');
  const editOpacity = document.getElementById('editOpacity');
  const editorDone = document.getElementById('editorDone');
  const editorCancel = document.getElementById('editorCancel');
  const finishMove = document.getElementById('finishMove');

  // Controls
  const padDock = document.getElementById('padDock');
  const pad = document.getElementById('pad');
  const padKnob = document.querySelector('.padKnob');
  const startDock = document.getElementById('startDock');
  const startBtn = document.getElementById('startBtn');

  // ---------- Game URL ----------
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // ---------- Utils ----------
  const css = (k,v)=>document.documentElement.style.setProperty(k,v);
  const getCSS = k => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k));
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  function toastMsg(msg){ toast.textContent = msg; toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>toast.classList.remove('show'), 1400); }
  function focusGame(){ try { frame.focus(); frame.contentWindow?.focus(); } catch{} }

  // Device-aware defaults (one-time per load)
  (function tuneDefaults(){
    const ss = Math.min(screen.width, screen.height); // short side
    const ua = navigator.userAgent || '';
    let padScale = 1.22, startScale = 1.00;
    if (ss <= 360) { padScale = 1.30; startScale = 1.10; } // small phones
    if (/iPhone|iPad|iPod/i.test(ua)) padScale += 0.06;   // iOS thumb bias
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

  // Enter app
  enterFS.addEventListener('click', async () => {
    await enterFullscreen();
    await tryLockLandscape();
    updateGate();
    startPlacement(); // ALWAYS on every page load
    focusGame();
  });
  fullscreenBtn.addEventListener('click', async () => {
    if (isFullscreen()) { try { await document.exitFullscreen?.(); } catch{} }
    else { await enterFullscreen(); }
    updateGate();
  });
  landscapeBtn.addEventListener('click', tryLockLandscape);

  // ---------- Placement flow ----------
  let placing = false;
  const setFlags = { pad:false, start:false };
  function markStatus(){
    const on = s => { s.classList.remove('off'); s.classList.add('on'); s.textContent = 'Set'; };
    const off = s => { s.classList.remove('on'); s.classList.add('off'); s.textContent = 'Not set'; };
    setFlags.pad ? on(padStatus) : off(padStatus);
    setFlags.start ? on(startStatus) : off(startStatus);
    placeSet.disabled = !(setFlags.pad && setFlags.start);
  }
  function startPlacement(){
    placing = true;
    document.body.classList.add('placing');
    placement.classList.remove('hidden');
    showStartBtn(false);
    // reset flags each time you enter placement
    setFlags.pad = false; setFlags.start = false; markStatus();
    // close editor/move if any left hanging
    closeEditor();
    stopMove();
  }
  function endPlacement(){
    placing = false;
    document.body.classList.remove('placing');
    placement.classList.add('hidden');
    closeEditor();
    stopMove();
    showStartBtn(true);
    focusGame();
  }

  // Checklist actions
  editPadBtn.addEventListener('click', () => openEditor('pad'));
  editStartBtn.addEventListener('click', () => openEditor('start'));
  movePadBtn.addEventListener('click', () => beginMove('pad'));
  moveStartBtn.addEventListener('click', () => beginMove('start'));

  // Defaults (also mark set)
  placeDefaults.addEventListener('click', () => {
    css('--pad-x','0vw'); css('--pad-y','0vh'); css('--pad-scale',1.22); css('--pad-opacity',0.92);
    css('--start-x','0vw'); css('--start-y','0vh'); css('--start-scale',1.00); css('--start-opacity',0.92);
    setFlags.pad = true; setFlags.start = true; markStatus();
  });

  // Force Start fallback (for any weird device)
  forceStart.addEventListener('click', () => { endPlacement(); toastMsg('Controls set — press START'); });

  // SET (strict)
  placeSet.addEventListener('click', () => {
    if (placeSet.disabled){ toastMsg('Set both controls first'); return; }
    endPlacement();
    toastMsg('Controls set — press START');
  });

  // ---------- Editor (centered) ----------
  let editing = null; // 'pad' | 'start' | null
  const editorState = { size: 1, opacity: 0.92, prev: null };

  function openEditor(type){
    if (!placing) return;
    editing = type;
    editorTitle.textContent = type === 'pad' ? 'Edit Touchpad' : 'Edit START';
    editorState.prev = {
      scale: getCSS(type==='pad'?'--pad-scale':'--start-scale'),
      opacity: getCSS(type==='pad'?'--pad-opacity':'--start-opacity'),
    };
    editSize.value = editorState.prev.scale || (type==='pad'?1.22:1.00);
    editOpacity.value = editorState.prev.opacity || 0.92;
    editorOverlay.classList.remove('hidden');
  }
  function closeEditor(){
    editorOverlay.classList.add('hidden');
    editing = null;
  }
  editorDone.addEventListener('click', () => {
    if (editing==='pad') setFlags.pad = true;
    if (editing==='start') setFlags.start = true;
    markStatus();
    closeEditor();
  });
  editorCancel.addEventListener('click', () => {
    if (!editing) return closeEditor();
    // revert
    if (editing==='pad'){
      css('--pad-scale', editorState.prev.scale || 1.22);
      css('--pad-opacity', editorState.prev.opacity || 0.92);
    } else {
      css('--start-scale', editorState.prev.scale || 1.00);
      css('--start-opacity', editorState.prev.opacity || 0.92);
    }
    closeEditor();
  });
  editSize.addEventListener('input', e => {
    const v = clamp(parseFloat(e.target.value)||1, 0.9, 1.7);
    if (editing==='pad') css('--pad-scale', v);
    else if (editing==='start') css('--start-scale', v);
  });
  editOpacity.addEventListener('input', e => {
    const v = clamp(parseFloat(e.target.value)||0.92, 0.25, 1.0);
    if (editing==='pad') css('--pad-opacity', v);
    else if (editing==='start') css('--start-opacity', v);
  });

  // ---------- Move mode (drag one control, then Done) ----------
  let moving = null; // 'pad' | 'start' | null
  let dragId = null, dragBaseX=0, dragBaseY=0, dragStartX=0, dragStartY=0;
  function beginMove(type){
    if (!placing) return;
    closeEditor();
    moving = type;
    finishMove.classList.remove('hidden');
    finishMove.textContent = `Done Moving ${type==='pad'?'Touchpad':'START'}`;
  }
  function stopMove(){
    moving = null;
    finishMove.classList.add('hidden');
  }
  finishMove.addEventListener('click', () => {
    if (moving==='pad') setFlags.pad = true;
    if (moving==='start') setFlags.start = true;
    markStatus();
    stopMove();
  });

  function startDrag(e){
    if (!placing || !moving) return;
    const styleKeyX = moving==='pad' ? '--pad-x' : '--start-x';
    const styleKeyY = moving==='pad' ? '--pad-y' : '--start-y';
    dragId = e.pointerId;
    dragBaseX = getCSS(styleKeyX);
    dragBaseY = getCSS(styleKeyY);
    dragStartX = e.clientX; dragStartY = e.clientY;
    e.currentTarget.setPointerCapture?.(dragId);
    e.preventDefault();
  }
  function moveDrag(e){
    if (!placing || !moving || e.pointerId!==dragId) return;
    const dx_vw = (e.clientX - dragStartX) / window.innerWidth * 100;
    const dy_vh = (e.clientY - dragStartY) / window.innerHeight * 100;
    if (moving==='pad'){
      css('--pad-x', clamp(dragBaseX + dx_vw, -20, 20) + 'vw');
      css('--pad-y', clamp(dragBaseY + dy_vh, -12, 12) + 'vh');
    } else {
      css('--start-x', clamp(dragBaseX + dx_vw, -30, 30) + 'vw');
      css('--start-y', clamp(dragBaseY + dy_vh, -15, 15) + 'vh');
    }
    e.preventDefault();
  }
  function endDrag(e){
    if (!placing || !moving || e.pointerId!==dragId) return;
    dragId = null;
    e.preventDefault();
  }
  // Attach to BOTH docks (drag only during move mode)
  padDock.addEventListener('pointerdown', startDrag, {passive:false});
  padDock.addEventListener('pointermove', moveDrag, {passive:false});
  padDock.addEventListener('pointerup', endDrag, {passive:false});
  padDock.addEventListener('pointercancel', endDrag, {passive:false});
  startDock.addEventListener('pointerdown', startDrag, {passive:false});
  startDock.addEventListener('pointermove', moveDrag, {passive:false});
  startDock.addEventListener('pointerup', endDrag, {passive:false});
  startDock.addEventListener('pointercancel', endDrag, {passive:false});

  // ---------- On-screen START (Space) ----------
  let startUsed = false;
  function showStartBtn(show){ startBtn.classList.toggle('hidden', !show); }
  showStartBtn(false); // visible only after SET / forceStart
  bindPress(startBtn, 'Space', () => {
    if (!placing && !startUsed) {
      startUsed = true;
      showStartBtn(false); // hide after first press
      toastMsg('Start hidden (RESET to restore)');
    }
  });

  // Helper to bind screen button → key events
  function bindPress(el, name, onUp){
    let active=false;
    const downH = e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active=true; keyDown(name); };
    const upH   = e=>{ if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active=false; keyUp(name); onUp && onUp(); };
    el.addEventListener('pointerdown', downH);
    window.addEventListener('pointerup', upH);
    window.addEventListener('pointercancel', upH);
    el.addEventListener('pointerout', e=>{ if(active) upH(e); });
  }

  // ---------- Keyboard injection ----------
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

  // ---------- Reset ----------
  resetBtn.addEventListener('click', () => {
    showStartBtn(true); startUsed = false;
    // release keys & re-center
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].forEach(k => keyUp(k));
    centerTarget();

    // hard reload the iframe to avoid stale state
    try {
      const src = frame.src;
      frame.src = 'about:blank';
      setTimeout(() => { frame.src = src; }, 30);
    } catch {}

    toastMsg('Game reset');
  });

  // Focus when ready
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  // Same-origin hint (key events need same origin)
  try { void frame.contentDocument; } catch { toastMsg('Host game & wrapper on same origin for controls'); }

  // helper: show/hide START
  function showStartBtn(show){ startBtn.classList.toggle('hidden', !show); }
})();

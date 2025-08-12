(() => {
  // --- DOM ---
  const frame = document.getElementById('gameframe');
  const gate = document.getElementById('gate');
  const enterFS = document.getElementById('enterFS');
  const topbar = document.getElementById('topbar');
  const controls = document.getElementById('controls');
  const placement = document.getElementById('placement');
  const toast = document.getElementById('toast');

  const landscapeBtn = document.getElementById('landscape');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const openPlacement = document.getElementById('openPlacement');
  const resetBtn = document.getElementById('resetBtn');
  const placeSetStart = document.getElementById('placeSetStart');
  const placeDefaults = document.getElementById('placeDefaults');

  // START
  const startDock = document.getElementById('startDock');
  const startBtn  = document.getElementById('startBtn');
  const startEditor = document.getElementById('startEditor');
  const startSize = document.getElementById('startSize');
  const startOpacity = document.getElementById('startOpacity');

  // PAD
  const padDock = document.getElementById('padDock');
  const pad = document.getElementById('pad');
  const padRing = document.querySelector('.padRing');
  const padKnob = document.querySelector('.padKnob');
  const padEditor = document.getElementById('padEditor');
  const padSize = document.getElementById('padSize');
  const padOpacity = document.getElementById('padOpacity');

  // --- Game URL ---
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // --- Helpers ---
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  const isLandscape = () => window.matchMedia('(orientation: landscape)').matches || (innerWidth > innerHeight);
  function toastMsg(msg){ toast.textContent = msg; toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>toast.classList.remove('show'), 1400); }
  function focusGame(){ try { frame.focus(); frame.contentWindow?.focus(); } catch(e){} }

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

  // Always show placement on every page load
  let placing = false;
  function startPlacement(){
    placing = true;
    document.body.classList.add('placing');
    placement.classList.remove('hidden');
    // show both mini editors closed initially
    closeEditor(padEditor);
    closeEditor(startEditor);
    // require interaction with both before enabling SET
    touched.pad = false; touched.start = false;
    updateSetButton();
  }
  function endPlacement(){
    placing = false;
    document.body.classList.remove('placing');
    placement.classList.add('hidden');
    closeEditor(padEditor); closeEditor(startEditor);
    focusGame();
  }
  function updateSetButton(){
    placeSetStart.disabled = !(touched.pad && touched.start);
  }

  // Gate entry
  enterFS.addEventListener('click', async () => {
    await enterFullscreen();
    await tryLockLandscape();
    updateGate();
    startPlacement();  // ALWAYS on load
    focusGame();
  });
  fullscreenBtn.addEventListener('click', async () => {
    if (isFullscreen()) { try { await document.exitFullscreen?.(); } catch(e){} }
    else { await enterFullscreen(); }
    updateGate();
  });
  landscapeBtn.addEventListener('click', tryLockLandscape);
  updateGate();

  // --- Key injection (block while placing) ---
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
    if (placing) return; // don’t send keys in placement
    const d = keyMap[name]; if(!d || down.has(name)) return;
    down.add(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keydown',d); dispatch(frame.contentWindow,'keydown',d);
      if (navigator.vibrate) navigator.vibrate(6);
    } catch(e){}
  }
  function keyUp(name){
    if (placing) return;
    const d = keyMap[name]; if(!d || !down.has(name)) return;
    down.delete(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keyup',d); dispatch(frame.contentWindow,'keyup',d);
    } catch(e){}
  }

  // START button behavior (session-based visibility)
  let startUsed = false;
  function showStartBtn(show){ startBtn.classList.toggle('hidden', !show); }
  showStartBtn(true); // always show on each page load
  bindPress(startBtn, 'Space', () => {
    // after first press, hide START for rest of the session (until RESET)
    if (!startUsed && !placing) { startUsed = true; showStartBtn(false); toastMsg('Start hidden (RESET to restore)'); }
  });

  // Binding helper for on-screen keys
  function bindPress(el, name, onUp){
    let active=false;
    const downH = e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active=true; keyDown(name); };
    const upH   = e=>{ if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active=false; keyUp(name); onUp && onUp(); };
    el.addEventListener('pointerdown', downH);
    window.addEventListener('pointerup', upH);
    window.addEventListener('pointercancel', upH);
    el.addEventListener('pointerout', e=>{ if(active) upH(e); });
  }

  // --- Circular pad joystick (fixed center) ---
  let tracking=false, pid=null;
  let tx=0, ty=0, x=0, y=0; // target & filtered (-1..1)
  const OUTER = 0.92;       // knob travel fraction
  function getPadRect(){ return pad.getBoundingClientRect(); }
  function setTargetFromEvent(e){
    const r = getPadRect();
    const cx = r.left + r.width/2; const cy = r.top + r.height/2;
    let dx = (e.clientX - cx) / (r.width*0.5*OUTER);
    let dy = (e.clientY - cy) / (r.height*0.5*OUTER);
    const mag = Math.hypot(dx,dy) || 1;
    dx = (dx/mag) * Math.min(1, Math.abs(dx));
    dy = (dy/mag) * Math.min(1, Math.abs(dy));
    const scale = 1.0; // sensitivity already tuned
    tx = Math.max(-1, Math.min(1, dx * scale));
    ty = Math.max(-1, Math.min(1, dy * scale));
  }
  function centerTarget(){ tx=0; ty=0; }

  pad.addEventListener('pointerdown', e => { if(placing) return; tracking=true; pid=e.pointerId; setTargetFromEvent(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if(placing || !tracking || e.pointerId!==pid) return; setTargetFromEvent(e); e.preventDefault(); });
  const end = e=>{ if(placing || !tracking || (pid!==null && e.pointerId && e.pointerId!==pid)) return; tracking=false; pid=null; centerTarget(); e.preventDefault(); };
  pad.addEventListener('pointerup', end, {passive:false});
  pad.addEventListener('pointercancel', end, {passive:false});
  window.addEventListener('pointerup', end, {passive:false});

  function tick(){
    // smoothing
    const SMOOTH = 0.22;
    x += (tx - x) * SMOOTH; y += (ty - y) * SMOOTH;

    // clamp and move knob
    const m = Math.hypot(x,y); const nx = m>1 ? x/m : x; const ny = m>1 ? y/m : y;
    const r = getPadRect();
    const px = (r.width/2) + nx * (r.width*0.5*OUTER);
    const py = (r.height/2)+ ny * (r.height*0.5*OUTER);
    padKnob.style.left = px + 'px'; padKnob.style.top = py + 'px';

    // keys (8-way default; diagonals allowed)
    const TH = 0.28;
    const L = nx < -TH, R = nx > TH, U = ny < -TH, D = ny > TH;
    L ? keyDown('ArrowLeft')  : keyUp('ArrowLeft');
    R ? keyDown('ArrowRight') : keyUp('ArrowRight');
    U ? keyDown('ArrowUp')    : keyUp('ArrowUp');
    D ? keyDown('ArrowDown')  : keyUp('ArrowDown');

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // --- Placement (drag + per-control mini editors) ---
  const touched = { pad:false, start:false }; // must touch both before SET
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  // Dragging in vw/vh units
  function beginDrag(e){
    if (!placing) return;
    const type = e.currentTarget.getAttribute('data-drag'); // 'pad'|'start'
    const id = e.pointerId;
    const startX = e.clientX, startY = e.clientY;
    const baseX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(type==='pad' ? '--pad-x' : '--start-x'));
    const baseY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(type==='pad' ? '--pad-y' : '--start-y'));
    e.currentTarget.setPointerCapture(id);
    function move(ev){
      if (ev.pointerId !== id) return;
      const dx_vw = (ev.clientX - startX) / window.innerWidth * 100;
      const dy_vh = (ev.clientY - startY) / window.innerHeight * 100;
      if (type==='pad'){
        document.documentElement.style.setProperty('--pad-x', clamp(baseX + dx_vw, -20, 20) + 'vw');
        document.documentElement.style.setProperty('--pad-y', clamp(baseY + dy_vh, -12, 12) + 'vh');
        touched.pad = true; updateSetButton();
      } else {
        document.documentElement.style.setProperty('--start-x', clamp(baseX + dx_vw, -30, 30) + 'vw');
        document.documentElement.style.setProperty('--start-y', clamp(baseY + dy_vh, -15, 15) + 'vh');
        touched.start = true; updateSetButton();
      }
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

  // Mini editors (open by tapping the control while placing)
  function openEditor(editor, forType){
    if (!placing) return;
    editor.hidden = false;
    // seed sliders from CSS vars
    if (forType==='pad'){
      padSize.value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad-scale')) || 1.2;
      padOpacity.value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad-opacity')) || 0.9;
      touched.pad = true; updateSetButton();
    } else {
      startSize.value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--start-scale')) || 1.0;
      startOpacity.value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--start-opacity')) || 0.9;
      touched.start = true; updateSetButton();
    }
  }
  function closeEditor(editor){ editor.hidden = true; }
  pad.addEventListener('click', () => openEditor(padEditor,'pad'));
  startBtn.addEventListener('click', (e) => {
    if (placing){ openEditor(startEditor,'start'); e.stopPropagation(); }
  });
  padEditor.querySelector('.miniClose').addEventListener('click', ()=>closeEditor(padEditor));
  startEditor.querySelector('.miniClose').addEventListener('click', ()=>closeEditor(startEditor));

  // Editor sliders → CSS vars
  padSize.addEventListener('input', e => {
    document.documentElement.style.setProperty('--pad-scale', clamp(parseFloat(e.target.value)||1.2, 0.9, 1.5));
  });
  padOpacity.addEventListener('input', e => {
    document.documentElement.style.setProperty('--pad-opacity', clamp(parseFloat(e.target.value)||0.9, 0.3, 1.0));
  });
  startSize.addEventListener('input', e => {
    document.documentElement.style.setProperty('--start-scale', clamp(parseFloat(e.target.value)||1.0, 0.9, 1.5));
  });
  startOpacity.addEventListener('input', e => {
    document.documentElement.style.setProperty('--start-opacity', clamp(parseFloat(e.target.value)||0.9, 0.3, 1.0));
  });

  // Defaults button during placement
  placeDefaults.addEventListener('click', () => {
    document.documentElement.style.setProperty('--pad-x', '0vw');
    document.documentElement.style.setProperty('--pad-y', '0vh');
    document.documentElement.style.setProperty('--pad-scale', 1.2);
    document.documentElement.style.setProperty('--pad-opacity', 0.9);
    document.documentElement.style.setProperty('--start-x', '0vw');
    document.documentElement.style.setProperty('--start-y', '0vh');
    document.documentElement.style.setProperty('--start-scale', 1.0);
    document.documentElement.style.setProperty('--start-opacity', 0.9);
    touched.pad = true; touched.start = true; updateSetButton();
  });

  // SET & START: lock controls, start game
  placeSetStart.addEventListener('click', () => {
    if (placeSetStart.disabled) return;
    endPlacement();
    showStartBtn(true); // visible at first so player can start
    toastMsg('Controls locked — tap START');
  });

  // Open placement later via gear
  openPlacement.addEventListener('click', () => startPlacement());

  // --- RESET: reload game only, also restore START ---
  resetBtn.addEventListener('click', () => {
    showStartBtn(true); // bring back start
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].forEach(k => keyUp(k));
    try { const src = frame.src; frame.src = src; } catch(e){}
    toastMsg('Game reset');
  });

  // Prevent page scroll while interacting with overlay controls
  ['touchstart','touchmove','touchend'].forEach(t =>
    document.getElementById('controls').addEventListener(t, e => e.preventDefault(), { passive:false })
  );

  // Focus when ready
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  // Same-origin hint (so key events reach game)
  try { void frame.contentDocument; } catch(e){ toastMsg('Host game & wrapper on same origin'); }
})();

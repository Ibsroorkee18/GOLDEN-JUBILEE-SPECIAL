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
  const placeSet = document.getElementById('placeSet');
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
  const css = (k,v)=>document.documentElement.style.setProperty(k,v);
  const getCSS = k => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k));
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  function toastMsg(msg){ toast.textContent = msg; toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>toast.classList.remove('show'), 1400); }
  function focusGame(){ try { frame.focus(); frame.contentWindow?.focus(); } catch(e){} }

  // Device-aware defaults (rough tuning for small/large phones)
  (function tuneDefaults(){
    const w = Math.min(screen.width, screen.height);
    const ua = navigator.userAgent || "";
    let padScale = 1.22, startScale = 1.0;
    if (w <= 360) { padScale = 1.28; startScale = 1.1; }        // small phones
    if (/iPhone|iPad|iPod/i.test(ua)) padScale += 0.06;          // iOS thumb bias
    css('--pad-scale', padScale);
    css('--start-scale', startScale);
  })();

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
  updateGate();

  // Always show placement on every page load
  let placing = false;
  const done = { pad:false, start:false };
  function startPlacement(){
    placing = true;
    document.body.classList.add('placing');
    placement.classList.remove('hidden');
    showStartBtn(false); // hide START while placing
    // reset gates each time
    done.pad = false; done.start = false; updateSetButton();
    closeEditor(padEditor); closeEditor(startEditor);
  }
  function endPlacement(){
    placing = false;
    document.body.classList.remove('placing');
    placement.classList.add('hidden');
    closeEditor(padEditor); closeEditor(startEditor);
    showStartBtn(true); // after SET, show START to begin
    focusGame();
  }
  function updateSetButton(){ placeSet.disabled = !(done.pad && done.start); }

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
    if (placing) return;
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

  // START button: visible after placement; hides after first press
  let startUsed = false;
  function showStartBtn(show){ startBtn.classList.toggle('hidden', !show); }
  showStartBtn(false); // hidden until you SET controls
  bindPress(startBtn, 'Space', () => {
    if (!placing && !startUsed) {
      startUsed = true;
      showStartBtn(false); // hide for the session
      toastMsg('Start hidden (RESET to restore)');
    }
  });

  // Binding helper
  function bindPress(el, name, onUp){
    let active=false;
    const downH = e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active=true; keyDown(name); };
    const upH   = e=>{ if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active=false; keyUp(name); onUp && onUp(); };
    el.addEventListener('pointerdown', downH);
    window.addEventListener('pointerup', upH);
    window.addEventListener('pointercancel', upH);
    el.addEventListener('pointerout', e=>{ if(active) upH(e); });
  }

  // --- Circular pad joystick ---
  let tracking=false, pid=null;
  let tx=0, ty=0, x=0, y=0;
  const OUTER = 0.92;
  const TH = 0.28; // key threshold

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
    // smoothing
    const SMOOTH = 0.22;
    x += (tx - x) * SMOOTH; y += (ty - y) * SMOOTH;

    // move knob
    const m = Math.hypot(x,y); const nx = m>1 ? x/m : x; const ny = m>1 ? y/m : y;
    moveKnob(nx, ny);

    // keys: 8-way diagonals
    const L = nx < -TH, R = nx > TH, U = ny < -TH, D = ny > TH;
    L ? keyDown('ArrowLeft')  : keyUp('ArrowLeft');
    R ? keyDown('ArrowRight') : keyUp('ArrowRight');
    U ? keyDown('ArrowUp')    : keyUp('ArrowUp');
    D ? keyDown('ArrowDown')  : keyUp('ArrowDown');

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // --- Placement (drag + per-control mini editors) ---
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
      } else {
        css('--start-x', clamp(baseX + dx_vw, -30, 30) + 'vw');
        css('--start-y', clamp(baseY + dy_vh, -15, 15) + 'vh');
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

  // Editors (tap control to open while placing)
  function openEditor(editor, type){
    if (!placing) return;
    editor.hidden = false;
    if (type==='pad'){
      padSize.value = getCSS('--pad-scale') || 1.22;
      padOpacity.value = getCSS('--pad-opacity') || 0.9;
    } else {
      startSize.value = getCSS('--start-scale') || 1.0;
      startOpacity.value = getCSS('--start-opacity') || 0.9;
    }
  }
  function closeEditor(editor){ editor.hidden = true; }

  pad.addEventListener('click', () => openEditor(padEditor,'pad'));
  startBtn.addEventListener('click', (e) => { if (placing){ openEditor(startEditor,'start'); e.stopPropagation(); } });

  // Editor sliders → CSS vars (also mark that control "done" once they tweak)
  padSize.addEventListener('input', e => { css('--pad-scale', clamp(parseFloat(e.target.value)||1.22, 0.9, 1.5)); });
  padOpacity.addEventListener('input', e => { css('--pad-opacity', clamp(parseFloat(e.target.value)||0.9, 0.3, 1.0)); });
  startSize.addEventListener('input', e => { css('--start-scale', clamp(parseFloat(e.target.value)||1.0, 0.9, 1.5)); });
  startOpacity.addEventListener('input', e => { css('--start-opacity', clamp(parseFloat(e.target.value)||0.9, 0.3, 1.0)); });

  // Done buttons: must press Done on BOTH to enable SET
  padEditor.querySelector('.miniClose').addEventListener('click', () => { closeEditor(padEditor); done.pad = true; updateSetButton(); });
  startEditor.querySelector('.miniClose').addEventListener('click', () => { closeEditor(startEditor); done.start = true; updateSetButton(); });

  // Defaults button during placement (also marks both done)
  placeDefaults.addEventListener('click', () => {
    css('--pad-x','0vw'); css('--pad-y','0vh'); css('--pad-scale',1.22); css('--pad-opacity',0.9);
    css('--start-x','0vw'); css('--start-y','0vh'); css('--start-scale',1.0); css('--start-opacity',0.9);
    done.pad = true; done.start = true; updateSetButton();
  });

  // If user taps SET while an editor is open, auto-close & accept it as done
  placeSet.addEventListener('click', () => {
    if (!placing) return;
    if (!done.pad || !done.start){
      // Auto-accept any open editor as done, then re-check
      if (!done.pad && !padEditor.hidden) { closeEditor(padEditor); done.pad = true; }
      if (!done.start && !startEditor.hidden) { closeEditor(startEditor); done.start = true; }
      updateSetButton();
      if (placeSet.disabled){ toastMsg('Tap Done on both controls first'); return; }
    }
    endPlacement(); // locks placement
    toastMsg('Controls set — press START');
  });

  // Open placement later via gear (optional)
  openPlacement.addEventListener('click', () => startPlacement());

  // --- RESET: reload game only, also restore START & center pad ---
  resetBtn.addEventListener('click', () => {
    showStartBtn(true); startUsed = false;
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].forEach(k => keyUp(k));
    centerTarget();
    try { const src = frame.src; frame.src = src; } catch(e){}
    toastMsg('Game reset');
  });

  // Prevent page scroll while interacting with overlay
  ['touchstart','touchmove','touchend','pointerdown','pointermove','pointerup'].forEach(t =>
    controls.addEventListener(t, e => e.preventDefault(), { passive:false })
  );

  // Focus when ready
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  // Same-origin hint
  try { void frame.contentDocument; } catch(e){ toastMsg('Host game & wrapper on same origin'); }
})();

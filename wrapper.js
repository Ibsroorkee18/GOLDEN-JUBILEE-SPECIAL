(() => {
  // ===== DOM =====
  const frame = document.getElementById('gameframe');
  const startBtn = document.getElementById('startBtn');
  const goFull = document.getElementById('goFull');
  const starter = document.getElementById('starter');
  const landscapeBtn = document.getElementById('landscape');
  const toggleControls = document.getElementById('toggleControls');
  const controls = document.getElementById('controls');
  const toast = document.getElementById('toast');

  const zone = document.getElementById('touchzone');
  const ring = document.getElementById('ring');
  const knob = document.getElementById('knob');

  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const resetBtn = document.getElementById('resetBtn');
  const spaceBtn = document.getElementById('spaceBtn');

  // ===== Game loading =====
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  function focusGame(){ try { frame.focus(); frame.contentWindow && frame.contentWindow.focus(); } catch(e){} }
  function toastMsg(msg){ toast.textContent = msg; toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>toast.classList.remove('show'), 1500); }

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
      if (navigator.vibrate) navigator.vibrate(8);
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

  // ===== SPACE auto-hide after first press (persist until RESET) =====
  let spaceUsed = localStorage.getItem('wrap_space_used') === '1';
  function updateSpaceVisibility(){
    if (spaceUsed) spaceBtn.classList.add('hidden');
    else spaceBtn.classList.remove('hidden');
  }
  updateSpaceVisibility();

  // Bind SPACE/ENTER buttons (multi-touch friendly)
  document.querySelectorAll('[data-key]').forEach(el => {
    const name = el.getAttribute('data-key'); let active=false;
    const activate = e=>{
      e.preventDefault(); e.stopPropagation();
      el.classList.add('active'); active=true; keyDown(name);
    };
    const deactivate = e=>{
      if(!active) return;
      e && (e.preventDefault(), e.stopPropagation());
      el.classList.remove('active'); active=false; keyUp(name);
      // hide SPACE after the first completed press
      if (el === spaceBtn && !spaceUsed) {
        spaceUsed = true;
        localStorage.setItem('wrap_space_used','1');
        updateSpaceVisibility();
        toastMsg('Start hidden — use RESET to bring it back');
      }
    };
    el.addEventListener('pointerdown', activate);
    window.addEventListener('pointerup', deactivate);
    window.addEventListener('pointercancel', deactivate);
    el.addEventListener('pointerout', e=>{ if(active) deactivate(e); });
  });

  // RESET button: bring SPACE back + reload the game + recenter stick
  resetBtn.addEventListener('click', () => {
    spaceUsed = false;
    localStorage.setItem('wrap_space_used','0');
    updateSpaceVisibility();
    // recenter joystick + clear any held keys
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Enter'].forEach(keyUp);
    centerTarget();
    // reload iframe
    try { const src = frame.src; frame.src = src; } catch(e){}
    toastMsg('Reset complete');
  });

  // ===== Peak touchpad (dynamic origin + smoothing + smart 4-way snap) =====
  const SMOOTHING = 0.24;   // EMA smoothing factor (0..1)
  const OUTER     = 0.90;   // knob travel (fraction of ring radius)
  const DZ_ENTER  = 0.28;   // deadzone enter
  const DZ_EXIT   = 0.20;   // deadzone exit (for hysteresis feel)

  let tracking=false, pid=null; // pointer tracking
  let cx=0, cy=0;              // current origin (px inside zone)
  let tx=0, ty=0;              // target vector (-1..1)
  let x=0,  y=0;               // filtered vector

  // cache rect each interaction (perf)
  let rect = null;
  const ro = new ResizeObserver(()=>{ rect = zone.getBoundingClientRect(); });
  ro.observe(zone);

  function setOrigin(px, py){
    if (!rect) rect = zone.getBoundingClientRect();
    cx = Math.max(rect.left, Math.min(rect.right, px)) - rect.left;
    cy = Math.max(rect.top,  Math.min(rect.bottom,py)) - rect.top;
    ring.style.left = (cx / rect.width * 100) + '%';
    ring.style.top  = (cy / rect.height * 100) + '%';
    knob.style.left = (cx / rect.width * 100) + '%';
    knob.style.top  = (cy / rect.height * 100) + '%';
  }
  function vectorFrom(px, py){
    if (!rect) rect = zone.getBoundingClientRect();
    const rx = rect.width*0.5*OUTER, ry = rect.height*0.5*OUTER;
    const dx = (px - (rect.left + cx)) / rx;
    const dy = (py - (rect.top  + cy)) / ry;
    const mag = Math.hypot(dx,dy) || 1;
    // normalize then clamp to unit circle
    const nx = Math.max(-1, Math.min(1, dx / mag)) * Math.min(1, Math.abs(dx));
    const ny = Math.max(-1, Math.min(1, dy / mag)) * Math.min(1, Math.abs(dy));
    return { nx, ny, mag: Math.min(1, mag) };
  }
  function setTargetFromEvent(e){ const v = vectorFrom(e.clientX, e.clientY); tx = v.nx * v.mag; ty = v.ny * v.mag; }
  function centerTarget(){ tx = 0; ty = 0; }

  zone.addEventListener('pointerdown', e => {
    if (!rect) rect = zone.getBoundingClientRect();
    tracking=true; pid=e.pointerId;
    setOrigin(e.clientX,e.clientY);
    setTargetFromEvent(e);
  }, {passive:false});

  zone.addEventListener('pointermove', e => {
    if(!tracking || e.pointerId!==pid) return;
    setTargetFromEvent(e);
  }, {passive:false});

  const end = e => {
    if(!tracking || (pid!==null && e.pointerId && e.pointerId!==pid)) return;
    tracking=false; pid=null; centerTarget();
  };
  zone.addEventListener('pointerup', end, {passive:false});
  zone.addEventListener('pointercancel', end, {passive:false});
  window.addEventListener('pointerup', end, {passive:false});

  // smart 4-way snap (dominant axis) to avoid accidental diagonals
  function smartSnap(nx, ny){
    const ax = Math.abs(nx), ay = Math.abs(ny);
    if (ax > ay) return { L: nx < -DZ_ENTER, R: nx > DZ_ENTER, U:false, D:false };
    return { L:false, R:false, U: ny < -DZ_ENTER, D: ny > DZ_ENTER };
  }
  function updateKeys(nx, ny){
    const s = smartSnap(nx, ny);
    [['ArrowLeft','L'],['ArrowRight','R'],['ArrowUp','U'],['ArrowDown','D']]
      .forEach(([k,c]) => { if (s[c]) keyDown(k); else keyUp(k); });
  }

  function tick(){
    // EMA smoothing
    x += (tx - x) * SMOOTHING;
    y += (ty - y) * SMOOTHING;

    // clamp to unit circle
    const m = Math.hypot(x,y); let nx=x, ny=y;
    if(m > 1e-6 && m > 1){ nx = x/m; ny = y/m; }

    // place knob relative to origin
    if (!rect) rect = zone.getBoundingClientRect();
    const rx = rect.width*0.5*OUTER, ry = rect.height*0.5*OUTER;
    const px = (cx + nx*rx) / rect.width * 100;
    const py = (cy + ny*ry) / rect.height * 100;
    knob.style.left = px + '%'; knob.style.top = py + '%';

    // update keys
    updateKeys(nx, ny);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ===== UX: overlay, fullscreen, landscape, hide controls =====
  startBtn.addEventListener('click', () => {
    focusGame();
    setTimeout(()=>{ starter.style.display='none'; focusGame(); }, 50);
  });
  goFull.addEventListener('click', async () => {
    try{ if(!document.fullscreenElement) await frame.requestFullscreen?.(); }catch(e){}
  });
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  toggleControls.addEventListener('click', () => {
    const hidden = controls.style.display === 'none';
    controls.style.display = hidden ? '' : 'none';
    toggleControls.setAttribute('aria-pressed', hidden ? 'false' : 'true');
  });

  fullscreenBtn.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen();
          else if (frame.requestFullscreen) await frame.requestFullscreen(); } catch(e){}
    focusGame();
  });

  landscapeBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) { await frame.requestFullscreen?.(); }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape'); toastMsg('Landscape locked');
      }
    } catch(e){ toastMsg('Rotate device for landscape'); }
    focusGame();
  });

  // Friendly hints on orientation change
  const mq = window.matchMedia('(orientation: portrait)');
  mq.addEventListener?.('change', e => { if (e.matches) toastMsg('Rotate for wider view'); });

  // Prevent page scroll while using controls
  ['touchstart','touchmove','touchend'].forEach(t =>
    controls.addEventListener(t, e => e.preventDefault(), { passive:false })
  );

  // Same-origin hint (so key events can reach the game)
  try { void frame.contentDocument; } catch(e){ toastMsg('Host game on same domain so keys work'); }
})();

(() => {
  // DOM
  const frame = document.getElementById('gameframe');
  const gate = document.getElementById('gate');
  const enterFS = document.getElementById('enterFS');
  const topbar = document.getElementById('topbar');
  const controls = document.getElementById('controls');
  const toast = document.getElementById('toast');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const landscapeBtn = document.getElementById('landscape');
  const openPlacement = document.getElementById('openPlacement');
  const resetBtn = document.getElementById('resetBtn');

  const coach = document.getElementById('coach');
  const placeSet = document.getElementById('placeSet');
  const placeDefaults = document.getElementById('placeDefaults');
  const forceStart = document.getElementById('forceStart');

  const editorOverlay = document.getElementById('editorOverlay');
  const editorTitle = document.getElementById('editorTitle');
  const editSize = document.getElementById('editSize');
  const editOpacity = document.getElementById('editOpacity');
  const editorDone = document.getElementById('editorDone');
  const editorCancel = document.getElementById('editorCancel');

  const padDock = document.getElementById('padDock');
  const pad = document.getElementById('pad');
  const padKnob = document.querySelector('.padKnob');
  const startDock = document.getElementById('startDock');
  const startBtn = document.getElementById('startBtn');

  // Game URL
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // Utils
  const css = (k,v)=>document.documentElement.style.setProperty(k,v);
  const getCSSf = k => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k));
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  function toastMsg(msg){ toast.textContent = msg; toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>toast.classList.remove('show'), 1400); }
  function focusGame(){ try { frame.focus(); frame.contentWindow?.focus(); } catch{} }
  function showStartBtn(show){ startBtn.classList.toggle('hidden', !show); }
  let startUsed = false;

  // Device tuning
  (function tuneDefaults(){
    const ss = Math.min(screen.width, screen.height);
    const ua = navigator.userAgent || '';
    let padScale = 1.24, startScale = 1.00;
    if (ss <= 360) { padScale = 1.32; startScale = 1.12; }
    if (/iPhone|iPad|iPod/i.test(ua)) padScale += 0.06;
    css('--pad-scale', padScale);
    css('--start-scale', startScale);
  })();

  // Gate
  const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  const isLand = () => matchMedia('(orientation: landscape)').matches || (innerWidth > innerHeight);
  async function enterFullscreen(){ try{ const el=document.documentElement; if(el.requestFullscreen) await el.requestFullscreen(); else if(el.webkitRequestFullscreen) await el.webkitRequestFullscreen(); }catch{} }
  async function lockLandscape(){ try{ if(!isFS()) await enterFullscreen(); await screen.orientation?.lock?.('landscape'); toastMsg('Landscape locked'); }catch{} }
  function updateGate(){
    const ok = isFS() && isLand();
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
    await enterFullscreen(); await lockLandscape(); updateGate();
    startPlacement();
    focusGame();
  });
  fullscreenBtn.addEventListener('click', async () => {
    if (isFS()) { try { await document.exitFullscreen?.(); } catch{} }
    else { await enterFullscreen(); }
    updateGate();
  });
  landscapeBtn.addEventListener('click', lockLandscape);

  // If already FS+landscape at load, auto open placement
  if (isFS() && isLand()) startPlacement();

  // Placement flow (START shown during placement so you can move it)
  let placing = false;
  const setFlags = { pad:false, start:false };
  function markTouched(type){ setFlags[type] = true; placeSet.disabled = !(setFlags.pad && setFlags.start); }

  function startPlacement(){
    if (placing) return;
    placing = true;
    document.body.classList.add('placing');
    coach.classList.remove('hidden');
    showStartBtn(true);           // START visible in center during placement
    setFlags.pad = false; setFlags.start = false;
    placeSet.disabled = true;
  }
  function endPlacement(){
    placing = false;
    document.body.classList.remove('placing');
    coach.classList.add('hidden');
    closeEditor();
    showStartBtn(true);           // reveal START to press after SET
    focusGame();
  }

  // Defaults & Start anyway
  placeDefaults.addEventListener('click', () => {
    css('--pad-x','0vw'); css('--pad-y','0vh'); css('--pad-scale',1.24); css('--pad-opacity',0.92);
    css('--start-x','0vw'); css('--start-y','0vh'); css('--start-scale',1.00); css('--start-opacity',0.92);
    markTouched('pad'); markTouched('start');
  });
  forceStart.addEventListener('click', () => { endPlacement(); toastMsg('Controls set — press START'); });
  placeSet.addEventListener('click', () => {
    if (placeSet.disabled){ toastMsg('Drag each control or edit them first'); return; }
    endPlacement();
    toastMsg('Controls set — press START');
  });

  // Drag controls (bind to docks and the actual elements)
  let suppressClickUntil = 0; // prevents accidental editor-open after a drag
  function beginDrag(e){
    if (!placing) return;
    const typeAttr = e.currentTarget.getAttribute('data-drag');
    const type = typeAttr || (e.currentTarget===startBtn ? 'start' : (e.currentTarget===pad ? 'pad' : null));
    if (!type) return;

    const id = e.pointerId;
    const baseX = getCSSf(type==='pad'?'--pad-x':'--start-x');
    const baseY = getCSSf(type==='pad'?'--pad-y':'--start-y');
    const sX = e.clientX, sY = e.clientY;
    let moved = false;

    e.currentTarget.setPointerCapture?.(id);

    function move(ev){
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - sX, dy = ev.clientY - sY;
      if (!moved && (dx*dx + dy*dy) > 9) moved = true; // >3px
      const dx_vw = dx / innerWidth * 100;
      const dy_vh = dy / innerHeight * 100;
      if (type==='pad'){ css('--pad-x', clamp(baseX + dx_vw, -22, 22) + 'vw'); css('--pad-y', clamp(baseY + dy_vh, -14, 14) + 'vh'); markTouched('pad'); }
      else { css('--start-x', clamp(baseX + dx_vw, -30, 30) + 'vw'); css('--start-y', clamp(baseY + dy_vh, -18, 18) + 'vh'); markTouched('start'); }
      ev.preventDefault();
    }
    function up(ev){
      if (ev.pointerId !== id) return;
      if (moved) suppressClickUntil = Date.now() + 250; // block the "click" that follows a drag
      e.currentTarget.removeEventListener('pointermove', move);
      e.currentTarget.removeEventListener('pointerup', up);
      e.currentTarget.removeEventListener('pointercancel', up);
      ev.preventDefault();
    }
    e.currentTarget.addEventListener('pointermove', move, {passive:false});
    e.currentTarget.addEventListener('pointerup', up, {passive:false});
    e.currentTarget.addEventListener('pointercancel', up, {passive:false});
    e.preventDefault();
  }
  padDock.addEventListener('pointerdown', beginDrag, {passive:false});
  pad.addEventListener('pointerdown', beginDrag, {passive:false});
  startDock.addEventListener('pointerdown', beginDrag, {passive:false});
  startBtn.addEventListener('pointerdown', beginDrag, {passive:false});

  // Editor (tap a control while placing)
  let editing = null; let prev = null;
  function openEditor(type){
    if (!placing) return;
    if (Date.now() < suppressClickUntil) return; // ignore click right after a drag
    editing = type;
    editorTitle.textContent = type === 'pad' ? 'Edit Touchpad' : 'Edit START';
    prev = { scale: getCSSf(type==='pad'?'--pad-scale':'--start-scale'), opacity: getCSSf(type==='pad'?'--pad-opacity':'--start-opacity') };
    editSize.value = prev.scale || (type==='pad'?1.24:1.00);
    editOpacity.value = prev.opacity || 0.92;
    editorOverlay.classList.remove('hidden');
  }
  function closeEditor(){ editorOverlay.classList.add('hidden'); editing = null; }
  pad.addEventListener('click', () => openEditor('pad'));
  startBtn.addEventListener('click', (e) => { if (placing){ openEditor('start'); e.stopPropagation(); } });

  editSize.addEventListener('input', e => { const v = clamp(parseFloat(e.target.value)||1, 0.9, 1.7); if (editing==='pad') css('--pad-scale', v); else if (editing==='start') css('--start-scale', v); });
  editOpacity.addEventListener('input', e => { const v = clamp(parseFloat(e.target.value)||0.92, 0.25, 1.0); if (editing==='pad') css('--pad-opacity', v); else if (editing==='start') css('--start-opacity', v); });
  editorDone.addEventListener('click', () => { if (editing) markTouched(editing); closeEditor(); });
  editorCancel.addEventListener('click', () => {
    if (editing==='pad'){ css('--pad-scale', prev?.scale??1.24); css('--pad-opacity', prev?.opacity??0.92); }
    else if (editing==='start'){ css('--start-scale', prev?.scale??1.00); css('--start-opacity', prev?.opacity??0.92); }
    closeEditor();
  });

  // START (Space)
  bindPress(startBtn, 'Space', () => {
    if (!placing && !startUsed) { startUsed = true; showStartBtn(false); toastMsg('Start hidden (RESET to restore)'); }
  });

  // Bind helper
  function bindPress(el, name, onUp){
    let active=false;
    const downH = e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active=true; keyDown(name); };
    const upH   = e=>{ if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active=false; keyUp(name); onUp && onUp(); };
    el.addEventListener('pointerdown', downH);
    window.addEventListener('pointerup', upH);
    window.addEventListener('pointercancel', upH);
    el.addEventListener('pointerout', e=>{ if(active) upH(e); });
  }

  // Keyboard injection
  const keyMap = {
    ArrowUp:{key:'ArrowUp',code:'ArrowUp',keyCode:38,which:38},
    ArrowDown:{key:'ArrowDown',code:'ArrowDown',keyCode:40,which:40},
    ArrowLeft:{key:'ArrowLeft',code:'ArrowLeft',keyCode:37,which:37},
    ArrowRight:{key:'ArrowRight',code:'ArrowRight',keyCode:39,which:39},
    Space:{key:' ',code:'Space',keyCode:32,which:32}
  };
  const down = new Set();
  function dispatch(to,type,d){ const ev=new KeyboardEvent(type,{key:d.key,code:d.code,keyCode:d.keyCode,which:d.which,bubbles:true,cancelable:true}); Object.defineProperty(ev,'keyCode',{get:()=>d.keyCode}); Object.defineProperty(ev,'which',{get:()=>d.which}); to.dispatchEvent(ev); }
  function keyDown(name){ if(placing) return; const d=keyMap[name]; if(!d||down.has(name))return; down.add(name); try{ const doc=frame.contentDocument||frame.contentWindow.document; dispatch(doc,'keydown',d); dispatch(frame.contentWindow,'keydown',d); if(navigator.vibrate) navigator.vibrate(6);}catch{} }
  function keyUp(name){ if(placing) return; const d=keyMap[name]; if(!d||!down.has(name))return; down.delete(name); try{ const doc=frame.contentDocument||frame.contentWindow.document; dispatch(doc,'keyup',d); dispatch(frame.contentWindow,'keyup',d);}catch{} }

  // Joystick
  let tracking=false, pid=null; let tx=0, ty=0, x=0, y=0;
  const OUTER=0.92; const baseTH=Math.min(screen.width,screen.height)<=360?0.26:0.28;
  function padRect(){ return pad.getBoundingClientRect(); }
  function setTargetFromEvent(e){ const r=padRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2; let dx=(e.clientX-cx)/(r.width*0.5*OUTER), dy=(e.clientY-cy)/(r.height*0.5*OUTER); const m=Math.hypot(dx,dy)||1; dx=(dx/m)*Math.min(1,Math.abs(dx)); dy=(dy/m)*Math.min(1,Math.abs(dy)); tx=Math.max(-1,Math.min(1,dx)); ty=Math.max(-1,Math.min(1,dy)); }
  function centerTarget(){ tx=0; ty=0; moveKnob(0,0,true); }
  function moveKnob(nx,ny,instant=false){ const r=padRect(); const px=(r.width/2)+nx*(r.width*0.5*OUTER); const py=(r.height/2)+ny*(r.height*0.5*OUTER); padKnob.style.left=px+'px'; padKnob.style.top=py+'px'; if(instant){ x=nx; y=ny; } }
  pad.addEventListener('pointerdown', e=>{ if(placing) return; tracking=true; pid=e.pointerId; setTargetFromEvent(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e=>{ if(placing||!tracking||e.pointerId!==pid) return; setTargetFromEvent(e); e.preventDefault(); });
  const end=e=>{ if(placing||!tracking||(pid!==null&&e.pointerId&&e.pointerId!==pid)) return; tracking=false; pid=null; centerTarget(); e.preventDefault(); };
  pad.addEventListener('pointerup', end, {passive:false}); pad.addEventListener('pointercancel', end, {passive:false}); window.addEventListener('pointerup', end, {passive:false});
  function tick(){ const SMOOTH=0.22; x+=(tx-x)*SMOOTH; y+=(ty-y)*SMOOTH; const m=Math.hypot(x,y); const nx=m>1?x/m:x, ny=m>1?y/m:y; moveKnob(nx,ny); const TH=baseTH; const L=nx<-TH, R=nx>TH, U=ny<-TH, D=ny>TH; L?keyDown('ArrowLeft'):keyUp('ArrowLeft'); R?keyDown('ArrowRight'):keyUp('ArrowRight'); U?keyDown('ArrowUp'):keyUp('ArrowUp'); D?keyDown('ArrowDown'):keyUp('ArrowDown'); requestAnimationFrame(tick); }
  requestAnimationFrame(tick);

  // Reset
  resetBtn.addEventListener('click', () => {
    showStartBtn(true); startUsed = false;
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].forEach(k => keyUp(k));
    centerTarget();
    try { const src = frame.src; frame.src = 'about:blank'; setTimeout(() => { frame.src = src; }, 30); } catch{}
    toastMsg('Game reset');
  });

  // Re-open placement any time
  openPlacement.addEventListener('click', () => startPlacement());
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  // Same-origin hint for key events
  try { void frame.contentDocument; } catch { toastMsg('Host game & wrapper on same origin for controls'); }
})();

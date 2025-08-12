(() => {
  const frame = document.getElementById('gameframe');
  const startBtn = document.getElementById('startBtn');
  const starter = document.getElementById('starter');
  const toggleControls = document.getElementById('toggleControls');
  const controls = document.getElementById('controls');
  const controlInner = document.getElementById('controlInner');
  const openSettings = document.getElementById('openSettings');
  const settingsDlg = document.getElementById('settings');
  const lefty = document.getElementById('lefty');
  const uiSize = document.getElementById('uisize');
  const uiOpacity = document.getElementById('uiopacity');
  const resetPrefs = document.getElementById('resetPrefs');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  // Resolve game src
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // Prefs
  const P = {
    lefty: localStorage.getItem('wrap_lefty') === '1',
    size: parseFloat(localStorage.getItem('wrap_size') || '1.25'),
    opacity: parseFloat(localStorage.getItem('wrap_opacity') || '0.95')
  };
  function applyPrefs(){
    document.body.classList.toggle('lefty', P.lefty);
    document.documentElement.style.setProperty('--ui-scale', String(P.size));
    document.documentElement.style.setProperty('--ui-opacity', String(P.opacity));
    lefty.checked = P.lefty;
    uiSize.value = String(P.size);
    uiOpacity.value = String(P.opacity);
  }
  applyPrefs();

  // Focus helpers
  function focusGame(){
    try { frame.focus(); frame.contentWindow && frame.contentWindow.focus(); } catch(e){}
  }

  // Key mapping + state
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
    const data = keyMap[name]; if (!data || down.has(name)) return;
    down.add(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keydown',data); dispatch(frame.contentWindow,'keydown',data);
      if (navigator.vibrate) navigator.vibrate(8);
    } catch(e){}
  }
  function keyUp(name){
    const data = keyMap[name]; if (!data || !down.has(name)) return;
    down.delete(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc,'keyup',data); dispatch(frame.contentWindow,'keyup',data);
    } catch(e){}
  }

  // Bind SPACE/ENTER buttons
  document.querySelectorAll('[data-key]').forEach(el => {
    const name = el.getAttribute('data-key'); let active = false;
    const activate = e => { e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active = true; keyDown(name); };
    const deactivate = e => { if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active = false; keyUp(name); };
    el.addEventListener('pointerdown', activate);
    window.addEventListener('pointerup', deactivate);
    window.addEventListener('pointercancel', deactivate);
    el.addEventListener('pointerout', e => { if(active) deactivate(e); });
  });

  // Thumb stick logic
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  let tracking = false, pid = null;

  function centerKnob(smooth=true){
    knob.style.transition = smooth ? 'left .08s ease, top .08s ease' : 'none';
    knob.style.left = '50%'; knob.style.top = '50%';
  }
  centerKnob(false);

  function setKeysFromVector(nx, ny, dz=0.28){ // deadzone ~28% radius feels good
    const left  = nx < -dz, right = nx > dz, up = ny < -dz, down = ny > dz;
    // update keys
    [['ArrowLeft', left], ['ArrowRight', right], ['ArrowUp', up], ['ArrowDown', down]].forEach(([k, on])=>{
      if (on) keyDown(k); else keyUp(k);
    });
  }

  function handleMove(clientX, clientY){
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const dx = clientX - cx; const dy = clientY - cy;
    const max = r.width/2 * 0.9;          // clamp inside ring
    const mag = Math.hypot(dx, dy) || 1;
    const clamp = Math.min(mag, max);
    const ux = dx / mag, uy = dy / mag;
    const px = cx + ux * clamp, py = cy + uy * clamp;

    knob.style.transition = 'none';
    knob.style.left = ((px - r.left) / r.width * 100) + '%';
    knob.style.top  = ((py - r.top ) / r.height * 100) + '%';

    const nx = (dx / (r.width/2));   // normalized -1..1
    const ny = (dy / (r.height/2));
    setKeysFromVector(nx, ny);
  }

  stick.addEventListener('pointerdown', e => {
    tracking = true; pid = e.pointerId; stick.setPointerCapture(pid);
    handleMove(e.clientX, e.clientY);
  });
  stick.addEventListener('pointermove', e => {
    if (!tracking || e.pointerId !== pid) return;
    handleMove(e.clientX, e.clientY);
  });
  const end = e => {
    if (!tracking || (pid!==null && e.pointerId && e.pointerId !== pid)) return;
    tracking = false; pid = null;
    centerKnob(true);
    // release all arrow keys
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].forEach(keyUp);
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  window.addEventListener('pointerup', end); // safety

  // Starter overlay
  startBtn.addEventListener('click', () => {
    focusGame();
    setTimeout(() => { starter.style.display = 'none'; focusGame(); }, 50);
  });
  frame.addEventListener('load', () => setTimeout(focusGame, 60));

  // Hide/Show controls
  toggleControls.addEventListener('click', () => {
    const hidden = controls.style.display === 'none';
    controls.style.display = hidden ? '' : 'none';
    toggleControls.setAttribute('aria-pressed', hidden ? 'false' : 'true');
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (frame.requestFullscreen) await frame.requestFullscreen();
    } catch(e){}
    focusGame();
  });

  // Settings
  openSettings.addEventListener('click', () => settingsDlg.showModal());
  settingsDlg.addEventListener('close', () => focusGame());
  lefty.addEventListener('change', e => {
    const v = !!e.target.checked;
    localStorage.setItem('wrap_lefty', v ? '1' : '0');
    P.lefty = v;
    document.body.classList.toggle('lefty', v);
  });
  uiSize.addEventListener('input', e => {
    const v = parseFloat(e.target.value || '1.25');
    localStorage.setItem('wrap_size', String(v));
    document.documentElement.style.setProperty('--ui-scale', String(v));
  });
  uiOpacity.addEventListener('input', e => {
    const v = parseFloat(e.target.value || '0.95');
    localStorage.setItem('wrap_opacity', String(v));
    document.documentElement.style.setProperty('--ui-opacity', String(v));
  });
  resetPrefs.addEventListener('click', () => {
    localStorage.removeItem('wrap_lefty');
    localStorage.removeItem('wrap_size');
    localStorage.removeItem('wrap_opacity');
    document.body.classList.remove('lefty');
    document.documentElement.style.setProperty('--ui-scale', '1.25');
    document.documentElement.style.setProperty('--ui-opacity', '0.95');
    lefty.checked = false; uiSize.value = '1.25'; uiOpacity.value = '0.95';
  });

  // Prevent scroll while touching controls
  ['touchstart','touchmove','touchend'].forEach(t =>
    controls.addEventListener(t, e => e.preventDefault(), { passive:false })
  );
})();

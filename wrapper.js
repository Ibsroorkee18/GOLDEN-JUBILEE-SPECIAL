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

  const modeSel = document.getElementById('mode');   // touchpad vs fixed
  const snapSel = document.getElementById('snap');   // off/four/eight
  const vibrateChk = document.getElementById('vibrate');

  // Resolve game src
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // Prefs
  const P = {
    lefty: localStorage.getItem('wrap_lefty') === '1',
    size: parseFloat(localStorage.getItem('wrap_size') || '1.3'),
    opacity: parseFloat(localStorage.getItem('wrap_opacity') || '0.96'),
    mode: localStorage.getItem('wrap_mode') || 'touchpad',
    snap: localStorage.getItem('wrap_snap') || 'off',
    vibrate: localStorage.getItem('wrap_vibrate') !== '0' // default on
  };
  function applyPrefs(){
    document.body.classList.toggle('lefty', P.lefty);
    document.documentElement.style.setProperty('--ui-scale', String(P.size));
    document.documentElement.style.setProperty('--ui-opacity', String(P.opacity));
    lefty.checked = P.lefty;
    uiSize.value = String(P.size);
    uiOpacity.value = String(P.opacity);
    modeSel.value = P.mode;
    snapSel.value = P.snap;
    vibrateChk.checked = !!P.vibrate;
  }
  applyPrefs();

  // Focus helper
  function focusGame(){ try { frame.focus(); frame.contentWindow?.focus(); } catch(e){} }

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
      if (P.vibrate && navigator.vibrate) navigator.vibrate(8);
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

  // Bind SPACE/ENTER
  document.querySelectorAll('[data-key]').forEach(el => {
    const name = el.getAttribute('data-key'); let active = false;
    const activate = e => { e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active = true; keyDown(name); };
    const deactivate = e => { if(!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active = false; keyUp(name); };
    el.addEventListener('pointerdown', activate);
    window.addEventListener('pointerup', deactivate);
    window.addEventListener('pointercancel', deactivate);
    el.addEventListener('pointerout', e => { if(active) deactivate(e); });
  });

  // Touchpad / Fixed stick logic
  const zone = document.getElementById('touchzone');
  const ring = document.getElementById('ring');
  const knob = document.getElementById('knob');

  const SMOOTHING = 0.24;    // EMA smoothing (higher = smoother)
  const OUTER     = 0.90;    // knob travel within ring radius
  const DZ_ENTER  = 0.28;    // deadzone enter
  const DZ_EXIT   = 0.20;    // deadzone exit (hysteresis)

  let tracking = false, pid = null;
  let cx = 0, cy = 0;        // current origin (px in zone)
  let tx = 0, ty = 0;        // target normalized vec -1..1
  let x = 0,  y = 0;         // filtered vec
  const dir = { L:false, R:false, U:false, D:false };

  function setOrigin(px, py){
    const r = zone.getBoundingClientRect();
    cx = Math.max(r.left, Math.min(r.right, px)) - r.left;
    cy = Math.max(r.top,  Math.min(r.bottom,py)) - r.top;
    ring.style.left = (cx / r.width * 100) + '%';
    ring.style.top  = (cy / r.height * 100) + '%';
    knob.style.left = (cx / r.width * 100) + '%';
    knob.style.top  = (cy / r.height * 100) + '%';
  }

  function vectorFrom(px, py){
    const r = zone.getBoundingClientRect();
    const rx = r.width  * 0.5 * OUTER;
    const ry = r.height * 0.5 * OUTER;
    // normalize to -1..1 from current origin
    const dx = (px - (r.left + cx)) / rx;
    const dy = (py - (r.top  + cy)) / ry;
    const mag = Math.hypot(dx, dy) || 1;
    const nx = Math.max(-1, Math.min(1, dx / mag)) * Math.min(1, Math.abs(dx));
    const ny = Math.max(-1, Math.min(1, dy / mag)) * Math.min(1, Math.abs(dy));
    return { nx, ny, mag: Math.min(1, mag) };
  }

  function setTargetFromEvent(e){
    const v = vectorFrom(e.clientX, e.clientY);
    tx = v.nx * Math.min(1, v.mag);
    ty = v.ny * Math.min(1, v.mag);
  }

  function centerTarget(){
    tx = 0; ty = 0;
  }

  zone.addEventListener('pointerdown', e => {
    tracking = true; pid = e.pointerId;
    if (P.mode === 'touchpad') setOrigin(e.clientX, e.clientY);
    else { // fixed: center
      const r = zone.getBoundingClientRect();
      setOrigin(r.left + r.width/2, r.top + r.height/2);
    }
    setTargetFromEvent(e);
  }, { passive:false });

  zone.addEventListener('pointermove', e => {
    if (!tracking || e.pointerId !== pid) return;
    setTargetFromEvent(e);
  }, { passive:false });

  const end = e => {
    if (!tracking || (pid!==null && e.pointerId && e.pointerId !== pid)) return;
    tracking = false; pid = null; centerTarget();
  };
  zone.addEventListener('pointerup', end, { passive:false });
  zone.addEventListener('pointercancel', end, { passive:false });
  window.addEventListener('pointerup', end, { passive:false });

  // Hysteresis per axis
  function applyHysteresis(axisValue, posKey, negKey){
    const posPressed = dir[posKey], negPressed = dir[negKey];
    if (!posPressed && axisValue >  DZ_ENTER) { dir[posKey] = true;  keyDown(posKey); }
    if ( posPressed && axisValue <= DZ_EXIT)  { dir[posKey] = false; keyUp(posKey);   }
    if (!negPressed && axisValue < -DZ_ENTER) { dir[negKey] = true;  keyDown(negKey); }
    if ( negPressed && axisValue >= -DZ_EXIT) { dir[negKey] = false; keyUp(negKey);   }
  }

  function snap4(nx, ny){
    // choose dominant axis only
    if (Math.abs(nx) > Math.abs(ny)) {
      return { L: nx < -DZ_ENTER, R: nx > DZ_ENTER, U: false, D:false };
    } else {
      return { L: false, R: false, U: ny < -DZ_ENTER, D: ny > DZ_ENTER };
    }
  }
  function snap8(nx, ny){
    return {
      L: nx < -DZ_ENTER, R: nx > DZ_ENTER,
      U: ny < -DZ_ENTER, D: ny > DZ_ENTER
    };
  }

  function updateKeys(nx, ny){
    if (snapSel.value === 'four'){
      const s = snap4(nx, ny);
      [['ArrowLeft','L'],['ArrowRight','R'],['ArrowUp','U'],['ArrowDown','D']].forEach(([k,c]) => {
        if (s[c]) keyDown(k); else keyUp(k);
      });
      return;
    }
    if (snapSel.value === 'eight'){
      const s = snap8(nx, ny);
      [['ArrowLeft','L'],['ArrowRight','R'],['ArrowUp','U'],['ArrowDown','D']].forEach(([k,c]) => {
        if (s[c]) keyDown(k); else keyUp(k);
      });
      return;
    }
    // Off: free with hysteresis
    applyHysteresis(nx, 'ArrowRight', 'ArrowLeft');
    applyHysteresis(ny, 'ArrowDown',  'ArrowUp');
  }

  // Animation loop
  function tick(){
    // Smooth toward target
    x += (tx - x) * SMOOTHING;
    y += (ty - y) * SMOOTHING;

    // clamp
    const m = Math.hypot(x,y);
    let nx = x, ny = y;
    if (m > 1e-6 && m > 1){ nx = x/m; ny = y/m; }

    // place knob relative to origin
    const r = zone.getBoundingClientRect();
    const rx = r.width  * 0.5 * OUTER;
    const ry = r.height * 0.5 * OUTER;
    const px = (cx + nx * rx) / r.width  * 100;
    const py = (cy + ny * ry) / r.height * 100;
    knob.style.left = px + '%';
    knob.style.top  = py + '%';

    // update keys
    updateKeys(nx, ny);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Starter / Fullscreen / Settings
  startBtn.addEventListener('click', () => {
    focusGame();
    setTimeout(() => { starter.style.display = 'none'; focusGame(); }, 50);
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

  openSettings.addEventListener('click', () => settingsDlg.showModal());
  settingsDlg.addEventListener('close', () => focusGame());

  // Save settings
  lefty.addEventListener('change', e => {
    P.lefty = !!e.target.checked; localStorage.setItem('wrap_lefty', P.lefty ? '1' : '0');
    document.body.classList.toggle('lefty', P.lefty);
  });
  uiSize.addEventListener('input', e => {
    P.size = parseFloat(e.target.value || '1.3'); localStorage.setItem('wrap_size', String(P.size));
    document.documentElement.style.setProperty('--ui-scale', String(P.size));
  });
  uiOpacity.addEventListener('input', e => {
    P.opacity = parseFloat(e.target.value || '0.96'); localStorage.setItem('wrap_opacity', String(P.opacity));
    document.documentElement.style.setProperty('--ui-opacity', String(P.opacity));
  });
  modeSel.addEventListener('change', e => {
    P.mode = e.target.value; localStorage.setItem('wrap_mode', P.mode);
  });
  snapSel.addEventListener('change', e => {
    P.snap = e.target.value; localStorage.setItem('wrap_snap', P.snap);
  });
  vibrateChk.addEventListener('change', e => {
    P.vibrate = !!e.target.checked; localStorage.setItem('wrap_vibrate', P.vibrate ? '1':'0');
  });
  resetPrefs.addEventListener('click', () => {
    localStorage.removeItem('wrap_lefty');
    localStorage.removeItem('wrap_size');
    localStorage.removeItem('wrap_opacity');
    localStorage.removeItem('wrap_mode');
    localStorage.removeItem('wrap_snap');
    localStorage.removeItem('wrap_vibrate');
    P.lefty=false; P.size=1.3; P.opacity=0.96; P.mode='touchpad'; P.snap='off'; P.vibrate=true;
    applyPrefs();
  });

  // Prevent scroll while using controls
  ['touchstart','touchmove','touchend'].forEach(t =>
    controls.addEventListener(t, e => e.preventDefault(), { passive:false })
  );
})();
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

  // Load game source: ?src=YourGame.html or default to game.html
  const params = new URLSearchParams(location.search);
  frame.src = params.get('src') || 'game.html';

  // Apply saved prefs
  const P = {
    lefty: localStorage.getItem('wrap_lefty') === '1',
    size: parseFloat(localStorage.getItem('wrap_size') || '1.25'),
    opacity: parseFloat(localStorage.getItem('wrap_opacity') || '0.9')
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
    try {
      frame.focus();
      frame.contentWindow && frame.contentWindow.focus();
    } catch (e) {}
  }

  // Keyboard mapping
  const keyMap = {
    ArrowUp:    { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38 },
    ArrowDown:  { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40 },
    ArrowLeft:  { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39 },
    Space:      { key: ' ', code: 'Space', keyCode: 32, which: 32 },
    Enter:      { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }
  };
  const down = new Set();

  function dispatch(to, type, data){
    const ev = new KeyboardEvent(type, {
      key: data.key, code: data.code, keyCode: data.keyCode, which: data.which,
      bubbles: true, cancelable: true
    });
    Object.defineProperty(ev, 'keyCode', { get: () => data.keyCode });
    Object.defineProperty(ev, 'which',   { get: () => data.which });
    to.dispatchEvent(ev);
  }

  function keyDown(name){
    const data = keyMap[name];
    if (!data || down.has(name)) return;
    down.add(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc, 'keydown', data);
      dispatch(frame.contentWindow, 'keydown', data);
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (e) {}
  }

  function keyUp(name){
    const data = keyMap[name];
    if (!data || !down.has(name)) return;
    down.delete(name);
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      dispatch(doc, 'keyup', data);
      dispatch(frame.contentWindow, 'keyup', data);
    } catch (e) {}
  }

  function bindButton(el){
    const name = el.getAttribute('data-key');
    let active = false;
    const activate = (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('active'); active = true; keyDown(name); };
    const deactivate = (e) => { if (!active) return; e && (e.preventDefault(), e.stopPropagation()); el.classList.remove('active'); active = false; keyUp(name); };
    el.addEventListener('pointerdown', activate);
    window.addEventListener('pointerup', deactivate);
    window.addEventListener('pointercancel', deactivate);
    el.addEventListener('pointerout', (e) => { if (active) deactivate(e); });
  }
  document.querySelectorAll('[data-key]').forEach(bindButton);

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
    } catch (e) {}
    focusGame();
  });

  // Settings
  openSettings.addEventListener('click', () => settingsDlg.showModal());
  settingsDlg.addEventListener('close', () => focusGame());
  lefty.addEventListener('change', e => {
    P.lefty = !!e.target.checked;
    localStorage.setItem('wrap_lefty', P.lefty ? '1' : '0');
    applyPrefs();
  });
  uiSize.addEventListener('input', e => {
    P.size = parseFloat(e.target.value || '1.25');
    localStorage.setItem('wrap_size', String(P.size));
    applyPrefs();
  });
  uiOpacity.addEventListener('input', e => {
    P.opacity = parseFloat(e.target.value || '0.9');
    localStorage.setItem('wrap_opacity', String(P.opacity));
    applyPrefs();
  });
  resetPrefs.addEventListener('click', () => {
    localStorage.removeItem('wrap_lefty');
    localStorage.removeItem('wrap_size');
    localStorage.removeItem('wrap_opacity');
    P.lefty = false; P.size = 1.25; P.opacity = 0.9;
    applyPrefs();
  });

  // Prevent scroll while touching the controls
  ['touchstart','touchmove','touchend'].forEach(t =>
    controls.addEventListener(t, e => e.preventDefault(), { passive:false })
  );
})();

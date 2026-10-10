(() => {
  if (window.__slideControl) return;

  // Each feature (gesture, voice) is an extension-owned iframe that posts { type:'swipe', dir }.
  const FEATURES = {
    gesture: {
      page: 'tracker.html', allow: 'camera',
      css: 'right:12px;bottom:12px;width:200px;height:56px;border:2px solid #1a73e8;border-radius:8px;opacity:.85;',
    },
    voice: {
      page: 'voice.html', allow: 'microphone',
      css: 'left:12px;bottom:12px;width:260px;height:34px;border:2px solid #188038;border-radius:17px;opacity:.9;',
    },
  };
  const frames = {};

  const KEYS = {
    next: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    prev: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  };

  function fireKey(doc, spec) {
    const target = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body;
    for (const type of ['keydown', 'keyup']) {
      const ev = new KeyboardEvent(type, { ...spec, which: spec.keyCode, bubbles: true, cancelable: true });
      target.dispatchEvent(ev);
    }
  }

  // Marp bespoke: slides are .bespoke-marp-slide, active has .bespoke-marp-active,
  // and the URL hash (#N, 1-based) navigates.
  const marpIndex = () => {
    const slides = [...document.querySelectorAll('.bespoke-marp-slide')];
    return { slides, cur: slides.findIndex((s) => s.classList.contains('bespoke-marp-active')) };
  };

  function send(dir) {
    const spec = KEYS[dir];
    const before = marpIndex();
    const own = Object.values(frames);
    const docs = [document];
    for (const f of document.querySelectorAll('iframe')) {
      if (own.includes(f)) continue;
      try { if (f.contentDocument) docs.push(f.contentDocument); } catch {}
    }
    docs.forEach((d) => fireKey(d, spec));

    // Fallback for Marp if the key events were ignored.
    if (before.slides.length) {
      setTimeout(() => {
        const { slides, cur } = marpIndex();
        if (cur !== before.cur) return;
        const next = Math.min(slides.length - 1, Math.max(0, cur + (dir === 'next' ? 1 : -1)));
        if (next !== cur) location.hash = '#' + (next + 1);
      }, 200);
    }
  }

  // Jump to slide N (1-based), 'first' or 'last'. Numbered jumps need Marp's #N hash.
  function goTo(slide) {
    const { slides } = marpIndex();
    if (slides.length) {
      const n = slide === 'first' ? 1 : slide === 'last' ? slides.length : Math.min(slides.length, Math.max(1, Number(slide)));
      location.hash = '#' + n;
      return;
    }
    if (slide === 'first' || slide === 'last') {
      const spec = slide === 'first' ? { key: 'Home', code: 'Home', keyCode: 36 } : { key: 'End', code: 'End', keyCode: 35 };
      fireKey(document, spec);
    }
  }

  function onMessage(e) {
    if (!Object.values(frames).some((f) => f.contentWindow === e.source)) return;
    if (e.data?.type === 'visible') {
      const f = Object.values(frames).find((fr) => fr.contentWindow === e.source);
      if (f) f.style.opacity = e.data.value ? f.dataset.opacity : '0';
      return;
    }
    if (e.data?.type === 'goto') { goTo(e.data.slide); return; }
    if (e.data?.type === 'swipe' && (e.data.dir === 'next' || e.data.dir === 'prev')) send(e.data.dir);
  }

  // Only the fullscreen element (and its children) is visible in fullscreen. Marp fullscreens <body>,
  // so panels live in <body>; if a deck fullscreens another element, follow it (this reloads the panel).
  const host = () => document.fullscreenElement || document.body || document.documentElement;
  function followFullscreen() {
    const h = host();
    for (const f of Object.values(frames)) if (f.parentNode !== h && !h.contains(f)) h.appendChild(f);
  }
  document.addEventListener('fullscreenchange', followFullscreen);
  document.addEventListener('webkitfullscreenchange', followFullscreen);

  function set(feature, on) {
    const cfg = FEATURES[feature];
    if (!cfg) return;
    if (on && !frames[feature]) {
      const f = document.createElement('iframe');
      f.src = chrome.runtime.getURL(cfg.page);
      f.allow = cfg.allow;
      f.style.cssText = 'position:fixed;z-index:2147483647;background:#000;pointer-events:none;transition:opacity .25s;' + cfg.css;
      f.dataset.opacity = f.style.opacity || '1';
      host().appendChild(f);
      frames[feature] = f;
    } else if (!on && frames[feature]) {
      frames[feature].remove();
      delete frames[feature];
    }
    // Only listen while at least one feature is on.
    window.removeEventListener('message', onMessage);
    if (Object.keys(frames).length) window.addEventListener('message', onMessage);
  }

  set.active = () => ({ gesture: !!frames.gesture, voice: !!frames.voice });
  window.__slideControl = set;
})();

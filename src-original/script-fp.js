const mainVideo   = document.getElementById('main-video');
const seqCanvas   = document.getElementById('seq-canvas');
const poiLayer    = document.getElementById('poi-layer');
const trackEl     = document.getElementById('track');
const loaderEl    = document.getElementById('loader');
const debugHud    = document.getElementById('debug-hud');
const debugCoords = document.getElementById('debug-coords');

// alpha:false — cheaper GPU compositing; no transparency needed on the canvas
const ctx = seqCanvas.getContext('2d', { alpha: false });

// Touch/mobile detection — covers iOS, Android and stylus-only devices
const MOBILE = window.matchMedia('(hover: none)').matches || window.innerWidth < 768;

// LRU cap: max number of decoded sequences held in memory at once
const MAX_SEQ = 3;
let _w = innerWidth, _h = innerHeight, lastFrame = null;

let currentScene = 'aerial';
let busy         = false;
let navGen       = 0;
let poiTimer     = null;
let mode         = "day"; // reserved for day/night toggle
const cache      = new Map();
const videoBlobs = new Map();

// ─── Analytics ───────────────────────────────────────────────────────────────

function sessionId() {
  let s = sessionStorage.getItem('sid');
  if (!s) { s = crypto.randomUUID(); sessionStorage.setItem('sid', s); }
  return s;
}

function track(event, props = {}) {
  const payload = {
    event, ...props,
    slug:    CONFIG?.slug,
    ts:      Date.now(),
    session: sessionId(),
    device:  MOBILE ? 'mobile' : 'desktop',
  };
  if (window.gtag) gtag('event', event, props);
  navigator.sendBeacon?.('/api/track', JSON.stringify(payload));
}

let dwellStart = Date.now();
let dwellScene = 'aerial';

function markDwell(newScene) {
  track('dwell', { scene: dwellScene, ms: Date.now() - dwellStart });
  dwellScene = newScene;
  dwellStart = Date.now();
}

window.addEventListener('pagehide', () => markDwell(dwellScene));

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  resizeCanvas();
  initCursor();
  buildTrack();
  showPoster('images/seq_arch/aereo_to_piscina_00.jpg', () => startScene(sceneFromHash()));
  preloadNeighbors('aerial');
  // Defer full video preload to idle time so the first frame renders fast
  (window.requestIdleCallback || setTimeout)(() => preloadAllVideos(), 2500);
});

// Smart resize: ignores address-bar height jitter on mobile (< 120px height delta)
window.addEventListener('resize', () => {
  if (innerWidth === _w && Math.abs(innerHeight - _h) < 120) return;
  _w = innerWidth; _h = innerHeight;
  resizeCanvas();
  if (lastFrame) drawCover(lastFrame);
});

function resizeCanvas() {
  const dpr = MOBILE ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  seqCanvas.width        = innerWidth  * dpr;
  seqCanvas.height       = innerHeight * dpr;
  seqCanvas.style.width  = innerWidth  + 'px';
  seqCanvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Deep link ────────────────────────────────────────────────────────────────

function sceneFromHash() {
  const id = new URLSearchParams(location.hash.slice(1)).get('scene');
  return CONFIG.scenes[id] ? id : 'aerial';
}

function syncHash(sceneId) {
  history.replaceState(null, '', `#scene=${sceneId}`);
}

// ─── Video source ─────────────────────────────────────────────────────────────

function videoSrc(scene) {
  let v = scene.video;
  if (v && (v.day || v.night)) v = v[mode] || v.day;
  if (!v) return null;
  if (typeof v === 'string') return v;
  const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  return (MOBILE || safari) ? (v.mp4 || v.webm) : (v.webm || v.mp4);
}

// ─── Video preload ────────────────────────────────────────────────────────────

const loadOne = (src) => {
  if (!src || videoBlobs.has(src)) return Promise.resolve();
  return fetch(src)
    .then(r => r.blob())
    .then(blob => { videoBlobs.set(src, URL.createObjectURL(blob)); })
    .catch(() => {});
};

function preloadNeighbors(sceneId) {
  const want = new Set([videoSrc(CONFIG.scenes[sceneId])]);
  Object.keys(CONFIG.transitions[sceneId] || {})
    .forEach(d => want.add(videoSrc(CONFIG.scenes[d])));
  [...want].filter(Boolean).forEach(loadOne);
}

function preloadAllVideos() {
  const srcs = [...new Set(
    Object.values(CONFIG.scenes).map(s => videoSrc(s)).filter(Boolean)
  )];
  const firstSrc = videoSrc(CONFIG.scenes['aerial']);
  const rest = srcs.filter(s => s !== firstSrc);
  const chain = firstSrc ? loadOne(firstSrc) : Promise.resolve();
  chain.then(() => Promise.all(rest.map(loadOne)));
}

// ─── Poster ───────────────────────────────────────────────────────────────────

function showPoster(src, cb) {
  seqCanvas.classList.add('active');
  const img = new Image();
  img.onload  = () => { drawCover(img); cb?.(); };
  img.onerror = () => cb?.();
  img.src = src;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function startScene(sceneId) {
  const scene = CONFIG.scenes[sceneId];
  if (!scene) return;

  markDwell(sceneId);
  currentScene = sceneId;
  setActive(sceneId);
  syncHash(sceneId);
  renderPOIs(scene.pois);

  // Kick off background preloads for adjacent scenes and their sequences
  preloadNeighbors(sceneId);
  Object.values(CONFIG.transitions[sceneId] || {}).forEach(id => preload(id));

  const src = videoSrc(scene);
  if (!src) { seqCanvas.classList.remove('active'); return; }

  const gen = navGen;
  mainVideo.src  = videoBlobs.get(src) || src;
  mainVideo.loop = true;
  mainVideo.load();

  const onReady = () => {
    if (gen !== navGen) return;
    let faded = false;
    const doFade = () => {
      if (faded || gen !== navGen) return;
      faded = true;
      fadeCanvas();
    };
    // Fade out the canvas as soon as the video produces its first frame
    mainVideo.addEventListener('playing',    doFade, { once: true });
    mainVideo.addEventListener('timeupdate', doFade, { once: true });
    mainVideo.play().catch(doFade);
    setTimeout(doFade, 500);
  };

  if (mainVideo.readyState >= 3) {
    onReady();
  } else {
    const evt = MOBILE ? 'loadeddata' : 'canplay';
    mainVideo.addEventListener(evt, onReady, { once: true });
    setTimeout(onReady, MOBILE ? 3000 : 5000);
  }
}

function fadeCanvas() {
  seqCanvas.style.transition = 'opacity 300ms ease';
  seqCanvas.style.opacity    = '0';
  setTimeout(() => {
    seqCanvas.classList.remove('active');
    seqCanvas.style.opacity    = '';
    seqCanvas.style.transition = '';
  }, 300);
}

// ─── Navigation ───────────────────────────────────────────────────────────────

async function navigateTo(targetId) {
  if (busy || targetId === currentScene) return;

  const seqId = CONFIG.transitions?.[currentScene]?.[targetId];
  if (!seqId) return;

  busy = true;
  const gen = ++navGen;
  hidePOIs();

  try {
    const frames = await loadWithLoader(seqId);
    if (gen !== navGen) return;

    // Mobile loads every other frame, so halve fps to maintain the same wall-clock duration
    const seq = CONFIG.sequences[seqId];
    const fps = (seq.fps || 30) / (MOBILE ? 2 : 1);
    await playSequence(frames, seq.reverse === true, gen, fps);

    if (gen !== navGen) return;
    startScene(targetId);
  } catch (err) {
    if (gen === navGen) {
      console.error('Sequence error:', err);
      seqCanvas.classList.remove('active');
    }
  } finally {
    if (gen === navGen) {
      setTimeout(() => { if (gen === navGen) busy = false; }, 350);
    }
  }
}

function loadWithLoader(seqId) {
  const p     = preload(seqId);
  const timer = setTimeout(() => loaderEl.classList.add('visible'), 400);
  return p.finally(() => { clearTimeout(timer); loaderEl.classList.remove('visible'); });
}

// ─── Preloading (LRU + img.decode) ────────────────────────────────────────────

function rememberSeq(seqId, promise) {
  cache.set(seqId, promise);
  // Evict the oldest entry when over the LRU cap
  if (cache.size > MAX_SEQ) {
    const oldest = cache.keys().next().value;
    if (oldest !== seqId) cache.delete(oldest);
  }
}

function preload(seqId) {
  if (cache.has(seqId)) return cache.get(seqId);

  const seqBase = CONFIG.sequences[seqId];
  // Mobile: use the half-resolution folder to reduce network load
  const seq = MOBILE
    ? { ...seqBase, folder: seqBase.folder.replace('images/seq_arch/', 'images/seq_arch_m/') }
    : seqBase;

  const step    = MOBILE ? 2 : 1; // skip every other frame on mobile
  const indices = [];
  for (let i = seq.from; i <= seq.to; i += step) indices.push(i);

  const frames  = new Array(indices.length);
  let loaded    = 0;
  let failed    = false;
  // Limit parallel downloads on mobile to avoid saturating a slow connection
  const SLOTS   = MOBILE ? 4 : indices.length;
  let nextLoad  = 0;

  const promise = new Promise((resolve, reject) => {
    const loadNext = () => {
      if (nextLoad >= indices.length) return;
      const slot = nextLoad++;
      const num  = String(indices[slot]).padStart(seq.pad, '0');
      const img  = new Image();
      img.src = `${seq.folder}${seq.prefix}${num}.${seq.ext}`;

      img.onload = () => {
        // Pre-decode eliminates stutter on the first drawImage call
        const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
        ready.then(() => {
          frames[slot] = img;
          loadNext();
          if (++loaded === indices.length) resolve(frames);
        });
      };
      img.onerror = () => {
        if (!failed) { failed = true; cache.delete(seqId); reject(new Error(`Failed to load: ${img.src}`)); }
      };
    };
    for (let k = 0; k < Math.min(SLOTS, indices.length); k++) loadNext();
  });

  rememberSeq(seqId, promise);
  return promise;
}

// ─── Playback (real-time throttle, handles 120Hz ProMotion) ───────────────────

function playSequence(frames, reverse = false, gen, fps = 30) {
  return new Promise(resolve => {
    seqCanvas.classList.add('active');
    let index = reverse ? frames.length - 1 : 0;
    let last  = 0;
    const step = 1000 / fps;

    function loop(now) {
      if (gen !== navGen) return resolve();
      if (now - last >= step) {
        last = now;
        if (frames[index]) drawCover(frames[index]);
        index += reverse ? -1 : 1;
        if (reverse ? index < 0 : index >= frames.length) return resolve();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
}

function drawCover(img) {
  const cw    = innerWidth;
  const ch    = innerHeight;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw    = Math.round(img.naturalWidth  * scale);
  const dh    = Math.round(img.naturalHeight * scale);
  const dx    = Math.round((cw - dw) / 2);
  const dy    = Math.round((ch - dh) / 2);
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
  lastFrame = img;
}

// ─── POIs ─────────────────────────────────────────────────────────────────────

function renderPOIs(pois = []) {
  poiLayer.innerHTML = '';
  pois.forEach((poi, i) => {
    const el = document.createElement('div');
    el.className = 'poi' + (poi.type === 'info' ? ' poi--info' : '');
    el.style.left = poi.x + '%';
    el.style.top  = poi.y + '%';
    el.style.animationDelay = (i * 80) + 'ms';
    el.innerHTML = `<div class="poi-btn"><span class="poi-pulse"></span></div>
                    <div class="poi-name">${poi.label}</div>`;

    const act = () => {
      if (poi.type === 'nav' && poi.target) {
        track('poi_nav', { from: currentScene, to: poi.target });
        navigateTo(poi.target);
      } else if (poi.type === 'info' && poi.info) {
        track('poi_info', { scene: currentScene, label: poi.label });
        openInfo(poi.info);
      } else if (poi.target) {
        navigateTo(poi.target);
      }
    };

    el.addEventListener('click', act);
    el.addEventListener('touchstart', e => { e.preventDefault(); act(); }, { passive: false });
    poiLayer.appendChild(el);
  });
}

function hidePOIs() {
  clearTimeout(poiTimer);
  poiLayer.classList.add('out');
  poiTimer = setTimeout(() => { poiLayer.innerHTML = ''; poiLayer.classList.remove('out'); }, 300);
}

function openInfo(info) {
  let panel = document.getElementById('info-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'info-panel';
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      if (e.target === panel || e.target.dataset.close) panel.classList.remove('open');
    });
  }
  panel.innerHTML = `
    <div id="info-card">
      <button data-close aria-label="Close">&times;</button>
      ${info.image ? `<img src="${info.image}" alt="">` : ''}
      <h3>${info.title}</h3>
      ${info.area ? `<span class="info-area">${info.area}</span>` : ''}
      <ul>${(info.items || []).map(t => `<li>${t}</li>`).join('')}</ul>
    </div>`;
  requestAnimationFrame(() => panel.classList.add('open'));
}

// ─── Track (nav dock) ─────────────────────────────────────────────────────────

function buildTrack() {
  const wrap = document.createElement('div');
  wrap.id = 'track-pts';
  CONFIG.timeline.forEach(item => {
    const btn = document.createElement('button');
    btn.className  = 't-pt';
    btn.dataset.id = item.id;
    btn.setAttribute('aria-label', item.label);
    btn.setAttribute('data-label', item.label);
    btn.innerHTML  = (item.icon || '') + `<span class="t-label">${item.label}</span>`;
    btn.addEventListener('click', () => navigateTo(item.id));
    wrap.appendChild(btn);
  });
  trackEl.appendChild(wrap);
  trackEl.classList.add('show');
}

function setActive(id) {
  document.querySelectorAll('.t-pt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });
  const item = CONFIG.timeline.find(t => t.id === id);
  if (!item) return;
}

// ─── Custom cursor (desktop only) ─────────────────────────────────────────────

function initCursor() {
  const cursor = document.getElementById('cursor');
  const ring   = document.getElementById('ring');
  if (!cursor) return;
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  (function loop() {
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';
    const dx = (mx - rx) * 0.12;
    const dy = (my - ry) * 0.12;
    rx += dx; ry += dy;
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
    }
    requestAnimationFrame(loop);
  })();
  document.addEventListener('mouseover', e => {
    cursor.classList.toggle('on', !!e.target.closest('button,.t-pt,.poi'));
  });
}

// ─── Debug mode (press D) ─────────────────────────────────────────────────────

let debugOn = false;
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'd') return;
  debugOn = !debugOn;
  debugHud.hidden = !debugOn;
  document.body.style.cursor = debugOn ? 'crosshair' : '';
});
document.addEventListener('click', e => {
  if (!debugOn) return;
  const x   = (e.clientX / innerWidth  * 100).toFixed(1);
  const y   = (e.clientY / innerHeight * 100).toFixed(1);
  const txt = `x: ${x}, y: ${y}`;
  debugCoords.textContent = txt;
  console.log(txt);
  navigator.clipboard?.writeText(txt);
});

// ─── Deterrents (casual copy/inspect only — not real protection) ──────────────

document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (
    k === 'f12' ||
    (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) ||
    (e.ctrlKey && k === 'u') ||
    (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(k))
  ) {
    e.preventDefault();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI STUDIO — Imagem / Vídeo / Voz (Gemini 3.x)
// ═══════════════════════════════════════════════════════════════════════════

// Captura o frame atual (vídeo em loop ou canvas de transição) como JPEG base64.
// Sem os fallbacks de ImageCapture/fetch do outro projeto — aqui os elementos
// são same-origin em produção; falha silenciosamente (retorna null) se o
// canvas estiver "tainted" (ex.: rodando via file://).
async function captureSceneFrame() {
  try {
    const w = innerWidth, h = innerHeight;
    const scale = Math.min(1, 1024 / w);
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    const octx = out.getContext('2d');

    if (seqCanvas.classList.contains('active')) {
      octx.drawImage(seqCanvas, 0, 0, cw, ch);
    } else if (mainVideo.readyState >= 2 && mainVideo.videoWidth > 0) {
      const vw = mainVideo.videoWidth, vh = mainVideo.videoHeight;
      const s = Math.max(cw / vw, ch / vh);
      const dw = vw * s, dh = vh * s;
      octx.drawImage(mainVideo, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    } else {
      return null;
    }
    const dataUrl = out.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1];
  } catch (e) {
    return null;
  }
}

// Chave compartilhada pelas 3 abas — só vive na memória da página,
// nunca é salva (localStorage/servidor); some ao recarregar.
function aiKey() {
  return document.getElementById('ai-key').value.trim();
}

function aiTogglePanel() {
  const panel = document.getElementById('ai-panel');
  const btn = document.getElementById('ai-trigger-btn');
  const isOpen = panel.classList.contains('open');
  if (!isOpen) {
    // volta pro centro antes de abrir, caso tenha sido arrastado da última vez
    panel.style.top = '50%';
    panel.style.left = '50%';
    panel.style.transform = 'translate(-50%, -50%) scale(0.97)';
    panel.offsetHeight; // força reflow pra transição funcionar
  }
  panel.classList.toggle('open', !isOpen);
  btn.classList.toggle('active', !isOpen);
}

// Arrasta o modal pela header — Pointer Events unifica mouse/touch/caneta
// numa API só, então funciona em desktop e mobile sem código duplicado.
function aiInitDrag() {
  const panel = document.getElementById('ai-panel');
  const header = document.getElementById('ai-panel-header');
  let dragging = false, offX = 0, offY = 0;

  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#ai-panel-close')) return;
    dragging = true;
    panel.classList.add('dragging');
    const r = panel.getBoundingClientRect();
    panel.style.top = r.top + 'px';
    panel.style.left = r.left + 'px';
    panel.style.transform = 'none';
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    header.setPointerCapture(e.pointerId);
  });

  header.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    let nx = e.clientX - offX;
    let ny = e.clientY - offY;
    nx = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, nx));
    ny = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, ny));
    panel.style.left = nx + 'px';
    panel.style.top = ny + 'px';
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('dragging');
  };
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);
}
aiInitDrag();

function aiSwitchTab(name) {
  document.querySelectorAll('.ai-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name),
  );
  document.querySelectorAll('.ai-tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'ai-tab-' + name),
  );
}

// ── Imagem (gemini-3.1-flash-image via /v1beta/interactions) ───────────────

let _aiImages = [];
let _aiCapturedB64 = null;
let _aiImgIdx = 0;

function aiSetStatus(msg) {
  document.getElementById('ai-img-status').textContent = msg;
}

function aiShowImage(idx) {
  _aiImgIdx = idx;
  const entry = _aiImages[idx];
  const img = document.getElementById('ai-result-img');
  img.src = entry.url || ('data:image/png;base64,' + entry.b64);
  document.getElementById('ai-img-wrap').classList.add('visible');
  document.getElementById('ai-img-dl-btn').classList.add('visible');
}

function aiCloseImage() {
  _aiImages = [];
  _aiImgIdx = 0;
  document.getElementById('ai-img-wrap').classList.remove('visible');
  document.getElementById('ai-img-dl-btn').classList.remove('visible');
  aiSetStatus('');
}

function aiOpenLightbox() {
  const src = document.getElementById('ai-result-img').src;
  if (!src) return;
  document.getElementById('ai-lightbox-img').src = src;
  document.getElementById('ai-lightbox').classList.add('open');
}

function aiCloseLightbox() {
  document.getElementById('ai-lightbox').classList.remove('open');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') aiCloseLightbox();
});

function aiDownload() {
  if (!_aiImages.length) return;
  const entry = _aiImages[_aiImgIdx];
  const a = document.createElement('a');
  a.href = entry.url || ('data:image/png;base64,' + entry.b64);
  a.download = 'ai-image.png';
  a.click();
}

async function aiManualCapture() {
  const btn = document.querySelector('#ai-tab-image .ai-capture-btn');
  const thumb = document.getElementById('ai-img-capture-thumb');
  btn.textContent = '⏳ Capturing...';
  btn.disabled = true;
  const b64 = await captureSceneFrame();
  btn.disabled = false;
  if (!b64) {
    btn.textContent = '📷 Capture View';
    thumb.innerHTML = '<span style="color:rgba(255,80,80,0.7)">Failed — try again</span>';
    return;
  }
  _aiCapturedB64 = b64;
  btn.textContent = '✓ Recapture';
  thumb.innerHTML = `<img src="data:image/jpeg;base64,${b64}" alt="captura" />`;
}

async function aiGenerate() {
  const key = aiKey();
  const promptRaw = document.getElementById('ai-img-prompt').value.trim();
  const style = 'photorealistic'; // always applied — style picker was removed
  const hasCapture = _aiCapturedB64 && _aiCapturedB64.length >= 500;

  if (!key) { aiSetStatus('Enter the API Key'); return; }
  if (!promptRaw && !hasCapture) {
    aiSetStatus('Enter a prompt or capture the current view');
    return;
  }

  // No text but with a capture: the vision analysis in aiGemini() describes
  // the image on its own and becomes the prompt — just needs a generic
  // instruction here.
  const basePrompt = promptRaw ||
    'Enhance this exact scene into a polished, photorealistic architectural render, keeping the same composition, structures and camera angle.';
  const prompt = style ? basePrompt + ', ' + style + ' style' : basePrompt;
  const btn = document.getElementById('ai-img-generate-btn');
  btn.disabled = true;
  aiSetStatus('Creating image...');
  _aiImages = [];

  try {
    await aiGemini(key, prompt);
    if (_aiImages.length) {
      aiShowImage(0);
      aiSetStatus('Done!');
    } else {
      aiSetStatus('No image returned.');
    }
  } catch (err) {
    console.error(err);
    aiSetStatus('Error: ' + err.message);
  }
  btn.disabled = false;
}

async function aiGemini(key, prompt) {
  const headers = { 'Content-Type': 'application/json' };

  // No intermediate status updates here on purpose — the UI just shows
  // "Creating image..." the whole time, without exposing the internal
  // capture/analyze/generate steps or which provider is being used.
  let frameB64 = _aiCapturedB64;
  if (!frameB64 || frameB64.length < 500) {
    frameB64 = await captureSceneFrame();
  }

  // 1. View analysis (optional — only enriches the prompt if the capture worked)
  let enrichedPrompt = prompt;
  if (frameB64 && frameB64.length >= 500) {
    const models = [
      'gemini-3.6-flash', 'gemini-3.5-flash-lite',
      'gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro',
      'gemini-2.0-flash', 'gemini-1.5-flash',
    ];
    const textBody = JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: frameB64 } },
          { text: 'Describe this architectural scene in detail for an image generation prompt. Include spatial layout, style, materials, lighting and atmosphere. User style request: ' + prompt + '. Respond with ONLY a concise image generation prompt in English, max 100 words.' },
        ],
      }],
    });
    outer:
    for (const ver of ['v1beta', 'v1']) {
      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${key}`,
            { method: 'POST', headers, body: textBody },
          );
          const data = await res.json();
          if (!res.ok) continue;
          const description = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (description) { enrichedPrompt = description.trim(); break outer; }
        } catch (e) { /* try next model/version */ }
      }
    }
  }

  // 2. Image generation — new endpoint first, falls back to the old one if needed.
  // Sends the captured photo as a reference (not just the text description),
  // turning this into an edit conditioned on the real scene instead of
  // generating from scratch — this is what avoids "random" compositions
  // disconnected from the current view.
  const hasRefImg = frameB64 && frameB64.length >= 500;
  const newImgModels = ['gemini-3.1-flash-image', 'gemini-3-pro-image'];
  let imgErr = '';
  for (const model of newImgModels) {
    try {
      const input = [{ type: 'text', text: enrichedPrompt }];
      if (hasRefImg) input.push({ type: 'image', mime_type: 'image/jpeg', data: frameB64 });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/interactions?key=${key}`,
        { method: 'POST', headers, body: JSON.stringify({ model, input }) },
      );
      const data = await res.json();
      if (!res.ok) { imgErr = `[${model}] ${data?.error?.message || res.status}`; continue; }
      const b64 = extractInteractionImages(data);
      if (b64.length) { b64.forEach((b) => _aiImages.push({ b64: b })); return; }
      imgErr = `[${model}] response had no image`;
    } catch (e) { imgErr = e.message; }
  }

  const legacyImgModels = [
    { model: 'imagen-4.0-generate-001', ver: 'v1beta', endpoint: 'predict' },
    { model: 'imagen-3.0-generate-002', ver: 'v1beta', endpoint: 'predict' },
    { model: 'gemini-2.0-flash-preview-image-generation', ver: 'v1beta', endpoint: 'generateContent' },
  ];
  for (const { model, ver, endpoint } of legacyImgModels) {
    try {
      const genParts = [{ text: enrichedPrompt }];
      if (hasRefImg) genParts.push({ inlineData: { mimeType: 'image/jpeg', data: frameB64 } });
      const body = endpoint === 'predict'
        ? JSON.stringify({ instances: [{ prompt: enrichedPrompt }], parameters: { sampleCount: 1, aspectRatio: '16:9' } })
        : JSON.stringify({ contents: [{ role: 'user', parts: genParts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/${ver}/models/${model}:${endpoint}?key=${key}`,
        { method: 'POST', headers, body },
      );
      const data = await res.json();
      if (!res.ok) { imgErr = `[${model}] ${data?.error?.message || res.status}`; continue; }
      if (endpoint === 'predict') {
        const preds = (data.predictions || []).filter((p) => p.bytesBase64Encoded);
        if (preds.length) { preds.forEach((p) => _aiImages.push({ b64: p.bytesBase64Encoded })); return; }
      } else {
        const imgs = (data?.candidates?.[0]?.content?.parts || []).filter((p) => p.inlineData?.data);
        if (imgs.length) { imgs.forEach((p) => _aiImages.push({ b64: p.inlineData.data })); return; }
      }
    } catch (e) { imgErr = e.message; }
  }
  throw new Error('Image generation failed. The key needs access to a Gemini/Imagen image model.\n' + imgErr);
}

// The new API (interactions) exposes `interaction.output_image` as an SDK shortcut;
// the raw JSON isn't publicly documented yet, so we scan the known/likely
// shapes (output_image, steps[].content[], candidates[].content.parts[]).
function extractInteractionImages(data) {
  const out = [];
  const push = (b64) => { if (b64) out.push(b64); };

  push(data?.output_image?.data);

  (data?.steps || []).forEach((step) => {
    (step?.content || []).forEach((part) => {
      if (part?.type === 'image' && part?.data) push(part.data);
    });
  });

  (data?.candidates?.[0]?.content?.parts || []).forEach((part) => {
    if (part?.inlineData?.data) push(part.inlineData.data);
  });

  return out;
}

// ── Video (Veo 3.1) ──────────────────────────────────────────────────────────

let _aiVideoB64Frame = null;
let _aiVideoMime = 'image/jpeg';
let _aiVideoUrl = null;

// Picks the starting frame for the video: the current view captured now, or
// the last image generated in the Image tab — the user decides which one.
async function aiSetVideoSource(kind) {
  const thumb = document.getElementById('ai-vid-capture-thumb');
  const btns = document.querySelectorAll('#ai-tab-video .ai-capture-btn');
  btns.forEach((b) => b.classList.toggle('active', b.dataset.src === kind));

  if (kind === 'capture') {
    const btn = document.querySelector('#ai-tab-video .ai-capture-btn[data-src="capture"]');
    btn.disabled = true;
    thumb.textContent = '⏳ Capturing...';
    const b64 = await captureSceneFrame();
    btn.disabled = false;
    if (!b64) {
      thumb.innerHTML = '<span style="color:rgba(255,80,80,0.7)">Failed — try again</span>';
      _aiVideoB64Frame = null;
      return;
    }
    _aiVideoB64Frame = b64;
    _aiVideoMime = 'image/jpeg';
    thumb.innerHTML = `<img src="data:image/jpeg;base64,${b64}" alt="capture" />`;
  } else if (kind === 'generated') {
    if (!_aiImages.length) {
      thumb.innerHTML = '<span style="color:rgba(255,80,80,0.7)">Generate an image in the Image tab first</span>';
      _aiVideoB64Frame = null;
      return;
    }
    const entry = _aiImages[_aiImgIdx];
    _aiVideoB64Frame = entry.b64;
    _aiVideoMime = 'image/png';
    thumb.innerHTML = `<img src="data:image/png;base64,${entry.b64}" alt="generated image" />`;
  }
}

function aiSetVideoStatus(msg) {
  document.getElementById('ai-vid-status').textContent = msg;
}

function aiCloseVideo() {
  const wrap = document.getElementById('ai-vid-wrap');
  const video = document.getElementById('ai-result-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  if (_aiVideoUrl) { URL.revokeObjectURL(_aiVideoUrl); _aiVideoUrl = null; }
  wrap.classList.remove('visible');
  document.getElementById('ai-vid-dl-btn').classList.remove('visible');
  aiSetVideoStatus('Video generation takes 1 to 3 minutes.');
}

function aiDownloadVideo() {
  if (!_aiVideoUrl) return;
  const a = document.createElement('a');
  a.href = _aiVideoUrl;
  a.download = 'ai-video.mp4';
  a.click();
}

async function aiGenerateVideo() {
  const key = aiKey();
  const prompt = document.getElementById('ai-vid-prompt').value.trim();
  if (!key) { aiSetVideoStatus('Enter the API Key'); return; }
  if (!prompt) { aiSetVideoStatus('Enter a prompt'); return; }

  const btn = document.getElementById('ai-vid-generate-btn');
  btn.disabled = true;
  aiCloseVideo();
  aiSetVideoStatus('Creating video...');

  try {
    const instance = { prompt };
    if (_aiVideoB64Frame) {
      // The predictLongRunning endpoint (Veo/Imagen) uses Vertex AI's "flat"
      // format (bytesBase64Encoded), not generateContent's inlineData —
      // using inlineData here returns "isn't supported by this model".
      instance.image = { bytesBase64Encoded: _aiVideoB64Frame, mimeType: _aiVideoMime };
    }

    const startRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instances: [instance] }) },
    );
    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(startData?.error?.message || String(startRes.status));
    const opName = startData.name;
    if (!opName) throw new Error('Response had no operation name.');

    let done = false, tries = 0, opData = null;
    while (!done && tries < 60) {
      await new Promise((r) => setTimeout(r, 10000));
      tries++;
      // no per-poll status update on purpose — keeps "Creating video..." shown
      const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opName}?key=${key}`);
      opData = await pollRes.json();
      if (!pollRes.ok) throw new Error(opData?.error?.message || String(pollRes.status));
      done = !!opData.done;
    }
    if (!done) throw new Error('Timed out waiting for the video.');
    if (opData.error) throw new Error(opData.error.message || 'Generation error.');

    const videoUri = opData?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!videoUri) throw new Error('Response had no video.');

    // still "Creating video..." — no separate "downloading" step shown
    const videoRes = await fetch(videoUri, { headers: { 'x-goog-api-key': key } });
    if (!videoRes.ok) throw new Error('Failed to download the generated video.');
    const blob = await videoRes.blob();
    _aiVideoUrl = URL.createObjectURL(blob);

    const videoEl = document.getElementById('ai-result-video');
    videoEl.src = _aiVideoUrl;
    document.getElementById('ai-vid-wrap').classList.add('visible');
    document.getElementById('ai-vid-dl-btn').classList.add('visible');
    aiSetVideoStatus('Done!');
  } catch (err) {
    console.error(err);
    aiSetVideoStatus('Error: ' + err.message);
  }
  btn.disabled = false;
}

// ── Voz — Live API (gemini-3.1-flash-live-preview) ──────────────────────────
// WebSocket bidirecional: microfone (PCM16 16kHz) sobe, áudio do modelo
// (PCM16 24kHz) desce, frames da tela sobem como contexto visual (<=1fps),
// e o modelo pode chamar navigate_to_scene para controlar a navegação.

const neoLive = {
  active: false,
  connecting: false,
  ws: null,
  micStream: null,
  inputCtx: null,
  inputNode: null,
  _inputSource: null,
  outputCtx: null,
  nextPlayTime: 0,
  playingSources: [],
  frameTimer: null,
  setupDone: false,
};

const NEO_LIVE_TOOLS = [
  {
    name: 'navigate_to_scene',
    description: 'Navega até uma das cenas/vistas do tour 3D.',
    parameters: {
      type: 'OBJECT',
      properties: {
        scene_id: {
          type: 'STRING',
          description: 'O id da cena de destino, um dos: ' + CONFIG.timeline.map((t) => t.id).join(', '),
        },
      },
      required: ['scene_id'],
    },
  },
  {
    name: 'list_scenes',
    description: 'Lista todas as cenas/vistas disponíveis para navegação, com id e título.',
    parameters: { type: 'OBJECT', properties: {} },
  },
];

function neoLiveSystemInstruction() {
  const scenes = CONFIG.timeline.map((t) => `- id:"${t.id}" título:"${t.label}"`).join('\n');
  return `Você é um corretor virtual simpático e objetivo, guiando o usuário por um tour 3D imersivo (ArchViz Explorer) de um empreendimento imobiliário.
Você está vendo a tela do usuário em tempo real através de frames de imagem enviados periodicamente — comente o que está vendo.
Converse em português do Brasil, de forma natural e breve (respostas curtas, tom de conversa falada, não leia listas).
Dê dicas sobre o que está sendo mostrado, destaque diferenciais, e ofereça navegar para outras vistas quando fizer sentido — use a função navigate_to_scene para isso.
As vistas disponíveis são:
${scenes}
Nunca invente um scene_id que não esteja nessa lista.`;
}

// Sem transcript visual (o modo voz virou um botão avulso, não uma aba) —
// fica só no console pra debug.
function neoLiveVoiceEl(role, text) {
  console.debug('[neoLive]', role, text);
}

function neoLiveSetStatus(msg) {
  const btn = document.getElementById('ai-voice-btn');
  if (btn) btn.title = msg;
}

function neoLiveToggle() {
  if (neoLive.active || neoLive.connecting) neoLiveStop();
  else neoLiveStart();
}

async function neoLiveStart() {
  const key = aiKey();
  if (!key) {
    neoLiveSetStatus('No API Key — open the AI panel and paste your key first');
    return;
  }
  if (neoLive.connecting || neoLive.active) return;
  neoLive.connecting = true;

  const btn = document.getElementById('ai-voice-btn');
  btn.classList.add('connecting');
  neoLiveSetStatus('Connecting...');

  try {
    neoLive.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    neoLiveSetStatus('Microphone denied/unavailable.');
    btn.classList.remove('connecting');
    neoLive.connecting = false;
    return;
  }

  neoLive.inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  neoLive.outputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  neoLive.nextPlayTime = 0;
  neoLive.playingSources = [];

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;
  neoLive.ws = new WebSocket(wsUrl);
  neoLive.setupDone = false;

  neoLive.ws.onopen = () => {
    neoLive.ws.send(JSON.stringify({
      setup: {
        model: 'models/gemini-3.1-flash-live-preview',
        responseModalities: ['AUDIO'],
        systemInstruction: { parts: [{ text: neoLiveSystemInstruction() }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: NEO_LIVE_TOOLS }],
      },
    }));
  };

  neoLive.ws.onmessage = async (event) => {
    let text = event.data;
    if (text instanceof Blob) text = await text.text();
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    neoLiveHandleMessage(msg);
  };

  neoLive.ws.onerror = () => neoLiveSetStatus('Connection error.');
  neoLive.ws.onclose = () => { if (neoLive.active || neoLive.connecting) neoLiveStop(); };

  neoLive.active = true;
  neoLive.connecting = false;

  neoLiveStartMic();
  neoLiveStartScreenFeed();
}

function neoLiveStartMic() {
  const source = neoLive.inputCtx.createMediaStreamSource(neoLive.micStream);
  const processor = neoLive.inputCtx.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    if (!neoLive.ws || neoLive.ws.readyState !== WebSocket.OPEN || !neoLive.setupDone) return;
    const input = e.inputBuffer.getChannelData(0);
    const pcm16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(pcm16.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    neoLive.ws.send(JSON.stringify({
      realtimeInput: { audio: { data: btoa(bin), mimeType: 'audio/pcm;rate=16000' } },
    }));
  };
  source.connect(processor);
  processor.connect(neoLive.inputCtx.destination);
  neoLive.inputNode = processor;
  neoLive._inputSource = source;
}

function neoLiveStartScreenFeed() {
  neoLive.frameTimer = setInterval(async () => {
    if (!neoLive.active || !neoLive.ws || neoLive.ws.readyState !== WebSocket.OPEN || !neoLive.setupDone) return;
    const b64 = await captureSceneFrame();
    if (!b64) return;
    neoLive.ws.send(JSON.stringify({ realtimeInput: { video: { data: b64, mimeType: 'image/jpeg' } } }));
  }, 1000);
}

function neoLivePlayPCM(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

  const ctx = neoLive.outputCtx;
  const buffer = ctx.createBuffer(1, float32.length, 24000);
  buffer.copyToChannel(float32, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);

  const startAt = Math.max(ctx.currentTime, neoLive.nextPlayTime);
  src.start(startAt);
  neoLive.nextPlayTime = startAt + buffer.duration;
  neoLive.playingSources.push(src);
  src.onended = () => { neoLive.playingSources = neoLive.playingSources.filter((s) => s !== src); };
}

function neoLiveStopPlayback() {
  neoLive.playingSources.forEach((s) => { try { s.stop(); } catch (e) {} });
  neoLive.playingSources = [];
  neoLive.nextPlayTime = neoLive.outputCtx ? neoLive.outputCtx.currentTime : 0;
}

function neoLiveHandleMessage(msg) {
  if (msg.setupComplete) {
    neoLive.setupDone = true;
    const btn = document.getElementById('ai-voice-btn');
    btn.classList.remove('connecting');
    btn.classList.add('live'); // only here does the circle actually start pulsing
    neoLiveSetStatus('🎙️ Listening...');
    return;
  }

  if (msg.serverContent) {
    const sc = msg.serverContent;
    if (sc.interrupted) neoLiveStopPlayback();
    if (sc.modelTurn?.parts) {
      for (const part of sc.modelTurn.parts) {
        if (part.inlineData?.data) {
          neoLiveSetStatus('🔊 Speaking...');
          neoLivePlayPCM(part.inlineData.data);
        }
      }
    }
    if (sc.inputTranscription?.text) neoLiveVoiceEl('user', sc.inputTranscription.text);
    if (sc.outputTranscription?.text) neoLiveVoiceEl('model', sc.outputTranscription.text);
    if (sc.turnComplete) neoLiveSetStatus('🎙️ Listening...');
  }

  if (msg.toolCall) {
    const responses = [];
    for (const fc of msg.toolCall.functionCalls) {
      let result;
      try { result = neoLiveRunTool(fc.name, fc.args || {}); }
      catch (e) { result = { error: e.message }; }
      responses.push({ id: fc.id, name: fc.name, response: { result } });
    }
    neoLive.ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
  }
}

function neoLiveRunTool(name, args) {
  if (name === 'navigate_to_scene') {
    if (!CONFIG.scenes[args.scene_id]) {
      return { status: 'error', message: 'unknown scene_id: ' + args.scene_id };
    }
    navigateTo(args.scene_id);
    return { status: 'ok', scene: args.scene_id };
  }
  if (name === 'list_scenes') {
    return { scenes: CONFIG.timeline.map((t) => ({ id: t.id, title: t.label })) };
  }
  return { status: 'error', message: 'unknown function: ' + name };
}

function neoLiveStop() {
  neoLive.active = false;
  neoLive.connecting = false;
  if (neoLive.frameTimer) { clearInterval(neoLive.frameTimer); neoLive.frameTimer = null; }
  if (neoLive.ws) { try { neoLive.ws.close(); } catch (e) {} neoLive.ws = null; }
  if (neoLive.micStream) { neoLive.micStream.getTracks().forEach((t) => t.stop()); neoLive.micStream = null; }
  if (neoLive.inputNode) { try { neoLive.inputNode.disconnect(); } catch (e) {} neoLive.inputNode = null; }
  if (neoLive._inputSource) { try { neoLive._inputSource.disconnect(); } catch (e) {} neoLive._inputSource = null; }
  neoLiveStopPlayback();
  if (neoLive.inputCtx) { neoLive.inputCtx.close().catch(() => {}); neoLive.inputCtx = null; }
  if (neoLive.outputCtx) { neoLive.outputCtx.close().catch(() => {}); neoLive.outputCtx = null; }
  neoLive.setupDone = false;

  const btn = document.getElementById('ai-voice-btn');
  btn.classList.remove('live', 'connecting');
  neoLiveSetStatus('Talk to the AI');
}

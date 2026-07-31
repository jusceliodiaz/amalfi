/* ══════════════════════════════════════════════════════
   PANO 360 — equirectangular panorama viewer (Three.js).
   Ported from the 7mmstudio launching-page prototype: drag to look
   around, wheel/pinch to zoom, hotspots to jump between panoramas.
   One panorama per scene (aerial → Piscina, pool → Terrazza), each
   with a single hotspot leading to the other.
   Exposes window.openPanoModal(sceneId) / window.closePanoModal().
   ══════════════════════════════════════════════════════ */

import * as THREE from "three";

const TOUR = {
  aerial: {
    label: "Piscina",
    src: "images/3dpano1.jpeg",
    hotspots: [{ lon: 180, lat: 0, label: "Terrazza", leadsTo: "pool" }]
  },
  pool: {
    label: "Terrazza",
    src: "images/3dpano2.jpeg",
    hotspots: [{ lon: 180, lat: 0, label: "Piscina", leadsTo: "aerial" }]
  }
};

const modal = document.getElementById("pano-modal");
const box = document.getElementById("pano-modal-box");
const canvas = document.getElementById("pano-canvas");
const loading = document.getElementById("pano-loading");
const hint = document.getElementById("pano-hint");
const roomLabel = document.getElementById("pano-room-label");
const hotspotsEl = document.getElementById("pano-hotspots");

let renderer = null, scene = null, camera = null, mesh = null, frameId = null;
let lon = 180, lat = 0, velLon = 0, velLat = 0;
let dragging = false, px = 0, py = 0;
let currentRoom = null, transitioning = false;

function setRoomUI(roomKey) {
  currentRoom = roomKey;
  roomLabel.textContent = TOUR[roomKey].label;
  hotspotsEl.innerHTML = "";
  TOUR[roomKey].hotspots.forEach(h => {
    const el = document.createElement("div");
    el.className = "pano-hotspot";
    el.innerHTML = `<div class="pano-hotspot-dot"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div><div class="pano-hotspot-label">${h.label}</div>`;
    el.addEventListener("click", () => navigateToPano(h.leadsTo));
    hotspotsEl.appendChild(el);
  });
}

function updateHotspotPositions(w, h) {
  if (!camera || !currentRoom) return;
  const room = TOUR[currentRoom];
  const els = hotspotsEl.querySelectorAll(".pano-hotspot");
  const phiC = THREE.MathUtils.degToRad(90 - lat);
  const thetaC = THREE.MathUtils.degToRad(lon);
  const camDir = new THREE.Vector3(
    Math.sin(phiC) * Math.cos(thetaC),
    Math.cos(phiC),
    Math.sin(phiC) * Math.sin(thetaC)
  );
  room.hotspots.forEach((hs, i) => {
    const el = els[i];
    if (!el) return;
    const phiH = THREE.MathUtils.degToRad(90 - hs.lat);
    const thetaH = THREE.MathUtils.degToRad(hs.lon);
    const hDir = new THREE.Vector3(
      Math.sin(phiH) * Math.cos(thetaH),
      Math.cos(phiH),
      Math.sin(phiH) * Math.sin(thetaH)
    );
    const dot = camDir.dot(hDir);
    if (dot < 0.08) { el.style.opacity = "0"; el.style.pointerEvents = "none"; return; }
    const worldPos = hDir.clone().multiplyScalar(90);
    worldPos.project(camera);
    const sx = (worldPos.x * 0.5 + 0.5) * w, sy = (-worldPos.y * 0.5 + 0.5) * h;
    el.style.opacity = Math.min(1, (dot - 0.08) / 0.25).toFixed(2);
    el.style.pointerEvents = dot > 0.2 ? "auto" : "none";
    el.style.left = sx + "px";
    el.style.top = sy + "px";
  });
}

function navigateToPano(roomKey) {
  if (!TOUR[roomKey] || transitioning || roomKey === currentRoom) return;
  transitioning = true;
  canvas.style.transition = hotspotsEl.style.transition = "opacity 0.3s ease";
  canvas.style.opacity = hotspotsEl.style.opacity = "0";
  setTimeout(() => {
    loading.innerHTML = '<div id="pano-spinner"></div>Caricamento...';
    loading.classList.remove("hidden");
    new THREE.TextureLoader().load(
      TOUR[roomKey].src,
      tex => {
        tex.colorSpace = THREE.NoColorSpace;
        if (mesh) {
          const old = mesh.material.map;
          mesh.material.map = tex;
          mesh.material.needsUpdate = true;
          if (old) old.dispose();
        }
        lon = 180; lat = 0; velLon = velLat = 0;
        setRoomUI(roomKey);
        loading.classList.add("hidden");
        canvas.style.opacity = hotspotsEl.style.opacity = "1";
        transitioning = false;
      },
      undefined,
      () => { loading.innerHTML = "<span>Immagine non trovata</span>"; transitioning = false; }
    );
  }, 320);
}

function initViewer(roomKey) {
  requestAnimationFrame(() => {
    const w = box.clientWidth, h = box.clientHeight;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 200);
    const geo = new THREE.SphereGeometry(100, 64, 32);
    geo.scale(-1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    new THREE.TextureLoader().load(
      TOUR[roomKey].src,
      tex => {
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        mat.map = tex;
        mat.needsUpdate = true;
        loading.classList.add("hidden");
        setRoomUI(roomKey);
      },
      undefined,
      () => { loading.innerHTML = "<span>Immagine non trovata</span>"; }
    );

    function onDown(x, y) { dragging = true; px = x; py = y; velLon = velLat = 0; }
    function onMove(x, y) {
      if (!dragging) return;
      const dLon = (x - px) * 0.12, dLat = (py - y) * 0.12;
      lon += dLon;
      lat = Math.max(-80, Math.min(80, lat + dLat));
      velLon = dLon; velLat = dLat;
      px = x; py = y;
      hint.classList.add("hidden");
    }
    function onUp() { dragging = false; }

    canvas.addEventListener("mousedown", e => onDown(e.clientX, e.clientY));
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("mousemove", e => onMove(e.clientX, e.clientY));
    canvas.addEventListener("touchstart", e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
    canvas.addEventListener("touchmove", e => { e.preventDefault(); const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: false });
    canvas.addEventListener("touchend", onUp);

    let lastPinch = 0;
    canvas.addEventListener("touchstart", e => {
      if (e.touches.length === 2) lastPinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }, { passive: true });
    canvas.addEventListener("touchmove", e => {
      if (e.touches.length !== 2) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      camera.fov = Math.max(30, Math.min(100, camera.fov - (d - lastPinch) * 0.1));
      camera.updateProjectionMatrix();
      lastPinch = d;
    }, { passive: true });
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      camera.fov = Math.max(30, Math.min(100, camera.fov + e.deltaY * 0.04));
      camera.updateProjectionMatrix();
    }, { passive: false });

    function onResize() {
      if (!renderer || !modal.classList.contains("open")) return;
      const W = box.clientWidth, H = box.clientHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    function renderFrame() {
      frameId = requestAnimationFrame(renderFrame);
      if (!dragging) {
        lon += velLon;
        lat = Math.max(-80, Math.min(80, lat + velLat));
        velLon *= 0.88; velLat *= 0.88;
      }
      const phi = THREE.MathUtils.degToRad(90 - lat), theta = THREE.MathUtils.degToRad(lon);
      camera.lookAt(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      renderer.render(scene, camera);
      updateHotspotPositions(box.clientWidth, box.clientHeight);
    }
    renderFrame();
  });
}

function openPanoModal(sceneId) {
  if (!TOUR[sceneId]) return;
  loading.classList.remove("hidden");
  loading.innerHTML = '<div id="pano-spinner"></div>Caricamento...';
  hint.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
  if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
  if (renderer) { renderer.dispose(); renderer = null; }
  scene = camera = mesh = null;
  currentRoom = null;
  lon = 180; lat = 0; velLon = velLat = 0;
  transitioning = false;
  canvas.style.opacity = "1";
  hotspotsEl.style.opacity = "1";
  initViewer(sceneId);
}

function closePanoModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
  if (renderer) { renderer.dispose(); renderer = null; }
  scene = camera = mesh = null;
  currentRoom = null;
  canvas.style.opacity = "1";
  hotspotsEl.style.opacity = "1";
  hotspotsEl.style.transition = "";
  canvas.style.transition = "";
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closePanoModal(); });
document.getElementById("pano-modal-backdrop").addEventListener("click", closePanoModal);
document.getElementById("pano-modal-close").addEventListener("click", closePanoModal);

window.openPanoModal = openPanoModal;
window.closePanoModal = closePanoModal;

/* ══════════════════════════════════════════════════════
   SHOP 3D — Three.js modal viewer for shop products.
   Loads GLB/GLTF (or FBX) models, preloads and caches them.
   Exposes window.Shop3D = { open, close, preload }.
   ══════════════════════════════════════════════════════ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const modal = document.getElementById("shop3d-modal");
const stage = document.getElementById("shop3d-stage");
const spinner = document.getElementById("shop3d-loading");
const titleEl = document.getElementById("shop3d-title");
const priceEl = document.getElementById("shop3d-price");

let renderer = null, scene = null, camera = null, controls = null;
let currentModel = null, rafId = null, openGen = 0;

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const modelCache = new Map(); // url → Promise<THREE.Object3D>

function initRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 100);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x55503f, 1.4);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2dd, 2.2);
  key.position.set(3, 5, 2.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdde8ff, 0.8);
  fill.position.set(-4, 2, -3);
  scene.add(fill);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.4;
  controls.minDistance = 0.4;
  controls.maxDistance = 20;

  window.addEventListener("resize", resize);
}

function resize() {
  if (!renderer || !modal.classList.contains("open")) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function loadUrl(url) {
  if (modelCache.has(url)) return modelCache.get(url);
  const isFbx = /\.fbx(\?.*)?$/i.test(url);
  const p = (isFbx ? fbxLoader.loadAsync(url) : gltfLoader.loadAsync(url))
    .then(res => {
      const obj = isFbx ? res : res.scene;
      normalize(obj);
      return obj;
    });
  // Remove failed loads from the cache so a retry is possible
  p.catch(() => modelCache.delete(url));
  modelCache.set(url, p);
  return p;
}

/* Center the model and scale it to a ~2 unit box */
function normalize(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2 / maxDim;
  obj.scale.setScalar(scale);
  obj.position.sub(center.multiplyScalar(scale));
  obj.position.y += (size.y * scale) / 2 - 1; // rest roughly on origin-ish
}

async function loadFirstAvailable(product, fallbacks) {
  const urls = [product.model, ...(fallbacks || [])].filter(Boolean);
  let lastErr = null;
  for (const url of urls) {
    try { return await loadUrl(url); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("No model available");
}

function frameModel(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 1.7;
  camera.position.set(center.x + dist * 0.85, center.y + dist * 0.5, center.z + dist * 0.85);
  controls.target.copy(center);
  controls.update();
}

function loop() {
  rafId = requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
}

const Shop3D = {
  preload(product, fallbacks) {
    loadFirstAvailable(product, fallbacks).catch(() => {});
  },

  async open(product, fallbacks) {
    initRenderer();
    const gen = ++openGen;
    titleEl.textContent = product.name + " — " + product.variant;
    priceEl.textContent = "€ " + product.price.toLocaleString("it-IT", {
      minimumFractionDigits: product.price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
    modal.classList.add("open");
    spinner.classList.add("visible");
    resize();

    if (currentModel) { scene.remove(currentModel); currentModel = null; }

    try {
      const template = await loadFirstAvailable(product, fallbacks);
      if (gen !== openGen || !modal.classList.contains("open")) return;
      currentModel = template.clone(true);
      scene.add(currentModel);
      frameModel(currentModel);
      spinner.classList.remove("visible");
      if (!rafId) loop();
    } catch (e) {
      if (gen !== openGen) return;
      spinner.classList.remove("visible");
      titleEl.textContent = product.name + " — modello 3D non trovato (aggiungi " + product.model + ")";
      console.error("Shop3D:", e);
    }
  },

  close() {
    if (!modal.classList.contains("open")) return;
    openGen++;
    modal.classList.remove("open");
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (currentModel && scene) { scene.remove(currentModel); currentModel = null; }
  }
};

modal.addEventListener("click", e => {
  if (e.target === modal || e.target.dataset.close !== undefined) Shop3D.close();
});
document.getElementById("shop3d-close").addEventListener("click", () => Shop3D.close());

window.Shop3D = Shop3D;

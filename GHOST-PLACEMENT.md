# Ghost Placement — posicionar o modelo 3D sobre a cena antes de gerar com IA

## Objetivo

Hoje o drop de um produto na cena (`shopStageDrop` em `shop.js`) abre o modal e a IA
**adivinha** onde colocar o móvel. Este guia implementa o "modo fantasma":

1. Usuário arrasta o card do produto pra cena (drag & drop que já existe).
2. No drop, em vez de gerar direto, o modelo GLB aparece **sobre o vídeo**, num
   canvas Three.js transparente ("fantasma").
3. Usuário move (arrastar), escala (scroll / pinch) e gira (Q/E ou twist de 2 dedos).
4. Ao clicar **"Applica"**, captura-se um frame composto (vídeo + render 3D por cima)
   e a IA recebe a instrução de **refinar mantendo posição/escala/ângulo** —
   ela polir em vez de compor.

A iluminação do fantasma não precisa bater com a cena: o render cru é só um
"esboço posicional", a IA repinta por cima.

**Antes de começar:** trabalhe num branch pra poder retroceder fácil (ver seção
Rollback no final):

```bash
git checkout -b ghost-placement
```

---

## Arquivos tocados

| Arquivo            | Mudança |
|--------------------|---------|
| `shop-ghost.js`    | **NOVO** — módulo do modo fantasma (Three.js) |
| `shop3d.js`        | +3 linhas — expõe o loader de modelos pro novo módulo |
| `shop.js`          | `shopStageDrop` desvia pro fantasma · prompt "ancorado" em `shopAiGenerate` |
| `index.html`       | markup do overlay + `<script>` do novo módulo |
| `styles.css`       | estilos do overlay/toolbar no final do arquivo |

---

## Passo 1 — `shop3d.js`: expor o loader

O `shop3d.js` já tem `loadFirstAvailable(product, fallbacks)` com cache e fallback
pro modelo demo. Só exponha ele no objeto público (não duplique o loader).

No final de `shop3d.js`, no objeto `Shop3D`, adicione:

```js
const Shop3D = {
  preload(product, fallbacks) { ... },        // já existe
  async open(product, fallbacks) { ... },     // já existe
  close() { ... },                            // já existe

  /* NEW: returns a CLONE of the cached model for external use (ghost mode).
     Clone matters — the ghost must not mutate the cached template. */
  async getModel(product, fallbacks) {
    const template = await loadFirstAvailable(product, fallbacks);
    return template.clone(true);
  }
};
```

> Nota: `normalize()` do shop3d escala o modelo pra caber num box de ~2 unidades.
> Pro fantasma isso é ok — a escala absoluta não importa, o usuário ajusta na mão
> e a IA usa o tamanho aparente na imagem como referência.

---

## Passo 2 — `index.html`: markup do overlay

Logo **depois** do `</div>` que fecha `#stage` (antes de `#site-logo`), adicione:

```html
<!-- GHOST PLACEMENT — position the 3D model over the scene before AI generation -->
<div id="ghost-layer">
  <div id="ghost-canvas-host"></div>
  <div id="ghost-loading">Caricamento modello…</div>
  <div id="ghost-toolbar">
    <span id="ghost-hint">Trascina per spostare · rotella per scalare · Q / E per ruotare</span>
    <button id="ghost-cancel" onclick="ShopGhost.cancel()">Annulla</button>
    <button id="ghost-apply" onclick="ShopGhost.apply()">Applica ✓</button>
  </div>
</div>
```

E no bloco de scripts no final do body, **depois** do `shop3d.js`:

```html
<script type="module" src="shop-ghost.js?v=1"></script>
```

(O módulo usa o mesmo `importmap` de `three` que já existe.)

---

## Passo 3 — `shop-ghost.js` (arquivo novo)

```js
/* ══════════════════════════════════════════════════════
   GHOST PLACEMENT — transparent Three.js overlay on top of
   the scene video. The user positions/scales/rotates the GLB,
   then "Applica" captures video + render composited and hands
   the base64 back to shop.js for anchored AI generation.
   Exposes window.ShopGhost = { start, apply, cancel, active }.
   Depends on: window.Shop3D.getModel (shop3d.js) and
   captureSceneFrame() (script-fp.js).
   ══════════════════════════════════════════════════════ */

import * as THREE from "three";

const layer   = document.getElementById("ghost-layer");
const host    = document.getElementById("ghost-canvas-host");
const loading = document.getElementById("ghost-loading");

let renderer = null, scene = null, camera = null, raf = null;
let model = null, product = null, gen = 0;

/* Approximate eye-level camera. The pre-rendered scene's real camera is
   unknown — close enough, because the user fine-tunes scale/position and
   the AI repaints the result. Refinement: per-scene presets (see README). */
function initThree() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 1.6, 4.5);
  camera.lookAt(0, 0.6, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function loop() {
  raf = requestAnimationFrame(loop);
  renderer.render(scene, camera);
}

/* Screen point → point on the invisible ground plane (y = 0) */
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
function screenToGround(x, y) {
  raycaster.setFromCamera(
    { x: (x / innerWidth) * 2 - 1, y: -(y / innerHeight) * 2 + 1 },
    camera
  );
  return raycaster.ray.intersectPlane(groundPlane, hit) ? hit.clone() : null;
}

/* ── Interaction: drag / wheel / keys / touch ── */
let dragging = false;
let pinch = null; // { dist, angle, scale0, rotY0 }

function onPointerDown(e) {
  if (e.target.closest("#ghost-toolbar")) return;
  dragging = true;
  moveTo(e.clientX, e.clientY);
}
function onPointerMove(e) {
  if (dragging && e.pointerType !== "touch") moveTo(e.clientX, e.clientY);
}
function onPointerUp() { dragging = false; }

function moveTo(x, y) {
  if (!model) return;
  const p = screenToGround(x, y);
  if (p) { model.position.x = p.x; model.position.z = p.z; }
}

function onWheel(e) {
  if (!model) return;
  e.preventDefault();
  if (e.shiftKey) model.rotation.y += e.deltaY * 0.003;
  else {
    const k = e.deltaY < 0 ? 1.07 : 0.935;
    const s = THREE.MathUtils.clamp(model.scale.x * k, 0.25, 4);
    model.scale.setScalar(s);
  }
}

function onKey(e) {
  if (!model || !ShopGhost.active) return;
  if (e.key === "q" || e.key === "Q") model.rotation.y -= 0.12;
  if (e.key === "e" || e.key === "E") model.rotation.y += 0.12;
  if (e.key === "Escape") ShopGhost.cancel();
  if (e.key === "Enter") ShopGhost.apply();
}

/* Touch: 1 finger = move · 2 fingers = pinch scale + twist rotate */
function onTouchMove(e) {
  if (!model) return;
  e.preventDefault();
  if (e.touches.length === 1 && dragging) {
    moveTo(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2) {
    const [a, b] = e.touches;
    const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const angle = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
    if (!pinch) {
      pinch = { dist, angle, scale0: model.scale.x, rotY0: model.rotation.y };
      return;
    }
    const s = THREE.MathUtils.clamp(pinch.scale0 * (dist / pinch.dist), 0.25, 4);
    model.scale.setScalar(s);
    model.rotation.y = pinch.rotY0 - (angle - pinch.angle);
  }
}
function onTouchEnd(e) { if (e.touches.length < 2) pinch = null; }

function bind() {
  layer.addEventListener("pointerdown", onPointerDown);
  addEventListener("pointermove", onPointerMove);
  addEventListener("pointerup", onPointerUp);
  layer.addEventListener("wheel", onWheel, { passive: false });
  layer.addEventListener("touchmove", onTouchMove, { passive: false });
  layer.addEventListener("touchend", onTouchEnd);
  addEventListener("keydown", onKey);
  addEventListener("resize", () => renderer && resize());
}
bind();

/* ── Composite capture: scene frame + ghost render on top ── */
async function captureComposite() {
  const sceneB64 = await captureSceneFrame(); // script-fp.js — video OR seq canvas
  if (!sceneB64) return null;
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = rej;
    img.src = "data:image/jpeg;base64," + sceneB64;
  });
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  renderer.render(scene, camera); // fresh frame right before reading pixels
  ctx.drawImage(renderer.domElement, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/* ── Public API ── */
const ShopGhost = {
  active: false,

  /* fallbacks = SHOP_FALLBACK_MODELS from shop.js */
  async start(p, dropX, dropY, fallbacks) {
    const myGen = ++gen;
    product = p;
    initThree();
    resize();
    this.active = true;
    layer.classList.add("open");
    loading.classList.add("show");
    document.getElementById("ghost-apply").disabled = true;

    try {
      const m = await window.Shop3D.getModel(p, fallbacks);
      if (myGen !== gen) return; // cancelled meanwhile
      if (model) scene.remove(model);
      model = m;
      /* Rest the model on the ground plane */
      const box = new THREE.Box3().setFromObject(model);
      model.position.y -= box.min.y;
      const at = screenToGround(dropX ?? innerWidth / 2, dropY ?? innerHeight * 0.7);
      if (at) { model.position.x = at.x; model.position.z = at.z; }
      scene.add(model);
      loading.classList.remove("show");
      document.getElementById("ghost-apply").disabled = false;
      if (!raf) loop();
    } catch (err) {
      console.error(err);
      loading.textContent = "Modello non disponibile";
      setTimeout(() => this.cancel(), 1400);
    }
  },

  async apply() {
    if (!this.active || !model || !product) return;
    const b64 = await captureComposite();
    this.cancel();
    if (b64 && window.shopGhostApplied) window.shopGhostApplied(product, b64);
  },

  cancel() {
    gen++;
    this.active = false;
    layer.classList.remove("open");
    loading.classList.remove("show");
    loading.textContent = "Caricamento modello…";
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (model) { scene.remove(model); model = null; }
    product = null;
  }
};

window.ShopGhost = ShopGhost;
```

---

## Passo 4 — `shop.js`: desviar o drop e ancorar o prompt

### 4a. Estado

Em `shopState`, adicione o flag:

```js
const shopState = {
  ...
  anchored: false   // NEW: capture came from ghost placement
};
```

### 4b. Drop entra no modo fantasma

Substitua o corpo de `shopStageDrop`:

```js
async function shopStageDrop(e) {
  e.preventDefault();
  document.getElementById("stage").classList.remove("drag-over");
  document.body.classList.remove("shop-card-dragging");
  const id = e.dataTransfer.getData("text/plain");
  const p = shopProduct(id);
  if (!p) return;
  /* Floors are a material, not an object — keep the old direct flow.
     Everything else goes through ghost placement first. */
  if (p.cat !== "floor" && window.ShopGhost) {
    ShopGhost.start(p, e.clientX, e.clientY, SHOP_FALLBACK_MODELS);
    return;
  }
  shopPlaceOpen(id, e.clientX, e.clientY);
  await shopAiGenerate();
}
```

### 4c. Callback do "Applica"

Adicione (perto das funções de drag, no final da seção AI):

```js
/* Ghost placement handed us a composite frame (scene + rough 3D render).
   Use it as the capture and generate with the anchored prompt. */
window.shopGhostApplied = async function (p, compositeB64) {
  shopState.captureB64 = compositeB64;
  shopState.anchored = true;
  shopPlaceOpen(p.id);
  const thumb = document.getElementById("shop-ai-capture-thumb");
  thumb.innerHTML = `<img src="data:image/jpeg;base64,${compositeB64}" alt="cattura con modello" />`;
  document.getElementById("shop-ai-capture-btn").textContent = "✓ Ricattura";
  await shopAiGenerate();
  shopState.anchored = false;
};
```

### 4d. Prompt ancorado em `shopAiGenerate`

Dentro de `shopAiGenerate`, onde a `instruction` é montada, envolva com o flag:

```js
let instruction;
if (shopState.anchored) {
  instruction =
    `Edit the FIRST image, a photorealistic architectural scene. ` +
    `The product — ${p.name} (${p.variant}), approx. size ${p.size}${refImg} — ` +
    `is ALREADY placed in the FIRST image as a rough, unlit 3D render. ` +
    `Refine it photorealistically: fix lighting, shadows, reflections, materials ` +
    `and ground contact so it blends into the scene. ` +
    `KEEP its position, scale, rotation and the camera EXACTLY as shown. ` +
    `Do not move, resize, duplicate or remove it. ${p.desc} ` +
    (userPrompt ? `User instruction: ${userPrompt}. ` : "") +
    `Return ONLY the edited image.`;
} else {
  instruction = /* ...bloco existente inalterado... */;
}
```

> Importante: **não** mexa no auto-capture do início de `shopAiGenerate` — como
> `shopState.captureB64` já vem preenchido com o composto, o `if (!scene ||
> scene.length < 500)` não dispara e nada é recapturado.

### 4e. Escape

No handler de `keydown` do final do arquivo, o Escape do fantasma já é tratado
dentro do próprio `shop-ghost.js` — nada a fazer.

---

## Passo 5 — `styles.css`: overlay e toolbar

Adicione no final:

```css
/* ── Ghost placement overlay ── */
#ghost-layer {
  position: fixed; inset: 0;
  z-index: 150; /* above stage/POIs, below shop panel (check your z-indexes) */
  display: none;
  touch-action: none;
}
#ghost-layer.open { display: block; }
#ghost-canvas-host, #ghost-canvas-host canvas {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
}
#ghost-loading {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(20, 19, 15, 0.85);
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  letter-spacing: 0.08em;
  display: none;
}
#ghost-loading.show { display: block; }
#ghost-toolbar {
  position: absolute;
  bottom: 26px; left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(250, 248, 244, 0.95);
  border: 1px solid rgba(20, 19, 15, 0.12);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  font-family: 'DM Sans', sans-serif;
}
#ghost-hint {
  font-size: 11px;
  color: rgba(20, 19, 15, 0.55);
  letter-spacing: 0.03em;
}
#ghost-cancel, #ghost-apply {
  padding: 9px 16px;
  border-radius: 999px;
  border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}
#ghost-cancel {
  background: rgba(20, 19, 15, 0.06);
  border: 1px solid rgba(20, 19, 15, 0.2);
  color: rgba(20, 19, 15, 0.75);
}
#ghost-apply { background: var(--warm); color: #14130f; }
#ghost-apply:disabled { opacity: 0.45; cursor: default; }
@media (max-width: 600px) {
  #ghost-hint { display: none; }
  #ghost-toolbar { bottom: 18px; }
}
```

> Cheque o `z-index`: precisa ficar **acima** de `#stage`/POIs/`#track` e
> **abaixo** dos modais (206/207). Ajuste o `150` conforme os valores do projeto.

---

## Teste (checklist)

1. Servidor local (não `file://` — módulos ES). Abrir, "Entra".
2. Abrir shop, arrastar um sofá pra cena → overlay abre, "Caricamento modello…",
   modelo aparece no ponto do drop.
3. Arrastar move no plano do chão; scroll escala; Shift+scroll ou Q/E gira;
   Escape cancela; Enter aplica.
4. Mobile: 1 dedo move, pinch escala, twist de 2 dedos gira.
5. "Applica" → modal abre com a thumb já mostrando cena + modelo → geração roda
   com o prompt ancorado → resultado mantém o móvel onde você colocou.
6. Drop de um pavimento (`floor`) → fluxo antigo direto, sem fantasma.
7. Cancelar no meio do loading → overlay fecha sem erro no console.

## Limitações conhecidas

- **Perspectiva aproximada:** a câmera do fantasma (1.6 m, FOV 55) não é a câmera
  real da cena pré-renderizada. Perto o bastante — o usuário compensa na escala e
  a IA corrige o resto. Refinamento futuro: presets por cena no `CONFIG`
  (ex.: `ghostCam: { y, fov, pitch }` em cada entrada de `scenes`).
- **Modelo demo:** sem os GLBs reais na pasta, o fantasma mostra a cadeira demo
  (SheenChair) — a IA receberá a cadeira como referência posicional, mas a foto
  do produto (2ª imagem) continua guiando a aparência.
- **Mobile + drag & drop:** o drag do card usa a HTML5 Drag API, que não existe
  em touch. No mobile, o caminho de entrada é outro (ex.: adicionar um botão
  "Posiziona" no card que chama `ShopGhost.start(p, cx, cy, SHOP_FALLBACK_MODELS)`
  com o centro da tela). Decidir depois do desktop funcionar.

## Rollback

Se não gostar do resultado:

```bash
# se seguiu o branch:
git checkout main            # (ou master) — tudo some, branch fica de arquivo
git branch -D ghost-placement

# se editou direto na main sem commitar:
git checkout -- shop.js shop3d.js index.html styles.css
rm shop-ghost.js
```

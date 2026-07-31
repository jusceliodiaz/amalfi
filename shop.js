/* ══════════════════════════════════════════════════════
   SHOP — IKEA Italia furniture shop
   Tabs (Sofas / Chairs) → product cards → 3D viewer
   → cart + order summary → AI "place in my scene".
   Depends on: script-fp.js (aiKey, captureSceneFrame)
   and shop3d.js (window.Shop3D — Three.js modal viewer).
   ══════════════════════════════════════════════════════ */

const SHOP_PRODUCTS = [
  {
    id: "daybed-baldacchino",
    cat: "sofas",
    name: "DAYBED A BALDACCHINO",
    variant: "Daybed da esterno su misura, baldacchino e ruote, tessuto a righe marrone",
    size: "200×160×220 cm",
    price: 3200,
    store: "Custom",
    img: "images/custom.jpeg",
    model: "glb/custom.glb",
    desc: "Custom-made outdoor canopy daybed on wheels, dark wood frame, striped upholstery with brown leather-trimmed canopy and matching cushions."
  },
  {
    id: "bondholmen",
    cat: "sofas",
    name: "BONDHOLMEN",
    variant: "Divano da esterno a 2 posti, bianco/beige",
    size: "139×81×73 cm",
    price: 189,
    img: "https://www.ikea.com/it/it/images/products/bondholmen-divano-a-2-posti-da-esterno-bianco-beige__1333145_pe946396_s5.jpg",
    url: "https://www.ikea.com/it/it/p/bondholmen-divano-a-2-posti-da-esterno-bianco-beige-50558185/",
    model: "assets/models/bondholmen.glb",
    desc: "Solid-acacia 2-seat outdoor sofa with a weather-resistant acrylic-lacquer finish and wide, supportive armrests."
  },
  {
    id: "lacko",
    cat: "sofas",
    name: "LÄCKÖ",
    variant: "Divano da esterno a 2 posti, grigio",
    size: "115×56×87 cm",
    price: 119,
    img: "https://www.ikea.com/it/it/images/products/laeckoe-divano-a-2-posti-da-esterno-grigio__1138955_pe880166_s5.jpg",
    url: "https://www.ikea.com/it/it/p/laeckoe-divano-a-2-posti-da-esterno-grigio-50522733/",
    model: "assets/models/lacko.glb",
    desc: "Romantic-style, powder-coated steel outdoor bench sofa for patios — low-maintenance and weather-resistant."
  },
  {
    id: "tallskar",
    cat: "chairs",
    name: "TALLSKÄR",
    variant: "Poltrona da giardino, antracite",
    size: "83×82×106 cm",
    price: 119,
    img: "https://www.ikea.com/it/it/images/products/tallskaer-poltrona-da-giardino-antracite__1385516_pe963345_s5.jpg",
    url: "https://www.ikea.com/it/it/p/tallskaer-poltrona-da-giardino-antracite-60575146/",
    model: "assets/models/tallskar.glb",
    desc: "Hand-woven, rattan-look outdoor armchair on a powder-coated steel frame, built for durable outdoor comfort."
  },
  {
    id: "skarpo",
    cat: "chairs",
    name: "SKARPÖ",
    variant: "Poltrona da giardino, bianca",
    size: "81×79×71 cm",
    price: 39.95,
    img: "https://www.ikea.com/it/it/images/products/skarpoe-poltrona-da-giardino-bianco__0729491_pe737010_s5.jpg",
    url: "https://www.ikea.com/it/it/p/skarpoe-poltrona-da-giardino-bianco-50575811/",
    model: "assets/models/skarpo.glb",
    desc: "Stackable, UV-stabilized polypropylene outdoor armchair with a drainage hole for rain."
  },
  {
    id: "nammaro",
    cat: "chairs",
    name: "NÄMMARÖ",
    variant: "Sedia relax da giardino, marrone chiaro/grigio-beige chiaro",
    size: "60×71×107 cm",
    price: 78.95,
    img: "https://www.ikea.com/it/it/images/products/naemmaroe-sedia-relax-da-giardino-mordente-marrone-chiaro-kuddarna-grigio-beige-chiaro__1437400_pe984434_s5.jpg",
    url: "https://www.ikea.com/it/it/p/naemmaroe-sedia-relax-da-giardino-mordente-marrone-chiaro-kuddarna-grigio-beige-chiaro-s09607711/",
    model: "assets/models/nammaro.glb",
    desc: "Foldable solid acacia reclining garden chair with an included recycled-polyester cushion."
  },

  /* ── Plants — IKEA Italia ── */
  {
    id: "fejka-ulivo",
    cat: "plants",
    name: "FEJKA",
    variant: "Pianta artificiale in vaso, da interno/esterno, ulivo",
    size: "vaso 19 cm · alt. 150 cm",
    price: 49.95,
    img: "https://www.ikea.com/it/it/images/products/fejka-pianta-artificiale-in-vaso-da-interno-esterno-ulivo-verde__1485471_pe1001980_s5.jpg",
    url: "https://www.ikea.com/it/it/p/fejka-pianta-artificiale-in-vaso-da-interno-esterno-ulivo-verde-40617699/",
    model: "assets/models/fejka-ulivo.glb",
    desc: "Realistic artificial olive tree in a pot, for indoor or outdoor Mediterranean-style terrace styling."
  },
  {
    id: "fejka-lavanda",
    cat: "plants",
    name: "FEJKA",
    variant: "Pianta artificiale in vaso, da interno/esterno, lavanda lilla",
    size: "vaso 12 cm · alt. 48 cm",
    price: 9.95,
    img: "https://www.ikea.com/it/it/images/products/fejka-pianta-artificiale-in-vaso-da-interno-esterno-lavanda-lilla__1485462_pe1001977_s5.jpg",
    url: "https://www.ikea.com/it/it/p/fejka-pianta-artificiale-in-vaso-da-interno-esterno-lavanda-lilla-70617693/",
    model: "assets/models/fejka-lavanda.glb",
    desc: "Faux lavender in a pot, low-maintenance and weather-proof, for a Mediterranean terrace look."
  },
  {
    id: "fejka-succulenta",
    cat: "plants",
    name: "FEJKA",
    variant: "Piante artificiali in vaso, da interno/esterno, succulenta (set da 3)",
    size: "vaso 6 cm · alt. 12 cm",
    price: 2.95,
    unit: "set da 3",
    img: "https://www.ikea.com/it/it/images/products/fejka-pianta-artificiale-in-vaso-da-interno-esterno-succulenta__0614187_pe686812_s5.jpg",
    url: "https://www.ikea.com/it/it/p/fejka-pianta-artificiale-in-vaso-da-interno-esterno-succulenta-50519764/",
    model: "assets/models/fejka-succulenta.glb",
    desc: "A set of three realistic artificial succulents in small pots, needing no water or sunlight."
  },

  /* ── Outdoor floor tiles — IKEA Italia ── */
  {
    id: "runnen-acacia",
    cat: "floor",
    name: "RUNNEN",
    variant: "Pavimentazione da esterno, acacia",
    size: "30×30×2 cm · 0,81 m² (9 piastrelle)",
    price: 25,
    unit: "confezione",
    img: "https://www.ikea.com/it/it/images/products/runnen-pedana-pavimentazione-da-esterno-acacia__1151157_pe884806_s5.jpg",
    url: "https://www.ikea.com/it/it/p/runnen-pedana-pavimentazione-da-esterno-acacia-60518486/",
    model: "assets/models/runnen-acacia.glb",
    desc: "Interlocking solid-acacia outdoor deck tiles, easy to click together for terraces and pool surrounds."
  },
  {
    id: "runnen-tessuto",
    cat: "floor",
    name: "RUNNEN",
    variant: "Pavimentazione da esterno, tessuto grigio scuro",
    size: "30×30 cm · 0,81 m² (9 piastrelle)",
    price: 35,
    unit: "confezione",
    img: "https://www.ikea.com/it/it/images/products/runnen-pedana-pavimentazione-da-esterno-tessuto-grigio-scuro__1275188_pe930555_s5.jpg",
    url: "https://www.ikea.com/it/it/p/runnen-pedana-pavimentazione-da-esterno-tessuto-grigio-scuro-40557799/",
    model: "assets/models/runnen-tessuto.glb",
    desc: "Composite outdoor deck tiles with a soft recycled-polyester fabric top, comfortable underfoot by the pool."
  },
  {
    id: "runnen-grigio",
    cat: "floor",
    name: "RUNNEN",
    variant: "Pavimentazione da esterno, grigio scuro",
    size: "30×30×2 cm · 0,81 m² (9 piastrelle)",
    price: 19.95,
    unit: "confezione",
    img: "https://www.ikea.com/it/it/images/products/runnen-pedana-pavimentazione-da-esterno-grigio-scuro__0237434_pe376790_s5.jpg",
    url: "https://www.ikea.com/it/it/p/runnen-pedana-pavimentazione-da-esterno-grigio-scuro-90238111/",
    model: "assets/models/runnen-grigio.glb",
    desc: "Interlocking recycled-polypropylene deck tiles in dark grey, weatherproof for patios and terraces."
  }
];

/* Public sample models used until real GLB/FBX files are dropped
   into assets/models/ — first URL that loads wins. */
const SHOP_FALLBACK_MODELS = [
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb",
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb"
];

const shopState = {
  open: false,
  tab: "sofas",
  cart: new Set(JSON.parse(localStorage.getItem("archviz-shop-cart") || "[]")),
  preloaded: false,
  captureB64: null,
  resultB64: null,
  confirmed: false,
  placeId: null,
  videoUrl: null
};

function shopProduct(id) { return SHOP_PRODUCTS.find(p => p.id === id); }
function shopCartItems() { return SHOP_PRODUCTS.filter(p => shopState.cart.has(p.id)); }
function shopTotal() { return shopCartItems().reduce((s, p) => s + p.price, 0); }
function shopFmt(n) {
  const dec = n % 1 === 0 ? 0 : 2;
  return "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: 2 });
}
function shopSaveCart() {
  localStorage.setItem("archviz-shop-cart", JSON.stringify([...shopState.cart]));
}

/* ── Panel open / close ── */
function shopToggle() {
  shopState.open = !shopState.open;
  document.getElementById("shop-panel").classList.toggle("open", shopState.open);
  document.getElementById("shop-btn").classList.toggle("active", shopState.open);
  if (shopState.open) {
    shopRenderGrid();
    shopPreloadModels();
  }
}

function shopSwitchTab(cat) {
  shopState.tab = cat;
  document.querySelectorAll(".shop-tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === cat));
  shopRenderGrid();
}

/* ── Cards ── */
function shopRenderGrid() {
  const grid = document.getElementById("shop-grid");
  const items = SHOP_PRODUCTS.filter(p => p.cat === shopState.tab);
  grid.innerHTML = items.map(p => {
    const inCart = shopState.cart.has(p.id);
    return `
    <div class="shop-card${inCart ? " selected" : ""}" data-id="${p.id}" data-cat="${p.cat}" onclick="shopToggleItem('${p.id}')">
      <div
        class="shop-card-imgwrap"
        draggable="true"
        title="Trascina nella scena per visualizzarlo con l'IA"
        ondragstart="shopDragStart(event,'${p.id}')"
        ondragend="shopDragEnd(event)"
      >
        <img src="${p.img}" alt="${p.name} — ${p.variant}" loading="lazy" />
        <button class="shop-ai-btn" title="Posiziona nella tua scena con l'IA" onclick="event.stopPropagation();shopPlaceOpen('${p.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4z"/>
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>
          </svg>
          <span>AI</span>
        </button>
        ${p.cat === "floor" ? "" : `
        <button class="shop-3d-btn" title="Visualizza in 3D" onclick="event.stopPropagation();shop3dOpen('${p.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z"/>
            <path d="M12 22V12M12 12L3.5 7M12 12l8.5-5"/>
          </svg>
          <span>3D</span>
        </button>`}
        ${inCart ? '<div class="shop-card-check">✓</div>' : ""}
      </div>
      <div class="shop-card-body">
        <div class="shop-card-name">${p.name}</div>
        <div class="shop-card-variant">${p.variant}</div>
        <div class="shop-card-size">${p.size}</div>
        <div class="shop-card-quick-actions">
          <button class="shop-quick-ai-btn" title="Posiziona nella tua scena con l'IA" onclick="event.stopPropagation();shopPlaceOpen('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4z"/>
              <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>
            </svg>
            <span>AI</span>
          </button>
          ${p.cat === "floor" ? "" : `
          <button class="shop-quick-3d-btn" title="Visualizza in 3D" onclick="event.stopPropagation();shop3dOpen('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z"/>
              <path d="M12 22V12M12 12L3.5 7M12 12l8.5-5"/>
            </svg>
            <span>3D</span>
          </button>`}
        </div>
        <div class="shop-card-footer">
          <div class="shop-card-price">${shopFmt(p.price)}${p.unit ? `<span class="shop-price-unit"> /${p.unit}</span>` : ""}</div>
          <div class="shop-card-actions">
            ${p.store === "Custom"
              ? `<span class="shop-buy-link shop-buy-link--static" title="Pezzo su misura, non disponibile per l'acquisto diretto">Su misura</span>`
              : `<a class="shop-buy-link" href="${p.url}" target="_blank" rel="noopener" title="Acquista su ${p.store || 'IKEA Italia'}" onclick="event.stopPropagation()">
              ${p.store === "Leroy Merlin" ? "LEROY" : "IKEA"} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
            </a>`}
            <button class="shop-add-btn${inCart ? " added" : ""}" onclick="event.stopPropagation();shopToggleItem('${p.id}')">
              ${inCart ? "Aggiunto ✓" : "Aggiungi"}
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join("");
}

function shopToggleItem(id) {
  if (shopState.cart.has(id)) shopState.cart.delete(id);
  else shopState.cart.add(id);
  shopState.confirmed = false;
  shopSaveCart();
  shopRenderGrid();
  shopUpdateTotals();
  const orderOpen = document.getElementById("shop-order-modal").classList.contains("open");
  if (orderOpen) shopRenderOrder();
}

/* ── Always-visible total pill + badge ── */
function shopUpdateTotals() {
  const total = shopTotal();
  const count = shopState.cart.size;
  const pill = document.getElementById("shop-total-pill");
  pill.classList.toggle("show", count > 0);
  pill.innerHTML = `<span class="shop-pill-lbl">Totale</span><span class="shop-pill-val">${shopFmt(total)}</span>`;
  pill.onclick = shopOpenOrder;
  const badge = document.getElementById("shop-btn-badge");
  badge.textContent = count;
  badge.classList.toggle("show", count > 0);
  const foot = document.getElementById("shop-panel-total");
  if (foot) foot.textContent = shopFmt(total);
  const orderBtn = document.getElementById("shop-order-btn");
  if (orderBtn) orderBtn.disabled = count === 0;
}

/* ── 3D viewer ── */
function shop3dOpen(id) {
  const p = shopProduct(id);
  if (!p || !window.Shop3D) return;
  window.Shop3D.open(p, SHOP_FALLBACK_MODELS);
}
function shopPreloadModels() {
  if (shopState.preloaded || !window.Shop3D) return;
  shopState.preloaded = true;
  const run = () => SHOP_PRODUCTS.forEach(p => window.Shop3D.preload(p, SHOP_FALLBACK_MODELS));
  window.requestIdleCallback ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 800);
}

/* ── Order summary modal ── */
function shopOpenOrder() {
  shopRenderOrder();
  document.getElementById("shop-order-modal").classList.add("open");
}
function shopCloseOrder() {
  document.getElementById("shop-order-modal").classList.remove("open");
}

function shopRenderOrder() {
  const listEl = document.getElementById("shop-order-list");
  const cats = [["sofas", "Divani"], ["chairs", "Sedie"], ["plants", "Piante"], ["floor", "Pavimenti"]];
  let html = "";
  cats.forEach(([cat, label]) => {
    const items = shopCartItems().filter(p => p.cat === cat);
    if (!items.length) return;
    const sub = items.reduce((s, p) => s + p.price, 0);
    html += `<div class="shop-order-cat"><span>${label}</span><span>${shopFmt(sub)}</span></div>`;
    items.forEach(p => {
      html += `
      <div class="shop-order-line">
        <img src="${p.img}" alt="" />
        <div class="shop-order-line-info">
          <div class="shop-order-line-name">${p.name}</div>
          <div class="shop-order-line-variant">${p.variant} · ${p.size}</div>
        </div>
        <div class="shop-order-line-price">${shopFmt(p.price)}${p.unit ? `<span class="shop-price-unit"> /${p.unit}</span>` : ""}</div>
        <button class="shop-order-remove" title="Rimuovi" onclick="shopToggleItem('${p.id}')">
          <svg viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
        </button>
      </div>`;
    });
  });
  if (!html) html = `<div class="shop-order-empty">Ancora nessun mobile selezionato — aggiungi articoli dal negozio.</div>`;
  listEl.innerHTML = html;
  document.getElementById("shop-order-total").textContent = shopFmt(shopTotal());

  const confirmBtn = document.getElementById("shop-confirm-btn");
  confirmBtn.textContent = shopState.confirmed ? "✓ Ordine confermato" : "Conferma ordine";
  confirmBtn.classList.toggle("confirmed", shopState.confirmed);
  confirmBtn.disabled = shopState.cart.size === 0;
}

function shopConfirmOrder() {
  if (!shopState.cart.size) return;
  shopState.confirmed = true;
  shopRenderOrder();
}

/* ── AI: place a product in the current scene (per-item modal) ── */
function shopAiStatus(msg) { document.getElementById("shop-ai-status").textContent = msg; }

/* Per-category copy for the "Visualize in your scene" modal — furniture
   and plants get "place" language, floor gets "apply material" language. */
const SHOP_AI_ACTION_LABELS = {
  plants: { button: "Posiziona la pianta nella scena", status: "Posizionamento della pianta nella scena..." },
  floor: { button: "Sostituisci il pavimento nella scena", status: "Sostituzione del pavimento nella scena..." }
};
const SHOP_AI_ACTION_DEFAULT = { button: "Posiziona il mobile nella scena", status: "Posizionamento del mobile nella scena..." };
function shopAiActionLabels(cat) {
  return SHOP_AI_ACTION_LABELS[cat] || SHOP_AI_ACTION_DEFAULT;
}

function shopPlaceOpen(id, originX, originY) {
  const p = shopProduct(id);
  if (!p) return;
  const modal = document.getElementById("shop-place-modal");
  modal.style.setProperty("--drop-x", (originX != null ? originX : window.innerWidth / 2) + "px");
  modal.style.setProperty("--drop-y", (originY != null ? originY : window.innerHeight / 2) + "px");
  document.getElementById("shop-ai-generate-btn").textContent = shopAiActionLabels(p.cat).button;
  if (shopState.placeId !== id) {
    /* New product — clear the previous results */
    shopState.resultB64 = null;
    document.getElementById("shop-ai-result").classList.remove("visible");
    document.getElementById("shop-ai-dl-btn").classList.remove("visible");
    shopAiStatus("");
    shopAiCloseVideo();
    shopAiVideoStatus("");
    const prompt = document.getElementById("shop-ai-prompt");
    const ph = {
      sofas: `es. sostituisci il divano esistente con questo ${p.name}, lascia tutto il resto uguale...`,
      chairs: `es. aggiungi questo ${p.name} alla terrazza, vicino ai posti a sedere esistenti...`,
      plants: `es. posiziona questo ${p.name} nell'angolo della terrazza...`,
      floor: `es. sostituisci la pavimentazione della terrazza con questo ${p.name}...`
    };
    prompt.placeholder = ph[p.cat] || ph.sofas;
  }
  shopState.placeId = id;
  document.getElementById("shop-place-img").src = p.img;
  document.getElementById("shop-place-name").textContent = p.name;
  document.getElementById("shop-place-variant").textContent = p.variant;
  document.getElementById("shop-place-price").textContent = shopFmt(p.price);
  modal.classList.add("open");
}
function shopPlaceClose() {
  document.getElementById("shop-place-modal").classList.remove("open");
  document.getElementById("shop-ai-video").pause();
}

async function shopOrderCapture() {
  const btn = document.getElementById("shop-ai-capture-btn");
  const thumb = document.getElementById("shop-ai-capture-thumb");
  btn.disabled = true;
  btn.textContent = "⏳ Cattura in corso...";
  /* captureSceneFrame reads the video/canvas directly — UI overlays are never captured */
  const b64 = await captureSceneFrame();
  btn.disabled = false;
  if (!b64) {
    btn.textContent = "📷 Cattura scena";
    thumb.innerHTML = '<span style="color:rgba(255,80,80,0.7)">Non riuscito — riprova</span>';
    return;
  }
  shopState.captureB64 = b64;
  btn.textContent = "✓ Ricattura";
  thumb.innerHTML = `<img src="data:image/jpeg;base64,${b64}" alt="cattura scena" />`;
}

const shopImgB64Cache = new Map();
async function shopProductImageB64(p) {
  if (shopImgB64Cache.has(p.id)) return shopImgB64Cache.get(p.id);
  try {
    const resp = await fetch(p.img);
    if (!resp.ok) throw new Error(String(resp.status));
    const blob = await resp.blob();
    const b64 = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1]);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    const out = { b64, mime: blob.type || "image/jpeg" };
    shopImgB64Cache.set(p.id, out);
    return out;
  } catch (e) {
    shopImgB64Cache.set(p.id, null);
    return null;
  }
}

async function shopAiGenerate() {
  const key = aiKey();
  if (!key) return shopAiStatus("Nessuna API Key — apri il pannello IA e incolla prima la tua chiave.");
  const p = shopProduct(shopState.placeId);
  if (!p) return shopAiStatus("Apri prima la simulazione IA da una scheda prodotto.");

  let scene = shopState.captureB64;
  if (!scene || scene.length < 500) {
    await shopOrderCapture();
    scene = shopState.captureB64;
  }
  if (!scene || scene.length < 500) return shopAiStatus("Impossibile catturare la scena.");

  const btn = document.getElementById("shop-ai-generate-btn");
  btn.disabled = true;
  shopAiStatus(shopAiActionLabels(p.cat).status);

  try {
    const prodImg = await shopProductImageB64(p);
    const userPrompt = document.getElementById("shop-ai-prompt").value.trim();
    const refImg = prodImg ? " shown in the SECOND image" : "";
    let action;
    if (p.cat === "plants") {
      action = `Insert the plant${refImg} — ${p.name} (${p.variant}), approx. size ${p.size}. ${p.desc} ` +
        `Place the potted plant naturally in the scene with correct perspective, scale, ground contact, shadows and lighting.`;
    } else if (p.cat === "floor") {
      action = `Replace the floor of the scene with the outdoor decking${refImg} — ${p.name} (${p.variant}), tile size ${p.size}. ${p.desc} ` +
        `Follow the floor plane's perspective with a realistic tile layout, texture scale, reflections and lighting.`;
    } else {
      action = `Insert the furniture product${refImg} — ${p.name} (${p.variant}), approx. size ${p.size}. ${p.desc} ` +
        `Place it naturally in the scene with correct perspective, scale, lighting, shadows and reflections.`;
    }
    const instruction =
      `Edit the FIRST image, a photorealistic architectural interior scene. ${action} ` +
      (userPrompt ? `User instruction: ${userPrompt}. ` : "") +
      `Keep the exact same camera angle, framing and photorealistic style of the original scene. ` +
      `Return ONLY the edited image.`;

    const parts = [{ text: instruction }, { inlineData: { mimeType: "image/jpeg", data: scene } }];
    if (prodImg) parts.push({ inlineData: { mimeType: prodImg.mime, data: prodImg.b64 } });

    const models = ["gemini-3.1-flash-image", "gemini-3-pro-image"];
    const errs = [];
    let imgB64 = null;
    for (const model of models) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "16:9" } }
            })
          });
        const d = await resp.json();
        if (!resp.ok) { errs.push(`[${model}] ${d?.error?.message || resp.status}`); continue; }
        const found = (d?.candidates?.[0]?.content?.parts || []).find(pt => pt.inlineData?.data);
        if (found) { imgB64 = found.inlineData.data; break; }
        errs.push(`[${model}] response had no image`);
      } catch (err) { errs.push(`[${model}] ${err.message}`); }
    }
    if (!imgB64) throw new Error(errs.join("\n") || "Nessuna immagine restituita.");

    shopState.resultB64 = imgB64;
    document.getElementById("shop-ai-result-img").src = "data:image/png;base64," + imgB64;
    document.getElementById("shop-ai-result").classList.add("visible");
    document.getElementById("shop-ai-dl-btn").classList.add("visible");
    galleryAdd(imgB64, "image/png", p.name);
    shopAiStatus("Fatto! " + p.name + " posizionato nella tua scena.");
  } catch (e) {
    console.error(e);
    shopAiStatus("Errore: " + e.message);
  }
  btn.disabled = false;
}

function shopAiDownload() {
  if (!shopState.resultB64) return;
  const a = document.createElement("a");
  a.href = "data:image/png;base64," + shopState.resultB64;
  a.download = "scene-with-furniture.png";
  a.click();
}

function shopAiOpenResult() {
  const src = document.getElementById("shop-ai-result-img").src;
  if (!src) return;
  const v = document.getElementById("ai-lightbox-video");
  v.pause();
  v.classList.remove("open");
  const img = document.getElementById("ai-lightbox-img");
  img.src = src;
  img.classList.add("open");
  document.getElementById("ai-lightbox").classList.add("open");
}

/* ── AI video: animate the scene with the placed furniture (Veo) ── */
function shopAiVideoStatus(msg) { document.getElementById("shop-ai-video-status").textContent = msg; }

function shopAiCloseVideo() {
  const vid = document.getElementById("shop-ai-video");
  vid.pause();
  vid.removeAttribute("src");
  vid.load();
  if (shopState.videoUrl) { URL.revokeObjectURL(shopState.videoUrl); shopState.videoUrl = null; }
  document.getElementById("shop-ai-video-result").classList.remove("visible");
  document.getElementById("shop-ai-video-dl-btn").classList.remove("visible");
}

async function shopAiGenerateVideo() {
  const key = aiKey();
  if (!key) return shopAiVideoStatus("Nessuna API Key — apri il pannello IA e incolla prima la tua chiave.");
  const p = shopProduct(shopState.placeId);
  if (!p) return shopAiVideoStatus("Apri prima la simulazione IA da una scheda prodotto.");

  /* Best source: the generated image with the furniture placed.
     Fallback: the raw scene capture. */
  /* The video ALWAYS animates the generated image with the product applied */
  const frameB64 = shopState.resultB64, frameMime = "image/png";
  if (!frameB64) return shopAiVideoStatus(`Genera prima l'immagine con "${shopAiActionLabels(p.cat).button}" — il video anima esattamente quell'immagine.`);

  const userPrompt = document.getElementById("shop-ai-prompt").value.trim();
  const prompt =
    `Cinematic slow camera push-in through this photorealistic architectural interior scene ` +
    `featuring the ${p.name} (${p.variant}). ` +
    (userPrompt ? userPrompt + ". " : "") +
    `Subtle ambient motion, soft natural light shifting, no people, keep the furniture and ` +
    `the scene exactly as shown, high-end real estate film style.`;

  const btn = document.getElementById("shop-ai-video-btn");
  btn.disabled = true;
  shopAiCloseVideo();
  shopAiVideoStatus("Avvio generazione video...");

  try {
    const instance = { prompt, image: { bytesBase64Encoded: frameB64, mimeType: frameMime } };
    const veoModels = ["veo-3.1-generate-preview", "veo-3.0-generate-preview", "veo-3.0-fast-generate-preview", "veo-2.0-generate-001"];
    const errs = [];
    let op = null;
    outer:
    for (const model of veoModels)
      for (const ver of ["v1beta", "v1"]) {
        try { op = await aiStartVeoOperation(key, ver, model, instance, "16:9"); break outer; }
        catch (err) { errs.push(`[${ver}/${model}] ${err.message}`); }
      }
    if (!op) throw new Error("Nessun modello Veo disponibile per questa chiave.\n" + errs.join("\n"));

    shopAiVideoStatus("Creazione video (può richiedere da 1 a 3 minuti)...");
    const result = await aiPollVeoOperation(key, op.ver, op.name);
    const d = extractVideoResult(result);
    if (!d) {
      const reason = result?.response?.raiMediaFilteredReasons?.[0] ||
        result?.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0];
      throw new Error(reason ? "Bloccato dal filtro di sicurezza: " + reason : "La risposta non contiene un video.");
    }

    let blob;
    if (d.uri) {
      const resp = await fetch(d.uri, { headers: { "x-goog-api-key": key } });
      if (!resp.ok) throw new Error("Impossibile scaricare il video generato.");
      blob = await resp.blob();
    } else {
      const bin = atob(d.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type: d.mime || "video/mp4" });
    }

    shopState.videoUrl = URL.createObjectURL(blob);
    document.getElementById("shop-ai-video").src = shopState.videoUrl;
    document.getElementById("shop-ai-video-result").classList.add("visible");
    document.getElementById("shop-ai-video-dl-btn").classList.add("visible");
    shopAiVideoStatus("Fatto! Video con " + p.name + " pronto.");
    galleryAddVideoBlob(blob, p.name + " video");
  } catch (e) {
    console.error(e);
    shopAiVideoStatus("Errore: " + e.message);
  }
  btn.disabled = false;
}

function shopAiDownloadVideo() {
  if (!shopState.videoUrl) return;
  const a = document.createElement("a");
  a.href = shopState.videoUrl;
  a.download = "scene-with-furniture.mp4";
  a.click();
}

/* ── Drag a product card onto the scene: drop = auto place + auto generate.
   shopAiGenerate() already captures the scene itself if none was taken yet,
   so this is just "open the modal at the drop point, then generate". ── */
function shopDragStart(e, id) {
  const p = shopProduct(id);
  if (!p) return;
  e.dataTransfer.setData("text/plain", id);
  e.dataTransfer.effectAllowed = "copy";
  const img = e.currentTarget.querySelector("img");
  if (img) e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
  e.currentTarget.closest(".shop-card")?.classList.add("dragging");
  document.body.classList.add("shop-card-dragging");
}
function shopDragEnd(e) {
  e.currentTarget.closest(".shop-card")?.classList.remove("dragging");
  document.body.classList.remove("shop-card-dragging");
  document.getElementById("stage").classList.remove("drag-over");
}
function shopStageDragOver(e) {
  if (!document.body.classList.contains("shop-card-dragging")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  document.getElementById("stage").classList.add("drag-over");
}
function shopStageDragLeave(e) {
  if (e.target === e.currentTarget) document.getElementById("stage").classList.remove("drag-over");
}
async function shopStageDrop(e) {
  e.preventDefault();
  document.getElementById("stage").classList.remove("drag-over");
  document.body.classList.remove("shop-card-dragging");
  const id = e.dataTransfer.getData("text/plain");
  if (!id || !shopProduct(id)) return;
  shopPlaceOpen(id, e.clientX, e.clientY);
  await shopAiGenerate();
}

/* ── Init ── */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (window.Shop3D) window.Shop3D.close();
  shopPlaceClose();
  shopCloseOrder();
});
shopUpdateTotals();

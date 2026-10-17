# AI Studio com Gemini + Veo: guia de implementação

Este guia mostra como capturar a tela, gerar imagem (Gemini) e gerar vídeo (Veo) a partir de um prompt e/ou da captura.

- Tudo roda no navegador, em JS puro, sem SDK e sem build: só `fetch` na API REST do Google (`https://generativelanguage.googleapis.com`).
- O código foi extraído e reescrito de forma legível a partir do `script-fp.js` do projeto ArchViz Explorer (Amalfi).

---

## 1. Visão geral do fluxo

```
┌──────────────┐   base64 JPEG   ┌────────────────────────────┐
│ <video> ou   │ ──────────────► │ 2a. Gemini (texto)         │  opcional: descreve a cena
│ <canvas>     │  captureFrame() │     → prompt descritivo    │
└──────────────┘                 └─────────────┬──────────────┘
        │                                      ▼
        │                        ┌────────────────────────────┐
        └──────────────────────► │ 2b. Gemini (imagem)        │ → PNG base64
                                 │     :generateContent       │
                                 └─────────────┬──────────────┘
                                               ▼ (frame inicial opcional)
                                 ┌────────────────────────────┐
                                 │ 3. Veo :predictLongRunning │ → operation name
                                 │    polling a cada 10s      │ → URI do MP4
                                 └────────────────────────────┘
```

**Pré-requisitos:**
- Uma API key do Google AI Studio (https://aistudio.google.com/apikey).
- **Billing ativo** no projeto do Google Cloud da key. Sem billing, a quota gratuita dos modelos de imagem e de vídeo é **0 requisições**, e a API devolve um erro de `quota` / `limit: 0`.

---

## 2. Capturar a tela atual

A ideia é desenhar o que está visível (um `<video>` ou um `<canvas>`) num canvas temporário e exportar como JPEG em base64.

- Limite a largura a ~1024px. A API não precisa de mais que isso, e o payload fica leve.
- Recorte imitando `object-fit: cover`, pra captura bater com o que o usuário vê.

```js
/**
 * Captures what is currently on screen and returns a raw base64 JPEG
 * (without the "data:image/jpeg;base64," prefix), or null on failure.
 * @param {HTMLVideoElement|HTMLCanvasElement} source
 */
function captureFrame(source, maxWidth = 1024) {
  try {
    const scale = Math.min(1, maxWidth / innerWidth);
    const w = Math.round(innerWidth * scale);
    const h = Math.round(innerHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    if (source instanceof HTMLVideoElement) {
      if (source.readyState < 2 || !source.videoWidth) return null; // no frame yet
      // object-fit: cover
      const vw = source.videoWidth, vh = source.videoHeight;
      const s = Math.max(w / vw, h / vh);
      ctx.drawImage(source, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
    } else {
      ctx.drawImage(source, 0, 0, w, h);
    }

    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  } catch (err) {
    // A cross-origin video without CORS "taints" the canvas → toDataURL throws
    console.error('captureFrame failed', err);
    return null;
  }
}
```

**Armadilhas:**
- **CORS:** se o vídeo vier de outro domínio, ele precisa de `crossorigin="anonymous"` no `<video>`, e o servidor precisa mandar `Access-Control-Allow-Origin`. Sem isso, o `toDataURL` lança `SecurityError`. Vídeo local, no mesmo domínio, funciona sem configuração.
- **Captura vazia:** uma captura com menos de ~500 caracteres em base64 é praticamente vazia (frame preto). O projeto original descarta capturas abaixo desse tamanho.

---

## 3. Gerar imagem com Gemini

### 3.1 Endpoint e payload

```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}
Content-Type: application/json
```

```json
{
  "contents": [{
    "role": "user",
    "parts": [
      { "text": "prompt aqui" },
      { "inlineData": { "mimeType": "image/jpeg", "data": "<base64 da captura>" } }
    ]
  }],
  "generationConfig": {
    "responseModalities": ["IMAGE", "TEXT"],
    "imageConfig": { "aspectRatio": "16:9" }
  }
}
```

- `inlineData` é **opcional**. Com ele, a imagem é editada/reinterpretada a partir da captura. Sem ele, é text-to-image puro.
- Os valores comuns de `aspectRatio` são `1:1`, `16:9`, `9:16`, `4:3` e `3:4`.
- A imagem vem em `candidates[0].content.parts[i].inlineData.data`, em base64 (normalmente PNG).

### 3.2 Modelos usados (em ordem de fallback)

| Uso | Modelos |
|---|---|
| Gerar imagem | `gemini-3.1-flash-image`, `gemini-3-pro-image` |
| Descrever a cena (texto, opcional) | `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-2.5-pro`, `gemini-2.0-flash` |

O código tenta um modelo por vez e passa para o próximo se der erro. Isso protege contra modelo descontinuado ou sem acesso para aquela key. Confira os nomes atuais em https://ai.google.dev/gemini-api/docs/models.

### 3.3 Código

```js
const API = 'https://generativelanguage.googleapis.com';
const IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-3-pro-image'];
const TEXT_MODELS  = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash'];

/**
 * Optional step: asks a text model to describe the captured scene and turn it
 * into a richer prompt. Falls back to the user's prompt if every model fails.
 */
async function describeScene(apiKey, imageB64, userPrompt) {
  const body = JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageB64 } },
        { text: 'Describe this architectural scene in detail for an image generation prompt. ' +
                'Include spatial layout, style, materials, lighting and atmosphere. ' +
                'User style request: ' + userPrompt + '. ' +
                'Respond with ONLY a concise image generation prompt in English, max 100 words.' }
      ]
    }]
  });

  for (const ver of ['v1beta', 'v1']) {
    for (const model of TEXT_MODELS) {
      try {
        const res = await fetch(`${API}/${ver}/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body
        });
        if (!res.ok) continue;
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      } catch { /* try next */ }
    }
  }
  return userPrompt;
}

/**
 * Generates one or more images. Returns an array of { b64, mime }.
 * @param {string} apiKey
 * @param {string} prompt
 * @param {string|null} imageB64  optional base64 JPEG used as reference
 * @param {string} aspectRatio
 */
async function generateImage(apiKey, prompt, imageB64 = null, aspectRatio = '16:9') {
  const hasImage = imageB64 && imageB64.length >= 500;
  const errors = [];

  for (const model of IMAGE_MODELS) {
    try {
      const parts = [{ text: prompt }];
      if (hasImage) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageB64 } });

      const res = await fetch(`${API}/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            imageConfig: { aspectRatio }
          }
        })
      });
      const data = await res.json();

      if (!res.ok) {
        errors.push(`[${model}] ${data?.error?.message || res.status}`);
        continue;
      }

      const images = (data?.candidates?.[0]?.content?.parts || [])
        .filter(p => p.inlineData?.data)
        .map(p => ({ b64: p.inlineData.data, mime: p.inlineData.mimeType || 'image/png' }));

      if (images.length) return images;
      errors.push(`[${model}] response had no image`);
    } catch (err) {
      errors.push(`[${model}] ${err.message}`);
    }
  }

  if (errors.some(m => /quota|billing|limit: 0/i.test(m))) {
    throw new Error('API key sem billing ativo: modelos de imagem têm quota gratuita 0.\n' + errors.join('\n'));
  }
  throw new Error('Falha ao gerar imagem.\n' + errors.join('\n'));
}
```

### 3.4 Uso combinado (como no projeto original)

```js
async function onGenerateImageClick() {
  const apiKey = document.getElementById('api-key').value.trim();
  const userPrompt = document.getElementById('img-prompt').value.trim();
  const capture = captureFrame(document.querySelector('video'));

  // No prompt but have a capture → "enhance" mode
  let prompt = userPrompt ||
    'Enhance this exact scene into a polished, photorealistic architectural render, ' +
    'keeping the same composition, structures and camera angle.';

  if (capture) prompt = await describeScene(apiKey, capture, prompt); // optional step
  prompt += ', photorealistic style';

  const images = await generateImage(apiKey, prompt, capture, '16:9');
  document.getElementById('result-img').src = `data:${images[0].mime};base64,${images[0].b64}`;
}
```

O passo `describeScene` é opcional. Mandar o prompt e a captura direto para o modelo de imagem já funciona. A descrição prévia só ajuda a manter a composição em prompts curtos.

---

## 4. Gerar vídeo com Veo

O Veo é **assíncrono**: você inicia uma operação longa, recebe um `name` e fica consultando até `done: true`. A geração leva de 1 a 3 minutos.

### 4.1 Endpoints

```
# 1. Start
POST {API}/v1beta/models/{MODEL}:predictLongRunning?key={API_KEY}
{
  "instances": [{
    "prompt": "drone shot slowly orbiting the pool at sunset",
    "image": { "bytesBase64Encoded": "<base64>", "mimeType": "image/jpeg" }   // optional first frame
  }],
  "parameters": { "aspectRatio": "16:9" }
}
→ { "name": "models/veo-.../operations/abc123" }

# 2. Polling
GET {API}/v1beta/{name}?key={API_KEY}
→ { "done": true, "response": { "generateVideoResponse": { "generatedSamples": [{ "video": { "uri": "..." } }] } } }

# 3. Download (a URI exige a key no header)
GET {uri}   header: x-goog-api-key: {API_KEY}
```

- Modelos em ordem de fallback: `veo-3.1-generate-preview`, `veo-3.0-generate-preview`, `veo-3.0-fast-generate-preview`, `veo-2.0-generate-001`.
- O campo `image` define o **primeiro frame** do vídeo. Pode ser a captura da tela ou uma imagem gerada no passo 3. Sem ele, o vídeo é text-to-video.
- O Veo aceita `aspectRatio` `16:9` ou `9:16`.

### 4.2 Código

```js
const VEO_MODELS = [
  'veo-3.1-generate-preview',
  'veo-3.0-generate-preview',
  'veo-3.0-fast-generate-preview',
  'veo-2.0-generate-001'
];

async function startVeo(apiKey, ver, model, instance, aspectRatio) {
  const res = await fetch(`${API}/${ver}/models/${model}:predictLongRunning?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [instance], parameters: { aspectRatio } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || String(res.status));
  if (!data.name) throw new Error('Response has no operation name.');
  return { ver, name: data.name };
}

async function pollVeo(apiKey, ver, name, { intervalMs = 10000, maxTries = 60, onTick } = {}) {
  for (let i = 1; i <= maxTries; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    onTick?.(i);
    const res = await fetch(`${API}/${ver}/${name}?key=${apiKey}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || String(res.status));
    if (data.done) {
      if (data.error) throw new Error(data.error.message || 'Generation error.');
      return data;
    }
  }
  throw new Error('Timed out waiting for video.');
}

/** The response shape varies between Veo versions — try every known path. */
function extractVideo(op) {
  const r = op?.response;
  if (!r) return null;
  const candidates = [
    r.generateVideoResponse?.generatedSamples?.[0]?.video,
    r.generatedVideos?.[0]?.video,
    r.videos?.[0]?.video,
    r.videos?.[0],
    r.generateVideoResponse?.generatedSamples?.[0]
  ].filter(Boolean);

  for (const v of candidates) {
    if (v.uri) return { uri: v.uri };
    if (v.videoBytes) return { b64: v.videoBytes, mime: v.mimeType || 'video/mp4' };
    if (v.bytesBase64Encoded) return { b64: v.bytesBase64Encoded, mime: v.mimeType || 'video/mp4' };
  }
  return null;
}

/**
 * Generates a video and returns a Blob (video/mp4).
 * @param {string|null} firstFrameB64  optional base64 image used as the first frame
 */
async function generateVideo(apiKey, prompt, firstFrameB64 = null, firstFrameMime = 'image/jpeg',
                             aspectRatio = '16:9', onStatus = () => {}) {
  const instance = { prompt };
  if (firstFrameB64) instance.image = { bytesBase64Encoded: firstFrameB64, mimeType: firstFrameMime };

  // 1. Start: first model/version that accepts the request wins
  const errors = [];
  let op = null;
  outer: for (const model of VEO_MODELS) {
    for (const ver of ['v1beta', 'v1']) {
      try {
        op = await startVeo(apiKey, ver, model, instance, aspectRatio);
        break outer;
      } catch (err) {
        errors.push(`[${ver}/${model}] ${err.message}`);
      }
    }
  }
  if (!op) throw new Error('No Veo model available for this key.\n' + errors.join('\n'));

  // 2. Polling
  onStatus('Gerando vídeo (1–3 min)...');
  const result = await pollVeo(apiKey, op.ver, op.name, { onTick: i => onStatus(`Gerando... ${i * 10}s`) });

  // 3. Extract
  const video = extractVideo(result);
  if (!video) {
    const reason = result?.response?.raiMediaFilteredReasons?.[0]
                || result?.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0];
    throw new Error(reason ? 'Blocked by safety filter: ' + reason : 'Response contains no video.');
  }

  // 4. Download
  if (video.uri) {
    const res = await fetch(video.uri, { headers: { 'x-goog-api-key': apiKey } });
    if (!res.ok) throw new Error('Could not download the generated video.');
    return await res.blob();
  }
  const bin = atob(video.b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: video.mime });
}
```

### 4.3 Uso

```js
async function onGenerateVideoClick() {
  const apiKey = document.getElementById('api-key').value.trim();
  const prompt = document.getElementById('vid-prompt').value.trim();
  const frame = captureFrame(document.querySelector('video')); // or a generated image's b64

  const blob = await generateVideo(apiKey, prompt, frame, 'image/jpeg', '16:9',
                                   msg => (document.getElementById('status').textContent = msg));

  const url = URL.createObjectURL(blob);
  const player = document.getElementById('result-video');
  player.src = url;
  player.play();
  // Download: <a href={url} download="ai-video.mp4">
  // When discarding: URL.revokeObjectURL(url)
}
```

---

## 5. HTML mínimo

```html
<input id="api-key" type="password" placeholder="Gemini API key" autocomplete="off">

<video src="minha-cena.mp4" autoplay muted loop playsinline></video>

<textarea id="img-prompt" placeholder="Prompt da imagem (opcional)"></textarea>
<button onclick="onGenerateImageClick()">Gerar imagem</button>
<img id="result-img">

<textarea id="vid-prompt" placeholder="Prompt do vídeo"></textarea>
<button onclick="onGenerateVideoClick()">Gerar vídeo</button>
<p id="status"></p>
<video id="result-video" controls playsinline></video>
```

---

## 6. Segurança: key no cliente vs. proxy

O projeto original manda a key **direto do navegador** (`?key=...` na URL).

- **Isso só é aceitável se cada usuário digitar a própria key.** Ela aparece no DevTools e no histórico de rede.
- **Se a key for sua (do projeto), nunca coloque no front.** Crie um proxy server-side. Exemplo como Vercel Function, em `api/gemini.js`:

```js
// api/gemini.js — Vercel Serverless Function
// The key lives in an environment variable (Vercel → Settings → Environment Variables)
export default async function handler(req, res) {
  const { path, body } = req.body;              // e.g. path = "v1beta/models/gemini-3.1-flash-image:generateContent"
  if (!/^v1(beta)?\/(models|operations)\//.test(path)) {
    return res.status(400).json({ error: 'invalid path' }); // allow only what you need
  }
  const upstream = await fetch(`https://generativelanguage.googleapis.com/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: body ? JSON.stringify(body) : undefined
  });
  res.status(upstream.status).json(await upstream.json());
}
```

No front, troque cada `fetch(\`${API}/...?key=${apiKey}\`)` por um `fetch('/api/gemini', { method: 'POST', body: JSON.stringify({ path, body }) })`.

Ainda falta resolver duas coisas:
- **Download do vídeo do Veo:** a URI também exige a key, então ele precisa de uma rota de proxy própria, que faça streaming do MP4.
- **Abuso:** adicione rate limit e/ou autenticação, senão qualquer pessoa gasta a sua quota.

---

## 7. Checklist de problemas comuns

| Sintoma | Causa provável |
|---|---|
| `quota exceeded` / `limit: 0` | Billing não ativado no projeto da key |
| `models/xxx is not found` | Modelo descontinuado ou renomeado → atualize as listas de fallback |
| `SecurityError` no `toDataURL` | Vídeo cross-origin sem CORS (ver seção 2) |
| Captura preta / vazia | Vídeo ainda não carregou (`readyState < 2`) |
| Veo retorna `raiMediaFilteredReasons` | Prompt ou imagem bloqueados pelo filtro de segurança (pessoas reais, marcas etc.) |
| Download do vídeo dá 403 | Faltou o header `x-goog-api-key` no fetch da URI |
| Polling nunca termina | Normal levar até 3 min; o timeout está em 10 min (60 × 10s) |

---

## 8. Extra: conversa por voz (Gemini Live API)

O projeto original também tem conversa por voz em tempo real. O ponto de partida é este:
- Abre um WebSocket em `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}`.
- Manda primeiro uma mensagem `setup` com `model: "models/gemini-3.1-flash-live-preview"`, `responseModalities: ["AUDIO"]` e um `systemInstruction`.
- Depois faz streaming de áudio do microfone em PCM 16kHz e toca a resposta em PCM 24kHz via `AudioContext`.

Esse fluxo é mais longo e fica para um guia à parte. A referência é a documentação da Live API: https://ai.google.dev/gemini-api/docs/live

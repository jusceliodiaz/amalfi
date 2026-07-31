# ArchViz Explorer — Guia do Projeto

## Visão

Experiência interativa de visualização arquitetônica, inspirada na Parallel (parallel.life).
A experiência **inteira acontece numa única tela**, em modo cinematográfico:

1. A tela inicia com uma **tela de loading** (fundo bege, logo, contador de progresso real) que pré-carrega o poster, os vídeos das cenas e a sequência de transição principal — só depois disso o botão **"Entra"** libera a experiência.
2. Após o "Entra", a tela mostra um **vídeo em loop** da cena atual.
3. Sobre o vídeo, há **POIs (Points of Interest)** e o **dock de navegação inferior** (`#track`) com um botão por cena.
4. Ao navegar pra outra cena, o vídeo é substituído por uma **sequência de imagens** (pré-renderizadas em IA) que simula um movimento de câmera 3D indo do ponto atual até o destino.
5. O **último frame da sequência é idêntico ao primeiro frame do próximo loop** — isso garante a sensação de continuidade 3D sem corte visível.
6. Na cena "Piscina" (id interno `aerial`/`pool`, ver abaixo), um slider dia/noite (`#ab-slider`) permite arrastar entre o vídeo diurno e um vídeo/sequência noturna.

**Regra de ouro:** o usuário nunca deve perceber a transição entre vídeo e sequência de imagens. Tudo precisa parecer um único 3D real-time, mesmo sendo pré-renderizado.

## Idioma

**A interface do site é em italiano** (`<html lang="it">`) — nomes de cena, textos da loja, painel de IA, galeria, tela de loading, meta tags de SEO. O código-fonte (nomes de função/variável, comentários, este arquivo) continua em inglês/português como convenção de desenvolvimento — só o que o usuário final vê na tela está em italiano. Nomes de marca e de produto (BONDHOLMEN, FEJKA, RUNNEN, Veo, Gemini) não são traduzidos.

## Stack

- **HTML / CSS / JS puro** (sem framework, sem build step)
- Deploy: **Vercel** via Git
- Assets de mídia: locais no repo
- Sem dependências npm no site em si. `three.module.js` é importado via `importmap` (CDN) só no `shop3d.js`, pro viewer 3D da loja.

## Estrutura de arquivos

```
/
├── CLAUDE.md          # este arquivo
├── SHOP-README.md     # detalhes da integração da loja
├── index.html         # estrutura da tela — inclui preloader, shop, AI Studio, galeria
├── styles.css         # todos os estilos
├── scenes-fp.js       # CONFIG: timeline, cenas, sequências, transições
├── script-fp.js       # player de sequência, preloader, AI Studio, galeria, voz
├── shop.js            # produtos, carrinho, simulação por IA
├── shop3d.js          # viewer 3D (Three.js) dos produtos da loja
├── glb/                # modelos 3D placeholder da loja
└── images/
    ├── logo.svg                     # logo (branca — invertida via CSS em telas claras)
    ├── og-pool.jpg                  # imagem de compartilhamento (1200×630)
    ├── 1.webm / 3.webm              # vídeos de loop das cenas (dia)
    ├── 1_night.webm / 3_night.webm  # vídeos de loop (noite, lado B do slider)
    ├── seq_arch/                    # sequências de transição — resolução desktop
    └── seq_arch_m/                  # mesmas sequências — resolução mobile (metade)
```

## Conceitos técnicos chave

### Estados da tela

A tela tem 2 estados, nunca os dois ao mesmo tempo:

- **`loop`** → `<video>` rodando em loop, POIs e dock de navegação visíveis sobre ele
- **`transition`** → `<canvas>` desenhando sequência de imagens frame-a-frame, POIs escondidos

A transição entre estados é uma **troca dura** (não há crossfade) porque o último frame do estado anterior coincide com o primeiro frame do próximo.

### Player de sequência (canvas)

- Frames são pré-carregados via `preload(sequenceId, onProgress?)`, com cache em memória (`cache`, máx. 3 sequências simultâneas).
- Desenho em `<canvas>` com `requestAnimationFrame`, FPS definido por sequência (`fps` no config, default 30).
- `drawCover()` faz o equivalente a `object-fit: cover` no canvas.
- Em mobile, `preload()` troca automaticamente `images/seq_arch/` por `images/seq_arch_m/` e pula metade dos frames (metade da resolução + metade do frame-rate, mesma duração percebida).

### Sistema de cenas (`scenes-fp.js`)

```js
CONFIG = {
  timeline: [
    { id: 'aerial', label: 'Piscina',  icon: '<svg>...</svg>' },
    { id: 'pool',   label: 'Terrazza', icon: '<svg>...</svg>' }
  ],
  scenes: {
    aerial: { video: 'images/1.webm', pois: [], abVideoB: 'images/1_night.webm', abSequence: 'aerial-ab-reveal' },
    pool:   { video: 'images/3.webm', pois: [], abVideoB: 'images/3_night.webm', abSequence: 'pool-ab-reveal' }
  },
  sequences: {
    'aerial-to-pool': { folder: 'images/seq_arch/', prefix: 'aereo_to_piscina_', from: 0, to: 71, pad: 2, ext: 'jpg', fps: 60 },
    // ...
  },
  transitions: { aerial: { pool: 'aerial-to-pool' }, pool: { aerial: 'pool-to-aerial' } }
}
```

Importante: **`id` interno da cena não precisa bater com o `label` exibido** — os ids `aerial`/`pool` são históricos (a cena "aerial" hoje mostra a piscina, e "pool" mostra a terraço/varanda). Ao adicionar POIs/scripts novos, sempre use o `id`, nunca assuma que ele reflete o conteúdo real — confira `label` em `CONFIG.timeline`.

### Slider dia/noite (A/B)

Qualquer cena com `abVideoB` + `abSequence` no `CONFIG.scenes` ganha o slider automaticamente (`#ab-slider`, lógica em `script-fp.js`). `abVideoB` é o vídeo do lado noturno; `abSequence` aponta pra uma entrada em `CONFIG.sequences` com os frames do arrasto no meio.

### Naming convention dos frames

`<prefixo>_NN.jpg` com 2 dígitos com zero à esquerda (ex: `aereo_to_piscina_00.jpg` até `_71.jpg`). O prefixo e o range (`from`/`to`) ficam no config de cada sequência — não são fixos.

### Regra do frame coincidente

Quando criar uma nova sequência na IA:
- **Frame 0** deve ser **visualmente idêntico** ao último frame visível do estado anterior (vídeo ou imagem).
- **Frame N** (último) deve ser **visualmente idêntico** ao primeiro frame visível do próximo estado.

Sem isso, o usuário vê o "corte" e a ilusão quebra.

## Tela de loading / preloader

`#preloader` (em `index.html`, lógica em `initPreloader()` no `script-fp.js`) cobre a tela inteira até:
1. o poster inicial carregar,
2. os vídeos de todas as cenas carregarem (via `videoBlobs`),
3. a sequência de transição principal (ida e volta) carregar por completo no `cache`.

A porcentagem exibida é **progresso real**, não simulado. Só depois disso o botão "Entra" fica clicável — isso garante que a primeira transição nunca mostre frame faltando. Vídeos/sequências secundários (slider dia/noite) continuam carregando em segundo plano depois do "Entra" (`preloadRemainingIdle()`).

## Loja (`shop.js` / `SHOP-README.md`)

Painel lateral com produtos reais da IKEA Itália, agrupados em 4 abas: **Divani** (sofás externos), **Sedie** (cadeiras externas), **Piante** (plantas artificiais) e **Pavimenti** (deck/piso externo) — tudo voltado pra área externa (piscina/terraço), não mobília de interior. Cada produto tem link de compra real, carrinho (localStorage), viewer 3D (`shop3d.js`, modelo placeholder até subir os GLBs reais) e simulação por IA ("colocar na cena") usando a mesma API key do painel de IA.

## AI Studio + Voz + Galeria

- **AI Studio** (`#ai-panel`): gera imagem ou vídeo (Gemini / Veo) a partir da vista atual capturada ou de um prompt.
- **Voz** (`#ai-voice-btn`): conversa ao vivo com a Gemini Live API, comentando a cena e navegando por comando de voz.
- **Galeria** (`#gallery-modal`): toda imagem/vídeo gerado (AI Studio + simulação da loja) cai aqui automaticamente pra revisão/download. Sessão apenas em memória — não persiste após recarregar a página.

## Performance

- Sequências pré-carregadas **antes do "Entra"** só para a transição principal (aerial⇄pool); as demais (slider dia/noite) carregam em background depois, sem travar o load inicial.
- Compressão de imagens das sequências: **JPEG, qualidade 85 no desktop** (`images/seq_arch/`), **qualidade 58 em metade da resolução no mobile** (`images/seq_arch_m/`) — ambos com `optimize=True`/progressive. Reduz o peso em ~70% sem perda perceptível.
- O `<video>` precisa de `muted` e `playsinline` pra rodar em mobile; o autoplay real só dispara após o clique em "Entra" (gesto do usuário), evitando bloqueio de autoplay em iOS/Android.

## Deploy (Vercel)

- Repo conectado ao Vercel, deploy automático no push na main.
- Não precisa de `vercel.json` — Vercel detecta site estático sozinho.
- Se for adicionar cache longo em produção, `vercel.json` com `max-age=31536000, immutable` em `images/*`.

## Migração de mídia pesada

Repo de imagens (`images/`) está em ~83MB depois da otimização (era 250MB+). Se voltar a crescer muito (200MB+):

1. Subir vídeos/sequências grandes no **Vercel Blob** (`@vercel/blob`) ou **Cloudflare R2**.
2. Substituir o `folder`/`video` no `scenes-fp.js` pela URL pública retornada.
3. Remover o arquivo grande do git (e do histórico com `git-filter-repo` se necessário).

## Convenções de código

- JS puro, sem TypeScript.
- Nomes de função/variável em inglês; comentários no código em inglês.
- `script-fp.js` é uma mistura: bloco principal minificado (herdado) + funções novas (preloader, galeria, slider A/B) escritas de forma legível ao final do arquivo — ao editar, prefira adicionar funções legíveis novas em vez de minificar manualmente.
- Texto **voltado ao usuário final é em italiano** (ver seção "Idioma" acima) — não confundir com convenção de código.
- Evitar libs. Se for inevitável, justificar (ex: Three.js no viewer 3D da loja).

# ArchViz Explorer — Guia do Projeto

## Visão

Experiência interativa de visualização arquitetônica, inspirada na Parallel (parallel.life).
A experiência **inteira acontece numa única tela**, em modo cinematográfico:

1. A tela abre direto na experiência (sem tela de loading): mostra o poster (frame 0 da sequência principal) e em seguida um **vídeo em loop** da cena atual.
2. As sequências de transição carregam em segundo plano desde o início.
3. Sobre o vídeo, há **POIs (Points of Interest)** e o **dock de navegação inferior** (`#track`) com um botão por cena.
4. Ao navegar pra outra cena, o vídeo é substituído por uma **sequência de imagens** (pré-renderizadas em IA) que simula um movimento de câmera 3D indo do ponto atual até o destino.
5. O **último frame da sequência é idêntico ao primeiro frame do próximo loop** — isso garante a sensação de continuidade 3D sem corte visível.
6. Na cena "Piscina" (id interno `aerial`/`pool`, ver abaixo), dois botões (sol/lua) fazem a transição entre o vídeo diurno e o noturno.

**Regra de ouro:** o usuário nunca deve perceber a transição entre vídeo e sequência de imagens. Tudo precisa parecer um único 3D real-time, mesmo sendo pré-renderizado.

## Idioma

**A interface do site é em inglês** (`<html lang="en">`) — nomes de cena, textos da loja, painel de IA, galeria, meta tags de SEO. O código-fonte (nomes de função/variável, comentários, este arquivo) continua em inglês/português como convenção de desenvolvimento — só o que o usuário final vê na tela está em inglês. Não há logo na tela. Nomes de marca e de produto (BONDHOLMEN, FEJKA, RUNNEN, Veo, Gemini) não são traduzidos.

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
├── index.html         # estrutura da tela — inclui shop, AI Studio, galeria
├── styles.css         # todos os estilos
├── scenes-fp.js       # CONFIG: timeline, cenas, sequências, transições
├── script-fp.js       # player de sequência, início, AI Studio, galeria, voz
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
    'aerial-to-pool': { folder: 'images/seq_arch/', prefix: 'aereo_to_piscina_', from: 0, to: 59, v: 2, pad: 2, ext: 'jpg', fps: 60 },
    // ...
  },
  transitions: { aerial: { pool: 'aerial-to-pool' }, pool: { aerial: 'pool-to-aerial' } }
}
```

Importante: **`id` interno da cena não precisa bater com o `label` exibido** — os ids `aerial`/`pool` são históricos (a cena "aerial" hoje mostra a piscina, e "pool" mostra a terraço/varanda). Ao adicionar POIs/scripts novos, sempre use o `id`, nunca assuma que ele reflete o conteúdo real — confira `label` em `CONFIG.timeline`.

### Botões dia/noite (A/B)

Qualquer cena com `abVideoB` + `abSequence` no `CONFIG.scenes` ganha dois botões no topo (`#ab-slider` > `#dn-day` / `#dn-night`, lógica em `abSetNight()` no `script-fp.js`). Sol = vídeo da cena, Lua = `abVideoB`. Ao clicar, toca a `abSequence` no canvas: pra frente (dia → noite) ou ao contrário (noite → dia), e no fim troca a opacidade do vídeo (`#stage.ab-show-b`). Durante a animação `busy` fica true, bloqueando navegação e cliques repetidos. **Modo vídeo de transição** (`abVideoBReverse`, usado hoje em `aerial`): `abVideoB` é o próprio clipe dia→noite (`1_night.webm`). A lua toca ele uma vez e depois entra no loop noturno `abVideoBLoop` (`1_night_loop.webm`, em `#ab-video-d`; o primeiro frame dele = último frame do clipe). Sem `abVideoBLoop`, segura o último frame do clipe. O sol toca `abVideoBReverse` (`1_night_rev.webm`, o mesmo clipe invertido, gerado com `ffmpeg -vf reverse`) em `#ab-video-c` e depois volta pro loop diurno a partir do frame 0. Se trocar o `1_night.webm`, gere o reverso de novo: `ffmpeg -i images/1_night.webm -vf reverse -an -c:v libvpx-vp9 -crf 30 -b:v 0 -row-mt 1 -g 30 images/1_night_rev.webm`, e incremente o `?v=` dos dois.

### Controles de cena no topo (`#scene-controls`)

Segunda linha no topo, centralizada sob o dock de IA: os botões dia/noite + o botão **360°** (`#pano-btn`). O botão aparece em qualquer cena com `pano` no `CONFIG.scenes` (id do panorama em `pano360.js`) e abre `openPanoModal(pano)`. Ele some junto com os POIs durante a transição (`hidePOIs()` / `renderPOIs()`). O 360° não é mais POI no meio da cena. Hoje nenhuma cena tem `pano`, então o botão fica escondido e só os botões dia/noite aparecem, centralizados — pra reativar, adicione `pano:"aerial"` / `pano:"pool"` nas cenas.

### Naming convention dos frames

`<prefixo>_NN.jpg` com 2 dígitos com zero à esquerda (ex: `aereo_to_piscina_00.jpg` até `_59.jpg`). O prefixo e o range (`from`/`to`) ficam no config de cada sequência — não são fixos.

### Regra do frame coincidente

Quando criar uma nova sequência na IA:
- **Frame 0** deve ser **visualmente idêntico** ao último frame visível do estado anterior (vídeo ou imagem).
- **Frame N** (último) deve ser **visualmente idêntico** ao primeiro frame visível do próximo estado.

Sem isso, o usuário vê o "corte" e a ilusão quebra.

## Início (sem tela de loading)

Não há tela de loading nem botão de start. No `load`, `initPreloader()` (`script-fp.js`) desenha o frame 0 da sequência principal como poster e chama `startScene()`, que já pré-carrega as sequências de transição da cena atual. Vídeos/sequências secundários (slider dia/noite) carregam em segundo plano via `preloadRemainingIdle()`. Como a primeira transição pode começar antes de todos os frames chegarem, `loadWithLoader()` mostra o `#loader` se demorar.

## Loja (`shop.js` / `SHOP-README.md`)

Painel lateral com produtos reais da IKEA Itália, agrupados em 4 abas: **Divani** (sofás externos), **Sedie** (cadeiras externas), **Piante** (plantas artificiais) e **Pavimenti** (deck/piso externo) — tudo voltado pra área externa (piscina/terraço), não mobília de interior. Cada produto tem link de compra real, carrinho (localStorage), viewer 3D (`shop3d.js`, modelo placeholder até subir os GLBs reais) e simulação por IA ("colocar na cena") usando a mesma API key do painel de IA.

## AI Studio + Voz + Galeria

- **AI Studio** (`#ai-panel`): gera imagem ou vídeo (Gemini / Veo) a partir da vista atual capturada ou de um prompt.
- **Voz** (`neoLive*` em `script-fp.js`): conversa ao vivo com a Gemini Live API. O botão de microfone foi removido da interface — o código continua no arquivo, mas sem ponto de entrada.
- **Menu lateral** (`#side-menu`): painel fixo sempre aberto no canto superior esquerdo com AI Studio e Galeria (só ícones no celular). Os ids `#ai-trigger-btn` e `#gallery-btn-badge` continuam (usados por `aiTogglePanel()` e `galleryAdd()`).
- **Galeria** (`#gallery-modal`): toda imagem/vídeo gerado (AI Studio + simulação da loja) cai aqui automaticamente pra revisão/download. Sessão apenas em memória — não persiste após recarregar a página.

## Performance

- A transição principal (aerial⇄pool) começa a pré-carregar logo no início; as demais (slider dia/noite) carregam em background quando o browser fica ocioso.
- Compressão de imagens das sequências: **JPEG, qualidade 85 no desktop** (`images/seq_arch/`), **qualidade 58 em metade da resolução no mobile** (`images/seq_arch_m/`) — ambos com `optimize=True`/progressive. Reduz o peso em ~70% sem perda perceptível. Frames novos chegam em 4K: redimensionar pra 1920×1080 (desktop) e 960×540 (mobile) antes de commitar. Os masters 4K ficam fora do repo, em `../amalfi-masters/`.
- **Cache-busting de mídia:** ao substituir frames/vídeos mantendo o mesmo nome, incremente `v` na sequência (`v:2` → `?v=2` em cada frame, via `preload()`) ou o `?v=N` no caminho do vídeo em `scenes-fp.js` (e no `<link rel="preload">` do `index.html`).
- O `<video>` precisa de `muted` e `playsinline` pra rodar em mobile; como não há mais gesto de start, o autoplay depende de o vídeo estar `muted` (permitido em iOS/Android).

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
- `script-fp.js` é uma mistura: bloco principal minificado (herdado) + funções novas (início, galeria, slider A/B) escritas de forma legível ao final do arquivo — ao editar, prefira adicionar funções legíveis novas em vez de minificar manualmente.
- Texto **voltado ao usuário final é em inglês** (ver seção "Idioma" acima) — não confundir com convenção de código.
- Evitar libs. Se for inevitável, justificar (ex: Three.js no viewer 3D da loja).

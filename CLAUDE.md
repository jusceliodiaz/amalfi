# ArchViz Explorer — Guia do Projeto

## Visão

Experiência interativa de visualização arquitetônica, inspirada na Parallel (parallel.life).
A experiência **inteira acontece numa única tela**, em modo cinematográfico:

1. A tela inicia com um **vídeo aéreo em loop**.
2. Sobre o vídeo, há **POIs (Points of Interest)** — pontos clicáveis posicionados na tela.
3. Ao clicar num POI, o vídeo é substituído por uma **sequência de imagens** (pré-renderizadas em IA) que simula um movimento de câmera 3D indo do ponto atual até o destino.
4. O **último frame da sequência é idêntico ao primeiro frame do próximo loop** (vídeo ou nova sequência em loop) — isso garante a sensação de continuidade 3D sem corte visível.
5. No destino, novos POIs aparecem permitindo navegar adiante. A navegação é uma árvore de cenas conectadas por sequências.

**Regra de ouro:** o usuário nunca deve perceber a transição entre vídeo e sequência de imagens. Tudo precisa parecer um único 3D real-time, mesmo sendo pré-renderizado.

## Stack

- **HTML / CSS / JS puro** (sem framework, sem build step)
- Deploy: **Vercel** via Git
- Assets de mídia: locais no repo no MVP; migrar pra **Vercel Blob** ou **Cloudflare R2** quando o tamanho ultrapassar ~50MB total
- Sem dependências npm. Se precisar de algo, avaliar antes de adicionar.

## Estrutura de arquivos

```
/
├── CLAUDE.md          # este arquivo
├── index.html         # estrutura da tela
├── styles.css         # estilos
├── script.js          # lógica de POIs, player de sequência, estado
├── scenes.js          # configuração das cenas (vídeos, sequências, POIs)
└── assets/
    ├── videos/
    │   └── aerial-loop.mp4          # vídeo inicial em loop
    └── sequences/
        └── poi-01/
            ├── frame_0001.jpg
            ├── frame_0002.jpg
            └── ...
```

## Conceitos técnicos chave

### Estados da tela

A tela tem 2 estados, nunca os dois ao mesmo tempo:

- **`loop`** → `<video>` rodando em loop, POIs visíveis sobre ele
- **`transition`** → `<canvas>` desenhando sequência de imagens frame-a-frame, POIs escondidos

A transição entre estados é uma **troca dura** (não há crossfade) porque o último frame do estado anterior coincide com o primeiro frame do próximo. É essa coincidência de frames que vende a ilusão.

### Player de sequência (canvas)

- Frames são **pré-carregados** antes da reprodução começar (Promise.all em `new Image()`).
- Desenho em `<canvas>` com `requestAnimationFrame`, controlando FPS manualmente (default: 30fps).
- Função `drawCover()` faz o equivalente a `object-fit: cover` no canvas, mantendo proporção independente do tamanho da janela.
- Quando a sequência termina, o estado volta a `loop` com o vídeo/imagem da próxima cena.

### Sistema de cenas

Cada cena (definida em `scenes.js`) tem:

```js
{
  id: 'home',
  type: 'video',                    // ou 'still' (imagem estática)
  src: 'assets/videos/aerial.mp4',
  pois: [
    {
      id: 'poi-01',
      x: 50, y: 50,                 // posição em % da tela
      label: 'Explorar',
      sequence: 'home-to-livingroom',// id da sequência
      nextScene: 'livingroom'
    }
  ]
}
```

E cada sequência tem:

```js
{
  id: 'home-to-livingroom',
  path: 'assets/sequences/home-to-livingroom/',
  frameCount: 60,
  fps: 30
}
```

### Naming convention dos frames

`frame_NNNN.jpg` com 4 dígitos com zero à esquerda (`frame_0001.jpg`, `frame_0060.jpg`).
Mantenha JPG ou WebP. **WebP é ~30% menor** com mesma qualidade — preferir quando possível.

### Regra do frame coincidente

Quando criar uma nova sequência na IA:
- **Frame 1** da sequência deve ser **visualmente idêntico** ao último frame visível do estado anterior (vídeo ou imagem).
- **Frame N** (último) deve ser **visualmente idêntico** ao primeiro frame visível do próximo estado.

Sem isso, o usuário vê o "corte" e a ilusão quebra.

## Performance

- Pré-carregar a sequência **apenas quando o POI for hovered/visível**, não no load inicial — senão a primeira tela demora.
- Mostrar um indicador de loading discreto durante o pré-carregamento se passar de 500ms.
- Compressão: vídeos com `-crf 23 -preset slow` no ffmpeg. Imagens em WebP qualidade 80.
- O `<video>` precisa de `muted`, `playsinline` e `autoplay` pra rodar em mobile sem interação.

## Deploy (Vercel)

- Repo conectado ao Vercel, deploy automático no push na main.
- Não precisa de `vercel.json` — Vercel detecta site estático sozinho.
- Headers de cache: pra produção, adicionar `vercel.json` com cache longo (`max-age=31536000, immutable`) em `assets/*`.

## Migração de mídia pesada

Quando o repo passar de ~100MB total ou um arquivo único passar de 50MB:

1. Subir o vídeo no **Vercel Blob** (`@vercel/blob`) ou **Cloudflare R2**.
2. Substituir o `src` no `scenes.js` pela URL pública retornada.
3. Remover o arquivo grande do git (e do histórico com `git-filter-repo` se necessário).

Sequências de imagens **continuam locais** — são muitos arquivos pequenos, ideal pra servir do mesmo domínio com cache.

## Roadmap

- [ ] MVP: 1 vídeo de loop + 1 POI + 1 sequência funcionando
- [ ] Múltiplos POIs por cena
- [ ] Navegação entre múltiplas cenas (árvore)
- [ ] Indicador de loading durante preload
- [ ] Sequência reversa (voltar ao ponto anterior)
- [ ] Suporte a áudio ambiente
- [ ] Modo fullscreen automático
- [ ] Migrar vídeos pesados pra Vercel Blob

## Convenções de código

- JS puro, sem TypeScript no MVP.
- Funções pequenas, nomes em inglês, comentários em inglês (site e SEO mirados na Europa/mercado anglófono — evitar português em qualquer texto de código, meta tag ou conteúdo voltado ao usuário).
- Estado global em um único objeto `state` em `script.js`.
- Evitar libs. Se for inevitável, justificar.

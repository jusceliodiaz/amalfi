# Shop — IKEA Italia (integração)

## Arquivos
- `index.html` — atualizado: botão shop ativo, pill de total, painel, modais, importmap Three.js
- `styles.css` — atualizado: estilos do shop no final do arquivo
- `shop.js` — NOVO: produtos, abas, cards, carrinho, order summary, IA "colocar na cena"
- `shop3d.js` — NOVO: viewer 3D Three.js (GLB/GLTF e FBX, com pré-load e cache)
- `scenes-fp.js` / `script-fp.js` — sem alterações (copiados só pra pasta ficar completa)

## Modelos 3D
Cada produto aponta para `assets/models/<id>.glb`:
bondholmen, jolpen, lacko, tallskar, skarpo, nammaro, fejka-ulivo, fejka-lavanda,
fejka-succulenta (.glb ou .fbx — troque a extensão no array `SHOP_PRODUCTS` em
shop.js se usar FBX). Os tiles de piso (runnen-*) não usam viewer 3D — são
aplicados na cena só via IA, como um material.
Enquanto o arquivo não existir, o viewer usa um modelo público de demonstração
(SheenChair da Khronos). Basta soltar seus arquivos na pasta que eles assumem.

## Produtos (IKEA Itália, preços verificados em 31/07/2026)
Sofas:  BONDHOLMEN €189 · JOLPEN €75 · LÄCKÖ €119
Chairs: TALLSKÄR €119 · SKARPÖ €39,95 · NÄMMARÖ €78,95
Plants: FEJKA Ulivo €49,95 · FEJKA Lavanda €9,95 · FEJKA Succulenta (3pz) €2,95
Floors: RUNNEN Acacia €25 · RUNNEN Tessuto €35 · RUNNEN Grigio €19,95
Nome, preço, link de compra e imagem oficial estão no array `SHOP_PRODUCTS`.

## IA (colocar móvel na cena)
Usa a mesma API key Gemini do painel de IA já existente (campo API Key).
Cada card de produto tem um botão AI (canto inferior esquerdo da imagem) que
abre o modal de simulação individual daquele móvel:
Capture scene → prompt → Place furniture in scene.
Envia screenshot da cena + foto do produto + instrução pros modelos
gemini-3.1-flash-image / gemini-3-pro-image. Não precisa estar no carrinho.

## AR (vedi nel tuo spazio)
Cada card (exceto pavimentos) tem um botão **AR** que abre um modal com
`<model-viewer>` (Google, via CDN) mostrando o GLB do produto.
- **Android + Chrome**: botão "Vedi in AR" abre a câmera e ancora o modelo
  no chão (Scene Viewer/WebXR), escala real.
- **iPhone**: o Quick Look exige `.usdz`. Adicione um campo `usdz: "assets/models/<id>.usdz"`
  no produto em `SHOP_PRODUCTS` e solte o arquivo na pasta — o código já suporta.
  Sem o .usdz, o iPhone mostra só o preview 3D orbital.
- **Desktop**: sem AR no navegador — mostra preview 3D + aviso pra abrir no celular.
O botão AR nativo do model-viewer só aparece quando o dispositivo suporta AR.
Se o GLB do produto não existir, cai no mesmo modelo demo do viewer 3D.
Importante: o GLB precisa estar em **escala real (metros)** pro AR mostrar o
tamanho certo do móvel.

## Observação
O carrinho persiste em localStorage (chave `archviz-shop-cart`).
Requer servidor local (não abrir via file://) por causa dos módulos ES do Three.js.

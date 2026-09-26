# assets/modelos

Modelos 3D externos (`.glb` ou `.gltf`) feitos no Blender ou baixados (confira a licença antes de usar).

Como usar num móvel (`js/render/furniture*.js`):
```js
minhaPeca: { area: "casa", build: (k) => k.model("assets/modelos/minha-peca.glb", { size: [1.2, 0.8, 1] }) }   // [largura, profundidade, altura]
```
`k.model` reserva o espaço na hora (caixa invisível) e o modelo entra quando carregar; ele é apoiado no chão, centrado e escalado para a altura pedida, com sombras e reflexos do ambiente.
Também dá para usar direto: `Scene3D.loadModel(url, { height: 1.5 }).then((grupo) => cena.add(grupo))`.

- `exemplo-cubo.gltf`: cubo de teste (usado pelo teste `modelos3d`).
- O carregador é `vendor/gltf-loader.js` (gerado por `npm run build:gltf` a partir do GLTFLoader do three r149).
- Dicas: prefira `.glb` (arquivo único), poucos polígonos (< 20 mil por peça), texturas até 1024 px e materiais PBR (metal/rugosidade).

# js/ — o código do jogo

Scripts clássicos (sem módulos): compartilham variáveis globais, então **a ordem em que o `index.html` os carrega importa**.
Cada subpasta é uma camada; uma camada só usa as de cima dela na lista abaixo (i18n → core → render/audio → game → world).

| Pasta | Para quê |
|---|---|
| `i18n/` | idiomas e textos da interface |
| `core/` | estado do jogo, relógio, HUD, tutorial, sincronização, dinheiro, versão |
| `audio/` | música e efeitos sonoros (gerados no navegador, sem arquivos) |
| `render/` | tudo que é 3D (Three.js): consultório, casa, personagens, aquário, ícones 3D |
| `game/` | regras do jogo: consulta, loja, investigação clínica, missões, atividades, bichinhos |
| `world/` | a cidade em 2D: mapa, ruas, lugares, fauna, natureza, aquário, vida social |
| `app.js` | liga os botões e abre a tela de título (carrega por último) |

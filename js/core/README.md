# js/core/ — a base do jogo

| Arquivo | Para quê |
|---|---|
| `app-core.js` | estado (`state`), salvamento, configurações, relógio e fases do dia, HUD, telas e janelas (`showScreen`, `openModal`) |
| `content-loader.js` | transforma `content/bundle.js` nas variáveis do jogo (casos, Manual, loja, mundo, banco de diagnóstico) |
| `changelog.js` | versão do jogo e o "Mapa de atualizações" (a cada versão nova, acrescente uma entrada aqui) |
| `tutorial.js` | dicas progressivas: aparecem quando a pessoa chega ao lugar ou usa o sistema pela primeira vez |
| `sync.js` | conta, sincronização entre aparelhos e ranking (só aparece com servidor) |
| `money.js` | o nome e o ícone da moeda de cada país/idioma |
| `emoji-chip.js` | selo de fundo nos emojis dos botões para não sumirem no modo escuro |

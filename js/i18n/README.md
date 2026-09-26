# js/i18n/ — idiomas

Interface em 13 idiomas (pt, en, es, fr, de, it, ru, ja, ko, zh, zt, fi, gn).

| Arquivo | Para quê |
|---|---|
| `i18n.js` | motor: `L(pt,en,es)`, `t(chave)`, lista de idiomas, bandeiras, troca de idioma |
| `ui-strings.js` | **fonte** dos textos da interface (pt/en/es). Chave nova nasce aqui |
| `i18n-extra.js` | traduções à mão de parte das chaves nos outros idiomas |
| `i18n-extra2.js` | **GERADO** por `node tools/build-i18n.mjs` a partir de `tools/i18n/*.json`. Não edite |
| `names-i18n.js` | **GERADO** por `node tools/build-names.mjs`: nomes de países, loja, bichinhos, diagnósticos e grupos |

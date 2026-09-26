"use strict";

// Carrega o conteúdo do jogo (content/bundle.js, gerado a partir de content/*.json) e o entrega
// nas mesmas variáveis globais de antes. Blocos { pt, en, es } viram textos L(...) traduzíveis.
(function () {
  const C = window.__CONTENT;
  if (!C) throw new Error("content/bundle.js não foi carregado");
  const L = window.L;

  const isL = (x) => {
    const k = Object.keys(x);
    const EXTRA = ["fr", "de", "it", "ru", "ja", "ko", "zh", "zt", "fi", "gn"];   // idiomas extras que o pacote pode trazer (tools/i18n/mundo.tsv)
    return "pt" in x && "en" in x && "es" in x && k.every((n) => n === "pt" || n === "en" || n === "es" || EXTRA.includes(n));
  };
  const revive = (x) => {
    if (Array.isArray(x)) return x.map(revive);
    if (x && typeof x === "object") {
      if (isL(x)) { const o = L(x.pt, x.en, x.es), ex = window.NAMES_I18N && window.NAMES_I18N[x.pt]; Object.keys(x).forEach((n) => { if (n !== "pt" && n !== "en" && n !== "es") o[n] = x[n]; }); return ex ? Object.assign(o, ex) : o; }
      return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, revive(v)]));
    }
    return x;
  };

  window.APPROACHES = revive(C.approaches);
  window.APPROACH_DEFAULT_WHY = revive(C.defaultWhy);
  window.MANUAL_DATA = revive(C.manual);
  window.SHOP_DATA = revive(C.shop);
  window.CASES_DATA = revive(C.cases);
  window.SECRET_DATA = revive(C.secret);
  window.SCHEDULE_DATA = C.schedule;
  window.PINS_DATA = revive(C.pins);
  window.PETS_DATA = revive(C.pets);
  window.WORLD_DATA = revive(C.world);
  window.DX_DATA = revive(C.dx);
  window.MISSOES_DATA = revive(C.missoes || { principal: [], secundarias: [] });
})();

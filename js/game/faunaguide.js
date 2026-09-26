"use strict";

// Guia da fauna: todos os bichinhos da cidade, da praia e do mar, com onde vivem e uma curiosidade.
// Cada um só "aparece" depois que você passa perto dele (Fauna.markSeen); os outros ficam como sombra, com dica de onde procurar.
const FaunaGuide = (() => {
  let timer = 0;
  const placeName = (id) => { const l = (window.WORLD_DATA.locations || []).find((x) => x.id === id); return l ? I18N.pick(l.name) : id; };

  function render() {
    const body = $("fauna-body"); body.textContent = "";
    const all = Fauna.species(), seen = Fauna.seen(), n = all.filter((s) => seen[s]).length;
    body.appendChild(el("p", "opt-help", t("guide.help")));
    body.appendChild(el("p", "fg-count", t("guide.count", { n, t: all.length })));
    const grid = el("div", "fg-grid");
    all.forEach((sp) => {
      const known = Boolean(seen[sp]), info = Fauna.INFO[sp];
      const card = el("div", "fg-card" + (known ? "" : " unseen")); card.dataset.sp = sp;
      const cv = el("canvas", "fg-icon"); cv.width = 120; cv.height = 96; card.appendChild(cv);
      card.appendChild(el("strong", null, known ? I18N.pick(info[0]) : t("guide.unknown")));
      const places = Fauna.placesOf(sp).map(placeName);
      if (known) {
        card.appendChild(el("p", "fg-about", I18N.pick(info[1])));
        card.appendChild(el("p", "fg-where", `📍 ${t("guide.where")}: ${places.slice(0, 5).join(", ")}`));
      } else card.appendChild(el("p", "fg-where", `🔎 ${t("guide.hint")} ${places.slice(0, 3).join(", ")}`));
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  function paint() {
    const m = $("fauna-modal");
    if (m.classList.contains("hidden")) { clearInterval(timer); timer = 0; return; }
    const t0 = performance.now();
    document.querySelectorAll("#fauna-body .fg-card").forEach((card) => {
      const cv = card.querySelector("canvas"), c = cv.getContext("2d"), sp = card.dataset.sp;
      c.clearRect(0, 0, cv.width, cv.height);
      const r = (Fauna._radius && Fauna._radius(sp)) || 14, sc = Math.max(0.55, Math.min(2.6, 32 / r));
      Fauna.drawIcon(c, sp, 60, sp === "whale" ? 52 : 58, sc, t0);
    });
  }

  function open() {
    render(); openModal("fauna-modal"); paint();
    clearInterval(timer); timer = setInterval(paint, 110);
  }
  function init() {
    $("fauna-close").addEventListener("click", () => { closeModal("fauna-modal"); clearInterval(timer); timer = 0; });
  }
  return { open, init, render };
})();
window.FaunaGuide = FaunaGuide;

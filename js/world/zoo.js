"use strict";

// ===========================================================================
// Zoológico dos Biomas e progressão dos animais.
//  · 14 animais em 7 biomas do Brasil (world.animals / world.biomes); cada recinto abre uma ficha;
//  · Observar (1 vez por dia por animal, +2), Alimentar (3 moedas, +3, 1 vez por dia) e Doar ao projeto de conservação (10 moedas, +5, até 3 por dia);
//  · Selo do bioma: observar os 2 animais do bioma 3 vezes cada rende +10 e o selo; 7 selos = conquista "Bióloga do Brasil";
//  · Níveis do zoológico por pontos: Visitante 0 · Observadora 15 · Pesquisadora 40 · Guardiã da fauna 80 · Embaixadora dos biomas 150 (cada um dá prêmio).
// Também: areaUnlocked(id) (o Polo Norte só aparece no mapa depois da conquista "A lenda dos Guardiões") e o bioma de cada lugar do mapa.
// Estado: state.zoo = { obs:{animal:n}, dia:{"animal:acao": "semana:dia"}, pts, level, seals:{bioma:true}, doado }
// ===========================================================================
const Zoo = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const W = () => window.WORLD_DATA || {};
  const st = () => { const z = (state.zoo = state.zoo || {}); z.obs = z.obs || {}; z.dia = z.dia || {}; z.pts = z.pts || 0; z.level = z.level || 0; z.seals = z.seals || {}; z.doado = z.doado || 0; return z; };
  const today = () => `${state.week || 1}:${state.dayIndex}`;
  const animals = () => W().animals || [];
  const biomes = () => W().biomes || [];
  const animal = (id) => animals().find((a) => a.id === id);
  const biome = (id) => biomes().find((b) => b.id === id);
  const LEVELS = [
    { at: 0, name: L("Visitante", "Visitor", "Visitante"), reward: null },
    { at: 15, name: L("Observadora", "Observer", "Observadora"), reward: { c: 20 } },
    { at: 40, name: L("Pesquisadora", "Researcher", "Investigadora"), reward: { c: 40, x: 30 } },
    { at: 80, name: L("Guardiã da fauna", "Fauna guardian", "Guardiana de la fauna"), reward: { c: 80, x: 60 } },
    { at: 150, name: L("Embaixadora dos biomas", "Biome ambassador", "Embajadora de los biomas"), reward: { c: 150, x: 100 } }
  ];
  const levelOf = (pts) => LEVELS.reduce((n, l, i) => (pts >= l.at ? i : n), 0);
  const sealCount = () => Object.keys(st().seals).length;
  const areaUnlocked = (id) => {
    if (id !== "polo") return true;
    return Boolean((state.ach && state.ach.guardioes) || (typeof settings !== "undefined" && settings.dev && settings.unlockAll));
  };

  function addPts(n) {
    const z = st(); z.pts += n;
    const lv = levelOf(z.pts);
    while (z.level < lv) {
      z.level += 1; const r = LEVELS[z.level].reward;
      if (r) { state.coins += r.c || 0; state.xp += r.x || 0; }
      setTimeout(() => showToast(`🦁 ${tr("Zoológico", "Zoo", "Zoológico")}: ${pick(LEVELS[z.level].name)}${r ? ` · 🪙 +${r.c || 0}${r.x ? ` · ⭐ +${r.x}` : ""}` : ""}`), 700);
      sfx("levelup");
    }
    biomes().forEach((b) => {   // selo do bioma
      if (z.seals[b.id]) return;
      if (b.animals.every((id) => (z.obs[id] || 0) >= 3)) { z.seals[b.id] = true; z.pts += 10; setTimeout(() => showToast(`🏅 ${tr("Selo do bioma", "Biome seal", "Sello del bioma")}: ${pick(b.name)} · +10`), 1400); sfx("good"); }
    });
    saveState(); updateHud();
  }

  // ---------------------------------------------------------------- ficha do animal
  function openAnimal(id) {
    const a = animal(id); if (!a) return;
    const z = st(), b = biome(a.biome), body = $("hosp-body"); body.textContent = "";
    $("hosp-title").textContent = `${a.emoji} ${pick(a.name)}`;
    const n = z.obs[id] || 0;
    body.appendChild(el("p", "uni-q", `${b.emoji} ${tr("Bioma", "Biome", "Bioma")}: ${pick(b.name)} · ${tr("Observações", "Observations", "Observaciones")}: ${n}/3`));
    body.appendChild(el("p", "uni-res", n ? pick(a.fact) : tr("Observe o animal para abrir a ficha.", "Watch the animal to open the file.", "Observa al animal para abrir la ficha.")));
    const res = el("p", "uni-res"), opts = el("div", "uni-opts");
    const did = (act) => z.dia[`${id}:${act}`] === today();
    const btn = (label, disabled, fn) => { const x = el("button", "choice-btn", label); x.type = "button"; x.disabled = disabled; x.addEventListener("click", fn); opts.appendChild(x); return x; };
    btn(did("obs") ? tr("👀 Já observou hoje", "👀 Already watched today", "👀 Ya observaste hoy") : `👀 ${tr("Observar (+2)", "Watch (+2)", "Observar (+2)")}`, did("obs"), () => { z.dia[`${id}:obs`] = today(); z.obs[id] = (z.obs[id] || 0) + 1; advanceClock(10); state.xp += 1; if (typeof Events !== "undefined") Events.calm(2); addPts(2); openAnimal(id); });
    btn(did("feed") ? tr("🥕 Já alimentou hoje", "🥕 Already fed today", "🥕 Ya alimentaste hoy") : `🥕 ${tr("Alimentar (🪙3, +3)", "Feed (🪙3, +3)", "Alimentar (🪙3, +3)")}`, did("feed") || state.coins < 3, () => { state.coins -= 3; z.dia[`${id}:feed`] = today(); addPts(3); openAnimal(id); });
    const doados = Number((z.dia[`${id}:don`] || "").split("|")[1] || 0), dHoje = String(z.dia[`${id}:don`] || "").startsWith(today() + "|") ? doados : 0;
    btn(`💚 ${tr("Doar ao projeto (🪙10, +5)", "Donate to the project (🪙10, +5)", "Donar al proyecto (🪙10, +5)")} ${dHoje}/3`, dHoje >= 3 || state.coins < 10, () => { state.coins -= 10; z.doado += 10; z.dia[`${id}:don`] = `${today()}|${dHoje + 1}`; addPts(5); openAnimal(id); });
    body.appendChild(opts); body.appendChild(res);
    openModal("hosp-modal");
  }

  // ---------------------------------------------------------------- álbum: nível, selos e onde ver cada bioma no mapa
  function openAlbum() {
    const z = st(), body = $("hosp-body"); body.textContent = "";
    $("hosp-title").textContent = `📒 ${tr("Álbum do zoológico", "Zoo album", "Álbum del zoológico")}`;
    const lv = levelOf(z.pts), next = LEVELS[lv + 1];
    body.appendChild(el("p", "uni-q", `🦁 ${pick(LEVELS[lv].name)} · ${z.pts} ${tr("pontos", "points", "puntos")}${next ? ` · ${tr("próximo nível em", "next level at", "próximo nivel en")} ${next.at}` : ""} · 🏅 ${sealCount()}/${biomes().length}`));
    const bar = el("div", "uni-bar"); bar.appendChild(el("i")); bar.firstChild.style.width = `${next ? Math.min(100, ((z.pts - LEVELS[lv].at) / (next.at - LEVELS[lv].at)) * 100) : 100}%`; body.appendChild(bar);
    const locs = (W().locations || []);
    biomes().forEach((b) => {
      const row = el("div", "message-item chat-msg"), c = el("div", "chat-body"), h = el("div", "chat-head");
      h.appendChild(el("strong", null, `${z.seals[b.id] ? "🏅" : b.emoji} ${pick(b.name)}`)); c.appendChild(h);
      c.appendChild(el("p", "shop-note", b.animals.map((id) => { const a = animal(id); return `${a.emoji} ${pick(a.name)} ${Math.min(3, z.obs[id] || 0)}/3`; }).join(" · ")));
      const here = locs.filter((l) => l.biome === b.id && l.id !== "zoo" && !/^rua/.test(l.id)).map((l) => `${l.emoji || ""} ${pick(l.name)}`);
      if (here.length) c.appendChild(el("p", "shop-note muted", `${tr("No mapa", "On the map", "En el mapa")}: ${here.join(", ")}`));
      row.appendChild(c); body.appendChild(row);
    });
    openModal("hosp-modal");
  }
  function action(spec) {
    const [kind, id] = spec.split(":");
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("zoo"), 500);
    if (kind === "animal") return openAnimal(id);
    if (kind === "album") return openAlbum();
  }
  return { st, animals, biomes, animal, biome, LEVELS, levelOf, sealCount, areaUnlocked, addPts, openAnimal, openAlbum, action };
})();
window.Zoo = Zoo;

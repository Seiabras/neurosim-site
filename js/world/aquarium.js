"use strict";

// ===========================================================================
// Aquário do consultório: tanque com níveis, decoração, equipamentos, cuidados diários, pesca e enciclopédia.
// Os dados (espécies, tanques, peças) estão em aquarium-data.js; o desenho 3D do tanque, em aquarium3d.js.
// Estado: state.aquarium = { have:{id:true}, tank:1, decor:{id:true}, gear:{id:true}, fed:"dia", cleaned:número do dia,
//                            last:"semana:dia" (pesca antiga), casts:{day, n}, seen:{id:true} }
// Saúde (0–100) = 50 + água (filtro, bolhas) + conforto (aquecedor) + beleza (decoração, luz) − lotação − descuido − fome.
// Saúde ≥ 75 dá +2 de energia ao acordar; ≥ 50, +1.
// ===========================================================================
const Aquarium = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const D = window.AQ_DATA;
  const SPECIES = D.SPECIES;
  const CASTS = 3, CAST_ENERGY = 3;
  const COINS_DUP = { comum: 4, raro: 9, epico: 18, lendario: 35 };   // criatura repetida vira moedas

  const byId = (id) => SPECIES.find((s) => s.id === id);
  const st = () => { const a = (state.aquarium = state.aquarium || {}); a.have = a.have || {}; a.decor = a.decor || {}; a.gear = a.gear || {}; a.seen = a.seen || {}; if (!a.tank) a.tank = 1; return a; };
  const hasTank = () => Boolean(state.owned && state.owned.aquario);
  const owned = () => SPECIES.filter((s) => (s.from === "base" && hasTank()) || st().have[s.id]);
  const has = (id) => owned().some((s) => s.id === id);
  const dayKey = () => `${state.week || 1}:${state.dayIndex}`;
  const absDay = () => ((state.week || 1) - 1) * 7 + (state.dayIndex || 0);
  const tankDef = () => D.TANKS[Math.min(D.TANKS.length, st().tank) - 1];
  const gearOn = (id) => Boolean(st().gear[id]);

  // quem realmente mora no tanque (as espécies que cabem, na ordem em que foram ganhas)
  function placed() {
    const cap = tankDef().cap; let used = 0; const out = [];
    owned().forEach((s) => { if (used + s.size <= cap) { used += s.size; out.push(s); } });
    return out;
  }
  const usedSlots = () => owned().reduce((n, s) => n + s.size, 0);

  function stats() {
    const a = st(), t = tankDef();
    const water = D.GEAR.reduce((n, g) => n + (gearOn(g.id) ? g.water || 0 : 0), 0);
    const comfort = D.GEAR.reduce((n, g) => n + (gearOn(g.id) ? g.comfort || 0 : 0), 0);
    const beauty = D.GEAR.reduce((n, g) => n + (gearOn(g.id) ? g.beauty || 0 : 0), 0) + D.DECOR.reduce((n, d) => n + (a.decor[d.id] ? d.beauty : 0), 0);
    const ratio = usedSlots() / t.cap, crowd = ratio > 0.85 ? Math.round((ratio - 0.85) * 60) : 0;
    const dirtyDays = Math.max(0, absDay() - (a.cleaned === undefined ? absDay() : a.cleaned));
    const neglect = Math.min(24, Math.round(dirtyDays * 4 * (gearOn("filtro") ? 0.5 : 1)));
    const hungry = a.fed !== dayKey() && !gearOn("alimentador");
    const health = clamp(Math.round(50 + water + comfort + beauty - crowd - neglect - (hungry ? 10 : 0)), 0, 100);
    return { health, water, comfort, beauty, crowd, neglect, hungry, dirtyDays, used: usedSlots(), cap: t.cap };
  }
  const dayBonus = () => { if (!hasTank()) return 0; const h = stats().health; return h >= 75 ? 2 : h >= 50 ? 1 : 0; };

  // o que o cenário 3D precisa saber (e uma assinatura para reconstruir só quando algo muda)
  function spec3d() {
    const a = st(), t = tankDef(), s = stats();
    return { level: a.tank, w: t.w, cap: t.cap, species: placed(), decor: D.DECOR.filter((d) => a.decor[d.id]).map((d) => d.id), gear: { luz: gearOn("luz"), bolhas: gearOn("bolhas"), filtro: gearOn("filtro") }, health: s.health };
  }
  const sig = () => { if (!hasTank()) return ""; const a = st(); return [a.tank, placed().map((s) => s.id).join(), Object.keys(a.decor).sort().join(), Object.keys(a.gear).sort().join(), Math.floor(stats().health / 20)].join("|"); };

  function add(id) {
    if (!byId(id) || st().have[id]) return false;
    st().have[id] = true; st().seen[id] = true; saveState();
    if (typeof showToast === "function") setTimeout(() => showToast(`🐠 ${tr("Nova criatura no aquário", "New creature in the aquarium", "Nueva criatura en el acuario")}: ${pick(byId(id).name)}`), 500);
    return true;
  }

  // ------------------------------------------------------------ pesca
  const POOL = { fenda: ["fenda", "profundo", "recife"], praia: ["costa", "recife", "aberto"] };
  function castsLeft() { const c = st().casts; return !c || c.day !== dayKey() ? CASTS : Math.max(0, CASTS - c.n); }

  // 1) confere e cobra o lançamento; 2) o jogo interativo (Activities.fish) devolve q: 0 escapou, 1 pescou, 2 pescou com maestria;
  // 3) só então sorteia a criatura. Com opt.instant (testes) ou com as atividades desligadas, o resultado sai na hora.
  function fish(locId, opt) {
    const where = POOL[locId] ? locId : "fenda";
    if (!castsLeft()) return showToast(tr("Você já lançou a linha 3 vezes hoje. Volte amanhã!", "You already cast 3 times today. Come back tomorrow!", "Ya lanzaste 3 veces hoy. ¡Vuelve mañana!"));
    if (state.energy < CAST_ENERGY) return showToast(tr("Você está cansada demais para pescar.", "You're too tired to fish.", "Estás demasiado cansada para pescar."));
    const a = st(), c = a.casts && a.casts.day === dayKey() ? a.casts : (a.casts = { day: dayKey(), n: 0 });
    c.n++;
    state.energy = clamp(state.energy - CAST_ENERGY, 0, 100);
    advanceClock(15);
    saveState(); updateHud();
    if ((opt && opt.instant) || !((typeof Activities !== "undefined" && Activities.enabled()))) return land(where, 1);
    Activities.fish(where, (q) => land(where, q));
  }
  function land(where, q) {
    const a = st();
    const pool = SPECIES.filter((s) => s.from === "pesca" && POOL[where].includes(s.habitat));
    const fresh = pool.filter((s) => !a.have[s.id]);
    const use = fresh.length && Math.random() < 0.75 ? fresh : pool;
    const wt = (s) => D.RARITY[s.rarity].w * (q === 2 && s.rarity !== "comum" ? 2 : 1);   // pescar com maestria favorece as raridades
    let r = Math.random() * use.reduce((n, s) => n + wt(s), 0), f = use[0];
    for (const s of use) { r -= wt(s); if (r <= 0) { f = s; break; } }
    let msg;
    if (q === 0) msg = tr("O peixe escapou. Tente de novo!", "The fish got away. Try again!", "El pez escapó. ¡Inténtalo de nuevo!");
    else if (Math.random() < 0.12 && q === 1) msg = tr("Só pegou uma bota velha. 🥾", "Just an old boot. 🥾", "Solo pescaste una bota vieja. 🥾");
    else if (a.have[f.id]) { const m = COINS_DUP[f.rarity] || 4; state.coins += m; msg = `${tr("Pegou de novo", "Caught again", "Pescaste otra vez")}: ${pick(f.name)}. +${m} ${tr("moedas", "coins", "monedas")}`; }
    else { add(f.id); msg = `${tr("Você pescou", "You caught", "Pescaste")}: ${pick(f.name)} (${pick(D.RARITY[f.rarity].name)})!`; }
    saveState(); updateHud(); sfx(q ? "good" : "bad");
    showToast(`${msg} · ${castsLeft()}/${CASTS}`);
    if (!hasTank()) setTimeout(() => showToast(tr("Compre um aquário na loja de decoração para ver as criaturas.", "Buy an aquarium at the decor shop to see the creatures.", "Compra un acuario en la tienda de decoración para ver las criaturas.")), 3600);
  }
  const collect = (o) => fish("fenda", o);

  // ------------------------------------------------------------ cuidados e compras
  function feed() {
    if (st().fed === dayKey()) return showToast(tr("Eles já comeram hoje.", "They already ate today.", "Ya comieron hoy."));
    st().fed = dayKey(); state.xp += 1; saveState(); sfx("good"); refresh();
  }
  function clean() {
    if (st().cleaned === absDay()) return showToast(tr("O tanque já está limpo hoje.", "The tank is already clean today.", "El tanque ya está limpio hoy."));
    if (state.energy < 4) return showToast(tr("Você está cansada demais para limpar.", "You're too tired to clean.", "Estás demasiado cansada para limpiar."));
    state.energy = clamp(state.energy - 4, 0, 100); advanceClock(10); st().cleaned = absDay(); state.xp += 2; saveState(); updateHud(); sfx("good"); refresh();
  }
  function pay(price) { if (state.coins < price) { showToast(tr("Moedas insuficientes.", "Not enough coins.", "Monedas insuficientes.")); return false; } state.coins -= price; return true; }
  function buyTank() { const n = D.TANKS[st().tank]; if (!n || !pay(n.price)) return; st().tank++; saveState(); updateHud(); sfx("good"); refresh(); }
  function buyDecor(id) { const d = D.DECOR.find((x) => x.id === id); if (!d || st().decor[id] || !pay(d.price)) return; st().decor[id] = true; saveState(); updateHud(); sfx("good"); refresh(); }
  function buyGear(id) { const g = D.GEAR.find((x) => x.id === id); if (!g || st().gear[id] || !pay(g.price)) return; st().gear[id] = true; saveState(); updateHud(); sfx("good"); refresh(); }

  // ------------------------------------------------------------ tela
  let tab = "tanque", viewId = null;
  const rar = (s) => D.RARITY[s.rarity];
  function bar(label, val, max, color) {
    const w = el("div", "aqx-bar"); w.appendChild(el("span", "aqx-bar-l", label));
    const b = el("div", "aqx-bar-b"), f = el("div", "aqx-bar-f"); f.style.width = `${clamp(val / max, 0, 1) * 100}%`; if (color) f.style.background = color; b.appendChild(f); w.appendChild(b); w.appendChild(el("span", "aqx-bar-n", `${val}/${max}`)); return w;
  }
  function btn(text, fn, dis) { const b = el("button", "pill-btn small", text); b.type = "button"; if (dis) b.disabled = true; else b.addEventListener("click", fn); return b; }

  function tabTank(body) {
    const s = stats(), t = tankDef();
    const box = el("div", "aq-viewer aqx-tank"); box.id = "aq-viewer"; body.appendChild(box);
    body.appendChild(el("p", "shop-note", `${pick(t.name)} · ${tr("vagas", "slots", "cupos")} ${s.used}/${s.cap}${s.crowd ? " · " + tr("lotado!", "crowded!", "¡lleno!") : ""}`));
    body.appendChild(bar(tr("Saúde", "Health", "Salud"), s.health, 100, s.health >= 75 ? "#4fb86a" : s.health >= 50 ? "#e0b030" : "#d9534f"));
    body.appendChild(bar(tr("Beleza", "Beauty", "Belleza"), s.beauty, 40, "#b58af0"));
    const hints = [];
    if (s.hungry) hints.push(tr("Com fome: dê comida.", "Hungry: feed them.", "Con hambre: dales de comer."));
    if (s.dirtyDays >= 2) hints.push(tr(`Sujo há ${s.dirtyDays} dias: limpe o tanque.`, `Dirty for ${s.dirtyDays} days: clean the tank.`, `Sucio hace ${s.dirtyDays} días: limpia el tanque.`));
    if (s.crowd) hints.push(tr("Espaço apertado: compre um tanque maior.", "Cramped: buy a bigger tank.", "Espacio justo: compra un tanque mayor."));
    body.appendChild(el("p", "shop-note", hints.length ? "⚠️ " + hints.join(" ") : tr(`Tudo em ordem. Bônus de hoje ao acordar: +${dayBonus()} de energia.`, `All good. Wake-up bonus: +${dayBonus()} energy.`, `Todo en orden. Bono al despertar: +${dayBonus()} de energía.`)));
    const row = el("div", "aqx-row");
    row.appendChild(btn(`🍤 ${tr("Alimentar", "Feed", "Alimentar")}`, feed, st().fed === dayKey()));
    row.appendChild(btn(`🧽 ${tr("Limpar (4⚡)", "Clean (4⚡)", "Limpiar (4⚡)")}`, clean, st().cleaned === absDay()));
    body.appendChild(row);
    body.appendChild(el("p", "shop-note muted", tr(`Pesca: ${castsLeft()}/${CASTS} lançamentos hoje. Cais da praia e Fenda do Biquíni.`, `Fishing: ${castsLeft()}/${CASTS} casts today. Beach pier and Bikini Rift.`, `Pesca: ${castsLeft()}/${CASTS} lanzamientos hoy. Muelle de la playa y grieta submarina.`)));
    const ok = window.Scene3D && use3D() && Scene3D.mount(box, "aquarium", {});
    if (!ok) box.appendChild(el("div", "aq-fallback", "🐠"));
  }

  function tabCreatures(body) {
    const list = owned();
    body.appendChild(el("p", "uni-q", tr(`Coleção: ${list.length}/${SPECIES.length}. Toque para ver em 3D.`, `Collection: ${list.length}/${SPECIES.length}. Tap to see in 3D.`, `Colección: ${list.length}/${SPECIES.length}. Toca para verla en 3D.`)));
    const v = el("div", "aq-viewer"); v.id = "aq-viewer"; body.appendChild(v);
    const info = el("p", "shop-note"); info.id = "aq-info"; info.textContent = tr("Escolha uma criatura.", "Pick a creature.", "Elige una criatura."); body.appendChild(info);
    const grid = el("div", "aqx-grid");
    SPECIES.forEach((s) => {
      const got = list.includes(s), c = el("button", "aqx-card" + (got ? "" : " locked"), got ? s.name && pick(s.name) : "???");
      c.type = "button"; c.style.borderColor = got ? rar(s).c : "";
      c.appendChild(el("small", "", `${pick(rar(s).name)} · ${pick(D.HABITAT[s.habitat])}`.replace(/^.*$/, (m) => (got ? m : tr("Ainda não pescada", "Not caught yet", "Aún sin pescar")))));
      c.addEventListener("click", () => got ? view(s.id) : showToast(`${pick(D.HABITAT[s.habitat])} · ${pick(rar(s).name)}`));
      const th = el("div", "aqx-thumb"); c.prepend(th); c._th = th; c._id = s.id; c._got = got;
      grid.appendChild(c);
    });
    body.appendChild(grid);
    // miniaturas 3D (uma por vez, sem travar); as que ainda não foram pescadas aparecem como silhueta
    if (window.Scene3D && Scene3D.fishIcon && use3D()) {
      const cards = [...grid.children]; let i = 0;
      const next = () => { const c = cards[i++]; if (!c || !c.isConnected) return; const src = Scene3D.fishIcon(c._id); if (src) { const im = el("img", "aqx-img" + (c._got ? "" : " dark")); im.src = src; im.alt = ""; c._th.appendChild(im); } setTimeout(next, 12); };
      setTimeout(next, 30);
    }
    if (viewId && has(viewId)) view(viewId);
  }

  function tabShop(body) {
    const a = st();
    body.appendChild(el("p", "uni-q", `💰 ${state.coins}`));
    const sec = (h) => body.appendChild(el("h3", "aqx-h", h));
    const item = (name, about, price, owned, fn) => { const r = el("div", "aqx-item"); const t = el("div", "aqx-item-t"); t.appendChild(el("b", "", name)); t.appendChild(el("small", "", about)); r.appendChild(t); r.appendChild(owned ? el("span", "aqx-own", "✓") : btn(`${price} 🪙`, fn, state.coins < price)); body.appendChild(r); };
    sec(tr("Tanque", "Tank", "Tanque"));
    const nx = D.TANKS[a.tank];
    D.TANKS.forEach((t) => { if (t.lv === 1) return; item(pick(t.name), `${t.cap} ${tr("vagas", "slots", "cupos")}`, t.price, a.tank >= t.lv, () => (t.lv === a.tank + 1 ? buyTank() : showToast(tr("Compre o anterior primeiro.", "Buy the previous one first.", "Compra el anterior primero.")))); });
    void nx;
    sec(tr("Equipamentos", "Equipment", "Equipos"));
    D.GEAR.forEach((g) => item(pick(g.name), pick(g.about), g.price, a.gear[g.id], () => buyGear(g.id)));
    sec(tr("Decoração", "Decoration", "Decoración"));
    D.DECOR.forEach((d) => item(pick(d.name), `${tr("Beleza", "Beauty", "Belleza")} +${d.beauty}`, d.price, a.decor[d.id], () => buyDecor(d.id)));
  }

  function render() {
    const body = $("aq-body"); body.textContent = "";
    if (window.Scene3D) Scene3D.unmount($("aq-viewer") || undefined);
    const tabs = el("div", "shop-tabs");
    [["tanque", "🐠 " + tr("Tanque", "Tank", "Tanque")], ["criaturas", "📖 " + tr("Criaturas", "Creatures", "Criaturas")], ["loja", "🛒 " + tr("Loja", "Shop", "Tienda")]].forEach(([id, label]) => {
      const b = el("button", "shop-tab" + (id === tab ? " active" : ""), label); b.type = "button"; b.addEventListener("click", () => { tab = id; render(); }); tabs.appendChild(b);
    });
    body.appendChild(tabs);
    if (tab === "tanque") tabTank(body); else if (tab === "criaturas") tabCreatures(body); else tabShop(body);
  }
  // recarrega mantendo a rolagem (comprou, alimentou...)
  function refresh() { const m = $("aq-body"); const y = m ? m.parentElement.scrollTop : 0; render(); if (m) m.parentElement.scrollTop = y; }

  function open() {
    const body = $("aq-body");
    if (!hasTank()) { body.textContent = ""; body.appendChild(el("p", "uni-q", tr("Você ainda não tem um aquário. Compre um na loja de decoração.", "You don't have an aquarium yet. Buy one at the decor shop.", "Aún no tienes un acuario. Compra uno en la tienda de decoración."))); openModal("aq-modal"); return; }
    if (stats().health < 50 && tab === "tanque") { /* abre no tanque para mostrar os avisos */ }
    render(); openModal("aq-modal");
  }

  function view(id) {
    const s = byId(id); if (!s) return;
    viewId = id;
    const box = $("aq-viewer"); if (!box) return;
    box.textContent = "";
    $("aq-info").textContent = `${pick(s.name)} — ${pick(s.about)}`;
    const ok = window.Scene3D && use3D() && Scene3D.mount(box, "fish", { species: id });
    if (!ok) box.appendChild(el("div", "aq-fallback", "🐠"));
    sfx("click");
  }

  function close() { if (window.Scene3D) Scene3D.unmount($("aq-viewer") || undefined); viewId = null; }

  return { SPECIES, owned, has, add, collect, fish, open, view, close, hasTank, st, stats, dayBonus, spec3d, sig, feed, clean, castsLeft };
})();

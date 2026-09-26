"use strict";

// ===========================================================================
// Extras da vida na cidade: botons, óculos e bijuterias (loja de souvenirs),
// roupas exclusivas da boutique e o sistema de bichinhos de estimação
// ===========================================================================

const tx2 = (o) => I18N.pick(o);

// ---------------------------------------------------------------- bichinhos de estimação
const Pets = (function () {
  const MAX_PETS = 5;
  const data = () => window.PETS_DATA;
  const species = (id) => data().species.find((s) => s.id === id);
  const habitat = (id) => data().habitats.find((h) => h.id === id);
  const list = () => (state.pets = state.pets || []);
  const happy = (p) => state.dayIndex - (p.fed === undefined ? -9 : p.fed) <= 1;   // comeu hoje ou ontem
  const variantOf = (p) => { const sp = species(p.species); return sp && p.variant ? (sp.variants || []).find((v) => v.id === p.variant) || null : null; };
  const shineBonus = (p) => (p.shine ? (data().shine || {}).bonus || 1 : 0);
  const kindName = (p) => { const sp = species(p.species), v = variantOf(p); return v ? tx2(v.name) : tx2(sp.name); };
  // emoji do bichinho: a raça muda a cor por um filtro; o modo brilhante ganha estrelinhas
  let picCount = 0;
  function pic(p, cls) {
    const sp = species(p.species), v = variantOf(p);
    const box = el("div", cls || "pet-emoji" + (p.shine ? " shine" : ""));
    const e = el("span", "pet-face", sp.emoji);
    e.style.filter = `${v && v.tint ? v.tint + " " : ""}drop-shadow(0 0 1.5px rgba(30, 20, 40, 0.75))`;
    box.appendChild(e);
    if (p.shine) box.appendChild(el("span", "pet-sparkle", "✨"));
    if (window.Scene3D && Scene3D.petIcon && use3D()) {   // o mesmo bichinho 3D das salas, no lugar do emoji (gerado aos poucos, sem travar)
      setTimeout(() => { if (!box.isConnected) return; const src = Scene3D.petIcon(p.species, p.variant); if (!src) return; const im = el("img", "pet-3d"); im.src = src; im.alt = ""; box.replaceChild(im, e); }, 20 + (picCount++ % 30) * 25);
    }
    return box;
  }
  const levelOf = (bond) => data().levels.slice().reverse().find((l) => bond >= l.min) || data().levels[0];

  function matches(when, caseKey) {
    const c = CASES[caseKey] || SECRET[caseKey] || {};
    const kid = Boolean(c.kid);
    if (!when || when === "all") return true;
    if (when === "kid") return kid;
    if (when === "adult") return !kid;
    if (when.startsWith("group:")) return when.slice(6).split(",").includes(c.group);
    return false;
  }

  // bônus na consulta (entram junto com os itens da sala); só bichinhos bem cuidados ajudam
  function bonuses(ap, caseKey) {
    const out = [];
    list().forEach((p) => {
      const sp = species(p.species);
      if (!sp || !sp.bonus || !sp.bonus.ap || sp.bonus.ap !== ap || !happy(p)) return;
      if (matches(sp.bonus.when, caseKey)) out.push({ item: { name: `${sp.emoji}${p.shine ? "✨" : ""} ${p.name}` }, v: sp.bonus.v + shineBonus(p) });
    });
    return out;
  }

  const dayEnergy = () => list().reduce((s, p) => { const sp = species(p.species); return s + (sp && sp.bonus && sp.bonus.dayEnergy && happy(p) ? sp.bonus.dayEnergy : 0); }, 0);

  const followers = () => list().filter((p) => p.follow).slice(0, 3).map((p) => { const sp = species(p.species), v = variantOf(p); return { emoji: sp.emoji, size: sp.size || 30, tint: v && v.tint ? v.tint : "", shine: Boolean(p.shine) }; });   // a raça (cor) e o brilho seguem o bichinho até a cidade

  function bonusText(sp) {
    if (sp.bonus.dayEnergy) return `⚡ +${sp.bonus.dayEnergy} ${t("pets.dayenergy")}`;
    const ap = APPROACH[sp.bonus.ap];
    let when = t("pets.when.all");
    if (sp.bonus.when === "kid") when = t("pets.when.kid");
    else if (sp.bonus.when === "adult") when = t("pets.when.adult");
    else if (sp.bonus.when && sp.bonus.when.startsWith("group:")) {
      const names = sp.bonus.when.slice(6).split(",").map((id) => { const g = MANUAL_GROUPS.find((x) => x.id === id); return g ? g.title : id; });
      when = t("pets.when.group", { g: names.join(" / ") });
    }
    return `✨ ${ap.name} +${sp.bonus.v} · ${when}`;
  }

  // ---------------------------------------------------------------- ações
  function changed(msg) { shopMsg = msg || ""; saveState(); updateHud(); renderShop(); }

  // fonte: "generic" (nome genérico), "breed" (raça escolhida) ou "adoption" (centro de adoção, mais barato)
  function priceOf(sp, variantId, source) {
    const v = variantId ? (sp.variants || []).find((x) => x.id === variantId) : null;
    const base = sp.price + (v ? v.add || 0 : 0);
    return source === "adoption" ? Math.max(5, Math.round(base * 0.5)) : base;
  }

  function adopt(id, variantId, source, after) {
    const sp = species(id);
    if (!sp) return;
    source = source || (variantId ? "breed" : "generic");
    if (source !== "adoption" && !canBuyIn("pets")) return denyBuy("pets");
    const done = (msg) => { if (after) { saveState(); updateHud(); after(msg); } else changed(msg); };
    if (list().length >= MAX_PETS) return done(t("pets.limit", { n: MAX_PETS }));
    if (sp.needs && !state.ownedClothes[sp.needs]) return done(t("pets.needhab", { name: tx2(habitat(sp.needs).name) }));
    const price = priceOf(sp, variantId, source);
    if (state.coins < price) return done(t("shop.poor"));
    const v = variantId ? (sp.variants || []).find((x) => x.id === variantId) : null;
    const label = v ? tx2(v.name) : tx2(sp.name);
    let name = (window.prompt(t("pets.name.prompt", { species: label }), label) || "").trim();
    if (!name) name = label;
    name = name.slice(0, 16);
    const trait = data().traits[Math.floor(Math.random() * data().traits.length)];
    const shine = Math.random() < ((data().shine || {}).chance || {})[source];
    state.coins -= price;
    list().push({ id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`, species: id, variant: variantId || null, shine: Boolean(shine), name, trait: trait.id, bond: 0, fed: state.dayIndex, played: -1, petted: -1, follow: list().filter((x) => x.follow).length < 2 });
    sfx(shine ? "levelup" : "buy");
    if (shine && typeof showToast === "function") showToast(t("pets.shiny.adopted", { name }));
    done(shine ? t("pets.shiny.adopted", { name }) : t("pets.adopted", { name }));
  }

  function bump(p, amount) { p.bond = Math.min(100, (p.bond || 0) + amount); }

  function feed(p) {
    if (p.fed === state.dayIndex) return changed(t("pets.alreadyfed", { name: p.name }));
    if (state.coins < 2) return changed(t("shop.poor"));
    state.coins -= 2; p.fed = state.dayIndex; bump(p, 2); sfx("buy");
    changed(t("pets.fed", { name: p.name }));
  }

  function play(p) {
    if (p.played === state.dayIndex) return changed(t("pets.alreadyplayed", { name: p.name }));
    if (state.energy < 5) return changed(t("pets.tired"));
    state.energy = clamp(state.energy - 5, 0, 100); p.played = state.dayIndex; bump(p, 3); sfx("good");
    changed(t("pets.played", { name: p.name }));
  }

  function cuddle(p) {
    if (p.petted === state.dayIndex) return changed(t("pets.alreadypet", { name: p.name }));
    p.petted = state.dayIndex; bump(p, 1); sfx("equip");
    changed(t("pets.petted", { name: p.name }));
  }

  function buyHabitat(id) {
    const h = habitat(id);
    if (!h || state.ownedClothes[id]) return;
    if (!canBuyIn("pets")) return denyBuy("pets");
    if (state.coins < h.price) return changed(t("shop.poor"));
    state.coins -= h.price; state.ownedClothes[id] = true; sfx("buy");
    changed(t("shop.bought", { name: tx2(h.name) }));
  }

  // um "momento do bichinho" por dia: historinha e uma pequena recompensa
  function dailyMoment() {
    if (!list().length || state.petDay === state.dayIndex) return "";
    state.petDay = state.dayIndex;
    const p = list()[Math.floor(Math.random() * list().length)];
    const tr = data().traits.find((x) => x.id === p.trait) || data().traits[0];
    if (tr.coins) state.coins += tr.coins;
    saveState();
    return `${tr.emoji} ${tx2(tr.line).replace("{pet}", p.name)}${tr.coins ? ` (🪙 +${tr.coins})` : ""}`;
  }

  // ---------------------------------------------------------------- tela da loja de pets
  function petCard(p) {
    const sp = species(p.species);
    const tr = data().traits.find((x) => x.id === p.trait) || data().traits[0];
    const lvl = levelOf(p.bond);
    const card = el("div", "pet-card");
    card.appendChild(pic(p));
    const body = el("div", "pet-body");
    body.appendChild(el("div", "pet-name", `${p.name} · ${kindName(p)}${p.shine ? " ✨" : ""}`));
    body.appendChild(el("div", "pet-meta", `${tr.emoji} ${tx2(tr.name)}  ·  ${tx2(lvl.name)}  ·  ${happy(p) ? "😋 " + t("pets.fedstatus") : "🍽️ " + t("pets.hungry")}`));
    const bar = el("div", "pet-bar");
    const fill = el("b");
    fill.style.width = `${p.bond}%`;
    bar.appendChild(fill);
    body.appendChild(bar);
    body.appendChild(el("div", "shop-bonus", bonusText(sp)));
    const acts = el("div", "pet-actions");
    [["pets.feed", () => feed(p), p.fed === state.dayIndex], ["pets.play", () => play(p), p.played === state.dayIndex], ["pets.pet", () => cuddle(p), p.petted === state.dayIndex]].forEach(([key, fn, done]) => {
      const b = el("button", "pill-btn small", t(key));
      b.type = "button";
      b.disabled = done;
      b.addEventListener("click", fn);
      acts.appendChild(b);
    });
    const follow = el("label", "opt-check pet-follow");
    const cb = el("input");
    cb.type = "checkbox"; cb.checked = Boolean(p.follow);
    cb.addEventListener("change", () => { p.follow = cb.checked; saveState(); });
    follow.appendChild(cb);
    follow.appendChild(el("span", null, ` ${t("pets.follow")}`));
    body.appendChild(acts);
    body.appendChild(follow);
    card.appendChild(body);
    return card;
  }

  function speciesCard(sp) {
    const card = el("div", "shop-item pet-species" + (sp.kind === "exotic" ? " exotic" : ""));
    const ic = el("div", "shop-icon");
    ic.textContent = sp.emoji;
    ic.style.fontSize = "2rem";
    if (window.Scene3D && Scene3D.petIcon && use3D()) setTimeout(() => { if (!ic.isConnected) return; const src = Scene3D.petIcon(sp.id); if (src) { const im = el("img", "pet-3d"); im.src = src; im.alt = ""; ic.textContent = ""; ic.appendChild(im); } }, 20 + (picCount++ % 30) * 25);
    card.appendChild(ic);
    card.appendChild(el("div", "shop-name", tx2(sp.name)));
    card.appendChild(el("div", "pet-blurb", tx2(sp.blurb)));
    card.appendChild(el("div", "shop-bonus", bonusText(sp)));
    if (sp.care) card.appendChild(el("div", "pet-care", `🍽️ ${tx2(sp.care)}`));
    card.appendChild(el("div", "shop-price", `🪙 ${sp.price}`));
    const hab = sp.needs ? habitat(sp.needs) : null;
    const note = whereNote("pets");
    if (note) card.appendChild(note);
    let btn;
    if (hab && !state.ownedClothes[hab.id]) {
      card.appendChild(el("div", "shop-note", `${hab.emoji} ${t("pets.needs", { name: tx2(hab.name) })}`));
      btn = buyButton("pets", hab.price, `${t("shop.buy")} ${tx2(hab.name)} · 🪙 ${hab.price}`, () => buyHabitat(hab.id));
    } else {
      btn = buyButton("pets", sp.price, t("pets.adopt"), () => adopt(sp.id, null, "generic"));
      if (canBuyIn("pets") && list().length >= MAX_PETS) btn.disabled = true;
    }
    card.appendChild(btn);
    return card;
  }

  function render(container) {
    setTimeout(() => { if (screen === "shop") Tutor.topic("pets", [{ key: "pets1", target: "shop-list" }]); }, 700);
    const moment = dailyMoment();
    if (moment) { shopMsg = moment; $("shop-msg").textContent = shopMsg; updateHud(); }
    const mine = el("section", "shop-group");
    mine.appendChild(el("h2", null, `${t("pets.title")} (${list().length}/${MAX_PETS})`));
    if (!list().length) mine.appendChild(el("p", "shop-note", t("pets.none")));
    list().forEach((p) => mine.appendChild(petCard(p)));
    container.appendChild(mine);
    const tabs = el("div", "pin-tabs");
    [["general", "pets.tab.general"], ["breeds", "pets.tab.breeds"]].forEach(([id, key]) => {
      const b = el("button", "pill-btn small" + (petTab === id ? " active" : ""), t(key));
      b.type = "button";
      b.addEventListener("click", () => { petTab = id; renderShop(); });
      tabs.appendChild(b);
    });
    container.appendChild(tabs);
    if (petTab === "breeds") {
      container.appendChild(el("p", "shop-note", t("pets.breeds.note")));
      data().species.filter((s) => (s.variants || []).length).forEach((sp) => {
        const group = el("section", "shop-group");
        group.appendChild(el("h2", null, `${sp.emoji} ${tx2(sp.name)}`));
        const grid = el("div", "shop-grid");
        sp.variants.forEach((v) => grid.appendChild(breedCard(sp, v)));
        group.appendChild(grid);
        container.appendChild(group);
      });
      return;
    }
    [["common", "pets.common"], ["exotic", "pets.exotic"]].forEach(([kind, key]) => {
      const group = el("section", "shop-group");
      group.appendChild(el("h2", null, t(key)));
      if (kind === "exotic") group.appendChild(el("p", "shop-note", t("pets.exotic.note")));
      const grid = el("div", "shop-grid");
      data().species.filter((s) => s.kind === kind).forEach((s) => grid.appendChild(speciesCard(s)));
      group.appendChild(grid);
      container.appendChild(group);
    });
  }

  function breedCard(sp, v) {
    const card = el("div", "shop-item pet-species");
    const ic = el("div", "shop-icon");
    ic.appendChild(pic({ species: sp.id, variant: v.id }, "pet-emoji"));
    card.appendChild(ic);
    card.appendChild(el("div", "shop-name", tx2(v.name)));
    card.appendChild(el("div", "pet-blurb", t("pets.breedof", { name: tx2(sp.name) })));
    const price = priceOf(sp, v.id, "breed");
    card.appendChild(el("div", "shop-price", `🪙 ${price}`));
    const hab = sp.needs ? habitat(sp.needs) : null;
    const note = whereNote("pets");
    if (note) card.appendChild(note);
    if (hab && !state.ownedClothes[hab.id]) {
      card.appendChild(el("div", "shop-note", `${hab.emoji} ${t("pets.needs", { name: tx2(hab.name) })}`));
      card.appendChild(buyButton("pets", hab.price, `${t("shop.buy")} ${tx2(hab.name)} · 🪙 ${hab.price}`, () => buyHabitat(hab.id)));
    } else {
      const btn = buyButton("pets", price, t("pets.adopt"), () => adopt(sp.id, v.id, "breed"));
      if (canBuyIn("pets") && list().length >= MAX_PETS) btn.disabled = true;
      card.appendChild(btn);
    }
    return card;
  }

  // ---------------------------------------------------------------- centro de adoção: bichinhos do dia, metade do preço
  function todaysAnimals() {
    let seed = (state.dayIndex + 1) * 9973;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pool = data().species.slice();
    const out = [];
    while (out.length < 4 && pool.length) {
      const sp = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const vs = sp.variants || [];
      out.push({ species: sp.id, variant: vs.length && rnd() < 0.7 ? vs[Math.floor(rnd() * vs.length)].id : null });
    }
    return out;
  }

  function openAdoption() {
    const body = $("adopt-body");
    const draw = (msg) => {
      body.textContent = "";
      body.appendChild(el("p", "uni-q", t("adopt.intro", { n: list().length, max: MAX_PETS })));
      if (msg) body.appendChild(el("p", "uni-res", msg));
      const grid = el("div", "shop-grid");
      todaysAnimals().forEach((a, i) => {
        const sp = species(a.species), v = a.variant ? (sp.variants || []).find((x) => x.id === a.variant) : null;
        const key = `${state.dayIndex}:${i}`;
        const card = el("div", "shop-item pet-species");
        const ic = el("div", "shop-icon");
        ic.appendChild(pic({ species: a.species, variant: a.variant }, "pet-emoji"));
        card.appendChild(ic);
        card.appendChild(el("div", "shop-name", v ? tx2(v.name) : tx2(sp.name)));
        card.appendChild(el("div", "pet-blurb", tx2(sp.blurb)));
        const price = priceOf(sp, a.variant, "adoption");
        card.appendChild(el("div", "shop-price", `🪙 ${price}`));
        const taken = (state.adopted = state.adopted || {})[key];
        const btn = el("button", "pill-btn small", taken ? t("adopt.taken") : t("pets.adopt"));
        btn.type = "button";
        btn.disabled = Boolean(taken);
        btn.addEventListener("click", () => {
          const before = list().length;
          adopt(a.species, a.variant, "adoption", (m) => { if (list().length > before) state.adopted[key] = true; saveState(); updateHud(); draw(m); });
        });
        card.appendChild(btn);
        grid.appendChild(card);
      });
      body.appendChild(grid);
    };
    draw("");
    openModal("adopt-modal");
  }

  return { render, bonuses, dayEnergy, followers, list, openAdoption, kindName };
})();

// ---------------------------------------------------------------- botons, óculos e bijuterias
let pinFilter = "", petTab = "general";

function pinKindOf(def) {
  if (def.kind && def.kind.startsWith("gl-")) return "gl";
  if (def.kind) return "jewel";
  return "pin";
}

const pinField = { pin: "pin", gl: "gl", jewel: "jewel" };

function pinCard(def) {
  const kind = pinKindOf(def);
  const p = state.player;
  const owned = Boolean(state.ownedClothes[def.id]);
  const wearing = p[pinField[kind]] === def.id;
  const card = el("div", "shop-item pin-card" + (wearing ? " in-use" : ""));
  const ic = el("div", "shop-icon pin-holder");
  ic.innerHTML = Pins.icon(def);
  card.appendChild(ic);
  card.appendChild(el("div", "shop-name", tx2(def.name)));
  card.appendChild(el("div", "shop-price", owned ? t("shop.owned") : `🪙 ${def.price}`));
  let btn = el("button", "pill-btn small");
  btn.type = "button";
  if (!owned) {
    const note = whereNote("souvenirs");
    if (note) card.appendChild(note);
    btn = buyButton("souvenirs", def.price, t("shop.buy"), () => {
      if (!canBuyIn("souvenirs")) return denyBuy("souvenirs");
      if (state.coins < def.price) return shopChanged(t("shop.poor"));
      state.coins -= def.price; state.ownedClothes[def.id] = true; p[pinField[kind]] = def.id; sfx("buy");
      shopChanged(t("shop.bought", { name: tx2(def.name) }));
    });
  } else if (wearing) {
    btn.textContent = t("souv.remove");
    btn.addEventListener("click", () => { delete p[pinField[kind]]; sfx("equip"); shopChanged(t("shop.stored")); });
  } else {
    btn.textContent = t("shop.use");
    btn.addEventListener("click", () => { p[pinField[kind]] = def.id; sfx("equip"); shopChanged(t("shop.equipped", { name: tx2(def.name) })); });
  }
  card.appendChild(btn);
  return card;
}

// bandeiras por confederação; clicar num país ou região abre as abas de estados e cidades
let flagRegion = "ALL", flagSub = "ALL", flagOpen = null, flagTab = "states", flagPagina = 0;
const PIN_PASSO = 60;                  // quantos cartões por vez (o Reino Unido tem 221 subdivisões)

function flagSection(list) {
  const D = window.PINS_DATA;
  Pins.normalizar();                   // cada subdivisão ganha o seu selo antes de qualquer cartão ser montado
  const group = el("section", "shop-group");
  group.appendChild(el("h2", null, `${t("souv.flags")} (${D.flags.length})`));
  const note = el("p", "shop-note", t("souv.flagnote"));
  group.appendChild(note);
  const nSub = Pins.subs().length;
  // 5326 lido de enfiada não diz nada: separa o milhar, e sem confiar no código do idioma do jogo
  // (o "zt" do chinês tradicional não é código de locale e o Intl reclamaria)
  const milhar = (n) => { try { return n.toLocaleString(I18N.lang === "en" ? "en-US" : "pt-BR"); } catch (e) { return String(n); } };
  if (nSub) group.appendChild(el("p", "shop-note", t("souv.subcount", { n: milhar(nSub), p: Object.keys(D.subdivisions || {}).length })));
  const input = el("input", "pin-filter");
  input.type = "search"; input.placeholder = t("souv.filter"); input.value = pinFilter;
  input.id = "pin-busca";              // o tutorial aponta para cá (Tutor.topic resolve o destino por id)
  group.appendChild(input);
  const tabs = el("div", "pin-tabs");
  group.appendChild(tabs);
  const body = el("div", "pin-flagbody");
  group.appendChild(body);
  const regions = Object.keys(D.regions || {});
  const subsOf = (id) => (D.subdivisions || {})[id];
  const fill = () => {
    tabs.textContent = "";
    if (flagOpen) {
      const parent = D.flags.find((f) => f.id === flagOpen);
      const back = el("button", "pill-btn small", "← " + t("souv.back"));
      back.type = "button";
      back.addEventListener("click", () => { flagOpen = null; flagPagina = 0; fill(); });
      tabs.appendChild(back);
      ["states", "cities"].forEach((k) => {
        const n = ((subsOf(flagOpen) || {})[k] || []).length;
        const b = el("button", "pill-btn small" + (flagTab === k ? " active" : ""), `${t("souv." + k)} (${n})`);
        b.type = "button";
        b.addEventListener("click", () => { flagTab = k; flagPagina = 0; fill(); });
        tabs.appendChild(b);
      });
      body.textContent = "";
      const head = el("div", "pin-parent");
      head.innerHTML = Pins.icon(parent);
      head.appendChild(el("strong", null, tx2(parent.name)));
      body.appendChild(head);
      const grid = el("div", "shop-grid pin-grid");
      const items = (subsOf(flagOpen) || {})[flagTab] || [];
      if (flagTab === "states") grid.appendChild(pinCard(parent));
      const mostra = items.slice(0, (flagPagina + 1) * PIN_PASSO);
      mostra.forEach((d) => grid.appendChild(pinCard(d)));
      if (!items.length) grid.appendChild(el("p", "shop-note", t("souv.nosub")));
      body.appendChild(grid);
      if (mostra.length < items.length) {
        const mais = el("button", "pill-btn small", t("souv.more", { n: items.length - mostra.length }));
        mais.type = "button";
        mais.addEventListener("click", () => { flagPagina++; fill(); });
        body.appendChild(mais);
      }
      return;
    }
    // regiões do mundo (não as confederações da FIFA): América do Sul, do Norte, Central, Europa, Ásia, África, Oceania, cada uma com sub-regiões
    const geo = D.geo || [];
    [["ALL", "🗺️ " + t("souv.all")]].concat(geo.map((g) => [g.id, `${g.icon} ${tx2(g.name)}`])).forEach(([r, label]) => {
      const n = r === "ALL" ? D.flags.length : D.flags.filter((d) => d.geo === r).length;
      const b = el("button", "pill-btn small" + (flagRegion === r ? " active" : ""), `${label} (${n})`);
      b.type = "button";
      b.addEventListener("click", () => { flagRegion = r; flagSub = "ALL"; fill(); });
      tabs.appendChild(b);
    });
    const cur = geo.find((g) => g.id === flagRegion);
    if (cur) {
      const subTabs = el("div", "pin-subtabs");
      [{ id: "ALL", name: null }].concat(cur.subs).forEach((sb) => {
        const n = sb.id === "ALL" ? D.flags.filter((d) => d.geo === cur.id).length : D.flags.filter((d) => d.sub === sb.id).length;
        const b = el("button", "pill-btn small ghost" + (flagSub === sb.id ? " active" : ""), `${sb.name ? tx2(sb.name) : t("souv.all")} (${n})`);
        b.type = "button";
        b.addEventListener("click", () => { flagSub = sb.id; fill(); });
        subTabs.appendChild(b);
      });
      tabs.appendChild(subTabs);
    }
    body.textContent = "";
    const q = pinFilter.trim().toLowerCase();
    const grid = el("div", "shop-grid pin-grid");
    D.flags.filter((d) => (flagRegion === "ALL" || d.geo === flagRegion) && (flagSub === "ALL" || d.sub === flagSub) && (!q || tx2(d.name).toLowerCase().includes(q))).forEach((d) => {
      const card = pinCard(d);
      const sd = subsOf(d.id);
      if (sd) {
        const more = el("button", "pill-btn small ghost", `▸ ${t("souv.states")} / ${t("souv.cities")}`);
        more.type = "button";
        more.addEventListener("click", () => { flagOpen = d.id; flagTab = "states"; fill(); });
        card.appendChild(more);
      }
      grid.appendChild(card);
    });
    if (!grid.children.length) grid.appendChild(el("p", "shop-note", t("souv.none")));
    body.appendChild(grid);
    // BUSCA NAS REGIÕES (7.13): com 5.326 subdivisões, achar a Baviera abrindo país por país era inviável.
    // A partir de duas letras a busca desce para dentro dos países e diz de onde é cada achado.
    if (q.length >= 2) {
      const achados = Pins.subs().filter((d) => tx2(d.name).toLowerCase().includes(q));
      if (achados.length) {
        body.appendChild(el("h3", "pin-subhead", t("souv.subhits", { n: achados.length })));
        const g2 = el("div", "shop-grid pin-grid");
        achados.slice(0, PIN_PASSO).forEach((d) => {
          const card = pinCard(d);
          const pai = D.flags.find((f) => f.id === d.parent);
          if (pai) card.insertBefore(el("div", "shop-note", tx2(pai.name)), card.querySelector(".shop-price"));
          g2.appendChild(card);
        });
        body.appendChild(g2);
        if (achados.length > PIN_PASSO) body.appendChild(el("p", "shop-note", t("souv.narrow", { n: achados.length - PIN_PASSO })));
      }
    }
  };
  input.addEventListener("input", () => { pinFilter = input.value; flagOpen = null; flagPagina = 0; fill(); });
  fill();
  list.appendChild(group);
}

function renderSouvenirs(list) {
  setTimeout(() => { if (screen === "shop") Tutor.topic("souv", [{ key: "souv1", target: "wardrobe" }, { key: "souv2", target: "pin-busca" }]); }, 700);
  const D = window.PINS_DATA;
  const section = (title, defs, filterable) => {
    const group = el("section", "shop-group");
    group.appendChild(el("h2", null, title));
    if (filterable) {
      const input = el("input", "pin-filter");
      input.type = "search";
      input.placeholder = t("souv.filter");
      input.value = pinFilter;
      group.appendChild(input);
      const grid = el("div", "shop-grid pin-grid");
      const fill = () => {
        grid.textContent = "";
        const q = pinFilter.trim().toLowerCase();
        defs.filter((d) => !q || tx2(d.name).toLowerCase().includes(q)).forEach((d) => grid.appendChild(pinCard(d)));
        if (!grid.children.length) grid.appendChild(el("p", "shop-note", t("souv.none")));
      };
      input.addEventListener("input", () => { pinFilter = input.value; fill(); });
      fill();
      group.appendChild(grid);
    } else {
      const grid = el("div", "shop-grid pin-grid");
      defs.forEach((d) => grid.appendChild(pinCard(d)));
      group.appendChild(grid);
    }
    list.appendChild(group);
  };
  section(t("souv.causes"), D.movements, false);
  flagSection(list);
  section(t("souv.glasses"), D.glasses, false);
  section(t("souv.jewels"), D.jewels, false);
}

window.Pets = Pets;
window.Pins_ready = true;

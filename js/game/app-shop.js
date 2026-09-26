"use strict";

// ===========================================================================
// Sala (3D com volta ao 2D), loja com áreas e expansões, guarda-roupa
// ===========================================================================

// Desenha a sala no contêiner. Devolve true se usou o 3D.
function renderRoom(container, opts = {}) {
  if (use3D()) {
    const ok = window.Scene3D.mount(container, opts.scene || "room", Object.assign({}, opts, {
      base: opts.base3d !== undefined ? opts.base3d : opts.base !== false
    }));
    if (ok) return true;
  }
  if (window.Scene3D) window.Scene3D.unmount(container);
  container.classList.remove("is3d");
  render2DRoom(container, opts);
  return false;
}

// Versão 2D simples (para quem não tem WebGL ou desligou o 3D): parede, chão, janela e os itens em fileira.
function render2DRoom(container, opts) {
  container.textContent = "";
  container.style.setProperty("--wall", opts.scene === "casa" ? (opts.homeWall || wallColorOf("casa")) : (opts.wall || wallColorOf("consultorio")));
  container.appendChild(el("div", "room-window"));
  container.appendChild(el("div", "room-floor"));
  const ids = opts.scene === "casa" ? (opts.homeWorn || []).concat(opts.kitchen ? opts.kitchenWorn || [] : []) : (opts.worn || []).concat(opts.espera ? opts.esperaWorn || [] : []);
  const shelf = el("div", "room-shelf");
  ids.forEach((id) => {
    const it = itemById(id);
    if (!it) return;
    const node = el("span", "room-item2d", it.emoji || "▪");
    if (it.color && !it.emoji) node.style.background = it.color;
    node.title = it.name;
    shelf.appendChild(node);
  });
  container.appendChild(shelf);
}

// ---------------------------------------------------------------- loja
// Compras só nas lojas da cidade. Em casa dá para ver e usar o que já se tem, mas comprar é bloqueado.
const STORES = {
  decor: ["consultorio", "espera", "casa", "cozinha", "sazonal"],
  roupas: ["roupas"], boutique: ["boutique"], souvenirs: ["souvenirs"], pets: ["pets"]
};
const ensureStores = () => (SHOP && SHOP.stores ? SHOP.stores : []).forEach((st) => { STORES[st.id] = ["consultorio", "casa"]; });   // lojas de móveis por bairro (content/shop.json → stores)
const storeName = (id) => { ensureStores(); const st = (SHOP.stores || []).find((x) => x.id === id); return st ? `${st.emoji} ${st.name}` : t("store." + id); };
let shopStore = null;                                    // null = em casa; senão, a loja onde você está
const storeOfArea = (areaId) => ["decor", "roupas", "boutique", "souvenirs", "pets"].find((k) => STORES[k].includes(areaId)) || "decor";
const storeKey = (key) => (ensureStores(), (SHOP.stores || []).some((x) => x.id === key) ? key : storeOfArea(key));   // aceita o id de uma loja ou de uma área
const canBuyIn = (key) => shopStore !== null && storeKey(key) === shopStore;
const storeOfItem = (it) => it.store || storeOfArea(it.area);
// peça exclusiva de uma loja: só aparece no menu depois de conhecer a loja (entrar nela) ou de comprar a peça
const shopSeen = () => (state.shopSeen = state.shopSeen || {});
const itemVisible = (it) => !it.store || Boolean(state.owned[it.id]) || Boolean(shopSeen()[it.store]) || Boolean(settings.dev && settings.unlockAll);

function flashDeny() {
  const f = $("deny-flash");
  f.classList.remove("on");
  void f.offsetWidth;
  f.classList.add("on");
}

function denyBuy(areaId) {
  sfx("deny");
  flashDeny();
  showToast(t("deny.text", { store: storeName(storeKey(areaId)) }));
}

// botão de compra: bloqueado (com o aviso "compra-se em…") quando você não está na loja certa
function buyButton(areaId, price, label, onBuy) {
  const btn = el("button", "pill-btn small");
  btn.type = "button";
  if (!canBuyIn(areaId)) {
    btn.textContent = `🔒 ${label}`;
    btn.classList.add("locked");
    btn.addEventListener("click", () => denyBuy(areaId));
  } else {
    btn.textContent = label;
    btn.disabled = state.coins < price;
    btn.addEventListener("click", onBuy);
  }
  return btn;
}

const whereNote = (areaId) => (canBuyIn(areaId) ? null : el("div", "shop-where-note", t("deny.where", { store: storeName(storeKey(areaId)) })));

let shopTab = "consultorio";
let shopFilter = "all";
let shopMsg = "";

const areaById = (id) => SHOP.areas.find((a) => a.id === id) || (id === "lojas" ? GUIDE_AREA : undefined);
const areaUnlocked = (area) => !area.needs || Boolean(state.expansions[area.needs]);

const GUIDE_AREA = { id: "lojas", icon: "🧭", name: I18N.pick(window.L("Lojas da cidade", "City shops", "Tiendas de la ciudad")), guide: true };
function visibleAreas() {
  const base = visibleAreasRaw();
  return shopStore === null && (SHOP.stores || []).length ? base.concat([Object.assign({}, GUIDE_AREA, { name: I18N.pick(window.L("Lojas da cidade", "City shops", "Tiendas de la ciudad")) })]) : base;
}
function visibleAreasRaw() {
  return SHOP.areas.filter((a) => (!a.secret || SHOP.items.some((it) => it.area === a.id && state.owned[it.id])) && (shopStore === null || STORES[shopStore].includes(a.id)));
}

function equippedIn(area, slot) { return (state.equipped[area] || {})[slot]; }

function shopChanged(message) {
  shopMsg = message || "";
  saveState();
  updateHud();
  renderShop();
}

function itemCard(it, area) {
  const owned = isOwned(it);
  const inUse = equippedIn(it.area, it.slot) === it.id;
  const isColor = it.slot === "cor" || it.slot === "c-cor";
  const card = el("div", "shop-item" + (inUse ? " in-use" : ""));
  const icon = el("div", "shop-icon");
  if (it.emoji && !isColor) {
    icon.textContent = it.emoji;
    if (window.Scene3D && Scene3D.iconAsync && use3D()) Scene3D.iconAsync(it.id, (src) => {   // o mesmo modelo 3D da sala, como ícone
      if (!src || !icon.isConnected) return;
      const im = el("img", "shop-icon-3d"); im.src = src; im.alt = ""; icon.textContent = ""; icon.appendChild(im);
    });
  } else { icon.classList.add("swatch"); icon.style.background = it.color; }
  card.appendChild(icon);
  card.appendChild(el("div", "shop-name", it.name));
  card.appendChild(el("div", "shop-price", owned ? (it.price === 0 ? t("shop.free") : t("shop.owned")) : `🪙 ${it.price}`));
  if (it.bonus) card.appendChild(el("div", "shop-bonus", `✨ ${APPROACH[it.bonus.ap].name} +${it.bonus.v}`));
  if (it.dayEnergy) card.appendChild(el("div", "shop-bonus", `⚡ +${it.dayEnergy}`));
  const btn = el("button", "pill-btn small");
  btn.type = "button";
  btn.dataset.item = it.id;
  if (!owned) {
    const note = whereNote(it.store || it.area);
    if (note) card.appendChild(note);
    const b = buyButton(it.store || it.area, it.price, t("shop.buy"), () => buyItem(it.id));
    b.dataset.item = it.id;
    card.appendChild(b);
    return card;
  } else if (inUse && isColor) {
    btn.textContent = t("shop.inuse");
    btn.disabled = true;
  } else if (inUse) {
    btn.textContent = t("shop.store");
    btn.addEventListener("click", () => unequipSlot(it.area, it.slot));
  } else {
    btn.textContent = t("shop.use");
    btn.addEventListener("click", () => equipItem(it.id));
  }
  card.appendChild(btn);
  return card;
}

function renderShop() {
  ensureStores();
  if (tryOn && !["roupas", "boutique"].includes(shopTab)) tryOn = null;
  $("shop-coins").textContent = state.coins;
  $("shop-msg").textContent = shopMsg;
  $("shop-where").textContent = shopStore === null ? `🏠 ${t("shop.home.note")}` : `🏬 ${storeName(shopStore)}`;
  $("shop-where").classList.toggle("in-store", shopStore !== null);

  // abas
  const tabs = $("shop-tabs");
  tabs.textContent = "";
  visibleAreas().forEach((a) => {
    const btn = el("button", "shop-tab" + (a.id === shopTab ? " active" : ""), `${a.icon} ${a.name}${areaUnlocked(a) ? "" : " 🔒"}`);
    btn.type = "button";
    btn.dataset.area = a.id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(a.id === shopTab));
    btn.addEventListener("click", () => { shopTab = a.id; shopMsg = ""; sfx("click"); renderShop(); });
    tabs.appendChild(btn);
  });
  if (!visibleAreas().some((a) => a.id === shopTab)) shopTab = visibleAreas()[0].id;
  const area = areaById(shopTab);

  const list = $("shop-list");
  list.textContent = "";
  if (area.guide) { $("wardrobe").classList.add("hidden"); $("shop-room").classList.add("hidden"); renderStoreGuide(list); return; }

  // prévia: 3D da área, ou guarda-roupa
  const wardrobe = ["roupas", "boutique", "souvenirs"].includes(area.id);
  const petsTab = area.id === "pets";
  $("wardrobe").classList.toggle("hidden", !wardrobe);
  $("shop-room").classList.toggle("hidden", wardrobe || petsTab);
  if (petsTab) { Pets.render(list); return; }
  if (wardrobe) { renderWardrobe(list); return; }
  const scene = area.scene === "casa" ? "casa" : "room";
  renderRoom($("shop-room"), Object.assign(scenePlace(area.id), { scene, camera: "wide", base: true, drag: true, focus: area.id }));

  // Organizar os móveis, ampliar o cômodo e as dicas vão para o FIM da lista. Antes abriam a loja e
  // empurravam a primeira peça para 1287 px do topo no computador (e 2262 no celular): quem entra na
  // loja quer ver peças, não a sala e três cartões de administração.
  const rodape = document.createDocumentFragment();
  if (["consultorio", "espera", "casa"].includes(area.id) && areaUnlocked(area)) {
    const org = el("section", "shop-group decor-card");
    org.appendChild(el("h2", null, t("decor.title")));
    org.appendChild(el("p", "shop-note", t("decor.shop.text")));
    const ob = el("button", "pill-btn", t("decor.open"));
    ob.type = "button"; ob.addEventListener("click", () => Decor.open(area.id));
    org.appendChild(ob);
    rodape.appendChild(org);
    SHOP.expansions.filter((e) => e.size && e.area === (area.id === "espera" ? "consultorio" : area.id)).forEach((ex, i, arr) => {
      const card = el("section", "shop-group expansion");
      card.appendChild(el("h2", null, `${ex.emoji} ${ex.name}`));
      card.appendChild(el("p", "shop-note", ex.about));
      if (state.expansions[ex.id]) card.appendChild(el("p", "shop-note", "✅ " + t("shop.owned")));
      else if (i > 0 && !state.expansions[arr[i - 1].id]) card.appendChild(el("p", "shop-note muted", t("decor.size.first")));
      else {
        const btn = buyButton(ex.area, ex.price, `${t("shop.buy")} · 🪙 ${ex.price}`, () => buyExpansion(ex.id));
        btn.classList.remove("small"); btn.dataset.expansion = ex.id;
        card.appendChild(btn);
      }
      rodape.appendChild(card);
    });
  }

  if (area.id === "consultorio") {
    const helps = el("section", "shop-group");
    helps.appendChild(el("h2", null, t("shop.helps")));
    helps.appendChild(el("p", "shop-note", t("shop.helpstext", { n: HINT_COST })));
    rodape.appendChild(helps);
  }

  // expansão necessária
  if (area.needs && !areaUnlocked(area)) {
    const ex = EXP_MAP[area.needs];
    const card = el("section", "shop-group expansion");
    card.appendChild(el("h2", null, `${ex.emoji} ${t("shop.unlockcost", { name: ex.name })}`));
    card.appendChild(el("p", "shop-note", ex.about));
    const note = whereNote(area.id);
    if (note) card.appendChild(note);
    const btn = buyButton(area.id, ex.price, `${t("shop.buy")} · 🪙 ${ex.price}`, () => buyExpansion(ex.id));
    btn.classList.remove("small");
    btn.dataset.expansion = ex.id;
    card.appendChild(btn);
    card.appendChild(el("p", "shop-note muted", t("shop.locked")));
    list.appendChild(card);
    return;
  }

  // itens por categoria (as peças das lojas de bairro) ou por espaço (o resto); com filtro "todos / meus"
  const mine = SHOP.items.filter((it) => it.area === area.id && (!it.secretOnly || state.owned[it.id]) && itemVisible(it) && (shopStore === null || storeOfItem(it) === shopStore));
  const cats = [];
  mine.forEach((it) => { const g = it.cat || it.slot; if (!cats.includes(g)) cats.push(g); });
  if (mine.some((it) => it.cat)) {
    const bar = el("div", "shop-tabs shop-filter");
    [["all", "✨", I18N.pick(window.L("Todos", "All", "Todos"))], ["mine", "✅", I18N.pick(window.L("Meus", "Mine", "Míos"))]].concat(cats.filter((c) => SHOP.cats && SHOP.cats[c]).map((c) => [c, SHOP.cats[c].icon, I18N.pick(SHOP.cats[c].name)])).forEach(([id, icon, label]) => {
      const b = el("button", "shop-tab" + (shopFilter === id ? " active" : ""), `${icon} ${label}`); b.type = "button";
      b.addEventListener("click", () => { shopFilter = id; sfx("click"); renderShop(); }); bar.appendChild(b);
    });
    list.appendChild(bar);
  }
  const hidden = SHOP.items.filter((it) => it.area === area.id && it.store && !itemVisible(it)).length;
  cats.forEach((g) => {
    let items = mine.filter((it) => (it.cat || it.slot) === g);
    if (shopFilter === "mine") items = items.filter((it) => isOwned(it));
    else if (shopFilter !== "all" && SHOP.cats && SHOP.cats[shopFilter]) items = items.filter((it) => it.cat === shopFilter);
    if (!items.length) return;
    const group = el("section", "shop-group");
    const head = SHOP.cats && SHOP.cats[g] ? `${SHOP.cats[g].icon} ${I18N.pick(SHOP.cats[g].name)}` : SHOP.slots[g];
    group.appendChild(el("h2", null, head));
    const grid = el("div", "shop-grid");
    items.forEach((it) => grid.appendChild(itemCard(it, area)));
    group.appendChild(grid);
    list.appendChild(group);
  });
  if (shopStore === null && hidden) list.appendChild(el("p", "shop-note muted shop-teaser", `🧭 ${I18N.pick(window.L(`Mais ${hidden} peças exclusivas esperam por você nas lojas espalhadas pela cidade. Veja a aba "Lojas da cidade" para as pistas.`, `${hidden} more exclusive pieces await you in shops around town. See the "City shops" tab for clues.`, `${hidden} piezas exclusivas más te esperan en las tiendas de la ciudad. Mira la pestaña "Tiendas de la ciudad" para pistas.`))}`));
  list.appendChild(rodape);
}

// guia das lojas da cidade: as conhecidas mostram o que vendem; as desconhecidas dão uma pista para procurar no mapa
function renderStoreGuide(list) {
  list.appendChild(el("p", "shop-note", I18N.pick(window.L("Cada loja da cidade vende peças que só existem lá. Explore as ruas e o mapa para descobri-las!", "Every shop in town sells pieces found nowhere else. Explore the streets and the map to discover them!", "Cada tienda de la ciudad vende piezas que solo existen allí. ¡Explora las calles y el mapa para descubrirlas!"))));
  const grid = el("div", "store-grid");
  (SHOP.stores || []).forEach((st) => {
    const all = SHOP.items.filter((it) => it.store === st.id), got = all.filter((it) => state.owned[it.id]).length, seen = Boolean(shopSeen()[st.id] || (settings.dev && settings.unlockAll));
    const card = el("section", "store-card" + (seen ? " seen" : " unknown"));
    card.appendChild(el("div", "store-ic", seen ? st.emoji : "❔"));
    const body = el("div", "store-body");
    body.appendChild(el("h3", null, seen ? I18N.pick(st.name) : I18N.pick(window.L("Loja desconhecida", "Unknown shop", "Tienda desconocida"))));
    body.appendChild(el("p", "store-hint", seen ? I18N.pick(window.L(`Você já conhece esta loja. ${got}/${all.length} peças compradas.`, `You know this shop. ${got}/${all.length} pieces bought.`, `Ya conoces esta tienda. ${got}/${all.length} piezas compradas.`)) : `🔎 ${I18N.pick(st.hint)}`));
    body.appendChild(el("p", "store-count", `${all.length} ${I18N.pick(window.L("peças exclusivas", "exclusive pieces", "piezas exclusivas"))}`));
    card.appendChild(body); grid.appendChild(card);
  });
  list.appendChild(grid);
}

function buyItem(id) {
  const item = itemById(id);
  if (!item || isOwned(item)) return;
  if (!canBuyIn(item.store || item.area)) return denyBuy(item.store || item.area);
  if (state.coins < item.price) return shopChanged(t("shop.poor"));
  state.coins -= item.price;
  state.owned[id] = true;
  state.equipped[item.area] = state.equipped[item.area] || {};
  state.equipped[item.area][item.slot] = id;
  sfx("buy");
  shopChanged(t("shop.bought", { name: item.name }));
}

function equipItem(id) {
  const item = itemById(id);
  if (!item || !isOwned(item)) return;
  state.equipped[item.area] = state.equipped[item.area] || {};
  state.equipped[item.area][item.slot] = id;
  sfx("equip");
  shopChanged(t("shop.equipped", { name: item.name }));
}

function unequipSlot(area, slot) {
  if (slot === "cor" || slot === "c-cor") return;
  delete state.equipped[area][slot];
  shopChanged(t("shop.stored"));
}

function buyExpansion(id) {
  const ex = EXP_MAP[id];
  if (!ex || state.expansions[id]) return;
  if (!canBuyIn(ex.area)) return denyBuy(ex.area);
  if (state.coins < ex.price) return shopChanged(t("shop.poor"));
  state.coins -= ex.price;
  state.expansions[id] = true;
  sfx("levelup");
  shopChanged(t("shop.unlocked", { name: ex.name }));
}

// ---------------------------------------------------------------- guarda-roupa
// provador: veste a peça na bonequinha sem comprar (só na tela; nada é salvo)
let tryOn = null;
const CAMPO_DE = { top: "top", acc: "acc", calcado: "calcado", intima: "intima" };
const tryLook = (p) => {
  const base = verPorBaixo ? Object.assign({}, p, { semTop: true }) : p;
  return tryOn ? Object.assign({}, base, { [CAMPO_DE[tryOn.kind]]: tryOn.def.id, semTop: verPorBaixo && tryOn.kind !== "top" }) : base;
};
// Um provador em que não dá para ver por baixo da roupa não é um provador: é uma vitrine. Aqui a
// bonequinha tira a peça de cima para você escolher a de baixo — e volta a se vestir num toque.
let verPorBaixo = false;

function wardrobeCard(kind, def) {
  const p = state.player;
  const owned = Boolean(state.ownedClothes[def.id]) || (def.price === 0 && !def.secretOnly);
  const wearing = p[CAMPO_DE[kind]] === def.id || (kind === "calcado" && !p.calcado && def.id === "sapato-padrao") || (kind === "intima" && !p.intima && def.id === "intima-basica");
  const card = el("div", "shop-item" + (wearing ? " in-use" : ""));
  const icon = el("div", "shop-icon swatch");
  icon.style.background = def.color || "#ffffff";
  if (kind === "acc") { icon.textContent = def.id === "none" ? "∅" : def.id === "glasses" ? "👓" : def.id === "scarf" ? "🧣" : def.id === "gorro-natal" ? "🎅" : def.id === "chapeu-abobora" ? "🎃" : "🐰"; icon.style.background = "#fff"; icon.style.borderRadius = "14px"; }
  if (kind === "calcado") { icon.textContent = { tenis: "👟", bota: "🥾", sapatilha: "🩰", sandalia: "👡", social: "👞" }[def.kind] || "👠"; icon.style.borderRadius = "14px"; }
  card.appendChild(icon);
  card.appendChild(el("div", "shop-name", def.name));
  card.appendChild(el("div", "shop-price", owned ? (def.price === 0 ? t("shop.free") : t("shop.owned")) : `🪙 ${def.price}`));
  const btn = el("button", "pill-btn small");
  btn.type = "button";
  btn.dataset.cloth = def.id;
  if (!owned) {
    const note = whereNote(shopTab);
    if (note) card.appendChild(note);
    const b = buyButton(shopTab, def.price, t("shop.buy"), () => buyCloth(kind, def));
    b.dataset.cloth = def.id;
    const tryBtn = el("button", "pill-btn small", tryOn && tryOn.def.id === def.id ? `👀 ${t("shop.trying")}` : `👗 ${t("shop.try")}`);
    tryBtn.type = "button";
    tryBtn.dataset.try = def.id;
    tryBtn.addEventListener("click", () => { tryOn = tryOn && tryOn.def.id === def.id ? null : { kind, def }; sfx("equip"); renderShop(); });
    card.appendChild(tryBtn);
    card.appendChild(b);
    return card;
  } else if (wearing) {
    btn.textContent = t("shop.inuse");
    btn.disabled = true;
  } else {
    btn.textContent = t("shop.use");
    btn.addEventListener("click", () => wearCloth(kind, def));
  }
  card.appendChild(btn);
  return card;
}

function renderWardrobe(list) {
  const p = state.player;
  $("wardrobe-avatar").innerHTML = `<img src="${Retrato.url(tryLook(p))}" alt="">`;
  $("wardrobe-info").textContent = "";
  $("wardrobe-info").appendChild(el("span", "", tryOn ? `👗 ${t("shop.trying")}: ${tryOn.def.name}` : `${vars().doc} · ${t("shop.clothes.tip")}`));
  if (["roupas", "boutique"].includes(shopTab)) {
    const b = el("button", "pill-btn tiny wardrobe-under" + (verPorBaixo ? " on" : ""), verPorBaixo ? `👗 ${t("shop.vestir")}` : `👀 ${t("shop.verpordebaixo")}`);
    b.type = "button";
    b.addEventListener("click", () => { verPorBaixo = !verPorBaixo; sfx("equip"); renderShop(); });
    $("wardrobe-info").appendChild(b);
  }
  if (shopTab === "souvenirs") { renderSouvenirs(list); return; }
  const store = shopTab === "boutique" ? "boutique" : "roupas";
  const sections = [["top", SHOP.tops.filter((x) => (x.store || "roupas") === store), t("create.outfit")], ["acc", store === "boutique" ? [] : SHOP.accs.filter((a) => !a.secretOnly || state.ownedClothes[a.id]), t("shop.wardrobe")]];
  if (store === "roupas") {
    sections.push(["calcado", SHOP.shoes || [], t("shop.calcado")]);
    sections.push(["intima", SHOP.under || [], t("shop.intima")]);
  }
  sections.forEach(([kind, defs, title]) => {
    const group = el("section", "shop-group");
    group.appendChild(el("h2", null, title));
    const grid = el("div", "shop-grid");
    defs.forEach((d) => grid.appendChild(wardrobeCard(kind, d)));
    group.appendChild(grid);
    list.appendChild(group);
  });
}

function buyCloth(kind, def) {
  if (!canBuyIn(shopTab)) return denyBuy(shopTab);
  if (state.coins < def.price) return shopChanged(t("shop.poor"));
  state.coins -= def.price;
  state.ownedClothes[def.id] = true;
  tryOn = null;
  wearCloth(kind, def, true);
  sfx("buy");
  shopChanged(t("shop.bought", { name: def.name }));
}

function wearCloth(kind, def, silent) {
  state.player[CAMPO_DE[kind]] = def.id;
  if (!silent) { sfx("equip"); shopChanged(t("shop.equipped", { name: def.name })); }
}

// ---------------------------------------------------------------- ir à loja (com animação) e voltar
function openShop() {
  if (session) return;
  shopStore = null;                    // entrando pela barra ou de casa: só olhar e usar
  shopMsg = "";
  renderShop();
  showScreen("shop");
  sfx("bell");
  setTimeout(() => { if (screen === "shop") Tutor.topic("shop", [{ key: "shop1", target: "shop-where" }]); }, 700);
}

function goShop() {
  if (session || screen === "consult" || screen === "break") return;
  if (screen === "shop") return;
  travel("shop.going", openShop);
}

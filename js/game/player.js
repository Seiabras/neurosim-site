"use strict";

// O personagem do jogador: nome, tratamento, aparência e roupas. O retrato é a aquarela desenhada na
// hora (js/core/retrato.js) — o avatar em SVG saiu do jogo na 5.12: só existem aquarela e 3D.
const SKINS = ["#fbe3d0", "#f6d3b3", "#eab98f", "#d09a6a", "#bf8a5e", "#a8714a", "#7a4b2f", "#5a3a26"];
// tons naturais primeiro (o 0, o 1 e o 2 são usados como padrão em outras partes) e alguns fantasia mais discretos no fim
const HAIR_COLORS = ["#2a1d17", "#6b4630", "#5a3a26", "#a8622a", "#c9a45a", "#8f8f95", "#e6cf94", "#e8e6e0", "#8a3a3a", "#3a5f9a", "#4f7f5f", "#6b4a9a"];
const EYE_COLORS = ["#2a1d17", "#5a3a26", "#8a5a2a", "#3d8a5a", "#3a6fb0", "#7a7a86"];
const HAIR_STYLES = ["bob", "short", "long", "bun", "curly", "wavy", "ponytail", "braids", "afro", "pixie", "buzz"];
const EYE_SHAPES = ["round", "almond", "sleepy", "wide"];
const BROWS = ["soft", "thick", "arched", "none"];
const MOUTHS = ["soft", "smile", "neutral", "smirk", "grin"];
const FACES = ["round", "oval", "wide"];
const FREE_TOPS = ["base", "coat", "shirt", "sweater", "purple"];

function topDef(id) {
  return (window.SHOP_DATA.tops.find((t) => t.id === id)) || window.SHOP_DATA.tops[0];
}

// Como os pacientes tratam você e como o jogo fala da profissão.
function docVars(p) {
  const g = (p && p.gender) || "n";
  const name = (p && typeof p.name === "string" && p.name.trim()) || I18N.t("create.defaultname");   // save estranho pode trazer número aqui
  const title = I18N.t("title." + g);
  const prof = I18N.t("prof." + g);
  return { name, title, doc: (title ? title + " " : "") + name, prof, Prof: prof.charAt(0).toUpperCase() + prof.slice(1) };
}

// ---------------------------------------------------------------- tela de criação
let createDraft = null;
let editingChar = false;
let createView = "aquarela";   // "aquarela" (desenhada na hora) ou "3d" (o boneco). A prévia fica fixa enquanto se rola as opções.

function newDraft() {
  return { name: "", gender: "f", hand: "right", skin: SKINS[1], hairStyle: "bob", hairColor: "#6b4630", eyeColor: EYE_COLORS[0], eyeShape: "round", brow: "soft", mouth: "soft", face: "round", freckles: false, top: "base", acc: "none", art: "psicologa" };
}

function renderCreate() {
  if (!createDraft) createDraft = newDraft();
  const d = createDraft;
  const nameInput = document.getElementById("create-name");
  nameInput.placeholder = I18N.t("create.defaultname");
  if (nameInput.value !== d.name) nameInput.value = d.name;

  const fill = (id, list, build) => {
    const box = document.getElementById(id);
    box.textContent = "";
    list.forEach((v) => box.appendChild(build(v)));
  };
  const choice = (label, active, onClick, style) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "create-opt" + (active ? " active" : "");
    b.setAttribute("aria-pressed", String(active));
    if (typeof label === "string") b.textContent = label;
    else b.appendChild(label);
    if (style) b.style.cssText = style;
    b.addEventListener("click", onClick);
    return b;
  };
  const swatch = (color) => {
    const s = document.createElement("i");
    s.className = "swatch-dot";
    s.style.background = color;
    return s;
  };

  fill("create-gender", ["f", "m", "n"], (g) => choice(I18N.t("create." + g), d.gender === g, () => { d.gender = g; renderCreate(); }));
  fill("create-skin", SKINS, (c) => choice(swatch(c), d.skin === c, () => { d.skin = c; d.art = null; renderCreate(); }));
  fill("create-hairstyle", HAIR_STYLES, (h) => choice(I18N.t("hair." + h), d.hairStyle === h, () => { d.hairStyle = h; d.art = null; renderCreate(); }));
  // mão dominante: é com ela que a personagem segura os objetos no 3D (ver js/render/scene3d.js)
  fill("create-hand", ["right", "left"], (m) => choice(I18N.t("create.hand." + m), (d.hand || "right") === m, () => { d.hand = m; renderCreate(); }));
  fill("create-haircolor", HAIR_COLORS, (c) => choice(swatch(c), d.hairColor === c, () => { d.hairColor = c; d.art = null; renderCreate(); }));
  fill("create-eyes", EYE_COLORS, (c) => choice(swatch(c), d.eyeColor === c, () => { d.eyeColor = c; d.art = null; renderCreate(); }));
  fill("create-eyeshape", EYE_SHAPES, (v) => choice(I18N.t("eyeshape." + v), (d.eyeShape || "round") === v, () => { d.eyeShape = v; d.art = null; renderCreate(); }));
  fill("create-brow", BROWS, (v) => choice(I18N.t("brow." + v), (d.brow || "soft") === v, () => { d.brow = v; d.art = null; renderCreate(); }));
  fill("create-mouth", MOUTHS, (v) => choice(I18N.t("mouth." + v), (d.mouth || "soft") === v, () => { d.mouth = v; d.art = null; renderCreate(); }));
  fill("create-face", FACES, (v) => choice(I18N.t("face." + v), (d.face || "round") === v, () => { d.face = v; d.art = null; renderCreate(); }));
  fill("create-freckles", [false, true], (v) => choice(I18N.t(v ? "create.freckles.on" : "create.freckles.off"), Boolean(d.freckles) === v, () => { d.freckles = v; d.art = null; renderCreate(); }));
  const owned = editingChar ? Object.keys(state.ownedClothes || {}).filter((id) => TOP_MAP[id] && !FREE_TOPS.includes(id) && id !== "none") : [];   // ao editar, também as roupas compradas
  fill("create-outfit", FREE_TOPS.concat(owned), (id) => {
    const t = topDef(id);
    const wrap = document.createElement("span");
    wrap.appendChild(swatch(t.color));
    wrap.appendChild(document.createTextNode(" " + I18N.resolve(t.name)));
    return choice(wrap, d.top === id, () => { d.top = id; d.art = id === "base" ? d.art : null; renderCreate(); });
  });

  // a aquarela vale em todo lugar: aqui, no HUD, na cidade, no provador e na tela de viagem
  { const av = document.getElementById("create-avatar"); if (av) av.innerHTML = `<img src="${Retrato.url(d)}" alt="">`; }
  {
    const views = document.getElementById("create-views"), can3d = Boolean(window.Scene3D && typeof use3D === "function" && use3D());
    if (!can3d && createView === "3d") createView = "aquarela";
    views.dataset.view = createView;
    document.getElementById("view-3d").classList.toggle("hidden", !can3d);
    ["aquarela", "3d"].forEach((v) => { const b = document.getElementById("view-" + v); if (!b) return; b.classList.toggle("active", createView === v); b.setAttribute("aria-selected", String(createView === v)); b.onclick = () => { if (createView !== v) { createView = v; if (v !== "3d" && window.Scene3D) Scene3D.unmount(document.getElementById("create-3d")); renderCreate(); } }; });
    // o retrato em aquarela é desenhado na hora, a partir da aparência escolhida (js/core/retrato.js)
    if (createView === "aquarela" && window.Retrato) { try { Retrato.pintar(document.getElementById("create-aquarela-tela"), d); } catch (e) { createView = "3d"; views.dataset.view = "3d"; } }
    if (can3d && createView === "3d") { try { window.Scene3D.mount(document.getElementById("create-3d"), "avatar", { player: playerLook(d), drag: true }); } catch (e) { createView = "aquarela"; views.dataset.view = "aquarela"; } }
  }
  const base = document.getElementById("create-base");
  if (base) { base.classList.toggle("hidden", Boolean(d.art)); base.onclick = () => { Object.assign(d, newDraft(), { name: d.name, gender: d.gender }); renderCreate(); }; }
  document.getElementById("create-doc").textContent = docVars(d).doc;
}

"use strict";

// Botons (bandeiras e causas), óculos e bijuterias. Tudo é desenhado em SVG a partir dos dados de
// content/pins.json, então dá para acrescentar uma bandeira nova só pelo editor.
const Pins = (function () {
  const W = 30, H = 20;

  function starPoints(cx, cy, R, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
      pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`);
    }
    return pts.join(" ");
  }

  function overlay(o) {
    if (o.k === "disc") return o.c === "none" ? "" : `<circle cx="${W * o.x}" cy="${H * o.y}" r="${H * o.r}" fill="${o.c}"/>`;
    if (o.k === "star") return o.c === "none" ? "" : `<polygon points="${starPoints(W * o.x, H * o.y, H * o.r, H * o.r * 0.4)}" fill="${o.c}"/>`;
    if (o.k === "tri") return `<polygon points="0,0 ${W * o.w},${H / 2} 0,${H}" fill="${o.c}"/>`;
    if (o.k === "canton") return `<rect x="0" y="0" width="${W * o.w}" height="${H * o.h}" fill="${o.c}"/>`;
    if (o.k === "cross") {
      const th = H * o.th, cx = W * o.x;
      return `<rect x="${cx - th / 2}" y="0" width="${th}" height="${H}" fill="${o.c}"/><rect x="0" y="${H / 2 - th / 2}" width="${W}" height="${th}" fill="${o.c}"/>`;
    }
    if (o.k === "path") {
      if (o.c === "none") return "";
      const [color, width] = String(o.c).split(":");
      return width ? `<path d="${o.d}" fill="none" stroke="${color}" stroke-width="${width}"/>` : `<path d="${o.d}" fill="${color}"/>`;
    }
    return "";
  }

  // selo simplificado (estados e capitais sem desenho de bandeira conhecido): faixa diagonal nas cores do lugar + a sigla.
  // Não pretende ser a bandeira oficial; é só um marcador reconhecível (a peça aparece como "simplificada").
  function badgeInner(b) {
    const [c1, c2 = c1] = b.c;
    const txt = String(b.txt || "").slice(0, 3);
    const size = txt.length > 2 ? 7.5 : 9;
    const star = b.cap ? `<polygon points="${starPoints(6, 5.2, 3.2, 1.3)}" fill="#ffd84a" stroke="#15131f" stroke-width=".35"/>` : "";
    return `<rect width="${W}" height="${H}" fill="${c1}"/><polygon points="${W},0 ${W},${H} 0,${H}" fill="${c2}"/><rect x="${W / 2 - 8.5}" y="${H / 2 - 4.6}" width="17" height="9.2" rx="2" fill="rgba(255,255,255,.88)"/><text x="${W / 2}" y="${H / 2 + size * 0.36}" text-anchor="middle" font-family="system-ui,Arial,sans-serif" font-weight="800" font-size="${size}" fill="#15131f">${txt.replace(/&/g, "&amp;")}</text>${star}`;
  }

  // miolo da bandeira, em um quadro de 30 x 20
  function flagInner(spec) {
    if (spec.badge) return badgeInner(spec.badge);
    // bandeira oficial em SVG (estados e capitais, de tools/python/build_subdiv_flags.py): proporção preservada sobre um fundo neutro
    if (spec.svg) return `<rect width="${W}" height="${H}" fill="#e9e6df"/><svg x="0" y="0" width="${W}" height="${H}" viewBox="${spec.vb || "0 0 900 600"}" preserveAspectRatio="xMidYMid meet">${spec.svg}</svg>`;
    const parts = [];
    const cols = spec.c, wt = spec.w || cols.map(() => 1), sum = wt.reduce((a, b) => a + b, 0);
    let pos = 0;
    cols.forEach((c, i) => {
      const len = ((spec.t === "v" ? W : H) * wt[i]) / sum;
      parts.push(spec.t === "v" ? `<rect x="${pos}" y="0" width="${len + 0.15}" height="${H}" fill="${c}"/>` : `<rect x="0" y="${pos}" width="${W}" height="${len + 0.15}" fill="${c}"/>`);
      pos += len;
    });
    (spec.o || []).forEach((o) => parts.push(overlay(o)));
    return parts.join("");
  }

  const flagSVG = (spec, cls) => `<svg class="${cls || "flag-svg"}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${flagInner(spec)}<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#15131f" stroke-width="1"/></svg>`;

  // ---------------------------------------------------------------- catálogo
  const data = () => window.PINS_DATA || { flags: [], movements: [], glasses: [], jewels: [] };
  // SELO DE SUBDIVISÃO (7.13). Desde que a loja passou a ter as 5.046 subdivisões da lista ISO 3166-2,
  // guardar o desenho de cada uma engordava o content/pins.json em 1,7 MB — e esse arquivo é carregado
  // inteiro na abertura do jogo. Então o desenho não é dado: é regra. Mesmo código ISO e mesma bandeira
  // do país produzem sempre o mesmo selo, aqui e no gerador (tools/python/build_subdiv_iso.py).
  //
  // O que é bandeira DE VERDADE (a dos 13 países que passaram pelo Commons, e as capitais escritas à
  // mão) continua com o seu `spec` no arquivo, e este selo não encosta nelas.
  function seloDe(parentId, iso) {
    const pai = (data().flags || []).find((f) => f.id === parentId);
    const cores = ((pai && pai.spec && pai.spec.c) || ["#ccc", "#888"]).slice(0, 3);
    let h = 0;
    for (let i = 0; i < String(iso).length; i++) h = (h * 31 + String(iso).charCodeAt(i)) >>> 0;
    const spec = { t: h % 2 ? "v" : "h", c: cores.length >= 2 ? cores : cores.concat(["#fff"]) };
    if (h % 3 === 0) spec.o = [{ k: "disc", c: spec.c[0] === "#fff" ? "#15131f" : "#fff", x: 0.5, y: 0.5, r: 0.16 }];
    return spec;
  }
  // Escreve o selo no próprio catálogo, uma vez. A loja lê `PINS_DATA.subdivisions` direto — se o desenho
  // só existisse na cópia devolvida por subs(), os cartões das 4.799 subdivisões geradas sairiam sem bandeira.
  let normalizado = false;
  function normalizar() {
    if (normalizado) return;
    const sd = data().subdivisions || {};
    const paises = Object.keys(sd);
    if (!paises.length) return;                  // conteúdo ainda não carregou: tenta de novo na próxima
    paises.forEach((parent) => ["states", "cities"].forEach((k) => (sd[parent][k] || []).forEach((d) => {
      if (!d.parent) d.parent = parent;
      if (!d.level) d.level = k;
      if (!d.spec) d.spec = seloDe(parent, d.iso || d.id);
    })));
    normalizado = true;
  }
  const subs = () => {
    normalizar();
    const out = [], sd = data().subdivisions || {};
    Object.entries(sd).forEach(([parent, g]) => ["states", "cities"].forEach((k) => (g[k] || []).forEach((d) => out.push(Object.assign({ parent, level: k }, d)))));
    return out;
  };
  const all = () => data().flags.concat(subs(), data().movements, data().glasses, data().jewels);
  const byId = (id) => all().find((x) => x.id === id) || null;

  // ícone de uma peça no cartão da loja
  function icon(def) {
    if (def.spec) return flagSVG(def.spec, "pin-icon");
    if (def.e) return `<span class="pin-emoji" style="background:${def.bg || "#fff"}">${def.e}</span>`;
    if (def.kind) return `<svg class="pin-icon pin-icon-tall" viewBox="20 18 60 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${previewParts(def)}</svg>`;
    return "";
  }

  function previewParts(def) {
    // prévia: cabeça e ombros neutros, no mesmo sistema de coordenadas do avatar, com a peça por cima
    const skin = "#f2c9a2", edge = "#c9a27c";
    return `<path d="M22 108C22 90 34 84 50 84C66 84 78 90 78 108Z" fill="#8fa3b4" stroke="#5f7386" stroke-width="1"/><rect x="44" y="66" width="12" height="20" fill="${skin}"/><circle cx="50" cy="48" r="24" fill="${skin}" stroke="${edge}" stroke-width="1"/><path d="M25 46C24 20 76 20 75 46C68 33 32 33 25 46Z" fill="#5a3a26"/><ellipse cx="41.5" cy="50" rx="2.2" ry="2.6" fill="#2a1d17"/><ellipse cx="58.5" cy="50" rx="2.2" ry="2.6" fill="#2a1d17"/><path d="M44 60Q50 65 56 60" fill="none" stroke="#a4554b" stroke-width="1.6"/>` + partsFor(def);
  }

  // ---------------------------------------------------------------- peças usadas no avatar (viewBox 100 x 120)
  function partsFor(def, dx = 0, dy = 0) {
    const k = def.kind;
    const g = (s) => `<g transform="translate(${dx} ${dy})">${s}</g>`;
    const gold = "#d9a520";
    if (k === "gl-round") return g(`<circle cx="41.5" cy="50" r="7" fill="none" stroke="#2f2622" stroke-width="1.6"/><circle cx="58.5" cy="50" r="7" fill="none" stroke="#2f2622" stroke-width="1.6"/><path d="M48.5 50h3" stroke="#2f2622" stroke-width="1.6"/>`);
    if (k === "gl-square") return g(`<rect x="34" y="44.5" width="15" height="11" rx="2.5" fill="none" stroke="#2f2622" stroke-width="1.7"/><rect x="51" y="44.5" width="15" height="11" rx="2.5" fill="none" stroke="#2f2622" stroke-width="1.7"/><path d="M49 49h2" stroke="#2f2622" stroke-width="1.7"/>`);
    if (k === "gl-cat") return g(`<path d="M33 46 L48.5 45.5 Q49.5 55 42 56 Q35 56 33 46Z M67 46 L51.5 45.5 Q50.5 55 58 56 Q65 56 67 46Z" fill="rgba(255,255,255,.18)" stroke="#8a2f5a" stroke-width="1.7"/><path d="M48.5 47h3" stroke="#8a2f5a" stroke-width="1.7"/>`);
    if (k === "gl-sun") return g(`<rect x="34" y="44.5" width="15" height="11" rx="5" fill="#1d1a24" opacity=".9" stroke="#111" stroke-width="1.4"/><rect x="51" y="44.5" width="15" height="11" rx="5" fill="#1d1a24" opacity=".9" stroke="#111" stroke-width="1.4"/><path d="M49 48h2" stroke="#111" stroke-width="1.6"/>`);
    if (k === "gl-aviator") return g(`<path d="M34 45h15q0 12-7.5 12T34 45z M66 45H51q0 12 7.5 12T66 45z" fill="rgba(120,180,220,.35)" stroke="${gold}" stroke-width="1.6"/><path d="M49 46h2" stroke="${gold}" stroke-width="1.6"/>`);
    if (k === "ear-pearl") return g(`<circle cx="26.2" cy="59" r="2.3" fill="#fff" stroke="#c9c2b4" stroke-width=".7"/><circle cx="73.8" cy="59" r="2.3" fill="#fff" stroke="#c9c2b4" stroke-width=".7"/>`);
    if (k === "ear-hoop") return g(`<circle cx="26" cy="62" r="4.2" fill="none" stroke="${gold}" stroke-width="1.3"/><circle cx="74" cy="62" r="4.2" fill="none" stroke="${gold}" stroke-width="1.3"/>`);
    if (k === "ear-star") return g(`<polygon points="${starPoints(26, 60, 3.4, 1.4)}" fill="${gold}"/><polygon points="${starPoints(74, 60, 3.4, 1.4)}" fill="${gold}"/>`);
    if (k === "neck-thin") return g(`<path d="M37 83 Q50 98 63 83" fill="none" stroke="${gold}" stroke-width="1"/>`);
    if (k === "neck-heart") return g(`<path d="M37 83 Q50 98 63 83" fill="none" stroke="${gold}" stroke-width="1"/><path d="M50 99c-3-2.4-5-4-5-6a2.6 2.6 0 0 1 5-1 2.6 2.6 0 0 1 5 1c0 2-2 3.6-5 6z" fill="#e2478a" stroke="#8a1f56" stroke-width=".6"/>`);
    if (k === "neck-psi") return g(`<path d="M37 83 Q50 98 63 83" fill="none" stroke="${gold}" stroke-width="1"/><text x="50" y="101" text-anchor="middle" font-size="9" font-family="serif" font-weight="700" fill="${gold}" stroke="#7a5a10" stroke-width=".3">Ψ</text>`);
    if (k === "tiara-flower") return g(`<path d="M27 40 Q50 24 73 40" fill="none" stroke="#5a8f3a" stroke-width="1.6"/>${[[32, 36, "#f4b8c2"], [40, 31, "#fff"], [50, 29, "#f4b8c2"], [60, 31, "#fff"], [68, 36, "#f4b8c2"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3" fill="${c}" stroke="#c98aa0" stroke-width=".6"/><circle cx="${x}" cy="${y}" r="1" fill="#f2c230"/>`).join("")}`);
    if (k === "tiara-gold") return g(`<path d="M27 40 Q50 22 73 40" fill="none" stroke="${gold}" stroke-width="2"/><polygon points="50,24 47,31 53,31" fill="${gold}"/><circle cx="50" cy="27" r="1.6" fill="#e2478a"/><circle cx="39" cy="30" r="1.3" fill="#7fb8ff"/><circle cx="61" cy="30" r="1.3" fill="#7fb8ff"/>`);
    return "";
  }

  return { flagSVG, flagInner, icon, byId, data, subs, normalizar };
})();

window.Pins = Pins;

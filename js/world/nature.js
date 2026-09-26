"use strict";

// ===========================================================================
// Natureza da cidade: flores, tufos de grama, arbustos, cogumelos, pedras, juncos, conchas, troncos, algas e corais,
// espalhados de forma repetível (sempre os mesmos lugares) e balançando ao vento. É só cenário: não bloqueia ninguém,
// mas nunca fica em cima de prédios, água, estações ou objetos. Também desenha a "atmosfera" do dia: sombras de nuvens,
// feixes de sol e uma leve vinheta, para o mundo parecer mais vivo e menos chapado.
// ===========================================================================
const Nature = (() => {
  const ink = "#15131f";
  let list = [], locId = null, seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // quantidade e tipos por lugar; "zone" limita onde pode nascer
  const RECIPES = {
    praca: { n: 130, kinds: [["flower", 5], ["tuft", 6], ["bush", 2], ["mushroom", 1], ["rock", 1], ["clover", 3]] },
    parque: { n: 150, kinds: [["flower", 6], ["tuft", 6], ["bush", 3], ["clover", 3], ["mushroom", 1]] },
    bairro: { n: 110, kinds: [["flower", 5], ["tuft", 6], ["bush", 3], ["clover", 2]] },
    rua: { n: 70, kinds: [["tuft", 5], ["flower", 3], ["clover", 2], ["pebble", 2]], zone: (x, y) => (y > 340 && y < 470) || (y > 770 && y < 890) },
    praia: { n: 70, kinds: [["shell", 5], ["driftwood", 1], ["seagrass", 3], ["pebble", 3], ["starsand", 1]], zone: (x, y) => y > 320 },
    fenda: { n: 90, kinds: [["kelp", 4], ["coral", 4], ["anemone", 2], ["urchin", 1]] },
    mar: { n: 0, kinds: [] }
  };

  ["rua-lojas", "rua-campus", "rua-lazer"].forEach((id) => { RECIPES[id] = RECIPES.rua; });

  function enter(loc, blocked, stations) {
    locId = loc.id; list = []; seed = 31 + (loc.id.length * 77) % 991;
    const rec0 = RECIPES[loc.id]; if (!rec0 || !rec0.n) return;
    const rec = Object.assign({}, rec0, { n: Math.round(rec0.n * (window.Perf ? Perf.crowd() : 1)) });   // modo Econômico: menos plantas de enfeite
    const bag = []; rec.kinds.forEach(([k, w]) => { for (let i = 0; i < w; i++) bag.push(k); });
    let tries = 0;
    while (list.length < rec.n && tries++ < rec.n * 14) {
      const x = 30 + rnd() * (loc.w - 60), y = 40 + rnd() * (loc.h - 80);
      if (rec.zone && !rec.zone(x, y)) continue;
      if (blocked(x, y) || blocked(x - 14, y) || blocked(x + 14, y)) continue;
      if ((stations || []).some((s) => Math.hypot(s.x - x, s.y - y) < 70)) continue;
      list.push({ k: pick(bag), x, y, s: 0.8 + rnd() * 0.7, c: rnd(), p: rnd() * 6.28 });
    }
    // mais densidade em mancha: flores e mato em grupinhos, como na natureza de verdade
    const extra = [];
    list.forEach((a) => { if ((a.k === "flower" || a.k === "tuft") && rnd() < 0.55) for (let i = 0; i < 2; i++) { const nx = a.x + (rnd() - 0.5) * 46, ny = a.y + (rnd() - 0.5) * 30; if ((!rec.zone || rec.zone(nx, ny)) && !blocked(nx, ny) && !(stations || []).some((s) => Math.hypot(s.x - nx, s.y - ny) < 70)) extra.push({ k: a.k, x: nx, y: ny, s: a.s * (0.8 + rnd() * 0.4), c: rnd(), p: rnd() * 6.28 }); } });
    list = list.concat(extra);
  }

  const PET = ["#ffffff", "#ffd84a", "#ff7ab0", "#b58af0", "#ff9a4a", "#7ac8ff"];
  const DRAW = {
    tuft(c, a, t) { const w = Math.sin(t / 900 + a.p) * 3 * a.s; c.strokeStyle = "#3f8f4a"; c.lineWidth = 2 * a.s; c.lineCap = "round"; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 3 * a.s, 0); c.quadraticCurveTo(i * 4 * a.s + w * 0.5, -8 * a.s, i * 5 * a.s + w, -(13 - Math.abs(i) * 2) * a.s); c.stroke(); } c.strokeStyle = "#5cb56a"; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(w * 0.4, -8 * a.s, w, -16 * a.s); c.stroke(); c.lineCap = "butt"; },
    flower(c, a, t) { const w = Math.sin(t / 1000 + a.p) * 2.5, col = PET[Math.floor(a.c * PET.length)], h = 12 * a.s; c.strokeStyle = "#3f8f4a"; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(w * 0.3, -h * 0.5, w, -h); c.stroke(); c.fillStyle = "#4aa85a"; c.beginPath(); c.ellipse(-3, -h * 0.35, 3.2, 1.6, -0.5, 0, 7); c.fill(); c.save(); c.translate(w, -h); c.fillStyle = col; for (let i = 0; i < 5; i++) { const ang = (i * 2 * Math.PI) / 5; c.beginPath(); c.ellipse(Math.cos(ang) * 3.4 * a.s, Math.sin(ang) * 3.4 * a.s, 2.8 * a.s, 2.2 * a.s, ang, 0, 7); c.fill(); } c.fillStyle = col === "#ffd84a" ? "#e08a1a" : "#ffd84a"; c.beginPath(); c.arc(0, 0, 1.9 * a.s, 0, 7); c.fill(); c.restore(); },
    clover(c, a) { c.fillStyle = "#4aa85a"; [[0, -3], [-3.4, 0], [3.4, 0], [0, 3]].forEach(([x, y]) => { c.beginPath(); c.arc(x * a.s, y * a.s, 2.6 * a.s, 0, 7); c.fill(); }); },
    bush(c, a, t) { const w = Math.sin(t / 1400 + a.p) * 1.2; c.fillStyle = "rgba(21,19,31,0.16)"; c.beginPath(); c.ellipse(0, 3, 24 * a.s, 6, 0, 0, 7); c.fill(); [[-12, -8, 12, "#3f8f4a"], [10, -9, 12, "#4aa85a"], [0, -16, 14, "#56b35f"], [-2, -6, 13, "#3f9b4f"]].forEach(([x, y, r, col]) => { c.fillStyle = col; c.strokeStyle = "rgba(21,19,31,0.55)"; c.lineWidth = 2; c.beginPath(); c.arc((x + w) * a.s, y * a.s, r * a.s, 0, 7); c.fill(); c.stroke(); }); c.fillStyle = a.c < 0.5 ? "#ff5a7a" : "#ffd84a"; [[-10, -14], [6, -20], [12, -6], [-4, -6]].forEach(([x, y]) => { c.beginPath(); c.arc((x + w) * a.s, y * a.s, 2.2 * a.s, 0, 7); c.fill(); }); },
    mushroom(c, a) { c.fillStyle = "#f6efe4"; c.strokeStyle = ink; c.lineWidth = 1.6; c.fillRect(-2 * a.s, -6 * a.s, 4 * a.s, 6 * a.s); c.beginPath(); c.arc(0, -6 * a.s, 7 * a.s, Math.PI, 0); c.closePath(); c.fillStyle = "#e2473a"; c.fill(); c.stroke(); c.fillStyle = "#fff"; [[-3, -9], [2, -11], [4, -8]].forEach(([x, y]) => { c.beginPath(); c.arc(x * a.s, y * a.s, 1.3 * a.s, 0, 7); c.fill(); }); },
    rock(c, a) { c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(0, 2, 12 * a.s, 3, 0, 0, 7); c.fill(); c.fillStyle = "#9a9ea8"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(-11 * a.s, 0); c.lineTo(-8 * a.s, -8 * a.s); c.lineTo(2 * a.s, -11 * a.s); c.lineTo(10 * a.s, -4 * a.s); c.lineTo(11 * a.s, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = "rgba(255,255,255,0.3)"; c.beginPath(); c.moveTo(-5 * a.s, -7 * a.s); c.lineTo(1 * a.s, -9.5 * a.s); c.lineTo(3 * a.s, -6 * a.s); c.closePath(); c.fill(); },
    pebble(c, a) { c.fillStyle = "#c9bfae"; c.strokeStyle = "rgba(21,19,31,0.5)"; c.lineWidth = 1.2; [[0, 0, 4], [6, 2, 3], [-5, 2, 2.6]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x * a.s, y * a.s, r * a.s, r * 0.7 * a.s, 0, 0, 7); c.fill(); c.stroke(); }); },
    shell(c, a) { const col = ["#f7c9b8", "#f2e0b8", "#e8b0c8", "#d9c9f0"][Math.floor(a.c * 4)]; c.fillStyle = col; c.strokeStyle = "rgba(21,19,31,0.7)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(-9 * a.s, -4 * a.s, -6 * a.s, -9 * a.s); c.quadraticCurveTo(0, -12 * a.s, 6 * a.s, -9 * a.s); c.quadraticCurveTo(9 * a.s, -4 * a.s, 0, 2); c.fill(); c.stroke(); c.strokeStyle = "rgba(21,19,31,0.35)"; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, 1); c.lineTo(i * 2.4 * a.s, -9 * a.s); c.stroke(); } },
    driftwood(c, a) { c.fillStyle = "#a88a62"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(-22 * a.s, 0); c.quadraticCurveTo(-6 * a.s, -7 * a.s, 22 * a.s, -3 * a.s); c.quadraticCurveTo(24 * a.s, 1 * a.s, 18 * a.s, 2 * a.s); c.quadraticCurveTo(-2 * a.s, 5 * a.s, -22 * a.s, 3 * a.s); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = "rgba(60,40,20,0.5)"; c.beginPath(); c.moveTo(-14 * a.s, 0); c.lineTo(6 * a.s, -2 * a.s); c.stroke(); },
    seagrass(c, a, t) { const w = Math.sin(t / 800 + a.p) * 3; c.strokeStyle = "#a8b46a"; c.lineWidth = 2; c.lineCap = "round"; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 3, 0); c.quadraticCurveTo(i * 3 + w * 0.5, -9 * a.s, i * 5 + w, -15 * a.s); c.stroke(); } c.lineCap = "butt"; },
    starsand(c, a) { c.fillStyle = "#f08a4a"; c.strokeStyle = ink; c.lineWidth = 1.4; c.beginPath(); for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3 : 8; c.lineTo(Math.cos(ang) * r * a.s, Math.sin(ang) * r * a.s - 6 * a.s); } c.closePath(); c.fill(); c.stroke(); },
    kelp(c, a, t) { const h = 40 + a.c * 40; c.lineCap = "round"; [-5, 0, 5].forEach((dx, k) => { c.strokeStyle = ["#2f8a4a", "#3fa85a", "#256f3c"][k]; c.lineWidth = 5 - k; c.beginPath(); c.moveTo(dx, 0); for (let y = 0; y <= h * (0.8 + k * 0.1); y += 6) c.lineTo(dx + Math.sin(t / 700 + y / 14 + a.p + k) * (4 + y / 12), -y); c.stroke(); }); c.lineCap = "butt"; },
    coral(c, a, t) { const cols = ["#f2708a", "#ff9a4a", "#c86af0", "#ffd84a"], col = cols[Math.floor(a.c * 4)], w = Math.sin(t / 1200 + a.p) * 1.2; c.strokeStyle = col; c.lineWidth = 5; c.lineCap = "round"; [[0, -22, 0], [-9, -16, -0.5], [9, -18, 0.5], [-4, -12, -0.2]].forEach(([x, h, tilt]) => { c.beginPath(); c.moveTo(x * 0.3, 0); c.lineTo(x + tilt * 10 + w, h * a.s - 2); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(x + tilt * 10 + w, h * a.s - 2, 4, 0, 7); c.fill(); }); c.lineCap = "butt"; },
    anemone(c, a, t) { c.fillStyle = "#b25aa0"; c.beginPath(); c.ellipse(0, 0, 9 * a.s, 4, 0, 0, 7); c.fill(); c.strokeStyle = "#f28ad4"; c.lineWidth = 2; c.lineCap = "round"; for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(i * 2, -1); c.quadraticCurveTo(i * 3 + Math.sin(t / 500 + i) * 3, -9 * a.s, i * 3.6 + Math.sin(t / 500 + i + 1) * 4, -15 * a.s); c.stroke(); } c.lineCap = "butt"; },
    urchin(c, a) { c.fillStyle = "#3a2f5a"; c.strokeStyle = "#8a7ac8"; c.lineWidth = 1.6; for (let i = 0; i < 14; i++) { const ang = (i / 14) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(ang) * 4, Math.sin(ang) * 4); c.lineTo(Math.cos(ang) * 10 * a.s, Math.sin(ang) * 10 * a.s); c.stroke(); } c.beginPath(); c.arc(0, 0, 5 * a.s, 0, 7); c.fill(); }
  };

  function entries() {
    const t = performance.now();
    return list.map((a) => ({ y: a.y, draw: (c) => { c.save(); c.translate(a.x, a.y); (DRAW[a.k] || (() => {}))(c, a, t); c.restore(); } }));
  }

  // ------------------------------------------------------------ versão em Sprites (PixiJS)
  // Desenhar 222 plantinhas à mão a cada quadro custava 8,5 ms na praça — mais de metade do orçamento
  // de 60 fps. Aqui cada uma vira um Sprite com textura em cache. O balanço continua: cada tipo tem o
  // seu período, fatiado em 8 quadros, e a fase própria de cada planta entra como deslocamento nesses
  // 8. Assim plantas iguais no mesmo instante do balanço compartilham a MESMA textura.
  const PER = { tuft: 900, flower: 1000, bush: 1400, seagrass: 800, kelp: 700, coral: 1200, anemone: 500 };
  const FASES = 8;
  const passo = (per) => (per * Math.PI) / 4;            // 1/8 de volta completa do seno
  const TAM = [0.85, 1.05, 1.25, 1.45];                  // o tamanho entra na textura, então é quantizado
  const snapTam = (v) => TAM.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

  function sprites(t) {
    return list.map((a) => {
      const per = PER[a.k], sQ = snapTam(a.s);
      const cor = a.k === "flower" ? Math.floor(a.c * PET.length) : 0;
      const idx = per ? (Math.floor(t / passo(per)) + Math.round(a.p / ((Math.PI * 2) / FASES))) % FASES : 0;
      const item = Object.assign({}, a, { s: sQ, p: 0, c: a.k === "flower" ? (cor + 0.5) / PET.length : a.c });
      const tSint = per ? idx * passo(per) : 0;
      const r = 26 * sQ + 14;
      return {
        chave: `n|${a.k}|${sQ}|${cor}|${per ? idx : "f"}`,
        x: a.x, y: a.y, w: r * 2, h: r * 2, ax: r, ay: r,
        pintar: (g) => { g.save(); g.translate(a.x, a.y); (DRAW[a.k] || (() => {}))(g, item, tSint); g.restore(); },
      };
    });
  }

  // atmosfera do dia nos lugares abertos: sombras de nuvens que passam, feixes de sol e uma vinheta suave nas bordas
  function atmosphere(c, cw, ch, phase, water) {
    const t = performance.now() / 1000;
    if (phase === "day" && !water) {
      c.save();
      // sombra de nuvem mais fraca e mais lenta: passando depressa por cima da grama, ela fazia o chão
      // inteiro parecer tremular a cada quadro
      c.fillStyle = "rgba(20,30,60,0.045)";
      for (let i = 0; i < 3; i++) { const x = ((t * (6 + i * 3) + i * 480) % (cw + 500)) - 250, y = 90 + i * (ch / 3.2); c.beginPath(); c.ellipse(x, y, 190 + i * 40, 62 + i * 12, -0.12, 0, 7); c.fill(); }
      const g = c.createLinearGradient(cw * 0.15, 0, cw * 0.6, ch);
      g.addColorStop(0, "rgba(255,244,200,0.16)"); g.addColorStop(0.5, "rgba(255,244,200,0.05)"); g.addColorStop(1, "rgba(255,244,200,0)");
      c.fillStyle = g; c.beginPath(); c.moveTo(cw * 0.1, 0); c.lineTo(cw * 0.35, 0); c.lineTo(cw * 0.75, ch); c.lineTo(cw * 0.3, ch); c.closePath(); c.fill();
      c.restore();
    }
    const v = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, water ? "rgba(0,10,40,0.35)" : "rgba(20,15,40,0.16)");
    c.fillStyle = v; c.fillRect(0, 0, cw, ch);
  }

  const spots = (kinds) => list.filter((a) => kinds.includes(a.k)).map((a) => ({ x: a.x, y: a.y }));
  return { enter, entries, sprites, atmosphere, spots, count: () => list.length, kinds: () => list.reduce((o, a) => { o[a.k] = (o[a.k] || 0) + 1; return o; }, {}), list: () => list.map((a) => ({ k: a.k, x: a.x, y: a.y })) };
})();
window.Nature = Nature;

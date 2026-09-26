"use strict";

// Arte 2D da cidade: fachadas por atividade, casas dos pacientes, marcadores, móveis e árvores desenhados em vetor
// (com gradientes, sombras e detalhes), em vez de emojis soltos. O motor (city.js) só chama estas funções.
(function () {
  const ink = "#15131f";
  let FLIP = false;   // true enquanto se desenha a fachada espelhada (porta para cima)
  const EMO = "system-ui, \"Apple Color Emoji\", \"Segoe UI Emoji\", sans-serif";

  // aceita "#abc", "#aabbcc" e "rgb(r,g,b)": a cor do tema pode chegar já misturada com a da estação
  function rgb(hex) {
    const s = String(hex).trim();
    if (s.charAt(0) === "#") { const t = s.slice(1), n = parseInt(t.length === 3 ? t.split("").map((x) => x + x).join("") : t, 16); return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [200, 200, 200]; }
    const m = /rgba?\(([^)]+)\)/i.exec(s);
    if (m) { const p = m[1].split(",").map((v) => Math.max(0, Math.min(255, Math.round(parseFloat(v)) || 0))); return [p[0], p[1], p[2]]; }
    return [200, 200, 200];
  }
  function sh(hex, f) {
    const [r, g, b] = rgb(hex);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + (f > 0 ? (255 - v) * f : v * f))));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function vg(c, y0, y1, top, bot) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bot); return g; }
  function hash(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
  const emojiAt = (c, e, x, y, size, shadow) => {
    c.save(); c.font = `${size}px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = ink;
    if (shadow !== false) { c.shadowColor = "rgba(21,19,31,0.35)"; c.shadowBlur = 5; c.shadowOffsetY = 2; }
    c.fillText(e, x, y); c.restore();
  };

  // móveis e enfeites: desenho vetorial (CityIcons) e, se o símbolo não tiver desenho, o emoji de antes
  const symbolAt = (c, e, x, y, size, shadow) => {
    if (window.CityIcons && window.CityIcons.draw(c, e, x, y, size * 1.15)) return;
    emojiAt(c, e, x, y, size, shadow);
  };

  // ---------------------------------------------------------------- fachadas
  // estilo de cada prédio da rua: parede, telhado, toldo (duas cores), luminoso, vitrine e ornamento do telhado
  const STYLES = {
    apartamento: { wall: "#f2d7c0", roof: "gable", roofC: "#b9573c", trim: "#fff4e6", win: "home", orn: "chimney", flowers: true },
    clinica: { wall: "#cfe0f7", roof: "flat", roofC: "#3f8fa6", trim: "#ffffff", win: "glass", orn: "psi", awning: ["#3f8fa6", "#ffffff"] },
    hospital: { wall: "#e4f0f5", roof: "flat", roofC: "#dfe8ee", trim: "#ffffff", win: "glass", orn: "cross", awning: ["#d9534f", "#ffffff"], stripe: "#d9534f" },
    universidade: { wall: "#e2dcf0", roof: "pediment", roofC: "#8b7bc4", trim: "#f7f3ff", win: "arch", orn: "columns", flag: "#8b7bc4" },
    biblioteca: { wall: "#c98a62", roof: "gable", roofC: "#5a3d2b", trim: "#f0dcc0", win: "arch", orn: "books", brick: true },
    adocao: { wall: "#f7dfc0", roof: "gable", roofC: "#e58aa8", trim: "#fff", win: "home", orn: "heart", flowers: true },
    eletronicos: { wall: "#38405c", roof: "flat", roofC: "#20263c", trim: "#5b6fb8", win: "screens", orn: "neon", neon: "#54d0ff", dark: true },
    roupas: { wall: "#f7d6e6", roof: "flat", roofC: "#d9709c", trim: "#fff", win: "mannequin", awning: ["#e2478a", "#fff"], scallop: true },
    boutique: { wall: "#e8d5f2", roof: "flat", roofC: "#7a4fa8", trim: "#e2b84a", win: "mannequin", awning: ["#8a4fbf", "#e2b84a"], scallop: true, gold: true },
    souvenirs: { wall: "#ffe9a8", roof: "flat", roofC: "#e2a82a", trim: "#fff", win: "gifts", awning: ["#f2c230", "#e2473a"], scallop: true },
    decor: { wall: "#f4e3c8", roof: "flat", roofC: "#a87848", trim: "#fff", win: "furniture", awning: ["#c99a6a", "#f4e3c8"] },
    petshop: { wall: "#d4f0d4", roof: "flat", roofC: "#3f9b4f", trim: "#fff", win: "paws", awning: ["#4a9a5a", "#fff"], scallop: true },
    cafe: { wall: "#f0dcc4", roof: "flat", roofC: "#7a5232", trim: "#fff", win: "cafe", awning: ["#c9453a", "#fff"], scallop: true, steam: true },
    posto: { wall: "#e3ecf4", roof: "canopy", roofC: "#d9534f", trim: "#fff", win: "glass", orn: "pumps" },
    academia: { wall: "#3f4a58", roof: "flat", roofC: "#252c36", trim: "#ff8a3d", win: "gym", orn: "neon", neon: "#ff8a3d", dark: true },
    mercado: { wall: "#f0edd8", roof: "flat", roofC: "#3f9b4f", trim: "#fff", win: "crates", awning: ["#3f9b4f", "#fff"], scallop: true },
    fastfood: { wall: "#f7e6c4", roof: "flat", roofC: "#d9453a", trim: "#ffd84a", win: "glass", awning: ["#d9453a", "#ffd84a"], orn: "arch" },
    cassino: { wall: "#54406b", roof: "flat", roofC: "#2f1f45", trim: "#e2b84a", win: "casino", orn: "marquee", dark: true, gold: true },
    ludoteca: { wall: "#e2daf7", roof: "flat", roofC: "#7a5cc4", trim: "#fff", win: "gifts", awning: ["#8790dd", "#f2c230"], scallop: true, orn: "blocks" },
    laboratorio: { wall: "#dbe9ef", roof: "flat", roofC: "#4f8aa8", trim: "#ffffff", win: "glass", awning: ["#4f8aa8", "#ffffff"], stripe: "#4f8aa8" },
    museu: { wall: "#efe2c6", roof: "pediment", roofC: "#a8783a", trim: "#fff7e0", win: "arch", orn: "columns", flag: "#a8783a" },
    escola: { wall: "#f7e3a8", roof: "gable", roofC: "#d9453a", trim: "#ffffff", win: "home", orn: "books", flowers: true },
    forum: { wall: "#e6e0d2", roof: "pediment", roofC: "#6a6a7a", trim: "#ffffff", win: "arch", orn: "columns" },
    cinema: { wall: "#4a3260", roof: "flat", roofC: "#2f1f45", trim: "#e2b84a", win: "screens", orn: "marquee", dark: true, gold: true },
    caps: { wall: "#f7d2b0", roof: "gable", roofC: "#e58a4a", trim: "#ffffff", win: "home", orn: "heart", flowers: true },
    zoo: { wall: "#dff0d0", roof: "gable", roofC: "#3f9b4f", trim: "#ffffff", win: "paws", flowers: true, awning: ["#3f9b4f", "#f2c230"], scallop: true },
    memorial: { wall: "#cfd6cf", roof: "flat", roofC: "#4a5058", trim: "#eef0ee", win: "arch", orn: "gate" },
    feira: { wall: "#f2e2c0", roof: "flat", roofC: "#3f9b4f", trim: "#ffffff", win: "crates", awning: ["#e2573a", "#ffffff"], scallop: true },
    musica: { wall: "#e6d8f5", roof: "flat", roofC: "#7a4fa8", trim: "#ffffff", win: "glass", awning: ["#7a4fa8", "#f2c230"], scallop: true },
    jardim: { wall: "#d8f0d4", roof: "gable", roofC: "#3f9b4f", trim: "#ffffff", win: "home", awning: ["#4a9a5a", "#ffffff"], flowers: true },
    livraria: { wall: "#c9a878", roof: "gable", roofC: "#5a3d2b", trim: "#f0dcc0", win: "arch", orn: "books", brick: true },
    atelie: { wall: "#f7dcc8", roof: "flat", roofC: "#d9709c", trim: "#ffffff", win: "gifts", awning: ["#e2478a", "#f2c230", "#3fa9e0"], scallop: true },
    antiquario: { wall: "#d9c9a8", roof: "pediment", roofC: "#6a4526", trim: "#f0e2c4", win: "arch", orn: "columns", gold: true },
    brinquedos: { wall: "#fbe0e8", roof: "flat", roofC: "#e2573f", trim: "#ffffff", win: "gifts", awning: ["#e2573f", "#f2c230"], scallop: true, orn: "blocks" },
    bibinfantil: { wall: "#fbe4ee", roof: "gable", roofC: "#e58aa8", trim: "#fff", win: "arch", awning: ["#e58aa8", "#fff2a8"], scallop: true, orn: "books", flowers: true },
    ceramica: { wall: "#f3dcc0", roof: "flat", roofC: "#c8703a", trim: "#fff4e6", win: "glass", awning: ["#c8703a", "#f6efe0"], scallop: true },
    xadrez: { wall: "#dfe3ea", roof: "flat", roofC: "#4a5a6a", trim: "#fff", win: "glass", awning: ["#2a2f36", "#f6efe0"] },
    shopping: { wall: "#f1eef8", roof: "flat", roofC: "#8790dd", trim: "#fff", win: "mall", orn: "mall" }
  };

  // vidro: gradiente de céu, reflexo diagonal e, à noite (ou aberto), brilho quente por dentro
  function glass(c, x, y, w, h, lit, kind) {
    c.save();
    rr(c, x, y, w, h, 4); c.clip();
    c.fillStyle = lit ? vg(c, y, y + h, "#ffe9a8", "#ffc766") : vg(c, y, y + h, "#cfe8fa", "#8fbfe6");
    c.fillRect(x, y, w, h);
    if (FLIP) { c.translate(0, 2 * y + h); c.scale(1, -1); }   // o conteúdo da vitrine fica de pé mesmo na fachada espelhada
    drawInterior(c, kind, x, y, w, h, lit);
    if (FLIP) { c.scale(1, -1); c.translate(0, -(2 * y + h)); }
    c.fillStyle = "rgba(255,255,255,0.32)";
    c.beginPath(); c.moveTo(x + w * 0.1, y + h); c.lineTo(x + w * 0.42, y); c.lineTo(x + w * 0.62, y); c.lineTo(x + w * 0.3, y + h); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = ink; c.lineWidth = 3; rr(c, x, y, w, h, 4); c.stroke();
  }

  function drawInterior(c, kind, x, y, w, h, lit) {
    const cx = x + w / 2, by = y + h;
    if (kind === "mannequin") {
      c.fillStyle = "#e58aa8"; c.beginPath(); c.moveTo(cx - 9, by); c.lineTo(cx - 7, y + h * 0.42); c.lineTo(cx + 7, y + h * 0.42); c.lineTo(cx + 9, by); c.fill();
      c.fillStyle = "#e9c9a8"; c.beginPath(); c.arc(cx, y + h * 0.3, 6, 0, 7); c.fill();
    } else if (kind === "screens") {
      const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#54d0ff"); g.addColorStop(1, "#7a5cff");
      c.fillStyle = g; c.fillRect(x + 6, y + 6, w * 0.55, h * 0.55); c.fillStyle = "#20263c"; c.fillRect(x + w * 0.64, y + h * 0.3, w * 0.26, h * 0.5);
    } else if (kind === "gifts") {
      c.fillStyle = "#e2473a"; c.fillRect(x + w * 0.2, by - 16, 18, 14); c.fillStyle = "#4a9a5a"; c.fillRect(x + w * 0.55, by - 22, 16, 20);
      c.fillStyle = "#fff"; c.fillRect(x + w * 0.2 + 8, by - 16, 3, 14); c.fillRect(x + w * 0.55 + 6, by - 22, 3, 20);
    } else if (kind === "furniture") {
      c.fillStyle = "#c98a62"; c.fillRect(x + w * 0.15, by - 14, w * 0.5, 10); c.fillStyle = "#8790dd"; c.fillRect(x + w * 0.15, by - 26, w * 0.5, 13);
      c.fillStyle = "#f2c230"; c.beginPath(); c.moveTo(x + w * 0.78, by - 34); c.lineTo(x + w * 0.9, by - 34); c.lineTo(x + w * 0.86, by - 22); c.lineTo(x + w * 0.82, by - 22); c.fill();
      c.fillStyle = "#5a3d26"; c.fillRect(x + w * 0.83, by - 22, 2, 20);
    } else if (kind === "paws") {
      c.fillStyle = "rgba(63,155,79,0.55)"; [[0.3, 0.55], [0.5, 0.4], [0.7, 0.55]].forEach(([px, py]) => { c.beginPath(); c.arc(x + w * px, y + h * py, 5, 0, 7); c.fill(); });
      c.beginPath(); c.arc(cx, y + h * 0.75, 8, 0, 7); c.fill();
    } else if (kind === "cafe") {
      c.fillStyle = "#7a5232"; c.fillRect(x + w * 0.2, by - 20, w * 0.6, 4); c.fillRect(x + w * 0.28, by - 16, 3, 14); c.fillRect(x + w * 0.66, by - 16, 3, 14);
      c.fillStyle = "#fff"; c.beginPath(); c.arc(cx - 8, by - 26, 6, 0, 7); c.arc(cx + 10, by - 26, 6, 0, 7); c.fill();
    } else if (kind === "crates") {
      [["#d9453a", 0.12], ["#f2a83f", 0.42], ["#4a9a5a", 0.7]].forEach(([col, px]) => { c.fillStyle = "#a87848"; c.fillRect(x + w * px, by - 16, w * 0.24, 14); c.fillStyle = col; c.beginPath(); c.arc(x + w * px + w * 0.12, by - 17, w * 0.1, Math.PI, 0); c.fill(); });
    } else if (kind === "gym") {
      c.fillStyle = "#20252e"; c.fillRect(cx - 18, y + h * 0.5, 36, 5); c.fillRect(cx - 22, y + h * 0.36, 7, 28); c.fillRect(cx + 15, y + h * 0.36, 7, 28);
    } else if (kind === "casino") {
      c.fillStyle = "#c9453a"; c.fillRect(cx - 14, y + h * 0.3, 28, 30); c.fillStyle = "#ffd84a"; c.fillRect(cx - 9, y + h * 0.36, 7, 10); c.fillRect(cx + 2, y + h * 0.36, 7, 10);
    } else if (kind === "home") {
      c.fillStyle = "rgba(255,255,255,0.55)"; c.fillRect(x, y, w * 0.24, h); c.fillRect(x + w * 0.76, y, w * 0.24, h);   // cortinas
    }
  }

  function awning(c, x, y, w, cols, scallop, hgt) {
    const n = Math.max(4, Math.round(w / 34)), sw = w / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = cols[i % 2];
      c.beginPath(); c.moveTo(x + i * sw, y); c.lineTo(x + (i + 1) * sw, y);
      if (scallop) { c.lineTo(x + (i + 1) * sw, y + hgt - 8); c.arc(x + (i + 0.5) * sw, y + hgt - 8, sw / 2, 0, Math.PI); }
      else { c.lineTo(x + (i + 1) * sw, y + hgt); c.lineTo(x + i * sw, y + hgt); }
      c.closePath(); c.fill();
    }
    c.strokeStyle = ink; c.lineWidth = 3; c.strokeRect(x, y, w, 6);
    c.fillStyle = "rgba(21,19,31,0.16)"; c.fillRect(x, y + hgt - 2, w, 6);
  }

  function roofOf(c, st, x, y, w, rH, t) {
    if (st.roof === "gable") {
      c.fillStyle = vg(c, y, y + rH, sh(st.roofC, 0.12), sh(st.roofC, -0.2)); c.strokeStyle = ink; c.lineWidth = 4;
      c.beginPath(); c.moveTo(x - 14, y + rH); c.lineTo(x + w * 0.5, y + 2); c.lineTo(x + w + 14, y + rH); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = "rgba(21,19,31,0.22)"; c.lineWidth = 2;
      for (let r = 1; r < 4; r++) { const yy = y + 2 + (rH - 2) * r / 4, inset = (w * 0.5 + 14) * (1 - r / 4); c.beginPath(); c.moveTo(x + w * 0.5 - inset, yy); c.lineTo(x + w * 0.5 + inset, yy); c.stroke(); }
    } else if (st.roof === "pediment") {
      c.fillStyle = st.trim; c.strokeStyle = ink; c.lineWidth = 4;
      c.beginPath(); c.moveTo(x - 10, y + rH); c.lineTo(x + w / 2, y + 4); c.lineTo(x + w + 10, y + rH); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = st.roofC; c.beginPath(); c.moveTo(x + w * 0.3, y + rH - 6); c.lineTo(x + w / 2, y + 22); c.lineTo(x + w * 0.7, y + rH - 6); c.closePath(); c.fill();
      c.font = `22px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.fillText("🎓", x + w / 2, y + rH - 22);
    } else if (st.roof === "canopy") {
      c.fillStyle = vg(c, y + 14, y + rH, "#ffffff", "#d7dce4"); c.strokeStyle = ink; c.lineWidth = 4; rr(c, x - 12, y + 14, w + 24, rH - 14, 8); c.fill(); c.stroke();
      c.fillStyle = st.roofC; c.fillRect(x - 8, y + 24, w + 16, 12);
    } else {   // teto plano com platibanda
      c.fillStyle = vg(c, y, y + rH, sh(st.roofC, 0.15), sh(st.roofC, -0.2)); c.strokeStyle = ink; c.lineWidth = 4; rr(c, x - 10, y + 8, w + 20, rH - 8, 8); c.fill(); c.stroke();
      c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x, y + 14, w, 5);
    }
    // ornamentos do telhado
    const cx = x + w / 2, oy = y + rH / 2 + 6;
    if (st.orn === "chimney") { c.fillStyle = "#8a4a34"; c.strokeStyle = ink; c.lineWidth = 3; c.fillRect(x + w * 0.74, y + 4, 24, 34); c.strokeRect(x + w * 0.74, y + 4, 24, 34); }
    else if (st.orn === "cross") { c.fillStyle = "#d9534f"; c.fillRect(cx - 7, oy - 20, 14, 34); c.fillRect(cx - 17, oy - 10, 34, 14); c.strokeStyle = "#fff"; c.lineWidth = 2; c.strokeRect(cx - 7, oy - 20, 14, 34); }
    else if (st.orn === "psi") { c.font = `bold 44px serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.fillText("Ψ", cx, oy - 2); }
    else if (st.orn === "heart") { c.font = `28px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("💗", cx, oy + 6); }
    else if (st.orn === "books") { ["#d9534f", "#4a7fd0", "#f2c230", "#4a9a5a"].forEach((col, i) => { c.fillStyle = col; c.strokeStyle = ink; c.lineWidth = 2; c.fillRect(cx - 34 + i * 17, oy - 6 - (i % 2) * 6, 13, 28 + (i % 2) * 6); c.strokeRect(cx - 34 + i * 17, oy - 6 - (i % 2) * 6, 13, 28 + (i % 2) * 6); }); }
    else if (st.orn === "arch") { c.strokeStyle = "#ffd84a"; c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); c.arc(cx - 18, oy + 16, 18, Math.PI, 0); c.arc(cx + 18, oy + 16, 18, Math.PI, 0); c.stroke(); c.lineCap = "butt"; }
    else if (st.orn === "pumps") { [-1, 1].forEach((k) => { c.fillStyle = "#d9534f"; c.strokeStyle = ink; c.lineWidth = 3; rr(c, cx + k * 60 - 12, oy - 4, 24, 34, 5); c.fill(); c.stroke(); c.fillStyle = "#bfe3f5"; c.fillRect(cx + k * 60 - 7, oy, 14, 10); }); c.font = `bold 22px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.fillText("24h", cx, oy + 14); }
    else if (st.orn === "blocks") { [["#e2473a", "A"], ["#f2c230", "B"], ["#3f6fd8", "C"], ["#3f9b4f", "1"]].forEach(([col, ch], i) => { c.fillStyle = col; c.strokeStyle = ink; c.lineWidth = 3; rr(c, cx - 62 + i * 33, oy - 6 - (i % 2) * 8, 28, 28, 5); c.fill(); c.stroke(); c.fillStyle = "#fff"; c.font = `bold 16px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(ch, cx - 48 + i * 33, oy + 8 - (i % 2) * 8); }); }
    else if (st.orn === "gate") {   // portão de ferro do memorial: barras, arco e uma vela na entrada
      c.strokeStyle = "#1e2228"; c.lineWidth = 4; c.lineCap = "round";
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(cx + i * 11, oy + 44); c.lineTo(cx + i * 11, oy + 6 - Math.abs(i)); c.stroke(); }
      c.beginPath(); c.arc(cx, oy + 8, 36, Math.PI, 0); c.stroke(); c.beginPath(); c.moveTo(cx - 36, oy + 44); c.lineTo(cx + 36, oy + 44); c.stroke();
      c.font = `22px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.fillText("🪦", cx, oy - 22);
    }
    else if (st.orn === "mall") { c.font = `bold 30px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.fillText("🛍️", cx, oy + 4); }
    if (st.flag) { c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w - 30, y + 4); c.lineTo(x + w - 30, y - 34); c.stroke(); c.fillStyle = st.flag; c.beginPath(); c.moveTo(x + w - 30, y - 34); c.lineTo(x + w - 2, y - 26 + Math.sin(t / 300) * 3); c.lineTo(x + w - 30, y - 16); c.closePath(); c.fill(); c.stroke(); }
    if (st.neon) { c.save(); c.shadowColor = st.neon; c.shadowBlur = 14; c.strokeStyle = st.neon; c.lineWidth = 4; c.strokeRect(x + 8, y + 16, w - 16, rH - 30); c.restore(); }
    if (st.orn === "marquee") {   // luzes piscando no letreiro do cassino
      const n = Math.round(w / 26);
      for (let i = 0; i < n; i++) { c.fillStyle = (Math.floor(t / 260) + i) % 2 ? "#ffd84a" : "#c9453a"; c.beginPath(); c.arc(x + 12 + i * ((w - 24) / (n - 1)), y + 16, 5, 0, 7); c.fill(); c.beginPath(); c.arc(x + 12 + i * ((w - 24) / (n - 1)), y + rH - 6, 5, 0, 7); c.fill(); }
    }
  }

  function facade(c, s, info, t) {
    const st = STYLES[info.id] || { wall: info.wall, roof: "flat", roofC: "#c97a5a", trim: "#fff", win: "glass" };
    const lit = info.night || !info.open;
    const roofH = 70, x = s.x, y = s.y, w = s.w, h = s.h, bodyY = y + roofH, bodyH = h - roofH;
    // sombra projetada no chão
    c.fillStyle = "rgba(21,19,31,0.22)"; rr(c, x + 12, y + 16, w, h, 14); c.fill();
    // corpo: gradiente vertical, textura de tijolo ou reboco e cantoneiras
    c.fillStyle = vg(c, bodyY, bodyY + bodyH, sh(st.wall, 0.1), sh(st.wall, -0.1)); c.strokeStyle = ink; c.lineWidth = 5; rr(c, x, bodyY, w, bodyH, 8); c.fill(); c.stroke();
    c.save(); rr(c, x, bodyY, w, bodyH, 8); c.clip();
    if (st.brick) { c.strokeStyle = "rgba(60,25,10,0.28)"; c.lineWidth = 2; for (let r = 0, yy = bodyY; yy < bodyY + bodyH; yy += 14, r++) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); for (let xx = x + (r % 2) * 18; xx < x + w; xx += 36) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 14); c.stroke(); } } }
    else { c.fillStyle = "rgba(255,255,255,0.07)"; for (let i = 0; i < 40; i++) c.fillRect(x + (i * 47) % w, bodyY + (i * 29) % bodyH, 16, 3); }
    if (st.stripe) { c.fillStyle = st.stripe; c.fillRect(x, bodyY + 44, w, 8); }
    if (st.orn === "columns") { for (let i = 0; i < 5; i++) { const cx = x + 20 + i * ((w - 40) / 4); c.fillStyle = vg(c, bodyY, bodyY + bodyH, "#fff", "#d6d0e6"); c.fillRect(cx - 9, bodyY + 4, 18, bodyH - 8); c.strokeStyle = "rgba(21,19,31,0.25)"; c.lineWidth = 2; c.strokeRect(cx - 9, bodyY + 4, 18, bodyH - 8); } }
    c.restore();
    // telhado
    roofOf(c, st, x, y, w, roofH, t);
    // placa com o nome (madeira/luminoso conforme o estilo)
    const signY = bodyY + 8, signH = 40;
    c.save();
    if (st.dark) { c.shadowColor = st.neon || st.trim; c.shadowBlur = info.night ? 16 : 6; }
    c.fillStyle = st.dark ? "#14121c" : "#fdfaf5"; c.strokeStyle = st.gold ? "#e2b84a" : ink; c.lineWidth = 4; rr(c, x + 30, signY, w - 60, signH, 10); c.fill(); c.stroke();
    c.restore();
    c.font = `bold 20px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = st.dark ? (st.neon || "#ffe9a8") : ink;
    c.fillText(`${info.emoji} ${info.name}`.slice(0, 26), x + w / 2, signY + signH / 2 + 1);
    // toldo + vitrines dos dois lados da porta
    const winY = bodyY + 82, winH = 50, doorW = 56, doorX = x + w / 2 - doorW / 2;
    if (st.awning) awning(c, x + 14, bodyY + 54, w - 28, st.awning, st.scallop, 28);
    const wy = st.awning ? winY + 4 : winY - 8;
    const gw = (doorX - x - 40);
    if (st.win === "arch") {
      [x + 22, x + w - 22 - gw].forEach((gx) => { c.save(); c.beginPath(); c.moveTo(gx, wy + winH + 18); c.lineTo(gx, wy + 14); c.arc(gx + gw / 2, wy + 14, gw / 2, Math.PI, 0); c.lineTo(gx + gw, wy + winH + 18); c.closePath(); c.fillStyle = lit ? "#ffd98a" : "#a9cdea"; c.fill(); c.strokeStyle = ink; c.lineWidth = 3; c.stroke(); c.restore(); });
    } else {
      glass(c, x + 22, wy, gw, winH + 10, lit, st.win);
      glass(c, x + w - 22 - gw, wy, gw, winH + 10, lit, st.win);
    }
    if (st.flowers) { [x + 22, x + w - 22 - gw].forEach((gx) => { c.fillStyle = "#8a5a3a"; c.fillRect(gx - 2, wy + winH + 10, gw + 4, 10); c.strokeStyle = ink; c.lineWidth = 2; c.strokeRect(gx - 2, wy + winH + 10, gw + 4, 10); ["#e2478a", "#f2c230", "#fff", "#e2478a", "#f2c230"].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(gx + 8 + i * (gw - 12) / 4, wy + winH + 7, 4, 0, 7); c.fill(); }); }); }
    // porta com moldura, painéis e maçaneta
    const dH = 92, dY = y + h - dH;
    c.fillStyle = st.trim; rr(c, doorX - 8, dY - 10, doorW + 16, dH + 10, 6); c.fill(); c.strokeStyle = ink; c.lineWidth = 3; c.stroke();
    c.fillStyle = st.glassDoor || (["clinica", "hospital", "shopping", "eletronicos", "fastfood", "posto", "cassino"].includes(info.id) ? "#a9d4ee" : "#8a5a2a"); c.fillRect(doorX, dY, doorW, dH); c.strokeRect(doorX, dY, doorW, dH);
    c.strokeStyle = "rgba(21,19,31,0.3)"; c.lineWidth = 2; c.strokeRect(doorX + 7, dY + 8, doorW / 2 - 10, 32); c.strokeRect(doorX + doorW / 2 + 3, dY + 8, doorW / 2 - 10, 32); c.strokeRect(doorX + 7, dY + 48, doorW - 14, 34);
    c.fillStyle = "#e2b84a"; c.beginPath(); c.arc(doorX + doorW - 9, dY + dH * 0.55, 3.5, 0, 7); c.fill();
    if (info.open && info.hours) { c.fillStyle = "rgba(255,216,120,0.35)"; c.fillRect(doorX + 3, dY + 3, doorW - 6, dH - 6); }
    // degrau/capacho e horário
    c.fillStyle = "rgba(21,19,31,0.18)"; c.fillRect(doorX - 10, y + h - 4, doorW + 20, 6);
    if (st.steam && info.open) { c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + w - 46 + i * 9, y + 6); c.bezierCurveTo(x + w - 52 + i * 9, y - 6 + Math.sin(t / 400 + i) * 3, x + w - 40 + i * 9, y - 16, x + w - 46 + i * 9, y - 26); c.stroke(); } }
    if (info.hours) {
      c.font = "bold 14px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
      const label = `${info.open ? "🟢" : "🔒"} ${info.hours[0]}–${info.hours[1]}`, tw = c.measureText(label).width + 16;
      c.fillStyle = "rgba(255,255,255,0.92)"; c.strokeStyle = ink; c.lineWidth = 2; rr(c, x + w / 2 - tw / 2, y + h + 6, tw, 20, 8); c.fill(); c.stroke();
      c.fillStyle = info.open ? "#2f6b3a" : "#a23a3a"; c.fillText(label, x + w / 2, y + h + 16);
    }
    if (!info.open) { c.fillStyle = "rgba(21,19,50,0.34)"; rr(c, x, bodyY, w, bodyH, 8); c.fill(); }
  }

  // desenha a fachada na orientação certa: "bottom" = porta para baixo (telhado em cima); "top" = espelhada
  function drawBuilding(c, s, info, t) {
    if (s.door === "top") {
      const cy = s.y + s.h / 2;
      c.save(); c.translate(0, cy * 2); c.scale(1, -1);
      FLIP = true;
      try { facadeShapes(c, s, info, t); } finally { FLIP = false; }
      c.restore();
      facadeText(c, s, info);
    } else { facade(c, s, info, t); }
  }

  // versão espelhada: desenha a fachada sem texto (o texto sai depois, na posição certa e sem espelhar)
  function facadeShapes(c, s, info, t) {
    const saveFill = c.fillText; c.fillText = function () {};
    // `hours: null` também: o selo de horário é desenhado por facadeText(). Sem tirar daqui, este passo
    // pintava o FUNDO do selo sem o texto (fillText está desligado) e sobrava uma pílula branca vazia
    // flutuando ao lado da porta — era parte do que estava feio na rua.
    try { facade(c, s, Object.assign({}, info, { name: "", emoji: "", hours: null }), t); } finally { c.fillText = saveFill; }
  }
  function facadeText(c, s, info) {
    const st = STYLES[info.id] || { wall: info.wall };
    const y = s.y, h = s.h;
    c.font = `bold 20px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = st.dark ? (st.neon || "#ffe9a8") : ink;
    c.fillText(`${info.emoji} ${info.name}`.slice(0, 26), s.x + s.w / 2, y + h - 97);   // o desenho espelhado põe a placa a 98 px do fundo
    if (info.hours) {
      // O horário fica NA FACHADA, logo abaixo da placa do nome. Antes ele flutuava 26 px acima do
      // prédio, que é exatamente onde mora a porta dos prédios com entrada em cima (`door: "top"`,
      // posta em `y - 22`): os dois se cobriam, e o que se via era um selo de horário em cima do
      // ícone de porta.
      c.font = "bold 14px system-ui";
      const label = `${info.open ? "🟢" : "🔒"} ${info.hours[0]}–${info.hours[1]}`, tw = c.measureText(label).width + 16;
      const by = y + h - 72;
      c.fillStyle = "rgba(255,255,255,0.92)"; c.strokeStyle = ink; c.lineWidth = 2; rr(c, s.x + s.w / 2 - tw / 2, by, tw, 20, 8); c.fill(); c.stroke();
      c.fillStyle = info.open ? "#2f6b3a" : "#a23a3a"; c.fillText(label, s.x + s.w / 2, by + 10);
    }
  }

  // ---------------------------------------------------------------- casas dos pacientes
  const HOUSE_PAL = [
    { wall: "#f6e3c4", roof: "#c0563b" }, { wall: "#d8e4f8", roof: "#4f6fb0" }, { wall: "#e2f0d6", roof: "#7a5a3a" },
    { wall: "#f7d9e2", roof: "#9b4a6b" }, { wall: "#fdf1b8", roof: "#d08a2a" }, { wall: "#e6dcf5", roof: "#6b5aa8" }
  ];
  function drawHouse(c, h, info, t, night) {
    const pal = info.kid ? { wall: "#fbd8a8", roof: "#e2573f" } : HOUSE_PAL[hash(info.id) % HOUSE_PAL.length];
    const x = h.x, y = h.y, w = h.w, hh = h.h;
    c.fillStyle = "rgba(21,19,31,0.22)"; c.beginPath(); c.ellipse(x + w / 2 + 8, y + hh + 6, w * 0.62, 12, 0, 0, 7); c.fill();
    // caminho de pedras até a porta
    c.fillStyle = "#e6dccb"; c.beginPath(); c.moveTo(x + w / 2 - 10, y + hh); c.lineTo(x + w / 2 + 10, y + hh); c.lineTo(x + w / 2 + 20, y + hh + 26); c.lineTo(x + w / 2 - 20, y + hh + 26); c.fill();
    c.fillStyle = vg(c, y, y + hh, sh(pal.wall, 0.1), sh(pal.wall, -0.12)); c.strokeStyle = ink; c.lineWidth = 4; rr(c, x, y, w, hh, 8); c.fill(); c.stroke();
    // telhado com telhas e chaminé
    c.fillStyle = "#8a4a34"; c.fillRect(x + w * 0.7, y - 34, 16, 26); c.strokeRect(x + w * 0.7, y - 34, 16, 26);
    c.fillStyle = vg(c, y - 38, y + 8, sh(pal.roof, 0.12), sh(pal.roof, -0.2));
    c.beginPath(); c.moveTo(x - 12, y + 8); c.lineTo(x + w / 2, y - 40); c.lineTo(x + w + 12, y + 8); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = "rgba(21,19,31,0.22)"; c.lineWidth = 2;
    for (let r = 1; r < 3; r++) { const yy = y - 40 + 48 * r / 3, inset = (w / 2 + 12) * r / 3; c.beginPath(); c.moveTo(x + w / 2 - inset, yy); c.lineTo(x + w / 2 + inset, yy); c.stroke(); }
    // janelas com cortina, luz acesa à noite
    [x + 14, x + w - 14 - 26].forEach((wx) => { c.fillStyle = night ? "#ffd98a" : vg(c, y + 30, y + 58, "#cfe8fa", "#8fbfe6"); c.strokeStyle = ink; c.lineWidth = 3; c.fillRect(wx, y + 32, 26, 26); c.strokeRect(wx, y + 32, 26, 26); c.beginPath(); c.moveTo(wx + 13, y + 32); c.lineTo(wx + 13, y + 58); c.moveTo(wx, y + 45); c.lineTo(wx + 26, y + 45); c.stroke(); });
    // porta, degrau e maçaneta
    c.fillStyle = "#8a5a2a"; c.fillRect(x + w / 2 - 12, y + hh - 42, 24, 42); c.strokeRect(x + w / 2 - 12, y + hh - 42, 24, 42);
    c.fillStyle = "#e2b84a"; c.beginPath(); c.arc(x + w / 2 + 7, y + hh - 20, 2.5, 0, 7); c.fill();
    // arbustos e caixa de correio
    ["#4a9a5a", "#5cb56a"].forEach((col, i) => { c.fillStyle = col; c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.arc(x + 6 + i * (w - 12), y + hh - 6, 12, 0, 7); c.fill(); c.stroke(); });
    c.fillStyle = "#8a5a2a"; c.fillRect(x + w + 12, y + hh - 24, 3, 24); c.fillStyle = "#d9534f"; rr(c, x + w + 6, y + hh - 34, 16, 12, 4); c.fill(); c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
    if (info.kid) { c.font = `18px ${EMO}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("🧸", x + w - 6, y + hh + 12); }
    // plaquinha com o nome
    c.font = "bold 14px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
    const tw = c.measureText(info.name).width + 14;
    c.fillStyle = "#fdfaf5"; c.strokeStyle = ink; c.lineWidth = 2.5; rr(c, x + w / 2 - tw / 2, y + hh + 6, tw, 20, 7); c.fill(); c.stroke();
    c.fillStyle = ink; c.fillText(info.name, x + w / 2, y + hh + 16);
    void t;
  }

  // ---------------------------------------------------------------- marcadores de ação (estações)
  const STATION_TONE = { door: ["#e2b84a", "#8a5a2a"], shop: ["#5cb56a", "#2f6b3a"], act: ["#5aa3ff", "#2a5fb0"], map: ["#ff8a5c", "#b04a20"] };
  function drawStation(c, s, closed, t) {
    const bob = Math.sin(t / 350 + s.x) * 3, pulse = 1 + Math.sin(t / 420 + s.x) * 0.08;
    const kind = s.door ? "door" : s.action === "map" ? "map" : /shop|loja|buy|store/i.test(String(s.action)) ? "shop" : "act";
    const tone = closed ? ["#9aa0aa", "#565b66"] : STATION_TONE[kind];
    // halo no chão
    const g = c.createRadialGradient(s.x, s.y + 22, 2, s.x, s.y + 22, 40 * pulse); g.addColorStop(0, closed ? "rgba(150,150,160,0.5)" : "rgba(255,216,74,0.65)"); g.addColorStop(1, "rgba(255,216,74,0)");
    c.fillStyle = g; c.beginPath(); c.ellipse(s.x, s.y + 22, 42 * pulse, 15 * pulse, 0, 0, 7); c.fill();
    // ficha: aro colorido, miolo em gradiente, brilho
    const cy = s.y - 6 + bob;
    c.fillStyle = "rgba(21,19,31,0.25)"; c.beginPath(); c.ellipse(s.x, s.y + 24, 20, 6, 0, 0, 7); c.fill();
    c.fillStyle = tone[1]; c.beginPath(); c.arc(s.x, cy, 29, 0, 7); c.fill();
    c.fillStyle = tone[0]; c.beginPath(); c.arc(s.x, cy, 26, 0, 7); c.fill();
    const inner = c.createRadialGradient(s.x - 7, cy - 9, 2, s.x, cy, 22); inner.addColorStop(0, "#ffffff"); inner.addColorStop(1, "#f1e8d6");
    c.fillStyle = inner; c.beginPath(); c.arc(s.x, cy, 21, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.arc(s.x, cy, 29, 0, 7); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.ellipse(s.x - 8, cy - 14, 9, 4, -0.5, 0, 7); c.fill();
    if (s.door && !closed) drawDoorIcon(c, s.x, cy);
    else emojiAt(c, closed ? "🔒" : s.emoji, s.x, cy + 1, 26);
  }
  function drawDoorIcon(c, x, y) {
    c.fillStyle = "#8a5a2a"; c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(x - 10, y + 14); c.lineTo(x - 10, y - 6); c.arc(x, y - 6, 10, Math.PI, 0); c.lineTo(x + 10, y + 14); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#e2b84a"; c.beginPath(); c.arc(x + 5, y + 4, 2, 0, 7); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 15); c.lineTo(x, y + 14); c.stroke();
  }


  // ---------------------------------------------------------------- litoral: cais, navios, redemoinho
  function drawWaterRect(c, x, y, w, h, t) {
    c.fillStyle = "#6fc3ea"; c.fillRect(x, y, w, h);
    c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 4;
    for (let yy = y + 40; yy < y + h; yy += 55) { c.beginPath(); for (let xx = x; xx <= x + w; xx += 40) c.lineTo(xx, yy + Math.sin(xx / 60 + t / 700 + yy) * 6); c.stroke(); }
  }
  function pier(c, d) {
    const { x, y, w, h } = d, vertical = true;
    c.fillStyle = "rgba(21,19,31,0.22)"; rr(c, x + 8, y + 10, w, h, 6); c.fill();
    c.fillStyle = "#a8794a"; c.strokeStyle = ink; c.lineWidth = 4; c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h);
    c.strokeStyle = "rgba(60,30,10,0.45)"; c.lineWidth = 2;
    for (let yy = y + 18; yy < y + h; yy += 22) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
    c.strokeStyle = "rgba(255,225,180,0.25)"; for (let yy = y + 29; yy < y + h; yy += 44) { c.beginPath(); c.moveTo(x + 4, yy); c.lineTo(x + w - 4, yy); c.stroke(); }
    // estacas com cordas nas duas bordas
    const posts = Math.floor(h / 70);
    for (let i = 0; i <= posts; i++) {
      const yy = d.dir === "up" ? y + 8 + i * ((h - 16) / posts) : y + 8 + i * ((h - 16) / posts);
      [x - 2, x + w + 2].forEach((xx) => { c.fillStyle = "#5a3d26"; c.beginPath(); c.arc(xx, yy, 8, 0, 7); c.fill(); c.strokeStyle = ink; c.lineWidth = 3; c.stroke(); c.fillStyle = "rgba(255,255,255,0.3)"; c.beginPath(); c.arc(xx - 2, yy - 2, 3, 0, 7); c.fill(); });
    }
    c.strokeStyle = "#d8c49a"; c.lineWidth = 3;
    [x - 2, x + w + 2].forEach((xx) => { c.beginPath(); c.moveTo(xx, y + 8); for (let i = 1; i <= posts; i++) c.quadraticCurveTo(xx, y + 8 + (i - 0.5) * ((h - 16) / posts) + 8, xx, y + 8 + i * ((h - 16) / posts)); c.stroke(); });
    void vertical;
  }
  function moored(c, x, y, t) {
    const bob = Math.sin(t / 600 + x) * 3;
    c.fillStyle = "rgba(21,19,31,0.22)"; c.beginPath(); c.ellipse(x + 6, y + 30 + bob, 46, 10, 0, 0, 7); c.fill();
    c.fillStyle = "#8b5a2b"; c.strokeStyle = ink; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x - 50, y - 6 + bob); c.quadraticCurveTo(x, y + 38 + bob, x + 50, y - 6 + bob); c.lineTo(x + 40, y + 6 + bob); c.quadraticCurveTo(x, y + 28 + bob, x - 40, y + 6 + bob); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#c98a4a"; c.beginPath(); c.moveTo(x - 38, y + 6 + bob); c.quadraticCurveTo(x, y + 28 + bob, x + 38, y + 6 + bob); c.lineTo(x + 30, y - 2 + bob); c.lineTo(x - 30, y - 2 + bob); c.fill();
    c.strokeStyle = "#d8c49a"; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 50, y - 4 + bob); c.quadraticCurveTo(x - 80, y - 12, x - 100, y - 4); c.stroke();
  }
  // navio pirata: casco curvo, dois mastros, velas com caveira, bandeira, canhões e escada de corda
  function pirateShip(c, s, t) {
    const { x, y, w, h } = s, sway = Math.sin(t / 900) * 3, cx = x + w / 2;
    c.fillStyle = "rgba(21,19,31,0.22)"; c.beginPath(); c.ellipse(cx + 10, y + h + 6, w * 0.5, 20, 0, 0, 7); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 4; c.beginPath(); for (let xx = x - 10; xx <= x + w + 10; xx += 24) c.lineTo(xx, y + h + 2 + Math.sin(xx / 30 + t / 500) * 5); c.stroke();
    // mastros e velas
    [[x + w * 0.32, 0.9], [x + w * 0.66, 1]].forEach(([mx, k], i) => {
      c.strokeStyle = "#5a3d26"; c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); c.moveTo(mx, y + h * 0.5); c.lineTo(mx, y - 120 * k + sway * 0.3); c.stroke();
      c.fillStyle = "#f4ecd8"; c.strokeStyle = ink; c.lineWidth = 4;
      c.beginPath(); c.moveTo(mx - 62, y - 100 * k); c.quadraticCurveTo(mx + sway * 2, y - 78 * k + 22, mx + 62, y - 100 * k); c.lineTo(mx + 56, y + 6); c.quadraticCurveTo(mx + sway * 2, y + 30, mx - 56, y + 6); c.closePath(); c.fill(); c.stroke();
      if (i === 1) { c.fillStyle = ink; c.beginPath(); c.arc(mx, y - 42, 12, 0, 7); c.fill(); c.fillStyle = "#f4ecd8"; c.fillRect(mx - 5, y - 46, 3, 4); c.fillRect(mx + 2, y - 46, 3, 4); c.strokeStyle = "#f4ecd8"; c.lineWidth = 3; c.beginPath(); c.moveTo(mx - 14, y - 22); c.lineTo(mx + 14, y - 30); c.moveTo(mx + 14, y - 22); c.lineTo(mx - 14, y - 30); c.stroke(); }
    });
    c.lineCap = "butt";
    // bandeira
    const fx = x + w * 0.66; c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.moveTo(fx, y - 118); c.lineTo(fx, y - 150); c.stroke();
    c.fillStyle = "#15131f"; c.beginPath(); c.moveTo(fx, y - 150); c.lineTo(fx + 40, y - 142 + Math.sin(t / 250) * 4); c.lineTo(fx, y - 128); c.closePath(); c.fill();
    // casco
    c.fillStyle = vg(c, y + h * 0.35, y + h, "#9a6a3c", "#5a3a20"); c.strokeStyle = ink; c.lineWidth = 5;
    c.beginPath(); c.moveTo(x, y + h * 0.42); c.lineTo(x + w, y + h * 0.42); c.quadraticCurveTo(x + w - 20, y + h - 10, x + w * 0.75, y + h); c.lineTo(x + w * 0.25, y + h); c.quadraticCurveTo(x + 20, y + h - 10, x, y + h * 0.42); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#e2b84a"; c.fillRect(x + 8, y + h * 0.5, w - 16, 7);
    for (let i = 0; i < 5; i++) { const px = x + 50 + i * ((w - 100) / 4); c.fillStyle = ink; c.beginPath(); c.arc(px, y + h * 0.7, 9, 0, 7); c.fill(); c.strokeStyle = "#e2b84a"; c.lineWidth = 2; c.stroke(); }
    c.fillStyle = "#c98a4a"; c.strokeStyle = ink; c.lineWidth = 4; rr(c, x + w - 34, y + h * 0.28, 40, h * 0.16, 4); c.fill(); c.stroke();
    // escada de corda até a porta
    c.strokeStyle = "#d8c49a"; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + w * 0.24, y + h * 0.6); c.lineTo(cx + w * 0.24 + 12, y + h + 70); c.moveTo(cx + w * 0.24 + 34, y + h * 0.6); c.lineTo(cx + w * 0.24 + 46, y + h + 70); c.stroke();
    for (let k = 0; k < 6; k++) { const yy = y + h * 0.66 + k * ((h * 0.34 + 70) / 6); c.beginPath(); c.moveTo(cx + w * 0.24 + k * 2, yy); c.lineTo(cx + w * 0.24 + 34 + k * 2, yy); c.stroke(); }
  }
  // Holandês Voador: casco fantasma verde, velas rasgadas e brilho pulsante (só à noite)
  function ghostShip(c, d, t) {
    const { x, y, w, h } = d, pulse = 0.5 + Math.sin(t / 600) * 0.15;
    c.save(); c.globalAlpha = 0.55 + pulse * 0.3;
    const g = c.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.7); g.addColorStop(0, "rgba(120,255,190,0.55)"); g.addColorStop(1, "rgba(120,255,190,0)");
    c.fillStyle = g; c.fillRect(x - 60, y - 60, w + 120, h + 120);
    c.fillStyle = "#2a3a3c"; c.strokeStyle = "#9fe8c9"; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x + 10, y + h * 0.55); c.lineTo(x + w - 10, y + h * 0.55); c.quadraticCurveTo(x + w - 30, y + h, x + w * 0.7, y + h); c.lineTo(x + w * 0.3, y + h); c.quadraticCurveTo(x + 30, y + h, x + 10, y + h * 0.55); c.fill(); c.stroke();
    c.strokeStyle = "#9fe8c9"; c.lineWidth = 6; c.beginPath(); c.moveTo(x + w / 2, y + h * 0.55); c.lineTo(x + w / 2, y - 30); c.stroke();
    c.fillStyle = "rgba(200,255,230,0.55)"; c.beginPath(); c.moveTo(x + w / 2 - 70, y - 20); c.lineTo(x + w / 2 + 70, y - 26); c.lineTo(x + w / 2 + 56 + Math.sin(t / 300) * 4, y + h * 0.5); c.lineTo(x + w / 2 + 30, y + h * 0.38); c.lineTo(x + w / 2 - 6, y + h * 0.5); c.lineTo(x + w / 2 - 56, y + h * 0.42); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
  function whirl(c, d, t) {
    c.save(); c.translate(d.x, d.y);
    for (let i = 0; i < 7; i++) { c.strokeStyle = `rgba(255,255,255,${0.75 - i * 0.09})`; c.lineWidth = 6 - i * 0.6; c.beginPath(); for (let a = 0; a < Math.PI * 3.2; a += 0.2) { const r = 8 + a * (d.r / 10) * (1 + i * 0.05); const th = a + i * 0.9 + t / 500; c.lineTo(Math.cos(th) * r, Math.sin(th) * r * 0.55); } c.stroke(); }
    c.restore();
  }
  // alameda de pedra (caminho do memorial): faixa clara com borda e juntas
  function pathRect(c, d) {
    c.fillStyle = "#e6dcc6"; c.strokeStyle = "#b8a98a"; c.lineWidth = 3; rr(c, d.x, d.y, d.w, d.h, 26); c.fill(); c.stroke();
    c.strokeStyle = "rgba(120,100,70,0.22)"; c.lineWidth = 2;
    if (d.h > d.w) { for (let y = d.y + 40; y < d.y + d.h; y += 48) { c.beginPath(); c.moveTo(d.x + 8, y); c.lineTo(d.x + d.w - 8, y); c.stroke(); } }
    else { for (let x = d.x + 40; x < d.x + d.w; x += 48) { c.beginPath(); c.moveTo(x, d.y + 8); c.lineTo(x, d.y + d.h - 8); c.stroke(); } }
  }
  // recinto de bioma (zoológico): mancha colorida com o nome no alto
  function zoneRect(c, d) {
    c.save(); c.globalAlpha = 0.42; c.fillStyle = d.color; rr(c, d.x, d.y, d.w, d.h, 34); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = "rgba(40,60,40,0.55)"; c.lineWidth = 4; c.setLineDash([14, 10]); rr(c, d.x, d.y, d.w, d.h, 34); c.stroke(); c.setLineDash([]);
    c.font = "bold 24px system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#1f2a1f"; c.fillText(d.label || "", d.x + d.w / 2, d.y + 26);
    c.restore();
  }
  function drawDeco(c, d, t, night) {
    if (d.when === "night" && !night) return;
    if (d.type === "sea") drawWaterRect(c, d.x, d.y, d.w, d.h, t);
    else if (d.type === "pier") pier(c, d);
    else if (d.type === "path") pathRect(c, d);
    else if (d.type === "zone") zoneRect(c, d);
    else if (d.type === "boat") moored(c, d.x, d.y, t);
    else if (d.type === "ghost") ghostShip(c, d, t);
    else if (d.type === "whirl") whirl(c, d, t);
  }


  // lago da praça: água com reflexo, ondas, vitórias-régias e patos nadando
  function pond(c, s, t) {
    c.fillStyle = "rgba(21,19,31,0.2)"; rr(c, s.x + 8, s.y + 10, s.w, s.h, 30); c.fill();
    c.fillStyle = "#c9b48f"; c.strokeStyle = ink; c.lineWidth = 5; rr(c, s.x - 8, s.y - 8, s.w + 16, s.h + 16, 34); c.fill(); c.stroke();
    c.fillStyle = vg(c, s.y, s.y + s.h, "#8fd0ec", "#4f9bc8"); rr(c, s.x, s.y, s.w, s.h, 28); c.fill(); c.lineWidth = 3; c.stroke();
    c.save(); rr(c, s.x, s.y, s.w, s.h, 28); c.clip();
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const yy = s.y + 30 + i * (s.h - 50) / 5; c.beginPath(); for (let xx = s.x; xx <= s.x + s.w; xx += 30) c.lineTo(xx, yy + Math.sin(xx / 40 + t / 700 + i) * 4); c.stroke(); }
    [[0.2, 0.3], [0.7, 0.65], [0.45, 0.8]].forEach(([fx, fy], i) => { const lx = s.x + s.w * fx, ly = s.y + s.h * fy; c.fillStyle = "#4aa85a"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, ly); c.arc(lx, ly, 15, 0.4, 5.9); c.closePath(); c.fill(); c.stroke(); if (i === 0) { c.fillStyle = "#f7a8c8"; c.beginPath(); c.arc(lx + 3, ly - 2, 5, 0, 7); c.fill(); } });
    [[0.35, 0.5, 1], [0.6, 0.35, -1]].forEach(([fx, fy, dir], i) => {
      const dx = s.x + s.w * fx + Math.sin(t / 2000 + i * 3) * 40, dy = s.y + s.h * fy + Math.sin(t / 900 + i) * 3;
      c.save(); c.translate(dx, dy); c.scale(dir, 1);
      c.fillStyle = "#f4f0e0"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 18, 11, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#d9d0b8"; c.beginPath(); c.ellipse(-5, -1, 10, 6, 0, 0, 7); c.fill();
      c.fillStyle = "#3f7a4a"; c.beginPath(); c.arc(14, -12, 8, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#f2a83a"; c.beginPath(); c.moveTo(20, -12); c.lineTo(29, -9); c.lineTo(20, -6); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(16, -14, 1.4, 0, 7); c.fill(); c.restore();
      c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 2; c.beginPath(); c.ellipse(dx, dy + 8, 26, 7, 0, 0, 7); c.stroke();
    });
    c.restore();
  }


  // ---------------------------------------------------------------- moradores da Fenda do Biquíni (personagens originais)
  const face = (c, ex, ey, gap, r, blink) => {
    [-1, 1].forEach((k) => { c.fillStyle = "#fff"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.ellipse(ex + k * gap, ey, r, r * (blink ? 0.15 : 1.15), 0, 0, 7); c.fill(); c.stroke(); if (!blink) { c.fillStyle = ink; c.beginPath(); c.arc(ex + k * gap + 0.8, ey + 0.6, r * 0.5, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.arc(ex + k * gap + 2, ey - 1.5, r * 0.18, 0, 7); c.fill(); } });
  };
  const smile = (c, x, y, w, sad) => { c.strokeStyle = ink; c.lineWidth = 2; c.lineCap = "round"; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y + (sad ? -w * 0.5 : w * 0.7), x + w, y); c.stroke(); c.lineCap = "butt"; };
  const blush = (c, x, y, gap) => { c.fillStyle = "rgba(255,120,150,0.5)"; [-1, 1].forEach((k) => { c.beginPath(); c.ellipse(x + k * gap, y, 4, 2.6, 0, 0, 7); c.fill(); }); };

  // Porina, a esponja: corpo de barril azul-esverdeado com poros, tubinhos no topo, óculos redondos e jeitinho encolhido
  function sponge(c, t) {
    const sq = Math.sin(t / 900) * 0.03, blink = (t % 3400) < 130;
    c.save(); c.scale(1 + sq, 1 - sq);
    const g = c.createLinearGradient(-22, 0, 22, 0); g.addColorStop(0, "#3a9fa0"); g.addColorStop(0.5, "#6fd0c4"); g.addColorStop(1, "#3a9fa0");
    c.fillStyle = g; c.strokeStyle = ink; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-20, -6); c.quadraticCurveTo(-26, -34, -18, -56); c.quadraticCurveTo(0, -64, 18, -56); c.quadraticCurveTo(26, -34, 20, -6); c.quadraticCurveTo(0, 4, -20, -6); c.closePath(); c.fill(); c.stroke();
    [-13, 0, 13].forEach((tx, i) => { c.fillStyle = "#4fb8b0"; c.beginPath(); c.ellipse(tx, -59 + Math.abs(i - 1) * 3, 6, 5.5, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#1f6a6a"; c.beginPath(); c.ellipse(tx, -60 + Math.abs(i - 1) * 3, 3.2, 2.4, 0, 0, 7); c.fill(); });
    c.fillStyle = "rgba(20,90,95,0.45)"; [[-12, -20], [10, -14], [-4, -8], [14, -30], [-14, -38], [4, -26]].forEach(([px, py]) => { c.beginPath(); c.ellipse(px, py, 2.4, 1.8, 0, 0, 7); c.fill(); });
    face(c, 0, -38, 8, 5.5, blink);
    c.strokeStyle = "#7a3f1f"; c.lineWidth = 2; [-1, 1].forEach((k) => { c.beginPath(); c.arc(k * 8, -38, 8, 0, 7); c.stroke(); }); c.beginPath(); c.moveTo(-1, -38); c.lineTo(1, -38); c.stroke();   // óculos
    blush(c, 0, -28, 12); smile(c, 0, -24, 5, true);
    c.strokeStyle = ink; c.lineWidth = 3; c.lineCap = "round"; [-1, 1].forEach((k) => { c.beginPath(); c.moveTo(k * 20, -26); c.quadraticCurveTo(k * 30, -22 + Math.sin(t / 500 + k) * 2, k * 27, -14); c.stroke(); }); c.lineCap = "butt";
    c.restore();
    [-1, 1].forEach((k) => { c.fillStyle = "#f2a83a"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.ellipse(k * 9, -2, 7, 4, 0, 0, 7); c.fill(); c.stroke(); });
  }
  // Astéria, a estrela-do-mar: coral-rosada com pintinhas, uma florzinha na cabeça e olhar preocupado
  function starfish(c, t) {
    const w = Math.sin(t / 700) * 0.06, blink = (t % 4100) < 130;
    c.save(); c.translate(0, -30);
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5 + (i % 2 ? 0 : w * (i % 4 ? 1 : -1)), r = i % 2 ? 13 : 33; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    c.fillStyle = "#f2708a"; c.strokeStyle = ink; c.lineWidth = 3; c.lineJoin = "round"; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.35)"; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; [12, 20, 27].forEach((r) => { c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, 1.6, 0, 7); c.fill(); }); }
    face(c, 0, -2, 6.5, 4.6, blink);
    c.strokeStyle = ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-11, -11); c.lineTo(-4, -8); c.moveTo(11, -11); c.lineTo(4, -8); c.stroke();   // sobrancelhas aflitas
    blush(c, 0, 5, 10); smile(c, 0, 10, 4, true);
    c.translate(0, -30); c.fillStyle = "#ffd84a"; c.strokeStyle = ink; c.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5; c.fillStyle = i % 2 ? "#fff" : "#ffb3d1"; c.beginPath(); c.ellipse(Math.cos(a) * 4, Math.sin(a) * 4, 3, 3, 0, 0, 7); c.fill(); c.stroke(); } c.fillStyle = "#ffd84a"; c.beginPath(); c.arc(0, 0, 2.4, 0, 7); c.fill();
    c.restore();
  }
  // Tintinha, a lula: manto alto e pontudo em violeta e rosa, nadadeiras, tentáculos ondulantes e uma faixa de cabeça
  function squid(c, t) {
    const bob = Math.sin(t / 800) * 2, blink = (t % 3700) < 130;
    c.save(); c.translate(0, bob * 0.5);
    [-1, 1].forEach((k, j) => { c.strokeStyle = "#b08ae8"; c.lineWidth = 7; c.lineCap = "round"; for (let i = 0; i < 4; i++) { const x0 = (i - 1.5) * 8 + k * 0.001, sw = Math.sin(t / 400 + i * 1.3 + j) * 4; c.beginPath(); c.moveTo(x0, -18); c.quadraticCurveTo(x0 + sw, -8, x0 - sw * 0.6, 0 + (i % 2) * 3); c.stroke(); } });
    c.lineCap = "butt";
    const g = c.createLinearGradient(0, -80, 0, -14); g.addColorStop(0, "#c9a5f5"); g.addColorStop(1, "#8a6ad8");
    c.fillStyle = "#b08ae8"; c.strokeStyle = ink; c.lineWidth = 3;
    [-1, 1].forEach((k) => { c.beginPath(); c.moveTo(k * 9, -66); c.lineTo(k * 24, -56 + Math.sin(t / 500) * 2); c.lineTo(k * 10, -46); c.closePath(); c.fill(); c.stroke(); });   // nadadeiras
    c.fillStyle = g; c.beginPath(); c.moveTo(-14, -18); c.quadraticCurveTo(-19, -50, 0, -84); c.quadraticCurveTo(19, -50, 14, -18); c.quadraticCurveTo(0, -10, -14, -18); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.28)"; c.beginPath(); c.ellipse(-6, -58, 3, 12, 0.25, 0, 7); c.fill();
    c.fillStyle = "#ff8fb8"; c.beginPath(); c.moveTo(-14.5, -34); c.lineTo(14.5, -34); c.lineTo(14, -29); c.lineTo(-14, -29); c.closePath(); c.fill(); c.stroke();   // faixa
    c.beginPath(); c.arc(0, -31.5, 3.6, 0, 7); c.fillStyle = "#ffd84a"; c.fill(); c.stroke();
    face(c, 0, -43, 6, 4.6, blink);
    blush(c, 0, -36, 9); smile(c, 0, -21.5, 3.6, false);
    c.restore();
  }
  function drawCreature(c, kind, x, y, t) {
    const bob = Math.sin(t / 550 + x) * 3;
    c.fillStyle = "rgba(21,19,31,0.28)"; c.beginPath(); c.ellipse(x, y + 4, 24, 8, 0, 0, 7); c.fill();
    c.save(); c.translate(x, y - 4 + bob);
    if (kind === "sponge") sponge(c, t); else if (kind === "star") starfish(c, t); else squid(c, t);
    c.restore();
  }

  // casas da fenda: cada morador tem a sua (e nenhuma lembra as de desenhos conhecidos)
  function fendaHouse(c, s, t) {
    const cx = s.x + s.w / 2, base = s.y + s.h, sway = Math.sin(t / 1300 + s.x) * 2;
    c.fillStyle = "rgba(0,20,50,0.35)"; c.beginPath(); c.ellipse(cx, base + 4, s.w * 0.52, 16, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 5;
    if (s.house === "sponge") {   // uma esponja-vaso gigante, cheia de furos, com porta redonda
      const g = c.createLinearGradient(s.x, 0, s.x + s.w, 0); g.addColorStop(0, "#c56fb3"); g.addColorStop(0.5, "#eaa0d4"); g.addColorStop(1, "#b25aa0");
      c.fillStyle = g; c.beginPath(); c.moveTo(s.x + 30, base); c.quadraticCurveTo(s.x - 6, s.y + s.h * 0.4, s.x + 50, s.y + 20); c.lineTo(s.x + s.w - 50, s.y + 20); c.quadraticCurveTo(s.x + s.w + 6, s.y + s.h * 0.4, s.x + s.w - 30, base); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#5a2a58"; c.beginPath(); c.ellipse(cx, s.y + 22, s.w / 2 - 50, 13, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = "rgba(90,30,90,0.5)"; [[0.22, 0.42], [0.72, 0.36], [0.4, 0.62], [0.62, 0.7], [0.3, 0.8], [0.8, 0.6]].forEach(([fx, fy]) => { c.beginPath(); c.ellipse(s.x + s.w * fx, s.y + s.h * fy, 7, 5, 0, 0, 7); c.fill(); });
      c.fillStyle = "#fff4d6"; c.beginPath(); c.arc(cx, base - 42, 26, Math.PI, 0); c.lineTo(cx + 26, base); c.lineTo(cx - 26, base); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#e2b84a"; c.beginPath(); c.arc(cx + 14, base - 22, 3, 0, 7); c.fill();
    } else if (s.house === "star") {   // uma gruta de pedra arredondada com janela em forma de estrela e algas na porta
      c.fillStyle = "#8f83b8"; c.beginPath(); c.moveTo(s.x, base); c.quadraticCurveTo(s.x - 4, s.y + 30, cx, s.y); c.quadraticCurveTo(s.x + s.w + 4, s.y + 30, s.x + s.w, base); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "rgba(255,255,255,0.18)"; c.beginPath(); c.ellipse(cx - 40, s.y + 50, 40, 20, -0.4, 0, 7); c.fill();
      c.fillStyle = "#ffe6a0"; c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 9 : 22; c.lineTo(cx + Math.cos(a) * r, s.y + 62 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
      c.lineWidth = 5; c.fillStyle = "#3a2f5a"; c.beginPath(); c.arc(cx, base - 34, 28, Math.PI, 0); c.lineTo(cx + 28, base); c.lineTo(cx - 28, base); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = "#3f9b4f"; c.lineWidth = 5; c.lineCap = "round"; [-34, 34].forEach((dx, i) => { c.beginPath(); c.moveTo(cx + dx, base); c.quadraticCurveTo(cx + dx + sway * (i ? 1 : -1), base - 30, cx + dx * 0.8, base - 56); c.stroke(); }); c.lineCap = "butt";
    } else {   // um enorme vidro de tinta azul-violeta com rolha, portinha e janelinhas redondas
      c.fillStyle = "#5a52c8"; c.beginPath(); c.moveTo(s.x + 24, base); c.lineTo(s.x + 8, s.y + 90); c.quadraticCurveTo(s.x + 8, s.y + 50, cx - 34, s.y + 44); c.lineTo(cx - 34, s.y + 16); c.lineTo(cx + 34, s.y + 16); c.lineTo(cx + 34, s.y + 44); c.quadraticCurveTo(s.x + s.w - 8, s.y + 50, s.x + s.w - 8, s.y + 90); c.lineTo(s.x + s.w - 24, base); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#c98a4a"; c.fillRect(cx - 26, s.y - 2, 52, 22); c.strokeRect(cx - 26, s.y - 2, 52, 22);
      c.fillStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.ellipse(s.x + 46, s.y + 100, 8, 40, 0.15, 0, 7); c.fill();
      [[-46, 80], [46, 80]].forEach(([dx, dy]) => { c.fillStyle = "#ffe9a8"; c.beginPath(); c.arc(cx + dx, s.y + dy, 15, 0, 7); c.fill(); c.strokeStyle = ink; c.lineWidth = 3; c.stroke(); });
      c.lineWidth = 5; c.fillStyle = "#2a2668"; c.beginPath(); c.arc(cx, base - 30, 24, Math.PI, 0); c.lineTo(cx + 24, base); c.lineTo(cx - 24, base); c.closePath(); c.fill(); c.stroke();
    }
  }

  // ---------------------------------------------------------------- objetos e móveis
  function tree(c, x, y, s, t) {
    const sway = Math.sin(t / 900 + x) * 1.5;
    c.fillStyle = "rgba(21,19,31,0.2)"; c.beginPath(); c.ellipse(x, y + s * 0.34, s * 0.4, s * 0.1, 0, 0, 7); c.fill();
    c.fillStyle = "#6b4a2b"; c.strokeStyle = ink; c.lineWidth = 3; c.fillRect(x - s * 0.07, y, s * 0.14, s * 0.36); c.strokeRect(x - s * 0.07, y, s * 0.14, s * 0.36);
    [[0, -s * 0.06, s * 0.36, "#3f9b4f"], [-s * 0.2, s * 0.02, s * 0.26, "#4aa85a"], [s * 0.2, s * 0.02, s * 0.26, "#37903f"], [0, -s * 0.3, s * 0.26, "#56b35f"]].forEach(([dx, dy, r, col]) => {
      c.fillStyle = col; c.beginPath(); c.arc(x + dx + sway, y + dy - s * 0.02, r, 0, 7); c.fill(); c.stroke();
    });
    c.fillStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.arc(x - s * 0.1 + sway, y - s * 0.32, s * 0.12, 0, 7); c.fill();
  }
  function palm(c, x, y, s, t) {
    const sway = Math.sin(t / 700 + x) * 3;
    c.fillStyle = "rgba(21,19,31,0.2)"; c.beginPath(); c.ellipse(x, y + s * 0.34, s * 0.3, s * 0.08, 0, 0, 7); c.fill();
    c.strokeStyle = "#8a6a3a"; c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y + s * 0.34); c.quadraticCurveTo(x + 8, y, x + sway, y - s * 0.3); c.stroke();
    c.strokeStyle = "#3f9b4f"; c.lineWidth = 6;
    [-2.5, -1.9, -1.2, -0.6, 0.1].forEach((a) => { c.beginPath(); c.moveTo(x + sway, y - s * 0.3); c.quadraticCurveTo(x + sway + Math.cos(a) * s * 0.25, y - s * 0.55 + Math.sin(a) * s * 0.1, x + sway + Math.cos(a) * s * 0.45, y - s * 0.25 + Math.sin(a) * s * 0.2); c.stroke(); });
    c.lineCap = "butt";
  }
  function plantPot(c, x, y, s) {
    c.fillStyle = "rgba(21,19,31,0.2)"; c.beginPath(); c.ellipse(x, y + s * 0.32, s * 0.3, s * 0.08, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.5;
    ["#3f9b4f", "#56b35f", "#2f8442"].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.ellipse(x + (i - 1) * s * 0.16, y - s * 0.12, s * 0.09, s * 0.3, (i - 1) * 0.5, 0, 7); c.fill(); c.stroke(); });
    c.fillStyle = "#d9694a"; c.beginPath(); c.moveTo(x - s * 0.26, y + s * 0.06); c.lineTo(x + s * 0.26, y + s * 0.06); c.lineTo(x + s * 0.18, y + s * 0.34); c.lineTo(x - s * 0.18, y + s * 0.34); c.closePath(); c.fill(); c.stroke();
  }
  function bench(c, x, y, s) {
    c.fillStyle = "rgba(21,19,31,0.2)"; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.5, s * 0.09, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.5; c.fillStyle = "#b07a44";
    c.fillRect(x - s * 0.45, y - s * 0.12, s * 0.9, s * 0.1); c.strokeRect(x - s * 0.45, y - s * 0.12, s * 0.9, s * 0.1);
    c.fillRect(x - s * 0.45, y - s * 0.32, s * 0.9, s * 0.1); c.strokeRect(x - s * 0.45, y - s * 0.32, s * 0.9, s * 0.1);
    c.fillStyle = "#3a3a4a"; [-0.38, 0.32].forEach((k) => { c.fillRect(x + s * k, y - s * 0.04, s * 0.06, s * 0.3); });
  }
  function cloud(c, x, y, s, t) {
    const dx = Math.sin(t / 2500 + x) * 6;
    c.fillStyle = "rgba(255,255,255,0.92)";
    [[0, 0, 0.3], [-0.28, 0.06, 0.22], [0.28, 0.06, 0.24], [0.1, -0.12, 0.22]].forEach(([ox, oy, r]) => { c.beginPath(); c.arc(x + dx + ox * s, y + oy * s, r * s, 0, 7); c.fill(); });
  }
  function car(c, x, y, s) {
    const col = ["#d9453a", "#3f7fd8", "#f2c230", "#4a9a5a"][hash(String(Math.round(x))) % 4];
    c.fillStyle = "rgba(21,19,31,0.25)"; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.5, s * 0.1, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 3;
    c.fillStyle = col; rr(c, x - s * 0.55, y - s * 0.05, s * 1.1, s * 0.34, 8); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - s * 0.32, y - s * 0.05); c.lineTo(x - s * 0.2, y - s * 0.3); c.lineTo(x + s * 0.22, y - s * 0.3); c.lineTo(x + s * 0.36, y - s * 0.05); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#bfe3f5"; c.beginPath(); c.moveTo(x - s * 0.24, y - s * 0.07); c.lineTo(x - s * 0.15, y - s * 0.25); c.lineTo(x + s * 0.17, y - s * 0.25); c.lineTo(x + s * 0.28, y - s * 0.07); c.closePath(); c.fill();
    c.fillStyle = "#2a2a34"; [-0.32, 0.32].forEach((k) => { c.beginPath(); c.arc(x + s * k, y + s * 0.3, s * 0.11, 0, 7); c.fill(); c.stroke(); });
  }
  function fountain(c, x, y, s, t) {
    c.fillStyle = "rgba(21,19,31,0.2)"; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.5, s * 0.12, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 3; c.fillStyle = "#c9ccd6"; c.beginPath(); c.ellipse(x, y + s * 0.2, s * 0.46, s * 0.16, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = "#6fc3ea"; c.beginPath(); c.ellipse(x, y + s * 0.18, s * 0.38, s * 0.11, 0, 0, 7); c.fill();
    c.fillStyle = "#c9ccd6"; c.fillRect(x - s * 0.05, y - s * 0.12, s * 0.1, s * 0.3); c.strokeRect(x - s * 0.05, y - s * 0.12, s * 0.1, s * 0.3);
    c.strokeStyle = "rgba(160,220,255,0.9)"; c.lineWidth = 3;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x, y - s * 0.14); c.quadraticCurveTo(x + i * s * 0.2, y - s * 0.4 + Math.sin(t / 200 + i) * 3, x + i * s * 0.32, y + s * 0.12); c.stroke(); }
  }
  function umbrella(c, x, y, s) {
    c.strokeStyle = "#8a6a3a"; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y + s * 0.3); c.lineTo(x, y - s * 0.2); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 3;
    ["#e2473a", "#fff", "#e2473a", "#fff"].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s * 0.24); c.arc(x, y - s * 0.02, s * 0.42, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); c.closePath(); c.fill(); });
  }

  function wave(c, x, y, s, t) { c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 4; c.lineCap = "round"; for (let i = 0; i < 2; i++) { c.beginPath(); for (let a = -s * 0.5; a <= s * 0.5; a += 8) c.lineTo(x + a, y + i * 12 + Math.sin(a / 14 + t / 500 + x) * 5); c.stroke(); } c.lineCap = "butt"; }
  function sailboat(c, x, y, s, t) {
    const b = Math.sin(t / 700 + x) * 3;
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.34, s * 0.4, s * 0.07, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 3; c.fillStyle = "#f4ecd8";
    c.beginPath(); c.moveTo(x, y - s * 0.42 + b); c.lineTo(x + s * 0.32, y + s * 0.12 + b); c.lineTo(x, y + s * 0.12 + b); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#e2473a"; c.beginPath(); c.moveTo(x - 4, y - s * 0.3 + b); c.lineTo(x - s * 0.26, y + s * 0.12 + b); c.lineTo(x - 4, y + s * 0.12 + b); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#3f5a8a"; c.beginPath(); c.moveTo(x - s * 0.34, y + s * 0.16 + b); c.lineTo(x + s * 0.4, y + s * 0.16 + b); c.lineTo(x + s * 0.26, y + s * 0.3 + b); c.lineTo(x - s * 0.22, y + s * 0.3 + b); c.closePath(); c.fill(); c.stroke();
  }
  function dolphin(c, x, y, s, t) {
    const a = Math.sin(t / 900 + x) * 0.25, j = Math.max(0, Math.sin(t / 1400 + x)) * s * 0.5;
    c.save(); c.translate(x, y - j); c.rotate(a);
    c.fillStyle = "#7a93b0"; c.strokeStyle = ink; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-s * 0.5, s * 0.05); c.quadraticCurveTo(-s * 0.1, -s * 0.35, s * 0.4, -s * 0.05); c.quadraticCurveTo(s * 0.55, 0, s * 0.62, -s * 0.05); c.quadraticCurveTo(s * 0.5, s * 0.1, s * 0.3, s * 0.12); c.quadraticCurveTo(-s * 0.1, s * 0.3, -s * 0.5, s * 0.05); c.fill(); c.stroke();
    c.fillStyle = "#7a93b0"; c.beginPath(); c.moveTo(-s * 0.5, s * 0.05); c.lineTo(-s * 0.68, -s * 0.12); c.lineTo(-s * 0.62, s * 0.16); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#e7eef5"; c.beginPath(); c.ellipse(s * 0.05, s * 0.1, s * 0.3, s * 0.07, 0.1, 0, 7); c.fill();
    c.fillStyle = ink; c.beginPath(); c.arc(s * 0.36, -s * 0.03, 2.5, 0, 7); c.fill();
    c.restore();
  }
  function surfer(c, x, y, s, t) {
    const b = Math.sin(t / 600 + x) * 3;
    c.save(); c.translate(x, y + b);
    c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, s * 0.3, s * 0.55, s * 0.1, 0, 0, 7); c.stroke();
    c.fillStyle = "#f08a4a"; c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.ellipse(0, s * 0.25, s * 0.5, s * 0.09, -0.08, 0, 7); c.fill(); c.stroke();
    c.fillStyle = "#3f7fd8"; c.beginPath(); c.moveTo(-6, s * 0.2); c.lineTo(-9, -s * 0.16); c.lineTo(9, -s * 0.16); c.lineTo(6, s * 0.2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#e9c9a8"; c.beginPath(); c.arc(0, -s * 0.28, s * 0.13, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -s * 0.08); c.lineTo(-s * 0.32, -s * 0.2 + Math.sin(t / 300) * 3); c.moveTo(8, -s * 0.08); c.lineTo(s * 0.32, -s * 0.2 - Math.sin(t / 300) * 3); c.stroke();
    c.restore();
  }
  function rock(c, x, y, s) {
    c.fillStyle = "rgba(21,19,31,0.2)"; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.42, s * 0.09, 0, 0, 7); c.fill();
    c.fillStyle = "#8a8f98"; c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.moveTo(x - s * 0.4, y + s * 0.3); c.lineTo(x - s * 0.3, y - s * 0.1); c.lineTo(x, y - s * 0.3); c.lineTo(x + s * 0.32, y - s * 0.05); c.lineTo(x + s * 0.4, y + s * 0.3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.25)"; c.beginPath(); c.moveTo(x - s * 0.22, y - s * 0.05); c.lineTo(x, y - s * 0.24); c.lineTo(x + s * 0.06, y - s * 0.1); c.closePath(); c.fill();
  }
  // ---------------------------------------------------------------- objetos de cenário desenhados
  // Estes eram emojis desenhados como texto, que é o que mais destoava dentro das casas e lojas.
  // Mesmo traço dos outros: sombra ovalada no chão, preenchimento chapado e contorno de tinta.
  function pine(c, x, y, s, t) {                                   // 🌲 pinheiro
    const w = Math.sin((t || 0) / 2200 + x) * 2;
    c.fillStyle = "rgba(21,19,31,0.2)"; c.beginPath(); c.ellipse(x, y + s * 0.34, s * 0.3, s * 0.08, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.5;
    c.fillStyle = "#7a5333"; c.fillRect(x - s * 0.06, y, s * 0.12, s * 0.34); c.strokeRect(x - s * 0.06, y, s * 0.12, s * 0.34);
    [[0.42, 0.06], [0.33, -0.2], [0.23, -0.44]].forEach(([larg, topo], i) => {
      c.fillStyle = ["#2f6b3f", "#377d48", "#3f8f52"][i];
      c.beginPath(); c.moveTo(x + w * (i + 1) * 0.4, y + s * (topo - 0.26)); c.lineTo(x + s * larg, y + s * topo); c.lineTo(x - s * larg, y + s * topo); c.closePath(); c.fill(); c.stroke();
    });
  }
  function bike(c, x, y, s) {                                      // 🚲 bicicleta encostada
    c.fillStyle = "rgba(21,19,31,0.2)"; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.45, s * 0.08, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.6;
    [-0.3, 0.3].forEach((k) => { c.beginPath(); c.arc(x + s * k, y + s * 0.12, s * 0.18, 0, 7); c.stroke(); });
    c.beginPath(); c.moveTo(x - s * 0.3, y + s * 0.12); c.lineTo(x - s * 0.04, y - s * 0.12); c.lineTo(x + s * 0.2, y - s * 0.12);
    c.lineTo(x + s * 0.3, y + s * 0.12); c.moveTo(x - s * 0.04, y - s * 0.12); c.lineTo(x + s * 0.06, y + s * 0.12); c.stroke();
    c.strokeStyle = "#d9534f"; c.lineWidth = 3.2; c.beginPath(); c.moveTo(x - s * 0.02, y - s * 0.16); c.lineTo(x + s * 0.12, y - s * 0.16); c.stroke();
  }
  function frame(c, x, y, s) {                                     // 🖼️ quadro na parede
    c.strokeStyle = ink; c.lineWidth = 2.6;
    c.fillStyle = "#c08b4a"; c.fillRect(x - s * 0.32, y - s * 0.34, s * 0.64, s * 0.5); c.strokeRect(x - s * 0.32, y - s * 0.34, s * 0.64, s * 0.5);
    c.fillStyle = "#cfe3f2"; c.fillRect(x - s * 0.25, y - s * 0.27, s * 0.5, s * 0.36);
    c.fillStyle = "#8fb98a"; c.beginPath(); c.moveTo(x - s * 0.25, y + s * 0.09); c.lineTo(x - s * 0.05, y - s * 0.12); c.lineTo(x + s * 0.11, y + s * 0.09); c.closePath(); c.fill();
    c.fillStyle = "#f2c230"; c.beginPath(); c.arc(x + s * 0.13, y - s * 0.17, s * 0.05, 0, 7); c.fill();
    c.strokeRect(x - s * 0.25, y - s * 0.27, s * 0.5, s * 0.36);
  }
  function tulip(c, x, y, s, t) {                                  // 🌷 tulipa
    const w = Math.sin((t || 0) / 1100 + x) * 2.5;
    c.strokeStyle = "#3f8f4a"; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x, y + s * 0.3); c.quadraticCurveTo(x + w * 0.4, y, x + w, y - s * 0.18); c.stroke();
    c.fillStyle = "#4aa85a"; c.beginPath(); c.ellipse(x - s * 0.1, y + s * 0.06, s * 0.1, s * 0.04, -0.5, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2;
    c.fillStyle = "#e0578f"; c.beginPath();
    c.moveTo(x + w - s * 0.12, y - s * 0.18); c.quadraticCurveTo(x + w - s * 0.14, y - s * 0.4, x + w, y - s * 0.34);
    c.quadraticCurveTo(x + w + s * 0.14, y - s * 0.4, x + w + s * 0.12, y - s * 0.18); c.closePath(); c.fill(); c.stroke();
  }
  function candle(c, x, y, s, t) {                                 // 🕯️ vela com chama que treme
    const f = 1 + Math.sin((t || 0) / 180 + x) * 0.12;
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.16, s * 0.05, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.3;
    c.fillStyle = "#f4efe4"; c.fillRect(x - s * 0.1, y - s * 0.1, s * 0.2, s * 0.4); c.strokeRect(x - s * 0.1, y - s * 0.1, s * 0.2, s * 0.4);
    c.strokeStyle = ink; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, y - s * 0.1); c.lineTo(x, y - s * 0.15); c.stroke();   // pavio ligando a chama
    c.fillStyle = "#f2b02e"; c.beginPath(); c.ellipse(x, y - s * 0.21, s * 0.055 * f, s * 0.1 * f, 0, 0, 7); c.fill();
    c.fillStyle = "#ffe89a"; c.beginPath(); c.ellipse(x, y - s * 0.19, s * 0.026 * f, s * 0.05 * f, 0, 0, 7); c.fill();
  }
  function snow(c, x, y, s, t) {                                   // ❄️ floco
    const g = Math.sin((t || 0) / 1500 + x) * 0.25;
    c.lineCap = "round";
    for (let dup = 0; dup < 2; dup++) {                            // contorno de tinta por baixo: sem ele o floco somia no fundo claro
      c.strokeStyle = dup ? "#dff0fb" : ink; c.lineWidth = dup ? 2.6 : 4.6;
      for (let i = 0; i < 3; i++) {
        const a = g + (i * Math.PI) / 3;
        c.beginPath(); c.moveTo(x - Math.cos(a) * s * 0.26, y - Math.sin(a) * s * 0.26); c.lineTo(x + Math.cos(a) * s * 0.26, y + Math.sin(a) * s * 0.26); c.stroke();
        [-1, 1].forEach((lado) => {                                // as farpinhas das pontas
          const px = x + Math.cos(a) * s * 0.26 * lado, py = y + Math.sin(a) * s * 0.26 * lado;
          [a + 2.4, a - 2.4].forEach((b) => { c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(b) * s * 0.1 * lado, py + Math.sin(b) * s * 0.1 * lado); c.stroke(); });
        });
      }
    }
    c.fillStyle = "#eaf6ff"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.arc(x, y, s * 0.07, 0, 7); c.fill(); c.stroke();
    c.lineCap = "butt";
  }
  function clock(c, x, y, s) {                                     // 🕰️ relógio de parede
    c.strokeStyle = ink; c.lineWidth = 2.6;
    c.fillStyle = "#8a5a33"; c.beginPath(); c.arc(x, y, s * 0.3, 0, 7); c.fill(); c.stroke();
    c.fillStyle = "#f6f1e6"; c.beginPath(); c.arc(x, y, s * 0.22, 0, 7); c.fill(); c.stroke();
    const m = typeof state !== "undefined" && state && state.clock ? state.clock : 600;   // marca a hora do jogo
    const hAng = ((m / 60) % 12) / 12 * Math.PI * 2 - Math.PI / 2, mAng = ((m % 60) / 60) * Math.PI * 2 - Math.PI / 2;
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(hAng) * s * 0.12, y + Math.sin(hAng) * s * 0.12); c.stroke();
    c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(mAng) * s * 0.18, y + Math.sin(mAng) * s * 0.18); c.stroke();
  }
  function mirror(c, x, y, s) {                                    // 🪞 espelho de corpo
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.34, s * 0.22, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.6;
    c.fillStyle = "#c9a227"; c.beginPath(); c.ellipse(x, y, s * 0.24, s * 0.36, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = "#dfeef7"; c.beginPath(); c.ellipse(x, y, s * 0.18, s * 0.3, 0, 0, 7); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 3; c.beginPath(); c.moveTo(x - s * 0.08, y + s * 0.14); c.lineTo(x + s * 0.06, y - s * 0.16); c.stroke();
  }
  function sunflower(c, x, y, s, t) {                              // 🌻 girassol
    const w = Math.sin((t || 0) / 1300 + x) * 2;
    c.strokeStyle = "#3f8f4a"; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, y + s * 0.34); c.quadraticCurveTo(x + w * 0.4, y, x + w, y - s * 0.16); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 2;
    c.fillStyle = "#f2c230";
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; c.beginPath(); c.ellipse(x + w + Math.cos(a) * s * 0.17, y - s * 0.16 + Math.sin(a) * s * 0.17, s * 0.09, s * 0.05, a, 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = "#7a4a22"; c.beginPath(); c.arc(x + w, y - s * 0.16, s * 0.11, 0, 7); c.fill(); c.stroke();
  }
  function star(c, x, y, s, t) {                                   // 🌟 e ⭐ estrela que pisca
    const b = 0.85 + Math.sin((t || 0) / 500 + x) * 0.15;
    c.fillStyle = "#ffd84a"; c.strokeStyle = ink; c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 10; i++) { const r = (i % 2 ? s * 0.12 : s * 0.28) * b, a = (i / 10) * Math.PI * 2 - Math.PI / 2; c[i ? "lineTo" : "moveTo"](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath(); c.fill(); c.stroke();
  }

  function window_(c, x, y, s, t) {                                // 🌅 janela com o céu da hora certa
    const m = typeof state !== "undefined" && state && state.clock ? state.clock : 600;
    const dia = m >= 360 && m < 1050, fim = m >= 1050 && m < 1170;
    c.strokeStyle = ink; c.lineWidth = 2.8;
    c.fillStyle = "#8a5a33"; c.fillRect(x - s * 0.36, y - s * 0.34, s * 0.72, s * 0.62); c.strokeRect(x - s * 0.36, y - s * 0.34, s * 0.72, s * 0.62);
    const g = c.createLinearGradient(0, y - s * 0.3, 0, y + s * 0.22);
    if (dia) { g.addColorStop(0, "#9ed2f2"); g.addColorStop(1, "#dff0fb"); }
    else if (fim) { g.addColorStop(0, "#f2a35a"); g.addColorStop(1, "#f7d9a0"); }
    else { g.addColorStop(0, "#2c3560"); g.addColorStop(1, "#5a6490"); }
    c.fillStyle = g; c.fillRect(x - s * 0.29, y - s * 0.27, s * 0.58, s * 0.48);
    c.fillStyle = dia ? "#f7e07a" : fim ? "#f6c04a" : "#f4f1e2";
    c.beginPath(); c.arc(x + s * 0.12, y - s * (dia ? 0.14 : 0.05), s * 0.07, 0, 7); c.fill();
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(x, y - s * 0.27); c.lineTo(x, y + s * 0.21); c.moveTo(x - s * 0.29, y - s * 0.03); c.lineTo(x + s * 0.29, y - s * 0.03); c.stroke();
    c.strokeRect(x - s * 0.29, y - s * 0.27, s * 0.58, s * 0.48);
    void t;
  }
  function pen(c, x, y, s) {                                       // 🖋️ caneta no descanso
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.2, s * 0.24, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.4;
    c.fillStyle = "#2b2f45"; c.beginPath(); c.moveTo(x - s * 0.22, y + s * 0.16); c.lineTo(x + s * 0.16, y - s * 0.22); c.lineTo(x + s * 0.24, y - s * 0.14); c.lineTo(x - s * 0.14, y + s * 0.22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#d9b44a"; c.beginPath(); c.moveTo(x + s * 0.16, y - s * 0.22); c.lineTo(x + s * 0.26, y - s * 0.28); c.lineTo(x + s * 0.24, y - s * 0.14); c.closePath(); c.fill(); c.stroke();
  }
  function clipboard(c, x, y, s) {                                 // 📋 prancheta
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.34, s * 0.22, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.6;
    c.fillStyle = "#a9762f"; rr(c, x - s * 0.24, y - s * 0.32, s * 0.48, s * 0.64, s * 0.05); c.fill(); c.stroke();
    c.fillStyle = "#faf6ec"; c.fillRect(x - s * 0.19, y - s * 0.24, s * 0.38, s * 0.5); c.strokeRect(x - s * 0.19, y - s * 0.24, s * 0.38, s * 0.5);
    c.strokeStyle = "#9aa0b4"; c.lineWidth = 1.8;
    [-0.14, -0.04, 0.06, 0.16].forEach((k) => { c.beginPath(); c.moveTo(x - s * 0.14, y + s * k); c.lineTo(x + s * 0.13, y + s * k); c.stroke(); });
    c.fillStyle = "#6f7a95"; c.strokeStyle = ink; c.lineWidth = 2.2; rr(c, x - s * 0.08, y - s * 0.38, s * 0.16, s * 0.1, s * 0.03); c.fill(); c.stroke();
  }
  function puzzle(c, x, y, s) {                                    // 🧩 peça de quebra-cabeça
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.28, s * 0.22, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.6; c.fillStyle = "#6f5f94";
    c.beginPath();
    c.moveTo(x - s * 0.24, y - s * 0.2); c.lineTo(x - s * 0.07, y - s * 0.2);
    c.arc(x, y - s * 0.2, s * 0.07, Math.PI, 0, false);            // o encaixe de cima aponta para FORA
    c.lineTo(x + s * 0.24, y - s * 0.2); c.lineTo(x + s * 0.24, y + s * 0.03);
    c.arc(x + s * 0.24, y + s * 0.1, s * 0.07, -Math.PI / 2, Math.PI / 2, false);   // e o da direita também
    c.lineTo(x + s * 0.24, y + s * 0.24); c.lineTo(x - s * 0.24, y + s * 0.24);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.28)"; c.beginPath(); c.arc(x - s * 0.1, y - s * 0.06, s * 0.07, 0, 7); c.fill();
  }
  function lamp(c, x, y, s) {                                      // 💡 luminária acesa
    c.strokeStyle = ink; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(x, y - s * 0.4); c.lineTo(x, y - s * 0.16); c.stroke();
    c.fillStyle = "#f2c230"; c.beginPath(); c.moveTo(x - s * 0.22, y + s * 0.06); c.lineTo(x + s * 0.22, y + s * 0.06); c.lineTo(x + s * 0.13, y - s * 0.18); c.lineTo(x - s * 0.13, y - s * 0.18); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(247,224,122,0.4)"; c.beginPath(); c.moveTo(x - s * 0.22, y + s * 0.06); c.lineTo(x + s * 0.22, y + s * 0.06); c.lineTo(x + s * 0.34, y + s * 0.32); c.lineTo(x - s * 0.34, y + s * 0.32); c.closePath(); c.fill();
  }
  function teddy(c, x, y, s) {                                     // 🧸 ursinho
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.24, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.4; c.fillStyle = "#b5813f";
    [[-0.17, -0.2, 0.09], [0.17, -0.2, 0.09]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + s * dx, y + s * dy, s * r, 0, 7); c.fill(); c.stroke(); });
    c.beginPath(); c.ellipse(x, y + s * 0.1, s * 0.2, s * 0.19, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.arc(x, y - s * 0.14, s * 0.17, 0, 7); c.fill(); c.stroke();
    c.fillStyle = "#e0c39a"; c.beginPath(); c.ellipse(x, y - s * 0.08, s * 0.08, s * 0.06, 0, 0, 7); c.fill();
    c.fillStyle = ink; [[-0.06, -0.17], [0.06, -0.17]].forEach(([dx, dy]) => { c.beginPath(); c.arc(x + s * dx, y + s * dy, s * 0.022, 0, 7); c.fill(); });
    c.beginPath(); c.arc(x, y - s * 0.09, s * 0.03, 0, 7); c.fill();
  }

  function gift(c, x, y, s) {                                      // 🎁 presente
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.26, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.6;
    c.fillStyle = "#c94f6d"; c.fillRect(x - s * 0.26, y - s * 0.14, s * 0.52, s * 0.42); c.strokeRect(x - s * 0.26, y - s * 0.14, s * 0.52, s * 0.42);
    c.fillStyle = "#e0788f"; c.fillRect(x - s * 0.3, y - s * 0.24, s * 0.6, s * 0.12); c.strokeRect(x - s * 0.3, y - s * 0.24, s * 0.6, s * 0.12);
    c.fillStyle = "#f2c230"; c.fillRect(x - s * 0.05, y - s * 0.24, s * 0.1, s * 0.52); c.strokeRect(x - s * 0.05, y - s * 0.24, s * 0.1, s * 0.52);
    [-1, 1].forEach((k) => { c.beginPath(); c.ellipse(x + k * s * 0.11, y - s * 0.3, s * 0.1, s * 0.07, k * 0.5, 0, 7); c.fill(); c.stroke(); });
  }
  function cart(c, x, y, s) {                                      // 🛒 carrinho de compras
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.32, s * 0.3, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.8;
    c.beginPath(); c.moveTo(x - s * 0.34, y - s * 0.26); c.lineTo(x - s * 0.22, y - s * 0.26); c.lineTo(x - s * 0.1, y + s * 0.14); c.lineTo(x + s * 0.26, y + s * 0.14); c.stroke();
    c.fillStyle = "#8fa3b4"; c.beginPath(); c.moveTo(x - s * 0.2, y - s * 0.14); c.lineTo(x + s * 0.34, y - s * 0.14); c.lineTo(x + s * 0.26, y + s * 0.12); c.lineTo(x - s * 0.12, y + s * 0.12); c.closePath(); c.fill(); c.stroke();
    [-0.06, 0.2].forEach((k) => { c.fillStyle = "#3a3a4a"; c.beginPath(); c.arc(x + s * k, y + s * 0.24, s * 0.07, 0, 7); c.fill(); c.stroke(); });
  }
  function balloon(c, x, y, s, t) {                                // 🎈 balão que flutua
    const w = Math.sin((t || 0) / 900 + x) * 3;
    c.strokeStyle = ink; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, y + s * 0.34); c.quadraticCurveTo(x + w, y + s * 0.1, x + w, y - s * 0.02); c.stroke();
    c.lineWidth = 2.6; c.fillStyle = "#d9534f";
    c.beginPath(); c.ellipse(x + w, y - s * 0.2, s * 0.2, s * 0.24, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.4)"; c.beginPath(); c.ellipse(x + w - s * 0.07, y - s * 0.27, s * 0.05, s * 0.08, -0.4, 0, 7); c.fill();
  }
  function backpack(c, x, y, s) {                                  // 🎒 mochila
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.32, s * 0.24, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.6; c.fillStyle = "#3f7d8f";
    rr(c, x - s * 0.24, y - s * 0.24, s * 0.48, s * 0.56, s * 0.12); c.fill(); c.stroke();
    c.fillStyle = "#2f6472"; rr(c, x - s * 0.18, y + s * 0.02, s * 0.36, s * 0.2, s * 0.05); c.fill(); c.stroke();
    c.strokeStyle = ink; c.beginPath(); c.moveTo(x - s * 0.12, y - s * 0.24); c.quadraticCurveTo(x, y - s * 0.4, x + s * 0.12, y - s * 0.24); c.stroke();
    c.fillStyle = "#f2c230"; c.beginPath(); c.arc(x, y + s * 0.12, s * 0.04, 0, 7); c.fill();
  }
  function carrot(c, x, y, s) {                                    // 🥕 cenoura
    c.strokeStyle = ink; c.lineWidth = 2.4;
    c.fillStyle = "#e08a2e"; c.beginPath(); c.moveTo(x - s * 0.12, y - s * 0.1); c.lineTo(x + s * 0.12, y - s * 0.1); c.lineTo(x, y + s * 0.3); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = "#b5661a"; c.lineWidth = 1.6;
    [-0.02, 0.06, 0.14].forEach((k) => { c.beginPath(); c.moveTo(x - s * (0.1 - k * 0.6), y + s * k); c.lineTo(x + s * (0.1 - k * 0.6), y + s * k); c.stroke(); });
    c.strokeStyle = ink; c.lineWidth = 2.2; c.fillStyle = "#4aa85a";
    [-0.9, 0, 0.9].forEach((a) => { c.beginPath(); c.ellipse(x + Math.sin(a) * s * 0.09, y - s * 0.2, s * 0.05, s * 0.12, a, 0, 7); c.fill(); c.stroke(); });
  }
  function yarn(c, x, y, s) {                                      // 🧶 novelo de lã
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.26, s * 0.22, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.6; c.fillStyle = "#b07ad9";
    c.beginPath(); c.arc(x, y, s * 0.24, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = "#7a4fa0"; c.lineWidth = 2;
    [-0.6, 0, 0.6].forEach((a) => { c.beginPath(); c.ellipse(x, y, s * 0.23, s * 0.1, a, 0, 7); c.stroke(); });
    c.strokeStyle = "#b07ad9"; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + s * 0.22, y + s * 0.08); c.quadraticCurveTo(x + s * 0.4, y + s * 0.18, x + s * 0.3, y + s * 0.28); c.stroke();
  }
  function bone(c, x, y, s) {                                      // 🦴 osso
    c.fillStyle = "rgba(21,19,31,0.16)"; c.beginPath(); c.ellipse(x, y + s * 0.16, s * 0.26, s * 0.05, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 2.6; c.fillStyle = "#f4efe2";
    c.beginPath(); c.moveTo(x - s * 0.2, y - s * 0.05); c.lineTo(x + s * 0.2, y - s * 0.05); c.lineTo(x + s * 0.2, y + s * 0.05); c.lineTo(x - s * 0.2, y + s * 0.05); c.closePath(); c.fill();
    [-1, 1].forEach((k) => { [-0.08, 0.08].forEach((dy) => { c.beginPath(); c.arc(x + k * s * 0.22, y + s * dy, s * 0.09, 0, 7); c.fill(); c.stroke(); }); });
    c.beginPath(); c.moveTo(x - s * 0.2, y - s * 0.05); c.lineTo(x + s * 0.2, y - s * 0.05); c.moveTo(x - s * 0.2, y + s * 0.05); c.lineTo(x + s * 0.2, y + s * 0.05); c.stroke();
  }
  function headphones(c, x, y, s) {                                // 🎧 fone de ouvido
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(x, y + s * 0.28, s * 0.24, s * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = ink; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y - s * 0.02, s * 0.26, Math.PI, 0); c.stroke();
    c.fillStyle = "#3a3a4a";
    [-1, 1].forEach((k) => { rr(c, x + k * s * 0.26 - s * 0.08, y - s * 0.04, s * 0.16, s * 0.26, s * 0.06); c.fill(); c.stroke(); });
    c.fillStyle = "#8fa3b4"; [-1, 1].forEach((k) => { c.beginPath(); c.ellipse(x + k * s * 0.26, y + s * 0.09, s * 0.04, s * 0.08, 0, 0, 7); c.fill(); });
  }

  const PROPS = { "🏄": surfer, "🌊": wave, "⛵": sailboat, "🐬": dolphin, "🪨": rock, "🌳": tree, "🌴": palm, "🪴": plantPot, "🪑": bench, "☁️": cloud, "🚗": car, "⛲": fountain, "⛱️": umbrella,
    "🌲": pine, "🚲": bike, "🖼️": frame, "🌷": tulip, "🕯️": candle, "❄️": snow, "🕰️": clock, "🪞": mirror, "🌻": sunflower, "🌟": star, "⭐": star,
    "🌅": window_, "🖋️": pen, "📋": clipboard, "🧩": puzzle, "💡": lamp, "🧸": teddy,
    "🎁": gift, "🛒": cart, "🎈": balloon, "🎒": backpack, "🥕": carrot, "🧶": yarn, "🦴": bone, "🎧": headphones };
  // Escala de rua. Uma pessoa na cidade tem 78px de altura, e a árvore vinha com 79: a rua inteira
  // parecia miniatura ao lado de quem anda nela. Aqui as peças que têm tamanho conhecido no mundo real
  // ganham a proporção que teriam ao lado de uma pessoa. A posição continua vindo do content.
  const ESCALA_DE_RUA = { "🌳": 1.8, "🌲": 1.7, "🌴": 1.8, "🪑": 1.5, "🚗": 1.9, "🚲": 1.6, "⛲": 1.4, "🪨": 1.25 };
  function drawProp(c, p, t) {
    const fn = PROPS[p.e];
    if (fn) return fn(c, p.x, p.y, p.s * (ESCALA_DE_RUA[p.e] || 1), t);
    c.fillStyle = "rgba(21,19,31,0.18)"; c.beginPath(); c.ellipse(p.x, p.y + p.s * 0.32, p.s * 0.36, p.s * 0.11, 0, 0, 7); c.fill();
    symbolAt(c, p.e, p.x, p.y, p.s);
  }

  // móveis/solidos: base com gradiente, brilho no topo, borda e emoji num "selo" com sombra
  function drawSolid(c, s, t) {
    if (s.ship === "pirate") return pirateShip(c, s, t || 0);
    if (s.emoji === "🦆") return pond(c, s, t || 0);
    if (s.house) return fendaHouse(c, s, t || 0);
    c.fillStyle = "rgba(21,19,31,0.2)"; rr(c, s.x + 8, s.y + 10, s.w, s.h, 14); c.fill();
    c.fillStyle = vg(c, s.y, s.y + s.h, sh(s.color, 0.18), sh(s.color, -0.12)); c.strokeStyle = ink; c.lineWidth = 5; rr(c, s.x, s.y, s.w, s.h, 14); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.22)"; rr(c, s.x + 8, s.y + 7, s.w - 16, Math.min(22, s.h * 0.28), 8); c.fill();
    c.strokeStyle = "rgba(21,19,31,0.14)"; c.lineWidth = 2; rr(c, s.x + 6, s.y + 6, s.w - 12, s.h - 12, 10); c.stroke();
    if (s.emoji) symbolAt(c, s.emoji, s.x + s.w / 2, s.y + s.h / 2 + 4, Math.min(84, Math.min(s.w, s.h) * 0.55));
  }

  // quais objetos do cenário mudam com o tempo (os outros podem virar textura fixa no modo Pixi)
  const PROPS_ANIMADOS = new Set(["🏄", "🌊", "⛵", "🐬", "🌳", "🌴", "☁️", "⛲", "🌲", "🌷", "🕯️", "❄️", "🌻", "🌟", "⭐", "🕰️", "🌅", "🎈"]);   // mexem com o tempo: a textura do Pixi entra com a fase
  window.CityArt = { PROPS_ANIMADOS, drawCreature, drawBuilding, drawHouse, drawStation, drawProp, drawSolid, drawDeco, drawShip: pirateShip, sh, rr, ink };
})();

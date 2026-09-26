"use strict";

// Ícones vetoriais dos móveis e enfeites do mapa (no lugar dos emojis).
// CityIcons.draw(c, emoji, x, y, size) desenha o símbolo no ctx e devolve true; se o emoji não tem desenho, devolve false
// e quem chamou usa o emoji como antes. Cada desenho é uma função (g, a) onde g = ajudantes e a = "aparência" (cores).
// Todos os desenhos cabem num quadrado de 100 x 100 centrado em (0,0) e usam a mesma borda escura do resto da arte.
(function () {
  const INK = "#15131f";
  let c = null;
  // ajudantes (usam o ctx atual, já transladado e escalado)
  const fill = (col) => { c.fillStyle = col; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.lineJoin = "round"; c.stroke(); };
  const flat = (col) => { c.fillStyle = col; c.fill(); };
  const rect = (x, y, w, h, col, r = 5) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); fill(col); };
  const flatRect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const circ = (x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, 7); fill(col); };
  const flatCirc = (x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, 7); flat(col); };
  const ell = (x, y, rx, ry, col, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); fill(col); };
  const poly = (pts, col) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); fill(col); };
  const line = (x1, y1, x2, y2, col = INK, w = 4) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  const eye = (x, y, r = 3.2) => flatCirc(x, y, r, INK);

  // ------------------------------------------------------------------ arquétipos
  const bed = (col) => () => { rect(-42, -8, 84, 40, "#e8ddc8"); rect(-42, -34, 14, 66, "#8a6a4a"); rect(-28, -8, 70, 26, col); rect(-26, -20, 22, 16, "#fff6e6", 7); };
  const sofa = (col) => () => { rect(-44, -22, 88, 30, col, 9); rect(-50, -8, 22, 38, sh(col, -0.1), 9); rect(28, -8, 22, 38, sh(col, -0.1), 9); rect(-30, 0, 60, 26, sh(col, 0.12), 8); };
  const chair = (col) => () => { rect(-22, -44, 44, 40, col, 6); rect(-28, -6, 56, 16, sh(col, 0.1), 5); line(-22, 10, -22, 40); line(22, 10, 22, 40); };
  const table = (col, round) => () => { if (round) ell(0, -6, 40, 16, col); else rect(-44, -14, 88, 18, col, 4); line(-30, 6, -32, 40); line(30, 6, 32, 40); if (round) line(0, 8, 0, 40); };
  const shelf = (books) => () => { rect(-38, -44, 76, 88, "#a87a4a", 4); [-24, 0, 24].forEach((y, r) => { flatRect(-34, y - 8, 68, 4, "#7a5230"); books.forEach((b, i) => flatRect(-32 + i * 12 + (r % 2) * 3, y - 34 + (i % 3) * 3, 9, 26 - (i % 3) * 3, b)); }); };
  const book = (col) => () => { rect(-34, -40, 68, 80, col, 5); flatRect(-26, -34, 6, 68, "rgba(255,255,255,0.35)"); rect(-16, -20, 42, 8, "#f6efe0", 3); rect(-16, -4, 32, 6, "#f6efe0", 3); };
  const paper = (lines) => () => { rect(-30, -42, 60, 84, "#f9f5ea", 4); for (let i = 0; i < lines; i++) flatRect(-20, -30 + i * 14, i % 3 === 2 ? 26 : 40, 4, "#8a8a9a"); };
  const cup = (col) => () => { c.beginPath(); c.moveTo(-26, -20); c.lineTo(26, -20); c.lineTo(20, 26); c.quadraticCurveTo(0, 34, -20, 26); c.closePath(); fill(col); c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.arc(30, 0, 12, -1.3, 1.3); c.stroke(); line(-8, -34, -4, -26, "#aab", 3); line(8, -34, 12, -26, "#aab", 3); };
  const pot = (leaf) => () => { poly([[-22, 6], [22, 6], [16, 40], [-16, 40]], "#c86f4a"); [[-24, -14, -0.7], [0, -34, 0], [24, -14, 0.7], [-10, -8, -0.3], [12, -8, 0.3]].forEach(([x, y, r]) => { c.save(); c.translate(x, y); c.rotate(r); c.beginPath(); c.ellipse(0, -6, 12, 26, 0, 0, 7); fill(leaf); c.restore(); }); };
  const box = (col, top) => () => { rect(-36, -24, 72, 58, col, 6); rect(-40, -34, 80, 16, top || sh(col, 0.15), 5); };
  const tree = (kind) => () => { flatRect(-6, 8, 12, 34, "#7a5230"); if (kind === "pine") { poly([[0, -44], [26, -8], [-26, -8]], "#2f7a4a"); poly([[0, -26], [32, 16], [-32, 16]], "#3a8a55"); } else circ(0, -12, 32, "#4aa35a"); };
  const flower = (col) => () => { line(0, 4, 0, 42, "#3a8a4a", 5); for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; circ(Math.cos(a) * 15, -12 + Math.sin(a) * 15, 11, col); } circ(0, -12, 9, "#f2c230"); };
  const star = (col, n = 5) => () => { c.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 16 : 40, a = (i * Math.PI) / n - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); fill(col); };
  const tomb = (col) => () => { c.beginPath(); c.moveTo(-28, 40); c.lineTo(-28, -8); c.arc(0, -8, 28, Math.PI, 0); c.lineTo(28, 40); c.closePath(); fill(col); line(0, -14, 0, 14, "#5a5a66", 4); line(-10, -4, 10, -4, "#5a5a66", 4); };
  const statue = () => { rect(-24, 26, 48, 16, "#8a8f98", 3); c.beginPath(); c.moveTo(-14, 26); c.lineTo(-12, -8); c.lineTo(12, -8); c.lineTo(14, 26); c.closePath(); fill("#b4b9c4"); circ(0, -24, 15, "#b4b9c4"); };
  const food = (col, kind) => () => {
    if (kind === "round") { circ(0, 4, 32, col); flatCirc(-10, -6, 7, "rgba(255,255,255,0.4)"); line(0, -28, 6, -42, "#3a8a4a", 4); }
    else if (kind === "bar") { rect(-34, -20, 68, 44, col, 6); [-14, 6, 26].forEach((x) => flatRect(x, -20, 2, 44, "rgba(0,0,0,0.25)")); }
    else if (kind === "leaf") { ell(0, 4, 34, 28, col); line(0, -20, 0, 30, "rgba(0,0,0,0.3)", 3); }
    else if (kind === "bread") { ell(0, 6, 40, 26, col); [-16, 0, 16].forEach((x) => line(x - 4, -6, x + 4, 10, "rgba(120,70,20,0.6)", 3)); }
    else if (kind === "cup") { poly([[-22, -22], [22, -22], [16, 38], [-16, 38]], col); flatRect(-26, -30, 52, 10, "#f6efe0"); line(4, -30, 14, -46, INK, 4); }
    else if (kind === "cake") { poly([[-34, 30], [34, 30], [34, -6], [-34, -6]], col); poly([[-34, -6], [34, -6], [26, -26], [-26, -26]], "#f6d2e0"); circ(0, -32, 7, "#d9453a"); }
    else if (kind === "can") { rect(-24, -32, 48, 66, col, 7); flatRect(-24, -12, 48, 22, "#f6efe0"); }
  };
  const monitor = (screen) => () => { rect(-42, -36, 84, 54, "#3a3a46", 6); flatRect(-36, -30, 72, 42, screen); rect(-10, 18, 20, 12, "#8a8a96", 2); rect(-26, 30, 52, 8, "#5a5a66", 3); };
  const phone = () => { rect(-22, -42, 44, 84, "#3a3a46", 8); flatRect(-16, -32, 32, 58, "#8fd0f0"); circ(0, 34, 4, "#8a8a96"); };
  const laptop = () => { rect(-36, -34, 72, 46, "#3a3a46", 5); flatRect(-30, -28, 60, 34, "#8fd0f0"); poly([[-46, 30], [46, 30], [36, 14], [-36, 14]], "#b4b9c4"); };
  const cloth = (col, kind) => () => {
    if (kind === "shirt") poly([[-14, -34], [14, -34], [40, -18], [30, -4], [20, -10], [20, 36], [-20, 36], [-20, -10], [-30, -4], [-40, -18]], col);
    else if (kind === "dress") poly([[-12, -38], [12, -38], [14, -8], [36, 38], [-36, 38], [-14, -8]], col);
    else if (kind === "coat") { poly([[-16, -38], [16, -38], [42, -18], [34, 4], [24, -2], [24, 38], [-24, 38], [-24, -2], [-34, 4], [-42, -18]], col); line(0, -34, 0, 38, INK, 3); }
  };
  const gem = (col) => () => { poly([[-34, -8], [-18, -32], [18, -32], [34, -8], [0, 38]], col); line(-34, -8, 34, -8, "rgba(255,255,255,0.7)", 3); line(-18, -32, -8, -8, "rgba(255,255,255,0.6)", 3); line(18, -32, 8, -8, "rgba(255,255,255,0.6)", 3); };
  const ring = () => { c.beginPath(); c.arc(0, 12, 26, 0, 7); c.lineWidth = 12; c.strokeStyle = INK; c.stroke(); c.lineWidth = 6; c.strokeStyle = "#f2c230"; c.stroke(); gem("#8fd0f0")(); };
  const coin = () => { circ(0, 0, 38, "#f2c230"); c.beginPath(); c.arc(0, 0, 26, 0, 7); c.lineWidth = 3; c.strokeStyle = "rgba(120,80,0,0.6)"; c.stroke(); flatRect(-3, -16, 6, 32, "rgba(120,80,0,0.6)"); };
  const card = () => { rect(-42, -26, 84, 54, "#3f7fd8", 7); flatRect(-42, -10, 84, 12, "#15131f"); flatRect(-34, 12, 26, 6, "#fff"); };
  const globe = () => { circ(0, 0, 38, "#5aa8e0"); [[-12, -12, 14, 10], [14, 8, 12, 14], [-16, 16, 10, 8]].forEach(([x, y, rx, ry]) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0.4, 0, 7); flat("#5ab05a"); }); };
  const flag = () => { line(-30, -42, -30, 42, INK, 5); ["#d9453a", "#f2a63a", "#f2e63a", "#4aa35a", "#3f7fd8", "#8b5ac8"].forEach((col, i) => flatRect(-28, -40 + i * 11, 64, 11, col)); c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(-28, -40, 64, 66); };
  const glasses = () => { c.beginPath(); c.arc(-20, 0, 18, 0, 7); c.lineWidth = 6; c.strokeStyle = INK; c.stroke(); c.beginPath(); c.arc(20, 0, 18, 0, 7); c.stroke(); line(-2, 0, 2, 0, INK, 6); flatCirc(-20, 0, 15, "rgba(143,208,240,0.55)"); flatCirc(20, 0, 15, "rgba(143,208,240,0.55)"); };
  const door = () => { rect(-26, -44, 52, 88, "#b07a4a", 4); rect(-18, -36, 36, 34, "#c8925a", 3); circ(16, 8, 4, "#f2c230"); };
  const person = (col) => () => { circ(0, -32, 13, "#e9c9a8"); rect(-15, -18, 30, 34, col, 8); line(-8, 16, -12, 40); line(8, 16, 12, 40); };
  const bag = (col) => () => { poly([[-32, -14], [32, -14], [38, 40], [-38, 40]], col); c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.arc(0, -14, 16, Math.PI, 0); c.stroke(); };
  const cart = () => { c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(-44, -34); c.lineTo(-30, -34); c.lineTo(-20, 16); c.lineTo(32, 16); c.stroke(); poly([[-28, -22], [40, -22], [32, 10], [-22, 10]], "#c9ccd6"); circ(-14, 32, 7, "#5a5a66"); circ(24, 32, 7, "#5a5a66"); };
  const gym = (kind) => () => {
    if (kind === "run") { circ(6, -34, 12, "#e9c9a8"); line(6, -22, 0, 8, "#3f7fd8", 10); line(0, 8, 22, 26); line(0, 8, -20, 30); line(4, -14, 24, -2); line(4, -14, -16, -4); }
    else if (kind === "bike") { c.strokeStyle = INK; c.lineWidth = 5; [-26, 26].forEach((x) => { c.beginPath(); c.arc(x, 18, 18, 0, 7); c.stroke(); }); line(-26, 18, -4, -8); line(-4, -8, 26, 18); line(-4, -8, 18, -8); line(-10, -16, -2, -16); }
    else { flatRect(-42, -3, 84, 6, "#5a5a66"); rect(-46, -20, 12, 40, "#3a3a46", 3); rect(34, -20, 12, 40, "#3a3a46", 3); rect(-32, -14, 8, 28, "#5a5a66", 2); rect(24, -14, 8, 28, "#5a5a66", 2); }
  };
  const machine = (col) => () => { rect(-30, -44, 60, 88, col, 7); rect(-22, -34, 44, 34, "#15131f", 3); [-14, 0, 14].forEach((x) => flatCirc(x, -16, 5, ["#d9453a", "#f2c230", "#4aa35a"][(x + 14) / 14])); rect(-14, 12, 28, 10, "#f2c230", 3); };
  const dice = () => { rect(-30, -30, 60, 60, "#f6efe0", 10); [[-14, -14], [14, -14], [0, 0], [-14, 14], [14, 14]].forEach(([x, y]) => flatCirc(x, y, 5.5, INK)); };
  const skate = () => { ell(0, 24, 40, 8, "#c9ccd6"); poly([[-22, -28], [8, -28], [12, 10], [34, 18], [34, 26], [-22, 26]], "#f2a63a"); };
  const bomb = (col) => () => { circ(-4, 8, 30, col); line(14, -16, 30, -34, "#8a6a3a", 5); flatCirc(32, -36, 7, "#f2c230"); };
  const scope = () => { c.save(); c.rotate(-0.7); rect(-14, -44, 28, 60, "#c9ccd6", 6); rect(-18, 10, 36, 14, "#8a8a96", 4); c.restore(); line(-30, 40, 30, 40, INK, 6); circ(0, 34, 6, "#5a5a66"); };
  const flask = (col) => () => { c.beginPath(); c.moveTo(-10, -42); c.lineTo(10, -42); c.lineTo(10, -16); c.lineTo(34, 30); c.quadraticCurveTo(36, 40, 26, 40); c.lineTo(-26, 40); c.quadraticCurveTo(-36, 40, -34, 30); c.lineTo(-10, -16); c.closePath(); fill("rgba(220,240,250,0.9)"); c.beginPath(); c.moveTo(-22, 8); c.lineTo(22, 8); c.lineTo(32, 30); c.lineTo(-32, 30); c.closePath(); flat(col); };
  const dish = () => { circ(0, 0, 36, "#8fd0a0"); circ(0, 0, 26, "#d9f0d9"); [[-8, -6], [8, 4], [-2, 10]].forEach(([x, y]) => flatCirc(x, y, 5, "#4aa35a")); };
  const vase = () => { c.beginPath(); c.moveTo(-14, -40); c.lineTo(14, -40); c.quadraticCurveTo(38, -6, 20, 30); c.lineTo(22, 40); c.lineTo(-22, 40); c.lineTo(-20, 30); c.quadraticCurveTo(-38, -6, -14, -40); fill("#c8703a"); flatRect(-26, -6, 52, 6, "#f2c230"); };
  const frame = (paint) => () => { rect(-40, -34, 80, 68, "#8a6a4a", 3); flatRect(-32, -26, 64, 52, paint); poly([[-32, 26], [-8, -6], [8, 12], [20, 0], [32, 26]], "#5aa35a"); flatCirc(18, -14, 7, "#fff6a0"); };
  const brush = () => { rect(-40, -34, 80, 68, "#f6efe0", 5); flatCirc(-16, -10, 12, "#d9453a"); flatCirc(8, -14, 12, "#f2c230"); flatCirc(20, 8, 12, "#3f7fd8"); flatCirc(-8, 12, 12, "#4aa35a"); };
  const yarn = () => { circ(0, 0, 34, "#e07a9a"); [-16, 0, 16].forEach((y) => { c.beginPath(); c.arc(0, y, 30, 0.2, Math.PI - 0.2); c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.3)"; c.stroke(); }); };
  const note = (col) => () => { ell(-12, 24, 16, 11, col); line(2, 24, 2, -34, INK, 6); poly([[2, -36], [30, -22], [30, -10], [2, -22]], col); };
  const clock = () => { circ(0, 0, 38, "#f6efe0"); for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; line(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 34, Math.sin(a) * 34, INK, 3); } line(0, 0, 0, -24, INK, 5); line(0, 0, 18, 6, INK, 5); };
  const toy = (col) => () => { circ(0, -20, 18, col); circ(-14, -34, 8, col); circ(14, -34, 8, col); ell(0, 16, 24, 26, col); eye(-6, -22); eye(6, -22); flatCirc(0, -14, 5, "#f6d2b0"); };
  const brain = () => { ell(-14, -2, 24, 30, "#f0a8c0"); ell(14, -2, 24, 30, "#f0a8c0"); [[-16, -14], [16, -14], [-10, 8], [10, 8]].forEach(([x, y]) => line(x - 8, y, x + 8, y + 4, "#b8607a", 3)); };
  const scale = () => { line(0, -40, 0, 34, INK, 5); line(-34, -28, 34, -28, INK, 5); rect(-16, 32, 32, 8, "#8a8a96", 2); [-34, 34].forEach((x) => { line(x, -28, x, -6, INK, 3); c.beginPath(); c.arc(x, -6, 14, 0, Math.PI); fill("#f2c230"); }); };
  const hammer = () => { c.save(); c.rotate(-0.7); rect(-4, -34, 8, 74, "#8a6a4a", 2); rect(-22, -44, 44, 20, "#8a8a96", 4); c.restore(); };
  const clap = () => { rect(-38, -8, 76, 44, "#3a3a46", 4); poly([[-38, -8], [38, -8], [34, -24], [-40, -14]], "#f6efe0"); [-24, -6, 12, 28].forEach((x) => line(x, -8, x + 8, -22, INK, 5)); };
  const ticket = () => { c.beginPath(); c.moveTo(-40, -22); c.lineTo(40, -22); c.lineTo(40, -6); c.arc(40, 0, 6, -1.57, 1.57, true); c.lineTo(40, 22); c.lineTo(-40, 22); c.lineTo(-40, 6); c.arc(-40, 0, 6, 1.57, -1.57, true); c.closePath(); fill("#f2a63a"); flatRect(-4, -18, 3, 36, "rgba(0,0,0,0.3)"); };
  const digits = (txt) => () => { rect(-40, -34, 80, 68, "#3f7fd8", 8); c.fillStyle = "#fff"; c.font = "bold 40px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, 0, 2); };
  const coffin = () => { poly([[-14, -42], [14, -42], [30, -16], [16, 42], [-16, 42], [-30, -16]], "#7a5230"); line(0, -28, 0, 20, "#f2c230", 4); line(-10, -12, 10, -12, "#f2c230", 4); };
  const candle = () => { rect(-10, -14, 20, 52, "#f6efe0", 3); line(0, -14, 0, -22, INK, 3); c.beginPath(); c.ellipse(0, -32, 8, 13, 0, 0, 7); fill("#f2a63a"); flatCirc(0, -30, 4, "#fff6a0"); };
  const sun = () => { circ(0, 0, 22, "#f2c230"); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; line(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 42, Math.sin(a) * 42, "#f2c230", 6); } };
  const moon = () => { c.beginPath(); c.arc(0, 0, 36, 0.6, 5.7); c.arc(14, -4, 30, 5.2, 1.0, true); c.closePath(); fill("#f6e6a0"); };
  const snow = () => { for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; line(Math.cos(a) * 36, Math.sin(a) * 36, -Math.cos(a) * 36, -Math.sin(a) * 36, "#bfe3f5", 6); } };
  const bubble = () => { c.beginPath(); c.arc(0, 0, 30, 0, 7); c.lineWidth = 4; c.strokeStyle = "rgba(160,220,255,0.95)"; c.stroke(); flatCirc(-10, -10, 7, "rgba(255,255,255,0.7)"); };
  const bulb = () => { circ(0, -10, 26, "#fff2a0"); rect(-12, 14, 24, 20, "#8a8a96", 3); };
  const gift = (col) => () => { rect(-34, -12, 68, 50, col, 4); rect(-38, -26, 76, 18, sh(col, 0.15), 4); flatRect(-5, -26, 10, 64, "#f2c230"); circ(-10, -34, 10, "#f2c230"); circ(10, -34, 10, "#f2c230"); };
  const santa = () => { circ(0, 0, 22, "#e9c9a8"); poly([[-24, -6], [0, -44], [24, -6]], "#d9453a"); ell(0, 16, 22, 14, "#fff"); circ(0, -46, 7, "#fff"); eye(-8, 0); eye(8, 0); };
  const snowman = () => { circ(0, 22, 22, "#fff"); circ(0, -14, 16, "#fff"); flatCirc(-5, -18, 2.5, INK); flatCirc(5, -18, 2.5, INK); poly([[0, -14], [12, -12], [0, -10]], "#f2a63a"); rect(-12, -40, 24, 10, "#3a3a46", 2); };
  const jar = (col) => () => { rect(-24, -30, 48, 66, "rgba(220,240,250,0.9)", 8); rect(-28, -40, 56, 12, "#8a8a96", 3); flatRect(-20, 0, 40, 32, col); };
  const pin = () => { c.beginPath(); c.moveTo(0, 42); c.bezierCurveTo(-40, -6, -30, -42, 0, -42); c.bezierCurveTo(30, -42, 40, -6, 0, 42); fill("#d9453a"); flatCirc(0, -10, 10, "#fff"); };
  const anchor = () => { c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, 32); c.moveTo(-14, -14); c.lineTo(14, -14); c.moveTo(-34, 6); c.quadraticCurveTo(-30, 36, 0, 34); c.quadraticCurveTo(30, 36, 34, 6); c.stroke(); c.beginPath(); c.arc(0, -36, 6, 0, 7); c.stroke(); };
  const lighthouse = () => { poly([[-18, 40], [18, 40], [12, -18], [-12, -18]], "#f4efe6"); poly([[-15, 18], [15, 18], [16, 6], [-16, 6]], "#d9453a"); poly([[-14, -18], [14, -18], [10, -34], [-10, -34]], "#3a3a46"); flatRect(-8, -30, 16, 9, "#fff2a0"); poly([[-14, -34], [0, -46], [14, -34]], "#d9453a"); };
  const train = () => { rect(-44, -20, 88, 46, "#3f7fd8", 8); [-28, -6, 16].forEach((x) => flatRect(x, -12, 16, 14, "#bfe3f5")); flatRect(-44, 8, 88, 6, "#f2c230"); circ(-26, 32, 8, "#2a2a34"); circ(26, 32, 8, "#2a2a34"); line(-44, 34, 44, 34, "#8a8a96", 3); };
  const grapes = () => { [[-14, -6], [4, -8], [18, -2], [-6, 10], [12, 10], [0, 26]].forEach(([x, y]) => circ(x, y, 12, "#8a4aa8")); line(0, -20, 6, -38, "#3a8a4a", 5); ell(14, -32, 12, 7, "#4aa35a", -0.4); };
  const barrel = () => { ell(0, 0, 32, 42, "#a87a4a"); [-20, 0, 20].forEach((y) => line(-30, y, 30, y, INK, 3)); };
  const dna = () => { for (let i = -3; i <= 3; i++) { const x = Math.sin(i * 0.9) * 22; line(-x, i * 12, x, i * 12, "#8fd0f0", 4); flatCirc(x, i * 12, 5, "#d9453a"); flatCirc(-x, i * 12, 5, "#3f7fd8"); } };
  const pack = () => { rect(-30, -30, 60, 72, "#d9453a", 14); rect(-20, 0, 40, 26, "#a83a2a", 6); c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.arc(0, -34, 14, Math.PI, 0); c.stroke(); };
  const cap = () => { poly([[0, -22], [46, -4], [0, 16], [-46, -4]], "#3a3a46"); rect(-24, 10, 48, 20, "#3a3a46", 6); line(46, -4, 46, 26, "#f2c230", 4); };
  const columns = () => { poly([[-44, -20], [0, -44], [44, -20]], "#e6e2f2"); [-28, 0, 28].forEach((x) => rect(x - 7, -18, 14, 54, "#f7f3ff", 2)); rect(-44, 34, 88, 8, "#e6e2f2", 2); };
  const basket = () => { poly([[-38, -6], [38, -6], [30, 38], [-30, 38]], "#c8925a"); c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.arc(0, -6, 30, Math.PI, 0); c.stroke(); [-16, 0, 16].forEach((x) => line(x, -4, x, 36, "rgba(80,50,20,0.5)", 3)); };
  const carrot = () => { poly([[-16, -22], [16, -22], [0, 42]], "#f2842a"); [-8, 0, 8].forEach((x) => line(x, -22, x * 1.6, -40, "#3a8a4a", 5)); };
  const bone = () => { c.save(); c.rotate(-0.6); rect(-30, -8, 60, 16, "#f6efe0", 8); [[-32, -10], [-32, 10], [32, -10], [32, 10]].forEach(([x, y]) => circ(x, y, 10, "#f6efe0")); c.restore(); };
  const syringe = () => { c.save(); c.rotate(0.7); rect(-10, -30, 20, 46, "rgba(220,240,250,0.95)", 3); flatRect(-8, -6, 16, 22, "#d9453a"); line(0, 16, 0, 40, INK, 3); rect(-16, -34, 32, 6, "#8a8a96", 2); c.restore(); };
  const cross = () => { rect(-12, -38, 24, 76, "#d9453a", 5); rect(-38, -12, 76, 24, "#d9453a", 5); };
  const fuel = () => { rect(-24, -38, 48, 78, "#d9453a", 6); rect(-16, -30, 32, 22, "#f6efe0", 3); line(24, -14, 40, -2, INK, 5); };
  const plug = () => { rect(-16, -14, 32, 34, "#3a3a46", 6); line(-8, -14, -8, -34, "#c9ccd6", 6); line(8, -14, 8, -34, "#c9ccd6", 6); line(0, 20, 0, 40, INK, 5); };
  const phones = () => { c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.arc(0, 4, 28, Math.PI, 0); c.stroke(); rect(-38, 0, 16, 32, "#3f7fd8", 6); rect(22, 0, 16, 32, "#3f7fd8", 6); };
  const drink = (col) => () => { poly([[-34, -30], [34, -30], [0, 10]], "rgba(220,240,250,0.95)"); flat(col); c.beginPath(); c.moveTo(-26, -24); c.lineTo(26, -24); c.lineTo(0, 4); flat(col); line(0, 10, 0, 38, INK, 4); line(-16, 40, 16, 40, INK, 5); circ(20, -34, 7, "#d9453a"); };
  const icecream = () => { poly([[-18, -4], [18, -4], [0, 42]], "#e0a860"); circ(0, -16, 20, "#f6d2e0"); circ(0, -30, 14, "#f0a8c0"); };
  const balloon = () => { c.beginPath(); c.ellipse(0, -10, 24, 30, 0, 0, 7); fill("#d9453a"); line(0, 20, -4, 44, INK, 3); };
  const puzzle = () => { rect(-30, -30, 60, 60, "#5aa8e0", 6); circ(30, 0, 10, "#5aa8e0"); circ(0, -30, 10, "#5aa8e0"); };
  const mirror = () => { ell(0, -4, 28, 38, "#8a6a4a"); ell(0, -4, 22, 32, "#bfe3f5"); line(-10, -20, 4, -34, "rgba(255,255,255,0.8)", 4); };
  const pen = () => { c.save(); c.rotate(0.7); rect(-7, -40, 14, 62, "#3f7fd8", 4); poly([[-7, 22], [7, 22], [0, 42]], "#f2c230"); c.restore(); };
  const sunrise = () => { c.beginPath(); c.arc(0, 14, 26, Math.PI, 0); fill("#f2a63a"); flatRect(-44, 14, 88, 26, "#5aa8e0"); c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(-44, -30, 88, 70); };
  const wave = () => { c.beginPath(); c.moveTo(-44, 8); c.quadraticCurveTo(-22, -34, 0, 4); c.quadraticCurveTo(22, -34, 44, 8); c.lineWidth = 8; c.strokeStyle = "#5aa8e0"; c.stroke(); };
  const cloudI = () => { [[-16, 6, 20], [8, -8, 24], [28, 8, 18], [4, 10, 22]].forEach(([x, y, r]) => flatCirc(x, y, r, "rgba(255,255,255,0.95)")); };
  const bikeProp = () => gym("bike")();
  const carI = () => { rect(-44, -4, 88, 32, "#d9453a", 8); poly([[-26, -4], [-16, -26], [16, -26], [30, -4]], "#d9453a"); flatRect(-14, -22, 28, 16, "#bfe3f5"); circ(-26, 30, 10, "#2a2a34"); circ(26, 30, 10, "#2a2a34"); };

  // animais: corpo genérico com traços de cada espécie (cor, orelhas, cauda, etc.)
  const animal = (o) => () => {
    o = Object.assign({ body: "#b08050", belly: null, ears: "round", tail: 0, spots: null, long: false, beak: null, mane: null, snout: "#e9c9a8", size: 1 }, o);
    c.save(); c.scale(o.size, o.size);
    if (o.tail === 1) { c.beginPath(); c.moveTo(20, 10); c.quadraticCurveTo(46, -10, 40, -30); c.lineWidth = 8; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4; c.strokeStyle = o.body; c.stroke(); }
    ell(4, 16, o.long ? 42 : 30, 20, o.body);
    if (o.belly) ell(4, 24, o.long ? 30 : 20, 10, o.belly);
    if (o.spots) [[-8, 12], [8, 8], [16, 20], [-2, 24]].forEach(([x, y]) => flatCirc(x, y, 4, o.spots));
    if (o.mane) circ(-22, -10, 28, o.mane);
    if (o.ears === "round") { circ(-30, -28, 9, o.body); circ(-10, -32, 9, o.body); } else if (o.ears === "point") { poly([[-38, -20], [-32, -44], [-22, -26]], o.body); poly([[-14, -26], [-6, -44], [2, -20]], o.body); } else if (o.ears === "long") { ell(-28, -42, 6, 22, o.body); ell(-10, -44, 6, 22, o.body); } else if (o.ears === "horn") { line(-30, -22, -38, -44, "#e6d8b0", 6); line(-10, -22, -2, -44, "#e6d8b0", 6); }
    circ(-20, -8, 22, o.body);
    if (o.snout) ell(-28, 2, 12, 9, o.snout);
    if (o.beak) poly([[-38, -6], [-52, 2], [-38, 8]], o.beak);
    eye(-30, -14); eye(-14, -14); flatCirc(-31, 0, 3, INK);
    c.restore();
  };
  const bird = (col, belly) => () => { ell(0, 6, 26, 32, col, -0.3); ell(4, 12, 14, 20, belly, -0.3); circ(-6, -30, 15, col); poly([[-18, -32], [-34, -26], [-18, -22]], "#f2a63a"); eye(-8, -34); poly([[18, 28], [46, 44], [10, 40]], col); };
  const croc = () => { ell(0, 14, 44, 16, "#5aa35a"); poly([[-44, 8], [-62, 12], [-44, 22]], "#5aa35a"); poly([[38, 12], [66, 20], [38, 24]], "#5aa35a"); [-24, -8, 8, 24].forEach((x) => poly([[x - 5, 2], [x, -8], [x + 5, 2]], "#3a8a45")); eye(-40, 10); };
  const snake = () => { c.beginPath(); c.moveTo(-40, 30); c.bezierCurveTo(-40, -10, -6, 34, 6, 0); c.bezierCurveTo(14, -20, 40, -10, 34, -30); c.lineWidth = 16; c.strokeStyle = INK; c.lineCap = "round"; c.stroke(); c.lineWidth = 9; c.strokeStyle = "#7ab35a"; c.stroke(); circ(34, -32, 10, "#7ab35a"); eye(36, -34, 2.5); };
  const lizard = () => { ell(0, 8, 32, 12, "#6ab04a"); poly([[30, 6], [58, 14], [30, 14]], "#6ab04a"); circ(-32, 6, 12, "#6ab04a"); eye(-36, 3, 2.5); [-16, 10].forEach((x) => { line(x, 14, x - 6, 30, "#6ab04a", 6); }); };
  const spider = () => { for (let i = 0; i < 4; i++) { const y = -14 + i * 9; line(-8, y, -36, y - 10 + i * 4, INK, 3); line(8, y, 36, y - 10 + i * 4, INK, 3); } circ(0, 8, 20, "#4a3a3a"); circ(0, -12, 12, "#4a3a3a"); flatCirc(-4, -14, 2.5, "#d9453a"); flatCirc(4, -14, 2.5, "#d9453a"); };
  const paw = () => { [[-26, -8], [-10, -26], [10, -26], [26, -8]].forEach(([x, y]) => ell(x, y, 8, 11, "#8a6a4a")); ell(0, 14, 24, 20, "#8a6a4a"); };
  const fish = (col) => () => { ell(-4, 0, 30, 20, col); poly([[24, 0], [46, -18], [46, 18]], col); eye(-20, -4); };
  const dolphinI = () => { c.beginPath(); c.moveTo(-40, 14); c.quadraticCurveTo(-10, -44, 34, -8); c.quadraticCurveTo(48, -4, 54, -10); c.quadraticCurveTo(46, 12, 20, 14); c.quadraticCurveTo(-10, 30, -40, 14); fill("#7a93b0"); poly([[-38, 12], [-54, -6], [-52, 22]], "#7a93b0"); eye(30, -6, 3); };
  const turtle = () => { ell(0, 6, 34, 24, "#4a9a5a"); [[-14, 0], [6, -4], [16, 10], [-6, 14]].forEach(([x, y]) => flatCirc(x, y, 6, "#3a7a4a")); circ(-38, 4, 10, "#8ac46a"); eye(-42, 2, 2.5); [-20, 20].forEach((x) => ell(x, 30, 8, 6, "#8ac46a")); };
  const hedgehog = () => { ell(4, 8, 38, 28, "#6a4a3a"); for (let i = -4; i <= 4; i++) line(4 + i * 8, -14, 4 + i * 9, -30, "#3a2a22", 4); circ(-34, 14, 12, "#e9c9a8"); eye(-38, 12, 2.5); };
  const beaver = () => { ell(0, 8, 32, 26, "#8a5a3a"); ell(38, 24, 14, 6, "#5a3a2a"); circ(-24, -8, 20, "#8a5a3a"); flatRect(-30, 4, 12, 10, "#f6efe0"); eye(-30, -12); eye(-18, -12); };
  const turkey = () => { for (let i = -3; i <= 3; i++) { c.save(); c.rotate(i * 0.3); ell(0, -30, 8, 24, ["#c8703a", "#d9453a", "#f2a63a"][Math.abs(i) % 3]); c.restore(); } ell(0, 16, 24, 26, "#8a5a3a"); circ(-4, -8, 12, "#d9453a"); poly([[-12, -10], [-24, -6], [-12, -2]], "#f2a63a"); eye(-4, -12, 2.5); };
  const seal = () => { ell(0, 14, 44, 20, "#8a93a4"); circ(-38, 2, 14, "#8a93a4"); eye(-42, -2, 2.5); flatCirc(-48, 4, 3, INK); poly([[36, 14], [56, 4], [56, 26]], "#6a7384"); };
  const monkey = () => { ell(6, 20, 26, 24, "#8a5a3a"); c.beginPath(); c.moveTo(30, 30); c.quadraticCurveTo(58, 20, 50, -10); c.lineWidth = 8; c.strokeStyle = "#8a5a3a"; c.stroke(); circ(-8, -18, 22, "#8a5a3a"); circ(-30, -18, 9, "#e9c9a8"); circ(14, -18, 9, "#e9c9a8"); ell(-8, -10, 14, 11, "#e9c9a8"); eye(-14, -20); eye(-2, -20); };
  const parrot = () => bird("#d9453a", "#f2c230")();
  const wolf = () => animal({ body: "#8a93a4", ears: "point", snout: "#d0d5de", tail: 1, long: true })();
  const cat = (col) => animal({ body: col, ears: "point", tail: 1, snout: "#f6d2b0" });
  const dog = (col) => animal({ body: col, ears: "round", tail: 1, snout: "#f6d2b0", size: 1 });
  const deer = () => animal({ body: "#b0824a", ears: "horn", spots: "#f6efe0", long: true, snout: "#e9c9a8" })();

  function sh(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    const n = parseInt(m[1], 16); const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
  }

  // ------------------------------------------------------------------ tabela emoji -> desenho
  const MAP = {
    "🛏️": bed("#7aa8d8"), "🛋️": sofa("#8a7bc4"), "🪑": chair("#b07a4a"), "🍽️": table("#d0a878", true), "🍳": food("#f2c230", "round"),
    "👔": cloth("#3f7fd8", "shirt"), "👗": cloth("#d9678a", "dress"), "🧥": cloth("#8a5a3a", "coat"), "📘": book("#3f7fd8"), "📚": shelf(["#d9453a", "#3f7fd8", "#4aa35a", "#f2c230", "#8b5ac8"]),
    "📖": book("#8b5ac8"), "📝": paper(4), "📜": paper(3), "📋": paper(5), "🧾": paper(6), "💁": person("#d9678a"), "🚪": door,
    "💳": card, "💎": gem("#5ac8e0"), "🏳️‍🌈": flag, "🌍": globe, "🌐": globe, "👓": glasses, "💍": ring,
    "☕": cup("#f6efe0"), "🍰": food("#e0a860", "cake"), "🥐": food("#e0a860", "bread"), "🧠": brain, "🩺": phones,
    "🥫": food("#c9ccd6", "can"), "🍿": food("#f2c230", "cup"), "🧃": food("#f2842a", "can"), "🍫": food("#7a4a2a", "bar"), "🛒": cart,
    "📱": phone, "💻": laptop, "🖥️": monitor("#8fd0f0"), "🏃": gym("run"), "🚴": gym("bike"), "🏋️": gym("bar"),
    "🥦": food("#4aa35a", "round"), "🍎": food("#d9453a", "round"), "🥛": food("#f6efe0", "can"), "🍞": food("#e0a860", "bread"), "🍌": food("#f2e63a", "leaf"),
    "🍔": food("#c8925a", "round"), "🍟": food("#f2c230", "cup"), "🥤": food("#d9453a", "cup"), "🎰": machine("#d9453a"), "🎲": dice, "🪙": coin, "🛍️": bag("#f0a8c0"),
    "⛸️": skate, "💣": bomb("#3a3a46"), "🚩": flag, "🧨": bomb("#d9453a"), "⚰️": coffin, "🕯️": candle,
    "🔬": scope, "🧪": flask("#4aa35a"), "🧫": dish, "⚗️": flask("#8b5ac8"), "🏺": vase, "🖼️": frame("#bfe3f5"),
    "🔢": digits("123"), "🔤": digits("ABC"), "⚖️": scale, "🔨": hammer, "🎬": clap, "🎟️": ticket, "🎨": brush,
    "🪴": pot("#3f9a55"), "🧶": yarn, "🍊": food("#f2842a", "round"), "🥬": food("#6ab04a", "leaf"), "🍅": food("#d9453a", "round"), "🔭": scope,
    "🎵": note("#8b5ac8"), "🌿": pot("#5aa35a"), "🕰️": clock, "🧸": toy("#c8925a"), "🗿": statue, "🪦": tomb("#b4b9c4"),
    "🐆": animal({ body: "#e0b060", ears: "round", spots: "#4a3a2a", tail: 1, long: true }), "🐬": dolphinI, "🐒": monkey,
    "🦜": parrot, "🐺": wolf, "🦔": hedgehog, "🐊": croc, "🦫": beaver, "🦃": turkey, "🐦": bird("#4a90d8", "#f6efe0"), "🦭": seal, "🐢": turtle,
    "🎅": santa, "🗼": lighthouse, "🚆": train, "🍇": grapes, "⛄": snowman, "🎄": tree("pine"),
    "🐶": dog("#c8925a"), "🐕": dog("#c8925a"), "🐱": cat("#f2a63a"), "🐈": cat("#8a93a4"), "🐰": animal({ body: "#f6efe0", ears: "long", tail: 0 }), "🐇": animal({ body: "#f6efe0", ears: "long" }),
    "🦎": lizard, "🐍": snake, "🕷️": spider, "🐾": paw,
    // enfeites (props)
    "🌳": tree("round"), "🌲": tree("pine"), "🚲": bikeProp, "🚗": carI, "🌅": sunrise, "🖋️": pen, "🧩": puzzle, "🪞": mirror, "🎁": gift("#d9453a"), "🎀": gift("#f0a8c0"),
    "🐠": fish("#f2842a"), "💡": bulb, "🎓": cap, "🌷": flower("#e0578a"), "🦴": bone, "💉": syringe, "⚕️": cross, "⛽": fuel, "🔌": plug, "🎧": phones,
    "🍦": icecream, "🎈": balloon, "🍸": drink("#f0a8c0"), "🌟": star("#f2c230"), "❄️": snow, "🌊": wave, "🪨": statue, "☁️": cloudI, "⚓": anchor, "🛢️": barrel,
    "🫧": bubble, "🧬": dna, "🎒": pack, "🏛️": columns, "🌻": flower("#f2c230"), "🧺": basket, "🥕": carrot, "🌸": flower("#f0a8c0"), "⭐": star("#f2c230"), "🌙": moon, "🦌": deer,
    "📷": frame("#bfe3f5")
  };

  function draw(ctx, emoji, x, y, size) {
    const fn = MAP[emoji]; if (!fn) return false;
    ctx.save(); ctx.translate(x, y); const k = size / 100; ctx.scale(k, k);
    ctx.fillStyle = "rgba(21,19,31,0.22)"; ctx.beginPath(); ctx.ellipse(2, 42, 34, 8, 0, 0, 7); ctx.fill();
    c = ctx;
    try { fn(); } catch (e) { ctx.restore(); return false; }
    ctx.restore(); c = null; return true;
  }
  window.CityIcons = { draw, has: (e) => Boolean(MAP[e]), keys: () => Object.keys(MAP) };
})();

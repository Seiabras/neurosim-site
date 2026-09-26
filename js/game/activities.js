"use strict";

// ===========================================================================
// Atividades interativas: em vez de só apertar um botão e ganhar algo, a jogadora faz a coisa de verdade.
//  · Pescaria (cais da praia e Fenda do Biquíni): segure para lançar a linha, espere o peixe beliscar, fisgue na hora certa
//    e recolha mantendo o peixe dentro da zona verde.
//  · Escavar conchas (praia): toque na areia para cavar; a cor da casinha dá a dica de quão perto está o tesouro. 8 escavações.
//  · Buscar a bolinha (praça e parque): jogue a bolinha e os bichinhos correm para buscá-la e trazê-la de volta.
// Tudo é desenhado em canvas 2D (640×360 lógicos) com animação de verdade. Em Opções dá para desligar ("Atividades interativas"):
// aí volta o botão simples de antes (acessibilidade e aparelhos lentos). Cada jogo chama um callback com o resultado.
// ===========================================================================
const Activities = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const W = 640, H = 360, INK = "#15131f";
  const enabled = () => settings.activities !== false;
  let cur = null;   // jogo em andamento: { stop() }

  // ------------------------------------------------------------ moldura comum
  function frame(title, hint) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("atividades"), 500);     stop();
    const body = $("act-body"); body.textContent = "";
    $("act-title").textContent = title;
    const cv = el("canvas", "act-canvas"); cv.width = W; cv.height = H; body.appendChild(cv);
    const info = el("p", "shop-note act-hint", hint); body.appendChild(info);
    const status = el("p", "act-status", ""); body.appendChild(status);
    const g = cv.getContext("2d");
    const at = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height }; };
    const game = { cv, g, info, status, at, done: false, t: 0, raf: 0, last: 0, keys: {}, onFrame: null };
    const onKey = (e) => { if (e.code === "Space") { game.keys.space = e.type === "keydown"; game.onKey && game.onKey(e); e.preventDefault(); } };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
    const loop = (now) => {
      if (cur !== game) return;
      const dt = Math.min(0.05, (now - (game.last || now)) / 1000); game.last = now; game.t += dt;
      game.onFrame && game.onFrame(dt);
      game.raf = requestAnimationFrame(loop);
    };
    game.stop = () => { cancelAnimationFrame(game.raf); window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
    cur = game;
    openModal("act-modal");
    game.raf = requestAnimationFrame(loop);
    return game;
  }
  function stop() { if (cur) { cur.stop(); cur = null; } }
  function finishButton(game, label, fn) {
    const b = el("button", "pill-btn", label); b.type = "button";
    b.addEventListener("click", () => { closeModal("act-modal"); if (fn) fn(); });
    game.status.appendChild(b);
  }

  // ------------------------------------------------------------ desenhos simples
  const avatarImg = () => { const i = new Image(); i.src = Retrato.url(state.player || { skin: "#eab98f", hairStyle: "short", hairColor: "#5a3a26", top: "coat" }); return i; };
  const emojiText = (g, e, x, y, size) => { g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = INK; g.fillText(e, x, y); };
  const ring = (g, x, y, r, a) => { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y, r, r * 0.35, 0, 0, 7); g.stroke(); };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

  // ============================================================ PESCARIA
  // onResult(q): 0 escapou · 1 pescou · 2 pescou com maestria (rápido, maior chance de raridade)
  function fish(where, onResult) {
    const g0 = frame(`🎣 ${tr("Pescaria", "Fishing", "Pesca")}`, tr("Segure para lançar (quanto mais tempo, mais longe) e solte. Quando o flutuador afundar, toque para fisgar. Depois, segure para subir a zona verde e mantenha o peixe dentro dela.", "Hold to cast (longer = farther) and release. When the float sinks, tap to hook. Then hold to raise the green zone and keep the fish inside it.", "Mantén para lanzar (más tiempo = más lejos) y suelta. Cuando el flotador se hunda, toca para picar. Luego mantén para subir la zona verde y conserva al pez dentro."));
    const g = g0.g, me = avatarImg(), deep = where === "fenda";
    const S = { phase: "aim", power: 0, hold: false, bob: { x: 138, y: 60, vx: 0, vy: 0, fly: false, t: 0 }, wait: 0, biteAt: 0, bite: 0, ripples: [], shadows: [], reel: { zone: 150, zv: 0, fy: 160, ft: 160, prog: 0.3, time: 0 }, msg: "", over: false };
    for (let i = 0; i < 6; i++) S.shadows.push({ x: 180 + Math.random() * 400, y: 150 + Math.random() * 170, v: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 20), s: 0.7 + Math.random() * 0.8 });
    const end = (q, text) => { if (S.over) return; S.over = true; S.phase = "end"; S.msg = text; g0.info.textContent = ""; g0.done = true; if (window.navigator.vibrate) try { navigator.vibrate(q ? 40 : 15); } catch (e) { /* sem vibração */ } onResult(q); finishButton(g0, tr("Continuar", "Continue", "Continuar")); };
    const down = () => { if (S.phase === "aim") { S.hold = true; S.power = 0; } else if (S.phase === "wait") { if (S.bite > 0) { S.phase = "reel"; S.reel.time = 0; sfx("good"); } else if (S.wait > 0.6) end(0, tr("Você puxou cedo demais e o peixe fugiu.", "You pulled too early and the fish ran off.", "Tiraste demasiado pronto y el pez huyó.")); } else if (S.phase === "reel") S.hold = true; };
    const up = () => { if (S.phase === "aim" && S.hold) { S.hold = false; const p = Math.max(0.15, S.power); Object.assign(S.bob, { fly: true, t: 0, x0: 138, y0: 60, x1: 210 + p * 380, y1: 150 + Math.random() * 90 }); S.phase = "cast"; sfx("step"); } else if (S.phase === "reel") S.hold = false; };
    g0.cv.addEventListener("pointerdown", (e) => { e.preventDefault(); down(); });
    window.addEventListener("pointerup", up, { once: false });
    g0.onKey = (e) => { if (e.type === "keydown" && !e.repeat) down(); else if (e.type === "keyup") up(); };
    const oldStop = g0.stop; g0.stop = () => { window.removeEventListener("pointerup", up); oldStop(); };
    g0._win = () => { S.phase = "reel"; S.reel.prog = 0.999; };
    g0.onFrame = (dt) => {
      const t = g0.t, b = S.bob, R = S.reel;
      // ---- lógica
      if (S.phase === "aim" && S.hold) S.power = Math.min(1, S.power + dt * 0.9);
      if (S.phase === "cast") { b.t += dt / 0.8; const u = Math.min(1, b.t); b.x = b.x0 + (b.x1 - b.x0) * u; b.y = b.y0 + (b.y1 - b.y0) * u - Math.sin(u * Math.PI) * 90; if (u >= 1) { S.phase = "wait"; b.fly = false; S.wait = 0; S.ripples.push({ x: b.x, y: b.y, r: 4, a: 0.9 }); S.biteAt = 1.6 + Math.random() * 2.6; sfx("click"); } }
      if (S.phase === "wait") {
        S.wait += dt;
        if (S.wait > S.biteAt && S.bite <= 0 && !S.bitten) { S.bitten = true; S.bite = 0.95; sfx("coin"); if (window.navigator.vibrate) try { navigator.vibrate(30); } catch (e) { /* sem vibração */ } }
        if (S.bite > 0) { S.bite -= dt; if (S.bite <= 0) end(0, tr("O peixe beliscou e escapou. Seja mais rápida!", "The fish nibbled and got away. Be quicker!", "El pez picó y escapó. ¡Sé más rápida!")); }
        if (Math.random() < dt * 1.2) S.ripples.push({ x: b.x + (Math.random() - 0.5) * 14, y: b.y + 4, r: 3, a: 0.5 });
      }
      if (S.phase === "reel") {
        R.time += dt;
        R.ft += (Math.random() - 0.5) * 900 * dt; R.ft = Math.max(30, Math.min(300, R.ft));
        R.fy += (R.ft - R.fy) * Math.min(1, dt * (deep ? 3.2 : 2.4));
        R.zv += ((S.hold || g0.keys.space) ? -520 : 420) * dt; R.zv = Math.max(-260, Math.min(260, R.zv)); R.zone = Math.max(30, Math.min(300 - 80, R.zone + R.zv * dt));
        const inside = R.fy > R.zone && R.fy < R.zone + 80;
        R.prog += (inside ? 0.16 : -0.11) * dt; R.prog = Math.max(0, Math.min(1, R.prog));
        if (R.prog >= 1) end(R.time < 7 ? 2 : 1, tr("Pescou! ", "Caught! ", "¡Pescaste! ") + (R.time < 7 ? tr("E foi rápido: um bom sinal de raridade.", "And fast too: a good sign of rarity.", "Y rápido: buena señal de rareza.") : ""));
        else if (R.prog <= 0) end(0, tr("A linha frouxou e o peixe escapou.", "The line went slack and the fish escaped.", "La línea se aflojó y el pez escapó."));
      }
      S.ripples.forEach((r) => { r.r += 26 * dt; r.a -= 0.5 * dt; }); S.ripples = S.ripples.filter((r) => r.a > 0);
      S.shadows.forEach((s) => { s.x += s.v * dt; if (s.x < 170 || s.x > 610) s.v = -s.v; });
      // ---- desenho
      const sky = g.createLinearGradient(0, 0, 0, 90); sky.addColorStop(0, deep ? "#1a3f70" : "#9fdcf7"); sky.addColorStop(1, deep ? "#2c6ea8" : "#d7f1fb"); g.fillStyle = sky; g.fillRect(0, 0, W, 90);
      const sea = g.createLinearGradient(0, 90, 0, H); sea.addColorStop(0, deep ? "#1d5c95" : "#5fc3ea"); sea.addColorStop(1, deep ? "#0a2a4f" : "#2a86bd"); g.fillStyle = sea; g.fillRect(0, 90, W, H - 90);
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2; for (let k = 0; k < 6; k++) { const y = 105 + k * 42; g.beginPath(); for (let x = 0; x <= W; x += 30) g.lineTo(x, y + Math.sin(x / 40 + t * 1.6 + k) * 3); g.stroke(); }
      S.shadows.forEach((s) => { g.fillStyle = "rgba(10,40,70,0.28)"; g.beginPath(); g.ellipse(s.x, s.y, 22 * s.s, 8 * s.s, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(s.x - 22 * s.s * Math.sign(s.v), s.y); g.lineTo(s.x - 34 * s.s * Math.sign(s.v), s.y - 7 * s.s); g.lineTo(s.x - 34 * s.s * Math.sign(s.v), s.y + 7 * s.s); g.fill(); });
      g.fillStyle = "#8a5a2c"; g.strokeStyle = INK; g.lineWidth = 3; g.fillRect(0, 84, 170, 14); g.strokeRect(0, 84, 170, 14); [24, 90, 150].forEach((x) => g.fillRect(x, 98, 8, 60));
      if (me.complete && me.naturalWidth) g.drawImage(me, 78, 12, 58, 70);
      // vara e linha
      const tipX = 150, tipY = 34, bob = S.phase === "aim" ? { x: 168, y: 96 } : b;
      g.strokeStyle = "#5a3a1c"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(112, 62); g.lineTo(tipX, tipY); g.stroke();
      const dip = S.phase === "wait" && S.bite > 0 ? 8 + Math.sin(t * 40) * 3 : 0;
      g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tipX, tipY); g.quadraticCurveTo((tipX + bob.x) / 2, Math.max(tipY, bob.y) + (S.phase === "reel" ? 0 : 26), bob.x, bob.y + dip); g.stroke();
      S.ripples.forEach((r) => ring(g, r.x, r.y + 4, r.r, Math.max(0, r.a)));
      if (S.phase !== "reel") { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(bob.x, bob.y + dip, 6, Math.PI, 0); g.fill(); g.fillStyle = "#e2473a"; g.beginPath(); g.arc(bob.x, bob.y + dip, 6, 0, Math.PI); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(bob.x, bob.y + dip, 6, 0, 7); g.stroke(); }
      if (S.phase === "wait" && S.bite > 0) { g.fillStyle = "#ffdf4a"; g.strokeStyle = INK; g.lineWidth = 4; rr(g, b.x - 16, b.y - 60, 32, 40, 8); g.fill(); g.stroke(); g.fillStyle = INK; g.font = "bold 30px system-ui"; g.textAlign = "center"; g.fillText("!", b.x, b.y - 39); }
      // barra de força
      if (S.phase === "aim") { g.fillStyle = "rgba(255,255,255,0.9)"; g.strokeStyle = INK; g.lineWidth = 3; rr(g, 40, 330, 200, 16, 8); g.fill(); g.stroke(); g.fillStyle = "#4fb86a"; rr(g, 42, 332, Math.max(0, 196 * S.power), 12, 6); g.fill(); g.fillStyle = INK; g.font = "13px system-ui"; g.textAlign = "left"; g.fillText(tr("Segure para lançar", "Hold to cast", "Mantén para lanzar"), 44, 322); }
      // recolhendo
      if (S.phase === "reel") {
        g.fillStyle = "rgba(255,255,255,0.92)"; g.strokeStyle = INK; g.lineWidth = 3; rr(g, 540, 30, 46, 300, 10); g.fill(); g.stroke();
        g.fillStyle = "rgba(79,184,106,0.85)"; g.fillRect(544, 30 + R.zone, 38, 80);
        emojiText(g, "🐟", 563, 30 + R.fy, 26);
        g.fillStyle = "rgba(255,255,255,0.92)"; rr(g, 600, 30, 20, 300, 8); g.fill(); g.stroke(); g.fillStyle = R.prog > 0.4 ? "#e0a820" : "#d9534f"; g.fillRect(603, 30 + 294 - 294 * R.prog, 14, 294 * R.prog);
      }
      if (S.msg) { g.fillStyle = "rgba(255,255,255,0.94)"; g.strokeStyle = INK; g.lineWidth = 3; rr(g, 90, 140, 460, 70, 14); g.fill(); g.stroke(); g.fillStyle = INK; g.font = "bold 18px system-ui"; g.textAlign = "center"; wrap(g, S.msg, 320, 168, 430, 22); }
    };
    return g0;
  }
  function wrap(g, text, x, y, maxW, lh) {
    const words = String(text).split(" "); let line = "", yy = y;
    words.forEach((w) => { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; });
    g.fillText(line, x, yy);
  }

  // ============================================================ ESCAVAR CONCHAS
  // onResult(coins, found)
  function shells(onResult) {
    const g0 = frame(`🐚 ${tr("Escavar conchas", "Dig for shells", "Excavar conchas")}`, tr("Toque na areia para cavar (8 escavações). A cor da casinha dá a dica: quanto mais quente, mais perto está algo enterrado.", "Tap the sand to dig (8 digs). The tile color is a clue: the warmer, the closer something is buried.", "Toca la arena para cavar (8 excavaciones). El color de la casilla es una pista: cuanto más cálida, más cerca hay algo enterrado."));
    const g = g0.g, C = 8, Rr = 5, TW = W / C, TH = (H - 40) / Rr;
    const items = ["🐚", "🐚", "🐚", "⭐", "🪙", "🥾"], grid = Array.from({ length: C * Rr }, () => null);
    items.forEach((it) => { let i; do { i = Math.floor(Math.random() * C * Rr); } while (grid[i]); grid[i] = it; });
    const S = { digs: 8, dug: {}, parts: [], pop: [], coins: 0, found: 0, over: false };
    const VAL = { "🐚": 3, "⭐": 6, "🪙": 4, "🥾": 0 };
    const near = (i) => { const x = i % C, y = Math.floor(i / C); let d = 99; grid.forEach((it, j) => { if (it && !S.dug[j]) d = Math.min(d, Math.hypot(x - (j % C), y - Math.floor(j / C))); }); return d; };
    const finish = () => { if (S.over) return; S.over = true; g0.done = true; g0.info.textContent = ""; g0.status.textContent = `${tr("Você achou", "You found", "Encontraste")} ${S.found} ${tr("tesouro(s)", "treasure(s)", "tesoro(s)")}: +${S.coins} ${tr("moedas", "coins", "monedas")}.`; onResult(S.coins, S.found); finishButton(g0, tr("Continuar", "Continue", "Continuar")); };
    g0._win = () => { grid.forEach((it, i) => { if (it && !S.dug[i]) dig(i); }); };
    function dig(i) {
      if (S.dug[i] || S.over) return;
      S.dug[i] = true; S.digs--; sfx("step");
      const x = (i % C) * TW + TW / 2, y = 40 + Math.floor(i / C) * TH + TH / 2;
      for (let k = 0; k < 14; k++) S.parts.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -60 - Math.random() * 160, life: 0.7 });
      const it = grid[i];
      if (it) { S.found++; S.coins += VAL[it]; S.pop.push({ e: it, x, y, t: 0 }); sfx(it === "🥾" ? "bad" : "coin"); }
      g0.status.textContent = `${tr("Escavações", "Digs", "Excavaciones")}: ${S.digs} · ${tr("Moedas", "Coins", "Monedas")}: ${S.coins}`;
      if (S.digs <= 0 || grid.every((v, j) => !v || S.dug[j])) setTimeout(finish, 700);
    }
    g0.cv.addEventListener("pointerdown", (e) => { const p = g0.at(e); if (p.y < 40) return; dig(Math.floor((p.y - 40) / TH) * C + Math.floor(p.x / TW)); });
    g0.status.textContent = `${tr("Escavações", "Digs", "Excavaciones")}: 8`;
    g0.onFrame = (dt) => {
      const t = g0.t;
      g.fillStyle = "#4fb8e8"; g.fillRect(0, 0, W, 40);
      g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, 34 + Math.sin(x / 30 + t * 2) * 4); g.stroke();
      for (let i = 0; i < C * Rr; i++) {
        const x = (i % C) * TW, y = 40 + Math.floor(i / C) * TH, dug = S.dug[i];
        let col = "#f3e2b0"; if (!dug && S.digs < 8) { const d = near(i); col = d <= 1.5 ? "#f2b982" : d <= 2.5 ? "#f5d197" : "#f3e2b0"; }
        g.fillStyle = dug ? "#c9a56a" : col; g.fillRect(x + 1, y + 1, TW - 2, TH - 2);
        if (!dug) { g.fillStyle = "rgba(160,120,60,0.18)"; for (let k = 0; k < 6; k++) g.fillRect(x + ((i * 37 + k * 23) % (TW - 6)), y + ((i * 53 + k * 31) % (TH - 6)), 2, 2); }
        else { const gr = g.createRadialGradient(x + TW / 2, y + TH / 2, 2, x + TW / 2, y + TH / 2, TW / 2); gr.addColorStop(0, "rgba(90,60,20,0.45)"); gr.addColorStop(1, "rgba(90,60,20,0)"); g.fillStyle = gr; g.fillRect(x, y, TW, TH); }
        g.strokeStyle = "rgba(120,90,40,0.25)"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, TW - 1, TH - 1);
      }
      S.pop.forEach((p) => { p.t += dt; const u = Math.min(1, p.t / 0.35), sc = 0.4 + 0.9 * Math.sin(u * Math.PI / 2) + (u >= 1 ? 0.0 : 0); emojiText(g, p.e, p.x, p.y - u * 8, 34 * sc); });
      S.parts.forEach((p) => { p.life -= dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.fillStyle = `rgba(214,180,110,${Math.max(0, p.life)})`; g.fillRect(p.x, p.y, 4, 4); }); S.parts = S.parts.filter((p) => p.life > 0);
    };
    return g0;
  }

  // ============================================================ BUSCAR A BOLINHA
  // pets: [{ species, variant, name }]; onResult(bolinhas)
  function fetchGame(pets, onResult) {
    const g0 = frame(`🎾 ${tr("Buscar a bolinha", "Fetch", "Buscar la pelota")}`, tr("Toque no campo para jogar a bolinha. Os bichinhos correm, pegam e trazem de volta. Você tem 30 segundos!", "Tap the field to throw the ball. Your pets run, grab it and bring it back. You have 30 seconds!", "Toca el campo para lanzar la pelota. Tus mascotas corren, la agarran y la traen. ¡Tienes 30 segundos!"));
    const g = g0.g, me = avatarImg(), owner = { x: 70, y: 250 };
    const sp = (id) => ((window.PETS_DATA && PETS_DATA.species) || []).find((s) => s.id === id) || {};
    const P = pets.slice(0, 3).map((p, i) => {
      const im = new Image(); const src = window.Scene3D && Scene3D.petIcon && use3D() ? Scene3D.petIcon(p.species, p.variant) : null; if (src) im.src = src;
      return { x: 120 + i * 40, y: 270 + i * 22, mode: "idle", im, emoji: sp(p.species).emoji || "🐾", sp: 150 + Math.random() * 60, face: 1, hop: 0 };
    });
    const S = { ball: null, score: 0, time: 30, hearts: [], over: false };
    const end = () => { if (S.over) return; S.over = true; g0.done = true; g0.info.textContent = ""; g0.status.textContent = `${tr("Bolinhas trazidas", "Balls fetched", "Pelotas traídas")}: ${S.score}`; onResult(S.score); finishButton(g0, tr("Continuar", "Continue", "Continuar")); };
    g0._win = () => { S.score = 6; end(); };
    g0.cv.addEventListener("pointerdown", (e) => { if (S.over || S.ball) return; const p = g0.at(e); if (p.y < 120) return; S.ball = { x: owner.x + 20, y: owner.y - 30, x0: owner.x + 20, y0: owner.y - 30, x1: Math.max(150, p.x), y1: Math.max(150, Math.min(330, p.y)), t: 0, land: false, carried: null }; sfx("step"); });
    g0.status.textContent = `${tr("Bolinhas trazidas", "Balls fetched", "Pelotas traídas")}: 0`;
    g0.onFrame = (dt) => {
      const b = S.ball; if (!S.over) { S.time -= dt; if (S.time <= 0) end(); }
      if (b && !b.land) { b.t += dt / 0.7; const u = Math.min(1, b.t); b.x = b.x0 + (b.x1 - b.x0) * u; b.y = b.y0 + (b.y1 - b.y0) * u - Math.sin(u * Math.PI) * 120; if (u >= 1) { b.land = true; b.y = b.y1; P.forEach((p) => { p.mode = "chase"; }); sfx("click"); } }
      P.forEach((p) => {
        if (p.mode === "chase" && b && b.land && !b.carried) { const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy); if (d < 18) { b.carried = p; p.mode = "return"; sfx("good"); } else { p.x += (dx / d) * p.sp * dt; p.y += (dy / d) * p.sp * dt; p.face = dx < 0 ? -1 : 1; } if (b.carried && b.carried !== p) p.mode = "idle"; }
        else if (p.mode === "return") { const dx = owner.x + 40 - p.x, dy = owner.y + 10 - p.y, d = Math.hypot(dx, dy); if (d < 16) { p.mode = "idle"; S.score++; S.ball = null; g0.status.textContent = `${tr("Bolinhas trazidas", "Balls fetched", "Pelotas traídas")}: ${S.score}`; for (let k = 0; k < 6; k++) S.hearts.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y - 20, life: 1 }); sfx("coin"); P.forEach((q) => { q.mode = "idle"; }); } else { p.x += (dx / d) * p.sp * 0.9 * dt; p.y += (dy / d) * p.sp * 0.9 * dt; p.face = dx < 0 ? -1 : 1; if (b) { b.x = p.x + p.face * 14; b.y = p.y - 8; } } }
        else if (p.mode === "idle") { p.hop += dt; }
      });
      // desenho
      const sk = g.createLinearGradient(0, 0, 0, 120); sk.addColorStop(0, "#9fdcf7"); sk.addColorStop(1, "#dff3d8"); g.fillStyle = sk; g.fillRect(0, 0, W, 120);
      const gr = g.createLinearGradient(0, 120, 0, H); gr.addColorStop(0, "#9fd68a"); gr.addColorStop(1, "#6fb45c"); g.fillStyle = gr; g.fillRect(0, 120, W, H - 120);
      g.fillStyle = "rgba(255,255,255,0.15)"; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % W, 130 + ((i * 53) % 220), 20, 3);
      [90, 260, 470, 590].forEach((x, i) => { g.fillStyle = "#6b4a2a"; g.fillRect(x - 5, 92, 10, 34); g.fillStyle = i % 2 ? "#3f9b4f" : "#4fae5a"; g.beginPath(); g.arc(x, 78, 30, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); });
      if (me.complete && me.naturalWidth) g.drawImage(me, owner.x - 30, owner.y - 76, 58, 70);
      P.slice().sort((a, b2) => a.y - b2.y).forEach((p) => {
        const bounce = p.mode === "idle" ? Math.abs(Math.sin(p.hop * 4)) * 3 : Math.abs(Math.sin(g0.t * 16)) * 5;
        g.fillStyle = "rgba(21,19,31,0.25)"; g.beginPath(); g.ellipse(p.x, p.y + 6, 16, 5, 0, 0, 7); g.fill();
        g.save(); g.translate(p.x, p.y - bounce); g.scale(p.face, 1);
        if (p.im.complete && p.im.naturalWidth) g.drawImage(p.im, -28, -50, 56, 56); else emojiText(g, p.emoji, 0, -20, 36);
        g.restore();
      });
      if (b) { const carried = b.carried; g.fillStyle = "rgba(21,19,31,0.25)"; if (!carried) { g.beginPath(); g.ellipse(b.x, (b.land ? b.y : b.y1) + 6, 8, 3, 0, 0, 7); g.fill(); } g.fillStyle = "#d8f04a"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, 8, 0, 7); g.fill(); g.stroke(); g.strokeStyle = "#fff"; g.beginPath(); g.arc(b.x, b.y, 6, 0.6, 2.4); g.stroke(); }
      S.hearts.forEach((h) => { h.life -= dt; h.y -= 30 * dt; emojiText(g, "💛", h.x, h.y, 18 * h.life + 6); }); S.hearts = S.hearts.filter((h) => h.life > 0);
      g.fillStyle = "rgba(255,255,255,0.9)"; g.strokeStyle = INK; g.lineWidth = 3; rr(g, 10, 10, 96, 32, 10); g.fill(); g.stroke(); g.fillStyle = INK; g.font = "bold 18px system-ui"; g.textAlign = "center"; g.fillText(`⏱ ${Math.max(0, Math.ceil(S.time))}s`, 58, 32);
    };
    return g0;
  }

  return { enabled, fish, shells, fetch: fetchGame, stop, get current() { return cur; }, kit: { frame, finishButton, emojiText, rr, avatarImg, INK, W, H } };
})();

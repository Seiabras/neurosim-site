"use strict";

// ===========================================================================
// Quatro atividades interativas novas, todas na moldura de Activities.kit (canvas 640×360, um jogo por vez):
//  · Patos (parque)          — jogue migalhas no lago; os patos nadam até elas. Até 5 patos alimentados.
//  · Constelações (observatório) — ligue as estrelas na ordem; uma constelação por dia da semana, com curiosidade no fim.
//  · Frutas (feira)          — mova a cesta e pegue as frutas que caem em 25 s; as estragadas tiram pontos.
//  · Oficina de arte (CAPS)  — desenho livre com cores e pincel; ao concluir, alivia o estresse. Guarda as 3 últimas obras.
// Cada uma rende recompensa (moedas, XP, energia, calma) UMA vez por dia; depois dá para jogar de novo só por diversão.
// Estado: state.atv = { feito: { patos:"sem:dia", ... }, arte: [dataURL, ...], melhor: { frutas: n }, const: { id: n } }.
// Ligado ao mapa por estações "act:patos|constelacoes|frutas|arte" (tools/python/build_atividades.py).
// ===========================================================================
const NovasAtividades = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const K = () => Activities.kit;
  const st = () => { const a = (state.atv = state.atv || {}); a.feito = a.feito || {}; a.arte = a.arte || []; a.melhor = a.melhor || {}; a.const = a.const || {}; return a; };
  const hoje = () => `${state.week || 1}:${state.dayIndex}`;
  const primeira = (id) => st().feito[id] !== hoje();
  const rand = (a, b) => a + Math.random() * (b - a);

  // recompensa diária: devolve o texto do que foi ganho ("" se já tinha ganho hoje)
  function premio(id, r) {
    const a = st(); if (!primeira(id)) return tr("Você já ganhou o prêmio de hoje aqui. Jogar de novo é só por diversão.", "You already got today's reward here. Playing again is just for fun.", "Ya obtuviste el premio de hoy aquí. Jugar de nuevo es solo por diversión.");
    a.feito[id] = hoje(); const parts = [];
    if (r.c) { state.coins += r.c; parts.push(`🪙 +${r.c}`); }
    if (r.x) { state.xp += r.x; parts.push(`⭐ +${r.x}`); }
    if (r.e) { const e0 = state.energy; state.energy = Math.max(0, Math.min(100, state.energy + r.e)); parts.push(`⚡ +${Math.round(state.energy - e0)}`); }
    if (r.calma && typeof Events !== "undefined") { Events.calm(r.calma); parts.push(`😌 −${r.calma} ${tr("estresse", "stress", "estrés")}`); }
    if (typeof Wheel !== "undefined" && r.roda) Wheel.gain && Wheel.gain(r.roda, 0.7);
    saveState(); if (typeof updateHud === "function") updateHud(); sfx("good");
    return parts.join(" · ");
  }
  const fim = (game, texto) => { game.done = true; game.info.textContent = texto; K().finishButton(game, tr("Concluir", "Finish", "Terminar")); };

  // ============================================================ PATOS
  function patos() {
    const k = K(), game = k.frame(`🦆 ${tr("Alimentar os patos", "Feed the ducks", "Dar de comer a los patos")}`, tr("Toque no lago para jogar migalhas (8). Os patos nadam até elas.", "Tap the lake to throw crumbs (8). The ducks swim to them.", "Toca el lago para lanzar migas (8). Los patos nadan hacia ellas."));
    const g = game.g, W = k.W, H = k.H;
    const ducks = Array.from({ length: 5 }, (_, i) => ({ x: rand(120, 520), y: rand(150, 300), vx: rand(-14, 14), face: 1, fed: 0, bob: rand(0, 6), col: ["#f2c230", "#f2c230", "#e8d8a0", "#f2b040", "#f6e27a"][i] }));
    let crumbs = [], left = 8, ripples = [];
    game.cv.addEventListener("pointerdown", (e) => {
      e.preventDefault(); if (game.done || left <= 0) return; const p = game.at(e);
      if (p.y < 110) return; left--; crumbs.push({ x: p.x, y: p.y, life: 12 }); ripples.push({ x: p.x, y: p.y, r: 2, a: 0.9 }); sfx("click");
      game.status.textContent = `🍞 ${left}`;
    });
    game.status.textContent = `🍞 ${left}`;
    game.onFrame = (dt) => {
      const t = game.t;
      ducks.forEach((d) => {
        const c = crumbs.filter((q) => q.life > 0).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
        if (c) { const dx = c.x - d.x, dy = c.y - d.y, dist = Math.hypot(dx, dy) || 1; d.x += (dx / dist) * 55 * dt; d.y += (dy / dist) * 55 * dt; d.face = dx >= 0 ? 1 : -1; if (dist < 12) { c.life = 0; d.fed++; ripples.push({ x: d.x, y: d.y, r: 2, a: 0.9 }); sfx("good"); } }
        else { d.x += d.vx * dt; d.y += Math.sin(t * 0.7 + d.bob) * 6 * dt; d.face = d.vx >= 0 ? 1 : -1; if (d.x < 60 || d.x > W - 60) d.vx *= -1; }
        d.y = Math.max(135, Math.min(H - 30, d.y));
      });
      crumbs.forEach((q) => { q.life -= dt; }); ripples.forEach((r) => { r.r += 30 * dt; r.a -= 0.7 * dt; }); ripples = ripples.filter((r) => r.a > 0);
      // ---- desenho
      const sky = g.createLinearGradient(0, 0, 0, 120); sky.addColorStop(0, "#bfe6ff"); sky.addColorStop(1, "#e4f4d8"); g.fillStyle = sky; g.fillRect(0, 0, W, 120);
      g.fillStyle = "#7fc06a"; g.fillRect(0, 96, W, 30);
      [[70, 70, 34], [560, 64, 40], [300, 80, 26]].forEach(([x, y, r]) => { g.fillStyle = "#7a5230"; g.fillRect(x - 5, y, 10, 40); g.fillStyle = "#4aa35a"; g.beginPath(); g.arc(x, y - 6, r, 0, 7); g.fill(); g.strokeStyle = k.INK; g.lineWidth = 3; g.stroke(); });
      const lake = g.createLinearGradient(0, 118, 0, H); lake.addColorStop(0, "#7fcdea"); lake.addColorStop(1, "#4a9fcb"); g.fillStyle = lake;
      k.rr(g, 20, 118, W - 40, H - 132, 46); g.fill(); g.strokeStyle = k.INK; g.lineWidth = 4; g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(80 + i * 96, 170 + (i % 3) * 50, 24, 5, 0, 0, 7); g.stroke(); }
      ripples.forEach((r) => { g.strokeStyle = `rgba(255,255,255,${r.a})`; g.lineWidth = 2; g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, 7); g.stroke(); });
      crumbs.forEach((q) => { if (q.life > 0) { g.fillStyle = "#e0b070"; g.strokeStyle = k.INK; g.lineWidth = 1.5; g.beginPath(); g.arc(q.x, q.y, 4, 0, 7); g.fill(); g.stroke(); } });
      ducks.slice().sort((a, b) => a.y - b.y).forEach((d) => {
        g.save(); g.translate(d.x, d.y + Math.sin(t * 2 + d.bob) * 1.5); g.scale(d.face, 1);
        g.fillStyle = "rgba(21,19,31,0.15)"; g.beginPath(); g.ellipse(0, 14, 24, 6, 0, 0, 7); g.fill();
        g.fillStyle = d.col; g.strokeStyle = k.INK; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 4, 24, 15, 0, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.arc(20, -12, 11, 0, 7); g.fill(); g.stroke();
        g.fillStyle = "#f28a2a"; g.beginPath(); g.moveTo(29, -12); g.lineTo(42, -8); g.lineTo(29, -5); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = k.INK; g.beginPath(); g.arc(22, -15, 2.2, 0, 7); g.fill();
        g.fillStyle = "rgba(0,0,0,0.12)"; g.beginPath(); g.ellipse(-4, 4, 12, 7, 0.3, 0, 7); g.fill();
        g.restore();
        if (d.fed) { g.font = "14px sans-serif"; g.fillStyle = "#d9453a"; g.textAlign = "center"; g.fillText("♥", d.x, d.y - 32 - Math.sin(t * 3 + d.bob) * 2); }
      });
      if (!game.done && (left <= 0 && crumbs.every((q) => q.life <= 0) || ducks.every((d) => d.fed > 0))) {
        const n = ducks.filter((d) => d.fed > 0).length;
        const p = premio("patos", { c: n * 2, x: 2 + n, calma: n >= 3 ? 3 : 1, e: n >= 4 ? 5 : 0 });
        fim(game, `🦆 ${n}/5 ${tr("patos alimentados", "ducks fed", "patos alimentados")}. ${p}`);
      }
    };
  }

  // ============================================================ CONSTELAÇÕES
  const CONST = [
    { id: "cruzeiro", name: L("Cruzeiro do Sul", "Southern Cross", "Cruz del Sur"), pts: [[320, 70], [320, 230], [240, 150], [400, 140], [352, 190]], order: [0, 1, null, 2, 3], link: [[0, 1], [2, 3]],
      fact: L("O Cruzeiro do Sul aponta o Sul e aparece na bandeira do Brasil. Os navegantes o usam há séculos para se orientar.", "The Southern Cross points south and appears on Brazil's flag. Sailors have used it for centuries to find their way.", "La Cruz del Sur señala el sur y aparece en la bandera de Brasil. Los navegantes la usan hace siglos para orientarse.") },
    { id: "tresmarias", name: L("Três Marias (Órion)", "Orion's Belt", "Las Tres Marías (Orión)"), pts: [[200, 140], [320, 120], [440, 100], [240, 240], [420, 60], [140, 70]], order: [0, 1, 2], link: [[0, 1], [1, 2]],
      fact: L("As Três Marias são o cinturão de Órion. Muitas culturas as viram como três irmãs, três reis ou uma fileira de sementes.", "The Three Marys are Orion's belt. Many cultures saw them as three sisters, three kings or a row of seeds.", "Las Tres Marías son el cinturón de Orión. Muchas culturas las vieron como tres hermanas, tres reyes o una fila de semillas.") },
    { id: "escorpiao", name: L("Escorpião", "Scorpius", "Escorpio"), pts: [[110, 90], [190, 130], [260, 170], [320, 220], [400, 250], [480, 230], [520, 170]], order: [0, 1, 2, 3, 4, 5, 6], link: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
      fact: L("O Escorpião tem uma estrela vermelha brilhante, Antares, o 'coração do escorpião'. No inverno do Sul ele cruza o céu bem alto.", "Scorpius has a bright red star, Antares, the 'heart of the scorpion'. In the southern winter it crosses the sky high up.", "Escorpio tiene una estrella roja brillante, Antares, el 'corazón del escorpión'. En el invierno del sur cruza el cielo muy alto.") }
  ];
  function constelacoes() {
    const k = K(), C = CONST[(state.dayIndex || 0) % CONST.length];
    const game = k.frame(`🔭 ${tr("Constelações", "Constellations", "Constelaciones")}: ${pick(C.name)}`, tr("Toque nas estrelas na ordem dos números para ligar a constelação. Errou a ordem? Sem problema, só some o brilho.", "Tap the stars in numbered order to connect the constellation. Wrong order? No problem, the glow just fades.", "Toca las estrellas en el orden de los números para unir la constelación. ¿Te equivocaste? No pasa nada, solo se apaga el brillo."));
    const g = game.g, W = k.W, H = k.H;
    const alvo = C.order.filter((v) => v !== null);
    const numero = {}; alvo.forEach((p, i) => { numero[p] = i + 1; });
    let prox = 0, erros = 0, ligadas = [], flash = 0;
    const fundo = Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(0.6, 1.8), f: rand(0, 6) }));
    game.cv.addEventListener("pointerdown", (e) => {
      e.preventDefault(); if (game.done) return; const p = game.at(e);
      const hit = C.pts.findIndex((q, i) => numero[i] && Math.hypot(q[0] - p.x, q[1] - p.y) < 24); if (hit < 0) return;
      if (hit === alvo[prox]) { if (prox > 0) ligadas.push([alvo[prox - 1], hit]); prox++; sfx("good"); flash = 1;
        if (prox >= alvo.length) {
          const pr = premio("constelacoes", { x: 6 + (erros === 0 ? 4 : 0), c: erros === 0 ? 6 : 3, calma: 2, roda: "observacao" }); st().const[C.id] = (st().const[C.id] || 0) + 1; saveState();
          fim(game, `✨ ${pick(C.fact)} ${pr}`);
        }
      } else { erros++; sfx("bad"); flash = -1; game.status.textContent = `❌ ${erros}`; }
    });
    game.onFrame = () => {
      const t = game.t; const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0e1230"); bg.addColorStop(1, "#2a2a5a"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      fundo.forEach((s) => { g.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 1.5 + s.f)})`; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); });
      g.fillStyle = "#1a1a30"; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H - 24); g.quadraticCurveTo(160, H - 46, 320, H - 26); g.quadraticCurveTo(480, H - 46, W, H - 22); g.lineTo(W, H); g.fill();
      g.strokeStyle = "rgba(255,240,170,0.9)"; g.lineWidth = 3; g.lineCap = "round"; ligadas.forEach(([a, b]) => { g.beginPath(); g.moveTo(...C.pts[a]); g.lineTo(...C.pts[b]); g.stroke(); });
      if (prox > 0 && prox < alvo.length) { g.strokeStyle = "rgba(255,240,170,0.25)"; g.setLineDash([5, 6]); g.beginPath(); g.moveTo(...C.pts[alvo[prox - 1]]); g.lineTo(...C.pts[alvo[prox]]); g.stroke(); g.setLineDash([]); }
      C.pts.forEach((q, i) => {
        const on = numero[i] && numero[i] <= prox, extra = !numero[i];
        const r = extra ? 3 : on ? 9 : 7 + Math.sin(t * 3 + i) * 1.2;
        if (on) { const gl = g.createRadialGradient(q[0], q[1], 1, q[0], q[1], 26); gl.addColorStop(0, "rgba(255,240,170,0.8)"); gl.addColorStop(1, "rgba(255,240,170,0)"); g.fillStyle = gl; g.beginPath(); g.arc(q[0], q[1], 26, 0, 7); g.fill(); }
        g.fillStyle = extra ? "rgba(255,255,255,0.7)" : on ? "#fff3b0" : "#cfd8ff"; g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill();
        if (numero[i] && !on) { g.fillStyle = "rgba(255,255,255,0.75)"; g.font = "bold 14px sans-serif"; g.textAlign = "center"; g.fillText(String(numero[i]), q[0], q[1] - 16); }
      });
      if (game.done) { g.fillStyle = "rgba(255,240,170,0.95)"; g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.fillText(pick(C.name), W / 2, 34); }
    };
  }

  // ============================================================ FRUTAS
  function frutas() {
    const k = K(), game = k.frame(`🧺 ${tr("Colher frutas", "Pick fruit", "Recoger frutas")}`, tr("Arraste (ou use as setas) para mover a cesta e pegue as frutas por 25 segundos. As estragadas (marrons) tiram pontos.", "Drag (or use the arrow keys) to move the basket and catch the fruit for 25 seconds. Rotten ones (brown) cost points.", "Arrastra (o usa las flechas) para mover la cesta y atrapa las frutas por 25 segundos. Las podridas (marrones) restan puntos."));
    const g = game.g, W = k.W, H = k.H;
    let bx = W / 2, pts = 0, tempo = 25, next = 0, itens = [], pegas = 0;
    const CORES = [["#d9453a", "🍎"], ["#f2842a", "🍊"], ["#f2e63a", "🍌"], ["#8a4aa8", "🍇"], ["#4aa35a", "🍏"]];
    game.cv.addEventListener("pointermove", (e) => { if (!game.done) bx = game.at(e).x; });
    game.cv.addEventListener("pointerdown", (e) => { e.preventDefault(); if (!game.done) bx = game.at(e).x; });
    const onKey = (e) => { if (e.code === "ArrowLeft") game.keys.l = e.type === "keydown"; if (e.code === "ArrowRight") game.keys.r = e.type === "keydown"; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
    const old = game.stop; game.stop = () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); old(); };
    game.onFrame = (dt) => {
      const t = game.t;
      if (!game.done) {
        tempo -= dt; if (game.keys.l) bx -= 260 * dt; if (game.keys.r) bx += 260 * dt; bx = Math.max(40, Math.min(W - 40, bx));
        next -= dt; if (next <= 0) { next = rand(0.35, 0.8); const podre = Math.random() < 0.18, c = CORES[Math.floor(Math.random() * CORES.length)]; itens.push({ x: rand(40, W - 40), y: -10, v: rand(90, 150), c: podre ? "#6a4a2a" : c[0], podre }); }
        itens.forEach((f) => { f.y += f.v * dt; });
        itens = itens.filter((f) => {
          if (f.y > H - 62 && f.y < H - 30 && Math.abs(f.x - bx) < 40) { if (f.podre) { pts = Math.max(0, pts - 2); sfx("bad"); } else { pts++; pegas++; sfx("click"); } return false; }
          return f.y < H + 20;
        });
        if (tempo <= 0) {
          const a = st(); a.melhor.frutas = Math.max(a.melhor.frutas || 0, pts);
          const p = premio("frutas", { c: Math.min(12, pts), x: 2 + Math.min(6, Math.floor(pts / 3)), e: pts >= 10 ? 6 : 2 });
          fim(game, `🧺 ${pts} ${tr("pontos", "points", "puntos")} (${tr("melhor", "best", "mejor")}: ${a.melhor.frutas}). ${p}`);
        }
        game.status.textContent = `⏱ ${Math.max(0, Math.ceil(tempo))} · 🍎 ${pts}`;
      }
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#bfe6ff"); sky.addColorStop(1, "#dff2c8"); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = "#7fc06a"; g.fillRect(0, H - 46, W, 46);
      [[60, 150], [310, 130], [560, 150]].forEach(([x, y]) => { g.fillStyle = "#7a5230"; g.fillRect(x - 9, y, 18, H - y - 40); g.fillStyle = "#4aa35a"; g.strokeStyle = k.INK; g.lineWidth = 3; g.beginPath(); g.arc(x, y - 10, 62 + Math.sin(t + x) * 2, 0, 7); g.fill(); g.stroke(); });
      itens.forEach((f) => { g.fillStyle = f.c; g.strokeStyle = k.INK; g.lineWidth = 2.5; g.beginPath(); g.arc(f.x, f.y, 11, 0, 7); g.fill(); g.stroke(); g.strokeStyle = "#3a8a4a"; g.beginPath(); g.moveTo(f.x, f.y - 11); g.lineTo(f.x + 3, f.y - 17); g.stroke(); if (f.podre) { g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.arc(f.x + 3, f.y + 2, 4, 0, 7); g.fill(); } });
      // cesta
      g.fillStyle = "#c8925a"; g.strokeStyle = k.INK; g.lineWidth = 3; g.beginPath(); g.moveTo(bx - 40, H - 62); g.lineTo(bx + 40, H - 62); g.lineTo(bx + 30, H - 28); g.lineTo(bx - 30, H - 28); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = "rgba(80,50,20,0.5)"; g.lineWidth = 2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(bx + i * 14, H - 60); g.lineTo(bx + i * 12, H - 30); g.stroke(); }
    };
  }

  // ============================================================ OFICINA DE ARTE
  function arte() {
    const k = K(), game = k.frame(`🎨 ${tr("Oficina de arte", "Art workshop", "Taller de arte")}`, tr("Desenhe livremente: escolha uma cor e um pincel. Não há certo nem errado, o que importa é o gesto. Quando quiser, conclua.", "Draw freely: pick a colour and a brush. There is no right or wrong, the gesture is what matters. Finish whenever you like.", "Dibuja libremente: elige un color y un pincel. No hay correcto ni incorrecto, importa el gesto. Termina cuando quieras."));
    const g = game.g, W = k.W, H = k.H;
    const cores = ["#15131f", "#d9453a", "#f2842a", "#f2c230", "#4aa35a", "#3f7fd8", "#8b5ac8", "#e0578a", "#ffffff"];
    let cor = cores[5], tam = 6, desenhando = false, ult = null, tracos = 0;
    g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, W, H);
    const bar = el("div", "art-bar"); bar.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0";
    cores.forEach((c) => { const b = el("button", "art-swatch"); b.type = "button"; b.style.cssText = `width:30px;height:30px;border-radius:50%;border:3px solid #15131f;background:${c}`; b.setAttribute("aria-label", c); b.addEventListener("click", () => { cor = c; }); bar.appendChild(b); });
    [[3, "•"], [6, "●"], [14, "⬤"]].forEach(([n, s]) => { const b = el("button", "pill-btn", s); b.type = "button"; b.addEventListener("click", () => { tam = n; }); bar.appendChild(b); });
    const lim = el("button", "pill-btn", tr("Limpar", "Clear", "Borrar")); lim.type = "button"; lim.addEventListener("click", () => { g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, W, H); tracos = 0; }); bar.appendChild(lim);
    game.info.after(bar);
    const ponto = (p) => { g.strokeStyle = cor; g.fillStyle = cor; g.lineWidth = tam; g.lineCap = "round"; g.lineJoin = "round"; if (ult) { g.beginPath(); g.moveTo(ult.x, ult.y); g.lineTo(p.x, p.y); g.stroke(); } else { g.beginPath(); g.arc(p.x, p.y, tam / 2, 0, 7); g.fill(); } ult = p; };
    game.cv.style.touchAction = "none";
    game.cv.addEventListener("pointerdown", (e) => { e.preventDefault(); desenhando = true; ult = null; tracos++; ponto(game.at(e)); });
    game.cv.addEventListener("pointermove", (e) => { if (desenhando) ponto(game.at(e)); });
    const solta = () => { desenhando = false; ult = null; };
    window.addEventListener("pointerup", solta);
    const old = game.stop; game.stop = () => { window.removeEventListener("pointerup", solta); old(); };
    game.onFrame = () => {};
    const ok = el("button", "pill-btn", tr("Concluir obra", "Finish artwork", "Terminar obra")); ok.type = "button";
    ok.addEventListener("click", () => {
      if (game.done) return; if (tracos < 3) { game.info.textContent = tr("Faça pelo menos alguns traços antes de concluir.", "Make a few strokes before finishing.", "Haz algunos trazos antes de terminar."); return; }
      const a = st(); try { const th = document.createElement("canvas"); th.width = 240; th.height = 135; th.getContext("2d").drawImage(game.cv, 0, 0, 240, 135); a.arte.unshift({ img: th.toDataURL("image/jpeg", 0.62), semana: state.week || 1, dia: state.dayIndex }); a.arte = a.arte.slice(0, 6); /* a galeria do Museu da Mente expõe as 6 últimas */ } catch (e) { /* sem miniatura */ }
      const p = premio("arte", { x: 6, c: 4, calma: 8, e: 6, roda: "multi" });
      game.done = true; bar.remove(); ok.remove(); game.info.textContent = `🎨 ${tr("Que bonito! Expressar-se com arte ajuda a organizar o que a gente sente.", "How lovely! Expressing yourself through art helps organise what we feel.", "¡Qué lindo! Expresarse con arte ayuda a organizar lo que sentimos.")} ${p}`;
      k.finishButton(game, tr("Concluir", "Finish", "Terminar"));
    });
    game.status.appendChild(ok);
  }

  // Galeria do Museu da Mente: expõe os quadros que você mesmo pintou na oficina do CAPS.
  function galeria() {
    const a = st();
    const body = $("hosp-body");
    $("hosp-title").textContent = `🖼️ ${tr("Galeria da Oficina", "Workshop Gallery", "Galería del Taller")}`;
    body.textContent = "";
    body.appendChild(el("p", "uni-q", tr("O museu reserva uma parede para o que sai da oficina de arte do CAPS. Arte não é enfeite: é um jeito de dizer o que ainda não virou palavra.", "The museum keeps a wall for what comes out of the CAPS art workshop. Art is not decoration: it is a way of saying what has not yet become words.", "El museo reserva una pared para lo que sale del taller de arte del CAPS. El arte no es adorno: es una forma de decir lo que aún no se hizo palabra.")));
    if (!a.arte.length) {
      body.appendChild(el("p", "shop-note muted", tr("A parede está vazia. Pinte na oficina de arte do CAPS e sua obra aparece aqui.", "The wall is empty. Paint at the CAPS art workshop and your work shows up here.", "La pared está vacía. Pinta en el taller de arte del CAPS y tu obra aparece aquí.")));
    } else {
      const parede = el("div", "galeria");
      a.arte.forEach((q, i) => {
        const moldura = el("figure", "galeria-q");
        const img = document.createElement("img");
        img.src = typeof q === "string" ? q : q.img;          // formato antigo: só a imagem
        img.alt = tr("Obra sua", "Your artwork", "Obra tuya");
        moldura.appendChild(img);
        const leg = el("figcaption", "", typeof q === "string" ? `#${a.arte.length - i}` : tr(`Semana ${q.semana}`, `Week ${q.semana}`, `Semana ${q.semana}`));
        moldura.appendChild(leg);
        parede.appendChild(moldura);
      });
      body.appendChild(parede);
      body.appendChild(el("p", "shop-note", tr(`${a.arte.length} de 6 obras na parede. As mais antigas dão lugar às novas.`, `${a.arte.length} of 6 works on the wall. The oldest make room for the newest.`, `${a.arte.length} de 6 obras en la pared. Las más antiguas dejan lugar a las nuevas.`)));
    }
    openModal("hosp-modal");
  }

  function action(id) {
    if (typeof Activities === "undefined" || !Activities.enabled()) {   // com as atividades desligadas: recompensa direta, sem jogo
      const R = { patos: { c: 4, x: 3, calma: 2 }, constelacoes: { x: 6, c: 3, calma: 2 }, frutas: { c: 6, x: 4, e: 4 }, arte: { x: 6, c: 4, calma: 8, e: 6 } }[id];
      const p = premio(id, R || {}); return showToast(p);
    }
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("atividades"), 500);
    ({ patos, constelacoes, frutas, arte }[id] || (() => {}))();
  }
  return { patos, constelacoes, frutas, arte, galeria, action, st, CONST };
})();
window.NovasAtividades = NovasAtividades;

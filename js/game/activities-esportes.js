"use strict";

// ===========================================================================
// Aulas da academia, com horário marcado e animação: alongamento, yoga, pilates, dança e boxe.
// Cada aula só acontece na janela de horário (o relógio do jogo manda). Um instrutor desenhado em canvas faz as posturas e a jogadora
// acompanha o ritmo tocando quando o anel de respiração fecha; o acerto vira saúde, energia e experiência.
// Estado: state.classes = { done: { idAula: "semana:dia" } }. Usa a moldura de Activities.kit.
// ===========================================================================
const Esportes = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const hm = (v) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
  const CLASSES = [
    { id: "alongamento", e: "🤸", from: "07:30", to: "08:30", bpm: 50, energy: 6, health: 2, name: L("Alongamento", "Stretching", "Estiramiento"), about: L("Solta o corpo para começar o dia.", "Loosens the body to start the day.", "Suelta el cuerpo para empezar el día.") },
    { id: "yoga", e: "🧘", from: "10:00", to: "11:00", bpm: 40, energy: 8, health: 3, name: L("Yoga", "Yoga", "Yoga"), about: L("Respiração e equilíbrio, devagar.", "Breathing and balance, slowly.", "Respiración y equilibrio, despacio.") },
    { id: "pilates", e: "🏋️", from: "15:00", to: "16:00", bpm: 52, energy: 5, health: 3, name: L("Pilates", "Pilates", "Pilates"), about: L("Força do centro do corpo e postura.", "Core strength and posture.", "Fuerza del centro y postura.") },
    { id: "danca", e: "💃", from: "18:00", to: "19:00", bpm: 96, energy: 4, health: 3, name: L("Dança", "Dance", "Baile"), about: L("Ritmo, alegria e movimento.", "Rhythm, joy and movement.", "Ritmo, alegría y movimiento.") },
    { id: "boxe", e: "🥊", from: "19:30", to: "20:30", bpm: 110, energy: 2, health: 4, name: L("Boxe leve", "Light boxing", "Boxeo suave"), about: L("Cardio em ritmo forte, sem contato.", "Strong-rhythm cardio, no contact.", "Cardio de ritmo fuerte, sin contacto.") }
  ];
  // posturas: ângulos em radianos a partir da vertical (0 = para baixo): braço [ombro, cotovelo] e perna [quadril, joelho], inclinação do tronco e agachamento
  const POSES = {
    alongamento: [{ la: [3.0, 0.1], ra: [-3.0, -0.1], ll: [0.15, 0], rl: [-0.15, 0], lean: 0, dip: 0 }, { la: [0.5, 0.1], ra: [-0.5, -0.1], ll: [0.05, 0], rl: [-0.05, 0], lean: 1.3, dip: 0 }, { la: [1.6, 0.1], ra: [1.6, 0.1], ll: [0.35, 0.2], rl: [-0.35, -0.2], lean: 0.5, dip: 0.05 }],
    yoga: [{ la: [3.1, 0], ra: [-3.1, 0], ll: [0.05, 0], rl: [-0.05, 0], lean: 0, dip: 0 }, { la: [2.6, 0.5], ra: [-2.6, -0.5], ll: [0.05, 0], rl: [1.3, -1.6], lean: 0, dip: 0 }, { la: [1.55, 0], ra: [-1.55, 0], ll: [0.6, 0.3], rl: [-0.6, -0.3], lean: 0.05, dip: 0.12 }],
    pilates: [{ la: [1.5, 0], ra: [1.5, 0], ll: [1.4, 0], rl: [1.4, 0], lean: -0.4, dip: 0 }, { la: [2.9, 0], ra: [2.9, 0], ll: [0.4, 0], rl: [-0.4, 0], lean: 0.15, dip: 0 }],
    danca: [{ la: [2.4, 0.6], ra: [-0.5, -0.3], ll: [0.3, 0], rl: [-0.2, 0], lean: 0.1, dip: 0 }, { la: [0.5, 0.3], ra: [-2.4, -0.6], ll: [0.2, 0], rl: [-0.3, 0], lean: -0.1, dip: 0.04 }, { la: [1.4, -1.2], ra: [-1.4, 1.2], ll: [0.5, 0.4], rl: [-0.5, -0.4], lean: 0, dip: 0.1 }],
    boxe: [{ la: [1.0, -1.7], ra: [-0.7, 1.6], ll: [0.35, 0.2], rl: [-0.3, -0.1], lean: 0.2, dip: 0.08 }, { la: [1.55, 0], ra: [-0.7, 1.6], ll: [0.35, 0.2], rl: [-0.3, -0.1], lean: 0.3, dip: 0.08 }, { la: [1.0, -1.7], ra: [-1.55, 0], ll: [0.35, 0.2], rl: [-0.3, -0.1], lean: 0.3, dip: 0.08 }]
  };
  const st = () => { const c = (state.classes = state.classes || {}); c.done = c.done || {}; return c; };
  const today = () => `${state.week || 1}:${state.dayIndex}`;
  const minutes = () => (state.clock === undefined ? 480 : state.clock);
  const status = (c) => { const m = minutes(), a = hm(c.from), b = hm(c.to); return m >= a && m < b ? "now" : m < a ? "soon" : "over"; };

  function open() {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("aulas"), 500);     const body = $("hosp-body"); body.textContent = "";
    $("hosp-title").textContent = `🏋️ ${tr("Aulas da academia", "Gym classes", "Clases del gimnasio")}`;
    body.appendChild(el("p", "uni-q", tr("Cada aula tem hora marcada. Chegue no horário, acompanhe o instrutor e toque no ritmo: quanto melhor o ritmo, mais saúde você ganha.", "Each class has a set time. Show up on time, follow the instructor and tap to the rhythm: the better your rhythm, the more health you gain.", "Cada clase tiene hora fija. Llega a tiempo, sigue al instructor y toca al ritmo: cuanto mejor el ritmo, más salud ganas.")));
    const grid = el("div", "store-grid");
    CLASSES.forEach((c) => {
      const s = status(c), done = st().done[c.id] === today();
      const card = el("section", "store-card" + (s === "now" && !done ? " seen" : " unknown"));
      card.appendChild(el("div", "store-ic", c.e));
      const b = el("div", "store-body");
      b.appendChild(el("h3", null, `${pick(c.name)} · ${c.from}–${c.to}`)); b.appendChild(el("p", "store-hint", pick(c.about)));
      const label = done ? tr("✅ Feita hoje", "✅ Done today", "✅ Hecha hoy") : s === "now" ? tr("▶ Começar agora", "▶ Start now", "▶ Empezar ahora") : s === "soon" ? tr(`⏰ Começa às ${c.from}`, `⏰ Starts at ${c.from}`, `⏰ Empieza a las ${c.from}`) : tr("Já terminou hoje", "Already ended today", "Ya terminó hoy");
      const btn = el("button", "pill-btn small", label); btn.type = "button"; btn.disabled = done || s !== "now";
      btn.addEventListener("click", () => { closeModal("hosp-modal"); start(c); });
      b.appendChild(btn); card.appendChild(b); grid.appendChild(card);
    });
    body.appendChild(grid);
    openModal("hosp-modal");
  }

  // ---- esqueleto: desenha um boneco de palitos grossos a partir de uma postura
  function figure(g, cx, cy, P, color, t) {
    const k = 34, sway = Math.sin(t * 2) * 0.03;
    const hip = { x: cx, y: cy + P.dip * 120 }, sh = { x: hip.x + Math.sin(P.lean) * 50, y: hip.y - Math.cos(P.lean) * 50 };
    const limb = (from, a1, l1, a2, l2, w) => { const j = { x: from.x + Math.sin(a1) * l1, y: from.y + Math.cos(a1) * l1 }, e = { x: j.x + Math.sin(a1 + a2) * l2, y: j.y + Math.cos(a1 + a2) * l2 }; g.lineWidth = w; g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(j.x, j.y); g.lineTo(e.x, e.y); g.stroke(); };
    g.strokeStyle = color; g.lineCap = "round"; g.lineJoin = "round";
    limb(hip, P.ll[0] + sway, k * 1.3, P.ll[1], k * 1.2, 13); limb(hip, P.rl[0] - sway, k * 1.3, P.rl[1], k * 1.2, 13);
    g.lineWidth = 20; g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(sh.x, sh.y); g.stroke();
    limb(sh, P.la[0], k * 0.95, P.la[1], k * 0.9, 10); limb(sh, P.ra[0], k * 0.95, P.ra[1], k * 0.9, 10);
    g.fillStyle = "#eab98f"; g.strokeStyle = "#15131f"; g.lineWidth = 3; g.beginPath(); g.arc(sh.x + Math.sin(P.lean) * 12, sh.y - 20, 15, 0, 7); g.fill(); g.stroke();
  }
  const mix = (a, b, u) => ({ la: [a.la[0] + (b.la[0] - a.la[0]) * u, a.la[1] + (b.la[1] - a.la[1]) * u], ra: [a.ra[0] + (b.ra[0] - a.ra[0]) * u, a.ra[1] + (b.ra[1] - a.ra[1]) * u], ll: [a.ll[0] + (b.ll[0] - a.ll[0]) * u, a.ll[1] + (b.ll[1] - a.ll[1]) * u], rl: [a.rl[0] + (b.rl[0] - a.rl[0]) * u, a.rl[1] + (b.rl[1] - a.rl[1]) * u], lean: a.lean + (b.lean - a.lean) * u, dip: a.dip + (b.dip - a.dip) * u });

  function start(c) {
    const K = Activities.kit, g0 = K.frame(`${c.e} ${pick(c.name)}`, tr("Acompanhe o instrutor. Toque (ou use a barra de espaço) quando o anel encostar no círculo do meio: é o ritmo da aula.", "Follow the instructor. Tap (or press space) when the ring reaches the middle circle: that is the class rhythm.", "Sigue al instructor. Toca (o usa la barra espaciadora) cuando el anillo llegue al círculo del centro: es el ritmo de la clase."));
    const g = g0.g, seq = POSES[c.id], beat = 60 / c.bpm, TOTAL = 16;
    const S = { beats: 0, hits: 0, judged: {}, flash: 0, msg: "", over: false, pose: 0, tPose: 0 };
    const finish = () => {
      if (S.over) return; S.over = true; g0.done = true; g0.info.textContent = "";
      const pct = S.hits / TOTAL, good = pct >= 0.5;
      const dh = Math.max(1, Math.round(c.health * (0.4 + pct))), de = good ? c.energy : Math.round(c.energy / 2);
      const first = st().done[c.id] !== today();
      if (first && typeof Events !== "undefined") Events.calm(5);
      if (first) { state.health = clamp((state.health === undefined ? 50 : state.health) + dh, 0, 100); state.energy = clamp(state.energy + de, 0, 100); state.xp += 3; st().done[c.id] = today(); }
      advanceClock(60); saveState(); updateHud(); sfx(good ? "good" : "click");
      g0.status.textContent = `${tr("Ritmo", "Rhythm", "Ritmo")}: ${Math.round(pct * 100)}%${first ? ` · ❤️ +${dh} · ⚡ +${de} · +3 XP` : ""}`;
      K.finishButton(g0, tr("Continuar", "Continue", "Continuar"));
    };
    const tapAt = () => {
      if (S.over) return;
      const idx = Math.round(g0.t / beat - 1), dt = Math.abs(g0.t - (idx + 1) * beat);
      if (idx < 0 || idx >= TOTAL || S.judged[idx]) return;
      S.judged[idx] = true; if (dt < 0.22) { S.hits++; S.flash = 1; S.msg = dt < 0.1 ? tr("Perfeito!", "Perfect!", "¡Perfecto!") : tr("Bom!", "Good!", "¡Bien!"); sfx("coin"); } else { S.msg = tr("Fora do ritmo", "Off rhythm", "Fuera de ritmo"); sfx("click"); }
    };
    g0.cv.addEventListener("pointerdown", tapAt); g0.onKey = (e) => { if (e.type === "keydown" && !e.repeat) tapAt(); };
    g0._win = () => { S.hits = TOTAL; finish(); };
    g0.onFrame = (dt) => {
      const t = g0.t, ph = t / beat, inBeat = ph - Math.floor(ph);
      if (!S.over && ph >= TOTAL + 1) finish();
      const pi = Math.floor(ph / 4) % seq.length, u = Math.min(1, (ph % 4) / 1.2), cur = seq[pi], prev = seq[(pi + seq.length - 1) % seq.length];
      const P = mix(prev, cur, u * u * (3 - 2 * u)); S.flash = Math.max(0, S.flash - dt * 3);
      const bg = g.createLinearGradient(0, 0, 0, 360); bg.addColorStop(0, c.id === "boxe" ? "#3a2f4f" : "#f4e9d0"); bg.addColorStop(1, c.id === "boxe" ? "#20182f" : "#d9c3a0"); g.fillStyle = bg; g.fillRect(0, 0, 640, 360);
      g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, 300, 640, 60); g.strokeStyle = "rgba(0,0,0,0.15)"; for (let x = 0; x < 640; x += 64) { g.beginPath(); g.moveTo(x, 300); g.lineTo(x - 30, 360); g.stroke(); }
      g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(20, 30, 120, 150); g.strokeStyle = "#15131f"; g.lineWidth = 3; g.strokeRect(20, 30, 120, 150);   // espelho da sala
      figure(g, 210, 250, P, "#5b64bf", t);                                // instrutor
      const Q = mix(P, P, 0); figure(g, 430, 250, Q, "#e58aa8", t - 0.12);  // a jogadora acompanha, um instante depois
      g.fillStyle = "#15131f"; g.font = "bold 14px system-ui"; g.textAlign = "center"; g.fillText(tr("Instrutor", "Instructor", "Instructor"), 210, 300); g.fillText(tr("Você", "You", "Tú"), 430, 300);
      // anel do ritmo
      const cx = 560, cy = 70, r = 26; g.strokeStyle = "#15131f"; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      const rr2 = r + (1 - inBeat) * 34; g.strokeStyle = S.flash > 0 ? "#4fb86a" : "#e0a820"; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, rr2, 0, 7); g.stroke();
      g.fillStyle = "#15131f"; g.font = "bold 16px system-ui"; g.fillText(`${Math.min(TOTAL, Math.max(0, Math.floor(ph)))}/${TOTAL}`, cx, cy + 6);
      if (S.msg) { g.font = "bold 18px system-ui"; g.fillStyle = S.flash > 0 ? "#2f8a4a" : "#a23a3a"; g.fillText(S.msg, 320, 40); }
    };
    return g0;
  }
  return { open, CLASSES, status, start };
})();

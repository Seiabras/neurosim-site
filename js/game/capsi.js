"use strict";

// ===========================================================================
// CAPsi — o centro acadêmico de psicologia.
//  · Prêmio na primeira visita: a turma adota você (bônus de rede de apoio e XP).
//  · Mesa de pingue-pongue jogável: descarregar tensão antes da semana de provas.
//    O jogo é curto de propósito — serve para relaxar, não para virar um segundo jogo.
// Estado: state.capsi = { visitou, melhor, jogadoEm }
// ===========================================================================
const Capsi = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const st = () => { const c = (state.capsi = state.capsi || {}); c.melhor = c.melhor || 0; return c; };
  const hoje = () => `${state.week || 1}:${state.dayIndex}`;

  // ---- prêmio de boas-vindas (uma vez)
  // A adoção da turma acontece ao entrar. Se o jogador já estiver no meio de outra coisa (falando com
  // alguém, numa tela de atividade), a boas-vindas ESPERA em vez de abrir por cima e roubar o clique:
  // era o que acontecia com quem tocava num integrante nos primeiros instantes da primeira visita.
  const ocupado = () => Boolean(document.querySelector(".modal:not(.hidden)")) || (typeof session !== "undefined" && session);

  function boasVindas(tentativa) {
    const c = st();
    if (c.visitou) return false;
    if (ocupado()) {
      if ((tentativa || 0) < 20) setTimeout(() => boasVindas((tentativa || 0) + 1), 600);   // volta quando a tela estiver livre
      return false;
    }
    c.visitou = true;
    state.xp += 25;
    state.coins += 30;
    if (typeof Wheel !== "undefined" && Wheel.gain) Wheel.gain("multi", 1);
    if (typeof Events !== "undefined" && Events.calm) Events.calm(6);
    saveState(); if (typeof updateHud === "function") updateHud(); sfx("levelup");
    const body = $("hosp-body");
    $("hosp-title").textContent = `🎓 ${tr("Bem-vinda ao CAPsi", "Welcome to CAPsi", "Bienvenida al CAPsi")}`;
    body.textContent = "";
    body.appendChild(el("p", "uni-q", tr(
      "A turma para o que está fazendo e abre espaço no sofá. Alguém serve café num copo de requeijão e te entrega uma cópia da chave: \"agora você é de casa\". Ter com quem dividir caso pesado é o que segura quem cuida dos outros.",
      "The group stops what it is doing and makes room on the sofa. Someone pours coffee into a jam jar and hands you a spare key: \"you're one of us now\". Having someone to share a heavy case with is what holds up the people who care for others.",
      "El grupo para lo que está haciendo y hace sitio en el sofá. Alguien sirve café en un vaso de mermelada y te da una copia de la llave: \"ya eres de casa\". Tener con quién compartir un caso pesado es lo que sostiene a quien cuida de otros.")));
    const cx = el("div", "dx-why ok");
    cx.appendChild(el("p", null, `⭐ +25 XP · 🪙 +30 · 🩺 +1 ${tr("Articulação Multidisciplinar", "Multidisciplinary Work", "Articulación Multidisciplinar")} · 😌 −6 ${tr("estresse", "stress", "estrés")}`));
    body.appendChild(cx);
    const ok = el("button", "continue-btn", tr("Obrigada!", "Thank you!", "¡Gracias!")); ok.type = "button";
    ok.addEventListener("click", () => closeModal("hosp-modal"));
    body.appendChild(ok);
    openModal("hosp-modal");
    return true;
  }

  // ---- pingue-pongue: rebater o máximo que der; a raquete segue o dedo/mouse
  function pingue() {
    if (typeof Activities === "undefined" || !Activities.enabled()) return semJogo();
    const K = Activities.kit;
    const g0 = K.frame(`🏓 ${tr("Pingue-pongue do CAPsi", "CAPsi ping-pong", "Ping-pong del CAPsi")}`,
      tr("Mova a raquete com o dedo ou o mouse e rebata. A cada rebatida a bola acelera um pouco.",
         "Move the paddle with your finger or mouse and hit it back. The ball speeds up a little with each rally.",
         "Mueve la paleta con el dedo o el ratón y devuelve. La pelota acelera un poco en cada golpe."));
    const W = g0.cv.width, H = g0.cv.height;
    const S = { x: W / 2, y: H / 2, vx: 210, vy: 170, r: 9, pw: 86, ph: 13, px: W / 2, cpu: W / 2, pontos: 0, fim: false };
    const mover = (e) => { if (S.fim) return; S.px = Math.max(S.pw / 2, Math.min(W - S.pw / 2, g0.at(e).x)); };
    g0.cv.addEventListener("pointermove", mover);
    g0.cv.addEventListener("pointerdown", mover);
    const velho = g0.stop; g0.stop = () => { g0.cv.removeEventListener("pointermove", mover); g0.cv.removeEventListener("pointerdown", mover); velho(); };

    g0.onFrame = (dt) => {
      const g = g0.g;
      if (!S.fim) {
        S.x += S.vx * dt; S.y += S.vy * dt;
        if (S.x < S.r || S.x > W - S.r) { S.vx *= -1; S.x = Math.max(S.r, Math.min(W - S.r, S.x)); }
        // raquete de cima (computador) acompanha com folga, para dar rally
        S.cpu += Math.max(-150 * dt, Math.min(150 * dt, (S.x - S.cpu)));
        const bateu = (py, px) => Math.abs(S.y - py) < S.r + S.ph / 2 && Math.abs(S.x - px) < S.pw / 2;
        if (S.vy < 0 && bateu(26, S.cpu)) { S.vy = Math.abs(S.vy); S.vx += (S.x - S.cpu) * 1.6; }
        if (S.vy > 0 && bateu(H - 26, S.px)) {
          S.vy = -Math.abs(S.vy) * 1.045; S.vx = (S.vx + (S.x - S.px) * 2.1) * 1.01;
          S.pontos += 1; sfx("click");
        }
        if (S.y > H + 30) { S.fim = true; fim(); }
        if (S.y < -30) { S.y = H / 2; S.x = W / 2; S.vy = Math.abs(S.vy); }
      }
      g.fillStyle = "#1f5c3a"; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
      g.fillStyle = "#fdfaf5";
      g.fillRect(S.cpu - S.pw / 2, 26 - S.ph / 2, S.pw, S.ph);
      g.fillRect(S.px - S.pw / 2, H - 26 - S.ph / 2, S.pw, S.ph);
      g.beginPath(); g.arc(S.x, S.y, S.r, 0, 7); g.fill();
      g.font = "bold 22px system-ui"; g.textAlign = "left"; g.fillText(String(S.pontos), 14, 40);
      g0.status.textContent = `🏓 ${tr("Rebatidas", "Rallies", "Golpes")}: ${S.pontos}`;
    };

    function fim() {
      const c = st();
      const recorde = S.pontos > c.melhor;
      if (recorde) c.melhor = S.pontos;
      let txt = tr(`A bola passou. ${S.pontos} rebatidas.`, `The ball went past. ${S.pontos} rallies.`, `La pelota pasó. ${S.pontos} golpes.`);
      if (c.jogadoEm !== hoje()) {
        c.jogadoEm = hoje();
        const moedas = Math.min(20, 2 + Math.floor(S.pontos / 2));
        state.coins += moedas; state.xp += 4;
        if (typeof Events !== "undefined" && Events.calm) Events.calm(5);
        txt += ` 🪙 +${moedas} · ⭐ +4 · 😌 −5 ${tr("estresse", "stress", "estrés")}`;
      } else {
        txt += ` ${tr("(o prêmio de hoje já saiu; agora é por diversão)", "(today's reward is spent; now it's just for fun)", "(el premio de hoy ya salió; ahora es por diversión)")}`;
      }
      if (recorde) txt += ` 🏅 ${tr("Novo recorde!", "New record!", "¡Nuevo récord!")}`;
      saveState(); if (typeof updateHud === "function") updateHud(); sfx(recorde ? "levelup" : "good");
      g0.info.textContent = txt;
      g0.done = true;
      Activities.kit.finishButton(g0, tr("Sair da mesa", "Leave the table", "Dejar la mesa"));
    }
  }

  function semJogo() {
    const c = st();
    if (c.jogadoEm !== hoje()) { c.jogadoEm = hoje(); state.coins += 8; state.xp += 4; if (typeof Events !== "undefined" && Events.calm) Events.calm(5); saveState(); if (typeof updateHud === "function") updateHud(); }
    showToast(`🏓 ${tr("Uma partida rápida com a turma.", "A quick match with the group.", "Una partida rápida con el grupo.")}`);
  }

  const action = (id) => (id === "pingue" ? pingue() : null);
  return { action, boasVindas, pingue, st, melhor: () => st().melhor };
})();
window.Capsi = Capsi;

"use strict";

// ===========================================================================
// Lugares de aprendizagem: laboratório, museu da mente, escola, fórum, cinema, CAPS, feira, parque e observatório.
// Cada estação "learn:<id>" abre um cartão (content/world.json → learn) com um texto curto e, às vezes, uma perguntinha.
//  · cartão com pergunta: acertar dá experiência (uma vez por dia);
//  · cartão com "cost": paga moedas a cada vez (cinema, feira) e devolve energia;
//  · cartão com "energy" sem custo: recupera energia uma vez por dia (parque, oficina do CAPS...).
// Estado: state.places = { done: { id: "semana:dia" } }
// ===========================================================================
const Places = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const data = () => (window.WORLD_DATA && WORLD_DATA.learn) || {};
  const st = () => { const p = (state.places = state.places || {}); p.done = p.done || {}; return p; };
  const today = () => `${state.week || 1}:${state.dayIndex}`;

  function open(id) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("lugares"), 500);     const d = data()[id];
    if (!d) return;
    const body = $("hosp-body"); body.textContent = "";
    $("hosp-title").textContent = pick(d.title);
    body.appendChild(el("p", "uni-q", pick(d.text)));
    const res = el("p", "uni-res"); res.id = "pl-res";
    const paid = (d.cost || 0) > 0, doneToday = st().done[id] === today();
    const foot = el("div", "uni-opts");
    const reward = (ok) => {   // aplica o que o cartão dá
      const first = !doneToday;
      const parts = [];
      if (paid) { if (state.coins < d.cost) { res.textContent = tr("Moedas insuficientes.", "Not enough coins.", "Monedas insuficientes."); sfx("bad"); return false; } state.coins -= d.cost; }
      if (d.energy && (paid || first)) { const e0 = state.energy; state.energy = clamp(state.energy + d.energy, 0, 100); parts.push(`⚡ +${Math.round(state.energy - e0)}`); }
      if (d.time) advanceClock(d.time);
      if (ok && first) { const xp = d.xp || 2; state.xp += xp; parts.push(`+${xp} XP`); }
      st().done[id] = today();
      saveState(); updateHud(); sfx("good");
      res.textContent = `✅ ${parts.join(" · ") || tr("Feito.", "Done.", "Hecho.")}`;
      return true;
    };
    if (d.quiz) {
      const q = d.quiz; body.appendChild(el("p", "dx-q", pick(q.q)));
      const box = el("div", "uni-opts");
      q.opts.forEach((o) => {
        const b = el("button", "choice-btn", pick(o.t)); b.type = "button";
        b.addEventListener("click", () => {
          box.querySelectorAll("button").forEach((x) => { x.disabled = true; });
          if (o.ok) { if (reward(true)) res.textContent = `${res.textContent}\n${pick(q.why)}`; }
          else { sfx("bad"); res.textContent = `❌ ${tr("Ainda não.", "Not yet.", "Aún no.")} ${pick(q.why)}`; }
        });
        box.appendChild(b);
      });
      body.appendChild(box);
    } else {
      const label = paid ? tr(`Assistir / usar (🪙${d.cost})`, `Use (🪙${d.cost})`, `Usar (🪙${d.cost})`) : (d.energy && doneToday ? tr("Já feito hoje", "Already done today", "Ya hecho hoy") : tr("Concluir", "Finish", "Terminar"));
      const b = el("button", "pill-btn", label); b.type = "button"; if (!paid && doneToday && d.energy) b.disabled = true;
      b.addEventListener("click", () => { if (reward(true)) b.disabled = !paid; });
      foot.appendChild(b); body.appendChild(foot);
    }
    body.appendChild(res);
    openModal("hosp-modal");
  }
  // ------------------------------------------------------------ Parque Memorial e Cemitério: monumentos, lápides e flores
  const HOMAGE_XP = 15, FLOWERS_COST = 10, FLOWERS_ENERGY = 20;
  const homage = () => { const p = st(); p.pioneers = p.pioneers || {}; return p.pioneers; };
  function memorial(spec) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("memorial"), 500);     const [kind, id] = spec.split(":");
    const body = $("hosp-body"); body.textContent = "";
    if (kind === "pioneer") {   // a) monumento de um pioneiro: verbete de história no Manual e +15 XP (uma vez por monumento)
      const g = MANUAL_GROUPS.find((x) => x.id === "historia"), d = g && g.disorders.find((x) => x.id === id);
      if (!d) return;
      $("hosp-title").textContent = `🏛️ ${d.name}`;
      d.items.forEach((t) => body.appendChild(el("p", "uni-q", t)));
      const res = el("p", "uni-res");
      const first = !homage()[id];
      const b = el("button", "continue-btn", first ? `🕯️ ${tr("Prestar homenagem (+15 XP e verbete no Manual)", "Pay tribute (+15 XP and a Manual entry)", "Rendir homenaje (+15 XP y una entrada en el Manual)")}` : tr("Você já prestou homenagem aqui.", "You already paid tribute here.", "Ya rendiste homenaje aquí."));
      b.type = "button"; b.disabled = !first;
      b.addEventListener("click", () => { homage()[id] = today(); state.manualOpen = state.manualOpen || {}; state.manualOpen[id] = true; state.xp += HOMAGE_XP; saveState(); updateHud(); sfx("good"); res.textContent = `✅ +${HOMAGE_XP} XP · ${tr("verbete aberto no Manual (História da psicologia)", "entry opened in the Manual (History of psychology)", "entrada abierta en el Manual (Historia de la psicología)")}`; b.disabled = true; });
      body.appendChild(b); body.appendChild(res);
    } else if (kind === "tombs") {   // b) lápides dos casos interrompidos por crise: reflexão ética e prontuário
      $("hosp-title").textContent = `🪦 ${tr("Lápides e reflexões", "Tombstones and reflections", "Lápidas y reflexiones")}`;
      const closed = typeof Risk !== "undefined" && Risk.enabled() ? Object.keys(state.pat || {}).filter((k) => state.pat[k].closed && CASES[k]) : [];
      body.appendChild(el("p", "uni-q", tr("Cada lápide guarda um caso que terminou antes da hora. Não é castigo: é memória e aprendizado.", "Each tombstone holds a case that ended too soon. It is not punishment: it is memory and learning.", "Cada lápida guarda un caso que terminó antes de tiempo. No es castigo: es memoria y aprendizaje.")));
      if (!closed.length) body.appendChild(el("p", "shop-note", tr("Nenhuma lápide por enquanto. Que continue assim: avalie o risco, pactue o plano e responda às emergências.", "No tombstones for now. May it stay that way: assess risk, agree on the plan and answer emergencies.", "Ninguna lápida por ahora. Que siga así: evalúe el riesgo, pacte el plan y responda a las emergencias.")));
      closed.forEach((k) => {
        const c = CASES[k], r = state.pat[k], box = el("div", "message-item chat-msg"), b = el("div", "chat-body"), h = el("div", "chat-head");
        h.appendChild(el("strong", null, `🪦 ${c.name} · ${c.age}`)); h.appendChild(el("span", "chat-time", `${(r.q || []).length}/${FU.SESSIONS}`)); b.appendChild(h);
        b.appendChild(el("p", "chat-bubble", `${tr("Prontuário", "Chart", "Expediente")}: ${Sens.text(c.complaint)} ${Sens.text(c.history)}`));
        b.appendChild(el("p", "shop-note", tr(`Reflexão: o risco não foi manejado a tempo (negligência ${r.neglig || 0}). Ler a análise ética ajuda a não repetir.`, `Reflection: the risk was not managed in time (negligence ${r.neglig || 0}). Reading the ethical analysis helps not to repeat it.`, `Reflexión: el riesgo no se manejó a tiempo (negligencia ${r.neglig || 0}). Leer el análisis ético ayuda a no repetirlo.`)));
        const rb = el("button", "pill-btn small", `🧭 ${tr("Ler a análise ética", "Read the ethical analysis", "Leer el análisis ético")}`); rb.type = "button"; rb.addEventListener("click", () => Risk.debrief(k)); b.appendChild(rb);
        box.appendChild(b); body.appendChild(box);
      });
    } else if (kind === "flowers") {   // c) autocuidado: 10 moedas, +20 de energia (uma vez por dia)
      $("hosp-title").textContent = `💐 ${tr("Deixar flores", "Leave flowers", "Dejar flores")}`;
      body.appendChild(el("p", "uni-q", tr("Deixar flores é um gesto de despedida e de cuidado consigo: uma pausa para lembrar de quem se foi e de si.", "Leaving flowers is a gesture of farewell and self-care: a pause to remember those who left, and yourself.", "Dejar flores es un gesto de despedida y de cuidado propio: una pausa para recordar a quien se fue y a uno mismo.")));
      const res = el("p", "uni-res"), doneToday = st().done["mem-flores"] === today();
      const b = el("button", "continue-btn", doneToday ? tr("Hoje você já deixou flores.", "You already left flowers today.", "Hoy ya dejaste flores.") : `💐 ${tr("Deixar flores", "Leave flowers", "Dejar flores")} (🪙${FLOWERS_COST}, ⚡ +${FLOWERS_ENERGY})`);
      b.type = "button"; b.disabled = doneToday;
      b.addEventListener("click", () => {
        if (state.coins < FLOWERS_COST) { res.textContent = tr("Moedas insuficientes.", "Not enough coins.", "Monedas insuficientes."); sfx("bad"); return; }
        state.coins -= FLOWERS_COST; if (typeof Events !== "undefined") Events.calm(10); const e0 = state.energy; state.energy = clamp(state.energy + FLOWERS_ENERGY, 0, 100); st().done["mem-flores"] = today(); advanceClock(15);
        saveState(); updateHud(); sfx("good"); res.textContent = `✅ 🪙 −${FLOWERS_COST} · ⚡ +${Math.round(state.energy - e0)}`; b.disabled = true;
      });
      body.appendChild(b); body.appendChild(res);
    }
    openModal("hosp-modal");
  }
  return { open, data, st, memorial };
})();

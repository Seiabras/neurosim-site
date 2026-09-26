"use strict";

// ===========================================================================
// Principal: agenda, planner, celular, tela inicial, criação, introdução,
// idiomas, opções, painel do desenvolvedor e eventos
// ===========================================================================

// ---------------------------------------------------------------- agenda do dia
function renderHome() {
  updateHud();
  $("btn-quests").textContent = `📜 ${I18N.pick(L("Missões", "Quests", "Misiones"))}`;
  $("btn-aq").classList.toggle("hidden", !(state.owned && state.owned.aquario));   // o botão do aquário aparece depois de comprar o aquário
  const list = $("appointment-list");
  list.textContent = "";

  if (weekDone()) {
    if ($("home-dayover")) $("home-dayover").classList.add("hidden");
    $("home-title").textContent = t("week.done");
    const card = el("div", "summary-card");
    card.appendChild(el("p", "summary-stars", starText(Math.round((totalStars() / maxStars()) * 3))));
    card.appendChild(el("p", null, t("week.summary", { n: totalStars(), max: maxStars(), level: levelName(levelIndex(state.xp)) })));
    card.appendChild(el("p", "muted", t("week.replay")));
    // O BALANÇO DO CICLO. Quatro semanas atendendo, investigando, errando e acertando, e o que se via
    // era "12 de 36 estrelas". O jogo sabe quem melhorou, o que você concluiu, se estava certo e quem
    // ficou pelo caminho: agora ele conta, paciente por paciente.
    if (typeof FU !== "undefined" && FU.balanco) {
      const b2 = FU.balanco();
      if (b2.atendidos) {
        const bx = el("div", "bal");
        bx.appendChild(el("h3", "aqx-h", `📖 ${t("week.bal.titulo")}`));
        bx.appendChild(el("p", "opt-note", t("week.bal.resumo", { n: b2.atendidos, f: b2.fechados, a: b2.acertos, t: b2.emTerapia })));
        b2.linhas.forEach((x) => {
          const l = el("div", "bal-l" + (x.interrompido ? " ruim" : x.certo === true ? " ok" : ""));
          const cab = el("div", "bal-cab");
          if (x.imagem) { const im = el("img", "bal-foto"); im.src = x.imagem; im.alt = ""; cab.appendChild(im); }
          cab.appendChild(el("b", "", x.nome));
          cab.appendChild(el("small", "", t("week.bal.consultas", { n: x.consultas, areas: x.investigadas })));
          l.appendChild(cab);
          let frase;
          if (x.interrompido) frase = t("week.bal.interrompido");
          else if (!x.fechou) frase = t("week.bal.semfechar");
          else if (x.certo) frase = t("week.bal.certo", { dx: x.dxNome });
          else frase = t("week.bal.errado", { dx: x.dxNome, real: x.respostaNome });
          l.appendChild(el("div", "bal-txt", frase));
          if (x.terapia) l.appendChild(el("div", "bal-txt ok", `🛋️ ${t("week.bal.terapia")}`));
          else if (x.fechou) l.appendChild(el("div", "bal-txt", t("week.bal.evolucao", { p: x.evolucao })));
          bx.appendChild(l);
        });
        card.appendChild(bx);
      }
    }
    if (!state.sandbox) {   // fim do ciclo de 4 semanas: continuar no modo contínuo (agenda sem fim, com psicoterapia e novos casos)
      const go = el("button", "continue-btn", `♾️ ${I18N.pick(L("Continuar no modo contínuo", "Continue in endless mode", "Continuar en modo continuo"))}`); go.type = "button"; go.id = "btn-sandbox";
      go.addEventListener("click", () => { state.sandbox = true; if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("continuo"), 500); state.weekRolled = FU.nextWeek(); state.rolledFrom = (state.week || 2) - 1; saveState(); renderHome(); showToast(I18N.pick(L("Modo contínuo: a agenda não acaba mais. Bom trabalho!", "Endless mode: the schedule never ends. Good work!", "Modo continuo: la agenda ya no termina. ¡Buen trabajo!"))); });
      card.appendChild(go);
    }
    list.appendChild(card);
    updateNav();
    return;
  }

  const dayKey = currentDayKey();
  $("home-title").textContent = t("home.title", { day: dayLabel(dayKey) });
  const over = $("home-dayover");
  if (over) { over.textContent = state.dayOver ? t("home.dayover") : ""; over.classList.toggle("hidden", !state.dayOver); }
  const openIdx = openCard !== null ? openCard : state.apptIndex;

  SCHEDULE[dayKey].forEach((appt, idx) => {
    const c = CASES[appt.caseId];
    if (!c) return;                       // agenda apontando para um caso que não existe (save estranho): o cartão é pulado
    const done = idx < state.apptIndex;
    const isNext = idx === state.apptIndex;
    const isOpen = idx === openIdx;

    const card = el("article", "appt-card");
    if (done) card.classList.add("done");
    if (isNext) card.classList.add("next");

    const left = el("div", "appt-left");
    const dot = el("button", `dot dot-btn ${c.dot}`);
    dot.type = "button";
    dot.title = t(DOT_KEYS[c.dot]);
    dot.setAttribute("aria-label", t("dot.aria", { name: t(DOT_KEYS[c.dot]) }));
    dot.addEventListener("click", () => openModal("legend-modal"));
    left.appendChild(dot);
    left.appendChild(el("div", "appt-time", appt.time));
    { const r0 = state.results[resultKey(dayKey, idx)]; if (done && r0) left.appendChild(el("div", "appt-stars", starText(r0.stars))); }
    card.appendChild(left);

    const right = el("div", "appt-right");
    const toggle = el("button", "appt-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.addEventListener("click", () => { openCard = isOpen ? -1 : idx; renderHome(); });

    if (isOpen) {
      toggle.appendChild(el("span", "appt-patient", t("appt.patient", { name: c.name })));
      right.appendChild(toggle);
      const info = el("div", "info-box");
      info.appendChild(el("strong", null, t("appt.info")));
      [["info.name", c.name], ["info.age", c.age], ["info.complaint", c.complaint], ["info.type", FU.sessType(appt.sess || 1)]].forEach(([k, v]) => {
        const p = el("p");
        p.appendChild(el("b", null, `${t(k)}: `));
        p.appendChild(document.createTextNode(v));
        info.appendChild(p);
      });
      right.appendChild(info);
      if (isNext) {
        const go = el("button", "continue-btn", t("appt.start"));
        go.type = "button";
        go.addEventListener("click", enterConsultationRoom);
        right.appendChild(go);
        const skip = el("button", "appt-skip-btn", t("appt.skip"));
        skip.type = "button";
        skip.addEventListener("click", skipAppointment);
        right.appendChild(skip);
      }
    } else {
      toggle.appendChild(el("span", "appt-hint", t("appt.tap")));
      right.appendChild(toggle);
    }
    card.appendChild(right);
    list.appendChild(card);
  });
  updateNav();
}

// ---------------------------------------------------------------- planner semanal
function renderPlanner() {
  const grid = $("paper-grid");
  grid.textContent = "";
  PAPER_DAYS.forEach((key) => {
    const isWork = DAYS.includes(key);
    const cell = el(isWork ? "button" : "div", "paper-cell");
    if (isWork) {
      cell.type = "button";
      if (key === plannerDay) cell.classList.add("selected");
      if (!weekDone() && key === currentDayKey()) cell.classList.add("today");
      cell.addEventListener("click", () => { plannerDay = key; renderPlanner(); });
    }
    cell.appendChild(el("span", "paper-day", t("daypaper." + key).toUpperCase()));
    const dots = el("div", "paper-dots");
    if (isWork) {
      SCHEDULE[key].forEach((appt, idx) => {
        const c = CASES[appt.caseId];
        const dot = el("i", `dot ${c.dot}`);
        dot.title = `${appt.time}: ${t(DOT_KEYS[c.dot])}`;
        if (state.results[resultKey(key, idx)]) dot.classList.add("done");
        dots.appendChild(dot);
      });
    }
    cell.appendChild(dots);
    grid.appendChild(cell);
  });

  const progress = el("div", "paper-cell progress-cell");
  progress.appendChild(el("span", "paper-day", t("planner.progress")));
  progress.appendChild(el("p", "progress-line", `${totalStars()} / ${maxStars()} ⭐`));
  progress.appendChild(el("p", "progress-line small", levelName(levelIndex(state.xp))));
  grid.appendChild(progress);

  const detail = $("planner-detail");
  detail.textContent = "";
  if (!plannerDay) { detail.appendChild(el("p", "muted", t("planner.tapday"))); return; }
  detail.appendChild(el("h2", null, dayLabel(plannerDay)));
  SCHEDULE[plannerDay].forEach((appt, idx) => {
    const c = CASES[appt.caseId];
    const row = el("div", "detail-row");
    row.appendChild(el("i", `dot ${c.dot}`));
    const text = el("div");
    text.appendChild(el("strong", null, `${appt.time}  ${c.name} (${c.age})`));
    text.appendChild(el("div", null, `${FU.sessType(appt.sess || 1)}: ${c.info}`));
    const res = state.results[resultKey(plannerDay, idx)];
    if (res) text.appendChild(el("div", null, `${t("planner.result")}: ${starText(res.stars)}`));
    row.appendChild(text);
    detail.appendChild(row);
  });
  if (DAYS.indexOf(plannerDay) > state.dayIndex) detail.appendChild(el("p", "muted", t("planner.locked")));
}

function openPlanner() {
  plannerDay = plannerDay || currentDayKey();
  renderPlanner();
  showScreen("planner");
}

// ---------------------------------------------------------------- celular
// horário e dia de cada mensagem: chegam na noite anterior à consulta (ex.: "dom 17:30")
function messageStamp(dayKey, idx) {
  const i = PAPER_DAYS.indexOf(dayKey);
  const prev = PAPER_DAYS[(i + 6) % 7];
  const mins = 17 * 60 + 30 + idx * 12;
  const hh = String(Math.floor(mins / 60)).padStart(2, "0"), mm = String(mins % 60).padStart(2, "0");
  return `${t("daypaper." + prev).slice(0, 3).toLowerCase()} ${hh}:${mm}`;
}

// mensagens do dia e pedidos de terapia, prontos para o componente Svelte (sem DOM)
function phoneMsgData() {
  const upTo = weekDone() ? DAYS.length - 1 : state.dayIndex, COLORS = ["#7fb8ff", "#f4a6c0", "#8fd9a8", "#ffd27a", "#c8a2f0"];
  const inbox = (state.inbox || []).slice().reverse().filter((m) => CASES[m.caseId]).map((m) => ({ caseId: m.caseId, status: m.status, kind: m.kind, name: CASES[m.caseId].name, letter: CASES[m.caseId].name.charAt(0).toUpperCase(), week: t("fu.week", { w: m.week, t: weekTotal() }), text: FU.inboxText(m), decline: t("fu.decline"), accept: t("fu.accept"), accepted: t("fu.accepted"), declined: t("fu.declined") }));
  const days = [];
  for (let i = upTo; i >= 0; i--) {
    const dayKey = DAYS[i];
    SCHEDULE[dayKey].forEach((appt, idx) => {
      const msg = CASES[appt.caseId].message, key = `${state.week || 1}:${dayKey}:${idx}`, today = i === state.dayIndex && !weekDone(), rep = Phone.st().replied[key];
      days.push({ key, caseId: appt.caseId, from: msg.from, letter: String(msg.from).trim().charAt(0).toUpperCase(), color: COLORS[(i + idx) % COLORS.length], stamp: messageStamp(dayKey, idx), text: msg.text, unread: i === state.dayIndex && !state.phoneRead[dayKey], canReply: today && Phone.hasTab("agenda"), replied: rep ? Phone.repliedText(rep) : null });
    });
  }
  const events = typeof Events !== "undefined" ? Events.viewData() : [];
  const crises = typeof Risk !== "undefined" ? Risk.pendingCrises().map((c) => ({ id: c.id, name: CASES[c.caseId].name, letter: CASES[c.caseId].name.charAt(0).toUpperCase(), text: Risk.crisisText(c), actions: Object.keys(Risk.CRISIS_ACTIONS).map((a) => ({ act: a, label: I18N.pick(Risk.CRISIS_ACTIONS[a]) })) })) : [];
  return { events, eventsTitle: `📌 ${I18N.pick(window.L("Acontecimentos", "Events", "Acontecimientos"))}`, crises, crisisTitle: `🚨 ${I18N.pick(window.L("Emergência fora do expediente", "Emergency outside working hours", "Emergencia fuera del horario"))}`, inboxTitle: `📨 ${t("fu.inbox.title")}`, weekTitle: `💬 ${t("fu.week", { w: state.week || 1, t: weekTotal() })}`, inbox, days, quick: Phone.quickList() };
}

function renderPhone() {
  if (window.CelularSvelte) { try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* nada */ } return; }   // o componente Svelte desenha o celular
  const list = $("message-list");
  list.textContent = "";
  $("phone-clock").textContent = fmtClock(state.clock);
  const tab = Phone.render();
  if (tab === "agenda") return Phone.renderAgenda(list);
  if (tab === "record") return Phone.renderRecord(list);
  if (tab === "pedidos") return Phone.renderPedidos(list);
  if (tab === "care") return Phone.renderCare(list);
  if (tab === "friends") return Phone.renderFriends(list);
  if (tab === "set") return Phone.renderSettings(list);
  const upTo = weekDone() ? DAYS.length - 1 : state.dayIndex;
  if (typeof Events !== "undefined" && Events.pending().length) {   // acontecimentos do dia e dilemas éticos da semana
    list.appendChild(el("h3", "uni-sem", `📌 ${I18N.pick(L("Acontecimentos", "Events", "Acontecimientos"))}`));
    Events.viewData().forEach((ev) => {
      const item = el("div", "message-item chat-msg unread"); item.appendChild(el("span", "chat-avatar", ev.icon));
      const b = el("div", "chat-body"), h = el("div", "chat-head"); h.appendChild(el("strong", null, `${ev.title} · ${ev.label}`)); b.appendChild(h); b.appendChild(el("p", "chat-bubble", ev.text));
      ev.choices.forEach((c) => { const bt = el("button", "pill-btn small", `${c.t}${c.fx ? " (" + c.fx + ")" : ""}`); bt.type = "button"; bt.style.display = "block"; bt.style.margin = "4px 0"; bt.addEventListener("click", () => Events.choose(ev.id, c.i)); b.appendChild(bt); });
      item.appendChild(b); list.appendChild(item);
    });
  }
  if (typeof Risk !== "undefined" && Risk.pendingCrises().length) {   // mensagens de emergência (risco): responder é obrigatório para não virar negligência
    list.appendChild(el("h3", "uni-sem", `🚨 ${t("risk.crisis")}`));
    Risk.pendingCrises().forEach((c) => {
      const item = el("div", "message-item chat-msg unread"); item.appendChild(el("span", "chat-avatar", CASES[c.caseId].name.charAt(0).toUpperCase()));
      const b = el("div", "chat-body"), h = el("div", "chat-head"); h.appendChild(el("strong", null, CASES[c.caseId].name)); b.appendChild(h); b.appendChild(el("p", "chat-bubble", Risk.crisisText(c)));
      const row = el("div", "uni-row"); Object.keys(Risk.CRISIS_ACTIONS).forEach((a) => { const bt = el("button", "pill-btn small", I18N.pick(Risk.CRISIS_ACTIONS[a])); bt.type = "button"; bt.addEventListener("click", () => Risk.crisisAct(c.id, a)); row.appendChild(bt); }); b.appendChild(row);
      item.appendChild(b); list.appendChild(item);
    });
  }
  // pedidos de terapia (pacientes que terminaram o ciclo de 4 consultas)
  if ((state.inbox || []).length) {
    list.appendChild(el("h3", "uni-sem", `📨 ${t("fu.inbox.title")}`));
    state.inbox.slice().reverse().forEach((m) => {
      const c = CASES[m.caseId];
      if (!c) return;
      const item = el("div", "message-item chat-msg");
      if (m.status === "new") item.classList.add("unread");
      item.appendChild(el("span", "chat-avatar", c.name.charAt(0).toUpperCase()));
      const body = el("div", "chat-body");
      const head = el("div", "chat-head");
      head.appendChild(el("strong", null, c.name));
      head.appendChild(el("span", "chat-time", t("fu.week", { w: m.week, t: weekTotal() })));
      body.appendChild(head);
      body.appendChild(el("p", "chat-bubble", FU.inboxText(m)));
      // o abandono não se responde com "aceitar": se responde com um telefone na mão
      const abandono = m.kind === "abandono";
      if (m.status === "new") {
        const row = el("div", "uni-row");
        const rotulos = abandono
          ? [[I18N.pick(L("Deixar ir", "Let them go", "Dejarlo ir")), false], [I18N.pick(L("📞 Ligar para ele(a)", "📞 Call them", "📞 Llamarle")), true]]
          : [[t("fu.decline"), false], [t("fu.accept"), true]];
        rotulos.forEach(([rot, yes]) => {
          const b = el("button", "pill-btn small", rot);
          b.type = "button";
          b.addEventListener("click", () => { FU.answer(m.caseId, yes); sfx(yes ? "good" : "click"); updateHud(); renderPhone(); });
          row.appendChild(b);
        });
        body.appendChild(row);
      } else if (m.status === "accepted") body.appendChild(el("p", "shop-note", abandono ? I18N.pick(L("📞 Você ligou. Ele(a) volta na semana que vem, e a adesão sobe um pouco — uma vez só.", "📞 You called. They come back next week, and adherence rises a little — once only.", "📞 Llamaste. Vuelve la semana que viene y la adhesión sube un poco — una sola vez.")) : t("fu.accepted")));
      else if (m.status === "declined") body.appendChild(el("p", "shop-note", abandono ? I18N.pick(L("O tratamento ficou encerrado por abandono. Fica na Reputação da Clínica.", "Treatment ended in dropout. It stays on the Clinic Reputation.", "El tratamiento terminó por abandono. Queda en la Reputación de la Clínica.")) : t("fu.declined")));
      item.appendChild(body);
      list.appendChild(item);
    });
    list.appendChild(el("h3", "uni-sem", `💬 ${t("fu.week", { w: state.week || 1, t: weekTotal() })}`));
  }
  const COLORS = ["#7fb8ff", "#f4a6c0", "#8fd9a8", "#ffd27a", "#c8a2f0"];
  for (let i = upTo; i >= 0; i--) {
    const dayKey = DAYS[i];
    SCHEDULE[dayKey].forEach((appt, idx) => {
      const msg = CASES[appt.caseId].message;
      const item = el("div", "message-item chat-msg");
      if (i === state.dayIndex && !state.phoneRead[dayKey]) item.classList.add("unread");
      const av = el("span", "chat-avatar", String(msg.from).trim().charAt(0).toUpperCase());
      av.style.background = COLORS[(i + idx) % COLORS.length];
      item.appendChild(av);
      const body = el("div", "chat-body");
      const head = el("div", "chat-head");
      head.appendChild(el("strong", null, msg.from));
      head.appendChild(el("span", "chat-time", messageStamp(dayKey, idx)));
      body.appendChild(head);
      body.appendChild(el("p", "chat-bubble", msg.text));
      if (i === state.dayIndex && !weekDone()) Phone.replyRow(`${state.week || 1}:${dayKey}:${idx}`, appt.caseId, body);
      item.appendChild(body);
      list.appendChild(item);
    });
  }
}

// ---------------------------------------------------------------- apêndice de pacientes e índice do jogo
function renderAppendix() {
  const box = $("appendix-list");
  box.textContent = "";
  let done = 0, total = 0;
  DAYS.forEach((day) => SCHEDULE[day].forEach((appt, idx) => {
    total++;
    const c = CASES[appt.caseId];
    const r = state.results[resultKey(day, idx)];
    const current = !weekDone() && day === currentDayKey() && idx === state.apptIndex;
    const inSession = session && !session.secret && session.dayKey === day && session.apptIdx === idx;
    const past = DAYS.indexOf(day) < state.dayIndex || Boolean(r);
    let status, cls;
    if (r) { done++; status = `${starText(Math.min(3, r.stars))} ${r.dx === true ? "✅ " + t("city.dx.right") : r.dx === false ? "❌ " + t("city.dx.wrong") : ""}`; cls = "done"; }
    else if (inSession) { status = `▶ ${t("appx.inprogress", { n: Math.min(session.stepIndex + 1, session.totalSteps), total: session.totalSteps, phase: t(session.phase === "dx" ? "appx.phase.dx" : "appx.phase.talk") })}`; cls = "now"; }
    else if (current) { status = `⏳ ${t("appx.next")}`; cls = "now"; }
    else if (past) { status = `⏭ ${t("appx.skipped")}`; cls = "skipped"; }
    else { status = `🔒 ${t("appx.soon")}`; cls = "later"; }
    const li = el("li", `appx-item ${cls}`);
    const head = el("div", "appx-head");
    head.appendChild(el("strong", null, r || current || inSession || past ? c.name : "???"));
    head.appendChild(el("span", "appx-when", `${t("dayshort." + day)} ${appt.time}`));
    li.appendChild(head);
    if (r || current || inSession || past) li.appendChild(el("div", "appx-type", `${FU.sessType(appt.sess || 1)}`));
    li.appendChild(el("div", "appx-status", status));
    box.appendChild(li);
  }));
  $("appendix-title").textContent = `${t("appx.title")} · ${done}/${total}`;
}

const IDX_ITEMS = [["🩺", "consult"], ["🎯", "dx"], ["📖", "manual"], ["☕", "break"], ["🗺️", "city"], ["👗", "shop"], ["🏷️", "souv"], ["🐾", "pets"], ["🎓", "uni"], ["💬", "npc"], ["🛋️", "decor"], ["📱", "phone"], ["📋", "appx"], ["☁️", "cloud"], ["🎁", "secret"], ["⚙️", "opts"]];
IDX_ITEMS.splice(3, 0, ["🔁", "follow"], ["🎡", "wheel"]);
IDX_ITEMS.splice(8, 0, ["🏙️", "live"], ["🏋️", "leisure"], ["🌊", "sea"]);
IDX_ITEMS.push(["🦋", "fauna"], ["🧩", "mind"], ["🏗️", "works"], ["🎵", "music"], ["🏆", "ach"], ["👗", "dress"], ["🌐", "culture"]);

function renderIndex() {
  const box = $("index-list");
  box.textContent = "";
  IDX_ITEMS.forEach(([icon, key]) => {
    const li = el("li", "idx-item");
    li.appendChild(el("span", "idx-icon", icon));
    const body = el("div", "idx-body");
    body.appendChild(el("strong", null, t(`idx.${key}.t`)));
    body.appendChild(el("p", null, t(`idx.${key}.x`)));
    li.appendChild(body);
    box.appendChild(li);
  });
}

function openPhone() {
  renderPhone();
  if (!weekDone()) state.phoneRead[currentDayKey()] = true;
  saveState();
  updateHud();
  showScreen("phone");
  setTimeout(() => { if (screen === "phone") Tutor.topic("phone", [{ key: "phone1", target: "message-list" }]); }, 600);
}

// ---------------------------------------------------------------- tela inicial, criação e novo jogo
function openTitle() {
  abandonSession();
  stopBreak();
  hideDayCard();
  $("btn-continue-game").classList.toggle("hidden", !state.introDone);
  $("btn-secret").classList.toggle("hidden", !secretAvailable());
  showScreen("title");
}

function newGame() {
  const hasProgress = state.introDone || state.dayIndex > 0 || Object.keys(state.results).length > 0;
  if (hasProgress && !confirm(t("newgame.confirm"))) return;
  abandonSession();
  createDraft = newDraft();
  renderCreate();
  showScreen("create");
}

function createDone() {
  const d = createDraft || newDraft();
  const fresh = newState();
  fresh.player = { name: (d.name || "").trim() || t("create.defaultname"), gender: d.gender, skin: d.skin, hairStyle: d.hairStyle, hairColor: d.hairColor, eyeColor: d.eyeColor, eyeShape: d.eyeShape || "round", brow: d.brow || "soft", mouth: d.mouth || "soft", face: d.face || "round", freckles: Boolean(d.freckles), top: d.top, acc: "none", art: d.art || null };
  state = fresh;
  openCard = null;
  plannerDay = null;
  hudAvatarKey = "";
  rebuildContent();
  saveState();
  renderHome();
  startIntro();
}

function continueGame() {
  if (!state.player) { newGame(); return; }
  if (resumeSession()) return;   // havia uma consulta em andamento: volta direto para ela, sem passar pela tela inicial
  renderHome();
  showScreen("home");
}

function resetGame() {
  if (!confirm(t("reset.confirm"))) return;
  abandonSession();
  stopBreak();
  state = newState();
  hudAvatarKey = "";
  openCard = null;
  plannerDay = null;
  rebuildContent();
  saveState();
  renderHome();
  closeModal("options-modal");
  openTitle();
}

function replayTips() {
  state.tips = {};
  state.tuts = {};
  settings.tips = true;
  saveSettings();
  saveState();
  syncOptions();
  $("btn-replay-tips").textContent = t("tips.again");
}

// ---------------------------------------------------------------- introdução (de casa até o consultório)
const INTRO_STEPS = [
  { scene: "casa", alarm: true, text: "intro.1", action: { icon: "⏰", label: "intro.1a" } },
  { scene: "casa", text: "intro.2", action: { img: "assets/icon-celular.png", label: "intro.2a" }, popup: { from: "intro.2from", text: "intro.2msg" } },
  { scene: "casa", text: "intro.3", action: { icon: "👜", label: "intro.3a" } },
  { scene: "rua", text: "intro.4" },
  { scene: "rua", text: "intro.5" },
  { scene: "porta", text: "intro.6", action: { img: "assets/icon-porta.png", label: "intro.6a" }, actSfx: "door" },
  { scene: "consultorio", text: "intro.7" },
  { scene: "consultorio", showProps: true, text: "intro.8" },
  { scene: "consultorio", sfx: "knock", text: "intro.9", label: "intro.9b" },
  { scene: "chegada", sfx: "arrive", text: "intro.10", variants: ["intro.10", "intro.10v2", "intro.10v3"], label: "intro.10b" }
];

// o nome de quem abre o dia, tirado da agenda
function nomeDoPrimeiroHorario() {
  try {
    const a = SCHEDULE[DAYS[0]][0];
    const c = a && CASES[a.caseId];
    return c ? I18N.pick(c.name) : "";
  } catch (e) { return ""; }
}

let introIndex = 0;
let introVariant = null;
let introPhase = 0;

function startIntro() {
  introIndex = 0;
  introVariant = null;
  introPhase = 0;
  showScreen("intro");
  renderIntro();
}

function mountIntro3D(art, step, waiting) {
  if (!use3D()) return false;
  const kind = { casa: "casa", rua: "rua", porta: "porta" }[step.scene] || "room";
  // A CHEGADA usa a câmera da consulta, não a `wide`. A `wide` enquadra o cômodo inteiro: numa tela larga
  // sobrava metade do quadro em parede e chão vazios, com as duas pessoas espremidas num canto. A câmera
  // `consult` existe justamente para enquadrar as duas poltronas — é a mesma que a consulta usa.
  const camera = step.scene === "chegada" ? "consult" : "wide";
  return window.Scene3D.mount(art, kind, Object.assign(scenePlace("consultorio"), {
    scene: kind, base: true, camera,
    alarm: Boolean(step.alarm) && waiting,
    showProps: Boolean(step.showProps),
    docPhase: step.scene === "casa" ? Math.min(2, introIndex) : undefined,
    // a chegada da 1ª paciente: quem senta é a pessoa da agenda, montada em 3D como na consulta
    patientLook: step.scene === "chegada" ? caseLook(CASES[primeiroCaso()], "patient") : null,
    speaker: "patient"
  }));
}

function addIntroAction(art, step) {
  const b = el("button", "intro-act");
  b.type = "button";
  if (step.action.img) {
    const img = el("img");
    img.src = step.action.img;
    img.alt = "";
    b.appendChild(img);
  } else {
    b.appendChild(el("span", "intro-act-icon", step.action.icon));
  }
  b.appendChild(el("span", "intro-act-label", t(step.action.label)));
  b.addEventListener("click", introAct);
  art.appendChild(b);
}

function buildIntroArt(step, waiting) {
  const art = $("intro-art");
  const had3D = art.classList.contains("is3d");
  [...art.children].forEach((ch) => { if (!ch.classList.contains("s3d-canvas")) ch.remove(); });
  if (!had3D) art.textContent = "";
  art.className = `intro-art scene-${step.scene}`;
  if (mountIntro3D(art, step, waiting)) {
    if (waiting) addIntroAction(art, step);
    return;
  }
  if (window.Scene3D) window.Scene3D.unmount(art);
  art.textContent = "";
  const prop = (cls, text) => art.appendChild(el("span", `sc-prop ${cls}`, text));

  if (step.scene === "casa") {
    const win = el("div", "sc-window");
    win.appendChild(el("span", "sc-sun", "☀️"));
    art.appendChild(win);
    prop("bed", "🛏️"); prop("plant", "🪴"); prop("mug", "☕");
    if (step.alarm) prop("alarm ringing", "⏰");
  } else if (step.scene === "rua") {
    ["cloud c1|☁️", "cloud c2|☁️", "bld b1|🏢", "bld b2|🏬", "bld b3|🏠", "tree t1|🌳", "tree t2|🌳", "walker|🚶"].forEach((s) => { const [c, e] = s.split("|"); prop(c, e); });
    art.appendChild(el("div", "sc-ground"));
  } else if (step.scene === "porta") {
    const facade = el("div", "sc-facade");
    facade.appendChild(el("div", "sc-sign", t("sign")));
    const door = el("img", "sc-door");
    door.src = "assets/icon-porta.png";
    door.alt = "";
    facade.appendChild(door);
    art.appendChild(facade);
  } else {
    const room = el("div", "room room-preview intro-room");
    renderRoom(room, Object.assign(scenePlace("consultorio"), { base: true }));
    art.appendChild(room);
    if (step.showProps) {
      [["ficha", "assets/ficha.png"], ["manual", "assets/manual.png"]].forEach(([cls, src]) => {
        const img = el("img", `sc-prop-img ${cls}`);
        img.src = src;
        img.alt = "";
        art.appendChild(img);
      });
    }
    if (step.scene === "chegada") {
      const maria = el("img", "sc-maria");
      maria.src = "assets/maria.png";
      maria.alt = "";
      art.appendChild(maria);
    }
  }
  if (waiting) addIntroAction(art, step);
}

function renderIntro() {
  const step = INTRO_STEPS[introIndex];
  const waiting = Boolean(step.action) && introPhase === 0;
  buildIntroArt(step, waiting);
  if (window.Sound) window.Sound.alarm(Boolean(step.alarm) && waiting);
  if (step.sfx) sfx(step.sfx);

  const text = $("intro-text");
  // Quem bate na porta é quem está no PRIMEIRO HORÁRIO DA AGENDA, e não um nome escrito à mão. A
  // introdução dizia "Maria" desde antes da 4.18, quando o caso-tutorial passou a ser o Lucas: o jogador
  // via a Maria se apresentar e, no segundo seguinte, entrava em consulta com outra pessoa.
  const vv = Object.assign({}, vars(), { nome: nomeDoPrimeiroHorario() });
  // falas de chegada: uma por jogo novo, sorteada (não dá para decorar)
  if (step.variants) { introVariant = introVariant === null ? Math.floor(Math.random() * step.variants.length) : introVariant; text.textContent = t(step.variants[introVariant], vv); }
  else text.textContent = t(step.text, vv);
  // as palavras aparecem uma a uma (texto continua o mesmo para leitores de tela e testes)
  const words = text.textContent.split(/(\s+)/);
  text.textContent = "";
  let wi = 0;
  words.forEach((w) => {
    if (/^\s+$/.test(w) || !w) { text.appendChild(document.createTextNode(w)); return; }
    const sp = el("span", "iw", w);
    sp.style.animationDelay = `${Math.min(wi++, 60) * 0.045}s`;
    text.appendChild(sp);
  });
  const badge = $("intro-scene-badge");
  if (badge) badge.textContent = { casa: "☀️", rua: "🌆", porta: "🚪", consultorio: "🩺", chegada: "🔔" }[step.scene] || "✨";
  const bar = $("intro-progress");
  if (bar) bar.style.width = `${((introIndex + 1) / INTRO_STEPS.length) * 100}%`;

  const popup = $("intro-popup");
  const showPopup = Boolean(step.popup) && introPhase === 1;
  popup.classList.toggle("hidden", !showPopup);
  if (showPopup) {
    sfx("phone");
    $("intro-popup-from").textContent = t(step.popup.from);
    $("intro-popup-text").textContent = t(step.popup.text, vars());
  }

  const next = $("intro-next");
  next.classList.toggle("hidden", waiting);
  next.textContent = step.label ? t(step.label) : t("intro.next");

  const dots = $("intro-dots");
  dots.textContent = "";
  INTRO_STEPS.forEach((_, i) => dots.appendChild(el("i", i === introIndex ? "on" : i < introIndex ? "past" : "")));
}

function introAct() {
  const step = INTRO_STEPS[introIndex];
  if (step.actSfx) sfx(step.actSfx);
  if (step.popup) { introPhase = 1; renderIntro(); } else introAdvance();
}

function introAdvance() {
  introIndex += 1;
  introPhase = 0;
  if (introIndex >= INTRO_STEPS.length) return finishIntro();
  renderIntro();
}

function finishIntro() {
  state.introDone = true;
  state.cardShown = state.dayIndex;
  saveState();
  renderHome();
  enterConsultationRoom();
}

function skipIntro() {
  state.introDone = true;
  saveState();
  renderHome();
  showScreen("home");
}

// ---------------------------------------------------------------- idioma
// Os idiomas ficam recolhidos: um botão mostra o idioma atual e abre a lista (são muitos para deixar todos à mostra)
const langOpen = {};
function renderLangButtons() {
  ["lang-row", "opt-lang"].forEach((id) => {
    const box = $(id);
    box.textContent = "";
    box.classList.add("lang-fold");
    const open = Boolean(langOpen[id]);
    const toggle = el("button", "lang-btn lang-toggle active");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.appendChild(I18N.flagImg(I18N.lang));
    toggle.appendChild(el("span", "e-inv-txt", `🌐 ${I18N.NAMES[I18N.lang]} ${open ? "▴" : "▾"}`));
    toggle.addEventListener("click", () => { langOpen[id] = !langOpen[id]; renderLangButtons(); });
    box.appendChild(toggle);
    if (!open) return;
    const panel = el("div", "lang-panel");
    I18N.LANGS.forEach((code) => {
      const btn = el("button", "lang-btn" + (code === I18N.lang ? " active" : ""));
      btn.type = "button";
      btn.dataset.lang = code;
      btn.setAttribute("aria-pressed", String(code === I18N.lang));
      btn.appendChild(I18N.flagImg(code));
      btn.appendChild(el("span", null, I18N.NAMES[code]));
      btn.addEventListener("click", () => { langOpen[id] = false; I18N.setLang(code); renderLangButtons(); });
      panel.appendChild(btn);
    });
    box.appendChild(panel);
    if (I18N.lang === "gn") box.appendChild(el("p", "opt-help", t("lang.gn.note")));   // o guarani ainda precisa de revisão de falante nativo
  });
}

function onLanguageChanged() {
  settings.lang = I18N.lang;
  saveSettings();
  rebuildContent();
  hudAvatarKey = "";
  updateHud();
  renderLangButtons();
  syncOptions();
  $("btn-replay-tips").textContent = t("help.replay");
  closeCoachNow();
  if (screen === "create") renderCreate();
  else if (screen === "intro") renderIntro();
  else if (screen === "home") renderHome();
  else if (screen === "planner") { renderPlanner(); }
  else if (screen === "phone") renderPhone();
  else if (screen === "shop") renderShop();
  else if (screen === "break") renderBreak();
  else if (screen === "secret") renderSecret();
  else if (screen === "consult" && session && $("feedback-panel").classList.contains("hidden")) { if (session.phase === "dx") startDiagnosis(); else renderStep(); }
  if (!$("manual-modal").classList.contains("hidden")) renderManual();
  if (!$("ficha-modal").classList.contains("hidden") && session) renderFicha();
}

// ---------------------------------------------------------------- opções
function syncOptions() {
  applyLook();
  { const th = $("opt-theme"); th.textContent = ""; ["auto", "light", "dark"].forEach((id) => { const b = el("button", "create-opt" + ((settings.theme || "auto") === id ? " active" : ""), t("opt.theme." + id)); b.type = "button"; b.setAttribute("aria-pressed", String((settings.theme || "auto") === id)); b.addEventListener("click", () => { settings.theme = id; saveSettings(); syncOptions(); }); th.appendChild(b); }); }
  { const ff = $("opt-font"); ff.textContent = ""; ["auto", "hand", "clean", "serif", "easy"].forEach((id) => { const b = el("button", "create-opt" + ((settings.font || "auto") === id ? " active" : ""), t("opt.font." + id)); b.type = "button"; b.dataset.font = id; b.setAttribute("aria-pressed", String((settings.font || "auto") === id)); b.addEventListener("click", () => { settings.lookTouched = true; settings.font = id; saveSettings(); syncOptions(); }); ff.appendChild(b); }); }
  $("opt-contraste").checked = Boolean(settings.altoContraste);
  $("opt-motion").checked = Boolean(settings.reducedMotion);
  document.documentElement.classList.toggle("alto-contraste", Boolean(settings.altoContraste));
  document.documentElement.classList.toggle("sem-movimento", Boolean(settings.reducedMotion));
  { const fs = $("opt-fontsize"); fs.textContent = ""; [[0.9, "A−"], [1, "A"], [1.15, "A+"], [1.3, "A++"]].forEach(([v, lb]) => { const b = el("button", "create-opt" + (Math.abs((settings.fontScale || 1) - v) < 0.01 ? " active" : ""), lb); b.type = "button"; b.style.fontSize = (0.9 + v * 0.3) + "rem"; b.setAttribute("aria-pressed", String(Math.abs((settings.fontScale || 1) - v) < 0.01)); b.addEventListener("click", () => { settings.lookTouched = true; settings.fontScale = v; saveSettings(); syncOptions(); }); fs.appendChild(b); }); }
  $("opt-versions").textContent = `${t("ver.btn", { v: GAME_VERSION })} · ${I18N.pick(faseDe(GAME_VERSION).nome)}`;
  $("title-version").textContent = `v${GAME_VERSION} · ${I18N.pick(faseDe(GAME_VERSION).nome)}`;
  if (!$("versions-modal").classList.contains("hidden")) renderChangelog();
  { // desempenho por aparelho
    const box = $("opt-perf"); box.textContent = "";
    const cur = settings.perf || "auto";
    [["auto", I18N.pick(window.L("Automático", "Automatic", "Automático"))], ["low", I18N.pick(Perf.NAMES.low)], ["balanced", I18N.pick(Perf.NAMES.balanced)], ["high", I18N.pick(Perf.NAMES.high)]].forEach(([id, label]) => {
      const b = el("button", "create-opt" + (cur === id ? " active" : ""), label); b.type = "button"; b.setAttribute("aria-pressed", String(cur === id));
      b.addEventListener("click", () => { settings.perf = id; saveSettings(); syncOptions(); showToast(t("opt.perf.applied")); }); box.appendChild(b);
    });
    const d = Perf.device(), a = settings.perfAuto || Perf.detect();
    $("opt-perf-info").textContent = t("opt.perf.info", { kind: t("opt.perf.kind." + d.kind), level: I18N.pick(Perf.NAMES[Perf.level()]), ms: a.ms });
    $("opt-perf-test").textContent = t("opt.perf.test");
    $("opt-fps").checked = Boolean(settings.showFps);
    const sug = Perf.suggestLook(); $("opt-look-hint").textContent = settings.lookTouched ? "" : t("opt.look.hint", { size: Math.round(sug.fontScale * 100) });
  }
  $("opt-typing").checked = settings.typing;
  $("opt-activities").checked = settings.activities !== false;
  $("opt-sens").checked = Boolean(settings.hideSensitive);
  // sem escolha da pessoa vale o automático: a caixa mostra o que o jogo decidiu pelo aparelho
  $("opt-pixi").checked = window.City && City.pixiAtivo ? City.pixiAtivo() : Boolean(settings.cityPixi);
  $("opt-pixi").disabled = !window.CityPixi;   // só liga no build do Vite (o Pixi vem do bundle)
  $("opt-dev").checked = settings.dev;
  $("opt-tips").checked = settings.tips;
  $("opt-showap").checked = settings.showApproach;
  $("opt-freedx").checked = Boolean(settings.freeDx);
  $("opt-fp").checked = settings.firstPerson;
  $("btn-fp").setAttribute("aria-pressed", String(Boolean(settings.firstPerson)));
  document.body.dataset.fp = settings.firstPerson ? "1" : "";   // a interface da consulta muda um pouco na 1ª pessoa (etiqueta do nome)
  $("btn-fp").classList.toggle("on", Boolean(settings.firstPerson));
  $("opt-3d").checked = settings.graphics3d;
  $("opt-mute").checked = settings.muted;
  $("opt-sfx").value = Math.round(settings.sfx * 100);
  $("opt-music").value = Math.round(settings.music * 100);
  $("opt-amb").value = Math.round((settings.amb === undefined ? 0.6 : settings.amb) * 100);
  $("opt-sfx-out").textContent = `${Math.round(settings.sfx * 100)}%`;
  $("opt-music-out").textContent = `${Math.round(settings.music * 100)}%`;
  $("opt-amb-out").textContent = `${Math.round((settings.amb === undefined ? 0.6 : settings.amb) * 100)}%`;
  $("opt-typesound").checked = settings.typeSound;
  $("opt-emptyoffice").checked = settings.emptyOffice !== false;
  { const box = $("opt-instr"); box.textContent = ""; ["bell", "piano", "flute", "harp"].forEach((id) => { const b = el("button", "create-opt" + (settings.instrument === id ? " active" : ""), t("instr." + id)); b.type = "button"; b.setAttribute("aria-pressed", String(settings.instrument === id)); b.addEventListener("click", () => { settings.instrument = id; saveSettings(); if (window.Sound) { Sound.setInstrument(id); Sound.motif(7, id); } syncOptions(); }); box.appendChild(b); }); }
  $("opt-showbest").checked = settings.showBest;
  $("nav-dev").classList.toggle("hidden", !settings.dev);
  $("btn-open-dev").classList.toggle("hidden", !settings.dev);
  applySound();
}

// a lista de jogos salvos, em Opções
function renderSaves() {
  const box = $("opt-saves");
  if (!box || typeof Saves === "undefined") return;
  box.textContent = "";
  const l = Saves.lista();
  if (!l.length) { box.appendChild(el("p", "opt-note", t("opt.saves.vazio"))); return; }
  l.forEach((sv) => {
    const c = el("div", "save-card");
    const cab = el("div", "save-cab");
    cab.appendChild(el("b", "", sv.nome));
    if (sv.auto) cab.appendChild(el("small", "save-auto", t("opt.saves.auto")));
    c.appendChild(cab);
    c.appendChild(el("small", "", `${sv.resumo} · ${new Date(sv.quando).toLocaleString()}`));
    const row = el("div", "uni-row");
    const carregar = el("button", "pill-btn small", `▶️ ${t("opt.saves.carregar")}`);
    carregar.type = "button";
    carregar.addEventListener("click", () => {
      if (!window.confirm(t("opt.saves.confirma"))) return;
      if (Saves.carregar(sv.id)) { showToast(`💾 ${t("opt.saves.carregado")}`); closeModal("options-modal"); renderHome(); updateHud(); }
    });
    const apagar = el("button", "pill-btn small", `🗑 ${t("opt.saves.apagar")}`);
    apagar.type = "button";
    apagar.addEventListener("click", () => { Saves.apagar(sv.id); renderSaves(); });
    row.appendChild(carregar); row.appendChild(apagar);
    c.appendChild(row);
    box.appendChild(c);
  });
}

function openOptions() {
  syncOptions();
  renderSaves();
  openModal("options-modal");
  setTimeout(() => Tutor.topic("opts", [{ key: "opts1", target: "opt-perf" }]), 500);
}

function initOptions() {
  const select = $("dev-day");
  DAYS.forEach((day, i) => {
    const opt = el("option", null, dayLabel(day));
    opt.value = String(i);
    select.appendChild(opt);
  });

  $("nav-options").addEventListener("click", openOptions);
  $("opt-reset").addEventListener("click", resetGame);
  $("opt-versions").addEventListener("click", () => { sfx("click"); renderChangelog(); openModal("versions-modal"); });
  $("opt-3d").addEventListener("change", (e) => { settings.graphics3d = e.target.checked; saveSettings(); if (screen === "shop") renderShop(); });
  $("opt-mute").addEventListener("change", (e) => { settings.muted = e.target.checked; saveSettings(); syncOptions(); });
  $("opt-sfx").addEventListener("input", (e) => { settings.sfx = Number(e.target.value) / 100; $("opt-sfx-out").textContent = `${e.target.value}%`; applySound(); saveSettings(); });
  $("opt-sfx").addEventListener("change", () => sfx("good"));
  $("opt-music").addEventListener("input", (e) => { settings.music = Number(e.target.value) / 100; $("opt-music-out").textContent = `${e.target.value}%`; applySound(); saveSettings(); });
  $("opt-amb").addEventListener("input", (e) => { settings.amb = Number(e.target.value) / 100; $("opt-amb-out").textContent = `${e.target.value}%`; applySound(); saveSettings(); });
  $("opt-typesound").addEventListener("change", (e) => { settings.typeSound = e.target.checked; saveSettings(); });
  $("opt-emptyoffice").addEventListener("change", (e) => { settings.emptyOffice = e.target.checked; saveSettings(); });
  $("nav-sound").addEventListener("click", () => { settings.muted = !settings.muted; saveSettings(); syncOptions(); });
  $("opt-tips").addEventListener("change", (e) => { settings.tips = e.target.checked; saveSettings(); if (!settings.tips) closeCoachNow(); });
  $("opt-typing").addEventListener("change", (e) => { settings.typing = e.target.checked; saveSettings(); });
  $("opt-perf-test").addEventListener("click", () => { Perf.retest(); syncOptions(); showToast(t("opt.perf.done", { level: I18N.pick(Perf.NAMES[Perf.level()]) })); });
  $("opt-fps").addEventListener("change", (e) => { settings.showFps = e.target.checked; saveSettings(); Perf.fpsMeter(settings.showFps); });
  $("opt-activities").addEventListener("change", (e) => { settings.activities = e.target.checked; saveSettings(); });
  $("opt-pixi").addEventListener("change", (e) => { settings.cityPixi = e.target.checked; saveSettings(); showToast(t(e.target.checked ? "opt.pixi.on" : "opt.pixi.off")); });
  $("opt-sens").addEventListener("change", (e) => { settings.hideSensitive = e.target.checked; saveSettings(); if (typeof Dx !== "undefined") Dx.resetData(); showToast(t(e.target.checked ? "opt.sens.on" : "opt.sens.off")); });
  const setFirstPerson = (on) => {
    settings.firstPerson = on;
    saveSettings();
    syncOptions();
    if (screen === "consult" && use3D() && session) renderRoom($("consult-room"), consultOpts());
  };
  $("opt-fp").addEventListener("change", (e) => setFirstPerson(e.target.checked));
  $("btn-fp").addEventListener("click", () => { sfx("click"); setFirstPerson(!settings.firstPerson); });
  $("opt-showap").addEventListener("change", (e) => {
    settings.showApproach = e.target.checked;
    saveSettings();
    if (session && session.phase !== "dx" && $("feedback-panel").classList.contains("hidden")) renderStep();
  });
  $("opt-freedx").addEventListener("change", (e) => { settings.freeDx = e.target.checked; saveSettings(); });
  $("opt-dev").addEventListener("change", (e) => { settings.dev = e.target.checked; saveSettings(); syncOptions(); });
  $("opt-showbest").addEventListener("change", (e) => {
    settings.showBest = e.target.checked;
    saveSettings();
    if (session && $("feedback-panel").classList.contains("hidden")) renderStep();
  });
  $("btn-open-dev").addEventListener("click", openDev);
  $("nav-dev").addEventListener("click", openDev);
  document.querySelectorAll(".dev-tab").forEach((tab) => tab.addEventListener("click", () => selectDevTab(tab.dataset.tab)));
  $("dev-unlock-shop").addEventListener("click", devUnlockShop);
  $("dev-secret").addEventListener("click", devSecret);
  // ---- painel do desenvolvedor: aba Clínica (chegar na consulta em dois cliques e enxergar o que mudou)
  {
    const caso = $("dev-clin-caso"), sess = $("dev-clin-sess");
    if (caso && sess) {
      Object.keys(CASES).filter((k) => CASES[k] && CASES[k].steps).forEach((k) => {
        const o = document.createElement("option"); o.value = k; o.textContent = I18N.pick(CASES[k].name); caso.appendChild(o);
      });
      [1, 2, 3, 4].forEach((n) => { const o = document.createElement("option"); o.value = String(n); o.textContent = `${n}ª consulta`; sess.appendChild(o); });
    }
    const atualiza = () => {
      const el0 = $("dev-clin-estado"); if (!el0) return;
      if (!session) { el0.textContent = "Nenhuma consulta aberta."; return; }
      const f = typeof ClinicFSM !== "undefined" && ClinicFSM.estado();
      const def = Math.round((100 - state.affinity) * (typeof Wheel !== "undefined" ? Wheel.defense() : 1));
      el0.textContent = `${I18N.pick(CASES[session.key].name)} · ${session.sess}ª consulta · passo ${session.stepIndex + 1}/${session.steps.length}`
        + ` · ${session.investigativa ? "investigativa" : "com escolhas"} · vínculo ${state.affinity}% · defesa ${def}%`
        + ` · ${session.points}/${session.maxPoints} pts · perguntas ${Dx.asksLeft()} · tempo ${Dx.budgetLeft()} min`
        + (f ? ` · máquina: ${f.estado} (${f.visitados.join("→")})` : "");
    };
    const abrir = $("dev-clin-abrir");
    if (abrir) abrir.addEventListener("click", () => {
      const k = caso.value, n = Number(sess.value) || 1;
      if (!k) return;
      if (session) abandonSession();
      const r = FU.rec(k); r.q = Array.from({ length: Math.max(0, n - 1) }, () => 0.7);   // finge as consultas anteriores
      state.affinity = START_AFFINITY;
      closeModal("dev-modal");
      startSession(k, { sess: n });
      setTimeout(atualiza, 400);
    });
    document.querySelectorAll("[data-vinc]").forEach((b) => b.addEventListener("click", () => {
      state.affinity = clamp(Number(b.dataset.vinc), 0, 100); saveState(); updateHud(); atualiza();
      devMessage(`Vínculo em ${state.affinity}%.`);
    }));
    document.querySelectorAll("[data-eixos]").forEach((b) => b.addEventListener("click", () => {
      const n = Number(b.dataset.eixos);
      state.atributos = {};
      if (typeof Wheel !== "undefined") {
        Wheel.AXES.forEach((a) => { state.atributos[a.id] = n; });   // os 8 eixos do radar (Wheel.IDS são as abordagens, outra lista)
        state.perfilDominante = Wheel.dominantAxis();
      }
      saveState(); updateHud(); if (session) renderStep(); atualiza();
      devMessage(n ? `Os 8 eixos da Roda no nível ${n}.` : "Eixos zerados.");
    }));
    const ach = $("dev-clin-achados");
    if (ach) ach.addEventListener("click", () => {
      const k = session ? session.key : caso.value;
      if (!k || typeof Dx === "undefined") return devMessage("Abra uma consulta primeiro.");
      const b2 = Dx.book(k); (Dx.kase(k).findings || []).forEach((f) => { b2.found[f.d] = true; });
      saveState(); if (session) renderStep(); atualiza();
      devMessage(`Todas as áreas de ${I18N.pick(CASES[k].name)} marcadas como investigadas.`);
    });
    const tmp = $("dev-clin-tempo");
    if (tmp) tmp.addEventListener("click", () => {
      if (!session) return devMessage("Abra uma consulta primeiro.");
      session.gasto = 0; session.asks = 0; session.corpoVisto = {};
      saveState(); renderStep(); atualiza();
      devMessage("Perguntas e tempo da sessão recarregados.");
    });
    window.__devClinAtualiza = atualiza;
  }
  $("dev-skip-appt").addEventListener("click", devSkipAppt);
  $("dev-skip-day").addEventListener("click", devSkipDay);
  $("dev-finish-week").addEventListener("click", devFinishWeek);
  $("dev-goto-day").addEventListener("click", devGotoDay);
  $("dev-redo").addEventListener("click", devRedo);
  $("dev-export").addEventListener("click", devExport);
  $("dev-import").addEventListener("click", devImport);
  $("dev-clear-phone").addEventListener("click", () => { state.phoneRead = {}; refreshAll(); devMessage("Mensagens marcadas como não lidas."); });
  document.querySelectorAll("[data-vinculo]").forEach((b) => b.addEventListener("click", () => devAdjust("vinculo", Number(b.dataset.vinculo))));
  document.querySelectorAll("[data-energy]").forEach((b) => b.addEventListener("click", () => devAdjust("energy", Number(b.dataset.energy))));
  document.querySelectorAll("[data-coins]").forEach((b) => b.addEventListener("click", () => devAdjust("coins", Number(b.dataset.coins))));
  document.querySelectorAll("[data-xp]").forEach((b) => b.addEventListener("click", () => devAdjust("xp", Number(b.dataset.xp))));
}

// ---------------------------------------------------------------- painel do desenvolvedor (em português)
function refreshAll() {
  saveState();
  updateHud();
  renderHome();
  if (screen === "planner") renderPlanner();
  if (screen === "shop") renderShop();
  if (screen === "break") renderBreak();
  updateDevStatus();
}

function backToHome() {
  if (screen === "break") stopBreak();
  renderHome();
  showScreen("home");
}

function markSkipped(dayKey, idx) {
  state.results[resultKey(dayKey, idx)] = { stars: 0, finalAffinity: state.affinity, skipped: true };
}

function devMessage(text) { $("dev-msg").textContent = text; }

function updateDevStatus() {
  const where = weekDone() ? "semana concluída" : `${dayLabel(currentDayKey())}, consulta ${state.apptIndex + 1} de ${SCHEDULE[currentDayKey()].length}`;
  $("dev-status").textContent =
    `Agora: ${where}\nVínculo ${state.affinity}% | Energia ${Math.round(state.energy)}% | Moedas ${state.coins} | XP ${state.xp} | Estrelas ${totalStars()}/${maxStars()}`;
  $("dev-val-vinculo").textContent = `${state.affinity}%`;
  $("dev-val-energy").textContent = `${Math.round(state.energy)}%`;
  $("dev-val-coins").textContent = state.coins;
  $("dev-val-xp").textContent = state.xp;
}

// pular a próxima consulta (para quem está sem tempo ou não quer atender aquele caso agora): conta 0 estrelas,
// igual a uma falta, e segue para a próxima. Pedido de confirmação porque não dá para desfazer.
function skipAppointment() {
  if (weekDone() || session) return;
  const day = currentDayKey(), appt = SCHEDULE[day][state.apptIndex];
  if (!appt) return;
  if (!confirm(t("appt.skip.confirm"))) return;
  markSkipped(day, state.apptIndex);
  advanceSchedule(day);
  openCard = null;
  refreshAll();
  showToast(t("appt.skip.done"));
}

function devSkipAppt() {
  if (weekDone()) return devMessage("A semana já está concluída.");
  abandonSession();
  const day = currentDayKey();
  markSkipped(day, state.apptIndex);
  advanceSchedule(day);
  openCard = null;
  refreshAll();
  backToHome();
  devMessage("Consulta pulada (0 estrelas).");
}

function devSkipDay() {
  if (weekDone()) return devMessage("A semana já está concluída.");
  abandonSession();
  const day = currentDayKey();
  for (let i = state.apptIndex; i < SCHEDULE[day].length; i++) markSkipped(day, i);
  state.dayIndex += 1;
  state.apptIndex = 0;
  openCard = null;
  refreshAll();
  backToHome();
  devMessage(`${dayLabel(day)} pulada.`);
}

function devFinishWeek() {
  abandonSession();
  for (let d = state.dayIndex; d < DAYS.length; d++) {
    const from = d === state.dayIndex ? state.apptIndex : 0;
    for (let i = from; i < SCHEDULE[DAYS[d]].length; i++) markSkipped(DAYS[d], i);
  }
  state.dayIndex = DAYS.length;
  state.apptIndex = 0;
  openCard = null;
  refreshAll();
  backToHome();
  devMessage("Semana concluída.");
}

function devGotoDay() {
  const idx = Number($("dev-day").value);
  abandonSession();
  DAYS.forEach((day, d) => {
    if (d < idx) return;
    SCHEDULE[day].forEach((_, i) => delete state.results[resultKey(day, i)]);
    delete state.phoneRead[day];
  });
  state.dayIndex = idx;
  state.apptIndex = 0;
  openCard = null;
  plannerDay = null;
  refreshAll();
  backToHome();
  devMessage(`Agora em ${dayLabel(DAYS[idx])} (resultados desse dia em diante foram apagados).`);
}

function devUnlockShop() {
  SHOP.items.forEach((it) => { state.owned[it.id] = true; });
  SHOP.expansions.forEach((e) => { state.expansions[e.id] = true; });
  SHOP.tops.concat(SHOP.accs).forEach((c) => { state.ownedClothes[c.id] = true; });
  refreshAll();
  devMessage("Todos os itens, expansões e roupas foram liberados.");
}

function devSecret() {
  settings.secretUnlocked = true;
  saveSettings();
  $("btn-secret").classList.remove("hidden");
  devMessage("Modo secreto liberado (botão na tela inicial).");
}

function devRedo() {
  if (weekDone()) return devMessage("A semana já está concluída.");
  abandonSession();
  stopBreak();
  closeModal("dev-modal");
  enterConsultationRoom();
}

function devAdjust(kind, value) {
  if (kind === "vinculo") state.affinity = clamp(state.affinity + value, 0, 100);
  if (kind === "energy") state.energy = clamp(state.energy + value, 0, 100);
  if (kind === "xp") state.xp = value === 0 ? 0 : state.xp + value;
  if (kind === "coins") state.coins = value === 0 ? 0 : state.coins + value;
  refreshAll();
  devMessage("Valores atualizados.");
}

function devExport() {
  $("dev-save").value = JSON.stringify(state, null, 2);
  devMessage("Texto atualizado com o save atual.");
}

// Troca o save atual por outro (importação do painel dev e sincronização pela nuvem).
function adoptSave(parsed) {
  if (!parsed || typeof parsed !== "object" || typeof parsed.dayIndex !== "number") throw new Error("formato inesperado");
  abandonSession();
  state = Object.assign(newState(), parsed);
  state.dayIndex = clamp(Math.round(state.dayIndex), 0, DAYS.length);
  state.apptIndex = Math.max(0, Math.round(state.apptIndex || 0));
  state.coins = Math.max(0, Math.round(state.coins || 0));
  hudAvatarKey = "";
  rebuildContent();
  openCard = null;
  refreshAll();
  if (screen === "title") openTitle();
}

function devImport() {
  try {
    adoptSave(JSON.parse($("dev-save").value));
    backToHome();
    devMessage("Save importado.");
  } catch (e) {
    devMessage(`Não consegui importar: ${e.message}.`);
  }
}

function openDev() {
  if (!settings.dev) return;
  closeModal("options-modal");
  updateDevStatus();
  if (window.__devClinAtualiza) window.__devClinAtualiza();
  devExport();
  devMessage("");
  openModal("dev-modal");
}

function selectDevTab(name) {
  document.querySelectorAll(".dev-tab").forEach((tab) => {
    const on = tab.dataset.tab === name;
    tab.classList.toggle("active", on);
    tab.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".dev-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== name));
}

// ---------------------------------------------------------------- eventos
$("nav-door").addEventListener("click", () => { if (!weekDone()) enterConsultationRoom(); });
$("nav-home").addEventListener("click", () => {
  if (screen === "shop") { travel("travel.home", () => { renderHome(); showScreen("home"); }); return; }
  goHome();
});
$("nav-phone").addEventListener("click", openPhone);
$("nav-shop").addEventListener("click", goShop);
$("btn-new").addEventListener("click", newGame);
$("btn-continue-game").addEventListener("click", continueGame);
$("btn-help").addEventListener("click", () => openModal("help-modal"));
$("btn-secret").addEventListener("click", openSecret);
$("secret-back").addEventListener("click", openTitle);
$("btn-title-options").addEventListener("click", openOptions);
$("btn-title").addEventListener("click", openTitle);
$("btn-replay-tips").addEventListener("click", replayTips);
$("intro-next").addEventListener("click", introAdvance);
$("intro-skip").addEventListener("click", skipIntro);
$("coach-ok").addEventListener("click", () => dismissCoach(true));
$("coach-off").addEventListener("click", () => { settings.tips = false; saveSettings(); syncOptions(); closeCoachNow(); });
$("daycard").addEventListener("click", hideDayCard);
$("btn-planner").addEventListener("click", openPlanner);
$("btn-ranking").addEventListener("click", () => window.Cloud.showRanking());
$("btn-legend").addEventListener("click", () => openModal("legend-modal"));
$("btn-appendix").addEventListener("click", () => { renderAppendix(); openModal("appendix-modal"); });
$("btn-index").addEventListener("click", () => { renderIndex(); openModal("index-modal"); });
$("btn-decor").addEventListener("click", () => Decor.open("consultorio"));
$("btn-fauna").addEventListener("click", () => FaunaGuide.open());
Decor.init();
Minigames.init();
Xadrez.init();
CharEdit.init();
FaunaGuide.init();
$("btn-wheel").addEventListener("click", () => Wheel.open());
$("btn-ach").addEventListener("click", () => Life.openAchievements());
$("btn-aq").addEventListener("click", () => Aquarium.open());
$("btn-quests").addEventListener("click", () => Quests.open());
$("nav-back").addEventListener("click", () => { sfx("click"); goBack(); });
$("btn-legend-2").addEventListener("click", () => openModal("legend-modal"));
$("btn-manual").addEventListener("click", openManual);
$("manual-back").addEventListener("click", manualBack);
{ const bubble = document.querySelector("#screen-consult .speech-bubble"); if (bubble && window.ResizeObserver) new ResizeObserver(() => placeNameTag()).observe(bubble); window.addEventListener("resize", () => placeNameTag()); }
$("manual-tab-index").addEventListener("click", () => manualTab("index"));
$("manual-tab-search").addEventListener("click", () => manualTab("search"));
$("manual-q").addEventListener("input", (e) => manualSearchInput(e.target.value));
$("btn-ficha").addEventListener("click", openFicha);
$("btn-invest").addEventListener("click", () => Dx.openInvest());
$("btn-test").addEventListener("click", () => PsicoDx.openTest());
$("btn-proj").addEventListener("click", () => PsicoDx.openProj(1));
$("btn-diva").addEventListener("click", () => oferecerDiva());
$("btn-sintese").addEventListener("click", () => usarHabilidade("sintese"));   // 📝 eixo Laudo
$("btn-parecer").addEventListener("click", () => usarHabilidade("parecer"));   // 🩺 eixo Articulação
$("btn-hint").addEventListener("click", buyHint);
$("btn-continue").addEventListener("click", continueDialogue);
$("btn-reset").addEventListener("click", resetGame);
$("btn-caderno").addEventListener("click", () => { if (typeof Dx !== "undefined" && Dx.abrirCaderno) Dx.abrirCaderno(); });
$("opt-bug").addEventListener("click", () => { if (typeof Bug !== "undefined") Bug.abrir(); });
$("opt-contraste").addEventListener("change", (e) => { settings.altoContraste = e.target.checked; settings.lookTouched = true; saveSettings(); syncOptions(); });
$("opt-motion").addEventListener("change", (e) => { settings.reducedMotion = e.target.checked; saveSettings(); syncOptions(); });
$("btn-save-novo").addEventListener("click", () => {
  if (typeof Saves === "undefined") return;
  const nome = window.prompt(I18N.pick(L("Nome deste jogo salvo:", "Name for this saved game:", "Nombre de esta partida guardada:")), Saves.rotulo(state));
  if (nome === null) return;
  // salvar podia não salvar e não dizer nada: se o navegador recusa, o jogador precisa saber
  if (Saves.guardar(nome, false)) { sfx("unlock"); showToast(`💾 ${t("opt.saves.feito")}`); renderSaves(); }
  else { sfx("deny"); showToast(`⚠️ ${t("opt.saves.cheio")}`); renderSaves(); }
});
// LEVAR O JOGO EMBORA (7.9). O save mora no navegador e é preso ao endereço do site — trocar de
// domínio, de navegador ou de computador deixava a partida para trás, e limpar os dados do navegador
// apagava tudo sem volta. Estes dois botões resolvem os três casos com um arquivo.
$("btn-save-exportar").addEventListener("click", () => {
  if (typeof Saves === "undefined") return;
  const nome = Saves.baixar(true);
  if (nome) { sfx("unlock"); showToast(`⬇️ ${t("opt.saves.baixado", { nome })}`); }
  else { sfx("deny"); showToast(`⚠️ ${t("opt.saves.semarquivo")}`); }
});
$("btn-save-importar").addEventListener("click", () => $("save-arquivo").click());
$("save-arquivo").addEventListener("change", (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = "";   // escolher o mesmo arquivo duas vezes seguidas tem de funcionar
  if (!f || typeof Saves === "undefined") return;
  const leitor = new FileReader();
  leitor.onload = () => {
    const info = Saves.ler(leitor.result);
    if (!info.ok) { sfx("deny"); showToast(`⚠️ ${t(`opt.saves.erro.${info.erro || "formato"}`)}`); return; }
    // o jogador vê o que vai entrar ANTES de entrar: de quem é a partida, em que semana, com quantas estrelas
    if (!window.confirm(t("opt.saves.confirma.import", { rotulo: info.rotulo, semana: info.semana, estrelas: info.estrelas, jogo: info.jogo }))) return;
    if (Saves.importar(info, true)) {
      sfx("levelup"); showToast(`⬆️ ${t("opt.saves.importado")}`);
      closeModal("options-modal"); renderHome(); updateHud(); refreshAll();
    } else { sfx("deny"); showToast(`⚠️ ${t("opt.saves.erro.formato")}`); }
  };
  leitor.onerror = () => { sfx("deny"); showToast(`⚠️ ${t("opt.saves.erro.json")}`); };
  leitor.readAsText(f);
});
$("btn-result-ok").addEventListener("click", closeResult);
$("dialogue-text").addEventListener("click", skipTyping);
$("break-next").addEventListener("click", endBreak);
$("create-name").addEventListener("input", (e) => { createDraft.name = e.target.value; $("create-doc").textContent = docVars(createDraft).doc; });
$("create-go").addEventListener("click", createDone);
$("create-back").addEventListener("click", openTitle);

// Um clique escondido: 5 toques no Ψ da tela inicial liberam o modo secreto.
let psiClicks = 0, psiTimer = null;
$("title-psi").addEventListener("click", () => {
  psiClicks += 1;
  clearTimeout(psiTimer);
  psiTimer = setTimeout(() => { psiClicks = 0; }, 4000);
  if (psiClicks >= 5 && !settings.secretUnlocked) {
    settings.secretUnlocked = true;
    saveSettings();
    $("btn-secret").classList.remove("hidden");
    sfx("levelup");
  }
});

document.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.close)));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    ["legend-modal", "manual-modal", "ficha-modal", "options-modal", "dev-modal", "help-modal", "ranking-modal", "cloud-choice-modal", "uni-modal", "hosp-modal", "adopt-modal", "appendix-modal", "index-modal", "versions-modal"].forEach((id) => {
      if (!$(id).classList.contains("hidden")) closeModal(id);
    });
    return;
  }
  if (screen !== "consult" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector(".modal:not(.hidden)")) return;
  const index = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 }[e.key.toLowerCase()];
  const box = $("choices-container");
  if (index === undefined || box.classList.contains("hidden")) return;
  const btn = box.querySelectorAll("button")[index];
  if (btn) btn.click();
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest("button");
  if (btn && !btn.disabled) sfx("click");
}, true);

// gancho de depuração (usado nos testes)
window.__nc = { seasonNow, state: () => state, settings: () => settings };

// ---------------------------------------------------------------- início
I18N.onChange(onLanguageChanged);
Perf.applySuggestedLook();   // fonte e tamanho sugeridos para este aparelho (só enquanto a pessoa não escolheu os dela)
applyLook();
if (settings.showFps) Perf.fpsMeter(true);
I18N.init(settings.lang);
rebuildContent();
initOptions();
renderLangButtons();
syncOptions();
renderHome();
openTitle();
Money.init();
Tutor.init();
City.init();
window.Cloud.init();

// instalar no celular/tablet e abrir sem internet (só em site de verdade; em localhost o cache atrapalharia os testes)
if ("serviceWorker" in navigator && /^https:/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { /* sem service worker: o jogo funciona igual */ }); });
}

// dicas progressivas: cada sistema novo se explica uma vez, quando a pessoa chega nele
if (typeof Tips !== "undefined") Tips.watch();

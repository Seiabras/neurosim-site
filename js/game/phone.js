"use strict";

// ===========================================================================
// Celular: modelos, capinhas, papéis de parede, abas (mensagens, agenda, prontuário, ajustes)
// e a loja de eletrônicos da cidade. Estado em state.phone = { model, case, wall, owned }.
// ===========================================================================
const Phone = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => I18N.pick(L(pt, en, es));

  const MODELS = [
    { id: "basic", price: 0, emoji: "📱", tabs: ["msg", "care", "friends", "set"], name: L("Celular básico", "Basic phone", "Celular básico"), about: L("Mensagens e recados.", "Messages and notes.", "Mensajes y recados.") },
    { id: "plus", price: 60, emoji: "📲", tabs: ["msg", "agenda", "pedidos", "care", "friends", "set"], name: L("Celular Plus", "Phone Plus", "Celular Plus"), about: L("Respostas rápidas, a agenda do dia e os pedidos a terceiros (escola, médico, família).", "Quick replies, the day's agenda and requests to third parties (school, doctor, family).", "Respuestas rápidas, la agenda del día y los pedidos a terceros (escuela, médico, familia).") },
    { id: "pro", price: 150, emoji: "🤳", tabs: ["msg", "agenda", "record", "pedidos", "care", "friends", "set"], name: L("Celular Pro", "Phone Pro", "Celular Pro"), about: L("Tudo do Plus e o prontuário: evolução, diagnóstico e encaminhamento de cada paciente.", "Everything in Plus and the records app: progress, diagnosis and referral for each patient.", "Todo lo del Plus y el prontuario: evolución, diagnóstico y derivación de cada paciente.") }
  ];
  const CASES_PH = [
    { id: "none", price: 0, color: "#3a3a48", emoji: "", name: L("Sem capinha", "No case", "Sin funda") },
    { id: "rosa", price: 15, color: "#e58aa8", emoji: "🌸", name: L("Capinha rosa", "Pink case", "Funda rosa") },
    { id: "azul", price: 15, color: "#5b8fd8", emoji: "🌊", name: L("Capinha azul", "Blue case", "Funda azul") },
    { id: "verde", price: 15, color: "#4f9a6a", emoji: "🍀", name: L("Capinha verde", "Green case", "Funda verde") },
    { id: "preta", price: 20, color: "#15131f", emoji: "🖤", name: L("Capinha preta", "Black case", "Funda negra") },
    { id: "estrelas", price: 25, color: "#6a4fbf", emoji: "✨", name: L("Capinha de estrelas", "Star case", "Funda de estrellas") },
    { id: "psi", price: 30, color: "#8790dd", emoji: "Ψ", name: L("Capinha Ψ", "Ψ case", "Funda Ψ") }
  ];
  const WALLS = ["#f4f2ee", "#e6f5ff", "#ffe9ef", "#e8f7e4", "#fff4d6"];
  const QUICK = [
    { id: "ok", text: L("Combinado, obrigada por avisar!", "Sounds good, thanks for letting me know!", "¡De acuerdo, gracias por avisar!") },
    { id: "ask", text: L("Pode me contar um pouco mais antes da consulta?", "Could you tell me a bit more before the session?", "¿Puedes contarme un poco más antes de la consulta?") }
  ];

  const st = () => {
    const p = (state.phone = state.phone || {});
    p.model = p.model || "basic"; p.case = p.case || "none"; p.wall = p.wall || WALLS[0];
    p.owned = p.owned || { basic: true, none: true };
    p.owned.basic = true; p.owned.none = true;
    p.replied = p.replied || {};
    return p;
  };
  const model = () => MODELS.find((m) => m.id === st().model) || MODELS[0];
  const hasTab = (tab) => model().tabs.includes(tab);
  const caseDef = () => CASES_PH.find((c) => c.id === st().case) || CASES_PH[0];

  let tab = "msg";
  const warnOf = (caseId, bare) => { const w = typeof Risk !== "undefined" && CASES[caseId] ? Risk.warnLabel(caseId) : ""; return w ? (bare ? w : `  ${w}`) : ""; };

  function paintFrame() {
    const frame = document.querySelector(".phone-frame");
    if (!frame) return;
    const c = caseDef();
    frame.style.setProperty("--case", c.color);
    frame.dataset.model = st().model;
    let sticker = frame.querySelector(".phone-sticker");
    if (!sticker) { sticker = el("span", "phone-sticker"); sticker.setAttribute("aria-hidden", "true"); frame.appendChild(sticker); }
    sticker.textContent = c.emoji;
    $("message-list").style.background = st().wall;
  }

  function renderTabs() {
    const box = $("phone-tabs");
    box.textContent = "";
    [["msg", "💬", "ph.tab.msg"], ["agenda", "📅", "ph.tab.agenda"], ["record", "📋", "ph.tab.record"], ["pedidos", "📎", "ph.tab.pedidos"], ["care", "🛋️", "ph.tab.care"], ["friends", "👥", "ph.tab.friends"], ["set", "⚙️", "ph.tab.set"]].forEach(([id, icon, key]) => {
      const open = hasTab(id);
      const b = el("button", "shop-tab" + (tab === id ? " active" : ""), `${icon} ${t(key)}${open ? "" : " 🔒"}`);
      b.type = "button";
      b.dataset.tab = id;
      b.addEventListener("click", () => {
        if (!open) { sfx("bad"); showToast(t("ph.locked", { name: pick(MODELS.find((m) => m.tabs.includes(id)).name) })); return; }
        tab = id; sfx("click"); renderPhone();
      });
      box.appendChild(b);
    });
  }

  // agenda do dia (Plus)
  function renderAgenda(list) {
    list.appendChild(el("h3", "uni-sem", `📅 ${weekDone() ? t("hud.weekend") : dayLabel(currentDayKey())} · ${t("fu.week", { w: state.week || 1, t: weekTotal() })}`));
    if (weekDone()) return;
    SCHEDULE[currentDayKey()].forEach((a, idx) => {
      const c = CASES[a.caseId];
      const done = Boolean(state.results[resultKey(currentDayKey(), idx)]);
      const row = el("div", "message-item chat-msg");
      const b = el("div", "chat-body");
      const head = el("div", "chat-head");
      head.appendChild(el("strong", null, `${a.time}  ${c.name}`));
      head.appendChild(el("span", "chat-time", done ? "✅" : idx === state.apptIndex ? "⏳" : ""));
      b.appendChild(head);
      b.appendChild(el("p", "chat-bubble", `${FU.sessType(a.sess || 1)}${warnOf(a.caseId)}`));
      row.appendChild(b);
      list.appendChild(row);
    });
  }

  // prontuário (Pro): evolução de cada paciente
  function renderRecord(list) {
    list.appendChild(el("h3", "uni-sem", `📋 ${t("ph.tab.record")}`));
    const ids = Object.keys(state.pat || {}).filter((id) => CASES[id] && state.pat[id].q.length);
    if (!ids.length) { list.appendChild(el("p", "shop-note", t("ph.record.empty"))); return; }
    ids.forEach((id) => {
      const c = CASES[id], r = state.pat[id];
      const row = el("div", "message-item chat-msg");
      const b = el("div", "chat-body");
      const head = el("div", "chat-head");
      head.appendChild(el("strong", null, c.name));
      head.appendChild(el("span", "chat-time", `${r.q.length}/${FU.SESSIONS}`));
      b.appendChild(head);
      const bar = el("div", "uni-bar"); bar.appendChild(el("i")); bar.firstChild.style.width = `${FU.evolution(id)}%`;
      b.appendChild(bar);
      const bits = [`${t("ph.record.evo")}: ${FU.evolution(id)}%`];
      if (r.dx !== null) bits.push(r.dx ? `✅ ${t("city.dx.right")}` : `❌ ${t("city.dx.wrong")}`);
      if (r.tx !== null) bits.push(r.tx ? "💊✅" : "💊❌");
      if (state.therapy && state.therapy[id]) bits.push(`🛋️ ${t("ph.record.therapy")}`);
      { const w = warnOf(id, true); if (w) bits.push(w); }
      b.appendChild(el("p", "shop-note", bits.join(" · ")));
      row.appendChild(b);
      list.appendChild(row);
    });
  }

  // acompanhamento: psicoterapia contínua e alta clínica
  // PEDIR A QUEM VÊ O QUE VOCÊ NÃO VÊ. Dentro da sala você só alcança o que a pessoa conta. A escola vê
  // a rotina, o médico vê o corpo, a família viu o começo, e quem atendeu antes tem o registro. Cada
  // pedido custa moedas e DIAS de espera — não tempo de sessão —, então vale planejar cedo.
  function renderPedidos(list) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("pedidos"), 400);
    const casos = Object.keys(state.dxbook || {}).filter((k) => typeof Dx !== "undefined" && Dx.kase(k));
    list.appendChild(el("p", "shop-note", t("ph.pedidos.sobre")));
    if (!casos.length) { list.appendChild(el("p", "dx-hint", t("ph.pedidos.vazio"))); return; }
    casos.forEach((k) => {
      const c = CASES[k]; if (!c) return;
      const feitos = Dx.pedidos(k);
      const uteis = Dx.FONTES.filter((f) => Dx.podePedir(k, f.id) || feitos[f.id]);
      if (!uteis.length) return;
      list.appendChild(el("h3", "aqx-h", `🧑‍⚕️ ${pick(c.name)}`));
      uteis.forEach((f) => {
        const p = feitos[f.id];
        const card = el("div", "ped-card" + (p && p.entregue ? " done" : ""));
        const cab = el("div", "ped-cab");
        cab.appendChild(el("b", "", `${f.emoji} ${pick(f.nome)}`));
        cab.appendChild(el("small", "", p ? "" : `🪙 ${f.custo} · ${f.dias} ${t("ph.pedidos.dias")}`));
        card.appendChild(cab);
        if (!p) {
          const area = Dx.areaDaFonte(k, f.id), d = Dx.dom(area);
          card.appendChild(el("small", "dx-hint", t("ph.pedidos.alcanca", { area: d ? pick(d.name) : "—" })));
          const bt = el("button", "pill-btn small", `📎 ${t("ph.pedidos.pedir")}`);
          bt.type = "button";
          bt.disabled = (state.coins || 0) < f.custo;
          bt.addEventListener("click", () => { if (Dx.pedir(k, f.id)) { sfx("unlock"); showToast(`📎 ${t("ph.pedidos.enviado", { dias: f.dias })}`); render(); } });
          card.appendChild(bt);
        } else if (!p.entregue) {
          const faltam = Math.max(0, p.chega - ((state.week || 1) - 1) * 5 - (state.dayIndex || 0));
          card.appendChild(el("small", "dx-hint", t("ph.pedidos.esperando", { dias: faltam })));
        } else {
          const d = Dx.dom(p.area);
          card.appendChild(el("small", "dx-hint ok", `✅ ${t("ph.pedidos.chegou", { area: d ? pick(d.name) : "" })}`));
        }
        list.appendChild(card);
      });
    });
  }

  function renderCare(list) {
    const v = Care.viewData();
    list.appendChild(el("h3", "uni-sem", v.title)); list.appendChild(el("p", "shop-note", v.intro));
    if (v.empty) list.appendChild(el("p", "shop-note", v.empty));
    v.rows.forEach((r) => {
      const row = el("div", "message-item chat-msg"), b = el("div", "chat-body"), h = el("div", "chat-head");
      h.appendChild(el("strong", null, r.name)); h.appendChild(el("span", "chat-time", `${r.progress}%`)); b.appendChild(h);
      const bar = el("div", "uni-bar"); bar.appendChild(el("i")); bar.firstChild.style.width = `${r.progress}%`; b.appendChild(bar);
      b.appendChild(el("p", "shop-note", r.info + (r.warn ? ` · ${r.warn}` : "")));
      if (r.can || r.early) { const bt = el("button", "pill-btn small", r.label); bt.type = "button"; bt.addEventListener("click", () => Care.act(r.id)); b.appendChild(bt); }
      row.appendChild(b); list.appendChild(row);
    });
    if (v.done.length) { list.appendChild(el("h3", "uni-sem", `🎓 ${I18N.pick(L("Altas", "Discharges", "Altas"))}`)); v.done.forEach((d) => list.appendChild(el("p", "shop-note", `${d.name} · ${d.kind}`))); }
  }

  // amigos: quem já virou amigo na cidade pode ser chamado para um café; a rede de apoio dá energia ao acordar
  const friendsList = () => (window.WORLD_DATA.npcs || []).filter((n) => ((state.social || {})[n.id] || { friend: 0 }).friend >= 1 && n.lines);
  const supportBonus = () => Math.min(3, Math.floor(friendsList().filter((n) => state.social[n.id].friend >= 3).length / 3));
  function renderFriends(list) {
    list.appendChild(el("h3", "uni-sem", `👥 ${t("ph.tab.friends")}`));
    const fl = friendsList();
    const close = fl.filter((n) => state.social[n.id].friend >= 3).length;
    list.appendChild(el("p", "shop-note", tr(`Rede de apoio: ${close} amigo(s) próximos → +${supportBonus()} de energia ao acordar. (A cada 3 amigos próximos, +1, até +3.)`, `Support network: ${close} close friend(s) → +${supportBonus()} energy on waking up. (Every 3 close friends give +1, up to +3.)`, `Red de apoyo: ${close} amigo(s) cercano(s) → +${supportBonus()} de energía al despertar. (Cada 3 amigos cercanos dan +1, hasta +3.)`)));
    if (!fl.length) { list.appendChild(el("p", "shop-note", tr("Converse com as pessoas da cidade para fazer amigos.", "Talk to people around town to make friends.", "Habla con la gente de la ciudad para hacer amigos."))); return; }
    fl.forEach((n) => {
      const soc = state.social[n.id];
      const row = el("div", "message-item chat-msg");
      const b = el("div", "chat-body");
      const head = el("div", "chat-head");
      head.appendChild(el("strong", null, n.name));
      head.appendChild(el("span", "chat-time", "❤️".repeat(Math.min(3, soc.friend)) + "🤍".repeat(Math.max(0, 3 - soc.friend))));
      b.appendChild(head);
      if (soc.friend >= 3) {
        const day = `${state.week || 1}:${state.dayIndex}`;
        const btn = el("button", "pill-btn small", soc.invited === day ? tr("Já se encontraram hoje", "Already met today", "Ya se encontraron hoy") : `☕ ${tr("Convidar para um café (3 moedas)", "Invite for a coffee (3 coins)", "Invitar a un café (3 monedas)")}`);
        btn.type = "button"; btn.disabled = soc.invited === day;
        btn.addEventListener("click", () => {
          if (state.coins < 3) { showToast(t("conv.poor")); sfx("bad"); return; }
          state.coins -= 3; soc.invited = day; soc.friend = Math.min(6, soc.friend + 1); state.energy = clamp(state.energy + 8, 0, 100); state.xp += 2;
          advanceClock(30); saveState(); updateHud(); sfx("good");
          showToast(`☕ ${n.name}: ${pick(n.friend)}`);
          renderPhone();
        });
        b.appendChild(btn);
      } else b.appendChild(el("p", "shop-note", tr("Converse mais em outros dias para virar amigo(a).", "Talk more on other days to become friends.", "Habla más en otros días para hacerse amigo(a).")));
      row.appendChild(b);
      list.appendChild(row);
    });
  }

  // ajustes: papel de parede e capinha
  function renderSettings(list) {
    const p = st();
    list.appendChild(el("h3", "uni-sem", `⚙️ ${t("ph.tab.set")}`));
    list.appendChild(el("p", "shop-note", `${model().emoji} ${pick(model().name)} — ${pick(model().about)}`));
    list.appendChild(el("p", "shop-note", t("ph.wall")));
    const row = el("div", "uni-row");
    WALLS.forEach((w) => {
      const b = el("button", "pill-btn small", p.wall === w ? "✓" : "");
      b.type = "button"; b.style.background = w; b.style.minWidth = "44px"; b.setAttribute("aria-label", w);
      b.addEventListener("click", () => { p.wall = w; saveState(); sfx("click"); renderPhone(); });
      row.appendChild(b);
    });
    list.appendChild(row);
    list.appendChild(el("p", "shop-note", t("ph.case")));
    const row2 = el("div", "uni-row");
    CASES_PH.filter((c) => p.owned[c.id]).forEach((c) => {
      const b = el("button", "pill-btn small", `${c.emoji || "▫️"} ${p.case === c.id ? "✓" : ""}`);
      b.type = "button"; b.style.borderColor = c.color; b.setAttribute("aria-label", pick(c.name));
      b.addEventListener("click", () => { p.case = c.id; saveState(); sfx("click"); renderPhone(); });
      row2.appendChild(b);
    });
    list.appendChild(row2);
    list.appendChild(el("p", "shop-note muted", t("ph.shophint")));
  }

  // resposta rápida às mensagens do dia (Plus em diante)
  function replyRow(key, caseId, body) {
    const p = st();
    if (!hasTab("agenda")) return;
    const c = CASES[caseId];
    if (p.replied[key]) { body.appendChild(el("p", "chat-bubble mine", pick(QUICK.find((q) => q.id === p.replied[key]).text))); return; }
    const row = el("div", "uni-row");
    QUICK.forEach((q) => {
      const b = el("button", "pill-btn small", pick(q.text));
      b.type = "button";
      b.addEventListener("click", () => {
        p.replied[key] = q.id; state.xp += 1; saveState(); sfx("good"); updateHud();
        showToast(t("ph.replied", { name: c.name }));
        renderPhone();
      });
      row.appendChild(b);
    });
    body.appendChild(row);
  }

  // ------------------------------------------------------------ loja de eletrônicos
  function openStore() {
    const p = st();
    const body = $("hosp-body");
    body.textContent = "";
    $("hosp-title").textContent = `📱 ${t("electro.title")}`;
    const status = el("p", "uni-q", t("electro.intro"));
    body.appendChild(status);
    const buy = (item, kind) => {
      if (p.owned[item.id]) return;
      if (state.coins < item.price) { status.textContent = t("conv.poor"); sfx("bad"); return; }
      state.coins -= item.price; p.owned[item.id] = true;
      if (kind === "model") p.model = item.id; else p.case = item.id;
      saveState(); updateHud(); sfx("buy");
      status.textContent = t("electro.bought", { name: pick(item.name) });
      openStore();
    };
    body.appendChild(el("h3", "uni-sem", `📱 ${t("electro.phones")}`));
    const box = el("div", "uni-opts");
    MODELS.forEach((m) => {
      const own = p.owned[m.id];
      const b = el("button", "choice-btn", `${m.emoji} ${pick(m.name)} — ${own ? (p.model === m.id ? "✓" : t("shop.use")) : `🪙${m.price}`}\n${pick(m.about)}`);
      b.type = "button";
      b.addEventListener("click", () => { if (own) { p.model = m.id; saveState(); sfx("click"); openStore(); } else buy(m, "model"); });
      box.appendChild(b);
    });
    body.appendChild(box);
    body.appendChild(el("h3", "uni-sem", `🛡️ ${t("electro.cases")}`));
    const box2 = el("div", "uni-opts");
    CASES_PH.forEach((c) => {
      const own = p.owned[c.id];
      const b = el("button", "choice-btn", `${c.emoji || "▫️"} ${pick(c.name)} — ${own ? (p.case === c.id ? "✓" : t("shop.use")) : `🪙${c.price}`}`);
      b.type = "button"; b.style.borderColor = c.color;
      b.addEventListener("click", () => { if (own) { p.case = c.id; saveState(); sfx("click"); openStore(); } else buy(c, "case"); });
      box2.appendChild(b);
    });
    body.appendChild(box2);
    openModal("hosp-modal");
  }

  // ------------------------------------------------------------ dados e ações para o componente Svelte (Celular.svelte)
  const notify = () => { try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* nada */ } };
  function viewData() {
    const p = st(), c = caseDef();
    const tabs = [["msg", "💬", "ph.tab.msg"], ["agenda", "📅", "ph.tab.agenda"], ["record", "📋", "ph.tab.record"], ["care", "🛋️", "ph.tab.care"], ["friends", "👥", "ph.tab.friends"], ["set", "⚙️", "ph.tab.set"]]
      .map(([id, icon, key]) => { const open = hasTab(id); return { id, open, active: tab === id, label: `${icon} ${t(key)}${open ? "" : " 🔒"}` }; });
    if (!hasTab(tab)) tab = "msg";
    const day = currentDayKey();
    const agenda = { title: `📅 ${weekDone() ? t("hud.weekend") : dayLabel(day)} · ${t("fu.week", { w: state.week || 1, t: weekTotal() })}`, rows: weekDone() ? [] : SCHEDULE[day].map((a, idx) => ({ head: `${a.time}  ${CASES[a.caseId].name}`, mark: state.results[resultKey(day, idx)] ? "✅" : idx === state.apptIndex ? "⏳" : "", sub: `${FU.sessType(a.sess || 1)}${warnOf(a.caseId)}` })) };
    const ids = Object.keys(state.pat || {}).filter((id) => CASES[id] && state.pat[id].q.length);
    const care = typeof Care !== "undefined" ? Care.viewData() : null;
    const record = { title: `📋 ${t("ph.tab.record")}`, empty: ids.length ? "" : t("ph.record.empty"), rows: ids.map((id) => { const r = state.pat[id], bits = [`${t("ph.record.evo")}: ${FU.evolution(id)}%`]; if (r.dx !== null) bits.push(r.dx ? `✅ ${t("city.dx.right")}` : `❌ ${t("city.dx.wrong")}`); if (r.tx !== null) bits.push(r.tx ? "💊✅" : "💊❌"); if (state.therapy && state.therapy[id]) bits.push(`🛋️ ${t("ph.record.therapy")}`); { const w = warnOf(id, true); if (w) bits.push(w); } return { name: CASES[id].name, count: `${r.q.length}/${FU.SESSIONS}`, pct: FU.evolution(id), info: bits.join(" · ") }; }) };
    const fl = friendsList(), close = fl.filter((n) => state.social[n.id].friend >= 3).length, today = `${state.week || 1}:${state.dayIndex}`;
    const friends = { title: `👥 ${t("ph.tab.friends")}`, net: tr(`Rede de apoio: ${close} amigo(s) próximos → +${supportBonus()} de energia ao acordar. (A cada 3 amigos próximos, +1, até +3.)`, `Support network: ${close} close friend(s) → +${supportBonus()} energy on waking up. (Every 3 close friends, +1, up to +3.)`, `Red de apoyo: ${close} amigo(s) cercanos → +${supportBonus()} de energía al despertar. (Cada 3 amigos cercanos, +1, hasta +3.)`), empty: fl.length ? "" : tr("Converse com as pessoas da cidade para fazer amigos.", "Talk to people around town to make friends.", "Habla con la gente de la ciudad para hacer amigos."),
      rows: fl.map((n) => { const soc = state.social[n.id]; return { id: n.id, name: n.name, hearts: "❤️".repeat(Math.min(3, soc.friend)) + "🤍".repeat(Math.max(0, 3 - soc.friend)), close: soc.friend >= 3, met: soc.invited === today, inviteLabel: soc.invited === today ? tr("Já se encontraram hoje", "Already met today", "Ya se encontraron hoy") : `☕ ${tr("Convidar para um café (3 moedas)", "Invite for a coffee (3 coins)", "Invitar a un café (3 monedas)")}`, hint: tr("Converse mais em outros dias para virar amigo(a).", "Talk more on other days to become friends.", "Habla más en otros días para hacerse amigo(a).") }; }) };
    const settings = { title: `⚙️ ${t("ph.tab.set")}`, model: `${model().emoji} ${pick(model().name)} — ${pick(model().about)}`, wallLabel: t("ph.wall"), caseLabel: t("ph.case"), hint: t("ph.shophint"), walls: WALLS.map((w) => ({ w, on: p.wall === w })), cases: CASES_PH.filter((x) => p.owned[x.id]).map((x) => ({ id: x.id, emoji: x.emoji || "▫️", color: x.color, name: pick(x.name), on: p.case === x.id })) };
    return { title: t("phone.title"), clock: fmtClock(state.clock), tab, tabs, frame: { color: c.color, model: p.model, sticker: c.emoji, wall: p.wall }, agenda, record, friends, settings, care };
  }
  const phoneActions = {
    setTab(id) { if (!hasTab(id)) { sfx("bad"); showToast(t("ph.locked", { name: pick(MODELS.find((m) => m.tabs.includes(id)).name) })); return; } tab = id; sfx("click"); notify(); },
    setWall(w) { st().wall = w; saveState(); sfx("click"); },
    setCase(id) { st().case = id; saveState(); sfx("click"); },
    invite(id) {
      const soc = state.social[id], day = `${state.week || 1}:${state.dayIndex}`, n = window.WORLD_DATA.npcs.find((x) => x.id === id);
      if (state.coins < 3) { showToast(t("conv.poor")); sfx("bad"); return; }
      state.coins -= 3; soc.invited = day; soc.friend = Math.min(6, soc.friend + 1); state.energy = clamp(state.energy + 8, 0, 100); state.xp += 2;
      advanceClock(30); saveState(); updateHud(); sfx("good"); showToast(`☕ ${n.name}: ${pick(n.friend)}`);
    },
    reply(key, caseId, qid) { const p = st(); p.replied[key] = qid; state.xp += 1; saveState(); sfx("good"); updateHud(); showToast(t("ph.replied", { name: CASES[caseId].name })); }
  };
  const quickList = () => QUICK.map((q) => ({ id: q.id, text: pick(q.text) }));
  const repliedText = (id) => pick(QUICK.find((q) => q.id === id).text);

  function render(list) {
    st();
    if (!hasTab(tab)) tab = "msg";
    paintFrame();
    renderTabs();
    return tab;
  }

  return { renderCare, renderPedidos, viewData, phoneActions, quickList, repliedText, supportBonus, renderFriends, MODELS, CASES_PH, WALLS, st, hasTab, model, render, renderAgenda, renderRecord, renderSettings, replyRow, openStore, reset() { tab = "msg"; } };
})();

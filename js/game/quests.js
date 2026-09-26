"use strict";

// ===========================================================================
// Menu de Missões: tudo o que há para fazer, com o próximo passo de cada personagem raro.
//  · Hoje: tarefas do dia (consultas, aquário, pesca, conversar).
//  · Raros: guardiões, moradores do fundo do mar e capitães. Cada um tem etapas (encontrar, ganhar confiança, decifrar, convencer)
//    e uma pista de onde e quando achá-lo.
//  · Pacientes: a trilha de cada paciente (consultas, áreas investigadas, diagnóstico).
//  · Coleções: aquário, fauna, lugares e conquistas.
// Só lê o estado do jogo: não guarda nada próprio.
// ===========================================================================
const Quests = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const world = () => window.WORLD_DATA;
  const locOf = (id) => world().locations.find((l) => l.id === id);
  const locName = (id) => { const l = locOf(id); return l ? `${l.emoji || ""} ${pick(l.name)}`.trim() : id; };
  const soc = (id) => (state.social || {})["w:" + id] || (state.social || {})[id] || { talks: 0, friend: 0 };
  const def = (id) => (typeof Life !== "undefined" && Life.guardianDef(id)) || Town.cdef(id) || null;
  const hoursTxt = (h) => (h ? ` (${h[0]}–${h[1]})` : "");

  // onde e quando encontrar cada personagem raro
  function whereIs(id) {
    const c = (world().citizens || []).find((x) => x.id === id && x.special);
    if (c) return `${locName(c.place)} ${tr("(dia, das 10h às 18h)", "(daytime, 10am–6pm)", "(de día, de 10 a 18 h)")}`;
    for (const l of world().locations) { const n = (l.npcs || []).find((x) => x.id === id); if (n) return `${locName(l.id)}${hoursTxt(n.hours || l.hours)}`; }
    return "?";
  }

  const RARE = [
    { group: "guardioes", ids: ["papai_noel", "coelho", "abobora", "jack_frost", "fada_dente", "sandman"] },
    { group: "mar", ids: ["perola", "coralino", "tata", "bussola", "nevoa", "seu_tiao"] },
    { group: "cidade", ids: ["dra_lin", "dona_celia", "prof_lucia", "nebulosa", "dona_iara", "ze", "nico", "vo_rosa", "mestre_zen", "ana", "dra_vera", "silvia"] }
  ];
  const GROUP_NAME = { guardioes: L("🎄 Os Guardiões", "🎄 The Guardians", "🎄 Los Guardianes"), cidade: L("🏙️ Gente dos lugares novos", "🏙️ People of the new places", "🏙️ Gente de los lugares nuevos"), mar: L("🌊 Gente do mar", "🌊 Sea folk", "🌊 Gente del mar") };

  function stages(id) {
    const d = def(id), s = soc(id), out = [];
    if (!d) return out;
    const need = Town.need ? Math.max(2, Town.need(d)) : 2;
    out.push({ t: tr("Encontrar e conversar", "Find and talk", "Encontrar y conversar"), done: s.talks >= 1, hint: `${tr("Onde", "Where", "Dónde")}: ${whereIs(id)}` });
    out.push({ t: tr(`Ganhar confiança (amizade ${need}, em dias diferentes)`, `Build trust (friendship ${need}, on different days)`, `Ganar confianza (amistad ${need}, en días distintos)`), done: s.friend >= need, prog: `${Math.min(s.friend, need)}/${need}`, hint: tr("Volte e converse de novo em outro dia.", "Come back and talk again on another day.", "Vuelve y conversa de nuevo otro día.") });
    if (d.dx) out.push({ t: tr("Decifrar o diagnóstico (+15 XP, +20 moedas)", "Work out the diagnosis (+15 XP, +20 coins)", "Descifrar el diagnóstico (+15 XP, +20 monedas)"), done: Life.solved(id), hint: tr("Depois da amizade, use o botão 🩺 na conversa. Uma tentativa por dia.", "After friendship, use the 🩺 button in the chat. One try a day.", "Tras la amistad, usa el botón 🩺 en la charla. Un intento al día.") });
    if (d.likes) out.push({ t: tr("Convencer a fazer terapia", "Convince them to try therapy", "Convencerlo de hacer terapia"), done: Boolean(Town.st().convinced[id]), hint: tr(`Use a abordagem que combina com a pessoa (dica: ${pick(d.doubt || L("", "", ""))})`, `Use the approach that suits them (hint: ${pick(d.doubt || L("", "", ""))})`, `Usa el enfoque que le sirve (pista: ${pick(d.doubt || L("", "", ""))})`) });
    return out;
  }

  const bar = (n, m) => { const w = el("div", "aqx-bar qx-bar"); w.appendChild(el("span", "aqx-bar-l", "")); const b = el("div", "aqx-bar-b"), f = el("div", "aqx-bar-f"); f.style.width = `${m ? Math.min(1, n / m) * 100 : 0}%`; b.appendChild(f); w.appendChild(b); w.appendChild(el("span", "aqx-bar-n", `${n}/${m}`)); return w; };
  const check = (done) => (done ? "✅" : "⬜");

  function card(id) {
    const d = def(id); if (!d) return null;
    const st = stages(id), done = st.filter((x) => x.done).length, next = st.find((x) => !x.done);
    const c = el("div", "qx-card" + (done === st.length ? " done" : ""));
    const head = el("div", "qx-head"); head.appendChild(el("b", "", `${d.emoji || ""} ${d.name}`.trim())); head.appendChild(el("small", "", `${done}/${st.length}`)); c.appendChild(head);
    st.forEach((x) => c.appendChild(el("div", "qx-st" + (x.done ? " ok" : ""), `${check(x.done)} ${x.t}${x.prog && !x.done ? ` · ${x.prog}` : ""}`)));
    if (next) c.appendChild(el("div", "qx-hint", `💡 ${next.hint}`)); else c.appendChild(el("div", "qx-hint", tr("🎉 Missão completa!", "🎉 Quest complete!", "🎉 ¡Misión completa!")));
    return c;
  }

  // ---------------------------------------------------------- abas
  let tab = "hoje";
  // "Raros" e "Figuras" eram duas abas dizendo a mesma coisa — gente especial que se acha pelo mapa — e
  // se contradiziam: os Guardiões (Papai Noel, Fada do Dente…) são figuras de feriado e estavam só em
  // "Raros", enquanto Santos Dumont e Darwin estavam só em "Figuras". Virou uma aba só, **Figuras**, com
  // uma divisão por grupo dentro dela (escolha do Matheus: ele prefere "figuras").
  const TABS = [["hoje", "☀️", L("Hoje", "Today", "Hoy")], ["cidade", "🗺️", L("Na cidade", "In town", "En la ciudad")], ["pacientes", "🧑‍⚕️", L("Pacientes", "Patients", "Pacientes")], ["figuras", "🎭", L("Figuras", "Figures", "Figuras")], ["carreira", "🏛️", L("Carreira", "Career", "Carrera")], ["colecoes", "📚", L("Coleções", "Collections", "Colecciones")]];

  function today(box) {
    const day = SCHEDULE[currentDayKey()] || [], left = weekDone() ? 0 : Math.max(0, day.length - state.apptIndex);
    const hasAq = typeof Aquarium !== "undefined" && Aquarium.hasTank();
    const talked = Object.values(state.social || {}).some((s) => s && s.lastDay === state.dayIndex);
    const rows = [
      [tr("Atender as consultas de hoje", "Attend today's sessions", "Atender las consultas de hoy"), left === 0, `${day.length - left}/${day.length}`],
      [tr("Conversar com alguém na cidade", "Talk to someone in town", "Hablar con alguien en la ciudad"), talked, ""]
    ];
    // a etapa da história que está valendo agora fica sempre à vista, não só na aba Na cidade
    if (typeof Missoes !== "undefined") {
      const e = Missoes.etapaAtual(), l = Missoes.lista();
      if (e) rows.push([`📖 ${pick(e.nome)}`, false, `${l.etapa}/${l.total}`]);
    }
    if (hasAq) {
      const a = Aquarium.st(), s = Aquarium.stats();
      rows.push([tr("Alimentar o aquário", "Feed the aquarium", "Alimentar el acuario"), a.fed === `${state.week || 1}:${state.dayIndex}`, ""]);
      rows.push([tr("Pescar 3 vezes (cais da praia ou fenda)", "Fish 3 times (beach pier or rift)", "Pescar 3 veces (muelle o grieta)"), Aquarium.castsLeft() === 0, `${3 - Aquarium.castsLeft()}/3`]);
      rows.push([tr(`Manter a saúde do aquário acima de 75% (agora ${s.health}%)`, `Keep the aquarium health above 75% (now ${s.health}%)`, `Mantener la salud del acuario sobre 75% (ahora ${s.health}%)`), s.health >= 75, ""]);
    }
    if (typeof Tips !== "undefined") { const sg = Tips.suggestions(); if (sg.length) { box.appendChild(el("h3", "aqx-h", `🎯 ${tr("Próximos passos sugeridos", "Suggested next steps", "Próximos pasos sugeridos")}`)); sg.forEach((x) => box.appendChild(el("div", "qx-st big", `${x.icon} ${x.text}`))); } }
    box.appendChild(el("p", "uni-q", tr("Tarefas do dia. Nada é obrigatório, mas tudo ajuda.", "Today's tasks. None is required, but all of it helps.", "Tareas del día. Nada es obligatorio, pero todo ayuda.")));
    rows.forEach(([t, ok, prog]) => box.appendChild(el("div", "qx-st big" + (ok ? " ok" : ""), `${check(ok)} ${t}${prog ? ` · ${prog}` : ""}`)));
    if (weekDone()) box.appendChild(el("p", "shop-note", tr("A semana terminou: veja o resultado no Planner.", "The week is over: see the result in the Planner.", "La semana terminó: mira el resultado en el Planner.")));
  }

  function patients(box) {
    box.appendChild(el("p", "uni-q", tr("A trilha de cada paciente: 4 consultas, áreas investigadas e diagnóstico.", "Each patient's path: 4 sessions, areas explored and diagnosis.", "La ruta de cada paciente: 4 sesiones, áreas exploradas y diagnóstico.")));
    Object.keys(CASES).filter((id) => id.indexOf("cit:") !== 0 && CASES[id].steps && (!CASES[id].gen || ((state.pat || {})[id] || { q: [] }).q.length)).forEach((id) => {
      const c = CASES[id], r = (state.pat || {})[id] || { q: [], dx: null }, n = r.q.length;
      const found = window.Dx ? Dx.foundList(id).length : 0, tot = (window.Dx && Dx.data().domains.length) || 12;
      const row = el("div", "qx-card" + (r.dx !== null && r.dx !== undefined ? " done" : ""));
      const head = el("div", "qx-head"); head.appendChild(el("b", "", pick(c.name))); head.appendChild(el("small", "", n ? `${n}/4` : tr("não atendido", "not seen", "sin atender"))); row.appendChild(head);
      if (n) {
        row.appendChild(el("div", "qx-st" + (found >= 3 ? " ok" : ""), `${check(found >= 3)} ${tr("Áreas investigadas", "Areas explored", "Áreas exploradas")} · ${found}/${tot}`));
        row.appendChild(el("div", "qx-st" + (r.dx ? " ok" : ""), `${check(r.dx === true)} ${tr("Diagnóstico", "Diagnosis", "Diagnóstico")}${r.dx === false ? " ✗" : r.dx === null || r.dx === undefined ? " · —" : ""}`));
      } else row.appendChild(el("div", "qx-hint", tr("Ainda vai chegar na agenda.", "Not on the schedule yet.", "Aún no llegó a la agenda.")));
      box.appendChild(row);
    });
  }


  // ---------------------------------------------------------- figuras (feriados e história): vão abrindo conforme a pessoa encontra as anteriores
  const FTABS = [["feriados", "🎉", L("Feriados", "Holidays", "Feriados")], ["brasil", "🇧🇷", L("Brasil", "Brazil", "Brasil")], ["mundo", "🌍", L("Mundo", "World", "Mundo")], ["ciencia", "🔬", L("Psicologia e ciência", "Psychology and science", "Psicología y ciencia")],
                 ["guardioes", "🎄", L("Guardiões", "Guardians", "Guardianes")], ["mar", "🌊", L("Gente do mar", "Sea folk", "Gente del mar")], ["cidade", "🏙️", L("Gente dos lugares", "People of the places", "Gente de los lugares")]];
  const GRUPO_RARO = { guardioes: "guardioes", mar: "mar", cidade: "cidade" };   // sub-abas que vêm do antigo "Raros" e têm etapas
  let ftab = "feriados";
  const unlockAll = () => Boolean(settings.dev && settings.unlockAll);
  const figs = () => world().figures || { tabs: {}, info: {} };
  const found = (id) => Boolean((state.figures || {})[id]) || soc(id).talks >= 1;
  const foundCount = (tab) => (figs().tabs[tab] || []).filter(found).length;
  // primeira conversa com uma figura: registra e dá o prêmio (chamado pela cidade)
  function meet(id) {
    const info = figs().info[id]; if (!info) return;
    state.figures = state.figures || {};
    if (state.figures[id]) return;
    state.figures[id] = { week: state.week || 1 };
    state.xp += 10; state.coins += 10;
    const d = def(id);
    showToast(`📜 ${tr("Nova figura", "New figure", "Nueva figura")}: ${d ? d.name : id} · ⭐ +10 · 🪙 +10`);
  }
  const visibleCount = (tab) => (unlockAll() ? 99 : 2 + foundCount(tab) * 2);
  const idsDoGrupo = (tab) => { const g = RARE.find((r) => r.group === GRUPO_RARO[tab]); return g ? g.ids : []; };
  const prontosNoGrupo = (tab) => idsDoGrupo(tab).filter((id) => stages(id).every((x) => x.done)).length;

  function figures(box) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("figuras"), 500);     box.appendChild(el("p", "uni-q", tr("Pessoas que marcaram a história e as festas. Cada uma mora em algum lugar do mapa: leia a pista, vá até lá e converse. Achou uma, abre pistas de outras.", "People who marked history and holidays. Each one lives somewhere on the map: read the clue, go there and talk. Find one and more clues open.", "Personas que marcaron la historia y las fiestas. Cada una vive en algún lugar del mapa: lee la pista, ve y conversa. Al hallar una, se abren más pistas.")));
    const sub = el("div", "shop-tabs");
    FTABS.forEach(([id, ic, name]) => {
      const n = GRUPO_RARO[id] ? `${prontosNoGrupo(id)}/${idsDoGrupo(id).length}` : `${foundCount(id)}/${(figs().tabs[id] || []).length}`;
      const b = el("button", "shop-tab" + (id === ftab ? " active" : ""), `${ic} ${pick(name)} ${n}`);
      b.type = "button"; b.addEventListener("click", () => { ftab = id; open(); }); sub.appendChild(b);
    });
    box.appendChild(sub);
    // os grupos que vieram do antigo "Raros" mostram as ETAPAS de cada um (encontrar, ganhar confiança,
    // decifrar, convencer), que é o que eles sempre tiveram e as figuras de história não têm
    if (GRUPO_RARO[ftab]) {
      box.appendChild(el("p", "uni-q", tr("Cada um tem um jeito de ser encontrado, entendido e ajudado.", "Each one has a way to be found, understood and helped.", "Cada uno tiene una forma de ser encontrado, entendido y ayudado.")));
      idsDoGrupo(ftab).forEach((id) => { const c = card(id); if (c) box.appendChild(c); });
      if (settings.dev) { const b = el("button", "pill-btn", settings.unlockAll ? "🛠 Esconder de novo" : "🛠 Liberar todas as missões"); b.type = "button"; b.addEventListener("click", () => { settings.unlockAll = !settings.unlockAll; saveSettings(); open(); }); box.appendChild(b); }
      return;
    }
    const list = figs().tabs[ftab] || [], vis = visibleCount(ftab);
    list.forEach((id, i) => {
      if (i >= vis) return;
      const info = figs().info[id] || {}, ok = found(id), d = def(id);
      const c = el("div", "qx-card" + (ok ? " done" : ""));
      const head = el("div", "qx-head"); head.appendChild(el("b", "", ok ? `${d ? d.name : id}` : "❔ ???")); head.appendChild(el("small", "", pick(info.era || "")));
      c.appendChild(head);
      if (ok) { c.appendChild(el("div", "qx-st ok", `✅ ${tr("Encontrada em", "Found at", "Encontrada en")} ${locName(info.place)}`)); const f = d && d.lines && d.lines[0]; if (f) c.appendChild(el("div", "qx-hint", `📖 ${pick(f)}`)); }
      else c.appendChild(el("div", "qx-hint", `💡 ${pick(info.clue || "")}`));
      box.appendChild(c);
    });
    if (vis < list.length) box.appendChild(el("p", "shop-note", `🔒 ${list.length - vis} ${tr("figura(s) ainda escondida(s). Encontre as de cima para abrir novas pistas.", "figure(s) still hidden. Find the ones above to open new clues.", "figura(s) aún oculta(s). Encuentra las de arriba para abrir nuevas pistas.")}`));
    if (settings.dev) { const b = el("button", "pill-btn", settings.unlockAll ? "🛠 Esconder de novo" : "🛠 Liberar todas as missões"); b.type = "button"; b.addEventListener("click", () => { settings.unlockAll = !settings.unlockAll; saveSettings(); open(); }); box.appendChild(b); }
  }

  // ---------------------------------------------------------- carreira: o que as reputações desbloqueiam, equipe e ações
  function career(box) {
    const v = Career.viewData();
    box.appendChild(el("p", "uni-q", tr("As reputações abrem a estrutura da clínica e a vida acadêmica. Ganhe Reputação da Clínica com altas, devolutivas e boa conduta; Acadêmica com laudos bons, artigos e congressos.", "Reputations open the clinic's structure and academic life. Earn Clinic Reputation with discharges, feedback sessions and good conduct; Academic with good reports, articles and conferences.", "Las reputaciones abren la estructura de la clínica y la vida académica. Gana Reputación de la Clínica con altas, devolutivas y buena conducta; Académica con buenos informes, artículos y congresos.")));
    const block = (title, rep, list, key) => {
      box.appendChild(el("h3", "aqx-h", `${title} · ${rep}`));
      list.forEach((u) => {
        const c = el("div", "qx-card" + (u.open ? " done" : "")), h = el("div", "qx-head"); h.appendChild(el("b", "", `${u.icon} ${u.name}`)); h.appendChild(el("small", "", u.open ? "🔓" : `🔒 ${rep >= u.at ? "" : `${rep}/${u.at}`}`)); c.appendChild(h);
        c.appendChild(el("div", "qx-hint", u.fx));
        if (!u.open) c.appendChild(bar(rep, u.at));
        const row = el("div", "uni-row");
        if (u.open && u.hire && !u.hire.done) { const b = el("button", "pill-btn small", `${tr("Contratar", "Hire", "Contratar")} (🪙${u.hire.cost})`); b.type = "button"; b.addEventListener("click", () => { Career.hire(u.id); open(); }); row.appendChild(b); }
        if (u.open && u.hire && u.hire.done) row.appendChild(el("small", "", `✅ ${tr("na equipe", "on the team", "en el equipo")}`));
        if (u.open && u.id === "aula") { const b = el("button", "pill-btn small", v.aulaHoje ? tr("Já deu aula hoje", "Already taught today", "Ya diste clase hoy") : `👩‍🏫 ${tr("Ministrar aula", "Teach a class", "Dar clase")}`); b.type = "button"; b.disabled = v.aulaHoje; b.addEventListener("click", () => Career.teach(() => open())); row.appendChild(b); }
        if (u.open && u.id === "artigo") { const b = el("button", "pill-btn small", `📄 ${tr("Escrever artigo", "Write an article", "Escribir un artículo")} (${v.disponiveis} ${tr("laudos", "reports", "informes")})`); b.type = "button"; b.addEventListener("click", () => Career.article(() => open())); row.appendChild(b); }
        if (u.open && u.id === "congresso") { const b = el("button", "pill-btn small", v.congressoEm ? `${tr("Próximo em", "Next in", "Próximo en")} ${v.congressoEm} ${tr("sem.", "wk", "sem.")}` : `🎤 ${tr("Ir ao congresso (🪙60)", "Go to the conference (🪙60)", "Ir al congreso (🪙60)")}`); b.type = "button"; b.disabled = Boolean(v.congressoEm); b.addEventListener("click", () => Career.conference(() => open())); row.appendChild(b); }
        if (u.open && u.id === "livro") { const b = el("button", "pill-btn small", v.livro ? tr("Livro publicado", "Book published", "Libro publicado") : `📚 ${tr("Publicar livro", "Publish a book", "Publicar libro")}`); b.type = "button"; b.disabled = v.livro; b.addEventListener("click", () => { Career.book(); open(); }); row.appendChild(b); }
        if (row.childNodes.length) c.appendChild(row);
        box.appendChild(c);
      });
    };
    block(`🏥 ${tr("Reputação da Clínica", "Clinic Reputation", "Reputación de la Clínica")}`, v.repClinic, v.clinic);
    block(`🎓 ${tr("Reputação Acadêmica", "Academic Reputation", "Reputación Académica")}`, v.repAcad, v.acad);
    if (v.bonus.length) box.appendChild(el("p", "shop-note", `✨ ${tr("Bônus ativos", "Active bonuses", "Bonos activos")}: ${v.bonus.map((b) => `+${b.n} ${b.id} (${tr("até a semana", "until week", "hasta la semana")} ${b.ate})`).join(" · ")}`));
  }

  function collections(box) {
    const a = typeof Aquarium !== "undefined" ? Aquarium : null, fauna = window.Fauna ? Object.keys(Fauna.seen()).length : 0, faunaTot = window.Fauna ? Fauna.species().length : 0;
    const visited = Object.keys((state.city && state.city.visited) || {}).length, places = world().locations.length;
    const ach = Life.ACH.filter((x) => state.ach && state.ach[x.id]).length;
    const list = [
      ["🐠", tr("Criaturas do aquário", "Aquarium creatures", "Criaturas del acuario"), a ? a.owned().length : 0, a ? a.SPECIES.length : 0],
      ["🦋", tr("Bichinhos da natureza vistos", "Wildlife seen", "Animalitos vistos"), fauna, faunaTot],
      ["🗺️", tr("Lugares descobertos", "Places discovered", "Lugares descubiertos"), visited, places],
      ["🏆", tr("Conquistas", "Achievements", "Logros"), ach, Life.ACH.length],
      ...(typeof Risk !== "undefined" && Risk.enabled() ? [["⚠️", tr("Advertências éticas", "Ethical warnings", "Advertencias éticas"), (state.advertencias || []).length, 0]] : []),
      ["🦁", tr("Zoológico (selos de bioma)", "Zoo (biome seals)", "Zoológico (sellos de bioma)"), typeof Zoo !== "undefined" ? Zoo.sealCount() : 0, 7],
      ["🎓", tr("Reputação Acadêmica", "Academic Reputation", "Reputación Académica"), Wheel.rep().academica, 0],
      ["🏥", tr("Reputação da Clínica", "Clinic Reputation", "Reputación de la Clínica"), Wheel.rep().clinica, 0],
      ["🧠", tr("Manual: transtornos abertos", "Manual: disorders opened", "Manual: trastornos abiertos"), Object.keys(state.manualOpen || {}).length, 0]
    ];
    list.forEach(([ic, t, n, m]) => { const row = el("div", "qx-card"); row.appendChild(el("div", "qx-head", "")); row.firstChild.appendChild(el("b", "", `${ic} ${t}`)); if (m) row.appendChild(bar(n, m)); else row.firstChild.appendChild(el("small", "", String(n))); box.appendChild(row); });
  }

  // Missões de fora da clínica: a principal em etapas (uma por vez, para não despejar tudo) e as
  // secundárias, soltas. O progresso mora em js/game/missoes.js.
  function cidade(box) {
    if (typeof Missoes === "undefined") return;
    Missoes.conferir();
    const { principal, secundarias, etapa, total } = Missoes.lista();
    const cartao = (x) => {
      const feita = x.estado === "feita";
      const c = el("div", "qx-card" + (feita ? " done" : ""));
      c.appendChild(el("b", null, `${feita ? "✅" : x.principal ? "📖" : "•"} ${pick(x.m.nome)}`));
      c.appendChild(el("p", null, pick(x.m.texto)));
      const p = x.m.premio || {};
      const partes = [];
      if (p.moedas) partes.push(`🪙 ${p.moedas}`);
      if (p.xp) partes.push(`⭐ ${p.xp}`);
      if (p.eixo && typeof Wheel !== "undefined") { const a = Wheel.AXES.find((y) => y.id === p.eixo); if (a) partes.push(`${a.icon} +2`); }
      c.appendChild(el("small", "qx-hint", `${feita ? tr("Recebido", "Received", "Recibido") : tr("Prêmio", "Reward", "Premio")}: ${partes.join(" · ")}`));
      return c;
    };
    box.appendChild(el("h3", "qx-h", `📖 ${tr("A sua história na cidade", "Your story in town", "Tu historia en la ciudad")} · ${Math.min(etapa, total)}/${total}`));
    const agora = principal.find((x) => x.estado === "agora");
    principal.filter((x) => x.estado === "feita").forEach((x) => box.appendChild(cartao(x)));
    if (agora) box.appendChild(cartao(agora));
    else box.appendChild(el("p", "qx-hint", tr("Você fez tudo o que a cidade tinha para te mostrar. O resto é morar nela.", "You have done everything the city had to show you. The rest is living in it.", "Hiciste todo lo que la ciudad tenía para mostrarte. El resto es vivir en ella.")));
    box.appendChild(el("h3", "qx-h", `🧭 ${tr("Coisas para fazer", "Things to do", "Cosas para hacer")} · ${secundarias.filter((x) => x.estado === "feita").length}/${secundarias.length}`));
    secundarias.filter((x) => x.estado !== "feita").forEach((x) => box.appendChild(cartao(x)));
    secundarias.filter((x) => x.estado === "feita").forEach((x) => box.appendChild(cartao(x)));
  }

  function open() {
    const body = $("quests-body"); body.textContent = "";
    const tabs = el("div", "shop-tabs");
    TABS.forEach(([id, icon, name]) => { const b = el("button", "shop-tab" + (id === tab ? " active" : ""), `${icon} ${pick(name)}`); b.type = "button"; b.addEventListener("click", () => { tab = id; open(); }); tabs.appendChild(b); });
    body.appendChild(tabs);
    const box = el("div", "qx-list"); body.appendChild(box);
    if (tab === "hoje") today(box); else if (tab === "cidade") cidade(box); else if (tab === "pacientes") patients(box); else if (tab === "figuras") figures(box); else if (tab === "carreira") career(box); else collections(box);
    $("quests-title").textContent = `📜 ${tr("Missões", "Quests", "Misiones")}`;
    openModal("quests-modal");
  }

  return { open, stages, whereIs, RARE, meet, found, figures: () => figs() };
})();

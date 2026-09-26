"use strict";

// ===========================================================================
// Vida na cidade: saúde (academia, mercado, fast food), cassino com minijogos,
// guardiões (diagnosticar figuras especiais) e o menu de conquistas.
// Estado: state.health (0-100), state.life = { gym: {"semana:dia": n}, casino: {plays, wins, lost, streak, best} },
//         state.guardians = { id: true }, state.ach = { id: true }
// ===========================================================================
const Life = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));

  const life = () => { const l = (state.life = state.life || {}); l.gym = l.gym || {}; l.casino = l.casino || { plays: 0, wins: 0, lost: 0, streak: 0, best: 0, loseRun: 0 }; return l; };
  const health = () => (state.health === undefined ? 50 : state.health);
  const addHealth = (d) => { state.health = clamp(health() + d, 0, 100); };
  const dayKey = () => `${state.week || 1}:${state.dayIndex}`;

  function shell(title, intro) {
    const body = $("hosp-body");
    body.textContent = "";
    $("hosp-title").textContent = title;
    const status = el("p", "uni-q", intro);
    body.appendChild(status);
    return { body, status };
  }
  const bar = (v) => { const b = el("div", "uni-bar"); b.appendChild(el("i")); b.firstChild.style.width = `${v}%`; return b; };
  // ao dormir: um dia parado demais tira saúde, e um dia de muito movimento (a pé ou de bicicleta) sobe um pouco
  function dayHealth() {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("vida"), 500);     const a = state.act || {}, pts = a.day === state.dayIndex ? a.pts || 0 : 0;
    if (pts < 20) { addHealth(-3); return t("life.sedentary"); }
    if (pts >= 90) { addHealth(2); return t("life.active"); }
    return "";
  }
  const healthLine = () => `❤️‍🩹 ${tr("Saúde", "Health", "Salud")}: ${health()}%`;

  // ------------------------------------------------------------ academia
  const GYM = [
    { id: "leve", e: "🧘", minutes: 30, energy: -5, health: 4, coins: 0, name: L("Aula leve de alongamento", "Light stretching class", "Clase ligera de estiramiento") },
    { id: "treino", e: "🏋️", minutes: 60, energy: -12, health: 8, coins: 5, name: L("Treino completo", "Full workout", "Entrenamiento completo") }
  ];
  function openGym() {
    const { body, status } = shell(`🏋️ ${tr("Academia", "Gym", "Gimnasio")}`, tr("Treinar cansa agora, mas melhora a saúde: quem está saudável começa o dia com mais energia. Máximo de 2 treinos por dia.", "Working out tires you now but improves health: healthy people start the day with more energy. Up to 2 workouts a day.", "Entrenar cansa ahora pero mejora la salud: quien está sano empieza el día con más energía. Máximo 2 entrenamientos por día."));
    body.appendChild(el("p", "shop-note", healthLine()));
    body.appendChild(bar(health()));
    const box = el("div", "uni-opts");
    GYM.forEach((g) => {
      const b = el("button", "choice-btn", `${g.e} ${pick(g.name)} — ${g.minutes} min · ${g.energy}⚡ · +${g.health}❤️‍🩹${g.coins ? ` · 🪙${g.coins}` : ""}`);
      b.type = "button";
      b.addEventListener("click", () => {
        const l = life();
        if ((l.gym[dayKey()] || 0) >= 2) { status.textContent = tr("Por hoje chega: o corpo precisa descansar.", "That's enough for today: the body needs rest.", "Por hoy basta: el cuerpo necesita descanso."); sfx("bad"); return; }
        if (state.energy < -g.energy) { status.textContent = tr("Você está cansada demais para isso.", "You're too tired for that.", "Estás demasiado cansada para eso."); sfx("bad"); return; }
        if (state.coins < g.coins) { status.textContent = t("conv.poor"); sfx("bad"); return; }
        state.coins -= g.coins;
        state.energy = clamp(state.energy + g.energy, 0, 100);
        addHealth(g.health);
        l.gym[dayKey()] = (l.gym[dayKey()] || 0) + 1; l.sessions = (l.sessions || 0) + 1;
        advanceClock(g.minutes);
        saveState(); updateHud(); sfx("good");
        openGym();
        $("hosp-body").firstChild.textContent = tr("Bom treino! Você se sente melhor.", "Good workout! You feel better.", "¡Buen entrenamiento! Te sientes mejor.");
      });
      box.appendChild(b);
    });
    body.appendChild(box);
    openModal("hosp-modal");
  }

  // ------------------------------------------------------------ mercado e fast food
  const MARKET = [
    { id: "salada", e: "🥗", price: 6, energy: 8, health: 5, name: L("Salada", "Salad", "Ensalada") },
    { id: "fruta", e: "🍎", price: 3, energy: 4, health: 3, name: L("Fruta", "Fruit", "Fruta") },
    { id: "suco", e: "🧃", price: 4, energy: 6, health: 2, name: L("Suco natural", "Fresh juice", "Jugo natural") }
  ];
  const FAST = [
    { id: "combo", e: "🍔", price: 5, energy: 18, health: -4, name: L("Combo de hambúrguer", "Burger combo", "Combo de hamburguesa") },
    { id: "sorvete", e: "🍦", price: 3, energy: 8, health: -2, name: L("Sorvete", "Ice cream", "Helado") },
    { id: "batata", e: "🍟", price: 3, energy: 10, health: -3, name: L("Batata frita", "Fries", "Papas fritas") }
  ];
  function openFood(list, title, intro) {
    const { body, status } = shell(title, intro);
    body.appendChild(el("p", "shop-note", healthLine()));
    const box = el("div", "uni-opts");
    list.forEach((it) => {
      const b = el("button", "choice-btn", `${it.e} ${pick(it.name)} — 🪙${it.price} · +${it.energy}⚡ · ${it.health > 0 ? "+" : ""}${it.health}❤️‍🩹`);
      b.type = "button";
      b.addEventListener("click", () => {
        if (state.energy >= 100 && it.health <= 0) { status.textContent = t("conv.full"); sfx("bad"); return; }
        if (state.coins < it.price) { status.textContent = t("conv.poor"); sfx("bad"); return; }
        state.coins -= it.price;
        state.energy = clamp(state.energy + it.energy, 0, 100);
        addHealth(it.health);
        advanceClock(10);
        saveState(); updateHud(); sfx("buy");
        status.textContent = tr(`Você comeu: ${pick(it.name)}.`, `You had: ${pick(it.name)}.`, `Comiste: ${pick(it.name)}.`);
        body.querySelector(".shop-note").textContent = healthLine();
      });
      box.appendChild(b);
    });
    body.appendChild(box);
    openModal("hosp-modal");
  }
  const openMarket = () => openFood(MARKET, `🛒 ${tr("Mercado", "Supermarket", "Mercado")}`, tr("Comida de verdade: dá energia e melhora a saúde.", "Real food: gives energy and improves health.", "Comida de verdad: da energía y mejora la salud."));
  const openFast = () => openFood(FAST, `🍔 ${tr("Lanchonete", "Fast food", "Comida rápida")}`, tr("Rápido e gostoso, mas cobra da saúde. De vez em quando, tudo bem!", "Quick and tasty but it costs your health. Once in a while is fine!", "Rápido y rico, pero cobra a la salud. ¡De vez en cuando está bien!"));

  // ------------------------------------------------------------ navio pirata e navio fantasma
  function openTreasure() {
    const l = life();
    if (l.treasure === dayKey()) return showToast(tr("O baú já foi aberto hoje. Só sobrou poeira de ouro!", "The chest was already opened today. Only gold dust is left!", "El cofre ya se abrió hoy. ¡Solo queda polvo de oro!"));
    l.treasure = dayKey();
    const c = 5 + Math.floor(Math.random() * 11);
    state.coins += c; saveState(); updateHud(); sfx("good");
    showToast(`💰 ${tr(`Você achou ${c} moedas no baú do navio pirata!`, `You found ${c} coins in the pirate ship's chest!`, `¡Encontraste ${c} monedas en el cofre del barco pirata!`)}`);
  }
  function ghostLamp() {
    const l = life();
    if (l.lamp === dayKey()) return showToast(tr("A lanterna já brilha esta noite.", "The lantern already glows tonight.", "La linterna ya brilla esta noche."));
    l.lamp = dayKey(); state.xp += 3; saveState(); updateHud(); sfx("levelup");
    showToast(`🏮 ${tr("A luz verde revela lembranças antigas: +3 XP", "The green light reveals old memories: +3 XP", "La luz verde revela viejos recuerdos: +3 XP")}`);
  }


  // ------------------------------------------------------------ obras: ampliar o apartamento e a clínica
  const BUILDS = {
    varanda: { loc: "apartamento", price: 60, e: "🌇", name: L("Varanda", "Balcony", "Balcón"), about: L("Um canto para ver o pôr do sol e respirar. Recupera energia (mais ao entardecer).", "A corner to watch the sunset and breathe. Restores energy (more at dusk).", "Un rincón para ver el atardecer y respirar. Recupera energía (más al atardecer).") },
    escritorio: { loc: "apartamento", price: 80, e: "📓", name: L("Escritório", "Study", "Escritorio"), about: L("Diário de reflexão e estudo do Manual, uma vez por dia cada.", "Reflection journal and Manual study, once a day each.", "Diario de reflexión y estudio del Manual, una vez al día cada uno.") },
    "sala-grupo": { loc: "clinica", price: 120, e: "👥", name: L("Sala de grupo", "Group room", "Sala de grupo"), about: L("Grupos terapêuticos: uma vez por dia, rendem moedas e experiência.", "Therapy groups: once a day, they earn coins and experience.", "Grupos terapéuticos: una vez al día, dan monedas y experiencia.") },
    brinquedoteca: { loc: "clinica", price: 80, e: "🧸", name: L("Brinquedoteca", "Playroom", "Ludoteca"), about: L("Brincar antes das consultas: o primeiro paciente criança do dia começa com +6 de vínculo.", "Play before sessions: the day's first child patient starts with +6 bond.", "Jugar antes de las consultas: el primer paciente niño del día empieza con +6 de vínculo.") },
    arquivo: { loc: "clinica", price: 100, e: "🗂️", name: L("Arquivo", "Archive", "Archivo"), about: L("Todos os prontuários à mão: evolução, diagnóstico e encaminhamento de cada paciente.", "All records at hand: progress, diagnosis and referral of every patient.", "Todos los prontuarios a mano: evolución, diagnóstico y derivación de cada paciente.") }
  };
  const builds = () => (state.builds = state.builds || {});
  const built = (id) => Boolean(builds()[id]);

  function openBuilds(locId) {
    const { body, status } = shell(`🏗️ ${tr("Obras e ampliações", "Works and expansions", "Obras y ampliaciones")}`, tr("Amplie este lugar com as suas moedas. Cada ampliação abre novos cantos para usar.", "Expand this place with your coins. Each expansion opens new corners to use.", "Amplía este lugar con tus monedas. Cada ampliación abre nuevos rincones para usar."));
    const box = el("div", "uni-opts");
    Object.entries(BUILDS).filter(([, b]) => b.loc === locId).forEach(([id, b]) => {
      const own = built(id);
      const btn = el("button", "choice-btn", `${b.e} ${pick(b.name)} — ${own ? "✓" : `🪙${b.price}`}\n${pick(b.about)}`);
      btn.type = "button"; btn.disabled = own;
      btn.addEventListener("click", () => {
        if (state.coins < b.price) { status.textContent = t("conv.poor"); sfx("bad"); return; }
        state.coins -= b.price; builds()[id] = true; saveState(); updateHud(); sfx("buy");
        if (window.City) City.refreshBuilds();
        openBuilds(locId);
        $("hosp-body").firstChild.textContent = tr(`Obra concluída: ${pick(b.name)}!`, `Works done: ${pick(b.name)}!`, `¡Obra terminada: ${pick(b.name)}!`);
      });
      box.appendChild(btn);
    });
    body.appendChild(box);
    openModal("hosp-modal");
  }

  const JOURNAL = [
    L("O que mais me marcou nesta semana e por quê?", "What struck me most this week, and why?", "¿Qué me marcó más esta semana y por qué?"),
    L("Que emoção evitei sentir hoje?", "What emotion did I avoid feeling today?", "¿Qué emoción evité sentir hoy?"),
    L("Que pergunta eu gostaria de ter feito a um paciente?", "What question do I wish I had asked a patient?", "¿Qué pregunta me habría gustado hacerle a un paciente?"),
    L("Como cuido de mim para poder cuidar dos outros?", "How do I look after myself so I can look after others?", "¿Cómo me cuido para poder cuidar de los demás?"),
    L("Que limite eu preciso colocar e ainda não coloquei?", "What boundary do I need to set and haven't yet?", "¿Qué límite necesito poner y aún no puse?"),
    L("Pelo que sou grata hoje?", "What am I grateful for today?", "¿Por qué estoy agradecida hoy?")
  ];
  const daily = (key) => { const l = life(); if (l["b_" + key] === dayKey()) return false; l["b_" + key] = dayKey(); return true; };

  function doBuild(what) {
    if (what === "varanda") {
      if (!daily("varanda")) return showToast(tr("Você já contemplou hoje.", "You already took in the view today.", "Ya contemplaste hoy."));
      const ph = dayPhase(state.clock), e = ph === "day" ? 5 : 12;
      state.energy = clamp(state.energy + e, 0, 100); advanceClock(30); addHealth(1); saveState(); updateHud(); sfx("good");
      showToast(`🌇 ${ph === "day" ? tr(`Um respiro na varanda: +${e} energia. Ao entardecer é ainda melhor!`, `A breath on the balcony: +${e} energy. Dusk is even better!`, `Un respiro en el balcón: +${e} energía. ¡Al atardecer es aún mejor!`) : tr(`Que pôr do sol! +${e} energia.`, `What a sunset! +${e} energy.`, `¡Qué atardecer! +${e} energía.`)}`);
    } else if (what === "diario") {
      const { body } = shell(`📓 ${tr("Diário", "Journal", "Diario")}`, tr("Escrever ajuda a organizar o que sentimos. Reflita sobre:", "Writing helps organize what we feel. Reflect on:", "Escribir ayuda a organizar lo que sentimos. Reflexiona sobre:"));
      body.appendChild(el("p", "uni-res", `“${pick(JOURNAL[Math.floor(Math.random() * JOURNAL.length)])}”`));
      const b = el("button", "pill-btn", tr("Registrar no diário", "Log it in the journal", "Registrar en el diario"));
      b.type = "button";
      b.addEventListener("click", () => { if (!daily("diario")) { showToast(tr("Você já escreveu hoje.", "You already wrote today.", "Ya escribiste hoy.")); return; } state.xp += 3; advanceClock(20); saveState(); updateHud(); sfx("good"); closeModal("hosp-modal"); showToast(`📓 ${tr("Diário escrito: +3 XP", "Journal written: +3 XP", "Diario escrito: +3 XP")}`); });
      body.appendChild(b);
      openModal("hosp-modal");
    } else if (what === "estudo") {
      if (!daily("estudo")) return showToast(tr("Você já estudou hoje.", "You already studied today.", "Ya estudiaste hoy."));
      const fechados = [];
      MANUAL_GROUPS.forEach((g) => { if (g.kind !== "approach" && g.id !== "guia") g.disorders.forEach((d) => { if (d.items && d.items.length && !manualIsOpen(d)) fechados.push(d); }); });
      advanceClock(40); state.xp += 2;
      if (fechados.length) { const d = fechados[Math.floor(Math.random() * fechados.length)]; unlockManual([d.id], true); showToast(`📘 ${t("lib.unlock", { name: d.name })}`); }
      else showToast(tr("Você revisou o Manual: +2 XP", "You reviewed the Manual: +2 XP", "Repasaste el Manual: +2 XP"));
      saveState(); updateHud(); sfx("good");
    } else if (what === "grupo") {
      if (!daily("grupo")) return showToast(tr("O grupo de hoje já aconteceu.", "Today's group already met.", "El grupo de hoy ya se reunió."));
      const { body } = shell(`👥 ${tr("Grupo terapêutico", "Therapy group", "Grupo terapéutico")}`, tr("Três participantes chegam para o grupo. Como você conduz a roda?", "Three participants arrive for the group. How do you run the circle?", "Llegan tres participantes al grupo. ¿Cómo conduces la ronda?"));
      const box = el("div", "uni-opts");
      Wheel.IDS.forEach((ap) => {
        const b = el("button", "choice-btn", `${APPROACH[ap].icon} ${APPROACH[ap].name}`);
        b.type = "button";
        b.addEventListener("click", () => {
          const match = Wheel.dominant() === ap, coins = 10 + Math.floor(Math.random() * 11) + (match ? 5 : 0);
          state.coins += coins; state.xp += 5; Wheel.record({ ap, score: match ? 4 : 2 }); advanceClock(50); saveState(); updateHud(); sfx("good");
          box.querySelectorAll("button").forEach((x) => { x.disabled = true; });
          body.appendChild(el("p", "uni-res", `${tr(`O grupo rendeu +${coins} moedas e +5 XP.`, `The group earned +${coins} coins and +5 XP.`, `El grupo dio +${coins} monedas y +5 XP.`)}${match ? ` ${tr("Seu estilo combinou com a condução!", "Your style matched how you led!", "¡Tu estilo coincidió con la conducción!")}` : ""}`));
        });
        box.appendChild(b);
      });
      body.appendChild(box);
      openModal("hosp-modal");
    } else if (what === "brinquedos") {
      if (!daily("brinquedos")) return showToast(tr("A brinquedoteca já foi arrumada hoje.", "The playroom was already set up today.", "La ludoteca ya se arregló hoy."));
      state.playroom = dayKey(); advanceClock(15); saveState(); sfx("good");
      showToast(`🧸 ${tr("Tudo pronto: o próximo paciente criança começa com +6 de vínculo.", "All set: the next child patient starts with +6 bond.", "Todo listo: el próximo paciente niño empieza con +6 de vínculo.")}`);
    } else if (what === "arquivo") {
      const { body } = shell(`🗂️ ${tr("Arquivo de prontuários", "Records archive", "Archivo de prontuarios")}`, "");
      Phone.renderRecord(body);
      openModal("hosp-modal");
    }
  }

  // bônus da brinquedoteca: vale uma vez, para o primeiro paciente criança depois de brincar
  function playroomBonus(kid) {
    if (!kid || state.playroom !== dayKey()) return 0;
    state.playroom = null;
    return 6;
  }

  // ------------------------------------------------------------ cassino
  const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎"];
  const BETS = [5, 10, 25];
  function openCasino(game) {
    const c = life().casino;
    const names = { coin: tr("Cara ou coroa", "Coin flip", "Cara o cruz"), dice: tr("Dados", "Dice", "Dados"), slots: tr("Caça-níquel", "Slot machine", "Tragamonedas") };
    const { body, status } = shell(`🎰 ${names[game]}`, tr("Moedas do jogo, de mentirinha. Atenção: apostar demais é um transtorno de verdade (veja \"Transtorno do jogo\" no Manual). A banca sempre tem vantagem!", "Game coins, all pretend. Careful: betting too much is a real disorder (see \"Gambling disorder\" in the Manual). The house always has an edge!", "Monedas del juego, de mentira. Ojo: apostar demasiado es un trastorno real (mira \"Trastorno del juego\" en el Manual). ¡La banca siempre tiene ventaja!"));
    let bet = BETS[0], pickSide = "cara";
    const betRow = el("div", "uni-row");
    const paint = () => { betRow.textContent = ""; BETS.forEach((b) => { const x = el("button", "pill-btn small", `🪙 ${b}${b === bet ? " ✓" : ""}`); x.type = "button"; x.addEventListener("click", () => { bet = b; paint(); }); betRow.appendChild(x); }); };
    paint();
    body.appendChild(betRow);
    const options = el("div", "uni-row");
    const opt = (label, key) => { const x = el("button", "pill-btn small", label); x.type = "button"; x.addEventListener("click", () => { pickSide = key; [...options.children].forEach((y) => { y.style.outline = ""; }); x.style.outline = "3px solid #d9a520"; }); options.appendChild(x); return x; };
    if (game === "coin") { opt(tr("Cara", "Heads", "Cara"), "cara").style.outline = "3px solid #d9a520"; opt(tr("Coroa", "Tails", "Cruz"), "coroa"); pickSide = "cara"; body.appendChild(options); }
    if (game === "dice") { opt(tr("Menos de 7 (1:1)", "Under 7 (1:1)", "Menos de 7 (1:1)"), "under").style.outline = "3px solid #d9a520"; opt(tr("Exatamente 7 (4:1)", "Exactly 7 (4:1)", "Exactamente 7 (4:1)"), "seven"); opt(tr("Mais de 7 (1:1)", "Over 7 (1:1)", "Más de 7 (1:1)"), "over"); pickSide = "under"; body.appendChild(options); }
    const out = el("p", "uni-res");
    const play = el("button", "pill-btn", `🎲 ${tr("Jogar", "Play", "Jugar")}`);
    play.type = "button";
    play.addEventListener("click", () => {
      if (state.coins < bet) { out.textContent = t("conv.poor"); sfx("bad"); return; }
      state.coins -= bet;
      let win = 0, text = "";
      if (game === "coin") {
        const r = Math.random() < 0.5 ? "cara" : "coroa";
        text = `🪙 ${r === "cara" ? tr("Cara", "Heads", "Cara") : tr("Coroa", "Tails", "Cruz")}!`;
        if (r === pickSide) win = bet * 2;
      } else if (game === "dice") {
        const a = 1 + Math.floor(Math.random() * 6), b2 = 1 + Math.floor(Math.random() * 6), s = a + b2;
        text = `🎲 ${a} + ${b2} = ${s}`;
        if ((pickSide === "under" && s < 7) || (pickSide === "over" && s > 7)) win = bet * 2;
        else if (pickSide === "seven" && s === 7) win = bet * 5;
      } else {
        const reel = [0, 0, 0].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        text = reel.join(" ");
        if (reel[0] === reel[1] && reel[1] === reel[2]) win = bet * 10;
        else if (reel[0] === reel[1] || reel[1] === reel[2] || reel[0] === reel[2]) win = bet;   // par: devolve a aposta
      }
      state.coins += win;
      c.plays += 1;
      if (win > bet) { c.wins += 1; c.streak += 1; c.best = Math.max(c.best, c.streak); c.loseRun = 0; }
      else if (win === bet) { /* empate */ }
      else { c.streak = 0; c.lost += bet; c.loseRun += 1; }
      advanceClock(10);
      saveState(); updateHud();
      sfx(win > bet ? "good" : win === bet ? "click" : "bad");
      out.textContent = `${text}  ${win > bet ? `✅ +${win - bet}` : win === bet ? "↔️ 0" : `❌ -${bet}`}`;
      if (c.loseRun >= 4) out.textContent += `\n${tr("Perder várias vezes e querer \"recuperar\" é um sinal de alerta no jogo patológico. Que tal parar por hoje?", "Losing repeatedly and wanting to \"win it back\" is a warning sign in gambling disorder. How about stopping for today?", "Perder varias veces y querer \"recuperar\" es una señal de alerta en el juego patológico. ¿Y si paras por hoy?")}`;
    });
    body.appendChild(play);
    body.appendChild(out);
    openModal("hosp-modal");
  }

  // ------------------------------------------------------------ guardiões: conversar e diagnosticar
  const GUARDIANS = ["papai_noel", "coelho", "abobora", "jack_frost", "fada_dente", "sandman"];
  const guardianDef = (id) => {
    const c = Town.cdef(id);
    if (c) return c;
    const n = (window.WORLD_DATA.npcs || []).find((x) => x.id === id);
    return n || null;
  };
  const guardianName = (id) => { const d = guardianDef(id); return d ? d.name : id; };
  const solved = (id) => Boolean((state.guardians || {})[id]);
  const triedKey = (id) => `g:${id}`;

  function openGuardianDx(id) {
    const d = guardianDef(id);
    if (!d || !d.dx) return;
    const { body, status } = shell(`🩺 ${tr("Guardião", "Guardian", "Guardián")}: ${d.name}`, tr("Depois de conversar bastante, qual hipótese diagnóstica combina mais com essa pessoa? (Uma tentativa por dia.)", "After talking at length, which diagnostic hypothesis fits this person best? (One try per day.)", "Tras conversar mucho, ¿qué hipótesis diagnóstica encaja más con esta persona? (Un intento por día.)"));
    state.tuts = state.tuts || {};
    const tries = (state.life && state.life.gTry) || {};
    if (solved(id)) { body.appendChild(el("p", "uni-res", `✅ ${tr("Você já decifrou este guardião.", "You've already figured this guardian out.", "Ya descifraste a este guardián.")}`)); openModal("hosp-modal"); return; }
    if (tries[triedKey(id)] === dayKey()) { body.appendChild(el("p", "uni-res", tr("Você já tentou hoje. Volte amanhã.", "You already tried today. Come back tomorrow.", "Ya lo intentaste hoy. Vuelve mañana."))); openModal("hosp-modal"); return; }
    const box = el("div", "uni-opts");
    shuffle(d.dx.options).forEach((opt) => {
      const b = el("button", "choice-btn", disorderName(opt));
      b.type = "button";
      b.addEventListener("click", () => {
        life().gTry = life().gTry || {}; life().gTry[triedKey(id)] = dayKey();
        const ok = opt === d.dx.answer;
        box.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        if (ok) {
          state.guardians = state.guardians || {}; state.guardians[id] = true;
          state.xp += 15; state.coins += 20; sfx("good");
          status.textContent = `✅ ${tr("Acertou! +15 XP, +20 moedas.", "Correct! +15 XP, +20 coins.", "¡Acertaste! +15 XP, +20 monedas.")} ${pick(d.dx.why)}`;
        } else { sfx("bad"); status.textContent = `❌ ${tr("Ainda não. Converse mais e tente amanhã.", "Not yet. Talk some more and try tomorrow.", "Aún no. Habla más e inténtalo mañana.")}`; }
        saveState(); updateHud();
      });
      box.appendChild(b);
    });
    body.appendChild(box);
    openModal("hosp-modal");
  }

  // ------------------------------------------------------------ conquistas
  const ACH = [
    { id: "primeira", e: "🩺", name: L("Primeira consulta", "First session", "Primera consulta"), about: L("Termine uma consulta.", "Finish a session.", "Termina una consulta."), prog: () => [Object.values(state.pat || {}).filter((r) => r.q.length).length, 1] },
    { id: "diagnostica", e: "🎯", name: L("Olho clínico", "Clinical eye", "Ojo clínico"), about: L("Acerte 5 diagnósticos.", "Get 5 diagnoses right.", "Acierta 5 diagnósticos."), prog: () => [Object.values(state.pat || {}).filter((r) => r.dx === true).length, 5] },
    { id: "todos_dx", e: "🏅", name: L("Mestra do diagnóstico", "Diagnosis master", "Maestra del diagnóstico"), about: L("Acerte o diagnóstico dos 15 pacientes.", "Get all 15 patients' diagnoses right.", "Acierta el diagnóstico de los 15 pacientes."), prog: () => [Object.values(state.pat || {}).filter((r) => r.dx === true).length, 15] },
    { id: "amiga", e: "🤝", name: L("Amiga da cidade", "Friend of the city", "Amiga de la ciudad"), about: L("Faça 5 moradores virarem amigos.", "Befriend 5 residents.", "Haz amigos a 5 vecinos."), prog: () => [Object.values(state.social || {}).filter((s) => s.friend >= 3).length, 5] },
    { id: "convencedora", e: "💬", name: L("Convencedora", "Persuader", "Convencedora"), about: L("Convença 3 moradores a fazer terapia.", "Convince 3 residents to try therapy.", "Convence a 3 vecinos de hacer terapia."), prog: () => [Object.keys((state.town && state.town.convinced) || {}).length, 3] },
    { id: "terapeuta", e: "🛋️", name: L("Terapeuta de confiança", "Trusted therapist", "Terapeuta de confianza"), about: L("Aceite 3 pedidos de terapia.", "Accept 3 therapy requests.", "Acepta 3 solicitudes de terapia."), prog: () => [Object.keys(state.therapy || {}).length, 3] },
    { id: "guardioes", e: "🎄", name: L("A lenda dos Guardiões", "The Legend of the Guardians", "La leyenda de los Guardianes"), about: L("Converse e diagnostique corretamente os 6 guardiões (Papai Noel, Seu Coelho, Seu Abóbora, João da Neve, Fada do Dente e Sandman).", "Talk to and correctly diagnose the 6 guardians (Santa, Mr. Rabbit, Mr. Pumpkin, João da Neve, the Tooth Fairy and Sandman).", "Habla y diagnostica correctamente a los 6 guardianes (Papá Noel, Sr. Conejo, Sr. Calabaza, João da Neve, el Hada de los Dientes y Sandman)."), prog: () => [GUARDIANS.filter(solved).length, GUARDIANS.length] },
    { id: "atleta", e: "🏋️", name: L("Atleta", "Athlete", "Atleta"), about: L("Faça 10 treinos na academia.", "Do 10 gym workouts.", "Haz 10 entrenamientos en el gimnasio."), prog: () => [(state.life && state.life.sessions) || 0, 10] },
    { id: "saudavel", e: "❤️‍🩹", name: L("Saudável", "Healthy", "Saludable"), about: L("Chegue a 80% de saúde.", "Reach 80% health.", "Llega al 80% de salud."), prog: () => [health(), 80] },
    { id: "sorte", e: "🎰", name: L("Sorte de principiante", "Beginner's luck", "Suerte de principiante"), about: L("Ganhe 3 apostas seguidas no cassino (e pare enquanto está bem!).", "Win 3 bets in a row at the casino (and quit while you're ahead!).", "Gana 3 apuestas seguidas en el casino (¡y para mientras vas bien!)."), prog: () => [(state.life && state.life.casino && state.life.casino.best) || 0, 3] },
    { id: "estudiosa", e: "🎓", name: L("Formada", "Graduate", "Graduada"), about: L("Passe em todas as aulas da faculdade.", "Pass every university class.", "Aprueba todas las clases de la universidad."), prog: () => { const g = MANUAL_GROUPS.filter((x) => x.id !== "abordagens" && x.id !== "guia" && x.disorders.filter((d) => d.items && d.items.length >= 2).length >= 3); return [Object.keys((state.uni && state.uni.passed) || {}).length, g.length || 1]; } },
    { id: "perfil", e: "🎡", name: L("Perfil definido", "Defined profile", "Perfil definido"), about: L("Forme um perfil de psicólogo na roda.", "Form a psychologist profile on the wheel.", "Forma un perfil de psicólogo en la rueda."), prog: () => [Wheel.dominant() ? 1 : 0, 1] },
    { id: "bichos", e: "🐾", name: L("Casa cheia", "Full house", "Casa llena"), about: L("Tenha 3 bichinhos.", "Have 3 pets.", "Ten 3 mascotas."), prog: () => [(state.pets || []).length, 3] },
    { id: "fantasma", e: "👻", name: L("Ouvinte de almas", "Listener of souls", "Oyente de almas"), about: L("Diagnostique o Capitão Névoa, no Holandês Voador (só aparece à noite).", "Diagnose Captain Névoa on the Flying Dutchman (only shows up at night).", "Diagnostica al Capitán Névoa en el Holandés Errante (solo aparece de noche)."), prog: () => [solved("nevoa") ? 1 : 0, 1] },
    { id: "abissal", e: "🫧", name: L("Amiga do fundo do mar", "Friend of the deep", "Amiga del fondo del mar"), about: L("Convença os 3 moradores da Fenda do Biquíni a fazer terapia.", "Convince the 3 residents of the underwater rift to try therapy.", "Convence a los 3 habitantes de la grieta submarina de hacer terapia."), prog: () => [["perola", "coralino", "tata"].filter((id) => Town.st().convinced[id]).length, 3] },
    { id: "colecionadora_aq", e: "🐠", name: L("Aquarista", "Aquarist", "Acuarista"), about: L("Reúna todas as criaturas do aquário: pesque no cais e na fenda e convença os moradores.", "Gather every aquarium creature: fish at the pier and the rift and convince the residents.", "Reúne todas las criaturas del acuario: pesca en el muelle y la grieta y convence a los vecinos."), prog: () => [Aquarium.owned().length, Aquarium.SPECIES.length] },
    { id: "poliglota", e: "🌐", name: L("Poliglota", "Polyglot", "Políglota"), about: L("Visite a seção de todos os idiomas na lojinha do shopping.", "Visit every language section at the mall's language shop.", "Visita la sección de todos los idiomas en la tienda del centro comercial."), prog: () => [Object.keys((state.culture && state.culture.langs) || {}).length, I18N.LANGS.length] },
    { id: "historiadora", e: "📚", name: L("Historiadora", "Historian", "Historiadora"), about: L("Leia todos os marcos da história da psicologia.", "Read every milestone in the history of psychology.", "Lee todos los hitos de la historia de la psicología."), prog: () => [Object.keys((state.culture && state.culture.history) || {}).length, Culture.HISTORY.length] },
    { id: "alta", e: "🎓", name: L("Primeira alta", "First discharge", "Primera alta"), about: L("Dê a alta clínica completa a um paciente.", "Give a patient a full clinical discharge.", "Da el alta clínica completa a un paciente."), prog: () => [Object.values(state.therapy || {}).filter((t) => t && t.alta === "completa").length, 1] },
    { id: "reputada", e: "🏥", name: L("Clínica de renome", "Renowned clinic", "Clínica de renombre"), about: L("Chegue a 30 de Reputação da Clínica.", "Reach 30 Clinic Reputation.", "Llega a 30 de Reputación de la Clínica."), prog: () => [Math.max(0, (state.rep || {}).clinica || 0), 30] },
    { id: "academica", e: "📄", name: L("Vida acadêmica", "Academic life", "Vida académica"), about: L("Chegue a 10 de Reputação Acadêmica.", "Reach 10 Academic Reputation.", "Llega a 10 de Reputación Académica."), prog: () => [(state.rep || {}).academica || 0, 10] },
    { id: "etica", e: "⚖️", name: L("Boa conduta", "Good conduct", "Buena conducta"), about: L("Resolva 3 dilemas éticos.", "Resolve 3 ethical dilemmas.", "Resuelve 3 dilemas éticos."), prog: () => [typeof Events !== "undefined" ? Events.DILEMMAS.filter((d) => Events.st().visto[d.id]).length : 0, 3] },
    { id: "memoria", e: "🕯️", name: L("Memória viva", "Living memory", "Memoria viva"), about: L("Preste homenagem aos 6 pioneiros no Parque Memorial.", "Pay tribute to the 6 pioneers at the Memorial Park.", "Rinde homenaje a los 6 pioneros en el Parque Memorial."), prog: () => [Object.keys((state.places && state.places.pioneers) || {}).length, 6] },
    { id: "cuidado", e: "🛡️", name: L("Cuidar de vidas", "Caring for lives", "Cuidar de vidas"), about: L("Pactue um Plano de Segurança.", "Agree on a Safety Plan.", "Pacta un Plan de Seguridad."), prog: () => [Object.values(state.dxbook || {}).filter((b) => b.risco && b.risco.plano).length, 1] },
    { id: "curiosa", e: "🎭", name: L("Curiosa da história", "History buff", "Curiosa de la historia"), about: L("Encontre 10 figuras históricas ou de feriados.", "Find 10 historical or holiday figures.", "Encuentra 10 figuras históricas o de feriados."), prog: () => [Object.keys(state.figures || {}).length, 10] },
    { id: "lojista", e: "🧭", name: L("Exploradora das lojas", "Shop explorer", "Exploradora de tiendas"), about: L("Visite as 6 lojas de móveis da cidade.", "Visit the city's 6 furniture stores.", "Visita las 6 tiendas de muebles de la ciudad."), prog: () => [Object.keys(state.shopSeen || {}).length, 6] },
    { id: "continuo", e: "♾️", name: L("Sem fim", "Endless", "Sin fin"), about: L("Chegue à semana 9 no modo contínuo.", "Reach week 9 in endless mode.", "Llega a la semana 9 en modo continuo."), prog: () => [state.sandbox ? state.week || 1 : 0, 9] },
    { id: "biologa", e: "🐆", name: L("Bióloga do Brasil", "Biologist of Brazil", "Bióloga de Brasil"), about: L("Conquiste os 7 selos de bioma no zoológico.", "Earn the 7 biome seals at the zoo.", "Consigue los 7 sellos de bioma en el zoológico."), prog: () => [typeof Zoo !== "undefined" ? Zoo.sealCount() : 0, 7] },
    { id: "guardia_fauna", e: "🦁", name: L("Guardiã da fauna", "Fauna guardian", "Guardiana de la fauna"), about: L("Chegue ao nível 3 do zoológico.", "Reach zoo level 3.", "Llega al nivel 3 del zoológico."), prog: () => [typeof Zoo !== "undefined" ? Zoo.st().level : 0, 3] },
    { id: "polo", e: "❄️", name: L("Visita ao Polo Norte", "Visit to the North Pole", "Visita al Polo Norte"), about: L("Chegue ao Polo Norte (libera com A lenda dos Guardiões).", "Reach the North Pole (unlocked by The Legend of the Guardians).", "Llega al Polo Norte (se desbloquea con La leyenda de los Guardianes)."), prog: () => [state.city && state.city.visited && state.city.visited.polo ? 1 : 0, 1] },
    { id: "semanas", e: "📅", name: L("Fim do ciclo", "End of the cycle", "Fin del ciclo"), about: L("Chegue à 4ª semana.", "Reach week 4.", "Llega a la 4.ª semana."), prog: () => [state.week || 1, 4] }
  ];
  const done = (a) => { const [v, n] = a.prog(); return v >= n; };

  // ---------------------------------------------------------------- prêmio de cada conquista: moedas, XP, peça de roupa/acessório e dicas do mapa
  const H = (pt, en, es) => L(pt, en, es);
  const REWARDS = {
    primeira: { c: 20 }, diagnostica: { c: 40, x: 20, acc: "glasses" }, todos_dx: { c: 120, x: 80, top: "b-jaleco-rosa" }, amiga: { c: 30, acc: "scarf" }, convencedora: { c: 40, x: 20 },
    terapeuta: { c: 50, top: "b-sueter-mostarda" }, guardioes: { c: 100, x: 60, hint: H("Área nova: o Polo Norte apareceu no mapa, lá no alto. Vá visitar o Papai Noel!", "New area: the North Pole appeared on the map, up north. Go visit Santa!", "Área nueva: el Polo Norte apareció en el mapa, arriba. ¡Ve a visitar a Papá Noel!") },
    atleta: { c: 30, x: 15 }, saudavel: { c: 30, hint: H("Dica: a academia tem aulas com horário marcado (alongamento, yoga, pilates, dança e boxe).", "Hint: the gym has scheduled classes (stretching, yoga, pilates, dance and boxing).", "Pista: el gimnasio tiene clases con horario (estiramiento, yoga, pilates, baile y boxeo).") },
    sorte: { c: 20 }, estudiosa: { c: 60, x: 40, top: "b-blazer-verde" }, perfil: { c: 30, x: 25 }, bichos: { c: 30 },
    fantasma: { c: 80, x: 40, top: "b-vestido-noite", hint: H("Dica: a Capitã Bússola guarda mais histórias no navio pirata.", "Hint: Captain Bússola keeps more stories on the pirate ship.", "Pista: la Capitana Bússola guarda más historias en el barco pirata.") },
    abissal: { c: 60, x: 30 }, colecionadora_aq: { c: 150, x: 60 }, poliglota: { c: 40, top: "b-camisa-oceano" }, historiadora: { c: 40, x: 30, hint: H("Dica: os monumentos do Parque Memorial abrem verbetes de história no Manual.", "Hint: the Memorial Park monuments open history entries in the Manual.", "Pista: los monumentos del Parque Memorial abren entradas de historia en el Manual.") },
    alta: { c: 60, x: 40, top: "b-jaleco-preto" }, reputada: { c: 100, x: 60, top: "b-blazer-vinho" }, academica: { c: 80, x: 50 }, etica: { c: 70, x: 40, hint: H("Dica: supervisão e flores no memorial aliviam o estresse.", "Hint: supervision and flowers at the memorial relieve stress.", "Pista: la supervisión y las flores en el memorial alivian el estrés.") },
    memoria: { c: 60, x: 40, top: "b-vestido-flores" }, cuidado: { c: 60, x: 40 }, curiosa: { c: 50, x: 30, hint: H("Dica: figuras da ciência moram em laboratório, observatório e universidade.", "Hint: science figures live in the lab, observatory and university.", "Pista: las figuras de la ciencia viven en el laboratorio, el observatorio y la universidad.") },
    lojista: { c: 80, hint: H("Dica: cada loja de móveis tem peças exclusivas; visite antes de comprar.", "Hint: each furniture store has exclusive pieces; visit before you buy.", "Pista: cada tienda de muebles tiene piezas exclusivas; visita antes de comprar.") },
    biologa: { c: 200, x: 100 }, guardia_fauna: { c: 80, x: 50 }, polo: { c: 60, x: 30 },
    continuo: { c: 150, x: 80 }, semanas: { c: 100, x: 50 }
  };
  const rewardText = (id) => {
    const r = REWARDS[id]; if (!r) return "";
    const topName = r.top && ITEM_TOP(r.top), accName = r.acc && (ACC_MAP[r.acc] || {}).name;
    return [r.c ? `🪙 ${r.c}` : "", r.x ? `⭐ ${r.x} XP` : "", topName ? `👗 ${topName}` : "", accName ? `👓 ${accName}` : "", r.hint ? `💡 ${pick(r.hint)}` : ""].filter(Boolean).join(" · ");
  };
  const ITEM_TOP = (id) => (typeof TOP_MAP !== "undefined" && TOP_MAP[id] ? TOP_MAP[id].name : id);
  function giveReward(id) {
    const r = REWARDS[id]; if (!r) return;
    if (r.c) state.coins += r.c;
    if (r.x) state.xp += r.x;
    if (r.top) { state.ownedClothes = state.ownedClothes || {}; state.ownedClothes[r.top] = true; }
    if (r.acc) { state.ownedClothes = state.ownedClothes || {}; state.ownedClothes[r.acc] = true; }
    if (r.hint) { state.dicas = state.dicas || []; state.dicas.push({ id, semana: state.week || 1 }); }
  }

  let soonT = 0;
  function check() {
    state.ach = state.ach || {};
    const fresh = [];
    ACH.forEach((a) => { if (!state.ach[a.id] && done(a)) { state.ach[a.id] = true; fresh.push(a); giveReward(a.id); } });
    if (fresh.length) { saveState(); if (typeof updateHud === "function") updateHud(); fresh.forEach((a, i) => setTimeout(() => { if (typeof showToast === "function") showToast(`🏆 ${tr("Conquista", "Achievement", "Logro")}: ${pick(a.name)} · 🎁 ${rewardText(a.id)}`); sfx("levelup"); }, 500 + i * 3800)); }
    return fresh.length;
  }
  const soon = () => { clearTimeout(soonT); soonT = setTimeout(check, 400); };

  function openAchievements() {
    check();
    const body = $("ach-body");
    body.textContent = "";
    const n = ACH.filter((a) => state.ach && state.ach[a.id]).length;
    body.appendChild(el("p", "uni-q", `🏆 ${n}/${ACH.length}`));
    const list = el("ul", "idx-list");
    ACH.forEach((a) => {
      const got = Boolean(state.ach && state.ach[a.id]);
      const [v, m] = a.prog();
      const li = el("li", "idx-item" + (got ? "" : " ach-locked"));
      li.appendChild(el("span", "idx-icon", got ? a.e : "🔒"));
      const b = el("div", "idx-body");
      b.appendChild(el("strong", null, pick(a.name)));
      b.appendChild(el("p", null, pick(a.about)));
      b.appendChild(bar(Math.min(100, Math.round((Math.min(v, m) / m) * 100))));
      b.appendChild(el("p", "shop-note", `${Math.min(v, m)}/${m}`));
      if (REWARDS[a.id]) b.appendChild(el("p", "shop-note", `🎁 ${got ? tr("Prêmio recebido", "Reward received", "Premio recibido") : tr("Prêmio", "Reward", "Premio")}: ${rewardText(a.id)}`));
      li.appendChild(b);
      list.appendChild(li);
    });
    body.appendChild(list);
    openModal("ach-modal");
  }

  return { REWARDS, rewardText, dayHealth, openBuilds, doBuild, playroomBonus, built, BUILDS, openTreasure, ghostLamp, GUARDIANS, guardianDef, guardianName, solved, openGym, openMarket, openFast, openCasino, openGuardianDx, openAchievements, check, soon, ACH, health, addHealth, life };
})();

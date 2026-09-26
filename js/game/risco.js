"use strict";

// ===========================================================================
// Manejo de risco e ética (educativo): avaliação graduada de risco de suicídio/automutilação, Plano de Segurança, decisão ética
// sobre sigilo, mensagens de crise no celular, negligência clínica com desfecho de crise e Análise Ética do caso.
// Desligado por completo quando "Ocultar suicídio, automutilação e temas parecidos" está ligado (Sens.on()).
// Dados por caso (content/dx.json, gerado por tools/python/build_risco.py): cases[caso].risk = { ideacao, plano, imediato }, cases[caso].warn = [...].
//   nível = ideacao ? (plano ? (imediato ? 3 : 2) : 1) : 0
//     1 ideação passiva → fortalecer fatores de proteção · 2 ideação ativa/intenção → pactuar Plano de Segurança
//     3 risco iminente/plano estruturado → decisão ética obrigatória (A omissão · B conduta proporcional · C conduta punitiva)
// Estado: state.dxbook[caso].risco = { asked, level, protecao, plano, etica }, state.pat[caso] += { neglig, negLog[], closed },
//         state.crises[] (mensagens de emergência no celular), state.advertencias[] (histórico ético da clínica).
// Fórmulas: docs/DESIGN-RISCO-ETICA.md.
// ===========================================================================
const Risk = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const LIMIT = 4;               // pontos de negligência para o desfecho de crise
  const REP_PENALTY = 15;        // Reputação da Clínica perdida no desfecho
  const enabled = () => typeof Sens === "undefined" || !Sens.on();
  const hash = (s) => String(s).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rec = (k) => FU.rec(k);
  const raw = (k) => { const c = Dx.data().cases[k]; return c && c.risk ? c.risk : null; };
  const levelOf = (r) => (!r ? 0 : r.ideacao ? (r.plano ? (r.imediato ? 3 : 2) : 1) : 0);
  const cur = () => (session && !session.secret ? session.key : null);
  const bk = (k) => { const b = Dx.book(k); b.risco = b.risco || { asked: {}, level: null }; return b.risco; };
  const real = (k) => (enabled() ? levelOf(raw(k)) : 0);
  const body = () => $("psico-body");
  const head = (title, sub) => { body().textContent = ""; $("psico-title").textContent = title; if (sub) body().appendChild(el("p", "uni-q", sub)); };
  const done = (label, fn) => { const b = el("button", "pill-btn primary", label || tr("Continuar", "Continue", "Continuar")); b.type = "button"; b.addEventListener("click", () => { closeModal("psico-modal"); if (fn) fn(); }); return b; };
  const LEVEL_NAME = [L("Sem risco identificado", "No risk identified", "Sin riesgo identificado"), L("Nível 1 · Ideação passiva", "Level 1 · Passive ideation", "Nivel 1 · Ideación pasiva"), L("Nível 2 · Ideação ativa / intenção", "Level 2 · Active ideation / intent", "Nivel 2 · Ideación activa / intención"), L("Nível 3 · Risco iminente / plano estruturado", "Level 3 · Imminent risk / structured plan", "Nivel 3 · Riesgo inminente / plan estructurado")];

  // ---------------------------------------------------------------- negligência
  const KINDS = {
    ignorou: { name: L("Indicadores de risco ignorados", "Risk indicators ignored", "Indicadores de riesgo ignorados"), why: L("O caso tinha queixa grave e a área de risco não foi investigada.", "The case had a serious complaint and the risk area was not investigated.", "El caso tenía una queja grave y no se investigó el área de riesgo."), ethics: L("Código de Ética, princípios fundamentais e Art. 1º (dever de zelar pela saúde e integridade): avaliar o risco faz parte do cuidado.", "Code of Ethics, fundamental principles and Art. 1 (duty to protect health and integrity): assessing risk is part of care.", "Código de Ética, principios fundamentales y Art. 1 (deber de velar por la salud e integridad): evaluar el riesgo es parte del cuidado."), advice: L("Pergunte com clareza, sem julgamento, a partir da 2ª consulta; reavalie a cada sessão.", "Ask clearly, without judgment, from the 2nd session; reassess every session.", "Pregunte con claridad, sin juzgar, desde la 2.ª consulta; reevalúe en cada sesión.") },
    sem_plano: { name: L("Risco moderado/alto sem Plano de Segurança", "Moderate/high risk without a Safety Plan", "Riesgo moderado/alto sin Plan de Seguridad"), why: L("Havia ideação ativa e nenhum plano de segurança foi pactuado.", "There was active ideation and no safety plan was agreed.", "Había ideación activa y no se pactó ningún plan de seguridad."), ethics: L("Intervenção proporcional ao risco (Art. 1º e diretrizes do CFP): risco ativo pede plano, rede e contato mais frequente.", "Care proportional to risk (Art. 1 and CFP guidelines): active risk calls for a plan, network and more frequent contact.", "Intervención proporcional al riesgo (Art. 1 y directrices del CFP): el riesgo activo pide plan, red y contacto más frecuente."), advice: L("Pactue com a pessoa, por escrito, os 6 passos do Plano de Segurança e revise sempre.", "Agree in writing with the person on the 6 steps of the Safety Plan and review it often.", "Pacte por escrito con la persona los 6 pasos del Plan de Seguridad y revíselo siempre.") },
    omissao: { name: L("Omissão diante do risco", "Omission in the face of risk", "Omisión ante el riesgo"), why: L("Optou-se por não tocar no assunto ou por manter sigilo absoluto, com o risco em aberto.", "You chose not to bring it up or kept absolute confidentiality, leaving the risk open.", "Se optó por no tocar el tema o mantener sigilo absoluto, con el riesgo abierto."), ethics: L("Art. 9º (sigilo) e Art. 10 (quebra de sigilo em conflito, pelo menor prejuízo): o sigilo não protege a omissão quando há risco à vida.", "Art. 9 (confidentiality) and Art. 10 (breaking it in conflict, with least harm): confidentiality does not protect omission when life is at risk.", "Art. 9 (sigilo) y Art. 10 (ruptura en conflicto, por el menor perjuicio): el sigilo no protege la omisión cuando hay riesgo de vida."), advice: L("Acione a rede (família, SAMU 192, CAPS) explicando à pessoa o que fará e por quê, e mantenha o acolhimento.", "Activate the network (family, SAMU 192, CAPS) explaining to the person what you will do and why, and keep the warm contact.", "Active la red (familia, SAMU 192, CAPS) explicando a la persona qué hará y por qué, y mantenga el acogimiento.") },
    crise: { name: L("Mensagem de emergência ignorada", "Emergency message ignored", "Mensaje de emergencia ignorado"), why: L("A pessoa pediu ajuda fora do expediente e não houve resposta.", "The person asked for help outside working hours and got no answer.", "La persona pidió ayuda fuera del horario y no hubo respuesta."), ethics: L("Dever de não abandono e de encaminhamento (Código de Ética): se não puder atender, oriente e encaminhe para a rede de crise.", "Duty not to abandon and to refer (Code of Ethics): if you cannot attend, guide and refer to the crisis network.", "Deber de no abandono y de derivación (Código de Ética): si no puede atender, oriente y derive a la red de crisis."), advice: L("Responda com acolhimento breve, combine um encaixe ou encaminhe (CVV 188, CAPS, SAMU 192).", "Reply with brief support, arrange an extra slot or refer (CVV 188, CAPS, SAMU 192).", "Responda con acogimiento breve, acuerde un encaje o derive (CVV 188, CAPS, SAMU 192).") }
  };
  function neg(k, n, kind) {
    if (!enabled() || (session && session.difSkip)) return;
    const r = rec(k); r.neglig = (r.neglig || 0) + n; r.negLog = r.negLog || [];
    r.negLog.push({ sess: session ? session.sess : 0, kind, n, week: state.week || 1 });
    if (session && session.key === k) session.negligenceScore = r.neglig;
    saveState();
  }
  const negScore = (k) => (rec(k).neglig || 0);

  // ---------------------------------------------------------------- avaliação graduada (aberta depois de investigar "risco")
  const QS = [
    { k: "ideacao", ask: L("Você tem pensado em morrer ou em se machucar?", "Have you been thinking about dying or hurting yourself?", "¿Has pensado en morir o en hacerte daño?"), yes: L("Tenho, sim... às vezes penso nisso.", "Yes... sometimes I think about it.", "Sí... a veces lo pienso."), no: L("Não, isso não.", "No, not that.", "No, eso no.") },
    { k: "plano", ask: L("Você já pensou em como faria? Existe um plano?", "Have you thought about how you would do it? Is there a plan?", "¿Has pensado en cómo lo harías? ¿Hay un plan?"), yes: L("Já pensei em como... e em quando, até.", "I've thought about how... and even when.", "Ya pensé en cómo... e incluso cuándo."), no: L("Plano, não. É só o pensamento que vem.", "No plan. It's just the thought that comes.", "Plan, no. Es solo el pensamiento que viene.") },
    { k: "imediato", ask: L("Você pretende fazer isso em breve, ou tem os meios à mão?", "Do you intend to do it soon, or do you have the means at hand?", "¿Piensas hacerlo pronto, o tienes los medios a mano?"), yes: L("Tenho o que preciso aqui... e tem sido difícil resistir hoje.", "I have what I need here... and resisting has been hard today.", "Tengo lo que necesito aquí... y hoy ha sido difícil resistir."), no: L("Não, não pretendo. Só queria que a dor parasse.", "No, I don't intend to. I just wish the pain would stop.", "No, no pienso hacerlo. Solo quería que el dolor parara.") }
  ];
  function assess(k) {
    k = k || cur();
    const r = k && raw(k);
    if (!k || !enabled() || !r || !Dx.book(k).found.risco) return false;
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("risco"), 500); 
    const b = bk(k);
    head(`🚨 ${tr("Avaliação de risco", "Risk assessment", "Evaluación de riesgo")}`, tr("Pergunte com clareza e sem julgamento. Perguntar não coloca a ideia na cabeça: costuma aliviar.", "Ask clearly and without judgment. Asking does not plant the idea: it usually brings relief.", "Pregunte con claridad y sin juzgar. Preguntar no pone la idea: suele aliviar."));
    QS.forEach((q, i) => {
      const asked = b.asked[q.k] !== undefined, blocked = i > 0 && (b.asked[QS[i - 1].k] === undefined || b.asked[QS[i - 1].k] === false);
      const row = el("div", "say-row" + (asked ? " pat" : " you"));
      row.appendChild(el("b", "", `🩺 ${pick(q.ask)}`));
      if (asked) row.appendChild(el("p", "say-quote", `“${pick(b.asked[q.k] ? q.yes : q.no)}”`));
      else if (blocked) row.appendChild(el("small", "", tr("Sem ideação, não há o que aprofundar.", "Without ideation there is nothing to probe further.", "Sin ideación no hay más que profundizar.")));
      else { const bt = el("button", "pill-btn small", tr("Perguntar", "Ask", "Preguntar")); bt.type = "button"; bt.addEventListener("click", () => { b.asked[q.k] = Boolean(r[q.k]); sfx(r[q.k] ? "bad" : "click"); Wheel.gain("raciocinio", 1); saveState(); assess(k); }); row.appendChild(bt); }
      body().appendChild(row);
    });
    const complete = QS.every((q, i) => b.asked[q.k] !== undefined || (i > 0 && b.asked[QS[i - 1].k] === false)) || QS.some((q) => b.asked[q.k] === false);
    if (complete && b.asked.ideacao !== undefined) {
      const lvl = levelOf({ ideacao: Boolean(b.asked.ideacao), plano: Boolean(b.asked.plano), imediato: Boolean(b.asked.imediato) });
      b.level = lvl; saveState();
      body().appendChild(el("h3", "aqx-h", `${["🟢", "🟡", "🟠", "🔴"][lvl]} ${pick(LEVEL_NAME[lvl])}`));
      const need = [tr("Sem ideação: reavalie nas próximas consultas.", "No ideation: reassess in the next sessions.", "Sin ideación: reevalúe en las próximas consultas."), tr("Fortaleça os fatores de proteção e acompanhe de perto.", "Strengthen protective factors and follow up closely.", "Fortalezca los factores de protección y haga un seguimiento cercano."), tr("Pacte um Plano de Segurança com a pessoa.", "Agree on a Safety Plan with the person.", "Pacte un Plan de Seguridad con la persona."), tr("Protocolo obrigatório: manejo de crise e decisão ética sobre o sigilo.", "Mandatory protocol: crisis management and the ethical decision about confidentiality.", "Protocolo obligatorio: manejo de crisis y decisión ética sobre el sigilo.")][lvl];
      body().appendChild(el("p", "shop-note", need));
      const row = el("div", "say-btns");
      if (lvl === 1 && !b.protecao) { const x = el("button", "pill-btn primary", tr("Fortalecer fatores de proteção", "Strengthen protective factors", "Fortalecer factores de protección")); x.type = "button"; x.addEventListener("click", () => protect(k)); row.appendChild(x); }
      if (lvl === 2 && !b.plano) { const x = el("button", "pill-btn primary", tr("Pactuar o Plano de Segurança", "Agree on the Safety Plan", "Pactar el Plan de Seguridad")); x.type = "button"; x.addEventListener("click", () => plan(k)); row.appendChild(x); }
      if (lvl === 3 && !b.etica) { const x = el("button", "pill-btn primary", tr("Decidir a conduta (sigilo)", "Decide the course of action (confidentiality)", "Decidir la conducta (sigilo)")); x.type = "button"; x.addEventListener("click", () => decide(k)); row.appendChild(x); }
      row.appendChild(done(tr("Fechar", "Close", "Cerrar")));
      body().appendChild(row);
    } else body().appendChild(done(tr("Fechar", "Close", "Cerrar")));
    openModal("psico-modal");
    return true;
  }
  // o rótulo do botão que abre a avaliação a partir do popup do Investigar
  const canAssess = (k) => Boolean(enabled() && k && raw(k) && Dx.book(k).found.risco);

  // ---------------------------------------------------------------- nível 1: fatores de proteção
  const PROT = [
    { t: L("Vínculos e rede de apoio (quem está por perto)", "Bonds and support network (who is nearby)", "Vínculos y red de apoyo (quién está cerca)"), ok: true },
    { t: L("Motivos para viver e planos para o futuro", "Reasons for living and plans for the future", "Motivos para vivir y planes de futuro"), ok: true },
    { t: L("Rotina, sono e alimentação cuidados", "Care for routine, sleep and eating", "Rutina, sueño y alimentación cuidados"), ok: true },
    { t: L("Adesão ao tratamento e acesso rápido a ajuda", "Treatment adherence and quick access to help", "Adhesión al tratamiento y acceso rápido a ayuda"), ok: true },
    { t: L("Pedir que a pessoa prometa que nunca mais vai pensar nisso", "Asking the person to promise never to think about it again", "Pedir que la persona prometa que nunca más pensará en eso"), ok: false }
  ];
  function protect(k) {
    const sel = {};
    const render = () => {
      head(`🛡️ ${tr("Fatores de proteção", "Protective factors", "Factores de protección")}`, tr("Escolha as ações que realmente fortalecem a proteção (mínimo 2).", "Choose the actions that really strengthen protection (at least 2).", "Elija las acciones que realmente fortalecen la protección (mínimo 2)."));
      PROT.forEach((p, i) => { const on = Boolean(sel[i]); const bt = el("button", "dx-opt" + (on ? " on" : ""), `${on ? "✓ " : ""}${pick(p.t)}`); bt.type = "button"; bt.addEventListener("click", () => { sel[i] = !on; render(); }); body().appendChild(bt); });
      const chosen = PROT.filter((_, i) => sel[i]), good = chosen.filter((p) => p.ok).length, bad = chosen.length - good;
      const go = el("button", "pill-btn primary", tr("Combinar com a pessoa", "Agree with the person", "Acordar con la persona")); go.type = "button"; go.disabled = good < 2;
      go.addEventListener("click", () => {
        const b = bk(k);
        if (bad) { sfx("bad"); showToast(tr("Uma promessa não protege: reveja as ações.", "A promise does not protect: review the actions.", "Una promesa no protege: revise las acciones.")); return; }
        b.protecao = true; Wheel.gain("raciocinio", 1); Wheel.gain("anamnese", 1); state.xp += 3; sfx("good"); saveState(); updateHud(); closeModal("psico-modal"); showToast(tr("Fatores de proteção combinados.", "Protective factors agreed.", "Factores de protección acordados."));
      });
      body().appendChild(go); openModal("psico-modal");
    };
    render();
  }

  // ---------------------------------------------------------------- nível 2: Plano de Segurança (6 passos, Stanley-Brown)
  const PLAN = [
    { t: L("Sinais de alerta (pensamentos, emoções e situações que antecedem a crise)", "Warning signs (thoughts, emotions and situations that come before the crisis)", "Señales de alerta (pensamientos, emociones y situaciones que anteceden a la crisis)"), ok: true },
    { t: L("Estratégias internas para se acalmar sozinha(o)", "Internal strategies to calm down alone", "Estrategias internas para calmarse a solas"), ok: true },
    { t: L("Pessoas e lugares que ajudam a distrair", "People and places that help with distraction", "Personas y lugares que ayudan a distraer"), ok: true },
    { t: L("Pessoas de confiança a quem pedir ajuda (nomes e telefones)", "Trusted people to ask for help (names and numbers)", "Personas de confianza a quienes pedir ayuda (nombres y teléfonos)"), ok: true },
    { t: L("Profissionais e serviços: terapeuta, CAPS, CVV 188, SAMU 192", "Professionals and services: therapist, CAPS, CVV 188, SAMU 192", "Profesionales y servicios: terapeuta, CAPS, CVV 188, SAMU 192"), ok: true },
    { t: L("Tornar o ambiente seguro (afastar medicamentos, armas e objetos cortantes)", "Make the environment safe (remove medication, firearms and sharp objects)", "Hacer el ambiente seguro (alejar medicamentos, armas y objetos cortantes)"), ok: true },
    { t: L("Prometer 'nunca mais' e assinar um contrato de não se machucar", "Promise 'never again' and sign a no-self-harm contract", "Prometer 'nunca más' y firmar un contrato de no hacerse daño"), ok: false },
    { t: L("Não contar para a família, para não preocupar", "Not telling the family, so they don't worry", "No contarle a la familia, para no preocuparla"), ok: false }
  ];
  function plan(k) {
    const sel = {};
    const render = () => {
      head(`📋 ${tr("Plano de Segurança", "Safety Plan", "Plan de Seguridad")}`, tr("Monte o plano COM a pessoa: marque os passos que fazem parte de um plano de segurança (pelo menos 5 dos 6 corretos e nenhum errado).", "Build the plan WITH the person: tick the steps that belong in a safety plan (at least 5 of the 6 right ones and no wrong ones).", "Monte el plan CON la persona: marque los pasos que forman parte de un plan de seguridad (al menos 5 de los 6 correctos y ninguno equivocado)."));
      PLAN.forEach((p, i) => { const on = Boolean(sel[i]); const bt = el("button", "dx-opt" + (on ? " on" : ""), `${on ? "✓ " : ""}${pick(p.t)}`); bt.type = "button"; bt.addEventListener("click", () => { sel[i] = !on; render(); }); body().appendChild(bt); });
      const chosen = PLAN.filter((_, i) => sel[i]), good = chosen.filter((p) => p.ok).length, bad = chosen.length - good;
      body().appendChild(el("p", "shop-note", `${tr("Passos certos", "Right steps", "Pasos correctos")}: ${good}/6`));
      const go = el("button", "pill-btn primary", tr("Pactuar o plano", "Agree on the plan", "Pactar el plan")); go.type = "button"; go.disabled = good < 5;
      go.addEventListener("click", () => {
        if (bad) { sfx("bad"); showToast(tr("Tem passo que não protege: promessas e segredo enfraquecem o plano.", "A step does not protect: promises and secrecy weaken the plan.", "Hay un paso que no protege: las promesas y el secreto debilitan el plan.")); return; }
        const b = bk(k); b.plano = true; Wheel.gain("raciocinio", 2); Wheel.gain("anamnese", 1); Wheel.gain("devolutiva", 1); state.xp += 8; state.affinity = clamp(state.affinity + 5, 0, 100); sfx("good"); saveState(); updateHud(); closeModal("psico-modal");
        showToast(tr("Plano de Segurança pactuado (+8 XP, +5 vínculo).", "Safety Plan agreed (+8 XP, +5 bond).", "Plan de Seguridad pactado (+8 XP, +5 vínculo)."));
      });
      body().appendChild(go); openModal("psico-modal");
    };
    render();
  }

  // ---------------------------------------------------------------- nível 3 / dilema: decisão ética sobre o sigilo
  const OPTS = {
    A: { icon: "🤐", name: L("Manter sigilo absoluto (por medo de romper o vínculo)", "Keep absolute confidentiality (for fear of breaking the bond)", "Mantener sigilo absoluto (por miedo a romper el vínculo)"), say: L("Prefiro não avisar ninguém. Se eu falar, ela pode não voltar.", "I'd rather not tell anyone. If I speak up, they may not come back.", "Prefiero no avisar a nadie. Si hablo, quizá no vuelva.") },
    B: { icon: "🤝", name: L("Acionar a rede de apoio (família/responsáveis, SAMU, CAPS) explicando e acolhendo", "Activate the support network (family, SAMU, CAPS) explaining and staying supportive", "Activar la red de apoyo (familia, SAMU, CAPS) explicando y acogiendo"), say: L("Vou chamar quem pode te proteger e explico cada passo. Eu continuo com você.", "I will call those who can protect you and explain each step. I stay with you.", "Voy a llamar a quien puede protegerte y te explico cada paso. Sigo contigo.") },
    C: { icon: "📢", name: L("Acionar a rede sem explicar nem acolher (postura punitiva/alarmista)", "Activate the network without explaining or supporting (punitive/alarmist stance)", "Activar la red sin explicar ni acoger (postura punitiva/alarmista)"), say: L("Isso é gravíssimo. Já liguei para a sua família e ponto final.", "This is extremely serious. I've already called your family, end of story.", "Esto es gravísimo. Ya llamé a tu familia y punto.") }
  };
  function decide(k, opts = {}) {
    k = k || cur();
    head(`⚖️ ${tr("Decisão ética: sigilo e proteção", "Ethical decision: confidentiality and protection", "Decisión ética: sigilo y protección")}`, tr("Há risco iminente. O Código de Ética (Art. 9º e 10) admite a quebra de sigilo pelo menor prejuízo. Qual conduta você escolhe?", "There is imminent risk. The Code of Ethics (Art. 9 and 10) allows breaking confidentiality with the least harm. Which course do you choose?", "Hay riesgo inminente. El Código de Ética (Art. 9 y 10) admite romper el sigilo por el menor perjuicio. ¿Qué conducta elige?"));
    Object.keys(OPTS).forEach((id) => {
      const o = OPTS[id], bt = el("button", "dx-opt", `${o.icon} ${id}) ${pick(o.name)}`); bt.type = "button";
      bt.addEventListener("click", () => resolveEthics(k, id, opts));
      body().appendChild(bt); body().appendChild(el("small", "say-quote", `“${pick(o.say)}”`));
    });
    openModal("psico-modal");
  }
  function resolveEthics(k, id, opts = {}) {
    const b = bk(k), r = rec(k), lines = [];
    b.etica = id;
    if (id === "A") { neg(k, 3, "omissao"); state.affinity = clamp(state.affinity + 3, 0, 100); Wheel.rep().clinica -= 3; if (session) session.riskFail = true; lines.push(tr("Falha grave: o risco ficou em aberto por medo de perder o vínculo. −3 de Reputação da Clínica; o resultado da avaliação fica inconclusivo/de risco.", "Serious failure: the risk stayed open for fear of losing the bond. −3 Clinic Reputation; the assessment result is inconclusive/at risk.", "Falla grave: el riesgo quedó abierto por miedo a perder el vínculo. −3 de Reputación de la Clínica; el resultado de la evaluación queda no concluyente/de riesgo.")); sfx("bad"); }
    else if (id === "B") { Wheel.rep().clinica += 3; state.affinity = clamp(state.affinity + 4, 0, 100); r.adesao = Math.min(100, (r.adesao || 60) + 10); Wheel.gain("devolutiva", 1); Wheel.gain("multi", 2); state.xp += 8; lines.push(tr("Conduta proporcional: a rede foi acionada com explicação e acolhimento. +3 de Reputação da Clínica, mais vínculo e adesão.", "Proportional response: the network was activated with explanation and support. +3 Clinic Reputation, more bond and adherence.", "Conducta proporcional: se activó la red con explicación y acogimiento. +3 de Reputación de la Clínica, más vínculo y adhesión.")); sfx("good"); }
    else { state.affinity = clamp(state.affinity - 15, 0, 100); Wheel.rep().clinica -= 1; r.adesao = Math.max(0, (r.adesao || 60) - 15); lines.push(tr("Postura alarmista: a proteção veio, mas sem explicar nem acolher a aliança caiu (−15 de vínculo, −1 de Reputação).", "Alarmist stance: protection came, but without explaining or supporting the alliance dropped (−15 bond, −1 Reputation).", "Postura alarmista: llegó la protección, pero sin explicar ni acoger la alianza cayó (−15 vínculo, −1 Reputación).")); sfx("bad"); }
    saveState(); updateHud();
    head(`⚖️ ${tr("Resultado da decisão", "Result of the decision", "Resultado de la decisión")}`, null);
    lines.forEach((t) => body().appendChild(el("p", "shop-note", t)));
    body().appendChild(el("p", "shop-note", tr("Fundamentação: Código de Ética do Psicólogo, Art. 9º e 10; Lei 13.819/2019. Veja o Manual → Ética e manejo de risco.", "Grounds: Psychologist's Code of Ethics, Art. 9 and 10; Law 13.819/2019. See Manual → Ethics and risk management.", "Fundamentación: Código de Ética del Psicólogo, Art. 9 y 10; Ley 13.819/2019. Vea el Manual → Ética y manejo de riesgo.")));
    body().appendChild(done(null, opts.then)); openModal("psico-modal");
  }

  // ---------------------------------------------------------------- fim de cada consulta: negligência e mensagens de crise
  function endSession(s) {
    if (!enabled() || s.secret || s.difSkip) return;
    const k = s.key, lvl = real(k);
    if (!lvl) return;
    const b = bk(k), sess = s.sess || 1;
    if (sess >= 2 && !Dx.book(k).found.risco && !s.riskSeen) neg(k, 1, "ignorou");                      // (a) queixa grave e risco nunca investigado
    if (b.level >= 2 && !b.plano) neg(k, 2, "sem_plano");                                                // (b) risco moderado/alto sem plano
    if (sess <= 3 && lvl >= 1) {                                                                          // mensagem de emergência fora do expediente
      const p = lvl >= 2 ? 0.6 : 0.25;
      if ((hash(k + sess + (state.week || 1)) % 100) / 100 < p) { state.crises = state.crises || []; state.crises.push({ id: `${k}:${state.week || 1}:${sess}`, caseId: k, week: state.week || 1, day: state.dayIndex, sess, status: "new" }); }
    }
  }
  // (d) antes de cada consulta: crise sem resposta vira negligência; desfecho de crise se passou do limite
  function beforeSession(k) {
    if (!enabled()) return false;
    const r = rec(k);
    (state.crises || []).forEach((c) => { if (c.caseId === k && c.status === "new") { c.status = "ignored"; neg(k, 2, "crise"); } });
    if (r.closed) { showToast(tr("Este caso foi encerrado por uma crise: a consulta não acontece.", "This case was closed after a crisis: the session does not take place.", "Este caso se cerró tras una crisis: la consulta no se realiza.")); skipAppointment(k, false); return true; }
    if ((r.neglig || 0) >= LIMIT) { outcome(k); return true; }
    return false;
  }
  function skipAppointment(k, penal) {
    const day = currentDayKey(), idx = state.apptIndex;
    state.results[resultKey(day, idx)] = { stars: 0, finalAffinity: 0, coins: 0, dx: null, late: false, crisis: Boolean(penal) };
    state.clock = Math.max(state.clock, slotStart(SCHEDULE[day][idx]) + 10);
    advanceSchedule(day); saveState(); updateHud(); renderHome();
  }
  function outcome(k) {
    const r = rec(k), name = pick(CASES[k].name);
    r.closed = "crise"; r.q = r.q || [];
    const w = state.week || 1;
    Wheel.rep().clinica -= REP_PENALTY;
    state.advertencias = state.advertencias || [];
    state.advertencias.push({ caso: k, semana: w, texto: tr(`Advertência ética: caso de ${name} interrompido por crise após omissão de manejo de risco.`, `Ethical warning: ${name}'s case interrupted by a crisis after omitted risk management.`, `Advertencia ética: caso de ${name} interrumpido por una crisis tras omisión del manejo de riesgo.`) });
    skipAppointment(k, true);
    head(`🚨 ${tr("Notificação de emergência", "Emergency notification", "Notificación de emergencia")}`, null);
    body().appendChild(el("div", "say-row pat", "")); body().lastChild.appendChild(el("b", "", tr("Ligação da família e do hospital", "Call from the family and the hospital", "Llamada de la familia y del hospital")));
    body().lastChild.appendChild(el("p", "", tr(`${name} não veio à consulta. A família ligou: houve uma crise durante a noite e ${name} foi levada(o) ao pronto atendimento. O caso foi interrompido e encaminhado à rede de saúde.`, `${name} did not come to the session. The family called: there was a crisis during the night and ${name} was taken to the emergency unit. The case was interrupted and referred to the health network.`, `${name} no vino a la consulta. La familia llamó: hubo una crisis durante la noche y ${name} fue llevada(o) a urgencias. El caso se interrumpió y se derivó a la red de salud.`)));
    body().appendChild(el("p", "shop-note", tr(`Consultas zeradas, −${REP_PENALTY} de Reputação da Clínica e uma advertência ética no histórico da clínica.`, `Session zeroed, −${REP_PENALTY} Clinic Reputation and an ethical warning in the clinic's history.`, `Consulta anulada, −${REP_PENALTY} de Reputación de la Clínica y una advertencia ética en el historial de la clínica.`)));
    const row = el("div", "say-btns"); const an = el("button", "pill-btn primary", `🧭 ${tr("Ver a Análise Ética do caso", "See the case's Ethical Analysis", "Ver el Análisis Ético del caso")}`); an.type = "button"; an.addEventListener("click", () => debrief(k));
    row.appendChild(an); row.appendChild(done(tr("Fechar", "Close", "Cerrar"))); body().appendChild(row);
    sfx("bad"); openModal("psico-modal");
  }

  // ---------------------------------------------------------------- Análise Ética (debriefing)
  function debrief(k) {
    const r = rec(k), log = r.negLog || [], name = pick(CASES[k].name);
    head(`🧭 ${tr("Análise Ética do Caso", "Ethical Analysis of the Case", "Análisis Ético del Caso")} · ${name}`, tr("Material pedagógico: veja o que passou despercebido, em que o Código de Ética se apoia e o que seria a conduta recomendada.", "Educational material: see what went unnoticed, what the Code of Ethics rests on and what the recommended course would be.", "Material pedagógico: vea qué pasó inadvertido, en qué se apoya el Código de Ética y cuál sería la conducta recomendada."));
    if (!log.length) body().appendChild(el("p", "shop-note", tr("Nenhuma falha registrada neste caso: a conduta foi adequada ao risco.", "No failures were recorded in this case: the conduct was proportionate to the risk.", "No se registraron fallas en este caso: la conducta fue adecuada al riesgo.")));
    const seen = {};
    log.forEach((x) => {
      if (seen[x.kind]) { seen[x.kind].n += 1; return; }
      seen[x.kind] = { n: 1 }; const K = KINDS[x.kind]; if (!K) return;
      const box = el("div", "say-row guard"); box.appendChild(el("b", "", `⚠️ ${pick(K.name)}`));
      box.appendChild(el("p", "", `${tr("Sinal ignorado", "Ignored sign", "Señal ignorada")}: ${pick(K.why)}`));
      box.appendChild(el("p", "", `${tr("Fundamentação", "Grounds", "Fundamentación")}: ${pick(K.ethics)}`));
      box.appendChild(el("p", "", `${tr("Conduta recomendada", "Recommended course", "Conducta recomendada")}: ${pick(K.advice)}`));
      body().appendChild(box);
    });
    body().appendChild(el("h3", "aqx-h", tr("Prevenção e rede de ajuda", "Prevention and help network", "Prevención y red de ayuda")));
    body().appendChild(el("p", "shop-note", tr("CVV 188 (24 h, gratuito) · SAMU 192 · CAPS e UPA do SUS. Diretrizes: CFP e OMS (LIVE LIFE). Lei 13.819/2019 (notificação de violência autoprovocada).", "CVV 188 (24 h, free) · SAMU 192 · CAPS and SUS emergency units. Guidelines: CFP and WHO (LIVE LIFE). Law 13.819/2019 (notification of self-inflicted violence).", "CVV 188 (24 h, gratuito) · SAMU 192 · CAPS y urgencias del SUS. Directrices: CFP y OMS (LIVE LIFE). Ley 13.819/2019 (notificación de violencia autoinfligida).")));
    body().appendChild(el("p", "shop-note muted", tr("Jogo educativo: em um caso real, busque supervisão e o CRP da sua região.", "Educational game: in a real case, seek supervision and your regional CRP.", "Juego educativo: en un caso real, busque supervisión y el CRP de su región.")));
    body().appendChild(done(tr("Fechar", "Close", "Cerrar"))); openModal("psico-modal");
  }
  const needsDebrief = (k) => enabled() && Boolean(raw(k));
  // ao fechar o caso: libera o módulo de debriefing no Manual
  function unlockDebrief(k) {
    if (!needsDebrief(k)) return false;
    state.manualOpen = state.manualOpen || {};
    ["etica-risco", "etica-plano", "etica-sigilo", "etica-luto"].forEach((id) => { state.manualOpen[id] = true; });
    return true;
  }

  // ---------------------------------------------------------------- Devolutiva: 4ª rodada (conduta diante do risco)
  const DEVOL = { who: L("(em voz baixa) E aquilo que eu te contei sobre me machucar... o que vai acontecer com isso?", "(in a low voice) And what I told you about hurting myself... what happens with that?", "(en voz baja) Y eso que te conté sobre hacerme daño... ¿qué va a pasar con eso?"), o: {
    omissao: [L("Melhor não tocarmos mais nesse assunto hoje, para não assustar ninguém.", "Better not to touch on that subject today, so we don't scare anyone.", "Mejor no tocar más ese tema hoy, para no asustar a nadie."), "A"],
    proporcional: [L("Obrigada por ter confiado isso a mim. Vamos rever o seu plano de segurança e combinar quem pode te apoiar. Se o risco aumentar, eu aciono a rede com você sabendo de cada passo.", "Thank you for trusting me with this. Let's review your safety plan and agree on who can support you. If the risk rises, I will activate the network with you knowing every step.", "Gracias por confiarme esto. Revisemos tu plan de seguridad y acordemos quién puede apoyarte. Si el riesgo aumenta, activo la red y tú sabrás cada paso."), "B"],
    punitiva: [L("Isso é muito sério. Vou avisar a sua família agora, é obrigatório.", "This is very serious. I'm going to tell your family now, it's mandatory.", "Esto es muy serio. Voy a avisar a tu familia ahora, es obligatorio."), "C"] } };
  const devolRound = (k) => (enabled() && real(k) >= 1 ? DEVOL : null);
  function devolChoice(k, code) {   // devolve o ajuste de compreensão/aliança da 4ª rodada
    if (code === "A") { neg(k, 3, "omissao"); return { c: -1, a: -3 }; }
    if (code === "B") { Wheel.rep().clinica += 1; return { c: 1, a: 3 }; }
    return { c: 0, a: -3 };
  }

  // ---------------------------------------------------------------- avisos de conteúdo (selo discreto na agenda, no prontuário e na ficha)
  function warnTags(k) {
    const c = Dx.data().cases[k], list = (c && c.warn) || [];
    const t = (window.DX_DATA && DX_DATA.warnText) || {};
    return list.filter((x) => enabled() || !["risco", "autolesao"].includes(x)).map((x) => pick(t[x] || x));
  }
  const warnLabel = (k) => { const w = warnTags(k); return w.length ? `⚠️ ${tr("Aviso de conteúdo", "Content warning", "Aviso de contenido")}: ${w.join(", ")}` : ""; };

  // ---------------------------------------------------------------- crises no celular (phone.js / app.js)
  const crisisText = (c) => tr(`(mensagem, 23h47) Não estou bem hoje... acho que não consigo sozinha(o). Podemos conversar?`, `(message, 11:47 pm) I'm not okay today... I don't think I can do this alone. Can we talk?`, `(mensaje, 23:47) No estoy bien hoy... creo que no puedo sola(o). ¿Podemos hablar?`);
  const pendingCrises = () => (enabled() ? (state.crises || []).filter((c) => c.status === "new") : []);
  const CRISIS_ACTIONS = { support: L("Acolhimento breve e orientação por telefone", "Brief support and phone guidance", "Acogimiento breve y orientación telefónica"), slot: L("Agendar um encaixe de emergência", "Schedule an emergency slot", "Agendar un encaje de emergencia"), refer: L("Encaminhar para a emergência psiquiátrica / rede de proteção", "Refer to the psychiatric emergency / protection network", "Derivar a urgencias psiquiátricas / red de protección") };
  function crisisAct(id, act) {
    const c = (state.crises || []).find((x) => x.id === id); if (!c || c.status !== "new") return;
    c.status = act; const k = c.caseId;
    if (act === "support") { state.energy = clamp(state.energy - 5, 0, 100); state.xp += 3; Wheel.rep().clinica += 1; showToast(tr("Você acolheu e orientou por telefone. −5 energia, +3 XP.", "You supported and guided by phone. −5 energy, +3 XP.", "Acogiste y orientaste por teléfono. −5 energía, +3 XP.")); }
    else if (act === "slot") { state.energy = clamp(state.energy - 12, 0, 100); state.xp += 5; const r = rec(k); r.neglig = Math.max(0, (r.neglig || 0) - 1); Wheel.gain("anamnese", 1); showToast(tr("Encaixe de emergência agendado (−12 energia, +5 XP, −1 negligência).", "Emergency slot scheduled (−12 energy, +5 XP, −1 negligence).", "Encaje de emergencia agendado (−12 energía, +5 XP, −1 negligencia).")); }
    else { state.xp += 3; Wheel.gain("multi", 2); showToast(tr("Encaminhado à rede de proteção (+3 XP).", "Referred to the protection network (+3 XP).", "Derivado a la red de protección (+3 XP).")); }
    sfx(act === "refer" ? "click" : "good"); saveState(); updateHud();
    try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* nada */ }
    if (typeof renderPhone === "function") renderPhone();
  }

  return { enabled, real, level: levelOf, LEVEL_NAME, assess, canAssess, protect, plan, decide, resolveEthics, endSession, beforeSession, outcome, debrief, needsDebrief, unlockDebrief, devolRound, devolChoice, warnTags, warnLabel, pendingCrises, crisisText, crisisAct, CRISIS_ACTIONS, negScore, neg, LIMIT, KINDS };
})();
window.Risk = Risk;

"use strict";

// ===========================================================================
// Eventos aleatórios, dilemas éticos e estresse da psicóloga.
//  · Intercorrências do dia (35% de chance ao começar cada dia): falta repentina, pedido de encaixe, atraso, convite de supervisão, burocracia.
//  · Dilema ético semanal (a partir da semana 2): laudo para disputa judicial, sigilo, limites do acolhimento, atestado, e (se o manejo de
//    risco estiver ligado) um risco revelado, que usa a decisão A/B/C de risco.js.
//  · Estresse (state.estresse, 0–100): sobe com crises, encaixes e dilemas mal resolvidos; cai ao dormir e com autocuidado.
//      ≥ 60: −1 na nota das respostas e dormir devolve 10 de energia a menos · ≥ 85: laudos ficam menos coerentes (−0,1).
// As mensagens ficam no celular (Mensagens → "Acontecimentos"); sem resposta até o fim do dia, vale a opção "ignorar" do evento.
// Estado: state.estresse, state.eventos = { pend[], visto{}, denuncia, ultimoDilema }
// Fórmulas: docs/DESIGN-EVOLUCOES.md, bloco H.
// ===========================================================================
const Events = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const st = () => { const e = (state.eventos = state.eventos || {}); e.pend = e.pend || []; e.visto = e.visto || {}; e.denuncia = e.denuncia || 0; if (e.ultimoDilema === undefined) e.ultimoDilema = 0; return e; };
  const stress = () => Math.max(0, Math.min(100, state.estresse || 0));
  const addStress = (n) => { state.estresse = Math.max(0, Math.min(100, (state.estresse || 0) + n)); };
  const calm = (n) => addStress(-Math.abs(n));   // autocuidado: flores, aulas de esporte, supervisão
  const week = () => state.week || 1;
  const hash = (s) => String(s).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rep = () => Wheel.rep();
  const hasReception = () => typeof Career !== "undefined" && Career.st().equipe.recepcao;

  // ---------------------------------------------------------------- efeitos comuns
  // fx: { coins, energy, stress, xp, clinica, academica, denuncia, clock, laudo, devolutiva }
  function apply(fx) {
    if (fx.coins) state.coins = Math.max(0, state.coins + fx.coins);
    if (fx.energy) state.energy = Math.max(0, Math.min(100, state.energy + fx.energy));
    if (fx.stress) addStress(fx.stress);
    if (fx.xp) state.xp += fx.xp;
    if (fx.clinica) rep().clinica += fx.clinica;
    if (fx.academica) rep().academica = Math.max(0, rep().academica + fx.academica);
    if (fx.denuncia) st().denuncia += fx.denuncia;
    if (fx.clock) advanceClock(fx.clock);
    if (fx.laudo) Wheel.gain("laudo", fx.laudo);
    if (fx.devolutiva) Wheel.gain("devolutiva", fx.devolutiva);
    if (fx.multi) Wheel.gain("multi", fx.multi);
  }
  const fxText = (fx) => [fx.coins ? `🪙 ${fx.coins > 0 ? "+" : ""}${fx.coins}` : "", fx.energy ? `⚡ ${fx.energy > 0 ? "+" : ""}${fx.energy}` : "", fx.stress ? `😰 ${fx.stress > 0 ? "+" : ""}${fx.stress}` : "", fx.xp ? `⭐ +${fx.xp}` : "", fx.clinica ? `🏥 ${fx.clinica > 0 ? "+" : ""}${fx.clinica}` : "", fx.academica ? `🎓 ${fx.academica > 0 ? "+" : ""}${fx.academica}` : ""].filter(Boolean).join(" · ");

  // ---------------------------------------------------------------- tabela de acontecimentos
  const EVENTS = [
    { id: "falta", w: 3, kind: "event", icon: "📵", title: L("Falta repentina", "Sudden no-show", "Falta repentina"), text: L("Um paciente avisou que não consegue vir hoje. O horário ficou vago.", "A patient warned they cannot come today. The slot is empty.", "Un paciente avisó que no puede venir hoy. El horario quedó libre."), choices: [
      { t: L("Aproveitar para descansar", "Use it to rest", "Aprovechar para descansar"), fx: { energy: 10, stress: -3 } }, { t: L("Chamar alguém da lista de espera", "Call someone from the waiting list", "Llamar a alguien de la lista de espera"), fx: { coins: 12, energy: -4 } }], ignore: { stress: 1 } },
    { id: "encaixe", w: 3, kind: "event", icon: "🆘", title: L("Pedido de encaixe de emergência", "Emergency slot request", "Solicitud de encaje de emergencia"), text: L("Uma pessoa em sofrimento pede um encaixe ainda hoje.", "A person in distress asks for a slot today.", "Una persona en sufrimiento pide un encaje hoy mismo."), choices: [
      { t: L("Aceitar o encaixe", "Accept the slot", "Aceptar el encaje"), fx: { coins: 20, energy: -10, stress: 6, xp: 5, clock: 30, clinica: 1 } }, { t: L("Marcar para amanhã", "Book for tomorrow", "Agendar para mañana"), fx: { stress: 1 } }, { t: L("Recusar", "Decline", "Rechazar"), fx: { clinica: -1, stress: 3 }, unless: "recepcao" }], ignore: { clinica: -1, stress: 3 } },
    { id: "atraso", w: 2, kind: "event", icon: "⏰", title: L("Atraso do paciente", "Patient running late", "Retraso del paciente"), text: L("Um paciente avisou que vai atrasar 20 minutos.", "A patient said they'll be 20 minutes late.", "Un paciente avisó que llegará 20 minutos tarde."), choices: [
      { t: L("Esperar com calma", "Wait calmly", "Esperar con calma"), fx: { clock: 20, stress: -2 } }, { t: L("Encurtar a sessão", "Shorten the session", "Acortar la sesión"), fx: { coins: 5, stress: 3 } }], ignore: { stress: 2 } },
    { id: "supervisao", w: 2, kind: "event", icon: "🧑‍🏫", title: L("Convite de supervisão", "Supervision invitation", "Invitación de supervisión"), text: L("Uma colega experiente oferece uma hora de supervisão de caso.", "An experienced colleague offers an hour of case supervision.", "Una colega experimentada ofrece una hora de supervisión de casos."), choices: [
      { t: L("Aceitar (cuidar de quem cuida)", "Accept (caring for the caregiver)", "Aceptar (cuidar de quien cuida)"), fx: { stress: -10, xp: 8, clock: 45, devolutiva: 1 } }, { t: L("Recusar, estou sem tempo", "Decline, I have no time", "Rechazar, no tengo tiempo"), fx: { stress: 2 } }], ignore: { stress: 2 } },
    { id: "burocracia", w: 2, kind: "event", icon: "🗂️", title: L("Prazo de relatório", "Report deadline", "Plazo de informe"), text: L("Um relatório para o convênio vence hoje.", "An insurance report is due today.", "Un informe para el seguro vence hoy."), choices: [
      { t: L("Fazer agora", "Do it now", "Hacerlo ahora"), fx: { clock: 40, stress: 2, coins: 15 } }, { t: L("Pedir ajuda à equipe", "Ask the team for help", "Pedir ayuda al equipo"), fx: { coins: 8, stress: -1 }, need: "recepcao" }, { t: L("Deixar para depois", "Leave it for later", "Dejarlo para después"), fx: { stress: 4, clinica: -1 } }], ignore: { stress: 4, clinica: -1 } }
  ];
  const DILEMMAS = [
    { id: "judicial", kind: "dilemma", icon: "⚖️", title: L("Laudo para disputa judicial", "Report for a court dispute", "Informe para disputa judicial"), text: L("Um advogado pede que você conclua, em laudo, qual dos pais deve ficar com a guarda, com base em uma avaliação de uma sessão.", "A lawyer asks you to conclude, in a report, which parent should have custody, based on a one-session assessment.", "Un abogado te pide concluir, en un informe, cuál de los padres debe quedarse con la custodia, con base en una evaluación de una sesión."), choices: [
      { t: L("Emitir um documento restrito ao que a avaliação sustenta, com limitações", "Issue a document limited to what the assessment supports, with limitations", "Emitir un documento limitado a lo que la evaluación sustenta, con limitaciones"), fx: { academica: 1, coins: 30, laudo: 2, stress: 2 }, good: true, why: L("Correto: o laudo se limita ao que foi avaliado e declara os limites.", "Right: the report stays within what was assessed and states its limits.", "Correcto: el informe se limita a lo evaluado y declara sus límites.") },
      { t: L("Concluir além dos achados para agradar o cliente", "Conclude beyond the findings to please the client", "Concluir más allá de los hallazgos para complacer al cliente"), fx: { coins: 60, academica: -3, denuncia: 25, stress: 6 }, why: L("Errado: concluir além do que a avaliação sustenta fere o Código de Ética e pode gerar denúncia.", "Wrong: concluding beyond what the assessment supports breaches the Code of Ethics and can lead to a complaint.", "Incorrecto: concluir más allá de lo que la evaluación sustenta infringe el Código de Ética y puede generar una denuncia.") },
      { t: L("Recusar e sugerir uma perícia completa", "Decline and suggest a full forensic assessment", "Rechazar y sugerir una pericia completa"), fx: { academica: 1, stress: 1 }, good: true, why: L("Correto: o papel de perito é outro; sugerir a perícia adequada protege todos.", "Right: the expert's role is different; suggesting a proper assessment protects everyone.", "Correcto: el papel de perito es otro; sugerir la pericia adecuada protege a todos.") }] , ignore: { denuncia: 10, stress: 4 } },
    { id: "sigilo", kind: "dilemma", icon: "🤫", title: L("Sigilo em risco", "Confidentiality at risk", "Sigilo en riesgo"), text: L("No café, um colega comenta em voz alta detalhes de um caso e cita o nome do paciente.", "At the café, a colleague loudly discusses case details and names the patient.", "En el café, un colega comenta en voz alta detalles de un caso y cita el nombre del paciente."), choices: [
      { t: L("Corrigir com gentileza e lembrar o Código de Ética", "Kindly correct and recall the Code of Ethics", "Corregir con amabilidad y recordar el Código de Ética"), fx: { clinica: 1, stress: 1, devolutiva: 1 }, good: true, why: L("Correto: o sigilo protege a pessoa atendida em qualquer ambiente.", "Right: confidentiality protects the person served in any setting.", "Correcto: el sigilo protege a la persona atendida en cualquier ambiente.") },
      { t: L("Fingir que não ouviu", "Pretend not to hear", "Fingir que no oyó"), fx: { stress: 5 }, why: L("Omitir mantém o problema: o sigilo quebrado continua.", "Ignoring keeps the problem: the breach continues.", "Omitir mantiene el problema: el sigilo roto continúa.") },
      { t: L("Levar à supervisão ou ao conselho da clínica", "Take it to supervision or the clinic board", "Llevarlo a la supervisión o al consejo de la clínica"), fx: { stress: -5, academica: 1 }, good: true, why: L("Correto: buscar a instância certa é uma forma madura de cuidado.", "Right: seeking the proper body is a mature form of care.", "Correcto: buscar la instancia correcta es una forma madura de cuidado.") }], ignore: { stress: 5 } },
    { id: "limites", kind: "dilemma", icon: "🎁", title: L("Limites do acolhimento", "Limits of warmth", "Límites del acogimiento"), text: L("Uma paciente em acompanhamento traz um presente caro e pede para se encontrarem fora do consultório, como amigas.", "A patient in follow-up brings an expensive gift and asks to meet outside the office, as friends.", "Una paciente en seguimiento trae un regalo caro y pide encontrarse fuera del consultorio, como amigas."), choices: [
      { t: L("Manter o enquadre com acolhimento e explicar o porquê", "Keep the frame warmly and explain why", "Mantener el encuadre con acogimiento y explicar por qué"), fx: { clinica: 1, xp: 6, devolutiva: 1 }, good: true, why: L("Correto: o enquadre protege o vínculo terapêutico.", "Right: the frame protects the therapeutic bond.", "Correcto: el encuadre protege el vínculo terapéutico.") },
      { t: L("Aceitar um presente pequeno e recusar o encontro", "Accept a small gift and decline the meeting", "Aceptar un regalo pequeño y rechazar el encuentro"), fx: { clinica: 0, stress: 2 }, why: L("Meio-termo: um presente simbólico pode ser acolhido, mas exige clareza sobre os limites.", "Middle ground: a symbolic gift can be received, but needs clarity about limits.", "Punto medio: un regalo simbólico puede recibirse, pero exige claridad sobre los límites.") },
      { t: L("Ceder e mudar o setting", "Give in and change the setting", "Ceder y cambiar el setting"), fx: { clinica: -3, stress: 5 }, penal: 6, why: L("Errado: quebrar o setting confunde os papéis e prejudica o tratamento.", "Wrong: breaking the setting blurs roles and harms treatment.", "Incorrecto: romper el setting confunde los roles y perjudica el tratamiento.") }], ignore: { stress: 3 } },
    { id: "atestado", kind: "dilemma", icon: "📝", title: L("Pedido de atestado inadequado", "Inappropriate certificate request", "Solicitud de certificado inadecuado"), text: L("Alguém pede um atestado dizendo que 'está incapacitado', sem nunca ter sido avaliado por você.", "Someone asks for a certificate saying they are 'incapacitated', never having been assessed by you.", "Alguien pide un certificado que diga que 'está incapacitado', sin haber sido evaluado por ti."), choices: [
      { t: L("Explicar o que a psicologia pode atestar e propor uma avaliação", "Explain what psychology can certify and propose an assessment", "Explicar qué puede certificar la psicología y proponer una evaluación"), fx: { academica: 1, laudo: 1 }, good: true, why: L("Correto: só se atesta o que foi avaliado.", "Right: you only certify what was assessed.", "Correcto: solo se certifica lo evaluado.") },
      { t: L("Emitir o atestado para evitar conflito", "Issue it to avoid conflict", "Emitirlo para evitar conflicto"), fx: { coins: 15, academica: -2, denuncia: 15, stress: 4 }, why: L("Errado: atestar sem avaliação é infração ética.", "Wrong: certifying without assessment is an ethics breach.", "Incorrecto: certificar sin evaluación es una infracción ética.") }], ignore: { stress: 2 } },
    { id: "risco", kind: "dilemma", icon: "🚨", title: L("Risco revelado", "Risk disclosed", "Riesgo revelado"), text: L("Uma pessoa em acompanhamento conta que tem um plano e os meios para se machucar. Você precisa decidir a conduta agora.", "A person in follow-up tells you they have a plan and the means to harm themselves. You must decide your course now.", "Una persona en seguimiento cuenta que tiene un plan y los medios para hacerse daño. Debes decidir la conducta ahora."), riskOnly: true, choices: [{ t: L("Decidir a conduta (sigilo e proteção)", "Decide the course of action (confidentiality and protection)", "Decidir la conducta (sigilo y protección)"), risk: true }], ignore: { clinica: -2, stress: 8 } }
  ];

  // ---------------------------------------------------------------- sorteio (determinístico por dia)
  function pool(defs, filter) { return defs.filter(filter); }
  function pickWeighted(list, seed) { const total = list.reduce((n, e) => n + (e.w || 1), 0); let r = seed % total; for (const e of list) { r -= e.w || 1; if (r < 0) return e; } return list[0]; }
  function queue(def) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("eventos"), 500);  const e = st(); if (e.pend.some((x) => x.id === def.id)) return; e.pend.push({ id: def.id, kind: def.kind, week: week(), day: state.dayIndex }); setTimeout(() => showToast(`${def.icon} ${pick(def.title)}`), 1400); }
  // chamado por advanceDay (começo de cada dia)
  function newDay() {
    const e = st();
    expire();
    addStress(-15);                                                   // uma noite de sono alivia
    // dilema semanal: 1º dia da semana, a partir da 2ª semana
    if (state.dayIndex === 0 && week() >= 2 && e.ultimoDilema !== week()) {
      const useRisk = typeof Risk !== "undefined" && Risk.enabled() && activePatientWithRisk();
      const cand = DILEMMAS.filter((d) => (d.riskOnly ? useRisk : true));
      const d = pickWeighted(cand.map((x) => Object.assign({ w: 1 }, x)), hash(`d${week()}${(state.gen && state.gen.seq) || 0}`));
      e.ultimoDilema = week(); queue(d);
    }
    // intercorrência do dia: 35%
    if (hash(`e${week()}:${state.dayIndex}:${state.coins % 7}`) % 100 < 35) queue(pickWeighted(EVENTS, hash(`ev${week()}${state.dayIndex}`)));
    // denúncia acumulada
    if (e.denuncia >= 50) { e.denuncia = 0; state.advertencias = state.advertencias || []; state.advertencias.push({ caso: "-", semana: week(), texto: tr("Advertência ética: denúncia ao CRP por conduta profissional inadequada.", "Ethical warning: complaint to the CRP for inappropriate professional conduct.", "Advertencia ética: denuncia al CRP por conducta profesional inadecuada.") }); rep().clinica -= 5; addStress(10); setTimeout(() => showToast(`⚠️ ${tr("Denúncia ao CRP: −5 de Reputação da Clínica", "Complaint to the CRP: −5 Clinic Reputation", "Denuncia al CRP: −5 de Reputación de la Clínica")}`), 2400); }
  }
  const activePatientWithRisk = () => (typeof Care !== "undefined" ? Care.list() : []).find((id) => Risk.real(id) >= 1) || null;
  // o que não foi respondido até o fim do dia vale como "ignorar"
  function expire() {
    const e = st();
    e.pend = e.pend.filter((p) => {
      const def = defOf(p.id); if (!def || (p.week === week() && p.day === state.dayIndex)) return true;
      if (p.kind === "dilemma" && p.week === week()) return true;   // dilema vale a semana toda
      if (def.ignore) apply(def.ignore);
      return false;
    });
  }
  const defOf = (id) => EVENTS.concat(DILEMMAS).find((d) => d.id === id);
  const pending = () => st().pend;

  // ---------------------------------------------------------------- resposta
  function choose(id, i) {
    const e = st(), def = defOf(id), ch = def && def.choices[i];
    if (!ch) return false;
    if (ch.risk) {   // dilema de risco: usa a decisão A/B/C do manejo de risco
      const k = activePatientWithRisk(); if (!k) return false;
      e.pend = e.pend.filter((p) => p.id !== id); saveState();
      Risk.decide(k, { then: () => { try { window.dispatchEvent(new Event("neurosim:state")); } catch (er) { /* nada */ } } });
      return true;
    }
    apply(ch.fx || {});
    if (ch.penal && typeof Care !== "undefined") { const l = Care.list(); if (l.length) { const t = Care.st(l[hash(id + week()) % l.length]); t.progresso = Math.max(0, t.progresso - ch.penal); } }
    e.pend = e.pend.filter((p) => p.id !== id); e.visto[id] = week();
    saveState(); updateHud(); sfx(ch.good || (ch.fx && (ch.fx.stress || 0) <= 0) ? "good" : "click");
    showToast(`${def.icon} ${fxText(ch.fx || {})}${ch.why ? " · " + pick(ch.why) : ""}`);
    try { window.dispatchEvent(new Event("neurosim:state")); } catch (er) { /* nada */ }
    if (typeof renderPhone === "function") renderPhone();
    return true;
  }
  function viewData() {
    return pending().map((p) => { const def = defOf(p.id); if (!def) return null; return {
      id: def.id, kind: def.kind, icon: def.icon, title: pick(def.title), text: pick(def.text),
      choices: def.choices.map((c, i) => ({ i, t: pick(c.t), fx: fxText(c.fx || {}), hide: Boolean((c.unless === "recepcao" && hasReception()) || (c.need === "recepcao" && !hasReception())) })).filter((c) => !c.hide),
      label: def.kind === "dilemma" ? tr("Dilema ético", "Ethical dilemma", "Dilema ético") : tr("Acontecimento", "Event", "Acontecimiento") }; }).filter(Boolean);
  }

  return { stress, addStress, calm, newDay, pending, choose, viewData, EVENTS, DILEMMAS, st, expire };
})();
window.Events = Events;

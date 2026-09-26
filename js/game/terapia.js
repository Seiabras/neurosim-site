"use strict";

// ===========================================================================
// Psicoterapia contínua e Alta Clínica.
// Quem aceita continuar em terapia (mensagem depois da 4ª consulta) passa a ter sessões de acompanhamento na agenda (semanal enquanto o
// progresso é menor que 50%, quinzenal depois). Cada sessão faz subir o Progresso Terapêutico (0–100%); ao chegar a 100% com 6 sessões o
// jogador pode dar ALTA CLÍNICA (bônus de Reputação da Clínica) e o horário é liberado para sempre.
// Estado: state.therapy[caso] = { week, progresso, adesao, manut, faltas, proxima, alta, altaSemana, altaTipo, faltouEm, chamado }
//
// A ADESÃO (7.2) — o que a devolutiva decidiu chega aqui. `PsicoDx.openDevol` calcula `session.devol.adesao`
// (postura empática / clara / técnica / alarmista, jargão com família leiga, qualidade do laudo, diagnóstico
// certo ou errado) e guarda em `state.pat[caso].adesao`. Até a 7.1 esse número só multiplicava o progresso.
// Agora ele decide três coisas que o jogador sente:
//   · RESISTÊNCIA — nas primeiras sessões, quem saiu da devolutiva pouco convencido rende menos e diz por quê;
//   · FALTA DO PACIENTE — abaixo de ADESAO_FALTA a pessoa simplesmente não aparece na semana (determinístico
//     por caso+semana, para não virar sorteio a cada recarga);
//   · ABANDONO — faltas acumuladas com adesão frágil encerram o tratamento, e sobra uma ligação para fazer.
// Quem conduziu a devolutiva com jargão para uma família leiga não perde pontos na hora: perde o paciente
// três semanas depois. É essa a consequência que faltava.
// Fórmulas: docs/DESIGN-EVOLUCOES.md, bloco E (histórico).
// ===========================================================================
const Care = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const MANUT = 0.5;                       // marca de "sessão de acompanhamento" no campo sess da agenda
  const BASE = 9, NEED_SESSIONS = 6, EARLY_AT = 70;
  const ADESAO_FALTA = 58;        // abaixo disto o paciente pode não aparecer
  const ADESAO_FRAGIL = 45;       // abaixo disto, faltas acumuladas viram abandono
  const FALTAS_ABANDONO = 3;
  const RESIST_ATE = 3;           // a resistência se dissolve ao longo das 3 primeiras sessões
  const hash = (str) => String(str).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const all = () => (state.therapy = state.therapy || {});
  const week = () => state.week || 1;
  const st = (id) => {
    const t = all()[id]; if (!t) return null;
    if (t.progresso === undefined) { t.progresso = 0; t.adesao = ((state.pat || {})[id] || {}).adesao ?? 60; t.manut = 0; t.faltas = 0; t.proxima = null; t.alta = false; }
    return t;
  };
  const active = (id) => { const t = st(id); return Boolean(t && !t.alta && CASES[id] && !((state.pat || {})[id] || {}).closed); };
  const list = () => Object.keys(all()).filter(active);
  const freq = (t) => (t.progresso < 50 ? 1 : 2);   // semanas entre sessões

  // Resistência inicial: 0 (nenhuma) a 1 (máxima). Quem saiu da devolutiva com adesão baixa começa a terapia
  // de braços cruzados, e isso se dissolve com as sessões — não com o tempo.
  function resistencia(id) {
    const t = st(id); if (!t || t.manut >= RESIST_ATE) return 0;
    const falta = Math.max(0, 60 - (t.adesao || 0)) / 60;
    return Math.round(falta * (1 - t.manut / RESIST_ATE) * 100) / 100;
  }
  // Chance de o PACIENTE não aparecer nesta semana (0 a 32%). Determinística por caso+semana: recarregar a
  // página não sorteia de novo.
  const chanceFalta = (t) => (t.adesao >= ADESAO_FALTA ? 0 : Math.min(32, Math.round((ADESAO_FALTA - t.adesao) / 1.6)));
  function vaiFaltar(id, w) {
    const t = st(id); if (!t) return false;
    const ch = chanceFalta(t); if (!ch) return false;
    return hash(`${id}|falta|${w}`) % 100 < ch;
  }
  // a falta do paciente acontece uma vez por semana e deixa recado no celular
  function registrarFalta(id, w) {
    const t = st(id); if (!t || t.faltouEm === w) return;
    t.faltouEm = w; t.faltas += 1;
    t.adesao = clamp(Math.round(t.adesao - 6), 0, 100);
    t.progresso = Math.max(0, t.progresso - (typeof Career !== "undefined" ? Career.faltaPenalty() : 4));
    t.proxima = w + 1;
    state.inbox = state.inbox || [];
    if (!state.inbox.some((m) => m.caseId === id && m.kind === "faltou" && m.week === w)) state.inbox.push({ caseId: id, kind: "faltou", status: "info", week: w });
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("adesao"), 500);
  }
  // abandono: faltas acumuladas com adesão frágil. Não é fim de linha — fica uma ligação para fazer.
  function abandonou(id) {
    const t = st(id);
    return Boolean(t && !t.alta && t.faltas >= FALTAS_ABANDONO && t.adesao < ADESAO_FRAGIL);
  }
  function encerrarPorAbandono(id) {
    const t = st(id); if (!t) return;
    t.alta = "abandono"; t.altaSemana = week(); t.proxima = null;
    Wheel.rep().clinica -= 3;
    state.inbox = state.inbox || [];
    state.inbox.push({ caseId: id, kind: "abandono", status: "new", week: week() });
  }
  // a ligação: aceitar traz a pessoa de volta uma única vez, com a adesão que a conversa reconstrói
  function chamarDeVolta(id, aceitar) {
    const t = st(id); if (!t || t.alta !== "abandono") return false;
    if (!aceitar) { t.chamado = "recusado"; saveState(); return true; }
    if (t.chamado === "feito") return false;
    t.chamado = "feito"; t.alta = false; t.faltas = 0; t.faltouEm = null;
    t.adesao = clamp(Math.round(t.adesao + 14), 0, 100);
    t.proxima = week() + 1;
    Wheel.gain("devolutiva", 1);
    saveState();
    return true;
  }
  // chamado ao aceitar a terapia: a 1ª sessão de acompanhamento é na semana seguinte
  function onAccept(id) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("acompanhamento"), 500);  const t = st(id); if (t) t.proxima = week() + 1; }
  // ids com sessão de acompanhamento nesta semana (para FU.plan)
  function due(w) {
    return list().filter((id) => {
      const t = st(id); if (t.proxima === null || t.proxima === undefined) t.proxima = w;
      if (t.proxima > w) return false;
      if (t.faltouEm === w) return false;              // já faltou nesta semana: não volta para a agenda
      if (vaiFaltar(id, w)) { registrarFalta(id, w); return false; }
      return true;
    });
  }
  // fórmula do progresso: base × qualidade × adesão × vínculo (Anamnese) × bônus de boa sessão
  function delta(id, q) {
    const t = st(id);
    return BASE * (0.6 + 0.4 * q) * (0.5 + t.adesao / 100) * (1 + 0.05 * Wheel.level("anamnese")) * (q >= 0.7 ? 1.15 : 1) * (1 - 0.5 * resistencia(id));
  }
  // fim de uma sessão de acompanhamento (chamado por finishSession)
  function finish(id, q) {
    const t = st(id), d = delta(id, q), res = resistencia(id), antes = t.adesao;
    t.progresso = Math.min(100, Math.round((t.progresso + d) * 10) / 10);
    t.manut += 1; t.proxima = week() + freq(t); t.ultima = week();
    // a sessão também reconstrói (ou gasta) a adesão: é o único jeito de sair do buraco da devolutiva ruim
    t.adesao = clamp(Math.round(t.adesao + (q >= 0.7 ? 5 : q >= 0.45 ? 1 : -4)), 0, 100);
    Wheel.gain("anamnese", 1); if (q >= 0.7) Wheel.gain("devolutiva", 1);
    return { delta: Math.round(d * 10) / 10, progresso: t.progresso, manut: t.manut, adesao: t.adesao, dAdesao: t.adesao - antes, resist: res };
  }
  // vira a semana: quem tinha sessão marcada e faltou perde um pouco de progresso; alta precoce pode recair
  function weekRoll(fromWeek) {
    const msgs = [];
    let cap = typeof Career !== "undefined" ? Career.capacity() : 0;
    list().filter(abandonou).forEach((id) => { encerrarPorAbandono(id); msgs.push(id); });   // quem some, some por acumulado, não de uma vez
    list().forEach((id) => {
      const t = st(id);
      if (t.proxima !== null && t.proxima !== undefined && t.proxima <= fromWeek && t.ultima !== fromWeek) {
        if (cap > 0 && typeof Career !== "undefined") { cap -= 1; msgs.push(Career.delegate(id, cap)); return; }   // a equipe atende (estagiário/júnior)
        t.faltas += 1; t.progresso = Math.max(0, t.progresso - (typeof Career !== "undefined" ? Career.faltaPenalty() : 4)); t.proxima = fromWeek + 1;
      }
    });
    Object.keys(all()).forEach((id) => {
      const t = st(id);
      if (t && t.alta === "precoce" && week() - (t.altaSemana || 0) <= 4 && ((id.length * 7 + week() * 13 + (t.altaSemana || 0)) % 10) === 0) {   // ~10% por semana, de forma determinística por caso
        t.alta = false; t.progresso = 60; t.proxima = week() + 1; msgs.push(id);
      }
    });
    return msgs;
  }
  const canDischarge = (id) => { const t = st(id); return Boolean(t && !t.alta && t.progresso >= 100 && t.manut >= NEED_SESSIONS); };
  const canEarly = (id) => { const t = st(id); return Boolean(t && !t.alta && t.progresso >= EARLY_AT && !canDischarge(id)); };
  // alta clínica: libera o horário e paga em Reputação da Clínica; a alta precoce (progresso ≥ 70%) paga menos e pode recair
  function discharge(id) {
    const t = st(id); if (!t || t.alta) return null;
    const full = canDischarge(id); if (!full && !canEarly(id)) return null;
    const out = { full, lines: [] };
    t.alta = full ? "completa" : "precoce"; t.altaSemana = week();
    const r = Wheel.rep();
    if (full) {
      const bonus = 6 + (Wheel.active("devolutiva") ? 4 : 0);
      r.clinica += bonus; state.xp += 30; state.coins += 40;
      out.lines.push(`🎓 ${tr("Alta clínica", "Clinical discharge", "Alta clínica")}: 🏥 +${bonus} · ⭐ +30 · 🪙 +40`);
      if (Wheel.active("multi") || (id.length + week()) % 4 === 0) {   // indicação: paciente novo pela rede (Gen, quando existir) ou bônus
        if (typeof Gen !== "undefined" && Gen.refer) { Gen.refer("alta"); out.lines.push(`🩺 ${tr("Ele(a) indicou alguém para a clínica.", "They referred someone to the clinic.", "Recomendó a alguien a la clínica.")}`); }
        else { state.coins += 15; r.clinica += 1; out.lines.push(`🩺 ${tr("Ele(a) indicou a clínica a um conhecido: 🪙 +15", "They recommended the clinic to an acquaintance: 🪙 +15", "Recomendó la clínica a un conocido: 🪙 +15")}`); }
      }
    } else { r.clinica += 2; state.xp += 15; out.lines.push(`🎓 ${tr("Alta precoce (pode haver recaída)", "Early discharge (relapse possible)", "Alta temprana (puede haber recaída)")}: 🏥 +2 · ⭐ +15`); }
    state.inbox = state.inbox || [];
    state.inbox.push({ caseId: id, kind: "alta", status: "info", week: week() });
    saveState(); updateHud(); sfx("levelup");
    return out;
  }
  // Quem chega resistente diz isso com a boca, não com uma barra. Uma frase antes da fala da sessão,
  // só enquanto a resistência da devolutiva não se dissolveu.
  const RESISTE = [
    L("'Eu vim porque estava marcado. Mas eu ainda não entendi bem o que a gente vai fazer aqui.'", "'I came because it was scheduled. But I still do not really get what we are going to do here.'", "'Vine porque estaba agendado. Pero todavía no entiendo bien qué vamos a hacer aquí.'"),
    L("'Olha, vou ser sincero(a): eu saí daquela conversa mais assustado(a) do que antes.'", "'Look, I will be honest: I left that conversation more frightened than before.'", "'Mira, seré sincero(a): salí de esa conversación más asustado(a) que antes.'"),
    L("'Minha família ficou com uma ideia daquilo que a senhora explicou, e eu com outra.'", "'My family took one idea from what you explained, and I took another.'", "'Mi familia entendió una cosa de lo que usted explicó, y yo otra.'"),
    L("'Eu quase não vim hoje.'", "'I almost did not come today.'", "'Casi no vine hoy.'")
  ];

  // passos curtos da sessão de acompanhamento (2 passos), na voz do paciente e pelo nível de progresso
  function steps(caseKey, arc) {
    const c = CASES[caseKey], t = st(caseKey), lvl = t.progresso < 35 ? 0 : t.progresso < 70 ? 1 : 2, v = c.voice;
    const G = FU.generic, who = c.steps[0].who === "parent" || c.parent ? "parent" : "patient";
    const hs = String(caseKey + t.manut).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const line = (i) => {
      const base = pick(G[i].text[G[i].text.length === 1 ? 0 : lvl]);
      return i === 0 ? `'${v ? pick(v.pre[hs % v.pre.length]) + " " : ""}${base}${v ? " " + pick(v.ref[lvl]) : ""}'` : `'${base}${v ? " " + pick(v.post) : ""}'`;
    };
    return [0, 1].map((i) => {
      const options = {};
      Object.keys(G[i].opts).forEach((ap) => { let o = pick(G[i].opts[ap]); if (v && i === 0) { if (ap === "acolhimento" || ap === "psicodinamica") o += " " + pick(v.hookA); else if (ap === "tcc" || ap === "comportamental") o += " " + pick(v.hookB); } options[ap] = o; });
      const res = i === 0 ? resistencia(caseKey) : 0;
      const freio = res > 0.3 ? `${pick(RESISTE[hash(caseKey + t.manut) % RESISTE.length])} ` : "";
      return { who, text: i === 0 ? `${tr(`(${pick(c.name)} chega para a sessão de acompanhamento.) `, `(${pick(c.name)} arrives for the follow-up session.) `, `(${pick(c.name)} llega a la sesión de seguimiento.) `)}${freio}${line(i)}` : line(i), note: null, mods: {}, options };
    });
  }

  // ---------------------------------------------------------------- dados para a interface (Celular)
  function viewData() {
    return {
      title: `🛋️ ${tr("Acompanhamento", "Follow-up", "Seguimiento")}`,
      intro: tr("Quem aceitou continuar em terapia. Cada sessão de acompanhamento faz subir o progresso; com 100% e 6 sessões você pode dar alta.", "People who agreed to continue in therapy. Each follow-up session raises progress; at 100% and 6 sessions you can discharge.", "Personas que aceptaron continuar en terapia. Cada sesión de seguimiento sube el progreso; con 100% y 6 sesiones puedes dar el alta."),
      empty: list().length ? "" : tr("Ninguém em acompanhamento ainda. Aceite os pedidos de terapia nas mensagens.", "Nobody in follow-up yet. Accept therapy requests in the messages.", "Nadie en seguimiento aún. Acepta las solicitudes de terapia en los mensajes."),
      rows: list().map((id) => { const t = st(id); return {
        id, name: CASES[id].name, progress: Math.round(t.progresso), info: `${tr("Sessões", "Sessions", "Sesiones")}: ${t.manut} · ${tr("Adesão", "Adherence", "Adhesión")}: ${Math.round(t.adesao)}%${resistencia(id) > 0.3 ? ` (${tr("resistente", "resistant", "resistente")})` : ""} · ${tr("Faltas", "Missed", "Faltas")}: ${t.faltas}${chanceFalta(t) ? ` (${tr("risco de faltar", "no-show risk", "riesgo de faltar")} ${chanceFalta(t)}%)` : ""} · ${tr("Próxima: semana", "Next: week", "Próxima: semana")} ${t.proxima || week()}`,
        can: canDischarge(id), early: canEarly(id), label: canDischarge(id) ? `🎓 ${tr("Dar alta", "Discharge", "Dar de alta")}` : `🎓 ${tr("Alta precoce", "Early discharge", "Alta temprana")}`, warn: typeof Risk !== "undefined" ? Risk.warnLabel(id) : "" }; }),
      done: Object.keys(all()).filter((id) => st(id) && st(id).alta && CASES[id]).map((id) => ({ id, name: CASES[id].name, kind: st(id).alta === "completa" ? tr("alta completa", "full discharge", "alta completa") : st(id).alta === "abandono" ? tr("abandonou o tratamento", "dropped out", "abandonó el tratamiento") : tr("alta precoce", "early discharge", "alta temprana") }))
    };
  }
  function act(id) { const r = discharge(id); if (r) { showToast(r.lines[0]); if (typeof renderPhone === "function") renderPhone(); try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* nada */ } } return r; }

  return { MANUT, st, active, list, due, onAccept, delta, finish, weekRoll, canDischarge, canEarly, discharge, steps, viewData, act, freq, all,
           resistencia, chanceFalta, vaiFaltar, abandonou, chamarDeVolta, ADESAO_FALTA, ADESAO_FRAGIL, FALTAS_ABANDONO };
})();
window.Care = Care;

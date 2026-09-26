"use strict";

// ===========================================================================
// Supervisão clínica: levar um caso a alguém mais experiente.
//
// Até a 4.21 a supervisão só existia se a intercorrência aleatória sorteasse o convite. Ela é o
// contrário de sorte: é a coisa que o psicólogo PROCURA quando o caso pesa. Agora é um lugar na
// faculdade, uma vez por semana, e faz três coisas que nada mais no jogo faz juntas:
//  · alivia o estresse de verdade (é o maior alívio disponível);
//  · devolve a pergunta que você ainda não fez naquele caso (pista honesta, tirada da sua ficha);
//  · nomeia a reação que escapou de você na consulta (o registro vem de Escuta.agirContra).
// ===========================================================================
const Supervisao = (() => {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));

  const CUSTO_MIN = 60, CUSTO_ENERGIA = 6, ALIVIO = 18;

  const st = () => (state.supervisao = state.supervisao || { semana: 0, vezes: 0 });
  // Quantas vezes por semana: uma, ou duas com a Supervisão avançada que a Reputação Acadêmica abre (7.5).
  const limiteSemanal = () => (typeof Career !== "undefined" && Career.supervisoesPorSemana ? Career.supervisoesPorSemana() : 1);
  const usosNaSemana = () => (st().semana === (state.week || 1) ? (st().naSemana || 1) : 0);
  const feitaNestaSemana = () => usosNaSemana() >= limiteSemanal();

  // casos que valem levar: os que estão na agenda desta semana e ainda não fecharam
  function casos() {
    const vistos = {};
    DAYS.forEach((d) => (SCHEDULE[d] || []).forEach((a) => {
      if (String(a.caseId).startsWith("cit:")) return;
      if (!CASES[a.caseId] || ((state.pat || {})[a.caseId] || {}).closed) return;
      vistos[a.caseId] = true;
    }));
    return Object.keys(vistos);
  }

  // a pergunta que ainda não foi feita: primeiro domínio sem achado na ficha daquele caso
  function lacuna(k) {
    if (typeof Dx === "undefined" || !Dx.kase(k)) return null;
    const b = Dx.book(k);
    const faltando = Dx.data().domains.filter((d) => !b.found[d.id]);
    if (!faltando.length) return null;
    // prefere um domínio em que o caso TEM achado escrito: é onde a pergunta rende de verdade
    const comAchado = faltando.find((d) => (Dx.kase(k).findings || []).some((f) => f.d === d.id));
    return comAchado || faltando[0];
  }

  const reacaoPendente = () => (state.contraLog || []).slice(-1)[0] || null;

  const FALA = {
    impaciencia: L("Você contou a sessão inteira em quarenta segundos. Repara nisso: a pressa que você teve ali é a mesma que você está tendo aqui.",
                   "You told me the whole session in forty seconds. Notice that: the hurry you had in there is the same one you are having here.",
                   "Me contaste la sesión entera en cuarenta segundos. Fíjate: la prisa que tuviste allí es la misma que tienes aquí."),
    salvacao: L("Você queria muito que ela saísse melhor naquele dia. Queria por ela, ou queria para não sair você mesma com o peso?",
                "You really wanted her to leave better that day. Did you want it for her, or so that you would not leave carrying it?",
                "Querías mucho que saliera mejor ese día. ¿Lo querías por ella, o para no salir tú misma con el peso?"),
    evitar: L("Você disse que o assunto estava pesado para ela. Vamos olhar de novo: pesado para quem, naquela hora?",
              "You said the subject was heavy for her. Let us look again: heavy for whom, at that moment?",
              "Dijiste que el tema estaba pesado para ella. Miremos de nuevo: ¿pesado para quién, en ese momento?"),
  };

  function podeAgora() {
    if (feitaNestaSemana()) return { ok: false, motivo: tr("Você já levou um caso à supervisão esta semana.", "You have already taken a case to supervision this week.", "Ya llevaste un caso a supervisión esta semana.") };
    if (state.energy < CUSTO_ENERGIA) return { ok: false, motivo: tr("Você está sem energia para uma hora de supervisão.", "You do not have the energy for an hour of supervision.", "No tienes energía para una hora de supervisión.") };
    if (!casos().length) return { ok: false, motivo: tr("Não há caso em andamento para levar.", "There is no ongoing case to bring.", "No hay caso en curso para llevar.") };
    return { ok: true };
  }

  function abrir() {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("supervisao"), 400);
    const pode = podeAgora();
    if (!pode.ok) { showToast(pode.motivo); return; }
    const body = $("psico-body") || $("invest-say-body");
    const alvo = $("psico-modal") ? "psico-modal" : "invest-say";
    body.textContent = "";
    body.appendChild(el("p", "uni-q", tr(
      `Uma hora com uma colega mais experiente. Escolha o caso que está pesando. Custa ${CUSTO_MIN} minutos e ${CUSTO_ENERGIA} de energia, e vale uma vez por semana.`,
      `An hour with a more experienced colleague. Choose the case that is weighing on you. It costs ${CUSTO_MIN} minutes and ${CUSTO_ENERGIA} energy, and is available once a week.`,
      `Una hora con una colega con más experiencia. Elige el caso que pesa. Cuesta ${CUSTO_MIN} minutos y ${CUSTO_ENERGIA} de energía, y vale una vez por semana.`)));
    casos().forEach((k) => {
      const b = el("button", "choice-btn", "");
      b.type = "button";
      b.appendChild(el("b", null, pick(CASES[k].name)));
      b.appendChild(el("small", "dx-hint", pick(CASES[k].complaint)));
      b.addEventListener("click", () => levar(k));
      body.appendChild(b);
    });
    openModal(alvo);
  }

  function levar(k) {
    const alvo = $("psico-modal") ? "psico-modal" : "invest-say";
    st().naSemana = st().semana === (state.week || 1) ? (st().naSemana || 0) + 1 : 1;
    st().semana = state.week || 1;
    st().vezes += 1;
    state.clock = (state.clock || 0) + CUSTO_MIN;
    state.energy = clamp(state.energy - CUSTO_ENERGIA, 0, 100);
    if (typeof Events !== "undefined") Events.calm(typeof Career !== "undefined" && Career.has("superv2") ? Math.round(ALIVIO * 1.4) : ALIVIO);
    if (typeof Wheel !== "undefined") { Wheel.gain("raciocinio", 1); Wheel.rep().academica += 1; }
    state.xp += 5;

    const body = $("psico-body") || $("invest-say-body");
    body.textContent = "";
    body.appendChild(el("h3", "aqx-h", `🧑‍🏫 ${tr("Supervisão", "Supervision", "Supervisión")} · ${pick(CASES[k].name)}`));

    const fala = (txt) => { const d = el("div", "say-row pat"); d.appendChild(el("p", "say-quote", txt)); body.appendChild(d); };

    const g = lacuna(k);
    if (g) fala(tr(`“Você me contou muita coisa e não falou nada sobre ${pick(g.name).toLowerCase()}. Pergunta isso na próxima.”`,
                   `“You told me a lot and said nothing about ${pick(g.name).toLowerCase()}. Ask about that next time.”`,
                   `“Me contaste mucho y no dijiste nada sobre ${pick(g.name).toLowerCase()}. Pregunta eso la próxima.”`));
    else fala(tr("“Você cobriu as áreas todas. Agora o trabalho é ligar o que você já tem, não coletar mais.”",
                 "“You covered every area. The work now is to connect what you already have, not to collect more.”",
                 "“Cubriste todas las áreas. Ahora el trabajo es unir lo que ya tienes, no recolectar más.”"));

    const r = reacaoPendente();
    if (r && FALA[r.id]) {
      fala(pick(FALA[r.id]));
      state.contraLog = (state.contraLog || []).filter((x) => x !== r);
      if (typeof Wheel !== "undefined") Wheel.gain("projetivas", 1);
      body.appendChild(el("small", "", tr("+1 Técnicas Projetivas: olhar para a própria reação é trabalho clínico.", "+1 Projective Techniques: looking at your own reaction is clinical work.", "+1 Técnicas Proyectivas: mirar la propia reacción es trabajo clínico.")));
    }

    body.appendChild(el("p", "shop-note", `😌 −${ALIVIO} ${tr("estresse", "stress", "estrés")} · 🎓 +1 ${tr("Reputação Acadêmica", "Academic Reputation", "Reputación Académica")} · 🧩 +1 ${tr("Raciocínio Clínico", "Clinical Reasoning", "Clinical Reasoning")} · ⭐ +5 · ⏱️ +${CUSTO_MIN} min`));
    const ok = el("button", "pill-btn primary", tr("Voltar", "Back", "Volver"));
    ok.type = "button";
    ok.addEventListener("click", () => closeModal(alvo));
    body.appendChild(ok);
    saveState();
    if (typeof updateHud === "function") updateHud();
    sfx("unlock");
  }

  return { abrir, podeAgora, casos, lacuna, st, CUSTO_MIN, CUSTO_ENERGIA, ALIVIO };
})();

window.Supervisao = Supervisao;

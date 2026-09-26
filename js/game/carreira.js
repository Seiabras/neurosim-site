"use strict";

// ===========================================================================
// Carreira e gestão da clínica: o que as duas reputações desbloqueiam.
//  · Reputação da Clínica (state.rep.clinica): sala de espera, recepcionista, segunda sala, estagiário(a), psicólogo(a) júnior, clínica de referência;
//  · Reputação Acadêmica (state.rep.academica): aulas na universidade, artigos (a partir dos laudos), congressos (bônus nos eixos da Roda),
//    orientação de estagiários e livro.
// Estado: state.carreira = { unlocked, equipe: { recepcao, estagio, junior }, artigos[], usados{}, congresso: { ultimo }, bonus: { eixo: { ate, n } }, aula: { dia }, livro }
// Fórmulas: docs/DESIGN-EVOLUCOES.md, bloco G.
// ===========================================================================
const Career = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const week = () => state.week || 1;
  const st = () => { const c = (state.carreira = state.carreira || {}); c.unlocked = c.unlocked || {}; c.equipe = c.equipe || {}; c.artigos = c.artigos || []; c.usados = c.usados || {}; c.congresso = c.congresso || { ultimo: -99 }; c.bonus = c.bonus || {}; c.aula = c.aula || { dia: "" }; return c; };

  // ---------------------------------------------------------------- árvores de desbloqueio
  const CLINIC = [
    { id: "espera", at: 5, icon: "🛋️", name: L("Sala de espera ampliada", "Larger waiting room", "Sala de espera ampliada"), fx: L("Pacientes esperam +10 min antes de ir embora.", "Patients wait +10 min before leaving.", "Los pacientes esperan +10 min antes de irse.") },
    { id: "recepcao", at: 12, icon: "🧑‍💼", name: L("Recepcionista", "Receptionist", "Recepcionista"), fx: L("+10 min de tolerância no atraso, faltas custam metade; salário de 15 moedas por dia útil.", "+10 min of lateness grace, missed sessions cost half; salary of 15 coins per workday.", "+10 min de tolerancia en el retraso, las faltas cuestan la mitad; salario de 15 monedas por día hábil."), hire: 40 },
    { id: "sala2", at: 20, icon: "🚪", name: L("Segunda sala", "Second room", "Segunda sala"), fx: L("Sessões de acompanhamento gastam 6 de energia em vez de 12.", "Follow-up sessions cost 6 energy instead of 12.", "Las sesiones de seguimiento gastan 6 de energía en vez de 12.") },
    { id: "estagio", at: 30, icon: "🎓", name: L("Estagiário(a) júnior", "Junior intern", "Practicante júnior"), fx: L("Atende até 2 sessões de acompanhamento por semana quando você não pode; você fica com 30% do valor.", "Handles up to 2 follow-up sessions a week when you cannot; you keep 30% of the value.", "Atiende hasta 2 sesiones de seguimiento por semana cuando no puedes; te quedas con el 30% del valor."), hire: 80 },
    { id: "junior", at: 45, icon: "🧑‍⚕️", name: L("Psicólogo(a) júnior", "Junior psychologist", "Psicólogo(a) júnior"), fx: L("Atende até 3 sessões de acompanhamento por semana; você fica com 40% do valor.", "Handles up to 3 follow-up sessions a week; you keep 40% of the value.", "Atiende hasta 3 sesiones de seguimiento por semana; te quedas con el 40% del valor."), hire: 150 },
    { id: "referencia", at: 60, icon: "🏆", name: L("Clínica de referência", "Reference clinic", "Clínica de referencia"), fx: L("+10% de chance de encaminhamentos e título de referência.", "+10% referral chance and a reference title.", "+10% de probabilidad de derivaciones y título de referencia.") }
  ];
  const ACAD = [
    { id: "aula", at: 4, icon: "👩‍🏫", name: L("Convite para dar aula", "Invitation to teach", "Invitación para dar clase"), fx: L("Ministre uma aula na universidade (5 perguntas): XP e moedas, 1 vez por dia.", "Teach a class at the university (5 questions): XP and coins, once a day.", "Da una clase en la universidad (5 preguntas): XP y monedas, 1 vez al día.") },
    { id: "artigo", at: 10, icon: "📄", name: L("Publicar artigo", "Publish an article", "Publicar un artículo"), fx: L("Escolha 3 laudos seus (≥ 50) e publique: +2 Reputação Acadêmica e +1 nível num eixo por 4 semanas.", "Choose 3 of your reports (≥ 50) and publish: +2 Academic Reputation and +1 level on an axis for 4 weeks.", "Elige 3 informes tuyos (≥ 50) y publica: +2 Reputación Académica y +1 nivel en un eje por 4 semanas.") },
    { id: "congresso", at: 18, icon: "🎤", name: L("Congresso", "Conference", "Congreso"), fx: L("Uma vez a cada 4 semanas: escolha uma palestra e ganhe +1 nível efetivo num eixo da Roda por 2 semanas.", "Once every 4 weeks: pick a talk and gain +1 effective level on a Wheel axis for 2 weeks.", "Una vez cada 4 semanas: elige una charla y gana +1 nivel efectivo en un eje de la Rueda por 2 semanas.") },
    { id: "orienta", at: 30, icon: "🧭", name: L("Orientação de estagiários", "Intern supervision", "Orientación de practicantes"), fx: L("Sua equipe atende melhor (+0,1 de qualidade).", "Your team performs better (+0.1 quality).", "Tu equipo atiende mejor (+0,1 de calidad).") },
    { id: "bolsa", at: 24, icon: "🔬", name: L("Bolsa de pesquisa", "Research grant", "Beca de investigación"), fx: L("Uma linha de pesquisa financiada: +25 moedas por semana e +1 Reputação Acadêmica a cada 4 semanas, enquanto durar.", "A funded research line: +25 coins per week and +1 Academic Reputation every 4 weeks, while it lasts.", "Una línea de investigación financiada: +25 monedas por semana y +1 Reputación Académica cada 4 semanas, mientras dure.") },
    { id: "superv2", at: 36, icon: "🧑‍🏫", name: L("Supervisão avançada", "Advanced supervision", "Supervisión avanzada"), fx: L("Supervisão duas vezes por semana, com alívio maior de estresse.", "Supervision twice a week, with greater stress relief.", "Supervisión dos veces por semana, con mayor alivio del estrés.") },
    { id: "livro", at: 45, icon: "📚", name: L("Livro / manual", "Book / manual", "Libro / manual"), fx: L("Publique um livro: +200 moedas e +100 XP (uma vez).", "Publish a book: +200 coins and +100 XP (once).", "Publica un libro: +200 monedas y +100 XP (una vez).") }
  ];
  const rep = () => Wheel.rep();
  // A BOLSA (7.5): a Reputação Acadêmica deixou de ser um número na tela. Paga por semana e devolve
  // reputação de tempos em tempos — é o único rendimento do jogo que não vem de atender.
  const BOLSA_SEMANA = 25;
  function bolsaDaSemana() {
    if (!has("bolsa")) return 0;
    const c = st();
    c.bolsa = c.bolsa || { desde: week(), pagas: 0 };
    c.bolsa.pagas += 1;
    state.coins += BOLSA_SEMANA;
    if (c.bolsa.pagas % 4 === 0) rep().academica += 1;
    saveState();
    return BOLSA_SEMANA;
  }
  // supervisão: uma por semana, duas com a supervisão avançada
  const supervisoesPorSemana = () => (has("superv2") ? 2 : 1);
  const has = (id) => Boolean(st().unlocked[id]);
  const eq = () => st().equipe;
  // confere o que a reputação já abriu (avisa uma vez)
  function check() {
    const c = st(), out = [];
    CLINIC.forEach((u) => { if (!c.unlocked[u.id] && rep().clinica >= u.at) { c.unlocked[u.id] = true; out.push(u); } });
    ACAD.forEach((u) => { if (!c.unlocked[u.id] && rep().academica >= u.at) { c.unlocked[u.id] = true; out.push(u); } });
    if (out.length && typeof Tips !== "undefined") setTimeout(() => Tips.fire("reputacao"), 700);   // a reputação abriu alguma coisa: explica uma vez
    out.forEach((u, i) => setTimeout(() => showToast(`🔓 ${tr("Carreira", "Career", "Carrera")}: ${pick(u.name)}`), 400 + i * 1800));
    if (out.length) { saveState(); sfx("levelup"); if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("carreira"), 500); }
    return out;
  }
  // ---------------------------------------------------------------- efeitos nas regras do jogo
  const wait = () => (has("espera") ? 10 : 0);
  const grace = () => (eq().recepcao ? 10 : 0);
  const faltaPenalty = () => (eq().recepcao ? 2 : 4);
  const manutEnergy = () => (has("sala2") ? 6 : 12);
  const refBonus = () => (has("referencia") ? 0.1 : 0);
  function payDay() {   // salário da recepção ao começar cada dia útil
    if (!eq().recepcao) return 0;
    const pay = Math.min(15, state.coins); state.coins -= pay; return pay;
  }
  // bônus temporário nos eixos da Roda (congresso e artigos)
  function bonus(axis) { const b = st().bonus[axis]; return b && b.ate >= week() ? b.n : 0; }
  // equipe: sessões de acompanhamento delegadas na virada da semana (Care.weekRoll)
  const capacity = () => (eq().junior ? 3 : eq().estagio ? 2 : 0);
  const share = () => (eq().junior ? 0.4 : 0.3);
  function delegate(id, k) {
    const t = Care.st(id), lvl = eq().junior ? 2 : 1, r = ((id.length * 31 + week() * 17 + k * 7) % 100) / 100;
    let q = 0.45 + 0.05 * lvl + 0.02 * Wheel.level("devolutiva") + (has("orienta") ? 0.1 : 0) + (r - 0.5) * 0.2;
    if (state.energy < 3) q -= 0.15;   // sem energia para supervisionar
    state.energy = Math.max(0, state.energy - 3);   // supervisão
    q = Math.max(0.1, Math.min(0.95, q));
    const d = Care.delta(id, q); t.progresso = Math.min(100, Math.round((t.progresso + d) * 10) / 10); t.manut += 1; t.ultima = week(); t.proxima = week() + Care.freq(t);
    const value = Math.round(10 + 20 * q), mine = Math.round(value * share());
    state.coins += mine;
    let msg = `${pick(CASES[id].name)}: +${Math.round(d)}% · 🪙 +${mine}`;
    if (q < 0.5 && r < 0.2) { rep().clinica = Math.max(0, rep().clinica - 1); msg += ` · ⚠️ ${tr("intercorrência (−1 Reputação)", "incident (−1 Reputation)", "incidencia (−1 Reputación)")}`; }
    return msg;
  }

  // ---------------------------------------------------------------- equipe
  function hire(id) {
    const u = CLINIC.find((x) => x.id === id); if (!u || !has(id) || !u.hire || eq()[id]) return false;
    if (state.coins < u.hire) { sfx("bad"); showToast(tr("Moedas insuficientes.", "Not enough coins.", "Monedas insuficientes.")); return false; }
    state.coins -= u.hire; eq()[id] = true; if (id === "junior") eq().estagio = eq().estagio || false;
    saveState(); updateHud(); sfx("levelup"); showToast(`✅ ${pick(u.name)}`); return true;
  }

  // ---------------------------------------------------------------- aula (perguntas dos cartões de aprendizagem)
  const bank = () => Object.values((window.WORLD_DATA && WORLD_DATA.learn) || {}).filter((d) => d.quiz && d.quiz.opts && d.quiz.opts.length >= 2);
  function teach(done) {
    const c = st(), today = `${week()}:${state.dayIndex}`;
    if (!has("aula")) return false;
    if (c.aula.dia === today) { showToast(tr("Hoje você já deu aula.", "You already taught today.", "Hoy ya diste clase.")); return false; }
    const qs = bank().slice().sort((a, b) => ((pick(a.title).length * 7 + week()) % 13) - ((pick(b.title).length * 7 + week()) % 13)).slice(0, 5);
    if (!qs.length) return false;
    let i = 0, right = 0;
    const body = $("psico-body"), show = () => {
      body.textContent = ""; $("psico-title").textContent = `👩‍🏫 ${tr("Aula na universidade", "Class at the university", "Clase en la universidad")} ${Math.min(i + 1, qs.length)}/${qs.length}`;
      if (i >= qs.length) {
        const xp = right * 2 + (right === qs.length ? 5 : 0), coins = right * 3;
        state.xp += xp; state.coins += coins; c.aula.dia = today; advanceClock(60); state.energy = Math.max(0, state.energy - 8); Wheel.gain("devolutiva", 1); saveState(); updateHud(); sfx("good");
        body.appendChild(el("p", "uni-q", `${tr("Acertos", "Right", "Aciertos")}: ${right}/${qs.length} · ⭐ +${xp} · 🪙 +${coins}`));
        const ok = el("button", "pill-btn primary", tr("Concluir", "Finish", "Concluir")); ok.type = "button"; ok.addEventListener("click", () => { closeModal("psico-modal"); if (done) done({ right, xp, coins }); }); body.appendChild(ok); return;
      }
      const q = qs[i].quiz; body.appendChild(el("p", "uni-q", pick(q.q)));
      q.opts.forEach((o) => { const b = el("button", "dx-opt", pick(o.t)); b.type = "button"; b.addEventListener("click", () => { if (o.ok) { right += 1; sfx("good"); } else sfx("bad"); i += 1; show(); }); body.appendChild(b); });
    };
    show(); openModal("psico-modal"); return true;
  }

  // ---------------------------------------------------------------- artigo (a partir do banco de laudos)
  const THEMES = [{ id: "psicometria", n: L("Avaliação neuropsicológica na prática", "Neuropsychological assessment in practice", "Evaluación neuropsicológica en la práctica") }, { id: "raciocinio", n: L("Raciocínio clínico e diagnóstico diferencial", "Clinical reasoning and differential diagnosis", "Razonamiento clínico y diagnóstico diferencial") }, { id: "devolutiva", n: L("Devolutiva e adesão ao tratamento", "Feedback and treatment adherence", "Devolutiva y adhesión al tratamiento") }];
  const avail = () => (state.laudos || []).map((l, i) => ({ l, i })).filter((x) => x.l.q >= 50 && !st().usados[x.i]);
  function article(done) {
    if (!has("artigo")) return false;
    const list = avail(); if (list.length < 3) { showToast(tr("Você precisa de 3 laudos com qualidade ≥ 50 ainda não publicados.", "You need 3 unpublished reports with quality ≥ 50.", "Necesitas 3 informes con calidad ≥ 50 aún no publicados.")); return false; }
    const sel = {}, body = $("psico-body");
    const show = () => {
      body.textContent = ""; $("psico-title").textContent = `📄 ${tr("Publicar artigo", "Publish an article", "Publicar un artículo")}`;
      body.appendChild(el("p", "uni-q", tr("Escolha 3 laudos e o tema.", "Choose 3 reports and the theme.", "Elige 3 informes y el tema.")));
      list.forEach((x) => { const on = Boolean(sel[x.i]); const b = el("button", "dx-opt" + (on ? " on" : ""), `${on ? "✓ " : ""}${(CASES[x.l.caso] || { name: x.l.caso }).name} · ${tr("qualidade", "quality", "calidad")} ${x.l.q} · ${tr("semana", "week", "semana")} ${x.l.semana}`); b.type = "button"; b.addEventListener("click", () => { if (on) delete sel[x.i]; else if (Object.keys(sel).length < 3) sel[x.i] = true; show(); }); body.appendChild(b); });
      const chosen = Object.keys(sel);
      THEMES.forEach((th) => { const b = el("button", "pill-btn small", `📝 ${pick(th.n)}`); b.type = "button"; b.disabled = chosen.length < 3; b.addEventListener("click", () => {
        chosen.forEach((i) => { st().usados[i] = true; }); const avg = chosen.reduce((s, i) => s + state.laudos[i].q, 0) / 3;
        rep().academica += 2; st().bonus[th.id] = { ate: week() + 4, n: 1 }; st().artigos.push({ tema: th.id, semana: week(), q: Math.round(avg) }); state.xp += 20; Wheel.gain("laudo", 2); saveState(); updateHud(); sfx("levelup"); closeModal("psico-modal");
        showToast(`📄 ${pick(th.n)}: +2 ${tr("Reputação Acadêmica", "Academic Reputation", "Reputación Académica")} · +1 ${tr("nível temporário", "temporary level", "nivel temporal")}`); if (done) done();
      }); body.appendChild(b); });
    };
    show(); openModal("psico-modal"); return true;
  }

  // ---------------------------------------------------------------- congresso
  const TALKS = [{ id: "psicometria", n: L("Novas baterias e normas", "New batteries and norms", "Nuevas baterías y normas") }, { id: "projetivas", n: L("Técnicas projetivas hoje", "Projective techniques today", "Técnicas proyectivas hoy") }, { id: "observacao", n: L("Comunicação não verbal", "Non-verbal communication", "Comunicación no verbal") }, { id: "multi", n: L("Trabalho em rede", "Networked care", "Trabajo en red") }];
  function conference(done) {
    const c = st();
    if (!has("congresso")) return false;
    if (week() - c.congresso.ultimo < 4) { showToast(tr("O próximo congresso é daqui a algumas semanas.", "The next conference is a few weeks away.", "El próximo congreso es dentro de algunas semanas.")); return false; }
    if (state.coins < 60) { showToast(tr("A inscrição custa 60 moedas.", "Registration costs 60 coins.", "La inscripción cuesta 60 monedas.")); return false; }
    const body = $("psico-body"); body.textContent = ""; $("psico-title").textContent = `🎤 ${tr("Congresso", "Conference", "Congreso")}`;
    body.appendChild(el("p", "uni-q", tr("Inscrição: 🪙 60, ⚡ −15, três horas fora. Escolha uma palestra: +1 nível efetivo no eixo por 2 semanas.", "Registration: 🪙 60, ⚡ −15, three hours away. Pick a talk: +1 effective level on the axis for 2 weeks.", "Inscripción: 🪙 60, ⚡ −15, tres horas fuera. Elige una charla: +1 nivel efectivo en el eje por 2 semanas.")));
    TALKS.forEach((t) => { const b = el("button", "dx-opt", `🎤 ${pick(t.n)}`); b.type = "button"; b.addEventListener("click", () => { state.coins -= 60; state.energy = Math.max(0, state.energy - 15); advanceClock(180); c.congresso.ultimo = week(); c.bonus[t.id] = { ate: week() + 2, n: 1 }; state.xp += 15; saveState(); updateHud(); sfx("levelup"); closeModal("psico-modal"); showToast(`🎤 ${pick(t.n)} · +1 ${tr("nível por 2 semanas", "level for 2 weeks", "nivel por 2 semanas")}`); if (done) done(); }); body.appendChild(b); });
    openModal("psico-modal"); return true;
  }
  function book() { const c = st(); if (!has("livro") || c.livro) return false; c.livro = true; state.coins += 200; state.xp += 100; rep().academica += 3; saveState(); updateHud(); sfx("levelup"); showToast(`📚 ${tr("Livro publicado: +200 moedas, +100 XP", "Book published: +200 coins, +100 XP", "Libro publicado: +200 monedas, +100 XP")}`); return true; }

  // ---------------------------------------------------------------- dados da aba Carreira (Missões)
  function viewData() {
    check(); const c = st();
    const col = (list, val, key) => list.map((u) => ({ id: u.id, icon: u.icon, name: pick(u.name), fx: pick(u.fx), at: u.at, open: has(u.id), pct: Math.min(100, Math.round((val / u.at) * 100)), hire: key === "clinic" && u.hire ? { cost: u.hire, done: Boolean(eq()[u.id]) } : null }));
    return { clinic: col(CLINIC, rep().clinica, "clinic"), acad: col(ACAD, rep().academica, "acad"), repClinic: rep().clinica, repAcad: rep().academica, bonus: Object.entries(c.bonus).filter(([, b]) => b.ate >= week()).map(([id, b]) => ({ id, n: b.n, ate: b.ate })), artigos: c.artigos.length, disponiveis: avail().length, livro: Boolean(c.livro), aulaHoje: c.aula.dia === `${week()}:${state.dayIndex}`, congressoEm: Math.max(0, 4 - (week() - c.congresso.ultimo)) };
  }
  return { CLINIC, ACAD, check, has, hire, teach, article, conference, book, wait, grace, faltaPenalty, manutEnergy, refBonus, payDay, bonus, capacity, share, delegate, viewData, st,
    BOLSA_SEMANA, bolsaDaSemana, supervisoesPorSemana };
})();
window.Career = Career;

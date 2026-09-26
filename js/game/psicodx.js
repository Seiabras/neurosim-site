"use strict";

// ===========================================================================
// Psicodiagnóstico aprofundado (consulta): baterias de testes, técnicas projetivas, diagnóstico diferencial
// (descartar com evidência contrária, comorbidade, revisão na 4ª consulta), laudo e devolutiva jogáveis.
// Regras e fórmulas: docs/DESIGN-EVOLUCOES.md (blocos A a D). Dados por caso: content/dx.json (testes, comorbid, tardio, armadilha).
// Estado: state.testes[caso][bateria], state.projetivas[caso][área], state.dxbook[caso].dif / .desc / .invalidos, state.laudos[].
// Os bônus vêm da Roda (Wheel.level / Wheel.active); aqui só há regra e tela.
// ===========================================================================
const PsicoDx = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const body = () => $("psico-body");
  const hash = (s) => String(s).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const gauss = (r) => { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const cur = () => Dx.cur();
  const K = () => Dx.kase(cur());
  const sess = () => (session ? session.sess || 1 : 1);
  const closeBtn = (fn) => { const b = el("button", "pill-btn primary", tr("Voltar à consulta", "Back to the session", "Volver a la consulta")); b.type = "button"; b.addEventListener("click", () => { closeModal("psico-modal"); if (fn) fn(); }); return b; };
  const head = (title, sub) => { body().textContent = ""; $("psico-title").textContent = title; if (sub) body().appendChild(el("p", "uni-q", sub)); };
  const budgetTxt = () => `⏱ ${tr("tempo de investigação", "investigation time", "tiempo de investigación")}: ${Dx.budgetLeft()} min · ⚡ ${Math.round(state.energy)}`;
  const gate = (extraFirst) => { // acesso: só a partir do 2º encontro e depois da apresentação
    if (!session || !Dx.active()) return tr("Sem caso aberto.", "No open case.", "Sin caso abierto.");
    if (!Dx.canShow()) return tr("(Vocês acabaram de se conhecer: testes e técnicas só a partir da segunda consulta.)", "(You have only just met: tests and techniques open from the second session.)", "(Acaban de conocerse: pruebas y técnicas desde la segunda consulta.)");
    if (!Dx.introduced()) return tr("(Espere a pessoa se apresentar antes de aplicar algo.)", "(Wait for the person to introduce themselves first.)", "(Espera a que la persona se presente antes de aplicar algo.)");
    return extraFirst ? null : null;
  };

  // ---------------------------------------------------------------- A · baterias de testes
  const BATS = {
    atencao: { icon: "🎯", name: L("Atenção", "Attention", "Atención"), how: L("Go/No-Go e Schulte", "Go/No-Go and Schulte", "Go/No-Go y Schulte"), min: 10, en: 4, fid: 0.8 },
    memoria: { icon: "🧠", name: L("Memória", "Memory", "Memoria"), how: L("Dígitos e N-back", "Digit span and N-back", "Dígitos y N-back"), min: 10, en: 4, fid: 0.8 },
    executivas: { icon: "🧭", name: L("Funções executivas", "Executive functions", "Funciones ejecutivas"), how: L("Stroop e TMT", "Stroop and TMT", "Stroop y TMT"), min: 12, en: 5, fid: 0.75 },
    qi: { icon: "🔢", name: L("Eficiência intelectual (QI)", "Intellectual efficiency (IQ)", "Eficiencia intelectual (CI)"), how: L("Escala completa", "Full scale", "Escala completa"), min: 20, en: 8, fid: 0.9 },
    emocoes: { icon: "😊", name: L("Reconhecimento de emoções", "Emotion recognition", "Reconocimiento de emociones"), how: L("Faces e situações", "Faces and situations", "Caras y situaciones"), min: 8, en: 3, fid: 0.7 }
  };
  const TESTS = () => (state.testes = state.testes || {});
  const tests = (k) => (TESTS()[k] = TESTS()[k] || {});
  const fidelity = (b) => Math.min(0.97, BATS[b].fid + 0.03 * Wheel.level("psicometria"));
  const noise = (b, tent) => (1 - fidelity(b)) * 1.5 * (tent > 0 ? 0.7 : 1);
  const testMin = (b, tent) => Math.max(4, Math.ceil(BATS[b].min * (Wheel.active("raciocinio") ? 0.9 : 1) * (tent > 0 ? 0.7 : 1)));
  const testEnergy = (b, tent) => Math.max(1, Math.round(BATS[b].en * (tent > 0 ? 0.7 : 1)));
  // pontos a favor/contra cada diagnóstico segundo o quanto o z observado se parece com o perfil esperado dele
  function testPts(k, b, z) {
    const out = {};
    Object.entries(Dx.kase(k).testes[b].prof).forEach(([id, p]) => { const sim = 1 - Math.min(2, Math.abs(z - p)) / 2, w = Math.round(3 * sim - 1.5); if (w) out[id] = w; });
    return out;
  }
  function applyTest(k, b) {
    const t = tests(k), prev = t[b], tent = prev ? prev.tent + 1 : 0;
    const r = rng(hash(k + b + tent)), real = Dx.kase(k).testes[b].z;
    const sd = noise(b, tent), fadiga = state.energy < LOW_ENERGY ? 0.3 : 0;
    const zobs = Math.round((real + gauss(r) * sd - fadiga) * 100) / 100, margem = Math.round(sd * 1.28 * 100) / 100;
    const inc = Math.abs(zobs + 1.0) < margem * 0.5;   // perto do limiar clínico (−1 dp) e com margem larga: inconclusivo
    t[b] = { zobs, margem, inc, tent, sess: sess(), pts: inc ? {} : testPts(k, b, zobs) };
    return t[b];
  }
  const band = (z) => (z <= -1.3 ? tr("abaixo da média", "below average", "por debajo del promedio") : z <= -0.7 ? tr("limítrofe / média inferior", "borderline / low average", "límite / media baja") : z < 1 ? tr("média", "average", "promedio") : tr("acima da média", "above average", "por encima del promedio"));
  function testCard(k, b, res) {
    const box = el("div", "dx-result" + (res.inc ? " neg" : ""));
    box.appendChild(el("div", "dx-q", `${BATS[b].icon} ${pick(BATS[b].name)}`));
    const score = Math.round(100 + 15 * res.zobs), m = Math.round(15 * res.margem);
    box.appendChild(el("div", "dx-a", `${tr("Pontuação", "Score", "Puntuación")}: ${score} (± ${m}) · ${band(res.zobs)}`));
    if (res.inc) box.appendChild(el("div", "dx-hint", tr("Resultado inconclusivo: a margem de erro cobre o limiar clínico. Repetir custa 70% do tempo e reduz o ruído em 30%; mais nível de Psicometria também ajuda.", "Inconclusive result: the error margin covers the clinical cut-off. Repeating costs 70% of the time and cuts noise by 30%; a higher Psychometrics level helps too.", "Resultado no concluyente: el margen de error cubre el umbral clínico. Repetir cuesta el 70% del tiempo y reduce el ruido un 30%; más nivel de Psicometría también ayuda.")));
    else box.appendChild(el("div", "dx-hint", tr("Resultado conclusivo: entrou nas evidências da ficha.", "Conclusive result: added to the chart's evidence.", "Resultado concluyente: entró en las evidencias de la ficha.")));
    if (Wheel.active("observacao")) box.appendChild(el("div", "dx-hint", `👁️ ${res.zobs <= -1 ? tr("Distraiu-se e pediu para repetir instruções.", "Got distracted and asked for the instructions again.", "Se distrajo y pidió repetir las instrucciones.") : tr("Manteve o ritmo, com poucas pausas.", "Kept a steady pace with few pauses.", "Mantuvo el ritmo, con pocas pausas.")}`));
    return box;
  }
  function openTest(last) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("testes"), 500);     const g = gate(); head(`🧪 ${tr("Baterias de testes", "Test batteries", "Baterías de pruebas")}`, g || budgetTxt());
    if (g) { body().appendChild(closeBtn()); return openModal("psico-modal"); }
    const k = cur(), t = tests(k);
    if (last) body().appendChild(last);
    const grid = el("div", "dx-grid");
    Object.keys(BATS).forEach((b) => {
      const tent = t[b] ? t[b].tent + 1 : 0, done = t[b] && !t[b].inc;
      const btn = el("button", "dx-dom" + (done ? " done" : ""), ""); btn.type = "button";
      btn.appendChild(el("span", "dx-dom-i", BATS[b].icon));
      const tt = el("span", "dx-dom-t"); tt.appendChild(el("b", "", pick(BATS[b].name)));
      tt.appendChild(el("small", "", `${pick(BATS[b].how)} · ⏱ ${testMin(b, tent)} min · ⚡ ${testEnergy(b, tent)} · ⭐ ${"★".repeat(Math.round(fidelity(b) * 5))}${done ? " · ✓" : t[b] ? " · ↻" : ""}`)); btn.appendChild(tt);
      btn.addEventListener("click", () => runTest(b));
      grid.appendChild(btn);
    });
    body().appendChild(grid); body().appendChild(closeBtn());
    openModal("psico-modal");
  }
  function runTest(b) {
    const k = cur(), t = tests(k), tent = t[b] ? t[b].tent + 1 : 0, min = testMin(b, tent);
    if (Dx.budgetLeft() < min) { sfx("deny"); return openTest(el("div", "dx-result guard", tr("Não sobrou tempo na sessão para esta bateria.", "There is not enough session time left for this battery.", "No queda tiempo en la sesión para esta batería."))); }
    // testagem observada: escolher como apresentar a tarefa e ASSISTIR a pessoa fazendo, item a item.
    // A pontuação continua saindo do applyTest; o que se ganha é ver o comportamento.
    if (typeof Testagem !== "undefined" && Testagem.TAREFAS[b] && !runTest._dentro) {
      runTest._dentro = true;
      return Testagem.abrir(k, b, (obs) => {
        if (obs && obs.minutos) Dx.spend(obs.minutos);
        // a trava só cai DEPOIS da segunda chamada: zerar antes fazia voltar para a observação em vez de pontuar
        try { runTest(b); } finally { runTest._dentro = false; }
      });
    }
    session.nTestes = (session.nTestes || 0) + 1;
    state.energy = clamp(state.energy - testEnergy(b, tent), 0, 100);
    Dx.spend(min);
    let extra = "";
    if (session.nTestes > 2) { state.affinity = clamp(state.affinity - 4, 0, 100); extra = tr(" Testes demais no mesmo dia cansam o paciente (vínculo −4).", " Too many tests in one day tire the patient (bond −4).", " Demasiadas pruebas en un día cansan al paciente (vínculo −4).");
    }
    const res = applyTest(k, b);
    if (!res.inc) { Wheel.gain("psicometria", 1); state.xp += 1; sfx("unlock"); } else sfx("click");
    updateHud(); saveState(); Dx.refreshBtn();
    if ($("ficha-new")) $("ficha-new").classList.remove("hidden");
    const card = testCard(k, b, res); if (extra) card.appendChild(el("div", "dx-hint", extra));
    openTest(card);
  }
  // itens de evidência extras vistos (usados por Dx.evidence): testes conclusivos, leituras erradas de projetivas e o achado tardio
  function items(k) {
    const out = [], c = Dx.kase(k);
    Object.values(tests(k)).forEach((r) => { if (!r.inc) out.push({ pts: r.pts }); });
    Object.values((state.projetivas || {})[k] || {}).forEach((p) => { if (p.wrong) out.push({ pts: { [CASES[k].diagnosis.answer]: -1 } }); });
    if (c && c.tardio && lateOn(k)) out.push({ pts: c.tardio.pts, max: true });
    return out;
  }
  const lateOn = (k) => Boolean(session && !session.secret && session.key === k && (session.sess || 1) >= 4) || ((state.pat || {})[k] && (state.pat[k].q || []).length >= 3);
  function panelTests(p, k) {   // aba Achados: testes, projetivas e achado tardio
    const t = tests(k), ks = Object.keys(t);
    const c = Dx.kase(k);
    if (c && c.tardio && lateOn(k)) { const bx = el("div", "dx-result"); bx.appendChild(el("div", "dx-q", `🕓 ${tr("Achado tardio", "Late finding", "Hallazgo tardío")}`)); bx.appendChild(el("div", "dx-a", pick(c.tardio.text))); p.appendChild(bx); }
    if (!ks.length) return;
    p.appendChild(el("h3", "aqx-h", `🧪 ${tr("Testes aplicados", "Tests applied", "Pruebas aplicadas")}`));
    ks.forEach((b) => { const r = t[b]; p.appendChild(el("div", "dx-find" + (r.inc ? " locked" : ""), `${BATS[b].icon} ${pick(BATS[b].name)}: ${Math.round(100 + 15 * r.zobs)} (± ${Math.round(15 * r.margem)}) · ${band(r.zobs)}${r.inc ? " · " + tr("inconclusivo", "inconclusive", "no concluyente") : ""}`)); });
  }

  // ---------------------------------------------------------------- B · técnicas projetivas
  const TECH = {
    pranchas: { icon: "🖼️", name: L("Pranchas (cenas ambíguas)", "Plates (ambiguous scenes)", "Láminas (escenas ambiguas)"), area: { trauma: 0.8, risco: 0.5, subst: 0.3 }, resp: L("Diante da prancha, a pessoa descreve uma cena e se demora em certos detalhes.", "Faced with the plate, the person describes a scene and lingers on certain details.", "Ante la lámina, la persona describe una escena y se detiene en ciertos detalles.") },
    desenho: { icon: "✏️", name: L("Desenho temático (casa-árvore-pessoa)", "Themed drawing (house-tree-person)", "Dibujo temático (casa-árbol-persona)"), area: { trauma: 0.7, risco: 0.4, subst: 0.3 }, resp: L("O desenho vai surgindo aos poucos; a pessoa apaga e refaz um dos elementos.", "The drawing appears little by little; the person erases and redraws one element.", "El dibujo aparece poco a poco; la persona borra y rehace uno de los elementos.") },
    frases: { icon: "📝", name: L("Frases incompletas", "Sentence completion", "Frases incompletas"), area: { trauma: 0.5, risco: 0.8, subst: 0.6 }, resp: L("A pessoa completa as frases e trava em algumas delas.", "The person completes the sentences and freezes on some of them.", "La persona completa las frases y se bloquea en algunas.") },
    associacao: { aberta: true, icon: "💭", name: L("Livre associação (boa quando você não sabe onde olhar)", "Free association (good when you do not know where to look)", "Libre asociación (buena cuando no sabes dónde mirar)"), area: { trauma: 0.6, risco: 0.4, subst: 0.5 }, resp: L("As palavras vêm devagar; de repente surge uma lembrança inesperada.", "Words come slowly; suddenly an unexpected memory surfaces.", "Las palabras vienen despacio; de pronto surge un recuerdo inesperado."), minLink: 50 }
  };
  const AREAS_ALL = { trauma: L("Trauma", "Trauma", "Trauma"), risco: L("Risco", "Risk", "Riesgo"), subst: L("Substâncias", "Substances", "Sustancias") };
  // com "ocultar conteúdo sensível" ligado, a área de risco some das projetivas
  const areasNow = () => Object.fromEntries(Object.entries(AREAS_ALL).filter(([k]) => !(typeof Sens !== "undefined" && Sens.on() && Sens.HIDDEN_DOMAINS.includes(k))));
  const AREAS = new Proxy({}, { get: (_, k) => AREAS_ALL[k], ownKeys: () => Object.keys(areasNow()), getOwnPropertyDescriptor: (_, k) => (k in areasNow() ? { enumerable: true, configurable: true, value: AREAS_ALL[k] } : undefined), has: (_, k) => k in areasNow() });
  const PROJ = () => (state.projetivas = state.projetivas || {});
  const projOf = (k) => (PROJ()[k] = PROJ()[k] || {});
  function openProj(step, tech, last) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("projetivas"), 500);     const g = gate(); head(`🎨 ${tr("Técnicas projetivas", "Projective techniques", "Técnicas proyectivas")}`, g || budgetTxt());
    if (g) { body().appendChild(closeBtn()); return openModal("psico-modal"); }
    if (last) body().appendChild(last);
    const grid = el("div", "dx-grid");
    if (!tech) {
      body().appendChild(el("p", "shop-note", tr("1) Escolha a técnica. Cada uma alcança melhor certas áreas delicadas.", "1) Pick the technique. Each one reaches some sensitive areas better.", "1) Elige la técnica. Cada una llega mejor a ciertas áreas delicadas.")));
      Object.keys(TECH).forEach((id) => { const btn = el("button", "dx-dom", ""); btn.type = "button"; btn.appendChild(el("span", "dx-dom-i", TECH[id].icon)); const tt = el("span", "dx-dom-t"); tt.appendChild(el("b", "", pick(TECH[id].name))); tt.appendChild(el("small", "", `⏱ 10 min · ⚡ ${Math.max(1, Wheel.traumaEnergy() - 1)}`)); btn.appendChild(tt); btn.addEventListener("click", () => openProj(2, id)); grid.appendChild(btn); });
    } else {
      body().appendChild(el("p", "shop-note", `2) ${pick(TECH[tech].name)} — ${tr("qual área delicada você quer alcançar?", "which sensitive area do you want to reach?", "¿qué área delicada quieres alcanzar?")}`));
      Object.keys(AREAS).concat(["aberto"]).forEach((a) => { const btn = el("button", "dx-dom", ""); btn.type = "button"; btn.appendChild(el("span", "dx-dom-i", a === "aberto" ? "🌀" : (Dx.dom(a) || {}).icon || "•")); const tt = el("span", "dx-dom-t"); tt.appendChild(el("b", "", a === "aberto" ? tr("Aberto (deixar surgir)", "Open (let it emerge)", "Abierto (dejar surgir)") : pick(AREAS[a]))); btn.appendChild(tt); btn.addEventListener("click", () => runProj(tech, a)); grid.appendChild(btn); });
    }
    body().appendChild(grid); body().appendChild(closeBtn());
    openModal("psico-modal");
  }
  function runProj(tech, focus) {
    const k = cur(), c = CASES[k], T = TECH[tech], min = 10;
    if (Dx.budgetLeft() < min) { sfx("deny"); return openProj(1, null, el("div", "dx-result guard", tr("Não sobrou tempo na sessão para uma técnica projetiva.", "There is not enough session time left for a projective technique.", "No queda tiempo en la sesión para una técnica proyectiva."))); }
    const b = Dx.book(k);
    let area = focus;
    if (focus === "aberto") area = Object.keys(AREAS).find((a) => Dx.finding(k, a) && !b.found[a]) || "trauma";
    const kid = Boolean(c.kid), ageF = kid && tech === "desenho" ? 1.2 : 1;
    // A LIVRE ASSOCIAÇÃO É A TÉCNICA DO "NÃO SEI ONDE OLHAR" (7.10). Ela alcançava menos que as outras
    // em TODAS as áreas — era uma escolha que nunca compensava. Na clínica a força dela é outra: não é
    // mirar melhor, é não precisar mirar. Por isso ela é a única que não paga o preço do foco aberto.
    const abertoPenal = focus === "aberto" ? (tech === "associacao" ? 1 : 0.8) : 1;
    const ok = Math.min(1, T.area[area] * (0.7 + 0.03 * Wheel.level("projetivas")) * ageF * abertoPenal);
    const need = Math.round(45 * Wheel.defense() * (1 - 0.4 * ok)), gateLink = Math.max(need, T.minLink || 0);
    state.energy = clamp(state.energy - Math.max(1, Wheel.traumaEnergy() - 1), 0, 100);
    Dx.spend(min);
    const has = Boolean(Dx.finding(k, area)), r = rng(hash(k + tech + area + sess()));
    const reveals = ok >= 0.5 || (ok >= 0.35 && r() < ok);
    const card = el("div", "dx-result");
    card.appendChild(el("div", "dx-q", `${T.icon} ${pick(T.name)} · ${pick(AREAS[area])}`));
    card.appendChild(el("div", "dx-a", pick(T.resp)));
    if (state.affinity < gateLink) {
      state.affinity = clamp(state.affinity - 3, 0, 100); card.classList.add("guard"); sfx("bad");
      card.appendChild(el("div", "dx-hint", tr("A pessoa se retraiu: falta vínculo para esta técnica (vínculo −3).", "The person withdrew: not enough bond for this technique (bond −3).", "La persona se retrajo: falta vínculo para esta técnica (vínculo −3).")));
    } else if (!reveals) {
      const cost = Math.round(3 * (1 - 0.5 * (Wheel.active("projetivas") ? 1 : 0)));
      state.affinity = clamp(state.affinity - cost, 0, 100); card.classList.add("neg"); sfx("click");
      card.appendChild(el("div", "dx-hint", tr(`Nada claro emergiu: a técnica não alcança bem esta área (vínculo −${cost}). Tente outra técnica.`, `Nothing clear emerged: the technique does not reach this area well (bond −${cost}). Try another technique.`, `No surgió nada claro: la técnica no llega bien a esta área (vínculo −${cost}). Prueba otra técnica.`)));
    } else if (!has) {
      b.found[area] = true; card.classList.add("neg"); sfx("click");
      card.appendChild(el("div", "dx-hint", tr("Nenhum conteúdo relevante nesta área: achado negativo registrado (ajuda a descartar).", "No relevant content in this area: negative finding recorded (helps rule out).", "Sin contenido relevante en esta área: hallazgo negativo registrado (ayuda a descartar).")));
    } else {
      card.appendChild(el("div", "dx-hint", tr("Surgiu um conteúdo importante. Como você lê o tema que apareceu?", "Something important surfaced. How do you read the theme that appeared?", "Surgió un contenido importante. ¿Cómo lees el tema que apareció?")));
      const opts = el("div", "dx-opts");
      Object.keys(AREAS).forEach((a) => {
        const bt = el("button", "dx-opt", pick(AREAS[a])); bt.type = "button";
        bt.addEventListener("click", () => {
          const good = a === area, out = el("div", "dx-result" + (good ? "" : " guard"));
          if (good) { b.found[area] = true; delete projOf(k)[area]; Wheel.gain("projetivas", 2); state.xp += 2; sfx("unlock"); out.appendChild(el("div", "dx-a", `📝 ${pick(Dx.finding(k, area).text)}`)); out.appendChild(el("div", "dx-hint", tr("Leitura certa: achado anotado na ficha, sem desgaste de vínculo.", "Right reading: finding added to the chart, no loss of bond.", "Lectura correcta: hallazgo anotado en la ficha, sin desgaste de vínculo."))); if (area === "risco" && typeof Risk !== "undefined" && Risk.canAssess(k)) { session.riskSeen = true; const rk = el("button", "pill-btn primary", `🚨 ${tr("Avaliar o risco", "Assess the risk", "Evaluar el riesgo")}`); rk.type = "button"; rk.addEventListener("click", () => { closeModal("psico-modal"); Risk.assess(k); }); out.appendChild(rk); } }
          else { projOf(k)[area] = { wrong: true }; sfx("bad"); out.appendChild(el("div", "dx-a", tr("Leitura precipitada: ficou uma pista enganosa na ficha (pesa contra a hipótese certa). Uma nova técnica na mesma área pode corrigir.", "Hasty reading: a misleading clue went into the chart (it weighs against the right hypothesis). A new technique on the same area can fix it.", "Lectura precipitada: quedó una pista engañosa en la ficha (pesa contra la hipótesis correcta). Otra técnica en la misma área puede corregirla."))); }
          updateHud(); saveState(); Dx.refreshBtn(); if ($("ficha-new")) $("ficha-new").classList.remove("hidden");
          openProj(1, null, out);
        });
        opts.appendChild(bt);
      });
      card.appendChild(opts);
      updateHud(); saveState(); Dx.refreshBtn();
      head(`🎨 ${tr("Técnicas projetivas", "Projective techniques", "Técnicas proyectivas")}`, budgetTxt()); body().appendChild(card); body().appendChild(closeBtn()); openModal("psico-modal");
      return;
    }
    updateHud(); saveState(); Dx.refreshBtn();
    openProj(1, null, card);
  }

  // ---------------------------------------------------------------- C · diagnóstico diferencial
  const LIM_MIN = 3;
  const dif = (k) => { const b = Dx.book(k); b.dif = b.dif || {}; b.desc = b.desc || {}; b.invalidos = b.invalidos || 0; return b; };
  // evidências já vistas, cada uma com seu peso por diagnóstico
  function seenEvidence(k) {
    const out = [], b = Dx.book(k), c = Dx.kase(k);
    c.findings.forEach((f) => { if (b.found[f.d]) out.push({ key: "f:" + f.d, label: `${(Dx.dom(f.d) || {}).icon || ""} ${pick((Dx.dom(f.d) || { name: f.d }).name)}`, text: pick(f.text), pts: f.pts || {} }); });
    Object.entries(tests(k)).forEach(([bt, r]) => { if (!r.inc) out.push({ key: "t:" + bt, label: `${BATS[bt].icon} ${pick(BATS[bt].name)}`, text: `${Math.round(100 + 15 * r.zobs)} · ${band(r.zobs)}`, pts: r.pts }); });
    if (c.tardio && lateOn(k)) out.push({ key: "late", label: `🕓 ${tr("Achado tardio", "Late finding", "Hallazgo tardío")}`, text: pick(c.tardio.text), pts: c.tardio.pts });
    return out;
  }
  const candidates = (k) => Dx.opts(k);
  const discarded = (k) => candidates(k).filter((id) => dif(k).dif[id] === "descartada");
  const comorbidMarked = (k) => candidates(k).filter((id) => dif(k).dif[id] === "comorbida");
  // quantos diagnósticos o jogador precisa descartar para poder fechar
  function needDiscards(k) {
    const ans = CASES[k].diagnosis.answer, c = Dx.kase(k), b = dif(k);
    const reachable = candidates(k).filter((o) => o !== ans && (c.findings.some((f) => (f.pts || {})[o] < 0) || (c.tardio && (c.tardio.pts || {})[o] < 0)));
    const base = Math.max(0, reachable.length - (c.comorbid || []).length - (Wheel.active("raciocinio") ? 1 : 0));
    const canStillInvestigate = !(session && session.sess >= 4 && Dx.budgetLeft() < 6);
    const seen = seenEvidence(k), can = reachable.filter((o) => seen.some((e) => (e.pts || {})[o] < 0));
    void b;
    return canStillInvestigate ? base : Math.min(base, can.length);
  }
  const validDiscards = (k) => discarded(k).filter((id) => dif(k).desc[id] && (dif(k).desc[id].valid));
  function canClose(k) {
    const b = dif(k), miss = [];
    if (!b.hyp) miss.push(tr("Marque a hipótese principal na aba Hipóteses da ficha.", "Mark the main hypothesis in the chart's Hypotheses tab.", "Marca la hipótesis principal en la pestaña Hipótesis de la ficha."));
    if (Dx.foundList(k).length < 3) miss.push(tr("Reúna ao menos 3 achados.", "Gather at least 3 findings.", "Reúne al menos 3 hallazgos."));
    const need = needDiscards(k), has = validDiscards(k).length;
    if (has < need) miss.push(tr(`Descarte com evidência contrária mais ${need - has} diagnóstico(s) concorrente(s) (${has}/${need}).`, `Rule out ${need - has} more competing diagnosis(es) with contrary evidence (${has}/${need}).`, `Descarta con evidencia contraria ${need - has} diagnóstico(s) competidor(es) más (${has}/${need}).`));
    return { ok: !miss.length, miss };
  }
  // chamado por startDiagnosis: se faltar algo, mostra o que falta (o modo desenvolvedor pode passar direto)
  function canStart(go) {
    const k = cur();
    if (!k || !Dx.kase(k) || !session || session.secret) return true;
    const r = canClose(k);
    if (r.ok) return true;
    head(`⚖️ ${tr("Antes de fechar o caso", "Before closing the case", "Antes de cerrar el caso")}`, tr("O diagnóstico diferencial pede que você descarte ativamente as hipóteses concorrentes.", "Differential diagnosis asks you to actively rule out the competing hypotheses.", "El diagnóstico diferencial pide descartar activamente las hipótesis competidoras."));
    const ul = el("ul", "dx-notes"); r.miss.forEach((m) => ul.appendChild(el("li", "", m))); body().appendChild(ul);
    const row = el("div", "say-btns");
    const f = el("button", "pill-btn primary", `📋 ${tr("Abrir a ficha", "Open the chart", "Abrir la ficha")}`); f.type = "button"; f.addEventListener("click", () => { closeModal("psico-modal"); if (typeof openFicha === "function") { Dx.setTab && Dx.setTab("hipoteses"); openFicha(); } }); row.appendChild(f);
    const again = el("button", "pill-btn", tr("Tentar de novo", "Try again", "Intentar de nuevo")); again.type = "button"; again.addEventListener("click", () => { closeModal("psico-modal"); go(); }); row.appendChild(again);
    if (settings.dev) { const skip = el("button", "pill-btn", "🛠 " + tr("Fechar assim mesmo", "Close anyway", "Cerrar igual")); skip.type = "button"; skip.addEventListener("click", () => { session.difSkip = true; closeModal("psico-modal"); go(); }); row.appendChild(skip); }
    body().appendChild(row);
    openModal("psico-modal");
    return false;
  }
  // "Diagnóstico livre" (Opções): pula a exigência de descartar hipóteses concorrentes antes de fechar o caso
  const canStartOk = (go) => { if ((session && session.difSkip) || (typeof settings !== "undefined" && settings.freeDx)) return true; return canStart(go); };

  // o raciocínio do último descarte aparece DENTRO da aba de hipóteses, sem tirar o jogador da ficha
  let ultimaExplicacao = null;
  const explicar = (titulo, texto, acertou) => { ultimaExplicacao = { titulo, texto, acertou }; };

  function openDiscard(k, id, refresh) {
    ultimaExplicacao = null;
    head(`🗑️ ${tr("Descartar", "Rule out", "Descartar")}: ${disorderName(id)}`, tr("Qual evidência já coletada contradiz esta hipótese?", "Which collected evidence contradicts this hypothesis?", "¿Qué evidencia recogida contradice esta hipótesis?"));
    const list = seenEvidence(k);
    if (!list.length) body().appendChild(el("p", "shop-note", tr("Ainda não há evidências vistas.", "No evidence seen yet.", "Aún no hay evidencias vistas.")));
    list.forEach((e) => {
      const btn = el("button", "dx-opt", `${e.label}: ${e.text}`); btn.type = "button";
      btn.addEventListener("click", () => {
        const b = dif(k), valid = (e.pts[id] || 0) < 0;
        // além de certo/errado, explica o raciocínio: por que a hipótese cai, ou o que olhar quando não cai.
        // O texto por caso fica em content/dx.json (campo difWhy); sem ele, a mensagem genérica continua valendo.
        const porque = ((Dx.kase(k) || {}).difWhy || {})[id] || null;
        if (valid) {
          b.dif[id] = "descartada"; b.desc[id] = { key: e.key, valid: true }; Wheel.gain("raciocinio", 1); sfx("unlock");
          if (porque && porque.ok) explicar(`🗑️ ${disorderName(id)}`, pick(porque.ok), true);
          else showToast(`✅ ${tr("Descartado com evidência contrária", "Ruled out with contrary evidence", "Descartado con evidencia contraria")}`);
        } else {
          b.invalidos += 1; sfx("bad");
          if (porque && porque.dica) explicar(`${tr("Ainda não dá para descartar", "Not enough to rule out yet", "Aún no se puede descartar")}: ${disorderName(id)}`, pick(porque.dica), false);
          else showToast(`✗ ${tr("Esta evidência não contradiz a hipótese", "This evidence does not contradict the hypothesis", "Esta evidencia no contradice la hipótesis")}`);
        }
        saveState(); closeModal("psico-modal"); if (refresh) refresh();
      });
      body().appendChild(btn);
    });
    const c = el("button", "pill-btn", tr("Cancelar", "Cancel", "Cancelar")); c.type = "button"; c.addEventListener("click", () => closeModal("psico-modal")); body().appendChild(c);
    openModal("psico-modal");
  }
  // linhas extras na aba Hipóteses: descartar / comórbida
  function panelDiff(p, k, refresh) {
    if (window.ClinicFSM && ClinicFSM.ativo()) ClinicFSM.ir("diferencial");
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("diferencial"), 500);     const b = dif(k), need = needDiscards(k);
    p.appendChild(el("h3", "aqx-h", `⚖️ ${tr("Diagnóstico diferencial", "Differential diagnosis", "Diagnóstico diferencial")} · ${validDiscards(k).length}/${need}`));
    p.appendChild(el("p", "shop-note", tr("Para fechar o caso, descarte hipóteses concorrentes mostrando a evidência que as contradiz. Você também pode marcar uma comorbidade.", "To close the case, rule out competing hypotheses by showing the evidence that contradicts them. You can also mark one comorbidity.", "Para cerrar el caso, descarta hipótesis competidoras mostrando la evidencia que las contradice. También puedes marcar una comorbilidad.")));
    if (ultimaExplicacao) {
      const cx = el("div", ultimaExplicacao.acertou ? "dx-why ok" : "dx-why");
      cx.appendChild(el("b", null, ultimaExplicacao.titulo));
      cx.appendChild(el("p", null, ultimaExplicacao.texto));
      p.appendChild(cx);
    }
    candidates(k).forEach((id) => {
      if (id === b.hyp) return;
      const st = b.dif[id], row = el("div", "dx-hyp" + (st === "descartada" ? " done" : ""));
      row.appendChild(el("b", "", `${st === "descartada" ? "🗑️ " : st === "comorbida" ? "➕ " : ""}${disorderName(id)}`));
      const bx = el("span", "");
      if (st === "descartada" || st === "comorbida") { const undo = el("button", "pill-btn small", tr("Desfazer", "Undo", "Deshacer")); undo.type = "button"; undo.addEventListener("click", () => { delete b.dif[id]; delete b.desc[id]; saveState(); refresh(); }); bx.appendChild(undo); }
      else {
        const d = el("button", "pill-btn small", tr("Descartar", "Rule out", "Descartar")); d.type = "button"; d.addEventListener("click", () => openDiscard(k, id, refresh)); bx.appendChild(d);
        const cm = el("button", "pill-btn small", tr("Comórbida", "Comorbid", "Comórbida")); cm.type = "button"; cm.addEventListener("click", () => { candidates(k).forEach((o) => { if (b.dif[o] === "comorbida") delete b.dif[o]; }); b.dif[id] = "comorbida"; saveState(); refresh(); }); bx.appendChild(cm);
      }
      row.appendChild(bx); p.appendChild(row);
    });
  }
  // dados para a interface (Svelte): mesmas regras dos painéis acima, sem DOM
  function testsData(k) {
    const c = Dx.kase(k), t = tests(k);
    return {
      late: c && c.tardio && lateOn(k) ? { title: `🕓 ${tr("Achado tardio", "Late finding", "Hallazgo tardío")}`, text: pick(c.tardio.text) } : null,
      title: `🧪 ${tr("Testes aplicados", "Tests applied", "Pruebas aplicadas")}`,
      tests: Object.keys(t).map((b) => { const r = t[b]; return { text: `${BATS[b].icon} ${pick(BATS[b].name)}: ${Math.round(100 + 15 * r.zobs)} (± ${Math.round(15 * r.margem)}) · ${band(r.zobs)}${r.inc ? " · " + tr("inconclusivo", "inconclusive", "no concluyente") : ""}`, inc: r.inc }; })
    };
  }
  function diffData(k) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("diferencial"), 500);     const b = dif(k), need = needDiscards(k);
    return {
      title: `⚖️ ${tr("Diagnóstico diferencial", "Differential diagnosis", "Diagnóstico diferencial")} · ${validDiscards(k).length}/${need}`,
      intro: tr("Para fechar o caso, descarte hipóteses concorrentes mostrando a evidência que as contradiz. Você também pode marcar uma comorbidade.", "To close the case, rule out competing hypotheses by showing the evidence that contradicts them. You can also mark one comorbidity.", "Para cerrar el caso, descarta hipótesis competidoras mostrando la evidencia que las contradice. También puedes marcar una comorbilidad."),
      rows: candidates(k).filter((id) => id !== b.hyp).map((id) => ({ id, name: disorderName(id), state: b.dif[id] || null, discard: tr("Descartar", "Rule out", "Descartar"), comorbid: tr("Comórbida", "Comorbid", "Comórbida"), undo: tr("Desfazer", "Undo", "Deshacer") }))
    };
  }
  const notifyState = () => { try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* nada */ } };
  const diffActions = {
    discard(id) { openDiscard(cur(), id, notifyState); },
    comorbid(id) { const k = cur(), b = dif(k); candidates(k).forEach((o) => { if (b.dif[o] === "comorbida") delete b.dif[o]; }); b.dif[id] = "comorbida"; saveState(); notifyState(); },
    undo(id) { const b = dif(cur()); delete b.dif[id]; delete b.desc[id]; saveState(); notifyState(); }
  };
  // efeitos no fechamento: comorbidade, revisão da hipótese na 4ª consulta, descartes inválidos
  function reviewExtra(k, id, ok) {
    const c = Dx.kase(k), b = dif(k), out = { bonus: 0, factor: 1, lines: [] };
    const com = comorbidMarked(k)[0], real = c.comorbid || [];
    if (com) {
      if (real.includes(com)) { out.bonus += 6; Wheel.rep().academica += 1; out.lines.push(tr(`Comorbidade reconhecida (${disorderName(com)}): +6 de raciocínio e +1 de Reputação Acadêmica.`, `Comorbidity recognized (${disorderName(com)}): +6 reasoning and +1 Academic Reputation.`, `Comorbilidad reconocida (${disorderName(com)}): +6 de razonamiento y +1 de Reputación Académica.`)); }
      else { out.bonus -= 5; out.lines.push(tr(`Sobrediagnóstico: ${disorderName(com)} não é comorbidade deste caso (−5).`, `Overdiagnosis: ${disorderName(com)} is not a comorbidity in this case (−5).`, `Sobrediagnóstico: ${disorderName(com)} no es comorbilidad de este caso (−5).`)); }
    }
    if (b.invalidos > 0) { out.factor *= 0.9; out.lines.push(tr(`${b.invalidos} tentativa(s) de descarte sem evidência contrária: raciocínio menos rigoroso (×0,9).`, `${b.invalidos} ruling-out attempt(s) without contrary evidence: less rigorous reasoning (×0.9).`, `${b.invalidos} intento(s) de descarte sin evidencia contraria: razonamiento menos riguroso (×0,9).`)); }
    if (c.armadilha && lateOn(k)) {
      if (b.hyp === c.armadilha || id === c.armadilha) { out.bonus -= 6; out.lines.push(tr(`Ancoragem: depois do achado tardio, a hipótese ${disorderName(c.armadilha)} precisava ser revista (−6).`, `Anchoring: after the late finding, the ${disorderName(c.armadilha)} hypothesis needed revising (−6).`, `Anclaje: tras el hallazgo tardío, la hipótesis ${disorderName(c.armadilha)} debía revisarse (−6).`)); }
      else if (ok) { out.bonus += 8; Wheel.gain("raciocinio", 2); out.lines.push(tr("Você revisou a hipótese inicial diante do achado tardio: +8 e +2 pontos de Raciocínio.", "You revised the initial hypothesis after the late finding: +8 and +2 Reasoning points.", "Revisaste la hipótesis inicial ante el hallazgo tardío: +8 y +2 puntos de Razonamiento.")); }
    }
    if (ok && b.invalidos === 0 && validDiscards(k).length >= Math.max(1, needDiscards(k))) out.factor *= 1.1;
    return out;
  }
  // 4ª consulta: avisa quando o achado tardio chega
  function onStep() {
    const k = cur(), c = k && Dx.kase(k);
    if (!c || !c.tardio || !session || session.tardioShown || session.stepIndex !== 0 || (session.sess || 1) < 4) return;
    session.tardioShown = true;
    setTimeout(() => showToast(`🕓 ${tr("Chegou um achado tardio: veja a aba Achados da ficha.", "A late finding arrived: see the chart's Findings tab.", "Llegó un hallazgo tardío: mira la pestaña Hallazgos de la ficha.")}`), 700);
    if ($("ficha-new")) $("ficha-new").classList.remove("hidden");
  }

  // ---------------------------------------------------------------- D · laudo jogável
  const TXL = { psico: L("Psicoterapia", "Psychotherapy", "Psicoterapia"), psicpsiq: L("Psicoterapia + avaliação psiquiátrica", "Psychotherapy + psychiatric evaluation", "Psicoterapia + evaluación psiquiátrica"), familia: L("Orientação à família e escola", "Family and school guidance", "Orientación a familia y escuela"), grupo: L("Grupo terapêutico", "Therapy group", "Grupo terapéutico") };
  function openLaudo(next) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("laudo"), 500);     const k = cur(), c = CASES[k], ans = c.diagnosis.answer, b = dif(k);
    const ev = seenEvidence(k), st = { cited: {}, concl: b.hyp || null, com: comorbidMarked(k)[0] || null, rec: {}, lim: false, simples: false, descartes: {} };
    const inconclusive = Object.values(tests(k)).some((r) => r.inc) || Object.values(projOf(k)).some((p) => p.wrong);
    const render = () => {
      head(`📝 ${tr("Laudo", "Report", "Informe")}`, tr("Monte o laudo: escolha o que destacar, a conclusão, as recomendações e a linguagem. A qualidade depende de coerência, cobertura, clareza e limitações.", "Build the report: choose what to highlight, the conclusion, the recommendations and the language. Quality depends on coherence, coverage, clarity and limitations.", "Monta el informe: elige qué destacar, la conclusión, las recomendaciones y el lenguaje. La calidad depende de coherencia, cobertura, claridad y limitaciones."));
      const sec = (t) => body().appendChild(el("h3", "aqx-h", t));
      sec(`1 · ${tr("Procedimentos", "Procedures", "Procedimientos")}`);
      body().appendChild(el("p", "shop-note", [`${Dx.foundList(k).length} ${tr("áreas de investigação", "investigation areas", "áreas de investigación")}`].concat(Object.keys(tests(k)).map((x) => pick(BATS[x].name))).join(" · ")));
      sec(`2 · ${tr("Resultados a destacar (até 4)", "Results to highlight (up to 4)", "Resultados a destacar (hasta 4)")}`);
      ev.forEach((e) => { const on = Boolean(st.cited[e.key]); const bt = el("button", "dx-opt" + (on ? " on" : ""), `${on ? "✓ " : ""}${e.label}: ${e.text}`); bt.type = "button"; bt.addEventListener("click", () => { if (on) delete st.cited[e.key]; else if (Object.keys(st.cited).length < 4) st.cited[e.key] = true; render(); }); body().appendChild(bt); });
      sec(`3 · ${tr("Conclusão diagnóstica", "Diagnostic conclusion", "Conclusión diagnóstica")}`);
      Dx.opts(k).forEach((id) => { const on = st.concl === id; const bt = el("button", "dx-opt" + (on ? " on" : ""), `${on ? "⭐ " : ""}${disorderName(id)}`); bt.type = "button"; bt.addEventListener("click", () => { st.concl = id; if (st.com === id) st.com = null; render(); }); body().appendChild(bt); });
      sec(`4 · ${tr("Recomendações (2 a 3)", "Recommendations (2 to 3)", "Recomendaciones (2 a 3)")}`);
      FU.TX_OPTIONS.forEach((id) => { const on = Boolean(st.rec[id]); const bt = el("button", "dx-opt" + (on ? " on" : ""), `${on ? "✓ " : ""}${pick(TXL[id])}`); bt.type = "button"; bt.addEventListener("click", () => { if (on) delete st.rec[id]; else if (Object.keys(st.rec).length < 3) st.rec[id] = true; render(); }); body().appendChild(bt); });
      // 5 · O DESCARTE DO DIFERENCIAL (7.6). Concluir era escolher uma opção; o que faltava era a outra
      // metade do raciocínio clínico: dizer POR QUE as outras caem. E não vale dizer de boca — tem de
      // ser com uma evidência que o próprio jogador marcou CONTRA aquela hipótese, na ficha. Quem não
      // marcou nada volta para a ficha, que é exatamente onde essas mecânicas estavam escondidas.
      sec(`5 · ${tr("Diferenciais descartados", "Differentials ruled out", "Diferenciales descartados")}`);
      const concorrentes = Dx.opts(k).filter((id) => id !== st.concl && id !== st.com);
      if (!st.concl) body().appendChild(el("p", "shop-note", tr("Escolha a conclusão primeiro.", "Choose the conclusion first.", "Elige primero la conclusión.")));
      else if (!concorrentes.length) body().appendChild(el("p", "shop-note", tr("Não sobrou concorrente para descartar.", "No competing hypothesis left to rule out.", "No quedó competidora que descartar.")));
      else {
        if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("descarte"), 500);
        body().appendChild(el("p", "shop-note", tr("Para cada hipótese que você NÃO fechou, aponte o achado que a contradiz — o mesmo que você marcou contra ela na ficha (aba Hipóteses). Sem isso o laudo não sai: concluir sem descartar é opinião, não diferencial.", "For each hypothesis you did NOT close, point to the finding that contradicts it — the same one you marked against it in the chart (Hypotheses tab). Without this the report cannot be issued: concluding without ruling out is an opinion, not a differential.", "Para cada hipótesis que NO cerraste, señala el hallazgo que la contradice — el mismo que marcaste en contra en la ficha (pestaña Hipótesis). Sin eso el informe no sale: concluir sin descartar es opinión, no diferencial.")));
        concorrentes.forEach((id) => {
          const linha = el("div", "dx-find");
          linha.appendChild(el("b", "", `⚖️ ${disorderName(id)}`));
          // achado ambíguo não descarta ninguém: se ele pesa igual para a hipótese que se quer derrubar,
          // usá-lo como prova contra é exatamente o erro que o diferencial existe para evitar (7.11)
          const contras = Dx.foundList(k).filter((d2) => Dx.marcaDe(k, id, d2.id) < 0 && !(Dx.ambiguoEntre && Dx.ambiguoEntre(k, d2.id, id)));
          const ambiguos = Dx.foundList(k).filter((d2) => Dx.marcaDe(k, id, d2.id) < 0 && Dx.ambiguoEntre && Dx.ambiguoEntre(k, d2.id, id));
          if (ambiguos.length) linha.appendChild(el("small", "dx-hint", `🔀 ${tr(`${ambiguos.length} achado(s) que você marcou contra esta hipótese pesam igual para ela e para a sua conclusão — não servem para descartar.`, `${ambiguos.length} finding(s) you marked against this hypothesis weigh the same for it and for your conclusion — they cannot rule it out.`, `${ambiguos.length} hallazgo(s) que marcaste en contra pesan igual para ella y para tu conclusión — no sirven para descartar.`)}`));
          if (!contras.length) {
            linha.appendChild(el("small", "dx-hint", tr("Você ainda não marcou nada contra esta hipótese. Abra a ficha → Hipóteses, toque nesta hipótese e marque o achado que a contradiz.", "You have not marked anything against this hypothesis yet. Open the chart → Hypotheses, tap this hypothesis and mark the finding that contradicts it.", "Todavía no marcaste nada en contra de esta hipótesis. Abre la ficha → Hipótesis, toca esta hipótesis y marca el hallazgo que la contradice.")));
          } else {
            contras.forEach((d2) => {
              const f2 = Dx.finding(k, d2.id);
              const on = st.descartes[id] === d2.id;
              const bt = el("button", "dx-opt desc-opt" + (on ? " on" : ""), `${on ? "✓ " : ""}${d2.icon} ${pick(f2 ? f2.text : d2.neg)}`);
              bt.dataset.hip = id; bt.dataset.dom = d2.id;
              bt.type = "button";
              bt.addEventListener("click", () => { st.descartes[id] = on ? null : d2.id; if (!st.descartes[id]) delete st.descartes[id]; render(); });
              linha.appendChild(bt);
            });
          }
          body().appendChild(linha);
        });
        const faltam = concorrentes.filter((id) => !st.descartes[id]).length;
        body().appendChild(el("p", faltam ? "dx-hint" : "say-note", faltam
          ? tr(`Faltam ${faltam} hipótese(s) para descartar.`, `${faltam} hypothesis(es) still to rule out.`, `Faltan ${faltam} hipótesis por descartar.`)
          : tr("Diferencial completo: cada concorrente caiu com prova.", "Differential complete: each competitor fell with evidence.", "Diferencial completo: cada competidora cayó con prueba.")));
      }
      sec(`6 · ${tr("Limitações", "Limitations", "Limitaciones")}`);
      const lim = el("button", "dx-opt" + (st.lim ? " on" : ""), `${st.lim ? "✓ " : ""}${tr("Registrar as limitações da avaliação (testes inconclusivos, leituras incertas, tempo)", "Record the assessment's limitations (inconclusive tests, uncertain readings, time)", "Registrar las limitaciones de la evaluación (pruebas no concluyentes, lecturas inciertas, tiempo)")}${inconclusive ? " ⚠️" : ""}`); lim.type = "button"; lim.addEventListener("click", () => { st.lim = !st.lim; render(); }); body().appendChild(lim);
      sec(`7 · ${tr("Linguagem para quem vai ler", "Language for the reader", "Lenguaje para quien lo lee")}`);
      const who = c.parent ? tr("família", "family", "familia") : tr("paciente", "patient", "paciente");
      [[false, tr("Técnica (jargão)", "Technical (jargon)", "Técnica (jerga)")], [true, `${tr("Acessível para", "Plain language for", "Accesible para")} ${who}`]].forEach(([v, lbl]) => { const bt = el("button", "dx-opt" + (st.simples === v ? " on" : ""), `${st.simples === v ? "● " : "○ "}${lbl}`); bt.type = "button"; bt.addEventListener("click", () => { st.simples = v; render(); }); body().appendChild(bt); });
      const q = quality(k, st, ev, inconclusive);
      const meter = el("div", "wheel-prog"), f = el("span", "wheel-prog-f"); f.style.width = `${q.total}%`; meter.appendChild(f);
      body().appendChild(el("p", "uni-q", `${tr("Qualidade do laudo", "Report quality", "Calidad del informe")}: ${q.total}/100`)); body().appendChild(meter);
      const go = el("button", "pill-btn primary", `📄 ${tr("Emitir laudo", "Issue report", "Emitir informe")}`); go.type = "button"; go.disabled = !st.concl || Dx.opts(k).filter((id) => id !== st.concl && id !== st.com).some((id) => !st.descartes[id]); go.addEventListener("click", () => { closeModal("psico-modal"); session.laudo = { q: q.total, concl: st.concl, ok: st.concl === ans }; state.laudos = state.laudos || []; state.laudos.push({ caso: k, q: q.total, semana: state.week || 1, conclusao: st.concl }); Wheel.gain("laudo", q.total >= 80 ? 2 : 1); saveState(); next(); }); body().appendChild(go);
      openModal("psico-modal");
    };
    render();
  }
  // qualidade do laudo (0–100): 30 coerência + 20 cobertura + 20 clareza + 10 limitações + 10 recomendações + 10 descarte do diferencial (7.6)
  function quality(k, st, ev, inconclusive) {
    const c = CASES[k], ans = c.diagnosis.answer, cited = ev.filter((e) => st.cited[e.key]);
    const support = cited.length ? cited.filter((e) => (e.pts[st.concl] || 0) > 0).length / cited.length : 0;
    let coer = st.concl ? (st.concl === ans ? 1 : 0.3) * (0.5 + 0.5 * support) : 0;
    if (typeof Events !== "undefined" && Events.stress() >= 85) coer = Math.max(0, coer - 0.1);   // estresse muito alto: laudo menos coerente
    const secoes = [cited.length > 0, Boolean(st.concl), Object.keys(st.rec).length >= 2, st.lim, true, true].filter(Boolean).length;
    if (Wheel.active("laudo")) coer = Math.min(1, coer + 0.05 * secoes);
    const relev = ev.filter((e) => (e.pts[ans] || 0) > 0), cover = relev.length ? Math.min(1, cited.filter((e) => (e.pts[ans] || 0) > 0).length / Math.min(3, relev.length)) : (cited.length ? 1 : 0);
    const clar = st.simples ? 1 : 0.5;
    const lim = st.lim ? 1 : inconclusive ? 0 : 0.5;
    const rec = st.rec[FU.txAnswer(k)] ? (Object.keys(st.rec).length <= 3 ? 1 : 0.6) : 0.2;
    // o descarte só vale quando a evidência escolhida REALMENTE pesa contra a hipótese derrubada:
    // apontar qualquer achado para se livrar da exigência não é diferencial, é preencher formulário
    const conc = Dx.opts(k).filter((id) => id !== st.concl && id !== st.com);
    const bons = conc.filter((id) => { const d2 = (st.descartes || {})[id]; if (!d2) return false; const f2 = Dx.finding(k, d2); return f2 && (f2.pts || {})[id] !== undefined ? (f2.pts[id] || 0) <= 0 : true; }).length;
    const desc = conc.length ? bons / conc.length : 1;
    return { total: Math.round(30 * coer + 20 * cover + 20 * clar + 10 * lim + 10 * rec + 10 * desc), coer, cover, clar, desc };
  }

  // ---------------------------------------------------------------- D · devolutiva jogável (3 rodadas)
  const ROUNDS = [
    { who: L("Tenho uma dúvida: o que isso quer dizer, na prática?", "I have a question: what does this mean, in practice?", "Tengo una duda: ¿qué significa esto en la práctica?"), o: {
      empatica: [L("Entendo que dê dúvida. Vamos com calma: eu explico e você me diz se ficou claro.", "I understand the doubt. Let's go slowly: I explain and you tell me if it is clear.", "Entiendo la duda. Vamos con calma: yo explico y tú me dices si quedó claro."), 1, 2],
      clara: [L("Em palavras simples: os resultados mostram este padrão, e existe tratamento que costuma ajudar.", "In plain words: the results show this pattern, and there is treatment that usually helps.", "En palabras simples: los resultados muestran este patrón y existe tratamiento que suele ayudar."), 2, 1],
      tecnica: [L("Os critérios do manual foram atendidos nos domínios avaliados, com significância clínica.", "The manual's criteria were met in the assessed domains, with clinical significance.", "Se cumplieron los criterios del manual en los dominios evaluados, con significación clínica."), 1, -1],
      alarmista: [L("É sério: sem tratamento isso pode piorar bastante e rápido.", "It is serious: without treatment this can get much worse, fast.", "Es serio: sin tratamiento esto puede empeorar mucho y rápido."), -1, -2] } },
    { who: L("(fica em silêncio) Isso me assusta um pouco...", "(falls silent) This scares me a little...", "(se queda en silencio) Esto me asusta un poco..."), o: {
      empatica: [L("É natural ter medo. Você não está sozinho(a) nisso, e vamos decidir juntos os próximos passos.", "Fear is natural. You are not alone in this, and we will decide the next steps together.", "Es natural tener miedo. No estás solo(a) en esto y decidiremos juntos los próximos pasos."), 1, 3],
      clara: [L("O nome não muda quem você é: é uma forma de entender o que acontece e de escolher o cuidado certo.", "The name does not change who you are: it is a way to understand what is happening and choose the right care.", "El nombre no cambia quién eres: es una forma de entender lo que pasa y elegir el cuidado adecuado."), 1, 1],
      tecnica: [L("O prognóstico é variável e depende de adesão às condutas recomendadas.", "The prognosis is variable and depends on adherence to the recommended care.", "El pronóstico es variable y depende de la adhesión a las conductas recomendadas."), -1, -2],
      alarmista: [L("Você deve mesmo se preocupar: muita gente não leva a sério e se arrepende depois.", "You should worry: many people do not take it seriously and regret it later.", "Debes preocuparte: mucha gente no lo toma en serio y luego se arrepiente."), -1, -3] } },
    { who: L("Não sei se concordo... será que não é só uma fase?", "I don't know if I agree... could it be just a phase?", "No sé si estoy de acuerdo... ¿será solo una fase?"), o: {
      empatica: [L("Faz sentido duvidar. Podemos rever juntos o que encontramos e acompanhar como as coisas evoluem.", "It makes sense to doubt. We can review what we found together and follow how things evolve.", "Tiene sentido dudar. Podemos revisar juntos lo que encontramos y seguir cómo evolucionan las cosas."), 1, 2],
      clara: [L("Pode ser que melhore, e vamos acompanhar. Mas o que vimos aqui aparece há tempo e atrapalha o dia a dia, por isso vale cuidar.", "It may improve, and we will follow up. But what we saw has been present for a while and gets in the way of daily life, so care is worthwhile.", "Puede mejorar y haremos seguimiento. Pero lo que vimos lleva tiempo y estorba la vida diaria, por eso vale cuidarlo."), 2, 1],
      tecnica: [L("A cronicidade e o prejuízo funcional descartam a hipótese de fase transitória.", "Chronicity and functional impairment rule out a transient phase.", "La cronicidad y el perjuicio funcional descartan una fase transitoria."), 0, -1],
      alarmista: [L("Se achar que é fase, pode ser tarde demais quando perceber.", "If you think it is a phase, it may be too late when you notice.", "Si piensas que es una fase, puede ser tarde cuando lo notes."), -1, -3] } }
  ];
  function openDevol(next) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("devolutiva"), 500);     const k = cur(), c = CASES[k], st = { i: 0, c: 0, a: 0, alarm: 0, log: [] };
    const risk = typeof Risk !== "undefined" ? Risk.devolRound(k) : null, rounds = risk ? ROUNDS.concat([{ who: risk.who, risk: true, o: {} }]) : ROUNDS;
    const leigo = true;   // paciente ou família: linguagem técnica pesa contra
    const render = () => {
      head(`🗣️ ${tr("Devolutiva", "Feedback session", "Devolutiva")}`, `${pick(c.name)}${c.parent ? " + " + pick(c.parent.name) : ""} · ${st.i + 1}/${rounds.length}`);
      const r = rounds[st.i];
      if (r.risk) {   // 4ª rodada: conduta diante do risco (omissão, proporcional ou punitiva)
        const talk = el("div", "say-row pat"); talk.appendChild(el("b", "", `💬 ${pick(c.name)}`)); talk.appendChild(el("p", "", pick(r.who))); body().appendChild(talk);
        Object.keys(risk.o).forEach((key) => { const [txt, code] = risk.o[key]; const bt = el("button", "dx-opt", pick(txt)); bt.type = "button"; bt.addEventListener("click", () => { const e = Risk.devolChoice(k, code); st.c += e.c; st.a += e.a; if (code === "C") st.alarm += 1; session.riskCode = code; st.i += 1; sfx(e.a >= 0 ? "good" : "bad"); end(); }); body().appendChild(bt); });
        openModal("psico-modal"); return;
      }
      const talk = el("div", "say-row pat"); talk.appendChild(el("b", "", `💬 ${pick(c.parent && st.i === 1 ? c.parent.name : c.name)}`)); talk.appendChild(el("p", "", pick(r.who))); body().appendChild(talk);
      Object.keys(r.o).forEach((style) => {
        const [txt, dc, da] = r.o[style]; const bt = el("button", "dx-opt", pick(txt)); bt.type = "button";
        bt.addEventListener("click", () => { st.c += leigo && style === "tecnica" ? Math.min(dc, 0) : dc; st.a += da + (Wheel.active("devolutiva") ? 1 : 0); if (style === "alarmista") st.alarm += 1; st.i += 1; sfx(da >= 1 ? "good" : "bad"); if (st.i >= rounds.length) end(); else render(); });
        body().appendChild(bt);
      });
      body().appendChild(el("p", "shop-note", `${tr("Compreensão", "Understanding", "Comprensión")} ${st.c} · ${tr("Aliança", "Alliance", "Alianza")} ${st.a}`));
      openModal("psico-modal");
    };
    const end = () => {
      const ok = session.dx && session.dx.ok, ql = (session.laudo && session.laudo.q) || 0;
      let adesao = 50 + 8 * st.c + 6 * st.a + (ql >= 80 ? 4 : 0) - (st.alarm ? 10 : 0) - (ok ? 0 : 10) + (Wheel.active("devolutiva") ? 10 : 0);
      if (session.laudo && !session.laudo.ok) adesao -= 15;
      adesao = clamp(Math.round(adesao), 0, 100);
      session.devol = { adesao, c: st.c, a: st.a };
      const rec = FU.rec(k); rec.adesao = adesao; saveState();
      head(`🗣️ ${tr("Devolutiva concluída", "Feedback completed", "Devolutiva terminada")}`, null);
      body().appendChild(el("p", "uni-q", `${tr("Adesão ao tratamento", "Treatment adherence", "Adhesión al tratamiento")}: ${adesao}/100`));
      const meter = el("div", "wheel-prog"), f = el("span", "wheel-prog-f"); f.style.width = `${adesao}%`; meter.appendChild(f); body().appendChild(meter);
      body().appendChild(el("p", "shop-note", adesao >= 70 ? tr("O paciente sai confiante e disposto a seguir o cuidado.", "The patient leaves confident and willing to follow the care.", "El paciente sale confiado y dispuesto a seguir el cuidado.") : adesao >= 50 ? tr("Saiu com dúvidas, mas volta para o acompanhamento.", "Left with doubts, but will come back for follow-up.", "Salió con dudas, pero vuelve para el seguimiento.") : tr("A devolutiva não pegou bem: a adesão ficou baixa.", "The feedback did not land well: adherence is low.", "La devolutiva no cayó bien: la adhesión quedó baja.")));
      const go = el("button", "pill-btn primary", tr("Concluir", "Finish", "Concluir")); go.type = "button"; go.addEventListener("click", () => { closeModal("psico-modal"); next(); }); body().appendChild(go);
    };
    render();
  }

  return { testsData, diffData, diffActions, openDiscard, openTest, openProj, items, panelTests, panelDiff, canStart: canStartOk, canClose, needDiscards, reviewExtra, onStep, openLaudo, openDevol, quality, BATS, TECH, tests, seenEvidence,
           comorbidas: comorbidMarked };   // a ficha usa para saber que uma contradição foi resolvida assumindo comorbidade
})();

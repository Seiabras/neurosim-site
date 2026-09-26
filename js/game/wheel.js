"use strict";

// ===========================================================================
// Roda do psicólogo: as abordagens que você mais usa definem o seu tipo.
//  · o tipo dominante dá uma vantagem real no jogo (perk)
//  · o tipo destrava a 5ª opção "de perfil" nas consultas (as 4 abordagens continuam)
//  · respostas boas abrem um diálogo extra (árvore de diálogo) com a reação do paciente
// ===========================================================================
const Wheel = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const IDS = ["acolhimento", "tcc", "psicodinamica", "psicoeducacao", "comportamental", "diretiva"];
  const NEED_USES = 6, NEED_SHARE = 0.2, ACTIVE_AT = 3, MAX_LVL = 10;
  // FAIXAS (7.4). O bônus ligava em 3 e ficava igual até 10: passar de 3 para 9 não mudava nada no jogo,
  // e o eixo virava um número enfeitando o radar. Agora há três degraus — 3 abre, 6 amplia, 10 é maestria.
  const FAIXAS = [3, 6, 10];
  const faixa = (id) => { const n = level(id); return n >= FAIXAS[2] ? 3 : n >= FAIXAS[1] ? 2 : n >= FAIXAS[0] ? 1 : 0; };
  const porFaixa = (id, v0, v1, v2, v3) => [v0, v1, v2, v3][faixa(id)];

  // ------------------------------------------------------------ os 8 eixos do psicodiagnóstico (ordem = sentido horário no radar)
  // ap: a abordagem das consultas que alimenta o eixo (laudo e articulação vêm de outras ações)
  const AXES = [
    { id: "anamnese", ap: "acolhimento", icon: "🤝", name: L("Anamnese & Vínculo", "History & Bond", "Anamnesis y Vínculo"), bonus: L("Defensividade inicial −15%, +6 de vínculo e pacientes esperam +20 min antes de cancelar.", "Initial defensiveness −15%, +6 bond and patients wait +20 min before cancelling.", "Defensividad inicial −15%, +6 de vínculo y los pacientes esperan +20 min antes de cancelar.") },
    { id: "psicometria", ap: "tcc", icon: "🧠", name: L("Psicometria & Neuropsicologia", "Psychometrics & Neuropsychology", "Psicometría y Neuropsicología"), bonus: L("+20% de precisão nos testes estruturados (minijogos rendem 20% mais).", "+20% accuracy in structured tests (minigames pay 20% more).", "+20% de precisión en pruebas estructuradas (los minijuegos rinden 20% más).") },
    { id: "projetivas", ap: "psicodinamica", icon: "🎨", name: L("Técnicas Projetivas", "Projective Techniques", "Técnicas Proyectivas"), bonus: L("Abordar traumas e áreas delicadas gasta menos energia (2 em vez de 5).", "Approaching trauma and sensitive areas costs less energy (2 instead of 5).", "Abordar traumas y áreas delicadas gasta menos energía (2 en vez de 5).") },
    { id: "observacao", ap: "comportamental", icon: "👁️", name: L("Observação Comportamental", "Behavioral Observation", "Observación Conductual"), bonus: L("Mostra pistas da linguagem não verbal na fala do paciente durante a sessão.", "Shows non-verbal cues in the patient's speech during the session.", "Muestra pistas del lenguaje no verbal en el habla del paciente durante la sesión.") },
    { id: "raciocinio", ap: "diretiva", icon: "🧩", name: L("Raciocínio Clínico", "Clinical Reasoning", "Razonamiento Clínico"), bonus: L("Remove 1 diagnóstico errado da lista e poupa 20 min de análise ao fechar o caso.", "Removes 1 wrong diagnosis from the list and saves 20 min of analysis when closing the case.", "Quita 1 diagnóstico erróneo de la lista y ahorra 20 min de análisis al cerrar el caso.") },
    { id: "laudo", ap: null, icon: "📝", name: L("Elaboração de Laudo", "Report Writing", "Elaboración de Informe"), bonus: L("O laudo vale +25% e rende Reputação Acadêmica extra.", "The report is worth +25% and earns extra Academic Reputation.", "El informe vale +25% y da Reputación Académica extra.") },
    { id: "devolutiva", ap: "psicoeducacao", icon: "🗣️", name: L("Devolutiva & Psicoeducação", "Feedback & Psychoeducation", "Devolutiva y Psicoeducación"), bonus: L("Mais adesão ao resultado final e Reputação da Clínica em dobro.", "Better adherence to the final result and double Clinic Reputation.", "Más adhesión al resultado final y Reputación de la Clínica doble.") },
    { id: "multi", ap: null, icon: "🩺", name: L("Articulação Multidisciplinar", "Multidisciplinary Work", "Articulación Multidisciplinar"), bonus: L("Relatórios de escola e médicos na ficha e pacientes indicados por outros profissionais.", "School and medical reports in the chart, and patients referred by other professionals.", "Informes de escuela y médicos en la ficha y pacientes derivados por otros profesionales.") }
  ];
  const AX = Object.fromEntries(AXES.map((a) => [a.id, a]));
  const BY_AP = Object.fromEntries(AXES.filter((a) => a.ap).map((a) => [a.ap, a.id]));

  // ------------------------------------------------------------ estado (pontos por eixo, perfil dominante, reputação)
  function atributos() {
    if (!state.atributos) {   // saves antigos: aproveita os pontos que já existiam nas abordagens
      state.atributos = {};
      AXES.forEach((a) => { state.atributos[a.id] = a.ap && state.style ? state.style[a.ap] || 0 : 0; });
    }
    AXES.forEach((a) => { state.atributos[a.id] = state.atributos[a.id] || 0; });
    return state.atributos;
  }
  const rep = () => (state.rep = state.rep || { academica: 0, clinica: 0 });
  const level = (id) => Math.min(MAX_LVL, (atributos()[id] || 0) + (typeof Career !== "undefined" ? Career.bonus(id) : 0));   // + bônus temporário de congresso/artigo
  const active = (id) => level(id) >= ACTIVE_AT;
  const total = () => AXES.reduce((n, a) => n + (atributos()[a.id] || 0), 0);
  function gain(id, n) { if (!AX[id]) return; atributos()[id] += n || 1; state.perfilDominante = dominantAxis(); }
  function record(choice) { gain(BY_AP[choice.ap], choice.score >= 3 ? 2 : 1); }

  // eixo dominante (só existe depois de algumas escolhas e se um eixo se destacar)
  function dominantAxis() {
    const at = atributos(), n = total();
    if (n < NEED_USES) return null;
    const top = AXES.slice().sort((a, b) => at[b.id] - at[a.id])[0];
    return at[top.id] / n >= NEED_SHARE ? top.id : null;
  }
  // abordagem do perfil dominante (para a 5ª opção nas conversas); laudo e articulação não têm
  const dominant = () => { const d = dominantAxis(); return d && AX[d].ap ? AX[d].ap : null; };
  const profileProgress = () => { const n = total(); return { need: Math.max(0, NEED_USES - n), axis: dominantAxis(), pct: Math.min(1, n / NEED_USES) }; };

  // ------------------------------------------------------------ bônus (só cálculo; a tela não decide nada)
  const defense = () => porFaixa("anamnese", 1, 0.85, 0.78, 0.7);        // multiplica o vínculo mínimo para o paciente se abrir
  const testMult = () => porFaixa("psicometria", 1, 1.2, 1.3, 1.45);     // ganhos de testes estruturados (minijogos)
  const traumaEnergy = () => porFaixa("projetivas", 5, 2, 1, 0);         // energia gasta ao abordar áreas delicadas
  const laudoMult = () => porFaixa("laudo", 1, 1.25, 1.4, 1.6);
  const repClinicMult = () => porFaixa("devolutiva", 1, 2, 2, 3);
  function perk(kind) {   // nomes antigos, usados em outros pontos do jogo
    if (kind === "affinity") return porFaixa("anamnese", 0, 6, 9, 12);
    if (kind === "wait") return porFaixa("anamnese", 0, 20, 30, 40);
    return kind === "uni" || kind === "coins" ? 1 : 0;
  }
  // 👁️ pistas de linguagem não verbal (fixas por caso e passo, para não mudar ao reabrir)
  const CUES = [
    L("(evita o seu olhar por um instante)", "(avoids your gaze for a moment)", "(evita tu mirada un instante)"),
    L("(aperta as mãos no colo)", "(clasps their hands in their lap)", "(aprieta las manos en el regazo)"),
    L("(balança a perna sem perceber)", "(bounces a leg without noticing)", "(mueve la pierna sin darse cuenta)"),
    L("(respira mais curto e rápido)", "(breathes shorter and faster)", "(respira más corto y rápido)"),
    L("(a voz fica mais baixa no final da frase)", "(the voice drops at the end of the sentence)", "(la voz baja al final de la frase)"),
    L("(ajeita a roupa, inquieto(a))", "(smooths their clothes, restless)", "(se arregla la ropa, inquieto(a))"),
    L("(sorri, mas os olhos não acompanham)", "(smiles, but the eyes do not follow)", "(sonríe, pero los ojos no acompañan)"),
    L("(fica imóvel, com o olhar parado)", "(goes still, with a fixed gaze)", "(se queda inmóvil, con la mirada fija)")
  ];
  function cue() {
    if (!active("observacao") || !session || session.secret) return "";
    const h = (session.key + ":" + session.stepIndex).split("").reduce((x, ch) => (x * 31 + ch.charCodeAt(0)) >>> 0, 7);
    return `👁️ ${pick(CUES[h % CUES.length])} `;
  }
  // 🧩 tira 1 diagnóstico errado (o menos sustentado pelos achados) quando há mais de 3 opções
  function filterOptions(caseKey, options) {
    if (!active("raciocinio") || options.length <= 3 || typeof Dx === "undefined" || !Dx.evidence) return options;
    try {
      const ans = CASES[caseKey].diagnosis.answer, e = Dx.evidence(caseKey);
      const wrong = options.filter((o) => o !== ans).sort((a, b) => (e.by[a] ? e.by[a].pro : 0) - (e.by[b] ? e.by[b].pro : 0));
      return options.filter((o) => o !== wrong[0]);
    } catch (err) { return options; }
  }
  // estado da sessão atual: defensividade (0–100), pistas achadas e hipóteses
  function estadoConsulta() {
    const k = session && !session.secret ? session.key : null;
    const b = k && typeof Dx !== "undefined" ? Dx.book(k) : null;
    return { nivelDefensividade: Math.round((100 - state.affinity) * defense()), pistasDescobertas: b ? Object.keys(b.found) : [], hipotesesDiagnosticas: b && b.hyp ? [b.hyp] : [] };
  }
  // reputação e recompensas ao fechar o caso (chamado no fim da última sessão): devolve texto para o resultado
  function closeCase(ok, laudo, devol) {
    const r = rep(), out = { coins: 0, lines: [] };
    if (laudo) {   // laudo jogável: o valor depende da qualidade montada pela jogadora
      const q = laudo.q;
      if (laudo.ok) {
        const v = Math.round(20 * (0.5 + q / 100) * laudoMult());
        out.coins += v; gain("raciocinio", 2);
        r.academica += q >= 80 ? (active("laudo") ? 3 : 2) : q >= 50 ? 1 : 0;
        out.lines.push(`📝 ${pick(L("Laudo", "Report", "Informe"))} ${q}/100: 🪙 +${v}`);
      } else { r.academica = Math.max(0, r.academica - 1); out.lines.push(`📝 ${pick(L("Laudo com conclusão equivocada: sem pagamento e −1 Reputação Acadêmica", "Report with a wrong conclusion: no pay and −1 Academic Reputation", "Informe con conclusión equivocada: sin pago y −1 Reputación Académica"))}`); }
    } else if (ok) {
      const v = Math.round(20 * laudoMult());
      out.coins += v; gain("laudo", 2); gain("raciocinio", 2);
      r.academica += active("laudo") ? 2 : 1;
      out.lines.push(`📝 ${pick(L("Laudo emitido", "Report issued", "Informe emitido"))}: 🪙 +${v}`);
    }
    const c = (devol ? Math.round(devol.adesao / 25) : 1) * repClinicMult();
    r.clinica += c; gain("devolutiva", 1);
    out.lines.push(`🏥 ${pick(L("Reputação da Clínica", "Clinic Reputation", "Reputación de la Clínica"))} +${c}${devol ? ` (${pick(L("adesão", "adherence", "adhesión"))} ${devol.adesao})` : ""}`);
    if (active("multi") && Math.random() < 0.3) { out.coins += 15; r.clinica += 1; out.lines.push(`🩺 ${pick(L("Um colega indicou um paciente à clínica: 🪙 +15", "A colleague referred a patient to the clinic: 🪙 +15", "Un colega derivó un paciente a la clínica: 🪙 +15"))}`); }
    return out;
  }
  // 🩺 relatório externo (escola/médicos) com uma pista sobre o paciente
  function externalReport(caseKey) {
    if (!active("multi") || typeof Dx === "undefined" || !Dx.data().cases[caseKey]) return null;
    const b = Dx.book(caseKey), f = Dx.data().cases[caseKey].findings.find((x) => !b.found[x.d] && x.pts && Object.keys(x.pts).length);
    if (!f) return null;
    const d = Dx.data().domains.find((x) => x.id === f.d);
    return { from: pick(L("Relatório da escola e do médico", "School and doctor's report", "Informe de la escuela y del médico")), area: d ? pick(d.name) : "", text: pick(f.text) };
  }

  // hash estável (string → número): usado para escolher, sem aleatoriedade, uma variante entre as fixas abaixo
  // por paciente/passo, para que o mesmo caso sempre veja a mesma fala, mas casos diferentes não vejam a fala idêntica
  const strHash = (s) => String(s).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const pickV = (arr, seed) => pick(arr[strHash(seed) % arr.length]);

  // ------------------------------------------------------------ habilidades ativas (7.4)
  // Laudo (📝) e Articulação (🩺) eram os dois eixos MUDOS: não tinham 5ª opção de fala nem ação na
  // consulta — cresciam e não apareciam. Agora cada um tem uma ação, com uso contado por consulta
  // (um na faixa 3 e 6, dois na maestria), porque habilidade sem escassez vira botão de moer.
  const USOS = { laudo: "sintese", multi: "parecer" };
  const usosDe = (id) => (faixa(id) >= 3 ? 2 : 1);
  function usados(kind) { if (!session) return 99; session.habil = session.habil || {}; return session.habil[kind] || 0; }
  const podeUsar = (kind) => {
    const eixo = Object.keys(USOS).find((k) => USOS[k] === kind);
    return Boolean(session && !session.secret && active(eixo) && usados(kind) < usosDe(eixo));
  };
  function marcarUso(kind) { if (!session) return; session.habil = session.habil || {}; session.habil[kind] = (session.habil[kind] || 0) + 1; }

  // 📝 FORMULAR SÍNTESE: costura os achados que VOCÊ já coletou numa frase de trabalho. Não revela nada
  // novo — organiza o que está solto, que é o que o laudo faz. Na maestria, aponta também o que falta.
  function sintese(caseKey) {
    if (typeof Dx === "undefined" || !Dx.kase(caseKey)) return null;
    const b = Dx.book(caseKey), doms = Dx.data().domains.filter((d) => b.found[d.id]);
    if (doms.length < 2) {
      return { texto: pick(L("Ainda é cedo para costurar: com um achado só, qualquer frase que eu montar vai ser a minha opinião com cara de conclusão.", "It is early to stitch anything: with a single finding, whatever sentence I build will be my opinion wearing the face of a conclusion.", "Es pronto para coser: con un solo hallazgo, cualquier frase que arme será mi opinión con cara de conclusión.")), curto: true };
    }
    const achados = doms.map((d) => ({ d, f: Dx.kase(caseKey).findings.find((x) => x.d === d.id) })).filter((x) => x.f);
    const tres = achados.slice(0, 3).map((x) => `${x.d.icon} ${pick(x.f.text)}`);
    const faltam = Dx.data().domains.filter((d) => !b.found[d.id]).slice(0, 2).map((d) => pick(d.name));
    const linhas = [
      pick(L("Juntando o que eu já tenho:", "Putting together what I already have:", "Juntando lo que ya tengo:")),
      tres.join(" · "),
      pick(L("Três coisas que se sustentam podem ser um quadro; três coisas soltas são três coisas soltas. A pergunta é o que liga.", "Three things that hold each other up may be a picture; three loose things are three loose things. The question is what connects them.", "Tres cosas que se sostienen pueden ser un cuadro; tres cosas sueltas son tres cosas sueltas. La pregunta es qué las conecta."))
    ];
    if (faixa("laudo") >= 3 && faltam.length) linhas.push(pick(L(`E o que eu ainda não olhei: ${faltam.join(", ")}.`, `And what I have not looked at yet: ${faltam.join(", ")}.`, `Y lo que aún no miré: ${faltam.join(", ")}.`)));
    marcarUso("sintese");
    gain("laudo", 1);
    return { texto: linhas.join("\n") };
  }

  // 🩺 SOLICITAR PARECER: a leitura de quem vê a pessoa noutro lugar. Não entrega achado — diz ONDE
  // olhar, que é o que um parecer bom faz. O achado em si só sai da reunião de rede, indo até lá.
  function parecer(caseKey) {
    if (typeof Dx === "undefined" || !Dx.kase(caseKey)) return null;
    const b = Dx.book(caseKey);
    const falta = Dx.kase(caseKey).findings.find((x) => !b.found[x.d] && x.pts && Object.keys(x.pts).length);
    marcarUso("parecer");
    gain("multi", 1);
    if (!falta) return { texto: pick(L("O colega leu o caso e devolveu: — Pelo que você descreveu, você já olhou o que havia para olhar. Agora é decidir.", "The colleague read the case and replied: — From what you described, you have looked at everything there was to look at. Now it is about deciding.", "El colega leyó el caso y respondió: — Por lo que describiste, ya miraste lo que había que mirar. Ahora es decidir.")) };
    const d = Dx.data().domains.find((x) => x.id === falta.d);
    const onde = d ? pick(d.name) : falta.d;
    const linhas = [pick(L(`O colega ouve por telefone e responde: — Com esse quadro, eu não fecharia sem olhar ${onde.toLowerCase()}.`, `The colleague listens on the phone and answers: — With that picture, I would not close without looking at ${onde.toLowerCase()}.`, `El colega escucha por teléfono y responde: — Con ese cuadro, yo no cerraría sin mirar ${onde.toLowerCase()}.`))];
    if (faixa("multi") >= 2) linhas.push(pick(L("— E pergunte à pessoa, não à família. O que a família conta é verdade, mas é a verdade dela.", "— And ask the person, not the family. What the family reports is true, but it is their truth.", "— Y pregúntale a la persona, no a la familia. Lo que cuenta la familia es verdad, pero es su verdad.")));
    if (faixa("multi") >= 3) linhas.push(pick(L("— Se der, senta com o serviço que acompanha. Meia hora lá economiza três consultas aqui.", "— If you can, sit down with the service that follows them. Half an hour there saves three sessions here.", "— Si puedes, siéntate con el servicio que lo acompaña. Media hora allí ahorra tres consultas aquí.")));
    return { texto: linhas.join("\n"), area: onde };
  }

  // ------------------------------------------------------------ 5ª opção (de perfil): 3 variantes por abordagem
  const SPECIAL = {
    acolhimento: [
      L("Fico com você nisso, no seu ritmo. Não é preciso dar conta de tudo agora.", "I'm with you in this, at your pace. You don't have to handle everything right now.", "Estoy contigo en esto, a tu ritmo. No hace falta poder con todo ahora."),
      L("Vamos devagar: me conte só o que já der para colocar em palavras hoje.", "Let's go slowly: tell me only what you can put into words today.", "Vayamos despacio: cuéntame solo lo que ya puedas poner en palabras hoy."),
      L("Você não precisa se explicar direito para eu entender que isso pesa.", "You don't need to explain it perfectly for me to understand that it weighs on you.", "No necesitas explicarte del todo para que yo entienda que esto pesa.")
    ],
    tcc: [
      L("Vamos testar essa ideia como um experimento: o que você faria e o que esperaria que acontecesse?", "Let's test that idea like an experiment: what would you do and what would you expect to happen?", "Probemos esa idea como un experimento: ¿qué harías y qué esperarías que pasara?"),
      L("Que evidência a favor e contra esse pensamento a gente consegue listar agora?", "What evidence for and against that thought can we list right now?", "¿Qué evidencia a favor y en contra de ese pensamiento podemos listar ahora?"),
      L("Se um amigo pensasse exatamente isso, o que você diria a ele?", "If a friend thought exactly that, what would you tell them?", "Si un amigo pensara exactamente eso, ¿qué le dirías?")
    ],
    psicodinamica: [
      L("Deixe a mente ir: o que vem primeiro quando pensa nisso? Uma cena, uma pessoa, uma sensação?", "Let your mind wander: what comes first when you think of it? A scene, a person, a feeling?", "Deja que la mente vaya: ¿qué viene primero al pensarlo? ¿Una escena, una persona, una sensación?"),
      L("Se essa sensação tivesse uma idade, quantos anos ela teria?", "If this feeling had an age, how old would it be?", "Si esta sensación tuviera una edad, ¿cuántos años tendría?"),
      L("Onde mais na sua vida você já sentiu exatamente isso?", "Where else in your life have you felt exactly this?", "¿En qué otro momento de tu vida sentiste exactamente esto?")
    ],
    psicoeducacao: [
      L("Deixe-me desenhar o quadro completo: o que isso é, o que não é e o que costuma ajudar.", "Let me draw the whole picture: what this is, what it isn't and what tends to help.", "Déjame dibujar el cuadro completo: qué es, qué no es y qué suele ayudar."),
      L("Vou explicar em três frases o que a ciência sabe sobre isso até hoje.", "I'll explain in three sentences what science knows about this so far.", "Voy a explicar en tres frases lo que la ciencia sabe sobre esto hasta hoy."),
      L("Antes de mais nada: nada do que você sente aqui é raro ou incompreensível.", "First of all: nothing you feel here is rare or incomprehensible.", "Antes que nada: nada de lo que sientes aquí es raro o incomprensible.")
    ],
    comportamental: [
      L("Vamos escolher um único passo pequeno para esta semana e combinar como medir.", "Let's pick one single small step for this week and agree on how to measure it.", "Elijamos un solo paso pequeño para esta semana y acordemos cómo medirlo."),
      L("O que dessa rotina já funciona um pouco, mesmo que pouco? Vamos partir daí.", "What in this routine already works a little, even if just a little? Let's start there.", "¿Qué de esta rutina ya funciona un poco, aunque sea poco? Partamos de ahí."),
      L("Combinamos um sinal simples para você saber quando parar antes de piorar?", "Shall we agree on a simple sign for you to know when to stop before it gets worse?", "¿Acordamos una señal simple para que sepas cuándo parar antes de que empeore?")
    ],
    diretiva: [
      L("Vou ser direta: o que ajuda é isto, e o combinado desta semana é fazer isto.", "I'll be direct: this is what helps, and this week's agreement is to do this.", "Seré directa: esto es lo que ayuda, y el acuerdo de esta semana es hacer esto."),
      L("Sem rodeios: é isto que precisa mudar primeiro, e é para esta semana.", "No detours: this is what needs to change first, and it's for this week.", "Sin rodeos: esto es lo que necesita cambiar primero, y es para esta semana."),
      L("Minha recomendação é clara: faça isto, do jeito que estou dizendo, e me conte como foi.", "My recommendation is clear: do this, the way I'm telling you, and tell me how it went.", "Mi recomendación es clara: haz esto, tal como te digo, y cuéntame cómo te fue.")
    ]
  };

  // ------------------------------------------------------------ árvore de diálogo: reação ao que você disse (3 variantes)
  const REACTION = {
    acolhimento: [
      L("(Respira fundo e relaxa os ombros) 'Ninguém tinha me escutado assim. Posso continuar?'", "(Takes a deep breath and relaxes) 'Nobody had ever listened to me like this. May I go on?'", "(Respira hondo y relaja los hombros) 'Nadie me había escuchado así. ¿Puedo seguir?'"),
      L("(Os olhos marejam por um instante) 'Faz tempo que eu queria ouvir isso de alguém.'", "(Eyes well up for a moment) 'I've wanted to hear that from someone for a while.'", "(Los ojos se le humedecen un instante) 'Hace tiempo que quería escuchar eso de alguien.'"),
      L("(Solta os ombros, mais leve) 'Tá certo... então posso continuar sem medo de julgamento?'", "(Shoulders drop, lighter) 'Okay... so I can go on without fear of judgement?'", "(Baja los hombros, más liviano) 'Está bien... ¿entonces puedo seguir sin miedo a que me juzguen?'")
    ],
    tcc: [
      L("(Pensa um instante) 'Nunca tinha olhado por esse lado... mas e se eu errar de novo?'", "(Thinks for a moment) 'I'd never looked at it that way... but what if I get it wrong again?'", "(Piensa un instante) 'Nunca lo había mirado así... pero ¿y si me equivoco otra vez?'"),
      L("(Franze a testa) 'Isso bagunça um pouco o que eu tinha certeza que era verdade.'", "(Frowns) 'That shakes up something I was sure was true.'", "(Frunce el ceño) 'Eso desordena un poco lo que estaba seguro que era verdad.'"),
      L("(Ri sem graça) 'Dito assim parece bobo, o pensamento que eu tinha.'", "(Laughs awkwardly) 'Put that way, the thought I had sounds silly.'", "(Ríe con vergüenza) 'Dicho así, el pensamiento que tenía suena tonto.'")
    ],
    psicodinamica: [
      L("(Fica em silêncio e desvia o olhar) 'Isso me lembra uma coisa de muito tempo atrás...'", "(Falls silent and looks away) 'This reminds me of something from a long time ago...'", "(Se queda en silencio y desvía la mirada) 'Esto me recuerda algo de hace mucho tiempo...'"),
      L("(Aperta as mãos) 'Nunca tinha ligado uma coisa na outra assim...'", "(Clasps their hands) 'I'd never connected one thing to the other like that...'", "(Aprieta las manos) 'Nunca había conectado una cosa con la otra así...'"),
      L("(Engole em seco) 'Tem uma cena que voltou agora, do nada.'", "(Swallows hard) 'A scene just came back to me, out of nowhere.'", "(Traga saliva) 'Me volvió una escena ahora, de la nada.'")
    ],
    psicoeducacao: [
      L("(Solta o ar devagar) 'Então o que eu sinto tem nome e explicação... faz mais sentido agora.'", "(Lets out a slow breath) 'So what I feel has a name and an explanation... it makes more sense now.'", "(Suelta el aire despacio) 'Entonces lo que siento tiene nombre y explicación... ahora tiene más sentido.'"),
      L("(Parece aliviado) 'Achei que só acontecia comigo. Saber que tem nome já ajuda.'", "(Looks relieved) 'I thought it only happened to me. Knowing it has a name already helps.'", "(Parece aliviado) 'Pensé que solo me pasaba a mí. Saber que tiene nombre ya ayuda.'"),
      L("(Anota mentalmente) 'Vou querer perguntar mais sobre isso depois, pode ser?'", "(Makes a mental note) 'I'll want to ask more about this later, is that okay?'", "(Toma nota mentalmente) '¿Puedo preguntar más sobre esto después?'")
    ],
    comportamental: [
      L("(Anota mentalmente) 'Um passo pequeno assim eu consigo tentar. Como vou saber se deu certo?'", "(Makes a mental note) 'A small step like that I can try. How will I know it worked?'", "(Toma nota mentalmente) 'Un paso pequeño así puedo intentarlo. ¿Cómo sabré si funcionó?'"),
      L("(Assente devagar) 'Tá, isso cabe na minha semana. E se eu esquecer um dia?'", "(Nods slowly) 'Okay, that fits into my week. What if I forget a day?'", "(Asiente despacio) 'Bien, eso cabe en mi semana. ¿Y si olvido un día?'"),
      L("(Sorri de leve) 'Gosto de ter algo concreto para fazer, em vez de só conversar.'", "(Smiles a little) 'I like having something concrete to do, instead of just talking.'", "(Sonríe un poco) 'Me gusta tener algo concreto que hacer, en vez de solo conversar.'")
    ],
    diretiva: [
      L("(Endireita a postura) 'Ok, entendi o que devo fazer. Mas e se eu não conseguir cumprir?'", "(Straightens up) 'OK, I understand what I must do. But what if I can't keep to it?'", "(Se endereza) 'Vale, entendí qué debo hacer. Pero ¿y si no logro cumplirlo?'"),
      L("(Fica um pouco na defensiva) 'Certo, mas eu também posso opinar sobre isso?'", "(Gets a little defensive) 'Alright, but can I also have a say in this?'", "(Se pone un poco a la defensiva) 'Vale, pero ¿yo también puedo opinar sobre esto?'"),
      L("(Anota rápido) 'Anotado. Prefiro assim, direto ao ponto, mesmo.'", "(Jots it down quickly) 'Noted. I actually prefer it this way, straight to the point.'", "(Anota rápido) 'Anotado. La verdad prefiero así, directo al grano.'")
    ]
  };
  const FOLLOW = {
    acolhimento: [
      L("Obrigada por confiar isso a mim. Quer continuar contando?", "Thank you for trusting me with this. Would you like to keep going?", "Gracias por confiarme esto. ¿Quieres seguir contando?"),
      L("Não precisa ter pressa. O que mais vem junto com isso?", "There's no need to rush. What else comes along with that?", "No hace falta apurarse. ¿Qué más viene junto con esto?"),
      L("Estou aqui para ouvir o resto, no seu tempo.", "I'm here to hear the rest, in your own time.", "Estoy aquí para escuchar el resto, a tu tiempo.")
    ],
    tcc: [
      L("Que pensamento automático apareceu bem antes desse sentimento?", "What automatic thought showed up right before that feeling?", "¿Qué pensamiento automático apareció justo antes de ese sentimiento?"),
      L("Se esse pensamento fosse levado a julgamento, que provas ele teria a favor?", "If that thought went to trial, what evidence would it have in its favour?", "Si ese pensamiento fuera a juicio, ¿qué pruebas tendría a favor?"),
      L("O que mudaria na sua semana se você pensasse diferente disso?", "What would change in your week if you thought differently about this?", "¿Qué cambiaría en tu semana si pensaras distinto sobre esto?")
    ],
    psicodinamica: [
      L("O que isso te lembra de mais antigo?", "What does this remind you of from further back?", "¿Qué te recuerda esto de más atrás?"),
      L("Se essa sensação pudesse falar, o que ela diria?", "If this feeling could speak, what would it say?", "Si esta sensación pudiera hablar, ¿qué diría?"),
      L("Há alguém da sua história que sentia parecido com isso?", "Is there someone in your story who felt something similar?", "¿Hay alguien en tu historia que sintiera algo parecido?")
    ],
    psicoeducacao: [
      L("Quer que eu explique também por que isso costuma acontecer?", "Would you like me to explain why this tends to happen too?", "¿Quieres que también te explique por qué esto suele pasar?"),
      L("Alguma parte disso ficou confusa? Posso explicar de outro jeito.", "Was any part of that confusing? I can explain it another way.", "¿Alguna parte quedó confusa? Puedo explicarlo de otra manera."),
      L("O que você já sabia sobre isso antes de eu explicar?", "What did you already know about this before I explained?", "¿Qué sabías ya sobre esto antes de que te lo explicara?")
    ],
    comportamental: [
      L("O que você poderia fazer de diferente da próxima vez que isso acontecer?", "What could you do differently the next time this happens?", "¿Qué podrías hacer distinto la próxima vez que ocurra?"),
      L("Como a gente vai registrar se esse passo deu certo?", "How will we record whether this step worked?", "¿Cómo vamos a registrar si este paso funcionó?"),
      L("O que costuma atrapalhar você a cumprir o combinado?", "What usually gets in the way of you keeping to the agreement?", "¿Qué suele estorbarte para cumplir lo acordado?")
    ],
    diretiva: [
      L("Ficou claro o que fazer, ou quer que eu repita o combinado?", "Is it clear what to do, or would you like me to repeat the agreement?", "¿Quedó claro qué hacer, o quieres que repita lo acordado?"),
      L("Consegue cumprir isso até a próxima consulta?", "Can you get this done by the next session?", "¿Puedes cumplir esto hasta la próxima consulta?"),
      L("O que faria você não seguir o que combinamos?", "What would stop you from following what we agreed?", "¿Qué te haría no seguir lo que acordamos?")
    ]
  };

  // cria o passo extra que entra logo depois do atual; a variante escolhida é sempre a mesma para o mesmo caso+passo
  function branchStep(after, ap, caseKey) {
    const seed = (caseKey || "") + (after.text || "") + ap;
    const options = {};
    Object.keys(FOLLOW).forEach((k) => { options[k] = pickV(FOLLOW[k], seed + k); });
    return { who: after.who, text: pickV(REACTION[ap], seed), note: null, mods: {}, options, branch: true };
  }

  // 5ª escolha: usa a abordagem do perfil e vale nota máxima; bloqueada para quem não tem o perfil
  function specialFor(step, caseKey, scores) {
    const c = CASES[caseKey];
    const good = IDS.filter((ap) => scores[ap] >= 3);
    const pool = good.length ? good : IDS.slice().sort((a, b) => scores[b] - scores[a]).slice(0, 1);
    // determinístico por passo: sempre a mesma abordagem para o mesmo passo
    const key = strHash(caseKey + (step.text || ""));
    const need = pool[key % pool.length];
    const mine = dominant();
    return { ap: need, text: pickV(SPECIAL[need], "v" + caseKey + (step.text || "")), unlocked: mine === need, special: true };
  }

  // ------------------------------------------------------------ interface: radar de 8 eixos (só desenha o que o estado diz)
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
  function svg() {
    const R = 84, C = 120, dom = dominantAxis();
    const at = (i, r) => [C + Math.cos(ang(i)) * r, C + Math.sin(ang(i)) * r];
    const ring = (f) => AXES.map((_, i) => at(i, R * f).map((v) => v.toFixed(1)).join(",")).join(" ");
    let out = `<svg viewBox="0 0 240 240" class="wheel-svg" role="img" aria-label="${t("wheel.title")}">`;
    [0.25, 0.5, 0.75, 1].forEach((f) => { out += `<polygon points="${ring(f)}" fill="none" stroke="#15131f" stroke-opacity="${f === 1 ? 0.6 : 0.3}"/>`; });
    AXES.forEach((a, i) => {
      const [x, y] = at(i, R), [lx, ly] = at(i, R + 20);
      out += `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#15131f" stroke-opacity=".4"/>`;
      out += `<text x="${lx.toFixed(1)}" y="${(ly + 7).toFixed(1)}" text-anchor="middle" font-size="19" opacity="${dom && dom !== a.id ? 0.75 : 1}">${a.icon}</text>`;
    });
    const pts = AXES.map((a, i) => at(i, (level(a.id) / MAX_LVL) * R).map((v) => v.toFixed(1)).join(",")).join(" ");
    out += `<polygon points="${pts}" fill="#8790dd" fill-opacity=".55" stroke="#15131f" stroke-width="2"/>`;
    AXES.forEach((a, i) => { const [x, y] = at(i, (level(a.id) / MAX_LVL) * R); out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${a.id === dom ? 4.5 : 3}" fill="${a.id === dom ? "#e0a820" : "#15131f"}"/>`; });
    return out + "</svg>";
  }

  // dados prontos para a interface (usados pelo componente Svelte RodaDoPsicologo): nada de DOM aqui
  const FAIXA_NOME = [
    L("sem bônus", "no bonus", "sin bono"),
    L("faixa 1 — ativo", "band 1 — active", "franja 1 — activo"),
    L("faixa 2 — ampliado", "band 2 — widened", "franja 2 — ampliado"),
    L("faixa 3 — maestria", "band 3 — mastery", "franja 3 — maestría")
  ];
  // quanto falta para o próximo degrau (null na maestria): é o que faz o eixo valer a pena continuar subindo
  function proximaFaixa(id) {
    const n = level(id), alvo = FAIXAS.find((f) => n < f);
    return alvo ? { em: alvo, falta: alvo - n } : null;
  }

  function viewData() {
    const pr = profileProgress(), d = pr.axis, r = rep();
    return {
      title: t("wheel.title"),
      axes: AXES.map((a, i) => ({ id: a.id, icon: a.icon, name: pick(a.name), bonus: pick(a.bonus), level: level(a.id), active: active(a.id), faixa: faixa(a.id), faixaNome: pick(FAIXA_NOME[faixa(a.id)]), proxima: proximaFaixa(a.id), dominant: a.id === d, angle: ang(i) })),
      max: MAX_LVL,
      profile: { defined: Boolean(d), text: d ? `${AX[d].icon} ${pick(L("Perfil dominante", "Dominant profile", "Perfil dominante"))}: ${pick(AX[d].name)}` : pick(L(`Faltam ${pr.need} escolhas para definir o seu perfil.`, `${pr.need} more choices to define your profile.`, `Faltan ${pr.need} elecciones para definir tu perfil.`)), pct: (d ? level(d) / MAX_LVL : pr.pct) * 100 },
      rep: `🎓 ${pick(L("Reputação Acadêmica", "Academic Reputation", "Reputación Académica"))}: ${r.academica}  ·  🏥 ${pick(L("Reputação da Clínica", "Clinic Reputation", "Reputación de la Clínica"))}: ${r.clinica}`,
            help: pick(L("Cada escolha nas consultas, cada investigação, laudo, teste e conversa com outros profissionais dá pontos nos eixos. O bônus tem três degraus: com 3 pontos ele liga, com 6 ele amplia e com 10 vira maestria. Os eixos 📝 Laudo e 🩺 Articulação, além do bônus, dão uma ação na consulta.", "Every choice in sessions, every investigation, report, test and conversation with other professionals adds points to the axes. The bonus has three steps: at 3 points it switches on, at 6 it widens and at 10 it becomes mastery. The 📝 Report and 🩺 Multidisciplinary axes also grant an action during the session.", "Cada elección en las consultas, cada investigación, informe, prueba y conversación con otros profesionales da puntos en los ejes. El bono tiene tres escalones: con 3 puntos se enciende, con 6 se amplía y con 10 es maestría. Los ejes 📝 Informe y 🩺 Articulación además dan una acción en la consulta."))
    };
  }

  function open() {
    if (window.RodaSvelte) { openModal("wheel-modal"); try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* nada */ } return; }   // o componente Svelte desenha a partir de viewData()
    const body = $("wheel-body");
    body.textContent = "";
    const box = el("div", "wheel-box"); box.innerHTML = svg(); body.appendChild(box);
    const pr = profileProgress(), d = pr.axis;
    const prog = el("div", "wheel-prof");
    prog.appendChild(el("p", "uni-q", d ? `${AX[d].icon} ${pick(L("Perfil dominante", "Dominant profile", "Perfil dominante"))}: ${pick(AX[d].name)}` : pick(L(`Faltam ${pr.need} escolhas para definir o seu perfil.`, `${pr.need} more choices to define your profile.`, `Faltan ${pr.need} elecciones para definir tu perfil.`))));
    const bar = el("div", "wheel-prog"), fill = el("span", "wheel-prog-f"); fill.style.width = `${(d ? level(d) / MAX_LVL : pr.pct) * 100}%`; bar.appendChild(fill); prog.appendChild(bar);
    body.appendChild(prog);
    const r = rep();
    body.appendChild(el("p", "shop-note", `🎓 ${pick(L("Reputação Acadêmica", "Academic Reputation", "Reputación Académica"))}: ${r.academica}  ·  🏥 ${pick(L("Reputação da Clínica", "Clinic Reputation", "Reputación de la Clínica"))}: ${r.clinica}`));
        body.appendChild(el("p", "shop-note", viewData().help));
    const list = el("ul", "wheel-list");
    AXES.forEach((a) => {
      const li = el("li", "wheel-item" + (active(a.id) ? " on" : "") + (a.id === d ? " dom" : ""));
      const fx = faixa(a.id), prox = proximaFaixa(a.id);
      li.appendChild(el("b", "", `${a.icon} ${pick(a.name)} · ${level(a.id)}/${MAX_LVL}${fx ? ` · ${pick(FAIXA_NOME[fx])}` : ""}`));
      li.appendChild(el("small", "", `${active(a.id) ? "✅" : "🔒"} ${pick(a.bonus)}`));
      // o degrau seguinte, para o eixo não parecer que parou de crescer depois do 3
      if (prox) li.appendChild(el("small", "dx-hint", pick(L(`Faltam ${prox.falta} para a faixa em ${prox.em}.`, `${prox.falta} to go for the band at ${prox.em}.`, `Faltan ${prox.falta} para la franja en ${prox.em}.`))));
      if (a.id === "laudo" && active("laudo")) li.appendChild(el("small", "dx-hint", pick(L("Na consulta: 📝 Formular síntese.", "In session: 📝 Draft a synthesis.", "En la consulta: 📝 Formular síntesis."))));
      if (a.id === "multi" && active("multi")) li.appendChild(el("small", "dx-hint", pick(L("Na consulta: 🩺 Pedir parecer — e reunião de rede na escola, no CAPS, no hospital e no fórum.", "In session: 🩺 Ask for an opinion — and network meetings at the school, the CAPS, the hospital and the courthouse.", "En la consulta: 🩺 Pedir parecer — y reunión de red en la escuela, el CAPS, el hospital y el juzgado."))));
      list.appendChild(li);
    });
    body.appendChild(list);
    openModal("wheel-modal");
  }

  return { viewData, IDS, AXES, record, gain, dominant, dominantAxis, active, level, perk, defense, testMult, traumaEnergy, laudoMult, repClinicMult, cue, filterOptions, estadoConsulta, closeCase,
    FAIXAS, faixa, porFaixa, proximaFaixa, FAIXA_NOME, sintese, parecer, podeUsar, usosDe, usados, externalReport, rep, atributos, profileProgress, branchStep, specialFor, open, total };
})();

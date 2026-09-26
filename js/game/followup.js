"use strict";

// ===========================================================================
// Acompanhamento: cada paciente tem 4 consultas ao longo de 2 semanas (2 por semana).
//   1 anamnese (o paciente se apresenta) · 2 aprofundamento · 3 evolução · 4 devolutiva
// O diagnóstico e o encaminhamento só vêm na 4ª consulta. São 4 semanas: a turma 1 (8 pacientes)
// faz as semanas 1 e 2; a turma 2 (7 pacientes) faz as semanas 3 e 4. Depois, quem quer continuar
// manda uma mensagem pedindo terapia, e o jogador aceita ou recusa (há quem queira só o diagnóstico).
// ===========================================================================
const FU = (function () {
  const TOTAL_WEEKS = 4;
  const SESSIONS = 4;
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] === undefined ? m : o[k]));

  // agenda original (semana 1 do jogo antigo): define a ordem dos pacientes e os horários
  const BASE = JSON.parse(JSON.stringify(window.SCHEDULE_DATA));
  const ORDER = [];
  ["segunda", "terca", "quarta", "quinta", "sexta"].forEach((d) => BASE[d].forEach((a) => ORDER.push(a.caseId)));
  const TURMA = [ORDER.slice(0, 8), ORDER.slice(8)];
  const ONLY_DX = { carlos: true, gabriel: true, tiago: true };     // quem só queria o diagnóstico

  const slotTime = (i) => {
    const start = 8 * 60 + i * 60, f = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return `${f(start)}–${f(start + 50)}`;
  };

  // monta a agenda da semana dentro do próprio objeto SCHEDULE (o resto do jogo continua lendo dali)
  function plan() {
    const wAbs = Math.max(1, state.week || 1), w = ((wAbs - 1) % TOTAL_WEEKS) + 1, cycle = Math.floor((wAbs - 1) / TOTAL_WEEKS) + 1;
    // ciclo 1: os 15 casos da história; ciclos seguintes (modo contínuo): casos gerados (Gen), se existirem
    const pool = cycle === 1 ? TURMA[w <= 2 ? 0 : 1] : (typeof Gen !== "undefined" ? Gen.turma(cycle, w) : []);
    const members = pool.filter((id) => !((state.pat || {})[id] || {}).closed);   // caso encerrado por crise não volta à agenda
    const first = w % 2 === 1 ? 1 : 3;
    const days = [[], [], [], [], []];
    members.forEach((id, k) => {
      const d1 = k % 3;
      days[d1].push({ caseId: id, sess: first, k });
      days[d1 + 2].push({ caseId: id, sess: first + 1, k });
    });
    // Moradores convencidos: ciclo próprio de duas semanas, duas consultas por semana, a partir da 5ª
    // semana ABSOLUTA — por isso `wAbs` e não `w`, que reinicia a cada quatro semanas.
    if (typeof Town !== "undefined") Town.extraSlots(wAbs).forEach((x, i) => days[x.day].push({ caseId: "cit:" + x.id, sess: x.sess || 1, k: 99 + i }));
    if (typeof Gen !== "undefined" && Gen.slots) Gen.slots(wAbs).forEach((x, i) => days[x.day % 5].push({ caseId: x.caseId, sess: x.sess, k: 60 + i }));   // encaminhamentos aceitos
    if (typeof Care !== "undefined") Care.due(wAbs).forEach((id, i) => days[(i + 1) % 5].push({ caseId: id, sess: Care.MANUT, k: 50 + i }));   // psicoterapia contínua
    // CASO FRIO REABERTO: duas consultas na semana em que você aceitou rever, e nada além disso —
    // é uma segunda olhada, não um ciclo novo
    frios().forEach((id, i) => { days[(i * 2) % 5].push({ caseId: id, sess: 1, k: 70 + i }); days[(i * 2 + 3) % 5].push({ caseId: id, sess: 2, k: 70 + i }); });
    DAYS.forEach((day, i) => {
      days[i].sort((a, b) => (a.sess === 0.5) - (b.sess === 0.5) || a.sess - b.sess || a.k - b.k);   // acompanhamento depois do psicodiagnóstico
      SCHEDULE[day] = days[i].map((a, n) => ({ time: slotTime(n), caseId: a.caseId, sess: a.sess }));
    });
  }

  const rec = (id) => ((state.pat = state.pat || {})[id] = state.pat[id] || { q: [], dx: null, tx: null });
  const evolution = (id) => { const q = rec(id).q; return q.length ? Math.round((q.reduce((s, x) => s + x, 0) / q.length) * 100) : 0; };
  const tier = (id) => { const q = rec(id).q; if (!q.length) return 1; const last = q[q.length - 1]; return last >= 0.7 ? 2 : last >= 0.4 ? 1 : 0; };

  // ------------------------------------------------------------ roteiro genérico das consultas 3 e 4
  const G = [
    {
      text: [
        L("Foi uma semana difícil: o que mais incomoda continuou aparecendo e o que combinamos foi pouco colocado em prática.", "It was a hard week: what bothers most kept showing up and what we agreed was rarely put into practice.", "Fue una semana difícil: lo que más molesta siguió apareciendo y lo acordado se puso poco en práctica."),
        L("Houve dias melhores e outros piores. Parte do que combinamos foi colocada em prática, mas ainda oscila.", "There were better days and worse ones. Part of what we agreed was put into practice, but it still fluctuates.", "Hubo días mejores y otros peores. Parte de lo acordado se puso en práctica, pero todavía oscila."),
        L("Foi uma semana melhor: houve mais dias tranquilos e o que combinamos começou a funcionar.", "It was a better week: more calm days, and what we agreed started to work.", "Fue una semana mejor: hubo más días tranquilos y lo acordado empezó a funcionar.")],
      opts: {
        acolhimento: L("Obrigada por contar. Vamos olhar com calma o que foi mais difícil e o que foi um pouco mais leve nesta semana.", "Thank you for telling me. Let's look calmly at what was hardest and what was a little lighter this week.", "Gracias por contarlo. Miremos con calma lo más difícil y lo más ligero de esta semana."),
        tcc: L("Vamos listar as situações da semana, o que se pensou em cada uma e como isso influenciou o que se sentiu e se fez.", "Let's list this week's situations, what was thought in each and how that shaped what was felt and done.", "Listemos las situaciones de la semana, qué se pensó en cada una y cómo influyó en lo que se sintió e hizo."),
        psicodinamica: L("Isso lembra algo de antes? Quando essa sensação aparece, de onde você acha que ela vem?", "Does this remind you of something from before? When this feeling appears, where do you think it comes from?", "¿Esto recuerda algo de antes? Cuando aparece esa sensación, ¿de dónde crees que viene?"),
        psicoeducacao: L("Vou explicar como esse quadro costuma oscilar de uma semana para outra, para você saber o que esperar.", "I'll explain how this condition tends to fluctuate from week to week, so you know what to expect.", "Voy a explicar cómo este cuadro suele oscilar de una semana a otra, para que sepas qué esperar."),
        comportamental: L("Vamos ver quais combinados foram cumpridos, com que frequência, e o que ajudou ou atrapalhou.", "Let's see which agreements were kept, how often, and what helped or got in the way.", "Veamos qué acuerdos se cumplieron, con qué frecuencia y qué ayudó o estorbó."),
        diretiva: L("Certo. Esta semana vocês retomam o que combinamos e me trazem o registro de cada dia.", "Right. This week you go back to what we agreed and bring me a record of each day.", "Bien. Esta semana retoman lo acordado y me traen el registro de cada día.")
      }
    },
    {
      text: [
        L("Tem sido difícil manter a rotina. Às vezes dá vontade de desistir do tratamento.", "It has been hard to keep the routine. Sometimes there's an urge to quit the treatment.", "Ha sido difícil mantener la rutina. A veces dan ganas de abandonar el tratamiento."),
        L("Algumas coisas ajudaram, mas surgem situações em que voltamos ao padrão antigo.", "Some things helped, but situations come up where we slide back into the old pattern.", "Algunas cosas ayudaron, pero surgen situaciones en que volvemos al patrón antiguo."),
        L("Já dá para perceber o que ajuda e o que piora. Ainda há situações difíceis, mas elas são enfrentadas melhor.", "It's now possible to notice what helps and what makes it worse. Hard situations remain, but they're handled better.", "Ya se nota lo que ayuda y lo que empeora. Aún hay situaciones difíciles, pero se enfrentan mejor.")],
      opts: {
        acolhimento: L("Faz sentido cansar no meio do caminho. Ninguém está fazendo nada errado; vamos ajustar o ritmo juntos.", "It makes sense to get tired midway. Nobody is doing anything wrong; let's adjust the pace together.", "Tiene sentido cansarse a mitad del camino. Nadie hace nada mal; ajustemos el ritmo juntos."),
        tcc: L("Vamos identificar o pensamento que aparece antes da vontade de desistir e testar se ele se sustenta.", "Let's identify the thought that shows up before the urge to quit and test whether it holds up.", "Identifiquemos el pensamiento que aparece antes de las ganas de abandonar y probemos si se sostiene."),
        psicodinamica: L("Quero entender o que desistir representa. Já aconteceu de largar algo importante pela metade?", "I want to understand what quitting represents. Has it happened before that something important was dropped halfway?", "Quiero entender qué representa abandonar. ¿Ya ocurrió de dejar algo importante a medias?"),
        psicoeducacao: L("É comum haver altos e baixos no tratamento. Vou explicar por que isso acontece e como lidar.", "Ups and downs are common in treatment. I'll explain why they happen and how to handle them.", "Es común que haya altibajos en el tratamiento. Explicaré por qué ocurre y cómo manejarlo."),
        comportamental: L("Vamos dividir a rotina em passos pequenos e criar um jeito de registrar e recompensar cada avanço.", "Let's split the routine into small steps and create a way to record and reward each gain.", "Dividamos la rutina en pasos pequeños y creemos una forma de registrar y premiar cada avance."),
        diretiva: L("A partir de agora o combinado é este: três passos por dia, sem exceção, e o registro vem para mim.", "From now on the deal is this: three steps a day, no exceptions, and the record comes to me.", "A partir de ahora el trato es este: tres pasos por día, sin excepción, y el registro me lo traen.")
      }
    },
    {
      text: [
        L("Olhando para trás, houve poucas mudanças até agora. Fica a dúvida se esse caminho está ajudando.", "Looking back, there have been few changes so far. There's doubt about whether this path is helping.", "Mirando atrás, hubo pocos cambios hasta ahora. Queda la duda de si este camino ayuda."),
        L("Olhando para trás, algumas coisas mudaram e outras ainda incomodam. Queremos entender o que vem agora.", "Looking back, some things changed and others still bother. We want to understand what comes next.", "Mirando atrás, algunas cosas cambiaron y otras aún molestan. Queremos entender qué viene ahora."),
        L("Olhando para trás, mudou bastante coisa: os momentos difíceis aparecem menos e passam mais rápido.", "Looking back, a lot has changed: hard moments show up less and pass faster.", "Mirando atrás, cambió bastante: los momentos difíciles aparecen menos y pasan más rápido.")],
      opts: {
        acolhimento: L("Quero ouvir o que esse caminho significou, com o que foi bom e o que foi difícil.", "I'd like to hear what this path has meant, with what was good and what was hard.", "Quiero escuchar qué significó este camino, con lo bueno y lo difícil."),
        tcc: L("Vamos comparar como se reagia no começo com como se reage hoje, situação por situação.", "Let's compare how things were handled at the start with how they're handled today, situation by situation.", "Comparemos cómo se reaccionaba al inicio con cómo se reacciona hoy, situación por situación."),
        psicodinamica: L("Que padrões você reconhece agora que não via na primeira consulta?", "What patterns do you recognize now that you couldn't see at the first session?", "¿Qué patrones reconoces ahora que no veías en la primera consulta?"),
        psicoeducacao: L("Vou resumir o que sabemos até aqui sobre o quadro e o que costuma ajudar a longo prazo.", "I'll summarize what we know so far about the condition and what tends to help in the long run.", "Voy a resumir lo que sabemos hasta aquí sobre el cuadro y lo que suele ayudar a largo plazo."),
        comportamental: L("Vamos olhar os registros: o que aumentou, o que diminuiu e o que ainda precisa de treino.", "Let's look at the records: what increased, what decreased and what still needs practice.", "Miremos los registros: qué aumentó, qué disminuyó y qué aún necesita práctica."),
        diretiva: L("Vamos fechar as metas do ciclo: o que foi cumprido e o que falta cumprir.", "Let's close out the cycle's goals: what was met and what is still missing.", "Cerremos las metas del ciclo: qué se cumplió y qué falta cumplir.")
      }
    },
    {
      text: [
        L("E agora? O que você concluiu sobre o caso? Quais são os próximos passos?", "And now? What have you concluded about the case? What are the next steps?", "¿Y ahora? ¿Qué concluiste sobre el caso? ¿Cuáles son los próximos pasos?")],
      opts: {
        acolhimento: L("Vou explicar minhas conclusões com cuidado e vocês podem me interromper e perguntar o que quiserem.", "I'll explain my conclusions carefully and you can interrupt and ask whatever you like.", "Explicaré mis conclusiones con cuidado y pueden interrumpirme y preguntar lo que quieran."),
        tcc: L("Vou apresentar minha hipótese e o que a sustenta, e traçamos juntos um plano com metas claras.", "I'll present my hypothesis and what supports it, and together we draw up a plan with clear goals.", "Presentaré mi hipótesis y lo que la sostiene, y trazamos juntos un plan con metas claras."),
        psicodinamica: L("Vou compartilhar o que compreendi da história e como isso se liga ao que se sente hoje.", "I'll share what I understood of the story and how it connects to what is felt today.", "Compartiré lo que comprendí de la historia y cómo se conecta con lo que se siente hoy."),
        psicoeducacao: L("Vou explicar a hipótese em linguagem simples: o que ela significa e o que não significa.", "I'll explain the hypothesis in plain language: what it means and what it doesn't.", "Explicaré la hipótesis en lenguaje simple: qué significa y qué no significa."),
        comportamental: L("Vou mostrar, com base nos registros, o que se mantém e o que faremos a seguir, passo a passo.", "Based on the records, I'll show what holds and what we'll do next, step by step.", "Con base en los registros, mostraré qué se mantiene y qué haremos a continuación, paso a paso."),
        diretiva: L("Minha conclusão é esta, e o plano é este. Vamos combinar agora os próximos passos.", "This is my conclusion, and this is the plan. Let's agree on the next steps now.", "Esta es mi conclusión y este es el plan. Acordemos ahora los próximos pasos.")
      }
    }
  ];

  // versões alternativas das falas (roteiros 1 e 2): [passo][nível de evolução][roteiro-1]
  const G_ALT = [
    [
      [L("Esta semana pesou: os sintomas voltaram com força e quase nada do combinado saiu do papel.", "This week was heavy: the symptoms came back strongly and almost nothing we agreed left the paper.", "Esta semana pesó: los síntomas volvieron con fuerza y casi nada de lo acordado salió del papel."), L("Não foi uma boa semana: os mesmos problemas de sempre, e o combinado ficou para depois.", "It wasn't a good week: the same old problems, and the agreement was put off.", "No fue una buena semana: los mismos problemas de siempre, y lo acordado quedó para después.")],
      [L("Teve altos e baixos: parte do combinado funcionou, parte nem saiu do lugar.", "Ups and downs: part of the agreement worked, part never got started.", "Hubo altibajos: parte de lo acordado funcionó, parte ni empezó."), L("A semana foi irregular: alguns dias bem, outros nem tanto, e o combinado foi cumprido pela metade.", "The week was uneven: some days fine, others not so much, and the agreement was half kept.", "La semana fue irregular: algunos días bien, otros no tanto, y lo acordado se cumplió a medias.")],
      [L("Semana boa: os momentos difíceis apareceram menos e o combinado ajudou mais do que se esperava.", "A good week: hard moments showed up less and the agreement helped more than expected.", "Buena semana: los momentos difíciles aparecieron menos y lo acordado ayudó más de lo esperado."), L("Houve melhora: mais dias calmos e o combinado começou a virar hábito.", "There was improvement: more calm days and the agreement started to become a habit.", "Hubo mejora: más días tranquilos y lo acordado empezó a volverse hábito.")],
    ],
    [
      [L("Manter a rotina está pesado. Em alguns dias, desistir parece a saída mais fácil.", "Keeping the routine feels heavy. Some days, quitting seems the easy way out.", "Mantener la rutina pesa. Algunos días, abandonar parece la salida más fácil."), L("A rotina não está se sustentando, e a vontade de largar o tratamento aparece com frequência.", "The routine isn't holding, and the urge to drop treatment shows up often.", "La rutina no se sostiene, y las ganas de dejar el tratamiento aparecen con frecuencia.")],
      [L("Algumas coisas ajudaram, mas em certas situações tudo volta ao jeito antigo.", "Some things helped, but in certain situations everything slides back to the old way.", "Algunas cosas ayudaron, pero en ciertas situaciones todo vuelve al modo antiguo."), L("Há estratégias que funcionam, e há momentos em que o padrão antigo fala mais alto.", "Some strategies work, and there are moments when the old pattern speaks louder.", "Hay estrategias que funcionan, y momentos en que el patrón antiguo habla más fuerte.")],
      [L("Já se percebe o que ajuda e o que piora; ainda há dias difíceis, mas são mais bem atravessados.", "It's now clear what helps and what worsens; hard days remain, but they're weathered better.", "Ya se nota lo que ayuda y lo que empeora; aún hay días difíciles, pero se atraviesan mejor."), L("Os momentos ruins ainda vêm, só que agora há ferramentas para lidar com eles.", "Bad moments still come, but now there are tools to deal with them.", "Los malos momentos aún llegan, pero ahora hay herramientas para manejarlos.")],
    ],
    [
      [L("Olhando para trás, mudou pouco. Fica a dúvida se este caminho é o certo.", "Looking back, little has changed. There's doubt whether this is the right path.", "Mirando atrás, cambió poco. Queda la duda de si este camino es el correcto."), L("Até agora quase nada mudou, e isso desanima um pouco.", "So far almost nothing has changed, and that is a bit discouraging.", "Hasta ahora casi nada cambió, y eso desanima un poco.")],
      [L("Olhando para trás, há coisas que mudaram e outras que continuam incomodando. Queremos saber o que vem agora.", "Looking back, some things changed and others keep bothering. We want to know what comes next.", "Mirando atrás, hay cosas que cambiaron y otras que siguen molestando. Queremos saber qué viene ahora."), L("O caminho teve avanços e travas. Agora falta entender por onde continuar.", "The path had progress and blocks. Now we need to understand where to go on.", "El camino tuvo avances y trabas. Ahora falta entender por dónde continuar.")],
      [L("Olhando para trás, mudou muita coisa: os momentos difíceis vêm menos e passam mais depressa.", "Looking back, a lot has changed: hard moments come less and pass faster.", "Mirando atrás, cambió mucho: los momentos difíciles vienen menos y pasan más rápido."), L("Comparando com o início, a diferença é grande: há mais calma e mais confiança.", "Compared with the start, the difference is big: more calm and more confidence.", "Comparando con el inicio, la diferencia es grande: hay más calma y más confianza.")],
    ],
    [
      [L("E agora? Qual é a conclusão sobre o caso e quais são os próximos passos?", "And now? What is the conclusion about the case and what are the next steps?", "¿Y ahora? ¿Cuál es la conclusión sobre el caso y cuáles son los próximos pasos?"), L("Chegamos ao fim deste ciclo. O que se concluiu e o que fazemos daqui em diante?", "We've reached the end of this cycle. What was concluded and what do we do from here?", "Llegamos al final de este ciclo. ¿Qué se concluyó y qué hacemos de aquí en adelante?")],
    ],
  ];

  const INTRO = {
    // na 1ª vez no consultório, todo paciente se apresenta e conta o motivo de estar ali
    patient: L("({name}, {age}, se apresenta e conta o motivo da consulta: {complaint}) ", "({name}, {age}, introduces themself and explains why they came: {complaint}) ", "({name}, {age}, se presenta y cuenta el motivo de la consulta: {complaint}) "),
    parent: L("({parent} se apresenta, fala de {name}, {age}, e conta o motivo da consulta: {complaint}) ", "({parent} introduces themself, talks about {name}, {age}, and explains why they came: {complaint}) ", "({parent} se presenta, habla de {name}, {age}, y cuenta el motivo de la consulta: {complaint}) ")
  };
  const NARR = L("({name} relata como foram os últimos dias.) ", "({name} reports how the last few days went.) ", "({name} cuenta cómo fueron los últimos días.) ");

  function steps(caseKey, sess, arc = 0) {
    const c = CASES[caseKey];
    const who = c.parent ? "parent" : "patient";
    const speaker = c.steps[0].who;
    // Cena própria da consulta (content/cases/<id>.json → voice.sessoes.s1…s4): três falas ligadas,
    // começo, meio e fim de sessão. Quando existe, ela MANDA — inclusive na 1ª consulta, onde a
    // apresentação já vem escrita dentro da primeira fala (antes o jogo colava voice.intro por cima
    // do passo 0 e a pessoa contava a queixa duas vezes seguidas).
    const cenaBase = c.voice && c.voice.sessoes && c.voice.sessoes[`s${sess}`];
    const fechoExtra = c.voice && c.voice.fecho && c.voice.fecho[`s${sess}`];
    const cena = cenaBase && cenaBase.length ? (fechoExtra ? cenaBase.concat([fechoExtra]) : cenaBase) : null;
    if (cena && cena.length) {
      const molde = c.steps[Math.min(sess === 1 ? 0 : 2, c.steps.length - 1)];
      // OPÇÕES PRÓPRIAS DA CENA (7.9). A fala das consultas 3 e 4 é de cada paciente desde a 4.26, mas
      // as RESPOSTAS continuavam sendo as do molde — as escolhas escritas para a 2ª consulta, coladas
      // por cima de uma cena nova. A pessoa dizia uma coisa dela e o menu falava de outra.
      // Agora, quando o caso traz `voice.opcoes.sN[i]`, cada abordagem que o caso oferece pega a
      // resposta escrita para AQUELA cena; o que não estiver escrito continua vindo do molde, para
      // nenhum caso ficar sem menu enquanto os quinze não estiverem cobertos.
      const opcCena = c.voice && c.voice.opcoes && c.voice.opcoes[`s${sess}`];
      return cena.map((fala, i) => {
        const escritas = opcCena && opcCena[i];
        const options = Object.assign({}, molde.options);
        if (escritas) Object.keys(options).forEach((ap) => { if (escritas[ap]) options[ap] = pick(escritas[ap]); });
        return Object.assign({}, molde, {
          who: molde.who || (speaker === "parent" || who === "parent" ? "parent" : "patient"),
          text: pick(fala), variants: [], note: null, mods: {}, options,
          fim: i === cena.length - 1,                 // última fala da sessão: é onde a psicóloga se despede
        });
      });
    }
    if (sess <= 2) {
      // Toda consulta tem três tempos: começo, meio e fim. Na 1ª, a apresentação é um tempo SEPARADO
      // da queixa — antes as duas vinham coladas na mesma fala e vários pacientes contavam a mesma
      // coisa duas vezes seguidas. Na 2ª, o fecho vem de `voice.fecho.s2`.
      const part = sess === 1 ? c.steps.slice(0, 2) : c.steps.slice(2);
      const base = part.map((s0) => Object.assign({}, s0));
      if (sess === 1) {
        const intro = c.voice && c.voice.intro ? pick(c.voice.intro)
          : fill(pick(base[0].who === "parent" ? INTRO.parent : INTRO.patient), { name: c.name, age: c.age, complaint: c.complaint, parent: c.parent ? c.parent.name : "" });
        base.unshift(Object.assign({}, base[0], { text: intro, variants: [], note: null, mods: {} }));
      }
      const fecho = c.voice && c.voice.fecho && c.voice.fecho[`s${sess}`];
      if (fecho) base.push(Object.assign({}, base[base.length - 1], { text: pick(fecho), variants: [], note: null, mods: {}, fim: true }));
      base[base.length - 1].fim = true;
      return base;
    }
    const list = sess === 3 ? [G[0], G[1]] : [G[2], G[3]];
    const tr = tier(caseKey);
    return list.map((g, i) => {
      const gi = G.indexOf(g);
      const ti = g.text.length === 1 ? 0 : tr, a = arc % 3;
      const line = pick(a === 0 || !G_ALT[gi][ti] ? g.text[ti] : G_ALT[gi][ti][a - 1]);   // o roteiro da conversa vale nas quatro consultas
      const lead = sess === 3 && i === 0 ? fill(pick(NARR), { name: c.name }) : "";
      // voz do paciente (voice em content/cases): abertura oral + história do caso por nível de evolução + fecho oral
      const v = c.voice, hs = String(caseKey + sess + i).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
      // Fala própria da 3ª/4ª consulta (content/cases/<id>.json → voice.sessoes.s3/s4). Sem ela, vale o
      // roteiro compartilhado embrulhado na voz do paciente. Escrita por inteiro, então não leva o
      // embrulho (pre/ref/post) nem as aspas de novo: é a cena daquela pessoa, não um molde preenchido.
      const propria = v && v.sessoes && v.sessoes[`s${sess}`] && v.sessoes[`s${sess}`][i];
      if (propria) {
        // OPÇÕES PRÓPRIAS (7.9). A fala das consultas 3 e 4 é de cada paciente desde a 4.26, mas o
        // menu de escolhas continuava o mesmo para os quinze: a pessoa dizia uma coisa dela e as seis
        // respostas falavam de "o que combinamos". Quando o caso traz `voice.opcoes.s3/s4[i]`, é ele
        // que manda; o que faltar cai no roteiro-base, para nenhum caso ficar sem menu.
        const proprias = (v.opcoes && v.opcoes[`s${sess}`] && v.opcoes[`s${sess}`][i]) || null;
        const options0 = {};
        Object.keys(g.opts).forEach((ap) => { options0[ap] = proprias && proprias[ap] ? pick(proprias[ap]) : pick(g.opts[ap]); });
        return { who: speaker === "parent" || who === "parent" ? "parent" : "patient", text: `${lead}${pick(propria)}`, note: null, mods: {}, options: options0 };
      }
      const pre = v && i === 0 ? pick(v.pre[hs % v.pre.length]) + " " : "", ref = v && i === 0 && g.text.length > 1 ? " " + pick(v.ref[ti]) : "", post = v && i === 1 ? " " + pick(v.post) : "";
      const options = {};
      Object.keys(g.opts).forEach((ap) => {
        let o = pick(g.opts[ap]);
        if (v && i === 0) { if (ap === "acolhimento" || ap === "psicodinamica") o += " " + pick(v.hookA); else if (ap === "tcc" || ap === "comportamental") o += " " + pick(v.hookB); }   // pergunta ligada à história do caso
        options[ap] = o;
      });
      return { who: speaker === "parent" || who === "parent" ? "parent" : "patient", text: `${lead}'${pre}${line}${ref}${post}'`, note: null, mods: {}, options };
    });
  }

  // ------------------------------------------------------------ encaminhamento (fim da 4ª consulta)
  const TX_OPTIONS = ["psico", "psicpsiq", "familia", "grupo"];
  const TX_BY_CASE = { beatriz: "psicpsiq", carlos: "psico", enzo: "familia", gabriel: "familia", helena: "psicpsiq", iris: "psico", jonas: "psicpsiq", lucas: "familia", marcos: "grupo", maria: "psico", mariana: "familia", rafael: "psico", sofia: "familia", tiago: "psicpsiq", vitoria: "psico" };
  const txAnswer = (id) => TX_BY_CASE[id] || "psico";

  // ------------------------------------------------------------ pedidos de terapia
  const INVITE = L(
    "Doutora, gostei muito das nossas consultas e me sinto mais segura. Posso continuar em terapia com você? — {name}",
    "Doctor, I really liked our sessions and I feel more secure. Can I continue in therapy with you? — {name}",
    "Doctora, me gustaron mucho nuestras consultas y me siento más segura. ¿Puedo continuar en terapia contigo? — {name}");
  const NAOQUER = L(
    "Doutora, obrigado(a) por estas semanas. Pensei bastante e, por enquanto, não quero seguir com a terapia. Talvez mais para a frente. — {name}",
    "Doctor, thank you for these weeks. I thought about it a lot and, for now, I don't want to continue with therapy. Maybe further down the line. — {name}",
    "Doctora, gracias por estas semanas. Lo pensé mucho y, por ahora, no quiero seguir con la terapia. Quizá más adelante. — {name}");
  const FRIO = L(
    "Doutora, sou o(a) {name}. Sei que a gente já fechou, mas eu piorei. Eu tentei do jeito que a senhora falou e não foi. Eu não sei se era aquilo mesmo. A senhora me atenderia de novo?",
    "Doctor, it's {name}. I know we already closed, but I got worse. I tried it the way you said and it did not work. I don't know if that was really it. Would you see me again?",
    "Doctora, soy {name}. Sé que ya cerramos, pero empeoré. Intenté como usted dijo y no funcionó. No sé si era eso. ¿Me atendería otra vez?");
  // 7.2 — a adesão da devolutiva chega como recado: quem faltou avisa (ou não avisa), e quem abandonou deixa
  // uma ligação para fazer. O texto não culpa o paciente: descreve o que uma devolutiva mal conduzida produz.
  const FALTOU = [
    L("Doutora, desculpa, não vou conseguir ir hoje. Apareceu uma coisa. — {name}",
      "Doctor, sorry, I won't be able to make it today. Something came up. — {name}",
      "Doctora, perdón, hoy no voy a poder ir. Me surgió algo. — {name}"),
    L("Oi doutora. Eu não fui ontem. Para ser sincero(a), eu não sei se aquilo que a senhora explicou é mesmo o meu caso. — {name}",
      "Hi doctor. I didn't go yesterday. To be honest, I don't know if what you explained is really my case. — {name}",
      "Hola doctora. Ayer no fui. Para ser sincero(a), no sé si lo que usted explicó es realmente mi caso. — {name}"),
    L("(Sem aviso. O horário passou em branco.)", "(No word. The slot went by empty.)", "(Sin avisar. El horario pasó en blanco.)")
  ];
  const ABANDONO = L(
    "Doutora, é o(a) {name}. Acho melhor eu parar por aqui. Não é a senhora — é que eu não estou conseguindo ver onde isso vai dar. A senhora quer conversar por telefone antes de eu decidir de vez?",
    "Doctor, it's {name}. I think I'd better stop here. It's not you — I just can't see where this is going. Do you want to talk on the phone before I decide for good?",
    "Doctora, soy {name}. Creo que es mejor que pare aquí. No es usted — es que no consigo ver adónde va esto. ¿Quiere hablar por teléfono antes de que lo decida del todo?");

  const THANKS = L(
    "Obrigado(a) pelo diagnóstico e pelos encaminhamentos, doutora. Por enquanto era só isso que eu precisava. — {name}",
    "Thank you for the diagnosis and the referrals, doctor. For now that's all I needed. — {name}",
    "Gracias por el diagnóstico y las derivaciones, doctora. Por ahora era todo lo que necesitaba. — {name}");

  // "NÃO QUERO SEGUIR" TAMBÉM É RESPOSTA. Quem termina o ciclo escreve dizendo se quer continuar em
  // terapia — e a resposta depende de como o ciclo correu. Um ciclo raso (poucas consultas boas, ou um
  // diagnóstico que não se sustentou) faz a pessoa agradecer e parar por aí. Não é fracasso do jogo: é
  // a consequência clínica de um trabalho que não criou vínculo nem sentido suficiente.
  function quisContinuar(caseKey) {
    const r = rec(caseKey), ev = evolution(caseKey);
    const c = CASES[caseKey];
    const certo = c && c.diagnosis && r.dx ? r.dx === c.diagnosis.answer : false;
    if (r.q.length < 3) return false;                    // mal se conheceram
    return ev >= 45 || certo;                            // sentido no processo, ou um diagnóstico que fecha
  }
  function afterFinal(caseKey) {
    const c = CASES[caseKey];
    state.inbox = state.inbox || [];
    if (state.inbox.some((m) => m.caseId === caseKey)) return;
    const quer = !ONLY_DX[caseKey] && quisContinuar(caseKey);
    const kind = ONLY_DX[caseKey] ? "thanks" : quer ? "invite" : "naoquer";
    state.inbox.push({ caseId: caseKey, kind, status: quer ? "new" : "info", week: state.week || 1 });
    if (quer && typeof showToast === "function") setTimeout(() => showToast(t("fu.toast.invite", { name: c.name })), 600);
    else if (kind === "naoquer" && typeof showToast === "function") setTimeout(() => showToast(t("fu.toast.naoquer", { name: c.name })), 600);
  }

  // ------------------------------------------------------------------ o caso frio que volta
  // Um diagnóstico errado ficava no passado: a nota caía e acabou. Mas na clínica o erro tem um corpo,
  // e ele volta. Algumas SEMANAS depois de você fechar um caso com a hipótese errada, a pessoa escreve:
  // piorou, e quer voltar. Reabrir é o pior dos dois mundos e o melhor: a sua ficha antiga continua
  // lá, com as suas marcações antigas — e é justamente ela que atrapalha, porque olhar de novo para
  // o mesmo caso com a sua própria conclusão escrita na frente é a parte difícil da clínica.
  const ESPERA_FRIO = 3;      // semanas entre fechar errado e a pessoa voltar
  function fechouErrado(caseKey) {
    const r = rec(caseKey), c = CASES[caseKey];
    if (!c || !c.diagnosis || !r.dx) return false;
    return r.dx !== c.diagnosis.answer;
  }
  function verCasosFrios() {
    state.inbox = state.inbox || [];
    const sem = state.week || 1;
    Object.keys(state.pat || {}).forEach((id) => {
      const r = rec(id);
      if (!r.dx || r.frio || !fechouErrado(id)) return;
      if (!r.fechadoEm) { r.fechadoEm = sem; return; }             // a partir daqui a conta começa
      if (sem - r.fechadoEm < ESPERA_FRIO) return;
      if (state.inbox.some((m) => m.caseId === id && m.kind === "frio")) return;
      r.frio = "escreveu";
      state.inbox.push({ caseId: id, kind: "frio", status: "new", week: sem });
      if (typeof showToast === "function") setTimeout(() => showToast(t("fu.toast.frio", { name: CASES[id] ? CASES[id].name : "" })), 800);
    });
    saveState();
  }
  // quem está reaberto NESTA semana (a reabertura vale uma semana: é uma segunda olhada, não um ciclo novo)
  function frios() {
    const sem = state.week || 1;
    return Object.keys(state.pat || {}).filter((id) => { const r = rec(id); return r.frio === "reaberto" && r.reabertoEm === sem; });
  }
  function reabrir(caseKey, aceitou) {
    const r = rec(caseKey);
    r.frio = aceitou ? "reaberto" : "recusado";
    if (aceitou) {
      r.reabertoEm = (state.week || 1) + 1;   // ela volta na SEMANA QUE VEM, não hoje
      // a ficha antiga continua lá, e é ela que atrapalha: a hipótese que você fechou fica MARCADA,
      // e destravar exige desfazer o que você mesmo escreveu
      if (typeof Dx !== "undefined" && Dx.book) {
        const b = Dx.book(caseKey);
        b.reaberto = true;
        b.hyp = r.dx;                                     // a sua conclusão errada, de volta na sua frente
        b.firme = {};                                     // o que estava travado destrava: nada se sustenta mais
      }
      state.xp += 3;
    } else {
      state.reputacao = (state.reputacao || 0) - 2;       // dizer não a quem piorou custa
    }
    saveState();
  }

  function inboxText(m) {
    const c = CASES[m.caseId];
    if (m.kind === "referral" && typeof Gen !== "undefined") return Gen.referralText(m);
    if (m.kind === "alta") return fill(pick(L("Doutora, hoje me sinto bem e sigo em frente. Obrigado(a) por ter caminhado comigo até aqui. — {name}", "Doctor, today I feel well and I am moving on. Thank you for walking with me this far. — {name}", "Doctora, hoy me siento bien y sigo adelante. Gracias por haber caminado conmigo hasta aquí. — {name}")), { name: c ? c.name : "" });
    if (m.kind === "frio") return fill(pick(FRIO), { name: c ? c.name : "" });
    if (m.kind === "naoquer") return fill(pick(NAOQUER), { name: c ? c.name : "" });
    if (m.kind === "faltou") {
      const h = String(m.caseId + (m.week || 0)).split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
      return fill(pick(FALTOU[h % FALTOU.length]), { name: c ? c.name : "" });
    }
    if (m.kind === "abandono") return fill(pick(ABANDONO), { name: c ? c.name : "" });
    if (m.kind === "cancelou") {
      const h = String(m.caseId + (m.week || 0)).split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
      return fill(pick(MOTIVOS[h % MOTIVOS.length]), { name: c ? c.name : "" });
    }
    return fill(pick(m.kind === "thanks" ? THANKS : INVITE), { name: c ? c.name : "" });
  }

  function answer(caseKey, accept) {
    const m = (state.inbox || []).find((x) => x.caseId === caseKey && x.status === "new");
    if (!m) return false;
    m.status = accept ? "accepted" : "declined";
    if (m.kind === "referral") { if (typeof Gen !== "undefined") Gen.accept(caseKey, accept); saveState(); return true; }   // encaminhamento: vira agenda de psicodiagnóstico
    if (m.kind === "frio") { reabrir(caseKey, accept); saveState(); return true; }
    // a ligação para quem abandonou: aceitar é telefonar, e a pessoa volta uma vez só
    if (m.kind === "abandono") {
      if (typeof Care !== "undefined") Care.chamarDeVolta(caseKey, accept);
      if (accept && typeof showToast === "function") setTimeout(() => showToast(I18N.pick(L("Ele(a) topou voltar na semana que vem.", "They agreed to come back next week.", "Aceptó volver la semana que viene."))), 600);
      saveState(); return true;
    }
    if (accept) { state.therapy = state.therapy || {}; state.therapy[caseKey] = { week: state.week || 1 }; state.xp += 5; state.coins += 10; if (typeof Care !== "undefined") Care.onAccept(caseKey); }
    saveState();
    return true;
  }

  // ---------------------------------------------------------------- cancelamento de consulta (7.7)
  // O eixo 🤝 Anamnese prometia "reduzir cancelamento" desde sempre, e cancelamento não existia: o
  // código só dava mais minutos de espera para quem chegava atrasado. Agora o paciente pode desmarcar
  // — e quem desmarca é quem tem menos vínculo com você, adesão baixa e uma consulta ruim para trás.
  //
  // Regras que seguram isso de virar castigo:
  //  · só a 2ª e a 3ª consulta cancelam. A 1ª é a porta de entrada e a 4ª é o diagnóstico: perder
  //    qualquer uma das duas quebraria o ciclo do paciente, não o dia do jogador;
  //  · no máximo UM cancelamento por semana em toda a agenda;
  //  · nunca na semana 1 (o tutorial) nem no modo secreto;
  //  · é determinístico por caso+semana: recarregar a página não sorteia de novo.
  const CANCEL_BASE = 0.14;
  function chanceCancelar(id, sess) {
    if (sess !== 2 && sess !== 3) return 0;
    if ((state.week || 1) <= 1) return 0;
    const r = rec(id);
    const notas = (r.q || []).slice(-2);
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0.6;
    const adesao = (r.adesao ?? 60) / 100;
    let ch = CANCEL_BASE * (1.6 - media) * (1.4 - adesao);
    if (typeof Wheel !== "undefined") ch *= [1, 0.7, 0.5, 0.35][Wheel.faixa ? Wheel.faixa("anamnese") : (Wheel.active("anamnese") ? 1 : 0)];   // a promessa do eixo, cumprida
    if (typeof Career !== "undefined" && Career.has && Career.has("recepcao")) ch *= 0.6;   // quem confirma consulta perde menos gente
    return Math.max(0, Math.min(0.3, ch));
  }
  const MOTIVOS = [
    L("Doutora, desculpa em cima da hora. Não vou conseguir ir hoje. — {name}", "Doctor, sorry for the short notice. I can't make it today. — {name}", "Doctora, perdón por avisar encima. Hoy no voy a poder ir. — {name}"),
    L("Oi doutora, surgiu uma coisa no trabalho e eu não consigo sair. Remarcamos? — {name}", "Hi doctor, something came up at work and I can't get away. Can we reschedule? — {name}", "Hola doctora, surgió algo en el trabajo y no puedo salir. ¿Reprogramamos? — {name}"),
    L("Doutora, eu pensei melhor e essa semana eu prefiro não ir. — {name}", "Doctor, I thought about it and this week I'd rather not come. — {name}", "Doctora, lo pensé mejor y esta semana prefiero no ir. — {name}")
  ];
  const cancelados = () => (state.cancelados = state.cancelados || {});
  const chaveCancel = (id) => `${id}|${state.week || 1}`;
  const cancelou = (id) => Boolean(cancelados()[chaveCancel(id)]);

  // roda uma vez por semana, ao montar a agenda: decide quem desmarca
  function sortearCancelamento() {
    const w = state.week || 1;
    if (state.sandbox === undefined && w <= 1) return null;
    if (Object.keys(cancelados()).some((k) => k.endsWith(`|${w}`))) return null;   // já houve um nesta semana
    const candidatos = [];
    DAYS.forEach((d) => (SCHEDULE[d] || []).forEach((a, i) => {
      if (!a || a.sess === Care.MANUT || !CASES[a.caseId]) return;
      const ch = chanceCancelar(a.caseId, a.sess);
      if (ch > 0) candidatos.push({ id: a.caseId, dia: d, i, sess: a.sess, ch });
    }));
    for (const c of candidatos) {
      const h = String(`${c.id}|${w}|cancel`).split("").reduce((acc, ch2) => (acc * 31 + ch2.charCodeAt(0)) >>> 0, 7);
      if ((h % 1000) / 1000 < c.ch) {
        cancelados()[chaveCancel(c.id)] = { dia: c.dia, i: c.i, sess: c.sess, semana: w };
        state.inbox = state.inbox || [];
        state.inbox.push({ caseId: c.id, kind: "cancelou", status: "info", week: w });
        saveState();
        return c;
      }
    }
    return null;
  }

  // renda semanal de quem segue em terapia (chamado na virada da semana)
  function weeklyIncome() {
    const n = Object.keys(state.therapy || {}).length;
    let coins = n * 5;   // pequena renda de fundo; as sessões de acompanhamento pagam o resto
    if (coins) state.coins += coins;
    if (typeof Career !== "undefined" && Career.bolsaDaSemana) coins += Career.bolsaDaSemana();   // bolsa de pesquisa (7.5)
    return coins;
  }

  // vira a semana: guarda as estrelas, limpa os resultados e monta a agenda da próxima
  function nextWeek() {
    state.banked = state.banked || { stars: 0, max: 0 };
    state.banked.stars += Object.values(state.results).reduce((s, r) => s + r.stars, 0);
    state.banked.max += DAYS.reduce((s, d) => s + SCHEDULE[d].length * 3, 0);
    state.results = {};
    state.phoneRead = {};
    state.week = (state.week || 1) + 1;
    state.dayIndex = 0; state.apptIndex = 0;
    if (typeof Care !== "undefined") Care.weekRoll(state.week - 1);   // faltas e recaídas
    if (typeof Gen !== "undefined") Gen.weekRoll();                   // novos encaminhamentos (modo contínuo)
    verCasosFrios();                                                  // quem você fechou errado volta, semanas depois
    plan();
    sortearCancelamento();                                            // quem desmarcou esta semana (7.7)
    return weeklyIncome();
  }

  const sessType = (n) => (n === 0.5 ? I18N.pick(L("Sessão de acompanhamento", "Follow-up session", "Sesión de seguimiento")) : t(`fu.type.${clamp(n, 1, SESSIONS)}`));

  // ------------------------------------------------------------ o balanço do ciclo
  // As 4 semanas terminavam secas: "12 de 36 estrelas" e mais nada. O jogo sabia quem melhorou, o que
  // você concluiu, se estava certo e quem ficou pelo caminho — e não contava nada disso. Aqui ele conta,
  // paciente por paciente, porque é essa a leitura que fecha um ciclo de trabalho.
  function balanco() {
    const linhas = [];
    Object.keys(CASES).forEach((id) => {
      const r = (state.pat || {})[id];
      if (!r || (!r.q.length && !r.dx)) return;                       // nunca atendido: fica de fora
      const c = CASES[id];
      const certo = c.diagnosis && r.dx ? r.dx === c.diagnosis.answer : null;
      const ev = evolution(id);
      const investigadas = typeof Dx !== "undefined" && Dx.book ? Object.keys(Dx.book(id).found || {}).length : 0;
      linhas.push({
        id,
        nome: I18N.pick(c.name),
        imagem: c.image || null,
        consultas: r.q.length,
        evolucao: ev,
        fechou: Boolean(r.dx),
        certo,
        dxNome: r.dx && typeof disorderName === "function" ? disorderName(r.dx) : null,
        respostaNome: c.diagnosis && typeof disorderName === "function" ? disorderName(c.diagnosis.answer) : null,
        encaminhou: r.tx || null,
        investigadas,
        terapia: typeof Care !== "undefined" && Care.list ? Care.list().some((x) => (x.id || x) === id) : false,
        interrompido: Boolean(r.closed)
      });
    });
    linhas.sort((a2, b2) => b2.consultas - a2.consultas || a2.nome.localeCompare(b2.nome));
    const fechados = linhas.filter((x) => x.fechou);
    return {
      linhas,
      atendidos: linhas.length,
      fechados: fechados.length,
      acertos: fechados.filter((x) => x.certo).length,
      emTerapia: linhas.filter((x) => x.terapia).length,
      interrompidos: linhas.filter((x) => x.interrompido).length,
      semFechar: linhas.filter((x) => !x.fechou && !x.interrompido).length
    };
  }

  return { generic: G, TOTAL_WEEKS, SESSIONS, plan, steps, rec, chanceCancelar, sortearCancelamento, cancelou, cancelados, CANCEL_BASE, evolution, tier, balanco, quisContinuar, txAnswer, TX_OPTIONS, afterFinal, inboxText, answer, nextWeek, sessType, ONLY_DX, verCasosFrios, reabrir, fechouErrado, frios, ESPERA_FRIO };
})();

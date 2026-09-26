"use strict";

// ===========================================================================
// Testagem observada: aplicar uma bateria deixou de ser um botão que devolve um número.
// Agora a psicóloga (1) escolhe COMO apresenta a tarefa e (2) ASSISTE a pessoa fazendo,
// item a item. O número continua saindo igual (psicodx.applyTest); o que muda é que o
// jogador vê o comportamento — que é onde mora a informação clínica.
//
//  · A forma de apresentar mexe na ansiedade e no vínculo, e a ansiedade atrapalha o desempenho.
//  · Cada erro tem uma CARA: quem tem desatenção perde o fio, quem é impulsivo responde antes da hora,
//    quem é ansioso se corrige sem parar. É isso que vira a observação anotada na ficha.
//  · Quem não quiser assistir tem "pular"; o resultado é o mesmo.
// ===========================================================================
const Testagem = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));

  // como apresentar a tarefa. Mexe no vínculo e na ansiedade (que piora o desempenho observado).
  const MODOS = [
    { id: "explicar", icon: "📘", ap: "psicoeducacao",
      nome: L("Explicar antes o que vai acontecer", "Explain beforehand what will happen", "Explicar antes qué va a pasar"),
      efeito: L("Tranquiliza: menos ansiedade na tarefa e mais vínculo.", "Calms: less anxiety during the task and more bond.", "Tranquiliza: menos ansiedad en la tarea y más vínculo."),
      ansiedade: -2, vinculo: 3, minutos: 2 },
    { id: "aplicar", icon: "⏱️", ap: "diretiva",
      nome: L("Aplicar direto, do jeito padronizado", "Apply it straight, the standardised way", "Aplicar directo, de forma estandarizada"),
      efeito: L("Rápido e fiel ao manual, mas quem já chega tenso fica mais tenso.", "Quick and faithful to the manual, but whoever arrives tense gets tenser.", "Rápido y fiel al manual, pero quien llega tenso se pone más tenso."),
      ansiedade: 1, vinculo: 0, minutos: 0 },
    { id: "observar", icon: "👁️", ap: "comportamental",
      nome: L("Deixar tentar sozinha e observar", "Let her try on her own and observe", "Dejarla intentar sola y observar"),
      efeito: L("Rende mais observação comportamental; a pessoa se vira como consegue.", "Yields more behavioural observation; the person copes as best she can.", "Rinde más observación conductual; la persona se arregla como puede."),
      ansiedade: 0, vinculo: 1, minutos: 2, observacao: 1 },
  ];

  // o que aparece na tela em cada bateria, e o jeito do erro
  const TAREFAS = {
    memoria: {
      nome: L("Dígitos", "Digit span", "Dígitos"),
      estimulo: (i, r) => Array.from({ length: 3 + Math.floor(i / 2) }, () => Math.floor(r() * 10)).join(" "),
      acerto: (e) => e,
      erro: (e, r) => { const d = e.split(" "); if (d.length > 2) { const j = 1 + Math.floor(r() * (d.length - 1)); d.splice(j, 1); } return d.join(" "); },
      comoErra: L("some com um número do meio", "drops a number from the middle", "pierde un número del medio"),
    },
    atencao: {
      nome: L("Go / No-Go", "Go / No-Go", "Go / No-Go"),
      estimulo: (i, r) => (r() < 0.3 ? "🔴" : "🟢"),
      acerto: (e) => (e === "🟢" ? tr("apertou", "pressed", "pulsó") : tr("segurou", "held", "se contuvo")),
      erro: (e) => (e === "🟢" ? tr("deixou passar", "let it pass", "lo dejó pasar") : tr("apertou mesmo assim", "pressed anyway", "pulsó igual")),
      comoErra: L("aperta no sinal de parar", "presses on the stop signal", "pulsa en la señal de parar"),
    },
    executivas: {
      nome: L("Stroop", "Stroop", "Stroop"),
      estimulo: (i, r) => { const c = ["VERMELHO", "AZUL", "VERDE", "AMARELO"]; return c[Math.floor(r() * 4)]; },
      acerto: () => tr("disse a cor", "said the colour", "dijo el color"),
      erro: () => tr("leu a palavra", "read the word", "leyó la palabra"),
      comoErra: L("lê a palavra em vez de dizer a cor", "reads the word instead of saying the colour", "lee la palabra en vez de decir el color"),
    },
    qi: {
      nome: L("Raciocínio", "Reasoning", "Razonamiento"),
      estimulo: (i, r) => `${1 + Math.floor(r() * 9)} · ${1 + Math.floor(r() * 9)} · ?`,
      acerto: () => tr("completou a sequência", "completed the sequence", "completó la secuencia"),
      erro: () => tr("parou e disse que não sabe", "stopped and said she doesn't know", "se detuvo y dijo que no sabe"),
      comoErra: L("desiste antes de tentar", "gives up before trying", "se rinde antes de intentar"),
    },
    emocoes: {
      nome: L("Faces", "Faces", "Caras"),
      estimulo: (i, r) => ["😀", "😢", "😠", "😨", "😐"][Math.floor(r() * 5)],
      acerto: (e) => ({ "😀": tr("alegria", "joy", "alegría"), "😢": tr("tristeza", "sadness", "tristeza"), "😠": tr("raiva", "anger", "enfado"), "😨": tr("medo", "fear", "miedo"), "😐": tr("neutro", "neutral", "neutro") }[e]),
      erro: () => tr("chutou 'neutro'", "guessed 'neutral'", "adivinó 'neutro'"),
      comoErra: L("chama tudo de neutro quando não tem certeza", "calls everything neutral when unsure", "llama todo neutro cuando duda"),
    },
  };

  // A ESCOLHA DA PESSOA é dado clínico, não cortesia. Oferecer duas portas e ver por qual ela entra
  // diz o que nenhuma pontuação diz: quem já sabe onde falha desvia ANTES de tentar, quem é impulsivo
  // pega a mais difícil sem medir, quem está ansioso pede a mais curta e pergunta se pode repetir.
  // "fácil" muda a chance de acerto de verdade — senão a escolha seria enfeite.
  const ESCOLHAS = {
    memoria: {
      pergunta: L("Tem duas maneiras de fazer. Qual você prefere?", "There are two ways to do this. Which do you prefer?", "Hay dos maneras de hacerlo. ¿Cuál prefieres?"),
      opcoes: [
        { id: "direta", facil: 1, nome: L("Repetir os números na ordem em que eu falar", "Repeat the numbers in the order I say them", "Repetir los números en el orden en que los diga"),
          fala: L("Essa eu faço. A de trás para frente eu já sei que eu não consigo.", "That one I can do. The backwards one I already know I can't.", "Esa sí puedo. La de atrás para adelante ya sé que no puedo."),
          leitura: L("desviou da tarefa mais difícil antes de tentar — ela já sabe onde falha", "steered away from the harder task before trying — she already knows where she fails", "esquivó la tarea más difícil antes de intentarlo: ya sabe dónde falla") },
        { id: "inversa", facil: -1, nome: L("Repetir de trás para frente", "Repeat them backwards", "Repetirlos al revés"),
          fala: L("Põe a difícil logo, se não eu fico pensando nela o tempo todo.", "Put the hard one first, otherwise I'll be thinking about it the whole time.", "Pon la difícil ya, si no voy a estar pensando en ella todo el rato."),
          leitura: L("pegou a mais difícil primeiro, sem medir o quanto aguenta", "took the harder one first, without measuring how much she can take", "tomó la más difícil primero, sin medir cuánto aguanta") },
        { id: "curta", facil: 0, nome: L("Começar por sequências curtas e ir subindo", "Start with short sequences and work up", "Empezar por secuencias cortas e ir subiendo"),
          fala: L("Dá para começar devagar? Se eu errar o primeiro eu travo.", "Can we start slow? If I miss the first one I freeze.", "¿Podemos empezar despacio? Si fallo el primero me bloqueo."),
          leitura: L("negociou o começo para não errar de saída — o erro custa caro para ela", "negotiated the start so as not to fail at the outset — being wrong costs her dearly", "negoció el comienzo para no fallar de entrada: equivocarse le cuesta caro") }
      ]
    },
    atencao: {
      pergunta: L("Quer treinar dois antes de valer, ou já começa?", "Want two practice rounds before it counts, or start now?", "¿Quieres dos de prueba antes de que cuente, o empezamos ya?"),
      opcoes: [
        { id: "treino", facil: 1, nome: L("Treinar dois antes", "Two practice rounds", "Dos de prueba antes"),
          fala: L("Treina, treina. Eu não quero errar logo no começo.", "Practice, yes. I don't want to get it wrong right at the start.", "Practicar, sí. No quiero fallar justo al principio."),
          leitura: L("pediu treino: o erro pesa mais do que a tarefa", "asked to practise: being wrong weighs more than the task itself", "pidió practicar: el error pesa más que la tarea") },
        { id: "ja", facil: -1, nome: L("Começar agora", "Start now", "Empezar ahora"),
          fala: L("Pode começar. Eu pego no jeito.", "You can start. I'll get the hang of it.", "Puedes empezar. Le pillo el truco."),
          leitura: L("dispensou o treino e foi direto — confiança, ou pressa de acabar", "waved off the practice and went straight in — confidence, or a rush to be done", "rechazó la práctica y fue directo: confianza, o prisa por acabar") }
      ]
    },
    executivas: {
      pergunta: L("Prefere em voz alta ou apontando?", "Out loud or pointing?", "¿En voz alta o señalando?"),
      opcoes: [
        { id: "voz", facil: 0, nome: L("Dizer em voz alta", "Say it out loud", "Decirlo en voz alta"),
          fala: L("Falando. Se eu falo eu me escuto e me corrijo.", "Out loud. If I speak I hear myself and correct myself.", "Hablando. Si hablo me escucho y me corrijo."),
          leitura: L("usa a própria voz para se monitorar — uma estratégia que ela montou sozinha", "uses her own voice to monitor herself — a strategy she built on her own", "usa su propia voz para monitorearse: una estrategia que armó sola") },
        { id: "apontar", facil: 1, nome: L("Apontar", "Point", "Señalar"),
          fala: L("Apontando. Falar me atrapalha.", "Pointing. Speaking gets in my way.", "Señalando. Hablar me estorba."),
          leitura: L("tirou a fala do caminho: falar e pensar ao mesmo tempo custa", "took speech out of the way: speaking and thinking at once is costly", "quitó el habla del camino: hablar y pensar a la vez le cuesta") }
      ]
    },
    qi: {
      pergunta: L("Quer que eu leia junto ou você lê sozinha?", "Shall I read along, or will you read on your own?", "¿Leo contigo o lees tú sola?"),
      opcoes: [
        { id: "junto", facil: 1, nome: L("Ler junto", "Read along", "Leer juntas"),
          fala: L("Lê junto comigo. Sozinha eu leio e não entra.", "Read it with me. On my own I read it and it doesn't go in.", "Léelo conmigo. Sola leo y no me entra."),
          leitura: L("pediu companhia na leitura — sozinha, o texto não sustenta a atenção dela", "asked for company in the reading — alone, text does not hold her attention", "pidió compañía al leer: sola, el texto no sostiene su atención") },
        { id: "sozinha", facil: 0, nome: L("Ler sozinha", "Read on my own", "Leer sola"),
          fala: L("Eu leio. Eu prefiro no meu tempo.", "I'll read it. I'd rather go at my own pace.", "Leo yo. Prefiero a mi ritmo."),
          leitura: L("quis o próprio tempo — o ritmo dos outros atrapalha", "wanted her own pace — other people's rhythm gets in the way", "quiso su propio tiempo: el ritmo de los demás estorba") }
      ]
    },
    emocoes: {
      pergunta: L("Quer ver as caras uma de cada vez ou todas juntas?", "One face at a time, or all of them together?", "¿Una cara por vez o todas juntas?"),
      opcoes: [
        { id: "uma", facil: 1, nome: L("Uma de cada vez", "One at a time", "Una por vez"),
          fala: L("Uma de cada vez. Todas juntas me embaralham.", "One at a time. All together muddles me.", "Una por vez. Todas juntas me lían."),
          leitura: L("pediu para reduzir o campo: muita coisa junta desorganiza", "asked to narrow the field: too much at once disorganises her", "pidió reducir el campo: demasiado junto la desorganiza") },
        { id: "todas", facil: -1, nome: L("Todas juntas", "All together", "Todas juntas"),
          fala: L("Põe todas. Eu comparo melhor assim.", "Put them all up. I compare better that way.", "Ponlas todas. Así comparo mejor."),
          leitura: L("quis comparar em vez de julgar uma a uma — procura o contraste", "wanted to compare rather than judge one by one — she looks for contrast", "quiso comparar en vez de juzgar una a una: busca el contraste") }
      ]
    }
  };

  // COMO A PESSOA REAGE quando erra — e o que a psicóloga faz com isso. Não comentar mantém a medida
  // limpa; acolher acalma e contamina o número; perguntar rende a melhor informação e custa tempo.
  const REACOES = [
    { id: "esperar", icon: "🤐", ap: "comportamental",
      nome: L("Não dizer nada e deixar ela seguir", "Say nothing and let her carry on", "No decir nada y dejar que siga"),
      efeito: L("A medida fica limpa. Você vê como ela se recompõe sozinha.", "The measure stays clean. You see how she recovers on her own.", "La medida queda limpia. Ves cómo se recompone sola."),
      ansiedade: 0, vinculo: 0, observacao: 1, minutos: 0 },
    { id: "acolher", icon: "🫱", ap: "acolhimento",
      nome: L("Dizer que está indo bem", "Tell her she is doing fine", "Decirle que va bien"),
      efeito: L("Baixa a tensão e aproxima — mas o resto do teste deixa de valer como número.", "Lowers the tension and brings you closer — but the rest of the test stops counting as a score.", "Baja la tensión y acerca, pero el resto de la prueba deja de valer como número."),
      ansiedade: -3, vinculo: 3, observacao: 0, minutos: 0, contamina: true },
    { id: "perguntar", icon: "💬", ap: "investigativa",
      nome: L("Perguntar o que passou pela cabeça dela ali", "Ask what went through her head just then", "Preguntar qué le pasó por la cabeza ahí"),
      efeito: L("Rende a melhor informação do teste inteiro, e custa um minuto.", "Yields the best information in the whole test, and costs a minute.", "Rinde la mejor información de toda la prueba, y cuesta un minuto."),
      ansiedade: -1, vinculo: 1, observacao: 2, minutos: 1 }
  ];

  // o que ela responde quando você pergunta: depende de COMO ela erra, não de sorte
  const PORQUE = {
    memoria: L("\u201cEu tava repetindo na cabeça e no meio sumiu. Aí eu fiquei atrás do que sumiu e perdi o resto.\u201d", "\u201cI was repeating it in my head and in the middle it vanished. Then I went after what vanished and lost the rest.\u201d", "\u201cLo repetía en la cabeza y en medio desapareció. Y me quedé buscando lo que desapareció y perdí el resto.\u201d"),
    atencao: L("\u201cEu vi que era pra parar. A minha mão foi antes de mim.\u201d", "\u201cI saw it meant stop. My hand went before I did.\u201d", "\u201cVi que era para parar. Mi mano fue antes que yo.\u201d"),
    executivas: L("\u201cA palavra é mais rápida que a cor. Eu sei que tá escrito outra coisa, mas sai a palavra.\u201d", "\u201cThe word is faster than the colour. I know it says something else, but the word comes out.\u201d", "\u201cLa palabra es más rápida que el color. Sé que dice otra cosa, pero sale la palabra.\u201d"),
    qi: L("\u201cEu olhei e pensei: essa eu não vou conseguir. Aí nem tentei direito.\u201d", "\u201cI looked at it and thought: this one I won't manage. So I didn't really try.\u201d", "\u201cLo miré y pensé: esta no la voy a poder. Y ni lo intenté bien.\u201d"),
    emocoes: L("\u201cQuando eu não tenho certeza eu falo neutro. É o que erra menos.\u201d", "\u201cWhen I'm not sure I say neutral. It's what gets it wrong least.\u201d", "\u201cCuando no estoy segura digo neutro. Es lo que falla menos.\u201d")
  };

  // gerador previsível: a mesma pessoa na mesma bateria vê a mesma sessão ao recarregar
  function semente(txt) { let h = 2166136261; for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function sorteio(s) { let x = s || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

  let atual = null;

  const body = () => $("psico-body");
  function cabecalho(titulo, texto) {
    $("psico-title").textContent = titulo;
    body().textContent = "";
    if (texto) body().appendChild(el("p", "shop-note", texto));
  }

  // ---- 1) escolher como apresentar
  function abrir(k, b, aoTerminar) {
    const T = TAREFAS[b];
    if (!T) return aoTerminar && aoTerminar(null);
    atual = { k, b, aoTerminar };
    cabecalho(`🧪 ${pick(T.nome)}`, tr("Antes de aplicar: como você apresenta a tarefa? O jeito muda o que você vai ver.", "Before applying: how do you present the task? The way you do it changes what you will see.", "Antes de aplicar: ¿cómo presentas la tarea? La forma cambia lo que vas a ver."));
    MODOS.forEach((m) => {
      const btn = el("button", "choice-btn", "");
      btn.type = "button";
      btn.appendChild(el("b", null, `${m.icon} ${pick(m.nome)}`));
      btn.appendChild(el("small", "dx-hint", pick(m.efeito)));
      btn.addEventListener("click", () => escolher(m));
      body().appendChild(btn);
    });
    openModal("psico-modal");
  }

  // ---- 2) a PESSOA escolhe por onde entrar, e a escolha já é observação
  // Quem aplica teste sabe: metade do que se aprende aparece antes do primeiro item. A escolha dela
  // depende de como ela vai nesta bateria (o z do caso) e de quanto a sua apresentação a deixou tensa.
  function escolher(modo) {
    const { k, b } = atual;
    atual.modo = modo;
    session.modosUsados = session.modosUsados || {};
    const primeiraVez = !session.modosUsados[modo.id];
    session.modosUsados[modo.id] = true;
    if (primeiraVez) {
      if (modo.vinculo) state.affinity = clamp(state.affinity + modo.vinculo, 0, 100);
      if (modo.observacao && typeof Wheel !== "undefined") Wheel.gain("observacao", modo.observacao);
    }

    const E = ESCOLHAS[b];
    if (!E) return assistir();
    const z = ((Dx.kase(k) || {}).testes || {})[b] ? Dx.kase(k).testes[b].z : 0;
    const r = sorteio(semente(`${k}|${b}|escolha|${state.week || 1}`));
    // quem vai mal nesta área tende a desviar da porta difícil; quem vai bem tende a pegá-la. A
    // apresentação tensa empurra para a porta fácil. Não é sorteio puro: é a pessoa aparecendo.
    const peso = (o) => Math.max(0.05, 1 + o.facil * (-z * 0.9 + modo.ansiedade * 0.35) + r() * 0.5);
    const escolhida = E.opcoes.slice().sort((a, b2) => peso(b2) - peso(a))[0];
    atual.escolha = escolhida;

    if (typeof Tips !== "undefined") Tips.fire("escolhadela");
    cabecalho(`💬 ${pick(CASES[k].name)}`, tr("Você oferece as duas portas. Repare por qual ela entra: a escolha diz o que nenhuma pontuação diz.", "You offer both doors. Watch which one she goes through: the choice says what no score says.", "Ofreces las dos puertas. Fíjate por cuál entra: la elección dice lo que ninguna puntuación dice."));
    const q = el("div", "tst-pergunta");
    q.appendChild(el("b", null, `🗣️ ${pick(E.pergunta)}`));
    body().appendChild(q);
    const lista = el("div", "tst-portas");
    E.opcoes.forEach((o) => {
      const d = el("div", "tst-porta" + (o.id === escolhida.id ? " sel" : ""), pick(o.nome));
      lista.appendChild(d);
    });
    body().appendChild(lista);
    const fala = el("div", "tst-fala");
    fala.appendChild(el("p", null, `\u201c${pick(escolhida.fala)}\u201d`));
    body().appendChild(fala);
    const bt = el("button", "continue-btn", tr("Anotar e começar", "Note it and begin", "Anotar y empezar"));
    bt.type = "button";
    bt.addEventListener("click", () => assistir());
    body().appendChild(bt);
    if (typeof Wheel !== "undefined") Wheel.gain("observacao", 1);
  }

  // ---- 3) assistir a pessoa fazendo
  function assistir() {
    const { k, b, modo } = atual;
    const T = TAREFAS[b];

    // desempenho esperado: o z do caso, piorado pela ansiedade de como a tarefa foi apresentada e
    // pela porta que ELA escolheu — a porta difícil derruba a chance, a fácil segura
    const z = ((Dx.kase(k) || {}).testes || {})[b] ? Dx.kase(k).testes[b].z : 0;
    let ansiedade = modo.ansiedade;
    const facil = atual.escolha ? atual.escolha.facil : 0;
    const chanceDe = () => Math.max(0.15, Math.min(0.95, 0.62 + z * 0.22 - ansiedade * 0.05 + facil * 0.07));
    let chance = chanceDe();
    const r = sorteio(semente(`${k}|${b}|${modo.id}|${state.week || 1}`));

    cabecalho(`${TAREFAS[b].nome ? pick(TAREFAS[b].nome) : ""} — ${pick(CASES[k].name)}`, pick(modo.efeito));
    const palco = el("div", "tst-palco");
    const estimuloEl = el("div", "tst-estimulo", "…");
    const respostaEl = el("div", "tst-resposta", "");
    const linha = el("div", "tst-itens");
    palco.appendChild(estimuloEl); palco.appendChild(respostaEl); palco.appendChild(linha);
    body().appendChild(palco);

    const pular = el("button", "link-btn", tr("Pular e ver o resultado", "Skip and see the result", "Saltar y ver el resultado"));
    pular.type = "button";
    body().appendChild(pular);

    const N = 5, itens = [];
    let i = 0, timers = [], reagiu = false;
    const limpar = () => { timers.forEach(clearTimeout); timers = []; };
    const depois = (fn, ms) => { const id = setTimeout(fn, settings.reducedMotion ? 0 : ms); timers.push(id); };

    function proximo() {
      if (i >= N) return fim();
      const est = T.estimulo(i, r);
      const acertou = r() < chance;
      itens.push(acertou);
      estimuloEl.textContent = est;
      respostaEl.textContent = "";
      respostaEl.className = "tst-resposta";
      depois(() => {
        respostaEl.textContent = acertou ? `✔ ${T.acerto(est)}` : `✘ ${T.erro(est, r)}`;
        respostaEl.className = "tst-resposta " + (acertou ? "ok" : "err");
        const p = el("i", "tst-item " + (acertou ? "ok" : "err"));
        linha.appendChild(p);
        if (typeof sfx === "function") sfx(acertou ? "click" : "bad");
        i += 1;
        // O MOMENTO DA REAÇÃO: no primeiro tropeço a pessoa levanta os olhos. Ficar calado, acolher
        // ou perguntar não é estilo — cada um muda o que você mede e o que você fica sabendo.
        if (!acertou && !reagiu && i < N) { reagiu = true; limpar(); return depois(() => reagir(seguir), 600); }
        depois(proximo, 750);
      }, 700);
    }

    function fim() {
      limpar();
      const acertos = itens.filter(Boolean).length;
      atual.itens = itens;
      atual.acertos = acertos;
      resultado();
    }
    pular.addEventListener("click", () => { limpar(); while (itens.length < N) itens.push(r() < chance); fim(); });
    depois(proximo, 400);

    // volta da reação: o que você fez muda a ansiedade dela daqui para frente
    function seguir(reacao) {
      atual.reacao = reacao;
      if (reacao.vinculo) state.affinity = clamp(state.affinity + reacao.vinculo, 0, 100);
      if (reacao.observacao && typeof Wheel !== "undefined") Wheel.gain("observacao", reacao.observacao);
      if (reacao.id === "perguntar" && session && session.notes) session.notes.push(`${pick(CASES[k].name)}: ${pick(PORQUE[b] || PORQUE.memoria)}`);
      ansiedade += reacao.ansiedade;
      chance = chanceDe();
      atual.contaminado = Boolean(reacao.contamina);
      cabecalho(`${pick(T.nome)} — ${pick(CASES[k].name)}`, pick(modo.efeito));
      body().appendChild(palco);
      body().appendChild(pular);
      depois(proximo, 500);
    }
  }

  // ---- 4) a psicóloga reage ao tropeço
  function reagir(seguir) {
    const { k, b } = atual;
    cabecalho(`👀 ${tr("Ela errou, e olhou para você", "She got it wrong, and looked at you", "Falló, y te miró")}`, "");
    const fala = el("div", "tst-fala");
    fala.appendChild(el("p", null, `\u201c${tr("Errei, né?", "I got it wrong, didn't I?", "Fallé, ¿no?")}\u201d`));
    body().appendChild(fala);
    body().appendChild(el("p", "shop-note", tr("O que você faz agora entra no resultado. Não existe a opção neutra: até ficar em silêncio é uma escolha, e ela mede uma coisa diferente.", "What you do now goes into the result. There is no neutral option: even staying silent is a choice, and it measures something different.", "Lo que hagas ahora entra en el resultado. No existe la opción neutra: incluso callar es una elección, y mide otra cosa.")));
    REACOES.forEach((rc) => {
      const btn = el("button", "choice-btn tst-reacao", "");
      btn.type = "button";
      btn.appendChild(el("b", null, `${rc.icon} ${pick(rc.nome)}`));
      btn.appendChild(el("small", "dx-hint", pick(rc.efeito)));
      btn.addEventListener("click", () => {
        if (rc.id === "perguntar") {
          // ela responde ANTES de seguir: é a melhor frase do teste inteiro, e não pode passar batido
          cabecalho(`💬 ${pick(CASES[k].name)}`, "");
          const f2 = el("div", "tst-fala");
          f2.appendChild(el("p", null, pick(PORQUE[b] || PORQUE.memoria)));
          body().appendChild(f2);
          const ok2 = el("button", "continue-btn", tr("Anotar e continuar a tarefa", "Note it and carry on with the task", "Anotar y seguir con la tarea"));
          ok2.type = "button";
          ok2.addEventListener("click", () => seguir(rc));
          body().appendChild(ok2);
        } else seguir(rc);
      });
      body().appendChild(btn);
    });
  }

  // ---- 3) o que você observou (a nota comportamental) + o resultado formal
  function resultado() {
    const { k, b, modo, itens, acertos, aoTerminar, escolha, reacao, contaminado } = atual;
    const T = TAREFAS[b];
    const erros = itens.length - acertos;
    cabecalho(`👁️ ${tr("O que você observou", "What you observed", "Lo que observaste")}`, "");
    const cx = el("div", "dx-why" + (erros === 0 ? " ok" : ""));
    cx.appendChild(el("b", null, `${acertos}/${itens.length} ${tr("itens corretos", "items correct", "ítems correctos")}`));
    cx.appendChild(el("p", null, erros === 0
      ? tr("Fez a tarefa inteira sem tropeçar, no ritmo dela.", "Did the whole task without stumbling, at her own pace.", "Hizo toda la tarea sin tropezar, a su ritmo.")
      : `${tr("Quando erra,", "When she gets it wrong,", "Cuando falla,")} ${pick(T.comoErra)}. ${modo.id === "aplicar" ? tr("Aplicada direto, ficou mais tensa a cada item.", "Applied straight, she grew tenser with each item.", "Aplicada directo, se puso más tensa a cada ítem.") : modo.id === "explicar" ? tr("Explicar antes deixou a tarefa menos ameaçadora.", "Explaining beforehand made the task less threatening.", "Explicar antes hizo la tarea menos amenazante.") : tr("Deixada por conta, criou um jeito próprio de se organizar.", "Left to herself, she invented her own way of organising.", "Dejada a su aire, inventó su propia forma de organizarse.")}`));
    body().appendChild(cx);
    // a escolha dela e a sua reação valem tanto quanto o número, e por isso ficam escritas aqui
    if (escolha) body().appendChild(el("p", "tst-leitura", `🚪 ${tr("Na hora de escolher, ela", "When it came to choosing, she", "A la hora de elegir")} ${pick(escolha.leitura)}.`));
    if (reacao) {
      body().appendChild(el("p", "tst-leitura", `${reacao.icon} ${reacao.id === "esperar"
        ? tr("Você não disse nada, e ela se recompôs sozinha — a medida ficou limpa.", "You said nothing, and she pulled herself together on her own — the measure stayed clean.", "No dijiste nada y se recompuso sola: la medida quedó limpia.")
        : reacao.id === "acolher"
          ? tr("Você a segurou quando ela tropeçou. Daqui para frente o número vale menos como número e mais como amostra de como ela se recupera quando alguém está junto.", "You held her when she stumbled. From here on the score counts less as a score and more as a sample of how she recovers when someone is with her.", "La sostuviste cuando tropezó. De aquí en adelante el número vale menos como número y más como muestra de cómo se recupera cuando alguien está con ella.")
          : tr("Você perguntou o que passou pela cabeça dela, e ela disse. É a melhor informação do teste inteiro — já está anotada na ficha.", "You asked what went through her head, and she told you. It is the best information in the whole test — it is already in the chart.", "Preguntaste qué le pasó por la cabeza y te lo dijo. Es la mejor información de toda la prueba: ya está anotada en la ficha.")}`));
    }
    if (contaminado) body().appendChild(el("p", "tst-aviso", `⚠️ ${tr("Pontuação com ressalva: você interveio no meio da aplicação.", "Score with a caveat: you intervened in the middle of the application.", "Puntuación con salvedad: interviniste en medio de la aplicación.")}`));
    const ok = el("button", "continue-btn", tr("Anotar e ver a pontuação", "Note it and see the score", "Anotar y ver la puntuación"));
    ok.type = "button";
    ok.addEventListener("click", () => { closeModal("psico-modal"); if (aoTerminar) aoTerminar({ modo: modo.id, acertos, total: itens.length, minutos: modo.minutos + (reacao ? reacao.minutos : 0), escolha: escolha && escolha.id, reacao: reacao && reacao.id, ressalva: Boolean(contaminado) }); });
    body().appendChild(ok);
  }

  return { abrir, MODOS, TAREFAS, ESCOLHAS, REACOES, _atual: () => atual };
})();
window.Testagem = Testagem;

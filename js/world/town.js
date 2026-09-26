"use strict";

// ===========================================================================
// Cidade viva: pessoas que andam pelas ruas com rotina (pacientes, moradores e figuras especiais),
// convencer moradores a fazer terapia e a consulta de quem foi convencido.
//  · a rotina depende do horário: cada pessoa passa por um lugar ao ar livre a cada hora (ou está dentro de algum prédio)
//  · morador convencido aparece numa consulta em um dia da semana seguinte
//  · figura especial convencida transforma o consultório (tema e música)
// Estado em state.town = { convinced: {id: {week}}, tried: {id: "semana:dia"}, theme: "natal"|null }
// ===========================================================================
const Town = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const OUTDOORS = ["rua", "praca", "praia", "bairro", "rua-lojas", "rua-campus", "rua-lazer"];
  const INDOOR = ["academia", "mercado", "fastfood"];   // pacientes saudáveis vão à academia e ao mercado; os que estão mal, à lanchonete
  const world = () => window.WORLD_DATA;
  const citizens = () => (world().citizens || []);
  const cdef = (id) => citizens().find((c) => c.id === id) || (world().npcs || []).find((n) => n.id === id && n.likes);   // moradores da cidade e os do mar (com doubt/likes)

  const hash = (s) => String(s).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  // o morador não traz a marca de corpo na ficha dele: vem do nome, como no resto do jogo
  const comCorpo = (c) => (c.look && !c.look.corpo && typeof corpoPeloNome === "function"
    ? Object.assign({}, c.look, { corpo: corpoPeloNome(I18N.pick(c.name)) }) : c.look);
  const st = () => { const t = (state.town = state.town || {}); t.convinced = t.convinced || {}; t.tried = t.tried || {}; if (t.theme === undefined) t.theme = null; return t; };
  const isNight = (clock) => { const m = ((Math.round(clock) % 1440) + 1440) % 1440; return m >= 20 * 60 || m < 7 * 60; };

  const SPECIAL_ART = { papai_noel: "assets/sec-noel.png", coelho: "assets/sec-coelho.png", abobora: "assets/sec-jack.png" };   // mesma ilustração da consulta

  // aparência dos pacientes (os casos só têm retrato pronto): sorteada pelo nome, sempre a mesma
  function patientLook(id) {
    const h = hash(id), pk = (list, k) => list[(h >> k) % list.length];
    const img = CASES[id] && CASES[id].image;   // a mesma ilustração da consulta: quem é de um jeito no mapa é igual na sala
    if (img) return { img, skin: pk(SKINS, 1) };
    return { skin: pk(SKINS, 1), hairStyle: pk(["short", "long", "curly", "wavy", "ponytail", "bun"], 3), hairColor: pk(HAIR_COLORS.slice(0, 6), 5), top: pk(["shirt", "sweater", "purple", "vest", "plaid"], 7), acc: "none" };
  }

  // QUEM VOCÊ ESTÁ OLHANDO NÃO SE TELEPORTA. Os moradores trocam de rua a cada hora do jogo (o `bucket`
  // abaixo), e conversar consome minutos: se a hora virava no meio do diálogo, a pessoa com quem você
  // falava sumia da tela no instante em que você respondia — foi o que aconteceu com a Sabrina ao
  // recusar. Quem entra numa conversa fica ancorado naquele lugar por duas horas de jogo.
  function fixar(id, locId) {
    if (!id || !locId) return;
    st().fixo = { id, loc: locId, ate: (state.clock === undefined ? 0 : state.clock) + 120 };
  }
  const ancorado = (locId, clock) => { const f = st().fixo; return f && f.loc === locId && clock <= f.ate ? f.id : null; };

  // quem está em cada lugar ao ar livre neste horário
  function presentAt(locId, clock) {
    if (INDOOR.includes(locId)) return indoorPatients(locId, clock);
    if (!OUTDOORS.includes(locId) || isNight(clock)) return [];
    const bucket = Math.floor(clock / 60);
    const out = [];
    citizens().forEach((c) => {
      if (st().convinced[c.id] && !c.special) { /* morador convencido continua passeando */ }
      if (c.special) {
        if (st().convinced[c.id] || c.place !== locId || clock < 10 * 60 || clock > 18 * 60) return;
        if (!especialNaEpoca(c.id)) return;             // Papai Noel em março não quer dizer nada
        out.push({ kind: "special", id: c.id, name: c.name, look: SPECIAL_ART[c.id] ? Object.assign({}, comCorpo(c), { img: SPECIAL_ART[c.id] }) : comCorpo(c) });
        return;
      }
      if ((hash(c.id) + bucket * 5) % 7 === OUTDOORS.indexOf(locId) || ancorado(locId, clock) === c.id) out.push({ kind: "citizen", id: c.id, name: c.name, look: comCorpo(c) });
    });
    Object.keys(CASES).forEach((id) => {
      if (id.indexOf("cit:") === 0 || !CASES[id].steps) return;
      if ((hash(id) + bucket * 5) % 7 === OUTDOORS.indexOf(locId)) out.push({ kind: "patient", id, name: CASES[id].name, look: patientLook(id) });
    });
    return out;
  }

  // pacientes que já foram atendidos aparecem onde a evolução deles pede: bem = academia/mercado; mal = lanchonete
  function indoorPatients(locId, clock) {
    if (isNight(clock)) return [];
    const bucket = Math.floor(clock / 60), out = [];
    Object.keys(CASES).forEach((id) => {
      if (id.indexOf("cit:") === 0 || !CASES[id].steps) return;
      const r = (state.pat || {})[id];
      if (!r || !r.q.length) return;
      const evo = FU.evolution(id);
      const where = evo >= 65 ? ((hash(id) + bucket) % 2 ? "academia" : "mercado") : evo <= 40 ? "fastfood" : null;
      if (where === locId) out.push({ kind: "patient", id, name: CASES[id].name, look: patientLook(id) });
    });
    return out;
  }

  const badge = (w) => (w.kind === "patient" ? "🩺" : w.kind === "special" ? (st().convinced[w.id] ? "💚" : "⭐") : st().convinced[w.id] ? "💚" : "❔");

  // ------------------------------------------------------------ convencer
  const ADJ = { acolhimento: "psicodinamica", psicodinamica: "acolhimento", tcc: "comportamental", comportamental: "tcc", psicoeducacao: "diretiva", diretiva: "psicoeducacao" };
  const ARGUMENT = {
    acolhimento: L("Não precisa decidir nada agora. Só quero que saiba que teria um espaço para ser ouvido, sem julgamento.", "You don't have to decide anything now. I just want you to know there'd be a space to be heard, without judgment.", "No hace falta decidir nada ahora. Solo quiero que sepas que habría un espacio para ser escuchado, sin juicios."),
    tcc: L("Dá para testar esses pensamentos como hipóteses. Em poucas sessões você vê o que se sustenta e o que não.", "Those thoughts can be tested like hypotheses. In a few sessions you'd see what holds up and what doesn't.", "Esos pensamientos se pueden probar como hipótesis. En pocas sesiones verías qué se sostiene y qué no."),
    psicodinamica: L("Talvez isso tenha raízes mais antigas. Vale explorar com calma de onde vem.", "Maybe this has older roots. It's worth exploring calmly where it comes from.", "Quizá esto tenga raíces más antiguas. Vale la pena explorar con calma de dónde viene."),
    psicoeducacao: L("Posso explicar como a terapia funciona, o que é e o que não é. Informação tira muito medo.", "I can explain how therapy works, what it is and what it isn't. Information removes a lot of fear.", "Puedo explicar cómo funciona la terapia, qué es y qué no es. La información quita mucho miedo."),
    comportamental: L("Podemos começar com um passo pequeno e medir o que muda. Nada de teoria demais: prática.", "We could start with one small step and measure what changes. No heavy theory: practice.", "Podemos empezar con un paso pequeño y medir qué cambia. Nada de mucha teoría: práctica."),
    diretiva: L("Vou ser direta: com um plano claro e metas, os resultados aparecem. Marque uma consulta e comece.", "I'll be direct: with a clear plan and goals, results show up. Book a session and start.", "Seré directa: con un plan claro y metas, aparecen los resultados. Reserva una consulta y empieza.")
  };
  const friendOf = (id) => ((state.social || {})["w:" + id] || { friend: 0 }).friend;
  const triedToday = (id) => st().tried[id] === `${state.week || 1}:${state.dayIndex}`;
  const need = (c) => (c.diff >= 3 ? 3 : c.diff >= 2 ? 2 : 0);   // amizade mínima (conversas em dias diferentes) para aceitar

  function attempt(id, ap) {
    const c = cdef(id);
    st().tried[id] = `${state.week || 1}:${state.dayIndex}`;
    if (typeof City !== "undefined" && City.loc) fixar(id, City.loc());   // recusar não pode fazer a pessoa sumir da rua
    const match = ap === c.likes, close = ADJ[ap] === c.likes;
    const rapport = friendOf(id) >= need(c);
    let res = "no";
    if (match && rapport) res = "yes";
    else if (match && !rapport) res = "trust";                      // acertou, mas ainda não tem confiança
    else if (close && c.diff === 1) res = "yes";                    // moradores fáceis aceitam também um argumento parecido
    else if (close) res = "almost";
    if (res === "yes") convince(id);
    // A CIDADE LEMBRA das tentativas que não deram certo. Duas negativas seguidas e a pessoa passa a
    // te receber de outro jeito — não hostil, mas com a porta menos aberta.
    if (res === "no") {
      state.social = state.social || {};
      const ch = state.social[id] ? id : ("w:" + id);
      const soc = (state.social[ch] = state.social[ch] || { talks: 0, friend: 0, lastDay: -1 });
      soc.tentou = (soc.tentou || 0) + 1;
      if (soc.tentou >= 2) soc.recusou = true;
    }
    saveState();
    return res;
  }

  function convince(id) {
    const c = cdef(id);
    st().convinced[id] = { week: state.week || 1 };
    if (c.special) { st().theme = c.special; }
    if (c.aq && typeof Aquarium !== "undefined") Aquarium.add(c.aq);   // moradores da fenda dão uma criatura para o aquário
    state.xp += 8; state.coins += 10;
    injectCases();
  }

  // ------------------------------------------------------------ consulta do morador convencido
  function caseFor(id) {
    const c = cdef(id);
    if (!c) return null;
    const G = FU.generic;
    const opts = (i) => Object.fromEntries(Object.entries(G[i].opts).map(([ap, v]) => [ap, pick(v)]));
    const fit = {}; ["acolhimento", "tcc", "psicodinamica", "psicoeducacao", "comportamental", "diretiva"].forEach((ap) => { fit[ap] = ap === c.likes ? 4 : ADJ[ap] === c.likes ? 3 : 2; });
    const creatureImg = () => {   // esponja, estrela e lula: o mesmo desenho vetorial do mapa
      try { const cv = document.createElement("canvas"); cv.width = 440; cv.height = 522; const g = cv.getContext("2d"); g.translate(220, 470); g.scale(4.6, 4.6); CityArt.drawCreature(g, c.creature, 0, 0, 0); return cv.toDataURL("image/png"); } catch (e) { return null; }
    };
    // retrato "ao molde da Maria" pré-desenhado (tools/python/desenhar-personagens.py moradores); só cai no desenho
    // vetorial ao vivo se o morador não tiver retrato pronto nem for uma criatura (não deveria acontecer hoje)
    const img = (c.creature && creatureImg()) || (c.look ? `assets/moradores/morador-${id}.png` : null) ||
      (c.emoji ? "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><text x="50" y="86" font-size="76" text-anchor="middle">${c.emoji}</text></svg>`) : Retrato.url(Object.assign({}, c.look)));
    const tr = (pt, en, es) => pick(L(pt, en, es));
    return {
      name: c.name, age: tr("Adulto", "Adult", "Adulto"), image: img, parent: null, dot: "dot-blue", group: "town",
      complaint: pick(c.doubt), history: tr("Foi convencido na rua a experimentar a terapia.", "Was talked into trying therapy on the street.", "Lo convencieron en la calle de probar la terapia."),
      type: tr("Consulta de apoio", "Support session", "Consulta de apoyo"), info: tr("Morador convencido na cidade. Primeira consulta.", "Resident convinced in town. First session.", "Vecino convencido en la ciudad. Primera consulta."),
      message: { from: c.name, text: tr(`Doutora, você me convenceu na rua. Vou à consulta como combinamos. — ${c.name}`, `Doctor, you talked me into it on the street. I'll come to the session as agreed. — ${c.name}`, `Doctora, me convenció en la calle. Iré a la consulta como acordamos. — ${c.name}`) },
      fit, why: {}, town: id,
      steps: [
        { who: "patient", text: `(${c.name} chega meio desconfiado(a).) '${pick(c.doubt)}'`, note: null, mods: {}, options: opts(0) },
        { who: "patient", text: `'${tr("Não sei bem o que esperar, mas estou aqui. Por onde começamos?", "I don't quite know what to expect, but I'm here. Where do we start?", "No sé bien qué esperar, pero aquí estoy. ¿Por dónde empezamos?")}'`, note: null, mods: {}, options: opts(1) }
      ]
    };
  }

  // O KIT CLÍNICO DO MORADOR. `caseFor` monta a cara dele (nome, retrato, queixa, as duas falas de
  // abertura), mas não tem achados nem diagnóstico — sem isso não há o que investigar. O gerador do modo
  // contínuo (`Gen.build`) já sabe montar um caso inteiro: falas, achados, testes, formulação e
  // resposta. Aqui as duas coisas se juntam: o rosto e a queixa são do morador que VOCÊ convenceu na
  // rua; o material clínico vem do arquétipo que mais combina com a dúvida dele.
  const ARQ_POR_GOSTO = { acolhimento: "luto", psicodinamica: "luto", tcc: "ansiedade", comportamental: "ansiedade", psicoeducacao: "sono", diretiva: "estresse" };
  function kitDoMorador(id) {
    if (typeof Gen === "undefined" || !Gen.build || !Gen.ARCHS || !Gen.ARCHS.length) return null;
    const c = cdef(id);
    const pref = ARQ_POR_GOSTO[c && c.likes] || "";
    const a2 = Gen.ARCHS.includes(pref) ? pref : Gen.ARCHS[hash(id) % Gen.ARCHS.length];
    try { return Gen.build("cit:" + id, { a: a2, s: hash(id) }); } catch (e) { return null; }
  }
  function injectCases() {
    if (typeof CASES === "undefined") return;
    Object.keys(st().convinced).forEach((id) => {
      if (!cdef(id)) return;
      const k = caseFor(id);
      if (!k) return;
      const kit = kitDoMorador(id);
      if (kit) {
        // o rosto, o nome e a queixa continuam sendo do morador; o resto do caso vem do kit
        k.diagnosis = kit.c.diagnosis;
        k.voice = kit.c.voice;
        k.steps = k.steps.concat(kit.c.steps.slice(0, 2));   // as duas falas dele + as do arquétipo: quatro consultas têm o que dizer
        k.fit = kit.c.fit || k.fit;
        if (typeof DX_DATA !== "undefined" && DX_DATA.cases && kit.dx) DX_DATA.cases["cit:" + id] = kit.dx;
      }
      CASES["cit:" + id] = k;
    });
  }

  // horários extras da semana: cada convinced vem em um dia da semana seguinte à conversa
  // QUEM VOCÊ CONVENCEU FAZ O CICLO INTEIRO. Antes o morador convencido virava UMA "consulta de apoio"
  // avulsa na semana seguinte e sumia: sem investigação, sem ficha, sem diagnóstico, sem devolutiva.
  // Agora ele entra como paciente de verdade, a partir da SEMANA 5 (depois do ciclo dos 15 primeiros),
  // e faz o mesmo percurso: duas semanas, duas consultas por semana. No fim da última, passado um
  // tempo, ele manda mensagem dizendo se quer seguir em terapia — ou se não quer, o que também é
  // resultado, e depende de como o ciclo correu.
  const SEMANA_INICIAL = 5;          // os convencidos só entram depois do ciclo dos 15 primeiros
  const CONSULTAS = 4;               // 2 semanas × 2 consultas, igual aos 15
  // em que semana ABSOLUTA cada convencido começa: um de cada vez, na ordem em que foram convencidos
  function agendaDosConvencidos() {
    const l = Object.entries(st().convinced)
      .filter(([id]) => cdef(id))
      .sort((a2, b2) => (a2[1].week || 0) - (b2[1].week || 0) || a2[0].localeCompare(b2[0]));
    const out = {};
    l.forEach(([id, v], i) => {
      const cedo = Math.max(SEMANA_INICIAL, (v.week || 1) + 1);
      out[id] = { inicio: cedo + i * 2, def: v };      // cada um ocupa duas semanas; o seguinte espera a vez
    });
    return out;
  }
  // ------------------------------------------------------------------ o arco de três encontros
  // Cada morador tinha uma lista de falas que girava em círculo: conversar dez vezes era conversar a
  // primeira vez dez vezes. Agora cada um tem TRÊS encontros com forma psicológica — a fachada, o que
  // está por baixo dela, e um pedido concreto. Não é enredo: é o que acontece quando alguém volta.
  //  1º  a fachada: o que a pessoa diz a qualquer um;
  //  2º  por baixo: só aparece se você voltou noutro dia, porque é disso que se trata;
  //  3º  o pedido: pequeno, concreto e conferível — e cumprir muda a fala dela para sempre.
  const ARCO = {
    fachada: L("(a conversa de sempre, do jeito que ela conta para qualquer um)",
               "(the usual conversation, the way she tells anyone)",
               "(la charla de siempre, como se la cuenta a cualquiera)"),
    porBaixo: L("Você voltou. Sabe, quase ninguém volta. Eu vou te contar uma coisa que eu não conto assim de primeira…",
                "You came back. You know, almost nobody comes back. I'll tell you something I don't tell straight away…",
                "Volviste. ¿Sabes? Casi nadie vuelve. Te voy a contar algo que no cuento así de primeras…"),
    fechado: L("Depois daquilo que você fez por mim, você entrou para a minha lista curta de gente boa.",
               "After what you did for me, you joined my short list of good people.",
               "Después de lo que hiciste por mí, entraste en mi lista corta de buena gente.")
  };
  // pedidos conferíveis contra o que o jogo já guarda — nada de tarefa que o jogo não saiba conferir
  const PEDIDOS = [
    { id: "amizade", emoji: "🤝",
      txt: L("Faz uma amizade de verdade aqui na cidade. Uma só. Depois me conta como foi.", "Make one real friend here in town. Just one. Then tell me how it went.", "Haz una amistad de verdad aquí en la ciudad. Una sola. Luego me cuentas cómo fue."),
      feito: () => Boolean((state.ach || {}).amiga) || Object.values(state.social || {}).some((x) => (x.friend || 0) >= 3) },
    { id: "peixe", emoji: "🐟",
      txt: L("Me diz o nome de um peixe do aquário da cidade. Eu nunca sei, e queria saber.", "Tell me the name of a fish in the town aquarium. I never know, and I'd like to.", "Dime el nombre de un pez del acuario de la ciudad. Nunca lo sé y me gustaría."),
      feito: () => (typeof Aquarium !== "undefined" && Aquarium.owned ? Aquarium.owned().length > 0 : false) },
    { id: "jogo", emoji: "🧩",
      txt: L("Vai lá na Ludoteca e joga um daqueles jogos. Depois me conta se é difícil mesmo.", "Go to the Mind Playroom and play one of those games. Then tell me if it really is hard.", "Ve a la Ludoteca y juega uno de esos juegos. Luego me cuentas si de verdad es difícil."),
      feito: () => Object.keys((state.mg || {}).best || {}).length > 0 },
    { id: "gente", emoji: "💬",
      txt: L("Conversa com mais gente por aí. A cidade tem gente boa e ninguém pergunta nada a ninguém.", "Talk to more people around town. There's good people here and nobody asks anybody anything.", "Habla con más gente por aquí. Hay buena gente y nadie le pregunta nada a nadie."),
      feito: () => Object.keys(state.social || {}).length >= 5 },
    { id: "oficina", emoji: "🩺",
      txt: L("Você faz aquelas oficinas lá no CAPsi? Faz uma e me conta. Eu queria ter estudado.", "Do you do those workshops at the CAPsi? Do one and tell me about it. I wish I'd studied.", "¿Haces esos talleres en el CAPsi? Haz uno y cuéntame. Yo quería haber estudiado."),
      feito: () => Object.keys((state.mg || {}).best || {}).some((id) => String(id).startsWith("c-")) }
  ];
  const arcos = () => (state.arcos = state.arcos || {});
  const pedidoDe = (id) => PEDIDOS[hash(id) % PEDIDOS.length];
  // em que ponto do arco está esta pessoa: 0 fachada, 1 por baixo, 2 pedido feito, 3 fechado
  function passoDoArco(id) {
    const a = arcos()[id];
    if (a && a.feito) return 3;
    const soc = (state.social || {})[id] || (state.social || {})["w:" + id] || {};
    if (a && a.pediu) return 2;
    return (soc.talks || 0) >= 2 ? 1 : 0;
  }
  // chamado quando a conversa abre: devolve o que dizer agora e move o arco adiante
  function arcoDe(id) {
    const a = (arcos()[id] = arcos()[id] || { pediu: false, feito: false });
    const ped = pedidoDe(id);
    const passo = passoDoArco(id);
    if (passo === 3) return { passo, txt: ARCO.fechado };
    if (passo === 2) {
      if (ped.feito()) {
        a.feito = true;
        state.coins += 12; state.xp += 6;
        if (typeof Wheel !== "undefined") Wheel.gain("anamnese", 1);
        saveState();
        return { passo: 3, fechouAgora: true, txt: ARCO.fechado, premio: { coins: 12, xp: 6 } };
      }
      return { passo, txt: ped.txt, pedido: ped, pendente: true };
    }
    if (passo === 1) {
      a.pediu = true;
      saveState();
      return { passo, txt: ARCO.porBaixo, seguinte: ped };
    }
    return { passo, txt: null };
  }

  // ------------------------------------------------------------------ a cidade lembra
  // O morador repetia a fala seguinte da lista, sem saber nada do que você fez com ele nem com a
  // cidade. Mas uma cidade pequena é feita disso: quem você convenceu conta para os outros, quem
  // você dispensou não esquece, e quem viu o seu nome no jornal fala do seu nome. A memória não
  // inventa fala nova — ela ABRE a fala com uma linha que só existe porque aquilo aconteceu.
  const MEM = L(
    "(a cidade é pequena, e as notícias correm)",
    "(it is a small town, and news travels)",
    "(el pueblo es pequeño y las noticias corren)");
  const LEMBRANCAS = {
    convencido: L("Olha ela aí. Eu comecei aquilo que a senhora falou, sabe? Não é fácil, mas eu tô indo.",
                  "There she is. I started that thing you talked about, you know? It isn't easy, but I'm going.",
                  "Ahí está. Empecé aquello de lo que me habló, ¿sabe? No es fácil, pero voy."),
    recusado: L("A senhora de novo. Eu já falei que não quero, né? Mas bom dia.",
                "You again. I already said I don't want to, didn't I? But good morning.",
                "Usted otra vez. Ya dije que no quiero, ¿no? Pero buenos días."),
    vizinho: L("A senhora atendeu o pessoal aqui do lado. Eles falaram bem. Numa cidade deste tamanho isso corre rápido.",
               "You saw the folks next door. They spoke well of you. In a town this size that travels fast.",
               "Atendió a los del lado. Hablaron bien. En un pueblo así eso corre rápido."),
    erro: L("Ouvi dizer que teve um caso que não deu certo. Não é da minha conta. Só achei que a senhora ia querer saber que comentaram.",
            "I heard there was a case that didn't go well. None of my business. I just thought you'd want to know people talked.",
            "Oí que hubo un caso que no salió bien. No es asunto mío. Solo pensé que querría saber que se comentó."),
    velhoConhecido: L("Já perdi a conta das vezes que a gente conversou. A senhora sempre pergunta, nunca só passa.",
                      "I've lost count of how many times we've talked. You always ask, you never just walk past.",
                      "Ya perdí la cuenta de las veces que hablamos. Usted siempre pregunta, nunca solo pasa.")
  };
  function lembrancaDe(id) {
    const s2 = st(), soc = (state.social || {})[id] || (state.social || {})["w:" + id] || {};
    if (s2.convinced[id]) return LEMBRANCAS.convencido;
    if (soc.recusou) return LEMBRANCAS.recusado;
    if ((soc.talks || 0) >= 6) return LEMBRANCAS.velhoConhecido;
    // o que a cidade viu do seu trabalho: quantos casos fechados certo e quantos errados
    let certos = 0, errados = 0;
    Object.keys(state.pat || {}).forEach((pid) => {
      const r = (state.pat || {})[pid];
      const c = CASES[pid];
      if (!r || !r.dx || !c || !c.diagnosis) return;
      if (r.dx === c.diagnosis.answer) certos++; else errados++;
    });
    if (errados >= 2 && errados > certos) return LEMBRANCAS.erro;
    if (certos >= 2) return LEMBRANCAS.vizinho;
    return null;
  }

  function extraSlots(week) {
    const out = [], ag = agendaDosConvencidos();
    Object.entries(ag).forEach(([id, a2]) => {
      const rel = week - a2.inicio;                    // 0 e 1: as duas semanas do ciclo dele
      if (rel !== 0 && rel !== 1) return;
      const base = rel * 2;                            // consultas 1 e 2 na primeira semana, 3 e 4 na segunda
      const d0 = hash(id) % 5, d1 = (d0 + 2) % 5;
      out.push({ id, day: d0, sess: base + 1 });
      out.push({ id, day: d1, sess: base + 2 });
    });
    return out;
  }
  // terminou a 4ª consulta? então, passado um tempo, ele escreve dizendo se quer seguir
  function fechouCiclo(id) {
    const r = (state.pat || {})["cit:" + id];
    return Boolean(r && r.q && r.q.length >= CONSULTAS);
  }

  // ------------------------------------------------------------ as estações do ano
  // O jogo tinha figuras de feriado (Papai Noel, Coelho, Abóbora, Fada do Dente, Sandman, João da Neve)
  // e NENHUM calendário: todas andavam pela cidade o ano inteiro, e um Papai Noel em março não quer
  // dizer nada. Aqui as semanas viram estações, e cada figura só aparece na época dela. A cidade muda
  // de cor junto, porque é a estação que dá o clima do lugar.
  //
  // Um ano do jogo tem 12 semanas (três por estação), começando no verão do hemisfério sul — o jogo se
  // passa no Brasil, então dezembro é verão e a Páscoa cai no outono.
  const SEMANAS_POR_ESTACAO = 3;
  const ESTACOES = [
    { id: "verao", emoji: "☀️", nome: L("Verão", "Summer", "Verano"), ceu: "#bfe6ff", chao: "#e9e2c4", folha: "#5fa83f", festa: null },
    { id: "outono", emoji: "🍂", nome: L("Outono", "Autumn", "Otoño"), ceu: "#f2dfc0", chao: "#e3d6b8", folha: "#c47a2b", festa: "pascoa" },
    { id: "inverno", emoji: "❄️", nome: L("Inverno", "Winter", "Invierno"), ceu: "#d8e4ee", chao: "#dfe3e6", folha: "#7c8d74", festa: "halloween" },
    { id: "primavera", emoji: "🌸", nome: L("Primavera", "Spring", "Primavera"), ceu: "#dff0d8", chao: "#e6e6cf", folha: "#79c14a", festa: "natal" }
  ];
  const semanaAbsoluta = () => Math.max(1, state.week || 1);
  const estacaoIdx = () => Math.floor((semanaAbsoluta() - 1) / SEMANAS_POR_ESTACAO) % ESTACOES.length;
  const estacao = () => ESTACOES[estacaoIdx()];
  // a semana dentro da estação (1 a 3): a festa cai na ÚLTIMA, para haver expectativa
  const semanaDaEstacao = () => ((semanaAbsoluta() - 1) % SEMANAS_POR_ESTACAO) + 1;
  const ehSemanaDeFesta = () => semanaDaEstacao() === SEMANAS_POR_ESTACAO && Boolean(estacao().festa);
  // a figura daquele feriado só aparece na semana da festa da estação dela
  const figuraDaEpoca = () => (ehSemanaDeFesta() ? estacao().festa : null);
  function especialNaEpoca(id) {
    const c = cdef(id);
    if (!c || !c.special) return true;                 // não é figura de feriado: sem época
    if (settings && settings.dev && settings.unlockAll) return true;
    return c.special === figuraDaEpoca();
  }

  const themeNow = () => st().theme;

  return { INDOOR, OUTDOORS, citizens, cdef, st, presentAt, badge, fixar, patientLook, ARGUMENT, attempt, friendOf, need, triedToday, convince, caseFor, injectCases, extraSlots, themeNow, hash, lembrancaDe, MEM, LEMBRANCAS, arcoDe, passoDoArco, pedidoDe, PEDIDOS, ARCO,
           SEMANA_INICIAL, CONSULTAS, agendaDosConvencidos, fechouCiclo,
           ESTACOES, SEMANAS_POR_ESTACAO, estacao, estacaoIdx, semanaDaEstacao, ehSemanaDeFesta, figuraDaEpoca, especialNaEpoca };
})();

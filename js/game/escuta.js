"use strict";

// ===========================================================================
// Escuta ativa: as palavras que puxam assunto.
//
// A consulta de avaliação virou investigação (4.12), mas perguntar ainda era escolher num menu de
// 12 áreas. Aqui a fala do paciente ganha palavras grifadas: clicar em "invisível", "bebo" ou
// "não durmo" abre a pergunta daquela área. É a diferença entre ler o que a pessoa disse e ESCUTAR.
//
// O mapa é por PALAVRA, não por passo: serve para os 15 casos e para os casos gerados, sem escrever
// nada caso a caso. Só grifa o que ainda dá para perguntar (área não investigada e pergunta sobrando).
// ===========================================================================
const Escuta = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));

  // Palavras que denunciam cada área. Uma palavra só aponta para UMA área (a primeira que casar),
  // para não grifar a frase inteira. Escrito em pt e en; os outros idiomas simplesmente não grifam.
  const GATILHOS = {
    risco:      { pt: ["me machucar", "me cortar", "desaparecer", "sumir de vez", "não estar mais aqui", "acabar com tudo", "me matar"], en: ["hurt myself", "disappear", "end it all", "not be here"] },
    subst:      { pt: ["bebo", "bebid", "beber", "bebendo", "álcool", "remédio", "droga", "fumo"], en: ["drink", "drinking", "alcohol", "pills", "drugs", "smoke"] },
    sono:       { pt: ["não durmo", "dormir", "sono", "insônia", "acordo", "acordando", "cansad", "exaust", "sem dormir"], en: ["sleep", "insomnia", "wake up", "exhausted", "tired"] },
    humor:      { pt: ["vazi", "sem vontade", "trist", "desanimad", "humor", "prazer", "nada me anima", "sem graça"], en: ["empty", "sad", "no will", "mood", "pleasure", "no point"] },
    ansiedade:  { pt: ["medo", "pavor", "ansied", "ansios", "preocupad", "pânico", "aflit", "nervos", "angústia", "angustiad"], en: ["afraid", "fear", "anxiety", "anxious", "worried", "panic"] },
    pensamento: { pt: ["não sei quem eu sou", "penso demais", "pensament", "me acho", "obsess", "vozes", "ouço", "ridícul"], en: ["who i am", "overthink", "thoughts", "obsession", "voices"] },
    trauma:     { pt: ["aconteceu", "quando eu era criança", "na infância", "me marcou", "abuso", "acidente", "perdi"], en: ["happened", "as a child", "childhood", "abuse", "accident", "lost"] },
    social:     { pt: ["abandon", "sozinh", "relacionament", "relaç", "namorad", "amigos", "amiga", "invisív", "rejeitad", "me deixar", "me deixassem", "irem embora", "todo mundo"], en: ["abandon", "alone", "lonely", "relationship", "boyfriend", "girlfriend", "friends", "invisible", "reject", "leave me", "everyone"] },
    familia:    { pt: ["minha mãe", "meu pai", "meus pais", "minha família", "em casa", "irmã", "irmão", "meu filho", "minha filha"], en: ["my mother", "my father", "my parents", "my family", "at home", "sister", "brother"] },
    func:       { pt: ["no trabalho", "na escola", "na faculdade", "emprego", "notas", "não consigo me concentrar", "rendimento", "estragando", "professor", "bilhete", "recreio", "matemática", "na aula", "de aula", "na cadeira", "não presta atenção", "dever de casa", "lição", "estojo"], en: ["at work", "at school", "job", "grades", "can't concentrate", "ruining", "teacher", "note from school", "recess", "maths", "in class", "in his seat", "homework"] },
    corpo:      { pt: ["dor de barriga", "dor no peito", "coração", "falta de ar", "apetite", "emagreci", "engordei", "no corpo", "barulh", "cheiro", "luz forte", "a mão treme", "suor"], en: ["stomach ache", "chest", "heart", "short of breath", "appetite", "noise", "noisy", "smell", "bright light"] },
    inicio:     { pt: ["desde a adolescência", "desde criança", "faz uns", "começou", "há uns", "sempre foi assim"], en: ["since i was", "it started", "about a year", "always been"] },
  };

  const lang = () => I18N.lang || "pt";   // I18N.lang é propriedade, não função
  const listaDe = (dom) => (GATILHOS[dom] || {})[lang() === "en" ? "en" : "pt"] || [];

  // acha, no texto, o 1º trecho de cada área ainda investigável. Devolve marcações que não se cruzam.
  function marcar(texto, disponiveis) {
    const baixo = texto.toLowerCase();
    const achados = [];
    disponiveis.forEach((dom) => {
      let melhor = null;
      listaDe(dom).forEach((palavra) => {
        const i = baixo.indexOf(palavra.toLowerCase());
        if (i >= 0 && (!melhor || i < melhor.i)) melhor = { i, len: palavra.length };
      });
      // a lista guarda o radical ("abandon"); a marcação se estende até o fim da palavra para
      // grifar "abandonar" inteiro, e não "abandon" com um "ar" solto do lado
      if (melhor) { let fim = melhor.i + melhor.len; while (fim < texto.length && /[\p{L}]/u.test(texto[fim])) fim += 1; achados.push({ dom, i: melhor.i, fim }); }
    });
    achados.sort((a, b) => a.i - b.i);
    const limpos = [];
    achados.forEach((m) => { if (!limpos.length || m.i >= limpos[limpos.length - 1].fim) limpos.push(m); });
    return limpos;
  }

  // pinta o balão de fala com as palavras clicáveis
  // acende a palavra que carrega o pico emocional: é o sinal de que há um instante a responder
  function acenderPico(alvo, texto) {
    const p = pico(texto);
    if (!p || !p.alvo) return;
    if (window.Sound && Sound.tension) Sound.tension(true);   // a música fica em suspenso enquanto o instante está aberto
    const re = new RegExp(`(\\b${p.alvo}\\w*)`, "i");
    [...alvo.childNodes].forEach((no) => {
      if (no.nodeType !== 3 || !re.test(no.nodeValue)) return;
      const m = no.nodeValue.match(re);
      const antes = no.nodeValue.slice(0, m.index), depois = no.nodeValue.slice(m.index + m[0].length);
      const marca = document.createElement("span");
      marca.className = "fala-pico";
      marca.textContent = m[0];
      const pai = no.parentNode;
      pai.insertBefore(document.createTextNode(antes), no);
      pai.insertBefore(marca, no);
      pai.insertBefore(document.createTextNode(depois), no);
      pai.removeChild(no);
    });
  }

  function pintar(alvo, texto, aoEscolher) {
    alvo.textContent = "";
    const disp = disponiveis();
    const marcas = disp.length ? marcar(texto, disp) : [];
    if (!marcas.length) { alvo.textContent = texto; return 0; }
    let pos = 0;
    marcas.forEach((m) => {
      if (m.i > pos) alvo.appendChild(document.createTextNode(texto.slice(pos, m.i)));
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fala-gatilho";
      b.textContent = texto.slice(m.i, m.fim);
      const d = Dx.dom(m.dom);
      b.title = `${(d || {}).icon || "🔎"} ${pick((d || { name: m.dom }).name)}`;
      b.setAttribute("aria-label", `${b.textContent} — ${tr("perguntar sobre", "ask about", "preguntar sobre")} ${pick((d || { name: m.dom }).name)}`);
      b.addEventListener("click", (e) => { e.stopPropagation(); aoEscolher(m.dom); });
      alvo.appendChild(b);
      pos = m.fim;
    });
    if (pos < texto.length) alvo.appendChild(document.createTextNode(texto.slice(pos)));
    return marcas.length;
  }

  // áreas que ainda dá para perguntar neste paciente e nesta consulta
  function disponiveis() {
    if (typeof Dx === "undefined" || !Dx.active() || !Dx.introduced()) return [];
    if (!Dx.asksLeft() || Dx.budgetLeft() < 6) return [];
    const k = Dx.cur(); if (!k) return [];
    const livro = Dx.book(k);
    return Object.keys(GATILHOS).filter((d) => Dx.dom(d) && !livro.found[d]);
  }

  // ---------------------------------------------------------------- intuição clínica (voz da Roda)
  // Os 8 eixos já existem e sobem com a prática; o que faltava era eles TEREM VOZ. Quando o eixo está
  // alto o bastante, a psicóloga pensa alto: um balãozinho cinza que lê a cena por você — mas nunca
  // entrega a resposta, só aponta para onde olhar.
  const NIVEL_MIN = 3;

  function intuicao(texto) {
    if (typeof Wheel === "undefined" || typeof Dx === "undefined" || !Dx.active()) return null;
    const k = Dx.cur(); if (!k) return null;
    const livro = Dx.book(k);
    const achados = Object.keys(livro.found || {}).length;

    // 👁️ Observação: a fala traz uma marca de corpo entre parênteses — o não verbal que o texto guarda
    // No divã você não vê a cara dela: o canal não verbal simplesmente não existe nesta sessão.
    // Esse é o preço do que o divã abre — e é o preço de verdade, não um aviso na tela.
    const naoVerbal = (session && session.diva) ? null : (texto.match(/\(([^)]{6,90})\)/) || [])[1];
    if (naoVerbal && Wheel.level("observacao") >= NIVEL_MIN) {
      return { eixo: "observacao", icone: "👁️", nome: pick(eixoNome("observacao")), nivel: Wheel.level("observacao"),
        texto: tr(`"${naoVerbal}" — isso não é detalhe de cena: é o corpo dizendo o que a frase ainda não diz.`,
                  `"${naoVerbal}" — that is not scenery: it is the body saying what the sentence has not said yet.`,
                  `"${naoVerbal}" — eso no es decorado: es el cuerpo diciendo lo que la frase aún no dice.`) };
    }

    // 🤝 Anamnese: dá para entrar numa área delicada agora, ou o vínculo ainda não aguenta?
    if (Wheel.level("anamnese") >= NIVEL_MIN) {
      const delicada = (Dx.data().domains || []).find((d) => d.sensitive && !livro.found[d.id]);
      if (delicada) {
        const porta = Math.round(45 * Wheel.defense());
        const pode = state.affinity >= porta;
        return { eixo: "anamnese", icone: "🤝", nome: pick(eixoNome("anamnese")), nivel: Wheel.level("anamnese"),
          texto: pode
            ? tr(`O vínculo está firme o bastante para tocar em "${pick(delicada.name)}" agora.`,
                 `The bond is solid enough to touch on "${pick(delicada.name)}" now.`,
                 `El vínculo está firme para tocar "${pick(delicada.name)}" ahora.`)
            : tr(`Ainda não. Perguntar de "${pick(delicada.name)}" com este vínculo faria a pessoa se fechar.`,
                 `Not yet. Asking about "${pick(delicada.name)}" with this much bond would make them shut down.`,
                 `Todavía no. Preguntar por "${pick(delicada.name)}" con este vínculo haría que se cierre.`) };
      }
    }

    // 🧩 Raciocínio: já há material suficiente para um padrão começar a aparecer
    if (achados >= 3 && Wheel.level("raciocinio") >= NIVEL_MIN) {
      return { eixo: "raciocinio", icone: "🧩", nome: pick(eixoNome("raciocinio")), nivel: Wheel.level("raciocinio"),
        texto: tr(`${achados} áreas já respondidas. Dá para começar a ligar os pontos na ficha — e ver o que ainda não fecha.`,
                  `${achados} areas answered already. You can start connecting the dots in the chart — and see what still does not add up.`,
                  `${achados} áreas ya respondidas. Puedes empezar a unir los puntos en la ficha y ver qué aún no cierra.`) };
    }
    return null;
  }

  // pensamento posto na mesma caixa da intuição, mas vindo de uma AÇÃO sua (habilidades da Roda, 7.4):
  // aqui não há dúvida sobre de quem é a voz — você pediu para pensar, e é o seu raciocínio que aparece
  function pensar(texto, titulo) {
    const cx = document.getElementById("intuicao");
    if (!cx || !texto) return;
    cx.textContent = "";
    const cab = document.createElement("b");
    cab.textContent = titulo || `🧠 ${tr("O seu raciocínio", "Your reasoning", "Tu razonamiento")}`;
    cx.appendChild(cab);
    String(texto).split("\n").forEach((linha) => { const p = document.createElement("p"); p.textContent = linha; cx.appendChild(p); });
    cx.classList.remove("hidden");
  }

  const eixoNome = (id) => { const a = (Wheel.AXES || []).find((x) => x.id === id); return a ? a.name : id; };

  // desenha (ou tira) o balãozinho da intuição
  function mostrarIntuicao(texto) {
    const cx = document.getElementById("intuicao");
    if (!cx) return;
    // A contratransferência ocupa o mesmo lugar da intuição e tem a mesma cara: é assim que ela
    // chega de verdade. O que diferencia está no conteúdo — a intuição fala do paciente e traz o
    // nome de um eixo com nível; a reação fala de você. Aprender a ler isso é a mecânica.
    const c = contratransferencia();
    if (c) {
      cx.textContent = "";
      const cab = document.createElement("b");
      cab.textContent = `${c.icone} ${pick(c.nome)}`;
      cx.appendChild(cab);
      const p2 = document.createElement("p");
      p2.textContent = pick(c.texto);
      cx.appendChild(p2);
      cx.classList.remove("hidden");
      return;
    }
    const i = intuicao(texto || "");
    if (!i) { cx.classList.add("hidden"); cx.textContent = ""; return; }
    cx.textContent = "";
    const cab = document.createElement("b");
    cab.textContent = `${i.icone} ${i.nome} (${tr("nível", "level", "nivel")} ${i.nivel})`;
    cx.appendChild(cab);
    const p = document.createElement("p");
    p.textContent = i.texto;
    cx.appendChild(p);
    cx.classList.remove("hidden");
  }

  // ---------------------------------------------------------------- notar o corpo (incongruência afetiva)
  // As falas já trazem marcas de corpo entre parênteses ("(braços cruzados)", "(olhos marejados)").
  // Nomear o que se vê, com cuidado, é intervenção clínica: acolhe sem acusar e abre porta. Custa tempo
  // de sessão, então compete com uma pergunta — é uma escolha, não um botão grátis.
  const CUSTO_CORPO = 4;
  // Nomear o não verbal é uma intervenção, não um botão de moer pontos: a cada fala com gesto dava para
  // usar de novo, e a consulta virava uma fila de "reparei que…". Duas por consulta é o que cabe sem a
  // pessoa se sentir vigiada — e obriga a escolher QUAL gesto vale a pena nomear.
  const LIMITE_CORPO = 2;
  const corposNotados = () => Object.keys((session && session.corpoVisto) || {}).length;
  const corposRestantes = () => Math.max(0, LIMITE_CORPO - corposNotados());

  // O que está entre parênteses pode ser DUAS coisas: um gesto ("braços cruzados", "a voz falha") ou a
  // etiqueta de quem fala ("(a mãe:)", "(o pai:)"). Só o gesto vale, senão a psicóloga dizia coisas como
  // "Reparei — a mãe:." Etiqueta é o que termina em dois-pontos; quando ela traz um gesto junto
  // ("(Lucas, mexendo nos pés:)"), fica só a parte depois da vírgula.
  function corpoDaFala(texto) {
    const achados = String(texto || "").match(/\(([^)]{3,120})\)/g) || [];
    for (const bruto of achados) {
      let dentro = bruto.slice(1, -1).trim();
      if (/:$/.test(dentro)) {                       // etiqueta de locutor
        const virgula = dentro.indexOf(",");
        if (virgula < 0) continue;                   // só o nome: não é gesto nenhum
        dentro = dentro.slice(virgula + 1).replace(/:$/, "").trim();
      }
      if (dentro.length >= 6 && dentro.length <= 90) return dentro;
    }
    return null;
  }

  // O gesto vem escrito como NARRAÇÃO ("mexendo os pés sem parar", "Lucas acena rápido e volta a olhar
  // para os próprios tênis"). Repetir isso dentro das aspas da psicóloga soava a laudo, não a fala: ela
  // diria "Reparei — você está mexendo os pés sem parar". Duas conversões seguras:
  //  · gerúndio ("mexendo…") ganha "você está" na frente;
  //  · nome próprio no começo ("Lucas acena…") vira "você" — em português o verbo de 3ª pessoa serve
  //    para "você" sem mudar nada.
  // O que não cair numa das duas fica como está: melhor uma frase neutra do que uma frase errada.
  function emSegundaPessoa(marca) {
    const g = String(marca || "").trim();
    if (!g) return g;
    const nomes = [];
    try {
      const c = session && typeof CASES !== "undefined" ? CASES[session.key] : null;
      if (c) { nomes.push(I18N.pick(c.name)); if (c.parent) nomes.push(I18N.pick(c.parent.name)); }
    } catch (e) { /* sem caso: sobra a regra do gerúndio */ }
    const primeiro = (n) => String(n || "").trim().split(/\s+/)[0];
    for (const n of nomes) {
      const pn = primeiro(n);
      if (pn && g.toLowerCase().indexOf(pn.toLowerCase()) === 0 && /^\S+\s+\S/.test(g)) {
        return tr("você", "you", "tú") + g.slice(pn.length);
      }
    }
    if (/^\S+ndo\b/i.test(g)) return tr("você está ", "you are ", "estás ") + g;
    if (/^\S+ing\b/i.test(g)) return tr("você está ", "you are ", "estás ") + g;
    return g;
  }

  function podeNotarCorpo(texto) {
    if (!session || !session.investigativa || typeof Dx === "undefined" || !Dx.active()) return false;
    // observar NÃO depende da apresentação: você vê os braços cruzados antes de qualquer pergunta.
    // (o portão de `introduced` vale para PERGUNTAR, não para olhar)
    session.corpoVisto = session.corpoVisto || {};
    if (session.corpoVisto[session.stepIndex]) return false;
    if (corposRestantes() <= 0) return false;
    if (Dx.budgetLeft() < CUSTO_CORPO) return false;
    return Boolean(corpoDaFala(texto));
  }

  function notarCorpo(texto) {
    const marca = corpoDaFala(texto);
    if (!marca || !session) return null;
    session.corpoVisto = session.corpoVisto || {};
    session.corpoVisto[session.stepIndex] = true;
    Dx.spend(CUSTO_CORPO);
    // nomear o não verbal com cuidado acolhe: sobe um pouco o vínculo e o eixo Observação
    state.affinity = clamp(state.affinity + 3, 0, 100);
    if (typeof Wheel !== "undefined") Wheel.gain("observacao", 1);
    state.xp += 1;
    if (session.investigativa) session.points += 2;
    const k = Dx.cur();
    if (k) { const b = Dx.book(k); b.corpo = b.corpo || []; if (!b.corpo.includes(marca)) b.corpo.push(marca); }
    saveState(); if (typeof updateHud === "function") updateHud(); sfx("unlock");
    return {
      marca,
      texto: (() => { const dito = emSegundaPessoa(marca); return tr(
        `Você diz o que está vendo, sem acusar: "Reparei — ${dito}." A pessoa para, olha para você e o corpo afrouxa um pouco. Anotado na ficha.`,
        `You name what you see, without accusing: "I noticed — ${dito}." The person stops, looks at you, and the body loosens a little. Noted in the chart.`,
        `Dices lo que ves, sin acusar: "Me fijé — ${dito}." La persona se detiene, te mira y el cuerpo se afloja un poco. Anotado en la ficha.`); })(),
      ganho: tr("+3 de vínculo · +1 Observação Comportamental", "+3 bond · +1 Behavioral Observation", "+3 de vínculo · +1 Observación Conductual"),
    };
  }

  // ---------------------------------------------------------------- pico emocional (catarse)
  // Há um instante em cada caso em que a pessoa chega no limite. A palavra que carrega esse instante
  // fica acesa na fala; clicar nela abre a escolha de COM QUE LUGAR você responde — e cada lugar é um
  // eixo da Roda. Só entram os eixos que você desenvolveu: a competência treinada é o que está à mão
  // quando a hora chega. Do lugar certo, a pessoa chega onde não chegava sozinha. Do errado, passa.
  const CUSTO_PICO = 5;

  const picoDo = (k) => (typeof Dx !== "undefined" && k ? (Dx.kase(k) || {}).pico || null : null);

  // o pico está disponível agora? (caso certo, consulta certa, palavra na fala, ainda não usado)
  function pico(texto) {
    if (!session || !session.investigativa || typeof Dx === "undefined" || !Dx.active()) return null;
    const k = Dx.cur(), p = picoDo(k);
    if (!p || Dx.book(k).picoVisto) return null;
    if ((session.sess || 1) < (p.sess || 1)) return null;
    const fala = String(texto === undefined ? (document.getElementById("dialogue-text") || {}).textContent || "" : texto);
    const alvo = (p.palavra || []).find((w) => new RegExp(`\\b${w}`, "i").test(fala));
    return alvo ? Object.assign({}, p, { alvo }) : null;
  }

  // os eixos que o jogador pode oferecer agora: os que estão ativos, mais o certo se ele o tiver
  function eixosDoPico(p) {
    if (typeof Wheel === "undefined") return [];
    const ativos = Wheel.AXES.filter((a) => Wheel.active(a.id));
    if (!ativos.length) return [];
    if (!ativos.some((a) => a.id === p.eixo)) return ativos.slice(0, 3);   // sem o eixo certo, o momento existe e se perde
    const outros = ativos.filter((a) => a.id !== p.eixo).slice(0, 2);
    const lista = outros.concat([Wheel.AXES.find((a) => a.id === p.eixo)]);
    return lista.sort((a, b) => Town.hash(a.id + session.key) - Town.hash(b.id + session.key));   // a certa não fica sempre no mesmo lugar
  }

  function responderPico(eixoId) {
    const k = Dx.cur(), p = picoDo(k);
    if (!p || !session) return null;
    if (window.Sound && Sound.tension) Sound.tension(false);   // respondido: a música volta ao que era
    Dx.book(k).picoVisto = true;
    Dx.spend(CUSTO_PICO);
    const certo = eixoId === p.eixo;
    if (certo) {
      state.affinity = clamp(state.affinity + 12, 0, 100);
      if (typeof Wheel !== "undefined") { Wheel.gain(p.eixo, 3); Wheel.gain("anamnese", 1); }
      state.xp += 6;
      session.points += 4;
      Dx.book(k).catarse = true;
      saveState(); if (typeof updateHud === "function") updateHud(); sfx("levelup");
      return { bom: true, gatilho: pick(p.gatilho), fala: pick(p.fala), resposta: pick(p.resposta),
               ganho: tr("+12 de vínculo · +3 no eixo que você usou · a pessoa chegou onde não chegava sozinha", "+12 bond · +3 in the axis you used · the person reached what they could not reach alone", "+12 de vínculo · +3 en el eje que usaste · la persona llegó adonde no llegaba sola") };
    }
    state.affinity = clamp(state.affinity - 2, 0, 100);
    saveState(); if (typeof updateHud === "function") updateHud(); sfx("bad");
    return { bom: false, gatilho: pick(p.gatilho), fala: null, resposta: pick(p.perdido),
             ganho: tr("O momento passou. Não volta nesta consulta.", "The moment passed. It does not come back this session.", "El momento pasó. No vuelve en esta consulta.") };
  }

  // ---------------------------------------------------------------- contratransferência
  // O estresse da psicóloga não fica do lado de fora da sala. Quando ele passa de 60, aparece no
  // mesmo lugar da intuição um pensamento que PARECE leitura clínica e não é: é a reação dela.
  // Essa é a armadilha, e é de propósito — na clínica real a contratransferência também chega
  // disfarçada de percepção. O jogo não avisa qual é qual: quem diferencia é o jogador.
  //  · agir pela reação  — é o caminho fácil, e é o que estraga o vínculo;
  //  · nomear a reação   — custa um instante, devolve o lugar de psicóloga e alivia o estresse.
  const CONTRA_ESTRESSE = 60, CUSTO_CONTRA = 3;

  const CONTRA = [
    { id: "impaciencia", icone: "🌀",
      nome: L("Impaciência", "Impatience", "Impaciencia"),
      texto: L("Essa pessoa fala em círculos e você já entendeu tudo. Dava para cortar caminho e dizer logo o que está acontecendo.", "This person talks in circles and you have already understood everything. You could cut to it and just say what is going on.", "Esta persona habla en círculos y tú ya entendiste todo. Podrías atajar y decir de una vez qué pasa."),
      agir: L("Você apressa, encerra a fala pela pessoa e a conversa perde o fio. Ela concorda com tudo e não conta mais nada.", "You rush, finish the sentence for them, and the conversation loses its thread. They agree with everything and say nothing more.", "Apuras, terminas la frase por la persona y la charla pierde el hilo. Asiente a todo y ya no cuenta nada más."),
      nomear: L("Você repara: a pressa é sua, não dela. Solta o ombro e devolve o tempo para quem está falando.", "You notice: the hurry is yours, not theirs. You drop your shoulders and hand the time back to whoever is speaking.", "Te das cuenta: la prisa es tuya, no de ella. Sueltas el hombro y devuelves el tiempo a quien habla.") },
    { id: "salvacao", icone: "🦸",
      nome: L("Vontade de resolver", "Urge to fix it", "Ganas de resolverlo"),
      texto: L("Você quer muito que essa pessoa saia daqui melhor hoje. Se der o conselho certo agora, talvez resolva.", "You really want this person to leave here better today. If you give the right advice now, maybe it is solved.", "Quieres mucho que esta persona salga mejor hoy. Si das el consejo correcto ahora, quizá se resuelva."),
      agir: L("Você dá o conselho pronto. A pessoa agradece, educada — e sai com a sua solução, não com a dela.", "You hand over the ready-made advice. They thank you, politely — and leave with your solution, not theirs.", "Das el consejo hecho. Te agradece, cortés, y se va con tu solución, no con la suya."),
      nomear: L("A pressa de salvar é sua. Você respira e volta a fazer a pergunta que faltava, em vez de entregar a resposta.", "The urge to rescue is yours. You breathe and go back to the question that was missing, instead of handing over the answer.", "Las ganas de salvar son tuyas. Respiras y vuelves a la pregunta que faltaba, en vez de entregar la respuesta.") },
    { id: "evitar", icone: "🚪",
      nome: L("Vontade de desviar", "Urge to steer away", "Ganas de desviar"),
      texto: L("Esse assunto está pesado hoje. Talvez seja melhor deixar para a próxima sessão — a pessoa também parece cansada.", "This subject is heavy today. Maybe leave it for the next session — they look tired too.", "Este tema está pesado hoy. Quizá sea mejor dejarlo para la próxima sesión; ella también parece cansada."),
      agir: L("Você troca de assunto. O alívio é imediato — e é seu. A porta que estava abrindo fecha sem ninguém comentar.", "You change the subject. The relief is immediate — and it is yours. The door that was opening closes without anyone mentioning it.", "Cambias de tema. El alivio es inmediato, y es tuyo. La puerta que se abría se cierra sin que nadie lo comente."),
      nomear: L("Quem está cansado é você. Reconhecer isso já tira o assunto da frente do seu próprio cansaço.", "The tired one is you. Recognising that already moves the subject out from behind your own exhaustion.", "El cansado eres tú. Reconocerlo ya saca el tema de detrás de tu propio cansancio.") },
  ];

  const estresse = () => (typeof Events !== "undefined" ? Events.stress() : 0);

  // qual reação aparece: fixa por consulta (não troca a cada redesenho) e nunca duas vezes na mesma
  function contratransferencia() {
    if (!session || !session.investigativa || session.contraNomeada || session.contraAgida) return null;
    if (estresse() < CONTRA_ESTRESSE) return null;
    if (!Dx.introduced()) return null;
    const h = typeof Town !== "undefined" ? Town.hash(`${session.key}:${session.sess}:${session.arc}`) : (session.sess || 1);
    return CONTRA[h % CONTRA.length];
  }

  function nomearContra() {
    const c = contratransferencia();
    if (!c) return null;
    session.contraNomeada = c.id;
    Dx.spend(CUSTO_CONTRA);
    if (typeof Events !== "undefined") Events.calm(8);
    if (typeof Wheel !== "undefined") { Wheel.gain("projetivas", 1); Wheel.gain("anamnese", 1); }   // o eixo psicodinâmico do radar chama-se "projetivas"
    state.xp += 2;
    session.points += 2;
    saveState(); if (typeof updateHud === "function") updateHud(); sfx("unlock");
    return { bom: true, nome: pick(c.nome), texto: pick(c.nomear),
             ganho: tr("−8 de estresse · +1 Técnicas Projetivas · +1 Anamnese", "−8 stress · +1 Projective Techniques · +1 History-taking", "−8 de estrés · +1 Técnicas Proyectivas · +1 Anamnesis") };
  }

  function agirContra() {
    const c = contratransferencia();
    if (!c) return null;
    session.contraAgida = c.id;
    // fica registrado para a supervisão: é lá que a reação que escapou pode ser trabalhada
    state.contraLog = (state.contraLog || []).concat([{ caso: session.key, id: c.id, semana: state.week || 1 }]).slice(-8);
    state.affinity = clamp(state.affinity - 5, 0, 100);
    if (typeof Events !== "undefined") Events.addStress(4);   // Events.calm() só alivia: para somar estresse é addStress
    saveState(); if (typeof updateHud === "function") updateHud(); sfx("bad");
    return { bom: false, nome: pick(c.nome), texto: pick(c.agir),
             ganho: tr("−5 de vínculo · +4 de estresse: a reação era sua, e quem pagou foi a conversa.", "−5 bond · +4 stress: the reaction was yours, and the conversation paid for it.", "−5 de vínculo · +4 de estrés: la reacción era tuya, y lo pagó la conversación.") };
  }

  // ---------------------------------------------------------------- confronto com evidência
  // Quem chega ao consultório já traz uma explicação pronta: "ele é preguiçoso", "foi esse namoro",
  // "é manha". Quase sempre está errada, e quase sempre é ela que mantém o sofrimento no lugar.
  // Quando o achado que a contradiz JÁ ESTÁ na ficha, dá para apresentá-lo contra a crença.
  //  · não dá para blefar: sem o achado coletado, o botão nem aparece;
  //  · exige vínculo: confrontar cedo é sentido como acusação, e aí fecha em vez de abrir;
  //  · vale uma vez por caso e custa tempo de sessão, como qualquer intervenção.
  const CUSTO_CONFRONTO = 6, CONFRONTO_FIRME = 55;

  const confrontoDe = (k) => (typeof Dx !== "undefined" && k ? (Dx.kase(k) || {}).confronto || null : null);

  function podeConfrontar() {
    if (!session || !session.investigativa || typeof Dx === "undefined" || !Dx.active()) return false;
    const k = Dx.cur(), c = confrontoDe(k);
    if (!c || !Dx.introduced()) return false;
    if (Dx.book(k).confrontou) return false;                 // uma vez por caso
    if (!Dx.book(k).found[c.achado]) return false;            // só com o achado na mão
    return Dx.budgetLeft() >= CUSTO_CONFRONTO;
  }

  // O MANUAL VIRA PROVA NA HORA. Apresentar um achado era só apertar um botão: a ficha tinha o achado,
  // o vínculo bastava, pronto. Mas confrontar uma crença de família não é mostrar um fato solto — é
  // dizer POR QUE aquele fato desmente a explicação, e isso se faz nomeando o critério. Agora o
  // confronto pede as duas coisas: QUAL achado você apresenta e QUAL critério do Manual ele preenche.
  //  · achado certo + critério certo → o confronto inteiro;
  //  · achado certo + critério errado → a prova cai, mas a família não entende por quê: rende menos;
  //  · achado errado → não é prova de nada, e com uma crença na mesa isso custa caro.
  function confrontar(achadoId, criterioId) {
    const k = Dx.cur(), c = confrontoDe(k);
    if (!c || !session) return null;
    const b = Dx.book(k);
    b.confrontou = true;
    Dx.spend(CUSTO_CONFRONTO);
    const firme = state.affinity >= CONFRONTO_FIRME;
    // o achado apresentado: quando o jogador escolhe, a escolha vale; sem escolha, segue como antes
    if (achadoId !== undefined && achadoId !== c.achado) {
      state.affinity = clamp(state.affinity - 10, 0, 100);
      saveState(); if (typeof updateHud === "function") updateHud(); sfx("bad");
      return { bom: false, crenca: pick(c.crenca), fala: pick(c.fala),
               resposta: tr("\u201cE o que é que isso tem a ver com o que eu falei?\u201d", "\u201cAnd what has that got to do with what I said?\u201d", "\u201c¿Y eso qué tiene que ver con lo que dije?\u201d"),
               ganho: tr("−10 de vínculo: o achado que você apresentou não contradiz a explicação dela. Uma prova que não prova nada, com uma crença na mesa, custa caro.", "−10 bond: the finding you presented does not contradict her explanation. Evidence that proves nothing, with a belief on the table, is expensive.", "−10 de vínculo: el hallazgo que presentaste no contradice su explicación. Una prueba que no prueba nada, con una creencia en la mesa, cuesta caro.") };
    }
    // o critério do Manual: a prova cai, mas sem o nome dela a família não entende o que caiu
    const hip = b.hyp || null;
    const crits = hip && typeof Dx.criterios === "function" ? Dx.criterios(hip) : [];
    const criterioOk = criterioId === undefined || !crits.length || crits.some((x) => (x.id || x) === criterioId);
    if (firme && !criterioOk) {
      state.affinity = clamp(state.affinity + 2, 0, 100);
      b.confrontoOk = true;
      if (typeof Wheel !== "undefined") Wheel.gain("raciocinio", 1);
      state.xp += 1;
      session.points += 1;
      saveState(); if (typeof updateHud === "function") updateHud(); sfx("click");
      return { bom: true, crenca: pick(c.crenca), fala: pick(c.fala), resposta: pick(c.resposta),
               ganho: tr("A prova caiu, mas o critério que você nomeou não é desse quadro — e sem o nome certo ela ouviu um fato, não um argumento. +2 de vínculo · +1 Raciocínio Clínico.", "The evidence landed, but the criterion you named does not belong to this picture — and without the right name she heard a fact, not an argument. +2 bond · +1 Clinical Reasoning.", "La prueba cayó, pero el criterio que nombraste no es de este cuadro, y sin el nombre correcto ella oyó un hecho, no un argumento. +2 de vínculo · +1 Razonamiento Clínico.") };
    }
    if (!firme) {
      state.affinity = clamp(state.affinity - 8, 0, 100);
      saveState(); if (typeof updateHud === "function") updateHud(); sfx("bad");
      return { bom: false, crenca: pick(c.crenca), fala: pick(c.fala), resposta: pick(c.cedo),
               ganho: tr("−8 de vínculo: sem aliança, apresentar uma prova vira acusação.",
                         "−8 bond: without alliance, presenting evidence lands as an accusation.",
                         "−8 de vínculo: sin alianza, presentar una prueba se siente como acusación.") };
    }
    state.affinity = clamp(state.affinity + 6, 0, 100);
    if (typeof Wheel !== "undefined") { Wheel.gain("raciocinio", 2); Wheel.gain("devolutiva", 1); }
    state.xp += 4;
    session.points += c.pts || 3;
    b.confrontoOk = true;                                     // entra como evidência na aba Hipóteses
    saveState(); if (typeof updateHud === "function") updateHud(); sfx("unlock");
    return { bom: true, crenca: pick(c.crenca), fala: pick(c.fala), resposta: pick(c.resposta),
             ganho: `${pick(c.ganho)} · ${tr("+6 de vínculo · +2 Raciocínio Clínico · +1 Devolutiva", "+6 bond · +2 Clinical Reasoning · +1 Feedback", "+6 de vínculo · +2 Razonamiento Clínico · +1 Devolutiva")}` };
  }

  // ---------------------------------------------------------------- manejo do silêncio
  // Depois de uma área delicada, a pessoa se cala. O silêncio não é pausa: é intervenção.
  //  · sustentar  — com vínculo firme, ela elabora e chega mais fundo; sem vínculo, a angústia sobe;
  //  · validar    — sempre seguro: nomeia o peso e acolhe, mas não vai tão fundo quanto o silêncio bem sustentado;
  //  · desviar    — alivia agora e perde a porta que tinha acabado de abrir.
  const ALIANCA_FIRME = 60;

  const OPCOES_SILENCIO = [
    { id: "sustentar", icone: "🧘",
      nome: L("Sustentar o silêncio", "Hold the silence", "Sostener el silencio"),
      dica: L("Não preencher o vazio. Exige vínculo: sem ele, o silêncio angustia em vez de abrir.", "Do not fill the gap. It needs bond: without it, silence distresses instead of opening.", "No llenar el vacío. Exige vínculo: sin él, el silencio angustia en vez de abrir.") },
    { id: "validar", icone: "🤝",
      nome: L("Validar o desconforto", "Name the discomfort", "Validar la incomodidad"),
      dica: L("\u201cParece que ficou pesado falar disso.\u201d Acolhe sem empurrar. Sempre seguro.", "\u201cIt seems that got heavy to talk about.\u201d Welcomes without pushing. Always safe.", "\u201cParece que se puso pesado hablar de eso.\u201d Acoge sin empujar. Siempre seguro.") },
    { id: "desviar", icone: "❓",
      nome: L("Mudar de assunto", "Change the subject", "Cambiar de tema"),
      dica: L("Alivia a tensão agora — e fecha a porta que tinha acabado de abrir.", "Eases the tension now — and closes the door that had just opened.", "Alivia la tensión ahora, y cierra la puerta que acababa de abrirse.") },
  ];

  function resolverSilencio(id) {
    const firme = state.affinity >= ALIANCA_FIRME;
    if (id === "sustentar") {
      if (firme) {
        state.affinity = clamp(state.affinity + 8, 0, 100);
        if (typeof Wheel !== "undefined") { Wheel.gain("anamnese", 2); Wheel.gain("projetivas", 1); }
        state.xp += 3;
        if (session && session.investigativa) session.points += 3;
        premiar();
        return { bom: true, fala: tr("Ela respira fundo, os olhos enchem, e o que vem depois não estava na pergunta: é o que estava por baixo dela.", "She takes a deep breath, her eyes well up, and what comes next was not in the question: it is what lay underneath it.", "Respira hondo, se le llenan los ojos, y lo que viene después no estaba en la pregunta: es lo que había debajo."),
                 efeito: tr("+8 de vínculo · +2 Anamnese · +1 Projetivas", "+8 bond · +2 History-taking · +1 Projectives", "+8 de vínculo · +2 Anamnesis · +1 Proyectivas") };
      }
      state.affinity = clamp(state.affinity - 6, 0, 100);
      premiar();
      return { bom: false, fala: tr("O silêncio fica grande demais. Ela limpa a garganta, endurece o tom: \u201cEnfim. Não sei aonde isso vai dar.\u201d", "The silence grows too large. She clears her throat and hardens: \u201cAnyway. I don't see where this is going.\u201d", "El silencio se hace demasiado grande. Se aclara la garganta y endurece el tono: \u201cEn fin. No sé adónde lleva esto.\u201d"),
               efeito: tr("−6 de vínculo: sem confiança, o silêncio vira cobrança.", "−6 bond: without trust, silence feels like pressure.", "−6 de vínculo: sin confianza, el silencio se siente como exigencia.") };
    }
    if (id === "validar") {
      state.affinity = clamp(state.affinity + 5, 0, 100);
      if (typeof Wheel !== "undefined") Wheel.gain("anamnese", 1);
      state.xp += 1;
      if (session && session.investigativa) session.points += 1;
      premiar();
      return { bom: true, fala: tr("As mãos que apertavam a bolsa afrouxam. \u201cÉ pesado mesmo. Ninguém nunca perguntou assim.\u201d", "The hands gripping the bag loosen. \u201cIt is heavy. Nobody ever asked like that.\u201d", "Las manos que apretaban el bolso se aflojan. \u201cEs pesado, sí. Nadie preguntó nunca así.\u201d"),
               efeito: tr("+5 de vínculo · +1 Anamnese", "+5 bond · +1 History-taking", "+5 de vínculo · +1 Anamnesis") };
    }
    premiar();
    return { bom: false, fala: tr("Ela agarra a saída com alívio: \u201cAh, sim… enfim, o trabalho está tranquilo.\u201d O que estava quase dito volta para dentro.", "She grabs the exit with relief: \u201cOh, right… anyway, work is fine.\u201d What was almost said goes back in.", "Se agarra a la salida con alivio: \u201cAh, sí… en fin, el trabajo va bien.\u201d Lo que casi se dijo vuelve adentro."),
             efeito: tr("Sem ganho: o assunto fechou.", "No gain: the subject closed.", "Sin ganancia: el tema se cerró.") };
  }

  const premiar = () => { saveState(); if (typeof updateHud === "function") updateHud(); };

  // vale a pena parar aqui? (área delicada respondida de verdade)
  const mereceSilencio = (r) => Boolean(r && r.d && r.d.sensitive && !r.blocked && !r.guarded && r.f && !r.again);

  return { pintar, marcar, disponiveis, GATILHOS, intuicao, mostrarIntuicao, pensar, NIVEL_MIN,
           corpoDaFala, podeNotarCorpo, notarCorpo, CUSTO_CORPO, LIMITE_CORPO, corposRestantes, emSegundaPessoa,
           confrontoDe, podeConfrontar, confrontar, CUSTO_CONFRONTO, CONFRONTO_FIRME, achadoDoConfronto: (k) => (confrontoDe(k) || {}).achado || null,
           CONTRA, contratransferencia, nomearContra, agirContra, CONTRA_ESTRESSE, CUSTO_CONTRA,
           pico, picoDo, eixosDoPico, responderPico, CUSTO_PICO, acenderPico,
           OPCOES_SILENCIO, resolverSilencio, mereceSilencio, ALIANCA_FIRME, _listaDe: listaDe };
})();
window.Escuta = Escuta;

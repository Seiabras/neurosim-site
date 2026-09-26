"use strict";

// ===========================================================================
// Jogo: consulta (abordagens), ficha, manual, resultado, intervalo e modo secreto
// ===========================================================================

// pontos por nota da abordagem (0 a 4). Errar tira pontos; a 2ª melhor opção rende bem menos que a ideal.
const QUALITY_POINTS = { 4: 4, 3: 2.6, 2: 1, 1: 0, 0: -1 };

const FICHA_UNLOCK = { queixas: 0, historia: 1 };   // passo que libera cada campo da ficha

const sessionCase = () => (session ? (session.secret ? SECRET[session.key] : CASES[session.key]) : null);

// ---------------------------------------------------------------- motor de abordagens
// Nota final (0 a 4) = ajuste ao caso + ajuste da fase da conversa + itens da sala - cansaço.
function itemBonuses(ap, caseKey) {
  const kid = Boolean((CASES[caseKey] || {}).kid);
  const list = [];
  officeItems().forEach((id) => {
    const it = itemById(id);
    if (!it || !it.bonus || it.bonus.ap !== ap) return;
    const w = it.bonus.when;
    if (w === "all" || (w === "kid" && kid) || (w === "adult" && !kid)) list.push({ item: it, v: it.bonus.v });
  });
  return window.Pets ? list.concat(Pets.bonuses(ap, caseKey)) : list;
}

function scoreOption(c, step, ap, caseKey) {
  const base = (c.fit[ap] === undefined ? 1 : c.fit[ap]) + ((step.mods && step.mods[ap]) || 0);
  const bonuses = itemBonuses(ap, caseKey);
  const tired = (state.energy < LOW_ENERGY ? -1 : 0) + (typeof Events !== "undefined" && Events.stress() >= 60 ? -1 : 0);   // cansaço e estresse pesam na nota
  const score = clamp(base + bonuses.reduce((s, b) => s + b.v, 0) + tired, 0, 4);
  return { score, delta: DELTA[score], bonuses, tired };
}

function buildChoices(c, step, caseKey) {
  return shuffle(Object.keys(step.options).map((ap) => Object.assign({ ap, text: Sens.text(step.options[ap], I18N.pick(window.L("Estou aqui com você, no seu ritmo. Fale só até onde se sentir confortável.", "I'm here with you, at your pace. Share only as much as feels comfortable.", "Estoy aquí contigo, a tu ritmo. Cuenta solo lo que te resulte cómodo."))) }, scoreOption(c, step, ap, caseKey))));
}

// ---------------------------------------------------------------- consulta
// Quem está com a palavra. Várias falas trazem os DOIS — "(Lucas, mexendo os pés:) ... (a mãe:) ..." —
// e nesses casos o `who` do passo dizia acompanhante enquanto quem começava a falar era o paciente: o
// retrato ao lado do balão mostrava a pessoa errada. Quem manda é a etiqueta que abre a fala, porque é
// o que o jogador lê. Sem etiqueta, vale o `who` do passo.
const ETIQUETA_FAMILIA = /^[\s'"“]*\((?:o |a )?(pai|mãe|mae|avó|avo|avô)(?=[\s,.:;)])/i;   // \b não serve: em JS "ó" não é letra para o \b, e "(A avó pergunta" escapava
function quemAbreAFala(texto, c) {
  const t = String(texto || "").trim();
  if (!c || !c.parent) return null;
  if (ETIQUETA_FAMILIA.test(t)) return "parent";
  const nome = String(I18N.pick(c.name) || "").split(" ")[0];
  if (nome && new RegExp(`^[\\s'"“]*\\(${nome}(?=[\\s,.:;)])`, "i").test(t)) return "patient";
  return null;
}
// PARTIR A FALA POR QUEM FALA. Um mesmo trecho traz a mãe, uma rubrica sobre o filho e a mãe de novo,
// tudo num balão só e com uma medalha só — lia-se como se uma pessoa dissesse tudo. Aqui o trecho é
// quebrado nas etiquetas "(a mãe:)" / "(Lucas:)": cada pedaço vira um balão, com o retrato e o nome de
// quem está falando. A rubrica sem dois-pontos ("(Lucas acena e olha para os tênis.)") é ação, não fala:
// ela fica com quem a rubrica nomeia, para que notar o corpo aponte a pessoa certa.
function partirFala(texto, c) {
  const txt = String(texto || "");
  if (!c || !c.parent) return [{ quem: "patient", txt }];
  const nomePac = String(I18N.pick(c.name) || "").split(" ")[0];
  const nomeAcc = String(I18N.pick(c.parent.name) || "").split(" ")[0];
  const partes = [];
  const re = /\(([^)]{1,60})\)/g;
  let m, pos = 0, atual = null;
  const quemDaEtiqueta = (dentro) => {
    const d = dentro.trim();
    if (/^(a m[ãa]e|o pai|a av[óo]|o av[ôo]|m[ãa]e|pai)\b/i.test(d)) return "parent";
    if (nomeAcc && new RegExp(`^${nomeAcc}\\b`, "i").test(d)) return "parent";
    if (nomePac && new RegExp(`^${nomePac}\\b`, "i").test(d)) return "patient";
    return null;
  };
  const empurra = (quem, t2) => {
    const limpo = t2.trim();
    if (!limpo) return;
    if (atual && atual.quem === quem) atual.txt += " " + limpo;
    else { atual = { quem, txt: limpo }; partes.push(atual); }
  };
  let dono = "patient";
  while ((m = re.exec(txt))) {
    const dentro = m[1], etiqueta = /:\s*$/.test(dentro);
    const de = quemDaEtiqueta(dentro);
    const antes = txt.slice(pos, m.index);
    if (antes.trim()) empurra(dono, antes);
    if (etiqueta && de) {
      dono = de; atual = null;
      // "(Lucas, mexendo os pés sem parar:)" é etiqueta E gesto. O gesto NÃO pode sumir: é dele que
      // "notar o corpo" vive, e ele pertence a quem a etiqueta nomeia.
      const virg = dentro.indexOf(",");
      if (virg > 0) { const gesto = dentro.slice(virg + 1).replace(/:\s*$/, "").trim(); if (gesto.length >= 4) empurra(de, `(${gesto})`); }
    }
    else if (de && de !== dono) { atual = null; empurra(de, m[0]); atual = null; }   // rubrica sobre o OUTRO: pedaço só dela
    else empurra(dono, m[0]);
    pos = m.index + m[0].length;
  }
  if (txt.slice(pos).trim()) empurra(dono, txt.slice(pos));
  // O CONTEÚDO DESEMPATA. A rubrica sem dois-pontos ("(a mãe olha para ele, surpresa.)") não troca quem
  // fala, e a frase seguinte ficava com quem falava antes — foi assim que "Ele nunca tinha me contado
  // isso", que é da mãe, apareceu assinada pelo Lucas. Uma criança não fala de si em terceira pessoa:
  // um trecho atribuído ao paciente que diz "ele/ela" ou o nome dele é, na verdade, de quem veio junto.
  const terceiraPessoa = new RegExp(`\\b(ele|ela)\\s+(nunca|n[ãa]o|j[áa]|sempre|vive|anda|fica|come[çc]ou|tinha|tem|est[áa]|era|foi|faz|diz)\\b|\\bmeu filho\\b|\\bminha filha\\b${nomePac ? `|\\bo ${nomePac}\\b|\\ba ${nomePac}\\b` : ""}`, "i");
  const primeiraPessoaDele = /\b(eu (n[ãa]o )?(sei|acho|gosto|odeio|consigo|quero|presto|fico|tenho)|minha professora|meu pai|minha m[ãa]e)\b/i;
  partes.forEach((pe) => {
    if (pe.quem !== "patient") return;
    const semRubrica = pe.txt.replace(/\([^)]*\)/g, " ");
    if (terceiraPessoa.test(semRubrica) && !primeiraPessoaDele.test(semRubrica)) pe.quem = "parent";
  });
  // duas partes seguidas da mesma pessoa viram uma só
  const juntas = [];
  partes.forEach((pe) => {
    const ult = juntas[juntas.length - 1];
    if (ult && ult.quem === pe.quem) ult.txt += " " + pe.txt;
    else juntas.push(pe);
  });
  return juntas.length ? juntas : [{ quem: "patient", txt }];
}

function speakerInfo() {
  const c = sessionCase();
  // com a fala partida, quem aparece na medalha é quem está falando NESTE pedaço
  if (session && session.partes && session.partes.length) {
    const pe = session.partes[Math.min(session.parteIdx || 0, session.partes.length - 1)];
    const parent = Boolean(c.parent) && pe.quem === "parent";
    return { parent, name: parent ? c.parent.name : c.name, image: parent ? c.parent.image : c.image };
  }
  const step = session.steps[Math.min(session.stepIndex, session.steps.length - 1)];
  const pelaFala = quemAbreAFala(step && step.text, c);
  const parent = Boolean(c.parent) && (pelaFala ? pelaFala === "parent" : step.who === "parent");
  return { parent, name: parent ? c.parent.name : c.name, image: parent ? c.parent.image : c.image };
}

// Avança um pedaço da fala. Serve à seta, ao toque no próprio balão e a quem quiser pular direto para
// o fim (`tudo`), que é o que os testes fazem para chegar às opções sem encenar a conversa inteira.
function avancarFala(tudo) {
  if (!session || !session.partes || session.parteIdx >= session.partes.length - 1) return false;
  session.parteIdx = tudo ? session.partes.length - 1 : session.parteIdx + 1;
  if (session.aoFimDaFala) mostrarParte(session.aoFimDaFala);
  return true;
}

// mostra o pedaço atual da fala; o último libera as opções
function mostrarParte(aoFim) {
  session.aoFimDaFala = aoFim;
  const box = $("choices-container");
  const pe = session.partes[session.parteIdx];
  const ultima = session.parteIdx >= session.partes.length - 1;
  paintSpeaker();
  // A fala partida é mecânica: na primeira vez que ela aparece no tutorial, explica-se a seta. Sem isso
  // o jogador novo vê um balão e uma seta piscando sem saber que há mais gente para falar.
  if (!ultima && session.tutorial && !state.tutorialDone && !session.ensinouVez) {
    session.ensinouVez = true;
    setTimeout(() => { if (session && typeof Tutor !== "undefined" && !Tutor.running()) Tutor.run([{ key: "vez", target: "fala-mais" }]); }, 420);
  }
  box.classList.add("hidden");
  const seta = $("fala-mais");
  if (seta) seta.classList.add("hidden");
  typeText($("dialogue-text"), pe.txt, () => {
    if (ultima) { aoFim(); return; }
    if (seta) {
      seta.classList.remove("hidden");
      seta.onclick = () => avancarFala(false);
    }
  });
}

// o recado que abre a escolha da tarefa quando o roteiro pede uma
function avisoDaTarefa() {
  const cx = el("div", "dx-why");
  cx.appendChild(el("b", null, `🧪 ${t("tarefa.hora")}`));
  cx.appendChild(el("p", null, t("tarefa.hora.x")));
  return cx;
}

function consultOpts() {
  const c = sessionCase();
  return Object.assign(scenePlace("consultorio"), {
    camera: "consult", base: false, base3d: true,
    character: c.image || null,          // o retrato em aquarela, que agora vive na moldura ao lado do balão
    patientLook: caseLook(c, "patient"), // quem senta na poltrona é gente de verdade, montada em 3D
    parent: c.parent ? c.parent.image : null,
    parentLook: c.parent ? caseLook(c, "parent") : null,
    speaker: speakerInfo().parent ? "parent" : "patient",
    // o corpo de quem é atendido responde ao estado da sessão (scene3d: setClima)
    clima: (() => {
      const mult = typeof Wheel !== "undefined" && Wheel.defense ? Wheel.defense() : 1;
      return { defesa: clamp(Math.round((100 - state.affinity) * mult), 0, 100) / 100, alianca: clamp(state.affinity, 0, 100) / 100, crise: Boolean(session && session.crise) };
    })(),
    theme: c.theme || Town.themeNow() || null,
    pets: [],
    diva: Boolean(session && session.diva),
    // ENTRAR PELA PORTA (7.8): só no começo da consulta. Depois do primeiro balão eles já estão
    // sentados, e remontar a cena (trocar de aba, girar o celular) não pode fazer a pessoa levantar
    // e entrar de novo — por isso a entrada vale enquanto a conversa não começou.
    // A entrada é UMA por consulta: o que a decide não é o passo da conversa (que muda a cada balão e
    // fazia a cena remontada recolocar a pessoa sentada no meio do caminho), e sim ter entrado ou não.
    entrando: Boolean(session && !session.secret && !session.entrouNaSala && !session.diva),
    aoEntrar: () => { if (session) session.entrouNaSala = true; },
    firstPerson: Boolean(settings.firstPerson)
  });
}

// ---------------------------------------------------------------- o divã
// O divã não é um sofá mais caro: é o móvel em que a pessoa deixa de ver o seu rosto. E isso não é
// enfeite histórico — muda o que se pode dizer e o que se pode ver. Deitada, ela alcança o assunto
// que não alcançava olhando para você; em troca, você perde a cara dela, que é metade do que você lia.
const DIVA_IDADE = 15;                      // criança não deita no divã: ela precisa do seu rosto
function temDiva() { return (typeof officeItems === "function" ? officeItems() : []).includes("diva"); }
function podeOferecerDiva() {
  if (!session || session.secret || session.manut || session.diva || session.divaRecusado) return false;
  if (!temDiva() || session.sess < 2) return false;
  const c = sessionCase();
  if (!c || c.parent) return false;          // com acompanhante na sala, deitar é expor a pessoa
  const anos = parseInt(String(c.age || "").replace(/\D+/g, ""), 10);   // a idade vem escrita ("12 anos"), não como número
  return (isNaN(anos) ? 30 : anos) >= DIVA_IDADE;
}
const DIVA_VINCULO = 45;                    // deitar sem vínculo é ficar exposta, e ninguém aceita
function oferecerDiva() {
  if (!podeOferecerDiva()) return;
  const nome = speakerInfo().name;
  if (clamp(state.affinity, 0, 100) < DIVA_VINCULO) {
    session.divaRecusado = true;
    sfx("deny");
    mostrarIntervencao(t("diva.recusa.t"), t("diva.recusa.x", { nome }), true);
    return;
  }
  session.diva = true;
  session.divaSess = session.sess;
  if (typeof Wheel !== "undefined") Wheel.gain("escuta", 1);
  state.xp += 2;
  sfx("equip");
  saveState();
  if (use3D()) renderRoom($("consult-room"), consultOpts());
  mostrarIntervencao(t("diva.aceita.t"), t("diva.aceita.x", { nome }), false);
}

// Quem abre a semana é quem ensina o jogo. Desde a 4.18 é o Lucas (TDAH, 8 anos, com a mãe junto):
// um caso tranquilo e todo feito de investigação, em vez de abrir o jogo com abandono e autolesão.
// Fica preso à agenda, e não a um nome, para não haver dois lugares dizendo quem é o primeiro.
// Consequência tardia: o jogador fechou a sessão anterior convicto de uma hipótese errada e orientou a
// família por ela. O jogo não avisou na hora — avisa agora, pela boca de quem seguiu a orientação.
// Custa aliança e obriga a refazer o caminho, que é a parte clínica de verdade: admitir o erro.
// A PESSOA LEMBRA O QUE VOCÊ DISSE. Cada consulta começava do zero: você podia dizer a coisa mais
// acertada do mundo no primeiro encontro e, na semana seguinte, nada daquilo existia. O que fica na
// memória de quem é atendido não é a técnica, é a FRASE — e é por isso que ela volta com todas as
// letras. Guardamos a melhor resposta do primeiro encontro (e só ela: quem lembra de tudo é ficha,
// não é gente) e a pessoa a devolve a partir do terceiro.
function guardarFalaMarcante(choice) {
  if (!session || session.secret || session.manut || typeof Dx === "undefined" || !Dx.kase(session.key)) return;
  if (session.sess !== 1 || choice.score < 3) return;
  const b = Dx.book(session.key);
  if (b.marcante && b.marcante.score >= choice.score) return;
  b.marcante = { txt: String(choice.text || choice.label || "").slice(0, 220), ap: choice.ap, score: choice.score, sess: 1 };
  saveState();
}

function lembrancaDaPrimeira() {
  if (!session || session.secret || session.manut || session.sess < 3) return null;
  if (typeof Dx === "undefined" || !Dx.kase(session.key)) return null;
  const b = Dx.book(session.key);
  if (!b.marcante || !b.marcante.txt || b.lembrou) return null;
  b.lembrou = true;
  saveState();
  const ap = (typeof APPROACH !== "undefined" && APPROACH[b.marcante.ap]) || null;
  if (typeof Wheel !== "undefined" && b.marcante.ap) Wheel.gain("escuta", 1);
  return t("lembranca", { fala: b.marcante.txt, ap: ap ? `${ap.icon} ${ap.name}` : "" }).trim();
}

function aplicarConsequencia() {
  if (!session || session.secret || session.manut || session.sess < 3) return;
  if (typeof Dx === "undefined" || !Dx.kase(session.key)) return;
  const k = session.key, b = Dx.book(k);
  const cons = (Dx.kase(k).consequencia || {})[b.hyp];
  if (!cons) return;
  if ((b.consVistas = b.consVistas || {})[b.hyp]) return;     // uma vez por hipótese errada
  b.consVistas[b.hyp] = true;
  session.consequencia = I18N.pick(cons);
  state.affinity = clamp(state.affinity - 10, 0, 100);
  b.hyp = null;                                               // a hipótese cai: é preciso remarcar olhando de novo
  saveState();
}

const primeiroCaso = () => (SCHEDULE[DAYS[0]] && SCHEDULE[DAYS[0]][0] || {}).caseId;

function startSession(caseKey, opts = {}) {
  if (session) return;
  if (!(opts && opts.secret) && typeof Risk !== "undefined" && CASES[caseKey] && !String(caseKey).startsWith("cit:") && Risk.beforeSession(caseKey)) return;   // crise/encerrado: o paciente não aparece
  const secret = Boolean(opts.secret);
  const c = secret ? SECRET[caseKey] : CASES[caseKey];
  const dayKey = currentDayKey();
  const slot = secret ? null : nextAppt();
  const late = Boolean(slot) && (state.clock === undefined ? DAY_START : state.clock) > slotStart(slot) + LATE_GRACE + (typeof Career !== "undefined" ? Career.grace() : 0);
  state.affinity = clamp((late ? START_AFFINITY - LATE_PENALTY : START_AFFINITY) + Wheel.perk("affinity") + (secret ? 0 : Life.playroomBonus(c.kid)), 0, 100);
  if (slot && !late && state.clock < slotStart(slot)) state.clock = slotStart(slot);   // chegou cedo: espera o horário
  const manut = Boolean(slot) && slot.sess === 0.5 && typeof Care !== "undefined";   // sessão de acompanhamento (psicoterapia contínua)
  const sess = secret ? 0 : manut ? 3 : opts.sess || (slot && slot.sess) || 1;   // opts.sess: painel do desenvolvedor abre a consulta que quiser
  const arc = !secret && FU.rec(caseKey).arc !== undefined ? FU.rec(caseKey).arc : Math.floor(Math.random() * 3);   // roteiro da conversa (0, 1 ou 2)
  const steps = secret ? c.steps : manut ? Care.steps(caseKey, arc) : FU.steps(caseKey, sess, arc);
  session = {
    key: caseKey, secret, manut, dayKey, apptIdx: state.apptIndex, sess, steps,
    arc, stepIndex: 0, goodChoices: 0, totalSteps: steps.length, points: 0, maxPoints: steps.length * 4, phase: "talk", dx: null,
    // Consulta de AVALIAÇÃO (não é modo secreto nem acompanhamento): o corpo da sessão é a investigação,
    // não escolher uma fala entre quatro. O placar vem do que você descobre (ver Dx.pontuar).
    // As escolhas de abordagem continuam nas sessões de terapia, onde a escolha é de conduta.
    investigativa: !secret && !manut,
    late,
    tutorial: !secret && caseKey === primeiroCaso() && !state.tutorialDone,   // o tutorial acompanha a agenda, não um caso fixo
    hintPaid: false, unlocked: { queixas: false, historia: false }, notes: [], typing: null
  };
  if (session.investigativa) session.maxPoints = Dx.MAX_ASKS * 4;   // 3 perguntas por consulta, até 4 pontos cada
  aplicarConsequencia();
  const lembr = lembrancaDaPrimeira();
  if (lembr) { session.consequencia = session.consequencia ? `${lembr}\n\n${session.consequencia}` : lembr; if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("lembranca"), 1200); }
  ClinicFSM.iniciar(caseKey, sess);
  $("ficha-new").classList.add("hidden");
  if (window.Sound && !secret) Sound.setKey(Town.hash(caseKey));   // cada paciente tem o seu tom na música da consulta
  const ok = renderRoom($("consult-room"), consultOpts());
  $("screen-consult").classList.toggle("has3d", ok === true);
  showScreen("consult");
  paintSpeaker();
  updateHud();
  const enterMs = ok === true && !reducedMotion() && !secret ? 3300 : 0;
  if (enterMs) {
    // a paciente bate na porta, entra andando e senta; só então a conversa começa
    const sess = session;
    $("progress-fill").style.width = "0%";
    $("feedback-panel").classList.add("hidden");
    $("choices-container").classList.add("hidden");
    $("dialogue-text").textContent = "🚪 …";
    sfx("knock");
    let n = 0;
    const walk = setInterval(() => { if (session !== sess || ++n > 7) return clearInterval(walk); sfx("step"); }, 330);
    setTimeout(() => sfx("rest"), 2800);
    setTimeout(() => { if (session === sess) renderStep(); }, enterMs);
  } else {
    renderStep();
  }
  if (late) { sfx("bad"); showToast(t("clock.late", { n: LATE_PENALTY, t: fmtClock(slotStart(slot)) })); }
}

// retoma a consulta que ficou em andamento quando o jogo foi fechado (state.activeSession, guardado a cada saveState()
// enquanto há uma "session"); usado pelo botão Continuar. Sem a animação de entrada: a pessoa já estava sentada.
function resumeSession() {
  const a = state.activeSession;
  if (!a) return false;
  const c = a.secret ? SECRET[a.key] : CASES[a.key];
  if (!c || !Array.isArray(a.steps) || !a.steps[a.stepIndex]) { state.activeSession = null; return false; }   // conteúdo mudou (idioma/versão nova): melhor não arriscar
  session = Object.assign({ typing: null }, a);
  // volta ao estado exato da máquina; só se não houver estado guardado (save antigo) é que se reconstrói pela fase
  if (!ClinicFSM.restaurar(session.fsm)) {
    ClinicFSM.iniciar(session.key, session.sess);
    if (session.phase === "dx") { ClinicFSM.ir("escuta"); ClinicFSM.ir("hipotese"); }
    else if (session.phase === "tx") { ClinicFSM.ir("escuta"); ClinicFSM.ir("hipotese"); ClinicFSM.ir("conduta"); }
  }
  $("ficha-new").classList.add("hidden");
  if (window.Sound && !session.secret) Sound.setKey(Town.hash(session.key));
  const ok = renderRoom($("consult-room"), consultOpts());
  $("screen-consult").classList.toggle("has3d", ok === true);
  showScreen("consult");
  paintSpeaker();
  updateHud();
  renderStep();
  return true;
}

// atualiza o nome, o desenho 2D e o destaque 3D de quem está falando
function paintSpeaker() {
  const sp = speakerInfo();
  $("character-name-tag").textContent = sp.name;
  const art = $("patient-sprite");
  art.textContent = "";
  const img = el("img");
  img.src = sp.image;
  img.alt = "";
  art.appendChild(img);
  if (use3D()) renderRoom($("consult-room"), consultOpts());
}

function enterConsultationRoom() {
  if (weekDone() || session) return;
  if (state.dayOver) { if (settings.emptyOffice) showEmptyOffice(); else showToast(t("day.over.door")); return; }     // expediente encerrado: as próximas consultas são amanhã
  const appt = SCHEDULE[currentDayKey()][state.apptIndex];
  if (!appt) return;
  startSession(appt.caseId);
}

function abandonSession() {
  if (!session) return;   // nada em andamento: não sobrescreve o state.activeSession salvo (é o que o botão Continuar usa)
  if (session.typing) clearInterval(session.typing.timer);
  ClinicFSM.encerrar();
  session = null;
  state.affinity = START_AFFINITY;
  saveState();
}

// Escuta ativa: na consulta de avaliação, as palavras do paciente que puxam assunto viram clicáveis.
// Clicar em "invisível" ou "bebo" abre a pergunta daquela área — é o menu de investigação, mas dentro da fala.
// O SEU CANSAÇO ENTRA NA ESCUTA. O estresse já subia e descia e mexia na contratransferência, mas nada
// disso se via. Com o estresse alto, um trecho da fala chega embaçado — não porque o paciente falou
// diferente, e sim porque VOCÊ não está escutando inteiro. Tocar no trecho recompõe. É honesto: o jogo
// não mente sobre o que foi dito, ele mostra o custo de atender exausto.
const ESTRESSE_TURVA = 60;
function turvarFala(target) {
  if (typeof Events === "undefined" || !Events.stress || Events.stress() < ESTRESSE_TURVA) return;
  const textos = [...target.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim().length > 30);
  if (!textos.length) return;
  const no = textos[Math.floor(textos.length / 2)];
  const v = no.nodeValue, ini = Math.floor(v.length * 0.35), fim = Math.min(v.length, ini + 26);
  const span = document.createElement("span");
  span.className = "fala-turva";
  span.textContent = v.slice(ini, fim);
  span.title = I18N.pick(L("O seu cansaço está entrando na escuta. Toque para recompor.", "Your exhaustion is getting into your listening. Tap to refocus.", "Tu cansancio está entrando en la escucha. Toca para recomponer."));
  span.addEventListener("click", (e) => { e.stopPropagation(); span.classList.add("clara"); });
  const pai = no.parentNode;
  pai.insertBefore(document.createTextNode(v.slice(0, ini)), no);
  pai.insertBefore(span, no);
  pai.insertBefore(document.createTextNode(v.slice(fim)), no);
  pai.removeChild(no);
  if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("turva"), 700);
}

function grifarFala(target, text) {
  if (!session || !session.investigativa || typeof Escuta === "undefined") return;
  if (target.id !== "dialogue-text") return;
  try {
    Escuta.pintar(target, text, (dom) => { if (typeof Dx !== "undefined") Dx.openInvest(dom); });
    // a 1ª palavra acesa da partida explica o que é uma palavra acesa
    if (target.querySelector(".fala-gatilho") && typeof Tips !== "undefined") setTimeout(() => Tips.fire("escuta"), 700);
    Escuta.acenderPico(target, text);
    Escuta.mostrarIntuicao(text);
    turvarFala(target);
  } catch (e) { target.textContent = text; }   // qualquer tropeço: a fala continua legível
}

function typeText(target, text, onDone) {
  if (session.typing) clearInterval(session.typing.timer);
  let i = 0;
  target.textContent = "";
  const instant = !settings.typing || reducedMotion();
  const finish = () => {
    if (session && session.typing) clearInterval(session.typing.timer);
    if (session) session.typing = null;
    target.textContent = text;
    grifarFala(target, text);
    onDone();
  };
  if (instant) return finish();
  const timer = setInterval(() => {
    i += 2;
    if (settings.typeSound && i % 6 === 0) sfx("tick");
    if (i >= text.length) return finish();
    target.textContent = text.slice(0, i);
  }, 18);
  session.typing = { timer, finish };
}

// A fala do paciente em cada passo é sorteada entre a original e as variantes (uma vez por sessão e passo):
// não dá para decorar o que a pessoa vai dizer, mas a pista clínica é a mesma.
// na 1ª pessoa a etiqueta com o nome fica logo abaixo do balão (em cima do rosto ela atrapalha)
function placeNameTag() {
  const tag = $("character-name-tag"), bub = document.querySelector("#screen-consult .speech-bubble"), stage = document.querySelector("#screen-consult .stage");
  if (!tag || !bub || !stage) return;
  if (document.body.dataset.fp !== "1") { tag.style.top = ""; return; }
  tag.style.top = `${bub.getBoundingClientRect().bottom - stage.getBoundingClientRect().top + 14}px`;
}

function stepText(step, i) {
  const all = [step.text].concat(step.variants || []);
  // a aleatoriedade é da CONVERSA inteira, não de cada fala: o mesmo "roteiro" (0, 1 ou 2) vale em todos os passos, para as falas
  // se encaixarem (nada de citar algo que o roteiro escolhido não disse), e o paciente mantém o roteiro nas 4 consultas
  return Sens.text(all[session.arc % all.length], "(a pessoa prefere não falar sobre isso agora.)");
}

function renderStep() {
  window.scrollTo(0, 0);
  setTimeout(placeNameTag, 60);   // em telas pequenas, volta ao balão da fala
  const c = sessionCase();
  const step = session.steps[session.stepIndex];
  ClinicFSM.ir("escuta");
  // A TAREFA ACONTECE, não é narrada. Havia passo de roteiro que contava a pessoa errando numa tarefa
  // que o jogador nunca aplicou — a fala descrevia uma cena que não existiu na tela. Quando o passo traz
  // `tarefa`, o jogo abre a escolha da tarefa ali, na hora, e a cena roda antes de a fala aparecer.
  if (step && step.tarefa && !session.tarefaFeita && !session.secret && !session.manut && typeof PsicoDx !== "undefined") {
    session.tarefaFeita = true;
    setTimeout(() => PsicoDx.openTest(avisoDaTarefa()), 400);
  }
  session.choices = buildChoices(c, step, session.key);
  $("progress-fill").style.width = `${Dx.progress() * 100}%`;
  $("feedback-panel").classList.add("hidden");
  paintSpeaker();

  const box = $("choices-container");
  box.textContent = "";
  box.classList.add("hidden");

  if (window.Scene3D && Scene3D.doctorMode) Scene3D.doctorMode("listen");
  const inv = $("btn-invest");
  inv.classList.toggle("hidden", !Dx.canShow());
  inv.classList.toggle("invest-glow", Dx.canShow() && !state.usedInvestigar);   // brilha até o 1º uso, para não passar batido
  inv.textContent = Dx.btnLabel();
  $("btn-test").classList.toggle("hidden", !Dx.canTest());
  $("btn-test").textContent = `🧪 ${t("consult.test")}`;
  $("btn-proj").classList.toggle("hidden", !Dx.canTest());
  $("btn-proj").textContent = `🎨 ${t("consult.proj")}`;
  $("btn-diva").classList.toggle("hidden", !podeOferecerDiva());
  if (podeOferecerDiva() && typeof Tips !== "undefined") Tips.fire("diva");
  $("btn-diva").textContent = `🛋️ ${t("diva.btn")}`;
  atualizarHabilidades();
  PsicoDx.onStep();
  session.estadoConsulta = Wheel.estadoConsulta();
  // a consequência tardia é a primeira coisa que a pessoa diz ao voltar, antes de qualquer outra fala
  const abertura = session.consequencia && session.stepIndex === 0 ? session.consequencia + "\n\n" : "";
  const falaToda = abertura + Wheel.cue() + Dx.reaction() + stepText(step, session.stepIndex);
  // A fala vai partida por quem fala: a mãe num balão, o filho no seguinte, cada um com o seu retrato.
  // Uma consulta pode ter mais balões do que passos, e tudo bem — o que não pode é uma medalha só
  // assinando o que duas pessoas disseram.
  // `renderStep()` roda de novo depois de CADA intervenção (notar o corpo, investigar, silêncio). Se a
  // fala fosse repartida do zero a cada vez, o jogador teria de passar mãe e filho outra vez a cada
  // gesto que nomeasse. Então só se reparte quando a fala mudou de verdade; senão, fica onde estava.
  if (session.falaCache !== falaToda) {
    session.falaCache = falaToda;
    // O PICO NÃO PRECISA DE EXCEÇÃO. Houve uma tentativa de não partir o passo do pico, para a palavra
    // acesa e o menu ficarem na mesma tela — mas isso desligava o corte em qualquer passo que por acaso
    // contivesse a palavra, inclusive a primeira fala do caso-tutorial. E era desnecessário: a palavra
    // acesa JÁ É a ação (clicar nela abre a escolha), então ela funciona num balão do meio; e o botão do
    // menu, que procura na fala inteira do passo, continua esperando no último balão. Dois caminhos.
    session.partes = partirFala(falaToda, sessionCase());
    session.parteIdx = 0;
  }
  mostrarParte(() => {
    box.classList.remove("hidden");
    if (session.stepIndex === 0) {
      coachTip("fala", "dialogue-text");
      coachTip("opcoes", "choices-container");
    }
    if (session.stepIndex === 1) coachTip("manual", "btn-manual");
    if (session.stepIndex === 0 && Dx.canShow()) coachTip("investigar", "btn-invest");
    if (state.energy < LOW_ENERGY) coachTip("energia", "stat-energy");
    if (session.tutorial && !state.tutorialDone) {
      if (session.stepIndex === 0) Tutor.run([{ key: "bubble", target: "dialogue-text" }, { key: "ficha", target: "btn-ficha" }, { key: "manual", target: "btn-manual" },
        { key: session.investigativa ? "escuta" : "choices", target: "choices-container", interactive: true, wait: true }]);   // a consulta de avaliação ensina a investigar, não a escolher a fala
      else if (session.stepIndex === 1) Tutor.run([{ key: "vinculo", target: "stat-vinculo" }]);
    }
    const showAp = settings.showApproach || (session.tutorial && !state.tutorialDone);
    if (session.investigativa && !step.branch) return escutaInvestigativa(step);

    const best = Math.max(...session.choices.map((x) => x.delta));
    const showBest = settings.dev && settings.showBest;
    const list = session.choices.slice();
    let locked = null;
    if (!session.secret && !step.branch && !(session.tutorial && !state.tutorialDone)) {
      const scores = {}; session.choices.forEach((x) => { scores[x.ap] = x.score; });
      const sp = Wheel.specialFor(step, session.key, scores);
      if (sp.unlocked) list.push({ ap: sp.ap, text: sp.text, score: 4, delta: DELTA[4], bonuses: [], tired: 0, special: true });
      else locked = sp;
    }
    list.forEach((choice, i) => {
      const ap = APPROACH[choice.ap];
      const btn = el("button", "choice-btn");
      btn.type = "button";
      if (showAp) {
        const chip = el("span", "ap-chip", `${ap.icon} ${ap.name}`);
        chip.style.borderColor = ap.color;
        chip.style.background = `${ap.color}22`;
        btn.appendChild(chip);
      }
      let label = `${String.fromCharCode(65 + i)}. ${choice.text}`;
      if (showBest) label += `  [${choice.delta > 0 ? "+" : ""}${choice.delta}${choice.delta === best ? " ★ ideal" : ""}]`;
      btn.appendChild(el("span", "choice-text", label));
      if (showBest && choice.delta === best) btn.classList.add("best");
      if (choice.special) { btn.classList.add("special"); btn.prepend(el("span", "ap-chip", `⭐ ${t("wheel.chip")}`)); }
      btn.addEventListener("click", () => selectChoice(choice));
      box.appendChild(btn);
    });
    if (locked) {
      const lb = el("button", "choice-btn locked", `🔒 ${t("wheel.locked", { type: t("wheel.type." + locked.ap) })}`);
      lb.type = "button"; lb.disabled = true;
      box.appendChild(lb);
    }
  });
}

// Toque no balão: se a fala ainda está sendo digitada, termina de digitar; se já terminou e há mais
// gente para falar, chama o próximo pedaço. Clicar numa palavra acesa continua sendo perguntar sobre
// ela — a palavra tem precedência, senão o gesto de investigar viraria o de passar a fala.
function skipTyping(e) {
  if (!session) return;
  if (e && e.target && e.target.closest && e.target.closest(".fala-gatilho, .fala-pico")) return;
  if (session.typing) { session.typing.finish(); return; }
  avancarFala(false);
}

function selectChoice(choice) {
  if (!session || !$("feedback-panel").classList.contains("hidden")) return;   // já respondida (clique duplo)
  const c = sessionCase();
  const step = session.steps[session.stepIndex];
  const good = choice.delta > 0;

  ClinicFSM.ir("reacao");
  const before = levelIndex(state.xp);
  session.points += QUALITY_POINTS[choice.score];   // uma resposta 'boa' não basta: só a ideal pontua cheio
  state.affinity = clamp(state.affinity + choice.delta, 0, 100);
  Wheel.record(choice);
  session.lastScore = choice.score;   // o clima da próxima fala depende desta resposta (dxlab.js)
  guardarFalaMarcante(choice);
  const shares = Dx.noteShared(choice);
  if (good) {
    session.goodChoices += 1;
    state.xp += choice.delta + Wheel.perk("xp");
  }
  // árvore de diálogo: uma resposta boa abre um diálogo extra (uma vez por consulta) com a reação do paciente
  if (choice.score >= 3 && !session.branched && !session.secret && !step.branch && !(session.tutorial && !state.tutorialDone)) {
    session.branched = true;
    session.steps.splice(session.stepIndex + 1, 0, Wheel.branchStep(step, choice.ap, session.key));
    session.totalSteps += 1;
    session.maxPoints += 4;
  }
  const leveledUp = levelIndex(state.xp) !== before;
  sfx(good ? "good" : choice.delta < 0 ? "bad" : "click");
  updateHud();
  saveState();

  coachTip("vinculo", "stat-vinculo");
  if (window.Scene3D && Scene3D.doctorSeq) Scene3D.doctorSeq(good ? [{ mode: "talk", ms: 2000 }, { mode: "write", ms: 2200 }] : [{ mode: "talk", ms: 2000 }]);
  if (good) {
    let news = false;
    if (step.note && shares && Sens.text(step.note)) { session.notes.push(Sens.text(step.note)); news = true; }
    Object.entries(FICHA_UNLOCK).forEach(([field, idx]) => {
      if (idx === session.stepIndex && !session.unlocked[field]) { session.unlocked[field] = true; news = true; }
    });
    if (news) {
      $("ficha-new").classList.remove("hidden");
      coachTip("ficha", "btn-ficha");
      setTimeout(() => sfx("unlock"), 350);
    }
  }

  // texto do feedback: abordagem, por que funcionou (ou não) e os fatores extras
  const ap = APPROACH[choice.ap];
  const why = (c.why && c.why[choice.ap]) || APPROACH_WHY[choice.ap] || "";
  const lines = [`${t("fb.approach", { ap: `${ap.icon} ${ap.name}` })}: ${t("eff." + choice.score)}.`, why];
  if (choice.tired) lines.push(t("fb.tired", { d: choice.tired }));
  if (good && step.note && !shares) lines.push(I18N.pick(Dx.GUARDED));
  choice.bonuses.forEach((b) => lines.push(t("fb.item", { item: b.item.name, d: `+${b.v}` })));
  if (leveledUp) lines.push(t("fb.levelup", { level: levelName(levelIndex(state.xp)) }));
  if (leveledUp) setTimeout(() => sfx("levelup"), 450);

  $("choices-container").classList.add("hidden");
  const panel = $("feedback-panel");
  panel.classList.remove("hidden", "good", "bad");
  panel.classList.add(good ? "good" : "bad");
  const d = `${choice.delta > 0 ? "+" : ""}${choice.delta}`;
  $("feedback-title").textContent = t(choice.delta > 0 ? "fb.good" : choice.delta === 0 ? "fb.ok" : "fb.bad", { d });
  $("feedback-text").textContent = lines.join("\n\n");
  if (session.tutorial && !state.tutorialDone) {
    Tutor.release();
    if (session.stepIndex === 0) setTimeout(() => { if (session && !state.tutorialDone) Tutor.run([{ key: "feedback", target: "feedback-panel" }]); }, 350);
  } else {
    $("btn-continue").focus({ preventScroll: true });
  }
}

// A cada passagem da máquina de estados, o jogo guarda o retrato dela na sessão — é isso que faz o
// "Continuar" voltar ao ponto exato, inclusive no meio da investigação.
if (typeof ClinicFSM !== "undefined") ClinicFSM.aoMudar(() => { if (session) session.fsm = ClinicFSM.guardar(); });

// Consulta de avaliação: em vez de quatro falas prontas, a pessoa fala e você decide o que perguntar.
// É o que muda o jogo de "escolher a resposta bonita" para "ouvir e ligar os pontos".
// Resultado de uma intervenção da escuta: mesma moldura do feedback, mas volta para a mesma fala.
function mostrarIntervencao(titulo, texto, ruim) {
  session.intervPendente = true;
  // O passo do tutorial que espera uma ação se satisfaz com QUALQUER intervenção, não só com
  // "deixar continuar": notar o corpo, responder a um pico ou nomear a contratransferência também
  // valem. Sem isto, quem notava o corpo ficava com o tutorial parado atrás deste painel.
  if (typeof Tutor !== "undefined" && Tutor.running()) Tutor.release();
  $("feedback-title").textContent = titulo;
  $("feedback-text").textContent = texto;
  $("feedback-panel").classList.remove("hidden");
  $("feedback-panel").classList.toggle("ruim", Boolean(ruim));
  $("choices-container").classList.add("hidden");
  $("btn-continue").textContent = t("city.ok");
  $("btn-continue").onclick = () => {
    $("btn-continue").onclick = null;
    $("feedback-panel").classList.add("hidden");
    $("feedback-panel").classList.remove("ruim");
    if (session) renderStep();
  };
}

// O pico em si: a pessoa no limite, e a escolha de com que lugar responder.
function abrirPico(p, eixos) {
  const box = $("invest-say-body");
  box.textContent = "";
  const cena = el("div", "say-row pat silencio");
  cena.appendChild(el("b", "", `💥 ${speakerInfo().name}`));
  cena.appendChild(el("p", "say-quote", p.gatilho));
  box.appendChild(cena);
  box.appendChild(el("p", "uni-q", t("consult.pico.pergunta")));
  eixos.forEach((eixo) => {
    const b = el("button", "choice-btn escuta-pico-eixo");
    b.type = "button";
    b.appendChild(el("b", null, `${eixo.icon} ${I18N.pick(eixo.name)}`));
    b.appendChild(el("small", "dx-hint", `${t("consult.pico.nivel")} ${Wheel.level(eixo.id)}`));
    b.addEventListener("click", () => {
      const r = Escuta.responderPico(eixo.id);
      if (!r) return;
      const cx2 = $("invest-say-body");
      cx2.textContent = "";
      if (r.fala) cx2.appendChild(falaDaDoutora(`— ${r.fala}`));
      const pat = el("div", "say-row pat" + (r.bom ? "" : " guard"));
      pat.appendChild(el("b", "", `💬 ${speakerInfo().name}`));
      pat.appendChild(el("p", "say-quote", r.resposta));
      pat.appendChild(el("small", "", r.ganho));
      cx2.appendChild(pat);
      const f = el("button", "pill-btn primary", t("city.ok"));
      f.type = "button";
      f.addEventListener("click", () => { closeModal("invest-say"); if (session) renderStep(); });
      cx2.appendChild(f);
    });
    box.appendChild(b);
  });
  openModal("invest-say");
}

function escutaInvestigativa(step) {
  const cx = $("choices-container");
  cx.textContent = "";
  cx.classList.remove("hidden");
  $("feedback-panel").classList.add("hidden");

  const podePerguntar = Dx.canShow() && Dx.introduced() && Dx.asksLeft() > 0 && Dx.budgetLeft() >= 6;   // no passo 0 a pessoa ainda está se apresentando
  const inv = el("button", "choice-btn escuta-inv" + (podePerguntar ? "" : " gasto"));
  inv.type = "button";
  inv.appendChild(el("b", null, `🔎 ${t("consult.listen.ask")}`));
  inv.appendChild(el("small", "dx-hint", podePerguntar
    ? t("consult.listen.ask.hint", { n: Dx.asksLeft() })
    : Dx.introduced() ? t("consult.listen.ask.none") : t("consult.listen.ask.wait")));
  inv.disabled = !podePerguntar;
  inv.addEventListener("click", () => Dx.openInvest());
  cx.appendChild(inv);

  // 👁️ notar o corpo: só aparece quando a fala tem uma marca de corpo e ainda há tempo de sessão
  const falaAtual = $("dialogue-text") ? $("dialogue-text").textContent : "";
  if (typeof Escuta !== "undefined" && Escuta.podeNotarCorpo(falaAtual)) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("corpo"), 600);   // se explica na 1ª vez que aparece
    const olho = el("button", "choice-btn escuta-corpo");
    olho.type = "button";
    olho.appendChild(el("b", null, `👁️ ${t("consult.listen.body")} (${Escuta.corposRestantes()})`));   // quantas ainda cabem nesta consulta
    olho.appendChild(el("small", "dx-hint", t("consult.listen.body.hint", { n: Escuta.CUSTO_CORPO, max: Escuta.LIMITE_CORPO })));
    olho.addEventListener("click", () => {
      const r = Escuta.notarCorpo(falaAtual);
      if (!r) return;
      mostrarIntervencao(`👁️ ${t("consult.listen.body")}`, `${r.texto}\n${r.ganho}`);
    });
    cx.appendChild(olho);
  }

  // 💥 Pico emocional: a palavra que carrega o instante fica acesa na fala, e responder é escolher
  // DE QUE LUGAR você fala — cada opção é um eixo da Roda. É a única hora em que a competência que
  // você treinou decide o que a pessoa consegue alcançar.
  // A fala vai partida por quem fala, e o balão na tela é só UM pedaço. O pico é o instante decisivo do
  // caso: ele não pode depender de em qual balão o jogador parou. Por isso a procura corre a fala
  // INTEIRA do passo (`session.falaCache`), enquanto a palavra acesa continua aparecendo no pedaço em
  // que ela realmente foi dita.
  const opico = typeof Escuta !== "undefined" ? Escuta.pico(session.falaCache || undefined) : null;
  if (opico) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("pico"), 500);
    const eixos = Escuta.eixosDoPico(opico);
    const b = el("button", "choice-btn escuta-pico");
    b.type = "button";
    b.appendChild(el("b", null, `💥 ${t("consult.pico")}`));
    b.appendChild(el("small", "dx-hint", eixos.length ? t("consult.pico.hint", { n: Escuta.CUSTO_PICO }) : t("consult.pico.sem")));
    b.disabled = !eixos.length;
    if (!eixos.length) b.classList.add("gasto");
    b.addEventListener("click", () => abrirPico(opico, eixos));
    cx.appendChild(b);
  }

  // Contratransferência: aparece no mesmo lugar da intuição, porque é assim que ela chega — parecendo
  // leitura clínica. Enquanto estiver na tela, o jogador escolhe entre agir por ela ou nomeá-la.
  const contra = typeof Escuta !== "undefined" ? Escuta.contratransferencia() : null;
  if (contra) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("contra"), 600);
    const cai = (r) => { if (!r) return; mostrarIntervencao(`${contra.icone} ${t("consult.contra")}`, `${r.nome}\n\n${r.texto}\n${r.ganho}`, !r.bom); };
    const nomear = el("button", "choice-btn escuta-contra");
    nomear.type = "button";
    nomear.appendChild(el("b", null, `🪞 ${t("consult.contra.name")}`));
    nomear.appendChild(el("small", "dx-hint", t("consult.contra.name.hint", { n: Escuta.CUSTO_CONTRA })));
    nomear.addEventListener("click", () => cai(Escuta.nomearContra()));
    cx.appendChild(nomear);
    const agir = el("button", "choice-btn escuta-contra-agir");
    agir.type = "button";
    agir.appendChild(el("b", null, `${contra.icone} ${t("consult.contra.act")}`));
    agir.appendChild(el("small", "dx-hint", t("consult.contra.act.hint")));
    agir.addEventListener("click", () => cai(Escuta.agirContra()));
    cx.appendChild(agir);
  }

  // 🧾 apresentar um achado: só quando a ficha já tem a prova que contradiz a explicação que a família traz
  if (typeof Escuta !== "undefined" && Escuta.podeConfrontar()) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("confronto"), 600);
    const c = Escuta.confrontoDe(Dx.cur());
    const prova = el("button", "choice-btn escuta-confronto");
    prova.type = "button";
    prova.appendChild(el("b", null, `🧾 ${t("consult.listen.confront")}`));
    prova.appendChild(el("small", "dx-hint", t("consult.listen.confront.hint", { n: Escuta.CUSTO_CONFRONTO })));
    prova.addEventListener("click", () => abrirConfronto(c));
    cx.appendChild(prova);
  }

  const ultimo = session.stepIndex + 1 >= session.steps.length;
  const segue = el("button", "choice-btn escuta-segue");
  segue.type = "button";
  segue.appendChild(el("b", null, ultimo ? `✓ ${t("consult.listen.close")}` : `▶ ${t("consult.listen.next")}`));
  segue.appendChild(el("small", "dx-hint", ultimo ? t("consult.listen.close.hint") : t("consult.listen.next.hint")));
  segue.addEventListener("click", () => avancarEscuta());
  cx.appendChild(segue);

  $("progress-fill").style.width = `${Dx.progress() * 100}%`;
  void step;
}

// O CONFRONTO EM DUAS PERGUNTAS. Apresentar uma prova não é mostrar um fato solto: é dizer POR QUE
// aquele fato desmente a explicação que a família trouxe. Por isso o painel pede as duas coisas —
// QUAL achado você põe na mesa e QUAL critério do Manual ele preenche. É aqui que o Manual deixa de
// ser leitura e vira instrumento, no único momento em que isso importa.
function abrirConfronto(c) {
  const k = Dx.cur(), b = Dx.book(k);
  const box = $("invest-say-body");
  box.textContent = "";
  const cena = el("div", "say-row pat");
  cena.appendChild(el("b", "", `💬 ${speakerInfo().name}`));
  cena.appendChild(el("p", "say-quote", `“${I18N.pick(c.crenca)}”`));
  box.appendChild(cena);
  box.appendChild(el("p", "shop-note", t("confronto.como")));

  let achado = null, criterio = null;
  const achados = Dx.foundList(k);
  const hip = b.hyp || null;
  const crits = hip ? Dx.criterios(hip) : [];

  const grupo = (titulo, itens, rotulo, marcado, aoEscolher) => {
    const g = el("div", "conf-grupo");
    g.appendChild(el("h4", "conf-h", titulo));
    itens.forEach((it) => {
      const b2 = el("button", "pill-btn small conf-op" + (marcado() === (it.id || it) ? " on" : ""), rotulo(it));
      b2.type = "button";
      b2.addEventListener("click", () => { aoEscolher(it.id || it); render(); });
      g.appendChild(b2);
    });
    box.appendChild(g);
  };

  function render() {
    box.textContent = "";
    box.appendChild(cena);
    box.appendChild(el("p", "shop-note", t("confronto.como")));
    grupo(t("confronto.qualachado"), achados, (d2) => I18N.pick(d2.name), () => achado, (v) => { achado = v; });
    if (crits.length) grupo(t("confronto.qualcriterio"), crits, (x) => I18N.pick(x.t || x.name || x), () => criterio, (v) => { criterio = v; });
    else box.appendChild(el("p", "dx-hint", t("confronto.semhip")));
    const btns = el("div", "say-btns");
    const vai = el("button", "pill-btn primary", `🧾 ${t("confronto.apresentar")}`);
    vai.type = "button";
    vai.disabled = !achado;
    vai.addEventListener("click", () => {
      const r = Escuta.confrontar(achado, crits.length ? criterio : undefined);
      closeModal("invest-say");
      if (!r) return;
      mostrarIntervencao(`🧾 ${t("consult.listen.confront")}`, `${r.crenca}\n\n— ${r.fala}\n\n${r.resposta}\n${r.ganho}`, !r.bom);
    });
    const volta = el("button", "pill-btn", t("confronto.agoranao"));
    volta.type = "button";
    volta.addEventListener("click", () => closeModal("invest-say"));
    btns.appendChild(volta); btns.appendChild(vai);
    box.appendChild(btns);
  }
  render();
  openModal("invest-say");
}

// avança a consulta de avaliação (o equivalente ao "Continuar" das sessões com escolhas)
// Despedida da psicóloga: a consulta não acaba no meio de uma frase. O que ela diz depende de como
// a sessão foi — houve catarse, a pessoa se abriu, ou a hora acabou antes de a conversa aquecer.
const pk = (pt, en, es) => I18N.pick(L(pt, en, es));

function falaDeDespedida() {
  const k = session.key, b = typeof Dx !== "undefined" && Dx.kase(k) ? Dx.book(k) : {};
  const ultima = session.sess >= FU.SESSIONS;
  const bom = state.affinity >= 70, achados = Object.keys(b.found || {}).length;
  // PERGUNTA NO AR NÃO SE DEIXA CAIR. Quando a última coisa que a pessoa disse foi uma pergunta direta
  // ("isso tem nome, doutora?"), encerrar com um "a hora acabou" genérico é frio e, clinicamente, é o
  // pior jeito de fechar: a pessoa vai embora com a pergunta na boca. A despedida passa a reconhecer que
  // a pergunta existe, dizer por que ela não se responde no susto, e marcar que ela volta na próxima.
  const falaFinal = String((session.falaCache || "")).trim();
  if (/\?\s*['"”’)]*\s*$/.test(falaFinal)) {
    return ultima
      ? pk("“Você me fez uma pergunta, e ela merece resposta com calma — não de pé, na porta. É exatamente ela que eu vou responder na devolutiva, com o que a gente reuniu nestas semanas. Anote a pergunta do jeito que você fez, para não perdermos o jeito dela.”",
           "“You asked me a question, and it deserves a calm answer — not one given standing at the door. It is exactly that question I will answer in the feedback session, with everything we gathered these weeks. Write it down the way you asked it, so we don't lose its shape.”",
           "“Me hiciste una pregunta, y merece una respuesta con calma, no de pie en la puerta. Es justo esa la que voy a responder en la devolutiva, con lo que reunimos estas semanas.”")
      : pk("“Você me fez uma pergunta boa, e eu não vou responder no susto: responder rápido agora seria chutar, e chutar aqui custa caro. Vou levar essa pergunta comigo e trazer o que eu tiver na próxima. Ela não vai se perder.”",
           "“You asked me a good question, and I am not going to answer it in a rush: answering fast now would be guessing, and guessing here is costly. I will take that question with me and bring what I have next time. It will not get lost.”",
           "“Me hiciste una buena pregunta, y no voy a responderla al apuro: responder rápido ahora sería adivinar, y adivinar aquí cuesta caro. Me llevo esa pregunta y traigo lo que tenga la próxima vez.”");
  }
  if (b.catarse) return pk("“Vamos parar por aqui hoje. O que aconteceu nesta sala agora foi importante, e eu quero que você leve isso com calma para casa — não precisa resolver nada até a próxima.”",
                           "“Let's stop here for today. What happened in this room just now mattered, and I want you to take it home gently — you don't need to resolve anything before next time.”",
                           "“Paremos aquí por hoy. Lo que pasó en esta sala ahora fue importante, y quiero que te lo lleves con calma a casa: no hace falta resolver nada hasta la próxima.”");
  if (ultima) return pk("“Nosso tempo de avaliação chega ao fim. Obrigada por ter contado o que contou — nada disso era fácil de dizer em voz alta.”",
                        "“Our assessment time comes to an end. Thank you for telling me what you told me — none of it was easy to say out loud.”",
                        "“Nuestro tiempo de evaluación llega a su fin. Gracias por contarme lo que contaste: nada de eso era fácil de decir en voz alta.”");
  if (bom && achados >= 3) return pk("“Nossa hora acabou. Você trouxe bastante coisa hoje, e eu fiquei com o que você disse. Continuamos na próxima.”",
                                     "“Our time is up. You brought a lot today, and what you said stayed with me. We continue next time.”",
                                     "“Se nos acabó la hora. Trajiste bastante hoy, y me quedé con lo que dijiste. Seguimos la próxima.”");
  if (achados === 0) return pk("“A hora passou rápido. Fica para a próxima, então — e não tem problema nenhum em a gente ir devagar.”",
                               "“The hour went by fast. Let's leave it for next time, then — and there is nothing wrong with going slowly.”",
                               "“La hora pasó rápido. Lo dejamos para la próxima, entonces, y no pasa nada por ir despacio.”");
  return pk("“Vamos ficar por aqui hoje. Obrigada por ter vindo — a gente retoma de onde parou na próxima.”",
            "“Let's leave it here today. Thank you for coming — we'll pick up where we left off next time.”",
            "“Lo dejamos aquí por hoy. Gracias por venir: retomamos donde lo dejamos la próxima.”");
}

function despedir(aoFim) {
  session.despediu = true;
  const box = $("invest-say-body");
  box.textContent = "";
  box.appendChild(falaDaDoutora(falaDeDespedida()));
  box.appendChild(el("p", "shop-note", t("consult.fim.nota", { n: Math.round(Dx.budgetLeft ? Dx.INV_BUDGET - Dx.budgetLeft() : 0) })));
  const ok = el("button", "pill-btn primary", t("consult.fim.ok"));
  ok.type = "button";
  ok.addEventListener("click", () => { closeModal("invest-say"); aoFim(); });
  box.appendChild(ok);
  openModal("invest-say");
}

function avancarEscuta() {
  if (!session) return;
  if (typeof Tutor !== "undefined" && Tutor.running()) Tutor.release();   // o passo interativo do tutorial se satisfaz com qualquer das duas ações
  const c = sessionCase();
  // último passo: a psicóloga se despede antes de a tela mudar (o corte seco era brusco demais)
  if (session.stepIndex + 1 >= session.steps.length && !session.despediu && session.investigativa) {
    despedir(() => avancarEscuta());
    return;
  }
  if (session.stepIndex + 1 >= session.steps.length) {
    if (c.diagnosis && !session.secret && session.sess >= FU.SESSIONS) { session.stepIndex += 1; startDiagnosis(); return; }
    session.stepIndex += 1;
    finishSession();
    return;
  }
  session.stepIndex += 1;
  renderStep();
  saveState();
}

function continueDialogue() {
  if (!session || $("feedback-panel").classList.contains("hidden")) return;   // só depois de responder
  // Intervenções da escuta (notar o corpo, apresentar um achado) mostram o resultado no mesmo painel,
  // mas NÃO são uma resposta: fechar o aviso volta para a mesma fala. Sem isto, notar o corpo comia
  // um passo do diálogo de graça (bug desde a 4.14) e podia encerrar a consulta no último passo.
  if (session.intervPendente) { session.intervPendente = false; return; }
  const c = sessionCase();
  if (session.phase === "tx") {   // depois do encaminhamento: laudo e devolutiva jogáveis (só com caso investigável)
    if (Dx.active() && !session.secret && !session.laudo) { PsicoDx.openLaudo(() => PsicoDx.openDevol(() => finishSession())); return; }
    finishSession(); return;
  }
  if (session.phase === "dx") { startTreatment(); return; }
  if (session.stepIndex + 1 >= session.steps.length) {
    if (c.diagnosis && !session.secret && session.sess >= FU.SESSIONS) { startDiagnosis(); return; }   // diagnóstico só na última consulta
    session.stepIndex += 1;
    finishSession();
    return;
  }
  session.stepIndex += 1;
  renderStep();
  saveState();   // salva o passo novo (sem isto, fechar o jogo aqui perdia o avanço até a próxima resposta)
}

// ---------------------------------------------------------------- hipótese diagnóstica (fim da consulta)
function disorderName(id) {
  for (const g of MANUAL_GROUPS) {
    const d = g.disorders.find((x) => x.id === id);
    if (d) return d.name;
  }
  return id;
}

function startDiagnosis() {
  if (!PsicoDx.canStart(startDiagnosis)) return;   // diagnóstico diferencial: descartar as hipóteses concorrentes antes de fechar
  window.scrollTo(0, 0);
  const c = sessionCase();
  session.phase = "dx";
  ClinicFSM.ir("hipotese");
  $("progress-fill").style.width = "100%";
  $("feedback-panel").classList.add("hidden");
  const box = $("choices-container");
  box.textContent = "";
  box.classList.add("hidden");
  setTimeout(() => Tutor.topic("dxlate", [{ key: "dx", target: "choices-container" }]), 900);
  unlockManual(c.diagnosis.options);   // paciente novo, diagnósticos novos: passam a constar no Manual
  typeText($("dialogue-text"), t("dx.prompt", { name: c.name }), () => {
    box.classList.remove("hidden");
    box.appendChild(el("p", "dx-head", t("dx.head")));
    shuffle(Wheel.filterOptions(session.key, c.diagnosis.options)).forEach((id, i) => {
      const btn = el("button", "choice-btn dx-btn");
      btn.type = "button";
      btn.appendChild(el("span", "choice-text", `${String.fromCharCode(65 + i)}. ${disorderName(id)}`));
      btn.addEventListener("click", () => selectDx(id));
      box.appendChild(btn);
    });
    if (session.tutorial && !state.tutorialDone) Tutor.run([{ key: "dx", target: "choices-container", interactive: true, wait: true }]);
  });
}

function selectDx(id) {
  if (!session || session.dx) return;
  const c = sessionCase();
  const ok = id === c.diagnosis.answer;
  const rv = Dx.review(id, ok);
  session.dx = { id, ok, review: rv };
  const before = levelIndex(state.xp);
  if (ok) state.xp += Math.max(2, 10 + rv.bonus);
  sfx(ok ? "good" : "bad");
  updateHud();
  saveState();
  const lines = [];
  if (!ok) lines.push(t("dx.answer", { name: disorderName(c.diagnosis.answer) }));
  lines.push(Sens.text(c.diagnosis.why, ""));
  rv.lines.forEach((x) => lines.push(x));
  lines.push(t("dx.disclaimer"));
  if (ok && levelIndex(state.xp) !== before) lines.push(t("fb.levelup", { level: levelName(levelIndex(state.xp)) }));
  $("choices-container").classList.add("hidden");
  const panel = $("feedback-panel");
  panel.classList.remove("hidden", "good", "bad");
  panel.classList.add(ok ? "good" : "bad");
  $("feedback-title").textContent = t(ok ? "dx.right" : "dx.wrong");
  $("feedback-text").textContent = lines.join("\n\n");
  if (session.tutorial && !state.tutorialDone) Tutor.release();
  $("btn-continue").focus({ preventScroll: true });
}

// ---------------------------------------------------------------- encaminhamento (depois do diagnóstico, na 4ª consulta)
function startTreatment() {
  window.scrollTo(0, 0);
  const c = sessionCase();
  session.phase = "tx";
  ClinicFSM.ir("conduta");
  $("feedback-panel").classList.add("hidden");
  const box = $("choices-container");
  box.textContent = "";
  box.classList.add("hidden");
  typeText($("dialogue-text"), t("fu.tx.prompt", { name: c.name }), () => {
    box.classList.remove("hidden");
    box.appendChild(el("p", "dx-head", t("fu.tx.head")));
    shuffle(FU.TX_OPTIONS).forEach((id, i) => {
      const btn = el("button", "choice-btn dx-btn");
      btn.type = "button";
      btn.appendChild(el("span", "choice-text", `${String.fromCharCode(65 + i)}. ${t("fu.tx." + id)}`));
      btn.addEventListener("click", () => selectTx(id));
      box.appendChild(btn);
    });
  });
}

function selectTx(id) {
  if (!session || session.tx) return;
  const c = sessionCase();
  const ok = id === FU.txAnswer(session.key);
  session.tx = { id, ok };
  if (ok) state.xp += 5;
  sfx(ok ? "good" : "bad");
  updateHud();
  saveState();
  const lines = [t("fu.txwhy." + FU.txAnswer(session.key))];
  if (!ok) lines.unshift(t("fu.tx.answer", { name: t("fu.tx." + FU.txAnswer(session.key)) }));
  lines.push(t("fu.tx.disclaimer"));
  $("choices-container").classList.add("hidden");
  const panel = $("feedback-panel");
  panel.classList.remove("hidden", "good", "bad");
  panel.classList.add(ok ? "good" : "bad");
  $("feedback-title").textContent = t(ok ? "fu.tx.right" : "fu.tx.wrong");
  $("feedback-text").textContent = lines.join("\n\n");
  $("btn-continue").focus({ preventScroll: true });
}

// ---------------------------------------------------------------- ficha do paciente
function renderFicha() {
  const c = sessionCase();
  const fields = $("ficha-fields");
  fields.textContent = "";
  [
    ["ficha.name", c.name, true],
    ["ficha.age", c.age, true],
    ["ficha.complaint", Sens.text(c.complaint), session.unlocked.queixas],
    ["ficha.history", Sens.text(c.history), session.unlocked.historia]
  ].concat(typeof Risk !== "undefined" && Risk.warnLabel(session.key) ? [["ficha.warn", Risk.warnLabel(session.key), true]] : []).forEach(([key, value, open]) => {
    fields.appendChild(el("dt", null, `${t(key)}:`));
    fields.appendChild(el("dd", open ? null : "locked", open ? value : t("ficha.locked")));
  });
  const list = $("ficha-notes-list");
  list.textContent = "";
  session.notes.forEach((n) => list.appendChild(el("li", null, n)));
  Dx.renderFicha();
}

// ---------------------------------------------------------------- habilidades ativas da Roda (7.4)
// Laudo e Articulação cresciam sem nunca aparecer na consulta. Agora cada um tem um botão, com uso
// contado (um por consulta; dois na maestria), e o resultado chega pela caixa de intuição — é ali que
// o jogo já põe o que se passa na cabeça da psicóloga.
function atualizarHabilidades() {
  const bs = $("btn-sintese"), bp = $("btn-parecer");
  if (!bs || !bp || typeof Wheel === "undefined") return;
  const pode = (k) => Boolean(Wheel.podeUsar && Wheel.podeUsar(k));
  const mostra = (el2, k, eixo, rotulo) => {
    const visivel = Boolean(session && !session.secret && Wheel.active(eixo));
    el2.classList.toggle("hidden", !visivel);
    if (!visivel) return;
    el2.disabled = !pode(k);
    const sobra = Math.max(0, (Wheel.usosDe(eixo) || 1) - (Wheel.usados(k) || 0));
    el2.textContent = `${rotulo}${sobra > 1 ? ` (${sobra})` : ""}`;
  };
  mostra(bs, "sintese", "laudo", `📝 ${I18N.pick(window.L("Formular síntese", "Draft a synthesis", "Formular síntesis"))}`);
  mostra(bp, "parecer", "multi", `🩺 ${I18N.pick(window.L("Pedir parecer", "Ask for an opinion", "Pedir parecer"))}`);
  // mecânica nova se explica na primeira vez em que aparece
  if ((!bs.classList.contains("hidden") || !bp.classList.contains("hidden")) && typeof Tips !== "undefined") setTimeout(() => Tips.fire("habilidades"), 600);
}

function usarHabilidade(kind) {
  if (!session || typeof Wheel === "undefined" || !Wheel.podeUsar(kind)) return;
  const r = kind === "sintese" ? Wheel.sintese(session.key) : Wheel.parecer(session.key);
  atualizarHabilidades();
  if (!r) return;
  if (typeof Escuta !== "undefined" && Escuta.pensar) Escuta.pensar(r.texto);
  else showToast(r.texto.split("\n")[0]);
  saveState(); updateHud();
}

function openFicha() {
  if (!session) return;
  renderFicha();
  $("ficha-new").classList.add("hidden");
  openModal("ficha-modal");
}

// ---------------------------------------------------------------- manual diagnóstico
let manualView = { level: "index", groupId: null, disorder: null };

function manualRow(text, { highlight = false, disabled = false, badge = "", sub = null, onClick } = {}) {
  const btn = el("button", "manual-row");
  btn.type = "button";
  const box = el("span", "manual-row-main");
  box.appendChild(el("span", "manual-row-text", text));
  if (sub) box.appendChild(sub);
  btn.appendChild(box);
  if (badge) btn.appendChild(el("span", "manual-badge", badge));
  if (highlight) btn.classList.add("highlight");
  btn.disabled = disabled;
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}

// ---------------------------------------------------------------- pesquisa no Manual
// Sem acento e sem diferenciar maiúsculas; todos os termos precisam aparecer no mesmo transtorno (nome, grupo, critérios, diferenciais, dica).
const normSearch = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function searchTokens(q) { return normSearch(q).split(/\s+/).filter((x) => x.length >= 2 || /\d/.test(x)); }

function manualSearch(q) {
  const tokens = searchTokens(q);
  if (!tokens.length) return null;
  const res = [];
  MANUAL_GROUPS.forEach((g) => {
    if (tokens.every((tk) => normSearch(g.title).includes(tk))) res.push({ score: 60, kind: "group", g });
    g.disorders.forEach((d) => {
      if (!d.items || !d.items.length || !manualIsOpen(d)) return;
      const parts = [["name", d.name, 10], ["intro", d.intro, 3], ...d.items.map((x) => ["item", x, 2]), ...(d.diff || []).map((x) => ["diff", x, 2]), ["tip", d.tip, 2]];
      const all = normSearch([g.title, d.name, d.intro, ...d.items, ...(d.diff || []), d.tip].join(" "));
      if (!tokens.every((tk) => all.includes(tk))) return;
      let score = 0, snip = null;
      parts.forEach(([k, txt, w]) => {
        if (!txt) return;
        const n = normSearch(txt), hits = tokens.filter((tk) => n.includes(tk)).length;
        if (hits) { score += w * hits; if (!snip && k !== "name" && hits === tokens.length) snip = { k, txt }; }
      });
      if (!snip) { const first = parts.find(([k, txt]) => k !== "name" && txt && tokens.some((tk) => normSearch(txt).includes(tk))); if (first) snip = { k: first[0], txt: first[1] }; }
      if (normSearch(d.name).startsWith(tokens[0])) score += 20;
      res.push({ score, kind: "disorder", g, d, snip });
    });
  });
  return res.sort((a, b) => b.score - a.score).slice(0, 60);
}

// escreve o texto dentro de "parent" com os termos achados em <mark>; recorta um trecho em torno do primeiro (se for longo)
function fillHighlighted(parent, text, tokens, max) {
  const n = normSearch(text);
  let a = 0, b = text.length;
  if (max && text.length > max) {
    const at = Math.min(...tokens.map((tk) => { const i = n.indexOf(tk); return i < 0 ? 1e9 : i; }));
    a = Math.max(0, (at === 1e9 ? 0 : at) - Math.floor(max / 3)); b = Math.min(text.length, a + max);
    if (a > 0) parent.appendChild(document.createTextNode("…"));
  }
  const marks = [];
  tokens.forEach((tk) => { let i = n.indexOf(tk); while (i >= 0) { marks.push([i, i + tk.length]); i = n.indexOf(tk, i + tk.length); } });
  marks.sort((x, y) => x[0] - y[0]);
  let pos = a;
  marks.forEach(([s0, e0]) => {
    if (e0 <= pos || s0 >= b) return;
    const s1 = Math.max(s0, pos), e1 = Math.min(e0, b);
    if (s1 > pos) parent.appendChild(document.createTextNode(text.slice(pos, s1)));
    parent.appendChild(el("mark", null, text.slice(s1, e1)));
    pos = e1;
  });
  if (pos < b) parent.appendChild(document.createTextNode(text.slice(pos, b)));
  if (b < text.length) parent.appendChild(document.createTextNode("…"));
}

function renderManualSearch(body) {
  const q = manualView.q || "";
  const tokens = searchTokens(q);
  const results = manualSearch(q);
  const fechados = MANUAL_GROUPS.reduce((a, g) => { const c = manualCounts(g); return a + (c.total - c.open); }, 0);
  if (!results) { body.appendChild(el("p", "muted", t("manual.search.hint"))); return; }
  if (!results.length) {
    body.appendChild(el("p", "muted", t("manual.search.none", { q: q.trim() })));
    if (fechados) body.appendChild(el("p", "manual-locked", t("manual.search.locked", { n: fechados })));
    return;
  }
  body.appendChild(el("p", "manual-count", t("manual.search.count", { n: results.length })));
  results.forEach((r) => {
    const sub = el("span", "manual-row-sub");
    if (r.kind === "disorder") {
      sub.appendChild(el("span", "manual-where", t("manual.search.in", { g: r.g.title })));
      if (r.snip) { sub.appendChild(document.createTextNode(" · " + t("manual.f." + r.snip.k) + ": ")); fillHighlighted(sub, r.snip.txt, tokens, 110); }
    } else sub.appendChild(el("span", "manual-where", t("manual.search.group")));
    const label = r.kind === "group" ? r.g.title : r.d.name;
    body.appendChild(manualRow(label, {
      sub,
      onClick: () => { manualView = r.kind === "group" ? { level: "group", groupId: r.g.id, disorder: null, from: "search", q } : { level: "disorder", groupId: r.g.id, disorder: r.d, from: "search", q }; renderManual(); }
    }));
  });
}

function renderManual() {
  const body = $("manual-body");
  body.textContent = "";
  const v = manualView;
  // ao trocar de idioma o conteúdo é remontado: reencontra o grupo e o transtorno pelo id
  if (v.groupId) { const g0 = MANUAL_GROUPS.find((g) => g.id === v.groupId); if (g0 && v.disorder) v.disorder = g0.disorders.find((x) => x.id === v.disorder.id) || v.disorder; }
  const top = v.level === "index" || v.level === "search";
  $("manual-tabs").classList.toggle("hidden", !top);
  $("manual-tab-index").classList.toggle("on", v.level === "index");
  $("manual-tab-search").classList.toggle("on", v.level === "search");
  $("manual-search").classList.toggle("hidden", v.level !== "search");
  $("hint-box").classList.toggle("hidden", v.level !== "index");
  $("manual-back").classList.toggle("hidden", top);

  if (v.level === "search") {
    $("manual-title").textContent = t("manual.title");
    $("manual-intro").textContent = "";
    renderManualSearch(body);
    return;
  }

  if (v.level === "index") {
    $("manual-title").textContent = t("manual.title");
    $("manual-intro").textContent = t("manual.pick");
    const own = session ? sessionCase().group : null;
    MANUAL_GROUPS.forEach((g) => {
      const marked = Boolean(session && session.hintPaid && g.id === own);
      const cnt = manualCounts(g);
      const sub = g.kind === "approach" || g.id === "guia" ? null : el("span", "manual-row-sub", t("manual.count", { a: cnt.open, b: cnt.total }));
      body.appendChild(manualRow(g.title, {
        highlight: marked, badge: marked ? t("manual.badge") : "", sub,
        onClick: () => { manualView = { level: "group", groupId: g.id, disorder: null }; renderManual(); }
      }));
    });
    const btn = $("btn-hint"), info = $("hint-text");
    if (session && session.hintPaid) {
      btn.classList.add("hidden");
      const g = MANUAL_GROUPS.find((x) => x.id === own);
      info.textContent = g ? t("manual.hintfound", { group: g.title }) : "";
    } else {
      btn.classList.remove("hidden");
      btn.textContent = t("manual.hintbuy", { n: HINT_COST });
      btn.disabled = !session || state.coins < HINT_COST;
      info.textContent = !session ? "" : t(state.coins < HINT_COST ? "manual.hintlow" : "manual.hintok", { n: state.coins });
    }
    return;
  }

  const group = MANUAL_GROUPS.find((g) => g.id === v.groupId);
  if (v.level === "group") {
    $("manual-title").textContent = group.title;
    $("manual-intro").textContent = group.disorders.length ? t(group.kind === "approach" ? "manual.pickapproach" : "manual.pickdisorder") : "";
    if (!group.disorders.length) body.appendChild(el("p", "muted", t("manual.empty")));
    const cg = manualCounts(group);
    group.disorders.filter(manualIsOpen).forEach((d) => {
      body.appendChild(manualRow(d.name, {
        disabled: !d.items || !d.items.length,
        badge: d.items && d.items.length ? "" : t("manual.soon"),
        onClick: () => { manualView = { level: "disorder", groupId: group.id, disorder: d }; renderManual(); }
      }));
    });
    if (cg.total - cg.open > 0) body.appendChild(el("p", "manual-locked", t("manual.locked.note", { n: cg.total - cg.open })));
    return;
  }

  const d = v.disorder;
  $("manual-title").textContent = d.name;
  $("manual-intro").textContent = d.intro || "";
  const ol = el("ol", "manual-items");
  d.items.forEach((text) => ol.appendChild(el("li", null, text)));
  body.appendChild(ol);
  if (d.diff && d.diff.length) {
    const box = el("div", "manual-extra");
    box.appendChild(el("h3", null, t("manual.diff")));
    const ul = el("ul");
    d.diff.forEach((x) => ul.appendChild(el("li", null, x)));
    box.appendChild(ul);
    body.appendChild(box);
  }
  if (d.tip) {
    const box = el("div", "manual-extra manual-tip");
    box.appendChild(el("h3", null, t("manual.tip")));
    box.appendChild(el("p", null, d.tip));
    body.appendChild(box);
  }
}

function manualBack() {
  const v = manualView;
  if (v.from === "search" && v.level !== "disorder") manualView = { level: "search", q: v.q || "" };
  else if (v.level === "disorder") manualView = v.from === "search" ? { level: "search", q: v.q || "" } : { level: "group", groupId: v.groupId, disorder: null };
  else manualView = { level: "index", groupId: null, disorder: null };
  renderManual();
  if (manualView.level === "search") $("manual-q").value = manualView.q || "";
}

function manualTab(which) {
  manualView = which === "search" ? { level: "search", q: (manualView.q || "") } : { level: "index", groupId: null, disorder: null };
  renderManual();
  if (which === "search") { $("manual-q").value = manualView.q; $("manual-q").focus(); }
}

function manualSearchInput(value) {
  manualView = { level: "search", q: value };
  renderManual();
}

function openManual() {
  manualView = { level: "index", groupId: null, disorder: null };
  $("manual-q").value = "";
  renderManual();
  openModal("manual-modal");
}

function buyHint() {
  if (!session || session.hintPaid || state.coins < HINT_COST) return;
  state.coins -= HINT_COST;
  session.hintPaid = true;
  sfx("buy");
  saveState();
  updateHud();
  renderManual();
}

// ---------------------------------------------------------------- resultado da consulta
function advanceSchedule(dayKey) {
  state.apptIndex += 1;
  if (state.apptIndex >= SCHEDULE[dayKey].length) {
    // sexta fecha a semana na hora; nos outros dias o expediente acaba, o jogador fica livre e só o sono começa o dia seguinte
    if (state.dayIndex >= DAYS.length - 1) advanceDay(false);
    else state.dayOver = true;
  }
}

let afterResult = "home";   // o que o botão do resultado faz: "home" | "break" | "secret"

function finishSession() {
  ClinicFSM.ir("fechamento");
  const s = session;
  const c = sessionCase();
  let stars;
  if (s.secret) {
    const r = s.goodChoices / s.totalSteps;
    stars = r === 1 ? 3 : r >= 0.5 ? 2 : 1;
  } else if (s.manut) {
    // sessão de acompanhamento: 0 a 3 estrelas pela qualidade; o que sobe é o Progresso Terapêutico
    const q = Math.max(0, s.points) / s.maxPoints;
    stars = q >= 0.9 ? 3 : q >= 0.7 ? 2 : q >= 0.4 ? 1 : 0;
    s.manutResult = Care.finish(s.key, q);
  } else {
    // conversa: 0 a 2 estrelas pela qualidade das abordagens; hipótese diagnóstica certa: +1
    const q = Math.max(0, s.points) / s.maxPoints;
    stars = s.sess >= FU.SESSIONS ? (q >= 0.85 ? 2 : q >= 0.45 ? 1 : 0) + (s.dx && s.dx.ok ? 1 : 0) : (q >= 0.9 ? 3 : q >= 0.7 ? 2 : q >= 0.4 ? 1 : 0);
    const r = FU.rec(s.key);
    r.arc = s.arc;   // este paciente segue o mesmo roteiro nas próximas consultas
    r.q.push(clamp(q * Dx.factor(s), 0, 1));
    if (s.dx) r.dx = s.dx.ok;
    if (s.tx) r.tx = s.tx.ok;
    if (s.sess >= FU.SESSIONS) FU.afterFinal(s.key);
  }
  if (s.tutorial) { state.tutorialDone = true; Tutor.skip(); }
  let earned = Math.round((stars * COINS_PER_STAR + Math.min(MAX_VINCULO_BONUS, Math.floor(state.affinity / 20))) * (s.secret ? 1 : Wheel.perk("coins")));

  let extra = "";
  if (s.manut && s.manutResult) {
    earned = Math.round(earned * 0.6);
    const mr = s.manutResult;
    // a adesão deixou de ser placar de fim de caso: ela sobe e desce a cada sessão, e o jogador vê isso
    const ad = mr.dAdesao ? ` · 🤝 ${I18N.pick(window.L("Adesão", "Adherence", "Adhesión"))} ${mr.dAdesao > 0 ? "+" : ""}${mr.dAdesao} → ${mr.adesao}%` : "";
    const res = mr.resist > 0.3 ? ` · 🧱 ${I18N.pick(window.L("veio resistente: parte do ganho ficou pelo caminho", "came in resistant: part of the gain was lost on the way", "vino resistente: parte de la ganancia se quedó en el camino"))}` : "";
    extra += ` 🛋️ ${I18N.pick(window.L("Progresso terapêutico", "Therapeutic progress", "Progreso terapéutico"))}: +${mr.delta}% → ${Math.round(mr.progresso)}%${ad}${res}${Care.canDischarge(s.key) ? " · 🎓 " + I18N.pick(window.L("já dá para dar alta (Celular → Acompanhamento)", "you can discharge now (Phone → Follow-up)", "ya se puede dar el alta (Celular → Seguimiento)")) : ""}.`;
  }
  if (s.secret) {
    earned = c.reward.coins;
    (c.reward.items || []).forEach((id) => { state.owned[id] = true; });
    if (c.reward.acc) { state.ownedClothes[c.reward.acc] = true; if (state.player) state.player.acc = c.reward.acc; }
    state.secretDone[s.key] = true;
    const names = (c.reward.items || []).map((id) => (itemById(id) || {}).name).concat(c.reward.acc ? [(ACC_MAP[c.reward.acc] || {}).name] : []).filter(Boolean);
    extra = ` ${t("secret.reward", { what: names.join(", ") })}.`;
    afterResult = "secret";
  } else {
    state.results[resultKey(s.dayKey, s.apptIdx)] = { stars, finalAffinity: state.affinity, coins: earned, dx: s.dx ? s.dx.ok : null, late: Boolean(s.late) };
    state.clock = Math.max(state.clock === undefined ? DAY_START : state.clock, slotStart(SCHEDULE[s.dayKey][s.apptIdx]) + 50) + 10;   // sessão de 50 min + 10 de intervalo
    advanceSchedule(s.dayKey);
  }
  if (!s.secret && s.dx) {   // laudo, reputação e articulação: o caso fechado rende além das estrelas
    const cc = Wheel.closeCase(s.dx.ok, s.laudo, s.devol);
    if (s.sess >= FU.SESSIONS) { earned += cc.coins; extra += ` ${cc.lines.join(" · ")}`; }
    if (Wheel.active("raciocinio")) state.clock = Math.max(state.clock - 20, slotStart(SCHEDULE[s.dayKey][s.apptIdx]) + 50);   // 🧩 análise mais rápida
  }
  let debriefKey = null;
  if (!s.secret && typeof Risk !== "undefined") {   // manejo de risco: negligência, mensagens de crise e módulo de debriefing
    Risk.endSession(s);
    if (s.sess >= FU.SESSIONS && Risk.unlockDebrief(s.key)) { debriefKey = s.key; extra += ` 📘 ${t("risk.manual")}`; }
    else if (Risk.negScore(s.key) > 0 && Risk.needsDebrief(s.key)) debriefKey = s.key;
  }
  state.coins += earned;
  state.energy = clamp(state.energy - (s.manut ? Career.manutEnergy() : ENERGY_PER_SESSION), 0, 100);
  session = null;   // antes do saveState(): a consulta acabou, não é mais "em andamento" para o botão Continuar
  saveState();
  openCard = null;

  const rolled = state.weekRolled !== undefined;
  const rolledFrom = state.rolledFrom, rolledCoins = state.weekRolled || 0;
  delete state.weekRolled; delete state.rolledFrom;
  const finished = weekDone();
  const dayEnd = !s.secret && !finished && state.dayOver;
  const sameDay = !s.secret && !finished && !dayEnd && DAYS[state.dayIndex] === s.dayKey;
  let text = t("result.text", { good: s.goodChoices, total: s.totalSteps, v: state.affinity, n: earned }) + extra;
  if (!s.secret) text += ` ${t("fu.result", { n: s.sess, total: FU.SESSIONS, p: FU.evolution(s.key) })}`;
  if (!s.secret && s.dx) text += ` ${t(s.dx.ok ? "result.dx.right" : "result.dx.wrong", { name: disorderName(c.diagnosis.answer) })}`;
  if (!s.secret && rolled) text += ` ${t("fu.weekroll", { n: rolledFrom, m: rolledFrom + 1, c: rolledCoins })}`;
  if (!s.secret) {
    if (finished) text += ` ${t("result.weektext", { n: totalStars(), max: maxStars(), level: levelName(levelIndex(state.xp)) })}`;
    else if (dayEnd) text += ` ${t("result.dayend", { day: dayLabel(DAYS[state.dayIndex + 1]) })}`;
    else if (sameDay) { const nx = SCHEDULE[s.dayKey][state.apptIndex]; text += ` ${t("result.next", { time: nx.time, name: CASES[nx.caseId].name })}`; }
    else { const nx = SCHEDULE[currentDayKey()][0]; text += ` ${t("result.tomorrow", { time: nx.time, name: CASES[nx.caseId].name })}`; }
    afterResult = sameDay ? "break" : "home";
  }
  $("result-title").textContent = finished && !s.secret ? t("result.week") : t("result.session", { name: c.name });
  $("result-stars").textContent = starText(stars);
  $("result-text").textContent = text;
  { const bd = $("btn-result-debrief"); bd.classList.toggle("hidden", !debriefKey); if (debriefKey) { bd.textContent = `🧭 ${t("risk.debrief")}`; bd.onclick = () => Risk.debrief(debriefKey); } }
  $("btn-result-ok").textContent = afterResult === "break" ? t("result.break") : afterResult === "secret" ? t("create.back") : t("result.back");

  renderHome();
  holdDayCard = true;
  showScreen(s.secret ? "secret" : "home");
  holdDayCard = false;
  if (s.secret) renderSecret();
  openModal("result-modal");
  sfx("clock");                                   // relógio: a sessão acabou
  setTimeout(() => sfx(`result${stars}`), 1700);
}

// consultório vazio no fim do expediente: a sala sem ninguém e o aviso de que não há mais pacientes hoje
function showEmptyOffice() {
  const body = $("hosp-body");
  body.textContent = "";
  $("hosp-title").textContent = `🩺 ${t("office.empty")}`;
  const box = el("div", "aq-viewer empty-office");
  body.appendChild(box);
  body.appendChild(el("p", "uni-q", t("office.empty")));
  if (window.Scene3D && use3D()) {   // além da vitrine, dá para entrar: a psicóloga anda pelo consultório com todos os móveis no lugar
    const go = el("button", "continue-btn", t("office.enter"));
    go.type = "button"; go.id = "office-enter";
    go.addEventListener("click", () => enterEmptyOffice(box));
    body.appendChild(go);
  }
  openModal("hosp-modal");
  // A SALA VAZIA É A SALA, sem ninguém — não a sala sem móveis. Com `base: false` as poltronas não
  // entravam, e o fim do expediente mostrava um consultório que não existe: o tapete, a mesinha e
  // parede nua. Agora é `base: true` (os móveis ficam) e ninguém é desenhado porque não há paciente.
  const ok = window.Scene3D && use3D() && Scene3D.mount(box, "room", Object.assign(scenePlace("consultorio"), { camera: "wide", base: true, base3d: true, parent: true, player: null, pets: [], theme: Town.themeNow() || null }));
  if (!ok) box.appendChild(el("div", "aq-fallback", "🪑"));
}

// modo "entrar": a mesma sala (móveis, poltronas, mesinha e a decoração do jogador), agora com a personagem andando por ela
let officeKeys = null;
function enterEmptyOffice(box) {
  const body = $("hosp-body");
  const opts = Object.assign(scenePlace("consultorio"), {
    // `parent: true` como na vitrine: entrar na sala não pode fazer a terceira poltrona sumir — é a
    // mesma sala, e o que muda é só que agora a psicóloga está nela e você anda por ela
    camera: "wide", base: true, parent: true, pets: [], theme: Town.themeNow() || null, drag: true,
    hot: { map: HOT_MAP, active: [...new Set(Object.values(HOT_MAP))], onPick: (a) => Scene3D.doctorAct(a, a === "luz" && Scene3D.luzAcesa ? () => { state.luzAcesa = !state.luzAcesa; saveState(); Scene3D.luzAcesa(state.luzAcesa); } : null) },   // a luz acende quando a mão chega na luminária
    walkTo: (x, z) => Scene3D.doctorSeq([{ posture: "stand", ms: 200 }, { walk: [x, z] }])
  });
  if (!Scene3D.mount(box, "room", opts)) return;
  body.querySelectorAll("#office-enter, .uni-q").forEach((n) => n.remove());
  $("hosp-title").textContent = `🚶 ${t("office.empty")}`;
  body.appendChild(el("p", "shop-note", t("office.walkhint")));
  const back = el("button", "link-btn", t("office.leave")); back.type = "button";
  back.addEventListener("click", () => { stopOfficeKeys(); showEmptyOffice(); });
  body.appendChild(back);
  setTimeout(() => Scene3D.doctorSeq([{ posture: "stand", ms: 300 }, { walk: [0.4, 1.6] }]), 500);   // levanta da poltrona e vem para o meio da sala
  const held = new Set();
  officeKeys = (e, down) => {
    const k = e.key.toLowerCase(), map = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
    if (!map[k]) return;
    e.preventDefault(); if (down) held.add(k); else held.delete(k);
    if (down && !Scene3D.doctorBusy()) { const d = Scene3D.debugDoctor(), p = d && d.position(); if (p) Scene3D.doctorSeq([{ walk: [p.x + map[k][0] * 1.3, p.z + map[k][1] * 1.3] }]); }
  };
  window.addEventListener("keydown", officeKeysDown); window.addEventListener("keyup", officeKeysUp);
}
const officeKeysDown = (e) => { if (officeKeys && !$("hosp-modal").classList.contains("hidden")) officeKeys(e, true); };
const officeKeysUp = (e) => { if (officeKeys) officeKeys(e, false); };
function stopOfficeKeys() { officeKeys = null; window.removeEventListener("keydown", officeKeysDown); window.removeEventListener("keyup", officeKeysUp); }

function closeResult() {
  closeModal("result-modal");
  if (afterResult === "break") { travelIn(); return; }
  if (afterResult === "home" && state.dayOver && settings.emptyOffice && screen === "home") setTimeout(() => { if (state.dayOver && screen === "home") showEmptyOffice(); }, 500);
  if (screen === "home") {
    maybeDayCard();
    setTimeout(() => { if (screen === "home") Tutor.topic("appx", [{ key: "appx1", target: "btn-appendix" }, { key: "appx2", target: "btn-index" }]); }, 2600);
    setTimeout(() => { if (screen === "home") Tutor.topic("fu", [{ key: "fu", target: "nav-phone" }]); }, 1400);
    coachTip("moedas", "nav-shop");
    coachTip("porta", "nav-door");
    if (state.dayOver) setTimeout(() => { if (screen === "home" && state.dayOver) Tutor.topic("dayend", [{ key: "dayend1", target: "stat-clock" }, { key: "dayend2", target: "nav-city" }]); }, 900);
  }
}

function travelIn() { openBreak(); }

// ---------------------------------------------------------------- intervalo entre as sessões
let brk = null;
const HOT_MAP = {
  cafe: "cafe", planta: "planta", ficus: "planta", estante: "estante", sofa: "sofa", "sofa-mostarda": "sofa", "sofa-vinho": "sofa",
  "quadro-diploma": "diploma", aquario: "peixes", brinquedos: "brinquedos", "quadro-relogio": "relogio", lencos: "lencos",
  escrivaninha: "mesa", abajur: "luz", "luz-arco": "luz", flores: "flores", window: "janela"
};

function breakActions() {
  const worn = officeItems();
  return SHOP.actions.filter((a) => !a.req || a.req.some((id) => worn.includes(id)));
}

function nextPatientName() {
  const nx = SCHEDULE[currentDayKey()] && SCHEDULE[currentDayKey()][state.apptIndex];
  return nx ? CASES[nx.caseId].name : "";
}

function openBreak() {
  if (weekDone()) { renderHome(); showScreen("home"); return; }
  brk = { left: BREAK_ACTIONS, used: {} };
  showScreen("break");
  renderBreak();
  setTimeout(() => { if (screen === "break") Tutor.topic("break", [{ key: "break1", target: "break-actions" }]); }, 1200);
}

function stopBreak() {
  brk = null;
  if (window.Scene3D) window.Scene3D.unmount($("break-room"));
}

function breakHot() {
  // a luz continua clicável mesmo com as pausas esgotadas: acender não é descansar
  const active = breakActions().filter((a) => a.id === "luz" || (brk.left > 0 && !brk.used[a.id])).map((a) => a.id);
  return { map: HOT_MAP, active, onPick: (id) => doBreakAction(id) };
}

function renderBreak() {
  if (!brk) return;
  $("break-sub").textContent = t("break.sub", { name: nextPatientName() });
  $("break-energy-num").textContent = `${Math.round(state.energy)}%`;
  $("break-energy-fill").style.width = `${clamp(state.energy, 0, 100)}%`;
  const box = $("break-actions");
  box.textContent = "";
  breakActions().forEach((a) => {
    const livre = a.id === "luz";
    const used = Boolean(brk.used[a.id]);
    const btn = el("button", "break-act" + (livre ? " break-livre" : ""));
    btn.type = "button";
    btn.dataset.action = a.id;
    btn.disabled = !livre && (used || brk.left <= 0);
    btn.appendChild(el("span", "break-act-icon", a.icon));
    btn.appendChild(el("span", "break-act-label", livre ? (state.luzAcesa ? t("break.luz.apagar") : t("break.luz.acender")) : a.label));
    btn.appendChild(el("span", "break-act-gain", livre ? t("break.livre") : `+${a.energy}⚡`));
    btn.addEventListener("click", () => doBreakAction(a.id));
    box.appendChild(btn);
  });
  box.appendChild(el("p", "break-left", brk.left > 0 ? t("break.left", { n: brk.left }) : t("break.done")));
  const ok = renderRoom($("break-room"), Object.assign(scenePlace("consultorio"), { camera: "wide", base: true, drag: true, hot: breakHot() }));
  $("break-room").classList.toggle("is3d", ok === true);
}

function doBreakAction(id) {
  // ACENDER A LUZ NÃO É UMA PAUSA. Custava uma das poucas ações do intervalo e só dava para fazer uma
  // vez: quem acendesse por engano ficava com a sala acesa até o fim do dia e ainda perdia a pausa.
  // É um gesto, não um descanso — não gasta ação, não gasta energia e pode ir e voltar à vontade.
  const luzLivre = id === "luz";
  if (!brk || (!luzLivre && (brk.left <= 0 || brk.used[id]))) return;
  const a = SHOP.actions.find((x) => x.id === id);
  if (!a || !breakActions().some((x) => x.id === id)) return;
  if (window.Scene3D && Scene3D.doctorBusy && Scene3D.doctorBusy()) return;   // espere ela terminar o que está fazendo
  if (!luzLivre) brk.used[id] = true;
  // Tocar no abajur ACENDE — mas só quando a mão chega lá. Era um prazo fixo de 900 ms, e a sala
  // acendia com ela ainda atravessando o consultório, antes de encostar na luminária. Agora quem avisa
  // é o próprio passo do gesto, que começa quando ela chega.
  const aoFazer = id === "luz" && window.Scene3D && Scene3D.luzAcesa
    ? () => { state.luzAcesa = !state.luzAcesa; saveState(); Scene3D.luzAcesa(state.luzAcesa); }
    : null;
  if (window.Scene3D && Scene3D.doctorAct) Scene3D.doctorAct(id, aoFazer);
  if (!luzLivre) {
    brk.left -= 1;
    state.energy = clamp(state.energy + a.energy, 0, 100);
  }
  saveState();
  updateHud();
  sfx(id === "cafe" ? "sip" : id === "planta" ? "water" : id === "estante" ? "page" : id === "sofa" ? "rest" : "unlock");
  const toast = $("break-toast");
  toast.textContent = `${a.icon} ${a.text}`;
  toast.classList.remove("hidden");
  renderBreak();
}

function endBreak() {
  stopBreak();
  if (SCHEDULE[currentDayKey()] && SCHEDULE[currentDayKey()][state.apptIndex] && !weekDone()) enterConsultationRoom();
  else { renderHome(); showScreen("home"); }
}

// ---------------------------------------------------------------- modo secreto (Natal, Páscoa e Halloween)
function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

function seasonNow(now = new Date()) {
  const y = now.getFullYear(), day = 86400000;
  const easter = easterDate(y);
  if (now >= new Date(easter - 14 * day) && now <= new Date(+easter + 7 * day)) return "pascoa";
  if ((now.getMonth() === 9 && now.getDate() >= 20) || (now.getMonth() === 10 && now.getDate() <= 2)) return "halloween";
  if (now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 6)) return "natal";
  return null;
}

// o modo secreto abre na época certa, ao completar as 4 semanas ou ao cumprir A lenda dos Guardiões
const secretAvailable = () => Boolean(settings.secretUnlocked || seasonNow() || (state.ach && state.ach.guardioes) || weekDone());

function renderSecret() {
  const list = $("secret-list");
  list.textContent = "";
  Object.keys(SECRET).forEach((id) => {
    const c = SECRET[id];
    const card = el("article", "secret-card");
    card.dataset.theme = c.theme;
    card.appendChild(el("div", "secret-emoji", c.emoji));
    const body = el("div", "secret-body");
    body.appendChild(el("h2", null, c.name));
    body.appendChild(el("p", null, c.complaint));
    const done = Boolean(state.secretDone[id]);
    const btn = el("button", "continue-btn", done ? `${t("secret.done")} · ${t("secret.talk")}` : t("secret.talk"));
    btn.type = "button";
    btn.dataset.secret = id;
    btn.addEventListener("click", () => startSession(id, { secret: true }));
    body.appendChild(btn);
    card.appendChild(body);
    list.appendChild(card);
  });
}

function openSecret() {
  renderSecret();
  showScreen("secret");
}

"use strict";

// ===========================================================================
// Investigação clínica: o caminho até o diagnóstico.
//  · Investigar: a psicóloga escolhe áreas para perguntar (humor, sono, risco, início...). Cada área revela um achado do caso
//    (ou um achado "negativo", que também ajuda a descartar hipóteses). Áreas delicadas exigem vínculo: sem confiança o paciente desvia.
//  · Ficha em abas: Apresentação, Trilha, Achados, Hipóteses (evidência a favor e contra de cada diagnóstico) e Formulação (5 Ps).
//  · No diagnóstico final, a revisão compara a resposta com a evidência reunida: acerto sem investigação vale pouco, e um
//    diagnóstico fraco deixa o acompanhamento inconclusivo.
// Os dados (achados por caso, domínios, formulação) ficam em content/dx.json (gerado por tools/python/build_dx.py).
// Estado: state.dxbook[caso] = { found:{área:true}, form:{slot:"ok"|"bad"}, hyp:id|null, evid:{hipótese:{área:1|-1}} }
// ===========================================================================
const Dx = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  // com "ocultar conteúdo sensível" ligado, a área de risco e os textos que citam o tema saem dos dados (cópia filtrada, guardada até mudar a opção)
  let safeCopy = null;
  const rawData = () => window.DX_DATA || { domains: [], cases: {} };
  function data() {
    if (typeof Sens === "undefined" || !Sens.on()) return rawData();
    if (safeCopy) return safeCopy;
    const src = rawData(), out = { domains: src.domains.filter((d) => !Sens.HIDDEN_DOMAINS.includes(d.id)).map((d) => Object.assign({}, d)), cases: {} };
    const clean = (o) => (o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([l, v]) => [l, Sens.text(v, "")])) : o);
    out.domains.forEach((d) => { d.ask = clean(d.ask); d.neg = clean(d.neg); });
    Object.entries(src.cases).forEach(([k, c]) => { out.cases[k] = Object.assign({}, c, { findings: c.findings.filter((f) => !Sens.HIDDEN_DOMAINS.includes(f.d)).map((f) => Object.assign({}, f, { text: clean(f.text) })) }); });
    return (safeCopy = out);
  }
  const resetData = () => { safeCopy = null; };
  const MAX_ASKS = 3;          // perguntas de investigação por consulta (4 consultas x 3 = as 12 áreas)
  const MIN_FINDS = 3;         // menos que isso: diagnóstico prematuro
  const GATE = { normal: 25, sensitive: 45 };   // vínculo mínimo para o paciente responder
  const SLOTS = ["predisposing", "precipitating", "perpetuating", "protective"];
  const SLOT_INFO = {
    predisposing: { icon: "🌱", name: L("Predisponentes", "Predisposing", "Predisponentes"), q: L("O que deixou esta pessoa mais vulnerável?", "What made this person more vulnerable?", "¿Qué volvió a esta persona más vulnerable?") },
    precipitating: { icon: "⚡", name: L("Precipitantes", "Precipitating", "Precipitantes"), q: L("O que desencadeou o quadro agora?", "What set it off now?", "¿Qué lo desencadenó ahora?") },
    perpetuating: { icon: "🔁", name: L("Perpetuantes", "Perpetuating", "Perpetuantes"), q: L("O que mantém o problema vivo?", "What keeps the problem alive?", "¿Qué mantiene vivo el problema?") },
    protective: { icon: "🛡️", name: L("Protetores", "Protective", "Protectores"), q: L("O que ajuda esta pessoa a se manter de pé?", "What helps this person stay afloat?", "¿Qué ayuda a esta persona a mantenerse en pie?") }
  };

  const cur = () => (session && !session.secret ? session.key : null);
  const kase = (k) => (k && data().cases[k]) || null;
  const active = () => Boolean(kase(cur()));
  const book = (k) => { const b = (state.dxbook = state.dxbook || {}); const r = (b[k] = b[k] || {}); r.combinado = r.combinado || {}; r.found = r.found || {}; r.form = r.form || {}; r.evid = r.evid || {}; r.firme = r.firme || {}; r.crit = r.crit || {}; r.caderno = r.caderno || []; r.tempo = r.tempo || {}; r.desvios = r.desvios || {}; if (r.hyp === undefined) r.hyp = null; return r; };
  const dom = (id) => data().domains.find((d) => d.id === id);
  const finding = (k, d) => kase(k).findings.find((f) => f.d === d) || null;
  const opts = (k) => CASES[k].diagnosis.options;
  const hash = (s) => String(s).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const foundList = (k) => data().domains.filter((d) => book(k).found[d.id]);
  const asksLeft = () => (session ? MAX_ASKS - (session.asks || 0) : 0);

  // ------------------------------------------------------------ evidência
  function evidence(k) {
    const out = {}, max = {};
    opts(k).forEach((id) => { out[id] = { pro: 0, con: 0 }; max[id] = 0; });
    kase(k).findings.forEach((f) => {
      const seen = Boolean(book(k).found[f.d]);
      Object.entries(f.pts || {}).forEach(([id, w]) => { if (!out[id]) return; if (w > 0) max[id] += w; if (seen) { if (w > 0) out[id].pro += w; else out[id].con += -w; } });
    });
    const extra = typeof PsicoDx !== "undefined" ? PsicoDx.items(k) : [];   // testes, projetivas e achado tardio (só o que já foi visto)
    extra.forEach((f) => Object.entries(f.pts || {}).forEach(([id, w]) => { if (!out[id]) return; if (f.max && w > 0) max[id] += w; if (w > 0) out[id].pro += w; else out[id].con += -w; }));
    return { by: out, max };
  }
  // ------------------------------------------------------------ a evidência é marcada PELO JOGADOR
  // Este é um jogo de mistério: quem liga achado a hipótese é quem está jogando. Até aqui a ficha fazia
  // a conta sozinha — abria a aba Hipóteses e já estavam lá as barras verdes e vermelhas somadas pelo
  // jogo, com o diferencial pronto. Restava clicar em "Marcar". Agora a barra mostra o que VOCÊ apontou:
  // para cada hipótese, você diz quais dos seus achados pesam a favor e quais pesam contra. O jogo só
  // confere no fechamento, e é aí que se descobre se o raciocínio estava de pé.
  const marcaDe = (k, hyp, dom) => (book(k).evid[hyp] || {})[dom] || 0;
  function marcarEvidencia(k, hyp, dom, valor) {
    const b = book(k);
    b.evid[hyp] = b.evid[hyp] || {};
    if (b.evid[hyp][dom] === valor) delete b.evid[hyp][dom];   // tocar de novo desmarca
    else b.evid[hyp][dom] = valor;
    saveState();
  }
  // o que o jogador marcou, somado (é isto que as barras mostram)
  function marcado(k, hyp) {
    const m = book(k).evid[hyp] || {}, vistos = book(k).found;
    let pro = 0, con = 0;
    Object.entries(m).forEach(([dom, v]) => { if (!vistos[dom]) return; if (v > 0) pro += 1; else con += 1; });
    return { pro, con };
  }
  // conferência: o achado realmente pesa a favor (ou contra) daquela hipótese?
  // ACHADO AMBÍGUO (7.11). Um sintoma que pesa igual para dois quadros NÃO decide nada entre eles — e
  // essa é a lição que faltava no jogo: evidência que serve para os dois lados não é evidência no
  // diferencial. A ambiguidade não é escrita à mão em lugar nenhum: ela é LIDA dos pesos, o que vale
  // também para os casos gerados. Dois quadros empatados no topo, ambos com peso 2 ou mais.
  function ambiguo(k, dominio) {
    const f = (kase(k).findings || []).find((x) => x.d === dominio);
    if (!f || !f.pts) return null;
    const pos = Object.entries(f.pts).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]);
    if (pos.length < 2 || pos[0][1] !== pos[1][1]) return null;
    const empatados = pos.filter(([, v]) => v === pos[0][1]).map(([id]) => id);
    return { hyps: empatados, peso: pos[0][1] };
  }
  const ambiguoEntre = (k, dominio, hyp) => { const a = ambiguo(k, dominio); return a && a.hyps.includes(hyp) ? a : null; };

  function pesoReal(k, hyp, dom) {
    const f = (kase(k).findings || []).find((x) => x.d === dom);
    const w = f && f.pts ? f.pts[hyp] || 0 : 0;
    return w > 0 ? 1 : w < 0 ? -1 : 0;
  }
  // quanto do que você apontou está de pé: entra no fechamento do caso
  function conferirMarcacao(k) {
    const b = book(k);
    let certos = 0, errados = 0, total = 0;
    Object.entries(b.evid || {}).forEach(([hyp, m]) => Object.entries(m).forEach(([dom, v]) => {
      if (!b.found[dom]) return;
      total += 1;
      if (pesoReal(k, hyp, dom) === (v > 0 ? 1 : -1)) certos += 1; else errados += 1;
    }));
    return { certos, errados, total };
  }

  // ------------------------------------------------------------ pedidos a terceiros (pelo celular)
  // O eixo Articulação já trazia "o relatório da escola" de graça e sem você pedir: aparecia sozinho na
  // aba Achados quando o eixo estava ativo. Virou AÇÃO. Você pede a fonte que quiser, ela leva dias para
  // chegar, e traz um achado de uma área que você ainda não investigou — coisa que não se consegue
  // dentro da sala. Cada fonte alcança um tipo de área: a escola vê rotina e relações, o médico vê
  // corpo e sono, a família vê passado e começo. Pedir custa dinheiro e tempo de espera, não de sessão.
  const FONTES = [
    { id: "escola", emoji: "🏫", dias: 2, custo: 12, areas: ["func", "social", "inicio"],
      nome: L("Relatório da escola", "School report", "Informe de la escuela"),
      de: L("Coordenação da escola", "School coordinator", "Coordinación de la escuela") },
    { id: "medico", emoji: "🩺", dias: 3, custo: 20, areas: ["corpo", "sono", "subst"],
      nome: L("Exames e parecer médico", "Tests and medical opinion", "Exámenes y parecer médico"),
      de: L("Clínica médica", "Medical clinic", "Clínica médica") },
    { id: "familia", emoji: "🏠", dias: 1, custo: 0, areas: ["familia", "trauma", "inicio"],
      nome: L("Conversa com a família", "Talk with the family", "Conversación con la familia"),
      de: L("Familiar", "Family member", "Familiar") },
    { id: "colega", emoji: "📁", dias: 4, custo: 25, areas: ["humor", "ansiedade", "pensamento", "risco"],
      nome: L("Prontuário de quem atendeu antes", "Records from the previous clinician", "Historial de quien atendió antes"),
      de: L("Colega de outro serviço", "Colleague from another service", "Colega de otro servicio") }
  ];
  const fonteDe = (id) => FONTES.find((f) => f.id === id) || null;
  const pedidos = (k) => { const b = book(k); b.pedidos = b.pedidos || {}; return b.pedidos; };
  // o dia absoluto, para a espera atravessar a virada de semana
  const diaAbs = () => ((state.week || 1) - 1) * 5 + (state.dayIndex || 0);
  // que área aquela fonte alcançaria AGORA neste caso (a primeira ainda não investigada que ela cobre)
  function areaDaFonte(k, id) {
    const f = fonteDe(id);
    if (!f) return null;
    const b = book(k);
    return f.areas.find((a2) => !b.found[a2] && (kase(k).findings || []).some((x) => x.d === a2)) || null;
  }
  function podePedir(k, id) {
    const p = pedidos(k)[id];
    if (p) return false;                      // uma vez por fonte, por caso
    return Boolean(areaDaFonte(k, id));
  }
  function pedir(k, id) {
    const f = fonteDe(id);
    if (!f || !podePedir(k, id)) return null;
    if ((state.coins || 0) < f.custo) return null;
    const area = areaDaFonte(k, id);
    state.coins -= f.custo;
    pedidos(k)[id] = { area, pedidoEm: diaAbs(), chega: diaAbs() + f.dias, entregue: false };
    if (typeof Wheel !== "undefined") Wheel.gain("multi", 1);   // articular com outro serviço é competência
    saveState(); if (typeof updateHud === "function") updateHud();
    return pedidos(k)[id];
  }
  // chamado na virada do dia: o que chegou vira achado na ficha e recado no celular
  function entregarPedidos() {
    const livro = state.dxbook || {}, chegaram = [];
    Object.keys(livro).forEach((k) => {
      if (!kase(k)) return;
      Object.entries(livro[k].pedidos || {}).forEach(([id, p]) => {
        if (p.entregue || diaAbs() < p.chega) return;
        p.entregue = true;
        const f = fonteDe(id), d = dom(p.area);
        if (p.area && !livro[k].found[p.area]) livro[k].found[p.area] = true;
        chegaram.push({ caso: k, fonte: id, area: p.area, nome: pick((f || {}).nome || {}), de: pick((f || {}).de || {}), emoji: (f || {}).emoji || "📎", areaNome: d ? pick(d.name) : "" });
      });
    });
    if (chegaram.length) saveState();
    return chegaram;
  }
  const pedidosPendentes = () => {
    const livro = state.dxbook || {}, out = [];
    Object.keys(livro).forEach((k) => Object.entries(livro[k].pedidos || {}).forEach(([id, p]) => { if (!p.entregue) out.push({ caso: k, fonte: id, faltam: Math.max(0, p.chega - diaAbs()) }); }));
    return out;
  };

  // ------------------------------------------------------------ linha do tempo
  // Vários diagnósticos dependem de ORDEM: o que veio primeiro, o sintoma ou a perda; o medo começou
  // antes ou depois de parar de sair. O jogo não tinha lugar nenhum para isso. Aqui os achados que você
  // coletou se organizam em quatro tempos, e quem os coloca é você.
  //
  // O jogo NÃO inventa gabarito: só 22 dos 98 achados dizem no próprio texto quando a coisa começou.
  // Então a conferência só contradiz o jogador quando a fala do paciente é explícita — o resto é
  // julgamento clínico, e julgamento clínico não se corrige com uma tabela escondida.
  const TEMPOS = [
    ["antes", "⏮️", L("Antes de começar", "Before it started", "Antes de empezar")],
    ["inicio", "▶️", L("Quando começou", "When it started", "Cuando empezó")],
    ["desde", "⏩", L("Desde então", "Since then", "Desde entonces")],
    ["agora", "⏺️", L("Agora", "Now", "Ahora")]
  ];
  const PISTA_TEMPO = [
    ["antes", /desde (crian|pequen|sempre)|na inf[âa]ncia|quando (eu )?era|antes d(e|a|o)|desde os \d/i],
    ["inicio", /come[çc]ou|desde que|depois que|a partir d|h[áa] (tr[êe]s|dois|duas|seis|um|uma|\d+) (m[êe]s|mes|ano|semana)/i],
    ["agora", /agora|ultimamente|nas [úu]ltimas|esta semana|hoje em dia|tem piorado|piorou/i]
  ];
  // o que a PRÓPRIA fala do paciente diz sobre o tempo daquele achado (null = não diz nada)
  function tempoDito(k, dom) {
    const f = (kase(k).findings || []).find((x) => x.d === dom);
    if (!f) return null;
    const txt = `${pick(f.say || {})} ${pick(f.text || {})}`;
    const hit = PISTA_TEMPO.find(([, re]) => re.test(txt));
    return hit ? hit[0] : null;
  }
  const tempoDe = (k, dom) => book(k).tempo[dom] || null;
  function porNoTempo(k, dom, quando) {
    const b = book(k);
    if (b.tempo[dom] === quando) delete b.tempo[dom];
    else b.tempo[dom] = quando;
    saveState();
  }
  // onde o jogador contrariou o que a pessoa disse com todas as letras
  function conflitosDeTempo(k) {
    const b = book(k), out = [];
    Object.entries(b.tempo || {}).forEach(([dom, quando]) => {
      if (!b.found[dom]) return;
      const dito = tempoDito(k, dom);
      if (dito && dito !== quando && !(dito === "inicio" && quando === "desde")) out.push({ dom, seu: quando, dito });
    });
    return out;
  }

  // ------------------------------------------------------------ caderno de campo
  // Investigação de verdade tem rascunho. As "Observações desta consulta" que já existiam são do JOGO:
  // ele anota sozinho o que você fez. O caderno é seu — você escreve o que quiser, na hora que quiser, e
  // depois PRENDE a anotação num achado ou numa hipótese. A anotação presa aparece junto daquilo, que é
  // o que transforma um monte de texto solto em raciocínio organizado.
  function anotar(k, txt) {
    const t2 = String(txt || "").trim();
    if (!t2) return null;
    const b = book(k);
    const nota = { id: `n${Date.now().toString(36)}${b.caderno.length}`, txt: t2.slice(0, 400), dia: state.dayIndex || 0, sem: state.week || 1, alvo: null };
    b.caderno.push(nota);
    saveState();
    return nota;
  }
  function apagarNota(k, id) { const b = book(k); b.caderno = b.caderno.filter((n) => n.id !== id); saveState(); }
  function prenderNota(k, id, alvo) {
    const n = book(k).caderno.find((x) => x.id === id);
    if (!n) return;
    n.alvo = alvo && alvo.id ? { tipo: alvo.tipo, id: alvo.id } : null;
    saveState();
  }
  const notasDe = (k, tipo, id) => book(k).caderno.filter((n) => n.alvo && n.alvo.tipo === tipo && n.alvo.id === id);

  // ------------------------------------------------------------ dizer POR QUÊ (o Manual vira prova)
  // Marcar "a favor" sem dizer de quê é opinião. Aqui, ao apontar um achado a favor de uma hipótese, você
  // escolhe QUAL CRITÉRIO do Manual ele preenche — e a ficha passa a mostrar quais critérios daquele
  // transtorno ainda estão sem prova nenhuma. É o que separa "eu acho que é TDAH" de "é TDAH, e aqui
  // estão os cinco critérios sustentados". O Manual deixa de ser leitura e vira peça do raciocínio.
  const criterios = (hyp) => { const f = typeof findDisorder === "function" ? findDisorder(hyp) : null; return f && f.d && f.d.items ? f.d.items : []; };
  const criterioDe = (k, hyp, dom) => { const c = book(k).crit[hyp] || {}; return c[dom] === undefined ? null : c[dom]; };
  function marcarCriterio(k, hyp, dom, i) {
    const b = book(k);
    b.crit[hyp] = b.crit[hyp] || {};
    b.crit[hyp][dom] = i;
    saveState();
  }
  // quais critérios do transtorno já têm ao menos um achado apontado, e quais seguem sem prova
  function coberturaCriterios(k, hyp) {
    const itens = criterios(hyp), b = book(k), usados = {};
    Object.entries(b.crit[hyp] || {}).forEach(([dom, i]) => { if (b.found[dom] && (b.evid[hyp] || {})[dom] > 0) usados[i] = true; });
    return { total: itens.length, itens, cobertos: Object.keys(usados).map(Number), faltam: itens.map((_, i) => i).filter((i) => !usados[i]) };
  }

  // ------------------------------------------------------------ fechar em bloco (ao molde de Obra Dinn)
  // Conferir uma ligação por vez vira tentativa e erro: marca, vê se acendeu, corrige. Em bloco não dá.
  // Você aponta TRÊS ligações de uma vez e o jogo responde só QUANTAS não se sustentam — nunca quais.
  // Ou as três estão de pé (e aí travam, viram raciocínio firmado) ou você volta a pensar nas três.
  const TRIO = 3;
  const chaveLig = (hyp, dom) => `${hyp}|${dom}`;
  const firmada = (k, hyp, dom) => Boolean(book(k).firme[chaveLig(hyp, dom)]);
  // ligações marcadas que ainda não foram firmadas
  function ligacoesSoltas(k) {
    const b = book(k), out = [];
    Object.entries(b.evid || {}).forEach(([hyp, m]) => Object.entries(m).forEach(([dom, v]) => {
      if (!b.found[dom] || firmada(k, hyp, dom)) return;
      out.push({ hyp, dom, v });
    }));
    return out;
  }
  // confere um trio: devolve quantas erraram, e firma as três se todas estiverem certas
  function conferirTrio(k, trio) {
    const b = book(k);
    // marcação em cima de achado ambíguo não é erro nem acerto: ela simplesmente não decide, e por
    // isso não firma. Contar como erro puniria quem leu certo; contar como acerto ensinaria errado.
    const decisivas = trio.filter((l) => !ambiguoEntre(k, l.dom, l.hyp));
    const erradas = decisivas.filter((l) => pesoReal(k, l.hyp, l.dom) !== (l.v > 0 ? 1 : -1)).length;
    if (!erradas) {
      trio.filter((l) => !ambiguoEntre(k, l.dom, l.hyp)).forEach((l) => { b.firme[chaveLig(l.hyp, l.dom)] = true; });
      state.xp += 3;
      if (typeof Wheel !== "undefined") Wheel.gain("raciocinio", 1);
    }
    b.tentativas = (b.tentativas || 0) + 1;
    saveState();
    const ambiguas = trio.filter((l) => ambiguoEntre(k, l.dom, l.hyp));
    return { erradas, total: trio.length, firmou: !erradas, ambiguas: ambiguas.length, ambiguasInfo: ambiguas.map((l) => ({ dom: l.dom, hyps: ambiguoEntre(k, l.dom, l.hyp).hyps })) };
  }

  // ------------------------------------------------------------ contradição entre as SUAS marcações
  // Apontar o mesmo achado a favor de duas hipóteses que se excluem é uma contradição — a não ser que
  // você assuma comorbidade. A ficha passa a mostrar isso em vez de deixar passar calado.
  function contradicoes(k) {
    const b = book(k), out = [];
    const comorb = typeof PsicoDx !== "undefined" && PsicoDx.comorbidas ? PsicoDx.comorbidas(k) : [];
    const porAchado = {};
    Object.entries(b.evid || {}).forEach(([hyp, m]) => Object.entries(m).forEach(([dom, v]) => {
      if (v <= 0 || !b.found[dom]) return;
      (porAchado[dom] = porAchado[dom] || []).push(hyp);
    }));
    Object.entries(porAchado).forEach(([dom, hyps]) => {
      if (hyps.length < 2) return;
      for (let i = 0; i < hyps.length; i++) {
        for (let j = i + 1; j < hyps.length; j++) {
          if (comorb.includes(hyps[i]) || comorb.includes(hyps[j])) continue;   // comorbidade assumida resolve
          out.push({ dom, a: hyps[i], b: hyps[j] });
        }
      }
    });
    return out;
  }

  function strength(k) {   // quanto da evidência a favor da resposta certa foi reunida (0 a 1)
    const ans = CASES[k].diagnosis.answer, e = evidence(k);
    return e.max[ans] ? Math.min(1, e.by[ans].pro / e.max[ans]) : 0;
  }

  // ------------------------------------------------------------ reações: a resposta anterior muda o clima da fala seguinte
  const REACT = {
    4: L("(O clima na sala fica mais leve; a pessoa se solta.) ", "(The mood in the room lightens; the person opens up.) ", "(El clima en la sala se aligera; la persona se suelta.) "),
    3: L("(Há um silêncio confortável, e a conversa segue com mais confiança.) ", "(A comfortable silence, and the talk continues with more trust.) ", "(Un silencio cómodo, y la charla sigue con más confianza.) "),
    2: L("(Um breve silêncio; a conversa segue com cuidado.) ", "(A brief silence; the talk goes on carefully.) ", "(Un breve silencio; la charla sigue con cuidado.) "),
    1: L("(O clima esfria um pouco; a pessoa responde no automático.) ", "(The mood cools a little; the person answers on autopilot.) ", "(El clima se enfría un poco; la persona responde en automático.) "),
    0: L("(A pessoa se fecha e demora a voltar a falar.) ", "(The person shuts down and takes a while to speak again.) ", "(La persona se cierra y tarda en volver a hablar.) ")
  };
  const reaction = () => (session && !session.secret && session.lastScore !== undefined && session.stepIndex > 0 ? pick(REACT[session.lastScore]) : "");
  const noteShared = (choice) => state.affinity >= GATE.normal || choice.score >= 3;   // confiança muito baixa: o paciente não conta o detalhe
  // três desvios na mesma área viram, eles próprios, uma observação sobre o caso
  // PERGUNTAR DE OUTRO JEITO. "Ganhe confiança e tente de novo" mandava o jogador embora: a mesma
  // pergunta, de novo, é a única coisa que um clínico de verdade NÃO faria. Quando a pessoa desvia, o
  // que se faz é reformular — e cada reformulação é uma escolha clínica com preço próprio.
  const REFORMULAR = [
    { id: "lateral", icon: "↩️", alivio: 18, custoPergunta: 1, vinculoOk: 0, vinculoErro: 0,
      nome: L("Perguntar pela borda, não pelo centro", "Ask around the edge, not the middle", "Preguntar por el borde, no por el centro"),
      efeito: L("Em vez do assunto, o que fica em volta dele. É o caminho mais seguro, e gasta uma pergunta a mais.", "Instead of the subject, what sits around it. The safest route, and it costs one extra question.", "En vez del tema, lo que hay alrededor. El camino más seguro, y gasta una pregunta más."),
      fala: L("Então não vamos por aí. Me conta de uma coisa que aconteceu na mesma época — qualquer uma.", "Let's not go that way, then. Tell me about something that happened around the same time — anything.", "Entonces no vayamos por ahí. Cuéntame algo que pasó en la misma época, lo que sea.") },
    { id: "nomear", icon: "🫱", alivio: 30, custoPergunta: 0, vinculoOk: 4, vinculoErro: -3,
      nome: L("Nomear a dificuldade de falar disso", "Name how hard it is to talk about", "Nombrar lo difícil que es hablar de eso"),
      efeito: L("Você diz em voz alta o que está acontecendo ali. Abre muito quando funciona, e custa vínculo quando não.", "You say out loud what is happening there. It opens a lot when it works, and costs bond when it does not.", "Dices en voz alta lo que está pasando ahí. Abre mucho cuando funciona, y cuesta vínculo cuando no."),
      fala: L("Eu reparei que sempre que a gente chega perto disso você muda de assunto. Não tem problema nenhum — mas eu queria te dizer que eu reparei.", "I noticed that whenever we get near this you change the subject. That is completely fine — but I wanted to tell you that I noticed.", "Noté que cada vez que nos acercamos a esto cambias de tema. No pasa nada, pero quería decirte que lo noté.") },
    { id: "adiar", icon: "📌", alivio: 0, custoPergunta: 0, vinculoOk: 2, vinculoErro: 0, combina: true,
      nome: L("Combinar de voltar nisso outro dia", "Agree to come back to it another day", "Acordar volver a eso otro día"),
      efeito: L("Hoje não sai nada. Mas fica combinado, e na próxima consulta a porta já está destrancada.", "Nothing comes out today. But it is agreed, and next session the door is already unlocked.", "Hoy no sale nada. Pero queda acordado, y en la próxima consulta la puerta ya está abierta."),
      fala: L("Tudo bem. A gente não precisa falar disso hoje. Eu vou deixar anotado aqui, e a gente volta quando você quiser.", "That's all right. We do not have to talk about this today. I will make a note of it, and we will come back when you want to.", "Está bien. No tenemos que hablar de esto hoy. Lo dejo anotado y volvemos cuando quieras.") }
  ];
  const ALIVIO_COMBINADO = 22;     // o que foi combinado na consulta passada abre a porta na seguinte

  // A RODA ABRE CAMINHO. Os eixos davam bônus invisíveis — menos energia, mais precisão, uma dica. Nada
  // disso muda o que você PODE FAZER numa consulta. A partir do nível 3, cada um destes eixos põe uma
  // jogada nova na mesa: não é perguntar melhor, é perguntar outra coisa.
  const CAMINHOS = [
    { id: "olhar", eixo: "observacao", nivel: 3, icon: "👁️", minutos: 4, gastaPergunta: false,
      nome: L("Ficar em silêncio e olhar", "Stay silent and watch", "Quedarse en silencio y mirar"),
      dica: L("Não custa pergunta: custa 4 min. Você não pergunta nada e lê o corpo — e numa área de que ela vem desviando, olhar conta como uma tentativa.", "It costs no question: it costs 4 min. You ask nothing and read the body — and in an area she has been steering away from, watching counts as an attempt.", "No cuesta pregunta: cuesta 4 min. No preguntas nada y lees el cuerpo, y en un área que viene esquivando, mirar cuenta como un intento.") },
    { id: "negativo", eixo: "raciocinio", nivel: 3, icon: "🧩", minutos: 5, gastaPergunta: true,
      nome: L("Perguntar pelo que NÃO acontece", "Ask about what does NOT happen", "Preguntar por lo que NO pasa"),
      dica: L("Descartar também é diagnosticar. A resposta vem como achado negativo, e a porta é mais baixa: é mais fácil dizer que algo não acontece.", "Ruling out is diagnosing too. The answer comes as a negative finding, and the door is lower: it is easier to say something does not happen.", "Descartar también es diagnosticar. La respuesta viene como hallazgo negativo, y la puerta es más baja.") },
    { id: "antes", eixo: "anamnese", nivel: 3, icon: "🤝", minutos: 6, gastaPergunta: true,
      nome: L("Perguntar pela pessoa antes do problema", "Ask about the person before the problem", "Preguntar por la persona antes del problema"),
      dica: L("Quem ela era antes disso tudo. Gente fala do passado com muito mais facilidade do que do agora: a porta cai bastante.", "Who she was before all this. People speak of the past far more easily than of the present: the door drops a lot.", "Quién era antes de todo esto. La gente habla del pasado con mucha más facilidad: la puerta baja bastante.") }
  ];
  const ALIVIO_ANTES = 20, ALIVIO_NEGATIVO = 14;
  const caminhosAbertos = () => (typeof Wheel === "undefined" ? [] : CAMINHOS.filter((c) => Wheel.level(c.eixo) >= c.nivel));

  const DESVIOS_ACHADO = 3;
  const DIVA_ALIVIO = 12;      // quanto o divã alivia a porta de uma área delicada
  const desviosDe = (k, id) => (book(k).desvios || {})[id] || 0;
  const areasEvitadas = (k) => Object.entries(book(k).desvios || {}).filter(([id, n]) => n >= DESVIOS_ACHADO && !book(k).found[id]).map(([id]) => id);
  const GUARDED = L("(O paciente evita o assunto: falta confiança para se abrir sobre isso.)", "(The patient avoids the subject: not enough trust yet to open up about this.)", "(El paciente evita el tema: aún falta confianza para abrirse sobre esto.)");

  // ------------------------------------------------------------ investigar
  // Investigar só vale a partir do 2º encontro com a pessoa e depois que ela se apresentou (1ª fala da consulta já passou)
  // Investigar agora vale JÁ NA PRIMEIRA CONSULTA, assim que a pessoa se apresenta (passo 1).
  // Antes só liberava do 2º encontro, e a 1ª consulta virava duas perguntas de múltipla escolha e acabou.
  // O núcleo do jogo é o raciocínio clínico: ouvir, perguntar e ligar os pontos — não escolher uma fala entre quatro.
  const firstMeet = () => false;
  const introduced = () => Boolean(session) && session.stepIndex >= 1;
  const canShow = () => active() && !(session && session.manut);   // o botão aparece desde o começo; quem segura até a apresentação é o portão "intro" em opts()
  // testes formais e projetivas continuam do 2º encontro: a primeira consulta é anamnese, não testagem
  const canTest = () => canShow() && (session.sess || 1) >= 2;
  // cada pergunta gasta um pouco do tempo da consulta: a 3ª tira uma das falas que ainda faltavam (só as perguntas principais mexem na afinidade)
  const INV_BUDGET = 40, ASK_MIN = 6;                 // minutos de "tempo de investigação" por consulta (perguntas, testes e projetivas gastam daqui)
  const budgetLeft = () => (session ? Math.max(0, INV_BUDGET - (session.gasto || 0)) : 0);
  const progress = () => {
    if (!session) return 0;
    const spent = Math.min(1, (session.gasto || 0) / INV_BUDGET);
    return Math.min(1, (session.stepIndex + spent * 0.5) / session.totalSteps);
  };
  function spend(min) { session.gasto = (session.gasto || 0) + min; spendTime(); }
  function spendTime() {
    if ((session.gasto || 0) >= INV_BUDGET * 0.6 && !session.timeCut && session.steps.length - session.stepIndex > 2) {
      session.timeCut = true;
      session.steps.splice(session.stepIndex + 1, 1); session.totalSteps -= 1; session.maxPoints = Math.max(4, session.maxPoints - 4);
    }
    const pf = $("progress-fill"); if (pf) pf.style.width = `${progress() * 100}%`;
  }
  // 👁️ olhar: não se pergunta nada. Rende a observação do corpo e, numa área já desviada, conta como
  // uma tentativa — porque reparar que alguém desvia É investigar.
  function olhar(id) {
    const k = cur(), d = dom(id), b = book(k);
    if (!k || !d || !session) return null;
    if (budgetLeft() < 4) return { d, blocked: "asks" };
    spend(4);
    const desviou = (b.desvios || {})[id] || 0;
    if (desviou) {
      b.desvios[id] = desviou + 1;
      const n = b.desvios[id];
      if (n >= DESVIOS_ACHADO && !b.found[id]) { state.xp += 2; if (typeof Wheel !== "undefined") Wheel.gain("observacao", 1); }
      saveState(); updateHud(); sfx("tip");
      return { d, olhou: true, desvios: n, virouAchado: n >= DESVIOS_ACHADO,
               txt: tr("Você não pergunta nada. Ela repara no silêncio, olha para o lado e mexe nas mãos — e não é a primeira vez que esse assunto faz isso com ela.", "You ask nothing. She notices the silence, looks away and fiddles with her hands — and it is not the first time this subject does that to her.", "No preguntas nada. Ella nota el silencio, mira hacia el lado y mueve las manos, y no es la primera vez que este tema le hace eso.") };
    }
    state.xp += 1;
    if (typeof Wheel !== "undefined") Wheel.gain("observacao", 1);
    saveState(); updateHud(); sfx("tip");
    return { d, olhou: true, desvios: 0,
             txt: tr("Você fica quieta e observa. O corpo dela está em ordem quando o assunto é este: nada aqui pesa mais do que deveria.", "You stay quiet and watch. Her body is at ease on this subject: nothing here weighs more than it should.", "Te quedas quieta y observas. Su cuerpo está tranquilo con este tema: nada aquí pesa más de lo que debería.") };
  }

  function ask(id) {
    if (session && !session.secret) session.estadoConsulta = Wheel.estadoConsulta();
    const k = cur(), d = dom(id);
    if (!k || !d) return null;
    const b = book(k), f = finding(k, id);
    if (firstMeet()) return { d, blocked: "first" };
    if (!introduced()) return { d, blocked: "intro" };
    if (b.found[id]) return { d, f: f || { text: d.neg }, again: true };
    if (!asksLeft() || budgetLeft() < ASK_MIN) return { d, blocked: "asks" };
    session.asks = (session.asks || 0) + 1;
    spend(ASK_MIN);
    let gate = Math.round((d.sensitive ? GATE.sensitive : GATE.normal) * Wheel.defense());   // 🤝 anamnese reduz a defensividade
    const cost = d.sensitive ? Wheel.traumaEnergy() : 1;                                       // 🎨 projetivas poupam energia nas áreas delicadas
    state.energy = clamp(state.energy - cost, 0, 100);
    // NO DIVÃ a pessoa não vê o seu rosto, e é exatamente por isso que o assunto difícil passa a
    // caber: metade da vergonha de dizer é a cara de quem escuta. A porta da área delicada cede.
    const noDiva = Boolean(session && session.diva);
    if (noDiva && d.sensitive) gate = Math.max(0, gate - DIVA_ALIVIO);
    // o que ficou combinado numa consulta anterior destranca a porta nesta
    if ((b.combinado || {})[id] && (b.combinado[id] < (state.week || 1) * 10 + (state.dayIndex || 0))) gate = Math.max(0, gate - ALIVIO_COMBINADO);
    // e a reformulação desta vez vale só para esta pergunta
    if (session && session.reformular && session.reformular.id === id) { gate = Math.max(0, gate - session.reformular.alivio); session.reformular = null; }
    // ter LIDO a defesa da pessoa (e acertado) abre um pouco: ela se sentiu lida, não convencida
    if (session && session.defesaNomeada && (session.defesaNomeada.dominio === id || !session.defesaNomeada.dominio)) gate = Math.max(0, gate - session.defesaNomeada.alivio);
    // os caminhos que a Roda abriu: perguntar pelo passado ou pelo que não acontece pede menos confiança
    if (session && session.caminho === "antes") gate = Math.max(0, gate - ALIVIO_ANTES);
    if (session && session.caminho === "negativo") gate = Math.max(0, gate - ALIVIO_NEGATIVO);
    if (state.affinity < gate) {
      // O QUE A PESSOA NÃO DIZ TAMBÉM É INFORMAÇÃO. O desvio era só um "não deu" e sumia. Agora ele fica
      // registrado: perguntar três vezes sobre a mesma área e ouvir desvio nas três é um achado por si
      // só — não sobre o conteúdo, mas sobre o quanto aquele assunto custa para a pessoa.
      b.desvios[id] = (b.desvios[id] || 0) + 1;
      const n = b.desvios[id];
      if (n >= DESVIOS_ACHADO && !b.found[id]) { state.xp += 2; if (typeof Wheel !== "undefined") Wheel.gain("observacao", 1); }
      saveState(); updateHud(); sfx("bad");
      const def = typeof Defesa !== "undefined" ? Defesa.daPessoa(k) : null;
      return { d, guarded: true, gate, desvios: n, virouAchado: n >= DESVIOS_ACHADO, defesa: def, defesaFala: def ? Defesa.fala(k, id) : null };
    }
    Wheel.gain("raciocinio", 1); if (d.sensitive) Wheel.gain("projetivas", 1);   // sem confiança o paciente desvia; a afinidade não muda
    b.found[id] = true; state.xp += 1;
    pontuar(k, f);                                        // na consulta de avaliação, o placar vem daqui
    updateHud(); saveState(); sfx(f ? "unlock" : "click");
    if ($("ficha-new")) $("ficha-new").classList.remove("hidden");
    return { d, f: f || { text: d.neg, neg: true } };
  }

  // Quanto vale um achado no placar da consulta de avaliação.
  //  · base 2: descobrir qualquer coisa já é trabalho clínico;
  //  · +1 se sustenta a hipótese certa com peso (o achado que importa);
  //  · +1 se contradiz alguma concorrente (evidência negativa vale ouro no diferencial);
  //  · achado negativo (nada relevante na área) vale 1: informa, mas rende menos.
  function pesoDoAchado(k, f) {
    if (!f || f.neg) return 1;
    const resposta = (CASES[k].diagnosis || {}).answer;
    const pts = f.pts || {};
    let p = 2;
    if ((pts[resposta] || 0) >= 2) p += 1;
    if (Object.entries(pts).some(([id, v]) => id !== resposta && v < 0)) p += 1;
    return p;
  }
  function pontuar(k, f) {
    if (!session || !session.investigativa) return;
    session.points += pesoDoAchado(k, f);
  }

  const btnLabel = () => `🔎 ${tr("Investigar", "Investigate", "Investigar")} (${asksLeft()})`;
  // `direto`: a área já foi escolhida (veio de uma palavra grifada na fala), então pergunta na hora
  // em vez de abrir o menu das 12 áreas.
  function voltarAoMenu() {
    const b = el("button", "link-btn", tr("Ver todas as áreas", "See all areas", "Ver todas las áreas"));
    b.type = "button";
    b.addEventListener("click", () => openInvest());
    return b;
  }

  function openInvest(direto) {
    if (window.ClinicFSM && ClinicFSM.ativo()) ClinicFSM.ir("investigacao");
    if (!active()) return;
    if (typeof direto === "string" && dom(direto) && !book(cur()).found[direto]) {
      openModal("invest-modal");
      $("invest-title").textContent = btnLabel();
      const bx = $("invest-body"); bx.textContent = "";
      const r = el("div", "dx-result hidden"); r.id = "invest-result"; bx.appendChild(r);
      bx.appendChild(voltarAoMenu());
      return showAsk(ask(direto));
    }
    if (!state.usedInvestigar) { state.usedInvestigar = true; saveState(); }   // some o brilho do botão depois do 1º uso

    $("invest-title").textContent = btnLabel();
    const box = $("invest-body"); box.textContent = "";
    const k = cur(), b = book(k);
    box.appendChild(el("p", "uni-q", tr(`Escolha uma área para perguntar. Restam ${asksLeft()} de ${MAX_ASKS} perguntas nesta consulta. Áreas delicadas (🔒) exigem confiança.`, `Pick an area to ask about. ${asksLeft()} of ${MAX_ASKS} questions left this session. Sensitive areas (🔒) need trust.`, `Elige un área para preguntar. Quedan ${asksLeft()} de ${MAX_ASKS} preguntas en esta sesión. Las áreas delicadas (🔒) exigen confianza.`)));
    const res = el("div", "dx-result hidden"); res.id = "invest-result"; box.appendChild(res);
    const grid = el("div", "dx-grid");
    data().domains.forEach((d) => {
      const done = Boolean(b.found[d.id]);
      const btn = el("button", "dx-dom" + (done ? " done" : ""), "");
      btn.type = "button";
      btn.appendChild(el("span", "dx-dom-i", d.icon));
      const t = el("span", "dx-dom-t"); t.appendChild(el("b", "", pick(d.name) + (d.sensitive && !done ? " 🔒" : ""))); t.appendChild(el("small", "", done ? tr("✓ investigado", "✓ explored", "✓ explorado") : pick(d.ask))); btn.appendChild(t);
      btn.addEventListener("click", () => {
        const c = (session && session.caminho) ? CAMINHOS.find((x) => x.id === session.caminho) : null;
        if (c && c.id === "olhar") { const r = olhar(d.id); session.caminho = null; return showAsk(r); }
        const r = ask(d.id);
        if (session) session.caminho = null;
        showAsk(r);
      });
      grid.appendChild(btn);
    });
    box.appendChild(grid);
    // OS CAMINHOS DA RODA: aparecem só para quem treinou o eixo, e mudam o que a pergunta seguinte é
    const abertos = caminhosAbertos();
    if (abertos.length) {
      const cx = el("div", "dx-caminhos");
      cx.appendChild(el("h4", "dx-caminhos-h", `🎯 ${tr("O que a Roda abriu", "What the Wheel opened", "Lo que la Rueda abrió")}`));
      cx.appendChild(el("p", "dx-hint", tr("Estes eixos não dão só bônus: põem uma jogada nova na mesa. Escolha um e depois toque na área.", "These axes do not only give bonuses: they put a new move on the table. Pick one, then tap the area.", "Estos ejes no solo dan bonus: ponen una jugada nueva sobre la mesa. Elige uno y luego toca el área.")));
      abertos.forEach((c) => {
        const b2 = el("button", "choice-btn dx-caminho" + (session && session.caminho === c.id ? " on" : ""), "");
        b2.type = "button";
        b2.appendChild(el("b", null, `${c.icon} ${pick(c.nome)}`));
        b2.appendChild(el("small", "dx-hint", pick(c.dica)));
        b2.addEventListener("click", () => { session.caminho = session.caminho === c.id ? null : c.id; openInvest(); });
        cx.appendChild(b2);
      });
      box.appendChild(cx);
      if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("caminhos"), 400);
    }
    openModal("invest-modal");
  }

  // a pessoa responde de viva voz (com o próprio nome): fecha a lista de áreas, mostra a conversa e deixa perguntar outra coisa
  const LEAD = {
    humor: L("Hum... deixa eu pensar como tenho me sentido.", "Hmm... let me think about how I have been feeling.", "Mmm... déjame pensar cómo me he sentido."),
    ansiedade: L("Ah, isso... acho que aparece nas horas mais inesperadas.", "Oh, that... I think it shows up at the most unexpected times.", "Ah, eso... creo que aparece en los momentos más inesperados."),
    pensamento: L("É difícil explicar o que passa na minha cabeça, mas vou tentar.", "It is hard to explain what goes on in my head, but I will try.", "Es difícil explicar lo que pasa en mi cabeza, pero voy a intentar."),
    sono: L("Sobre dormir... bom, vou contar como tem sido.", "About sleep... well, let me tell you how it has been.", "Sobre dormir... bueno, te cuento cómo ha sido."),
    corpo: L("O corpo também sente, sabia? Deixa eu explicar.", "The body feels it too, you know? Let me explain.", "El cuerpo también lo siente, ¿sabías? Déjame explicar."),
    trauma: L("(respira fundo) Não é fácil falar disso, mas confio em você.", "(takes a deep breath) It is not easy to talk about, but I trust you.", "(respira hondo) No es fácil hablar de esto, pero confío en ti."),
    risco: L("(fica em silêncio um instante) Vou ser sincero(a) com você.", "(is silent for a moment) I will be honest with you.", "(guarda silencio un momento) Voy a ser sincero(a) contigo."),
    subst: L("Tá... vou responder, mas sem julgamento, combinado?", "Okay... I will answer, but no judgment, deal?", "Vale... voy a responder, pero sin juicios, ¿trato?"),
    func: L("No dia a dia? Bom, isso tem pesado bastante.", "In daily life? Well, it has been weighing on me.", "¿En el día a día? Bueno, ha pesado bastante."),
    social: L("Com as pessoas ao redor... hum, deixa eu contar.", "With the people around me... hmm, let me tell you.", "Con la gente a mi alrededor... mmm, déjame contarte."),
    inicio: L("Quando começou? Tento lembrar direitinho.", "When did it start? I am trying to remember exactly.", "¿Cuándo empezó? Intento recordarlo bien."),
    familia: L("Da minha família? Ok, posso falar um pouco.", "About my family? Okay, I can talk a bit.", "¿De mi familia? Vale, puedo hablar un poco.")
  };
  // negativo em 1ª pessoa, na faixa do paciente (criança ou adulto)
  const negSay = (d) => { const n = d.negsay; if (!n) return null; const c = session && CASES[session.key]; return c && c.kid ? n.kid : n.adult; };
  const speaker = () => { const c = session && (CASES[session.key] || {}); return c && c.name ? pick(c.name) : ""; };
  // O silêncio clínico: a pessoa acabou de falar de algo difícil e para. O que você faz com a pausa
  // é intervenção — sustentar, nomear o peso, ou desviar.
  function silencio(r) {
    const box = $("invest-say-body"); box.textContent = "";
    const pat = el("div", "say-row pat silencio");
    pat.appendChild(el("b", "", `💬 ${speaker()}`));
    pat.appendChild(el("p", "say-quote", tr("(Ela para de falar. Olha para as próprias mãos. O silêncio fica.)", "(She stops talking. Looks at her own hands. The silence stays.)", "(Deja de hablar. Mira sus propias manos. El silencio se queda.)")));
    box.appendChild(pat);
    Escuta.OPCOES_SILENCIO.forEach((o) => {
      const b = el("button", "choice-btn escuta-silencio");
      b.type = "button";
      b.appendChild(el("b", null, `${o.icone} ${pick(o.nome)}`));
      b.appendChild(el("small", "dx-hint", pick(o.dica)));
      b.addEventListener("click", () => {
        const res = Escuta.resolverSilencio(o.id);
        const cx = $("invest-say-body"); cx.textContent = "";
        const p2 = el("div", "say-row pat" + (res.bom ? "" : " guard"));
        p2.appendChild(el("b", "", `💬 ${speaker()}`));
        p2.appendChild(el("p", "say-quote", res.fala));
        p2.appendChild(el("small", "", res.efeito));
        cx.appendChild(p2);
        const f = el("button", "pill-btn primary", tr("Continuar a consulta", "Continue the session", "Continuar la consulta"));
        f.type = "button"; f.addEventListener("click", () => closeModal("invest-say"));
        cx.appendChild(f);
        sfx(res.bom ? "good" : "bad");
      });
      box.appendChild(b);
    });
    openModal("invest-say");
  }

  // A REFORMULAÇÃO. Repetir a mesma pergunta é a única coisa que um clínico de verdade não faria.
  // ---------------------------------------------------------- ler a defesa (7.2)
  // Uma tentativa por área e por consulta. Errar não custa nada: punir a leitura clínica transformaria
  // observação em tentativa e erro, que é o contrário do que se quer ensinar.
  function painelDefesa(box, r) {
    if (typeof Defesa === "undefined" || !r.defesa || !r.d) return;
    const k = cur(); if (!k) return;
    const caixa = el("div", "dx-reaberto");
    caixa.appendChild(el("h4", "", `🪞 ${tr("Como ela se fechou?", "How did she close up?", "¿Cómo se cerró?")}`));
    if (Defesa.jaLeu(r.d.id)) {
      caixa.appendChild(el("p", "shop-note", tr("Você já leu a defesa desta área hoje.", "You already read this area's defence today.", "Ya leíste la defensa de esta área hoy.")));
      box.appendChild(caixa); return;
    }
    caixa.appendChild(el("p", "shop-note", tr("A parede tem forma, e a forma diz do quadro. Nomear não abre a porta à força — abre um pouco, porque a pessoa se sente lida.", "The wall has a shape, and the shape speaks of the condition. Naming does not force the door — it opens it a little, because the person feels read.", "La pared tiene forma, y la forma habla del cuadro. Nombrar no fuerza la puerta — la abre un poco, porque la persona se siente leída.")));
    const linha = el("div", "uni-row");
    Defesa.opcoes(k, r.d.id).forEach((o) => {
      const bt = el("button", "pill-btn small", pick(o.nome)); bt.type = "button";
      bt.addEventListener("click", () => {
        const res = Defesa.nomear(k, r.d.id, o.id);
        linha.remove();
        const fim = el("div", "");
        fim.appendChild(el("p", res.acertou ? "say-note" : "shop-note", res.acertou
          ? `✅ ${tr("É isso mesmo", "That is it", "Es eso")}: ${pick(res.certo.nome)}.`
          : `↪️ ${tr("Era outra coisa", "It was something else", "Era otra cosa")}: ${pick(res.certo.nome)}.`));
        fim.appendChild(el("p", "shop-note", pick(res.sobre)));
        if (res.acertou) fim.appendChild(el("small", "", tr("Ficou na ficha, e a próxima pergunta desta área pede um pouco menos de confiança.", "It is in the chart, and the next question in this area asks a little less trust.", "Quedó en la ficha, y la próxima pregunta de esta área pide un poco menos de confianza.")));
        caixa.appendChild(fim);
        sfx(res.acertou ? "unlock" : "click");
      });
      linha.appendChild(bt);
    });
    caixa.appendChild(linha);
    box.appendChild(caixa);
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("defesas"), 500);
  }

  function painelReformular(box, r) {
    const k = cur(), id = r.d.id;
    box.appendChild(el("p", "shop-note", tr("Insistir na mesma pergunta é o que menos funciona. Reformule — e repare que cada jeito cobra um preço diferente.", "Pressing the same question is what works least. Rephrase — and notice that each way charges a different price.", "Insistir en la misma pregunta es lo que menos funciona. Reformula, y fíjate en que cada forma cobra un precio distinto.")));
    REFORMULAR.forEach((rf) => {
      const combinado = (book(k).combinado || {})[id];
      if (rf.combina && combinado) return;                       // já está combinado: não dá para combinar de novo
      if (!rf.combina && asksLeft() < rf.custoPergunta + 1) return;   // não sobra pergunta para reformular e ainda perguntar
      const b = el("button", "choice-btn", "");
      b.type = "button";
      b.appendChild(el("b", null, `${rf.icon} ${pick(rf.nome)}`));
      b.appendChild(el("small", "dx-hint", pick(rf.efeito)));
      b.addEventListener("click", () => {
        const body = $("invest-say-body"); body.textContent = "";
        body.appendChild(falaDaDoutora(`— ${pick(rf.fala)}`));
        if (rf.combina) {
          // fica combinado: na próxima consulta a porta já está destrancada
          book(k).combinado[id] = (state.week || 1) * 10 + (state.dayIndex || 0);
          state.affinity = clamp(state.affinity + rf.vinculoOk, 0, 100);
          saveState(); updateHud(); sfx("tip");
          const pat2 = el("div", "say-row pat");
          pat2.appendChild(el("b", "", `💬 ${speaker()}`));
          pat2.appendChild(el("p", "say-quote", `“${tr("Tá. Pode deixar anotado.", "All right. You can note it down.", "Vale. Puedes anotarlo.")}”`));
          pat2.appendChild(el("small", "", tr("Ficou combinado. Na próxima consulta este assunto abre bem mais fácil — e não custou pergunta nenhuma.", "It is agreed. Next session this subject opens far more easily — and it cost no question at all.", "Quedó acordado. En la próxima consulta este tema se abre mucho más fácil, y no costó ninguna pregunta.")));
          body.appendChild(pat2);
          const f2 = el("button", "pill-btn primary", tr("Continuar a consulta", "Continue the session", "Continuar la consulta"));
          f2.type = "button"; f2.addEventListener("click", () => closeModal("invest-say"));
          body.appendChild(f2);
          return;
        }
        // as outras duas perguntam de novo, com a porta mais baixa
        session.reformular = { id, alivio: rf.alivio };
        if (rf.custoPergunta) session.asks = (session.asks || 0) + rf.custoPergunta;   // a borda custa uma pergunta a mais; o ask() abaixo cobra a dele
        const r2 = ask(id);
        if (r2 && !r2.guarded) state.affinity = clamp(state.affinity + rf.vinculoOk, 0, 100);
        else state.affinity = clamp(state.affinity + rf.vinculoErro, 0, 100);
        session.reformular = null;
        saveState(); updateHud();
        showAsk(r2);
      });
      box.appendChild(b);
    });
    const ok = el("button", "pill-btn primary", tr("Deixar como está e continuar", "Leave it and continue", "Dejarlo así y continuar"));
    ok.type = "button";
    ok.addEventListener("click", () => closeModal("invest-say"));
    box.appendChild(ok);
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("reformular"), 500);
  }

  function showAsk(r) {
    if (!r) return;
    closeModal("invest-modal");
    const box = $("invest-say-body"); box.textContent = "";
    box.appendChild(r.olhou ? falaDaDoutora(`— ${tr("(você não diz nada, e só olha)", "(you say nothing, and just watch)", "(no dices nada, solo miras)")}`) : falaDaDoutora(`— ${pick(r.d.ask)}`));
    const pat = el("div", "say-row pat", ""); pat.appendChild(el("b", "", `💬 ${speaker()}`));
    if (r.olhou) {
      pat.appendChild(el("p", "say-note", `👁️ ${r.txt}`));
      if (r.virouAchado) pat.appendChild(el("small", "", tr("Isso ficou anotado na ficha: o que a pessoa não diz também é informação.", "It is noted in the chart: what a person does not say is information too.", "Quedó anotado en la ficha: lo que la persona no dice también es información.")));
      pat.classList.add(r.desvios ? "guard" : "");
    }
    else if (r.blocked === "first") pat.appendChild(el("p", "", tr("(Vocês acabaram de se conhecer. Perguntas de investigação só a partir da segunda consulta.)", "(You have only just met. Investigation questions open from the second session.)", "(Acaban de conocerse. Las preguntas de investigación se abren desde la segunda consulta.)")));
    else if (r.blocked === "intro") pat.appendChild(el("p", "", tr("(Espere a pessoa se apresentar antes de perguntar.)", "(Wait for the person to introduce themselves before asking.)", "(Espera a que la persona se presente antes de preguntar.)")));
    else if (r.blocked) pat.appendChild(el("p", "", tr("A consulta já está longa: não dá para fazer mais perguntas hoje. Continuamos na próxima.", "The session is already long: no more questions today. We continue next time.", "La sesión ya es larga: hoy no hay más preguntas. Seguimos la próxima vez.")));
    else if (r.guarded) {
      // A DEFESA TEM CARA. Antes vinha sempre a mesma frase de desvio, para qualquer pessoa e qualquer
      // quadro. Agora quem se fecha se fecha do jeito dela — e ler esse jeito é jogada (7.2).
      pat.appendChild(el("p", r.defesaFala ? "say-quote" : "", r.defesaFala ? `“${Sens.text(r.defesaFala, "…")}”` : `${pick(GUARDED)}`));
      pat.classList.add("guard");
      const aviso = r.virouAchado
        ? tr(`É a ${r.desvios}ª vez que ela desvia deste assunto. Isso ficou anotado na ficha: o que a pessoa não diz também é informação.`, `That is the ${r.desvios}th time she has steered away from this. It is noted in the chart: what a person does not say is information too.`, `Es la ${r.desvios}ª vez que esquiva este tema. Quedó anotado en la ficha: lo que la persona no dice también es información.`)
        : tr("Ganhe confiança com respostas acolhedoras e tente de novo.", "Build trust with warm answers and try again.", "Gana confianza con respuestas cálidas e inténtalo de nuevo.");
      pat.appendChild(el("small", "", aviso));
      if (r.virouAchado && typeof Tips !== "undefined") setTimeout(() => Tips.fire("desvio"), 600);
      box.appendChild(pat);
      painelDefesa(box, r);
      painelReformular(box, r);
      openModal("invest-say");
      const inv0 = $("btn-invest"); if (inv0) inv0.textContent = btnLabel();
      return;
    }
    else {
      const say = r.f.say || (r.neg || r.f.neg ? negSay(r.d) : null);   // fala do próprio paciente (1ª pessoa); sem ela, a frase-ponte antiga
      if (say) pat.appendChild(el("p", "say-quote", `“${Sens.text(pick(say), "…")}”`));
      else pat.appendChild(el("p", "", `"${pick(LEAD[r.d.id] || LEAD.humor)}"`));
      pat.appendChild(el("p", "say-note", `📝 ${pick(r.f.text || r.d.neg)}`));
      pat.appendChild(el("small", "", r.f.neg || !r.f.pts || !Object.keys(r.f.pts).length ? tr("Achado negativo: também ajuda a descartar hipóteses.", "Negative finding: it also helps rule out hypotheses.", "Hallazgo negativo: también ayuda a descartar hipótesis.") : tr("Anotado na ficha (aba Achados).", "Noted in the chart (Findings tab).", "Anotado en la ficha (pestaña Hallazgos).")));
    }
    box.appendChild(pat);
    const btns = el("div", "say-btns", "");
    if (asksLeft() > 0 && canShow()) { const more = el("button", "pill-btn", `🔎 ${tr("Perguntar outra coisa", "Ask something else", "Preguntar otra cosa")} (${asksLeft()})`); more.type = "button"; more.addEventListener("click", () => { closeModal("invest-say"); openInvest(); }); btns.appendChild(more); }
    const ok = el("button", "pill-btn primary", tr("Continuar a consulta", "Continue the session", "Continuar la consulta")); ok.type = "button";
    // depois de uma área delicada respondida, a pessoa se cala: o silêncio vira intervenção
    const cala = typeof Escuta !== "undefined" && Escuta.mereceSilencio(r);
    if (cala && typeof Tips !== "undefined") setTimeout(() => Tips.fire("silencio"), 500);   // o silêncio se explica na 1ª vez
    ok.addEventListener("click", () => { closeModal("invest-say"); if (cala) silencio(r); });
    btns.appendChild(ok);
    if (r.d && r.d.id === "risco" && typeof Risk !== "undefined" && Risk.canAssess(cur())) { session.riskSeen = true; const rk = el("button", "pill-btn primary", `🚨 ${tr("Avaliar o risco", "Assess the risk", "Evaluar el riesgo")}`); rk.type = "button"; rk.addEventListener("click", () => { closeModal("invest-say"); Risk.assess(cur()); }); btns.insertBefore(rk, btns.firstChild); }
    box.appendChild(btns);
    const inv = $("btn-invest"); if (inv) inv.textContent = btnLabel();
    openModal("invest-say");
  }

  // ------------------------------------------------------------ ficha em abas
  let tab = "apres";
  const TABS = [["apres", "📋", L("Apresentação", "Overview", "Presentación")], ["trilha", "🧭", L("Trilha", "Path", "Ruta")], ["achados", "🔎", L("Achados", "Findings", "Hallazgos")], ["tempo", "🕰️", L("Linha do tempo", "Timeline", "Línea del tiempo")], ["ligar", "🧵", L("Ligar os pontos", "Connect the dots", "Unir los puntos")], ["hipoteses", "⚖️", L("Hipóteses", "Hypotheses", "Hipótesis")], ["formulacao", "🧩", L("Formulação", "Formulation", "Formulación")]];

  function renderTabs() {
    const box = $("dx-tabs"); if (!box) return;
    box.textContent = "";
    box.classList.toggle("hidden", !active());
    if (!active()) { ["dx-panel"].forEach((i) => $(i).classList.add("hidden")); $("ficha-main").classList.remove("hidden"); return; }
    TABS.forEach(([id, icon, name]) => {
      const b = el("button", "shop-tab" + (id === tab ? " active" : ""), `${icon} ${pick(name)}`); b.type = "button";
      b.addEventListener("click", () => { tab = id; renderFicha(); }); box.appendChild(b);
    });
  }

  function renderFicha() {
    if (window.FichaSvelte && active()) {   // o componente Svelte redesenha sozinho a partir da store; o desenho antigo fica escondido
      document.querySelectorAll("#ficha-modal [data-legacy]").forEach((n) => { n.style.display = "none"; });
      notifyState(); return;
    }
    if (window.FichaSvelte) document.querySelectorAll("#ficha-modal [data-legacy]").forEach((n) => { n.style.display = ""; });   // caso sem investigação (secreto): ficha simples de sempre
    renderTabs();
    if (!active()) return;
    const k = cur(), p = $("dx-panel");
    $("ficha-main").classList.toggle("hidden", tab !== "apres");
    p.classList.toggle("hidden", tab === "apres");
    p.textContent = "";
    if (tab === "trilha") panelTrail(p, k); else if (tab === "achados") panelFound(p, k); else if (tab === "tempo") panelTempo(p, k); else if (tab === "ligar") panelLigar(p, k); else if (tab === "hipoteses") panelHyp(p, k); else if (tab === "formulacao") panelForm(p, k);
  }

  // trilha: os marcos do caminho até o diagnóstico
  function trail(k) {
    const b = book(k), dx = data(), found = foundList(k).length, c = CASES[k];
    const sensNeeded = kase(k).findings.filter((f) => (dom(f.d) || {}).sensitive).map((f) => f.d);
    const sensDone = sensNeeded.filter((d) => b.found[d]).length;
    const formOk = SLOTS.filter((s) => b.form[s] === "ok").length;
    const rec = FU.rec(k), sess = session ? session.sess : 1;
    return [
      { ic: "🤝", t: tr("Acolher e ouvir a queixa", "Welcome and hear the complaint", "Acoger y escuchar la queja"), done: Boolean(session && session.unlocked.queixas) || sess > 1, hint: tr("Boas respostas na conversa liberam a queixa e a história.", "Good answers in the talk unlock the complaint and history.", "Las buenas respuestas en la charla liberan la queja y la historia.") },
      { ic: "🔎", t: tr(`Investigar ${MIN_FINDS} áreas ou mais`, `Explore ${MIN_FINDS} areas or more`, `Explorar ${MIN_FINDS} áreas o más`), done: found >= MIN_FINDS, prog: `${Math.min(found, MIN_FINDS)}/${MIN_FINDS}`, hint: tr("Use o botão Investigar durante a consulta.", "Use the Investigate button during the session.", "Usa el botón Investigar durante la sesión.") },
      { ic: "🛟", t: tr("Avaliar áreas delicadas com confiança", "Assess sensitive areas with trust", "Evaluar áreas delicadas con confianza"), done: sensNeeded.length === 0 || sensDone === sensNeeded.length, prog: sensNeeded.length ? `${sensDone}/${sensNeeded.length}` : "", hint: tr("Risco, trauma e substâncias só abrem com vínculo.", "Risk, trauma and substances only open with rapport.", "Riesgo, trauma y sustancias solo se abren con vínculo.") },
      // AS MECÂNICAS ESCONDIDAS ENTRAM NA TRILHA (7.10). Linha do tempo, Ligar os pontos, critério do
      // Manual e conferir em bloco existiam desde a 6.x e quase ninguém achava: viviam atrás de abas
      // que não se anunciam. A Trilha é o mapa do raciocínio — então é aqui que elas aparecem, cada
      // uma com o botão que leva à aba certa. Não é tutorial: é o caminho dizendo por onde se anda.
      { ic: "🕰️", aba: "tempo", t: tr("Pôr os achados no tempo", "Place the findings in time", "Poner los hallazgos en el tiempo"), done: Object.keys(b.tempo || {}).length >= 2, prog: `${Object.keys(b.tempo || {}).length}/2`, hint: tr("Aba Linha do tempo: muita coisa se decide pela ordem — o sintoma veio antes ou depois da perda?", "Timeline tab: much is decided by order — did the symptom come before or after the loss?", "Pestaña Línea de tiempo: mucho se decide por el orden — ¿el síntoma vino antes o después de la pérdida?") },
      { ic: "🧵", aba: "ligar", t: tr("Ligar os pontos", "Connect the dots", "Unir los puntos"), done: Boolean(b.ligar && Object.keys(b.ligar).length), hint: tr("Aba Ligar os pontos: monte a frase do raciocínio com os achados que você coletou.", "Connect the dots tab: build the sentence of your reasoning with the findings you gathered.", "Pestaña Unir los puntos: arma la frase del razonamiento con los hallazgos que reuniste.") },
      { ic: "⚖️", aba: "hipoteses", t: tr("Marcar evidência a favor e contra", "Mark evidence for and against", "Marcar evidencia a favor y en contra"), done: Object.keys(b.evid || {}).some((h) => Object.keys(b.evid[h] || {}).length), hint: tr("Aba Hipóteses: toque numa hipótese e diga o que pesa a favor e o que pesa contra. Sem isso o laudo não sai.", "Hypotheses tab: tap a hypothesis and say what weighs for and against. Without it the report cannot be issued.", "Pestaña Hipótesis: toca una hipótesis y di qué pesa a favor y en contra. Sin eso el informe no sale.") },
      { ic: "📖", aba: "hipoteses", t: tr("Dizer que critério do Manual cada achado preenche", "Say which Manual criterion each finding meets", "Decir qué criterio del Manual cumple cada hallazgo"), done: Object.keys(b.crit || {}).some((h) => Object.keys(b.crit[h] || {}).length), hint: tr("Aba Hipóteses, dentro da hipótese aberta: é o que transforma achado em prova.", "Hypotheses tab, inside the open hypothesis: it is what turns a finding into proof.", "Pestaña Hipótesis, dentro de la hipótesis abierta: es lo que convierte un hallazgo en prueba.") },
      // COMORBIDADE (7.11): quando o caso tem duas coisas ao mesmo tempo, o jogo esperava que o jogador
      // descobrisse sozinho que dá para assumir as duas. Aqui a trilha pergunta — e só quando há motivo:
      // o caso tem comorbidade prevista e o jogador já marcou evidência a favor de duas hipóteses.
      (() => {
        const temCom = typeof PsicoDx !== "undefined" && PsicoDx.comorbidas && (kase(k).comorbid || []).length;
        const comDoisLados = Object.keys(b.evid || {}).filter((h) => Object.values(b.evid[h] || {}).some((v) => v > 0)).length >= 2;
        if (!temCom || !comDoisLados) return null;
        const assumidas = PsicoDx.comorbidas(k) || [];
        return { ic: "➕", aba: "hipoteses", t: tr("Duas coisas ao mesmo tempo?", "Two things at once?", "¿Dos cosas a la vez?"), done: assumidas.length > 0,
          hint: tr("Você marcou evidência a favor de duas hipóteses. Às vezes as duas estão certas: na aba Hipóteses dá para assumir comorbidade em vez de escolher.", "You marked evidence in favour of two hypotheses. Sometimes both are right: in the Hypotheses tab you can take comorbidity instead of choosing.", "Marcaste evidencia a favor de dos hipótesis. A veces ambas son correctas: en la pestaña Hipótesis puedes asumir comorbilidad en vez de elegir.") };
      })(),
      { ic: "🧷", aba: "hipoteses", t: tr("Conferir três marcações de uma vez", "Check three markings at once", "Comprobar tres marcas de una vez"), done: Object.keys(b.firme || {}).length > 0, hint: tr("Aba Hipóteses: o jogo diz QUANTAS caíram, nunca quais — é por isso que vale pensar antes de conferir.", "Hypotheses tab: the game says HOW MANY fell, never which — that is why it pays to think before checking.", "Pestaña Hipótesis: el juego dice CUÁNTAS cayeron, nunca cuáles — por eso conviene pensar antes de comprobar.") },
      { ic: "🧩", t: tr("Formular o caso (5 Ps)", "Formulate the case (5 Ps)", "Formular el caso (5 P)"), done: formOk >= 3, prog: `${formOk}/4`, hint: tr("Aba Formulação: acerte pelo menos 3 dos 4 fatores.", "Formulation tab: get at least 3 of the 4 factors right.", "Pestaña Formulación: acierta al menos 3 de los 4 factores.") },
      { ic: "⚖️", t: tr("Escolher uma hipótese de trabalho", "Choose a working hypothesis", "Elegir una hipótesis de trabajo"), done: Boolean(b.hyp), hint: tr("Aba Hipóteses: compare a evidência e marque a principal.", "Hypotheses tab: compare the evidence and mark the main one.", "Pestaña Hipótesis: compara la evidencia y marca la principal.") },
      { ic: "📝", t: tr("Diagnóstico e encaminhamento (4ª consulta)", "Diagnosis and referral (4th session)", "Diagnóstico y derivación (4.ª sesión)"), done: rec.dx !== null && rec.dx !== undefined, hint: tr("Só na última consulta: a nota depende da evidência reunida.", "Only in the last session: the score depends on the evidence gathered.", "Solo en la última sesión: la nota depende de la evidencia reunida.") }
    ].filter(Boolean);
  }
  function panelTrail(p, k) {
    // CASO REABERTO: a sua conclusão de antes está ali, escrita por você, e é ela que atrapalha.
    if (book(k).reaberto) {
      const av = el("div", "dx-reaberto");
      av.appendChild(el("b", null, `🧊 ${tr("Caso reaberto", "Case reopened", "Caso reabierto")}`));
      av.appendChild(el("p", null, tr("Esta pessoa voltou porque piorou. A sua ficha de antes continua aqui, com a hipótese que você fechou já marcada — e nenhuma ligação está mais travada. Ler o próprio caso com a própria conclusão escrita na frente é a parte difícil: o que você marcou antes não vale mais do que qualquer outra coisa.", "This person came back because they got worse. Your old chart is still here, with the hypothesis you closed already marked — and nothing is locked any more. Reading your own case with your own conclusion written in front of you is the hard part: what you marked before is worth no more than anything else.", "Esta persona volvió porque empeoró. Tu ficha de antes sigue aquí, con la hipótesis que cerraste ya marcada, y nada está trabado. Leer el propio caso con la propia conclusión delante es la parte difícil.")));
      p.appendChild(av);
      if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("frio"), 500);
    }
    p.appendChild(el("p", "shop-note", tr("O caminho de um bom diagnóstico: cada etapa depende do que você conversou e investigou.", "The path to a good diagnosis: each step depends on what you talked about and explored.", "El camino de un buen diagnóstico: cada etapa depende de lo que conversaste e investigaste.")));
    const list = el("ol", "dx-trail"); let nextMarked = false;
    trail(k).forEach((n) => {
      const cls = n.done ? "done" : !nextMarked ? "next" : ""; if (!n.done) nextMarked = true;
      const li = el("li", cls); li.appendChild(el("span", "dx-trail-i", n.done ? "✓" : n.ic));
      const t = el("div", "dx-trail-t"); t.appendChild(el("b", "", n.t + (n.prog ? ` · ${n.prog}` : "")));
      if (!n.done) t.appendChild(el("small", "", n.hint));
      // o passo que tem aba leva até ela: descobrir a mecânica deixa de depender de adivinhar
      if (n.aba && !n.done) {
        const ir = el("button", "pill-btn tiny", `${tr("Abrir", "Open", "Abrir")} ›`); ir.type = "button";
        ir.addEventListener("click", (ev) => { ev.stopPropagation(); tab = n.aba; renderFicha(); });
        t.appendChild(ir);
      }
      li.appendChild(t); list.appendChild(li);
    });
    p.appendChild(list);
  }

  function panelFound(p, k) {
    const b = book(k), n = foundList(k).length;
    p.appendChild(el("p", "shop-note", tr(`${n} de ${data().domains.length} áreas investigadas. Cada consulta permite ${MAX_ASKS} perguntas.`, `${n} of ${data().domains.length} areas explored. Each session allows ${MAX_ASKS} questions.`, `${n} de ${data().domains.length} áreas exploradas. Cada sesión permite ${MAX_ASKS} preguntas.`)));
    const ext = Wheel.externalReport(k);   // 🩺 articulação multidisciplinar
    if (ext) { const box = el("div", "dx-result"); box.appendChild(el("div", "dx-q", `📎 ${ext.from}`)); box.appendChild(el("div", "dx-a", `${ext.area ? ext.area + ": " : ""}${ext.text}`)); p.appendChild(box); }
    data().domains.forEach((d) => {
      const row = el("div", "dx-find" + (b.found[d.id] ? "" : " locked"));
      row.appendChild(el("span", "dx-dom-i", d.icon));
      const t = el("div", "dx-find-t"); t.appendChild(el("b", "", pick(d.name)));
      if (b.found[d.id]) {
        const f = finding(k, d.id); t.appendChild(el("span", f ? "" : "muted", pick(f ? f.text : d.neg)));
        // o achado que serve para dois quadros diz isso na cara: é o que impede de usá-lo como prova
        const amb = ambiguo(k, d.id);
        if (amb) t.appendChild(el("small", "dx-ambiguo", `🔀 ${tr(`Não decide entre ${amb.hyps.map(disorderName).join(" e ")}: pesa igual para os dois.`, `Does not decide between ${amb.hyps.map(disorderName).join(" and ")}: it weighs the same for both.`, `No decide entre ${amb.hyps.map(disorderName).join(" y ")}: pesa igual para ambos.`)}`));
      }
      else t.appendChild(el("small", "", tr("Ainda não investigado.", "Not explored yet.", "Aún sin explorar.")));
      row.appendChild(t); p.appendChild(row);
      const nd = desviosDe(k, d.id);
      if (!b.found[d.id] && nd) {
        const av = el("div", "dx-desvio" + (nd >= DESVIOS_ACHADO ? " forte" : ""), nd >= DESVIOS_ACHADO
          ? tr(`Você perguntou ${nd} vezes sobre isto e a pessoa desviou todas. O que ela não diz também é informação: este assunto custa caro para ela.`, `You asked about this ${nd} times and the person deflected every time. What they do not say is information too: this subject costs them dearly.`, `Preguntaste ${nd} veces sobre esto y la persona esquivó todas. Lo que no dice también es información: este tema le cuesta caro.`)
          : tr(`Desviou ${nd} vez(es).`, `Deflected ${nd} time(s).`, `Esquivó ${nd} vez(ces).`));
        p.appendChild(av);
      }
      if (b.found[d.id]) notasPresas(p, k, "achado", d.id);
    });
    if (typeof PsicoDx !== "undefined") PsicoDx.panelTests(p, k);
    if (session && session.notes.length) { p.appendChild(el("h3", "aqx-h", tr("Observações desta consulta", "Notes from this session", "Observaciones de esta sesión"))); const ul = el("ul", "dx-notes"); session.notes.forEach((x) => ul.appendChild(el("li", "", x))); p.appendChild(ul); }
    // O QUE VOCÊ OBSERVOU, E QUE ANTES SUMIA. "Nomear o que você vê" guardava a marca do corpo em
    // b.corpo e nada na ficha mostrava — a observação virava um beco sem saída. As defesas lidas (7.2)
    // entram no mesmo lugar: as duas coisas são observação clínica, não achado de entrevista.
    const obsCorpo = (b.corpo || []), obsDefesa = (b.defesas || []);
    if (obsCorpo.length || obsDefesa.length) {
      p.appendChild(el("h3", "aqx-h", `👁️ ${tr("O que você observou", "What you observed", "Lo que observaste")}`));
      const ul2 = el("ul", "dx-notes");
      obsCorpo.forEach((x) => ul2.appendChild(el("li", "", `${pick(x)}`)));
      obsDefesa.forEach((d2) => {
        const dom2 = d2.dominio ? dom(d2.dominio) : null;
        ul2.appendChild(el("li", "", `🪞 ${typeof Defesa !== "undefined" ? Defesa.nome(d2.id) : d2.id}${dom2 ? ` — ${tr("ao perguntar sobre", "when asked about", "al preguntar sobre")} ${pick(dom2.name).toLowerCase()}` : ""}`));
      });
      p.appendChild(ul2);
    }
  }

  // ---------------------------------------------------------- a linha do tempo, na ficha
  function panelTempo(p, k) {
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("tempo"), 400);
    const achados = foundList(k);
    p.appendChild(el("p", "shop-note", tr("Muita coisa se decide pela ordem: o sintoma veio antes ou depois da perda? o medo começou junto com o afastamento? Ponha cada achado no seu tempo. O jogo não corrige o seu julgamento — só avisa quando você contraria o que a pessoa disse com todas as letras.", "A lot is decided by order: did the symptom come before or after the loss? did the fear start along with the withdrawal? Place each finding in its time. The game does not correct your judgement — it only warns when you contradict what the person said in so many words.", "Mucho se decide por el orden: ¿el síntoma vino antes o después de la pérdida? ¿el miedo empezó junto con el aislamiento? Coloca cada hallazgo en su tiempo. El juego no corrige tu juicio: solo avisa cuando contradices lo que la persona dijo con todas las letras.")));
    if (!achados.length) { p.appendChild(el("p", "dx-hint", tr("Investigue alguma área primeiro.", "Investigate an area first.", "Investiga algún área primero."))); return; }
    achados.forEach((d) => {
      const f = finding(k, d.id);
      const linha = el("div", "tl-l");
      linha.appendChild(el("span", "tl-t", `${d.icon} ${pick(f ? f.text : d.neg)}`));
      const bar = el("div", "tl-b");
      TEMPOS.forEach(([id, ic, nome]) => {
        const posto = tempoDe(k, d.id) === id;
        const bt = el("button", "pill-btn tiny" + (posto ? " sim" : ""), `${ic}`);
        bt.type = "button";
        bt.title = pick(nome);
        bt.setAttribute("aria-label", `${pick(d.name)}: ${pick(nome)}`);
        bt.setAttribute("aria-pressed", String(posto));
        bt.addEventListener("click", () => { porNoTempo(k, d.id, id); renderFicha(); });
        bar.appendChild(bt);
      });
      linha.appendChild(bar);
      p.appendChild(linha);
    });
    // a linha montada, em ordem
    const postos = TEMPOS.map(([id, ic, nome]) => ({ id, ic, nome, itens: achados.filter((d) => tempoDe(k, d.id) === id) }));
    if (postos.some((c) => c.itens.length)) {
      p.appendChild(el("h3", "aqx-h", `🕰️ ${tr("A sua linha", "Your line", "Tu línea")}`));
      postos.forEach((c) => {
        if (!c.itens.length) return;
        const bl = el("div", "tl-col");
        bl.appendChild(el("b", "", `${c.ic} ${pick(c.nome)}`));
        c.itens.forEach((d) => bl.appendChild(el("div", "tl-item", `${d.icon} ${pick(d.name)}`)));
        p.appendChild(bl);
      });
    }
    const conf = conflitosDeTempo(k);
    conf.slice(0, 3).forEach((c) => {
      const nomeT = (id) => pick((TEMPOS.find((t2) => t2[0] === id) || [])[2] || {});
      p.appendChild(el("div", "dx-contra", tr(`Você pôs "${pick(dom(c.dom).name)}" em ${nomeT(c.seu)}, mas a própria pessoa disse que foi em ${nomeT(c.dito)}.`, `You placed "${pick(dom(c.dom).name)}" in ${nomeT(c.seu)}, but the person themselves said it was ${nomeT(c.dito)}.`, `Pusiste "${pick(dom(c.dom).name)}" en ${nomeT(c.seu)}, pero la propia persona dijo que fue en ${nomeT(c.dito)}.`)));
    });
  }

  // ---------------------------------------------------------- o caderno de campo, na ficha
  function panelCaderno(p, k) {
    const b = book(k);
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("caderno"), 400);
    p.appendChild(el("p", "shop-note", tr("O seu rascunho. Escreva o que quiser — uma suspeita, uma palavra que a pessoa repetiu, algo a perguntar na próxima. Depois prenda a anotação num achado ou numa hipótese, e ela passa a aparecer junto daquilo.", "Your scratch pad. Write whatever you want — a hunch, a word the person repeated, something to ask next time. Then pin the note to a finding or a hypothesis, and it shows up alongside it.", "Tu borrador. Escribe lo que quieras: una sospecha, una palabra que la persona repitió, algo que preguntar la próxima vez. Luego prende la nota a un hallazgo o a una hipótesis y aparecerá junto a eso.")));
    const caixa = el("div", "cad-novo");
    const ta = el("textarea", "cad-txt");
    ta.rows = 3;
    ta.placeholder = tr("Anotar…", "Take a note…", "Anotar…");
    ta.maxLength = 400;
    caixa.appendChild(ta);
    const bt = el("button", "pill-btn primary", `🗒️ ${tr("Anotar", "Add note", "Anotar")}`);
    bt.type = "button";
    bt.addEventListener("click", () => { if (anotar(k, ta.value)) { ta.value = ""; sfx("tip"); renderCaderno(); renderFicha(); } });
    caixa.appendChild(bt);
    p.appendChild(caixa);
    if (!b.caderno.length) { p.appendChild(el("p", "dx-hint", tr("Nenhuma anotação ainda.", "No notes yet.", "Ninguna anotación todavía."))); return; }
    b.caderno.slice().reverse().forEach((n) => {
      const c = el("div", "cad-nota");
      const cab = el("div", "cad-cab");
      cab.appendChild(el("small", "", `${tr("Semana", "Week", "Semana")} ${n.sem} · ${tr("dia", "day", "día")} ${(n.dia || 0) + 1}`));
      const del = el("button", "pill-btn tiny", "🗑");
      del.type = "button";
      del.setAttribute("aria-label", tr("Apagar anotação", "Delete note", "Borrar anotación"));
      del.addEventListener("click", () => { apagarNota(k, n.id); renderCaderno(); renderFicha(); });
      cab.appendChild(del);
      c.appendChild(cab);
      c.appendChild(el("p", "", n.txt));
      // prender: achados investigados e hipóteses do caso
      const sel = el("select", "cad-sel");
      const opt = (v, txt, sel2) => { const o = el("option", "", txt); o.value = v; if (sel2) o.selected = true; sel.appendChild(o); };
      const atual = n.alvo ? `${n.alvo.tipo}:${n.alvo.id}` : "";
      opt("", `📎 ${tr("solta", "unpinned", "suelta")}`, !atual);
      foundList(k).forEach((d2) => opt(`achado:${d2.id}`, `🔎 ${pick(d2.name)}`, atual === `achado:${d2.id}`));
      opts(k).forEach((id) => opt(`hipotese:${id}`, `⚖️ ${disorderName(id)}`, atual === `hipotese:${id}`));
      sel.addEventListener("change", () => {
        const v = sel.value;
        prenderNota(k, n.id, v ? { tipo: v.split(":")[0], id: v.split(":").slice(1).join(":") } : null);
        renderCaderno();
        renderFicha();
      });
      c.appendChild(sel);
      p.appendChild(c);
    });
  }

  // O caderno tem janela PROPRIA. Ficava numa aba da ficha, e isso apagava a diferenca entre as duas
  // coisas: a ficha e o registro clinico, o caderno e seu. E, na pratica, para anotar uma frase dita
  // agora era preciso abrir a ficha e trocar de aba, o que tirava voce da consulta.
  function abrirCaderno() {
    const k = cur();
    if (!k || !kase(k)) return;
    const body = $("caderno-body");
    if (!body) return;
    body.textContent = "";
    panelCaderno(body, k);
    openModal("caderno-modal");
    // o caderno se arrasta pelo título: ele não é uma tela do jogo, é um objeto que você põe ao lado
    // do que está lendo — e fica onde você deixou
    if (typeof Arrastavel !== "undefined") { Arrastavel.registrar("caderno-modal", ".cad-alca"); Arrastavel.posicionar("caderno-modal"); }
    const p2 = $("caderno-new");
    if (p2) p2.classList.add("hidden");
  }
  function renderCaderno() {
    const m = $("caderno-modal");
    if (!m || m.classList.contains("hidden")) return;
    const k = cur();
    if (!k) return;
    const body = $("caderno-body");
    if (!body) return;
    body.textContent = "";
    panelCaderno(body, k);
  }

  // as anotações presas a uma coisa aparecem junto dela
  function notasPresas(pai, k, tipo, id) {
    const ns = notasDe(k, tipo, id);
    if (!ns.length) return;
    ns.forEach((n) => pai.appendChild(el("div", "cad-presa", `🗒️ ${n.txt}`)));
  }

  let hypAberta = null;   // qual hipótese está aberta para marcar evidência

  function panelHyp(p, k) {
    const b = book(k), n = foundList(k).length, achados = foundList(k);
    if (n >= MIN_FINDS && typeof Tips !== "undefined") setTimeout(() => Tips.fire("evidencia"), 400);   // mecânica nova se explica na 1ª vez
    p.appendChild(el("p", "shop-note", n < MIN_FINDS
      ? tr("Reúna ao menos 3 achados antes de trabalhar as hipóteses.", "Gather at least 3 findings before working the hypotheses.", "Reúne al menos 3 hallazgos antes de trabajar las hipótesis.")
      : tr("Abra uma hipótese e aponte, achado por achado, o que pesa A FAVOR e o que pesa CONTRA. As barras são o SEU raciocínio, não o do jogo — a conferência vem quando você fechar o caso.", "Open a hypothesis and mark, finding by finding, what counts FOR and what counts AGAINST. The bars are YOUR reasoning, not the game's — the check comes when you close the case.", "Abre una hipótesis y señala, hallazgo por hallazgo, qué pesa A FAVOR y qué pesa EN CONTRA. Las barras son TU razonamiento, no el del juego — la comprobación llega al cerrar el caso.")));
    const marcas = {};
    opts(k).forEach((id) => { marcas[id] = marcado(k, id); });
    const top = Math.max(1, ...opts(k).map((id) => Math.max(marcas[id].pro, marcas[id].con)));
    opts(k).forEach((id) => {
      const m = marcas[id];
      const row = el("div", "dx-hyp" + (b.hyp === id ? " main" : "") + (hypAberta === id ? " aberta" : ""));
      const nome = el("button", "dx-hyp-nome", `${hypAberta === id ? "▾" : "▸"} ${disorderName(id)}`);
      nome.type = "button"; nome.disabled = n < MIN_FINDS;
      nome.addEventListener("click", () => { hypAberta = hypAberta === id ? null : id; renderFicha(); });
      row.appendChild(nome);
      const bars = el("div", "dx-bars"), pro = el("i", "pro"), con = el("i", "con");
      pro.style.width = `${(m.pro / top) * 100}%`; con.style.width = `${(m.con / top) * 100}%`;
      bars.appendChild(pro); bars.appendChild(con); row.appendChild(bars);
      row.appendChild(el("small", "", m.pro + m.con ? `+${m.pro}  −${m.con}` : tr("sem marcação", "not marked", "sin marcar")));
      const btn = el("button", "pill-btn small", b.hyp === id ? tr("⭐ Principal", "⭐ Main", "⭐ Principal") : tr("Marcar", "Mark", "Marcar")); btn.type = "button"; btn.disabled = n < MIN_FINDS;
      btn.addEventListener("click", () => { b.hyp = b.hyp === id ? null : id; saveState(); renderFicha(); }); row.appendChild(btn);
      p.appendChild(row);
      if (hypAberta === id && n >= MIN_FINDS) {
        const lista = el("div", "dx-evid");
        if (!achados.length) lista.appendChild(el("p", "shop-note", tr("Você ainda não tem achados para pesar.", "You have no findings to weigh yet.", "Aún no tienes hallazgos que pesar.")));
        achados.forEach((d) => {
          const f = finding(k, d.id);
          const linha = el("div", "dx-evid-l");
          linha.appendChild(el("span", "dx-evid-t", `${d.icon} ${pick(f ? f.text : d.neg)}`));
          const vote = el("div", "dx-evid-b");
          [[1, "👍", tr("a favor", "for", "a favor")], [-1, "👎", tr("contra", "against", "en contra")]].forEach(([v, ic, lab]) => {
            const marcada = marcaDe(k, id, d.id) === v;
            const trava = firmada(k, id, d.id);
            const bt = el("button", "pill-btn tiny" + (marcada ? (v > 0 ? " sim" : " nao") : "") + (trava ? " firme" : ""), `${trava && marcada ? "🔒 " : ""}${ic} ${lab}`);
            bt.type = "button";
            bt.disabled = trava;
            bt.setAttribute("aria-pressed", String(marcada));
            bt.addEventListener("click", () => { marcarEvidencia(k, id, d.id, v); renderFicha(); });
            vote.appendChild(bt);
          });
          linha.appendChild(vote);
          lista.appendChild(linha);
          // marcou a favor: diga de QUE critério do Manual este achado é prova
          if (marcaDe(k, id, d.id) === 1) {
            const itens = criterios(id);
            if (itens.length) {
              const sel = el("div", "dx-crit");
              if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("criterio"), 450);
              sel.appendChild(el("small", "", `📘 ${tr("Que critério este achado preenche?", "Which criterion does this finding fulfil?", "¿Qué criterio cumple este hallazgo?")}`));
              itens.forEach((it, i) => {
                const escolhido = criterioDe(k, id, d.id) === i;
                const bt = el("button", "pill-btn tiny" + (escolhido ? " sim" : ""), `${i + 1}`);
                bt.type = "button";
                bt.title = pick(it);
                bt.setAttribute("aria-label", `${tr("Critério", "Criterion", "Criterio")} ${i + 1}: ${pick(it)}`);
                bt.setAttribute("aria-pressed", String(escolhido));
                bt.disabled = firmada(k, id, d.id);
                bt.addEventListener("click", () => { marcarCriterio(k, id, d.id, i); renderFicha(); });
                sel.appendChild(bt);
              });
              const esc = criterioDe(k, id, d.id);
              if (esc !== null && itens[esc]) sel.appendChild(el("small", "dx-crit-t", pick(itens[esc])));
              lista.appendChild(sel);
            }
          }
        });
        // o que ainda não tem prova nenhuma
        notasPresas(lista, k, "hipotese", id);
        const cob = coberturaCriterios(k, id);
        if (cob.total) {
          const res = el("div", "dx-cober");
          res.appendChild(el("b", "", `📘 ${tr("Critérios sustentados", "Criteria supported", "Criterios sustentados")}: ${cob.cobertos.length}/${cob.total}`));
          if (cob.faltam.length) res.appendChild(el("div", "dx-hint", `${tr("Ainda sem prova", "Still unproven", "Aún sin prueba")}: ${cob.faltam.map((i) => `${i + 1}. ${pick(cob.itens[i])}`).join(" · ")}`));
          else res.appendChild(el("div", "dx-hint ok", tr("Todos os critérios deste transtorno têm ao menos um achado seu apontado.", "Every criterion of this disorder has at least one finding of yours behind it.", "Cada criterio de este trastorno tiene al menos un hallazgo tuyo detrás.")));
          lista.appendChild(res);
        }
        p.appendChild(lista);
      }
    });
    if (n >= MIN_FINDS) { painelTrio(p, k); if (typeof Tips !== "undefined" && ligacoesSoltas(k).length >= TRIO) setTimeout(() => Tips.fire("trio"), 500); }
    if (typeof PsicoDx !== "undefined" && n >= MIN_FINDS) PsicoDx.panelDiff(p, k, renderFicha);
  }

  // conferir em bloco + as contradições do próprio raciocínio
  function painelTrio(p, k) {
    const soltas = ligacoesSoltas(k), b = book(k);
    const firmes = Object.keys(b.firme || {}).length;
    const cx = el("div", "dx-trio");
    cx.appendChild(el("h3", "aqx-h", `⚖️ ${tr("Conferir o raciocínio", "Check the reasoning", "Comprobar el razonamiento")}${firmes ? ` · ${firmes} ${tr("firmada(s)", "locked", "firmada(s)")}` : ""}`));
    cx.appendChild(el("p", "dx-hint", tr(`Aponte ${TRIO} ligações de uma vez. O jogo diz quantas não se sustentam — nunca quais. Se as ${TRIO} estiverem de pé, elas travam e viram raciocínio firmado.`, `Submit ${TRIO} links at once. The game says how many do not hold up — never which ones. If all ${TRIO} stand, they lock in as settled reasoning.`, `Presenta ${TRIO} conexiones a la vez. El juego dice cuántas no se sostienen, nunca cuáles. Si las ${TRIO} se sostienen, quedan fijadas.`)));
    if (soltas.length < TRIO) {
      cx.appendChild(el("p", "shop-note", tr(`Faltam ${TRIO - soltas.length} ligação(ões) marcada(s) para poder conferir um bloco.`, `${TRIO - soltas.length} more marked link(s) needed to check a block.`, `Faltan ${TRIO - soltas.length} conexión(es) marcada(s) para comprobar un bloque.`)));
    } else {
      const bt = el("button", "pill-btn primary", `⚖️ ${tr(`Conferir ${TRIO} ligações`, `Check ${TRIO} links`, `Comprobar ${TRIO} conexiones`)}`);
      bt.type = "button";
      bt.addEventListener("click", () => {
        const r = conferirTrio(k, soltas.slice(0, TRIO));
        if (r.firmou) { sfx("unlock"); showToast(`🔒 ${tr(`As ${TRIO} se sustentam. Raciocínio firmado (+3 XP).`, `All ${TRIO} hold up. Reasoning settled (+3 XP).`, `Las ${TRIO} se sostienen. Razonamiento fijado (+3 XP).`)}`); }
        else { sfx("bad"); showToast(`⚖️ ${tr(`${r.erradas} das ${TRIO} não se sustentam. Repense — o jogo não diz quais.`, `${r.erradas} of the ${TRIO} do not hold up. Think again — the game will not say which.`, `${r.erradas} de las ${TRIO} no se sostienen. Repiensa: el juego no dice cuáles.`)}`); }
        updateHud(); renderFicha();
      });
      cx.appendChild(bt);
    }
    const contr = contradicoes(k);
    if (contr.length && typeof Tips !== "undefined") setTimeout(() => Tips.fire("contradicao"), 600);
    if (contr.length) {
      cx.appendChild(el("h3", "aqx-h", `⚡ ${tr("Contradição no seu raciocínio", "A contradiction in your reasoning", "Contradicción en tu razonamiento")}`));
      contr.slice(0, 3).forEach((c) => {
        cx.appendChild(el("div", "dx-contra", tr(
          `Você apontou "${pick(dom(c.dom).name)}" a favor de ${disorderName(c.a)} E de ${disorderName(c.b)}. As duas não podem estar certas ao mesmo tempo: desmarque uma, ou assuma comorbidade no diferencial.`,
          `You marked "${pick(dom(c.dom).name)}" in favour of both ${disorderName(c.a)} and ${disorderName(c.b)}. Both cannot be right at once: unmark one, or declare comorbidity in the differential.`,
          `Marcaste "${pick(dom(c.dom).name)}" a favor de ${disorderName(c.a)} Y de ${disorderName(c.b)}. Ambas no pueden ser correctas a la vez: desmarca una, o asume comorbilidad en el diferencial.`)));
      });
    }
    p.appendChild(cx);
  }

  // formulação: 3 frases por fator (uma é deste paciente, duas são de outros casos): escolha a que combina com o que você viu
  function formChoices(k, slot) {
    const others = Object.keys(data().cases).filter((x) => x !== k).sort((a, b) => hash(k + slot + a) - hash(k + slot + b)).slice(0, 2);
    const list = [{ id: k, text: kase(k).form[slot] }].concat(others.map((o) => ({ id: o, text: data().cases[o].form[slot] })));
    return list.sort((a, b) => hash(k + slot + a.id) % 7 - hash(k + slot + b.id) % 7 || (a.id === k ? -1 : 1));
  }
  // "Ligar os pontos": uma frase com lacunas que VOCÊ preenche com os achados que coletou.
  // Diferente da Formulação (que escolhe entre frases prontas), aqui a matéria-prima é o que
  // você de fato investigou neste paciente — quem não investigou não tem com o que preencher.
  function panelLigar(p, k) {
    const ded = (kase(k) || {}).deducao;
    if (!ded) { p.appendChild(el("p", "shop-note muted", tr("Este caso ainda não tem um raciocínio para montar.", "This case has no reasoning to assemble yet.", "Este caso aún no tiene un razonamiento para montar."))); return; }
    const b = book(k);
    b.ligar = b.ligar || {};
    const achados = foundList(k).map((d) => d.id);                  // ids dos domínios já investigados (foundList devolve os objetos)
    p.appendChild(el("p", "shop-note", tr("Monte o raciocínio com o que você ouviu. Toque numa lacuna e escolha o achado que encaixa.", "Assemble the reasoning from what you heard. Tap a blank and choose the finding that fits.", "Monta el razonamiento con lo que escuchaste. Toca un hueco y elige el hallazgo que encaja.")));
    if (achados.length < 2) { p.appendChild(el("p", "shop-note muted", tr("🔒 Investigue ao menos 2 áreas para começar a ligar os pontos.", "🔒 Explore at least 2 areas to start connecting the dots.", "🔒 Explora al menos 2 áreas para empezar a unir los puntos."))); return; }

    const chaves = Object.keys(ded.slots);
    const completo = chaves.every((c) => b.ligar[c] === ded.slots[c]);
    const frase = el("p", "dx-ded");
    pick(ded.texto).split(/(\{[A-Z]\})/).forEach((parte) => {
      const m = parte.match(/^\{([A-Z])\}$/);
      if (!m) return frase.appendChild(document.createTextNode(parte));
      const c = m[1], posto = b.ligar[c], certo = posto === ded.slots[c];
      const lac = el("button", "dx-lacuna" + (posto ? (certo ? " ok" : " err") : ""), posto ? pick((dom(posto) || { name: posto }).name) : "______");
      lac.type = "button";
      lac.addEventListener("click", () => escolherLacuna(k, c, achados));
      frase.appendChild(lac);
    });
    p.appendChild(frase);

    if (completo) {
      if (!b.ligarOk) { b.ligarOk = true; state.xp += 8; if (typeof Wheel !== "undefined") Wheel.gain("raciocinio", 2); sfx("levelup"); updateHud(); saveState(); }
      const cx = el("div", "dx-why ok");
      cx.appendChild(el("b", null, `🧵 ${tr("O raciocínio fecha", "The reasoning holds", "El razonamiento cierra")}`));
      cx.appendChild(el("p", null, pick(ded.fecho)));
      p.appendChild(cx);
    } else if (chaves.some((c) => b.ligar[c] && b.ligar[c] !== ded.slots[c])) {
      p.appendChild(el("p", "shop-note muted", tr("Alguma peça não encaixa: as lacunas erradas estão em vermelho. Toque de novo para trocar.", "Something does not fit: the wrong blanks are in red. Tap again to change.", "Algo no encaja: los huecos equivocados están en rojo. Toca de nuevo para cambiar.")));
    }
  }

  function escolherLacuna(k, chave, achados) {
    const b = book(k), ded = kase(k).deducao;
    const body = () => $("psico-body");
    $("psico-title").textContent = `🧵 ${tr("Qual achado entra aqui?", "Which finding goes here?", "¿Qué hallazgo va aquí?")}`;
    body().textContent = "";
    body().appendChild(el("p", "shop-note", tr("Só dá para usar o que você já investigou neste paciente.", "You can only use what you have already explored with this patient.", "Solo puedes usar lo que ya investigaste con este paciente.")));
    achados.forEach((d0) => {
      const f = (kase(k).findings || []).find((x) => x.d === d0);
      const btn = el("button", "dx-opt", `${(dom(d0) || {}).icon || ""} ${pick((dom(d0) || { name: d0 }).name)} — ${f ? pick(f.text) : ""}`);
      btn.type = "button";
      btn.addEventListener("click", () => {
        b.ligar[chave] = d0;
        if (d0 !== ded.slots[chave]) { sfx("bad"); } else sfx("good");
        saveState(); closeModal("psico-modal"); renderFicha();
      });
      body().appendChild(btn);
    });
    const c = el("button", "pill-btn", tr("Cancelar", "Cancel", "Cancelar")); c.type = "button";
    c.addEventListener("click", () => { closeModal("psico-modal"); renderFicha(); });
    body().appendChild(c);
    openModal("psico-modal");
  }

  function panelForm(p, k) {
    const b = book(k), n = foundList(k).length, c = CASES[k];
    p.appendChild(el("p", "shop-note", tr("Formulação dos 5 Ps: apresentação e quatro fatores. Escolha, em cada um, a frase que combina com este paciente.", "5 Ps formulation: presentation and four factors. In each, choose the sentence that fits this patient.", "Formulación de las 5 P: presentación y cuatro factores. En cada uno, elige la frase que encaja con este paciente.")));
    const pres = el("div", "dx-slot"); pres.appendChild(el("b", "", `📌 ${tr("Apresentação", "Presenting problem", "Presentación")}`)); pres.appendChild(el("p", "", pick(c.complaint))); p.appendChild(pres);
    if (n < 2) { p.appendChild(el("p", "shop-note muted", tr("🔒 Investigue ao menos 2 áreas para conseguir formular.", "🔒 Explore at least 2 areas to be able to formulate.", "🔒 Explora al menos 2 áreas para poder formular."))); return; }
    SLOTS.forEach((slot) => {
      const info = SLOT_INFO[slot], box = el("div", "dx-slot" + (b.form[slot] === "ok" ? " ok" : ""));
      box.appendChild(el("b", "", `${info.icon} ${pick(info.name)}`)); box.appendChild(el("small", "", pick(info.q)));
      if (b.form[slot] === "ok") box.appendChild(el("p", "dx-slot-ok", `✓ ${pick(kase(k).form[slot])}`));
      else formChoices(k, slot).forEach((o) => {
        const btn = el("button", "dx-opt", pick(o.text)); btn.type = "button";
        btn.addEventListener("click", () => {
          if (o.id === k) { b.form[slot] = "ok"; state.xp += 2; sfx("good"); updateHud(); } else { b.form[slot] = "bad"; sfx("bad"); showToast(tr("Não combina com o que você viu deste paciente.", "That does not fit what you saw of this patient.", "No encaja con lo que viste de este paciente.")); }
          saveState(); renderFicha();
        });
        box.appendChild(btn);
      });
      p.appendChild(box);
    });
  }

  // ------------------------------------------------------------ dados da ficha para a interface (usados pelo componente Svelte FichaClinica)
  // Só dados prontos e ações: o desenho fica por conta de quem chama (o DOM antigo abaixo ou o Svelte).
  const notifyState = () => { try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* nada */ } };
  function fichaData() {
    if (!session || !active()) return null;
    const k = cur(), b = book(k), c = CASES[k], e = evidence(k), n = foundList(k).length;
    const apresent = [["ficha.name", c.name, true], ["ficha.age", c.age, true], ["ficha.complaint", Sens.text(c.complaint), session.unlocked.queixas], ["ficha.history", Sens.text(c.history), session.unlocked.historia]]
      .concat(typeof Risk !== "undefined" && Risk.warnLabel(k) ? [["ficha.warn", Risk.warnLabel(k), true]] : [])
      .map(([key, value, open]) => ({ label: t(key), value: open ? value : t("ficha.locked"), open: Boolean(open) }));
    let nextMarked = false;
    const steps = trail(k).map((x) => { const next = !x.done && !nextMarked; if (!x.done) nextMarked = true; return { icon: x.done ? "✓" : x.ic, title: x.t + (x.prog ? ` · ${x.prog}` : ""), hint: x.done ? "" : x.hint, done: x.done, next }; });
    const top = Math.max(1, ...opts(k).map((id) => e.by[id].pro));
    const ext = Wheel.externalReport(k);
    const tp = typeof PsicoDx !== "undefined" ? PsicoDx : null;
    return {
      k, tab, active: true,
      tabs: TABS.map(([id, icon, name]) => ({ id, icon, name: pick(name) })),
      apres: { fields: apresent, notes: session.notes.slice(), tip: t("ficha.tip"), notesTitle: t("ficha.notes") },
      trail: { intro: tr("O caminho de um bom diagnóstico: cada etapa depende do que você conversou e investigou.", "The path to a good diagnosis: each step depends on what you talked about and explored.", "El camino de un buen diagnóstico: cada etapa depende de lo que conversaste e investigaste."), steps },
      found: {
        intro: tr(`${n} de ${data().domains.length} áreas investigadas. Cada consulta permite ${MAX_ASKS} perguntas.`, `${n} of ${data().domains.length} areas explored. Each session allows ${MAX_ASKS} questions.`, `${n} de ${data().domains.length} áreas exploradas. Cada sesión permite ${MAX_ASKS} preguntas.`),
        ext: ext ? { from: ext.from, text: `${ext.area ? ext.area + ": " : ""}${ext.text}` } : null,
        domains: data().domains.map((d) => { const open = Boolean(b.found[d.id]), f = finding(k, d.id); return { id: d.id, icon: d.icon, name: pick(d.name), open, muted: open && !f, text: open ? pick(f ? f.text : d.neg) : tr("Ainda não investigado.", "Not explored yet.", "Aún sin explorar.") }; }),
        extra: tp ? tp.testsData(k) : { late: null, tests: [] },
        notesTitle: tr("Observações desta consulta", "Notes from this session", "Observaciones de esta sesión"), notes: session.notes.slice()
      },
      hyp: {
        // as barras são a marcação DO JOGADOR (ver `marcado`), não a conta do jogo
        intro: n < MIN_FINDS ? tr("Reúna ao menos 3 achados antes de trabalhar as hipóteses.", "Gather at least 3 findings before working the hypotheses.", "Reúne al menos 3 hallazgos antes de trabajar las hipótesis.") : tr("Abra uma hipótese e aponte, achado por achado, o que pesa a favor e o que pesa contra. As barras são o seu raciocínio; a conferência vem ao fechar o caso.", "Open a hypothesis and mark, finding by finding, what counts for and what counts against. The bars are your reasoning; the check comes when you close the case.", "Abre una hipótesis y señala, hallazgo por hallazgo, qué pesa a favor y qué en contra. Las barras son tu razonamiento; la comprobación llega al cerrar el caso."),
        list: opts(k).map((id) => { const m = marcado(k, id); const topo = Math.max(1, ...opts(k).map((o) => Math.max(marcado(k, o).pro, marcado(k, o).con))); return { id, name: disorderName(id), pro: m.pro, con: m.con, proPct: (m.pro / topo) * 100, conPct: (m.con / topo) * 100, main: b.hyp === id, disabled: n < MIN_FINDS, label: b.hyp === id ? tr("⭐ Principal", "⭐ Main", "⭐ Principal") : tr("Marcar", "Mark", "Marcar"), evid: foundList(k).map((d2) => { const f2 = finding(k, d2.id); return { dom: d2.id, icon: d2.icon, text: pick(f2 ? f2.text : d2.neg), mark: marcaDe(k, id, d2.id) }; }) }; }),
        diff: tp && n >= MIN_FINDS ? tp.diffData(k) : null
      },
      form: formData(k, b, n, c)
    };
  }
  function formData(k, b, n, c) {
    return {
      intro: tr("Formulação dos 5 Ps: apresentação e quatro fatores. Escolha, em cada um, a frase que combina com este paciente.", "5 Ps formulation: presentation and four factors. In each, choose the sentence that fits this patient.", "Formulación de las 5 P: presentación y cuatro factores. En cada uno, elige la frase que encaja con este paciente."),
      presentTitle: `📌 ${tr("Apresentação", "Presenting problem", "Presentación")}`, presenting: pick(c.complaint),
      locked: n < 2 ? tr("🔒 Investigue ao menos 2 áreas para conseguir formular.", "🔒 Explore at least 2 areas to be able to formulate.", "🔒 Explora al menos 2 áreas para poder formular.") : null,
      slots: n < 2 ? [] : SLOTS.map((slot) => { const info = SLOT_INFO[slot], ok = b.form[slot] === "ok"; return { slot, icon: info.icon, name: pick(info.name), q: pick(info.q), ok, text: ok ? pick(kase(k).form[slot]) : "", choices: ok ? [] : formChoices(k, slot).map((o) => ({ id: o.id, text: pick(o.text) })) }; })
    };
  }
  const actions = {
    // ganchos usados pelos testes (tools/testes)
    ask: (id) => ask(id),
    olhar: (id) => olhar(id),
    showAsk: (r) => showAsk(r),
    setTab(id) { tab = id; renderFicha(); notifyState(); },
    setHyp(id) { const k = cur(), b = book(k); b.hyp = b.hyp === id ? null : id; saveState(); renderFicha(); },
    pickForm(slot, id) {
      const k = cur(), b = book(k);
      if (id === k) { b.form[slot] = "ok"; state.xp += 2; sfx("good"); updateHud(); } else { b.form[slot] = "bad"; sfx("bad"); showToast(tr("Não combina com o que você viu deste paciente.", "That does not fit what you saw of this patient.", "No encaja con lo que viste de este paciente.")); }
      saveState(); renderFicha();
    }
  };

  // ------------------------------------------------------------ revisão do diagnóstico (fim da 4ª consulta)
  function review(id, ok) {
    const k = cur();
    if (!k || !kase(k)) return { bonus: 0, lines: [], factor: 1 };
    const n = foundList(k).length, s = strength(k), ans = CASES[k].diagnosis.answer, b = book(k), e = evidence(k);
    const weak = n < MIN_FINDS || s < 0.4, strong = n >= 5 && s >= 0.7;
    const lines = [];
    if (ok && strong) lines.push(tr(`Raciocínio sólido: você reuniu ${n} achados e ${Math.round(s * 100)}% da evidência a favor de ${disorderName(ans)}. Bom trabalho.`, `Solid reasoning: you gathered ${n} findings and ${Math.round(s * 100)}% of the evidence for ${disorderName(ans)}. Well done.`, `Razonamiento sólido: reuniste ${n} hallazgos y el ${Math.round(s * 100)}% de la evidencia a favor de ${disorderName(ans)}. Buen trabajo.`));
    else if (ok && weak) lines.push(tr(`Você acertou, mas quase sem investigar (${n} achados). Na prática, um diagnóstico assim seria arriscado: o acompanhamento fica inconclusivo.`, `You got it right, but almost without investigating (${n} findings). In practice such a diagnosis would be risky: follow-up becomes inconclusive.`, `Acertaste, pero casi sin investigar (${n} hallazgos). En la práctica un diagnóstico así sería arriesgado: el seguimiento queda inconcluso.`));
    else if (ok) lines.push(tr(`Certo, e com evidência razoável (${n} achados).`, `Correct, with reasonable evidence (${n} findings).`, `Correcto, con evidencia razonable (${n} hallazgos).`));
    else if (s >= 0.5) lines.push(tr(`Seus próprios achados apontavam para ${disorderName(ans)}: releia a aba Hipóteses antes de decidir.`, `Your own findings pointed to ${disorderName(ans)}: reread the Hypotheses tab before deciding.`, `Tus propios hallazgos apuntaban a ${disorderName(ans)}: relee la pestaña Hipótesis antes de decidir.`));
    else lines.push(tr(`Faltou investigar: só ${n} achado(s), e a maior parte da evidência ficou de fora.`, `Not enough investigation: only ${n} finding(s), and most of the evidence was left out.`, `Faltó investigar: solo ${n} hallazgo(s), y la mayor parte de la evidencia quedó fuera.`));
    const missed = kase(k).findings.filter((f) => !b.found[f.d] && (f.pts[ans] || 0) > 0).map((f) => pick(dom(f.d).name));
    if (missed.length && !strong) lines.push(tr(`Áreas decisivas que você não investigou: ${missed.join(", ")}.`, `Decisive areas you did not explore: ${missed.join(", ")}.`, `Áreas decisivas que no exploraste: ${missed.join(", ")}.`));
    if (b.hyp && b.hyp !== id) lines.push(tr(`Sua hipótese de trabalho era ${disorderName(b.hyp)}; você mudou de ideia na hora de fechar.`, `Your working hypothesis was ${disorderName(b.hyp)}; you changed your mind at the end.`, `Tu hipótesis de trabajo era ${disorderName(b.hyp)}; cambiaste de idea al cerrar.`));
    void e;
    // A CONFERÊNCIA DO SEU RACIOCÍNIO. As barras da aba Hipóteses mostram o que você apontou, não o que o
    // jogo calculou: é aqui que se descobre se o que você ligou estava de pé. Marcar dá nota; marcar
    // errado custa. Quem não marcou nada fecha o caso no escuro, e o jogo diz isso.
    const mk = conferirMarcacao(k);
    if (!mk.total) lines.push(tr("Você fechou sem apontar nenhuma evidência na aba Hipóteses: o raciocínio não ficou registrado em lugar nenhum.", "You closed without marking any evidence in the Hypotheses tab: the reasoning was not recorded anywhere.", "Cerraste sin señalar ninguna evidencia en la pestaña Hipótesis: el razonamiento no quedó registrado en ninguna parte."));
    else {
      const pct = Math.round((mk.certos / mk.total) * 100);
      lines.push(tr(`Das ${mk.total} ligações que você marcou entre achado e hipótese, ${mk.certos} se sustentam (${pct}%).`, `Of the ${mk.total} links you marked between finding and hypothesis, ${mk.certos} hold up (${pct}%).`, `De las ${mk.total} conexiones que marcaste entre hallazgo e hipótesis, ${mk.certos} se sostienen (${pct}%).`));
      if (mk.errados) {
        const erradas = [];
        Object.entries(b.evid || {}).forEach(([hyp, m]) => Object.entries(m).forEach(([d2, v]) => {
          if (!b.found[d2] || pesoReal(k, hyp, d2) === (v > 0 ? 1 : -1) || erradas.length >= 3) return;
          erradas.push(`${pick(dom(d2).name)} ${v > 0 ? "→" : "⊣"} ${disorderName(hyp)}`);
        }));
        if (erradas.length) lines.push(tr(`Não se sustentam: ${erradas.join("; ")}.`, `Do not hold up: ${erradas.join("; ")}.`, `No se sostienen: ${erradas.join("; ")}.`));
      }
    }
    // COBERTURA DOS CRITÉRIOS: não basta apontar evidência, é preciso sustentar o transtorno inteiro.
    // Um diagnóstico com dois critérios provados e três no ar é exatamente o que um supervisor devolve.
    // Quem não usou a aba Hipóteses já leva a penalidade da marcação: cobrar de novo pelos critérios
    // seria punir duas vezes a mesma omissão, e investigar bem deixava de compensar. A cobertura só
    // pesa para quem entrou no jogo do raciocínio.
    const cob = coberturaCriterios(k, id);
    let notaCriterios = 0;
    if (cob.total && mk.total) {
      const prop = cob.cobertos.length / cob.total;
      notaCriterios = Math.round((prop - 0.5) * 6);
      if (cob.faltam.length) lines.push(tr(`Você sustentou ${cob.cobertos.length} dos ${cob.total} critérios de ${disorderName(id)}. Ficaram sem prova: ${cob.faltam.map((i) => pick(cob.itens[i])).join("; ")}.`, `You supported ${cob.cobertos.length} of the ${cob.total} criteria for ${disorderName(id)}. Left unproven: ${cob.faltam.map((i) => pick(cob.itens[i])).join("; ")}.`, `Sustentaste ${cob.cobertos.length} de los ${cob.total} criterios de ${disorderName(id)}. Quedaron sin prueba: ${cob.faltam.map((i) => pick(cob.itens[i])).join("; ")}.`));
      else lines.push(tr(`Os ${cob.total} critérios de ${disorderName(id)} têm achado seu por trás. É um diagnóstico que se defende.`, `All ${cob.total} criteria for ${disorderName(id)} have a finding of yours behind them. That is a diagnosis that holds up.`, `Los ${cob.total} criterios de ${disorderName(id)} tienen un hallazgo tuyo detrás. Es un diagnóstico que se defiende.`));
    }
    const conflitos = conflitosDeTempo(k);
    if (conflitos.length) lines.push(tr(`A sua linha do tempo contraria o que a pessoa disse em ${conflitos.length} ponto(s): ${conflitos.map((c) => pick(dom(c.dom).name)).join(", ")}.`, `Your timeline contradicts what the person said at ${conflitos.length} point(s): ${conflitos.map((c) => pick(dom(c.dom).name)).join(", ")}.`, `Tu línea del tiempo contradice lo que la persona dijo en ${conflitos.length} punto(s): ${conflitos.map((c) => pick(dom(c.dom).name)).join(", ")}.`));
    const notaMarcacao = (mk.total ? Math.round((mk.certos - mk.errados) * 0.8) : -2) + notaCriterios - conflitos.length;
    const ex = typeof PsicoDx !== "undefined" ? PsicoDx.reviewExtra(k, id, ok) : { bonus: 0, factor: 1, lines: [] };
    if (session && session.riskFail) { ex.factor *= 0.8; ex.bonus -= 4; ex.lines.push(tr("Omissão diante do risco: o resultado da avaliação fica inconclusivo e de risco (×0,8).", "Omission in the face of risk: the assessment result is inconclusive and at risk (×0.8).", "Omisión ante el riesgo: el resultado de la evaluación queda no concluyente y de riesgo (×0,8).")); }
    ex.lines.forEach((l) => lines.push(l));
    return { bonus: (ok ? (strong ? 5 : weak ? -6 : 0) : 0) + ex.bonus + notaMarcacao, lines, factor: (ok && weak ? 0.75 : strong ? 1.05 : 1) * ex.factor, weak, marcacao: mk };
  }
  const factor = (s) => { const r = s.dx && s.dx.review; return r ? r.factor : 1; };

  return { resetData, fichaData, actions, ambiguo, ambiguoEntre, marcarEvidencia, marcaDe, marcado, conferirMarcacao, DESVIOS_ACHADO, desviosDe, areasEvitadas, FONTES, fonteDe, podePedir, pedir, pedidos, areaDaFonte, entregarPedidos, pedidosPendentes, TEMPOS, tempoDe, porNoTempo, tempoDito, conflitosDeTempo, ligacoesSoltas, CAMINHOS, caminhosAbertos, conferirTrio, contradicoes, firmada, TRIO, criterios, criterioDe, marcarCriterio, coberturaCriterios, anotar, apagarNota, prenderNota, notasDe, abrirCaderno, renderCaderno, REFORMULAR, ALIVIO_COMBINADO, setTab: (t) => { tab = t; notifyState(); }, introduced, firstMeet, cur, kase, dom, data, opts, finding, INV_BUDGET, budgetLeft, spend, refreshBtn: () => { const b = $("btn-invest"); if (b) b.textContent = btnLabel(); }, active, canShow, canTest, progress, asksLeft, pesoDoAchado, btnLabel, openInvest, renderFicha, review, factor, reaction, noteShared, GUARDED, evidence, strength, book, MAX_ASKS, foundList };
})();

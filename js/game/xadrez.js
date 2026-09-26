"use strict";

// ===========================================================================
// Clube de Xadrez & Mente Ampla — a parte jogável do clube (o lugar, o Mestre Iuri e os três
// cartões de aprendizagem já existem em content/world.json desde a 3.36).
//
//  · Motor de regras próprio (sem biblioteca externa): lances legais, xeque, xeque-mate, afogamento,
//    roque, en passant e promoção. Escrito aqui porque o jogo roda como script clássico no site
//    publicado — uma dependência de npm só existiria no build do Vite.
//  · Partida casual contra o computador, em três níveis.
//  · Torneio semanal (sexta-feira): três rodadas de verdade, cada uma mais forte, com troféu para a mesa.
//  · Observar um paciente jogando: cada um joga do seu jeito (impulsivo, ritualizado, hipervigilante…)
//    e a partida vira observação comportamental — ganha no eixo Observação da Roda.
//
// Estado: state.xadrez = { partidas, vitorias, torneio: { semana, melhor }, trofeus: {}, obs: {} }
// Textos em pt/en/es (os demais idiomas caem no inglês), como nos outros módulos novos.
// ===========================================================================
const Xadrez = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const st = () => {
    const x = (state.xadrez = state.xadrez || {});
    x.torneio = x.torneio || { semana: 0, melhor: 0 };
    x.trofeus = x.trofeus || {};
    x.obs = x.obs || {};
    x.partidas = x.partidas || 0;
    x.vitorias = x.vitorias || 0;
    x.aulaDia = x.aulaDia || "";
    return x;
  };
  const dayKey = () => `${state.week || 1}:${state.dayIndex}`;

  // ------------------------------------------------------------------ motor de regras
  // Casa 0 = a8, casa 63 = h1. Maiúscula = brancas (a jogadora), minúscula = pretas.
  const INICIO = "rnbqkbnr" + "pppppppp" + "........".repeat(4) + "PPPPPPPP" + "RNBQKBNR";
  const branca = (p) => p !== "." && p === p.toUpperCase();
  const lado = (p) => (p === "." ? null : branca(p) ? "w" : "b");
  const dentro = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const ix = (r, c) => r * 8 + c;
  const posInicial = () => ({ casas: INICIO.split(""), vez: "w", roque: { K: true, Q: true, k: true, q: true }, ep: -1, meio: 0 });
  const clonar = (g) => ({ casas: g.casas.slice(), vez: g.vez, roque: Object.assign({}, g.roque), ep: g.ep, meio: g.meio });

  const SALTOS = { n: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], k: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] };
  const RAIOS = { b: [[-1, -1], [-1, 1], [1, -1], [1, 1]], r: [[-1, 0], [1, 0], [0, -1], [0, 1]], q: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]] };

  // a casa está sob ataque de quem? (usado para xeque e para proibir roque passando por ataque)
  function atacada(casas, alvo, por) {
    const ra = Math.floor(alvo / 8), ca = alvo % 8;
    const meu = (p) => p !== "." && lado(p) === por;
    // peão
    const dir = por === "w" ? 1 : -1;               // peão branco ataca "para cima" (r menor), então vem de r+1
    for (const dc of [-1, 1]) { const r = ra + dir, c = ca + dc; if (dentro(r, c)) { const p = casas[ix(r, c)]; if (meu(p) && p.toLowerCase() === "p") return true; } }
    // cavalo e rei
    for (const [dr, dc] of SALTOS.n) { const r = ra + dr, c = ca + dc; if (dentro(r, c)) { const p = casas[ix(r, c)]; if (meu(p) && p.toLowerCase() === "n") return true; } }
    for (const [dr, dc] of SALTOS.k) { const r = ra + dr, c = ca + dc; if (dentro(r, c)) { const p = casas[ix(r, c)]; if (meu(p) && p.toLowerCase() === "k") return true; } }
    // linhas e diagonais
    for (const [tipo, dirs] of [["b", RAIOS.b], ["r", RAIOS.r]]) {
      for (const [dr, dc] of dirs) {
        let r = ra + dr, c = ca + dc;
        while (dentro(r, c)) {
          const p = casas[ix(r, c)];
          if (p !== ".") { if (meu(p)) { const t = p.toLowerCase(); if (t === tipo || t === "q") return true; } break; }
          r += dr; c += dc;
        }
      }
    }
    return false;
  }

  const acharRei = (casas, cor) => casas.indexOf(cor === "w" ? "K" : "k");
  const emXeque = (g, cor) => { const k = acharRei(g.casas, cor); return k >= 0 && atacada(g.casas, k, cor === "w" ? "b" : "w"); };

  // lances pseudo-legais (podem deixar o próprio rei em xeque; filtrados depois)
  function pseudo(g) {
    const out = [], cor = g.vez, casas = g.casas;
    const inimigo = (p) => p !== "." && lado(p) !== cor;
    const vazio = (i) => casas[i] === ".";
    for (let i = 0; i < 64; i++) {
      const p = casas[i];
      if (p === "." || lado(p) !== cor) continue;
      const r = Math.floor(i / 8), c = i % 8, t = p.toLowerCase();
      if (t === "p") {
        const dir = cor === "w" ? -1 : 1, inicial = cor === "w" ? 6 : 1, ultima = cor === "w" ? 0 : 7;
        const r1 = r + dir;
        if (dentro(r1, c) && vazio(ix(r1, c))) {
          if (r1 === ultima) for (const q of ["q", "r", "b", "n"]) out.push({ de: i, para: ix(r1, c), promo: q });
          else {
            out.push({ de: i, para: ix(r1, c) });
            const r2 = r + dir * 2;
            if (r === inicial && vazio(ix(r2, c))) out.push({ de: i, para: ix(r2, c), duplo: true });
          }
        }
        for (const dc of [-1, 1]) {
          const rc = r + dir, cc = c + dc;
          if (!dentro(rc, cc)) continue;
          const j = ix(rc, cc);
          if (inimigo(casas[j])) {
            if (rc === ultima) for (const q of ["q", "r", "b", "n"]) out.push({ de: i, para: j, promo: q });
            else out.push({ de: i, para: j });
          } else if (j === g.ep) out.push({ de: i, para: j, ep: true });
        }
      } else if (t === "n" || t === "k") {
        for (const [dr, dc] of SALTOS[t]) {
          const rr = r + dr, cc = c + dc;
          if (!dentro(rr, cc)) continue;
          const j = ix(rr, cc);
          if (casas[j] === "." || inimigo(casas[j])) out.push({ de: i, para: j });
        }
      } else {
        for (const [dr, dc] of RAIOS[t]) {
          let rr = r + dr, cc = c + dc;
          while (dentro(rr, cc)) {
            const j = ix(rr, cc);
            if (casas[j] === ".") out.push({ de: i, para: j });
            else { if (inimigo(casas[j])) out.push({ de: i, para: j }); break; }
            rr += dr; cc += dc;
          }
        }
      }
    }
    // roque: rei e torre parados, caminho livre e o rei não sai, passa nem chega em casa atacada
    const linha = cor === "w" ? 7 : 0, oponente = cor === "w" ? "b" : "w";
    const podeK = cor === "w" ? g.roque.K : g.roque.k, podeQ = cor === "w" ? g.roque.Q : g.roque.q;
    const reiCasa = ix(linha, 4);
    if ((podeK || podeQ) && casas[reiCasa].toLowerCase() === "k" && !atacada(casas, reiCasa, oponente)) {
      if (podeK && vazio(ix(linha, 5)) && vazio(ix(linha, 6)) && !atacada(casas, ix(linha, 5), oponente) && !atacada(casas, ix(linha, 6), oponente)) out.push({ de: reiCasa, para: ix(linha, 6), roque: "K" });
      if (podeQ && vazio(ix(linha, 3)) && vazio(ix(linha, 2)) && vazio(ix(linha, 1)) && !atacada(casas, ix(linha, 3), oponente) && !atacada(casas, ix(linha, 2), oponente)) out.push({ de: reiCasa, para: ix(linha, 2), roque: "Q" });
    }
    return out;
  }

  function aplicar(g, mv) {
    const n = clonar(g), casas = n.casas, p = casas[mv.de], cor = lado(p);
    const capturou = casas[mv.para] !== "." || mv.ep;
    casas[mv.para] = mv.promo ? (cor === "w" ? mv.promo.toUpperCase() : mv.promo) : p;
    casas[mv.de] = ".";
    if (mv.ep) casas[ix(Math.floor(mv.de / 8), mv.para % 8)] = ".";            // o peão capturado fica ao lado, não na casa de destino
    if (mv.roque) {                                                            // a torre pula junto com o rei
      const linha = Math.floor(mv.de / 8);
      if (mv.roque === "K") { casas[ix(linha, 5)] = casas[ix(linha, 7)]; casas[ix(linha, 7)] = "."; }
      else { casas[ix(linha, 3)] = casas[ix(linha, 0)]; casas[ix(linha, 0)] = "."; }
    }
    // direitos de roque: caem ao mexer o rei ou a torre, e quando a torre é capturada na casa dela
    if (p.toLowerCase() === "k") { if (cor === "w") { n.roque.K = n.roque.Q = false; } else { n.roque.k = n.roque.q = false; } }
    const perde = (casa) => { if (casa === 63) n.roque.K = false; if (casa === 56) n.roque.Q = false; if (casa === 7) n.roque.k = false; if (casa === 0) n.roque.q = false; };
    perde(mv.de); perde(mv.para);
    n.ep = mv.duplo ? (mv.de + mv.para) / 2 : -1;
    n.meio = capturou || p.toLowerCase() === "p" ? 0 : n.meio + 1;
    n.vez = cor === "w" ? "b" : "w";
    return n;
  }

  function legais(g) {
    return pseudo(g).filter((mv) => !emXeque(aplicar(g, mv), g.vez));
  }

  // fim de jogo: mate, afogamento ou 50 lances sem captura nem peão
  function desfecho(g) {
    if (legais(g).length) return g.meio >= 100 ? "empate" : null;
    return emXeque(g, g.vez) ? (g.vez === "w" ? "pretas" : "brancas") : "empate";
  }

  // ------------------------------------------------------------------ computador
  const VALOR = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  // pequeno empurrão para o centro: sem isso o computador anda nas bordas e a partida fica sem graça
  const CENTRO = [0, 1, 2, 3, 3, 2, 1, 0];
  function avaliar(g) {
    let s = 0;
    for (let i = 0; i < 64; i++) {
      const p = g.casas[i];
      if (p === ".") continue;
      const v = VALOR[p.toLowerCase()] + CENTRO[Math.floor(i / 8)] * CENTRO[i % 8];
      s += branca(p) ? v : -v;
    }
    return g.vez === "w" ? s : -s;
  }
  function negamax(g, prof, alfa, beta) {
    if (prof === 0) return avaliar(g);
    const movs = legais(g);
    if (!movs.length) return emXeque(g, g.vez) ? -99999 - prof : 0;
    // capturas primeiro: corta muito mais cedo
    movs.sort((a, b) => (g.casas[b.para] !== "." ? 1 : 0) - (g.casas[a.para] !== "." ? 1 : 0));
    let melhor = -Infinity;
    for (const mv of movs) {
      const v = -negamax(aplicar(g, mv), prof - 1, -beta, -alfa);
      if (v > melhor) melhor = v;
      if (melhor > alfa) alfa = melhor;
      if (alfa >= beta) break;
    }
    return melhor;
  }
  // escolhe o lance. "estilo" deixa o computador jogar como um paciente específico (ver PACIENTES)
  function pensar(g, prof, estilo) {
    const movs = legais(g);
    if (!movs.length) return null;
    if (estilo && estilo.escolher) { const m = estilo.escolher(g, movs); if (m) return m; }
    let melhor = null, nota = -Infinity;
    const baralho = movs.slice().sort(() => Math.random() - 0.5);      // desempate variado: partidas diferentes a cada vez
    for (const mv of baralho) {
      const v = -negamax(aplicar(g, mv), prof - 1, -Infinity, Infinity);
      if (v > nota) { nota = v; melhor = mv; }
    }
    return melhor;
  }

  window.XadrezMotor = { posInicial, legais, aplicar, desfecho, emXeque, pensar, avaliar, INICIO };

  // ------------------------------------------------------------------ como cada paciente joga
  // O jeito de jogar é a observação: o tabuleiro vira um instrumento clínico. Cada estilo distorce a
  // escolha do lance de um jeito coerente com o caso, e rende uma frase de observação ao fim da partida.
  const captura = (g, m) => g.casas[m.para] !== "." || m.ep;
  const PACIENTES = {
    lucas: { prof: 1, nota: L("Lucas jogou depressa, capturou tudo o que apareceu sem olhar o troco e empurrou o tabuleiro quando perdeu a dama.", "Lucas played fast, grabbed every piece on offer without checking the trade and shoved the board when he lost his queen.", "Lucas jugó rápido, capturó todo lo que apareció sin mirar el cambio y empujó el tablero al perder la dama."), eixo: L("Impulsividade e baixa tolerância à frustração", "Impulsivity and low frustration tolerance", "Impulsividad y baja tolerancia a la frustración"), escolher: (g, m) => m.filter((x) => captura(g, x))[0] },
    mariana: { prof: 1, nota: L("Mariana começou três planos diferentes e não terminou nenhum; perdeu peças por esquecer ameaças que ela mesma tinha visto.", "Mariana started three different plans and finished none; she lost pieces by forgetting threats she had spotted herself.", "Mariana empezó tres planes distintos y no terminó ninguno; perdió piezas por olvidar amenazas que ella misma había visto."), eixo: L("Desatenção e dificuldade de organização", "Inattention and organisational difficulty", "Desatención y dificultad de organización"), escolher: (g, m) => (Math.random() < 0.5 ? m[Math.floor(Math.random() * m.length)] : null) },
    gabriel: { prof: 1, nota: L("Gabriel precisou de ajuda para lembrar como cada peça anda, mas quando entendeu o plano seguiu até o fim sem se perder.", "Gabriel needed help remembering how each piece moves, but once he understood the plan he followed it to the end.", "Gabriel necesitó ayuda para recordar cómo anda cada pieza, pero al entender el plan lo siguió hasta el final."), eixo: L("Dificuldade de aprendizagem com raciocínio preservado", "Learning difficulty with preserved reasoning", "Dificultad de aprendizaje con razonamiento preservado"), escolher: (g, m) => (Math.random() < 0.35 ? m[Math.floor(Math.random() * m.length)] : null) },
    sofia: { prof: 2, nota: L("Sofia calculava bem, mas repetia em voz alta a sequência para não esquecer e pedia desculpas a cada lance demorado.", "Sofia calculated well, but repeated the sequence out loud so as not to forget it and apologised for every slow move.", "Sofía calculaba bien, pero repetía en voz alta la secuencia para no olvidarla y se disculpaba por cada jugada lenta."), eixo: L("Sobrecarga de memória de trabalho com ansiedade de desempenho", "Working-memory overload with performance anxiety", "Sobrecarga de memoria de trabajo con ansiedad de rendimiento") },
    beatriz: { prof: 2, nota: L("Beatriz alinhou cada peça no centro exato da casa antes de jogar e refez o mesmo lance três vezes para ter certeza.", "Beatriz lined up every piece in the exact centre of its square before moving and remade the same move three times to be sure.", "Beatriz alineó cada pieza en el centro exacto de la casilla antes de jugar y rehízo la misma jugada tres veces para asegurarse."), eixo: L("Rituais de verificação e perfeccionismo", "Checking rituals and perfectionism", "Rituales de comprobación y perfeccionismo") },
    carlos: { prof: 2, nota: L("Carlos manteve quase todas as peças atrás, recusou trocas e sobressaltou-se quando a peça bateu na mesa.", "Carlos kept nearly every piece at the back, refused trades and startled when a piece hit the table.", "Carlos mantuvo casi todas las piezas atrás, rechazó cambios y se sobresaltó cuando la pieza golpeó la mesa."), eixo: L("Hipervigilância e evitação", "Hypervigilance and avoidance", "Hipervigilancia y evitación"), escolher: (g, m) => { const recuo = m.filter((x) => (g.vez === "b" ? x.para < x.de : x.para > x.de) && !captura(g, x)); return recuo.length ? recuo[Math.floor(Math.random() * recuo.length)] : null; } },
    iris: { prof: 1, nota: L("Íris passou de 'você joga muito bem' para 'isso é ridículo' em poucos lances, e quis desistir no meio da partida.", "Iris went from 'you play so well' to 'this is ridiculous' within a few moves, and wanted to quit halfway through.", "Íris pasó de 'juegas muy bien' a 'esto es ridículo' en pocas jugadas, y quiso abandonar a mitad de la partida."), eixo: L("Instabilidade afetiva e idealização/desvalorização", "Affective instability and idealisation/devaluation", "Inestabilidad afectiva e idealización/devaluación"), escolher: (g, m) => (Math.random() < 0.6 ? m.filter((x) => captura(g, x))[0] : null) },
    maria: { prof: 2, nota: L("Maria perguntou várias vezes se estava jogando certo e se você ficaria chateada caso ela ganhasse.", "Maria asked several times whether she was playing correctly and whether you would be upset if she won.", "María preguntó varias veces si estaba jugando bien y si te molestaría que ella ganara."), eixo: L("Busca de garantia e medo de rejeição", "Reassurance seeking and fear of rejection", "Búsqueda de garantía y miedo al rechazo") },
    helena: { prof: 1, nota: L("Helena demorou a mover cada peça, disse duas vezes que não ia conseguir e perguntou se podia parar.", "Helena was slow to move each piece, said twice that she would not manage and asked whether she could stop.", "Helena tardó en mover cada pieza, dijo dos veces que no lo lograría y preguntó si podía parar."), eixo: L("Lentificação psicomotora e desesperança", "Psychomotor slowing and hopelessness", "Lentificación psicomotora y desesperanza") },
    marcos: { prof: 1, nota: L("Marcos jogou em silêncio, sem planejar à frente, e comentou que 'tanto faz quem ganha'.", "Marcos played in silence, without planning ahead, and remarked that 'it makes no difference who wins'.", "Marcos jugó en silencio, sin planear con antelación, y comentó que 'da igual quién gane'.") , eixo: L("Anedonia e falta de iniciativa", "Anhedonia and lack of initiative", "Anhedonia y falta de iniciativa") },
    enzo: { prof: 2, nota: L("Enzo recitou as regras com precisão, corrigiu um lance seu e ficou desconfortável quando você propôs mudar o tempo da partida.", "Enzo recited the rules precisely, corrected one of your moves and grew uncomfortable when you suggested changing the time control.", "Enzo recitó las reglas con precisión, corrigió una jugada tuya y se incomodó cuando propusiste cambiar el tiempo de la partida."), eixo: L("Adesão rígida a regras e desconforto com mudança", "Rigid rule adherence and discomfort with change", "Adhesión rígida a las reglas e incomodidad con el cambio") },
    jonas: { prof: 2, nota: L("Jonas perguntou se havia alguém olhando a partida e se as regras tinham sido mudadas para prejudicá-lo.", "Jonas asked whether anyone was watching the game and whether the rules had been changed to disadvantage him.", "Jonas preguntó si alguien miraba la partida y si las reglas se habían cambiado para perjudicarlo."), eixo: L("Ideação persecutória", "Persecutory ideation", "Ideación persecutoria") },
    rafael: { prof: 2, nota: L("Rafael pediu uma pausa no meio da partida, disse que o coração estava disparado e perguntou onde ficava a saída.", "Rafael asked for a break mid-game, said his heart was racing and asked where the exit was.", "Rafael pidió una pausa a mitad de la partida, dijo que el corazón se le disparaba y preguntó dónde estaba la salida."), eixo: L("Sintomas de pânico e rota de fuga", "Panic symptoms and escape route", "Síntomas de pánico y ruta de escape") },
    tiago: { prof: 1, nota: L("Tiago falou sem parar, anunciou que ganharia em cinco lances e propôs jogar mais dez partidas seguidas.", "Tiago talked non-stop, announced he would win in five moves and proposed playing ten more games in a row.", "Tiago habló sin parar, anunció que ganaría en cinco jugadas y propuso jugar diez partidas seguidas."), eixo: L("Aceleração, grandiosidade e planos excessivos", "Acceleration, grandiosity and excessive plans", "Aceleración, grandiosidad y planes excesivos"), escolher: (g, m) => (Math.random() < 0.55 ? m.filter((x) => captura(g, x))[0] : null) },
    vitoria: { prof: 2, nota: L("Vitória disse que via a própria mão mover as peças 'como se fosse de outra pessoa' e perdeu o fio duas vezes.", "Vitória said she watched her own hand move the pieces 'as if it belonged to someone else' and lost the thread twice.", "Vitoria dijo que veía su propia mano mover las piezas 'como si fuera de otra persona' y perdió el hilo dos veces."), eixo: L("Despersonalização durante a tarefa", "Depersonalisation during the task", "Despersonalización durante la tarea") },
  };

  // ------------------------------------------------------------------ tabuleiro na tela
  // o mesmo desenho SOLIDO para os dois lados: a cor (com contorno no CSS) e que diz de quem e a peca.
  // Com os glifos vazados das brancas (♔) a peca desaparecia em cima da casa clara.
  const GLIFO = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const NOME_CASA = (i) => "abcdefgh"[i % 8] + (8 - Math.floor(i / 8));

  let jogo = null;   // { g, prof, estilo, modo, sel, fim, aoFim, travado }

  function desenhar() {
    const grade = $("xad-grade");
    if (!grade || !jogo) return;
    const alvos = jogo.sel === null ? [] : legais(jogo.g).filter((m) => m.de === jogo.sel).map((m) => m.para);
    grade.querySelectorAll("button").forEach((b) => {
      const i = +b.dataset.casa, p = jogo.g.casas[i];
      b.textContent = p === "." ? "" : GLIFO[p];
      b.classList.toggle("xad-sel", i === jogo.sel);
      b.classList.toggle("xad-alvo", alvos.includes(i));
      b.classList.toggle("xad-branca", p !== "." && branca(p));
      b.disabled = jogo.travado || Boolean(jogo.fim);
      b.setAttribute("aria-label", `${NOME_CASA(i)}${p === "." ? "" : " " + GLIFO[p]}`);
    });
  }

  function aviso(txt) { const s = $("xad-status"); if (s) s.textContent = txt; }

  function jogarComputador() {
    if (!jogo || jogo.fim) return;
    jogo.travado = true; desenhar();
    // timeout para a tela pintar antes de o computador pensar (senão parece travado)
    setTimeout(() => {
      if (!jogo) return;
      const mv = pensar(jogo.g, jogo.prof, jogo.estilo);
      if (mv) { jogo.g = aplicar(jogo.g, mv); jogo.lances = (jogo.lances || 0) + 1; }
      jogo.travado = false;
      conferirFim();
      desenhar();
      if (!jogo.fim) aviso(emXeque(jogo.g, "w") ? tr("Xeque! Seu rei está ameaçado.", "Check! Your king is under threat.", "¡Jaque! Tu rey está amenazado.") : tr("Sua vez.", "Your turn.", "Tu turno."));
    }, 60);
  }

  function conferirFim() {
    if (!jogo) return;
    const d = desfecho(jogo.g);
    const limite = jogo.maxLances && (jogo.lances || 0) >= jogo.maxLances;
    if (!d && !limite) return;
    jogo.fim = d || "limite";
    if (jogo.aoFim) jogo.aoFim(jogo.fim);
  }

  function clicar(i) {
    if (!jogo || jogo.fim || jogo.travado || jogo.g.vez !== "w") return;
    const p = jogo.g.casas[i];
    if (jogo.sel !== null) {
      const mv = legais(jogo.g).find((m) => m.de === jogo.sel && m.para === i);
      if (mv) {
        jogo.g = aplicar(jogo.g, mv); jogo.sel = null; jogo.lances = (jogo.lances || 0) + 1;
        sfx("click"); conferirFim(); desenhar();
        if (!jogo.fim) { aviso(tr("Pensando…", "Thinking…", "Pensando…")); jogarComputador(); }
        return;
      }
    }
    jogo.sel = p !== "." && branca(p) ? i : null;
    desenhar();
  }

  // monta o tabuleiro e devolve o elemento
  function montarTabuleiro() {
    const cx = el("div", "xad-wrap");
    const grade = el("div", "xad-grade"); grade.id = "xad-grade";
    for (let i = 0; i < 64; i++) {
      const b = el("button", `xad-casa ${(Math.floor(i / 8) + i) % 2 === 0 ? "clara" : "escura"}`);
      b.type = "button"; b.dataset.casa = i;
      b.addEventListener("click", () => clicar(i));
      grade.appendChild(b);
    }
    cx.appendChild(grade);
    const s = el("p", "xad-status"); s.id = "xad-status";
    cx.appendChild(s);
    return cx;
  }

  function comecarPartida({ prof, estilo, maxLances, aoFim }) {
    jogo = { g: posInicial(), prof, estilo: estilo || null, sel: null, fim: null, lances: 0, maxLances: maxLances || 0, aoFim, travado: false };
    desenhar();
    aviso(tr("Você joga com as brancas. Clique numa peça e depois na casa.", "You play White. Click a piece, then the square.", "Juegas con blancas. Haz clic en una pieza y luego en la casilla."));
  }

  // ------------------------------------------------------------------ menu e modos
  const shell = (titulo, texto) => {
    const body = $("hosp-body"); body.textContent = "";
    $("hosp-title").textContent = titulo;
    const status = el("p", "uni-q", texto);
    body.appendChild(status);
    return { body, status };
  };
  const voltar = (aonde) => { const b = el("button", "link-btn", tr("Voltar", "Back", "Volver")); b.type = "button"; b.addEventListener("click", aonde); return b; };

  const NIVEIS = [
    { id: "facil", prof: 1, nome: L("Tranquilo", "Easy", "Tranquilo"), xp: 12, moedas: 10 },
    { id: "medio", prof: 2, nome: L("Sério", "Serious", "Serio"), xp: 25, moedas: 25 },
    { id: "dificil", prof: 3, nome: L("Mestre Iuri", "Master Iuri", "Maestro Iuri"), xp: 45, moedas: 50 },
  ];
  const CUSTO_PARTIDA = 12, CUSTO_OBS = 15, CUSTO_TORNEIO = 25, INSCRICAO = 50;
  const TROFEUS = {
    ouro: { emoji: "🏆", nome: L("Troféu de Ouro do Clube", "Club Gold Trophy", "Trofeo de Oro del Club") },
    prata: { emoji: "🥈", nome: L("Troféu de Prata", "Silver Trophy", "Trofeo de Plata") },
    bronze: { emoji: "🥉", nome: L("Medalha de Bronze", "Bronze Medal", "Medalla de Bronce") },
  };

  function menu() {
    jogo = null;
    const x = st();
    const { body } = shell(`♟️ ${tr("Clube de Xadrez & Mente Ampla", "Chess Club & Wide Mind", "Club de Ajedrez y Mente Amplia")}`,
      tr("Xadrez treina planejamento, memória de trabalho e controle inibitório — as três funções executivas que você estuda na clínica.",
         "Chess trains planning, working memory and inhibitory control — the three executive functions you study in the clinic.",
         "El ajedrez entrena planificación, memoria de trabajo y control inhibitorio — las tres funciones ejecutivas que estudias en la clínica."));
    const linha = el("p", "xad-placar", `⚔️ ${tr("Partidas", "Games", "Partidas")}: ${x.partidas} · 🌟 ${tr("Vitórias", "Wins", "Victorias")}: ${x.vitorias}${Object.keys(x.trofeus).length ? ` · ${Object.keys(x.trofeus).map((k) => TROFEUS[k].emoji).join(" ")}` : ""}`);
    body.appendChild(linha);
    const opc = [
      { e: "♞", t: L("Partida casual", "Casual game", "Partida casual"), d: L(`Contra o computador, em três níveis. ${CUSTO_PARTIDA}⚡`, `Against the computer, three levels. ${CUSTO_PARTIDA}⚡`, `Contra la computadora, tres niveles. ${CUSTO_PARTIDA}⚡`), fn: escolherNivel },
      { e: "👁️", t: L("Observar um paciente", "Observe a patient", "Observar a un paciente"), d: L(`Jogue com quem você atende e veja como a mente dele funciona fora da sala. ${CUSTO_OBS}⚡`, `Play with someone you treat and see how their mind works outside the room. ${CUSTO_OBS}⚡`, `Juega con quien atiendes y observa cómo funciona su mente fuera de la sala. ${CUSTO_OBS}⚡`), fn: escolherPaciente },
      { e: "🏆", t: L("Torneio da sexta", "Friday tournament", "Torneo del viernes"), d: L(`Três rodadas, uma vez por semana. 🪙${INSCRICAO} · ${CUSTO_TORNEIO}⚡`, `Three rounds, once a week. 🪙${INSCRICAO} · ${CUSTO_TORNEIO}⚡`, `Tres rondas, una vez por semana. 🪙${INSCRICAO} · ${CUSTO_TORNEIO}⚡`), fn: telaTorneio },
    ];
    opc.forEach((o) => {
      const b = el("button", "choice-btn", `${o.e} ${pick(o.t)} — ${pick(o.d)}`);
      b.type = "button"; b.addEventListener("click", o.fn);
      body.appendChild(b);
    });
  }

  function gastar(energia, moedas, status) {
    if (state.energy < energia) { status.textContent = tr("Você está cansada demais para jogar agora.", "You're too tired to play right now.", "Estás demasiado cansada para jugar ahora."); sfx("bad"); return false; }
    if (moedas && state.coins < moedas) { status.textContent = tr("Moedas insuficientes.", "Not enough coins.", "Monedas insuficientes."); sfx("bad"); return false; }
    state.energy = clamp(state.energy - energia, 0, 100);
    if (moedas) state.coins -= moedas;
    saveState(); updateHud();
    return true;
  }

  function escolherNivel() {
    const { body, status } = shell(`♞ ${tr("Partida casual", "Casual game", "Partida casual")}`, tr("Escolha a força do adversário. Você joga com as brancas.", "Choose the opponent's strength. You play White.", "Elige la fuerza del rival. Juegas con blancas."));
    NIVEIS.forEach((n) => {
      const b = el("button", "choice-btn", `${pick(n.nome)} — 🌟+${n.xp} XP · 🪙+${n.moedas} ${tr("se vencer", "if you win", "si ganas")}`);
      b.type = "button";
      b.addEventListener("click", () => { if (gastar(CUSTO_PARTIDA, 0, status)) partida(n); });
      body.appendChild(b);
    });
    body.appendChild(voltar(menu));
  }

  function partida(nivel) {
    const { body, status } = shell(`♞ ${pick(nivel.nome)}`, "");
    status.textContent = "";
    body.appendChild(montarTabuleiro());
    const acoes = el("div", "xad-acoes");
    const desistir = el("button", "link-btn", tr("Desistir", "Resign", "Abandonar")); desistir.type = "button";
    desistir.addEventListener("click", () => { if (jogo) jogo.fim = "pretas"; fimPartida("pretas", nivel); });
    acoes.appendChild(desistir); acoes.appendChild(voltar(menu));
    body.appendChild(acoes);
    comecarPartida({ prof: nivel.prof, aoFim: (r) => fimPartida(r, nivel) });
  }

  function fimPartida(res, nivel) {
    const x = st();
    x.partidas += 1;
    let msg;
    if (res === "brancas") {
      x.vitorias += 1;
      state.xp += nivel.xp; state.coins += nivel.moedas;
      if (typeof Wheel !== "undefined") Wheel.gain("raciocinio", 1);
      msg = tr(`Xeque-mate! Vitória sua. +${nivel.xp} XP e ${nivel.moedas} moedas.`, `Checkmate! You win. +${nivel.xp} XP and ${nivel.moedas} coins.`, `¡Jaque mate! Ganas. +${nivel.xp} XP y ${nivel.moedas} monedas.`);
      sfx("levelup");
    } else if (res === "empate" || res === "limite") {
      state.xp += Math.round(nivel.xp / 3);
      msg = tr(`Empate. Ainda assim você treinou: +${Math.round(nivel.xp / 3)} XP.`, `Draw. You still trained: +${Math.round(nivel.xp / 3)} XP.`, `Tablas. Aun así entrenaste: +${Math.round(nivel.xp / 3)} XP.`);
      sfx("good");
    } else {
      state.xp += Math.round(nivel.xp / 4);
      msg = tr(`Derrota — e derrota também ensina: +${Math.round(nivel.xp / 4)} XP por analisar os erros.`, `Loss — and losses teach too: +${Math.round(nivel.xp / 4)} XP for reviewing the mistakes.`, `Derrota — y la derrota también enseña: +${Math.round(nivel.xp / 4)} XP por analizar los errores.`);
      sfx("bad");
    }
    saveState(); updateHud();
    aviso(msg);
  }

  // --------- observar um paciente
  const pacientesDisponiveis = () => Object.keys(PACIENTES).filter((id) => typeof CASES !== "undefined" && CASES[id]);

  function escolherPaciente() {
    const { body, status } = shell(`👁️ ${tr("Observar um paciente", "Observe a patient", "Observar a un paciente")}`,
      tr("Fora da sala, jogando, aparece o que a entrevista não mostra. A partida dura poucos lances e vira observação na ficha.",
         "Outside the room, while playing, what the interview misses shows up. The game lasts a few moves and becomes an observation in the chart.",
         "Fuera de la sala, jugando, aparece lo que la entrevista no muestra. La partida dura pocas jugadas y se vuelve observación en la ficha."));
    const lista = pacientesDisponiveis();
    if (!lista.length) { body.appendChild(el("p", "uni-q", tr("Você ainda não atende ninguém.", "You have no patients yet.", "Aún no atiendes a nadie."))); body.appendChild(voltar(menu)); return; }
    lista.forEach((id) => {
      const x = st(), feito = Boolean(x.obs[id]);
      const nome = pick(CASES[id].name);
      const b = el("button", "choice-btn", `${feito ? "✅" : "♟️"} ${nome}${feito ? ` — ${tr("já observado", "already observed", "ya observado")}` : ""}`);
      b.type = "button";
      b.addEventListener("click", () => { if (gastar(CUSTO_OBS, 0, status)) observar(id); });
      body.appendChild(b);
    });
    body.appendChild(voltar(menu));
  }

  function observar(id) {
    const est = PACIENTES[id], nome = pick(CASES[id].name);
    const { body } = shell(`♟️ ${nome}`, tr("Jogue algumas jogadas e repare em COMO ele joga, não em quem ganha.", "Play a few moves and watch HOW they play, not who wins.", "Juega algunas jugadas y fíjate en CÓMO juega, no en quién gana."));
    body.appendChild(montarTabuleiro());
    const acoes = el("div", "xad-acoes");
    const parar = el("button", "link-btn", tr("Encerrar e anotar", "End and take notes", "Terminar y anotar")); parar.type = "button";
    parar.addEventListener("click", () => fimObservacao(id));
    acoes.appendChild(parar); acoes.appendChild(voltar(menu));
    body.appendChild(acoes);
    comecarPartida({ prof: est.prof, estilo: est, maxLances: 16, aoFim: () => fimObservacao(id) });
  }

  function fimObservacao(id) {
    const x = st(), est = PACIENTES[id], nome = pick(CASES[id].name);
    const novo = !x.obs[id];
    x.obs[id] = { nota: pick(est.nota), eixo: pick(est.eixo), semana: state.week || 1 };
    if (novo) {
      state.xp += 30;
      if (typeof Wheel !== "undefined") Wheel.gain("observacao", 2);
      sfx("levelup");
    }
    saveState(); updateHud();
    const { body } = shell(`📝 ${tr("Observação", "Observation", "Observación")} — ${nome}`, pick(est.nota));
    const caixa = el("div", "xad-obs");
    caixa.appendChild(el("strong", null, `👁️ ${pick(est.eixo)}`));
    caixa.appendChild(el("p", null, novo
      ? tr("Anotado na ficha. +30 XP e +2 no eixo Observação Comportamental da Roda.", "Noted in the chart. +30 XP and +2 on the Behavioral Observation axis of the Wheel.", "Anotado en la ficha. +30 XP y +2 en el eje Observación Conductual de la Rueda.")
      : tr("Você já tinha essa observação na ficha.", "You already had this observation in the chart.", "Ya tenías esta observación en la ficha.")));
    body.appendChild(caixa);
    body.appendChild(voltar(menu));
  }

  // --------- torneio
  const RODADAS = [
    { nome: L("Quartas de final", "Quarter-final", "Cuartos de final"), adv: L("Gabi, do clube juvenil", "Gabi, from the youth club", "Gabi, del club juvenil"), prof: 1 },
    { nome: L("Semifinal", "Semi-final", "Semifinal"), adv: L("Professor Duarte", "Professor Duarte", "Profesor Duarte"), prof: 2 },
    { nome: L("Final", "Final", "Final"), adv: L("Mestre Iuri", "Master Iuri", "Maestro Iuri"), prof: 3 },
  ];
  const semanaAtual = () => state.week || 1;
  const ehSexta = () => state.dayIndex === 4;

  function telaTorneio() {
    const x = st();
    const { body, status } = shell(`🏆 ${tr("Torneio da sexta", "Friday tournament", "Torneo del viernes")}`,
      tr("Três rodadas eliminatórias, cada uma mais forte que a anterior. Quem chega longe leva troféu para a mesa do consultório.",
         "Three knockout rounds, each stronger than the last. Go far enough and you take a trophy home for the office desk.",
         "Tres rondas eliminatorias, cada una más fuerte. Quien llega lejos se lleva un trofeo para la mesa del consultorio."));
    const premios = el("p", "xad-placar", `🥇 🪙250 +100 XP · 🥈 🪙100 +50 XP · 🥉 🪙40 +25 XP`);
    body.appendChild(premios);
    if (!ehSexta()) {
      body.appendChild(el("p", "uni-q", tr("O torneio acontece na sexta-feira. Volte no fim da semana.", "The tournament runs on Friday. Come back at the end of the week.", "El torneo es el viernes. Vuelve al final de la semana.")));
      body.appendChild(voltar(menu)); return;
    }
    if (x.torneio.semana === semanaAtual()) {
      body.appendChild(el("p", "uni-q", tr("Você já disputou o torneio desta semana.", "You already played this week's tournament.", "Ya disputaste el torneo de esta semana.")));
      body.appendChild(voltar(menu)); return;
    }
    const b = el("button", "choice-btn", `🏆 ${tr("Inscrever-se", "Enter", "Inscribirse")} — 🪙${INSCRICAO} · ${CUSTO_TORNEIO}⚡`);
    b.type = "button";
    b.addEventListener("click", () => { if (gastar(CUSTO_TORNEIO, INSCRICAO, status)) { st().torneio.semana = semanaAtual(); saveState(); rodada(0); } });
    body.appendChild(b);
    body.appendChild(voltar(menu));
  }

  function rodada(n) {
    const r = RODADAS[n];
    const { body } = shell(`🏆 ${pick(r.nome)}`, `${tr("Adversário", "Opponent", "Rival")}: ${pick(r.adv)}`);
    body.appendChild(montarTabuleiro());
    const acoes = el("div", "xad-acoes");
    const desistir = el("button", "link-btn", tr("Abandonar o torneio", "Withdraw", "Abandonar el torneo")); desistir.type = "button";
    desistir.addEventListener("click", () => fimTorneio(n));
    acoes.appendChild(desistir);
    body.appendChild(acoes);
    comecarPartida({ prof: r.prof, aoFim: (res) => { if (res === "brancas") { if (n + 1 < RODADAS.length) proximaRodada(n + 1); else fimTorneio(3); } else fimTorneio(n); } });
  }

  function proximaRodada(n) {
    aviso(tr("Você passou! Preparando a próxima rodada…", "You advanced! Setting up the next round…", "¡Avanzaste! Preparando la siguiente ronda…"));
    sfx("good");
    setTimeout(() => rodada(n), 1200);
  }

  function fimTorneio(vitorias) {
    const x = st();
    const premio = vitorias >= 3 ? { pos: 1, tit: L("🥇 Campeã do torneio!", "🥇 Tournament champion!", "🥇 ¡Campeona del torneo!"), moedas: 250, xp: 100, trofeu: "ouro", rep: 3 }
      : vitorias === 2 ? { pos: 2, tit: L("🥈 Vice-campeã", "🥈 Runner-up", "🥈 Subcampeona"), moedas: 100, xp: 50, trofeu: "prata", rep: 1 }
      : vitorias === 1 ? { pos: 3, tit: L("🥉 Terceiro lugar", "🥉 Third place", "🥉 Tercer lugar"), moedas: 40, xp: 25, trofeu: "bronze", rep: 0 }
      : { pos: 4, tit: L("Eliminada nas quartas", "Knocked out in the quarter-finals", "Eliminada en cuartos"), moedas: 0, xp: 10, trofeu: null, rep: 0 };
    state.coins += premio.moedas; state.xp += premio.xp;
    if (premio.trofeu) x.trofeus[premio.trofeu] = true;
    if (premio.rep && typeof Wheel !== "undefined" && Wheel.rep) Wheel.rep().clinica += premio.rep;
    x.torneio.melhor = Math.max(x.torneio.melhor || 0, 5 - premio.pos);
    saveState(); updateHud();
    sfx(premio.pos === 1 ? "levelup" : premio.pos <= 3 ? "good" : "bad");
    const { body } = shell(`🏆 ${tr("Resultado", "Result", "Resultado")}`, pick(premio.tit));
    const cx = el("div", "xad-obs");
    cx.appendChild(el("p", null, `🪙 +${premio.moedas} · 🌟 +${premio.xp} XP${premio.rep ? ` · 🏥 +${premio.rep} ${tr("Reputação da Clínica", "Clinic Reputation", "Reputación de la Clínica")}` : ""}`));
    if (premio.trofeu) cx.appendChild(el("p", null, `${TROFEUS[premio.trofeu].emoji} ${pick(TROFEUS[premio.trofeu].nome)} — ${tr("foi para a mesa do consultório.", "went onto the office desk.", "fue a la mesa del consultorio.")}`));
    body.appendChild(cx);
    body.appendChild(voltar(menu));
  }

  function open(qual) {
    openModal("hosp-modal");
    if (qual === "partida") escolherNivel();
    else if (qual === "paciente") escolherPaciente();
    else if (qual === "torneio") telaTorneio();
    else menu();
  }
  const action = (a) => open(a);
  function init() { document.querySelectorAll('[data-close="hosp-modal"]').forEach((b) => b.addEventListener("click", () => { jogo = null; })); }

  return {
    _motor: window.XadrezMotor,
    open, action, init, menu,
    trofeus: () => Object.keys(st().trofeus),
    observacoes: () => st().obs,
    PACIENTES,
    montarTabuleiro, comecarPartida, desenhar,
    st,
    // ganchos dos testes
    _jogo: () => jogo,
    _forcar: (g) => { if (jogo) { jogo.g = g; desenhar(); } },
  };
})();
window.Xadrez = Xadrez;

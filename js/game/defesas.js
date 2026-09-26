"use strict";

// ===========================================================================
// AS DEFESAS TÊM CARA (7.2).
//
// Até aqui a defensividade era UM número, derivado do vínculo: `(100 − affinity) × Wheel.defense()`.
// Com ele, todo paciente se fechava do mesmo jeito — a pergunta batia numa parede sem nome e o jogo
// dizia "ganhe confiança e tente de novo". Na clínica não é assim: cada pessoa se protege com a forma
// que aprendeu, e reconhecer a forma É o trabalho.
//
// Aqui cada quadro ganha a sua morfologia. Quando a pergunta chega antes do vínculo, a pessoa não
// "desvia": ela CINDE (a doutora vira igual aos outros), NEGA, RACIONALIZA, PROJETA, EVITA, MINIMIZA,
// RETRAI-SE ou DESCONFIA — com fala e corpo próprios. E o jogador pode NOMEAR o que viu: acertar não
// abre a porta à força, abre um pouco (a pessoa se sente lida) e vira observação na ficha.
//
// Duas escolhas deliberadas:
//  · errar não custa nada. Punir a leitura transforma observação clínica em tentativa e erro.
//  · autismo e quadro psicótico não entram como "defesa do ego": entram como RETRAIMENTO e DESCONFIANÇA,
//    que é o que se vê de fato. Nomear alguém de "defensivo" quando a pessoa está sobrecarregada ou com
//    medo é erro clínico, e o jogo não vai ensinar isso.
//
// Dado: sem arquivo novo. A morfologia sai do diagnóstico do caso (e, na falta, do grupo), o que faz os
// casos gerados (`gerador.js`) já nascerem cobertos.
// ===========================================================================
const Defesa = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const ALIVIO = 10;          // o quanto a porta cede quando a pessoa se sente lida
  const hash = (s) => String(s).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

  const MECANISMOS = {
    cisao: {
      nome: L("Cisão / desvalorização", "Splitting / devaluation", "Escisión / devaluación"),
      curto: L("cisão", "splitting", "escisión"),
      sobre: L("De um momento para o outro você passa de quem entende para quem é igual a todo mundo. Não é sobre você: é como a pessoa organiza o mundo quando se sente ameaçada — tudo ou nada, salvador ou traidor.", "From one moment to the next you go from the one who understands to just like everyone else. It is not about you: it is how the person organises the world when threatened — all or nothing, saviour or traitor.", "De un momento a otro pasas de ser quien entiende a ser igual que todos. No es sobre ti: es cómo la persona organiza el mundo cuando se siente amenazada — todo o nada, salvador o traidor."),
      falas: [
        L("'Sabe de uma coisa? Deixa. A senhora também vai achar que eu tô exagerando, igual todo mundo.' (cruza os braços)", "'You know what? Forget it. You are going to think I am exaggerating too, like everyone else.' (crosses her arms)", "'¿Sabes qué? Déjalo. Usted también va a pensar que exagero, igual que todos.' (cruza los brazos)"),
        L("'Até agora eu achava que a senhora era diferente.' (olha para o lado) 'Enfim.'", "'Until now I thought you were different.' (looks away) 'Anyway.'", "'Hasta ahora pensaba que usted era diferente.' (mira a un lado) 'En fin.'")
      ]
    },
    negacao: {
      nome: L("Negação", "Denial", "Negación"),
      curto: L("negação", "denial", "negación"),
      sobre: L("O fato é dito e não cabe: a pessoa recusa o tamanho do que está acontecendo. Não é mentira — é a única forma que ela tem de continuar de pé hoje.", "The fact is said and does not fit: the person refuses the size of what is happening. It is not lying — it is the only way they have of staying upright today.", "El hecho se dice y no cabe: la persona rechaza el tamaño de lo que ocurre. No es mentira — es la única forma que tiene de seguir en pie hoy."),
      falas: [
        L("'Isso aí é exagero da minha mulher. Eu paro quando eu quiser, doutora. É só eu decidir.' (ri sem graça)", "'That is my wife exaggerating. I stop whenever I want, doctor. I just have to decide.' (laughs awkwardly)", "'Eso es exageración de mi mujer. Yo paro cuando quiero, doctora. Solo tengo que decidirlo.' (ríe incómodo)"),
        L("'Todo mundo que eu conheço faz igual. Se isso é problema, então o mundo inteiro tem problema.'", "'Everyone I know does the same. If that is a problem, then the whole world has a problem.'", "'Todos los que conozco hacen lo mismo. Si eso es un problema, entonces el mundo entero tiene un problema.'")
      ]
    },
    racionalizacao: {
      nome: L("Racionalização / intelectualização", "Rationalisation / intellectualisation", "Racionalización / intelectualización"),
      curto: L("racionalização", "rationalisation", "racionalización"),
      sobre: L("A pessoa explica com precisão o que sente — e a precisão é justamente o que mantém o sentimento longe. Quem fala de si em terceira pessoa não está mentindo: está se protegendo com a própria inteligência.", "The person explains precisely what they feel — and the precision is exactly what keeps the feeling at a distance. Speaking of oneself in the third person is not lying: it is protecting oneself with one's own intelligence.", "La persona explica con precisión lo que siente — y la precisión es justo lo que mantiene el sentimiento lejos. Hablar de sí en tercera persona no es mentir: es protegerse con la propia inteligencia."),
      falas: [
        L("'Eu já li sobre isso. É um mecanismo de resposta ao estresse, uma coisa fisiológica.' (fala rápido, sem pausa) 'Então não é bem um sentimento, entende?'", "'I have read about this. It is a stress response mechanism, a physiological thing.' (speaks fast, without pausing) 'So it is not really a feeling, you see?'", "'Ya leí sobre esto. Es un mecanismo de respuesta al estrés, algo fisiológico.' (habla rápido, sin pausa) '¿Entonces no es del todo un sentimiento, entiende?'"),
        L("'Vamos por partes: primeiro, isso tem uma explicação lógica. Segundo, eu já organizei tudo numa lista.' (não responde à pergunta)", "'Let us go in order: first, there is a logical explanation for this. Second, I have already organised it all in a list.' (does not answer the question)", "'Vamos por partes: primero, esto tiene una explicación lógica. Segundo, ya lo organicé todo en una lista.' (no responde a la pregunta)")
      ]
    },
    projecao: {
      nome: L("Projeção", "Projection", "Proyección"),
      curto: L("projeção", "projection", "proyección"),
      sobre: L("O que é insuportável sentir como sendo de dentro passa a estar do lado de fora: a culpa é da professora, do colega, do irmão. Em criança isso é comum e não é malandragem — é o jeito possível de sustentar uma vergonha grande demais.", "What is unbearable to feel as coming from inside moves to the outside: it is the teacher's fault, the classmate's, the brother's. In a child this is common and is not cunning — it is the possible way to carry a shame too big to hold.", "Lo insoportable de sentir como propio pasa a estar afuera: la culpa es de la maestra, del compañero, del hermano. En un niño es común y no es picardía — es la forma posible de sostener una vergüenza demasiado grande."),
      falas: [
        L("'A professora implica comigo. Ela só olha pra mim quando eu faço coisa errada.' (mexe o pé embaixo da cadeira)", "'The teacher has it in for me. She only looks at me when I do something wrong.' (swings a foot under the chair)", "'La maestra me tiene manía. Solo me mira cuando hago algo mal.' (mueve el pie debajo de la silla)"),
        L("'Não fui eu que comecei. Eles que ficam me chamando.' (fala mais alto) 'Ninguém acredita em mim.'", "'I did not start it. They keep calling me names.' (speaks louder) 'Nobody believes me.'", "'Yo no empecé. Ellos me andan llamando.' (habla más alto) 'Nadie me cree.'")
      ]
    },
    evitacao: {
      nome: L("Evitação", "Avoidance", "Evitación"),
      curto: L("evitação", "avoidance", "evitación"),
      sobre: L("O assunto é contornado antes de chegar perto. Cada desvio alivia agora e aperta o mundo depois — é assim que o medo cresce sem ninguém ver.", "The subject is skirted before it comes close. Each detour relieves now and tightens the world later — that is how fear grows unseen.", "El tema se rodea antes de acercarse. Cada desvío alivia ahora y aprieta el mundo después — así crece el miedo sin que nadie lo vea."),
      falas: [
        L("'Isso já passou, doutora. Prefiro não voltar nesse assunto hoje.' (endireita a postura e olha para a porta)", "'That is over, doctor. I would rather not go back to it today.' (straightens up and looks at the door)", "'Eso ya pasó, doctora. Prefiero no volver a ese tema hoy.' (endereza la postura y mira hacia la puerta)"),
        L("'Pode ser na próxima? Hoje eu não tô muito...' (a frase não termina)", "'Could it be next time? Today I am not really...' (the sentence does not end)", "'¿Puede ser la próxima? Hoy no estoy muy...' (la frase no termina)")
      ]
    },
    minimizacao: {
      nome: L("Minimização", "Minimisation", "Minimización"),
      curto: L("minimização", "minimisation", "minimización"),
      sobre: L("O tamanho da coisa encolhe na boca de quem a vive: 'é bobagem', 'não é nada'. Quem minimiza costuma ter aprendido que incomodar com o próprio sofrimento é feio.", "The size of the thing shrinks in the mouth of the one living it: 'it is nothing', 'it is silly'. Whoever minimises has usually learned that bothering others with one's own suffering is ugly.", "El tamaño de la cosa encoge en la boca de quien la vive: 'es una tontería', 'no es nada'. Quien minimiza suele haber aprendido que molestar con el propio sufrimiento es feo."),
      falas: [
        L("'Ah, é bobagem minha. Tem gente com problema de verdade.' (sorri e encolhe os ombros)", "'Oh, it is silly of me. There are people with real problems.' (smiles and shrugs)", "'Ay, es una tontería mía. Hay gente con problemas de verdad.' (sonríe y encoge los hombros)"),
        L("'Não é nada demais, sério. Acho que é só cansaço.' (fala baixo e olha para as mãos)", "'It is nothing much, really. I think it is just tiredness.' (speaks softly and looks at her hands)", "'No es nada del otro mundo, en serio. Creo que es solo cansancio.' (habla bajo y mira sus manos)")
      ]
    },
    retraimento: {
      nome: L("Retraimento", "Withdrawal", "Retraimiento"),
      curto: L("retraimento", "withdrawal", "retraimiento"),
      sobre: L("Não é uma defesa contra você: é o que sobra quando falar custa mais do que a pessoa tem. Insistir aqui gasta o pouco que ela trouxe — o caminho é baixar a exigência, não aumentar a pergunta.", "It is not a defence against you: it is what is left when speaking costs more than the person has. Pressing here spends the little they brought — the way through is to lower the demand, not raise the question.", "No es una defensa contra ti: es lo que queda cuando hablar cuesta más de lo que la persona tiene. Insistir aquí gasta lo poco que trajo — el camino es bajar la exigencia, no subir la pregunta."),
      falas: [
        L("(silêncio longo) 'Não sei.' (a resposta vem baixa, e não vem mais nada depois)", "(long silence) 'I do not know.' (the answer comes quietly, and nothing else comes after)", "(silencio largo) 'No sé.' (la respuesta llega baja, y no viene nada más)"),
        L("(desvia o olhar e fica olhando um ponto fixo; as mãos param de se mexer)", "(looks away and stares at a fixed point; the hands stop moving)", "(desvía la mirada y se queda mirando un punto fijo; las manos dejan de moverse)")
      ]
    },
    desconfianca: {
      nome: L("Desconfiança", "Guardedness", "Desconfianza"),
      curto: L("desconfiança", "guardedness", "desconfianza"),
      sobre: L("A pergunta chega como quem quer provar alguma coisa. Quem já foi tratado como louco tem bom motivo para medir cada palavra — e a pressa em convencer é o que fecha de vez.", "The question arrives as if trying to prove something. Someone who has been treated as crazy has good reason to measure every word — and hurrying to convince is what closes the door for good.", "La pregunta llega como quien quiere probar algo. Quien ya fue tratado como loco tiene buenas razones para medir cada palabra — y la prisa por convencer es lo que cierra del todo."),
      falas: [
        L("'Por que a senhora quer saber disso?' (olha para o gravador que não existe em cima da mesa)", "'Why do you want to know that?' (looks at the recorder that is not on the table)", "'¿Por qué quiere saber eso?' (mira la grabadora que no está sobre la mesa)"),
        L("'Isso vai para algum papel? Vai para a minha mãe?' (fala devagar, escolhendo cada palavra)", "'Does this go on some form? Does it go to my mother?' (speaks slowly, choosing each word)", "'¿Esto va a algún papel? ¿Va a mi madre?' (habla despacio, eligiendo cada palabra)")
      ]
    }
  };

  // a morfologia sai do diagnóstico; na falta dele, do grupo do caso
  const POR_DX = {
    borderline: "cisao", alcool: "negacao", toc: "racionalizacao", despersonalizacao: "racionalizacao",
    tdah: "projecao", tept: "evitacao", panico: "evitacao", aprendizagem: "evitacao",
    tag: "minimizacao", bipolar2: "minimizacao", tdm: "retraimento", tea: "retraimento",
    esquizofrenia: "desconfianca"
  };
  const POR_GRUPO = {
    personalidade: "cisao", depressivos: "retraimento", ansiedade: "evitacao", trauma: "evitacao",
    neuro: "projecao", psicoticos: "desconfianca", dissociativos: "racionalizacao", bipolar: "minimizacao", toc: "racionalizacao"
  };

  function idDe(caseKey) {
    const c = CASES[caseKey] || {};
    const dx = (c.diagnosis || {}).answer;
    return POR_DX[dx] || POR_GRUPO[c.group] || "evitacao";
  }
  const daPessoa = (caseKey) => Object.assign({ id: idDe(caseKey) }, MECANISMOS[idDe(caseKey)]);

  // a fala muda por caso e por área, para a mesma defesa não sair sempre com as mesmas palavras
  function fala(caseKey, dominio) {
    const m = daPessoa(caseKey);
    return pick(m.falas[hash(caseKey + (dominio || "")) % m.falas.length]);
  }

  // três opções para o jogador ler o que viu: a certa e duas plausíveis, estáveis por caso+área
  function opcoes(caseKey, dominio) {
    const certo = idDe(caseKey);
    const outros = Object.keys(MECANISMOS).filter((k) => k !== certo);
    const h = hash(caseKey + "|" + (dominio || ""));
    const a = outros[h % outros.length];
    const b = outros[(h * 7 + 3) % outros.length] === a ? outros[(h * 7 + 4) % outros.length] : outros[(h * 7 + 3) % outros.length];
    const lista = [certo, a, b];
    // embaralha de forma estável: a resposta certa não pode ficar sempre no mesmo lugar
    for (let i = lista.length - 1; i > 0; i--) { const j = (h + i * 13) % (i + 1); const t = lista[i]; lista[i] = lista[j]; lista[j] = t; }
    return lista.map((id) => ({ id, nome: MECANISMOS[id].nome, curto: MECANISMOS[id].curto }));
  }

  // nomear o que se viu: acertar não arromba a porta, abre um pouco — e fica escrito na ficha
  function nomear(caseKey, dominio, id) {
    const certo = idDe(caseKey), acertou = id === certo;
    if (session) { session.defesaLida = session.defesaLida || {}; session.defesaLida[dominio || "_"] = true; }
    if (!acertou) return { acertou: false, certo: MECANISMOS[certo], sobre: MECANISMOS[certo].sobre };
    if (session) session.defesaNomeada = { dominio, alivio: ALIVIO };
    if (typeof Wheel !== "undefined") Wheel.gain("observacao", 2);
    state.xp += 3;
    if (typeof Dx !== "undefined" && Dx.book) {
      const b = Dx.book(caseKey);
      b.defesas = b.defesas || [];
      const marca = { id: certo, dominio: dominio || null, semana: state.week || 1 };
      if (!b.defesas.some((d) => d.id === marca.id && d.dominio === marca.dominio)) b.defesas.push(marca);
    }
    if (typeof state !== "undefined") state.affinity = clamp(state.affinity + 3, 0, 100);   // ser lido aproxima
    saveState(); updateHud();
    return { acertou: true, certo: MECANISMOS[certo], sobre: MECANISMOS[certo].sobre, alivio: ALIVIO };
  }

  const jaLeu = (dominio) => Boolean(session && session.defesaLida && session.defesaLida[dominio || "_"]);
  const nome = (id) => (MECANISMOS[id] ? pick(MECANISMOS[id].nome) : id);

  return { MECANISMOS, POR_DX, POR_GRUPO, daPessoa, idDe, fala, opcoes, nomear, jaLeu, nome, ALIVIO };
})();
window.Defesa = Defesa;

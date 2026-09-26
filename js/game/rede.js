"use strict";

// ===========================================================================
// ARTICULAÇÃO: a rede vira gente (7.3).
//
// O eixo 🩺 Articulação rendia um "relatório externo" — uma pista tirada dos achados que você ainda não
// tinha descoberto — mais moedas e reputação. Era útil e era mudo: não havia com quem falar.
//
// Aqui a articulação vira o que ela é na clínica: uma CONVERSA com quem vê a pessoa em outro lugar.
// Você vai até a escola, o CAPS, o hospital ou o fórum e fala com quem está lá. Três posturas, e cada
// uma cobra o seu preço:
//   · TRAZER A SUA LEITURA — rápido, e fecha a porta quando chega antes de você ter ouvido;
//   · PERGUNTAR O QUE ELES VEEM — é o que abre a evidência cruzada (o que a sala não mostra);
//   · COMBINAR UMA CONDUTA — só funciona depois de ouvir, e é o que muda a vida da pessoa fora daqui.
//
// O que se ganha não é atalho para o diagnóstico: é o que **só existe fora da sala** — o comportamento
// na escola, o que o plantão viu na crise, o que o serviço já tentou. E a conduta combinada alimenta a
// ADESÃO (7.2), fechando o ciclo com a psicoterapia.
//
// Uma reunião por caso por semana. Quem não tem caso aberto ali é atendido com educação e nada mais.
// ===========================================================================
const Rede = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const $ = (id) => document.getElementById(id);
  // mesma casa da supervisão: o modal de conversa clínica já existe e já é testado
  const alvo = () => ($("psico-modal") ? "psico-modal" : "invest-say");
  const corpoModal = () => $("psico-body") || $("invest-say-body");
  // recado curto (sem conversa): título + texto, no mesmo modal
  function recado(titulo, texto) {
    const b = corpoModal(); if (!b) return;
    b.textContent = "";
    b.appendChild(el("p", "uni-q", titulo));
    texto.split("\n\n").forEach((par) => b.appendChild(el("p", "shop-note", par)));
    const ok = el("button", "pill-btn primary", tr("Fechar", "Close", "Cerrar")); ok.type = "button";
    ok.addEventListener("click", () => closeModal(alvo()));
    b.appendChild(ok);
    openModal(alvo());
  }

  const SERVICOS = {
    escola: {
      emoji: "🏫", local: "escola",
      nome: L("Escola", "School", "Escuela"),
      quem: L("Professora Denise, coordenação pedagógica", "Denise, teacher and pedagogical coordinator", "Denise, maestra y coordinación pedagógica"),
      areas: ["func", "social", "inicio"],
      serve: (c) => Number(String(c.age).replace(/\D/g, "")) <= 18,
      abertura: L("'A senhora é a psicóloga do {nome}? Que bom. Eu falo com ele todo dia, e ninguém nunca me perguntou nada.'", "'Are you {nome}'s psychologist? Good. I talk to them every day, and nobody has ever asked me anything.'", "'¿Usted es la psicóloga de {nome}? Qué bueno. Hablo con él todos los días y nadie me preguntó nunca nada.'")
    },
    caps: {
      emoji: "🧩", local: "caps",
      nome: L("CAPS", "Psychosocial care centre", "CAPS"),
      quem: L("Dr. Aílton, psiquiatra do serviço", "Dr. Aílton, the service's psychiatrist", "Dr. Aílton, psiquiatra del servicio"),
      areas: ["pensamento", "risco", "subst", "humor"],
      serve: (c) => true,
      abertura: L("'Senta. Antes de você falar: o que você quer da gente? Porque parecer eu te dou, mas conduta a gente combina.'", "'Have a seat. Before you speak: what do you want from us? Because I can give you an opinion, but conduct we agree together.'", "'Siéntate. Antes de que hables: ¿qué quieres de nosotros? Porque parecer te doy, pero la conducta la acordamos.'")
    },
    hospital: {
      emoji: "🏥", local: "hospital",
      nome: L("Hospital", "Hospital", "Hospital"),
      quem: L("Enfermeira Sônia, pronto-socorro", "Sônia, emergency room nurse", "Sônia, enfermera de urgencias"),
      areas: ["corpo", "sono", "subst", "risco"],
      serve: (c) => true,
      abertura: L("'Quem chega aqui chega no pior dia. Se você quer saber como a pessoa é no pior dia, eu te conto.'", "'Whoever gets here gets here on their worst day. If you want to know what the person is like on the worst day, I can tell you.'", "'Quien llega aquí llega en su peor día. Si quieres saber cómo es la persona en el peor día, te cuento.'")
    },
    forum: {
      emoji: "⚖️", local: "forum",
      nome: L("Fórum", "Courthouse", "Juzgado"),
      quem: L("Defensora Marta, Defensoria Pública", "Marta, public defender", "Marta, defensora pública"),
      areas: ["familia", "trauma", "social"],
      serve: (c) => true,
      abertura: L("'Eu não preciso de laudo. Preciso saber o que é verdade e o que a gente pode sustentar sem expor a pessoa.'", "'I do not need a report. I need to know what is true and what we can hold without exposing the person.'", "'No necesito un informe. Necesito saber qué es verdad y qué podemos sostener sin exponer a la persona.'")
    }
  };

  // as três posturas: a ordem importa, e o jogo não avisa qual é a certa — a conversa avisa
  const POSTURAS = {
    trazer: {
      emoji: "📣",
      nome: L("Trazer a sua leitura", "Bring your reading", "Traer tu lectura"),
      fala: L("'Eu já tenho uma hipótese e vim alinhar o que vocês vão fazer com ela.'", "'I already have a hypothesis and I came to align what you are going to do with it.'", "'Ya tengo una hipótesis y vine a alinear lo que van a hacer con ella.'")
    },
    perguntar: {
      emoji: "👂",
      nome: L("Perguntar o que eles veem", "Ask what they see", "Preguntar qué ven ellos"),
      fala: L("'Antes de eu dizer o que penso: o que vocês veem, no dia a dia, que eu não vejo na sala?'", "'Before I say what I think: what do you see day to day that I do not see in the room?'", "'Antes de decir lo que pienso: ¿qué ven ustedes en el día a día que yo no veo en la sala?'")
    },
    combinar: {
      emoji: "🤝",
      nome: L("Combinar uma conduta", "Agree on a course of action", "Acordar una conducta"),
      fala: L("'Então vamos combinar: o que cada um faz, e o que a gente não faz, para não puxar a pessoa para lados opostos.'", "'So let us agree: what each of us does, and what we do not do, so we are not pulling the person in opposite directions.'", "'Entonces acordemos: qué hace cada uno, y qué no hacemos, para no tirar de la persona hacia lados opuestos.'")
    }
  };

  const est = () => (state.rede = state.rede || {});
  const semana = () => state.week || 1;
  const chaveSemana = (caso, sid) => `${caso}|${sid}|${semana()}`;
  const jaFoi = (caso, sid) => Boolean(est()[chaveSemana(caso, sid)]);

  // quem está no seu caderno agora: o caso aberto da consulta, ou o último em que você mexeu
  function casoAtual() {
    if (typeof session !== "undefined" && session && session.key) return session.key;
    if (typeof Dx !== "undefined" && Dx.cur && Dx.cur()) return Dx.cur();
    const livro = state.dxbook || {};
    const ids = Object.keys(livro).filter((k) => CASES[k]);
    return ids.length ? ids[ids.length - 1] : null;
  }

  // a evidência cruzada: um achado que você AINDA não tem, dentro das áreas que aquele serviço enxerga.
  // Não é atalho: é o que aquele serviço veria mesmo, e só sai depois de escutar.
  function cruzada(caso, sid) {
    const s = SERVICOS[sid];
    if (!s || typeof Dx === "undefined" || !Dx.data().cases[caso]) return null;
    const b = Dx.book(caso);
    const f = Dx.data().cases[caso].findings.find((x) => !b.found[x.d] && s.areas.includes(x.d));
    if (!f) return null;
    const d = Dx.data().domains.find((x) => x.id === f.d);
    return { area: d ? pick(d.name) : f.d, dominio: f.d, texto: pick(f.text) };
  }

  // entregar a evidência cruzada: entra na ficha como achado de OUTRA fonte, marcado como tal
  function entregar(caso, sid, c) {
    if (!c || typeof Dx === "undefined") return;
    const b = Dx.book(caso);
    b.found[c.dominio] = true;
    b.rede = b.rede || [];
    if (!b.rede.some((x) => x.dominio === c.dominio)) b.rede.push({ dominio: c.dominio, servico: sid, semana: semana() });
    state.xp += 4;
    if (typeof Wheel !== "undefined") Wheel.gain("multi", 2);
    saveState(); updateHud();
  }

  // a conduta combinada: é isto que vira adesão lá na frente (7.2 → psicoterapia)
  function combinar(caso, sid) {
    const t = (state.therapy || {})[caso];
    let linha = "";
    if (t && typeof Care !== "undefined") {
      const antes = t.adesao;
      t.adesao = clamp(Math.round(t.adesao + 8), 0, 100);
      linha = tr(`Adesão ao tratamento: ${antes}% → ${t.adesao}%. Quem ouve a mesma coisa nos dois lugares duvida menos.`, `Treatment adherence: ${antes}% → ${t.adesao}%. Someone who hears the same thing in both places doubts less.`, `Adhesión al tratamiento: ${antes}% → ${t.adesao}%. Quien escucha lo mismo en los dos lugares duda menos.`);
    } else {
      const rec = typeof FU !== "undefined" && FU.rec ? FU.rec(caso) : null;
      if (rec) { rec.adesao = clamp(Math.round((rec.adesao ?? 60) + 8), 0, 100); linha = tr(`Fica combinado, e chega na devolutiva: adesão ${rec.adesao}%.`, `It is agreed, and it lands in the feedback session: adherence ${rec.adesao}%.`, `Queda acordado y llega a la devolutiva: adhesión ${rec.adesao}%.`); }
    }
    if (typeof Wheel !== "undefined") { Wheel.gain("multi", 2); Wheel.rep().clinica += 1; }
    state.xp += 5;
    saveState(); updateHud();
    return linha;
  }

  // ---------------------------------------------------------------- a tela
  function abrir(sid) {
    const s = SERVICOS[sid];
    if (!s) return;
    const caso = casoAtual(), c = caso ? CASES[caso] : null;
    const corpo = el("div", "");
    const titulo = `${s.emoji} ${pick(s.nome)}`;
    if (!c) {
      return recado(titulo, `${pick(s.quem)}\n\n${tr("— Hoje não tem ninguém seu aqui. Quando tiver, apareça: a gente conversa.", "— Nobody of yours here today. When there is, come by: we can talk.", "— Hoy no hay nadie tuyo aquí. Cuando lo haya, pase: conversamos.")}`);
    }
    if (!s.serve(c)) {
      return recado(titulo, `${pick(s.quem)}\n\n${tr(`— ${pick(c.name)} não é atendido(a) por aqui. Procure o serviço certo, que a gente perde menos tempo.`, `— ${pick(c.name)} is not seen here. Look for the right service, we all lose less time.`, `— A ${pick(c.name)} no lo atendemos aquí. Busque el servicio correcto, así perdemos menos tiempo.`)}`);
    }
    if (jaFoi(caso, sid)) {
      return recado(titulo, `${pick(s.quem)}\n\n${tr("— A gente já conversou sobre esse caso esta semana. Deixa o combinado render.", "— We already talked about this case this week. Let the agreement work.", "— Ya hablamos de ese caso esta semana. Deja que lo acordado rinda.")}`);
    }

    const estado = { ouviu: false, passos: 0, ganhou: null };
    const box = el("div", "dx-result");
    box.appendChild(el("div", "dx-q", pick(s.quem)));
    box.appendChild(el("div", "dx-a", pick(s.abertura).replace("{nome}", pick(c.name))));
    corpo.appendChild(box);
    const linhas = el("div", "");
    corpo.appendChild(linhas);
    const botoes = el("div", "uni-row");
    corpo.appendChild(botoes);

    const dizer = (quem, texto, cls) => { const b2 = el("div", cls || "dx-result"); b2.appendChild(el("div", "dx-q", quem)); b2.appendChild(el("div", "dx-a", texto)); linhas.appendChild(b2); };

    function fechar() {
      est()[chaveSemana(caso, sid)] = true;
      saveState();
      botoes.textContent = "";
      const ok = el("button", "pill-btn primary", tr("Encerrar a reunião", "End the meeting", "Terminar la reunión"));
      ok.type = "button"; ok.addEventListener("click", () => closeModal(alvo()));
      botoes.appendChild(ok);
    }

    function agir(id) {
      const p = POSTURAS[id];
      estado.passos += 1;
      dizer(tr("Você", "You", "Tú"), pick(p.fala), "dx-result mine");
      if (id === "perguntar") {
        estado.ouviu = true;
        const c2 = cruzada(caso, sid);
        if (c2) {
          entregar(caso, sid, c2);
          estado.ganhou = c2;
          dizer(pick(s.quem), `${c2.area}: ${c2.texto}`);
          linhas.appendChild(el("p", "say-note", `📎 ${tr("Isso entrou na ficha como achado da rede — e você não teria visto na sala.", "That went into the chart as a finding from the network — and you would not have seen it in the room.", "Eso entró en la ficha como hallazgo de la red — y no lo habrías visto en la sala.")}`));
        } else {
          dizer(pick(s.quem), tr("— Do que a gente vê aqui, você já sabe tudo. Isso é bom sinal: significa que você perguntou.", "— Of what we see here, you already know it all. That is a good sign: it means you asked.", "— De lo que vemos aquí, ya lo sabes todo. Es buena señal: significa que preguntaste."));
        }
      } else if (id === "trazer") {
        if (estado.ouviu) {
          dizer(pick(s.quem), tr("— Agora sim. Com o que você trouxe e o que a gente vê, dá para trabalhar junto.", "— Now yes. With what you brought and what we see, we can work together.", "— Ahora sí. Con lo que trajiste y lo que vemos, se puede trabajar juntos."));
          if (typeof Wheel !== "undefined") Wheel.gain("multi", 1);
          state.xp += 2; saveState(); updateHud();
        } else {
          dizer(pick(s.quem), tr("— Você chegou com a conclusão pronta. A gente também tem olho, sabia?", "— You arrived with the conclusion ready. We have eyes too, you know.", "— Llegaste con la conclusión hecha. Nosotros también tenemos ojos, ¿sabe?"));
          linhas.appendChild(el("p", "shop-note", tr("A porta fechou um pouco. Na rede, quem fala antes de ouvir costuma ouvir menos.", "The door closed a little. In a network, whoever speaks before listening usually hears less.", "La puerta se cerró un poco. En la red, quien habla antes de escuchar suele escuchar menos.")));
          estado.fechou = true;
        }
      } else if (id === "combinar") {
        if (!estado.ouviu) {
          dizer(pick(s.quem), tr("— Combinar o quê, se você ainda não sabe o que a gente faz aqui?", "— Agree on what, if you do not yet know what we do here?", "— ¿Acordar qué, si todavía no sabes lo que hacemos aquí?"));
        } else {
          const linha = combinar(caso, sid);
          dizer(pick(s.quem), tr("— Fechado. Eu falo com a família na mesma linha que você, e se mudar, eu te aviso.", "— Done. I will speak to the family along the same line as you, and if it changes, I will let you know.", "— Hecho. Hablo con la familia en la misma línea que tú, y si cambia, te aviso."));
          if (linha) linhas.appendChild(el("p", "say-note", `🤝 ${linha}`));
          return fechar();
        }
      }
      if (estado.passos >= 3 || estado.fechou) fechar();
      else desenharBotoes();
    }

    function desenharBotoes() {
      botoes.textContent = "";
      Object.keys(POSTURAS).forEach((id) => {
        const p = POSTURAS[id];
        const bt = el("button", "pill-btn", `${p.emoji} ${pick(p.nome)}`); bt.type = "button";
        bt.addEventListener("click", () => agir(id));
        botoes.appendChild(bt);
      });
      const sair = el("button", "pill-btn small", tr("Agradecer e sair", "Thank them and leave", "Agradecer y salir"));
      sair.type = "button"; sair.addEventListener("click", () => { est()[chaveSemana(caso, sid)] = true; saveState(); closeModal(alvo()); });
      botoes.appendChild(sair);
    }
    desenharBotoes();

    const b = corpoModal();
    b.textContent = "";
    b.appendChild(el("p", "uni-q", `${titulo} · ${pick(c.name)}`));
    b.appendChild(corpo);
    openModal(alvo());
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("rede"), 500);
  }

  return { SERVICOS, POSTURAS, abrir, cruzada, casoAtual, jaFoi, combinar };
})();
window.Rede = Rede;

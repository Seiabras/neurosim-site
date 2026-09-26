"use strict";

// ===========================================================================
// Missões de fora da clínica (5.5). O menu de Missões já existia, mas só LIA o estado do jogo: não
// havia nada para aceitar, cumprir ou receber. Aqui há.
//
//  · PRINCIPAL — uma história em etapas: a psicóloga fincando pé na cidade. Cada etapa leva a um
//    lugar e a uma pessoa, e só avança quando o jogador faz a coisa de verdade. A etapa seguinte só
//    aparece quando a anterior fecha, para não despejar tudo de uma vez.
//  · SECUNDÁRIAS — soltas, todas disponíveis, dando motivo para voltar a lugares que hoje se visita
//    uma vez e nunca mais.
//
// Nada aqui inventa estado novo para conferir: as condições leem o que o jogo já guarda (lugares
// visitados, conversas, atividades feitas, supervisão). Estado próprio: state.missoes.
// ===========================================================================
const Missoes = (() => {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const dados = () => window.MISSOES_DATA || { principal: [], secundarias: [] };

  const st = () => (state.missoes = state.missoes || { feitas: {}, etapa: 0, avisadas: {} });
  const feita = (id) => Boolean(st().feitas[id]);

  // ---------------------------------------------------------------- condições
  // Cada uma lê o estado que o sistema dono da atividade realmente grava — as chaves estão comentadas
  // no topo de cada módulo (aquarium.js, xadrez.js, capsi.js, activities-esportes.js, atividades-novas.js,
  // minigames.js, supervisao.js). Inventar chave aqui faz missão que nunca fecha.
  const visitados = () => Object.keys((state.city && state.city.visited) || {});
  const conversas = () => Object.keys(state.social || {}).filter((k) => ((state.social[k] || {}).talks || 0) > 0);
  const temChave = (o) => Boolean(o) && Object.keys(o).length > 0;

  const alimentouAquario = () => Boolean(state.aquarium && state.aquarium.fed);
  const jogouXadrez = () => Boolean(state.xadrez && (state.xadrez.partidas || 0) > 0);
  const jogouPingue = () => Boolean(state.capsi && state.capsi.jogadoEm);
  const fezAula = () => temChave(state.classes && state.classes.done);
  // "algo que não é trabalho": qualquer atividade de lazer do jogo serve
  const fezLazer = () => fezAula() || alimentouAquario() || jogouXadrez() || jogouPingue()
    || temChave(state.atv && state.atv.feito) || temChave(state.mg && state.mg.day);

  function cumprida(m) {
    const c = m.cond || {};
    switch (c.tipo) {
      case "visitar": return visitados().includes(c.alvo);
      case "visitarN": return visitados().length >= (c.n || 1);
      case "falarN": return conversas().length >= (c.n || 1);
      case "atividadeQualquer": return fezLazer();
      case "supervisao": return Boolean(state.supervisao && (state.supervisao.vezes || 0) > 0);
      case "aquario": return alimentouAquario();
      case "xadrez": return jogouXadrez();
      case "pingue": return jogouPingue();
      case "aula": return fezAula();
      default: return false;
    }
  }

  // a etapa da principal que está valendo agora (undefined quando a história acabou)
  const etapaAtual = () => (dados().principal || [])[st().etapa];

  // ---------------------------------------------------------------- prêmio
  function pagar(m) {
    const p = m.premio || {};
    if (p.moedas) state.coins = (state.coins || 0) + p.moedas;
    if (p.xp) state.xp = (state.xp || 0) + p.xp;
    if (p.eixo && typeof Wheel !== "undefined") Wheel.gain(p.eixo, 2);
    const partes = [];
    if (p.moedas) partes.push(`🪙 +${p.moedas}`);
    if (p.xp) partes.push(`⭐ +${p.xp}`);
    if (p.eixo && typeof Wheel !== "undefined") { const a = Wheel.AXES.find((x) => x.id === p.eixo); if (a) partes.push(`${a.icon} +2`); }
    return partes.join(" · ");
  }

  // Confere tudo o que pode ter fechado agora. É chamado de graça em vários pontos do jogo, então
  // sai cedo quando não há nada novo.
  function conferir() {
    if (typeof state === "undefined" || !state) return;
    const s = st();
    let mudou = false;
    const e = etapaAtual();
    if (e && !feita(e.id) && cumprida(e)) {
      s.feitas[e.id] = true; s.etapa += 1; mudou = true;
      anunciar(e, true);
    }
    (dados().secundarias || []).forEach((m) => {
      if (feita(m.id) || !cumprida(m)) return;
      s.feitas[m.id] = true; mudou = true;
      anunciar(m, false);
    });
    if (mudou) { saveState(); if (typeof updateHud === "function") updateHud(); }
  }

  // O tutorial das missões é a própria missão: fecha uma, o jogo diz o que ganhou e qual é a próxima.
  // A explicação do sistema só aparece na primeira vez, e depois de a pessoa já ter feito alguma coisa.
  function anunciar(m, principal) {
    const ganho = pagar(m);
    if (typeof sfx === "function") sfx("levelup");
    if (typeof showToast === "function") showToast(`${principal ? "📖" : "✅"} ${pick(m.nome)} · ${ganho}`);
    if (typeof Tips !== "undefined" && Tips.fire) setTimeout(() => Tips.fire("missoes"), 1400);
    if (!principal) return;
    const prox = etapaAtual();
    if (prox && typeof showToast === "function") setTimeout(() => showToast(`📖 ${tr("Agora:", "Now:", "Ahora:")} ${pick(prox.nome)}`), 2600);
  }

  // ---------------------------------------------------------------- lista para a tela
  function lista() {
    const s = st();
    const principal = (dados().principal || []).map((m, i) => ({
      m, principal: true,
      estado: feita(m.id) ? "feita" : i === s.etapa ? "agora" : i < s.etapa ? "feita" : "depois",
    }));
    const secundarias = (dados().secundarias || []).map((m) => ({ m, principal: false, estado: feita(m.id) ? "feita" : "agora" }));
    return { principal, secundarias, etapa: s.etapa, total: (dados().principal || []).length };
  }

  return { conferir, lista, cumprida, etapaAtual, feita, st };
})();

window.Missoes = Missoes;

"use strict";

// ===========================================================================
// Máquina de estados da consulta.
//
// O fluxo da consulta já existia, espalhado por app-play.js, app.js e psicodx.js, e só três
// momentos tinham nome (`session.phase` = talk/dx/tx). Todo o resto estava implícito no
// stepIndex, em qual modal estava aberto e em que classe o DOM tinha. Isto aqui NÃO substitui
// esse fluxo: dá nome aos estados que ele já percorre e vigia as passagens entre eles.
//
// Para que serve, na prática:
//  · impede atalho de conduta sem escuta (fechar o caso sem ouvir o paciente);
//  · guarda o caminho percorrido na sessão — é o que o "Continuar" usa para voltar ao ponto exato;
//  · transição inválida não quebra o jogo: fica registrada e aparece nos testes.
//
// Quem manda continua sendo o jogo: cada ponto de transição que já existia avisa a máquina.
// ===========================================================================
const ClinicFSM = (function () {
  const E = {
    CHEGADA: "chegada",           // a paciente bate na porta, entra e senta
    ESCUTA: "escuta",             // passo de anamnese: fala dela + opções de abordagem
    INVESTIGACAO: "investigacao", // 🔎 perguntar sobre um domínio (só do 2º encontro e após a apresentação)
    REACAO: "reacao",             // como ela recebeu a abordagem escolhida
    HIPOTESE: "hipotese",         // levantar a hipótese diagnóstica
    DIFERENCIAL: "diferencial",   // descartar as concorrentes com evidência contrária
    CONDUTA: "conduta",           // encaminhamento, terapia, plano de segurança
    FECHAMENTO: "fechamento"      // devolutiva, prontuário e ganhos
  };

  // para onde dá para ir a partir de cada estado
  const SAIDAS = {
    chegada: ["escuta"],
    escuta: ["escuta", "investigacao", "reacao", "hipotese", "conduta"],
    investigacao: ["investigacao", "escuta", "hipotese"],
    reacao: ["escuta", "hipotese", "reacao"],
    hipotese: ["hipotese", "diferencial", "conduta", "escuta"],
    diferencial: ["diferencial", "hipotese", "conduta"],
    conduta: ["conduta", "fechamento", "hipotese"],
    fechamento: []
  };

  // condições que valem além do mapa de saídas
  const GUARDAS = {
    // ninguém fecha uma conduta sem ter escutado: é a regra clínica que o jogo já ensina,
    // mas que antes nada impedia de burlar por um caminho de código
    conduta: (s) => (s.escutas > 0 ? null : "conduta sem nenhum passo de escuta"),
    fechamento: (s) => (s.visitados.includes("conduta") ? null : "fechamento sem conduta")
  };

  let s = null;              // sessão corrente
  const ouvintes = [];

  function iniciar(chave, sess) {
    s = { chave, sess: sess || 1, estado: E.CHEGADA, visitados: [E.CHEGADA], escutas: 0, investigacoes: 0, recusas: [], em: Date.now() };
    avisar();
    return s.estado;
  }

  // tenta ir para um estado. Devolve true se andou. Nunca lança: o jogo não pode quebrar por isto.
  function ir(destino, extra) {
    if (!s) return false;
    if (!Object.values(E).includes(destino)) { recusar(destino, "estado desconhecido"); return false; }
    const permitido = SAIDAS[s.estado] || [];
    if (!permitido.includes(destino)) { recusar(destino, `${s.estado} não leva a ${destino}`); return false; }
    const guarda = GUARDAS[destino] && GUARDAS[destino](s);
    if (guarda) { recusar(destino, guarda); return false; }
    s.estado = destino;
    if (destino === E.ESCUTA) s.escutas += 1;
    if (destino === E.INVESTIGACAO) s.investigacoes += 1;
    if (s.visitados[s.visitados.length - 1] !== destino) s.visitados.push(destino);
    if (extra) s.ultimo = extra;
    avisar();
    return true;
  }

  function recusar(destino, motivo) {
    s.recusas.push({ de: s.estado, para: destino, motivo });
    if (s.recusas.length <= 3 && typeof console !== "undefined") console.warn(`[consulta] transição recusada: ${motivo}`);
  }

  const pode = (destino) => {
    if (!s) return false;
    if (!(SAIDAS[s.estado] || []).includes(destino)) return false;
    return !(GUARDAS[destino] && GUARDAS[destino](s));
  };

  function avisar() { ouvintes.forEach((fn) => { try { fn(estado()); } catch (e) { /* um ouvinte com erro não derruba a consulta */ } }); }
  const estado = () => (s ? { chave: s.chave, sess: s.sess, estado: s.estado, visitados: s.visitados.slice(), escutas: s.escutas, investigacoes: s.investigacoes, recusas: s.recusas.length } : null);
  const encerrar = () => { s = null; avisar(); };

  // Retomada exata: em vez de recomeçar e adivinhar o caminho pela fase da consulta, a máquina
  // guarda o próprio estado no save (session.fsm) e volta de onde parou.
  const guardar = () => (s ? { chave: s.chave, sess: s.sess, estado: s.estado, visitados: s.visitados.slice(), escutas: s.escutas, investigacoes: s.investigacoes, recusas: s.recusas.slice() } : null);
  function restaurar(g) {
    if (!g || !Object.values(E).includes(g.estado)) return false;
    s = { chave: g.chave, sess: g.sess || 1, estado: g.estado, visitados: (g.visitados || [g.estado]).slice(),
          escutas: g.escutas || 0, investigacoes: g.investigacoes || 0, recusas: (g.recusas || []).slice(), em: Date.now() };
    avisar();
    return true;
  }

  return {
    ESTADOS: E, SAIDAS,
    iniciar, ir, pode, estado, encerrar, guardar, restaurar,
    atual: () => (s ? s.estado : null),
    ativo: () => Boolean(s),
    recusas: () => (s ? s.recusas.slice() : []),
    aoMudar: (fn) => { ouvintes.push(fn); return () => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); }; }
  };
})();
window.ClinicFSM = ClinicFSM;

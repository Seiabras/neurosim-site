"use strict";

// Janela que se arrasta pela tela.
// O caderno de campo ganhou janela própria na 6.15, mas continuava PREGADO no meio da tela como
// qualquer outra caixa do jogo — e caderno pregado no meio da tela é estranho justamente porque ele
// não é uma tela do jogo: é um objeto que você põe ao lado do que está lendo. Aqui ele passa a se
// arrastar pelo título, com o dedo ou com o mouse, fica onde você deixou e nunca some para fora da
// borda (ao virar o aparelho, volta para dentro sozinho).
const Arrastavel = (function () {
  const GUARDA = "neurosim-janelas";
  const lidos = () => { try { return JSON.parse(localStorage.getItem(GUARDA) || "{}"); } catch (e) { return {}; } };
  const guardar = (o) => { try { localStorage.setItem(GUARDA, JSON.stringify(o)); } catch (e) { /* sem espaço: a janela só não lembra onde estava */ } };

  const registradas = {};

  function dentro(caixa, x, y) {
    const margem = 24;                                  // sempre sobra um pedaço agarrável na tela
    const maxX = window.innerWidth - margem, maxY = window.innerHeight - margem;
    return [
      Math.max(margem - caixa.width, Math.min(x, maxX)),
      Math.max(0, Math.min(y, maxY))                    // o topo nunca sobe além da borda: o título é a alça
    ];
  }

  function aplicar(el, x, y) {
    el.style.position = "absolute";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.margin = "0";
  }

  // devolve a janela ao meio da tela (quando nunca foi arrastada, ou quando a tela encolheu)
  function centrar(el) {
    el.style.position = "";
    el.style.left = "";
    el.style.top = "";
    el.style.margin = "";
  }

  function registrar(idModal, seletorAlca) {
    if (registradas[idModal]) return;
    const modal = document.getElementById(idModal);
    if (!modal) return;
    const janela = modal.querySelector(".modal-content");
    const alca = modal.querySelector(seletorAlca) || janela;
    if (!janela || !alca) return;
    registradas[idModal] = true;
    alca.classList.add("arrasta-alca");
    janela.classList.add("arrastavel");

    let arrastando = null;

    const comecar = (ev) => {
      if (ev.target.closest("button, a, input, textarea, select")) return;   // fechar continua fechando
      const r = janela.getBoundingClientRect();
      arrastando = { dx: ev.clientX - r.left, dy: ev.clientY - r.top, largura: r.width };
      aplicar(janela, r.left, r.top);
      alca.setPointerCapture && alca.setPointerCapture(ev.pointerId);
      janela.classList.add("arrastando");
      ev.preventDefault();
    };
    const mover = (ev) => {
      if (!arrastando) return;
      const [x, y] = dentro({ width: arrastando.largura }, ev.clientX - arrastando.dx, ev.clientY - arrastando.dy);
      aplicar(janela, x, y);
      ev.preventDefault();
    };
    const soltar = () => {
      if (!arrastando) return;
      arrastando = null;
      janela.classList.remove("arrastando");
      const r = janela.getBoundingClientRect();
      const g = lidos();
      g[idModal] = { x: Math.round(r.left), y: Math.round(r.top) };
      guardar(g);
    };

    alca.addEventListener("pointerdown", comecar);
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);

    // ao abrir, volta para onde ficou — se ainda couber na tela de agora
    modal.addEventListener("mostrada", () => posicionar(idModal));
    window.addEventListener("resize", () => { if (!modal.classList.contains("hidden")) posicionar(idModal); });
  }

  function posicionar(idModal) {
    const modal = document.getElementById(idModal);
    const janela = modal && modal.querySelector(".modal-content");
    if (!janela) return;
    const g = lidos()[idModal];
    if (!g) return centrar(janela);
    const r = janela.getBoundingClientRect();
    const [x, y] = dentro({ width: r.width }, g.x, g.y);
    aplicar(janela, x, y);
  }

  return { registrar, posicionar, centrar: (id) => { const m = document.getElementById(id); const j = m && m.querySelector(".modal-content"); if (j) centrar(j); const g = lidos(); delete g[id]; guardar(g); } };
})();
window.Arrastavel = Arrastavel;

"use strict";

// Tutorial guiado da primeira consulta. A tela escurece e só o elemento em destaque aparece;
// nada mais recebe clique. O jogador só pode tocar no texto (avança), em "Pular tutorial" e, nos passos
// "interativos", nas opções que estão em destaque.
// Quem é o primeiro paciente vem da agenda, não de um nome escrito aqui (mudou na 4.18, de Maria para
// Lucas): por isso os textos usam {nome} e {quem} em vez de citar alguém.
const Tutor = (function () {
  const pacienteAtual = () => {
    try { return typeof session !== "undefined" && session && CASES[session.key] ? I18N.pick(CASES[session.key].name) : ""; } catch (e) { return ""; }
  };
  const quemFalaAgora = () => {
    try {
      if (typeof session === "undefined" || !session) return "";
      const c = CASES[session.key], passo = session.steps[session.stepIndex];
      return c && c.parent && passo && passo.who === "parent" ? I18N.pick(c.parent.name) : (c ? I18N.pick(c.name) : "");
    } catch (e) { return ""; }
  };
  let queue = [];
  let item = null;
  let saida = 0, soltaNoDestaque = null;                          // vigia do passo que espera ação (veja show())
  let liberado = false;                   // a saída de emergência abriu: o "Continuar" passa a valer mesmo num passo que espera ação
  let visible = false;
  let stepNo = 0, stepTotal = 0;          // contador "2/3" no título
  let topicMode = false;                  // true quando é um tutorial de um assunto novo (pular só fecha este)

  const root = () => $("tutor");

  function placeSpot(target, interactive) {
    const spot = $("tutor-spot"), shade = $("tutor-shade"), card = $("tutor-card");
    const W = window.innerWidth, H = window.innerHeight;
    if (!target) {
      spot.style.cssText = "left:50%;top:50%;width:0;height:0";
      shade.style.clipPath = "none";
      shade.classList.add("dim");
      card.dataset.pos = "bottom";
      caberComOBalao(card, H, 0);
      return;
    }
    const r = target.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return placeSpot(null, false);
    const pad = 8;
    const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
    const w = Math.min(W - x, r.width + pad * 2), h = Math.min(H - y, r.height + pad * 2);
    spot.style.left = `${x}px`; spot.style.top = `${y}px`; spot.style.width = `${w}px`; spot.style.height = `${h}px`;
    // passo interativo: abre um "buraco" na camada que bloqueia cliques, só sobre o destaque
    // destaque que ocupa quase a tela toda: a sombra do próprio destaque some, então escurece a camada inteira
    shade.classList.toggle("dim", !interactive && (w * h) / (W * H) > 0.45);
    shade.style.clipPath = interactive ? `path(evenodd, "M0 0H${W}V${H}H0Z M${x} ${y}H${x + w}V${y + h}H${x}Z")` : "none";
    card.dataset.pos = y + h / 2 > H * 0.55 ? "top" : "bottom";
    // O cartão ia para o alto da tela e caía EM CIMA do balão de fala: quem está aprendendo precisa ler
    // os dois ao mesmo tempo (o que o paciente disse e o que o tutorial explica). Quando há balão, o
    // cartão desce para logo abaixo dele — e só se ainda sobrar tela até o destaque.
    caberComOBalao(card, H, y);
  }

  // O cartão do tutorial e o balão de fala disputam a mesma tela. O cartão ia para o alto e caía EM CIMA
  // do balão: quem está aprendendo precisa ler os dois ao mesmo tempo (o que o paciente disse e o que o
  // tutorial explica). Aqui ele desce para logo abaixo do balão quando cabe e, se a tela for baixa
  // demais para os dois, encolhe até a faixa livre e rola por dentro em vez de tapar a fala.
  function caberComOBalao(card, H, yDestaque) {
    card.style.top = "";
    card.style.maxHeight = "";
    const bolha = document.querySelector("#screen-consult:not(.hidden) .speech-bubble");
    if (!bolha) return;
    const b = bolha.getBoundingClientRect();
    if (b.height <= 4) return;
    if (card.dataset.pos === "top" && yDestaque) {
      const abaixo = Math.round(b.bottom + 10);
      if (abaixo + card.offsetHeight < yDestaque + 8) card.style.top = `${abaixo}px`;
    }
    // quanto sobra depende de onde o cartão está ancorado: preso embaixo ele cresce para cima e tem de
    // parar antes do balão; preso em cima ele cresce para baixo; e, se foi solto logo abaixo do balão,
    // o que sobra é o que vai dali até o rodapé
    const sobra = card.style.top ? H - parseInt(card.style.top, 10) - 14
      : card.dataset.pos === "top" ? Math.round(b.top) - 26
        : H - 14 - Math.round(b.bottom) - 12;
    if (sobra > 90 && card.offsetHeight > sobra) card.style.maxHeight = `${sobra}px`;
  }

  function show(it) {
    item = it;
    const target = it.target ? $(it.target) : null;
    if (target && target.scrollIntoView) target.scrollIntoView({ block: "center" });
    stepNo += 1;
    $("tutor-title").textContent = (it.title ? I18N.pick(it.title) : t(`tut.${it.key}.t`)) + (stepTotal > 1 ? `  ·  ${stepNo}/${stepTotal}` : "");   // it.title/it.text: texto embutido (dicas de sistemas novos)
    // {nome} e {quem}: quem está na sala vem da agenda, não de um nome escrito no texto
    $("tutor-text").textContent = it.text ? I18N.pick(it.text) : t(`tut.${it.key}.x`, { nome: pacienteAtual(), quem: quemFalaAgora() });
    $("tutor-next").classList.toggle("hidden", Boolean(it.wait));
    $("tutor-hint").classList.toggle("hidden", !it.wait);
    // SAÍDA DE EMERGÊNCIA. O passo que espera uma ação esconde o "Continuar" e fica aguardando o
    // jogador tocar no destaque — mas se outra coisa abre por cima (o aviso de "notar o corpo", por
    // exemplo), a ação esperada some da tela e o tutorial trava sem nenhum botão. Se o passo estiver
    // esperando há tempo demais, ou se um aviso abriu por cima, o "Continuar" aparece assim mesmo.
    clearInterval(saida);
    liberado = false;
    // TOCAR NO DESTAQUE AVANÇA, por si. O passo dizia "toque no que está em destaque" e só andava se o
    // JOGO chamasse `Tutor.release()` — e todo caminho que não chamava deixava o jogador tocando no
    // lugar certo sem nada acontecer, até a saída de emergência aparecer. Quem tocou no destaque fez o
    // que foi pedido: o tutorial segue.
    if (soltaNoDestaque) { soltaNoDestaque(); soltaNoDestaque = null; }
    if (it.wait && it.interactive && target) {
      const aoTocar = () => { if (visible && item === it) advance(); };
      target.addEventListener("click", aoTocar, true);
      soltaNoDestaque = () => target.removeEventListener("click", aoTocar, true);
    }
    if (it.wait) {
      const desde = Date.now();
      saida = setInterval(() => {
        if (!visible || item !== it) return clearInterval(saida);
        const porCima = document.querySelector(".modal:not(.hidden), #feedback-panel:not(.hidden)");
        // e se o que estava para ser tocado nem dá para tocar (tudo desabilitado ali), não faz sentido
        // esperar: o jogador ficaria olhando para um destaque que não responde
        const nadaClicavel = target && !target.querySelector("button:not([disabled]), a, input:not([disabled]), [role=button]");
        if (porCima || nadaClicavel || Date.now() - desde > 5000) {
          liberado = true;                 // sem isto o botão aparecia e NÃO FAZIA NADA: `next()` recusa passo com `wait`
          $("tutor-next").classList.remove("hidden");
          $("tutor-hint").classList.add("hidden");
          clearInterval(saida);
        }
      }, 500);
    }
    root().classList.remove("hidden");
    visible = true;
    document.body.classList.add("tutor-active");     // esmaece os botões "Continuar" do jogo: só o do tutorial vale agora
    requestAnimationFrame(() => {
      placeSpot(target, Boolean(it.interactive));
      root().classList.add("on");
    });
    // O BALÃO DE FALA CHEGA DEPOIS. Quando o cartão aparece, o balão da consulta ainda está sendo
    // digitado: mede-se um balão que não existe e o cartão se acomoda como se a tela estivesse vazia —
    // aí o texto chega e os dois ficam um por cima do outro. Refaz a conta enquanto a fala se monta.
    [260, 700, 1400].forEach((ms) => setTimeout(() => { if (visible && item === it) placeSpot(target, Boolean(it.interactive)); }, ms));
    sfx("tip");
  }

  function hide() {
    clearInterval(saida);
    visible = false;
    item = null;
    document.body.classList.remove("tutor-active");
    root().classList.remove("on");
    root().classList.add("hidden");
  }

  function advance() {
    if (queue.length) show(queue.shift());
    else { hide(); topicMode = false; }
  }

  return {
    running: () => visible,
    run(items) { topicMode = false; queue = items.slice(); stepNo = 0; stepTotal = queue.length; advance(); },
    // dica de um assunto novo: aparece uma única vez, na primeira vez que o jogador chega ali (e só com as dicas ligadas)
    topic(id, items) {
      state.tuts = state.tuts || {};
      if (!settings.tips || state.tuts[id] || visible || (session && session.tutorial && !state.tutorialDone)) return false;
      if (!items.every((it) => !it.target || $(it.target))) return false;
      state.tuts[id] = true;
      saveState();
      queue = items.slice();
      stepNo = 0; stepTotal = queue.length;
      topicMode = true;
      advance();
      return true;
    },
    // toque no texto ou em "Continuar": só avança os passos que não esperam uma ação do jogador
    next() { if (item && (!item.wait || liberado)) advance(); },
    // o jogador fez a ação esperada (escolheu uma opção)
    release() { if (item && item.wait) advance(); },
    skip() {
      queue = [];
      hide();
      if (topicMode) { topicMode = false; return; }      // pular um assunto novo não encerra o tutorial da primeira consulta
      state.tutorialDone = true;
      saveState();
    },
    reposition() { if (item) placeSpot(item.target ? $(item.target) : null, Boolean(item.interactive)); },
    init() {
      $("tutor-next").addEventListener("click", (e) => { e.stopPropagation(); Tutor.next(); });
      $("tutor-skip").addEventListener("click", (e) => { e.stopPropagation(); Tutor.skip(); });
      $("tutor-card").addEventListener("click", () => Tutor.next());
      window.addEventListener("resize", () => Tutor.reposition());
      document.addEventListener("keydown", (e) => {
        if (!visible) return;
        if (e.key === "Escape") { e.preventDefault(); Tutor.skip(); }
        else if (e.key === "Enter" || e.key === " ") { if (item && (!item.wait || liberado)) { e.preventDefault(); Tutor.next(); } }
      }, true);
    }
  };
})();

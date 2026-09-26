"use strict";

// Emojis do começo dos botões viram um "selo" redondo e uniforme (mesmo tamanho, borda e sombra em qualquer aparelho),
// em vez de figurinhas soltas de tamanhos e estilos diferentes. O texto do botão não muda (só ganha um <span>).
(function () {
  const SEL = ".menu-btn, .pill-btn, .link-btn.with-emoji";
  // MODO ESCURO (7.13). O tema escuro é um `filter: invert()` na página inteira, e ele inverte também
  // os emojis — o sol fica azul, a cara amarela fica roxa. Os botões já escapavam porque o emoji deles
  // vira um selo `.e-chip`, que o CSS desinverte. Em título, aba e nota o emoji ficava solto no texto e
  // era invertido junto. Aqui ele ganha `.e-inv`: sem mudança visual nenhuma, só a marca que o tema
  // escuro precisa para devolver a cor certa.
  const SEL_TEXTO = "h2, h3, .shop-tab, .qx-st, .aqx-h, .uni-q, .shop-note, .dx-trail-t > b, .save-cab > b, .city-act, .wheel-item > b, .wheel-item > small, .stat-item, .map-label, .dx-hint, .say-note, .opt-note, .dx-find-t > b, .chat-head > strong, #clock-icon, .create-opt, .save-card small";
  const LEAD = /^((?![▶◀↺↩▸►])(?:\p{Extended_Pictographic})(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u;

  function wrap(btn, classe) {
    const n = btn.firstChild;
    if (!n || n.nodeType !== 3) return;
    const m = LEAD.exec(n.nodeValue);
    if (!m) return;
    const chip = document.createElement("span");
    chip.className = classe || "e-chip";
    chip.setAttribute("aria-hidden", "true");
    chip.textContent = m[1];
    n.nodeValue = n.nodeValue.slice(m[0].length);
    btn.insertBefore(chip, n);
  }

  // Em texto, o emoji não precisa estar no começo: "Agenda 🔒" e "🤝 Anamnese · 3/10" são tão comuns
  // quanto o emoji inicial. Aqui cada pedaço de emoji do texto direto do elemento vira um <span class="e-inv">.
  const EMOJI_TODOS = /((?:\p{Extended_Pictographic})(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)/gu;
  function marcarEmojis(el) {
    [...el.childNodes].forEach((n) => {
      if (n.nodeType !== 3 || !n.nodeValue) return;
      if (!/\p{Extended_Pictographic}/u.test(n.nodeValue)) return;
      const partes = n.nodeValue.split(EMOJI_TODOS).filter((x) => x !== "");
      if (partes.length < 2) return;
      const frag = document.createDocumentFragment();
      partes.forEach((t) => {
        if (/^\p{Extended_Pictographic}/u.test(t)) { const sp = document.createElement("span"); sp.className = "e-inv"; sp.textContent = t; frag.appendChild(sp); }
        else frag.appendChild(document.createTextNode(t));
      });
      el.replaceChild(frag, n);
    });
  }

  function scan(root) {
    (root.querySelectorAll ? root.querySelectorAll(SEL) : []).forEach((el) => wrap(el, "e-chip"));
    if (root.matches && root.matches(SEL)) wrap(root, "e-chip");
    (root.querySelectorAll ? root.querySelectorAll(SEL_TEXTO) : []).forEach(marcarEmojis);
    if (root.matches && root.matches(SEL_TEXTO)) marcarEmojis(root);
  }

  let queued = false;
  function later() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; scan(document); }); }

  function start() {
    scan(document);
    new MutationObserver(later).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

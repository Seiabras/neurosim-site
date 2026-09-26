"use strict";

// Dinheiro do país do idioma: nome (reais, dólares, euros, ienes, yuans, dólares taiwaneses), símbolo e um ícone próprio.
// O ícone 🪙 que aparece nos textos é trocado, em qualquer lugar da tela, pelo ícone da moeda atual.
const Money = (function () {
  const TABLE = {
    pt: { code: "BRL", sym: "R$", plural: "reais", one: "real", style: "brl" },
    en: { code: "USD", sym: "$", plural: "dollars", one: "dollar", style: "usd" },
    es: { code: "EUR", sym: "€", plural: "euros", one: "euro", style: "eur" },
    fr: { code: "EUR", sym: "€", plural: "euros", one: "euro", style: "eur" },
    de: { code: "EUR", sym: "€", plural: "Euro", one: "Euro", style: "eur" },
    ja: { code: "JPY", sym: "¥", plural: "円", one: "円", style: "jpy" },
    zh: { code: "CNY", sym: "¥", plural: "元", one: "元", style: "cny" },
    zt: { code: "TWD", sym: "NT$", plural: "元", one: "元", style: "twd" },
    fi: { code: "EUR", sym: "€", plural: "euroa", one: "euro", style: "eur" },
    it: { code: "EUR", sym: "€", plural: "euro", one: "euro", style: "eur" },
    ru: { code: "RUB", sym: "₽", plural: "рублей", one: "рубль", style: "rub" },
    ko: { code: "KRW", sym: "₩", plural: "원", one: "원", style: "krw" },
    gn: { code: "PYG", sym: "₲", plural: "guaraníes", one: "guaraní", style: "pyg" }   // guaraní paraguaio
  };
  // Palavras de "moeda" de cada idioma que não é pt/en/es, trocadas pelo dinheiro do país (com a forma gramatical certa)
  const WORDS = {
    fr: [[/\bpièces\b/gi, "euros"], [/\bpièce\b/gi, "euro"]],
    de: [[/\bMünzen\b/g, "Euro"], [/\bMünze\b/g, "Euro"]],
    ja: [[/コイン/g, "円"]],
    zh: [[/金币/g, "元"]],
    zt: [[/金幣/g, "元"]],
    gn: [[/\bpirapire\b/gi, "guaraníes"]],
    it: [[/\bmonete\b/gi, "euro"], [/\bmoneta\b/gi, "euro"]],
    ru: [[/(?<![а-яё])монетами(?![а-яё])/gi, "рублями"], [/(?<![а-яё])монеты(?![а-яё])/gi, "рубли"], [/(?<![а-яё])монет(?![а-яё])/gi, "рублей"], [/(?<![а-яё])монету(?![а-яё])/gi, "рубль"], [/(?<![а-яё])монета(?![а-яё])/gi, "рубль"]],
    ko: [[/코인/g, "원"]],
    fi: [[/\bkolikkoa\b/gi, "euroa"], [/\bkolikot\b/gi, "eurot"], [/\bkolikon\b/gi, "euron"], [/\bkolikko\b/gi, "euro"]]
  };
  const keepCase = (from, to) => (from[0] !== from[0].toLowerCase() ? to.charAt(0).toUpperCase() + to.slice(1) : to);
  const cur = () => TABLE[I18N.lang] || TABLE.pt;

  const svg = (inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>${inner}</svg>`;
  const coin = (fill, ring, sym, txt, fs) => svg(`<circle cx='16' cy='16' r='14.5' fill='${fill}' stroke='#5a3f08' stroke-width='2'/><circle cx='16' cy='16' r='10.6' fill='none' stroke='${ring}' stroke-width='1.6'/><text x='16' y='${fs > 11 ? 21 : 19.6}' text-anchor='middle' font-size='${fs}' font-weight='800' font-family='system-ui,Arial,sans-serif' fill='${txt}'>${sym}</text>`);
  const ICONS = {
    brl: coin("#e8b923", "#c9c9d2", "R$", "#3a2a08", 10.5),                                    // moeda de dois tons, como as de real
    eur: coin("#f2c230", "#4a6fd0", "€", "#4a3a08", 15),                                       // aro azul, como as de euro
    jpy: coin("#d7dbe3", "#9aa3b5", "¥", "#3d4557", 15),                                       // prateada, como a de 100 ienes
    cny: coin("#f5c542", "#c62828", "元", "#8a1a1a", 14),                                     // dourada com aro vermelho
    twd: coin("#f0c040", "#b08a20", "NT$", "#4a3508", 9.4),
    rub: coin("#d7dbe3", "#2a5fbf", "₽", "#26304a", 15),
    krw: coin("#e6c34a", "#8a8f9c", "₩", "#3a2f08", 15),
    pyg: coin("#c9c9d2", "#d52b1e", "₲", "#2a2a3a", 15),                                        // prateada com aro vermelho, como o guaraní
    usd: svg("<rect x='1.5' y='7' width='29' height='18' rx='3' fill='#6fbf73' stroke='#2f6b3a' stroke-width='2'/><circle cx='16' cy='16' r='6' fill='#a8dfab' stroke='#2f6b3a' stroke-width='1.4'/><text x='16' y='20.4' text-anchor='middle' font-size='11' font-weight='800' font-family='system-ui,Arial,sans-serif' fill='#1f5a2c'>$</text><circle cx='6' cy='16' r='1.6' fill='#2f6b3a'/><circle cx='26' cy='16' r='1.6' fill='#2f6b3a'/>")  // cédula
  };

  function apply() {
    const c = cur();
    const url = "data:image/svg+xml;utf8," + encodeURIComponent(ICONS[c.style]);
    document.documentElement.style.setProperty("--coin-img", `url("${url}")`);
    document.querySelectorAll(".coin-ic").forEach((n) => { n.title = `${c.sym} (${c.code})`; });
  }

  // troca "moedas/coins/monedas" pelo nome do dinheiro do país, mantendo maiúscula inicial
  function wordify(text) {
    if (typeof text !== "string") return text;
    const own = WORDS[I18N.lang];
    if (own) text = own.reduce((acc, [re, to]) => acc.replace(re, (m) => keepCase(m, to)), text);
    if (!/moeda|coin|moneda/i.test(text)) return text;
    const c = cur();
    return text.replace(/\b(moedas|coins|monedas)\b/gi, (m) => (m[0] === m[0].toUpperCase() ? c.plural.charAt(0).toUpperCase() + c.plural.slice(1) : c.plural))
      .replace(/\b(moeda|coin|moneda)\b/gi, (m) => (m[0] === m[0].toUpperCase() ? c.one.charAt(0).toUpperCase() + c.one.slice(1) : c.one));
  }

  function decorateText(node) {
    if (!node.parentNode || node.nodeValue.indexOf("🪙") < 0) return;
    const parts = node.nodeValue.split("🪙");
    const frag = document.createDocumentFragment();
    parts.forEach((p, i) => {
      if (p) frag.appendChild(document.createTextNode(p));
      if (i < parts.length - 1) { const s = document.createElement("span"); s.className = "coin-ic"; s.setAttribute("aria-hidden", "true"); frag.appendChild(s); }
    });
    node.parentNode.replaceChild(frag, node);
  }

  function scan(root) {
    if (root.nodeType === 3) return decorateText(root);
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT|CANVAS)$/.test(root.tagName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const list = [];
    let n;
    while ((n = w.nextNode())) if (n.nodeValue.indexOf("🪙") >= 0) list.push(n);
    list.forEach(decorateText);
  }

  function init() {
    I18N.setPost(wordify);
    I18N.applyDom();          // refaz os textos já escritos, agora com o nome do dinheiro do país
    apply();
    scan(document.body);
    new MutationObserver((muts) => {
      muts.forEach((m) => {
        if (m.type === "characterData") decorateText(m.target);
        else m.addedNodes.forEach(scan);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    I18N.onChange(() => { apply(); });
  }

  return { init, apply, current: cur, wordify };
})();
window.Money = Money;

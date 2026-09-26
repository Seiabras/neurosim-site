"use strict";

// Idiomas do jogo: português (padrão), inglês e espanhol.
//  - L(pt, en, es)  cria um texto nos 3 idiomas
//  - t("chave", {vars}) busca um texto da interface
//  - resolve(obj, vars) troca, dentro de qualquer estrutura, todos os textos L pelo idioma atual
//  - data-i18n / data-i18n-html / data-i18n-attr no HTML são preenchidos por applyDom()
(function () {
  const LANGS = ["pt", "en", "es", "fr", "de", "it", "ru", "ja", "ko", "zh", "zt", "fi", "gn"];
  const CORE = ["pt", "en", "es"];      // o conteúdo clínico (casos, Manual, loja) existe nestes; nos demais usa o inglês
  const NAMES = { pt: "Português", en: "English", es: "Español", fr: "Français", de: "Deutsch", it: "Italiano", ru: "Русский", ja: "日本語", ko: "한국어", zh: "简体中文", zt: "繁體中文", fi: "Suomi", gn: "Avañe'ẽ" };
  const HTML_LANG = { pt: "pt-BR", zh: "zh-Hans", zt: "zh-Hant", fi: "fi", gn: "gn", it: "it", ru: "ru", ko: "ko" };
  const EXTRA = {};                    // traduções extras da interface, por idioma (i18n-extra.js)
  let post = (s) => s;                 // ganho final aplicado a todo texto da interface (ex.: nome da moeda)
  let lang = "pt";
  const UI = {};
  const listeners = [];

  const L = (pt, en, es) => ({ __l: 1, pt, en: en === undefined ? pt : en, es: es === undefined ? pt : es });
  const isL = (v) => Boolean(v) && typeof v === "object" && v.__l === 1;

  function fmt(s, vars) {
    if (typeof s !== "string" || !vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }

  // no guarani (falado no Paraguai, onde quase todos também sabem espanhol) o conteúdo clínico cai no espanhol; nos demais, no inglês
  // nomes traduzidos além do trio pt/en/es (países, loja, bichinhos: js/i18n/names-i18n.js) ficam em v.fr, v.de…; o resto cai no inglês
  const pick = (v) => (isL(v) ? (CORE.includes(lang) ? v[lang] || v.pt : v[lang] || (lang === "gn" ? v.es : v.en) || v.pt) : v);

  function define(map) { Object.assign(UI, map); }

  function t(key, vars) {
    const ex = EXTRA[lang];
    if (ex && ex[key] !== undefined) return post(fmt(ex[key], vars));
    const v = UI[key];
    if (v === undefined) return key;
    return post(fmt(pick(v), vars));
  }

  function addLang(code, dict) { EXTRA[code] = Object.assign(EXTRA[code] || {}, dict); }

  // Troca todos os L de uma estrutura pelo texto do idioma atual (copia, sem alterar o original).
  function resolve(x, vars) {
    if (isL(x)) return post(fmt(pick(x), vars));
    if (Array.isArray(x)) return x.map((i) => resolve(i, vars));
    if (x && typeof x === "object") {
      const out = {};
      for (const k of Object.keys(x)) out[k] = resolve(x[k], vars);
      return out;
    }
    return x;
  }

  // ---------------------------------------------------------------- bandeiras em SVG (emoji de bandeira não aparece no Windows)
  const FLAGS = {
    pt: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='21' fill='#009b3a'/><path d='M15 2.4 27.2 10.5 15 18.6 2.8 10.5z' fill='#ffdf00'/><circle cx='15' cy='10.5' r='4.6' fill='#002776'/><path d='M10.6 9.4c3-.9 6.6-.4 8.9 1.4' stroke='#fff' stroke-width='.9' fill='none'/></svg>",
    en: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='21' fill='#fff'/>" +
      [0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y='${i * 1.615}' width='30' height='1.615' fill='#b22234'/>`).join("") +
      "<rect width='13' height='11.3' fill='#3c3b6e'/>" +
      [1, 2, 3].map((r) => [1, 2, 3, 4].map((c) => `<circle cx='${c * 2.6 - 0.6}' cy='${r * 2.6 - 0.6}' r='.5' fill='#fff'/>`).join("")).join("") + "</svg>",
    es: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='21' fill='#aa151b'/><rect y='5.25' width='30' height='10.5' fill='#f1bf00'/></svg>",
    fr: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='10' height='21' fill='#0055a4'/><rect x='10' width='10' height='21' fill='#fff'/><rect x='20' width='10' height='21' fill='#ef4135'/></svg>",
    de: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='7' fill='#000'/><rect y='7' width='30' height='7' fill='#dd0000'/><rect y='14' width='30' height='7' fill='#ffce00'/></svg>",
    ja: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='21' fill='#fff'/><circle cx='15' cy='10.5' r='6' fill='#bc002d'/></svg>",
    zh: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='21' fill='#de2910'/><polygon points='5,3 6.2,6.6 10,6.6 6.9,8.8 8.1,12.4 5,10.2 1.9,12.4 3.1,8.8 0,6.6 3.8,6.6' fill='#ffde00'/><circle cx='11' cy='3.2' r='.9' fill='#ffde00'/><circle cx='13' cy='5.4' r='.9' fill='#ffde00'/><circle cx='13' cy='8.2' r='.9' fill='#ffde00'/><circle cx='11' cy='10.4' r='.9' fill='#ffde00'/></svg>",
    fi: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='21' fill='#fff'/><rect x='8' width='4.6' height='21' fill='#003580'/><rect y='8.2' width='30' height='4.6' fill='#003580'/></svg>",
    it: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='10' height='21' fill='#009246'/><rect x='10' width='10' height='21' fill='#fff'/><rect x='20' width='10' height='21' fill='#ce2b37'/></svg>",
    ru: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='7' fill='#fff'/><rect y='7' width='30' height='7' fill='#0039a6'/><rect y='14' width='30' height='7' fill='#d52b1e'/></svg>",
    ko: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='21' fill='#fff'/><path d='M10.5 10.5a4.5 4.5 0 0 1 9 0z' fill='#cd2e3a'/><path d='M10.5 10.5a4.5 4.5 0 0 0 9 0z' fill='#0047a0'/><circle cx='12.75' cy='10.5' r='2.25' fill='#cd2e3a'/><circle cx='17.25' cy='10.5' r='2.25' fill='#0047a0'/><g fill='#000'><g transform='rotate(-34 5 4.5)'><rect x='2.5' y='2.6' width='5' height='.8'/><rect x='2.5' y='4' width='5' height='.8'/><rect x='2.5' y='5.4' width='5' height='.8'/></g><g transform='rotate(34 25 4.5)'><rect x='22.5' y='2.6' width='5' height='.8'/><rect x='22.5' y='4' width='5' height='.8'/><rect x='22.5' y='5.4' width='5' height='.8'/></g><g transform='rotate(34 5 16.5)'><rect x='2.5' y='14.6' width='5' height='.8'/><rect x='2.5' y='16' width='5' height='.8'/><rect x='2.5' y='17.4' width='5' height='.8'/></g><g transform='rotate(-34 25 16.5)'><rect x='22.5' y='14.6' width='5' height='.8'/><rect x='22.5' y='16' width='5' height='.8'/><rect x='22.5' y='17.4' width='5' height='.8'/></g></g></svg>",
    gn: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='7' fill='#d52b1e'/><rect y='7' width='30' height='7' fill='#fff'/><rect y='14' width='30' height='7' fill='#0038a8'/><circle cx='15' cy='10.5' r='2.8' fill='#fff' stroke='#0038a8' stroke-width='.5'/><circle cx='15' cy='10.5' r='1.9' fill='none' stroke='#2e8b3a' stroke-width='.5'/><path d='M15 9.4l.3.7h.7l-.6.5.2.7-.6-.4-.6.4.2-.7-.6-.5h.7z' fill='#f1c40f'/></svg>",
    zt: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 21'><rect width='30' height='21' fill='#fe0000'/><rect width='15' height='10.5' fill='#000095'/><circle cx='7.5' cy='5.25' r='3.4' fill='#fff'/><circle cx='7.5' cy='5.25' r='2.4' fill='#000095'/><circle cx='7.5' cy='5.25' r='1.9' fill='#fff'/></svg>"
  };
  const flagSrc = (code) => "data:image/svg+xml;utf8," + encodeURIComponent(FLAGS[code]);

  function flagImg(code) {
    const img = document.createElement("img");
    img.className = "flag";
    img.alt = "";
    img.src = flagSrc(code);
    return img;
  }

  // ---------------------------------------------------------------- DOM
  function applyDom(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    scope.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":");
        if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
      });
    });
    document.documentElement.lang = HTML_LANG[lang] || lang;
  }

  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    applyDom();
    listeners.forEach((fn) => fn(lang));
  }

  function init(start) {
    if (LANGS.includes(start)) lang = start;
    applyDom();
  }

  window.I18N = {
    LANGS, NAMES, L, isL, t, define, addLang, resolve, pick, fmt, applyDom, setLang, init, flagImg, flagSrc,
    setPost(fn) { post = fn; },
    get lang() { return lang; },
    onChange(fn) { listeners.push(fn); }
  };
  window.L = L;
  window.t = t;
})();

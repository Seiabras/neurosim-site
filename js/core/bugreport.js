"use strict";

// Reportar um problema.
// Pedir para o jogador "descrever o bug" é pedir o que ele não tem: ele viu a tela travar, não viu o
// erro. Então o jogo anota sozinho tudo o que dá para anotar — o erro de verdade, os últimos botões
// que foram tocados, a tela, a versão, o aparelho — e o jogador só conta o que viu.
// Não há servidor (o jogo é uma página estática), então o caminho que CHEGA de verdade é a área de
// problemas do GitHub, aberta já preenchida em um toque. Copiar, baixar e a cópia guardada aqui
// existem para quando não há internet ou conta — nada se perde.
const Bug = (function () {
  const L = window.L;
  const pick = (x) => (typeof I18N !== "undefined" ? I18N.pick(x) : x && x.pt) || x;
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

  // Para onde o relato vai. Tem de ser o repositório PÚBLICO: quem joga precisa conseguir abrir a issue,
  // e issue de repositório privado não existe para quem está de fora. Com a separação público/privado,
  // o código-fonte mora no privado e este endereço aponta para o repositório do site.
  const REPO = "https://github.com/Seiabras/neurosim";   // o repositório PÚBLICO do site: é nele que o jogador consegue abrir issue (o código-fonte vive no privado neurosim-fonte)
  const MAX_ERROS = 12;          // os últimos erros bastam: o primeiro costuma ser o que importa
  const MAX_PASSOS = 30;         // a trilha de toques até quebrar — é o que permite repetir o caminho
  const MAX_URL = 6000;          // o GitHub corta a URL muito longa, então o corpo vai aparado
  const GUARDADOS = "neurosim-bugs";
  const MAX_GUARDADOS = 20;

  const erros = [];
  const passos = [];
  let avisou = false;
  let ultimaTela = "";

  // ------------------------------------------------------------------ o que o jogo anota sozinho

  function anotar(tipo, msg, onde) {
    const e = { tipo, msg: String(msg || "").slice(0, 300), onde: String(onde || "").slice(0, 160), quando: agora(), tela: telaAtual() };
    const ult = erros[erros.length - 1];
    if (ult && ult.msg === e.msg && ult.onde === e.onde) { ult.vezes = (ult.vezes || 1) + 1; return; }  // um laço quebrado não pode empurrar os outros erros para fora
    erros.push(e);
    while (erros.length > MAX_ERROS) erros.shift();
    oferecer();
  }

  const agora = () => new Date().toTimeString().slice(0, 8);

  // a trilha: sem ela o relato diz "travou" e ninguém sabe onde. Com ela dá para repetir o caminho.
  function passo(txt) {
    const p = { t: agora(), txt: String(txt).slice(0, 80) };
    const ult = passos[passos.length - 1];
    if (ult && ult.txt === p.txt) { ult.vezes = (ult.vezes || 1) + 1; return; }
    passos.push(p);
    while (passos.length > MAX_PASSOS) passos.shift();
  }

  function rotulo(n) {
    if (!n || n === document || n === document.body) return "";
    const b = n.closest ? n.closest("button, a, input, select, .shop-tab, [role=button]") : null;
    const alvo = b || n;
    if (alvo.id) return `#${alvo.id}`;
    const t = (alvo.getAttribute && (alvo.getAttribute("aria-label") || alvo.getAttribute("data-i18n"))) || (alvo.textContent || "").trim();
    const nome = t.replace(/\s+/g, " ").slice(0, 40);
    return nome ? `${(alvo.tagName || "?").toLowerCase()} "${nome}"` : (alvo.className ? `.${String(alvo.className).split(" ")[0]}` : "");
  }

  document.addEventListener("click", (ev) => {
    const r = rotulo(ev.target);
    const t = telaAtual();
    if (t !== ultimaTela) { passo(`→ ${t}`); ultimaTela = t; }
    if (r) passo(`toque ${r}`);
  }, true);

  window.addEventListener("error", (ev) => {
    if (ev && ev.target && ev.target !== window && ev.target.src) { anotar("arquivo", `não carregou: ${ev.target.src}`, ev.target.tagName); return; }
    anotar("erro", ev && ev.message, ev && ev.filename ? `${String(ev.filename).split("/").pop()}:${ev.lineno}:${ev.colno}` : "");
  }, true);
  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev && ev.reason;
    anotar("promessa", r && (r.message || r), r && r.stack ? String(r.stack).split("\n")[1] : "");
  });

  // quando algo quebra de verdade o botão vai até o jogador: com a tela travada ele pode não
  // conseguir chegar em Opções
  function oferecer() {
    if (avisou || !document.body) return;
    avisou = true;
    const b = el("button", "bug-flutua", `🐞 ${tr("Algo quebrou. Reportar?", "Something broke. Report it?", "Algo se rompió. ¿Reportar?")}`);
    b.type = "button";
    b.addEventListener("click", () => { b.remove(); abrir(); });
    document.body.appendChild(b);
    setTimeout(() => { if (b.isConnected) b.classList.add("some"); }, 15000);
  }

  // em que tela o jogador estava: a janela aberta vale mais que a tela de fundo
  function telaAtual() {
    const m = document.querySelector(".modal:not(.hidden)");
    if (m && m.id) return `janela:${m.id}`;
    const s = document.querySelector(".screen:not(.hidden)");
    return s && s.id ? s.id : "?";
  }

  function contexto() {
    const c = {
      versao: window.GAME_VERSION || "?",
      quando: new Date().toISOString(),
      tela: telaAtual(),
      idioma: (typeof I18N !== "undefined" && I18N.lang) || navigator.language,
      janela: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      toque: ("ontouchstart" in window) || navigator.maxTouchPoints > 0 ? "sim" : "não",
      navegador: navigator.userAgent
    };
    try {
      if (typeof state !== "undefined" && state) {
        c.semana = state.week;
        c.dia = (state.dayIndex || 0) + 1;
        c.caso = (typeof session !== "undefined" && session && session.caseKey) || state.currentCase || "—";
        c.tutorial = state.tutorialDone ? tr("feito", "done", "hecho") : tr("em andamento", "in progress", "en curso");
      }
      if (typeof settings !== "undefined" && settings) {
        c.cenario3d = settings.graphics3d ? "ligado" : "desligado";
        c.cidadeWebGL = settings.pixiCity ? "ligada" : "desligada";
        c.primeiraPessoa = settings.firstPerson ? "ligada" : "desligada";
      }
      if (typeof Perf !== "undefined" && Perf.level) c.desempenho = Perf.level();
      if (typeof THREE !== "undefined") c.three = THREE.REVISION;
    } catch (e) { c.estado = `não deu para ler: ${e && e.message}`; }
    return c;
  }

  // ------------------------------------------------------------------ o relato

  const CATS = [
    ["travou", L("Travou ou fechou", "Froze or crashed", "Se colgó o cerró")],
    ["visual", L("Desenho, imagem ou layout", "Art, image or layout", "Dibujo, imagen o diseño")],
    ["texto", L("Texto ou tradução", "Text or translation", "Texto o traducción")],
    ["regra", L("Regra do jogo / algo não faz sentido", "Game rule / something makes no sense", "Regla del juego / algo no tiene sentido")],
    ["som", L("Som ou música", "Sound or music", "Sonido o música")],
    ["lento", L("Lentidão", "Slowness", "Lentitud")],
    ["outro", L("Outra coisa", "Something else", "Otra cosa")]
  ];
  const FREQ = [
    ["sempre", L("Acontece sempre", "Happens every time", "Pasa siempre")],
    ["asvezes", L("Acontece às vezes", "Happens sometimes", "Pasa a veces")],
    ["uma", L("Aconteceu uma vez", "Happened once", "Pasó una vez")]
  ];

  function texto(d) {
    const o = d || {};
    const nome = (x) => { const p = (x === "cat" ? CATS : FREQ).find((i) => i[0] === o[x]); return p ? pick(p[1]) : "—"; };
    const L2 = [];
    L2.push(`**${tr("Tipo", "Kind", "Tipo")}:** ${nome("cat")} · **${tr("Frequência", "Frequency", "Frecuencia")}:** ${nome("freq")}`);
    L2.push("");
    L2.push(`### ${tr("O que aconteceu", "What happened", "Qué pasó")}`);
    L2.push(String(o.oque || "").trim() || `_${tr("(em branco)", "(blank)", "(en blanco)")}_`);
    const esp = String(o.esperado || "").trim();
    if (esp) { L2.push(""); L2.push(`### ${tr("O que eu esperava", "What I expected", "Qué esperaba")}`); L2.push(esp); }
    if (o.tecnico !== false) {
      const c = contexto();
      L2.push(""); L2.push(`### ${tr("Dados técnicos", "Technical data", "Datos técnicos")}`);
      Object.keys(c).forEach((k) => L2.push(`- **${k}**: ${c[k]}`));
      if (passos.length) {
        L2.push(""); L2.push(`### ${tr("Caminho até aqui", "Path up to here", "Camino hasta aquí")}`);
        L2.push("```");
        passos.forEach((p) => L2.push(`${p.t}  ${p.txt}${p.vezes ? ` (×${p.vezes})` : ""}`));
        L2.push("```");
      }
      if (erros.length) {
        L2.push(""); L2.push(`### ${tr("Erros que o jogo registrou", "Errors the game recorded", "Errores que el juego registró")}`);
        erros.forEach((e) => L2.push(`- \`${e.tipo}\` ${e.msg}${e.onde ? ` — ${e.onde}` : ""}${e.vezes ? ` (×${e.vezes})` : ""} [${e.tela}]`));
      } else {
        L2.push(""); L2.push(`_${tr("Nenhum erro de programa foi registrado — o problema é de comportamento, não de queda.", "No program error was recorded — the problem is behaviour, not a crash.", "No se registró ningún error de programa: el problema es de comportamiento, no una caída.")}_`);
      }
    }
    if (o.salvo) { L2.push(""); L2.push(`### ${tr("Jogo salvo", "Saved game", "Partida guardada")}`); L2.push(tr("Vai no arquivo baixado (é grande demais para caber aqui).", "It is in the downloaded file (too big to fit here).", "Va en el archivo descargado (demasiado grande para caber aquí).")); }
    return L2.join("\n");
  }

  // o jogo salvo é o que permite repetir o problema exatamente — mas só sai se o jogador mandar
  function salvoJSON() {
    try { return JSON.stringify({ state: typeof state !== "undefined" ? state : null, settings: typeof settings !== "undefined" ? settings : null }, null, 1); }
    catch (e) { return `(não deu para ler o jogo salvo: ${e && e.message})`; }
  }

  // ------------------------------------------------------------------ para onde vai

  function guardar(t) {
    try {
      const l = lista();
      l.unshift({ quando: new Date().toISOString(), versao: window.GAME_VERSION || "?", txt: t.slice(0, 4000) });
      localStorage.setItem(GUARDADOS, JSON.stringify(l.slice(0, MAX_GUARDADOS)));
    } catch (e) { /* sem localStorage o relato ainda vai para o GitHub ou para o arquivo */ }
  }
  function lista() { try { return JSON.parse(localStorage.getItem(GUARDADOS) || "[]"); } catch (e) { return []; } }
  function limpar() { try { localStorage.removeItem(GUARDADOS); } catch (e) { /* nada a limpar */ } }

  function arquivo(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo || "text/plain;charset=utf-8" }));
    const a = el("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function baixar(t, comSalvo) {
    const sel = `neurosim-${window.GAME_VERSION || "?"}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
    arquivo(`${sel}.md`, comSalvo ? `${t}\n\n---\n\n\`\`\`json\n${salvoJSON()}\n\`\`\`\n` : t);
    // a imagem da tela: o que existe de canvas (o consultório em 3D, a cidade) sai junto, porque
    // problema de desenho não se descreve com palavras
    const c = [...document.querySelectorAll("canvas")].filter((x) => x.width > 200 && x.height > 150 && x.offsetParent !== null)[0];
    if (c) { try { c.toBlob((b) => { if (b) arquivo(`${sel}.png`, b, "image/png"); }); } catch (e) { /* canvas de outra origem não se lê */ } }
  }

  async function copiar(t, bt) {
    let deu = false;
    try { await navigator.clipboard.writeText(t); deu = true; } catch (e) { deu = false; }
    if (!deu) {                                    // sem permissão de área de transferência, o truque antigo
      const ta = el("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { deu = document.execCommand("copy"); } catch (e2) { deu = false; }
      ta.remove();
    }
    if (bt) {
      bt.textContent = deu ? `✅ ${tr("Copiado", "Copied", "Copiado")}` : `⚠️ ${tr("Selecione e copie abaixo", "Select and copy below", "Selecciona y copia abajo")}`;
      setTimeout(() => render(), 2500);
    }
    return deu;
  }

  // ------------------------------------------------------------------ a janela

  let form = { cat: "travou", freq: "sempre", oque: "", esperado: "", tecnico: true, salvo: false };

  function render() {
    const body = $("bug-body");
    if (!body) return;
    body.textContent = "";

    body.appendChild(el("p", "shop-note", tr(
      "Conte com as suas palavras o que aconteceu. O jogo já anota sozinho a versão, a tela, o aparelho, os últimos botões que você tocou e o erro que apareceu por baixo — você não precisa saber nada disso. O caminho que chega mais rápido é o GitHub.",
      "Tell us in your own words what happened. The game already records the version, the screen, your device, the last buttons you tapped and the underlying error — you do not need to know any of that. The fastest route is GitHub.",
      "Cuenta con tus palabras qué pasó. El juego ya anota la versión, la pantalla, el aparato, los últimos botones que tocaste y el error de fondo: no necesitas saber nada de eso. El camino más rápido es GitHub.")));

    const escolha = (id, itens, chave) => {
      const f = el("div", "create-field");
      f.appendChild(el("span", "", id));
      const box = el("div", "create-choices");
      itens.forEach(([v, n]) => {
        const b = el("button", `choice-btn${form[chave] === v ? " sel" : ""}`, pick(n));
        b.type = "button";
        b.addEventListener("click", () => { form[chave] = v; render(); });
        box.appendChild(b);
      });
      f.appendChild(box); body.appendChild(f);
    };
    escolha(tr("Que tipo de problema", "What kind of problem", "Qué tipo de problema"), CATS, "cat");
    escolha(tr("Acontece de novo?", "Does it happen again?", "¿Vuelve a pasar?"), FREQ, "freq");

    const campo = (rot, chave, linhas, max, dica) => {
      const f = el("label", "create-field");
      f.appendChild(el("span", "", rot));
      const t = el("textarea", "bug-txt");
      t.rows = linhas; t.maxLength = max; t.value = form[chave];
      if (dica) t.placeholder = dica;
      t.addEventListener("input", () => { form[chave] = t.value; atualiza(); });
      f.appendChild(t); body.appendChild(f);
      return t;
    };
    const t1 = campo(tr("O que aconteceu", "What happened", "Qué pasó"), "oque", 4, 1200,
      tr("Ex.: apertei Encerrar a consulta e a tela ficou parada.", "E.g.: I pressed End the session and the screen froze.", "Ej.: pulsé Terminar la consulta y la pantalla se quedó parada."));
    t1.id = "bug-oque";
    campo(`${tr("O que você esperava", "What you expected", "Qué esperabas")} · ${tr("opcional", "optional", "opcional")}`, "esperado", 2, 600, "").id = "bug-esperado";

    const marca = (id, rot, chave, nota) => {
      const c = el("label", "opt-check");
      const i = el("input"); i.type = "checkbox"; i.id = id; i.checked = form[chave];
      i.addEventListener("change", () => { form[chave] = i.checked; render(); });
      c.appendChild(i); c.appendChild(el("span", "", rot));
      body.appendChild(c);
      if (nota) body.appendChild(el("p", "opt-note", nota));
    };
    marca("bug-tec", tr("Enviar junto os dados técnicos (recomendado)", "Send the technical data along (recommended)", "Enviar también los datos técnicos (recomendado)"), "tecnico");
    marca("bug-salvo", tr("Anexar o meu jogo salvo", "Attach my saved game", "Adjuntar mi partida guardada"), "salvo",
      tr("Vai só no arquivo baixado, e é o que permite reproduzir o problema exatamente como aconteceu com você.", "It goes only in the downloaded file, and it is what makes it possible to reproduce the problem exactly as it happened to you.", "Va solo en el archivo descargado, y es lo que permite reproducir el problema tal como te pasó."));

    if (erros.length) {
      body.appendChild(el("p", "bug-achou", `🐞 ${tr("O jogo registrou {n} erro(s) nesta sessão, e {p} passo(s) do seu caminho. Tudo vai junto.", "The game recorded {n} error(s) in this session, and {p} step(s) of your path. It all goes along.", "El juego registró {n} error(es) en esta sesión y {p} paso(s) de tu camino. Todo va incluido.")
        .replace("{n}", erros.length).replace("{p}", passos.length)}`));
    }

    const pre = el("pre", "bug-prev", texto(form));
    body.appendChild(pre);
    const atualiza = () => { pre.textContent = texto(form); };

    const linha = el("div", "opt-row bug-acoes");
    const bGit = el("button", "pill-btn primary", `🐙 ${tr("Enviar pelo GitHub", "Send via GitHub", "Enviar por GitHub")}`);
    bGit.type = "button";
    bGit.addEventListener("click", () => {
      const t = texto(form);
      guardar(t);
      const titulo = (String(form.oque || "").trim().split("\n")[0] || tr("Problema no jogo", "Problem in the game", "Problema en el juego")).slice(0, 80);
      window.open(`${REPO}/issues/new?labels=bug&title=${encodeURIComponent(`[${window.GAME_VERSION || "?"}] ${titulo}`)}&body=${encodeURIComponent(t.slice(0, MAX_URL))}`, "_blank", "noopener");
    });
    const bCop = el("button", "pill-btn", `📋 ${tr("Copiar", "Copy", "Copiar")}`);
    bCop.type = "button";
    bCop.addEventListener("click", () => { const t = texto(form); guardar(t); copiar(t, bCop); });
    const bArq = el("button", "pill-btn", `💾 ${tr("Baixar arquivo", "Download file", "Descargar archivo")}`);
    bArq.type = "button";
    bArq.addEventListener("click", () => { const t = texto(form); guardar(t); baixar(t, form.salvo); });
    linha.appendChild(bGit); linha.appendChild(bCop); linha.appendChild(bArq);
    body.appendChild(linha);
    body.appendChild(el("p", "opt-note", tr(
      "Baixou o arquivo? Ponha-o na pasta bugs/ do jogo — é de lá que os relatos são lidos.",
      "Downloaded the file? Put it in the game's bugs/ folder — that is where reports are read from.",
      "¿Descargaste el archivo? Ponlo en la carpeta bugs/ del juego: de ahí se leen los informes.")));

    const g = lista();
    if (g.length) {
      const n = el("p", "opt-note", tr("{n} relato(s) guardado(s) neste aparelho.", "{n} report(s) saved on this device.", "{n} informe(s) guardado(s) en este aparato.").replace("{n}", g.length));
      const bTodos = el("button", "pill-btn tiny", `💾 ${tr("Baixar todos", "Download all", "Descargar todos")}`);
      bTodos.type = "button";
      bTodos.addEventListener("click", () => arquivo(`neurosim-relatos-${new Date().toISOString().slice(0, 10)}.md`, g.map((x) => `## ${x.quando} · ${x.versao}\n\n${x.txt}`).join("\n\n---\n\n")));
      const lim = el("button", "pill-btn tiny", `🗑 ${tr("Apagar", "Delete", "Borrar")}`);
      lim.type = "button";
      lim.addEventListener("click", () => { limpar(); render(); });
      n.appendChild(document.createTextNode(" "));
      n.appendChild(bTodos); n.appendChild(document.createTextNode(" ")); n.appendChild(lim);
      body.appendChild(n);
    }
  }

  function abrir() {
    const m = $("bug-modal");
    if (!m) return;
    render();
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("bug"), 400);
    if (typeof openModal === "function") openModal("bug-modal"); else m.classList.remove("hidden");
    const fl = document.querySelector(".bug-flutua");
    if (fl) fl.remove();
  }

  return { abrir, render, texto, contexto, anotar, passo, erros: () => erros.slice(), passos: () => passos.slice(), lista, limpar, form: () => form, CATS, FREQ, MAX_ERROS, MAX_PASSOS };
})();
window.Bug = Bug;

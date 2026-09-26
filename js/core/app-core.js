"use strict";

// ===========================================================================
// Núcleo: constantes, estado, idioma, HUD, telas, dicas e cartão de dia
// ===========================================================================

const DAYS = ["segunda", "terca", "quarta", "quinta", "sexta"];
const PAPER_DAYS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const SCHEDULE = window.SCHEDULE_DATA;
const DOT_KEYS = { "dot-pink": "dot.anam", "dot-blue": "dot.test", "dot-green": "dot.dev" };

// trilha de nível pensada para semanas de jogo (um paciente rende ~50 XP por consulta; o ciclo tem 4 semanas): Jr → Pleno ≈ 2 semanas, Sênior ≈ fim do ciclo
const LEVEL_XP = [0, 1400, 2800, 5000, 8000, 12000];
const START_AFFINITY = 60;
const DAY_START = 7 * 60 + 30;      // o dia começa às 07:30
const LATE_GRACE = 10;              // minutos de tolerância na consulta
const PATIENT_WAIT = 40;            // depois de tantos minutos do horário marcado, o paciente cansa de esperar e vai embora
const DUSK_FROM = 17 * 60 + 30;     // entardecer
const NIGHT_FROM = 19 * 60 + 30;    // noite (até as 06:00)
const NIGHT_TO = 6 * 60;
const FORCED_SLEEP = 26 * 60;       // 02:00: sem dormir até lá, o cansaço vence
const LATE_PENALTY = 10;            // vínculo perdido por chegar atrasada
const START_ENERGY = 80;
const ENERGY_PER_SESSION = 25;
const LOW_ENERGY = 30;
const BREAK_ACTIONS = 3;
const COINS_PER_STAR = 10;
const MAX_VINCULO_BONUS = 5;
const HINT_COST = 5;
const DELTA = { 4: 12, 3: 10, 2: 5, 1: -5, 0: -12 };   // nota da abordagem -> efeito no vínculo

const SAVE_KEY = "neuroclin-games-save-v3";
// VÁRIOS SAVES. Havia UM save só: um clique errado em "Reiniciar jogo", um bug ou um save estragado
// apagava semanas de trabalho sem volta. Agora o jogo guarda cópias nomeadas ao lado do save corrente —
// o jogador cria quando quiser, e o próprio jogo guarda uma por semana antes de virar a página.
const SLOTS_KEY = "neuroclin-games-slots-v1";
const MAX_SLOTS = 8;
const Saves = (function () {
  const ler = () => { try { return JSON.parse(localStorage.getItem(SLOTS_KEY)) || []; } catch (e) { return []; } };
  // Gravar podia falhar em silêncio. O estado do jogo cresceu (caderno, marcações, arcos da cidade,
  // combinados, acabamentos) e oito cópias inteiras dele chegam perto do limite do navegador: quando o
  // limite estoura, o `setItem` lança e a lista fica como estava — o jogador aperta Salvar e não
  // acontece nada. Agora, ao estourar, as cópias AUTOMÁTICAS mais velhas saem para abrir espaço, uma a
  // uma, e só se nem assim couber é que se desiste (e quem chamou fica sabendo).
  const gravar = (l) => {
    const lista = l.slice();
    for (;;) {
      try { localStorage.setItem(SLOTS_KEY, JSON.stringify(lista)); return true; } catch (e) { /* sem espaço: abre espaço */ }
      const i = lista.map((x, j) => [x, j]).reverse().find(([x]) => x.auto);
      if (i) { lista.splice(i[1], 1); continue; }
      if (lista.length > 1) { lista.pop(); continue; }
      try { localStorage.removeItem(SLOTS_KEY); } catch (e2) { /* nem apagar dá: o navegador não guarda nada */ }
      return false;
    }
  };
  const rotulo = (st) => {
    const nome = (st.player && st.player.name) || "—";
    const sem = st.week || 1, dia = (st.dayIndex || 0) + 1;
    return `${nome} · ${I18N.pick(window.L("semana", "week", "semana"))} ${sem}, ${I18N.pick(window.L("dia", "day", "día"))} ${dia}`;
  };
  return {
    lista: () => ler().map((x) => ({ id: x.id, nome: x.nome, quando: x.quando, auto: Boolean(x.auto), resumo: x.resumo })),
    // guarda uma cópia do estado atual. `auto` marca as que o jogo cria sozinho (uma por semana).
    guardar(nome, auto) {
      const l = ler();
      const copia = { id: `s${Date.now().toString(36)}`, nome: String(nome || rotulo(state)).slice(0, 40), quando: new Date().toISOString(), auto: Boolean(auto), resumo: rotulo(state), dados: JSON.parse(JSON.stringify(state)) };
      if (auto) { const i = l.findIndex((x) => x.auto && x.chave === `w${state.week || 1}`); if (i >= 0) l.splice(i, 1); copia.chave = `w${state.week || 1}`; }
      l.unshift(copia);
      // o teto derruba primeiro as automáticas mais velhas: as que o jogador nomeou têm preferência
      while (l.length > MAX_SLOTS) { const i = l.map((x, j) => [x, j]).reverse().find(([x]) => x.auto); l.splice(i ? i[1] : l.length - 1, 1); }
      return gravar(l) ? copia.id : null;
    },
    carregar(id) {
      const c = ler().find((x) => x.id === id);
      if (!c || !c.dados) return false;
      Saves.guardar(I18N.pick(window.L("antes de carregar", "before loading", "antes de cargar")), true);   // rede de segurança: o que estava em jogo não se perde
      state = sanear(Object.assign(newState(), c.dados));
      saveState();
      return true;
    },
    apagar(id) { const l = ler().filter((x) => x.id !== id); return gravar(l); },
    rotulo,

    // ---------------------------------------------------------------- levar o jogo embora (7.9)
    // O save vive no localStorage, que é preso ao ENDEREÇO do site: trocar de domínio, de navegador
    // ou de computador deixava a partida para trás, e limpar os dados do navegador apagava tudo sem
    // volta. Aqui o jogo inteiro vira um arquivo que a pessoa guarda onde quiser.
    //
    // O arquivo leva o estado e as cópias salvas, com versão e data. Não leva `settings` (letra, som,
    // desempenho são do APARELHO, não da partida) nem a sessão de conta.
    exportar(tudo) {
      const pacote = {
        formato: "neurosim-save", versao: 1, jogo: window.GAME_VERSION || "?",
        quando: new Date().toISOString(),
        rotulo: rotulo(state),
        estado: JSON.parse(JSON.stringify(state)),
        slots: tudo === false ? [] : ler()
      };
      return pacote;
    },
    baixar(tudo) {
      const p2 = Saves.exportar(tudo);
      const nome = `neurosim-${(state.player && state.player.name ? String(state.player.name) : "jogo").replace(/[^\w-]+/g, "-").toLowerCase()}-s${state.week || 1}-${new Date().toISOString().slice(0, 10)}.json`;
      try {
        const blob = new Blob([JSON.stringify(p2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = nome;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        return nome;
      } catch (e) { return null; }
    },
    // Lê o arquivo e diz o que há dentro SEM aplicar: quem decide é o jogador, vendo o que vai entrar.
    ler(texto) {
      let p2 = null;
      try { p2 = JSON.parse(String(texto)); } catch (e) { return { erro: "json" }; }
      if (!p2 || p2.formato !== "neurosim-save" || !p2.estado) return { erro: "formato" };
      if (Number(p2.versao) > 1) return { erro: "novo" };   // arquivo de uma versão futura do formato
      const e2 = p2.estado;
      return {
        ok: true, pacote: p2, jogo: p2.jogo, quando: p2.quando,
        rotulo: p2.rotulo || "—",
        semana: e2.week || 1,
        estrelas: Object.values(e2.results || {}).reduce((n, r) => n + (Number(r && r.stars) || 0), 0),
        xp: Number(e2.xp) || 0,
        slots: Array.isArray(p2.slots) ? p2.slots.length : 0
      };
    },
    // Aplica o arquivo. Antes disso guarda o que estava em jogo, para nada ser perdido sem volta.
    importar(pacote, comSlots) {
      const p2 = pacote && pacote.pacote ? pacote.pacote : pacote;
      if (!p2 || p2.formato !== "neurosim-save" || !p2.estado) return false;
      Saves.guardar(I18N.pick(window.L("antes de importar", "before importing", "antes de importar")), true);
      state = sanear(Object.assign(newState(), p2.estado));
      if (comSlots && Array.isArray(p2.slots) && p2.slots.length) {
        const meus = ler(), vindos = p2.slots.filter((x) => x && x.id && x.dados);
        const juntos = vindos.concat(meus.filter((m) => !vindos.some((v) => v.id === m.id)));
        gravar(juntos.slice(0, MAX_SLOTS));
      }
      saveState();
      return true;
    }
  };
})();
window.Saves = Saves;
const SETTINGS_KEY = "neuroclin-games-settings-v1";

// ---------------------------------------------------------------- utilidades
const $ = (id) => document.getElementById(id);
const t = (key, vars) => I18N.t(key, vars);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
// Movimento reduzido: era só o que o sistema operacional dizia. Quem joga no navegador de outra
// pessoa, ou num aparelho sem esse ajuste, não tinha como pedir — e para quem tem enxaqueca ou
// vertigem isso não é preferência, é acesso.
const reducedMotion = () => Boolean((typeof settings !== "undefined" && settings.reducedMotion)
  || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
const starText = (n) => "⭐".repeat(n) + "☆".repeat(3 - n);

// ---------------------------------------------------------------- estado e persistência
function newState() {
  return {
    version: 3,
    dayIndex: 0, apptIndex: 0, dayOver: false,
    affinity: START_AFFINITY, energy: START_ENERGY,
    xp: 0, coins: 0,
    clock: DAY_START, introDone: false, tutorialDone: false, tips: {}, cardShown: -1,
    player: null,
    owned: STARTER_OWNED(), ownedClothes: { base: true, coat: true, shirt: true, sweater: true, purple: true, none: true },
    expansions: {}, layout: {},   // layout: posição livre de cada móvel { área: { id: { x, z, yaw } } } (decor.js)
    equipped: { consultorio: Object.assign({ cor: "cor-bege" }, STARTER.consultorio), espera: {}, casa: { "c-cor": "casa-cor-pessego", "c-planta": "casa-planta", "c-estante": "casa-estante" }, cozinha: {}, sazonal: {} },
    results: {}, phoneRead: {}, secretDone: {},
    city: { visited: {} }, social: {}, pets: [], petDay: -1, uni: { right: 0, total: 0 },
    manualOpen: {}, manualMigrated: true,
    starterGiven: STARTER_VER, week: 1, pat: {}, inbox: [], therapy: {}, banked: { stars: 0, max: 0 }   // acompanhamento: 4 semanas, 4 consultas por paciente (followup.js)
  };
}

// peças que a jogadora já tem desde o começo, para poder mexer nos móveis logo de cara (o resto se compra nas lojas)
// O consultório é o coração do jogo e começava com uma planta e duas poltronas: uma sala vazia.
// Agora a psicóloga já entra numa sala que parece uma sala — tapete, diploma na parede, abajur,
// cortina e a caixa de lenços na mesinha. Tudo isso continua trocável na loja; são só o ponto de partida.
const STARTER_VER = 2;   // sobe quando o kit inicial ganha peça nova (veja a migração em loadState)
const STARTER = {
  consultorio: { canto: "planta", tapete: "tapete", quadro: "quadro-diploma", luz: "abajur", cortina: "cortina-azul", mesa: "lencos" },
  casa: { "c-planta": "casa-planta", "c-estante": "casa-estante" }
};
const STARTER_OWNED = () => ({ planta: true, tapete: true, "quadro-diploma": true, abajur: true, "cortina-azul": true, lencos: true, "casa-planta": true, "casa-estante": true });

// Um save pode chegar estranho: editado à mão, truncado por uma aba fechada no meio da gravação,
// vindo de uma versão futura ou de um bug antigo. O jogo não pode morrer por causa disso — tem de
// abrir com o que dá para aproveitar. Aqui os campos que o resto do código assume como número,
// objeto ou texto são devolvidos ao tipo certo e postos dentro dos limites.
function sanear(st) {
  const num = (v, min, max, pad) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : pad; };
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  st.week = num(st.week, 1, 9999, 1);
  st.dayIndex = num(st.dayIndex, 0, DAYS.length - 1, 0);
  st.clock = num(st.clock, 0, 24 * 60, DAY_START);
  st.coins = num(st.coins, 0, 1e9, 0);
  st.xp = num(st.xp, 0, 1e9, 0);
  st.energy = num(st.energy, 0, 100, 100);
  st.affinity = num(st.affinity, 0, 100, START_AFFINITY);
  st.estresse = num(st.estresse, 0, 100, 0);
  ["results", "owned", "equipped", "pat", "dxbook", "phoneRead", "tuts", "ownedClothes", "atributos", "rep"].forEach((k) => { st[k] = obj(st[k]); });
  if (st.player && typeof st.player !== "object") st.player = null;
  if (st.player && typeof st.player.name !== "string") st.player.name = String(st.player.name == null ? "" : st.player.name);
  // o índice da consulta só faz sentido dentro da agenda do dia; a agenda ainda não existe aqui,
  // então fica só no intervalo seguro e quem usa confere de novo
  st.apptIndex = num(st.apptIndex, 0, 12, 0);
  // consulta em andamento que aponta para um caso que não existe mais: o melhor é começar o dia limpo
  const a = st.activeSession;
  if (a && (typeof a !== "object" || !a.key || !Array.isArray(a.steps))) st.activeSession = null;
  return st;
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 3) return newState();
    // saves de antes do tutorial guiado não precisam vê-lo de novo
    if (parsed.tutorialDone === undefined) parsed.tutorialDone = true;
    if (parsed.manualMigrated === undefined) parsed.manualMigrated = false;   // save antigo: abre o que o jogador já viu (veja manualMigrate)
    const st0 = Object.assign(newState(), parsed);
    // save antigo: ganha as peças iniciais que ainda não tem (sem tirar nada do que já usa). O número
    // sobe quando o kit inicial muda — assim quem já jogava também recebe o que entrou depois.
    if (Number(st0.starterGiven) < STARTER_VER) {
      st0.owned = Object.assign(STARTER_OWNED(), st0.owned);
      Object.keys(STARTER).forEach((area) => { st0.equipped[area] = st0.equipped[area] || {}; Object.entries(STARTER[area]).forEach(([slot, id]) => { if (!st0.equipped[area][slot]) st0.equipped[area][slot] = id; }); });
      st0.starterGiven = STARTER_VER;
    }
    st0.ownedClothes = Object.assign({ base: true }, st0.ownedClothes);   // a camisa base da personagem é de graça para quem já tinha save
    return sanear(st0);
  } catch (e) {
    return newState();
  }
}

// ---------------------------------------------------------------- verbetes do Manual abertos pelo jogador
// Os "principais" (core) já vêm abertos; os demais surgem ao estudar (aulas, biblioteca) e ao atender pacientes novos.
function findDisorder(id) {
  for (const g of MANUAL_GROUPS) { const d = g.disorders.find((x) => x.id === id); if (d) return { g, d }; }
  return null;
}

function manualMigrate() {
  if (state.manualMigrated) return;
  state.manualMigrated = true;
  state.manualOpen = state.manualOpen || {};
  try {
    Object.keys(SCHEDULE || {}).forEach((day) => (SCHEDULE[day] || []).forEach((a, idx) => {
      const c = CASES[a.caseId];
      if (state.results[resultKey(day, idx)] && c && c.diagnosis) (c.diagnosis.options || []).forEach((id) => { state.manualOpen[id] = true; });
    }));
    Object.keys((state.uni && state.uni.passed) || {}).forEach((gid) => { const g = MANUAL_GROUPS.find((x) => x.id === gid); if (g) g.disorders.forEach((d) => { state.manualOpen[d.id] = true; }); });
  } catch (e) { /* sem progresso para migrar */ }
}

function manualIsOpen(d) {
  manualMigrate();
  return Boolean(d.core) || Boolean(state.manualOpen && state.manualOpen[d.id]);
}

function manualCounts(g) {
  const list = g.disorders.filter((d) => d.items && d.items.length);
  return { open: list.filter(manualIsOpen).length, total: list.length };
}

// abre verbetes; devolve os que eram novos. "quiet" não mostra o aviso.
function unlockManual(ids, quiet) {
  manualMigrate();
  state.manualOpen = state.manualOpen || {};
  const fresh = [];
  ids.forEach((id) => {
    const f = findDisorder(id);
    if (f && !manualIsOpen(f.d) && f.d.items && f.d.items.length) { state.manualOpen[id] = true; fresh.push(f.d); }
  });
  if (fresh.length) {
    saveState();
    if (!quiet && typeof showToast === "function") showToast(fresh.length === 1 ? t("manual.unlocked.one", { name: fresh[0].name }) : t("manual.unlocked.many", { n: fresh.length }));
  }
  return fresh;
}

// campos da consulta em andamento (session, declarada abaixo) que precisam sobreviver a fechar e reabrir o jogo;
// session.choices fica de fora porque renderStep() a recalcula sempre, e session.typing porque é um timer/função
const SESSION_FIELDS = ["key", "secret", "manut", "dayKey", "apptIdx", "sess", "steps", "arc", "stepIndex", "goodChoices",
  "totalSteps", "points", "maxPoints", "phase", "dx", "tx", "late", "tutorial", "hintPaid", "unlocked", "notes",
  "branched", "lastScore", "riskSeen", "timeCut", "gasto", "asks", "estadoConsulta",
  // 4.13: sem estes, retomar uma consulta perdia o formato investigativo e o estado da máquina
  "investigativa", "modosUsados", "fsm",
  // 4.17/4.19: sem estes, retomar a consulta devolvia o confronto e a contratransferência já usados
  "intervPendente", "contraNomeada", "contraAgida", "consequencia", "despediu"];

function saveState() {
  // guarda o passo exato da consulta em andamento (se houver) para o botão "Continuar" retomar do mesmo lugar
  state.activeSession = session ? Object.fromEntries(SESSION_FIELDS.map((k) => [k, session[k]])) : null;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* sem localStorage: segue sem salvar */ }
  if (window.Cloud) window.Cloud.touch();
  if (typeof Life !== "undefined") Life.soon();   // confere conquistas novas
  try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* ambiente sem eventos */ }   // a store do Svelte (src/lib/stores/gameStore.js) escuta este aviso
}

function loadSettings() {
  const defaults = { hideSensitive: false, activities: true, typing: true, dev: false, showBest: false, tips: true, graphics3d: true, showApproach: false, freeDx: false, firstPerson: false, sfx: 0.7, music: 0.35, amb: 0.6, muted: false, typeSound: false, emptyOffice: true, instrument: "bell", theme: "auto", fontScale: 1, font: "auto", lang: "pt", secretUnlocked: false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? Object.assign(defaults, JSON.parse(raw)) : defaults;
  } catch (e) {
    return defaults;
  }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* idem */ }
}

let settings = loadSettings();

// aparência do site: tema (automático segue o aparelho, claro, escuro) e tamanho da letra
function applyLook() {
  const dark = settings.theme === "dark" || (settings.theme !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.setProperty("--fs", String(settings.fontScale || 1));
  document.documentElement.dataset.font = settings.font || "auto";
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? "#14152a" : "#e9e6df";
}
if (window.matchMedia) { try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyLook()); } catch (e) { /* navegador antigo */ } }
let state = loadState();
window.__neurosim = { getState: () => state, setState: (s) => { state = s; } };   // ponte para a store do Svelte (o `state` do jogo é um binding, não uma propriedade de window)
let session = null;       // consulta em andamento
let screen = "title";
let openCard = null;
let plannerDay = null;

const sfx = (name) => { if (window.Sound) window.Sound.play(name); };
const use3D = () => Boolean(settings.graphics3d && window.Scene3D && window.Scene3D.available);

function applySound() {
  if (window.Sound) { window.Sound.setVolume({ sfx: settings.sfx, music: settings.music, amb: settings.amb === undefined ? 0.6 : settings.amb, muted: settings.muted }); window.Sound.setInstrument(settings.instrument || "bell"); }
  const btn = $("nav-sound");
  if (btn) { const im = btn.querySelector("img"); if (im) im.src = settings.muted ? "assets/icon-mudo.svg" : "assets/icon-som.svg"; }
}

// ---------------------------------------------------------------- conteúdo no idioma atual
let CASES = {}, SECRET = {}, MANUAL_GROUPS = [], SHOP = null, APPROACH = {}, APPROACH_WHY = {};
let ITEM_MAP = {}, EXP_MAP = {}, TOP_MAP = {}, ACC_MAP = {}, SHOE_MAP = {}, UNDER_MAP = {};

function vars() { return docVars(state.player); }

function rebuildContent() {
  const v = vars();
  CASES = I18N.resolve(window.CASES_DATA, v);
  SECRET = I18N.resolve(window.SECRET_DATA, v);
  MANUAL_GROUPS = I18N.resolve(window.MANUAL_DATA, v);
  APPROACH = I18N.resolve(window.APPROACHES, v);
  APPROACH_WHY = I18N.resolve(window.APPROACH_DEFAULT_WHY, v);
  SHOP = I18N.resolve(window.SHOP_DATA, v);
  ITEM_MAP = {}; SHOP.items.forEach((it) => { ITEM_MAP[it.id] = it; });
  EXP_MAP = {}; SHOP.expansions.forEach((e) => { EXP_MAP[e.id] = e; });
  TOP_MAP = {}; SHOP.tops.forEach((x) => { TOP_MAP[x.id] = x; });
  ACC_MAP = {}; SHOP.accs.forEach((x) => { ACC_MAP[x.id] = x; });
  SHOE_MAP = {}; (SHOP.shoes || []).forEach((x) => { SHOE_MAP[x.id] = x; });
  UNDER_MAP = {}; (SHOP.under || []).forEach((x) => { UNDER_MAP[x.id] = x; });
  document.title = "NeuroClin Games";
  if (typeof Town !== "undefined") Town.injectCases();
  if (typeof Gen !== "undefined") Gen.restore();   // casos gerados (modo contínuo) no idioma atual
  if (typeof FU !== "undefined") FU.plan();
}

const itemById = (id) => ITEM_MAP[id];
const dayLabel = (k) => t("day." + k);
const weekDone = () => state.dayIndex >= DAYS.length;
const weekTotal = () => (state.sandbox || (state.week || 1) > FU.TOTAL_WEEKS ? "∞" : FU.TOTAL_WEEKS);   // modo contínuo: sem fim
const currentDayKey = () => DAYS[Math.min(state.dayIndex, DAYS.length - 1)];
const resultKey = (dayKey, idx) => `${dayKey}:${idx}`;
const totalStars = () => Object.values(state.results).reduce((sum, r) => sum + r.stars, 0) + ((state.banked && state.banked.stars) || 0);
const maxStars = () => DAYS.reduce((sum, d) => sum + SCHEDULE[d].length * 3, 0) + ((state.banked && state.banked.max) || 0);

function levelIndex(xp) {
  let idx = 0;
  LEVEL_XP.forEach((min, i) => { if (xp >= min) idx = i; });
  return idx;
}
const levelName = (i) => t("level." + i, vars());

// ---------------------------------------------------------------- itens da sala
function isOwned(item) {
  if (!item) return false;
  if (item.secretOnly) return Boolean(state.owned[item.id]);
  return item.price === 0 || Boolean(state.owned[item.id]);
}

// itens em uso numa área (sem a cor da parede)
function wornIds(area) {
  const eq = state.equipped[area] || {};
  return Object.entries(eq)
    .filter(([slot]) => slot !== "cor" && slot !== "c-cor")
    .map(([, id]) => id)
    .filter((id) => isOwned(itemById(id)));
}

const wallColorOf = (area) => {
  const eq = state.equipped[area] || {};
  const id = area === "casa" ? eq["c-cor"] : eq.cor;
  const it = itemById(id) || itemById(area === "casa" ? "casa-cor-pessego" : "cor-bege");
  return it.color;
};

// tudo o que está na sala de atendimento (consultório + decoração sazonal)
// nível de tamanho dos cômodos (0 = original, 1 e 2 = ampliados na loja)
const roomLevel = (area) => (area === "casa" ? (state.expansions["exp-tam-h2"] ? 2 : state.expansions["exp-tam-h1"] ? 1 : 0) : (state.expansions["exp-tam-c2"] ? 2 : state.expansions["exp-tam-c1"] ? 1 : 0));

const officeItems = () => wornIds("consultorio").concat(wornIds("sazonal"));

function dayEnergyBonus() {
  const saude = typeof Life !== "undefined" ? Math.round((Life.health() - 50) / 10) : 0;   // saúde acima de 50% dá disposição extra; abaixo, tira
  return wornIds("cozinha").reduce((sum, id) => sum + ((itemById(id) || {}).dayEnergy || 0), 0) + (window.Pets ? Pets.dayEnergy() : 0) + ((typeof Aquarium !== "undefined") ? Aquarium.dayBonus() : 0) + saude + (typeof Phone !== "undefined" ? Phone.supportBonus() : 0);
}

// Como o paciente é montado em 3D (a mesma armação da psicóloga). Os 15 casos escritos à mão trazem
// o `look` no content, combinando com a aquarela; casos gerados e secretos ganham um derivado do nome,
// sempre o mesmo para o mesmo nome. A altura sai da idade: criança senta menor que adulto.
const CABELOS_3D = ["", "bob", "long", "wavy", "curly", "ponytail", "braids", "bun"];
const PELES_3D = ["#f0d3b8", "#eac6a4", "#d9ae82", "#c99a6e", "#b07a4e", "#8a5c3a"];
const CABELO_COR_3D = ["#1d1a26", "#3a2a22", "#6a4526", "#a87a4a", "#c98a52", "#6a6a6a"];
const ROUPA_3D = ["#4a90c8", "#8fa6bd", "#5aa85a", "#d94f8a", "#e8c03a", "#8a7ab8", "#d9534f", "#4a6a4a"];

function idadeDe(c) { const a = typeof c.age === "object" ? I18N.pick(c.age) : c.age; return parseInt(String(a).replace(/\D+/g, ""), 10) || 30; }
function alturaPorIdade(anos) { return anos < 8 ? 0.62 : anos < 12 ? 0.72 : anos < 15 ? 0.82 : anos < 18 ? 0.92 : 1; }

// QUEM É QUEM. O modelo 3D precisa saber se desenha um corpo feminino, masculino ou neutro, e os
// casos dizem isso em `look.corpo`. Para os moradores, os gerados e quem mais não tiver a marca, o
// nome resolve — com uma lista curta para os que a regra da última letra erraria (Íris é mulher e
// acaba em s; Lucas é homem e também).
const CORPO_F = new Set(["iris", "ines", "mercedes", "lourdes", "dolores", "beatriz", "esther", "ester", "raquel", "isabel", "abigail", "miriam", "carmen", "jaqueline", "eliane", "solange", "leonor", "noemi", "rute", "rebeca", "agnes", "heloise", "elis", "eloa", "iasmin", "yasmin", "karen", "cristiane", "marlene", "nair", "zilda", "iracema", "consuelo"]);
const CORPO_M = new Set(["lucas", "marcos", "matias", "tobias", "elias", "jonas", "andre", "jose", "jorge", "felipe", "vicente", "davi", "davis", "isaac", "levi", "noe", "josue", "luca", "nicola", "samuel", "daniel", "gabriel", "rafael", "miguel", "ezequiel", "joel", "abel", "caetano", "vitor", "heitor", "nestor", "arthur", "artur", "ruben", "ivan", "adao", "moises", "tales", "ulisses", "anderson", "jefferson", "wilson", "nelson", "edson", "robson", "cleiton", "kaua", "juca", "cosme", "dorival", "aristides", "hermes", "silas"]);
function corpoPeloNome(nome) {
  const s = String(nome || "").trim();
  if (/^(sra\.?|dona|d\.)\s/i.test(s)) return "f";
  if (/^(sr\.?|seu|dom|dr\.?)\s/i.test(s)) return "m";
  const p = s.split(/\s+/)[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (CORPO_F.has(p)) return "f";
  if (CORPO_M.has(p)) return "m";
  if (/a$/.test(p)) return "f";
  if (/(o|os|or|ar|el|il|im|on|son|ton|ir|uz|do|to)$/.test(p)) return "m";
  return "n";
}

function caseLook(c, quem) {
  if (!c) return null;
  const base = quem === "parent" ? (c.parent || {}).look : c.look;
  const anos = quem === "parent" ? 40 : idadeDe(c);
  const nome = String(I18N.pick((quem === "parent" ? (c.parent || {}).name : c.name) || "?"));
  // `anos` vai junto porque o 3D precisa dele: busto, maxilar, sombra de barba e pomo de adão são
  // marcas de adulto, e a ALTURA não serve para decidir isso (aos 15 anos ela já é a de gente grande).
  if (base) return Object.assign({ scale: alturaPorIdade(anos), anos, corpo: corpoPeloNome(nome) }, base);
  const h = Town.hash(nome);
  return {
    skin: PELES_3D[h % PELES_3D.length], hair: CABELO_COR_3D[(h >> 3) % CABELO_COR_3D.length],
    hairStyle: CABELOS_3D[(h >> 6) % CABELOS_3D.length], top: ROUPA_3D[(h >> 9) % ROUPA_3D.length],
    eyeShape: ["round", "almond", "wide", "sleepy"][(h >> 12) % 4], brow: ["soft", "thick", "arched"][(h >> 14) % 3],
    mouth: "neutral", scale: alturaPorIdade(anos), anos, corpo: corpoPeloNome(nome)
  };
}

// A fala da própria doutora no diálogo da consulta. Era só "🩺 Você": quem fala do outro lado tem
// retrato e nome, e ela não tinha rosto nenhum. Agora a aquarela dela abre a linha, do mesmo jeito.
function falaDaDoutora(texto, extra) {
  const row = el("div", "say-row you" + (extra ? " " + extra : ""));
  const quem = el("div", "say-quem");
  try {
    const img = el("img", "say-retrato");
    img.src = Retrato.url(state.player || {});
    img.alt = "";
    quem.appendChild(img);
  } catch (e) { /* sem retrato: fica só o nome */ }
  quem.appendChild(el("b", "", (typeof docVars === "function" ? docVars(state.player).doc : I18N.pick(L("Você", "You", "Tú")))));
  row.appendChild(quem);
  row.appendChild(el("p", "say-quote", texto));
  return row;
}

function playerLook(src) {
  const p = src || state.player || {};
  const top = TOP_MAP[p.top] || SHOP.tops[0];
  const gl = p.gl && window.Pins ? Pins.byId(p.gl) : null, jw = p.jewel && window.Pins ? Pins.byId(p.jewel) : null, pin = p.pin && window.Pins ? Pins.byId(p.pin) : null;
  return {
    art: p.art === "psicologa", skin: p.skin, hair: p.hairColor, hairStyle: p.hairStyle, top: top.color, style: top.style, pants: top.pants || "", mark: top.mark || "", acc: p.acc || "none",
    // o calçado é peça própria desde a 6.17: antes a cor do sapato vinha presa à blusa, e só a camisa
    // com Ψ tinha sapato de verdade — todas as outras roupas calçavam o mesmo preto
    shoe: (SHOE_MAP[p.calcado] || {}).color || top.shoe || "", shoeKind: (SHOE_MAP[p.calcado] || {}).kind || "sapato",
    under: (UNDER_MAP[p.intima] || {}).color || "", semTop: Boolean(p.semTop),
    corpo: p.gender || "n",   // a personagem do jogador já diz como quer ser tratada: o corpo segue a mesma escolha
    eye: p.eyeColor, eyeShape: p.eyeShape || "round", brow: p.brow || "soft", mouth: p.mouth || "soft", face: p.face || "round", freckles: Boolean(p.freckles), gl: gl ? gl.kind : "", jewel: jw ? jw.kind : "",
    pinColor: pin ? (pin.spec ? pin.spec.c[0] : pin.bg) : ""
  };
}

// opções de 3D para a sala (consultório com sala de espera) e para a casa (quarto com cozinha)
function scenePlace(area) {
  const p = playerLook();
  return {
    wall: wallColorOf("consultorio"),
    worn: officeItems(),
    espera: Boolean(state.expansions["exp-espera"]),
    esperaWorn: wornIds("espera"),
    homeWall: wallColorOf("casa"),
    homeWorn: wornIds("casa"),
    kitchen: Boolean(state.expansions["exp-cozinha"]),
    kitchenWorn: wornIds("cozinha"),
    roomSize: roomLevel("consultorio"), homeSize: roomLevel("casa"), layouts: state.layout || {},
    player: p,
    pets: (state.pets || []).map((x) => ({ species: x.species, variant: x.variant || null, shine: Boolean(x.shine), name: x.name })),
    hora: (state.clock === undefined ? DAY_START : state.clock) / 60,   // a luz que entra pela janela segue o relógio do jogo (scene3d: luzDaHora)
    focus: area || "consultorio"
  };
}

// ---------------------------------------------------------------- HUD
let hudAvatarKey = "";

const fmtClock = (m) => { const v = Math.max(0, Math.round(m === undefined ? DAY_START : m)); return `${String(Math.floor(v / 60) % 24).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
const slotStart = (appt) => { const m = /^(\d{1,2}):(\d{2})/.exec(appt.time); return m ? Number(m[1]) * 60 + Number(m[2]) : 480; };
const nextAppt = () => (weekDone() ? null : SCHEDULE[currentDayKey()][state.apptIndex] || null);

// fase do dia pelo relógio: "day", "dusk" (entardecer) ou "night"
function dayPhase(clock) {
  const m = ((Math.round(clock === undefined ? DAY_START : clock) % 1440) + 1440) % 1440;
  if (m >= NIGHT_FROM || m < NIGHT_TO) return "night";
  return m >= DUSK_FROM ? "dusk" : "day";
}

function advanceClock(min) {
  state.clock = (state.clock === undefined ? DAY_START : state.clock) + min;
  if (window.Scene3D && Scene3D.hora) Scene3D.hora(state.clock / 60);   // a sala escurece junto com o dia
  saveState();
  updateHud();
  pularCancelados();
  checkPatientLeft();
  if (state.dayOver && state.clock >= FORCED_SLEEP) sleepNow(true);
}

// QUEM DESMARCOU (7.7) não fica esperando na agenda: ao chegar a vez dele, o horário passa em branco,
// com o recado já no celular. Diferente da falta por atraso, isso não é culpa do jogador — e por isso
// o aviso é outro. Ver FU.sortearCancelamento para quem desmarca e por quê.
function pularCancelados() {
  if (typeof FU === "undefined" || !FU.cancelou || session) return;
  let n = 0;
  while (!weekDone() && !state.dayOver) {
    const ap = nextAppt();
    if (!ap || !CASES[ap.caseId] || !FU.cancelou(ap.caseId)) break;
    const day = currentDayKey(), nome = CASES[ap.caseId].name;
    state.results[resultKey(day, state.apptIndex)] = { stars: 0, finalAffinity: state.affinity, skipped: true, cancelado: true };
    advanceSchedule(day);
    n += 1;
    if (typeof showToast === "function") showToast(`📵 ${I18N.pick(window.L(`${I18N.pick(nome)} desmarcou: o horário fica livre hoje.`, `${I18N.pick(nome)} cancelled: the slot is free today.`, `${I18N.pick(nome)} canceló: el horario queda libre hoy.`))}`);
    if (n > 4) break;
  }
  if (n) { saveState(); if (typeof refreshAll === "function") refreshAll(); if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("cancelou"), 600); }
}

// quem demora demais para chegar perde a consulta: o paciente espera um pouco e vai embora
function checkPatientLeft() {
  let left = 0;
  while (!session && !weekDone() && !state.dayOver) {
    const ap = nextAppt();
    if (!ap || state.clock <= slotStart(ap) + PATIENT_WAIT + Wheel.perk("wait") + (typeof Career !== "undefined" ? Career.wait() : 0)) break;
    const day = currentDayKey(), name = CASES[ap.caseId] ? CASES[ap.caseId].name : "";
    markSkipped(day, state.apptIndex);
    advanceSchedule(day);
    left += 1;
    if (typeof showToast === "function") showToast(t("clock.left", { name }));
    if (left > 8) break;
  }
  if (left) { saveState(); if (typeof refreshAll === "function") refreshAll(); }
}

// começa o dia seguinte: nova manhã, energia recuperada (menos, se a pessoa só apagou de cansaço)
function advanceDay(forced) {
  state.dayIndex += 1;
  if (typeof Career !== "undefined") { const pay = Career.payDay(); Career.check(); if (pay) setTimeout(() => showToast(`🧑‍💼 ${I18N.pick(window.L("Salário da recepção", "Receptionist salary", "Salario de recepción"))}: 🪙 −${pay}`), 1200); }
  state.apptIndex = 0;
  if (state.dayIndex >= DAYS.length && ((state.week || 1) < FU.TOTAL_WEEKS || state.sandbox)) { state.weekRolled = FU.nextWeek(); state.rolledFrom = (state.week || 2) - 1; }   // a semana vira sozinha até a 4ª
  state.dayOver = false;
  state.energy = clamp(START_ENERGY + dayEnergyBonus() + Wheel.perk("sleep") - (forced ? 15 : 0) - (typeof Events !== "undefined" && Events.stress() >= 60 ? 10 : 0), 0, 100);   // uma noite de sono (estresse alto atrapalha)
  state.clock = DAY_START;
  // o que você pediu a terceiros (escola, médico, família) chega com os dias, e vira achado na ficha
  if (typeof Dx !== "undefined" && Dx.entregarPedidos) {
    const chegou = Dx.entregarPedidos();
    chegou.forEach((c, i) => setTimeout(() => showToast(t("ph.pedidos.recado", { emoji: c.emoji, de: c.de, nome: I18N.pick((CASES[c.caso] || {}).name || ""), area: c.areaNome })), 1400 + i * 2600));
  }
  if (typeof Events !== "undefined") Events.newDay();   // estresse, intercorrência do dia e dilema da semana
  if (typeof Missoes !== "undefined") Missoes.conferir();
  // uma cópia automática por semana, feita antes de a semana virar: é a rede que o jogador não precisa lembrar de armar
  if (state.dayIndex === 0 && typeof Saves !== "undefined") Saves.guardar(`${I18N.pick(window.L("Início da semana", "Start of week", "Inicio de semana"))} ${state.week || 1}`, true);
}

function sleepNow(forced) {
  const saudeMsg = typeof Life !== "undefined" ? Life.dayHealth() : "";   // o dia que acabou mexe na saúde
  advanceDay(forced);
  if (saudeMsg) setTimeout(() => showToast(saudeMsg), 900);
  saveState();
  if (typeof backToHome === "function") backToHome();
  if (forced && typeof showToast === "function") showToast(t("city.sleep.forced"));
  if (typeof maybeDayCard === "function") maybeDayCard();
}

let toastTimer2 = null;
// A barra do topo quebra em duas linhas em tela estreita. Antes o CSS descontava 78px fixos, e o palco
// da consulta ficava mais alto que a janela: as opções de resposta saíam da tela por baixo.
// Aqui a altura real é medida e vira a variável --topbar.
function medirBarraDoTopo() {
  const bar = document.querySelector(".top-bar");
  if (!bar) return;
  const h = Math.round(bar.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty("--topbar", `${h}px`);
}
if (typeof window !== "undefined") {
  window.addEventListener("resize", medirBarraDoTopo);
  window.addEventListener("orientationchange", () => setTimeout(medirBarraDoTopo, 120));
  if (window.ResizeObserver) {
    const bar = document.querySelector(".top-bar");
    if (bar) new ResizeObserver(medirBarraDoTopo).observe(bar);
  }
  document.addEventListener("DOMContentLoaded", medirBarraDoTopo);
  setTimeout(medirBarraDoTopo, 0);
}

function showToast(text) {
  const box = $("toast");
  if (!box) return;
  box.textContent = text;
  box.classList.remove("hidden");
  clearTimeout(toastTimer2);
  toastTimer2 = setTimeout(() => box.classList.add("hidden"), 3600);
}

// dados prontos da barra superior (usados pelo componente Svelte HUD): só números e textos, sem DOM
function hudData() {
  const li = levelIndex(state.xp), next = LEVEL_XP[li + 1], p = state.player, h = state.health === undefined ? 50 : Math.round(state.health), ph = dayPhase(state.clock);
  return {
    label: { vida: t("hud.vida"), vinculo: t("hud.vinculo"), energy: t("hud.energy"), coins: t("hud.coins"), level: t("hud.level"), day: t("hud.day") },
    player: p ? { retrato: Retrato.url(p), name: vars().doc } : null,
    vida: { pct: clamp(h, 0, 100), text: `${h}%`, low: h < 30 },
    vinculo: { pct: state.affinity, text: `${state.affinity}%` },
    energia: { pct: clamp(state.energy, 0, 100), text: `${Math.round(state.energy)}%`, low: state.energy < LOW_ENERGY },
    stress: { show: typeof Events !== "undefined" && Events.stress() >= 20, text: `${Math.round(typeof Events !== "undefined" ? Events.stress() : 0)}%`, high: typeof Events !== "undefined" && Events.stress() >= 60 },
    coins: state.coins,
    level: { name: levelName(li), pct: next === undefined ? 100 : Math.round(((state.xp - LEVEL_XP[li]) / (next - LEVEL_XP[li])) * 100) },
    clock: { text: fmtClock(state.clock), icon: ph === "night" ? "🌙" : ph === "dusk" ? "🌇" : "🕗" },
    day: weekDone() ? t("hud.weekend") : `${t("hud.week", { n: state.week || 1, t: weekTotal() })} · ${dayLabel(currentDayKey())}`
  };
}

function updateHud() {
  document.body.dataset.phase = dayPhase(state.clock);
  if (window.HudSvelte) {   // o componente Svelte desenha a barra; aqui só o selo do celular (fica na navegação clássica) e o aviso
    const unread = (!weekDone() && !state.phoneRead[currentDayKey()]) || (typeof Risk !== "undefined" && Risk.pendingCrises().length > 0) || (typeof Events !== "undefined" && Events.pending().length > 0);
    $("phone-badge").style.display = unread ? "" : "none";
    try { window.dispatchEvent(new Event("neurosim:state")); } catch (e) { /* nada */ }
    return;
  }
  const cl = $("clock-label");
  if (cl) cl.textContent = fmtClock(state.clock);
  const ci = $("clock-icon");
  if (ci) { const ph = dayPhase(state.clock); ci.textContent = ph === "night" ? "🌙" : ph === "dusk" ? "🌇" : "🕗"; document.body.dataset.phase = ph; }
  $("affinity-score").textContent = `${state.affinity}%`;
  $("vinculo-fill").style.width = `${state.affinity}%`;
  // Defensividade: o quanto a pessoa ainda se protege. Já existia e decidia se ela responde a uma área
  // delicada (dxlab: GATE × Wheel.defense()), mas era invisível — o jogador só via o paciente "desviar".
  {
    const df = $("defesa-fill"), ds = $("defesa-score");
    if (df && ds) {
      const mult = typeof Wheel !== "undefined" && Wheel.defense ? Wheel.defense() : 1;
      const v = clamp(Math.round((100 - state.affinity) * mult), 0, 100);
      ds.textContent = `${v}%`;
      df.style.width = `${v}%`;
      const st = $("stat-defesa");
      if (st) st.classList.toggle("alta", v >= 60);   // ainda fechada: as áreas delicadas não abrem
    }
  }
  $("energy-score").textContent = `${Math.round(state.energy)}%`;
  { const sv = typeof Events !== "undefined" ? Events.stress() : 0, sc = $("stat-stress"); if (sc) { sc.classList.toggle("hidden", sv < 20); sc.classList.toggle("low", sv >= 60); $("stress-score").textContent = `${Math.round(sv)}%`; } }
  $("energy-fill").style.width = `${clamp(state.energy, 0, 100)}%`;
  $("stat-energy").classList.toggle("low", state.energy < LOW_ENERGY);
  { const h = state.health === undefined ? 50 : Math.round(state.health); $("vida-score").textContent = `${h}%`; $("vida-fill").style.width = `${clamp(h, 0, 100)}%`; $("stat-vida").classList.toggle("low-life", h < 30); }
  $("coins-score").textContent = state.coins;
  const li = levelIndex(state.xp);
  $("player-level").textContent = levelName(li);
  const next = LEVEL_XP[li + 1];
  $("xp-fill").style.width = next === undefined ? "100%" : `${Math.round(((state.xp - LEVEL_XP[li]) / (next - LEVEL_XP[li])) * 100)}%`;
  $("current-day-label").textContent = weekDone() ? t("hud.weekend") : `${t("hud.week", { n: state.week || 1, t: weekTotal() })} · ${dayLabel(currentDayKey())}`;
  const unread = (!weekDone() && !state.phoneRead[currentDayKey()]) || (typeof Risk !== "undefined" && Risk.pendingCrises().length > 0) || (typeof Events !== "undefined" && Events.pending().length > 0);
  $("phone-badge").style.display = unread ? "" : "none";

  const p = state.player;
  const key = p ? JSON.stringify([p.skin, p.hairStyle, p.hairColor, p.top, p.acc, p.name, p.gender, p.art, I18N.lang]) : "";
  if (key !== hudAvatarKey) {
    hudAvatarKey = key;
    $("hud-avatar").innerHTML = p ? `<img src="${Retrato.url(p)}" alt="">` : "";
    $("hud-name").textContent = p ? vars().doc : "";
    $("hud-player").classList.toggle("hidden", !p);
  }
}

// ---------------------------------------------------------------- telas e navegação
const SCREENS = ["title", "create", "intro", "home", "planner", "phone", "shop", "break", "secret", "consult", "city", "map"];

// histórico para o botão "voltar": só entre as telas de circulação (casa, loja, celular, cidade)
const BACKABLE = ["home", "shop", "phone", "city"];
let navBack = [], navGoingBack = false;

function goBack() {
  const prev = navBack.pop();
  if (!prev) return;
  navGoingBack = true;
  if (prev === "shop" && typeof renderShop === "function") renderShop();     // volta para a mesma aba, com o mesmo bichinho escolhido
  if (prev === "phone" && typeof renderPhone === "function") renderPhone();
  if (prev === "home" && typeof renderHome === "function") renderHome();
  showScreen(prev);
  navGoingBack = false;
  updateNav();
}

function showScreen(name) {
  closeCoachNow();
  setTimeout(medirBarraDoTopo, 0);   // a barra do topo só ganha altura depois que o jogo começa, e muda de linhas conforme a tela
  const changed = screen !== name;
  if (changed && !navGoingBack) {
    if (BACKABLE.includes(screen) && BACKABLE.includes(name)) { navBack.push(screen); if (navBack.length > 8) navBack.shift(); }
    else if (!BACKABLE.includes(name)) navBack = [];
  }
  screen = name;
  document.body.dataset.screen = name;
  document.body.classList.toggle("no-hud", name === "title" || name === "create" || name === "intro");
  if (window.Sound) {
    if (name !== "intro") window.Sound.alarm(false);
    const tema = typeof Town !== "undefined" ? Town.themeNow() : null;   // figura especial convencida: o consultório ganha música de época
    window.Sound.music(name === "intro" ? "intro" : name === "consult" ? (tema || "consult") : (tema && name === "home" ? tema : "calm"));
    if (name !== "city") window.Sound.ambient(name === "consult" ? "room" : ["home", "phone", "shop", "planner"].includes(name) ? "home" : null);   // na cidade, quem escolhe é o city.js
  }
  if (changed) sfx("screen");
  SCREENS.forEach((s) => $(`screen-${s}`).classList.toggle("hidden", s !== name));
  updateNav();
  window.scrollTo(0, 0);
  if (window.City) { if (name === "city") City.start(); else City.stop(); }
  if (name === "home") maybeDayCard();
}

// O ícone da tela atual sai; durante a consulta e o intervalo, só o Ψ fica.
function updateNav() {
  const busy = screen === "consult" || screen === "break";
  $("nav-door").classList.toggle("hidden", busy || weekDone());
  $("nav-back").classList.toggle("hidden", busy || !navBack.length || !BACKABLE.includes(screen));
  $("nav-phone").classList.toggle("hidden", screen === "phone" || busy);
  $("nav-shop").classList.toggle("hidden", screen === "shop" || busy);
  $("nav-city").classList.toggle("hidden", screen === "city" || screen === "map" || busy);
  $("nav-home").classList.toggle("active", screen === "home");
}

function goHome() {
  if (screen === "consult") {
    if (!confirm(t("leave.confirm"))) return;
    abandonSession();
  }
  if (screen === "break") stopBreak();
  renderHome();
  showScreen("home");
}

// ---------------------------------------------------------------- dicas do tutorial (fila)
let coachQueue = [];
let coachCurrent = null;
let coachTargetEl = null;

function pumpCoach() {
  if (coachCurrent || !coachQueue.length) return;
  const tip = coachQueue.shift();
  coachCurrent = tip.id;
  $("coach-title").textContent = t(`tip.${tip.id}.t`);
  $("coach-text").textContent = t(`tip.${tip.id}.x`, { n: HINT_COST });
  $("coach").classList.remove("hidden");
  sfx("tip");
  const target = tip.targetId ? $(tip.targetId) : null;
  if (target) {
    target.classList.add("coach-target");
    coachTargetEl = target;
  }
}

function coachTip(id, targetId) {
  if (session && session.tutorial && !state.tutorialDone) return;   // o tutorial guiado já explica
  if (!settings.tips || state.tips[id] || coachCurrent === id || coachQueue.some((x) => x.id === id)) return;
  coachQueue.push({ id, targetId });
  pumpCoach();
}

function dismissCoach(markSeen) {
  if (coachTargetEl) {
    coachTargetEl.classList.remove("coach-target");
    coachTargetEl = null;
  }
  $("coach").classList.add("hidden");
  if (markSeen && coachCurrent) {
    state.tips[coachCurrent] = true;
    saveState();
  }
  coachCurrent = null;
  pumpCoach();
}

function closeCoachNow() {
  coachQueue = [];
  dismissCoach(false);
}

// ---------------------------------------------------------------- cartão de início de dia
let dayCardTimer = null;

function hideDayCard() {
  clearTimeout(dayCardTimer);
  $("daycard").classList.add("hidden");
}

let holdDayCard = false;   // enquanto o resultado da consulta está para abrir, o cartão do dia espera

function maybeDayCard() {
  if (holdDayCard || weekDone() || !state.introDone || state.cardShown === state.dayIndex) return;
  state.cardShown = state.dayIndex;
  saveState();
  const n = SCHEDULE[currentDayKey()].length;
  $("daycard-num").textContent = t("day.num", { n: state.dayIndex + 1 });
  $("daycard-day").textContent = dayLabel(currentDayKey());
  $("daycard-sub").textContent = t(n > 1 ? "day.many" : "day.one", { n });
  $("daycard").classList.remove("hidden");
  sfx("day");
  clearTimeout(dayCardTimer);
  dayCardTimer = setTimeout(hideDayCard, 2200);
}

// ---------------------------------------------------------------- modais
let lastFocus = null;

function openModal(id) {
  sfx("open");
  lastFocus = document.activeElement;
  $(id).classList.remove("hidden");
  const focusable = $(id).querySelector("button");
  if (focusable) focusable.focus();
}

function closeModal(id) {
  $(id).classList.add("hidden");
  if (id === "hosp-modal") { if (typeof stopOfficeKeys === "function") stopOfficeKeys(); if (window.City) City.release(); const eo = document.querySelector("#hosp-body .empty-office"); if (eo && window.Scene3D) Scene3D.unmount(eo); }   // a pessoa que conversava volta a andar
  if (id === "act-modal" && typeof Activities !== "undefined") Activities.stop();   // para o jogo interativo ao fechar
  if (id === "aq-modal" && typeof Aquarium !== "undefined") Aquarium.close();   // solta o 3D do visualizador
  if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
}

// ---------------------------------------------------------------- viagem (animação de ir a outro lugar)
let travelTimer = null;

function travel(labelKey, done) {
  clearTimeout(travelTimer);
  if (reducedMotion()) { done(); return; }
  const box = $("travel");
  $("travel-text").textContent = t(labelKey);
  $("travel-walker").innerHTML = state.player ? `<img src="${Retrato.url(state.player)}" alt="">` : "";
  box.classList.remove("hidden", "arriving");
  void box.offsetWidth;
  box.classList.add("going");
  sfx("step");
  const steps = setInterval(() => sfx("step"), 320);
  travelTimer = setTimeout(() => {
    clearInterval(steps);
    done();
    box.classList.remove("going");
    box.classList.add("arriving");
    travelTimer = setTimeout(() => box.classList.add("hidden"), 380);
  }, 1500);
}

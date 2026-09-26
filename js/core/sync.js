"use strict";

// Conta, sincronização entre aparelhos e ranking. Só aparece quando o jogo é aberto pelo servidor
// (npm start); abrindo o index.html direto do disco, nada disso é mostrado e o jogo funciona como sempre.
(function () {
  const KEY = "neurosim-cloud-v1";
  let store = { token: "", name: "", lastSyncAt: 0, lastHash: "" };
  let online = false, busy = false, applying = false, pending = false, timer = null;

  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* sem localStorage */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* idem */ } };

  const hash = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h); };
  const localJson = () => JSON.stringify(state);
  const hasProgress = (s) => Boolean(s && (s.introDone || s.xp > 0 || s.coins > 0 || Object.keys(s.results || {}).length));
  const summary = (s) => {
    const stars = Object.values((s && s.results) || {}).reduce((n, r) => n + Math.min(3, Math.max(0, Math.round(Number(r && r.stars) || 0))), 0);
    return { stars, score: stars * 100 + Math.max(0, Math.round(Number(s && s.xp) || 0)) };
  };

  async function api(method, path, body) {
    try {
      const res = await fetch(((window.NEUROSIM_CONFIG && window.NEUROSIM_CONFIG.apiBase) || "") + "api/" + path, {
        method,
        headers: Object.assign({ "content-type": "application/json" }, store.token ? { authorization: "Bearer " + store.token } : {}),
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      let json = {};
      try { json = await res.json(); } catch (e) { /* sem corpo */ }
      return { status: res.status, json };
    } catch (e) {
      return { status: 0, json: {} };
    }
  }

  const msg = (text) => { const el = $("cloud-msg"); if (el) el.textContent = text || ""; };
  function errText(r, ctx) {
    if (r.status === 0) return t("cloud.err.offline");
    if (r.status === 429) return t("cloud.err.many");
    if (ctx === "login" && r.status === 401) return t("cloud.err.login");
    if (r.status === 401) return t("cloud.err.session");
    if (ctx === "register" && r.status === 409) return t("cloud.err.taken");
    if (ctx === "register" && r.status === 400) return t("cloud.err.rules");
    return t("cloud.err.generic");
  }

  function render() {
    const opt = $("opt-cloud");
    if (!opt) return;
    opt.classList.toggle("hidden", !online);
    $("btn-ranking").classList.toggle("hidden", !online);
    $("cloud-out").classList.toggle("hidden", Boolean(store.token));
    $("cloud-in").classList.toggle("hidden", !store.token);
    $("cloud-who").textContent = store.token ? t("cloud.who", { name: store.name }) : "";
  }

  function forget() {
    store = { token: "", name: "", lastSyncAt: 0, lastHash: "" };
    pending = false;
    persist();
    render();
  }

  // ------------------------------------------------------------ sincronização
  function markSynced(updatedAt) {
    store.lastSyncAt = updatedAt;
    store.lastHash = hash(localJson());
    persist();
    pending = false;
  }

  function applyRemote(cloud) {
    applying = true;
    try { adoptSave(cloud.save); } finally { applying = false; }
    markSynced(cloud.updatedAt);
    msg(t("cloud.downloaded"));
  }

  async function push(force, silent) {
    const r = await api("PUT", "save", { save: state, baseUpdatedAt: store.lastSyncAt, force: Boolean(force) });
    if (r.status === 200) { markSynced(r.json.updatedAt); if (!silent) msg(t("cloud.uploaded")); return true; }
    if (r.status === 409) { pending = true; if (silent) msg(t("cloud.pending")); else ask(r.json); return false; }
    if (r.status === 401) { forget(); msg(t("cloud.err.session")); return false; }
    if (!silent) msg(errText(r));
    return false;
  }

  function ask(cloud) {
    const mine = summary(state), theirs = summary(cloud.save);
    $("cloud-choice-local").textContent = t("cloud.choice.line.local", mine);
    $("cloud-choice-cloud").textContent = t("cloud.choice.line.cloud", theirs);
    $("cloud-use-local").onclick = async () => { closeModal("cloud-choice-modal"); msg(t("cloud.busy")); await push(true, false); };
    $("cloud-use-cloud").onclick = () => { closeModal("cloud-choice-modal"); applyRemote(cloud); };
    openModal("cloud-choice-modal");
  }

  // Decide sem perder nada: só pergunta quando os dois lados mudaram desde a última sincronização.
  async function sync(silent) {
    if (!online || !store.token || busy) return;
    busy = true;
    if (!silent) msg(t("cloud.busy"));
    try {
      const r = await api("GET", "save");
      if (r.status === 401) { forget(); msg(t("cloud.err.session")); return; }
      if (r.status !== 200) { if (!silent) msg(errText(r)); return; }
      const cloud = r.json;
      const localChanged = hash(localJson()) !== store.lastHash;
      if (!cloud.save) {
        if (hasProgress(state)) await push(true, silent); else if (!silent) msg(t("cloud.synced"));
      } else if (!hasProgress(state)) {
        applyRemote(cloud);
      } else if (localJson() === JSON.stringify(Object.assign(newState(), cloud.save))) {
        markSynced(cloud.updatedAt);
        if (!silent) msg(t("cloud.synced"));
      } else {
        const cloudChanged = cloud.updatedAt !== store.lastSyncAt;
        if (!cloudChanged && !localChanged) { if (!silent) msg(t("cloud.synced")); }
        else if (!cloudChanged) await push(false, silent);
        else if (!localChanged) applyRemote(cloud);
        else if (silent) { pending = true; msg(t("cloud.pending")); }
        else ask(cloud);
      }
    } finally {
      busy = false;
    }
  }

  // chamado a cada saveState(): envia sozinho, sem incomodar, alguns segundos depois da última mudança
  function touch() {
    if (!online || !store.token || applying || pending) return;
    clearTimeout(timer);
    timer = setTimeout(() => { if (hash(localJson()) !== store.lastHash) push(false, true); }, 5000);
  }

  // ------------------------------------------------------------ conta
  async function enter(kind) {
    const name = $("cloud-name").value.trim(), password = $("cloud-pass").value;
    msg(t("cloud.busy"));
    const r = await api("POST", kind, { name, password });
    if (r.status !== 200) { msg(errText(r, kind)); return; }
    store = { token: r.json.token, name: r.json.name, lastSyncAt: 0, lastHash: "" };
    persist();
    $("cloud-pass").value = "";
    render();
    await sync(false);
  }

  async function logout() {
    await api("POST", "logout", {});
    forget();
    msg("");
  }

  // ------------------------------------------------------------ ranking
  async function showRanking() {
    const list = $("ranking-list"), me = $("ranking-me");
    list.textContent = "";
    me.classList.add("hidden");
    $("ranking-help").textContent = t("ranking.help") + (store.token ? "" : " " + t("ranking.login"));
    openModal("ranking-modal");
    const r = await api("GET", "ranking?limit=20");
    if (r.status !== 200) { list.appendChild(el("li", "ranking-empty", t("ranking.err"))); return; }
    if (!r.json.ranking.length) list.appendChild(el("li", "ranking-empty", t("ranking.empty")));
    r.json.ranking.forEach((row) => {
      const li = el("li", "ranking-row" + (store.token && row.name === store.name ? " mine" : ""));
      li.appendChild(el("span", "ranking-pos", String(row.rank)));
      li.appendChild(el("span", "ranking-name", row.name));
      li.appendChild(el("span", "ranking-pts", t("ranking.row", { stars: row.stars, score: row.score })));
      list.appendChild(li);
    });
    if (store.token) {
      const mine = await api("GET", "ranking?limit=1");
      if (mine.json.me && mine.json.me.rank > r.json.ranking.length) {
        me.textContent = t("ranking.me", { rank: mine.json.me.rank, score: mine.json.me.score });
        me.classList.remove("hidden");
      }
    }
  }

  async function init() {
    $("cloud-login").addEventListener("click", () => enter("login"));
    $("cloud-register").addEventListener("click", () => enter("register"));
    $("cloud-sync").addEventListener("click", () => sync(false));
    $("cloud-logout").addEventListener("click", logout);
    $("cloud-ranking").addEventListener("click", showRanking);
    if (!/^https?:$/.test(location.protocol)) return;
    const ping = await api("GET", "ping");
    online = ping.status === 200 && ping.json.app === "neurosim";
    render();
    if (online && store.token) sync(true);
  }

  window.Cloud = { init, touch, showRanking, sync: () => sync(false) };
  I18N.onChange(render);
})();

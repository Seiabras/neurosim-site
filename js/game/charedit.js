"use strict";

// ===========================================================================
// Editor da personagem: clicar no ícone dela no topo abre a mesma tela de aparência da criação (retrato 2D e boneco 3D
// lado a lado), agora sobre o jogo em andamento. O formulário é o mesmo: ele é levado para dentro do modal e devolvido
// à tela de criação ao fechar, então não há duas cópias para manter.
// ===========================================================================
const CharEdit = (() => {
  let snap = null, open = false;
  const FIELDS = ["name", "gender", "skin", "hairStyle", "hairColor", "eyeColor", "eyeShape", "brow", "mouth", "face", "freckles", "top", "art"];

  function grid() { return document.querySelector("#screen-create .create-grid, #char-host .create-grid"); }

  function show() {
    if (!state.player || open) return;
    if (["title", "create", "intro"].includes(screen)) return;
    if (screen === "consult" || (typeof session !== "undefined" && session)) { showToast(t("char.busy")); return; }
    open = true; editingChar = true;
    snap = window.Scene3D ? Scene3D.snapshot() : null;
    createDraft = Object.assign(newDraft(), state.player);
    $("char-host").appendChild(grid());
    openModal("char-modal");
    renderCreate();
  }

  function restoreScene() {
    if (!snap || !window.Scene3D) return;
    const sn = snap; snap = null;
    if (sn.opts && sn.opts.player) sn.opts = Object.assign({}, sn.opts, { player: playerLook() });   // já com o visual novo
    Scene3D.restore(sn);
  }

  function close(save) {
    if (!open) return;
    open = false; editingChar = false;
    const g = grid();
    if (save) {
      const d = createDraft;
      FIELDS.forEach((k) => { if (d[k] !== undefined) state.player[k] = d[k]; });
      state.player.name = (d.name || "").trim() || state.player.name;
      hudAvatarKey = ""; saveState(); updateHud(); rebuildContent && rebuildContent();
      showToast(t("char.saved")); sfx("levelup");
    }
    if (g) document.querySelector("#screen-create .create-card").insertBefore(g, document.querySelector("#screen-create .home-actions"));
    createDraft = null;
    closeModal("char-modal");
    if (window.Scene3D) { const c = $("create-3d"); Scene3D.unmount(c); }
    restoreScene();
    if (typeof screen !== "undefined") { try { if (screen === "shop") renderShop(); else if (screen === "home") renderHome(); } catch (e) { /* tela sem esse desenho */ } }
  }

  function init() {
    const hp = $("hud-player");
    hp.addEventListener("click", show);
    hp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(); } });
    $("char-save").addEventListener("click", () => close(true));
    $("char-cancel").addEventListener("click", () => close(false));
    $("char-close").addEventListener("click", () => close(false));
  }
  return { init, show, close, get isOpen() { return open; } };
})();
window.CharEdit = CharEdit;

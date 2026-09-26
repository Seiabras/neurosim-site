"use strict";

// ===========================================================================
// Organizar a sala: escolha onde cada móvel fica (arraste na planta), gire e restaure.
// A planta vem do próprio 3D (Scene3D.layoutInfo): o contorno de cada peça é o da malha real, então o que
// vale aqui é o que a psicóloga e os bichinhos respeitam lá dentro. Uma peça só fica onde couber sem tocar em
// nada, dentro do cômodo e sem trancar o caminho. O jogador guarda { x, z, yaw } em state.layout[área][id].
// ===========================================================================
const Decor = (() => {
  const L = window.L;
  const AREAS = [
    { id: "consultorio", scene: "room" },
    { id: "espera", scene: "room", needs: "exp-espera" },
    { id: "casa", scene: "casa" }
  ];
  let area = "consultorio", info = null, sel = null, drag = null, hover = null, msg = "", msgBad = false, canvas = null, view = null;
  const RADIUS = 0.28;                                  // "folga" da psicóloga (raio do corpo) ao contornar móveis

  const areaOk = (a) => !a.needs || Boolean(state.expansions[a.needs]);
  // Os móveis que já vêm com a sala não estão em loja nenhuma, e por isso não tinham nome aqui.
  // Agora eles entram na planta como qualquer outro: a poltrona do paciente é o móvel mais importante
  // do consultório, e era o único que não se podia mudar de lugar.
  const BASE_MOV = {
    "base-poltrona-psi": { emoji: "🪑", nome: L("Sua poltrona", "Your armchair", "Tu sillón") },
    "base-poltrona-paciente": { emoji: "🪑", nome: L("Poltrona do paciente", "Patient's armchair", "Sillón del paciente") },
    "base-poltrona-acompanhante": { emoji: "🪑", nome: L("Poltrona do acompanhante", "Companion's armchair", "Sillón del acompañante") },
    "base-mesinha": { emoji: "🪵", nome: L("Mesinha de centro", "Coffee table", "Mesita de centro") },
    "base-diva": { emoji: "🛋️", nome: L("Divã", "Couch", "Diván") }
  };
  const itemLabel = (id) => { const it = itemById(id); if (it) return it.name; const b = BASE_MOV[id]; return b ? I18N.pick(b.nome) : id; };
  // ícone 3D da peça (o mesmo modelo da sala), ainda como imagem em cache; sem 3D, cai no emoji
  const iconImgs = {};
  const iconImg = (id) => {
    if (iconImgs[id] !== undefined) return iconImgs[id];
    const src = window.Scene3D && Scene3D.icon && use3D() ? Scene3D.icon(id) : null;
    if (!src) return (iconImgs[id] = null);
    const im = new Image(); im.onload = () => { if (typeof draw === "function") try { draw(); } catch (e) { /* editor fechado */ } }; im.src = src;
    return (iconImgs[id] = im);
  };
  const itemEmoji = (id) => { const it = itemById(id); if (it && it.emoji) return it.emoji; const b = BASE_MOV[id]; return b ? b.emoji : "▪"; };
  const tr3 = (pt, en, es) => I18N.pick(window.L(pt, en, es));
  const mine = () => (info ? info.items.filter((i) => i.area === area) : []);
  const bounds = () => (info && info.bounds[area]) || { x0: -5, x1: 5, z0: -3, z1: 3 };
  const halfExt = (it, yaw) => (Math.abs(Math.sin(yaw)) > 0.7 ? [it.hd, it.hw] : [it.hw, it.hd]);
  const rectOf = (it, cx, cz, yaw) => { const [hw, hd] = halfExt(it, yaw); return { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd }; };
  // 0,06 e não 0,04: a colocação automática (scene3d: autoPlace/spreadClear) encosta peças com até
  // 0,05 de folga, e com a tolerância daqui em 0,04 o editor recusava mexer justamente no móvel que o
  // jogo tinha acabado de pôr ali — "encosta em outro móvel" numa peça que ninguém encostou.
  const overlaps = (a, b, m = 0.06) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > m && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > m;

  // ---- 3D: monta a sala da área e lê a planta
  function mountScene() {
    const a = AREAS.find((x) => x.id === area);
    renderRoom($("decor-3d"), Object.assign(scenePlace(area), { scene: a.scene, camera: "wide", base: true, parent: area === "consultorio", drag: true, focus: area }));
    info = use3D() && window.Scene3D ? window.Scene3D.layoutInfo() : null;
    if (info && sel && !info.items.some((i) => i.id === sel)) sel = null;
  }

  // ---- regras de posição
  function check(it, cx, cz, yaw, skip) {
    const B = bounds();
    if (it.mov === "wall") {
      const [hw] = halfExt(it, 0), w = info.wall;
      if (cx - hw < w.x0 - 1e-6 || cx + hw > w.x1 + 1e-6) return t("decor.bad.bounds");
      const me = { x0: cx - hw, x1: cx + hw };
      const clash = mine().find((o) => o.id !== it.id && o.mov === "wall" && Math.min(me.x1, o.cx + o.hw) - Math.max(me.x0, o.cx - o.hw) > 0.05);
      return clash ? t("decor.bad.wall") : null;
    }
    const r = rectOf(it, cx, cz, yaw);
    if (r.x0 < B.x0 - 1e-6 || r.x1 > B.x1 + 1e-6 || r.z0 < B.z0 - 1e-6 || r.z1 > B.z1 + 1e-6) return t("decor.bad.bounds");
    if (!it.blocks) return null;
    const others = mine().filter((o) => o.id !== it.id && o.id !== skip && o.blocks && o.mov === "floor").map((o) => rectOf(o, o.cx, o.cz, o.yaw));
    const fixed = info.fixed.filter((f) => f.x1 > B.x0 && f.x0 < B.x1 && f.z1 > B.z0 && f.z0 < B.z1);
    if (others.concat(fixed).some((o) => overlaps(r, o))) return t("decor.bad.overlap");
    return blocksPath(it, r, B, skip) ? t("decor.bad.path") : null;
  }

  // o cômodo precisa continuar "de uma peça só": nada fica trancado atrás de móveis
  function blocksPath(it, r, B, skip) {
    const step = 0.25, nx = Math.ceil((B.x1 - B.x0) / step), nz = Math.ceil((B.z1 - B.z0) / step);
    const rects = mine().filter((o) => o.id !== it.id && o.id !== skip && o.blocks && o.mov === "floor").map((o) => rectOf(o, o.cx, o.cz, o.yaw)).concat(info.fixed.filter((f) => f.x1 > B.x0 && f.x0 < B.x1).map((f) => ({ x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1 })), [r]);
    const blocked = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = B.x0 + (i + 0.5) * step, z = B.z0 + (j + 0.5) * step;
      if (rects.some((q) => x > q.x0 - RADIUS && x < q.x1 + RADIUS && z > q.z0 - RADIUS && z < q.z1 + RADIUS)) blocked[i * nz + j] = 1;
    }
    let start = -1;
    for (let j = nz - 1; j >= 0 && start < 0; j--) for (let i = 0; i < nx; i++) if (!blocked[i * nz + j]) { start = i * nz + j; break; }
    if (start < 0) return true;
    const seen = new Uint8Array(nx * nz), q = [start]; seen[start] = 1; let reach = 0, free = 0;
    for (let k = 0; k < blocked.length; k++) if (!blocked[k]) free++;
    while (q.length) {
      const c = q.pop(); reach++;
      const i = Math.floor(c / nz), j = c % nz;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) return; const n = a * nz + b; if (!blocked[n] && !seen[n]) { seen[n] = 1; q.push(n); } });
    }
    return reach < free * 0.9;                      // uma parte grande do chão ficou isolada
  }

  // ---- gravar
  function commit(it, cx, cz, yaw) {
    state.layout = state.layout || {};
    const key = it.area;
    state.layout[key] = state.layout[key] || {};
    state.layout[key][it.id] = it.mov === "wall" ? { x: round(cx) } : { x: round(cx), z: round(cz), yaw: round(yaw) };
    // itens da decoração sazonal guardam junto do consultório (é a mesma sala)
    saveState();
    mountScene();
  }
  const round = (v) => Math.round(v * 100) / 100;

  function say(text, bad) { msg = text; msgBad = Boolean(bad); const m = $("decor-msg"); if (m) { m.textContent = text; m.classList.toggle("bad", msgBad); } }

  // ---- desenho da planta
  const HUES = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360; return h; };
  function layoutView() {
    const B = bounds(), wrap = canvas.parentElement, cw = Math.max(260, wrap.clientWidth - 4);
    const m = 26, bw = B.x1 - B.x0, bh = B.z1 - B.z0, scale = (cw - m * 2) / bw, ch = Math.round(bh * scale + m * 2 + 24);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = cw * dpr; canvas.height = ch * dpr; canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
    view = { B, m, scale, cw, ch, dpr, oy: m + 24 };
  }
  const toPx = (x, z) => [view.m + (x - view.B.x0) * view.scale, view.oy + (z - view.B.z0) * view.scale];
  const toWorld = (px, py) => [view.B.x0 + (px - view.m) / view.scale, view.B.z0 + (py - view.oy) / view.scale];

  function draw() {
    if (!canvas || !info) return;
    layoutView();
    const c = canvas.getContext("2d"), { B, dpr, cw, ch } = view;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, ch);
    // parede de fundo (faixa) e chão
    const [fx0, fy0] = toPx(B.x0, B.z0), [fx1, fy1] = toPx(B.x1, B.z1);
    c.fillStyle = "#e9d3b0"; c.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    c.strokeStyle = "rgba(90,60,30,0.16)"; c.lineWidth = 1;
    for (let x = Math.ceil(B.x0); x < B.x1; x++) { const [px] = toPx(x, 0); c.beginPath(); c.moveTo(px, fy0); c.lineTo(px, fy1); c.stroke(); }
    for (let z = Math.ceil(B.z0); z < B.z1; z++) { const [, py] = toPx(0, z); c.beginPath(); c.moveTo(fx0, py); c.lineTo(fx1, py); c.stroke(); }
    c.fillStyle = "#c9b48f"; c.fillRect(fx0, view.m - 2, fx1 - fx0, fy0 - view.m + 2);
    c.fillStyle = "#15131f"; c.font = "bold 11px system-ui"; c.textAlign = "left"; c.fillText("▲ " + t("decor.wall"), fx0 + 6, view.m + 14);
    c.strokeStyle = "#15131f"; c.lineWidth = 3; c.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    // móveis fixos (poltronas, mesa, cama…)
    info.fixed.forEach((f) => {
      if (f.x1 < B.x0 || f.x0 > B.x1 || f.z1 < B.z0 || f.z0 > B.z1) return;
      const [a, b] = toPx(f.x0, f.z0), [d, e] = toPx(f.x1, f.z1);
      c.fillStyle = "rgba(60,60,80,0.35)"; c.strokeStyle = "rgba(21,19,31,0.5)"; c.lineWidth = 1.5; c.fillRect(a, b, d - a, e - b); c.strokeRect(a, b, d - a, e - b);
    });
    // itens
    mine().forEach((it) => {
      const on = drag && drag.it.id === it.id, cx = on ? drag.cx : it.cx, cz = on ? drag.cz : it.cz, yaw = on ? drag.yaw : it.yaw;
      let x0, y0, w, h;
      if (it.mov === "wall") { const [a] = toPx(cx - it.hw, 0), [d] = toPx(cx + it.hw, 0); x0 = a; w = d - a; y0 = view.m + 2; h = 20; }
      else { const r = rectOf(it, cx, cz, yaw), [a, b] = toPx(r.x0, r.z0), [d, e] = toPx(r.x1, r.z1); x0 = a; y0 = b; w = d - a; h = e - b; }
      const bad = on && drag.err;
      c.fillStyle = bad ? "rgba(217,83,79,0.75)" : `hsla(${HUES(it.id)},60%,72%,${it.blocks ? 0.95 : 0.7})`;
      c.strokeStyle = sel === it.id ? "#ff477e" : "#15131f"; c.lineWidth = sel === it.id ? 3.5 : 2;
      rr(c, x0, y0, w, h, 6); c.fill(); c.stroke();
      if (h > 14 && w > 16) { c.font = `${Math.max(12, Math.min(26, Math.min(w, h) * 0.6))}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#15131f"; const im = iconImg(it.id); if (im && im.complete && im.naturalWidth) { const q = Math.min(w, h) - 4; c.drawImage(im, x0 + w / 2 - q / 2, y0 + h / 2 - q / 2, q, q); } else c.fillText(itemEmoji(it.id), x0 + w / 2, y0 + h / 2 + 1); c.textBaseline = "alphabetic"; }
    });
    // pontos da frente
    c.fillStyle = "rgba(21,19,31,0.55)"; c.font = "11px system-ui"; c.textAlign = "center"; c.fillText("▼ " + t("decor.front"), (fx0 + fx1) / 2, fy1 + 15);
  }
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ---- entrada (mouse e toque)
  function hit(px, py) {
    const [wx, wz] = toWorld(px, py), list = mine().slice().reverse();
    return list.find((it) => {
      if (it.mov === "wall") return py < view.m + 24 && Math.abs(wx - it.cx) <= it.hw;
      const r = rectOf(it, it.cx, it.cz, it.yaw); return wx >= r.x0 - 0.1 && wx <= r.x1 + 0.1 && wz >= r.z0 - 0.1 && wz <= r.z1 + 0.1;
    });
  }
  const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  function down(e) {
    const [px, py] = local(e), it = hit(px, py);
    if (!it) { sel = null; renderTools(); draw(); return; }
    e.preventDefault();
    sel = it.id;
    const [wx, wz] = toWorld(px, py);
    drag = { it, ox: it.cx - wx, oz: it.cz - wz, cx: it.cx, cz: it.cz, yaw: it.yaw, err: null, moved: false };
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    renderTools(); draw();
  }
  function move(e) {
    if (!drag) return;
    const [px, py] = local(e), [wx, wz] = toWorld(px, py);
    drag.moved = true;
    const snap = (v) => Math.round(v * 10) / 10;
    drag.cx = snap(wx + drag.ox); drag.cz = drag.it.mov === "wall" ? drag.it.cz : snap(wz + drag.oz);
    drag.err = check(drag.it, drag.cx, drag.cz, drag.yaw);
    say(drag.err || t("decor.ok"), Boolean(drag.err));
    draw();
  }
  function up() {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved) {
      if (d.err && trySwap(d)) { render(); return; }
      if (d.err) { say(d.err, true); sfx("deny"); if (typeof flashDeny === "function") flashDeny(); draw(); return; }
      commit(d.it, d.cx, d.cz, d.yaw); sfx("equip"); say(t("decor.saved"), false);
    }
    render();
  }

  // soltar um móvel em cima de outro troca os dois de lugar (se os dois couberem nos lugares novos)
  function trySwap(d) {
    const it = d.it; if (it.mov !== "floor" || !it.blocks) return false;
    const r = rectOf(it, d.cx, d.cz, d.yaw);
    const hit = mine().filter((o) => o.id !== it.id && o.blocks && o.mov === "floor").map((o) => ({ o, ov: Math.max(0, Math.min(r.x1, rectOf(o, o.cx, o.cz, o.yaw).x1) - Math.max(r.x0, rectOf(o, o.cx, o.cz, o.yaw).x0)) * Math.max(0, Math.min(r.z1, rectOf(o, o.cx, o.cz, o.yaw).z1) - Math.max(r.z0, rectOf(o, o.cx, o.cz, o.yaw).z0)) })).filter((x) => x.ov > 0.02).sort((a, b) => b.ov - a.ov)[0];
    if (!hit) return false;
    const other = hit.o;
    if (check(it, other.cx, other.cz, it.yaw, other.id) || check(other, it.cx, it.cz, other.yaw, it.id)) return false;   // um dos dois não cabe no lugar do outro
    state.layout = state.layout || {};
    const put = (m, x, z, yaw) => { state.layout[m.area] = state.layout[m.area] || {}; state.layout[m.area][m.id] = { x: round(x), z: round(z), yaw: round(yaw) }; };
    put(it, other.cx, other.cz, it.yaw); put(other, it.cx, it.cz, other.yaw);
    saveState(); mountScene(); sfx("equip"); say(t("decor.swapped"), false);
    return true;
  }

  function rotateSel() {
    const it = mine().find((i) => i.id === sel);
    if (!it || it.mov === "wall") return;
    const yaw = it.yaw + Math.PI / 2, err = check(it, it.cx, it.cz, yaw);
    if (err) { say(err, true); sfx("deny"); if (typeof flashDeny === "function") flashDeny(); return; }
    commit(it, it.cx, it.cz, yaw); sfx("equip"); say(t("decor.saved"), false); render();
  }
  function resetSel() {
    const it = mine().find((i) => i.id === sel);
    if (!it || !state.layout[it.area] || !state.layout[it.area][it.id]) return;
    delete state.layout[it.area][it.id]; saveState(); mountScene(); say(t("decor.reset.done"), false); render();
  }
  function resetAll() {
    if (!state.layout[area] || !Object.keys(state.layout[area]).length) return;
    if (!confirm(t("decor.resetall.confirm"))) return;
    delete state.layout[area]; saveState(); mountScene(); say(t("decor.reset.done"), false); render();
  }

  // ---- interface
  function renderTabs() {
    const box = $("decor-tabs"); box.textContent = "";
    AREAS.filter(areaOk).forEach((a) => {
      const def = SHOP.areas.find((x) => x.id === a.id);
      const b = el("button", "shop-tab" + (a.id === area ? " active" : ""), `${def.icon} ${def.name}`);
      b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(a.id === area));
      b.addEventListener("click", () => { area = a.id; sel = null; say("", false); mountScene(); render(); });
      box.appendChild(b);
    });
  }
  function renderTools() {
    const it = mine().find((i) => i.id === sel);
    $("decor-sel").textContent = it ? `${itemEmoji(it.id)} ${itemLabel(it.id)}` : t("decor.pick");
    $("decor-rot").disabled = !it || it.mov === "wall";
    $("decor-reset").disabled = !it || !(state.layout[it.area] && state.layout[it.area][it.id]);
    const chips = $("decor-chips"); chips.textContent = "";
    mine().forEach((i) => {
      const b = el("button", "decor-chip" + (i.id === sel ? " on" : ""), "");
      const ic = iconImg(i.id);
      if (ic && ic.src) { const im = el("img", "decor-chip-ic"); im.src = ic.src; im.alt = ""; b.appendChild(im); b.appendChild(document.createTextNode(` ${itemLabel(i.id)}`)); } else b.textContent = `${itemEmoji(i.id)} ${itemLabel(i.id)}`;
      b.type = "button"; b.addEventListener("click", () => { sel = i.id; renderTools(); draw(); });
      chips.appendChild(b);
    });
    if (!mine().length) chips.appendChild(el("p", "shop-note", tr3("Você ainda não tem móveis nesta sala. Compre nas lojas espalhadas pela cidade: cada uma vende peças diferentes.", "You have no furniture in this room yet. Buy from the shops around town: each sells different pieces.", "Aún no tienes muebles en esta sala. Compra en las tiendas de la ciudad: cada una vende piezas distintas.")));
    if (info && info.notPlaced && info.notPlaced.length) chips.appendChild(el("p", "shop-note bad", t("decor.noplace", { names: info.notPlaced.map(itemLabel).join(", ") })));
    renderAcabamentos(chips);
  }
  // AVISO DE ASSENTO. Mover a poltrona do paciente é mover a consulta: longe demais e vocês não se
  // escutam, colados demais e ninguém respira, de costas e não existe consulta nenhuma. O jogo não
  // impede — a sala é sua —, mas diz o que aquele arranjo faz com a sessão.
  function avisoAssento() {
    if (area !== "consultorio" || !info) return null;
    const achar = (id) => mine().find((i) => i.id === id);
    const A = achar("base-poltrona-psi"), B = achar("base-poltrona-paciente");
    if (!A || !B) return tr3("Não há poltrona para o paciente: sem assento não há consulta.", "There is no armchair for the patient: without a seat there is no session.", "No hay sillón para el paciente: sin asiento no hay consulta.");
    const dx = B.cx - A.cx, dz = B.cz - A.cz, d = Math.hypot(dx, dz);
    if (d > 4.2) return tr3("Vocês ficaram longe demais um do outro: a {m} m de distância a consulta vira uma conversa gritada.", "You ended up too far apart: at {m} m a session becomes a shouted conversation.", "Quedaron demasiado lejos: a {m} m la consulta se vuelve una conversación a gritos.").replace("{m}", d.toFixed(1));
    if (d < 1.15) return tr3("As poltronas ficaram coladas ({m} m). Perto demais tira do paciente o espaço de se mexer sem esbarrar em você.", "The armchairs ended up touching ({m} m). Too close takes from the patient the room to shift without bumping into you.", "Los sillones quedaron pegados ({m} m). Demasiado cerca le quita al paciente el espacio para moverse sin chocar contigo.").replace("{m}", d.toFixed(1));
    const olha = (c, ox, oz) => (Math.sin(c.yaw) * ox + Math.cos(c.yaw) * oz) / Math.max(0.001, Math.hypot(ox, oz));
    if (olha(A, dx, dz) < 0.05) return tr3("A sua poltrona ficou de costas para o paciente.", "Your armchair ended up with its back to the patient.", "Tu sillón quedó de espaldas al paciente.");
    if (olha(B, -dx, -dz) < 0.05) return tr3("A poltrona do paciente ficou de costas para você.", "The patient's armchair ended up with its back to you.", "El sillón del paciente quedó de espaldas a ti.");
    return null;
  }

  // ACABAMENTOS: o mesmo móvel em outro tecido. Só vale para os móveis de fábrica — os comprados já
  // vêm na cor em que foram comprados.
  function renderAcabamentos(box) {
    const it = mine().find((i) => i.id === sel);
    const cores = (window.Scene3D && Scene3D.ACABAMENTOS) || null;
    if (!it || !cores || !BASE_MOV[it.id] || it.id === "base-mesinha") return;
    state.acabamento = state.acabamento || {};
    const linha = el("div", "decor-acab");
    linha.appendChild(el("span", "decor-acab-rot", tr3("Acabamento", "Finish", "Acabado")));
    const PADRAO = { "base-poltrona-psi": "terracota", "base-poltrona-paciente": "azul", "base-poltrona-acompanhante": "mostarda", "base-diva": "musgo" };
    const atual = state.acabamento[it.id] || PADRAO[it.id];
    Object.keys(cores).forEach((nome) => {
      const b = el("button", "decor-cor" + (nome === atual ? " on" : ""), "");
      b.type = "button";
      b.style.background = "#" + cores[nome].toString(16).padStart(6, "0");
      b.setAttribute("aria-label", nome);
      b.title = nome;
      b.addEventListener("click", () => {
        if (nome === PADRAO[it.id]) delete state.acabamento[it.id]; else state.acabamento[it.id] = nome;
        saveState(); mountScene(); sfx("equip"); render();
      });
      linha.appendChild(b);
    });
    box.appendChild(linha);
  }

  function render() {
    renderTabs(); renderTools(); draw();
    const av = avisoAssento();
    const box = $("decor-aviso");
    if (box) { box.textContent = av || ""; box.classList.toggle("hidden", !av); }
  }

  function open(startArea) {
    if (!use3D()) { showToast(t("decor.need3d")); return; }
    area = startArea && AREAS.find((a) => a.id === startArea && areaOk(a)) ? startArea : "consultorio";
    sel = null; drag = null; msg = "";
    openModal("decor-modal");
    mountScene(); say(t("decor.help.short") + " " + t("decor.swaphint"), false); render();
    setTimeout(() => { if (window.Tutor) Tutor.topic("decor", [{ key: "decor1", target: "decor-plan" }, { key: "decor2", target: "decor-rot" }]); }, 700);
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("movelbase"), 500);
  }
  function close() { closeModal("decor-modal"); if (typeof screen !== "undefined" && screen === "shop" && typeof renderShop === "function") renderShop(); }

  function init() {
    canvas = $("decor-plan");
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", () => { drag = null; draw(); });
    $("decor-rot").addEventListener("click", rotateSel);
    $("decor-reset").addEventListener("click", resetSel);
    $("decor-resetall").addEventListener("click", resetAll);
    $("decor-done").addEventListener("click", close);
    document.querySelectorAll('[data-close="decor-modal"]').forEach((b) => b.addEventListener("click", () => { if (typeof renderShop === "function" && screen === "shop") setTimeout(renderShop, 0); }));
    window.addEventListener("keydown", (e) => { if ($("decor-modal").classList.contains("hidden")) return; if (e.key === "r" || e.key === "R") rotateSel(); });
    window.addEventListener("resize", () => { if (!$("decor-modal").classList.contains("hidden")) draw(); });
  }

  return {
    open, init, close,
    // para os testes: tenta mover um item e devolve o erro (ou null); e lê a planta atual
    _try(id, x, z, yaw) { const it = info && info.items.find((i) => i.id === id); if (!it) return "sem item"; const err = check(it, x, z, yaw === undefined ? it.yaw : yaw); if (!err) commit(it, x, z, yaw === undefined ? it.yaw : yaw); return err; },
    _swap(a, b) { const i = info.items.find((x) => x.id === a), o = info.items.find((x) => x.id === b); return i && o ? trySwap({ it: i, cx: o.cx, cz: o.cz, yaw: i.yaw }) : false; },
    _check(id, x, z, yaw) { const it = info && info.items.find((i) => i.id === id); return it ? check(it, x, z, yaw === undefined ? it.yaw : yaw) : "sem item"; },
    _client(x, z) { const r = canvas.getBoundingClientRect(), [px, py] = toPx(x, z); return { x: r.left + px, y: r.top + py }; },
    _info: () => info, _mount(a) { area = a || area; mountScene(); return info; }
  };
})();

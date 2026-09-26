"use strict";

// Mundo do jogo: um MAPA (estilo Club Penguin) com vários locais clicáveis. Ao clicar, o carro leva você até lá e
// você passeia pelo local por dentro ou por fora. No computador: WASD ou setas (Shift corre, E ou Enter interage);
// no celular e no tablet: joystick de bolinha. Os locais, interiores e NPCs vêm de content/world.json.
//
// MAPA DO ARQUIVO (7.11) — 2.280 linhas, e por isso este índice. Procure pela marca de seção:
//   "estado" · "movimento" · "andar clicando" · "interação" · "cidade viva: pedestres com rotina"
//   "universidade" · "hospital" · "entrar e sair dos locais" · "mapa" · "dirigir no mapa"
//   "desenho" · "texturas do chão" · "renderizador PixiJS"
// O trânsito (carros, atropelamento, faixas) vive entre `montarTransito` e `desenharCarro`.
//
// REGRA para quem for mexer: sistema novo da cidade nasce em ARQUIVO PRÓPRIO (como city-art.js,
// fauna.js, nature.js, town.js). Este arquivo já concentra render, colisão, rota e regra — foi daqui
// que saíram quase todos os bugs visuais da 7.0 → 7.1. Não acrescente mais um sistema aqui dentro.
const City = (function () {
  const tx = (o) => I18N.pick(o);
  const R = 17;                       // raio do personagem
  const WALK = 190, RUN = 300;        // pixels por segundo
  const WALL_H = 170;                 // altura da parede nos interiores
  const STORE_TAB = { decor: "consultorio", musica: "consultorio", jardim: "consultorio", livraria: "consultorio", atelie: "consultorio", antiquario: "consultorio", brinquedos: "consultorio" };
  // deslocamento: a pé, de bicicleta (mais rápida e conta como exercício) ou de carro (rápido, sem exercício); dentro dos prédios sempre a pé
  const MODES = ["walk", "bike", "car"], MODE_ICON = { walk: "🚶", bike: "🚲", car: "🚗" }, MODE_SPEED = { walk: 1, bike: 1.65, car: 2.5 }, MODE_MOVE = { walk: 1, bike: 2, car: 0 };
  // Onde cada jeito de andar faz sentido (5.4). Antes, carro e bicicleta valiam em qualquer lugar
  // aberto: dava para atravessar a praia de carro e pedalar dentro da fenda do fundo do mar.
  //  · carro      — só nas ruas, que são as únicas com asfalto;
  //  · bicicleta  — ao ar livre em terra firme (rua, praça, parque, bairro), não na areia nem na água;
  //  · a pé       — em todo lugar, sempre.
  function modoPermitido(l, m) {
    if (m === "walk" || !l) return true;
    if (l.kind === "indoor") return false;
    // "lugar de água" é o que É água (fundo do mar, travessia de barco) — ter um lago dentro não conta,
    // senão o parque, que é o melhor lugar da cidade para pedalar, ficava proibido
    const agua = Boolean(l.theme && (l.theme.underwater || l.theme.boat));
    if (m === "car") return Boolean(l.street);
    if (m === "bike") return !agua && l.id !== "praia";   // areia não é para bicicleta
    return true;
  }
  const modeNow = () => {
    const m = (state.city && state.city.mode) || "walk";
    return modoPermitido(loc, m) ? m : "walk";
  };
  // movimento do dia: 1 ponto a cada 100 px a pé (2 de bicicleta, 0 de carro); a cada 30 pontos a saúde sobe um pouco (até 6 por dia)
  function moveHealth(px100) {
    const a = state.act = state.act && state.act.day === state.dayIndex ? state.act : { day: state.dayIndex, pts: 0, gained: 0 };
    a.pts += px100;
    while (a.pts >= (a.gained + 1) * 30 && a.gained < 6) { a.gained++; state.health = clamp((state.health === undefined ? 50 : state.health) + 1, 0, 100); }
  }
  function refreshModeBtn() {
    const b = $("city-mode"); if (!b) return;
    const m = modeNow(); b.textContent = MODE_ICON[m];
    // o botão some onde só dá para andar a pé: não adianta oferecer o que o lugar não aceita
    const soAPe = MODES.filter((x) => modoPermitido(loc, x)).length <= 1;
    b.classList.toggle("hidden", Boolean(loc && (loc.kind === "indoor" || soAPe)));
    b.title = t("city.mode." + m);
  }

  const world = () => window.WORLD_DATA;
  const locById = (id) => world().locations.find((l) => l.id === id);

  // horário de funcionamento: "hours": ["09:00", "19:00"]; sem "hours" o lugar não fecha (posto, hospital, ruas…)
  const hm = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
  function locOpen(l, minutes) {
    if (!l || !l.hours) return true;
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return m >= hm(l.hours[0]) && m < hm(l.hours[1]);
  }
  // personagens que só aparecem em certo horário (ex.: Sandman, à noite): "hours": ["20:00","23:59"]
  const npcHere = (n) => !n.hours || (() => { const m = state.clock === undefined ? DAY_START : state.clock; return m >= hm(n.hours[0]) && m < hm(n.hours[1]); })();
  const closedText = (l) => t("city.closed", { name: tx(l.name), open: l.hours[0], close: l.hours[1] });
  const npcDef = (id) => world().npcs.find((n) => n.id === id);

  // ---------------------------------------------------------------- estado
  let canvas, ctx, raf = 0, last = 0, running = false;
  let loc = null;                                    // local em que você está
  let px = 0, py = 0, facing = 1, moving = false;
  let frameDt = 0.016, pixiSnap = true;               // dt do quadro e pedido de "pular" a câmera (troca de lugar)
  const keys = new Set();
  const joy = { x: 0, y: 0, active: false };
  let near = null;                                   // { kind: "station"|"npc"|"house", ref }
  let trail = [];                                    // rastro do jogador (os bichos seguem)
  let npcs = [];
  // TRÂNSITO. Os carros eram adereços parados num asfalto com faixa central: uma rua desenhada, não uma
  // rua. Agora andam de verdade, em duas mãos, e quem está no meio da pista leva. Os pedestres veem o
  // carro chegar e saem da frente — é o que faz a rua parecer viva em vez de perigosa por acidente.
  let carros = [];
  let batidaEm = 0;                      // instante da última batida: não dá para levar duas em sequência
  const CARRO_DANO = 6, CARRO_ESPERA = 2.5, CARRO_L = 132, CARRO_A = 58;
  const CARRO_CORES = ["#d9453a", "#3f7fc4", "#e8a33a", "#4f9a6a", "#8f6ad9", "#d9d2c4", "#2f8f9a", "#c4577f"];
  const NPC_COLADO = 56;                            // colado na pessoa: falar ganha de qualquer porta ou objeto
  let falante = null;                                // de quem é o retrato que aparece na caixa de conversa
  let talkingTo = null;                              // quem está conversando com você fica parado, virado para você
  const imgCache = {};
  let toastTimer = null, helpTimer = null;
  let mapFrom = null, travelling = false;
  // mistura duas cores hex, com peso 0..1 na segunda: usada para a cor da estação entrar no chão
  // devolve SEMPRE #rrggbb: é a forma que as texturas, o minimapa e o desenho dos objetos esperam
  function misturarCor(a2, b2, k) {
    try {
      const [r1, g1, b1] = corRGB(a2), [r2, g2, b2v] = corRGB(b2);
      const m = (x, y) => Math.max(0, Math.min(255, Math.round(x + (y - x) * k)));
      const h2 = (v) => v.toString(16).padStart(2, "0");
      return `#${h2(m(r1, r2))}${h2(m(g1, g2))}${h2(m(b1, b2v))}`;
    } catch (e) { return a2; }
  }

  let path = [], goal = null;                        // andar clicando: rota (A*) e destino (com o que fazer ao chegar)
  const view = { zoom: 1, camX: 0, camY: 0 };       // como o mundo aparece na tela (para converter o clique)
  let mapPos = { x: 50, y: 50 }, mapRaf = 0, mapLast = 0, mapNear = null;   // o carro do mapa se dirige com teclas ou joystick
  const mjoy = { x: 0, y: 0, active: false };
  let cameFrom = null;                               // { x, y }: entrou num prédio pela rua; sair leva de volta à mesma porta

  const cityState = () => {
    state.city = state.city || {};
    state.city.visited = state.city.visited || {};
    state.social = state.social || {};
    return state.city;
  };

  // a arte já carregou? entra na chave da textura do Pixi: assar antes congelaria o desenho provisório
  function arteCarregada(look) {
    if (look && look.img) { const e = illustration(look.img); return Boolean(e && e.img && e.img.complete && e.img.naturalWidth); }
    if (look && (look.creature || look.emoji)) return true;
    const i = avatarImg(look && look.skin ? look : { skin: "#eab98f", hairStyle: "short", hairColor: "#5a3a26", top: "coat" });
    return Boolean(i.complete && i.naturalWidth);
  }

  // Retrato em aquarela de cada pessoa da cidade. Os PNGs existem desde a 4.8 (moradores e pessoas do
  // mundo) mas só eram usados na caixa de conversa. Desde a 5.2 a cidade inteira é aquarela, e desde a
  // 5.12 não há mais nada vetorial: quem não tem PNG próprio é desenhado na hora (js/core/retrato.js).
  function arteDaPessoa(n) {
    if (!n || !n.look || n.look.img || n.look.creature || n.look.emoji) return null;
    if (n.walker && n.kind === "citizen" && n.id) return `assets/moradores/morador-${n.id}.png`;
    if (n.id && n.def) return `assets/pessoas/npc-${n.id}.png`;
    return null;
  }
  // O ROSTO DE QUEM NÃO TEM RETRATO PRÓPRIO. A ficha de cada morador traz só pele, cabelo e blusa —
  // e a aquarela, sem o resto, desenhava a MESMA cara em todo mundo: mesmo olho, mesma sobrancelha,
  // mesma boca, mesmo formato. Daí a cidade parecer cheia de irmãos. O que falta sai do id da pessoa,
  // que não muda: a Aurora é sempre a mesma Aurora, mas não é a cara da vizinha.
  const OLHO_C = ["#2a1d17", "#5a3a26", "#8a5a2a", "#3d8a5a", "#3a6fb0", "#7a7a86"];
  function comFeicoes(look, id) {
    if (!look || look.img || look.creature || look.emoji || !look.skin) return look;
    if (look.eyeShape && look.mouth && look.face) return look;
    const h = hash(String(id || look.skin || "x"));
    return Object.assign({
      eyeShape: ["round", "almond", "sleepy", "wide"][h % 4],
      brow: ["soft", "thick", "arched"][(h >> 3) % 3],
      mouth: ["soft", "smile", "neutral", "smirk"][(h >> 5) % 4],
      face: ["round", "oval", "wide"][(h >> 8) % 3],
      eyeColor: OLHO_C[(h >> 11) % OLHO_C.length],
      freckles: ((h >> 14) % 5) === 0,
      corpo: typeof corpoPeloNome === "function" ? corpoPeloNome(id) : "n"
    }, look);
  }
  function comArte(n) {
    const src = arteDaPessoa(n);
    if (src) n.look = Object.assign({}, n.look, { img: src });
    else n.look = comFeicoes(n.look, n.name ? I18N.pick(n.name) : n.id);
    return n;
  }

  // Reserva de quem não tem PNG próprio: a aquarela desenhada na hora (js/core/retrato.js). O avatar
  // vetorial saiu do jogo — só existem aquarela e 3D.
  function avatarImg(look) {
    const key = JSON.stringify(look);
    if (!imgCache[key]) {
      const img = new Image();
      img.src = Retrato.url(look);
      imgCache[key] = img;
    }
    return imgCache[key];
  }

  // ---------------------------------------------------------------- casas dos pacientes (bairro)
  function houses() {
    if (!loc || !loc.houses) return [];
    const seen = [];
    Object.keys(SCHEDULE).forEach((day) => SCHEDULE[day].forEach((a, idx) => {
      const r = state.results[resultKey(day, idx)];
      if (r && !seen.includes(a.caseId)) seen.push(a.caseId);
    }));
    return seen.map((id, i) => ({ id, caseId: id, x: 150 + (i % 6) * 270, y: 170 + Math.floor(i / 6) * 250, w: 130, h: 95, kid: Boolean(CASES[id] && CASES[id].kid) }));
  }

  // contorno no chão de cada objeto: [meia largura, topo, altura], em frações do tamanho (só onde o objeto não tem "solid" explícito)
  const PROP_BODY = { "🌳": [0.13, -0.02, 0.36], "🌴": [0.1, 0, 0.34], "🪴": [0.22, 0.02, 0.32], "🪑": [0.46, -0.06, 0.32], "🚗": [0.56, -0.06, 0.36], "🚲": [0.3, 0, 0.3], "🛢️": [0.25, 0, 0.3], "⛽": [0.22, 0, 0.32], "🛒": [0.3, 0, 0.3], "🍦": [0.22, 0, 0.3] };

  function solids() {
    const out = [];
    (loc.solids || []).forEach((s) => out.push({ x: s.x, y: s.y, w: s.w, h: s.h }));
    (loc.props || []).forEach((p) => {
      if (p.solid) { const r = p.s * 0.28; out.push({ x: p.x - r, y: p.y - r * 0.4, w: r * 2, h: r * 1.2 }); return; }
      const f = p.solid === false ? null : PROP_BODY[p.e];   // objetos de chão têm o contorno do próprio corpo (tronco, vaso, banco, carro…)
      if (f) out.push({ x: p.x - p.s * f[0], y: p.y + p.s * f[1], w: p.s * f[0] * 2, h: p.s * f[2] });
    });
    houses().forEach((h) => out.push({ x: h.x, y: h.y, w: h.w, h: h.h }));
    return out;
  }

  // ---------------------------------------------------------------- movimento
  function collides(x, y) {
    if (x < R || y < R || x > loc.w - R || y > loc.h - R) return true;
    if (loc.kind === "indoor" && y < WALL_H + 30) return true;
    for (const s of solids()) if (x > s.x - R && x < s.x + s.w + R && y > s.y - R * 0.6 && y < s.y + s.h + R) return true;
    return false;
  }

  // ---------------------------------------------------------------- andar clicando
  const GRID = 24;
  function planPath(sx, sy, gx, gy) {
    const NX = Math.ceil(loc.w / GRID), NY = Math.ceil(loc.h / GRID);
    const cx = (i) => i * GRID + GRID / 2, cy = (j) => j * GRID + GRID / 2;
    const cell = (x, y) => [Math.max(0, Math.min(NX - 1, Math.floor(x / GRID))), Math.max(0, Math.min(NY - 1, Math.floor(y / GRID)))];
    const blocked = new Uint8Array(NX * NY);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) blocked[i + j * NX] = collides(cx(i), cy(j)) ? 1 : 0;
    const [si, sj] = cell(sx, sy);
    blocked[si + sj * NX] = 0;
    let [gi, gj] = cell(gx, gy);
    if (blocked[gi + gj * NX]) {   // destino em cima de um obstáculo: vai até o ponto livre mais próximo
      let best = null;
      for (let r = 1; r < 30 && !best; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ni = gi + di, nj = gj + dj;
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NY || blocked[ni + nj * NX]) continue;
        const d2 = di * di + dj * dj; if (!best || d2 < best.d2) best = { ni, nj, d2 };
      }
      if (!best) return null;
      gi = best.ni; gj = best.nj;
    }
    const g = new Float32Array(NX * NY).fill(1e9), from = new Int32Array(NX * NY).fill(-1), done = new Uint8Array(NX * NY);
    const open = [[0, si + sj * NX]]; g[si + sj * NX] = 0;
    let found = false;
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open.splice(bi, 1)[0];
      if (done[cur]) continue; done[cur] = 1;
      const ci = cur % NX, cj = Math.floor(cur / NX);
      if (ci === gi && cj === gj) { found = true; break; }
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NY || blocked[ni + nj * NX]) continue;
        if (di && dj && (blocked[ci + nj * NX] || blocked[ni + cj * NX])) continue;
        const nk = ni + nj * NX, ng = g[cur] + Math.hypot(di, dj);
        if (ng < g[nk]) { g[nk] = ng; from[nk] = cur; open.push([ng + Math.hypot(ni - gi, nj - gj), nk]); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let k = gi + gj * NX; k !== -1; k = from[k]) pts.push({ x: cx(k % NX), y: cy(Math.floor(k / NX)) });
    pts.reverse();
    const line = (a, b) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10); for (let k = 0; k <= n; k++) if (collides(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n)) return false; return true; };
    const out = []; let a = { x: sx, y: sy }, idx = 0;
    while (idx < pts.length) {
      let far = idx;
      for (let k = pts.length - 1; k > idx; k--) if (line(a, pts[k])) { far = k; break; }
      out.push(pts[far]); a = pts[far]; idx = far + 1;
    }
    return out;
  }

  // clique/toque no mundo: se acertar uma porta, objeto, pessoa ou casa, vai até lá e interage ao chegar
  function clickMove(wx, wy) {
    if (!loc) return false;
    let ref = null, best = 44;
    (loc.stations || []).forEach((st) => { const d = Math.hypot(wx - st.x, wy - (st.y - 6)); if (d < best) { best = d; ref = { kind: "station", ref: st, x: st.x, y: st.y }; } });
    npcs.forEach((n) => { const d = Math.hypot(wx - n.x, wy - (n.y - 30)); if (d < best) { best = d; ref = { kind: "npc", ref: n, x: n.x, y: n.y + 24 }; } });
    houses().forEach((h) => { const d = Math.hypot(wx - (h.x + h.w / 2), wy - (h.y + h.h / 2)); if (d < Math.max(best, 70)) { best = d; ref = { kind: "house", ref: h, x: h.x + h.w / 2, y: h.y + h.h + 26 }; } });
    const tx0 = ref ? ref.x : wx, ty0 = ref ? ref.y : wy;
    const p = planPath(px, py, tx0, ty0);
    if (!p || !p.length) return false;
    path = p; goal = { x: p[p.length - 1].x, y: p[p.length - 1].y, ref };
    return true;
  }

  function followPath(dt) {
    if (!path.length) return false;
    const t0 = path[0], dx = t0.x - px, dy = t0.y - py, d = Math.hypot(dx, dy);
    if (d < 8) { path.shift(); if (!path.length) arrive(); return path.length > 0; }
    const md = modeNow(), sp = WALK * 1.08 * MODE_SPEED[md] * dt, vx = (dx / d) * sp, vy = (dy / d) * sp;
    const ox = px, oy = py;
    const rp = pista();
    const podeIr = (xx, yy) => !collides(xx, yy) && (md !== "car" || !rp || (yy > rp.y + 18 && yy < rp.y + rp.h - 18));
    if (podeIr(px + vx, py)) px += vx;
    if (podeIr(px, py + vy)) py += vy;
    moveHealth((Math.hypot(px - ox, py - oy) / 100) * MODE_MOVE[md]);
    if (Math.abs(vx) > 0.01) facing = vx > 0 ? 1 : -1;
    if (px === ox && py === oy) { path = []; goal = null; return false; }    // encostou e não sai do lugar: desiste
    const lastT = trail[trail.length - 1];
    if (!lastT || Math.hypot(lastT.x - px, lastT.y - py) > 9) { trail.push({ x: px, y: py }); if (trail.length > 160) trail.shift(); }
    return true;
  }

  function arrive() {
    const g = goal; goal = null;
    if (!g || !g.ref) return;
    findNear();
    const r = g.ref;
    if (r.kind === "station" && Math.hypot(px - r.ref.x, py - r.ref.y) < 90) runAction(r.ref);
    else if (r.kind === "npc" && Math.hypot(px - r.ref.x, py - r.ref.y) < 90) talk(r.ref);
    else if (r.kind === "house") visitHouse(r.ref);
  }

  // bichinhos de enfeite (fauna.js): só andam onde dá para andar
  const faunaBlocked = (x, y) => {
    if (x < 18 || y < 18 || x > loc.w - 18 || y > loc.h - 18) return true;
    if (loc.kind === "indoor" && y < WALL_H + 34) return true;
    for (const s of solids()) if (x > s.x - 8 && x < s.x + s.w + 8 && y > s.y - 4 && y < s.y + s.h + 10) return true;
    return false;
  };
  // som ambiente de cada lugar (sound.js): rua, praça, mar… e, à noite, grilos e coruja nos lugares abertos
  const AMBIENT = {
    // ao ar livre
    rua: "street", "rua-lojas": "street", "rua-campus": "street", "rua-lazer": "street", estacao: "street",
    praca: "park", parque: "park", polo: "park", "feira-domingo": "park", bairro: "neighborhood",
    praia: "beach", farol: "beach", mar: "sea", navio: "ship", holandes: "ghost", fenda: "underwater",
    memorial: "memorial", observatorio: "observatory", zoo: "zoo",
    // fechados
    apartamento: "home", clinica: "room", cafe: "cafe", hospital: "hospital", posto: "clinic", caps: "clinic", capsi: "clinic",
    academia: "gym", shopping: "mall", "shopping-2": "mall", mercado: "market", feira: "market", fastfood: "food",
    biblioteca: "library", livraria: "library", bibinfantil: "library", museu: "museum", escola: "school", forum: "court",
    universidade: "university", laboratorio: "lab", cinema: "cinema", cassino: "casino",
    ludoteca: "toys", brinquedos: "toys", petshop: "pets", adocao: "pets", musica: "musicshop",
    atelie: "craft", ceramica: "craft", jardim: "garden", xadrez: "chess",
    roupas: "store", boutique: "store", souvenirs: "store", decor: "store", eletronicos: "store", antiquario: "store"
  };
  // chão de cada lugar, para o barulho do passo (sound.js): o que não está aqui é asfalto
  const CHAO = {
    praia: "areia", mar: "agua", fenda: "agua", navio: "madeira", holandes: "madeira", farol: "madeira",
    praca: "grama", parque: "grama", bairro: "grama", memorial: "grama", zoo: "terra", polo: "grama",
    "feira-domingo": "terra", observatorio: "terra"
  };
  const chaoDaqui = () => CHAO[loc.id] || (loc.kind === "indoor" ? "piso" : "asfalto");
  let andado = 0;   // distância desde o último passo ouvido

  function updateAmbient() {
    if (!window.Sound || !loc) return;
    andado = 0;
    let a = AMBIENT[loc.id] || (loc.kind === "indoor" ? "room" : "park");
    // à noite os lugares abertos trocam pássaros por grilos e coruja; o observatório já é noturno e o mar não muda
    if (loc.kind !== "indoor" && dayPhase(state.clock) === "night" && ["street", "park", "neighborhood", "beach", "zoo", "memorial"].includes(a)) a = "night";
    window.Sound.ambient(a);
    // a cidade depois do anoitecer ganha a versão grave do tema (showScreen já põe "calm" ao entrar)
    if (document.body.dataset.screen === "city") window.Sound.music(dayPhase(state.clock) === "night" ? "noite" : "calm");
    if (window.Fauna) Fauna.setNight(dayPhase(state.clock) === "night");
  }
  let ambTick = 0;
  function spawnFauna() { if (window.Nature && loc) Nature.enter(loc, faunaBlocked, loc.stations || []); if (window.Fauna && loc) { Fauna.setNight(dayPhase(state.clock) === "night"); Fauna.enter(loc, faunaBlocked); } }   // a natureza vem antes: borboletas e abelhas nascem nas flores

  function step(dt) {
    let ix = 0, iy = 0;
    if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
    if (keys.has("d") || keys.has("arrowright")) ix += 1;
    if (keys.has("w") || keys.has("arrowup")) iy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) iy += 1;
    let mag = 1;
    if (joy.active) { ix += joy.x; iy += joy.y; mag = Math.min(1, Math.hypot(joy.x, joy.y)); }
    const len = Math.hypot(ix, iy);
    const manual = len > 0.12;
    if (manual && path.length) { path = []; goal = null; }
    moving = manual;
    if (!manual && followPath(dt)) moving = true;
    if (moving && helpTimer) { clearTimeout(helpTimer); helpTimer = null; $("city-help").classList.add("gone"); }
    if (manual) {
      const md = modeNow(), sp = (keys.has("shift") ? RUN : WALK) * MODE_SPEED[md] * (joy.active && !keys.size ? Math.max(0.5, mag) : 1);
      const vx = (ix / len) * sp * dt, vy = (iy / len) * sp * dt;
      const ox0 = px, oy0 = py;
      // DE CARRO, SÓ NO ASFALTO. O carro andava em cima da calçada, entre os bancos e as árvores, o que
      // além de estranho tirava o sentido de ter calçada. A pista é a mesma que o trânsito usa.
      const r0 = pista();
      const noAsfalto = (yy) => !r0 || (yy > r0.y + 18 && yy < r0.y + r0.h - 18);
      const podeIr = (xx, yy) => !collides(xx, yy) && (md !== "car" || noAsfalto(yy));
      if (podeIr(px + vx, py)) px += vx;
      if (podeIr(px, py + vy)) py += vy;
      const andou = Math.hypot(px - ox0, py - oy0);
      moveHealth((andou / 100) * MODE_MOVE[md]);
      // passo (ou pneu, ou motor) a cada tanto de chão percorrido: de bicicleta e de carro o intervalo é maior
      andado += andou;
      const passo = md === "car" ? 240 : md === "bike" ? 95 : keys.has("shift") ? 46 : 60;
      if (andado >= passo) { andado = 0; if (window.Sound && Sound.foot) Sound.foot(chaoDaqui(), md); }
      if (Math.abs(vx) > 0.01) facing = vx > 0 ? 1 : -1;
      const lastT = trail[trail.length - 1];
      if (!lastT || Math.hypot(lastT.x - px, lastT.y - py) > 9) { trail.push({ x: px, y: py }); if (trail.length > 160) trail.shift(); }
    }
    refreshWalkersIfNeeded();
    passarTransito(dt);
    npcs.forEach((n) => {
      n.wait -= dt;
      if (n === talkingTo) return;   // conversando: não anda
      if (Math.hypot(px - n.x, py - n.y) < 150) { n.tx = n.x; n.ty = n.y; n.face = px > n.x ? 1 : -1; return; }   // você chegou perto: a pessoa espera parada, virada para você
      if (n.walker) {   // pedestre: caminha de um ponto a outro do lugar
        const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
        if (d > 4) {
          const nx = n.x + (dx / d) * 36 * dt, ny = n.y + (dy / d) * 36 * dt;
          if (!collides(nx, ny)) { n.x = nx; n.y = ny; n.face = dx > 0 ? 1 : -1; } else { n.wait = 0; n.tx = n.x; n.ty = n.y; }
        } else if (n.wait <= 0) {
          // PEDESTRE NÃO MORA NO MEIO DA PISTA. O destino era sorteado em qualquer ponto do lugar, e na
          // rua isso punha gente parada entre os carros. A calçada é o lugar dele; atravessar continua
          // acontecendo (é caminho entre dois pontos), ficar plantado no asfalto não.
          const r2 = pista();
          const naCalcada = (yy) => !r2 || yy < r2.y - 10 || yy > r2.y + r2.h + 10;
          // e não para colado num adereço alto: o PÉ dela passa longe da árvore, mas o BUSTO é desenhado
          // bem acima do pé e acaba em cima da copa. A distância aqui é a do desenho, não a do pé.
          const longeDeAdereco = (xx, yy) => !(loc.props || []).some((pr) => Math.hypot(pr.x - xx, pr.y - yy) < (pr.s || 40) + 34);
          for (let k = 0; k < 14; k++) {
            const tx2 = 80 + Math.random() * (loc.w - 160), ty2 = 80 + Math.random() * (loc.h - 160);
            if (!naCalcada(ty2) || !longeDeAdereco(tx2, ty2)) continue;
            if (!collides(tx2, ty2) && planPathOk(n.x, n.y, tx2, ty2)) { n.tx = tx2; n.ty = ty2; break; }
          }
          n.wait = 1 + Math.random() * 4;
        }
        return;
      }
      if (n.wait <= 0) {
        const tx2 = n.hx + (Math.random() - 0.5) * 110, ty2 = n.hy + (Math.random() - 0.5) * 70;
        if (!collides(tx2, ty2)) { n.tx = tx2; n.ty = ty2; }
        n.wait = 2 + Math.random() * 4;
      }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d > 2) { n.x += (dx / d) * 28 * dt; n.y += (dy / d) * 28 * dt; n.face = dx > 0 ? 1 : -1; }
    });
    findNear();
    if (dlgAnchor && !$("city-dlg").classList.contains("hidden") && Math.hypot(px - dlgAnchor.x, py - dlgAnchor.y) > 210 && (!$("hosp-modal") || $("hosp-modal").classList.contains("hidden"))) closeDlg();
  }

  function stationLabel(st) {
    if (st.door) {
      const dest = locById(st.action.slice(5));
      return dest ? `${dest.emoji} ${tx(dest.name)}${locOpen(dest, state.clock) ? "" : " 🔒"}` : tx(st.label);
    }
    if (st.action === "map" && cameFrom) return t("city.exit.street");
    return tx(st.label);
  }

  function findNear() {
    near = null;
    let best = 86;
    (loc.stations || []).forEach((s) => {
      const d = Math.hypot(px - s.x, py - s.y);
      if (d < best) { best = d; near = { kind: "station", ref: s }; }
    });
    houses().forEach((h) => {
      const d = Math.hypot(px - (h.x + h.w / 2), py - (h.y + h.h + 26));
      if (d < best) { best = d; near = { kind: "house", ref: h }; }
    });
    // pessoas: a porta/objeto ganha na distância média (senão alguém parado na entrada trancaria a loja),
    // mas quem está encostado em você ganha sempre — antes dava para ficar ao lado de um morador sem conseguir falar
    npcs.forEach((n) => {
      const d = Math.hypot(px - n.x, py - n.y);
      if (d < Math.min(best, 72) || d < NPC_COLADO) { best = d; near = { kind: "npc", ref: n }; }
    });
    const btn = $("city-act");
    if (btn) {
      btn.classList.toggle("hidden", !near);
      if (near && near.kind === "station" && !(state.tuts && state.tuts.station)) setTimeout(() => Tutor.topic("station", [{ key: "station1", target: "city-act" }]), 300);
      if (near) btn.textContent = near.kind === "station" ? `${near.ref.emoji}  ${stationLabel(near.ref)}` : near.kind === "npc" ? `💬 ${near.ref.name}` : `🏡 ${(CASES[near.ref.caseId] || { name: "" }).name}`;
    }
  }

  function toast(text) {
    const box = $("city-toast");
    if (!box) return;
    box.textContent = text;
    box.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.add("hidden"), 2800);
  }

  // ---------------------------------------------------------------- interação
  function interact() {
    if (!near) return;
    if (near.kind === "npc") return talk(near.ref);
    if (near.kind === "house") return visitHouse(near.ref);
    runAction(near.ref);
  }

  function warnAppointment() {
    const ap = nextAppt();
    if (!ap) return;
    const start = slotStart(ap), left = start + LATE_GRACE - state.clock;
    if (left < 0) toast(`⏰ ${t("clock.late.city", { t: fmtClock(start) })}`);
    else if (left <= 40) toast(`⏰ ${t("clock.soon", { t: fmtClock(start), n: Math.max(0, start - state.clock) })}`);
  }

  function openShopAt(store, tab) {
    shopStore = store; shopTab = tab; shopMsg = ""; shopFilter = "all";
    if (store) { state.shopSeen = state.shopSeen || {}; if (!state.shopSeen[store]) { state.shopSeen[store] = true; saveState(); } }   // conhecer a loja libera as peças dela no menu
    renderShop();
    showScreen("shop");
    setTimeout(() => { if (screen === "shop") Tutor.topic("shop", [{ key: "shop1", target: "shop-where" }]); }, 700);
  }

  let dlgAnchor = null;   // onde estava quem abriu o aviso: se você se afastar demais, o aviso fecha sozinho
  // retrato de quem está falando, na mesma ordem que a consulta usa:
  // paciente → desenho do caso; morador → retrato "ao molde da Maria"; criatura → desenho vetorial;
  // e, para quem não tem retrato pronto (lojistas, médicos, figuras históricas), o avatar da própria aparência.
  function retratoDe(n) {
    if (!n) return null;
    try {
      if (n.id && typeof CASES !== "undefined" && CASES[n.id] && CASES[n.id].image) return CASES[n.id].image;
      const look = n.look || (n.def && (n.def.creature ? { creature: n.def.creature } : n.def.emoji ? { emoji: n.def.emoji } : n.def.look)) || {};
      if (look.creature) {
        const cv = document.createElement("canvas"); cv.width = 260; cv.height = 310;
        const g = cv.getContext("2d"); g.translate(130, 280); g.scale(2.7, 2.7);
        CityArt.drawCreature(g, look.creature, 0, 0, 0);
        return cv.toDataURL("image/png");
      }
      if (look.img) return look.img;
      if (look.emoji) return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><text x="50" y="86" font-size="72" text-anchor="middle">${look.emoji}</text></svg>`);
      if (n.walker && n.kind === "citizen" && n.id) return `assets/moradores/morador-${n.id}.png`;
      // retrato "ao molde da Maria" de cada pessoa do mundo (tools/python/retratos-npcs.py).
      // Sem PNG próprio, a aquarela é desenhada na hora.
      if (n.id && n.def) return `assets/pessoas/npc-${n.id}.png`;
      if (look.skin) return Retrato.url(look);
    } catch (e) { /* sem retrato: a conversa segue só com o nome */ }
    return null;
  }

  function mostrarRetrato(n) {
    const el = $("city-dlg-face");
    if (!el) return;
    const src = retratoDe(n);
    if (!src) { el.classList.add("hidden"); el.removeAttribute("src"); return; }
    el.onerror = () => { el.classList.add("hidden"); };   // retrato que não existe não deixa buraco na caixa
    el.src = src;
    el.alt = n && n.name ? n.name : "";
    el.classList.remove("hidden");
  }

  function say(name, text, friendLine) {
    const quem = falante;      // say() começa fechando a caixa, e fechar esconde o retrato: repinta depois
    closeDlg();
    dlgAnchor = near && near.ref ? { x: near.kind === "house" ? near.ref.x + near.ref.w / 2 : near.ref.x, y: near.kind === "house" ? near.ref.y + near.ref.h : near.ref.y } : { x: px, y: py };
    $("city-dlg-name").textContent = name;
    $("city-dlg-text").textContent = text;
    $("city-dlg-friend").textContent = friendLine || "";
    $("city-dlg").classList.remove("hidden");
    mostrarRetrato(quem);
  }

  function runAction(st) {
    const a = st.action;
    sfx("open");
    if (a === "map") { if (cameFrom) { const at = cameFrom; cameFrom = null; return enterLocation(at.id || "rua", true, at); } return openMap(); }
    if (a === "clinic") { if (state.dayOver) return say(`🏥 ${tx(loc.name)}`, t("city.clinic.closed")); $("nav-door").click(); return; }
    if (a === "sleep") return openSleep();
    if (a === "convenience") return openConvenience();
    if (a.startsWith("goto:")) {
      const dest = locById(a.slice(5));
      if (dest && !locOpen(dest, state.clock)) return say(`🔒 ${tx(dest.name)}`, closedText(dest));
      if (st.door && loc.street) cameFrom = { x: st.x, y: st.y + (st.y < 600 ? 34 : -34), id: loc.id };   // ao sair do prédio, você volta para esta porta
      // Seta de uma rua para a vizinha: você chega na PONTA por onde entrou, não no meio da rua.
      // Antes o destino não vinha com ponto de chegada e o jogo usava o `spawn`, que fica no centro
      // (1920 de 3840, 3060 de 6120…): virar a esquina te teletransportava para o meio do quarteirão.
      if (!st.door && loc.street && dest && dest.street && String(st.id || "").startsWith("para-")) {
        const volta = (dest.stations || []).find((x) => x.action === `goto:${loc.id}`);
        if (volta) return enterLocation(a.slice(5), true, { x: volta.x + (volta.x < dest.w / 2 ? 90 : -90), y: volta.y });
      }
      return enterLocation(a.slice(5), true);
    }
    if (a.startsWith("shop-home:")) return openShopAt(null, a.slice(10));
    if (a.startsWith("shop:")) { const s = a.slice(5); return openShopAt(s, STORE_TAB[s] || s); }
    if (a === "electro") return Phone.openStore();
    if (a === "builds") return Life.openBuilds(loc.id);
    if (a.startsWith("build:")) return Life.doBuild(a.slice(6));
    if (a === "treasure") return Life.openTreasure();
    if (a === "ghostlamp") return Life.ghostLamp();
    if (a === "collect" || a === "fish") return Aquarium.fish(loc.id);
    if (a.startsWith("learn:")) return Places.open(a.slice(6));
    if (a.startsWith("rede:")) return Rede.abrir(a.slice(5));   // reunião de rede: escola, CAPS, hospital e fórum (7.3)
    if (a.startsWith("memorial:")) return Places.memorial(a.slice(9));
    if (a.startsWith("zoo:")) return Zoo.action(a.slice(4));
    if (a === "langs") return Culture.openLanguages();
    if (a === "history") return Culture.openHistory();
    if (a.startsWith("mg:")) return Minigames.open(a.slice(3));
    if (a === "oficina") { if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("oficina"), 600); return Minigames.open(null, true); }   // Oficina Clínica: os cinco exercícios do ofício
    if (a.startsWith("xad:")) return Xadrez.open(a.slice(4));
    if (a === "galeria") return NovasAtividades.galeria();
    if (a.startsWith("capsi:")) return Capsi.action(a.slice(6));
    if (a === "supervisao") return Supervisao.abrir();
    if (a === "gym") return Life.openGym();
    if (a === "aulas") return Esportes.open();
    if (a === "market") return Life.openMarket();
    if (a === "fastfood") return Life.openFast();
    if (a.startsWith("casino:")) return Life.openCasino(a.slice(7));
    if (a === "rest") return openRest();
    if (a === "phone") return openPhone();
    if (a === "cafe") return openCafe();
    if (a === "quiz") return openUniversity();
    if (a === "adopt") return Pets.openAdoption();
    if (a === "hospital") return openHospital();
    if (a === "read") return readBook();
    if (a === "manual") return openManual();
    if (a === "shells") return findShells(st);
    if (a === "petplay") return petPlay();
    if (a.startsWith("act:")) return NovasAtividades.action(a.slice(4));
  }

  // dormir só faz sentido depois do último atendimento: é o sono que começa o dia seguinte
  function openSleep() {
    if (!state.dayOver) return say(`🛏️ ${tx(loc.name)}`, t("city.sleep.no"));
    say(`🛏️ ${tx(loc.name)}`, t("city.sleep.ask", { day: dayLabel(DAYS[state.dayIndex + 1]) }));
    const ok = $("city-dlg-ok");
    ok.textContent = t("city.sleep.ok");
    ok.onclick = () => { closeDlg(); sleepNow(false); };
  }

  // loja de conveniência do posto (aberta 24 h): comida e café para recuperar energia de madrugada
  const CONV_ITEMS = [
    { id: "cafe", e: "☕", price: 2, energy: 8 },
    { id: "lanche", e: "🥪", price: 4, energy: 12 },
    { id: "energetico", e: "🥤", price: 3, energy: 15 }
  ];
  function openConvenience() {
    const body = $("hosp-body");
    body.textContent = "";
    $("hosp-title").textContent = `🛒 ${t("conv.title")}`;
    const status = el("p", "uni-q", t("conv.intro"));
    body.appendChild(status);
    const box = el("div", "uni-opts");
    CONV_ITEMS.forEach((it) => {
      const b = el("button", "choice-btn", `${it.e} ${t("conv.item." + it.id)} — 🪙${it.price} · +${it.energy}⚡`);
      b.type = "button";
      b.addEventListener("click", () => {
        if (state.energy >= 100) { status.textContent = t("conv.full"); sfx("bad"); return; }
        if (state.coins < it.price) { status.textContent = t("conv.poor"); sfx("bad"); return; }
        state.coins -= it.price;
        state.energy = clamp(state.energy + it.energy, 0, 100);
        advanceClock(10);
        saveState(); updateHud(); sfx("buy");
        status.textContent = t("conv.bought", { name: t("conv.item." + it.id), e: it.energy });
      });
      box.appendChild(b);
    });
    body.appendChild(box);
    openModal("hosp-modal");
  }

  function openRest() {
    say(`🏠 ${tx(loc.name)}`, t("city.home.text", { e: 10, m: 30 }));
    const ok = $("city-dlg-ok");
    ok.textContent = t("city.home.rest");
    ok.onclick = () => {
      state.energy = clamp(state.energy + 10, 0, 100);
      advanceClock(30);
      sfx("good");
      closeDlg();
      toast(`😴 ${t("city.home.rested", { e: 10 })}`);
      warnAppointment();
    };
  }

  // ampliações compradas: estações, adereços e móveis com "requires" só aparecem depois da obra
  const okBuild = (x) => !x.requires || Boolean(state.builds && state.builds[x.requires]);
  function withBuilds(l) {
    if (!(l.stations || []).some((s) => s.requires) && !(l.props || []).some((p) => p.requires) && !(l.solids || []).some((s) => s.requires)) return l;
    return Object.assign({}, l, { stations: (l.stations || []).filter(okBuild), props: (l.props || []).filter(okBuild), solids: (l.solids || []).filter(okBuild) });
  }
  function refreshBuilds() { if (loc) loc = withBuilds(locById(loc.id)); }

  // ---------------------------------------------------------------- cidade viva: pedestres com rotina
  let walkerHour = -1;
  const planPathOk = (x0, y0, x1, y1) => { try { const p = planPath(x0, y0, x1, y1); return Boolean(p && p.length); } catch (e) { return true; } };

  // a cada hora do jogo a rotina troca: quem sai do lugar some, quem chega aparece longe de você
  // as duas mãos da rua: a de cima vai para a direita, a de baixo para a esquerda
  const pista = () => (loc && loc.theme && loc.theme.road) || null;
  const faixas = () => { const r = pista(); return r ? [{ y: r.y + r.h * 0.27, dir: 1 }, { y: r.y + r.h * 0.73, dir: -1 }] : []; };
  function montarTransito() {
    carros = [];
    const r = pista();
    if (!r || (window.Perf && Perf.level && Perf.level() === "low")) return;
    const quantos = Math.max(3, Math.min(9, Math.round(loc.w / 620)));
    const vao = loc.w / quantos;
    faixas().forEach((f, li) => {
      for (let i = 0; i < quantos; i++) {
        // o sorteio da posição nunca pode encostar um carro no outro: ele só desloca dentro do vão,
        // e o vão é sempre bem maior que o carro
        carros.push({
          x: vao * i + CARRO_L + Math.random() * Math.max(0, vao - CARRO_L * 2.5) + li * 90,
          y: f.y, dir: f.dir,
          vel: 150 + Math.random() * 110,
          velMax: 0,
          cor: CARRO_CORES[Math.floor(Math.random() * CARRO_CORES.length)],
          buzina: 0
        });
      }
    });
    carros.forEach((c) => { c.velMax = c.vel; });
  }

  function passarTransito(dt) {
    if (!carros.length) return;
    const agora = performance.now() / 1000;
    const md = modeNow();
    // CARRO NÃO ATRAVESSA CARRO. Cada um tinha velocidade própria e ninguém olhava para a frente: o
    // mais rápido alcançava o da frente e passava POR DENTRO dele. Agora quem alcança freia e fica
    // atrás, como no trânsito de verdade.
    const DISTANCIA = CARRO_L * 1.35;
    carros.forEach((c) => {
      const mesmaFaixa = carros.filter((o) => o !== c && Math.abs(o.y - c.y) < 20);
      let frente = null, menor = Infinity;
      mesmaFaixa.forEach((o) => { const d = (o.x - c.x) * c.dir; if (d > 0 && d < menor) { menor = d; frente = o; } });
      if (frente && menor < DISTANCIA) c.vel = Math.max(0, Math.min(c.velMax, frente.vel * (menor / DISTANCIA)));
      else c.vel = Math.min(c.velMax, c.vel + 60 * dt);
      c.x += c.dir * c.vel * dt;
      if (c.dir > 0 && c.x > loc.w + CARRO_L) c.x = -CARRO_L;
      if (c.dir < 0 && c.x < -CARRO_L) c.x = loc.w + CARRO_L;
      if (c.buzina > 0) c.buzina -= dt;
      // quem está na frente sai da frente: o pedestre anda para fora da pista, e o carro buzina
      npcs.forEach((n) => {
        const adiante = (n.x - c.x) * c.dir;
        if (adiante > 0 && adiante < 300 && Math.abs(n.y - c.y) < 46) {
          const r = pista();
          const paraCima = n.y < r.y + r.h / 2;
          const destino = paraCima ? r.y - 60 : r.y + r.h + 60;
          n.ty = destino; n.tx = n.x;
          n.y += (destino > n.y ? 1 : -1) * 120 * dt;
          n.fugindo = agora + 1.2;
          if (c.buzina <= 0 && adiante < 150) { c.buzina = 2.2; if (typeof sfx === "function") sfx("deny"); }
        }
      });
      // e em você também: a pé ou de bicicleta, um carro em cima custa saúde de verdade
      if (md !== "car" && agora - batidaEm > CARRO_ESPERA
          && Math.abs(px - c.x) < CARRO_L / 2 && Math.abs(py - c.y) < CARRO_A / 2) {
        batidaEm = agora;
        state.health = clamp((state.health === undefined ? 50 : state.health) - CARRO_DANO, 0, 100);
        saveState(); updateHud();
        if (typeof sfx === "function") sfx("bad");
        // empurrão para fora da pista, do lado mais perto
        const r = pista();
        py += (py < r.y + r.h / 2 ? -1 : 1) * 70;
        toast(t("city.atropelado", { n: CARRO_DANO }));
        const cv = $("city-canvas");
        if (cv) { cv.classList.add("bateu"); setTimeout(() => cv.classList.remove("bateu"), 420); }
      }
    });
  }

  function desenharCarro(c) {
    const t2 = performance.now() / 1000;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.dir, 1);
    ctx.fillStyle = "rgba(21,19,31,0.26)";
    ctx.beginPath(); ctx.ellipse(0, 18, 62, 10, 0, 0, 7); ctx.fill();
    const corpo = ctx.createLinearGradient(0, -34, 0, 14);
    corpo.addColorStop(0, c.cor); corpo.addColorStop(1, shade(c.cor, -0.26));
    ctx.fillStyle = corpo; ctx.strokeStyle = INK_; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-62, 10); ctx.lineTo(-62, -6); ctx.quadraticCurveTo(-56, -14, -38, -16);
    ctx.lineTo(-22, -34); ctx.lineTo(18, -34); ctx.lineTo(40, -16);
    ctx.quadraticCurveTo(60, -14, 64, -2); ctx.lineTo(64, 10); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#cfe8fa";
    ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(-6, -30); ctx.lineTo(16, -30); ctx.lineTo(30, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
    const giro = t2 * 9;
    [-36, 36].forEach((wx) => {
      ctx.fillStyle = "#2a2a34"; ctx.beginPath(); ctx.arc(wx, 12, 13, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(220,220,230,0.7)"; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const a = giro + (k * Math.PI) / 1.5; ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 9, 12 + Math.sin(a) * 9); ctx.lineTo(wx - Math.cos(a) * 9, 12 - Math.sin(a) * 9); ctx.stroke(); }
      ctx.strokeStyle = INK_; ctx.lineWidth = 4;
    });
    ctx.fillStyle = "#ffe08a"; ctx.fillRect(58, -4, 8, 7);
    ctx.fillStyle = "#e8564a"; ctx.fillRect(-64, -4, 6, 7);
    ctx.restore();
    if (c.buzina > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, c.buzina);
      ctx.font = "bold 30px system-ui"; ctx.textAlign = "center";
      ctx.fillText("📣", c.x + c.dir * 70, c.y - 44);
      ctx.restore();
    }
  }

  function refreshWalkersIfNeeded(force) {
    if (!loc || !(loc.kind === "outdoor" || Town.INDOOR.includes(loc.id))) { npcs = npcs.filter((n) => !n.walker); return; }
    const hour = Math.floor((state.clock === undefined ? DAY_START : state.clock) / 60);
    if (!force && hour === walkerHour) return;
    walkerHour = hour;
    const want = Town.presentAt(loc.id, state.clock === undefined ? DAY_START : state.clock);
    const key = (w) => `${w.kind}:${w.id}`;
    const wantKeys = new Set(want.map(key));
    npcs = npcs.filter((n) => !n.walker || wantKeys.has(key(n)));
    const have = new Set(npcs.filter((n) => n.walker).map(key));
    want.forEach((w) => {
      if (have.has(key(w))) return;
      for (let k = 0; k < 30; k++) {
        const x = 80 + Math.random() * (loc.w - 160), y = 80 + Math.random() * (loc.h - 160);
        if (collides(x, y) || Math.hypot(x - px, y - py) < 220) continue;
        npcs.push(comArte({ walker: true, kind: w.kind, id: w.id, name: w.name, look: w.look, x, y, hx: x, hy: y, tx: x, ty: y, wait: Math.random() * 3, face: 1 }));
        break;
      }
    });
  }

  function faceAndHold(n) { talkingTo = n; n.tx = n.x; n.ty = n.y; n.face = px > n.x ? 1 : -1; }

  function talkWalker(w) {
    faceAndHold(w);
    falante = w;
    if (window.Sound) Sound.motif(Town.hash(w.id));   // tema musical de cada personagem
    const soc = state.social["w:" + w.id] = state.social["w:" + w.id] || { talks: 0, friend: 0, lastDay: -1 };
    if (soc.lastDay !== state.dayIndex) { soc.lastDay = state.dayIndex; soc.friend = Math.min(6, soc.friend + 1); soc.talks += 1; if (typeof Missoes !== "undefined") Missoes.conferir(); }
    if (typeof Quests !== "undefined") Quests.meet(w.id);
    const title = `${Town.badge(w)} ${w.name}`;
    const lemW = typeof Town !== "undefined" && Town.lembrancaDe ? Town.lembrancaDe(w.id) : null;
    if (w.kind === "patient") {
      const r = FU.rec(w.id), c = CASES[w.id];
      const line = r.q.length ? t("town.patient", { p: FU.evolution(w.id), n: r.q.length, total: FU.SESSIONS }) : t("town.patient.new", { complaint: c.complaint });
      saveState();
      return say(title, line, t("town.legend"));
    }
    const def = Town.cdef(w.id);
    const convinced = Boolean(Town.st().convinced[w.id]);
    if (Town.fixar) Town.fixar(w.id, loc && loc.id);   // enquanto a conversa corre, ela não muda de rua
    saveState();
    {
      // o arco de três encontros vem ANTES da fala do dia: é o que a pessoa quer te dizer agora
      const arco = Town.arcoDe ? Town.arcoDe(w.id) : null;
      const base = convinced ? t("town.convinced", { name: w.name }) : tx(def.line);
      const partes = [];
      if (lemW) partes.push(tx(lemW));
      if (arco && arco.txt) partes.push(tx(arco.txt));
      if (arco && arco.seguinte) { partes.push(`${arco.seguinte.emoji} ${tx(arco.seguinte.txt)}`); if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("arcos"), 700); }
      if (arco && arco.fechouAgora) { partes.push(t("town.arco.fechou", { c: arco.premio.coins, x: arco.premio.xp })); sfx("levelup"); updateHud(); }
      partes.push(base);
      say(title, partes.join("\n\n"), t("city.friendship", { n: Math.min(3, soc.friend), max: 3 }));
    }
    if (!convinced) {
      const alt = $("city-dlg-alt");
      alt.textContent = `💬 ${t("town.convince")}`;
      alt.classList.remove("hidden");
      alt.onclick = () => { closeDlg(); openConvince(w, def); };
    }
    if (def.dx && soc.friend >= 2) {   // guardião: depois de conversar bastante, dá para diagnosticar
      const alt2 = $("city-dlg-alt2");
      alt2.textContent = `🩺 ${t("town.diagnose")}`;
      alt2.classList.remove("hidden");
      alt2.onclick = () => { closeDlg(); Life.openGuardianDx(w.id); };
    }
  }

  function openConvince(w, def) {
    const body = $("hosp-body");
    body.textContent = "";
    $("hosp-title").textContent = `💬 ${t("town.convince.title", { name: w.name })}`;
    body.appendChild(el("p", "uni-q", `“${tx(def.doubt)}”`));
    if (Town.triedToday(w.id)) { body.appendChild(el("p", "uni-res", t("town.tried", { name: w.name }))); openModal("hosp-modal"); return; }
    body.appendChild(el("p", "shop-note", t("town.convince.help")));
    const box = el("div", "uni-opts");
    const res = el("p", "uni-res");
    ["acolhimento", "tcc", "psicodinamica", "psicoeducacao", "comportamental", "diretiva"].forEach((ap) => {
      const b = el("button", "choice-btn", `${APPROACH[ap].icon} ${APPROACH[ap].name}\n${I18N.pick(Town.ARGUMENT[ap])}`);
      b.type = "button";
      b.addEventListener("click", () => {
        if (Town.triedToday(w.id)) return;
        advanceClock(20);
        const r = Town.attempt(w.id, ap);
        updateHud();
        sfx(r === "yes" ? "good" : "bad");
        const last = (state.week || 1) >= FU.TOTAL_WEEKS;
        res.textContent = t("town.result." + r, { name: w.name }) + (r === "yes" ? ` ${t(last ? "town.result.yes.last" : "town.result.yes.next")}${def.special ? " " + t("town.special." + def.special) : ""}` : "");
        box.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        refreshWalkersIfNeeded(true);
      });
      box.appendChild(b);
    });
    body.appendChild(box);
    body.appendChild(res);
    openModal("hosp-modal");
  }

  function closeDlg() {
    const ok = $("city-dlg-ok"), alt = $("city-dlg-alt"), alt2 = $("city-dlg-alt2");
    $("city-dlg").classList.add("hidden"); dlgAnchor = null; document.body.classList.remove("talking");
    { const f = $("city-dlg-face"); if (f) { f.classList.add("hidden"); f.removeAttribute("src"); } }
    if (!$("city-dlg").classList.contains("hidden")) falante = null;
    alt.classList.add("hidden"); alt2.classList.add("hidden");
    if (!$("hosp-modal") || $("hosp-modal").classList.contains("hidden")) talkingTo = null;   // segue parado enquanto a conversa continua num painel (convencer/diagnosticar)
    ok.textContent = t("city.ok");
    ok.onclick = null;
  }

  function talk(n) {
    if (n.walker) return talkWalker(n);
    faceAndHold(n);
    falante = n;
    if (window.Sound) Sound.motif(Town.hash(n.id));
    const soc = state.social[n.id] = state.social[n.id] || { talks: 0, friend: 0, lastDay: -1, giftDay: -1 };
    if (soc.lastDay !== state.dayIndex) { soc.lastDay = state.dayIndex; soc.friend = Math.min(6, soc.friend + 1); soc.talks += 1; if (loc && ["hospital", "posto", "escola", "caps", "forum", "clinica", "universidade"].includes(loc.id)) Wheel.gain("multi", 1); if (typeof Missoes !== "undefined") Missoes.conferir(); }
    if (n.def.figure && typeof Quests !== "undefined") Quests.meet(n.id);
    const isFriend = soc.friend >= 3;
    let line;
    if (isFriend) {
      line = tx(n.def.friend);
      if (soc.giftDay !== state.dayIndex) {
        soc.giftDay = state.dayIndex;
        const g = n.def.gift || {};
        if (g.coins) state.coins += g.coins;
        if (g.energy) state.energy = clamp(state.energy + g.energy, 0, 100);
        if (g.xp) state.xp += g.xp;
        const parts = [g.coins ? `🪙 +${g.coins}` : "", g.energy ? `⚡ +${g.energy}` : "", g.xp ? `⭐ +${g.xp}` : ""].filter(Boolean).join("  ");
        line += `\n\n🎁 ${t("city.gift")} ${parts}`;
        sfx("good");
      }
    } else {
      line = tx(n.def.lines[(soc.talks + 1) % n.def.lines.length]);
    }
    // A CIDADE LEMBRA. A memória não inventa fala nova: ela abre a fala com uma linha que só existe
    // porque aquilo aconteceu — você convenceu, você dispensou, ou a cidade viu o seu trabalho.
    {
      const lem = typeof Town !== "undefined" && Town.lembrancaDe ? Town.lembrancaDe(n.id) : null;
      const arco = Town.arcoDe ? Town.arcoDe(n.id) : null;
      const antes = [];
      if (lem) antes.push(tx(lem));
      if (arco && arco.txt) antes.push(tx(arco.txt));
      if (arco && arco.seguinte) antes.push(`${arco.seguinte.emoji} ${tx(arco.seguinte.txt)}`);
      if (arco && arco.fechouAgora) { antes.push(t("town.arco.fechou", { c: arco.premio.coins, x: arco.premio.xp })); sfx("levelup"); }
      if (antes.length) line = `${antes.join("\n\n")}\n\n${line}`;
    }
    saveState();
    updateHud();
    say(`${n.name}${isFriend ? " ❤️" : ""}`, line, t("city.friendship", { n: Math.min(3, soc.friend), max: 3 }));
    if (n.def.doubt && !Town.st().convinced[n.id]) {   // moradores do mar e a capitã também podem ser convencidos a fazer terapia
      const alt = $("city-dlg-alt"); alt.textContent = `💬 ${t("town.convince")}`; alt.classList.remove("hidden");
      alt.onclick = () => { closeDlg(); openConvince({ id: n.id, name: n.name, kind: "citizen" }, n.def); };
    }
    if (n.def.dx && soc.friend >= 2) { const alt2 = $("city-dlg-alt2"); alt2.textContent = `🩺 ${t("town.diagnose")}`; alt2.classList.remove("hidden"); alt2.onclick = () => { closeDlg(); Life.openGuardianDx(n.id); }; }
    setTimeout(() => Tutor.topic("npc", [{ key: "npc1", target: "city-dlg" }]), 500);
  }

  function visitHouse(h) {
    const c = CASES[h.caseId];
    if (!c) return;
    let best = null;
    Object.keys(SCHEDULE).forEach((day) => SCHEDULE[day].forEach((a, idx) => {
      if (a.caseId !== h.caseId) return;
      const r = state.results[resultKey(day, idx)];
      if (r) best = Object.assign({ day, idx }, r);
    }));
    const dx = c.diagnosis ? disorderName(c.diagnosis.answer) : "";
    const status = best ? `${starText(Math.min(3, best.stars))}  ${best.dx === true ? "✅ " + t("city.dx.right") : best.dx === false ? "❌ " + t("city.dx.wrong") : ""}` : "";
    say(`🏡 ${c.name}`, `${c.age}. ${c.complaint}\n\n${t("city.house.type")}: ${c.type}\n${status}${dx && best && best.dx !== null ? `\n${t("city.house.hyp")}: ${dx}` : ""}`);
  }

  function openCafe() {
    const cost = 3;
    let text;
    if (state.coins < cost) text = t("city.cafe.nocoin", { n: cost });
    else if (state.energy >= 100) text = t("city.cafe.full");
    else {
      state.coins -= cost;
      advanceClock(15);
      state.energy = clamp(state.energy + 15, 0, 100);
      saveState();
      updateHud();
      sfx("good");
      text = t("city.cafe.ok", { n: cost });
    }
    say(`☕ ${tx(loc.name)}`, text);
  }

  function readBook() {
    const facts = world().facts;
    const f = facts[Math.floor(Math.random() * facts.length)];
    let extra = "";
    if (state.readDay !== state.dayIndex) {
      state.readDay = state.dayIndex; state.xp += 3; extra = `\n\n⭐ ${t("lib.xp", { n: 3 })}`; sfx("good");
      // a leitura do dia abre um verbete ainda fechado do Manual
      const fechados = [];
      MANUAL_GROUPS.forEach((g) => { if (g.kind !== "approach" && g.id !== "guia") g.disorders.forEach((d) => { if (d.items && d.items.length && !manualIsOpen(d)) fechados.push(d); }); });
      if (fechados.length) { const d = fechados[Math.floor(Math.random() * fechados.length)]; unlockManual([d.id], true); extra += `\n\n📘 ${t("lib.unlock", { name: d.name })}`; }
    }
    else extra = `\n\n${t("lib.already")}`;
    advanceClock(10);
    saveState();
    updateHud();
    say(`📖 ${tx(loc.name)}`, `${tx(f)}${extra}`);
  }

  function findShells(st) {
    const key = `${loc.id}:${st.id}`;
    const sh = state.shells = state.shells && state.shells.day === state.dayIndex ? state.shells : { day: state.dayIndex, found: {} };
    if (sh.found[key]) return say(`🐚 ${tx(loc.name)}`, t("beach.none"));
    const reward = (n, found) => { sh.found[key] = true; state.coins += n; sfx(n ? "coin" : "click"); saveState(); updateHud(); say(`🐚 ${tx(loc.name)}`, found === undefined ? t("beach.found", { n }) : (n ? t("beach.found", { n }) : t("beach.none"))); };
    if ((typeof Activities !== "undefined" && Activities.enabled())) { sh.found[key] = true; saveState(); return Activities.shells((n, found) => { state.coins += n; saveState(); updateHud(); showToast(`🐚 +${n}`); }); }   // o jogo já mostra o resultado; a estação só vale uma vez por dia
    reward(2 + Math.floor(Math.random() * 3));
  }

  function petPlay() {
    const list = window.Pets ? Pets.list() : [];
    if (!list.length) return say(`🎾 ${tx(loc.name)}`, t("park.nopets"));
    const give = (score) => {
      let n = 0; const gain = score === undefined ? 2 : Math.min(4, 1 + Math.floor(score / 2));
      list.forEach((p) => { if (p.played !== state.dayIndex) { p.played = state.dayIndex; p.bond = Math.min(100, (p.bond || 0) + gain); n++; } });
      saveState(); sfx(n ? "good" : "click");
      say(`🎾 ${tx(loc.name)}`, n ? t("park.played", { n }) : t("park.already"));
    };
    if ((typeof Activities !== "undefined" && Activities.enabled())) return Activities.fetch(list, (score) => { give(score); });
    give();
  }

  // ---------------------------------------------------------------- universidade: aulas do Manual e provinha
  // Cada grupo do Manual vira uma aula. Depois de ler a aula, dá para fazer a provinha (4 perguntas, passa com 3 acertos).
  const uniGroups = () => MANUAL_GROUPS.filter((g) => g.id !== "abordagens" && g.id !== "guia" && g.disorders.filter((d) => d.items && d.items.length >= 2).length >= 3);
  const uniState = () => {
    const u = (state.uni = state.uni || {});
    u.seen = u.seen || {}; u.passed = u.passed || {}; u.right = u.right || 0; u.total = u.total || 0;
    return u;
  };

  function uniShell(title) {
    $("uni-title").textContent = `🎓 ${tx(loc.name)}${title ? " · " + title : ""}`;
    const body = $("uni-body");
    body.textContent = "";
    return body;
  }

  function uniMenu() {
    const u = uniState();
    const body = uniShell("");
    const groups = uniGroups();
    const n = groups.filter((g) => u.passed[g.id]).length;
    body.appendChild(el("p", "uni-q", t("uni.intro", { n, total: groups.length })));
    const bar = el("div", "uni-bar");
    bar.appendChild(el("i"));
    bar.firstChild.style.width = `${groups.length ? Math.round((n / groups.length) * 100) : 0}%`;
    body.appendChild(bar);
    const list = el("div", "uni-opts");
    groups.forEach((g, gi) => {
      if (gi % 3 === 0) {   // trilha em semestres de 3 aulas, na ordem sugerida
        const sem = groups.slice(gi, gi + 3), done = sem.filter((x) => u.passed[x.id]).length;
        list.appendChild(el("h3", "uni-sem", `${done === sem.length ? "🏅" : "📅"} ${t("uni.sem", { n: gi / 3 + 1 })} · ${done}/${sem.length}`));
      }
      const passed = u.passed[g.id];
      const b = el("button", "choice-btn", `${passed ? "✅" : u.seen[g.id] ? "📖" : "📚"} ${g.title}${passed ? ` · ${passed}/4` : ""}`);
      b.type = "button";
      b.addEventListener("click", () => { sfx("click"); uniLesson(g); });
      list.appendChild(b);
    });
    body.appendChild(list);
    if (n === groups.length && groups.length) body.appendChild(el("p", "uni-res", t("uni.diploma")));
  }

  function uniLesson(g) {
    const u = uniState();
    unlockManual(g.disorders.map((d) => d.id));   // estudar a aula abre os verbetes do grupo no Manual
    const body = uniShell(g.title);
    body.appendChild(el("p", "uni-q", t("uni.lesson")));
    g.disorders.filter((d) => d.items && d.items.length >= 2).forEach((d) => {
      const box = el("div", "manual-extra");
      box.appendChild(el("h3", null, d.name));
      if (d.intro) box.appendChild(el("p", null, d.intro));
      const ul = el("ul");
      d.items.forEach((x) => ul.appendChild(el("li", null, x)));      // a provinha sorteia entre todos os critérios: a aula precisa mostrar todos
      box.appendChild(ul);
      if (d.diff && d.diff.length) box.appendChild(el("p", "shop-note", `${t("manual.diff")}: ${d.diff.join("; ")}`));
      if (d.tip) box.appendChild(el("p", "shop-note", `💡 ${d.tip}`));
      body.appendChild(box);
    });
    const row = el("div", "uni-row");
    const back = el("button", "pill-btn small", t("souv.back"));
    back.type = "button";
    back.addEventListener("click", uniMenu);
    const go = el("button", "pill-btn", t("uni.exam"));
    go.type = "button";
    go.addEventListener("click", () => { u.seen[g.id] = true; saveState(); uniExam(g); });
    row.appendChild(back);
    row.appendChild(go);
    body.appendChild(row);
    sfx("click");
  }

  function uniExam(g) {
    const u = uniState();
    const pool = g.disorders.filter((d) => d.items && d.items.length >= 2);
    const others = [];
    MANUAL_GROUPS.forEach((x) => { if (x.id !== g.id && x.id !== "abordagens" && x.id !== "guia") x.disorders.forEach((d) => { if (d.items && d.items.length >= 2) others.push(d); }); });
    const questions = shuffle(pool).slice(0, 4).map((d) => {
      const wrong = shuffle(pool.filter((x) => x.id !== d.id)).concat(shuffle(others)).slice(0, 3);
      return { d, crit: d.items[Math.floor(Math.random() * d.items.length)], options: shuffle([{ text: d.name, ok: true }].concat(wrong.map((w) => ({ text: w.name, ok: false })))) };
    });
    let qi = 0, right = 0;
    const ask = () => {
      const q = questions[qi];
      const body = uniShell(`${t("uni.examof")} ${qi + 1}/${questions.length}`);
      body.appendChild(el("p", "uni-q", t("uni.q", { c: q.crit })));
      const box = el("div", "uni-opts");
      const res = el("p", "uni-res");
      res.setAttribute("role", "status");
      q.options.forEach((o) => {
        const b = el("button", "choice-btn", o.text);
        b.type = "button";
        b.addEventListener("click", () => {
          if (b.dataset.done) return;
          box.querySelectorAll("button").forEach((x) => { x.dataset.done = "1"; x.disabled = true; });
          u.total += 1;
          if (o.ok) { right += 1; u.right += 1; res.textContent = t("uni.ok"); sfx("good"); }
          else { res.textContent = t("uni.wrong", { name: q.d.name }); sfx("bad"); }
          const nx = el("button", "pill-btn", qi + 1 < questions.length ? t("uni.next") : t("uni.finish"));
          nx.type = "button";
          nx.addEventListener("click", () => { qi += 1; if (qi < questions.length) ask(); else finish(); });
          body.appendChild(nx);
        });
        box.appendChild(b);
      });
      body.appendChild(box);
      body.appendChild(res);
    };
    const finish = () => {
      const need = Math.min(3, questions.length);
      const body = uniShell(g.title);
      const pass = right >= need;
      const first = pass && !u.passed[g.id];
      if (pass && right > (u.passed[g.id] || 0)) u.passed[g.id] = right;
      const dbl = Wheel.perk("uni");
      if (first) { state.xp += 12 * dbl; state.coins += 8 * dbl; }
      saveState();
      updateHud();
      sfx(pass ? "good" : "bad");
      body.appendChild(el("p", "uni-q", t(pass ? "uni.passed" : "uni.failed", { r: right, n: questions.length })));
      if (first) body.appendChild(el("p", "uni-res", t("uni.reward", { xp: 12 * dbl, c: 8 * dbl })));
      const row = el("div", "uni-row");
      const lesson = el("button", "pill-btn small", t("uni.review"));
      lesson.type = "button";
      lesson.addEventListener("click", () => uniLesson(g));
      const menu = el("button", "pill-btn", t("uni.menu"));
      menu.type = "button";
      menu.addEventListener("click", uniMenu);
      row.appendChild(lesson);
      row.appendChild(menu);
      body.appendChild(row);
    };
    ask();
  }

  function openUniversity() {
    if (uniGroups().length < 1) return;
    uniMenu();
    openModal("uni-modal");
    setTimeout(() => Tutor.topic("uni", [{ key: "uni1", target: "uni-body" }]), 500);
  }

  // ---------------------------------------------------------------- hospital: plantão de diagnósticos
  // Prontuários montados a partir do Manual: o jogador lê os achados e escolhe o diagnóstico. No futuro, vira emprego.
  const HOSP_PER_DAY = 3;
  const HOSP_RANKS = [[0, "hosp.rank0"], [5, "hosp.rank1"], [15, "hosp.rank2"], [30, "hosp.rank3"]];
  const hospState = () => {
    const h = (state.hosp = state.hosp || {});
    if (h.day !== state.dayIndex) { h.day = state.dayIndex; h.done = 0; }
    h.right = h.right || 0; h.total = h.total || 0;
    return h;
  };
  const hospRank = (h) => HOSP_RANKS.slice().reverse().find(([n]) => h.right >= n)[1];

  function hospitalCase() {
    const pool = [];
    MANUAL_GROUPS.forEach((g) => { if (g.id !== "abordagens" && g.id !== "guia") g.disorders.forEach((d) => { if (d.items && d.items.length >= 3) pool.push({ g, d }); }); });
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const same = shuffle(pool.filter((x) => x.g.id === pick.g.id && x.d.id !== pick.d.id));
    const rest = shuffle(pool.filter((x) => x.g.id !== pick.g.id));
    const wrong = same.concat(rest).slice(0, 3);
    const findings = shuffle(pick.d.items.slice()).slice(0, 3);
    const names = ["Ana", "Bruno", "Carla", "Davi", "Elisa", "Fábio", "Gina", "Hugo", "Ivone", "João", "Karen", "Léo"];
    return {
      who: `${names[Math.floor(Math.random() * names.length)]}, ${18 + Math.floor(Math.random() * 60)}`,
      findings, answer: pick.d,
      options: shuffle([{ text: pick.d.name, ok: true }].concat(wrong.map((w) => ({ text: w.d.name, ok: false }))))
    };
  }

  function openHospital() {
    const h = hospState();
    const body = $("hosp-body");
    body.textContent = "";
    $("hosp-title").textContent = `🏥 ${tx(loc.name)}`;
    body.appendChild(el("p", "uni-q", t("hosp.status", { rank: t(hospRank(h)), right: h.right, total: h.total, left: Math.max(0, HOSP_PER_DAY - h.done) })));
    body.appendChild(el("p", "shop-note", t("hosp.job")));
    if (h.done >= HOSP_PER_DAY) {
      body.appendChild(el("p", "uni-res", t("hosp.enough")));
      openModal("hosp-modal");
      return;
    }
    const cs = hospitalCase();
    const box = el("div", "manual-extra");
    box.appendChild(el("h3", null, t("hosp.chart", { who: cs.who })));
    const ul = el("ul");
    cs.findings.forEach((f) => ul.appendChild(el("li", null, f)));
    box.appendChild(ul);
    body.appendChild(box);
    body.appendChild(el("p", "uni-q", t("hosp.q")));
    const opts = el("div", "uni-opts");
    const res = el("p", "uni-res");
    res.setAttribute("role", "status");
    cs.options.forEach((o) => {
      const b = el("button", "choice-btn", o.text);
      b.type = "button";
      b.addEventListener("click", () => {
        if (b.dataset.done) return;
        opts.querySelectorAll("button").forEach((x) => { x.dataset.done = "1"; x.disabled = true; });
        h.done += 1; h.total += 1;
        if (o.ok) { h.right += 1; state.xp += 6; state.coins += 10; res.textContent = t("hosp.right", { xp: 6, c: 10 }); sfx("good"); }
        else { res.textContent = t("hosp.wrong", { name: cs.answer.name }); sfx("bad"); }
        unlockManual([cs.answer.id]);   // o diagnóstico do prontuário passa a constar no Manual
        saveState();
        updateHud();
        const next = el("button", "pill-btn", h.done < HOSP_PER_DAY ? t("hosp.next") : t("hosp.leave"));
        next.type = "button";
        next.addEventListener("click", () => { if (h.done < HOSP_PER_DAY) openHospital(); else closeModal("hosp-modal"); });
        body.appendChild(next);
      });
      opts.appendChild(b);
    });
    body.appendChild(opts);
    body.appendChild(res);
    openModal("hosp-modal");
  }

  // ---------------------------------------------------------------- entrar e sair dos locais
  function markVisited(id) {
    const v = cityState().visited;
    if (v[id]) return false;
    v[id] = true;
    saveState();
    return true;
  }

  function enterLocation(id, free, at) {
    const l = locById(id);
    if (!l) return;
    loc = withBuilds(l);
    spawnFauna(); updateAmbient(); refreshModeBtn();
    if (l.street && !at) cameFrom = null;   // chegou pelo mapa, não por uma porta
    px = at ? at.x : l.spawn.x; py = at ? at.y : l.spawn.y; facing = 1; trail = []; pixiSnap = true;
    npcs = (l.npcs || []).filter(npcHere).map((n) => {
      const def = npcDef(n.id);
      return comArte({ id: n.id, def, name: def.name, look: def.creature ? { creature: def.creature } : def.emoji ? { emoji: def.emoji } : def.look, x: n.x, y: n.y, hx: n.x, hy: n.y, tx: n.x, ty: n.y, wait: Math.random() * 3 });
    });
    montarTransito();
    if (carros.length && typeof Tips !== "undefined") setTimeout(() => Tips.fire("transito"), 1400);
    walkerHour = -1; refreshWalkersIfNeeded(true);
    const first = markVisited(id);
    if (typeof Missoes !== "undefined") Missoes.conferir();   // chegar num lugar pode fechar missão
    if (id === "capsi" && typeof Capsi !== "undefined") setTimeout(() => Capsi.boasVindas(), 700);   // a turma adota você na primeira visita
    if (id === "ludoteca") setTimeout(() => Tutor.topic("mind", [{ key: "mind1", target: "city-canvas" }]), 900);
    else if (["praia", "praca", "bairro"].includes(id)) setTimeout(() => Tutor.topic("fauna", [{ key: "fauna1", target: "city-canvas" }]), 1200);
    cityState().loc = id;
    if (!free && id !== "clinica") advanceClock(15);
    showScreen("city");
    fitCanvas();
    toast(first ? `🗺️ ${t("city.discovered", { place: tx(l.name) })}` : `${l.emoji} ${tx(l.name)}`);
    if (!free) warnAppointment();
    if (l.street) setTimeout(() => { if (screen === "city") Tutor.topic("street", [{ key: "street1", target: "city-canvas" }]); }, 700);
    setTimeout(() => { if (screen === "city") Tutor.topic("city", [{ key: "city1", target: "city-canvas" }, { key: "city2", target: "city-mini" }, { key: "city3", target: "city-mapbtn" }]); }, 1200);
  }

  // ---------------------------------------------------------------- mapa
  const spotEl = {};

  // dois modos: "cidade" (áreas: rua principal, praia, praça, bairro) e "rua" (cada loja e prédio da rua principal)
  let mapMode = "city";
  const streetIds = () => { const s = world().street || { top: [], bottom: [] }; return s.top.concat(s.bottom); };
  const inStreet = (id) => streetIds().includes(id);

  // posição (em % do mapa) de onde o carro para para cada destino, conforme o modo
  function carSpot(id) {
    if (mapMode === "street") {
      const s = world().street, top = s.top.indexOf(id), bot = s.bottom.indexOf(id);
      const row = top >= 0 ? s.top : s.bottom, k = top >= 0 ? top : bot;
      return { x: ((k + 0.5) / row.length) * 100, y: 50 };
    }
    const a = (world().areas || []).find((x) => x.id === id || x.go === id) || (inStreet(id) ? world().areas[0] : null);
    const l = locById(id);
    const m = a ? a.map : l ? l.map : { x: 50, y: 50 };
    return { x: m.x - 8, y: m.y + 3 };
  }

  function renderMap() {
    const box = $("map-spots"), street = $("map-street");
    box.textContent = "";
    street.textContent = "";
    const isStreet = mapMode === "street";
    street.classList.toggle("hidden", !isStreet);
    box.classList.toggle("hidden", isStreet);
    $("map-title").textContent = isStreet ? tx(world().areas[0].name) : tx(world().map.title);
    $("map-hint").textContent = tx(isStreet ? world().map.hintStreet : world().map.hintCity);
    const btn = $("map-mode");
    btn.classList.add("hidden");   // o antigo modo "rua" do mapa foi substituído pela rua andável
    const v = cityState().visited;
    if (isStreet) {
      const s = world().street;
      const sky = el("div", "street-sky");
      street.appendChild(sky);
      [["top", s.top], ["bottom", s.bottom]].forEach(([pos, ids]) => {
        const row = el("div", `street-row ${pos}`);
        ids.forEach((id) => {
          const l = locById(id);
          if (!l) return;
          const b = el("button", "bld" + (v[l.id] ? " visited" : ""));
          b.type = "button";
          b.id = `spot-${l.id}`;
          b.dataset.loc = l.id;
          b.style.setProperty("--wall", (l.theme && l.theme.wall) || "#e8dcc8");
          b.setAttribute("aria-label", tx(l.name));
          const aberto = locOpen(l, (state.clock === undefined ? DAY_START : state.clock) + 15);
          if (!aberto) { b.classList.add("closed"); b.title = closedText(l); }
          b.appendChild(el("span", "bld-roof"));
          b.appendChild(el("span", "bld-sign", `${l.emoji} ${tx(l.name)}`));
          if (l.hours) b.appendChild(el("span", "bld-hours", aberto ? `${l.hours[0]}–${l.hours[1]}` : `🔒 ${l.hours[0]}`));
          const body = el("span", "bld-body");
          body.appendChild(el("span", "bld-win"));
          body.appendChild(el("span", "bld-door"));
          body.appendChild(el("span", "bld-win"));
          b.appendChild(body);
          b.addEventListener("click", () => travelTo(l.id));
          row.appendChild(b);
          spotEl[l.id] = b;
        });
        street.appendChild(row);
        if (pos === "top") street.appendChild(el("div", "street-road"));
      });
    } else {
      (world().areas || []).forEach((a) => {
        if (a.unlock && !Zoo.areaUnlocked(a.unlock)) return;   // áreas que se abrem por conquista (Polo Norte)
        const b = el("button", "map-spot area" + (a.go && !a.at && v[a.go] ? " visited" : ""));
        b.type = "button";
        b.style.left = `${a.map.x}%`;
        b.style.top = `${a.map.y}%`;
        b.id = `area-${a.id}`;
        if (a.mini) b.classList.add("mini");
        b.dataset.area = a.id;
        if (a.go) { b.dataset.loc = a.go; b.setAttribute("data-spot", a.go); }
        b.setAttribute("aria-label", tx(a.name));
        b.appendChild(el("span", "map-badge", a.emoji));
        b.appendChild(el("span", "map-label", tx(a.name)));
        if (a.about) b.appendChild(el("span", "map-about", tx(a.about)));
        b.addEventListener("click", () => { if (a.street) { sfx("open"); setMapMode("street"); } else travelTo(a.go, a.at, a); });
        box.appendChild(b);
        spotEl[a.at ? a.id : (a.go || a.id)] = b;
      });
    }
    const from = (mapFrom && locById(mapFrom)) || locById(cityState().loc) || world().locations[0];
    placeCar(from);
    requestAnimationFrame(desempilhar);
  }

  // Os alfinetes ficam em posições fixas (%) e, em tela estreita, os rótulos de lugares vizinhos se
  // encavalam — no celular chegavam a quatro pares ilegíveis. Aqui eles são medidos depois de
  // desenhados e, de cima para baixo, cada um desce até sair de cima dos que já foram colocados.
  // O emblema não se mexe: o alfinete continua marcando o mesmo ponto do mapa.
  const TETO_DESLOC = 130;   // rótulo longe demais do seu emblema não ajuda ninguém
  function desempilhar() {
    const rotulos = [...document.querySelectorAll("#map-spots .map-label")];
    if (rotulos.length < 2) return;
    // O deslocamento é por `position: relative` e NÃO por margem: o alfinete é centrado no ponto
    // (translate(-50%, -50%)), então aumentar a margem faz o botão crescer e o centro subir — o rótulo
    // só andava metade do pedido e o emblema saía do lugar.
    rotulos.forEach((r) => { r.style.position = ""; r.style.top = ""; r.classList.remove("encoberto"); });
    const itens = rotulos.map((r) => ({ r, b: r.getBoundingClientRect() })).filter((x) => x.b.width > 2);
    itens.sort((a, b) => a.b.top - b.b.top);
    const postos = [];
    const bateEm = (topo, base, esq, dir) => postos.find((p) => p.b.right > esq + 2 && p.b.left < dir - 2 && p.b.bottom > topo + 2 && p.b.top < base - 2);
    itens.forEach((it) => {
      // procura o menor deslocamento que resolve, PARA BAIXO OU PARA CIMA. Só descer empurrava
      // cadeias inteiras para o pé do mapa; com as duas direções o mesmo par se resolve com metade
      // do caminho, e sobra espaço para os de baixo.
      let escolhido = null;
      for (const sentido of [1, -1]) {
        let desl = 0;
        for (let n = 0; n < 40; n++) {
          const topo = it.b.top + desl, base = it.b.bottom + desl;
          const bate = bateEm(topo, base, it.b.left, it.b.right);
          if (!bate) { escolhido = escolhido === null || Math.abs(desl) < Math.abs(escolhido) ? desl : escolhido; break; }
          const passo = sentido > 0 ? bate.b.bottom - topo + 4 : bate.b.top - base - 4;
          if (Math.abs(desl + passo) > TETO_DESLOC) break;
          desl += passo;
        }
      }
      // Não coube de jeito nenhum: em vez de deixar dois nomes um por cima do outro — ilegíveis os
      // dois —, o rótulo se recolhe e volta ao passar o dedo/mouse, ao focar pelo teclado ou quando
      // você está perto no mapa. O emblema, que é o que marca o lugar, continua lá.
      if (escolhido === null) { it.r.classList.add("encoberto"); return; }
      if (escolhido !== 0) { it.r.style.position = "relative"; it.r.style.top = `${escolhido}px`; it.b = it.r.getBoundingClientRect(); }
      postos.push(it);
    });
  }
  // o mapa muda de forma ao girar o celular: os rótulos precisam ser recolocados
  let reflowMapa = null;
  window.addEventListener("resize", () => {
    if (!document.getElementById("map-spots")) return;
    clearTimeout(reflowMapa);
    reflowMapa = setTimeout(() => requestAnimationFrame(desempilhar), 120);
  });

  function setMapMode(m) {
    mapMode = m;
    renderMap();
  }

  function placeCar(l) {
    const car = $("map-car");
    const p = carSpot(l.id);
    mapPos = { x: p.x, y: p.y };
    car.style.transition = "none";
    car.style.left = `${p.x}%`;
    car.style.top = `${p.y}%`;
    car.classList.toggle("on-street", mapMode === "street");
    void car.offsetWidth;
    car.style.transition = "";
  }

  function fitMap() {
    const wrap = $("map-wrap");
    wrap.style.height = `${Math.max(420, window.innerHeight - wrap.getBoundingClientRect().top)}px`;
    // a altura do mapa muda onde cada alfinete cai (as posições são em %): os rótulos são
    // reorganizados DEPOIS de a altura assentar, senão a conta é feita sobre um mapa que não existe mais
    requestAnimationFrame(desempilhar);
  }

  // ---------------------------------------------------------------- dirigir no mapa (estilo Overcooked)
  function mapStep(dt) {
    const wrap = $("map-wrap"), W = wrap.clientWidth || 1000, H = wrap.clientHeight || 600;
    let ix = 0, iy = 0;
    if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
    if (keys.has("d") || keys.has("arrowright")) ix += 1;
    if (keys.has("w") || keys.has("arrowup")) iy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) iy += 1;
    if (mjoy.active) { ix += mjoy.x; iy += mjoy.y; }
    const len = Math.hypot(ix, iy), car = $("map-car");
    if (len > 0.12) {
      const sp = 300 * dt * (keys.has("shift") ? 1.6 : 1) * (mjoy.active && !keys.size ? Math.min(1, len) : 1);   // pixels por segundo
      mapPos.x = Math.max(2, Math.min(98, mapPos.x + (((ix / len) * sp) / W) * 100));
      mapPos.y = Math.max(5, Math.min(95, mapPos.y + (((iy / len) * sp) / H) * 100));
      car.style.transition = "none"; car.style.left = `${mapPos.x}%`; car.style.top = `${mapPos.y}%`;
      if (Math.abs(ix) > 0.1) car.classList.toggle("flip", ix < 0);
    }
    let best = null, bd = 78;
    (world().areas || []).forEach((a) => {
      if (!a.go || (a.unlock && !Zoo.areaUnlocked(a.unlock))) return;
      const d = Math.hypot(((mapPos.x - (a.map.x - 8)) * W) / 100, ((mapPos.y - (a.map.y + 3)) * H) / 100);
      if (d < bd) { bd = d; best = a; }
    });
    mapNear = best;
    const btn = $("map-enter");
    btn.classList.toggle("hidden", !best);
    if (best) btn.textContent = `${best.emoji}  ${t("map.enter", { name: tx(best.name) })}`;
    document.querySelectorAll(".map-spot.area").forEach((el) => el.classList.toggle("near", Boolean(best) && el.dataset.area === best.id));
  }

  function mapEnter() {
    if (!mapNear || travelling) return;
    const to = locById(mapNear.go);
    if (to && !locOpen(to, (state.clock === undefined ? DAY_START : state.clock) + 15)) { sfx("bad"); showToast(`🔒 ${closedText(to)}`); return; }
    mapFrom = mapNear.go; sfx("open");
    enterLocation(mapNear.go, false, mapNear.at);
  }

  function mapLoop(now) {
    if (screen !== "map") { mapRaf = 0; keys.clear(); return; }
    const dt = Math.min(0.05, (now - mapLast) / 1000 || 0.016);
    mapLast = now;
    if (!travelling) mapStep(dt);
    mapRaf = requestAnimationFrame(mapLoop);
  }

  // o selo da estação no canto do mapa: que época é, e se esta é a semana da festa
  function pintarEstacao() {
    const el2 = $("map-estacao");
    if (!el2 || typeof Town === "undefined" || !Town.estacao) return;
    const e = Town.estacao();
    el2.textContent = "";
    el2.appendChild(el("span", "e-inv-txt", `${e.emoji} ${I18N.pick(e.nome)}`));
    if (Town.ehSemanaDeFesta()) {
      const f = Town.figuraDaEpoca();
      const nome = { natal: L("Natal", "Christmas", "Navidad"), pascoa: L("Páscoa", "Easter", "Pascua"), halloween: L("Halloween", "Halloween", "Halloween") }[f];
      if (nome) el2.appendChild(el("span", "festa", `🎉 ${I18N.pick(nome)}`));
    }
    // o céu do mapa acompanha a estação
    const art = document.querySelector(".map-art");
    if (art) { const g = art.querySelector("#seaGrad stop"); if (g) g.setAttribute("stop-color", e.ceu); }
  }

  function openMap() {
    if (session || screen === "consult" || screen === "break") return;
    mapFrom = loc ? loc.id : (cityState().loc || "apartamento");
    mapMode = "city";
    cameFrom = null;
    showScreen("map");
    pintarEstacao();
    if (typeof Tips !== "undefined") setTimeout(() => Tips.fire("estacoes"), 700);
    fitMap();
    renderMap();
    // a tela entra com animação: no quadro seguinte os rótulos ainda estão a caminho do lugar final,
    // e a conta de quem cobre quem sai errada. Refaz quando a animação assenta.
    setTimeout(desempilhar, 360);
    if (!mapRaf) { mapLast = performance.now(); mapRaf = requestAnimationFrame(mapLoop); }
    setTimeout(() => { if (screen === "map") Tutor.topic("map", [{ key: "map1", target: "map-wrap" }, { key: "map2", target: "map-car" }, { key: "map3", target: "stat-clock" }]); }, 600);
  }

  // o carro dirige até o local e estaciona; só então você entra
  function travelTo(id, at, area) {
    if (travelling) return;
    const to = locById(id);
    if (to && !locOpen(to, (state.clock === undefined ? DAY_START : state.clock) + 15)) { sfx("bad"); showToast(`🔒 ${closedText(to)}`); return; }
    const from = locById(mapFrom) || to;
    const car = $("map-car");
    travelling = true;
    sfx("step");
    const a = carSpot(from.id), b = area ? { x: area.map.x - 8, y: area.map.y + 3 } : carSpot(to.id);
    car.classList.toggle("flip", b.x < a.x);
    const same = from.id === to.id;
    car.style.left = `${b.x}%`;
    car.style.top = `${b.y}%`;
    const finish = () => { travelling = false; mapFrom = id; enterLocation(id, false, at); };
    if (same || reducedMotion()) setTimeout(finish, same ? 150 : 50);
    else setTimeout(finish, 1000);
  }

  function go() {
    if (session || screen === "consult" || screen === "break" || screen === "city" || screen === "map") return;
    travel("city.going", () => openMap());
  }

  // ---------------------------------------------------------------- desenho
  function fitCanvas() {
    if (!canvas) return;
    const box = canvas.parentElement;
    box.style.height = `${Math.max(280, window.innerHeight - box.getBoundingClientRect().top)}px`;
    const w = box.clientWidth, h = box.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(2, Math.round(w * dpr));
    canvas.height = Math.max(2, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas._dpr = dpr;
  }

  const ink = "#15131f";
  // Ler cor: aceita "#abc", "#aabbcc" e "rgb(r,g,b)". Existir em uma forma só custou caro — desde que a
  // estação passou a tingir o chão (6.14), a mistura devolvia `rgb(...)` e quem só sabia ler `#hex` fazia
  // parseInt("gb(201,...", 16) = NaN. Cor inválida no canvas não reclama: fica o preto que estava antes.
  // Era esse o chão preto do parque.
  const corRGB = (c) => {
    const s = String(c).trim();
    if (s.charAt(0) === "#") {
      const t = s.slice(1), n = parseInt(t.length === 3 ? t.split("").map((x) => x + x).join("") : t, 16);
      return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [200, 200, 200];
    }
    const m = /rgba?\(([^)]+)\)/i.exec(s);
    if (m) { const p = m[1].split(",").map((v) => Math.max(0, Math.min(255, Math.round(parseFloat(v)) || 0))); return [p[0], p[1], p[2]]; }
    return [200, 200, 200];
  };
  const shade = (hex, f) => {
    const [r, g, b] = corRGB(hex);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + (f > 0 ? (255 - v) * f : v * f))));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ---------------------------------------------------------------- texturas do chão
  // Grama, areia, pedra e madeira: um ladrilho repetível de ruído fixo (nada tremendo), gerado uma vez por cor.
  const patCache = {};
  const rgbaOf = (hex, f, a) => { const [r0, g0, b0] = corRGB(hex), c = (v) => Math.max(0, Math.min(255, Math.round(v + (f > 0 ? (255 - v) * f : v * f)))); return `rgba(${c(r0)},${c(g0)},${c(b0)},${a})`; };
  function groundKind(hex) {
    const [r, g, b] = corRGB(hex);
    if (b > r + 25 && b > g) return "water";
    if (g >= r && g > b + 12) return "grass";
    if (r > 200 && g > 170 && b < r - 25) return "sand";
    return "stone";
  }
  function pat(base, kind) {
    const key = kind + base;
    if (patCache[key]) return patCache[key];
    const S = 240, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const g = cv.getContext("2d");
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    let seed = 987654321; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const wrap = (x, y, r, fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if (x + dx > -r && x + dx < S + r && y + dy > -r && y + dy < S + r) fn(x + dx, y + dy); };
    for (let i = 0; i < 30; i++) {   // manchas suaves de tom: tiram o aspecto chapado
      const x = rnd() * S, y = rnd() * S, r = 26 + rnd() * 54, f = rnd() < 0.5 ? -0.08 : 0.07;
      wrap(x, y, r, (px, py) => { const gr = g.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, rgbaOf(base, f, 0.55)); gr.addColorStop(1, rgbaOf(base, f, 0)); g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2); });
    }
    if (kind === "grass") {
      for (let i = 0; i < 1100; i++) {   // folhas de grama: riscos curtos, quase de pé
        const x = rnd() * S, y = rnd() * S, l = 4 + rnd() * 6, a = -Math.PI / 2 + (rnd() - 0.5) * 0.9, f = rnd() < 0.55 ? 0.09 : -0.11;
        // contraste mais baixo: com 0,5 de opacidade a grama brigava com a sombra de nuvem que passa por
        // cima e o chão inteiro parecia tremular — o que se lia como "textura bugada"
        wrap(x, y, 10, (px, py) => { g.strokeStyle = rgbaOf(base, f, 0.3); g.lineWidth = 1.1; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); });
      }
    } else if (kind === "sand") {
      for (let i = 0; i < 1500; i++) { const x = rnd() * S, y = rnd() * S, f = rnd() < 0.5 ? -0.14 : 0.1; g.fillStyle = rgbaOf(base, f, 0.32); g.fillRect(x, y, 1 + rnd() * 1.2, 1 + rnd() * 1.2); }
      for (let i = 0; i < 9; i++) { const y = rnd() * S, x = rnd() * S; g.strokeStyle = rgbaOf(base, 0.12, 0.35); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y - 5, x + 60, y); g.stroke(); }   // marcas de ondulação da areia
    } else if (kind === "wood") {
      for (let i = 0; i < 110; i++) { const y = rnd() * S, x = rnd() * S, l = 40 + rnd() * 120, f = rnd() < 0.5 ? -0.09 : 0.07; wrap(x, y, l, (px, py) => { g.strokeStyle = rgbaOf(base, f, 0.38); g.lineWidth = 1 + rnd() * 1.4; g.beginPath(); g.moveTo(px, py); g.bezierCurveTo(px + l * 0.3, py + (rnd() - 0.5) * 3, px + l * 0.6, py + (rnd() - 0.5) * 3, px + l, py); g.stroke(); }); }
    } else {   // pedra / asfalto / ladrilho
      for (let i = 0; i < 1300; i++) { const x = rnd() * S, y = rnd() * S, f = rnd() < 0.5 ? -0.12 : 0.1; g.fillStyle = rgbaOf(base, f, 0.3); g.fillRect(x, y, 1 + rnd() * 1.6, 1 + rnd() * 1.6); }
      for (let i = 0; i < 5; i++) { let x = rnd() * S, y = rnd() * S; g.strokeStyle = rgbaOf(base, -0.25, 0.28); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.3) * 18; y += (rnd() - 0.5) * 14; g.lineTo(x, y); } g.stroke(); }
    }
    return (patCache[key] = ctx.createPattern(cv, "repeat"));
  }
  // preenche um retângulo com a textura do tom dado (mantém a cor base quando a textura não se aplica, como na água)
  function fillTex(hex, x, y, w, h, kind) {
    const k = kind || groundKind(hex);
    ctx.fillStyle = k === "water" ? hex : pat(hex, k);
    ctx.fillRect(x, y, w, h);
  }

  function drawGround() {
    const th = loc.theme || {};
    if (loc.kind === "indoor") {
      const floor = th.floor || "#d9b98c";
      ctx.fillStyle = floor; ctx.fillRect(0, 0, loc.w, loc.h);
      fillTex(floor, 0, WALL_H, loc.w, loc.h - WALL_H, th.tile ? "stone" : "wood");
      // piso: tábuas de madeira ou ladrilhos
      ctx.strokeStyle = shade(floor, -0.1); ctx.lineWidth = 2;
      if (th.tile) { for (let x = 0; x <= loc.w; x += 90) { ctx.beginPath(); ctx.moveTo(x, WALL_H); ctx.lineTo(x, loc.h); ctx.stroke(); } for (let y = WALL_H; y <= loc.h; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(loc.w, y); ctx.stroke(); } }
      else { for (let y = WALL_H + 50; y <= loc.h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(loc.w, y); ctx.stroke(); } for (let y = WALL_H, r = 0; y < loc.h; y += 50, r++) for (let x = (r % 2) * 70; x < loc.w; x += 140) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 50); ctx.stroke(); } }
      if (th.carpet) { ctx.fillStyle = th.carpet; ctx.globalAlpha = 0.28; roundRect(ctx, loc.w * 0.2, WALL_H + 80, loc.w * 0.6, loc.h - WALL_H - 200, 30); ctx.fill(); ctx.globalAlpha = 1; }
      // parede, rodapé e janelas
      ctx.fillStyle = th.wall || "#f2e2c4"; ctx.fillRect(0, 0, loc.w, WALL_H);
      ctx.fillStyle = shade(th.wall || "#f2e2c4", -0.12); ctx.fillRect(0, WALL_H - 26, loc.w, 26);
      ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, WALL_H); ctx.lineTo(loc.w, WALL_H); ctx.stroke();
      const nWin = Math.max(2, Math.floor(loc.w / 380));
      for (let i = 0; i < nWin; i++) {
        const wx = (loc.w / nWin) * (i + 0.5) - 45;
        ctx.fillStyle = "#b8dcf5"; ctx.lineWidth = 4; ctx.fillRect(wx, 28, 90, 78); ctx.strokeRect(wx, 28, 90, 78);
        ctx.beginPath(); ctx.moveTo(wx + 45, 28); ctx.lineTo(wx + 45, 106); ctx.moveTo(wx, 67); ctx.lineTo(wx + 90, 67); ctx.stroke();
      }
      // sombra onde o piso encontra a parede e luz das janelas caindo no chão
      { const sh = ctx.createLinearGradient(0, WALL_H, 0, WALL_H + 56); sh.addColorStop(0, "rgba(20,12,4,0.26)"); sh.addColorStop(1, "rgba(20,12,4,0)"); ctx.fillStyle = sh; ctx.fillRect(0, WALL_H, loc.w, 56);
        ctx.fillStyle = "rgba(255,246,205,0.13)";
        for (let i = 0; i < nWin; i++) { const wx = (loc.w / nWin) * (i + 0.5) - 45; ctx.beginPath(); ctx.moveTo(wx + 10, WALL_H + 4); ctx.lineTo(wx + 86, WALL_H + 4); ctx.lineTo(wx + 190, WALL_H + 250); ctx.lineTo(wx + 70, WALL_H + 250); ctx.closePath(); ctx.fill(); } }
    } else {
      // A ESTAÇÃO PINTA A CIDADE. O chão e a folhagem puxam para a cor da época: o verão mais seco e
      // claro, o outono alaranjado, o inverno acinzentado, a primavera verde. É uma mistura leve — o
      // lugar continua sendo ele mesmo, só que em outra época do ano.
      const chaoBase = th.ground || "#c9e4c0";
      const chao = (typeof Town !== "undefined" && Town.estacao && !th.underwater && !th.boat) ? misturarCor(chaoBase, Town.estacao().chao, 0.3) : chaoBase;
      ctx.fillStyle = chao; ctx.fillRect(0, 0, loc.w, loc.h);
      if (!th.boat && !th.underwater && !th.deck && (!window.Perf || Perf.fancy())) fillTex(chao, 0, 0, loc.w, loc.h);
      const t0 = performance.now() / 800;
      if (th.boat) {          // mar aberto: ondas
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 4;
        for (let y = 60; y < loc.h; y += 90) { ctx.beginPath(); for (let x = 0; x <= loc.w; x += 50) ctx.lineTo(x, y + Math.sin(x / 70 + t0 + y) * 8); ctx.stroke(); }
      }
      if (th.underwater) {    // fundo do mar: luz que some com a profundidade e bolhas
        const g = ctx.createLinearGradient(0, 0, 0, loc.h); g.addColorStop(0, "rgba(120,200,255,0.25)"); g.addColorStop(1, "rgba(5,20,50,0.55)"); ctx.fillStyle = g; ctx.fillRect(0, 0, loc.w, loc.h);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        for (let i = 0; i < 28; i++) { const bx = (i * 173) % loc.w, by = loc.h - ((t0 * 40 + i * 97) % loc.h); ctx.beginPath(); ctx.arc(bx + Math.sin(t0 + i) * 8, by, 4 + (i % 4) * 2, 0, Math.PI * 2); ctx.fill(); }
      }
      if (th.deck) {          // convés: tábuas de madeira
        ctx.strokeStyle = shade(th.ground || "#a8794a", -0.18); ctx.lineWidth = 3;
        for (let y = 0; y <= loc.h; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(loc.w, y); ctx.stroke(); }
        for (let y = 0, r = 0; y < loc.h; y += 46, r++) for (let x = (r % 2) * 90; x < loc.w; x += 180) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 46); ctx.stroke(); }
        if (th.ghost) { ctx.fillStyle = "rgba(120,255,190,0.12)"; ctx.fillRect(0, 0, loc.w, loc.h); }
      }
      if (th.road) {   // rua: calçadas, asfalto com faixa central e faixas de pedestre
        const r = th.road;
        fillTex("#e6dccb", 0, r.y - 130, loc.w, r.h + 260, "stone");
        ctx.strokeStyle = "rgba(90,70,50,0.16)"; ctx.lineWidth = 2;   // calçada de blocos
        for (let yy = r.y - 130; yy < r.y; yy += 32) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(loc.w, yy); ctx.stroke(); }
        for (let yy = r.y + r.h, i = 0; yy < r.y + r.h + 130; yy += 32, i++) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(loc.w, yy); ctx.stroke(); }
        for (let xx = 0; xx < loc.w; xx += 64) { ctx.beginPath(); ctx.moveTo(xx, r.y - 130); ctx.lineTo(xx, r.y); ctx.moveTo(xx, r.y + r.h); ctx.lineTo(xx, r.y + r.h + 130); ctx.stroke(); }
        fillTex("#5a5d6a", 0, r.y, loc.w, r.h, "stone");
        ctx.strokeStyle = "#f4f0e6"; ctx.lineWidth = 6; ctx.setLineDash([46, 34]); ctx.beginPath(); ctx.moveTo(0, r.y + r.h / 2); ctx.lineTo(loc.w, r.y + r.h / 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#f4f0e6";
        for (let cx = 500; cx < loc.w; cx += 1100) for (let k = 0; k < 7; k++) ctx.fillRect(cx + k * 22, r.y + 16, 12, r.h - 32);
        ctx.strokeStyle = ink; ctx.lineWidth = 4;
        [r.y, r.y + r.h].forEach((yy) => { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(loc.w, yy); ctx.stroke(); });
      }
    }
  }

  // fachada de um prédio da rua: telhado, janelas, porta, placa com o nome e o horário; fechado fica escurecido com cadeado
  function drawBuilding(s) {
    const l = locById(s.building);
    if (!l) return;
    const night = dayPhase(state.clock) === "night";
    CityArt.drawBuilding(ctx, s, { id: l.id, name: tx(l.name), emoji: l.emoji, hours: l.hours, open: locOpen(l, state.clock), wall: (l.theme && l.theme.wall) || "#e8dcc8", night }, performance.now());
  }

  function drawSolid(s) {
    if (s.building) return drawBuilding(s);
    if (s.water) {
      ctx.fillStyle = s.color; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 4;
      const t0 = performance.now() / 700;
      for (let y = s.y + 40; y < s.y + s.h; y += 55) { ctx.beginPath(); for (let x = s.x; x <= s.x + s.w; x += 40) ctx.lineTo(x, y + Math.sin(x / 60 + t0 + y) * 6); ctx.stroke(); }
      ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(s.x, s.y + s.h); ctx.lineTo(s.x + s.w, s.y + s.h); ctx.stroke();
      return;
    }
    CityArt.drawSolid(ctx, s, performance.now());
  }

  function drawProp(p) { CityArt.drawProp(ctx, p, performance.now()); }

  function drawStation(s) {
    const closed = s.door && !locOpen(locById(s.action.slice(5)), state.clock);
    CityArt.drawStation(ctx, s, closed, performance.now());
  }

  function drawHouse(h) {
    CityArt.drawHouse(ctx, h, { id: h.caseId, kid: h.kid, name: String((CASES[h.caseId] || { name: "" }).name).split(" ")[0] }, performance.now(), dayPhase(state.clock) === "night");
  }

  // bicicleta e carro desenhados debaixo/na frente da personagem (o barco fica em drawBoat)
  function drawRide(x, y, mode, part) {
    const t = performance.now() / 1000, dir = facing < 0 ? -1 : 1, spin = moving ? t * 14 : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    if (mode === "bike") {
      if (part === "back") {
        ctx.fillStyle = "rgba(21,19,31,0.25)"; ctx.beginPath(); ctx.ellipse(0, 6, 44, 7, 0, 0, 7); ctx.fill();
        [[-26, -12], [26, -12]].forEach(([wx, wy]) => { ctx.strokeStyle = INK_; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(wx, wy, 15, 0, 7); ctx.stroke(); ctx.strokeStyle = "rgba(21,19,31,0.45)"; ctx.lineWidth = 1.5; for (let k = 0; k < 4; k++) { const a = spin + (k * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 14, wy + Math.sin(a) * 14); ctx.lineTo(wx - Math.cos(a) * 14, wy - Math.sin(a) * 14); ctx.stroke(); } });
      } else {
        ctx.strokeStyle = "#d9453a"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-26, -12); ctx.lineTo(-6, -32); ctx.lineTo(14, -12); ctx.lineTo(-6, -12); ctx.closePath(); ctx.moveTo(-6, -32); ctx.lineTo(24, -34); ctx.lineTo(26, -12); ctx.moveTo(24, -34); ctx.lineTo(20, -42); ctx.stroke();
        ctx.strokeStyle = INK_; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, -34); ctx.lineTo(-2, -34); ctx.stroke();
      }
    } else if (mode === "car") {
      if (part === "back") {
        ctx.fillStyle = "rgba(21,19,31,0.28)"; ctx.beginPath(); ctx.ellipse(0, 8, 64, 9, 0, 0, 7); ctx.fill();
        const body = ctx.createLinearGradient(0, -34, 0, 4); body.addColorStop(0, "#e9574a"); body.addColorStop(1, "#b83a30");
        ctx.fillStyle = body; ctx.strokeStyle = INK_; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-64, 0); ctx.lineTo(-64, -16); ctx.quadraticCurveTo(-58, -24, -40, -26); ctx.lineTo(-24, -44); ctx.lineTo(16, -44); ctx.lineTo(38, -26); ctx.quadraticCurveTo(62, -24, 66, -12); ctx.lineTo(66, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#cfe8fa"; ctx.beginPath(); ctx.moveTo(-20, -28); ctx.lineTo(-8, -40); ctx.lineTo(14, -40); ctx.lineTo(28, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
        [-38, 38].forEach((wx) => { ctx.fillStyle = "#2a2a34"; ctx.beginPath(); ctx.arc(wx, 2, 13, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#c9c9d2"; ctx.beginPath(); ctx.arc(wx, 2, 5, 0, 7); ctx.fill(); });
        ctx.fillStyle = "#ffe08a"; ctx.fillRect(60, -14, 8, 6);
      } else { ctx.fillStyle = "rgba(207,232,250,0.55)"; ctx.beginPath(); ctx.moveTo(-20, -28); ctx.lineTo(-8, -40); ctx.lineTo(14, -40); ctx.lineTo(28, -28); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK_; ctx.lineWidth = 3; ctx.stroke(); }
    }
    ctx.restore();
  }
  const INK_ = "#15131f";

  // barquinho de remo debaixo da personagem no mar aberto
  function drawBoat(x, y, part) {
    const t = performance.now() / 1000, bob = Math.sin(t * 2 + x / 90) * 2.2, dir = facing < 0 ? -1 : 1;
    ctx.save(); ctx.translate(x, y + 6 + bob); ctx.scale(dir, 1);
    if (part !== "front") {
      // marolas em volta e sombra na água
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const r = 1 + ((t * 0.9 + k / 3) % 1); ctx.globalAlpha = 0.65 - (r - 1) * 0.6; ctx.beginPath(); ctx.ellipse(0, 10, 58 * r, 16 * r, 0, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (moving) { ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-58, 12); ctx.quadraticCurveTo(-90, 6, -120, 16); ctx.moveTo(-54, 20); ctx.quadraticCurveTo(-86, 26, -112, 34); ctx.stroke(); }   // esteira
      ctx.fillStyle = "rgba(10,40,80,0.25)"; ctx.beginPath(); ctx.ellipse(2, 20, 56, 9, 0, 0, 7); ctx.fill();
      // casco: madeira em tábuas, quilha curva e proa levantada
      const hull = ctx.createLinearGradient(0, -12, 0, 24); hull.addColorStop(0, "#c8894f"); hull.addColorStop(0.55, "#a5693a"); hull.addColorStop(1, "#6e4322");
      ctx.fillStyle = hull; ctx.strokeStyle = ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-58, -8); ctx.quadraticCurveTo(-52, 22, -18, 26); ctx.lineTo(24, 26); ctx.quadraticCurveTo(54, 22, 66, -12); ctx.lineTo(56, -6); ctx.quadraticCurveTo(0, 4, -58, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(60,30,10,0.45)"; ctx.lineWidth = 2;
      [[-50, 6, 56, 8], [-44, 14, 46, 15]].forEach(([x0, y0, x1, y1]) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 5, x1, y1); ctx.stroke(); });
      ctx.fillStyle = "#d9a86a"; ctx.strokeStyle = ink; ctx.lineWidth = 3;   // faixa de cima (borda)
      ctx.beginPath(); ctx.moveTo(-58, -8); ctx.quadraticCurveTo(0, 4, 56, -6); ctx.lineTo(66, -12); ctx.quadraticCurveTo(0, -2, -58, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f4e6c8"; ctx.beginPath(); ctx.arc(64, -10, 3, 0, 7); ctx.fill();   // argola da proa
    } else {
      // banco e remos na frente da personagem
      ctx.fillStyle = "#b47a44"; ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.fillRect(-14, -4, 30, 6); ctx.strokeRect(-14, -4, 30, 6);
      const sw = moving ? Math.sin(t * 6) * 0.55 : Math.sin(t * 1.5) * 0.12;
      [[-1, -30], [1, 30]].forEach(([sd, ox]) => {
        ctx.save(); ctx.translate(ox * 0.6, -2); ctx.rotate(sd * (0.9 + sw));
        ctx.strokeStyle = "#7a4c26"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 54 * sd * -1 * -1); ctx.stroke();
        ctx.fillStyle = "#c8894f"; ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 58 * sd, 6, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.restore();
      });
      ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-56, -8); ctx.quadraticCurveTo(0, 4, 54, -6); ctx.stroke();   // borda na frente do corpo
    }
    ctx.restore();
  }

  // personagens com ilustração própria (pacientes e figuras especiais): o mesmo desenho da consulta, recortado na figura
  const illus = {};
  function illustration(src) {
    let e = illus[src];
    if (e) return e;
    e = illus[src] = { img: new Image(), box: null };
    e.img.onload = () => {
      try {
        const w = 120, h = Math.max(1, Math.round((e.img.naturalHeight * w) / e.img.naturalWidth)), c = document.createElement("canvas");
        c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(e.img, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
        const k = e.img.naturalWidth / w;
        if (x1 > x0 && y1 > y0) e.box = { sx: x0 * k, sy: y0 * k, sw: (x1 - x0 + 1) * k, sh: (y1 - y0 + 1) * k };
      } catch (err) { e.box = null; }
    };
    e.img.src = (window.TEX_DATA && window.TEX_DATA[src]) || src;
    return e;
  }
  // a ilustração existe e carregou? se o arquivo faltar, a pessoa volta para o avatar vetorial em vez
  // de virar um espaço vazio andando pela rua
  // Só o BUSTO anda pela cidade. Houve uma tentativa de pôr um corpo embaixo dele (primeiro perninhas
  // de palito, depois um vulto só da cor da roupa): os dois ficaram com ar de boneco de vareta e o
  // Matheus pediu de volta o busto sozinho, que é como a aquarela foi desenhada. `CORPO_H = 0` mantém a
  // conta de altura (etiqueta do nome, sombra) sem desenhar corpo nenhum.
  // 48 px era pouco: numa tela grande a pessoa virava um selo, e a redução da ilustração (que é grande)
  // para 48 px num passo só, com a suavização padrão, deixava a borda mole — parecia jogo mal
  // otimizado. 66 px e suavização de alta qualidade resolvem as duas coisas.
  const BUSTO_H = 66, CORPO_H = 0;
  function ilustracaoPronta(src) {
    const e = illustration(src);
    return Boolean(e && e.img && (!e.img.complete || e.img.naturalWidth));
  }
  // NOME DE GENTE NA RUA (7.7). Cada pessoa desenhava o próprio nome sem olhar para o vizinho: em
  // praça cheia os nomes se empilhavam e viravam borrão — foi o que apareceu na imagem do parque.
  // Aqui os nomes do quadro são registrados numa lista: quem chega tenta subir um pouco para escapar,
  // e se ainda assim cobrir alguém, fica sem etiqueta. O boneco continua lá, e o nome volta quando a
  // pessoa se afasta — melhor um nome legível do que dois ilegíveis.
  let nomesDoQuadro = [];
  const limparNomes = () => { nomesDoQuadro = []; };
  function desenharNome(texto, x, y) {
    if (!texto) return;
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const larg = ctx.measureText(texto).width + 8, alt = 15;
    let alvoY = null;
    for (const subir of [0, 15, 30]) {
      const cx = { e: x - larg / 2, d: x + larg / 2, t: y - subir - alt, b: y - subir + 3 };
      const bate = nomesDoQuadro.some((n) => n.d > cx.e && n.e < cx.d && n.b > cx.t && n.t < cx.b);
      if (!bate) { alvoY = y - subir; nomesDoQuadro.push({ e: cx.e, d: cx.d, t: cx.t, b: cx.b }); break; }
    }
    if (alvoY === null) return;   // não coube: esta pessoa fica sem etiqueta neste quadro
    ctx.lineWidth = 4; ctx.strokeStyle = "#fdfaf5"; ctx.strokeText(texto, x, alvoY);
    ctx.fillStyle = ink; ctx.fillText(texto, x, alvoY);
  }

  // desenha uma pessoa a partir de uma tela já pronta (o retrato da jogadora, gerado em js/core/retrato.js)
  function drawDoCanvas(x, y, tela, face, name, ring, andando) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    const bob = andando ? Math.abs(Math.sin(performance.now() / 110)) * 3 : 0;
    ctx.fillStyle = "rgba(21,19,31,0.25)"; ctx.beginPath(); ctx.ellipse(x, y + 4, 19, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (ring) { ctx.strokeStyle = "#4f9a6a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 4, 23, 9, 0, 0, Math.PI * 2); ctx.stroke(); }
    const w = (BUSTO_H * tela.width) / tela.height;
    ctx.save(); ctx.translate(x, y - bob - CORPO_H); ctx.scale(face < 0 ? -1 : 1, 1); ctx.drawImage(tela, -w / 2, -BUSTO_H + 10, w, BUSTO_H); ctx.restore();
    const topo = BUSTO_H + CORPO_H;
    desenharNome(name, x, y - topo - 2);
  }
  function drawIllustrated(x, y, src, face, name, ring, andando) {
    const e = illustration(src);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";   // a ilustração encolhe muito: sem isto a borda sai serrilhada
    ctx.fillStyle = "rgba(21,19,31,0.25)"; ctx.beginPath(); ctx.ellipse(x, y + 4, 19, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (ring) { ctx.strokeStyle = ring === "patient" ? "#3f7fd8" : ring === "special" ? "#e0a820" : "#4f9a6a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 4, 23, 9, 0, 0, Math.PI * 2); ctx.stroke(); }
    const pronta = e.img.complete && e.img.naturalWidth;
    const b = e.box || (pronta ? { sx: 0, sy: 0, sw: e.img.naturalWidth, sh: e.img.naturalHeight } : null);
    if (pronta) {
      const w = (BUSTO_H * b.sw) / b.sh;
      ctx.save(); ctx.translate(x, y - CORPO_H); ctx.scale(face < 0 ? -1 : 1, 1); ctx.drawImage(e.img, b.sx, b.sy, b.sw, b.sh, -w / 2, -BUSTO_H + 10, w, BUSTO_H); ctx.restore();
    }
    const topo = BUSTO_H + CORPO_H;
    desenharNome(name, x, y - topo - 2);
  }

  function drawPerson(x, y, look, face, name, isPlayer, ring) {
    if (look && look.creature) {   // moradores da fenda: esponja, estrela-do-mar e lula desenhadas em vetor
      CityArt.drawCreature(ctx, look.creature, x, y, performance.now());
      desenharNome(name, x, y - 84);
      if (ring) { ctx.strokeStyle = ring === "special" ? "#e0a820" : "#4f9a6a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 4, 27, 10, 0, 0, Math.PI * 2); ctx.stroke(); }
      return;
    }
    if (look && look.emoji) {   // criaturas do fundo do mar: um emoji grande no lugar da pessoa
      ctx.fillStyle = "rgba(21,19,31,0.25)"; ctx.beginPath(); ctx.ellipse(x, y + 4, 19, 7, 0, 0, Math.PI * 2); ctx.fill();
      const bob = Math.sin(performance.now() / 500 + x) * 4;
      ctx.font = `62px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = ink;
      ctx.fillText(look.emoji, x, y - 4 + bob);
      desenharNome(name, x, y - 78);
      return;
    }
    // a jogadora tem o retrato desenhado na hora a partir da aparência escolhida
    if (isPlayer && window.Retrato && state.player) {
      try { drawDoCanvas(x, y, Retrato.tela(state.player), face, name, ring, isPlayer && moving); return; } catch (e) { /* cai no desenho de sempre */ }
    }
    if (look && look.img && ilustracaoPronta(look.img)) { drawIllustrated(x, y, look.img, face, name, ring, isPlayer && moving); return; }
    const img = avatarImg(look && look.skin ? look : { skin: "#eab98f", hairStyle: "short", hairColor: "#5a3a26", top: "coat" });
    const bob = isPlayer && moving ? Math.abs(Math.sin(performance.now() / 110)) * 5 : 0;
    ctx.fillStyle = "rgba(21,19,31,0.25)"; ctx.beginPath(); ctx.ellipse(x, y + 4, 19, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (ring) { ctx.strokeStyle = ring === "patient" ? "#3f7fd8" : ring === "special" ? "#e0a820" : "#4f9a6a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 4, 23, 9, 0, 0, Math.PI * 2); ctx.stroke(); }   // aro: azul paciente, verde morador, dourado especial
    const w = 54, h = 65;
    if (img.complete && img.naturalWidth) { ctx.save(); ctx.translate(x, y - bob); ctx.scale(face < 0 ? -1 : 1, 1); ctx.drawImage(img, -w / 2, -h + 6, w, h); ctx.restore(); }
    else { ctx.fillStyle = "#8790dd"; ctx.beginPath(); ctx.arc(x, y - 26, 20, 0, Math.PI * 2); ctx.fill(); }
    desenharNome(name, x, y - h - 4);
  }

  function petsFollow() {
    const owned = window.Pets ? Pets.followers() : [];
    return owned.map((p, i) => {
      const idx = Math.max(0, trail.length - 1 - (i + 1) * 11);
      const pt = trail[idx] || { x: px - 24 * (i + 1), y: py };
      return { x: pt.x, y: pt.y + 8, emoji: p.emoji, size: p.size || 30, tint: p.tint || "", shine: p.shine };
    });
  }

  function drawPet(p) {
    ctx.fillStyle = "rgba(21,19,31,0.22)"; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${p.size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = ink;
    const y = p.y + 2 - (moving ? Math.abs(Math.sin(performance.now() / 130)) * 3 : 0);
    // a raça muda a cor do emoji (mesmo filtro da lista de bichinhos): o hamster branco não vira marrom na rua
    if (p.tint && "filter" in ctx) { ctx.save(); ctx.filter = p.tint; ctx.fillText(p.emoji, p.x, y); ctx.restore(); }
    else ctx.fillText(p.emoji, p.x, y);
    if (p.shine) ctx.fillText("✨", p.x + p.size * 0.35, y - p.size * 0.7);
  }

  function drawWorld() {
    const dpr = canvas._dpr;
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    const zoom = Math.min(1.25, Math.max(0.7, Math.min(cw, ch) / 620));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#2b2838"; ctx.fillRect(0, 0, cw, ch);
    let camX = px - cw / (2 * zoom), camY = py - ch / (2 * zoom);
    camX = Math.max(0, Math.min(loc.w - cw / zoom, camX)); camY = Math.max(0, Math.min(loc.h - ch / zoom, camY));
    if (loc.w * zoom < cw) camX = -(cw / zoom - loc.w) / 2;
    if (loc.h * zoom < ch) camY = -(ch / zoom - loc.h) / 2;
    // A câmera passa a parar em pixel INTEIRO da tela. Andando, ela deslizava em frações de pixel e a
    // textura fina do chão (1100 riscos de grama por ladrilho) era reamostrada a cada quadro: o piso
    // inteiro cintilava e os bichinhos pareciam piscar contra ele.
    camX = Math.round(camX * zoom * dpr) / (zoom * dpr);
    camY = Math.round(camY * zoom * dpr) / (zoom * dpr);
    if (usePixi()) return drawWorldPixi(cw, ch, zoom, camX, camY, dpr);   // renderizador PixiJS (experimental): o Canvas 2D só serve de superfície de toque
    if (rendererNow !== "canvas") { rendererNow = "canvas"; }
    view.zoom = zoom; view.camX = camX; view.camY = camY; view.vw = cw / zoom; view.vh = ch / zoom;
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    ctx.lineJoin = "round";
    drawGround();
    (loc.solids || []).forEach(drawSolid);
    { const nightNow = dayPhase(state.clock) === "night"; (loc.deco || []).forEach((d) => CityArt.drawDeco(ctx, d, performance.now(), nightNow)); }
    houses().forEach(drawHouse);
    limparNomes();   // os nomes de gente são registrados por quadro, para não se cobrirem
    const list = [];
    (loc.props || []).forEach((p) => list.push({ y: p.y + p.s * 0.3, draw: () => drawProp(p) }));
    carros.forEach((c) => list.push({ y: c.y + 12, draw: () => desenharCarro(c) }));
    (loc.stations || []).forEach((s) => list.push({ y: s.y - 300, draw: () => drawStation(s) }));
    npcs.forEach((n) => list.push({ y: n.y, draw: () => drawPerson(n.x, n.y, n.look, n.face || 1, n.walker ? `${Town.badge(n)} ${n.name}` : n.name, false, n.walker ? n.kind : "") }));
    if (trail.length) petsFollow().forEach((p) => list.push({ y: p.y, draw: () => drawPet(p) }));
    if (window.Fauna) { const tnow = performance.now(); Fauna.entries().forEach((e) => list.push({ y: e.y, draw: () => e.draw(ctx, tnow) })); }
    if (window.Nature) Nature.entries().forEach((e) => list.push({ y: e.y - 6, draw: () => e.draw(ctx) }));   // mato, flores, corais…
    list.push({ y: py, draw: () => { const boat = Boolean(loc.theme && loc.theme.boat), md = boat ? "walk" : modeNow(); if (boat) drawBoat(px, py, "back"); else if (md !== "walk") drawRide(px, py, md, "back"); drawPerson(px, py - (boat ? 4 : md === "bike" ? 26 : md === "car" ? 22 : 0), state.player || {}, facing, "", true); if (boat) drawBoat(px, py, "front"); else if (md !== "walk") drawRide(px, py, md, "front"); } });
    list.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    if (goal) {   // marcador do destino clicado
      const pulse = 1 + Math.sin(performance.now() / 160) * 0.18;
      ctx.strokeStyle = "#ff477e"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(goal.x, goal.y + 10, 20 * pulse, 8 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (near) {
      const tgt = near.kind === "station" ? { x: near.ref.x, y: near.ref.y - 40 } : near.kind === "npc" ? { x: near.ref.x, y: near.ref.y - 74 } : { x: near.ref.x + near.ref.w / 2, y: near.ref.y + near.ref.h + 20 };
      const bob = Math.sin(performance.now() / 220) * 5;
      ctx.fillStyle = "#ffd84a"; ctx.strokeStyle = ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tgt.x, tgt.y - 6 + bob); ctx.lineTo(tgt.x - 11, tgt.y - 22 + bob); ctx.lineTo(tgt.x + 11, tgt.y - 22 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // ao entardecer e à noite as áreas externas escurecem; dentro das lojas a luz está acesa
    if (loc.kind !== "indoor") {
      const ph = dayPhase(state.clock);
      if (ph !== "day") { ctx.fillStyle = ph === "night" ? "rgba(12, 16, 58, 0.5)" : "rgba(255, 140, 60, 0.16)"; ctx.fillRect(0, 0, cw, ch); }
    }
    if (!window.Perf || Perf.fancy()) { const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.78); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, loc.kind === "indoor" ? "rgba(30,16,4,0.26)" : "rgba(10,20,10,0.18)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch); }   // vinheta suave nas bordas
    if (window.Nature) Nature.atmosphere(ctx, cw, ch, loc.kind === "indoor" ? "night" : dayPhase(state.clock), Boolean(loc.theme && (loc.theme.underwater || loc.theme.boat)));
    drawMinimap();
  }

  // ---------------------------------------------------------------- renderizador PixiJS (opt-in: Opções → Cidade em WebGL; só no build do Vite)
  // O jogo continua igual (movimento, colisão, teclado, joystick e cliques); só o DESENHO muda de motor:
  //  · camadas do palco: Fundo (chão) e Prédios/Ruas (paredes, decoração, casas) em ladrilhos assados uma vez; Natureza, Personagens e Fauna
  //    como camadas de tela atualizadas a cada quadro; Luz (multiply, pelo relógio do jogo) e Efeitos (atmosfera e vinheta);
  //  · a câmera segue a jogadora com interpolação (lerp) em vez de pular;
  //  · lugares com água animada, mar, barco ou fundo do mar continuam no Canvas 2D (animação por quadro no chão).
  let rendererNow = "canvas", pixiFrames = 0;
  // O Pixi só compensa com placa de vídeo de verdade. Medido aqui (Intel Iris Xe, sem vsync, rua):
  //   GPU real .......... Canvas 133 fps · Pixi 210 fps  → Pixi ganha
  //   render por software  Canvas  18 fps · Pixi   4 fps  → Pixi perde feio
  // Por isso o padrão é automático: liga o Pixi só quando o WebGL não é emulado na CPU.
  let gpuReal = null;
  function temGpuDeVerdade() {
    if (gpuReal !== null) return gpuReal;
    gpuReal = false;
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        const nome = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        gpuReal = !/swiftshader|llvmpipe|softpipe|software|basic render|generic renderer/i.test(nome);
      }
    } catch (e) { gpuReal = false; }
    return gpuReal;
  }
  // settings.cityPixi: true/false = escolha da pessoa; ausente = automático
  const pixiEscolhido = () => (typeof settings === "undefined" || settings.cityPixi === undefined || settings.cityPixi === "auto" ? temGpuDeVerdade() : Boolean(settings.cityPixi));
  const pixiWanted = () => Boolean(window.CityPixi && window.CityPixi.ready() && pixiEscolhido());
  const animatedLoc = () => { const th = (loc && loc.theme) || {}; return Boolean(th.boat || th.underwater || (loc.deco || []).some((d) => ["sea", "boat", "ghost", "whirl"].includes(d.type)) || (loc.solids || []).some((s) => s.water)); };
  const usePixi = () => Boolean(loc) && pixiWanted() && !animatedLoc();
  // o que muda o desenho estático: fase do dia (janelas acesas) e prédios abertos/fechados
  const bakeKey = () => `${dayPhase(state.clock)}|${(loc.solids || []).filter((s) => s.building).map((s) => (locOpen(locById(s.building), state.clock) ? 1 : 0)).join("")}|${houses().length}`;
  function paintStatic(g, x0, y0, w, h, layer) {
    const saved = ctx; ctx = g;
    g.save(); g.translate(-x0, -y0); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); g.lineJoin = "round";
    if (layer === "bg") drawGround();
    else { (loc.solids || []).forEach(drawSolid); const nightNow = dayPhase(state.clock) === "night"; (loc.deco || []).forEach((d) => CityArt.drawDeco(ctx, d, 0, nightNow)); houses().forEach(drawHouse); }
    g.restore(); ctx = saved;
  }
  // cor da luz do dia (multiplica a cena): claro, entardecer quente, noite azulada; ambientes fechados sempre claros
  function lightTint() {
    if (loc.kind === "indoor") return 0xffffff;
    const m = ((Math.round(state.clock) % 1440) + 1440) % 1440, mix = (a, b, t) => { const ch = (c, s) => (c >> s) & 255, f = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };
    const W = 0xffffff, WARM = 0xffcfa8, NIGHT = 0x8a90b8;
    if (m >= 360 && m < 1050) return W;
    if (m >= 1050 && m < 1170) return mix(W, WARM, (m - 1050) / 120);
    if (m >= 1170 && m < 1230) return mix(WARM, NIGHT, (m - 1170) / 60);
    if (m >= 1230 || m < 300) return NIGHT;
    return mix(NIGHT, W, (m - 300) / 60);
  }
  // ---- entidades do Pixi: cada pessoa/bicho/objeto vira um Sprite com textura em cache.
  // A chave da textura descreve só a APARÊNCIA (não a posição): andar pela cidade não reassa ninguém.
  // O que se move é o Sprite; o que anima de verdade (fauna) entra com a fase do movimento na chave.
  function comCtx(g, fn) { const salvo = ctx; ctx = g; try { fn(); } finally { ctx = salvo; } }
  const P_W = 210, P_H = 190, P_AX = 105, P_AY = 152;      // caixa da pessoa: cabe nome, aro, sombra e ilustração (cresceu com o busto, na 7.1)

  function entPessoa(x, y, look, face, nome, aro, bob) {
    const chave = `p|${JSON.stringify(look || {})}|${face}|${nome}|${aro}|${arteCarregada(look) ? 1 : 0}`;
    return {
      key: chave, x, y: y - (bob || 0), z: y, w: P_W, h: P_H, ax: P_AX, ay: P_AY,
      paint: (g) => comCtx(g, () => { g.translate(P_AX - x, P_AY - y); drawPerson(x, y, look, face, nome, false, aro); })
    };
  }
  function entBichinho(p) {
    const chave = `b|${p.emoji}|${p.size}|${p.tint}|${p.shine ? 1 : 0}`;
    const w = p.size * 3 + 40, h = p.size * 3 + 40, ax = w / 2, ay = h - 20;
    return {
      key: chave, x: p.x, y: p.y, z: p.y, w, h, ax, ay,
      paint: (g) => comCtx(g, () => { g.translate(ax - p.x, ay - p.y); drawPet(p); })
    };
  }
  // objeto do cenário e estação: o desenho anima com o relógio, então a fase entra na chave (8 quadros)
  function entObjeto(chave, x, y, z, w, h, ax, ay, desenhar) {
    return { key: chave, x, y, z, w, h, ax, ay, paint: (g) => comCtx(g, () => { g.translate(ax - x, ay - y); desenhar(); }) };
  }

  function entidadesDaCena() {
    const lista = [], agora = performance.now(), fase = Math.floor(agora / 130) % 8;
    // natureza como Sprites: a textura de cada plantinha é assada uma vez por (tipo, tamanho, cor, quadro
    // do balanço) e compartilhada por todas as iguais. Antes eram 222 desenhos à mão por quadro, 8,5 ms
    // na praça — mais de metade do orçamento de 60 fps só em florzinha.
    if (window.Nature && Nature.sprites) {
      Nature.sprites(agora).forEach((n) => lista.push({ key: n.chave, x: n.x, y: n.y, z: n.y, w: n.w, h: n.h, ax: n.ax, ay: n.ay, paint: (g) => comCtx(g, () => { g.translate(n.ax - n.x, n.ay - n.y); n.pintar(g); }) }));
    }
    (loc.props || []).forEach((p) => {
      const w = p.s * 3 + 60, h = p.s * 3 + 60;
      const anima = CityArt.PROPS_ANIMADOS && CityArt.PROPS_ANIMADOS.has(p.e);   // pedra, banco, vaso… não mudam: textura única
      lista.push(entObjeto(`o|${p.e}|${p.s}|${anima ? fase : "fixo"}`, p.x, p.y, p.y + p.s * 0.3, w, h, w / 2, h * 0.72, () => drawProp(p)));
    });
    (loc.stations || []).forEach((st) => {
      lista.push(entObjeto(`s|${st.id}|${stationLabel(st)}|${fase}`, st.x, st.y, st.y - 300, 260, 190, 130, 150, () => drawStation(st)));
    });
    // os carros também no WebGL: a roda gira, então a textura muda com a fase; a posição é do Sprite
    carros.forEach((c, i) => lista.push(entObjeto(`c|${c.cor}|${c.dir}|${fase}|${c.buzina > 0 ? "bz" : ""}`, c.x, c.y, c.y + 12, 200, 150, 100, 110, () => desenharCarro(Object.assign({}, c, { x: c.x, y: c.y })))));
    npcs.forEach((n) => lista.push(entPessoa(n.x, n.y, n.look, n.face || 1, n.walker ? `${Town.badge(n)} ${n.name}` : n.name, n.walker ? n.kind : "", 0)));
    if (trail.length) petsFollow().forEach((p) => lista.push(entBichinho(p)));
    // a jogadora: o balanço ao andar vai na POSIÇÃO do Sprite, não na textura (senão reassava a cada quadro)
    const md = modeNow(), alt = md === "bike" ? 26 : md === "car" ? 22 : 0;
    const bobJog = moving ? Math.abs(Math.sin(agora / 110)) * 5 : 0;
    if (md !== "walk") {
      lista.push(entObjeto(`v|${md}|back|${facing}`, px, py, py - 1, 200, 150, 100, 120, () => drawRide(px, py, md, "back")));
      lista.push(entObjeto(`v|${md}|front|${facing}`, px, py, py + 1, 200, 150, 100, 120, () => drawRide(px, py, md, "front")));
    }
    lista.push(entPessoa(px, py - alt, state.player || {}, facing, "", "", bobJog));
    // marcador do destino e seta de "dá para interagir": pequenos, com a pulsação na chave
    if (goal) {
      const pulso = Math.round((1 + Math.sin(agora / 160) * 0.18) * 20) / 20;
      lista.push(entObjeto(`g|${pulso}`, goal.x, goal.y, 1e6, 120, 90, 60, 35, () => {
        ctx.strokeStyle = "#ff477e"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(goal.x, goal.y + 10, 20 * pulso, 8 * pulso, 0, 0, Math.PI * 2); ctx.stroke();
      }));
    }
    if (near) {
      const tg = near.kind === "station" ? { x: near.ref.x, y: near.ref.y - 40 } : near.kind === "npc" ? { x: near.ref.x, y: near.ref.y - 74 } : { x: near.ref.x + near.ref.w / 2, y: near.ref.y + near.ref.h + 20 };
      const bob = Math.round(Math.sin(agora / 220) * 5);
      lista.push(entObjeto(`n|${bob}`, tg.x, tg.y, 1e6 + 1, 60, 60, 30, 40, () => {
        ctx.fillStyle = "#ffd84a"; ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(tg.x, tg.y - 6 + bob); ctx.lineTo(tg.x - 11, tg.y - 22 + bob); ctx.lineTo(tg.x + 11, tg.y - 22 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
      }));
    }
    return lista;
  }

  function drawWorldPixi(cw, ch, zoom, tx, ty, dpr) {
    rendererNow = "pixi";
    const cam = CityPixi.camera({ x: tx, y: ty, zoom, cw, ch, dpr, dt: frameDt, snap: pixiSnap, locId: loc.id }); pixiSnap = false;
    const camX = cam.x, camY = cam.y;
    view.zoom = zoom; view.camX = camX; view.camY = camY; view.vw = cw / zoom; view.vh = ch / zoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, ch);   // a superfície de toque fica transparente
    CityPixi.tiles({ w: loc.w, h: loc.h, key: bakeKey(), paint: paintStatic });
    const dyn = (name, fn, needed = true) => {
      const g = CityPixi.layer(name, needed); if (!g) return;
      const saved = ctx; ctx = g; g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.scale(zoom, zoom); g.translate(-camX, -camY); g.lineJoin = "round";
      fn(); g.restore(); ctx = saved; CityPixi.commit(name);
    };
    const fauE = window.Fauna ? Fauna.entries() : [];
    // personagens como Sprites (um por pessoa, textura assada uma vez por aparência).
    // Antes isto era uma camada do tamanho da tela, limpa e reenviada à GPU a cada quadro.
    CityPixi.entities(entidadesDaCena());
    dyn("fauna", () => { const tnow = performance.now(); fauE.slice().sort((a, b) => a.y - b.y).forEach((e) => e.draw(ctx, tnow)); }, fauE.length > 0);
    CityPixi.light(lightTint());
    pixiFrames += 1;
    const fx = pixiFrames % 3 === 1 ? CityPixi.layer("fx") : null;   // vinheta e atmosfera se renovam a cada 3 quadros (o resto reaproveita a textura)
    if (fx) {
      const saved = ctx; ctx = fx; fx.setTransform(dpr * 0.5, 0, 0, dpr * 0.5, 0, 0);
      if (!window.Perf || Perf.fancy()) { const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.78); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, loc.kind === "indoor" ? "rgba(30,16,4,0.26)" : "rgba(10,20,10,0.18)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch); }
      if (window.Nature) Nature.atmosphere(ctx, cw, ch, loc.kind === "indoor" ? "night" : dayPhase(state.clock), false);
      ctx = saved; CityPixi.commit("fx");
    }
    CityPixi.render();
    drawMinimap();
  }

  function drawMinimap() {
    const mm = $("city-mini");
    if (!mm) return;
    const mc = mm.getContext("2d");
    const w = mm.width, h = mm.height, s = Math.min(w / loc.w, h / loc.h);
    const ox = (w - loc.w * s) / 2, oy = (h - loc.h * s) / 2;
    mc.clearRect(0, 0, w, h);
    mc.fillStyle = (loc.theme && (loc.theme.floor || loc.theme.ground)) || "#c9e4c0"; mc.fillRect(ox, oy, loc.w * s, loc.h * s);
    (loc.solids || []).forEach((r) => { mc.fillStyle = r.color; mc.strokeStyle = ink; mc.lineWidth = 1; mc.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s); mc.strokeRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s); });
    houses().forEach((r) => { mc.fillStyle = "#c97a5a"; mc.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s); });
    (loc.stations || []).forEach((r) => { mc.fillStyle = r.action === "map" ? "#ff7a45" : "#ffd84a"; mc.beginPath(); mc.arc(ox + r.x * s, oy + r.y * s, 4, 0, Math.PI * 2); mc.fill(); });
    if (view.vw && (view.vw < loc.w || view.vh < loc.h)) { mc.strokeStyle = "rgba(21,19,31,0.75)"; mc.lineWidth = 1.5; mc.strokeRect(ox + view.camX * s, oy + view.camY * s, Math.min(view.vw, loc.w) * s, Math.min(view.vh, loc.h) * s); }   // área que aparece na tela
    mc.fillStyle = "#ff477e"; mc.strokeStyle = "#fff"; mc.lineWidth = 2;
    mc.beginPath(); mc.arc(ox + px * s, oy + py * s, 5, 0, Math.PI * 2); mc.fill(); mc.stroke();
  }

  // ---------------------------------------------------------------- laço
  function frame(now) {
    if (!running) return;
    if (window.Perf && Perf.frameGap() && now - last < Perf.frameGap()) { raf = requestAnimationFrame(frame); return; }   // modo Econômico: 30 quadros por segundo
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now; frameDt = dt;
    step(dt);
    if (window.Fauna) Fauna.update(dt, px, py);
    if (++ambTick % 120 === 0) updateAmbient();   // de tempos em tempos confere se anoiteceu
    drawWorld();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    canvas = $("city-canvas");
    ctx = canvas.getContext("2d");
    if (!loc) enterLocationSilently(cityState().loc || "apartamento");
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const help = $("city-help");
    help.textContent = t(coarse ? "city.help.touch" : "city.help.kb");
    help.classList.remove("gone");
    clearTimeout(helpTimer);
    helpTimer = setTimeout(() => help.classList.add("gone"), 8000);
    fitCanvas();
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // usado só quando a tela da cidade abre sem passar pelo mapa (ex.: carregar um jogo salvo)
  function enterLocationSilently(id) {
    const l = locById(id) || world().locations[0];
    loc = withBuilds(l); px = l.spawn.x; py = l.spawn.y; trail = [];
    spawnFauna(); updateAmbient(); refreshModeBtn();
    npcs = (l.npcs || []).filter(npcHere).map((n) => { const def = npcDef(n.id); return comArte({ id: n.id, def, name: def.name, look: def.creature ? { creature: def.creature } : def.emoji ? { emoji: def.emoji } : def.look, x: n.x, y: n.y, hx: n.x, hy: n.y, tx: n.x, ty: n.y, wait: 1 }); });
    walkerHour = -1; refreshWalkersIfNeeded(true);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    keys.clear();
    joy.active = false;
    closeDlg();
  }

  function init() {
    $("nav-city").addEventListener("click", go);
    $("city-act").addEventListener("click", interact);
    $("city-mapbtn").addEventListener("click", () => { sfx("open"); openMap(); });
    $("city-mode").addEventListener("click", () => {
      state.city = state.city || {};
      // pula os modos que este lugar não aceita, em vez de deixar escolher e ignorar em silêncio
      let i = MODES.indexOf(modeNow());
      for (let k = 0; k < MODES.length; k++) { i = (i + 1) % MODES.length; if (modoPermitido(loc, MODES[i])) break; }
      state.city.mode = MODES[i];
      // entrar no carro estando na calçada travaria você no lugar (o carro só anda no asfalto): em vez
      // de travar, o carro está estacionado na pista e você entra nele
      const rr = pista();
      if (state.city.mode === "car" && rr && (py <= rr.y + 20 || py >= rr.y + rr.h - 20)) {
        py = py < rr.y + rr.h / 2 ? rr.y + rr.h * 0.27 : rr.y + rr.h * 0.73;
        path = []; goal = null; trail = []; pixiSnap = true;
      }
      saveState(); refreshModeBtn(); sfx("click");
      showToast(t("city.mode.hint", { mode: t("city.mode." + state.city.mode) }));
    });
    $("map-mode").addEventListener("click", () => { sfx("click"); setMapMode(mapMode === "street" ? "city" : "street"); });
    $("city-dlg-ok").addEventListener("click", () => { if (!$("city-dlg-ok").onclick) closeDlg(); });
    window.addEventListener("resize", () => { if (running) fitCanvas(); if (screen === "map") fitMap(); });
    document.addEventListener("keydown", (e) => {
      const onMap = screen === "map";
      if ((!running && !onMap) || document.querySelector(".modal:not(.hidden)") || !$("tutor").classList.contains("hidden")) return;
      const k = e.key.toLowerCase();
      if (onMap) {
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) { keys.add(k); e.preventDefault(); }
        else if (k === "e" || k === "enter" || k === " ") { mapEnter(); e.preventDefault(); }
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) { keys.add(k); e.preventDefault(); }
      else if (k === "e" || k === "enter" || k === " ") {
        if (!$("city-dlg").classList.contains("hidden")) { if ($("city-dlg-ok").onclick) $("city-dlg-ok").onclick(); else closeDlg(); } else interact();
        e.preventDefault();
      }
    });
    document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());
    I18N.onChange(() => { if (screen === "map") renderMap(); });

    // joystick de bolinha (toque ou mouse): o da cidade e o do mapa
    const bindJoy = (pad, knob, state2) => {
      const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
      const move = (e) => {
        const r = pad.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2 - 10;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
        state2.x = dx / max; state2.y = dy / max; state2.active = true;
        setKnob(dx, dy);
      };
      pad.addEventListener("pointerdown", (e) => { pad.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
      pad.addEventListener("pointermove", (e) => { if (state2.active) move(e); });
      const release = () => { state2.active = false; state2.x = state2.y = 0; setKnob(0, 0); };
      pad.addEventListener("pointerup", release);
      pad.addEventListener("pointercancel", release);
    };
    bindJoy($("city-joy"), $("city-joy-knob"), joy);
    bindJoy($("map-joy"), $("map-joy-knob"), mjoy);
    $("map-enter").addEventListener("click", mapEnter);
    canvas = $("city-canvas");
    canvas.addEventListener("pointerdown", (e) => {
      if (!running || document.querySelector(".modal:not(.hidden)") || !$("tutor").classList.contains("hidden") || !$("city-dlg").classList.contains("hidden")) return;
      const r = canvas.getBoundingClientRect();
      clickMove((e.clientX - r.left) / view.zoom + view.camX, (e.clientY - r.top) / view.zoom + view.camY);
    });
  }

  return {
    modoPermitido: (id, m) => modoPermitido(locById(id), m),
    modo: () => modeNow(),
    pessoasDetalhe: () => npcs.map((n) => ({ id: n.id || null, kind: n.kind || null, walker: Boolean(n.walker), temDef: Boolean(n.def), img: (n.look && n.look.img) || null })),
    ambientes: () => Object.assign({}, AMBIENT), chaos: () => Object.assign({}, CHAO),   // usados no teste "som": todo lugar precisa de paisagem sonora e de chão conhecido
    pessoasInfo: () => ({ total: npcs.length, aquarela: npcs.filter((n) => n.look && n.look.img).length, vetorial: npcs.filter((n) => n.look && !n.look.img && !n.look.creature && !n.look.emoji).length, outros: npcs.filter((n) => n.look && (n.look.creature || n.look.emoji)).length }),
    init, start, stop, go, openMap, setMapMode, enter: (id) => enterLocation(id, true),
    transito: () => ({ carros: carros.map((c) => ({ x: c.x, y: c.y, dir: c.dir, vel: c.vel })), faixas: faixas(), pista: pista() }),
    pos: () => ({ x: Math.round(px), y: Math.round(py) }),
    warp: (x, y) => { px = x; py = y; trail = []; pixiSnap = true; },
    renderer: () => rendererNow,
    loc: () => (loc ? loc.id : null),
    locations: () => world().locations.map((l) => ({ id: l.id, street: Boolean(l.street), spawn: l.spawn, w: l.w, stations: (l.stations || []).map((s) => ({ id: s.id, x: s.x, y: s.y, action: s.action })) })),
    discovered: () => Object.keys(cityState().visited).length,
    total: () => world().locations.length,
    // ganchos usados pelos testes (tools/testes)
    refreshBuilds, release: () => { talkingTo = null; },
    gpuReal: temGpuDeVerdade, pixiAtivo: pixiEscolhido,
    viewInfo: () => ({ camX: Math.round(view.camX), camY: Math.round(view.camY), zoom: +(view.zoom || 0).toFixed(3), vw: Math.round(view.vw), vh: Math.round(view.vh) }),
    walkers: () => npcs.filter((n) => n.walker).map((n) => ({ id: n.id, kind: n.kind, name: n.name, x: n.x, y: n.y })),
    residents: () => npcs.filter((n) => !n.walker).map((n) => n.id),
    refreshWalkers: () => { walkerHour = -1; refreshWalkersIfNeeded(true); },
    blocked: (x, y) => collides(x, y),
    isOpen: (id, minutes) => locOpen(locById(id), minutes),
    clickWorld: (x, y) => clickMove(x, y),
    mapPos: () => ({ x: mapPos.x, y: mapPos.y }),
    mapWarp: (x, y) => { mapPos = { x, y }; const car = $("map-car"); car.style.transition = "none"; car.style.left = `${x}%`; car.style.top = `${y}%`; },
    mapNear: () => (mapNear ? mapNear.id : null),
    tick: (dt) => step(dt),
    walking: () => path.length > 0,
    canReach: (x, y) => Boolean(planPath(px, py, x, y)),
    use: (stationId) => { const st = loc && (loc.stations || []).find((x) => x.id === stationId); if (st) runAction(st); return Boolean(st); },
    misturarCor: (a2, b2, k) => misturarCor(a2, b2, k),   // exposto para o teste do chão: a mistura da estação tem de sair legível pela textura
    nomesDoQuadro: () => nomesDoQuadro.slice()            // caixas dos nomes desenhados no último quadro (teste de legibilidade da rua)
  };
})();

window.City = City;

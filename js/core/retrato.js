"use strict";

// ===========================================================================
// Retrato em aquarela da psicóloga, desenhado no navegador a partir da aparência escolhida.
//
// O traço é o mesmo dos 15 pacientes (tools/python/desenhar-personagens.py, que gera os PNGs
// em assets/). Aqui o motor foi portado para Canvas 2D porque o retrato da psicóloga não pode
// ser um arquivo pronto: ela é personalizável, então o desenho só existe depois que o jogador
// escolhe pele, cabelo, olhos, boca e roupa. Mesmas proporções (620×735), mesmas camadas e a
// mesma aleatoriedade com semente — o mesmo visual devolve sempre o mesmo rosto.
//
// Uso:  Retrato.pintar(canvas, Retrato.doJogador(state.player))
//       Retrato.url(cfg)   → data:image/png, para <img> (fica em cache por aparência)
// ===========================================================================
const Retrato = (() => {
  const W = 620, H = 735, SS = 2;            // SS: desenha no dobro e reduz na hora de mostrar (antisserrilhado)

  // ---------------------------------------------------------------- cor e acaso
  function rgb(hex) {
    const h = String(hex || "#000").replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function tom(hex, f) {   // f > 0 clareia, f < 0 escurece (mesma conta do gerador em Python)
    const [r, g, b] = rgb(hex);
    const m = f >= 0 ? (v) => v + (255 - v) * f : (v) => v * (1 + f);
    return `rgb(${Math.round(m(r))},${Math.round(m(g))},${Math.round(m(b))})`;
  }
  const alfa = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
  // mesma cor de `tom`, mas com transparência (as aguadas do rosto e o contorno de lápis)
  function tomA(hex, f, a) {
    const [r, g, b] = rgb(hex);
    const m = f >= 0 ? (v) => v + (255 - v) * f : (v) => v * (1 + f);
    return `rgba(${Math.round(m(r))},${Math.round(m(g))},${Math.round(m(b))},${a})`;
  }

  // gerador com semente: a mesma aparência tem de dar sempre o mesmo rosto, senão o retrato
  // "tremia" a cada redesenho da tela de criação
  function semente(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function acaso(s) {
    let a = s >>> 0;
    const f = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.uni = (lo, hi) => lo + f() * (hi - lo);
    f.um = (arr) => arr[Math.floor(f() * arr.length)];
    return f;
  }

  // ---------------------------------------------------------------- camadas
  function camada() {
    const c = document.createElement("canvas");
    c.width = W * SS; c.height = H * SS;
    const x = c.getContext("2d");
    x.lineJoin = "round"; x.lineCap = "round";
    return { c, x };
  }

  // ---------------------------------------------------------------- formas (mesmas funções do gerador)
  function suavizar(vals, k) {
    const n = vals.length;
    return vals.map((_, i) => { let s = 0; for (let j = -k; j <= k; j++) s += vals[(i + j + n * 2) % n]; return s / (2 * k + 1); });
  }
  // contorno orgânico: elipse com ruído suavizado na borda (e queixo afinado embaixo)
  function bolha(cx, cy, rx, ry, rnd, jit, n, chin) {
    jit = jit === undefined ? 5 : jit; n = n || 100; chin = chin || 0;
    const ruido = suavizar(Array.from({ length: n }, () => rnd.uni(-jit, jit)), 5);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = 2 * Math.PI * i / n;
      let x = Math.cos(t) * (rx + ruido[i]);
      const y = Math.sin(t) * (ry + ruido[i]);
      if (y > 0 && chin) x *= 1 - chin * Math.pow(y / ry, 2);
      pts.push([cx + x, cy + y]);
    }
    return pts;
  }
  // risco curvo com tremor de mão livre
  function curva(p0, p1, bend, rnd, passos, wob) {
    passos = passos || 12; wob = wob === undefined ? 0.5 : wob;
    const [x0, y0] = p0, [x1, y1] = p1;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const cx = (x0 + x1) / 2 + (-dy / L) * bend, cy = (y0 + y1) / 2 + (dx / L) * bend;
    const out = [];
    for (let i = 0; i <= passos; i++) {
      const t = i / passos, u = 1 - t;
      out.push([u * u * x0 + 2 * u * t * cx + t * t * x1 + rnd.uni(-wob, wob),
                u * u * y0 + 2 * u * t * cy + t * t * y1 + rnd.uni(-wob, wob)]);
    }
    return out;
  }
  function risco(x, pts, cor, larg) {
    if (pts.length < 2) return;
    x.strokeStyle = cor; x.lineWidth = Math.max(1, larg * SS);
    x.beginPath(); x.moveTo(pts[0][0] * SS, pts[0][1] * SS);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0] * SS, pts[i][1] * SS);
    x.stroke();
  }
  function caminho(x, pts) {
    x.beginPath(); x.moveTo(pts[0][0] * SS, pts[0][1] * SS);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0] * SS, pts[i][1] * SS);
    x.closePath();
  }
  function chapa(x, pts, cor) { x.fillStyle = cor; caminho(x, pts); x.fill(); }
  function elipse(x, cx, cy, rx, ry, cor, contorno, larg) {
    x.beginPath(); x.ellipse(cx * SS, cy * SS, rx * SS, ry * SS, 0, 0, Math.PI * 2);
    if (cor) { x.fillStyle = cor; x.fill(); }
    if (contorno) { x.strokeStyle = contorno; x.lineWidth = (larg || 2) * SS; x.stroke(); }
  }

  // Ponto dentro do polígono (lançamento de raio). O gerador em Python testava pixel a pixel numa
  // máscara em bitmap; aqui a conta fecha em microssegundos e poupa três telas cheias por chamada.
  function dentroDo(pts, x, y) {
    let d = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
    }
    return d;
  }
  // Polígono afastado do centro: faz o papel do MaxFilter do Python (deixar os riscos vazarem um
  // pouco para fora do contorno, que é o que dá o ar de desenho à mão).
  function inchar(pts, d) {
    if (!d) return pts;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return pts.map(([x, y]) => { const m = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / m * d, y + (y - cy) / m * d]; });
  }

  // Preenche uma região com muitos riscos, como o cabelo desenhado à mão.
  function riscosEm(x, base, paleta, rnd, n, fluxo, op) {
    op = op || {};
    const comp = op.comp || [70, 150], larg = op.larg || [1.6, 3.4], curv = op.curv || [-14, 14], dil = op.dil === undefined ? 6 : op.dil;
    const xs = base.map((p) => p[0]), ys = base.map((p) => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    x.save();
    caminho(x, inchar(base, dil)); x.clip();
    let feitos = 0, tentativas = 0;
    while (feitos < n && tentativas < n * 30) {
      tentativas++;
      const px = rnd.uni(minx, maxx), py = rnd.uni(miny, maxy);
      if (!dentroDo(base, px, py)) continue;
      const [dx, dy] = fluxo(px, py), L = rnd.uni(comp[0], comp[1]), mag = Math.hypot(dx, dy) || 1;
      risco(x, curva([px, py], [px + dx / mag * L, py + dy / mag * L], rnd.uni(curv[0], curv[1]), rnd), rnd.um(paleta), rnd.uni(larg[0], larg[1]));
      feitos++;
    }
    x.restore();
  }
  // mesma coisa, quando a parte quer a chapa de cor e os riscos de uma vez
  function chapaRiscada(x, pts, cor, paleta, rnd, n, fluxo, op) {
    chapa(x, pts, cor);
    riscosEm(x, pts, paleta, rnd, n, fluxo, op);
  }

  // inclinação da cabeça: gira o próprio contexto em vez de girar uma camada inteira
  function inclinar(x, graus, cx, cy) {
    x.translate(cx * SS, cy * SS); x.rotate(-graus * Math.PI / 180); x.translate(-cx * SS, -cy * SS);
  }

  // ---------------------------------------------------------------- partes do desenho
  function tronco(x, cfg, rnd) {
    const c = cfg.shirt_kind === "under" ? cfg.skin : cfg.shirt;
    const pts = [[120, 735], [150, 660], [205, 596], [262, 556], [310, 574], [358, 556], [415, 596], [470, 660], [500, 735]]
      .map(([x, y]) => [x + rnd.uni(-4, 4), y + rnd.uni(-3, 3)]);
    chapaRiscada(x, pts, c, [tom(c, .14), tom(c, -.10), c, tom(c, .06)], rnd, 55,
      () => [rnd.uni(-1, 1), rnd.uni(-.4, 1)], { comp: [40, 90], larg: [9, 16], curv: [-10, 10], dil: 0 });
    const borda = tom(c, -.30);
    if (cfg.shirt_kind === "stripes") {
      x.save(); caminho(x, pts); x.clip();
      for (let k = 0; k < 4; k++) { const y0 = 640 + k * 28; risco(x, curva([100, y0], [520, y0 + rnd.uni(-4, 4)], 6, rnd), cfg.stripe, 11); }
      x.restore();
    }
    for (let k = 0; k < 2; k++) {
      const jit = (p) => [p[0] + rnd.uni(-2, 2), p[1] + rnd.uni(-2, 2)];
      risco(x, pts.slice(0, 6).map(jit), borda, 3.2 - k);
      risco(x, pts.slice(5).map(jit), borda, 3.2 - k);
    }
    if (cfg.shirt_kind === "hoodie") {
      risco(x, curva([262, 556], [300, 640], 10, rnd), borda, 3);
      risco(x, curva([358, 556], [322, 640], -10, rnd), borda, 3);
      [290, 332].forEach((px) => risco(x, curva([px, 600], [px + (px > 300 ? 4 : -4), 690], 4, rnd), "#ececec", 4));
    }
    if (cfg.shirt_kind === "tshirt") {
      risco(x, curva([262, 556], [310, 600], 18, rnd), borda, 3);
      risco(x, curva([358, 556], [310, 600], 18, rnd), borda, 3);
    }
    // Cada peça da loja tem o SEU desenho. Até a 6.0 os seis estilos caíam em dois ("collar" e
    // "tshirt"): trocar de jaleco para vestido mudava só a cor do borrão, e o Ψ do jaleco de psicologia
    // — que é a roupa padrão — não existia na aquarela.
    if (cfg.shirt_kind === "coat" || cfg.shirt_kind === "blazer") {
      const gola = cfg.shirt_kind === "coat" ? "#f7f5f2" : tom(c, -.18);
      [-1, 1].forEach((sd) => {
        const g = [[310, 578], [310 + sd * 74, 560], [310 + sd * 92, 640], [310 + sd * 30, 700]];
        x.fillStyle = gola; x.strokeStyle = borda; x.lineWidth = 2.4 * SS;
        caminho(x, g); x.fill(); x.stroke();
      });
      risco(x, curva([310, 690], [310, 735], 0, rnd), borda, 2.6);                     // fechamento
      if (cfg.shirt_kind === "blazer") elipse(x, 310, 706, 8, 8, tom(c, -.34), borda, 1.6);
      risco(x, [[392, 672], [452, 672], [452, 716], [392, 716], [392, 672]], borda, 2); // bolso do peito
    } else if (cfg.shirt_kind === "sweater") {
      risco(x, curva([266, 560], [354, 560], 26, rnd), borda, 9);                       // gola redonda grossa
      for (let k = 0; k < 5; k++) risco(x, curva([150 + k * 84, 716], [152 + k * 84, 735], 2, rnd), tom(c, -.16), 4);   // canelado da barra
    } else if (cfg.shirt_kind === "dress") {
      risco(x, curva([250, 566], [370, 566], 34, rnd), borda, 3);                       // decote largo
      [-1, 1].forEach((sd) => risco(x, curva([310 + sd * 56, 570], [310 + sd * 74, 596], 4, rnd), borda, 6));   // alças
    } else if (cfg.shirt_kind === "shirt") {
      [-1, 1].forEach((sd) => {
        const g = [[310, 592], [310 + sd * 24, 556], [310 + sd * 58, 568], [310 + sd * 32, 616]];
        x.fillStyle = tom(c, .16); x.strokeStyle = borda; x.lineWidth = 2.2 * SS;
        caminho(x, g); x.fill(); x.stroke();
      });
      risco(x, [[310, 600], [310, 735]], borda, 2.4);
      [648, 700].forEach((y) => elipse(x, 310, y, 6, 6, tom(c, -.3)));
    }
    // MOLDES NOVOS. Uma roupa que muda só de cor não é outra roupa: cada uma destas tem um traço que
    // se reconhece de longe, e é o mesmo traço do modelo 3D — o retrato e o boneco vestem a mesma peça.
    if (cfg.shirt_kind === "polo") {
      [-1, 1].forEach((sd) => {
        const g = [[310, 600], [310 + sd * 26, 560], [310 + sd * 54, 574], [310 + sd * 30, 614]];
        x.fillStyle = tom(c, .14); x.strokeStyle = borda; x.lineWidth = 2.2 * SS;
        caminho(x, g); x.fill(); x.stroke();
      });
      risco(x, [[310, 604], [310, 664]], borda, 2.6);                                  // a carcela curta, só até o peito
      [618, 650].forEach((y) => elipse(x, 310, y, 5, 5, tom(c, -.32)));
    } else if (cfg.shirt_kind === "turtleneck") {
      x.fillStyle = tom(c, .1); x.strokeStyle = borda; x.lineWidth = 2.6 * SS;
      caminho(x, [[268, 556], [352, 556], [356, 512], [264, 512]]); x.fill(); x.stroke();   // a gola subindo pelo pescoço
      for (let k = 0; k < 4; k++) risco(x, curva([272 + k * 26, 516], [272 + k * 26, 552], 1, rnd), tom(c, -.14), 3);
    } else if (cfg.shirt_kind === "cardigan") {
      x.fillStyle = "#f2eee6"; x.strokeStyle = borda; x.lineWidth = 2.2 * SS;
      caminho(x, [[276, 566], [344, 566], [344, 735], [276, 735]]); x.fill(); x.stroke();   // a camiseta por baixo
      [-1, 1].forEach((sd) => {
        const g = [[310 + sd * 34, 560], [310 + sd * 96, 572], [310 + sd * 96, 735], [310 + sd * 34, 735]];
        x.fillStyle = tom(c, -.12); x.strokeStyle = borda; x.lineWidth = 2.4 * SS;
        caminho(x, g); x.fill(); x.stroke();
      });
      [604, 654, 704].forEach((y) => elipse(x, 288, y, 6, 6, "#f7f3ea", borda, 1.4));       // os botões de um lado só
    } else if (cfg.shirt_kind === "tank") {
      x.fillStyle = cfg.skin; x.strokeStyle = borda; x.lineWidth = 2.2 * SS;
      caminho(x, [[250, 560], [370, 560], [356, 626], [264, 626]]); x.fill(); x.stroke();   // ombro e peito à mostra
      [-1, 1].forEach((sd) => risco(x, curva([310 + sd * 46, 562], [310 + sd * 62, 628], 3, rnd), c, 14));   // as alças finas
    } else if (cfg.shirt_kind === "tunic") {
      risco(x, curva([262, 560], [358, 560], 20, rnd), borda, 3);
      risco(x, [[302, 566], [318, 566], [318, 672], [302, 672], [302, 566]], tom(c, -.3), 3);   // a abertura bordada
      for (let k = 0; k < 6; k++) elipse(x, 310, 580 + k * 18, 4, 4, tom(c, .3));
      risco(x, curva([196, 735], [424, 735], 8, rnd), tom(c, -.22), 7);                    // a barra comprida
    } else if (cfg.shirt_kind === "overall") {
      x.fillStyle = tom(c, -.26); x.strokeStyle = borda; x.lineWidth = 2.4 * SS;
      caminho(x, [[258, 618], [362, 618], [362, 735], [258, 735]]); x.fill(); x.stroke();  // o peitilho
      [-1, 1].forEach((sd) => {
        x.fillStyle = tom(c, -.26);
        caminho(x, [[310 + sd * 34, 616], [310 + sd * 58, 616], [310 + sd * 74, 556], [310 + sd * 52, 552]]);
        x.fill(); x.stroke();                                                              // as alças por cima do ombro
        elipse(x, 310 + sd * 46, 626, 6, 6, "#d9c07a", borda, 1.4);                        // as fivelas
      });
    }
    if (cfg.shirt_kind === "under") {
      // o provador mostra a peça de baixo: o tronco vem em pele e só a peça fica desenhada
      const u = cfg.under || "#e8e2d8", ub = tom(u, -.3);
      x.fillStyle = u; x.strokeStyle = ub; x.lineWidth = 2.6 * SS;
      caminho(x, [[248, 620], [310, 606], [372, 620], [366, 682], [310, 668], [254, 682]]); x.fill(); x.stroke();
      [-1, 1].forEach((sd) => risco(x, curva([310 + sd * 58, 616], [310 + sd * 40, 560], 4, rnd), u, 9));   // as alças
      risco(x, curva([250, 660], [370, 660], -4, rnd), ub, 3);
      risco(x, curva([180, 735], [440, 735], 6, rnd), u, 20);                                              // a peça de baixo, na barra
    }
    if (cfg.shirt_kind === "collar") {
      [-1, 1].forEach((s) => {
        const g = [[310, 600], [310 + s * 20, 556], [310 + s * 62, 566], [310 + s * 34, 622]];
        x.fillStyle = "#f4f4f4"; x.strokeStyle = borda; x.lineWidth = 2 * SS;
        caminho(x, g); x.fill(); x.stroke();
      });
      risco(x, [[310, 600], [310, 735]], borda, 2.4);
      [640, 690].forEach((y) => elipse(x, 310, y + 6, 6, 6, tom(c, -.3)));
    }
  }

  // O Ψ bordado no jaleco: é a marca da roupa padrão de psicologia e estava só no 3D
  function marcaDoPeito(x, cfg, rnd) {
    if (cfg.mark !== "psi") return;
    x.save();
    x.translate(228 * SS, 690 * SS);
    x.rotate(-0.06);
    x.fillStyle = "rgba(38,32,54,0.82)";
    x.font = `bold ${52 * SS}px Georgia, "Times New Roman", serif`;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("Ψ", 0, 0);
    x.restore();
  }

  function pescoco(x, cfg) {
    chapa(x, [[258, 470], [362, 470], [372, 560], [310, 585], [250, 560]], tom(cfg.skin, -.06));
  }

  function rosto(x, cfg, rnd) {
    const c = cfg.skin, [fx, fy, frx, fry] = cfg.face;
    const pts = bolha(fx, fy, frx, fry, rnd, 4, 100, cfg.chin);
    chapaRiscada(x, pts, c, [tomA(c, .07, .43), tomA(c, -.07, .35)], rnd, 70,
      () => [rnd.uni(-1, 1), rnd.uni(-1, 1)], { comp: [20, 50], larg: [4, 8], curv: [-6, 6], dil: 0 });
    for (let k = 0; k < 3; k++) {                       // contorno de lápis em várias passadas
      const off = pts.map(([px, py]) => [px + rnd.uni(-2.2, 2.2), py + rnd.uni(-2.2, 2.2)]);
      risco(x, k ? off.slice(8, -8) : off, tomA(c, -.16, .59), 1.7);
    }
    // O RETRATO É ONDE SE VÊ A PESSOA. Era o boneco 3D que dizia se alguém é homem ou mulher, e a
    // aquarela — que é a que aparece ao lado do balão de fala — desenhava a mesma cara para todos.
    // Daí um senhor sair com cara de senhora justamente no lugar em que você olha para ele.
    if (cfg.corpo === "m") {
      // a raspa da barba: ponto a ponto, colada no maxilar e no queixo — nada de borrão, que suja o traço
      for (let k = 0; k < 150; k++) {
        const t2 = rnd.uni(0, 1), px2 = fx - frx * .84 + t2 * frx * 1.68;
        const alto = fy + fry * .58 - Math.sin(t2 * Math.PI) * fry * .12;
        const baixo = fy + fry * .62 + Math.sin(t2 * Math.PI) * fry * .42;
        elipse(x, px2, rnd.uni(alto, baixo), rnd.uni(1.5, 2.8), rnd.uni(1.5, 2.8), tomA(c, -.32, .48));
      }
      risco(x, curva([fx - frx * .9, fy + fry * .3], [fx - frx * .34, fy + fry * 1.0], 10, rnd), tomA(c, -.3, .5), 3.4);   // o maxilar, mais anguloso
      risco(x, curva([fx + frx * .9, fy + fry * .3], [fx + frx * .34, fy + fry * 1.0], -10, rnd), tomA(c, -.3, .5), 3.4);
    }
    x.save();                                            // bochechas: o borrão sai do próprio contexto
    x.filter = `blur(${9 * SS}px)`;
    const corBochecha = alfa(cfg.blush, (cfg.blush_a || 60) / 255);
    [-1, 1].forEach((s) => elipse(x, fx + s * 88, fy + 68, 34, 22, corBochecha));
    x.restore();
  }

  function orelhas(x, cfg, rnd, geo) {
    const [fx, fy, frx] = geo, c = cfg.skin;
    [-1, 1].forEach((s) => {
      const ox = fx + s * (frx - 4);
      elipse(x, ox, fy + 5, 22, 34, tom(c, -.05));
      risco(x, curva([ox - s * 8, fy - 12], [ox - s * 8, fy + 28], s * 6, rnd), tom(c, -.25), 2.5);
    });
  }

  function olhos(x, cfg, rnd, geo) {
    const [fx, fy] = geo;
    const ey = fy + cfg.eye_y, sep = cfg.eye_sep, sc = cfg.eye_scale;
    const [lookx, looky] = cfg.look;
    [-1, 1].forEach((s) => {
      const cx = fx + s * sep, w = 40 * sc, h = 19 * sc;
      const topo = curva([cx - w, ey + 3], [cx + w, ey + 3], -h * 2.1, rnd, 12, .3);
      const baixo = curva([cx - w, ey + 3], [cx + w, ey + 3], h * 1.3, rnd, 12, .3);
      x.fillStyle = "#f6ebe0"; caminho(x, topo.concat(baixo.slice().reverse())); x.fill();
      const ir = 15 * sc, ix = cx + lookx, iy = ey + 2 + looky;
      elipse(x, ix, iy, ir, ir, cfg.iris);
      elipse(x, ix - 3 * sc, iy - 6 * sc, 2 * sc, 2 * sc, "#f6ebe0");
      risco(x, topo, cfg.lid, 4.2);
      risco(x, baixo, tom(cfg.skin, -.25), 1.8);
      risco(x, [[cx + s * (w - 2), ey + 1], [cx + s * (w + 9), ey - 6]], cfg.lid, 3);
      if (cfg.brow_w > 0) {                              // sobrancelha
        const inner = cfg.brow_inner, by = ey - 40 * sc - (cfg.brow_lift || 0);
        risco(x, curva([cx - s * 34 * sc, by - inner], [cx + s * 34 * sc, by + inner * .3], -6, rnd), cfg.brow, cfg.brow_w);
      }
    });
  }

  function narizBoca(x, cfg, rnd, geo) {
    const [fx, fy] = geo, c = tom(cfg.skin, -.22);
    const ny = fy + cfg.nose_y;
    risco(x, curva([fx - 5, ny - 30], [fx - 8, ny], 5, rnd), c, 2);
    risco(x, curva([fx - 20, ny + 6], [fx + 20, ny + 6], 12, rnd), c, 2.6);
    risco(x, curva([fx - 20, ny + 6], [fx - 16, ny - 2], -3, rnd), c, 2.2);
    risco(x, curva([fx + 20, ny + 6], [fx + 16, ny - 2], 3, rnd), c, 2.2);
    const my = fy + cfg.mouth_y, mc = "#b0645a", m = cfg.mouth;
    if (m === "grin") {
      const baixo = curva([fx - 40, my - 4], [fx + 40, my - 4], 26, rnd, 12, .2);
      const topo = curva([fx - 40, my - 4], [fx + 40, my - 4], -2, rnd, 12, .2);
      x.fillStyle = "#7a2f2f"; caminho(x, topo.concat(baixo.slice().reverse())); x.fill();
      x.fillStyle = "#f4efe8"; caminho(x, curva([fx - 34, my], [fx + 34, my], -2, rnd, 12, .1).concat(curva([fx + 34, my], [fx - 34, my], 2, rnd, 12, .1))); x.fill();
      risco(x, topo, mc, 3);
    } else if (m === "worried") {
      risco(x, curva([fx - 24, my + 3], [fx + 24, my + 1], -7, rnd), mc, 3);
      risco(x, curva([fx - 12, my + 12], [fx + 12, my + 12], 3, rnd), tom(cfg.skin, -.12), 2);
    } else if (m === "open") {
      elipse(x, fx, my + 4, 15, 12, "#8a3a3a");
      risco(x, curva([fx - 16, my - 8], [fx + 16, my - 8], -3, rnd), mc, 2.5);
    } else if (m === "down") {
      risco(x, curva([fx - 22, my + 6], [fx + 22, my + 6], -9, rnd), mc, 3);
    } else if (m === "smirk") {                          // canto de um lado só: o sorriso torto do jogo
      risco(x, curva([fx - 26, my + 4], [fx + 26, my - 6], 5, rnd), mc, 3);
      risco(x, curva([fx + 18, my - 6], [fx + 27, my - 12], 2, rnd), mc, 2.2);
    } else if (m === "smile") {
      risco(x, curva([fx - 28, my - 2], [fx + 28, my - 2], 12, rnd), mc, 3);
    } else {
      risco(x, curva([fx - 26, my], [fx + 26, my + 1], 4, rnd), mc, 3);
    }
  }

  function extras(x, cfg, rnd, geo) {
    const [fx, fy, frx] = geo;
    const ey = fy + cfg.eye_y, sep = cfg.eye_sep;
    (cfg.acc || []).forEach((a) => {
      if (a === "glasses") {
        [-1, 1].forEach((s) => elipse(x, fx + s * sep, ey + 3, 52, 37, null, "#2f2622", 5));
        risco(x, curva([fx - 20, ey], [fx + 20, ey], -8, rnd), "#2f2622", 4);
        risco(x, [[fx - sep - 52, ey], [fx - frx + 8, ey - 4]], "#2f2622", 4);
        risco(x, [[fx + sep + 52, ey], [fx + frx - 8, ey - 4]], "#2f2622", 4);
      }
      if (a === "freckles") {
        for (let i = 0; i < 16; i++) {
          const s = rnd.um([-1, 1]), r = rnd.uni(2, 3.6);
          elipse(x, fx + s * rnd.uni(28, 100), fy + rnd.uni(14, 62), r, r, "#c47f56");
        }
      }
      if (a === "bags") {
        [-1, 1].forEach((s) => {
          const cx = fx + s * sep;
          risco(x, curva([cx - 30, ey + 30], [cx + 30, ey + 30], 8, rnd), tom(cfg.skin, -.22), 2.6);
          risco(x, curva([cx - 22, ey + 38], [cx + 22, ey + 38], 6, rnd), tom(cfg.skin, -.15), 2);
        });
      }
      if (a === "earrings") {
        [-1, 1].forEach((s) => elipse(x, fx + s * (frx - 2), fy + 52, 8, 8, "#f2c230", "#a07a1c", 2));
      }
    });
  }

  function cabeloAtras(x, cfg, rnd) {
    const st = cfg.hair_style, pal = cfg.hair_pal;
    if (st === "bob") {
      const pts = [[135, 320], [150, 190], [215, 105], [310, 80], [405, 105], [470, 190], [487, 320], [490, 460], [445, 505], [380, 470], [310, 455], [240, 470], [175, 505], [130, 460]]
        .map(([x, y]) => [x + rnd.uni(-5, 5), y + rnd.uni(-5, 5)]);
      return chapaRiscada(x, pts, pal[0], pal, rnd, 260, (px) => [(px - 310) * .10, 1], { comp: [60, 120], dil: 4 });
    }
    if (st === "long") {
      const pts = [[130, 320], [150, 190], [215, 105], [310, 80], [405, 105], [470, 190], [490, 320], [492, 470], [480, 610], [440, 640],
                   [380, 560], [310, 520], [240, 560], [180, 640], [140, 610], [128, 470]]
        .map(([x, y]) => [x + rnd.uni(-5, 5), y + rnd.uni(-5, 5)]);
      return chapaRiscada(x, pts, pal[0], pal, rnd, 320, (px) => [(px - 310) * .10, 1], { comp: [90, 200], dil: 4 });
    }
    // PENTEADOS NOVOS. Onze opções caíam em cinco desenhos: coque virava chanel, afro virava cacheado,
    // raspado virava curto. As personalizações iniciais ficavam todas parecidas porque o traço não
    // distinguia o que o jogo deixava escolher.
    if (st === "bun") {
      const cap = [[152, 305], [168, 178], [230, 100], [310, 78], [390, 100], [452, 178], [468, 305], [400, 268], [310, 250], [220, 268]]
        .map(([x, y]) => [x + rnd.uni(-4, 4), y + rnd.uni(-4, 4)]);
      chapaRiscada(x, cap, pal[0], pal, rnd, 180, (px) => [(px - 310) * .18, 1], { comp: [60, 130], dil: 4 });
      elipse(x, 310, 74, 62, 54, pal[0], tom(pal[0], -.3), 3);                      // o coque, alto e atrás
      for (let i = 0; i < 22; i++) {                                                 // as voltas do cabelo preso
        const a = rnd.uni(0, 6.28), r = rnd.uni(16, 50);
        risco(x, curva([310 + Math.cos(a) * r, 74 + Math.sin(a) * r * .85], [310 + Math.cos(a + 1.4) * r, 74 + Math.sin(a + 1.4) * r * .85], 10, rnd), rnd.um(pal), rnd.uni(2, 3.4));
      }
      elipse(x, 310, 122, 24, 12, cfg.tie);                                          // o elástico
      return;
    }
    if (st === "afro") {
      for (let i = 0; i < 46; i++) {                                                 // o halo, feito de volume e não de contorno
        const a = rnd.uni(Math.PI * .96, Math.PI * 2.04), r = rnd.uni(150, 205);
        elipse(x, 310 + Math.cos(a) * r, 240 + Math.sin(a) * r * .96, rnd.uni(34, 54), rnd.uni(34, 54), rnd.um(pal));
      }
      elipse(x, 310, 232, 178, 168, pal[0]);
      for (let i = 0; i < 120; i++) {                                                 // a textura miúda
        const a = rnd.uni(0, 6.28), r = rnd.uni(60, 200);
        const cx = 310 + Math.cos(a) * r, cy = 232 + Math.sin(a) * r * .95;
        if (cy > 330) continue;
        elipse(x, cx, cy, rnd.uni(7, 15), rnd.uni(7, 15), rnd() < .45 ? tom(pal[0], -.26) : rnd.um(pal));
      }
      return;
    }
    if (st === "ponytail") {
      const cap = [[152, 300], [168, 172], [230, 98], [310, 78], [390, 98], [452, 172], [468, 300], [400, 262], [310, 244], [220, 262]]
        .map(([x, y]) => [x + rnd.uni(-4, 4), y + rnd.uni(-4, 4)]);
      chapaRiscada(x, cap, pal[0], pal, rnd, 180, (px) => [(px - 310) * .18, 1], { comp: [60, 130], dil: 4 });
      const rabo = [[440, 200], [500, 226], [534, 330], [528, 470], [498, 566], [466, 486], [444, 366], [428, 262]]
        .map(([x, y]) => [x + rnd.uni(-5, 5), y + rnd.uni(-5, 5)]);
      chapaRiscada(x, rabo, pal[0], pal, rnd, 110, () => [.2, 1], { comp: [70, 150], dil: 3 });   // um rabo só, de lado
      elipse(x, 452, 208, 18, 13, cfg.tie);
      return;
    }
    if (st === "pigtails") {
      const cap = [[150, 300], [168, 170], [230, 100], [310, 80], [390, 100], [452, 170], [470, 300], [400, 260], [310, 240], [220, 260]]
        .map(([x, y]) => [x + rnd.uni(-4, 4), y + rnd.uni(-4, 4)]);
      chapaRiscada(x, cap, pal[0], pal, rnd, 170, (px) => [(px - 310) * .2, 1], { comp: [60, 130], dil: 4 });
      [-1, 1].forEach((s) => {
        const tail = [[310 + s * 150, 230], [310 + s * 205, 250], [310 + s * 245, 340], [310 + s * 250, 470],
                      [310 + s * 232, 560], [310 + s * 205, 490], [310 + s * 178, 380], [310 + s * 150, 300]]
          .map(([x, y]) => [x + rnd.uni(-4, 4), y + rnd.uni(-4, 4)]);
        chapaRiscada(x, tail, pal[0], pal, rnd, 90, () => [s * .15, 1], { comp: [60, 130], dil: 3 });
        elipse(x, 310 + s * 190, 238, 16, 12, cfg.tie);
      });
      return;
    }
  }

  function cabeloFrente(x, cfg, rnd) {
    const st = cfg.hair_style, pal = cfg.hair_pal;
    if (st === "long" || st === "pigtails" || st === "bob") {
      const base = [[140, 300], [150, 190], [215, 105], [310, 82], [405, 105], [470, 190], [480, 300], [440, 240], [390, 215], [310, 205], [230, 215], [180, 240]]
        .map(([x, y]) => [x + rnd.uni(-3, 3), y + rnd.uni(-3, 3)]);
      chapaRiscada(x, base, pal[0], pal, rnd, 240, (px) => [(px - 310) * .22, 1], { comp: [50, 120], dil: 3 });
      for (let i = 0; i < 46; i++) {                     // franja: riscos que descem sobre a testa
        const x0 = rnd.uni(200, 420);
        risco(x, curva([x0, rnd.uni(130, 175)], [x0 + (x0 - 310) * .08 + rnd.uni(-6, 6), rnd.uni(205, 250) + (st === "long" ? 0 : -8)], rnd.uni(-8, 8), rnd), rnd.um(pal), rnd.uni(1.6, 3.2));
      }
      if (st === "long" || st === "bob") {
        const fim = st === "long" ? [440, 560] : [410, 480];
        [-1, 1].forEach((s) => {
          for (let i = 0; i < 26; i++) {
            const x0 = 310 + s * rnd.uni(140, 170);
            risco(x, curva([x0, rnd.uni(200, 260)], [x0 + s * rnd.uni(-2, 16), rnd.uni(fim[0], fim[1])], s * 5, rnd), rnd.um(pal), rnd.uni(1.8, 3.4));
          }
        });
      }
    } else if (st === "buzz") {
      const cap = [[168, 262], [176, 190], [222, 128], [310, 104], [398, 128], [444, 190], [452, 262], [420, 226], [310, 212], [200, 226]]
        .map(([x, y]) => [x + rnd.uni(-3, 3), y + rnd.uni(-3, 3)]);
      chapa(x, cap, tom(pal[0], -.12));                                              // um capacete rente, sem volume nenhum
      for (let i = 0; i < 170; i++) {                                                // a raspa, ponto a ponto
        const a = rnd.uni(Math.PI * 1.04, Math.PI * 1.96), r = rnd.uni(96, 148);
        elipse(x, 310 + Math.cos(a) * r, 232 + Math.sin(a) * r * .92, rnd.uni(2, 4), rnd.uni(2, 4), rnd() < .5 ? tom(pal[0], .3) : tom(pal[0], -.3));
      }
      risco(x, curva([176, 250], [444, 250], -46, rnd), tom(pal[0], -.3), 3);         // a linha da testa, alta
    } else if (st === "messy") {
      const crown = [[150, 300], [140, 240], [160, 170], [200, 120], [240, 80], [270, 40], [300, 88], [335, 30], [365, 92], [410, 60], [420, 120], [462, 150], [480, 220], [470, 300], [430, 250], [395, 205], [345, 232], [300, 200], [250, 235], [195, 215]]
        .map(([x, y]) => [x + rnd.uni(-3, 3), y + rnd.uni(-3, 3)]);
      chapaRiscada(x, crown, pal[0], pal, rnd, 260, (px, py) => [px - 310, (py - 260) * .9], { comp: [30, 90], curv: [-16, 16], dil: 3 });
      for (let i = 0; i < 24; i++) {                     // tufos para fora
        const a = rnd.uni(-2.5, -0.6), x0 = 310 + Math.cos(a) * 150, y0 = 235 + Math.sin(a) * 170;
        risco(x, curva([x0, y0], [x0 + Math.cos(a) * rnd.uni(20, 50), y0 + Math.sin(a) * rnd.uni(20, 46)], rnd.uni(-8, 8), rnd), rnd.um(pal), rnd.uni(2, 3.6));
      }
    } else if (st === "curly") {
      const cap = [[148, 310], [146, 225], [185, 145], [250, 100], [310, 88], [370, 100], [435, 145], [474, 225], [472, 310], [425, 255], [370, 222], [310, 214], [250, 222], [195, 255]]
        .map(([x, y]) => [x + rnd.uni(-3, 3), y + rnd.uni(-3, 3)]);
      chapa(x, cap, pal[2] || pal[0]);
      for (let i = 0; i < 34; i++) {                     // volumes dos cachos
        const a = rnd.uni(Math.PI * 1.02, Math.PI * 1.98), r = rnd.uni(140, 175), rr = rnd.uni(26, 42);
        elipse(x, 310 + Math.cos(a) * r * 1.02, 235 + Math.sin(a) * r * .95, rr, rr, rnd.um(pal));
      }
      for (let i = 0; i < 90; i++) {                     // espirais
        const a = rnd.uni(Math.PI * 1.05, Math.PI * 1.95), r = rnd.uni(110, 178), rr = rnd.uni(9, 20), t0 = rnd.uni(0, 6);
        const cx = 310 + Math.cos(a) * r, cy = 235 + Math.sin(a) * r * .95;
        const pts = []; for (let k = 0; k < 14; k++) pts.push([cx + Math.cos(t0 + k * .5) * rr * (1 - k / 14), cy + Math.sin(t0 + k * .5) * rr * (1 - k / 14)]);
        risco(x, pts, rnd() < .5 ? tom(pal[0], -.3) : rnd.um(pal), 2.2);
      }
      for (let i = 0; i < 13; i++) {                     // cachos na testa
        const cx = 205 + i * 17.5 + rnd.uni(-5, 5), cy = rnd.uni(178, 205), rr = rnd.uni(20, 30), t0 = rnd.uni(0, 6);
        elipse(x, cx, cy, rr, rr, rnd.um(pal));
        const pts = []; for (let k = 0; k < 14; k++) pts.push([cx + Math.cos(t0 + k * .5) * rr * .8 * (1 - k / 14), cy + Math.sin(t0 + k * .5) * rr * .8 * (1 - k / 14)]);
        risco(x, pts, tom(pal[0], -.3), 2.2);
      }
      [-1, 1].forEach((s) => {
        for (let i = 0; i < 9; i++) {
          const rr = rnd.uni(18, 28);
          elipse(x, 310 + s * rnd.uni(146, 176), rnd.uni(255, 330), rr, rr, rnd.um(pal));
        }
      });
    } else {                                             // short_dark: curto com franja de lado
      const crown = [[160, 300], [150, 220], [185, 150], [250, 105], [330, 95], [410, 120], [462, 190], [470, 300], [445, 230], [400, 190], [330, 178], [270, 205], [215, 245]]
        .map(([x, y]) => [x + rnd.uni(-3, 3), y + rnd.uni(-3, 3)]);
      chapaRiscada(x, crown, pal[0], pal, rnd, 200, (px) => [-(px - 310) * .1 + 40, 1], { comp: [30, 80], dil: 3 });
      for (let i = 0; i < 34; i++) {
        const x0 = rnd.uni(215, 440);
        risco(x, curva([x0, rnd.uni(118, 160)], [x0 - rnd.uni(20, 70), rnd.uni(190, 240)], rnd.uni(-8, 8), rnd), rnd.um(pal), rnd.uni(1.8, 3.2));
      }
    }
  }

  // Grão de papel por cima do desenho. Vai no tamanho final, não no dobro: no dobro o ruído virava
  // papa ao reduzir a imagem, deixava o PNG dez vezes maior que os retratos dos pacientes e nem
  // aparecia direito. O gerador em Python também aplica o grão por último (Image.effect_noise).
  function grao(x, larg, alt, rnd) {
    const T = 96, t = document.createElement("canvas");
    t.width = T; t.height = T;
    const tx = t.getContext("2d"), im = tx.createImageData(T, T), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 128 + (rnd() - .5) * 18;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 26;
    }
    tx.putImageData(im, 0, 0);
    x.save();
    x.globalCompositeOperation = "overlay";
    x.fillStyle = x.createPattern(t, "repeat");
    x.fillRect(0, 0, larg, alt);
    x.restore();
  }


  // Asas de fada e gorro de dormir: o visual de dois guardiões (a Fada do Dente e o Sandman). Estavam
  // só no desenho vetorial, que saiu do jogo na 5.12 — sem isto os dois apareceriam sem nada.
  function asas(x, cfg, rnd) {
    if (!(cfg.acc || []).includes("wings")) return;
    const par = [[150, 516, 108, 64, -0.55], [122, 648, 80, 50, 0.42]];
    [-1, 1].forEach((s) => par.forEach(([dx, cy, rx, ry, rot]) => {
      x.save();
      x.translate((310 + s * dx) * SS, cy * SS);
      x.rotate(s * rot);
      x.beginPath(); x.ellipse(0, 0, rx * SS, ry * SS, 0, 0, Math.PI * 2);
      x.fillStyle = "rgba(215,236,255,0.66)"; x.fill();
      x.strokeStyle = "rgba(143,186,224,0.85)"; x.lineWidth = 3 * SS; x.stroke();
      // nervuras: dois riscos de dentro para fora, como as veias de uma asa
      x.strokeStyle = "rgba(255,255,255,0.8)"; x.lineWidth = 2.4 * SS;
      [-0.3, 0.25].forEach((a) => { x.beginPath(); x.moveTo(-rx * 0.8 * SS, 0); x.lineTo(rx * 0.75 * SS, ry * a * SS); x.stroke(); });
      x.restore();
    }));
  }

  // gorro de dormir: casquete comprido que tomba para o lado, com pompom
  function gorro(x, cfg, rnd) {
    if (!(cfg.acc || []).includes("nightcap")) return;
    const c = "#3a3f8f", claro = "#f2f0ff";
    const corpo = [[156, 300], [168, 228], [216, 168], [302, 136], [382, 142], [432, 198], [464, 294]]
      .map(([px, py]) => [px + rnd.uni(-3, 3), py + rnd.uni(-3, 3)]);
    chapaRiscada(x, corpo, c, [tom(c, 0.16), tom(c, -0.14), c], rnd, 40,
      () => [rnd.uni(-1, 1), rnd.uni(-1, -0.2)], { comp: [30, 70], larg: [7, 13], curv: [-8, 8], dil: 0 });
    risco(x, corpo, tom(c, -0.35), 3);
    risco(x, curva([410, 152], [520, 92], 22, rnd), c, 34);        // a ponta mole, caída para o lado
    risco(x, curva([155, 302], [466, 298], -5, rnd), claro, 30);   // a aba dobrada
    elipse(x, 528, 86, 34, 32, claro, tom(c, -0.2), 3);            // pompom
  }

  // ---------------------------------------------------------------- montagem
  function montar(cfg, seed) {
    const rnd = acaso(seed);
    const l = camada(), x = l.x, geo = cfg.face;
    // Uma tela só para o retrato inteiro: antes cada parte era uma camada de 1240×1470 (~7 MB), e as
    // 18 camadas de um retrato davam picos de memória de segundos — inviável num celular.
    x.save(); inclinar(x, cfg.tilt, 310, 520); cabeloAtras(x, cfg, rnd); x.restore();
    asas(x, cfg, rnd);                     // atrás do tronco, senão as asas cobririam os ombros
    tronco(x, cfg, rnd);
    marcaDoPeito(x, cfg, rnd);
    pescoco(x, cfg);
    x.save(); inclinar(x, cfg.tilt, 310, 520);
    orelhas(x, cfg, rnd, geo); rosto(x, cfg, rnd); olhos(x, cfg, rnd, geo);
    narizBoca(x, cfg, rnd, geo); extras(x, cfg, rnd, geo); cabeloFrente(x, cfg, rnd);
    gorro(x, cfg, rnd);                    // por cima do cabelo, como um gorro de verdade
    x.restore();
    return l;
  }

  // ---------------------------------------------------------------- aparência do jogo → configuração do desenho
  // O editor do jogo tem mais variedade do que este traço sabe desenhar; cada opção cai na mais parecida.
  const CABELO = { bun: "bun", short: "short_dark", long: "long", bob: "bob", curly: "curly", wavy: "long",
                   ponytail: "ponytail", braids: "pigtails", afro: "afro", pixie: "messy", buzz: "buzz" };
  const CAMISA = { coat: "coat", sweater: "sweater", blazer: "blazer", dress: "dress", top: "tshirt", shirt: "shirt",
                   hoodie: "hoodie", polo: "polo", turtleneck: "turtleneck", cardigan: "cardigan", tank: "tank", tunic: "tunic", overall: "overall" };   // um desenho para cada peça, não dois para treze
  const ROSTO = { round: [[310, 330, 152, 166], .22], oval: [[310, 332, 145, 176], .34], wide: [[310, 332, 158, 170], .28] };
  const OLHO = { round: { eye_scale: 1.06, eye_y: -22 }, almond: { eye_scale: .95, eye_y: -22 },
                 sleepy: { eye_scale: .88, eye_y: -16 }, wide: { eye_scale: 1.18, eye_y: -24 } };
  const SOBRANCELHA = { soft: { brow_w: 3, brow_inner: 4 }, thick: { brow_w: 4.8, brow_inner: 2 },
                        arched: { brow_w: 3.4, brow_inner: 9, brow_lift: 4 }, none: { brow_w: 0, brow_inner: 0 } };

  function doJogador(p) {
    p = p || {};
    const cor = p.hairColor || "#5a3a26";
    const camisa = typeof topDef === "function" ? topDef(p.top || "coat") : { color: "#5f86c4", style: "shirt" };
    const [face, chin] = ROSTO[p.face] || ROSTO.oval;
    const acc = [];
    if (p.acc === "glasses") acc.push("glasses");
    if (p.acc === "asas-fada") acc.push("wings");
    if (p.acc === "gorro-sono") acc.push("nightcap");
    if (p.freckles) acc.push("freckles");
    return Object.assign({
      skin: p.skin || "#eab98f",
      shirt: camisa.color === "#ffffff" ? "#eceaf2" : camisa.color,   // jaleco branco puro sumiria no fundo claro
      corpo: p.corpo || p.gender || "n",
      shirt_kind: p.semTop ? "under" : (CAMISA[camisa.style] || "tshirt"),
      under: (typeof UNDER_MAP !== "undefined" && UNDER_MAP[p.intima] ? UNDER_MAP[p.intima].color : "#e8e2d8"),
      hair_style: CABELO[p.hairStyle] || "short_dark",
      hair_pal: [cor, tom(cor, .22), tom(cor, -.24), tom(cor, .38)],
      tie: tom(cor, -.1), stripe: tom(camisa.color, -.3),
      brow: tom(cor, -.3), face, chin,
      iris: p.eyeColor || "#4a2f22", lid: tom(cor, -.25),
      mouth: p.mouth || "soft", mouth_y: 92, nose_y: 32, eye_sep: 74,
      look: [-3, 3], blush: "#e89a86", blush_a: 55, tilt: -3,
      mark: camisa.mark || "",                             // o Ψ do jaleco de psicologia
      acc                                                  // óculos e sardas; sem isto `extras()` nunca desenhava nenhum dos dois
    }, OLHO[p.eyeShape] || OLHO.round, SOBRANCELHA[p.brow] || SOBRANCELHA.soft);
  }

  // chave do cache: só o que muda o desenho (o nome e o idioma não mudam)
  const chave = (p) => JSON.stringify([p.skin, p.hairStyle, p.hairColor, p.eyeColor, p.eyeShape, p.brow, p.mouth, p.face, p.freckles, p.top, p.acc, p.intima, p.semTop, p.corpo, p.gender]);   // `top` é o id da peça: já cobre estilo, cor e marca; a roupa de baixo só aparece no provador

  // O cache guarda a TELA pronta, não o PNG: codificar PNG custa mais que o desenho inteiro, e
  // quase todo uso é desenhar numa tela (prévia da criação), onde o PNG só daria trabalho a troco de nada.
  const telas = new Map(), urls = new Map();

  function tela(jogador) {
    const k = chave(jogador || {});
    if (telas.has(k)) return telas.get(k);
    const img = montar(doJogador(jogador), semente(k));
    const saida = document.createElement("canvas");
    saida.width = W; saida.height = H;
    const x = saida.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(img.c, 0, 0, W, H);
    grao(x, W, H, acaso(semente(k) ^ 0x9e3779b9));
    // o grão é pintado na tela inteira, então devolve o recorte: sem isto o retrato sai com um
    // retângulo de fundo cinza em volta, em vez de transparente
    x.globalCompositeOperation = "destination-in";
    x.drawImage(img.c, 0, 0, W, H);
    x.globalCompositeOperation = "source-over";
    if (telas.size > 6) telas.clear();        // o jogador muda o visual poucas vezes
    telas.set(k, saida);
    return saida;
  }

  // Desenha na tela recebida, respeitando a proporção 620×735 (a mais usada: prévia da criação).
  function pintar(canvas, jogador) {
    const t = tela(jogador), x = canvas.getContext("2d");
    const e = Math.min(canvas.width / W, canvas.height / H);
    x.clearRect(0, 0, canvas.width, canvas.height);
    x.imageSmoothingQuality = "high";
    x.drawImage(t, (canvas.width - W * e) / 2, (canvas.height - H * e) / 2, W * e, H * e);
    return canvas;
  }

  // Só para quem precisa de <img src>: o PNG é caro, então fica em cache à parte.
  function url(jogador) {
    const k = chave(jogador || {});
    if (urls.has(k)) return urls.get(k);
    const u = tela(jogador).toDataURL("image/png");
    if (urls.size > 4) urls.clear();
    urls.set(k, u);
    return u;
  }

  return { pintar, url, tela, doJogador, montar, semente, chave, W, H };
})();

window.Retrato = Retrato;

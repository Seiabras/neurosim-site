"use strict";

// Cenário 3D realista: materiais físicos (PBR), luz quente com sombras suaves, reflexos de ambiente e texturas com relevo.
// Os personagens 2D continuam em pé dentro da cena.
// Se o navegador não tiver WebGL (ou algo falhar), Scene3D.available fica falso e o jogo usa o cenário 2D.
//
// MAPA DO ARQUIVO (7.11) — a armação articulada (583 linhas) saiu daqui para js/render/rig.js. O que
// ficou, por marca de seção: "estado" · "materiais e formas" · "texturas desenhadas por código" ·
// "peças reutilizáveis" · "bichinhos de estimação em 3D" · "itens do consultório e temas" ·
// "decoração livre" · "modelos externos" · "cenas" (consultório, casa, rua, porta) · "vitrine da
// personagem" · "visualizador do aquário" · "renderizador".
//
// REGRA para quem for mexer: peça nova e grande nasce em ARQUIVO PRÓPRIO (como furniture.js,
// aquarium3d.js e agora rig.js). E duas medidas deste arquivo andam junto com os MÓVEIS — a altura do
// quadril e a do joelho, em rig.js, com o assento da poltrona aqui: o grupo de teste `sentar` guarda
// esse acoplamento, e mexer numa sem a outra tira o pé do chão.
(function () {
  const T = window.THREE;

  function webglOk() {
    try {
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
      return false;
    }
  }

  if (!T || !webglOk()) {
    window.Scene3D = { available: false, mount() { return false; }, unmount() {}, update() {} };
    return;
  }

  // cores em sRGB, luz em espaço linear e saída sRGB: é o que dá o aspecto real à luz e às cores
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;
  const INK = 0x15131f;
  const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------------ estado
  const S = {
    renderer: null, canvas: null, cur: null, raf: 0,
    pointer: { x: 0, y: 0 }, smooth: { x: 0, y: 0 },
    drag: { on: false, yaw: 0, pitch: 0, x: 0, y: 0 },
    clock: new T.Clock(), texCache: {}, hora: 12, luzOn: false
  };

  // ------------------------------------------------------------------ materiais e formas
  const ramp = (() => {
    const t = new T.DataTexture(new Uint8Array([150, 200, 240, 255]), 4, 1, T.RedFormat);
    t.minFilter = t.magFilter = T.NearestFilter;
    t.needsUpdate = true;
    t.__compartilhada = true;   // idem: a rampa do toon é de todas as cenas
    return t;
  })();
  const HULL = new T.MeshBasicMaterial({ color: INK, side: T.BackSide });
  HULL.__compartilhado = true;   // vive fora das cenas: dispose() de uma montagem NÃO pode levá-lo embora

  function hex(c) { return new T.Color(c); }
  function shade(c, f) {
    const col = hex(c);
    return f >= 0 ? col.lerp(new T.Color(0xffffff), f) : col.lerp(new T.Color(0x000000), -f);
  }

  // material físico: fosco por padrão (madeira, tecido, parede); quem quiser brilho passa roughness/metalness em `mat`
  // presets de material PBR: passe `mat: { preset: "wood" }` (ou fabric, metal, glass, ceramic, leather, plastic) em qualquer peça
  const PRESETS = {
    wood: { roughness: 0.62, metalness: 0.0, envMapIntensity: 0.4 },
    fabric: { fabric: true },
    metal: { roughness: 0.28, metalness: 0.9, envMapIntensity: 0.9 },
    ceramic: { roughness: 0.22, metalness: 0.0, envMapIntensity: 0.6 },
    leather: { roughness: 0.5, metalness: 0.0, envMapIntensity: 0.5, sheen: 0.6, sheenRoughness: 0.5 },
    plastic: { roughness: 0.4, metalness: 0.05, envMapIntensity: 0.5 },
    glass: { glass: true }
  };
  // madeira reconhecida pela cor (marrons quentes): peças antigas ganham o preset de madeira sem precisar de `mat` em cada uma
  const woodHSL = { h: 0, s: 0, l: 0 };
  function looksLikeWood(color) {
    new T.Color(color).getHSL(woodHSL);
    return woodHSL.h >= 0.04 && woodHSL.h <= 0.12 && woodHSL.s >= 0.3 && woodHSL.s <= 0.75 && woodHSL.l >= 0.14 && woodHSL.l <= 0.62;
  }
  function toon(color, o = {}) {
    if (!o.preset && o.roughness === undefined && o.metalness === undefined && !o.fabric && !o.glass && !o.emissive && looksLikeWood(color)) o = Object.assign({ preset: "wood" }, o);
    if (o.preset && PRESETS[o.preset]) { o = Object.assign({}, PRESETS[o.preset], o); delete o.preset; }
    if (o.glass) {   // vidro: MeshPhysicalMaterial com transmissão, reflexo e um leve brilho nas bordas (transparente e barato de desenhar)
      delete o.glass;
      return new T.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.06, metalness: 0, transmission: 0.92, thickness: 0.35, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 1.2, side: T.DoubleSide }, o));
    }
    const p = Object.assign({ color, roughness: 0.78, metalness: 0.02, envMapIntensity: 0.32 }, o);
    // tecido: brilho de fibra nas bordas (sheen) e trama em relevo
    if (p.fabric) { delete p.fabric; p.bumpMap = p.bumpMap || fabricBump(); p.bumpScale = p.bumpScale || 0.02; p.roughness = 0.95; p.sheen = 1; p.sheenRoughness = 0.55; p.sheenColor = new T.Color(color).lerp(new T.Color(0xffffff), 0.45); return new T.MeshPhysicalMaterial(p); }
    return new T.MeshStandardMaterial(p);
  }

  // malha com contorno escuro (casca invertida ligeiramente maior)
  function solid(geo, color, o = {}) {
    const mesh = new T.Mesh(geo, o.material || toon(color, o.mat || {}));
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    const g = new T.Group();
    g.add(mesh);
    if (o.outline === true) {   // contorno só se pedido: no visual realista ele não existe
      geo.computeBoundingBox();
      const s = new T.Vector3();
      geo.boundingBox.getSize(s);
      const ol = o.ol || 0.06;
      const hull = new T.Mesh(geo, HULL);
      hull.scale.set(1 + ol / Math.max(s.x, 0.05), 1 + ol / Math.max(s.y, 0.05), 1 + ol / Math.max(s.z, 0.05));
      g.add(hull);
    }
    if (o.pos) g.position.set(o.pos[0], o.pos[1], o.pos[2]);
    if (o.rot) g.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    return g;
  }

  // caixa com as quinas arredondadas: o brilho nas bordas é o que tira o aspecto de "bloco" e dá o de objeto real.
  // Paredes e chãos grandes ou finos continuam retos.
  const RB = {};
  function roundedBoxGeo(w, h, d, r) {
    const key = [w, h, d, r].map((v) => v.toFixed(3)).join("|");
    if (RB[key]) return RB[key];
    const x = w / 2 - r, y = h / 2 - r, sh = new T.Shape();
    sh.moveTo(-x, -h / 2); sh.lineTo(x, -h / 2); sh.absarc(x, -y, r, -Math.PI / 2, 0, false);
    sh.lineTo(w / 2, y); sh.absarc(x, y, r, 0, Math.PI / 2, false);
    sh.lineTo(-x, h / 2); sh.absarc(-x, y, r, Math.PI / 2, Math.PI, false);
    sh.lineTo(-w / 2, -y); sh.absarc(-x, -y, r, Math.PI, Math.PI * 1.5, false);
    const g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: 0, bevelSegments: 3, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    g.computeVertexNormals();
    return (RB[key] = g);
  }
  const box = (w, h, d, color, o = {}) => {
    const m = Math.min(w, h, d), big = Math.max(w, h, d) > 5.5;
    if (o.sharp || big || m < 0.1 || o.material) return solid(new T.BoxGeometry(w, h, d), color, o);
    return solid(roundedBoxGeo(w, h, d, Math.min(0.06, m * 0.22)), color, o);
  };
  const cyl = (rt, rb, h, color, o = {}) => solid(new T.CylinderGeometry(rt, rb, h, o.seg || 24), color, o);
  const sph = (r, color, o = {}) => solid(new T.SphereGeometry(r, 20, 14), color, o);

  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.anisotropy = 16;
    t.encoding = T.sRGBEncoding;
    return t;
  }

  function rng(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  // ------------------------------------------------------------------ texturas desenhadas por código
  function planksTex() {
    return canvasTex(1024, 1024, (g, w, h) => {
      const r = rng(7), rows = 8, ph = h / rows;
      for (let i = 0; i < rows; i++) {
        const y = ph * i, l = 50 + r() * 10, hue = 27 + r() * 6;
        g.fillStyle = `hsl(${hue},46%,${l}%)`;
        g.fillRect(0, y, w, ph);
        // veios da madeira: linhas finas e onduladas, mais claras e mais escuras
        for (let k = 0; k < 46; k++) {
          const yy = y + r() * ph, dark = r() < 0.6;
          g.strokeStyle = dark ? `rgba(70,38,16,${0.05 + r() * 0.12})` : `rgba(255,225,180,${0.05 + r() * 0.1})`;
          g.lineWidth = 0.6 + r() * 1.6;
          g.beginPath(); g.moveTo(0, yy);
          for (let x = 0; x <= w; x += 64) g.lineTo(x, yy + Math.sin(x / 90 + k) * 2.2 + (r() - 0.5) * 1.2);
          g.stroke();
        }
        // nós ocasionais
        if (r() < 0.5) { const nx = r() * w, ny = y + ph * (0.3 + r() * 0.4); const gr = g.createRadialGradient(nx, ny, 1, nx, ny, 16); gr.addColorStop(0, "rgba(60,30,10,0.5)"); gr.addColorStop(1, "rgba(60,30,10,0)"); g.fillStyle = gr; g.fillRect(nx - 18, ny - 18, 36, 36); }
        g.fillStyle = "rgba(40,20,8,0.55)"; g.fillRect(0, y, w, 3);            // junta entre as tábuas
        for (let k = 0; k < 2; k++) { g.fillRect(r() * w, y, 3, ph); }
      }
    });
  }

  // relevo suave (em tons de cinza) para chão e paredes: quebra o aspecto liso e pega a luz de lado
  // ATENÇÃO: as texturas criadas UMA VEZ e reusadas em todas as montagens têm de ser marcadas como
  // compartilhadas, senão o dispose() da cena as libera e a montagem seguinte desenha com textura morta
  // — o que a GPU mostra como branco, preto e cores aleatórias piscando. Foi o que aconteceu na 5.9.
  let noiseBump = null;
  function bumpNoise() {
    if (noiseBump) return noiseBump;
    noiseBump = canvasTex(256, 256, (g, w, h) => {
      const r = rng(23), img = g.createImageData(w, h);
      for (let i = 0; i < w * h; i++) { const v = 118 + Math.floor(r() * 24); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
    });
    noiseBump.encoding = T.LinearEncoding;
    noiseBump.wrapS = noiseBump.wrapT = T.RepeatWrapping; noiseBump.repeat.set(3, 3);
    noiseBump.__compartilhada = true;
    return noiseBump;
  }

  // trama de tecido: fios cruzados em relevo (poltronas, sofás, almofadas)
  let fabricB = null;
  function fabricBump() {
    if (fabricB) return fabricB;
    fabricB = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
      const r = rng(9);
      for (let i = 0; i < w; i += 2) { g.fillStyle = `rgba(${i % 4 ? "255,255,255" : "0,0,0"},0.07)`; g.fillRect(i, 0, 1, h); }
      for (let j = 0; j < h; j += 2) { g.fillStyle = `rgba(${j % 4 ? "255,255,255" : "0,0,0"},0.06)`; g.fillRect(0, j, w, 1); }
      for (let n = 0; n < 700; n++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},0.05)`; g.fillRect(r() * w, r() * h, 1, 1); }   // fibras soltas
    });
    fabricB.encoding = T.LinearEncoding;
    fabricB.wrapS = fabricB.wrapT = T.RepeatWrapping; fabricB.repeat.set(9, 9);
    fabricB.generateMipmaps = true; fabricB.minFilter = T.LinearMipmapLinearFilter;
    fabricB.__compartilhada = true;
    return fabricB;
  }

  // parede: pintura com leve degradê (mais escura junto ao chão e no forro), manchas suaves de rolo e reboco
  function wallTex() {
    return canvasTex(512, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#e8e8e8"); gr.addColorStop(0.18, "#ffffff"); gr.addColorStop(0.8, "#fbfbfb"); gr.addColorStop(1, "#cfcfcf");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = rng(41);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${0.012 + r() * 0.02})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 70, 8 + r() * 30, r() * 3, 0, 7); g.fill(); }
    });
  }

  // máscara em elipse com borda esmaecida para o rosto pintado (branco = opaco, preto = transparente)

  function clockTex() {
    return canvasTex(256, 256, (g, w) => {
      g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
      g.strokeStyle = "#15131f"; g.lineWidth = 10; g.stroke();
      g.lineWidth = 6;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.beginPath(); g.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); g.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110); g.stroke();
      }
      g.lineWidth = 10; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.stroke();
      g.lineWidth = 7; g.beginPath(); g.moveTo(128, 128); g.lineTo(178, 150); g.stroke();
    });
  }

  function abstractTex() {
    return canvasTex(256, 256, (g, w, h) => {
      const r = rng(11);
      g.fillStyle = "#fff4dc"; g.fillRect(0, 0, w, h);
      const cols = ["#e2478a", "#1f66d6", "#f2c230", "#22b04a", "#8790dd"];
      for (let i = 0; i < 6; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath(); g.arc(r() * w, r() * h, 25 + r() * 45, 0, 7); g.fill();
      }
      g.strokeStyle = "#15131f"; g.lineWidth = 6;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h); g.stroke(); }
    });
  }

  function diplomaTex() {
    return canvasTex(256, 192, (g, w, h) => {
      g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#a07a3c"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = "#15131f"; g.font = "bold 26px serif"; g.textAlign = "center"; g.fillText("Diploma", w / 2, 60);
      g.fillRect(50, 85, w - 100, 4); g.fillRect(70, 105, w - 140, 4); g.fillRect(60, 125, w - 120, 4);
      g.fillStyle = "#c0392b"; g.beginPath(); g.arc(w - 55, h - 45, 18, 0, 7); g.fill();
    });
  }

  function signTex() {
    return canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#15131f"; g.font = "bold 52px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("Clínica NeuroClin", w / 2 + 42, h / 2 + 3);
      g.font = "bold 70px serif"; g.fillText("Ψ", 52, h / 2 + 2);
    });
  }

  function buildingTex(color, seed) {
    return canvasTex(128, 256, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = color; g.fillRect(0, 0, w, h);
      for (let y = 20; y < h - 20; y += 40) {
        for (let x = 14; x < w - 14; x += 38) {
          g.fillStyle = r() > 0.35 ? "#ffe9a8" : "#a9c7e8";
          g.fillRect(x, y, 22, 26);
          g.strokeStyle = "#15131f"; g.lineWidth = 3; g.strokeRect(x, y, 22, 26);
        }
      }
    });
  }

  function alarmTex() {
    return canvasTex(128, 128, (g) => {
      g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
      g.strokeStyle = "#15131f"; g.lineWidth = 6; g.stroke();
      g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 24); g.stroke();
      g.beginPath(); g.moveTo(64, 64); g.lineTo(92, 78); g.stroke();
    });
  }


  function loadTex(key) {
    if (S.texCache[key]) return S.texCache[key];
    const src = (window.TEX_DATA && window.TEX_DATA[key]) || key;
    const t = new T.TextureLoader().load(src, () => { if (S.cur) S.cur.dirty = true; });
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 16;
    S.texCache[key] = t;
    return t;
  }

  // ------------------------------------------------------------------ peças reutilizáveis
  function tag(g, id) { g.userData.item = id; return g; }

  // ACABAMENTOS dos móveis de fábrica: o molde é o mesmo, o tecido é que muda. Comprar outra poltrona
  // para trocar a cor seria comprar o mesmo móvel de novo; aqui você escolhe o acabamento e pronto.
  const ACABAMENTOS = {
    terracota: 0xc4837a, azul: 0x7b9cc9, mostarda: 0xd9a15f, musgo: 0x7f9a72,
    vinho: 0x8c3a4f, areia: 0xd9c7a8, grafite: 0x5a5b66, petroleo: 0x3f6b74
  };
  const acabamento = (id, padrao) => {
    const c = (typeof state !== "undefined" && state.acabamento) ? state.acabamento[id] : null;
    return (c && ACABAMENTOS[c]) || padrao;
  };

  function plant(x, z, scale = 1) {
    const g = new T.Group();
    g.add(cyl(0.5, 0.36, 0.75, 0xd9694a, { pos: [0, 0.375, 0] }));
    g.add(cyl(0.44, 0.44, 0.06, 0x5a3b26, { pos: [0, 0.74, 0], outline: false }));
    const greens = [0x3f9b4f, 0x56b35f, 0x2f8442];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const leaf = new T.Mesh(new T.SphereGeometry(0.5, 10, 8), toon(greens[i % 3]));
      leaf.scale.set(0.2, 0.95, 0.06);
      leaf.position.set(Math.sin(a) * 0.22, 1.3 + (i % 3) * 0.1, Math.cos(a) * 0.22);
      leaf.rotation.set(Math.cos(a) * 0.5, a, -Math.sin(a) * 0.5);
      leaf.castShadow = true;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    return g;
  }

  function ficus(x, z) {
    const g = new T.Group();
    g.add(cyl(0.55, 0.42, 0.7, 0x6b7fa8, { pos: [0, 0.35, 0] }));
    g.add(cyl(0.09, 0.14, 1.5, 0x7a5232, { pos: [0, 1.45, 0], outline: false }));
    [[0, 2.7, 0, 0.75], [-0.5, 2.3, 0.1, 0.55], [0.5, 2.35, -0.1, 0.55], [0.1, 2.0, 0.5, 0.45], [-0.15, 3.2, 0, 0.42]].forEach(([px, py, pz, r]) =>
      g.add(sph(r, 0x3f9b4f, { pos: [px, py, pz], ol: 0.05 })));
    g.position.set(x, 0, z);
    return g;
  }

  function bookshelf(x, z, rotY) {
    const g = new T.Group();
    const wood = 0xb07a4a;
    g.add(box(0.14, 3.2, 0.6, wood, { pos: [-0.85, 1.6, 0] }));
    g.add(box(0.14, 3.2, 0.6, wood, { pos: [0.85, 1.6, 0] }));
    g.add(box(1.84, 0.14, 0.6, wood, { pos: [0, 3.2, 0] }));
    const r = rng(5);
    const cols = [0xd9534f, 0x5b64bf, 0xf2c230, 0x3f9b4f, 0xe2478a, 0x8790dd];
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      g.add(box(1.72, 0.1, 0.58, wood, { pos: [0, 0.1 + sIdx * 0.98, 0], outline: sIdx === 0 }));
      let bx = -0.75;
      while (bx < 0.7) {
        const w = 0.13 + r() * 0.1, h = 0.55 + r() * 0.3;
        g.add(box(w, h, 0.4, cols[Math.floor(r() * cols.length)], { pos: [bx + w / 2, 0.15 + sIdx * 0.98 + h / 2, 0], ol: 0.03 }));
        bx += w + 0.02;
      }
    }
    g.add(box(1.72, 3.1, 0.06, shade(wood, -0.3), { pos: [0, 1.6, -0.27], outline: false }));          // fundo da estante
    g.add(cyl(0.3, 0.22, 0.05, 0x3f3a4a, { pos: [-0.4, 3.3, 0], outline: false }));                    // vasinho e globo no topo
    g.add(sph(0.16, 0x4f7fc4, { pos: [0.4, 3.44, 0], ol: 0.03 }));
    g.add(cyl(0.02, 0.02, 0.2, 0x3f3a4a, { pos: [0.4, 3.28, 0], outline: false }));
    g.position.set(x, 0, z);
    if (rotY) g.rotation.y = rotY;
    return g;
  }

  function armchair(x, z, yaw, color) {
    const g = new T.Group();
    const F = { mat: { fabric: true } };
    // Medidas casadas com a armação de gente (STAND_Y/THIGH/SHIN em makeDoctor): assento a 0,63 do chão,
    // que é a altura do joelho, e 1,2 de fundo, que é a coxa — assim quem senta apoia o pé no chão em vez
    // de afundar o pé na base da poltrona.
    g.add(box(1.6, 0.3, 1.2, shade(color, -0.25), { pos: [0, 0.15, 0], ...F }));
    g.add(box(1.5, 0.33, 1.1, color, { pos: [0, 0.465, 0.02], ...F }));
    g.add(box(1.5, 1.45, 0.35, color, { pos: [0, 1.055, -0.52], ...F }));
    [-0.8, 0.8].forEach((sx) => {
      g.add(box(0.28, 0.62, 1.1, shade(color, -0.1), { pos: [sx, 0.73, 0.02], ...F }));
      g.add(cyl(0.14, 0.14, 1.1, shade(color, -0.1), { pos: [sx, 1.04, 0.02], rot: [Math.PI / 2, 0, 0], outline: false, ...F }));   // braço arredondado
    });
    [[-0.68, -0.48], [0.68, -0.48], [-0.68, 0.5], [0.68, 0.5]].forEach(([fx, fz]) => g.add(cyl(0.07, 0.05, 0.1, 0x5a3d26, { pos: [fx, 0.05, fz], outline: false })));
    g.add(box(1.2, 0.48, 0.14, shade(color, 0.12), { pos: [0, 1.16, -0.32], rot: [-0.1, 0, 0], ol: 0.03, ...F }));      // almofada do encosto
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    return g;
  }

  function sofa(x, z, c) {
    const g = new T.Group();
    const dark = shade(c, -0.25), mid = shade(c, -0.1), light = shade(c, 0.12), wood = 0x5a3d26;
    [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]].forEach(([fx, fz]) => g.add(cyl(0.07, 0.05, 0.16, wood, { pos: [fx, 0.08, fz], outline: false })));
    const F = { mat: { fabric: true } };
    g.add(box(2.9, 0.45, 1.25, dark, { pos: [0, 0.38, 0], ...F }));                                   // base
    [-0.65, 0.65].forEach((cx) => g.add(box(1.28, 0.3, 1.0, c, { pos: [cx, 0.76, 0.1], ol: 0.03, ...F })));      // duas almofadas do assento
    g.add(box(2.9, 1.05, 0.4, c, { pos: [0, 1.15, -0.45], ...F }));                                    // encosto
    [-0.65, 0.65].forEach((cx) => g.add(box(1.24, 0.6, 0.22, light, { pos: [cx, 1.2, -0.2], rot: [-0.12, 0, 0], ol: 0.03, ...F })));   // almofadas do encosto
    [-1.35, 1.35].forEach((sx) => {
      g.add(box(0.3, 0.8, 1.25, mid, { pos: [sx, 0.72, 0], ...F }));
      g.add(cyl(0.15, 0.15, 1.25, mid, { pos: [sx, 1.12, 0], rot: [Math.PI / 2, 0, 0], outline: false, ...F }));  // braço arredondado
    });
    g.add(box(0.5, 0.45, 0.18, 0xf2c230, { pos: [-0.75, 1.1, 0.12], rot: [-0.2, 0.2, 0.15], ol: 0.04 }));
    g.add(box(0.42, 0.42, 0.16, 0xd9534f, { pos: [0.85, 1.05, 0.14], rot: [-0.15, -0.25, -0.1], ol: 0.04 }));
    g.position.set(x, 0, z);
    return g;
  }

  function floorLamp(x, z) {
    const g = new T.Group();
    g.add(cyl(0.32, 0.32, 0.08, 0x4a3b2c, { pos: [0, 0.04, 0] }));
    g.add(cyl(0.05, 0.05, 2.3, 0x4a3b2c, { pos: [0, 1.2, 0], outline: false }));
    const cupula = cyl(0.42, 0.68, 0.75, 0xffe08a, { pos: [0, 2.55, 0], mat: { emissive: 0xffc44d, emissiveIntensity: 0.55 } });
    cupula.userData.vidro = true; g.add(cupula);
    const light = new T.PointLight(0xffc873, 0.55, 9);
    light.userData.luminaria = true;
    light.position.set(0, 2.5, 0.2);
    g.add(light);
    g.position.set(x, 0, z);
    return g;
  }

  function arcLamp(x, z) {
    const g = new T.Group();
    g.add(cyl(0.45, 0.5, 0.12, 0x2f2b3a, { pos: [0, 0.06, 0] }));
    g.add(cyl(0.05, 0.05, 2.6, 0x9aa0ad, { pos: [0, 1.4, 0], outline: false }));
    g.add(solid(new T.TorusGeometry(1.0, 0.045, 8, 24, Math.PI * 0.62), 0x9aa0ad, { pos: [-0.05, 2.65, 0], rot: [0, 0, 0.05], outline: false }));
    const globo = sph(0.36, 0xfff0b8, { pos: [-0.85, 3.1, 0], mat: { emissive: 0xffd76a, emissiveIntensity: 0.6 }, ol: 0.05 });
    globo.userData.vidro = true; g.add(globo);
    const light = new T.PointLight(0xffd88a, 0.5, 9);
    light.userData.luminaria = true;
    light.position.set(-0.85, 3.0, 0.3);
    g.add(light);
    g.position.set(x, 0, z);
    return g;
  }

  function framed(tex, w, h, x, y, z) {
    const g = new T.Group();
    g.add(box(w + 0.22, h + 0.22, 0.14, 0x7a5232, { pos: [0, 0, 0] }));
    const p = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex }));
    p.position.z = 0.09;
    g.add(p);
    g.position.set(x, y, z);
    return g;
  }

  function landscapeTex() {
    return canvasTex(256, 192, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.7); sky.addColorStop(0, "#9fd0ff"); sky.addColorStop(1, "#fff0c8");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffd24a"; g.beginPath(); g.arc(200, 44, 22, 0, 7); g.fill();
      g.fillStyle = "#7fb069"; g.beginPath(); g.moveTo(0, 130); g.quadraticCurveTo(70, 70, 150, 128); g.quadraticCurveTo(210, 100, 256, 120); g.lineTo(256, h); g.lineTo(0, h); g.fill();
      g.fillStyle = "#4f9a5e"; g.beginPath(); g.moveTo(0, 150); g.quadraticCurveTo(100, 110, 256, 150); g.lineTo(256, h); g.lineTo(0, h); g.fill();
    });
  }

  function brainTex() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#fff4dc"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#f4a3b8"; g.strokeStyle = "#15131f"; g.lineWidth = 6;
      g.beginPath(); g.ellipse(100, 120, 62, 70, 0, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(156, 120, 62, 70, 0, 0, 7); g.fill(); g.stroke();
      g.lineWidth = 4; g.strokeStyle = "#b25c78";
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(70 + i * 28, 70); g.bezierCurveTo(50 + i * 34, 100, 100 + i * 20, 130, 70 + i * 30, 176); g.stroke(); }
      g.fillStyle = "#15131f"; g.font = "bold 30px serif"; g.textAlign = "center"; g.fillText("Ψ", 128, 236);
    });
  }

  function starTex() {
    if (S.starTex) return S.starTex;
    S.starTex = canvasTex(64, 64, (g) => {
      g.fillStyle = "#ffd23f"; g.strokeStyle = "#15131f"; g.lineWidth = 4; g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke();
    });
    S.starTex.__compartilhada = true;
    return S.starTex;
  }

  function wallClock(x, y, z) {
    const g = new T.Group();
    g.add(cyl(0.62, 0.62, 0.14, 0x15131f, { rot: [Math.PI / 2, 0, 0], outline: false }));
    const face = new T.Mesh(new T.CircleGeometry(0.56, 32), new T.MeshBasicMaterial({ map: clockTex() }));
    face.position.z = 0.08;
    g.add(face);
    g.position.set(x, y, z);
    return g;
  }

  function diploma(x, y, z) {
    const g = new T.Group();
    g.add(box(1.5, 1.15, 0.1, 0xa07a3c, { pos: [0, 0, 0] }));
    const p = new T.Mesh(new T.PlaneGeometry(1.32, 0.99), new T.MeshBasicMaterial({ map: diplomaTex() }));
    p.position.z = 0.06;
    g.add(p);
    g.position.set(x, y, z);
    return g;
  }

  function coffeeTable(x, z) {
    const g = new T.Group();
    g.add(cyl(0.72, 0.72, 0.12, 0xb98a5a, { pos: [0, 0.66, 0], seg: 32 }));
    g.add(cyl(0.12, 0.16, 0.6, 0x7a5232, { pos: [0, 0.3, 0], outline: false }));
    g.add(cyl(0.5, 0.5, 0.06, 0x7a5232, { pos: [0, 0.03, 0], outline: false }));
    g.position.set(x, 0, z);
    return g;
  }

  function cup() {
    const g = new T.Group();
    g.add(cyl(0.34, 0.34, 0.03, 0xffffff, { pos: [0, 0.015, 0], ol: 0.03 }));
    g.add(cyl(0.2, 0.16, 0.26, 0xffffff, { pos: [0, 0.16, 0], ol: 0.03 }));
    g.add(cyl(0.17, 0.17, 0.02, 0x5a3b26, { pos: [0, 0.29, 0], outline: false }));
    g.add(solid(new T.TorusGeometry(0.09, 0.03, 8, 14), 0xffffff, { pos: [0.24, 0.17, 0], ol: 0.02 }));
    return g;
  }

  function tissues() {
    const g = new T.Group();
    g.add(box(0.6, 0.3, 0.38, 0x9fd3f0, { pos: [0, 0.15, 0], ol: 0.04 }));
    g.add(box(0.28, 0.2, 0.04, 0xffffff, { pos: [0, 0.38, 0], rot: [0.2, 0, 0.3], outline: false }));
    return g;
  }

  function vase() {
    const g = new T.Group();
    g.add(cyl(0.16, 0.22, 0.42, 0x6bb6d6, { pos: [0, 0.21, 0], ol: 0.03 }));
    [[-0.1, 0.62, 0, 0xe2478a], [0.12, 0.7, 0.05, 0xf2c230], [0, 0.78, -0.08, 0xffffff], [0.05, 0.6, 0.12, 0xd9534f]].forEach(([fx, fy, fz, c]) => {
      g.add(cyl(0.012, 0.012, 0.4, 0x3f9b4f, { pos: [fx * 0.6, fy - 0.2, fz * 0.6], outline: false }));
      g.add(sph(0.1, c, { pos: [fx, fy, fz], ol: 0.03 }));
    });
    return g;
  }

  function vase2(x, z) { const v = vase(); v.scale.setScalar(1.8); v.position.set(x, 0, z); return v; }

  function rug(color, cx, cz, rx, rz) {
    const g = new T.Group();
    const m = cyl(1, 1, 0.05, color, { pos: [0, 0.03, 0], seg: 48, cast: false, ol: 0.04 });
    m.scale.set(rx, 1, rz);
    g.add(m);
    const inner = new T.Mesh(new T.CylinderGeometry(0.82, 0.82, 0.06, 48), toon(shade(color, 0.35)));
    inner.scale.set(rx, 1, rz);
    inner.position.y = 0.035;
    inner.receiveShadow = true;
    g.add(inner);
    g.position.set(cx, 0, cz);
    return g;
  }

  function windowFrame(x, y, z, glowColor) {
    const g = new T.Group();
    g.add(box(2.7, 2.1, 0.16, 0x15131f, { outline: false, pos: [0, 0, 0.02] }));
    const glass = new T.Mesh(new T.PlaneGeometry(2.4, 1.8), new T.MeshBasicMaterial({ color: glowColor || 0xbfe3ff }));
    glass.position.z = 0.11;
    g.add(glass);
    const bar1 = new T.Mesh(new T.PlaneGeometry(0.09, 1.8), new T.MeshBasicMaterial({ color: INK }));
    bar1.position.z = 0.115;
    const bar2 = new T.Mesh(new T.PlaneGeometry(2.4, 0.09), new T.MeshBasicMaterial({ color: INK }));
    bar2.position.z = 0.115;
    g.add(bar1, bar2);
    g.position.set(x, y, z);
    return tag(g, "window");
  }

  function curtains(color) {
    const g = new T.Group();
    [-1.75, 1.75].forEach((dx) => g.add(box(0.9, 2.7, 0.22, color, { pos: [-2.7 + dx, 2.75, -3.5], ol: 0.05 })));
    g.add(box(4.6, 0.12, 0.12, 0x5a3b26, { pos: [-2.7, 4.15, -3.5], outline: false }));
    return g;
  }

  function toyChest(x, z) {
    const g = new T.Group();
    g.add(box(1.4, 0.7, 0.9, 0xd9534f, { pos: [0, 0.35, 0] }));
    g.add(box(1.5, 0.12, 1.0, 0x8a2f2c, { pos: [0, 0.76, 0] }));
    [[-0.35, 0.95, 0.1, 0x3f9b4f], [0.05, 0.95, -0.1, 0xf2c230], [0.4, 0.93, 0.2, 0x5b64bf]].forEach(([bx, by, bz, c]) => g.add(box(0.28, 0.28, 0.28, c, { pos: [bx, by, bz], rot: [0, bx, 0], ol: 0.04 })));
    g.add(sph(0.22, 0xe2478a, { pos: [0.6, 0.98, -0.2], ol: 0.04 }));
    g.position.set(x, 0, z);
    return g;
  }

  function desk(x, z) {
    const g = new T.Group();
    g.add(box(2.2, 0.12, 1.0, 0xb98a5a, { pos: [0, 1.05, 0] }));
    [[-1.0, -0.4], [1.0, -0.4], [-1.0, 0.4], [1.0, 0.4]].forEach(([lx, lz]) => g.add(box(0.1, 1.0, 0.1, 0x7a5232, { pos: [lx, 0.5, lz], outline: false })));
    g.add(box(0.95, 0.06, 0.65, 0x9aa0ad, { pos: [0, 1.14, 0.1], ol: 0.03 }));
    g.add(box(0.95, 0.65, 0.05, 0x2f2b3a, { pos: [0, 1.5, -0.2], rot: [-0.22, 0, 0], ol: 0.03 }));
    g.add(box(0.8, 0.5, 0.02, 0x9fd3f0, { pos: [0, 1.5, -0.17], rot: [-0.22, 0, 0], outline: false, mat: { emissive: 0x6fb3d6, emissiveIntensity: 0.4 } }));
    g.position.set(x, 0, z);
    g.rotation.y = Math.PI / 2;
    return g;
  }

  function aquarium(x, z) {
    const g = new T.Group();
    g.add(box(2.0, 1.0, 0.8, 0x7a5232, { pos: [0, 0.5, 0] }));
    const tank = new T.Mesh(new T.BoxGeometry(1.8, 1.0, 0.65), new T.MeshToonMaterial({ color: 0x9fd8f0, gradientMap: ramp, transparent: true, opacity: 0.45 }));
    tank.position.set(0, 1.55, 0);
    g.add(tank);
    g.add(box(1.85, 0.1, 0.7, 0x2f2b3a, { pos: [0, 2.1, 0], ol: 0.03 }));
    [[-0.4, 1.6, 0, 0xf2884a], [0.3, 1.4, 0.1, 0xf2c230], [0.5, 1.75, -0.1, 0xe2478a]].forEach(([fx, fy, fz, c]) => g.add(sph(0.13, c, { pos: [fx, fy, fz], ol: 0.03 })));
    g.add(sph(0.16, 0x3f9b4f, { pos: [-0.7, 1.15, 0.1], ol: 0.03 }));
    g.position.set(x, 0, z);
    g.userData.fish = true;
    return g;
  }

  function christmasTree(x, z) {
    const g = new T.Group();
    g.add(cyl(0.16, 0.2, 0.5, 0x7a5232, { pos: [0, 0.25, 0], outline: false }));
    [[1.1, 1.3, 0.9], [0.88, 2.0, 1.0], [0.65, 2.7, 0.9]].forEach(([r, y, h]) => g.add(solid(new T.ConeGeometry(r, h + 0.3, 16), 0x2f8442, { pos: [0, y, 0], ol: 0.06 })));
    [[0.5, 1.5, 0.4, 0xd9534f], [-0.4, 1.9, 0.5, 0xf2c230], [0.2, 2.5, 0.35, 0x5b64bf], [-0.3, 1.2, 0.6, 0xe2478a], [0.45, 2.1, -0.3, 0xffffff]].forEach(([bx, by, bz, c]) => g.add(sph(0.1, c, { pos: [bx, by, bz], ol: 0.03 })));
    g.add(sph(0.16, 0xffe08a, { pos: [0, 3.3, 0], mat: { emissive: 0xffc44d, emissiveIntensity: 0.7 }, ol: 0.04 }));
    [[0.9, 0.2, 0.9, 0xd9534f], [-0.9, 0.2, 0.7, 0x3f9b4f]].forEach(([gx, gy, gz, c]) => g.add(box(0.45, 0.4, 0.45, c, { pos: [gx, gy, gz], ol: 0.04 })));
    g.position.set(x, 0, z);
    return g;
  }

  function pumpkins(x, z) {
    const g = new T.Group();
    [[0, 0, 0.6], [0.8, 0.05, 0.42], [-0.7, 0.04, 0.48]].forEach(([px, pz, r]) => {
      const p = sph(r, 0xf08a1f, { pos: [px, r * 0.85, pz], ol: 0.05 });
      p.scale.y = 0.82;
      g.add(p);
      g.add(cyl(0.06, 0.08, 0.2, 0x5a8f3a, { pos: [px, r * 1.55, pz], outline: false }));
    });
    g.position.set(x, 0, z);
    return g;
  }

  function eggBasket(x, z) {
    const g = new T.Group();
    g.add(cyl(0.65, 0.5, 0.5, 0xb98a5a, { pos: [0, 0.25, 0] }));
    [[-0.25, 0.6, 0.1, 0xe2478a], [0.2, 0.62, -0.1, 0x6bb6d6], [0.05, 0.7, 0.25, 0xf2c230], [-0.1, 0.72, -0.2, 0x8fd18f], [0.32, 0.6, 0.22, 0xb79be0]].forEach(([ex, ey, ez, c]) => {
      const e = sph(0.17, c, { pos: [ex, ey, ez], ol: 0.03 });
      e.scale.y = 1.25;
      g.add(e);
    });
    g.position.set(x, 0, z);
    return g;
  }

  function waterCooler(x, z) {
    const g = new T.Group();
    g.add(box(0.7, 1.3, 0.6, 0xe4e4e8, { pos: [0, 0.65, 0] }));
    g.add(cyl(0.3, 0.3, 0.7, 0x9fd8f0, { pos: [0, 1.65, 0], mat: { transparent: true, opacity: 0.6 }, ol: 0.04 }));
    g.add(box(0.14, 0.08, 0.1, 0x4f7fc4, { pos: [0, 0.95, 0.32], ol: 0.02 }));
    g.position.set(x, 0, z);
    return g;
  }

  function magazines() {
    const g = new T.Group();
    [0xd9534f, 0x5b64bf, 0xf2c230].forEach((c, i) => g.add(box(0.55, 0.05, 0.4, c, { pos: [0, 0.03 + i * 0.05, 0], rot: [0, i * 0.4, 0], ol: 0.02 })));
    return g;
  }

  function bench(x, z, w) {
    const g = new T.Group();
    g.add(box(w, 0.28, 0.9, 0x6b7fa8, { pos: [0, 0.55, 0] }));
    g.add(box(w, 0.8, 0.22, 0x6b7fa8, { pos: [0, 1.0, -0.4] }));
    [-w / 2 + 0.15, w / 2 - 0.15].forEach((lx) => g.add(box(0.12, 0.45, 0.7, 0x4a5a80, { pos: [lx, 0.22, 0], outline: false })));
    g.position.set(x, 0, z);
    return g;
  }

  function smallTable(x, z) {
    const g = new T.Group();
    g.add(cyl(0.5, 0.5, 0.08, 0xb98a5a, { pos: [0, 0.7, 0], seg: 24 }));
    g.add(cyl(0.07, 0.1, 0.66, 0x7a5232, { pos: [0, 0.35, 0], outline: false }));
    g.position.set(x, 0, z);
    return g;
  }

  // ------------------------------------------------------------------ psicóloga(o) articulada, com animações suaves
  // Cada articulação é um grupo (ombro, cotovelo, quadril, joelho, cabeça). A cada quadro calculamos os ângulos-alvo do
  // "modo" atual e a pose se aproxima deles aos poucos: por isso as transições ficam fluidas.
  // caixas no chão dos móveis de um cenário (ignora tapetes, quadros na parede e paredes)
  function furnitureBoxes(groups, extra) {
    const out = [];
    groups.forEach((grp) => grp.children.forEach((g) => {
      const b3 = new T.Box3().setFromObject(g);
      if (b3.isEmpty()) return;
      const w = b3.max.x - b3.min.x, dd = b3.max.z - b3.min.z;
      if (b3.max.y < 0.32 || b3.min.y > 0.9 || w > 7 || dd > 7) return;
      out.push({ x0: b3.min.x, x1: b3.max.x, z0: b3.min.z, z1: b3.max.z, solid: true, id: (g.userData && (g.userData.item || g.userData.furniture)) || g.name || "" });
    }));
    return out.concat(extra || []);
  }


  // decoração solta nunca "engole" outro móvel: se a caixa de um item cruza a de um móvel já colocado, ele é deslocado
  // para o espaço livre mais próximo dentro da sala; se não couber em lugar nenhum, fica de fora
  const SPREAD = (() => {
    const list = [[0, 0]];
    for (let r = 0.35; r <= 3.2; r += 0.35) for (let a = 0; a < 16; a++) list.push([Math.cos((a / 16) * Math.PI * 2) * r, Math.sin((a / 16) * Math.PI * 2) * r]);
    return list;
  })();
  function boxOf(o) { const b = new T.Box3().setFromObject(o); return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, y0: b.min.y, y1: b.max.y }; }
  const crosses = (a, b, m = 0.04) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > m && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > m;
  function spreadClear(parent, movable, placed, bounds) {
    movable.forEach((o) => {
      const base = boxOf(o);
      if (base.y1 < 0.32 || base.y0 > 0.9) return;                                   // tapetes e coisas na parede não colidem
      const fits = (dx, dz) => {
        const b = { x0: base.x0 + dx, x1: base.x1 + dx, z0: base.z0 + dz, z1: base.z1 + dz };
        return b.x0 >= bounds.x0 && b.x1 <= bounds.x1 && b.z0 >= bounds.z0 && b.z1 <= bounds.z1 && !placed.some((p) => crosses(b, p));
      };
      const hit = SPREAD.find(([dx, dz]) => fits(dx, dz));
      if (!hit) { parent.remove(o); return; }
      o.position.x += hit[0]; o.position.z += hit[1];
      placed.push({ x0: base.x0 + hit[0], x1: base.x1 + hit[0], z0: base.z0 + hit[1], z1: base.z1 + hit[1] });
    });
  }

  // A armação articulada vive em js/render/rig.js desde a 7.11 (eram 583 linhas dentro deste arquivo).
  // As peças de desenho continuam aqui e são entregues a ela; o comportamento é o mesmo.
  const makeDoctor = window.criarRig({ T, box, canvasTex, cup, cyl, hex, loadTex, shade, solid, sph });



  // ------------------------------------------------------------------ bichinhos de estimação em 3D
  const PET_BASE = { cao: "#c99a62", gato: "#a0a0a8", coelho: "#e8dfd2", hamster: "#e0b070", jabuti: "#7a9a5a", papagaio: "#3fae5a", gecko: "#c9a55a", cobra: "#d98a3a", tarantula: "#5a3a2a", ourico: "#a8845c", dragao: "#c9a05a", arara: "#2f6fd0", rato: "#fbf7f2" };
  const PET_VAR = { "vira-lata": "#b58a5a", poodle: "#f4f0ea", labrador: "#d9b56b", shihtzu: "#e8d5b5", golden: "#e0a84a", "sem-raca": "#8f8f96", siames: "#e9dcc4", persa: "#f2eee8", maine: "#a67b4b", preto: "#2b2b30", anao: "#c9b9a0", angora: "#f6f2ec", lop: "#b08a62", sirio: "#d99a4a", russo: "#ecebf0", robo: "#e6c99a", piranga: "#6a8a4a", tinga: "#9a9a4a", verdadeiro: "#3fae5a", periquito: "#5ac0e0", cinza: "#9a9aa2", leopardo: "#e0b84a", crested: "#c9743a", milho: "#e0742a", real: "#4a4038", rosada: "#c98a8a", azul: "#3a5ad0", pigmeu: "#a8845c", albino: "#f1ece4", barbudo: "#c9a05a", citrico: "#e8c03a", vermelha: "#d23a2a", branco: "#fbf7f2", dumbo: "#cfc8c8", hooded: "#7a6552" };

  function makePet(spec) {
    const base = PET_VAR[spec.variant] || PET_BASE[spec.species] || "#c9a070";
    const col = hex(base), dark = shade(base, -0.4), light = shade(base, 0.4);
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const legs = [];
    let tail = null;
    const sp = spec.species;
    const leg = (x, z, h, c) => { const l = new T.Group(); l.position.set(x, h, z); l.add(cyl(0.05, 0.05, h, c || dark, { pos: [0, -h / 2, 0], ol: 0.02 })); body.add(l); legs.push(l); return l; };
    const eyes = (y, z, s = 0.03, sep = 0.09) => [-sep, sep].forEach((x) => body.add(sph(s, 0x1b1620, { pos: [x, y, z], outline: false })));
    const add = (m) => { body.add(m); return m; };
    if (["cao", "gato", "coelho", "hamster", "rato", "ourico"].includes(sp)) {
      const big = { cao: 1, gato: 0.8, coelho: 0.72, hamster: 0.36, rato: 0.4, ourico: 0.5 }[sp];
      const W = 0.32 * big, Ln = 0.6 * big, Hh = 0.32 * big;
      add(sph(1, col, { pos: [0, Hh + 0.12 * big, 0], ol: 0.05 })).scale.set(W, Hh, Ln);
      const headR = { cao: 0.2, gato: 0.17, coelho: 0.15, hamster: 0.11, rato: 0.1, ourico: 0.13 }[sp];
      const hz = Ln * 0.9, hy = Hh + 0.3 * big;
      add(sph(headR, col, { pos: [0, hy, hz], ol: 0.04 }));
      add(sph(headR * 0.4, light, { pos: [0, hy - headR * 0.25, hz + headR * 0.8], outline: false }));
      add(sph(headR * 0.16, 0x2a1f24, { pos: [0, hy - headR * 0.1, hz + headR * 1.1], outline: false }));
      eyes(hy + headR * 0.25, hz + headR * 0.8, headR * 0.16, headR * 0.45);
      if (sp === "cao") { [-1, 1].forEach((sx) => add(box(0.07, 0.2, 0.1, dark, { pos: [sx * 0.17, hy - 0.02, hz - 0.03], rot: [0, 0, sx * 0.25], ol: 0.03 }))); }
      if (sp === "gato") { [-1, 1].forEach((sx) => add(cyl(0, 0.06, 0.13, dark, { pos: [sx * 0.09, hy + 0.15, hz], rot: [0, 0, -sx * 0.15], seg: 4, ol: 0.02 }))); }
      if (sp === "coelho") { [-1, 1].forEach((sx) => add(sph(1, col, { pos: [sx * 0.07, hy + 0.27, hz - 0.03], rot: [0, 0, sx * 0.12], ol: 0.04 })).scale.set(0.05, 0.24, 0.035)); }
      if (sp === "hamster" || sp === "rato") { [-1, 1].forEach((sx) => add(cyl(sp === "rato" ? 0.07 : 0.05, 0.05, 0.02, sp === "rato" ? 0xf2b6b6 : dark, { pos: [sx * headR * 0.85, hy + headR * 0.7, hz - 0.03], rot: [Math.PI / 2, 0, 0], ol: 0.02 }))); }
      if (sp === "ourico") { for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; add(cyl(0, 0.03, 0.14, 0x4a3a2c, { pos: [Math.cos(a) * W * 0.8, Hh + 0.22 * big + Math.sin(a * 2) * 0.03, -Ln * 0.2 + Math.sin(a) * Ln * 0.5], rot: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], seg: 5, outline: false })); } }
      const lh = 0.12 * big + 0.03;
      [[-1, 0.6], [1, 0.6], [-1, -0.6], [1, -0.6]].forEach(([sx, sz]) => leg(sx * W * 0.7, sz * Ln * 0.5, lh, sp === "ourico" ? light : dark));
      if (sp === "rato") { tail = add(cyl(0.012, 0.03, 0.42, 0xf2b6b6, { pos: [0, 0.14, -Ln * 0.9], rot: [1.25, 0, 0], ol: 0.01 })); }
      else if (sp === "gato") { tail = add(cyl(0.03, 0.045, 0.5, col, { pos: [0, 0.4, -Ln * 0.95], rot: [-0.5, 0, 0], ol: 0.03 })); }
      else if (sp === "cao") { tail = add(cyl(0.03, 0.05, 0.3, dark, { pos: [0, 0.4, -Ln * 0.95], rot: [-0.8, 0, 0], ol: 0.03 })); }
      else if (sp === "coelho") { tail = add(sph(0.07, 0xffffff, { pos: [0, 0.3, -Ln * 0.9], ol: 0.02 })); }
    } else if (sp === "jabuti") {
      add(sph(1, col, { pos: [0, 0.22, 0], ol: 0.05 })).scale.set(0.34, 0.24, 0.42);
      add(sph(1, shade(base, -0.25), { pos: [0, 0.3, 0], outline: false })).scale.set(0.22, 0.12, 0.28);
      add(sph(0.09, 0xb0b88a, { pos: [0, 0.16, 0.45], ol: 0.03 }));
      eyes(0.19, 0.52, 0.02, 0.05);
      [[-1, 0.2], [1, 0.2], [-1, -0.2], [1, -0.2]].forEach(([sx, sz]) => leg(sx * 0.26, sz, 0.09, 0xb0b88a));
    } else if (sp === "papagaio" || sp === "arara") {
      const s = sp === "arara" ? 1.25 : 1;
      add(sph(1, col, { pos: [0, 0.5 * s, 0], ol: 0.05 })).scale.set(0.17 * s, 0.26 * s, 0.15 * s);
      add(sph(0.11 * s, sp === "arara" ? shade(base, 0.1) : light, { pos: [0, 0.8 * s, 0.05 * s], ol: 0.04 }));
      add(cyl(0.02, 0.05 * s, 0.1 * s, 0xf2c94c, { pos: [0, 0.78 * s, 0.16 * s], rot: [1.9, 0, 0], seg: 6, ol: 0.02 }));
      eyes(0.83 * s, 0.13 * s, 0.02, 0.055 * s);
      tail = add(box(0.07 * s, 0.34 * s, 0.03, sp === "arara" ? 0xd23a2a : dark, { pos: [0, 0.28 * s, -0.16 * s], rot: [0.35, 0, 0], ol: 0.02 }));
      [-1, 1].forEach((sx) => add(sph(1, dark, { pos: [sx * 0.15 * s, 0.5 * s, -0.02], rot: [0, 0, -sx * 0.15], ol: 0.03 })).scale.set(0.04, 0.2 * s, 0.11 * s));
      leg(-0.05, 0, 0.22 * s, 0xf2c94c); leg(0.05, 0, 0.22 * s, 0xf2c94c);
    } else if (sp === "cobra") {
      const n = 9;
      for (let i = 0; i < n; i++) { const r = 0.09 - i * 0.006; const seg = sph(r, i % 2 ? dark : col, { pos: [0, r, -i * 0.11], ol: 0.03 }); seg.userData.i = i; body.add(seg); legs.push(seg); }
      add(sph(0.1, col, { pos: [0, 0.11, 0.1], ol: 0.03 }));
      eyes(0.15, 0.16, 0.02, 0.045);
    } else if (sp === "tarantula") {
      add(sph(0.16, col, { pos: [0, 0.18, -0.1], ol: 0.04 }));
      add(sph(0.11, dark, { pos: [0, 0.18, 0.08], ol: 0.03 }));
      eyes(0.22, 0.17, 0.02, 0.04);
      for (let i = 0; i < 4; i++) [-1, 1].forEach((sx) => { const l = new T.Group(); l.position.set(sx * 0.08, 0.15, -0.02 + (i - 1.5) * 0.09); l.add(cyl(0.02, 0.02, 0.3, dark, { pos: [sx * 0.13, -0.02, 0], rot: [0, 0, sx * 1.1], ol: 0.01 })); body.add(l); legs.push(l); });
    } else {   // gecko e dragão-barbudo
      const k = sp === "dragao" ? 1.3 : 0.9;
      add(sph(1, col, { pos: [0, 0.1 * k, 0], ol: 0.04 })).scale.set(0.11 * k, 0.07 * k, 0.32 * k);
      add(sph(0.09 * k, col, { pos: [0, 0.12 * k, 0.36 * k], ol: 0.03 })).scale.set(1, 0.8, 1.2);
      eyes(0.16 * k, 0.4 * k, 0.02, 0.05 * k);
      tail = add(cyl(0.005, 0.06 * k, 0.5 * k, col, { pos: [0, 0.08 * k, -0.5 * k], rot: [Math.PI / 2, 0, 0], ol: 0.02 }));
      [[-1, 0.2], [1, 0.2], [-1, -0.2], [1, -0.2]].forEach(([sx, sz]) => { const l = leg(sx * 0.13 * k, sz * k, 0.06 * k, dark); l.rotation.z = sx * 0.35; });
      if (sp === "dragao") { for (let i = 0; i < 6; i++) add(cyl(0, 0.02, 0.07, dark, { pos: [0, 0.16 * k, 0.2 * k - i * 0.1 * k], seg: 4, outline: false })); }
    }
    if (spec.shine) {
      const star = new T.Sprite(new T.SpriteMaterial({ map: starTex(), transparent: true, depthTest: false }));
      star.scale.set(0.4, 0.4, 1);
      star.position.set(0.25, 0.9, 0);
      root.add(star);
      body.traverse((m) => { if (m.material && m.material.emissive && m.material !== HULL) { m.material = m.material.clone(); m.material.emissive = new T.Color(0xffd84a); m.material.emissiveIntensity = 0.35; } });
      root.userData.star = star;
    }
    root.userData.pet = { legs, tail, body, kind: sp, spec };
    // cintilar de cor nos bichinhos: partes pequenas recebendo a própria sombra (acne) e peças coladas (olho, mancha, focinho) disputando a mesma profundidade
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material && o.material.color && o.material !== HULL) { o.receiveShadow = false; o.material = o.material.clone(); o.material.polygonOffset = true; o.material.polygonOffsetFactor = -1; o.material.polygonOffsetUnits = -1; }
    });
    return root;
  }

  // o bando de bichinhos de uma sala: anda sem atravessar móveis (caminha só em linha livre) e descansa de vez em quando
  function makeHerd(bounds) {
    const group = new T.Group();
    const pets = [];
    let obstacles = [];
    let key = "";
    const RAD = 0.3;
    const free = (x, z) => x > bounds.x0 && x < bounds.x1 && z > bounds.z0 && z < bounds.z1 && !obstacles.some((b) => x > b.x0 - RAD && x < b.x1 + RAD && z > b.z0 - RAD && z < b.z1 + RAD);
    const clear = (a, b, c, d) => { const n = Math.ceil(Math.hypot(c - a, d - b) / 0.1); for (let k = 0; k <= n; k++) if (!free(a + ((c - a) * k) / n, b + ((d - b) * k) / n)) return false; return true; };
    return {
      group,
      setBounds(x1) { bounds.x1 = x1; },
      set(list, obst) {
        obstacles = obst || [];
        const k = JSON.stringify((list || []).map((p) => [p.species, p.variant, p.shine]));
        // os móveis podem chegar depois dos bichinhos (casa): quem estiver dentro de um móvel vai para um ponto livre
        pets.forEach((p) => {
          if (free(p.m.position.x, p.m.position.z)) return;
          for (let n = 0; n < 120; n++) {
            const x = bounds.x0 + Math.random() * (bounds.x1 - bounds.x0), z = bounds.z0 + Math.random() * (bounds.z1 - bounds.z0);
            if (free(x, z)) { p.m.position.set(x, 0, z); p.tx = x; p.tz = z; break; }
          }
        });
        if (k === key) return;
        key = k;
        while (group.children.length) group.remove(group.children[0]);
        pets.length = 0;
        (list || []).forEach((p, i) => {
          const m = makePet(p);
          let x = bounds.x0 + 1 + (i * 1.7) % (bounds.x1 - bounds.x0 - 2), z = bounds.z0 + 0.8 + ((i * 0.9) % (bounds.z1 - bounds.z0 - 1.5));
          for (let n = 0; n < 40 && !free(x, z); n++) { x = bounds.x0 + Math.random() * (bounds.x1 - bounds.x0); z = bounds.z0 + Math.random() * (bounds.z1 - bounds.z0); }
          m.position.set(x, 0, z);
          group.add(m);
          pets.push({ m, tx: x, tz: z, wait: Math.random() * 2, phase: Math.random() * 6, speed: 0.35 + Math.random() * 0.25 });
        });
      },
      update(t, dt) {
        pets.forEach((p) => {
          const d = p.m.userData.pet, m = p.m;
          const dx = p.tx - m.position.x, dz = p.tz - m.position.z, dist = Math.hypot(dx, dz);
          let moving = false;
          if (p.wait > 0) p.wait -= dt;
          else if (dist > 0.08) {
            const sp = Math.min(dist, p.speed * (d.kind === "cobra" || d.kind === "jabuti" ? 0.6 : 1) * dt), nx = m.position.x + (dx / dist) * sp, nz = m.position.z + (dz / dist) * sp;
            if (free(nx, nz)) { m.position.x = nx; m.position.z = nz; moving = true; } else p.wait = 0.3, p.tx = m.position.x, p.tz = m.position.z;
            let dy = Math.atan2(dx, dz) - m.rotation.y;
            while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
            m.rotation.y += dy * Math.min(1, dt * 6);
          } else {
            p.wait = 1.5 + Math.random() * 3.5;
            for (let n = 0; n < 12; n++) {
              const gx = bounds.x0 + Math.random() * (bounds.x1 - bounds.x0), gz = bounds.z0 + Math.random() * (bounds.z1 - bounds.z0);
              if (free(gx, gz) && clear(m.position.x, m.position.z, gx, gz)) { p.tx = gx; p.tz = gz; break; }
            }
          }
          if (moving) p.phase += dt * (5 + p.speed * 6);
          const sw = moving ? Math.sin(p.phase) : 0;
          d.legs.forEach((l, i) => {
            if (d.kind === "cobra") l.position.x = moving ? Math.sin(p.phase + i * 0.8) * 0.06 : 0;
            else l.rotation.x = (i % 2 ? sw : -sw) * 0.6;
          });
          d.body.position.y = moving ? Math.abs(Math.sin(p.phase)) * 0.03 : Math.sin(t * 2 + p.phase) * 0.004;
          if (d.tail) d.tail.rotation.z = Math.sin(t * (moving ? 8 : 2.5) + p.phase) * 0.35;
          if (m.userData.star) m.userData.star.position.y = 0.9 + Math.sin(t * 3 + p.phase) * 0.06;
        });
      }
    };
  }

  // a psicóloga sentada, feita de formas simples com as cores que o jogador escolheu
  const ROOM_SIZES = [{ dxL: 0, dz: 0 }, { dxL: 2.4, dz: 1.8 }, { dxL: 4.8, dz: 3.6 }];
  const sizeOf = (lv) => ROOM_SIZES[Math.max(0, Math.min(2, Number(lv) || 0))];
  const roomBounds = (lv, right) => { const z = sizeOf(lv); return { x0: -5.25 - z.dxL, x1: right, z0: -3.66, z1: 3.3 + z.dz }; };   // limites para colocar móveis (o chão de caminhada é um pouco menor)

  function shell(wallColor, floorColor, extend, fpWall, level) {
    const ext = extend || 0, { dxL, dz } = sizeOf(level);
    const W = 10.8 + ext + dxL, D = 7.8 + dz, cx = ext / 2 - dxL / 2, cz = dz / 2;
    const g = new T.Group();
    g.add(box(W, 0.3, D, floorColor, { pos: [cx, -0.15, cz], cast: false }));
    const planks = planksTex(); planks.wrapS = planks.wrapT = T.RepeatWrapping; planks.repeat.set(W / 10.6, D / 7.6);
    const top = new T.Mesh(new T.PlaneGeometry(W - 0.2, D - 0.2), toon(0xffffff, { map: planks, roughness: 0.62, bumpMap: bumpNoise(), bumpScale: 0.12 }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(cx, 0.01, cz);
    top.receiveShadow = true;
    g.add(top);
    g.add(box(W, 4.9, 0.3, wallColor, { pos: [cx, 2.45, -3.85], cast: false, mat: { roughness: 0.92, map: wallTex(), bumpMap: bumpNoise(), bumpScale: 0.07 } }));
    if (ext) g.add(box(0.3, 4.9, D, shade(wallColor, -0.07), { pos: [5.4 + ext + 0.15, 2.45, cz], cast: false }));
    if (ext) {
      // divisória com porta entre o consultório e a sala de espera
      const px = 5.6, dz0 = -0.1, dz1 = 1.7, dwall = shade(wallColor, -0.04), zf = 3.85 + dz;
      g.add(box(0.3, 4.9, 3.85 + dz0, dwall, { pos: [px, 2.45, (-3.85 + dz0) / 2 - 0.0], cast: false }));            // trecho de trás
      g.add(box(0.3, 4.9, zf - dz1, dwall, { pos: [px, 2.45, (dz1 + zf) / 2], cast: false }));                        // trecho da frente
      g.add(box(0.3, 1.7, dz1 - dz0, dwall, { pos: [px, 4.05, (dz0 + dz1) / 2], cast: false }));                      // verga
      g.add(box(0.36, 3.2, 0.12, 0x6a4526, { pos: [px, 1.6, dz0], outline: false, cast: false }));                   // batentes
      g.add(box(0.36, 3.2, 0.12, 0x6a4526, { pos: [px, 1.6, dz1], outline: false, cast: false }));
      g.add(box(0.36, 0.12, dz1 - dz0 + 0.12, 0x6a4526, { pos: [px, 3.2, (dz0 + dz1) / 2], outline: false, cast: false }));
      const hinge = new T.Group();                                                                                    // porta entreaberta
      hinge.position.set(px, 0, dz1 - 0.06);
      hinge.add(box(0.1, 3.1, dz1 - dz0 - 0.2, 0x9a6b3c, { pos: [0, 1.55, -(dz1 - dz0 - 0.2) / 2], ol: 0.02, cast: false }));
      hinge.add(sph(0.06, 0xd9a520, { pos: [0.08, 1.5, -(dz1 - dz0 - 0.2) + 0.15], outline: false }));
      hinge.rotation.y = -1.15;
      g.add(hinge);
    }
    g.add(box(0.3, 4.9, D, shade(wallColor, -0.07), { pos: [-5.4 - dxL, 2.45, cz], cast: false }));
    if (fpWall && !ext) {   // na visão em 1ª pessoa você olha para o lado aberto da sala: fecha com parede, janela e quadro
      g.add(box(0.3, 4.9, D, shade(wallColor, -0.04), { pos: [5.4, 2.45, cz], cast: false, mat: { roughness: 0.92, map: wallTex(), bumpMap: bumpNoise(), bumpScale: 0.07 } }));
      g.add(box(0.1, 0.22, D - 0.2, shade(wallColor, -0.35), { pos: [5.25, 0.11, cz], outline: false, cast: false }));
      const fr = box(0.12, 2.0, 2.6, 0x3a2a1c, { pos: [5.2, 2.9, -1.4], cast: false });
      g.add(fr);
      g.add(box(0.14, 1.75, 2.35, 0xbfe3f5, { pos: [5.18, 2.9, -1.4], cast: false, mat: { roughness: 0.15, emissive: 0x8fbfe6, emissiveIntensity: 0.45 } }));
      g.add(box(0.16, 1.75, 0.08, 0x3a2a1c, { pos: [5.16, 2.9, -1.4], cast: false, outline: false }));
      g.add(box(0.16, 0.08, 2.35, 0x3a2a1c, { pos: [5.16, 2.9, -1.4], cast: false, outline: false }));
      const pic = new T.Mesh(new T.PlaneGeometry(1.5, 1.1), new T.MeshBasicMaterial({ map: abstractTex() }));
      pic.rotation.y = -Math.PI / 2; pic.position.set(5.12, 2.7, 2.2); g.add(pic);
      g.add(box(0.1, 1.2, 1.6, 0x3a2a1c, { pos: [5.24, 2.7, 2.2], cast: false, outline: false }));
    }
    g.add(box(W - 0.2, 0.22, 0.1, shade(wallColor, -0.3), { pos: [cx, 0.11, -3.66], outline: false, cast: false }));
    g.add(box(0.1, 0.22, D - 0.2, shade(wallColor, -0.35), { pos: [-5.25 - dxL, 0.11, cz], outline: false, cast: false }));
    if (dxL || dz) {   // janelas extras na parede de fundo alargada
      for (let k = 0; k < (dxL > 3 ? 2 : 1); k++) g.add(tag(windowFrame(-6.4 - k * 2.9, 2.7, -3.68, 0xbfe3ff), "window-extra"));
    }
    return g;
  }

  // ------------------------------------------------------------------ itens do consultório e temas
  const ITEM_COLORS = {
    sofa: 0x6aa89a, "sofa-mostarda": 0xd9a51f, "sofa-vinho": 0x8c3a4f,
    tapete: 0xb9536b, "tapete-azul": 0x4f7fc4, "tapete-verde": 0x4f9a6a, "e-tapete": 0x7d6fc4, "casa-tapete": 0xb9536b, "k-tapete": 0xe0a050,
    "cortina-rosa": 0xe58aa8, "cortina-azul": 0x6f9fd8
  };

  // ------------------------------------------------------------------ decoração livre
  // Cada item de chão é embrulhado num grupo centrado no próprio corpo: assim ele gira e anda sem sair do lugar errado.
  // O jogador guarda { x, z, yaw } por item; itens novos sem posição guardada procuram sozinhos um espaço livre.
  const WALL_ITEM = (id) => /^(quadro-|poster$|e-quadro$|k-quadro$)/.test(id);
  const FIXED_ITEM = (id) => /^(cortina|tapete|e-tapete|casa-tapete|k-tapete|cafe$|lencos$|flores$|window)/.test(id);
  const EXTRA_ITEMS = {};                                   // móveis novos (registrados por furniture.js)

  // ------------------------------------------------------------------ modelos externos (.gltf / .glb)
  // O carregador vem de vendor/gltf-loader.js (gerado por `npm run build:gltf`) e só é baixado na primeira vez que alguém pede um modelo.
  let gltfLib = null;
  function ensureGLTF() {
    if (T.GLTFLoader) return Promise.resolve();
    if (!gltfLib) gltfLib = new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "vendor/gltf-loader.js"; sc.onload = () => (T.GLTFLoader ? ok() : no(new Error("GLTFLoader ausente"))); sc.onerror = () => no(new Error("vendor/gltf-loader.js não carregou")); document.head.appendChild(sc); });
    return gltfLib;
  }
  const modelCache = {};
  // Promise<Group>: cena do arquivo, apoiada no chão (y = 0), centrada em x/z, com altura opcional (o.height, em unidades do jogo),
  // sombras ligadas e materiais PBR ajustados ao ambiente. O mesmo arquivo pode ser usado várias vezes (clone).
  function loadModel(url, o = {}) {
    return ensureGLTF().then(() => (modelCache[url] = modelCache[url] || new Promise((ok, no) => new T.GLTFLoader().load(url, (g) => ok(g.scene), undefined, no)))).then((scene) => {
      const g = scene.clone(true), box = new T.Box3().setFromObject(g), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
      const k = o.height && size.y > 0 ? o.height / size.y : (o.scale || 1), W = new T.Group();
      g.position.set(-c.x, -box.min.y, -c.z); W.add(g); W.scale.setScalar(k);
      g.traverse((m) => { if (m.isMesh) { m.castShadow = o.cast !== false; m.receiveShadow = true; const ms = Array.isArray(m.material) ? m.material : [m.material]; ms.forEach((mt) => { if (mt && mt.isMeshStandardMaterial) mt.envMapIntensity = Math.max(mt.envMapIntensity || 0, 0.45); }); } });
      return W;
    });
  }
  // para usar dentro de build(k) de um móvel: devolve já um Group com o lugar reservado (caixa invisível w × d × h) e o modelo entra quando carregar
  function model(url, o = {}) {
    const [w, d, h] = o.size || [1, 1, 1], g = new T.Group();
    const place = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ visible: false })); place.position.y = h / 2; g.add(place);
    loadModel(url, Object.assign({ height: h }, o)).then((m) => { g.add(m); g.userData.modelLoaded = true; if (S.cur) S.cur.dirty = true; }).catch((e) => console.warn("modelo 3D:", url, e && e.message));
    return g;
  }
  const kitObj = { T, box, cyl, sph, solid, toon, shade, hex, INK, canvasTex, rng, tag, cup, armchair, sofa, bookshelf, plant, floorLamp, rug, model, lampLight, acabamento, PRESETS };
  function registerItems(map) { Object.keys(map).forEach((id) => { EXTRA_ITEMS[id] = map[id]; }); }

  function centered(g, kind) {
    const b = new T.Box3().setFromObject(g), c = b.getCenter(new T.Vector3());
    const W = new T.Group();
    g.position.x -= c.x; g.position.z -= c.z;
    W.add(g); W.position.set(c.x, 0, c.z);
    W.userData = { mov: kind, itemId: g.userData.item, furniture: g.userData.item };
    return W;
  }
  // caixa no chão (xz) de um item já colocado, com o giro atual
  const inside = (b, bounds) => b.x0 >= bounds.x0 - 1e-6 && b.x1 <= bounds.x1 + 1e-6 && b.z0 >= bounds.z0 - 1e-6 && b.z1 <= bounds.z1 + 1e-6;
  const blocks = (b) => !(b.y1 < 0.32 || b.y0 > 0.9);       // tapetes e coisas na parede não bloqueiam ninguém

  // aplica a posição guardada (se houver) e devolve o grupo pronto; "wall" só desliza na parede
  function placeItem(W, id, L) {
    if (!L) return W;
    if (W.userData.mov === "wall") { if (typeof L.x === "number") W.position.x = L.x; return W; }
    if (typeof L.yaw === "number") W.rotation.y = L.yaw;
    if (typeof L.x === "number") W.position.x = L.x;
    if (typeof L.z === "number") W.position.z = L.z;
    return W;
  }

  // procura o espaço livre mais próximo das paredes (fundo, depois esquerda) onde o item cabe sem tocar em nada
  function autoPlace(W, placed, bounds) {
    const base = boxOf(W), w = base.x1 - base.x0, d = base.z1 - base.z0;
    const cx0 = (base.x0 + base.x1) / 2, cz0 = (base.z0 + base.z1) / 2;
    const cands = [];
    for (let x = bounds.x0 + w / 2; x <= bounds.x1 - w / 2 + 1e-6; x += 0.3) for (let z = bounds.z0 + d / 2; z <= bounds.z1 - d / 2 + 1e-6; z += 0.3) {
      const wall = Math.min(x - w / 2 - bounds.x0, z - d / 2 - bounds.z0);
      cands.push([wall + (bounds.x1 - x) * 0.02, x, z]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (const [, x, z] of cands) {
      const b = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
      // A margem daqui e a do editor (`overlaps`, em decor.js) têm de contar a mesma coisa: com 0,05
      // aqui e 0,04 lá, o jogo encostava duas peças por 5 cm e o editor depois dizia "encosta em outro
      // móvel" e não deixava girar o que ele mesmo tinha posto ali. Apertar ESTE lado custaria móveis
      // (quatro peças a mais ficavam sem lugar), então quem cede é o editor, que passou a 0,06.
      if (placed.some((p) => crosses(b, p, 0.05))) continue;
      W.position.x += x - cx0; W.position.z += z - cz0;
      placed.push(b);
      return true;
    }
    return false;
  }

  // dados para o editor de layout: itens móveis (com o tamanho sem giro), obstáculos fixos e limites da sala
  function collectLayout(groups, areaOf) {
    const items = [], fixed = [];
    groups.forEach((grp) => grp.children.forEach((W) => {
      const u = W.userData || {}, b = boxOf(W);
      if (!isFinite(b.x0)) return;
      if (u.mov === "floor" || u.mov === "wall") {
        const yaw = W.rotation.y; W.rotation.y = 0; W.updateMatrixWorld(true);
        const b0 = boxOf(W); W.rotation.y = yaw; W.updateMatrixWorld(true);
        items.push({ id: u.itemId, mov: u.mov, area: areaOf(W), cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, hw: (b0.x1 - b0.x0) / 2, hd: (b0.z1 - b0.z0) / 2, yaw, blocks: blocks(b) });
      } else if (blocks(b) && b.x1 - b.x0 < 7 && b.z1 - b.z0 < 7) fixed.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, id: u.furniture || u.item || W.name || "" });
    }));
    return { items, fixed };
  }

  // ------------------------------------------------------------------ bichinhos das salas
  // um pássaro que cruza a janela de vez em quando e uma borboleta que passeia pela sala (só enfeite: não têm colisão)
  function critters(winX, winZ) {
    const g = new T.Group();
    const mk = (col) => new T.MeshBasicMaterial({ color: col, side: T.DoubleSide });
    const bird = new T.Group();
    const bodyM = new T.Mesh(new T.SphereGeometry(0.11, 10, 8), mk(0x3a3a4a)); bodyM.scale.set(1.5, 1, 1); bird.add(bodyM);
    const wings = [-1, 1].map((sd) => { const w = new T.Mesh(new T.PlaneGeometry(0.34, 0.12), mk(0x2a2a36)); w.position.set(0, 0.03, sd * 0.2); w.rotation.x = Math.PI / 2; bird.add(w); return w; });
    const beak = new T.Mesh(new T.ConeGeometry(0.03, 0.09, 6), mk(0xf2a83a)); beak.rotation.z = -Math.PI / 2; beak.position.set(0.19, 0, 0); bird.add(beak);
    bird.visible = false; g.add(bird);
    const fly = new T.Group();
    const bw = [-1, 1].map((sd) => { const w = new T.Mesh(new T.CircleGeometry(0.09, 10), mk(sd < 0 ? 0xe2478a : 0xf08ab8)); w.position.x = sd * 0.06; fly.add(w); return w; });
    g.add(fly);
    return {
      group: g,
      update(t) {
        const cyc = ((t + 10) % 26) / 26;                             // o pássaro atravessa a janela uma vez a cada 26 s
        if (cyc < 0.12) { const u = cyc / 0.12; bird.visible = true; bird.position.set(winX + 1.5 - u * 3.0, 2.9 + Math.sin(u * 6) * 0.12, winZ); wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 22) * 0.9 * (i ? 1 : -1); }); bird.scale.x = -1; bird.rotation.y = 0; } else bird.visible = false;
        const a = t * 0.35;
        fly.position.set(-2.4 + Math.sin(a) * 2.2 + Math.sin(a * 2.7) * 0.4, 3.0 + Math.sin(a * 1.7) * 0.5 + Math.sin(t * 5) * 0.05, -1.4 + Math.cos(a * 0.8) * 1.6);
        fly.rotation.y = Math.atan2(Math.cos(a) * 2.2, -Math.sin(a * 0.8) * 1.3);
        const f = Math.abs(Math.sin(t * 14)); bw.forEach((w, i) => { w.scale.x = 0.25 + f * 0.75; w.position.x = (i ? 1 : -1) * 0.06 * (0.4 + f * 0.6); });
      }
    };
  }

  function officeBuilders() {
    const extras = {};
    Object.keys(EXTRA_ITEMS).forEach((id) => { const it = EXTRA_ITEMS[id]; if (it.area === "consultorio" || it.area === "sazonal") extras[id] = () => it.build(kitObj); });
    return Object.assign(extras, {
      "quadro-abstrato": () => framed(abstractTex(), 1.5, 1.5, 2.9, 3.0, -3.62),
      "quadro-diploma": () => diploma(2.9, 3.0, -3.62),
      "quadro-relogio": () => wallClock(2.9, 3.0, -3.62),
      "quadro-paisagem": () => framed(landscapeTex(), 1.8, 1.35, 2.9, 3.0, -3.62),
      "quadro-cerebro": () => framed(brainTex(), 1.4, 1.4, 2.9, 3.0, -3.62),
      planta: () => plant(-4.3, -2.7, 1.25),
      estante: () => bookshelf(-4.2, -3.3),
      ficus: () => ficus(-4.3, -2.7),
      sofa: () => sofa(3.5, -2.6, ITEM_COLORS.sofa),
      "sofa-mostarda": () => sofa(3.5, -2.6, ITEM_COLORS["sofa-mostarda"]),
      "sofa-vinho": () => sofa(3.5, -2.6, ITEM_COLORS["sofa-vinho"]),
      abajur: () => floorLamp(5.2, -1.0),
      "luz-arco": () => arcLamp(5.4, -1.0),
      cafe: () => { const c = cup(); c.position.set(0.05, 0.72, 0.6); return c; },
      lencos: () => { const x = tissues(); x.position.set(0.15, 0.72, 0.6); return x; },
      flores: () => { const v = vase(); v.position.set(-0.05, 0.72, 0.65); return v; },
      "cortina-rosa": () => curtains(ITEM_COLORS["cortina-rosa"]),
      "cortina-azul": () => curtains(ITEM_COLORS["cortina-azul"]),
      brinquedos: () => toyChest(-3.6, 2.4),
      escrivaninha: () => desk(-4.6, 0.9),
      aquario: () => { const g = window.AQ3D && (typeof Aquarium !== "undefined") ? AQ3D.tank(kitObj, Aquarium.spec3d()) : aquarium(0.9, -3.1); g.position.set(0.9, 0, -3.1); return g; },
      "arvore-natal": () => christmasTree(5.0, 1.9),
      abobora: () => pumpkins(5.1, -1.6),
      ovos: () => eggBasket(3.9, 2.5)
    });
  }

  function esperaBuilders() {
    return {
      "e-quadro": () => framed(landscapeTex(), 1.8, 1.35, 8.4, 3.0, -3.62),
      "e-planta": () => plant(10.5, -2.8, 1.25),
      bebedouro: () => waterCooler(10.3, -0.8),
      revistas: () => { const m = magazines(); m.position.set(7.0, 0.78, -0.3); return m; },
      "e-tapete": () => rug(ITEM_COLORS["e-tapete"], 8.4, 0.6, 2.6, 1.3)
    };
  }

  const THEMES = {
    natal: { wall: "#e6efe6", build: () => [christmasTree(-4.0, 2.2), box(0.5, 0.45, 0.5, 0xd9534f, { pos: [-3.0, 0.22, 2.6] }), box(0.4, 0.4, 0.4, 0x3f9b4f, { pos: [-3.5, 0.2, 3.0] })] },
    halloween: { wall: "#3f3358", build: () => [pumpkins(-4.0, 2.2), pumpkins(5.2, -1.9), sph(0.18, 0xffb347, { pos: [-2.7, 3.6, -3.4], mat: { emissive: 0xff9a2a, emissiveIntensity: 0.7 }, ol: 0.03 })] },
    pascoa: { wall: "#f6f0d8", build: () => [eggBasket(-3.6, 2.4), vase2(4.9, -1.6), eggBasket(5.2, 1.9)] }
  };

  // ------------------------------------------------------------------ cenas
  // cada construtor devolve { root, tick(t, dt, cam), apply(opts), hotGroups, setHover }
  function roomScene(o) {
    const root = new T.Group();
    const dyn = new T.Group();       // itens da loja
    const extra = new T.Group();     // sala de espera
    const props = new T.Group();
    const marks = new T.Group();     // estrelinhas dos objetos clicáveis
    root.add(dyn, extra, props, marks);

    const built = { wall: null, worn: null, ex: null, char: null, parent: null, propsOn: false, doc: null, pat: null, comp: null };
    const state = { speaker: "patient", doc: null, pat: null, comp: null, entrando: [] };   // `entrando`: quem está a caminho da poltrona (7.8) — vive AQUI, no mesmo escopo do tick
    // Onde o quadril de quem senta fica, dada a poltrona: 0,73 do chão (a altura do assento mais o que a
    // almofada afunda) e 0,12 à frente do centro, para o joelho passar da frente da poltrona e o pé
    // alcançar o chão em vez de ficar dentro da base. `k` é a escala do corpo (criança senta menor): a
    // altura é interna ao grupo escalado e divide, x e z vivem no espaço do pai e não.
    // (a criança tem perna curta e a poltrona é de adulto: ela senta mais à frente, senão o pé,
    // que fica balançando no ar, entra na base da poltrona)
    const assento = (c, k) => { const d = Math.max(0.12, 0.62 - 0.5 * (k || 1)); return { x: c.x + Math.sin(c.yaw) * d, y: 0.73 / (k || 1), z: c.z + Math.cos(c.yaw) * d, yaw: c.yaw }; };
    const chairA = { x: -1.9, z: 0.5, yaw: 0.55 };      // a do terapeuta (a psicóloga senta aqui)
    const chairB = { x: 2.0, z: 0.5, yaw: -0.55 };      // a do paciente
    const chairC = { x: 4.7, z: 0.9, yaw: -0.8 };       // a do acompanhante
    const chairD = { x: 3.4, z: 1.9, yaw: -0.4 };       // o divã (a posição real vem do móvel colocado)
    // Na visão em 1ª pessoa as poltronas ficam frente a frente, viradas para a mesinha; com acompanhante, paciente e
    // acompanhante sentam lado a lado, os dois de frente para quem olha (um não cobre o outro)
    const LAYOUT = {
      normal: { A: { x: -1.9, z: 0.5, yaw: 0.55 }, B: { x: 2.0, z: 0.5, yaw: -0.55 }, C: { x: 4.7, z: 0.9, yaw: -0.8 } },
      fp: { A: { x: -1.9, z: 0.8, yaw: Math.PI / 2 }, B: { x: 2.1, z: 0.8, yaw: -Math.PI / 2 }, C: null },
      fpParent: { A: { x: -1.9, z: 0.8, yaw: Math.PI / 2 }, B: { x: 2.3, z: 2.1, yaw: -1.89 }, C: { x: 2.3, z: -0.5, yaw: -1.26 } }   // duas poltronas lado a lado, voltadas para quem olha, sem uma entrar na outra
    };
    // os MÓVEIS DE FÁBRICA também se movem. Eles ficavam fora da planta — você podia mudar de lugar o
    // abajur comprado, mas não a poltrona onde o paciente senta, que é o móvel mais importante da sala.
    // A posição salva entra aqui, e não só no desenho: o assento, a saída da psicóloga e o lugar do
    // paciente saem todos destas três coordenadas, então mover a poltrona move quem senta nela.
    // Na 1ª pessoa o arranjo é forçado frente a frente (senão a câmera olha para a nuca de alguém).
    const BASE = { A: "base-poltrona-psi", B: "base-poltrona-paciente", C: "base-poltrona-acompanhante", mesa: "base-mesinha" };
    const applyLayout = (op) => {
      const L = op.firstPerson ? (op.parent ? LAYOUT.fpParent : LAYOUT.fp) : LAYOUT.normal;
      Object.assign(chairA, L.A); Object.assign(chairB, L.B); Object.assign(chairC, L.C || LAYOUT.normal.C);
      if (op.firstPerson) return;
      const LC2 = (op.layouts || {}).consultorio || {};
      [[chairA, BASE.A], [chairB, BASE.B], [chairC, BASE.C]].forEach(([c, id]) => {
        const g = LC2[id];
        if (!g) return;
        if (typeof g.x === "number") c.x = g.x;
        if (typeof g.z === "number") c.z = g.z;
        if (typeof g.yaw === "number") c.yaw = g.yaw;
      });
    };
    let shellGroup = null, winG = null;
    const notPlaced = [];
    const propMeshes = [];
    const api = { root, hotGroups: [], setHover() {} };
    let curOp = o;
    const herd = makeHerd({ x0: -5.0, x1: 5.6, z0: -2.4, z1: 2.6 });
    root.add(herd.group);
    const wild = critters(-2.7, -3.5);
    root.add(wild.group);

    // medida da figura desenhada (caixa dos pixels visíveis): as ilustrações têm margens diferentes, então cada uma é
    // reescalada para que a figura tenha sempre a mesma altura de "gente sentada" e o pé apoie no assento
    function rebuild(op) {
      curOp = op;
      const theme = op.theme && THEMES[op.theme];
      const wallKey = theme ? theme.wall : op.wall;
      if (built.wall !== wallKey || built.ex !== Boolean(op.espera) || built.fpw !== Boolean(op.firstPerson) || built.sz !== (op.roomSize || 0)) {
        if (shellGroup) root.remove(shellGroup);
        if (winG) root.remove(winG);
        shellGroup = shell(hex(wallKey), 0x9a6b3c, op.espera ? 6 : 0, op.firstPerson, op.roomSize);
        winG = windowFrame(-2.7, 2.7, -3.68);
        root.add(shellGroup, winG);
        built.wall = wallKey;
        built.ex = Boolean(op.espera);
        built.fpw = Boolean(op.firstPerson);
        built.sz = op.roomSize || 0;
      }
      applyLayout(op);
      const wornKey = JSON.stringify([op.worn, op.base, op.espera, op.esperaWorn, Boolean(op.parent), op.theme, op.player, Boolean(op.firstPerson), op.layouts, state.acabamento, op.roomSize, (typeof Aquarium !== "undefined") ? Aquarium.sig() : ""]);
      if (built.worn !== wornKey) {
        while (dyn.children.length) dyn.remove(dyn.children[0]);
        while (extra.children.length) extra.remove(extra.children[0]);
        const worn = op.worn || [];
        const rugId = worn.find((id) => id.startsWith("tapete"));
        if (rugId) dyn.add(rug(ITEM_COLORS[rugId], 0.2, 0.7, 3.9, 1.9));
        // a posição das poltronas já veio de applyLayout; a mesinha se coloca pela planta como os outros
        const mesa = centered(tag(coffeeTable(0.1, 0.8), BASE.mesa), "floor");
        placeItem(mesa, BASE.mesa, ((op.layouts || {}).consultorio || {})[BASE.mesa]);
        dyn.add(mesa);
        if (op.base) {
          dyn.add(centered(tag(armchair(chairA.x, chairA.z, chairA.yaw, acabamento(BASE.A, 0xc4837a)), BASE.A), "floor"));
          dyn.add(centered(tag(armchair(chairB.x, chairB.z, chairB.yaw, acabamento(BASE.B, 0x7b9cc9)), BASE.B), "floor"));
          if (op.parent) dyn.add(centered(tag(armchair(chairC.x, chairC.z, chairC.yaw, acabamento(BASE.C, 0xd9a15f)), BASE.C), "floor"));
        }
        const B = officeBuilders();
        const LOOSE = new Set(["abajur", "luz-arco", "brinquedos", "aquario", "arvore-natal", "abobora", "ovos"]);   // itens soltos: podem se afastar de quem está no caminho
        const LAY = op.layouts || {}, sz = op.roomSize || 0;
        const LC = Object.assign({}, LAY.consultorio, LAY.sazonal);
        const BND = roomBounds(sz, 5.4);
        const loose = [], autos = [];
        notPlaced.length = 0;
        worn.forEach((id) => {
          if (!B[id] || id.startsWith("tapete")) return;
          const kind = WALL_ITEM(id) ? "wall" : FIXED_ITEM(id) ? "fixed" : "floor";
          let m = tag(B[id](), id);
          if (kind !== "fixed") m = centered(m, kind);
          const L = LC[id];
          if (L && kind !== "fixed") placeItem(m, id, L);
          else if (EXTRA_ITEMS[id] && kind === "floor") autos.push(m);
          dyn.add(m);
          if (LOOSE.has(id) && !L) loose.push(m);
        });
        if (theme) theme.build().forEach((m) => { dyn.add(m); loose.push(m); });
        const placedBoxes = furnitureBoxes([{ children: dyn.children.filter((c) => !loose.includes(c) && !autos.includes(c)) }]);
        autos.forEach((m) => { if (!autoPlace(m, placedBoxes, BND)) { dyn.remove(m); notPlaced.push(m.userData.itemId); } });
        spreadClear(dyn, loose, placedBoxes, { x0: BND.x0 - 0.25, x1: 5.9, z0: -3.4, z1: BND.z1 });
        if (op.espera) {
          extra.add(bench(8.4, -2.7, 3.6));
          extra.add(smallTable(7.0, -0.3));
          const EB = esperaBuilders(), LE = LAY.espera || {};
          const eLoose = [];
          (op.esperaWorn || []).forEach((id) => {
            if (!EB[id]) return;
            const kind = WALL_ITEM(id) ? "wall" : FIXED_ITEM(id) ? "fixed" : "floor";
            let m = tag(EB[id](), id);
            if (kind !== "fixed") m = centered(m, kind);
            const L = LE[id];
            if (L && kind !== "fixed") placeItem(m, id, L);
            extra.add(m);
            if (!L && (id === "e-planta" || id === "bebedouro")) eLoose.push(m);
          });
          spreadClear(extra, eLoose, furnitureBoxes([{ children: extra.children.filter((c) => !eLoose.includes(c)) }]), { x0: 6.3, x1: 11.0, z0: -3.4, z1: 3.3 + sizeOf(sz).dz });
        }
        built.worn = wornKey;
      }
      // a psicóloga(o): personagem articulado que se move e faz coisas na sala
      const docKey = op.player && op.base ? JSON.stringify(op.player) : null;
      if (built.doc !== docKey) {
        built.doc = docKey;
        if (state.doc) { root.remove(state.doc.root); state.doc = null; }
        if (docKey) {
          state.doc = makeDoctor(op.player);
          const as = assento(chairA);
          state.doc.setSeat(as.x, as.y, as.z, as.yaw);
          state.doc.placeSeated();
          root.add(state.doc.root);
        }
      }
      // Paciente e acompanhante: gente articulada nas poltronas, com o mesmo corpo da psicóloga.
      // Até a 5.6 eles eram o retrato em aquarela colado num plano — e como a aquarela é um BUSTO,
      // o que aparecia sentado na poltrona era uma cabeça gigante flutuando. O retrato continua no
      // jogo, onde faz sentido: na moldura ao lado do balão de fala.
      const sentar = (quem, look, cadeira, deitado) => {
        // a CADEIRA entra na chave: ao entrar na 1ª pessoa as poltronas trocam de lugar, e com a chave
        // só da aparência ninguém era recolocado — os dois ficavam onde a vista de fora os deixou,
        // um atrás do outro em vez de lado a lado de frente para quem olha
        const chave = look ? JSON.stringify(look) + "@" + JSON.stringify(cadeira) + (deitado ? "@deitado" : "") : null;
        if (built[quem] === chave) return;
        // QUEM ESTÁ ENTRANDO NÃO É REFEITO (7.11). A cena remonta por motivos banais — o balão trocou,
        // o aparelho girou, um móvel mudou de acabamento — e refazer a pessoa no meio da caminhada a
        // apagava e a recolocava SENTADA. Era isso que fazia a entrada pela porta aparecer só às vezes.
        if (state[quem] && state.entrando.some((e) => e.p === state[quem])) { built[quem] = chave; return; }
        built[quem] = chave;
        if (state[quem]) { root.remove(state[quem].root); state[quem] = null; }
        if (!chave) return;
        const k = Math.max(0.55, Math.min(1.15, Number(look.scale) || 1));   // criança senta menor que adulto
        const p = makeDoctor(look);
        p.root.scale.setScalar(k);
        // ATENÇÃO: `root.position` vive no espaço do PAI e não é afetado por `root.scale` — então x e z
        // vão como estão. Só a altura do corpo é interna ao grupo escalado, e essa sim divide pela
        // escala. Dividir x e z também fazia a criança (escala 0,62) sentar 60% mais à direita, fora
        // da poltrona; o adulto (escala 1) não mostrava o erro.
        const as = assento(cadeira, k);
        p.setSeat(as.x, as.y, as.z, as.yaw);
        root.add(p.root);
        state[quem] = p;
        if (deitado) {
          // O corpo tomba para o LOCAL -X (body.rotation.z = +90°), e a cabeceira do divã está no -x
          // dele: por isso o yaw de quem deita é o mesmo do móvel, e não o dele mais um quarto de volta.
          // o pivô do corpo é o QUADRIL: a cabeça sai 1,3 dele. Deixar o quadril no meio do divã põe a
          // cabeça para fora, no chão — ela anda 0,3 para o lado dos pés, e aí a nuca cai na cabeceira.
          const dEix = 0.6 * k;
          p.place(cadeira.x + Math.cos(cadeira.yaw) * dEix, cadeira.z - Math.sin(cadeira.yaw) * dEix, cadeira.yaw);
          p.setBodyY(0.96 / k);
          p.deitar(true);
          p.mode("listen");
        } else if (op.entrando && quem !== "doc" && !reduceMotion()) {
          // ENTRAR PELA PORTA (7.8). As duas tentativas anteriores deixaram os dois plantados no meio
          // da sala, e a nota antiga culpava a navegação. Não era a navegação: era a ROTA. A psicóloga
          // já andava bem porque o passo dela para sentar usa três marcas — a frente da poltrona, o
          // assento com `enter: true` (que manda o planejador ignorar o móvel em que se vai sentar) e
          // só então a postura. Paciente e acompanhante recebiam um destino em cima da poltrona, com o
          // próprio móvel bloqueando a célula de chegada: o A* não achava caminho, o vigia de 2 s dava
          // o passo por concluído e eles paravam onde estivessem. Aqui eles fazem o MESMO caminho dela.
          const porta = op.espera ? [6.4, 0.8] : [Math.max(-4.6, Math.min(4.6, cadeira.x)), 3.2];
          const frente = [as.x + Math.sin(cadeira.yaw) * 1.4, as.z + Math.cos(cadeira.yaw) * 1.4];
          p.place(porta[0], porta[1], Math.atan2(as.x - porta[0], as.z - porta[1]));
          // sem passo de "sit" no fim: quem senta é o vigia abaixo, chamando placeSeated(). O passo de
          // postura ficava pendurado quando a cena desenha pouco, e a pessoa ficava com cara de sentada
          // parada na porta — sentar é posição, não só pose.
          p.run([
            { walk: frente, face: Math.atan2(as.x - frente[0], as.z - frente[1]) },
            { walk: [as.x, as.z], face: as.yaw, enter: true }
          ]);
          state.entrando.push({ p, quem, aoEntrar: op.aoEntrar });
          // ISTO aqui é o que faltava nas duas tentativas antigas: pedir quadros ANTES de andar. O
          // consultório só desenha quando há motivo (5.11), e o motivo tem de ser dado na hora em que
          // a caminhada é enfileirada — de dentro do tick é tarde, porque sem quadro não há tick.
          api.needsFrames = true;
        } else p.placeSeated();
      };
      // O DIVÃ. Deitar não é sentar noutro móvel: é ficar fora do campo de visão de quem escuta. A
      // posição vem do próprio divã colocado na sala, para que mover o móvel mova quem está nele.
      const divaG = op.diva ? dyn.children.find((c) => c.userData && c.userData.itemId === "diva") : null;
      if (divaG) {
        const b = boxOf(divaG);
        // a cabeça fica na cabeceira (a ponta mais à esquerda do móvel, como ele é construído)
        chairD.x = (b.x0 + b.x1) / 2; chairD.z = (b.z0 + b.z1) / 2; chairD.yaw = divaG.rotation.y;
      }
      sentar("pat", op.patientLook || null, op.diva && divaG ? chairD : chairB, op.diva && divaG);
      sentar("comp", op.parentLook || null, chairC);
      // o clima da sessão vale para quem é atendido, não para a psicóloga
      if (state.pat) state.pat.setClima(op.clima || null);
      if (state.comp) state.comp.setClima(op.clima ? { defesa: (op.clima.defesa || 0) * 0.6, alianca: (op.clima.alianca || 0) * 0.6 } : null);

      const boxes = furnitureBoxes([dyn, extra]);
      // Quem ANDA precisa saber onde estão os móveis. Só a psicóloga recebia isso; paciente e
      // acompanhante andavam em linha reta e encalhavam na primeira poltrona no caminho da porta.
      const limites = { x0: roomBounds(op.roomSize, 0).x0, x1: op.espera ? 10.8 : 5.7, z0: -3.3, z1: roomBounds(op.roomSize, 0).z1 };
      [state.doc, state.pat, state.comp].forEach((q) => { if (q) { q.setObstacles(boxes); q.setBounds(limites); } });
      api.gente = () => ({ pat: state.pat, comp: state.comp, doc: state.doc });   // gancho de teste da entrada pela porta
      herd.setBounds(op.espera ? 10.6 : 5.6);
      herd.set(op.showProps || op.character ? [] : op.pets || [], boxes);
      if (state.doc) state.doc.root.visible = !op.firstPerson;   // na visão em 1ª pessoa você é o(a) terapeuta
      state.speaker = op.speaker || "patient";

      // objetos flutuantes da introdução
      if (op.showProps && !built.propsOn) {
        [["assets/ficha.png", -1.2, 0.5], ["assets/manual.png", 1.0, 0.85]].forEach(([k, x, y], i) => {
          const m = new T.Mesh(new T.PlaneGeometry(1.3 * (i ? 1.05 : 0.9), 1.3), new T.MeshBasicMaterial({ map: loadTex(k), transparent: true, alphaTest: 0.03 }));
          m.position.set(x, 2.6, 1.5);
          m.userData.y0 = 2.6 + y; m.userData.i = i;
          props.add(m);
          propMeshes.push(m);
        });
        built.propsOn = true;
      }
      if (!op.showProps && built.propsOn) {
        while (props.children.length) props.remove(props.children[0]);
        propMeshes.length = 0;
        built.propsOn = false;
      }

      // objetos clicáveis (intervalo): marcados com uma estrelinha
      while (marks.children.length) marks.remove(marks.children[0]);
      api.hotGroups = [];
      if (op.hot) {
        const groups = [];
        root.traverse((g) => {
          const it = g.userData && g.userData.item;
          if (it && op.hot.map[it] && op.hot.active.includes(op.hot.map[it])) { g.userData.action = op.hot.map[it]; groups.push(g); }
        });
        api.hotGroups = groups;
        groups.forEach((g) => {
          const b3 = new T.Box3().setFromObject(g);
          const star = new T.Sprite(new T.SpriteMaterial({ map: starTex(), transparent: true, depthTest: false }));
          star.scale.set(0.5, 0.5, 1);
          star.position.set((b3.min.x + b3.max.x) / 2, b3.max.y + 0.45, (b3.min.z + b3.max.z) / 2);
          star.userData.base = star.position.y;
          marks.add(star);
        });
      }
    }

    api.layoutInfo = () => {
      const op = curOp || {}, r = collectLayout([dyn, extra], (W) => (extra.children.includes(W) ? "espera" : "consultorio"));
      const z = sizeOf(op.roomSize);
      return Object.assign(r, { bounds: { consultorio: roomBounds(op.roomSize, 5.4), espera: { x0: 6.3, x1: 11.0, z0: -3.3, z1: 3.3 + z.dz } }, wall: { x0: -5.0 - z.dxL, x1: 5.3 }, notPlaced: notPlaced.slice() });
    };
    api.setHover = (g) => {
      root.traverse((o2) => {
        if (o2.isMesh && o2.material && o2.material.emissive && !o2.material.transparent) {
          if (o2.userData.emi0 === undefined) o2.userData.emi0 = o2.material.emissive.getHex();
          o2.material.emissive.setHex(o2.userData.emi0);
        }
      });
      if (g) g.traverse((o2) => { if (o2.isMesh && o2.material && o2.material.emissive && !o2.material.transparent) o2.material.emissive.setHex(0x5a4a10); });
    };

    api.tick = (t, dt, cam) => {
      const face = (m) => { m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z); };
      propMeshes.forEach((m) => { m.position.y = m.userData.y0 - 0.5 + Math.sin(t * 1.6 + m.userData.i) * 0.08; face(m); });
      marks.children.forEach((sp, i) => { sp.position.y = sp.userData.base + Math.sin(t * 3 + i) * 0.1; });
      if (state.doc) state.doc.update(t, dt);
      // VIGIA DA ENTRADA (7.8). Enquanto alguém entra, a cena não pode parar de desenhar — foi isso
      // que matou as duas tentativas anteriores: com a cena parada (ou com movimento reduzido), a
      // caminhada nunca terminava e a pessoa congelava no meio da sala. E, se mesmo assim passar de
      // 8 segundos, ela senta: melhor sentada do que plantada.
      if (state.entrando.length) {
        api.needsFrames = true;
        for (let i = state.entrando.length - 1; i >= 0; i--) {
          const e = state.entrando[i];
          // o prazo é em tempo REAL, não em tempo de cena: num aparelho fraco (ou no modo Econômico)
          // a cena avança devagar, e é justamente ali que a pessoa ficaria mais tempo de pé no meio
          // da sala. Quatro segundos de relógio de parede e ela senta.
          if (!e.ate) e.ate = Date.now() + 4000;
          if (!e.p.busy() || Date.now() > e.ate) {
            e.p.clear();
            e.p.placeSeated();   // sempre: garante a posição da poltrona, tenha a caminhada terminado ou não
            state.entrando.splice(i, 1);
            // só AGORA a entrada conta como feita. Marcar no começo fazia uma remontagem no meio do
            // caminho (o balão trocou, o aparelho girou) cancelar a caminhada e sentar a pessoa: a
            // entrada aparecia só às vezes, sem ninguém entender por quê.
            if (typeof e.aoEntrar === "function") { try { e.aoEntrar(e.quem); } catch (err) { /* a cena continua */ } }
          }
        }
      }
      // quem está com a palavra gesticula; o outro escuta (o rig já tem os dois modos)
      const falando = state.speaker === "parent" ? state.comp : state.pat;
      [state.pat, state.comp].forEach((p) => {
        if (!p) return;
        const querido = p === falando ? "talk" : "listen";
        if (p.current() !== querido && !p.busy()) p.mode(querido);
        p.update(t, dt);
      });
      herd.update(t, dt);
      if (!curOp || !curOp.character) wild.update(t);
      dyn.children.forEach((g) => { if (g.userData.fish && !g.userData.aq) g.rotation.y = Math.sin(t * 0.8) * 0.04; });
      if (window.AQ3D) AQ3D.tick(t);
    };

    // o que ela faz ao tocar em cada objeto do intervalo: caminha até lá, faz a ação e volta a se sentar
    const ACT = {
      cafe: ["drink", 2500], planta: ["water", 2600], estante: ["read", 3000], sofa: ["stretch", 2400], diploma: ["proud", 2200], peixes: ["peek", 2400],
      brinquedos: ["crouch", 2400], relogio: ["reach", 1900], lencos: ["dab", 1900], mesa: ["write", 2800], luz: ["reach", 1900], flores: ["sniff", 2200], janela: ["stretch", 2600]
    };
    api.doctor = {
      mode(name, ms) { if (state.doc) state.doc.mode(name, ms); },
      seq(steps) { if (state.doc) { state.doc.clear(); state.doc.run(steps); } },
      busy() { return Boolean(state.doc && state.doc.busy()); },
      act(key, aoFazer) {
        const d = state.doc;
        if (!d) return 0;
        const [mode, ms] = ACT[key] || ["stretch", 2000];
        // O lugar de sentar é o MESMO que `assento()` calcula ao montar a sala. Estava escrito à mão aqui
        // com o centro da poltrona: depois de levantar para fazer alguma coisa, ela voltava 0,12 atrás do
        // lugar certo e sentava com o pé dentro da poltrona.
        const seat = assento(chairA);
        // A volta é para o ASSENTO; o ponto de saída, porém, continua medido do CENTRO da poltrona.
        // Medido do assento, ele caía 0,12 mais para dentro da sala, em cima da mesinha: a caminhada
        // não fechava, o passo nunca terminava e ela ficava plantada na frente da cadeira para sempre.
        const front = [chairA.x + Math.sin(chairA.yaw) * 1.4, chairA.z + Math.cos(chairA.yaw) * 1.4];   // sai e volta pela frente da poltrona, não por cima do braço
        let steps = [{ posture: "stand", ms: 650 }, { walk: front }];
        const g = api.hotGroups.find((h) => h.userData.action === key);
        if (g) {
          const b3 = new T.Box3().setFromObject(g);
          const cx = (b3.min.x + b3.max.x) / 2, cz = (b3.min.z + b3.max.z) / 2;
          const wall = cz < -2.5;
          const ax = Math.max(-4.4, Math.min(4.6, cx)), az = wall ? -1.7 : Math.min(cz + 1.1, 2.2);
          steps.push({ walk: [ax, az], face: Math.atan2(cx - ax, cz - az) });
        }
        steps.push({ mode, ms, aoComecar: aoFazer || null });
        steps.push({ walk: front }, { walk: [seat.x, seat.z], face: seat.yaw, enter: true }, { posture: "sit", ms: 900 });
        d.clear(); d.run(steps);
        return ms + 4500;
      }
    };

    api.apply = rebuild;
    rebuild(o);
    return api;
  }

  function kitchenZone(op) {
    const g = new T.Group();
    const tex = canvasTex(256, 256, (c) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? "#f2eee4" : "#cfd8e4"; c.fillRect(i * 32, j * 32, 32, 32); } });
    const top = new T.Mesh(new T.PlaneGeometry(6, 7.6), toon(0xffffff, { map: tex }));
    top.rotation.x = -Math.PI / 2; top.position.set(8.4, 0.02, 0); top.receiveShadow = true;
    g.add(top);
    g.add(box(6, 0.3, 7.8, 0xb8bfcc, { pos: [8.4, -0.15, 0], cast: false }));
    g.add(box(6.4, 4.9, 0.3, 0xf4efe0, { pos: [8.4, 2.45, -3.85], cast: false }));
    g.add(box(3.4, 1.05, 0.9, 0xd9d2c0, { pos: [8.2, 0.52, -3.2] }));
    g.add(box(3.5, 0.12, 1.0, 0x8b8f9a, { pos: [8.2, 1.08, -3.2], ol: 0.03 }));
    g.add(box(1.1, 3.0, 1.0, 0xe4e7ee, { pos: [10.6, 1.5, -3.1] }));
    g.add(box(0.06, 0.9, 0.06, 0x9aa0ad, { pos: [10.1, 1.9, -2.55], outline: false }));
    g.add(cyl(0.7, 0.7, 0.08, 0xb98a5a, { pos: [8.6, 0.85, -0.3], seg: 24 }));
    g.add(cyl(0.09, 0.12, 0.85, 0x7a5232, { pos: [8.6, 0.42, -0.3], outline: false }));
    [[-0.9, 0.6], [0.9, -0.9]].forEach(([dx, dz]) => g.add(box(0.6, 0.55, 0.6, 0xc4837a, { pos: [8.6 + dx, 0.28, -0.3 + dz], ol: 0.04 })));
    const K = {
      cafeteira: () => { const m = new T.Group(); m.add(box(0.55, 0.7, 0.45, 0x2f2b3a, { pos: [0, 0.35, 0] })); m.add(cyl(0.18, 0.18, 0.3, 0xffffff, { pos: [0, 0.55, 0.12], ol: 0.03 })); m.position.set(7.3, 1.14, -3.2); return m; },
      fruteira: () => { const m = new T.Group(); m.add(cyl(0.34, 0.24, 0.16, 0xd9534f, { pos: [0, 0.08, 0], ol: 0.03 })); [[-0.1, 0.25, 0, 0xe2478a], [0.12, 0.27, 0.05, 0xf2c230], [0, 0.32, -0.1, 0x8fd18f]].forEach(([fx, fy, fz, c]) => m.add(sph(0.12, c, { pos: [fx, fy, fz], ol: 0.03 }))); m.position.set(8.6, 0.93, -0.3); return m; },
      "k-planta": () => { const m = new T.Group(); [-0.3, 0, 0.3].forEach((dx) => { m.add(cyl(0.12, 0.09, 0.2, 0xd9694a, { pos: [dx, 0.1, 0], ol: 0.02 })); m.add(sph(0.14, 0x56b35f, { pos: [dx, 0.32, 0], ol: 0.02 })); }); m.position.set(9.4, 1.14, -3.2); return m; },
      "k-quadro": () => framed(abstractTex(), 1.3, 1.3, 8.4, 3.3, -3.62),
      "k-tapete": () => rug(ITEM_COLORS["k-tapete"], 8.6, -0.3, 2.0, 1.4)
    };
    (op.kitchenWorn || []).forEach((id) => { if (K[id]) g.add(tag(K[id](), id)); });
    return g;
  }

  // ------------------------------------------------------------------ vitrine da personagem (criação e editor)
  // a personagem de pé num pequeno palco redondo, com um leve balanço; arrastar gira a vista
  function avatarScene(o) {
    const root = new T.Group();
    const stage = new T.Mesh(new T.CylinderGeometry(1.5, 1.6, 0.16, 48), toon(0xe6dcc8, { roughness: 0.55 }));
    stage.position.y = -0.08; stage.receiveShadow = true; root.add(stage);
    const ring = new T.Mesh(new T.TorusGeometry(1.5, 0.03, 8, 64), new T.MeshBasicMaterial({ color: 0x8790dd })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.002; root.add(ring);
    let doc = null, key = "";
    function build(op) {
      const k = JSON.stringify(op.player || {});
      if (k === key) return; key = k;
      if (doc) root.remove(doc.root);
      doc = makeDoctor(op.player || {});
      doc.setSeat(0, 1, 0, 0); doc.place(0, 0, 0); doc.pose.lie = 0; doc.pose.sit = 0; doc.posture("stand"); doc.mode("idle");
      root.add(doc.root);
    }
    build(o);
    return { root, hotGroups: [], setHover() {}, needsFrames: true, apply: build, tick(t, dt) { if (doc) { doc.update(t, dt || 0.016); doc.root.rotation.y = Math.sin(t * 0.5) * 0.25; } } };
  }

  function bedroomScene(o) {
    const root = new T.Group();
    const built = { key: null };
    let clock = null, bedGroup = null, curOp = o;
    const notPlaced = [];
    const herd = makeHerd({ x0: -5.1, x1: 5.5, z0: -2.3, z1: 2.5 });
    let lastBoxes = [];
    let ring = Boolean(o.alarm);
    const doc = o.player ? makeDoctor(o.player) : null;
    let phase = "unset";
    // fases da abertura: 0 dormindo (despertador), 1 acorda e olha o celular, 2 pega a bolsa e sai. Sem fase: rotina da casa.
    function setPhase(p) {
      if (!doc || p === phase) return;
      phase = p;
      doc.clear();
      doc.setBodyY(null);
      if (p === 0) { doc.setSeat(1.9, 0.98, -1.05, 0); doc.place(1.75, -2.2, 0); doc.posture("stand"); doc.setBodyY(1.0); doc.pose.lie = 1; doc.pose.sit = 0; doc.mode("sleep"); }
      else if (p === 1) { doc.setSeat(1.75, 0.82, -0.66, 0); doc.place(1.75, -0.66, 0); doc.pose.lie = 0; doc.pose.sit = 1; doc.posture("sit"); doc.run([{ mode: "yawn", ms: 2400 }, { mode: "phone", ms: 600000 }]); }
      else if (p === 2) { doc.setSeat(1.75, 0.82, -0.66, 0); doc.place(1.75, -0.66, 0); doc.pose.lie = 0; doc.pose.sit = 1; doc.posture("sit"); doc.run([{ posture: "stand", ms: 700 }, { walk: [1.75, 0.1] }, { walk: [0.7, 0.2] }, { walk: [3.1, 0.6], face: 0 }, { mode: "bag", ms: 600000 }]); }
      else { doc.setSeat(0.9, 0.98, -1.05, 0); doc.place(0.4, 0.6, 0); doc.pose.lie = 0; doc.pose.sit = 0; doc.posture("stand"); doc.mode("idle"); }
    }
    // rotina livre: janela, planta, café, cumprimento e leitura na beirada da cama
    const face = (fx, fz, x, z) => Math.atan2(fx - x, fz - z);
    function routine() {
      return [
        { walk: [-2.3, -2.0], face: face(-3.2, -3.68, -2.3, -2.0) }, { mode: "look", ms: 2600, lookYaw: -0.5 }, { mode: "stretch", ms: 2400 },
        { walk: [-3.7, -1.5], face: face(-4.3, -2.6, -3.7, -1.5) }, { mode: "water", ms: 2600 },
        { walk: [-1.2, -2.1], face: face(-1.2, -3.3, -1.2, -2.1) }, { mode: "drink", ms: 2500 },
        { walk: [0.4, 0.4], face: 0 }, { mode: "wave", ms: 1700 },
        { walk: [0.9, -1.05], face: 0, enter: true }, { posture: "sit", mode: "read", ms: 3400 }, { posture: "stand", ms: 800 }
      ];
    }

    // cama de verdade: estrado, colchão com lençol, dois travesseiros, edredom alto com dobra (as pernas ficam por baixo dele),
    // cabeceira e pé da cama, criado-mudo com despertador e livro, guarda-roupa com portas e um par de chinelos
    function bedItems() {
      const g = new T.Group();
      const bed = new T.Group();
      const stripes = canvasTex(128, 128, (c, w, h) => { c.fillStyle = "#5b8fd6"; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,0.14)" : "rgba(20,40,110,0.10)"; c.fillRect(0, i * 16, w, 16); } });
      stripes.wrapS = stripes.wrapT = T.RepeatWrapping;
      bed.add(box(4.3, 0.42, 2.8, 0x9a6a3c, { pos: [0, 0.21, 0] }));                                                   // estrado
      bed.add(box(4.0, 0.34, 2.55, 0xf4f0ea, { pos: [0, 0.59, 0], mat: { fabric: true } }));                              // colchão com lençol (topo em 0,76)
      [-0.62, 0.62].forEach((z, i) => bed.add(box(0.95, 0.3, 0.98, i ? 0xf6efe4 : 0xfff8ee, { pos: [-1.45, 0.91, z], rot: [0, i ? 0.08 : -0.06, i ? 0.05 : -0.04], mat: { fabric: true } })));   // travesseiros
      bed.add(box(2.45, 0.5, 2.62, 0x5b8fd6, { pos: [0.85, 1.01, 0], mat: { fabric: true, map: stripes } }));            // edredom (topo em 1,26)
      bed.add(box(0.5, 0.56, 2.66, 0x8fb5ec, { pos: [-0.28, 1.04, 0], rot: [0, 0, 0.06], mat: { fabric: true } }));       // dobra do edredom junto ao peito
      bed.add(box(0.34, 1.75, 2.9, 0x7a5232, { pos: [-2.15, 0.875, 0] }));                                              // cabeceira
      bed.add(box(0.26, 0.8, 2.9, 0x7a5232, { pos: [2.15, 0.4, 0] }));                                                  // pé da cama
      bed.position.set(1.6, 0, -2.2);
      g.add(bed);
      // criado-mudo com gaveta, despertador, livro e um copo d'água
      const stand = new T.Group();
      stand.add(box(1.1, 1.05, 1.0, 0xb98a5a, { pos: [0, 0.525, 0] }));
      stand.add(box(0.9, 0.3, 0.04, 0xa4784a, { pos: [0, 0.75, 0.51], outline: false })); stand.add(sph(0.05, 0xe2b84a, { pos: [0, 0.75, 0.55], outline: false }));
      stand.position.set(-1.2, 0, -3.0);
      g.add(stand);
      clock = new T.Group();
      clock.add(cyl(0.25, 0.25, 0.2, 0xd9534f, { rot: [Math.PI / 2, 0, 0], outline: true }));
      const face = new T.Mesh(new T.CircleGeometry(0.19, 28), new T.MeshBasicMaterial({ map: alarmTex() }));
      face.position.z = 0.11;
      clock.add(face);
      [-0.15, 0.15].forEach((sx) => clock.add(sph(0.08, 0xf2c230, { pos: [sx, 0.28, 0], ol: 0.03 })));
      clock.position.set(-1.55, 1.3, -2.85);
      g.add(clock);
      const mug = cup(); mug.position.set(-0.85, 1.05, -2.55); g.add(mug);
      // guarda-roupa com duas portas, frisos e puxadores
      const wr = new T.Group();
      wr.add(box(1.7, 3.3, 0.9, 0x8b6a4a, { pos: [0, 1.65, 0] }));
      [-0.42, 0.42].forEach((dx) => { wr.add(box(0.78, 2.9, 0.05, 0x9a7852, { pos: [dx, 1.65, 0.47], outline: false })); wr.add(box(0.5, 1.1, 0.03, 0x8b6a4a, { pos: [dx, 2.25, 0.5], outline: false })); wr.add(box(0.5, 1.1, 0.03, 0x8b6a4a, { pos: [dx, 0.95, 0.5], outline: false })); wr.add(sph(0.05, 0xe2b84a, { pos: [dx > 0 ? 0.08 : -0.08, 1.6, 0.52], outline: false, mat: { metalness: 0.8, roughness: 0.3 } })); });
      wr.position.set(4.5, 0, -3.2);
      g.add(wr);
      // chinelos ao lado da cama
      [-0.16, 0.16].forEach((dz) => g.add(box(0.42, 0.1, 0.18, 0xd98aa8, { pos: [0.6, 0.05, -0.55 + dz], rot: [0, 0.15, 0], outline: false, mat: { fabric: true } })));
      // o DSM-5-TR no criado-mudo (na cidade, o mesmo livro abre o Manual sem ir ao consultório)
      const dsm = new T.Group();
      dsm.add(box(0.5, 0.11, 0.38, 0x2f4f8a, { pos: [0, 0.055, 0], ol: 0.02 }));
      dsm.add(box(0.46, 0.07, 0.34, 0xf6efe0, { pos: [0.02, 0.055, 0], outline: false }));
      dsm.add(box(0.5, 0.115, 0.06, 0x1f3560, { pos: [-0.0, 0.056, -0.16], outline: false }));
      dsm.position.set(-1.5, 1.05, -2.72); dsm.rotation.y = 0.35;
      g.add(dsm);

      // O QUARTO ERA UMA CAMA E UM GUARDA-ROUPA. Faltava tudo o que faz um quarto ser de alguém: o
      // tapete onde se pisa ao acordar, a cortina, o espelho de antes de sair, a prateleira com as
      // coisas dela. Nada disto se compra: já vem, porque é onde a personagem mora.
      g.add(rug(0xc9a3b5, 1.6, 0.6, 3.4, 2.0));                                                                    // tapete ao pé da cama
      // cortinas na janela, iguais às do consultório mas em tom de casa
      [-1, 1].forEach((sd) => {
        const cor = box(0.9, 3.0, 0.14, 0xe8c9a0, { pos: [-3.2 + sd * 1.45, 1.75, -3.52], mat: { fabric: true } });
        cor.rotation.z = sd * 0.02; g.add(cor);
      });
      g.add(box(3.6, 0.16, 0.2, 0x7a5232, { pos: [-3.2, 3.3, -3.52] }));                                           // varão
      // espelho de corpo inteiro encostado na parede
      const esp = new T.Group();
      esp.add(box(1.1, 2.5, 0.12, 0x7a5232, { pos: [0, 1.25, 0] }));
      esp.add(box(0.92, 2.3, 0.04, 0xdfeaf2, { pos: [0, 1.28, 0.08], outline: false, mat: { roughness: 0.08, metalness: 0.65 } }));
      esp.position.set(-4.75, 0, -1.4); esp.rotation.y = 0.32;
      g.add(esp);
      // prateleira com livros e uma plantinha, na parede do fundo
      const pr = new T.Group();
      pr.add(box(2.2, 0.12, 0.42, 0x9a7852, { pos: [0, 0, 0] }));
      [0x8c3a4f, 0x3f6b74, 0xd9a520, 0x5a7a4a, 0x7a5232].forEach((c2, i) =>
        pr.add(box(0.16, 0.5 + (i % 3) * 0.08, 0.3, c2, { pos: [-0.85 + i * 0.22, 0.3, 0], rot: [0, 0, i === 3 ? 0.18 : 0], outline: false })));
      pr.add(cyl(0.16, 0.13, 0.22, 0xc9744a, { pos: [0.7, 0.17, 0], ol: 0.02 }));
      [0, 1, 2].forEach((i) => pr.add(sph(0.14, 0x5f9a5f, { pos: [0.7 + (i - 1) * 0.12, 0.34 + i * 0.05, 0], outline: false })));
      pr.position.set(0.6, 2.35, -3.5);
      g.add(pr);
      // três retratinhos na parede, em alturas diferentes
      [[-1.5, 2.9, 0.34], [-0.95, 2.55, 0.26], [-1.9, 2.4, 0.28]].forEach(([px, py, tam], i) => {
        const q = new T.Group();
        q.add(box(tam + 0.06, tam + 0.06, 0.05, 0x7a5232, { pos: [0, 0, 0] }));
        q.add(box(tam, tam, 0.02, [0xf2d9c0, 0xd6e4f0, 0xe8e0c8][i], { pos: [0, 0, 0.03], outline: false }));
        q.position.set(px, py, -3.58);
        q.rotation.z = (i - 1) * 0.04;
        g.add(q);
      });
      // cesto de roupa e uma luminária de teto
      const cesto = new T.Group();
      cesto.add(cyl(0.34, 0.3, 0.62, 0xd9c7a8, { pos: [0, 0.31, 0], ol: 0.03 }));
      cesto.add(box(0.5, 0.12, 0.44, 0xe9dfd0, { pos: [0.04, 0.6, 0], rot: [0, 0.2, 0.08], outline: false, mat: { fabric: true } }));
      cesto.position.set(-4.3, 0, 0.9);
      g.add(cesto);
      const pend = new T.Group();
      pend.add(cyl(0.02, 0.02, 1.0, 0x4a3b2c, { pos: [0, 3.4, 0], outline: false }));
      pend.add(cyl(0.42, 0.2, 0.34, 0xf4ead4, { pos: [0, 2.75, 0], ol: 0.03, mat: { emissive: 0xffd98a, emissiveIntensity: 0.28 } }));
      pend.position.set(-0.4, 0, -0.6);
      g.add(pend);
      return g;
    }

    function rebuild(op) {
      ring = Boolean(op.alarm);
      if (doc) setPhase(op.docPhase);
      herd.set(op.pets || [], lastBoxes);
      curOp = op;
      const key = JSON.stringify([op.homeWall, op.homeWorn, op.kitchen, op.kitchenWorn, op.layouts, op.homeSize]);
      if (built.key === key) return;
      built.key = key;
      while (root.children.length) root.remove(root.children[0]);
      root.add(shell(hex(op.homeWall || "#ffe1c2"), 0x9a6b3c, op.kitchen ? 6 : 0, false, op.homeSize));
      root.add(windowFrame(-3.2, 2.8, -3.68, 0xdff1ff));
      const beam = new T.Mesh(new T.PlaneGeometry(2.2, 4.6), new T.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.32, side: T.DoubleSide, depthWrite: false }));
      beam.position.set(-2.4, 1.6, -1.6); beam.rotation.set(-0.15, 0, 0.42);
      root.add(beam);
      bedGroup = bedItems();
      root.add(bedGroup);
      const H = {
        poster: () => framed(abstractTex(), 1.2, 1.2, 0.6, 3.5, -3.62),
        "casa-planta": () => plant(-4.3, -2.6, 1.15),
        "casa-abajur": () => { const l = new T.Group(); l.add(cyl(0.1, 0.16, 0.3, 0x4a3b2c, { pos: [0, 0.15, 0], ol: 0.02 })); l.add(cyl(0.2, 0.3, 0.32, 0xffe08a, { pos: [0, 0.46, 0], mat: { emissive: 0xffc44d, emissiveIntensity: 0.5 }, ol: 0.03 })); l.position.set(-1.2, 1.05, -2.7); return l; },
        "casa-tapete": () => rug(ITEM_COLORS["casa-tapete"], 0.4, 0.9, 3.3, 1.5),
        "casa-estante": () => bookshelf(-5.0, 0.9, Math.PI / 2)
      };
      {
        const LH = (op.layouts || {}).casa || {}, BND = roomBounds(op.homeSize, 5.4), autos = [];
        const EXH = {};
        Object.keys(EXTRA_ITEMS).forEach((id) => { const it = EXTRA_ITEMS[id]; if (it.area === "casa") EXH[id] = () => it.build(kitObj); });
        notPlaced.length = 0;
        (op.homeWorn || []).forEach((id) => {
          const mk = H[id] || EXH[id];
          if (!mk) return;
          const kind = WALL_ITEM(id) ? "wall" : FIXED_ITEM(id) ? "fixed" : "floor";
          let m = tag(mk(), id);
          if (kind !== "fixed") m = centered(m, kind);
          const L = LH[id];
          if (L && kind !== "fixed") placeItem(m, id, L);
          else if (EXH[id] && kind === "floor") autos.push(m);
          root.add(m);
        });
        if (autos.length) {
          const fixedNow = furnitureBoxes([{ children: root.children.filter((c) => c !== (doc && doc.root) && !autos.includes(c) && c.userData && (c.userData.item || c.userData.furniture)).concat(bedGroup ? bedGroup.children : []) }]);
          autos.forEach((m) => { if (!autoPlace(m, fixedNow, BND)) { root.remove(m); notPlaced.push(m.userData.itemId); } });
        }
      }
      if (op.kitchen) root.add(kitchenZone(op));
      if (doc) {
        root.add(doc.root);
        // móveis do quarto viram caixas de colisão: a cama, a mesinha e os itens comprados
        const groups = root.children.filter((c) => c !== doc.root && c.userData && (c.userData.item || c.userData.furniture));
        doc.setObstacles(furnitureBoxes([{ children: groups.concat(bedGroup ? bedGroup.children : []) }]));
        doc.setBounds({ x0: roomBounds(op.homeSize, 0).x0, x1: op.kitchen ? 11.0 : 5.7, z0: -3.3, z1: roomBounds(op.homeSize, 0).z1 });
      }
      {
        const groups = root.children.filter((c) => c !== (doc && doc.root) && c.userData && (c.userData.item || c.userData.furniture));
        lastBoxes = furnitureBoxes([{ children: groups.concat(bedGroup ? bedGroup.children : []) }]);
        herd.set(op.pets || [], lastBoxes);
        root.add(herd.group);
      }
    }

    rebuild(o);
    return {
      root,
      tick(t, dt) {
        if (clock) clock.rotation.z = ring ? Math.sin(t * 40) * 0.12 : 0;
        if (doc) { if (phase === undefined && !doc.busy()) doc.run(routine()); doc.update(t, dt || 0.016); }
        herd.update(t, dt || 0.016);
      },
      apply: rebuild, hotGroups: [], setHover() {},
      layoutInfo() {
        const op = curOp || {}, z = sizeOf(op.homeSize);
        const groups = [{ children: root.children.filter((c) => c !== (doc && doc.root) && c.userData && (c.userData.mov || c.userData.item || c.userData.furniture)) }, { children: bedGroup ? bedGroup.children : [] }];
        const r = collectLayout(groups, () => "casa");
        return Object.assign(r, { bounds: { casa: roomBounds(op.homeSize, 5.4) }, wall: { x0: -5.0 - z.dxL, x1: 5.3 }, notPlaced: notPlaced.slice() });
      }
    };
  }

  function streetScene(op) {
    const look = (op && op.player) || {};
    const root = new T.Group();
    const ground = box(40, 0.4, 14, 0x9fa4bb, { pos: [0, -0.2, 0], cast: false });
    root.add(ground);
    root.add(box(40, 0.3, 3, 0xd9d6e6, { pos: [0, 0.02, -3.2], cast: false, outline: false }));
    for (let x = -18; x < 18; x += 3) root.add(box(1.4, 0.03, 0.22, 0xfff6c8, { pos: [x, 0.22, 2.4], cast: false, outline: false }));
    const cols = ["#f3c9c9", "#c9d8f3", "#f3e6b8", "#d6c9f3", "#c9f3dc"];
    const bH = [6.5, 8.5, 5.5, 7.5, 9, 6, 8, 7];
    for (let i = 0; i < 8; i++) {
      const w = 3.7, x = -13 + i * 4;
      const tex = buildingTex(cols[i % cols.length], 3 + i);
      const b = box(w, bH[i], 3, 0xffffff, { pos: [x, bH[i] / 2, -6.2], mat: { map: tex } });
      root.add(b);
    }
    for (let x = -12; x <= 12; x += 6) {
      const tree = new T.Group();
      tree.add(cyl(0.14, 0.2, 1.5, 0x7a5232, { pos: [0, 0.75, 0], outline: false }));
      [[0, 2.2, 0, 0.95], [-0.5, 1.9, 0.2, 0.7], [0.5, 1.95, -0.1, 0.72]].forEach(([tx, ty, tz, r]) => tree.add(sph(r, 0x4fae5c, { pos: [tx, ty, tz], ol: 0.05 })));
      tree.position.set(x + 1.5, 0, -2.6);
      root.add(tree);
      const lamp = new T.Group();
      lamp.add(cyl(0.06, 0.08, 2.8, 0x4a3b2c, { pos: [0, 1.4, 0], outline: false }));
      lamp.add(sph(0.22, 0xffe08a, { pos: [0, 2.9, 0], mat: { emissive: 0xffc44d, emissiveIntensity: 0.5 }, ol: 0.04 }));
      lamp.position.set(x - 1.5, 0, -1.9);
      root.add(lamp);
    }
    const clouds = [];
    [[-8, 9.5, -8, 1], [2, 10.5, -9, 1.3], [10, 9, -8, 0.9], [-1, 8, -10, 0.8]].forEach(([cx, cy, cz, s]) => {
      const c = new T.Group();
      [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.1, 0.75], [0.4, 0.5, 0.7]].forEach(([dx, dy, r]) => c.add(sph(r * s, 0xffffff, { pos: [dx * s, dy * s, 0], outline: false, cast: false })));
      c.position.set(cx, cy, cz);
      root.add(c);
      clouds.push(c);
    });
    // a psicóloga(o) caminhando até a clínica, com a bolsa
    const doc = makeDoctor(look);
    doc.walkPhaseOn(true);
    root.add(doc.root);

    function tick(t, dt) {
      const x = ((t * 1.3) % 22) - 11;
      doc.place(x, 1, Math.PI / 2);
      doc.update(t, dt || 0.016);
      clouds.forEach((c, i) => { c.position.x += 0.004 * (i + 1); if (c.position.x > 14) c.position.x = -14; });
    }
    return { root, tick, apply() {}, camFollow: (t) => ({ x: (((t * 1.3) % 22) - 11) * 0.25 }) };
  }

  function facadeScene() {
    const root = new T.Group();
    root.add(box(9.5, 0.4, 5, 0xd9d6e6, { pos: [0, -0.2, 1.4], cast: false }));
    root.add(box(9.5, 6.4, 0.7, 0xe9c9b0, { pos: [0, 3.2, -1.1] }));
    root.add(box(9.8, 0.35, 0.95, 0x8790dd, { pos: [0, 6.5, -1.0] }));
    // porta
    root.add(box(2.7, 3.9, 0.3, 0x15131f, { pos: [0, 1.95, -0.6], outline: false }));
    root.add(box(2.2, 3.5, 0.18, 0xd9a15f, { pos: [0, 1.75, -0.45] }));
    [[-0.5, 2.6], [0.5, 2.6], [-0.5, 1.1], [0.5, 1.1]].forEach(([px, py]) => root.add(box(0.8, 1.2, 0.06, 0xe7b878, { pos: [px, py, -0.33], ol: 0.03 })));
    root.add(sph(0.11, 0xf2c230, { pos: [0.8, 1.7, -0.3], ol: 0.03 }));
    // degraus
    root.add(box(3.4, 0.22, 1.1, 0xc9c5d8, { pos: [0, 0.11, 0.2] }));
    root.add(box(3.0, 0.22, 0.8, 0xdad6e6, { pos: [0, 0.33, 0.05] }));
    // placa
    const sign = box(4.6, 0.95, 0.22, 0xffffff, { pos: [0, 4.6, -0.6] });
    const signFace = new T.Mesh(new T.PlaneGeometry(4.4, 0.85), new T.MeshBasicMaterial({ map: signTex() }));
    signFace.position.set(0, 4.6, -0.48);
    root.add(sign, signFace);
    // janelas
    [-3.2, 3.2].forEach((wx) => root.add(windowFrame(wx, 2.6, -0.72, 0xbfe3ff)));
    // vasos
    root.add(plant(-2.3, 0.7, 1.1));
    root.add(plant(2.3, 0.7, 1.1));
    // lampião
    [-1.9, 1.9].forEach((lx) => {
      const lamp = new T.Group();
      lamp.add(box(0.12, 0.5, 0.4, 0x3a2a26, { pos: [0, 0, -0.1], ol: 0.03 }));
      lamp.add(cyl(0.2, 0.26, 0.5, 0xffe08a, { pos: [0, -0.1, 0.12], mat: { emissive: 0xffc44d, emissiveIntensity: 0.55 }, ol: 0.04 }));
      lamp.position.set(lx, 3.7, -0.72);
      root.add(lamp);
    });
    let camZ = 0;
    return { root, tick(t) { camZ = Math.min(1, t / 6); }, apply() {}, camDolly: () => camZ };
  }


  // ------------------------------------------------------------------ visualizador 3D das criaturas do aquário
  function fishModel(id) {
    const g = new T.Group();
    const eye = (x, y, z) => { g.add(sph(0.09, 0xffffff, { pos: [x, y, z], outline: false })); g.add(sph(0.05, 0x15131f, { pos: [x + Math.sign(x) * 0.02, y, z + 0.05], outline: false })); };
    const tail = (x, c) => g.add(solid(new T.ConeGeometry(0.32, 0.6, 4), c, { pos: [x, 0, 0], rot: [0, 0, Math.PI / 2], ol: 0.03 }));
    if (id === "palhaco") {
      const b = sph(0.6, 0xf28a1f, { pos: [0, 0, 0], ol: 0.04 }); b.scale.set(1.35, 0.9, 0.7); g.add(b);
      [-0.25, 0.3].forEach((x) => { const s = sph(0.62, 0xffffff, { pos: [x, 0, 0], outline: false }); s.scale.set(0.13, 0.95, 0.72); g.add(s); });
      tail(-1.05, 0xf28a1f); g.add(solid(new T.ConeGeometry(0.22, 0.5, 4), 0xf28a1f, { pos: [0.1, 0.65, 0], outline: false })); eye(0.62, 0.15, 0.36); eye(0.62, 0.15, -0.36);
    } else if (id === "azul") {
      const b = sph(0.6, 0x2f7fe0, { pos: [0, 0, 0], ol: 0.04 }); b.scale.set(1.3, 1, 0.45); g.add(b);
      tail(-1.0, 0xf2c230); g.add(solid(new T.ConeGeometry(0.3, 0.6, 4), 0x1c4fa0, { pos: [0, 0.75, 0], outline: false })); eye(0.6, 0.15, 0.25); eye(0.6, 0.15, -0.25);
    } else if (id === "baiacu") {
      g.add(sph(0.75, 0xf2d24a, { pos: [0, 0, 0], ol: 0.04 }));
      for (let i = 0; i < 22; i++) { const a = i * 2.4, y = Math.cos(i * 0.9) * 0.7, r = Math.sqrt(Math.max(0.02, 0.56 - y * y)); g.add(solid(new T.ConeGeometry(0.06, 0.22, 4), 0xc9a020, { pos: [Math.cos(a) * r, y, Math.sin(a) * r], rot: [Math.sin(a), 0, -Math.cos(a)], outline: false })); }
      tail(-0.95, 0xe0b830); eye(0.55, 0.22, 0.38); eye(0.55, 0.22, -0.38);
    } else if (id === "esponja") {
      g.add(cyl(0.55, 0.65, 1.2, 0xe8c840, { pos: [0, 0, 0], ol: 0.04 }));
      [[0.3, 0.2, 0.5], [-0.3, -0.2, 0.55], [0.1, -0.4, 0.58], [-0.2, 0.4, 0.5], [0.4, -0.1, -0.5], [-0.35, 0.1, -0.52]].forEach(([x, y, z]) => g.add(sph(0.1, 0x8a6a10, { pos: [x, y, z], outline: false })));
      g.add(cyl(0.3, 0.35, 0.3, 0xd9b830, { pos: [0, 0.65, 0], outline: false }));
    } else if (id === "estrela") {
      g.add(sph(0.3, 0xf08a3a, { pos: [0, 0, 0], ol: 0.04 }));
      for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; const arm = solid(new T.ConeGeometry(0.24, 0.95, 5), 0xf08a3a, { pos: [Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0], rot: [0, 0, a - Math.PI / 2], ol: 0.03 }); arm.scale.z = 0.4; g.add(arm); }
      [0, 1, 2, 3, 4].forEach((i) => g.add(sph(0.05, 0xffd9a0, { pos: [Math.cos((i * Math.PI * 2) / 5) * 0.4, Math.sin((i * Math.PI * 2) / 5) * 0.4, 0.14], outline: false })));
    } else if (id === "lula") {
      g.add(solid(new T.ConeGeometry(0.4, 1.4, 12), 0xe58aa8, { pos: [0.3, 0, 0], rot: [0, 0, -Math.PI / 2], ol: 0.04 }));
      [-1, 1].forEach((sd) => { const f = box(0.5, 0.05, 0.35, 0xc96a8a, { pos: [0.75, 0, sd * 0.32], outline: false }); g.add(f); });
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI * 2) / 8; g.add(cyl(0.05, 0.03, 0.9, 0xe58aa8, { pos: [-0.7, Math.sin(a) * 0.22, Math.cos(a) * 0.22], rot: [0, 0, Math.PI / 2], outline: false })); }
      eye(-0.2, 0.2, 0.3); eye(-0.2, 0.2, -0.3);
    } else if (id === "tartaruga") {
      const sh = sph(0.7, 0x4f9a5a, { pos: [0, 0.05, 0], ol: 0.04 }); sh.scale.set(1.2, 0.6, 1); g.add(sh);
      g.add(sph(0.28, 0x8ac48a, { pos: [0.95, 0.05, 0], ol: 0.03 })); eye(1.1, 0.15, 0.13); eye(1.1, 0.15, -0.13);
      [[0.5, 0.75], [0.5, -0.75], [-0.5, 0.75], [-0.5, -0.75]].forEach(([x, z]) => { const f = sph(0.22, 0x8ac48a, { pos: [x, -0.1, z], outline: false }); f.scale.set(1.4, 0.4, 0.8); g.add(f); });
    } else if (id === "tubarao") {
      const b = sph(0.6, 0x8a97a8, { pos: [0, 0, 0], ol: 0.04 }); b.scale.set(2, 0.75, 0.75); g.add(b);
      const belly = sph(0.55, 0xeef2f6, { pos: [0.05, -0.15, 0], outline: false }); belly.scale.set(1.9, 0.55, 0.7); g.add(belly);
      g.add(solid(new T.ConeGeometry(0.28, 0.7, 4), 0x6a7788, { pos: [0, 0.75, 0], ol: 0.03 })); tail(-1.35, 0x6a7788); eye(0.95, 0.15, 0.32); eye(0.95, 0.15, -0.32);
    } else if (id === "caranguejo") {
      const b = sph(0.6, 0xd9503f, { pos: [0, 0, 0], ol: 0.04 }); b.scale.set(1.3, 0.55, 1); g.add(b);
      [-1, 1].forEach((sd) => { g.add(sph(0.26, 0xd9503f, { pos: [0.95, 0.1, sd * 0.55], ol: 0.03 })); for (let k = 0; k < 3; k++) g.add(cyl(0.04, 0.04, 0.6, 0xb8402f, { pos: [-0.1 + k * 0.3, -0.2, sd * 0.75], rot: [sd * 0.8, 0, 0], outline: false })); });
      eye(0.55, 0.35, 0.2); eye(0.55, 0.35, -0.2);
    } else if (id === "polvo") {
      g.add(sph(0.6, 0xb04fbf, { pos: [0, 0.35, 0], ol: 0.04 }));
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI * 2) / 8; g.add(cyl(0.09, 0.03, 1, 0xb04fbf, { pos: [Math.cos(a) * 0.45, -0.45, Math.sin(a) * 0.45], rot: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], outline: false })); }
      eye(0.3, 0.45, 0.5); eye(-0.3, 0.45, 0.5);
    } else if (window.AQ3D && window.AQ_DATA && AQ_DATA.SPECIES.some((q) => q.id === id)) {   // espécies novas: modelo paramétrico
      const m = AQ3D.model(kitObj, AQ_DATA.SPECIES.find((q) => q.id === id)); const sz = AQ_DATA.SPECIES.find((q) => q.id === id).size; m.scale.setScalar(0.72 + sz * 0.06); g.add(m);
    } else {   // desconhecido: uma bolha
      g.add(sph(0.6, 0x9fd8ff, { pos: [0, 0, 0], ol: 0.04 }));
    }
    g.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material !== HULL) { o.receiveShadow = false; o.material.polygonOffset = true; o.material.polygonOffsetFactor = -1; o.material.polygonOffsetUnits = -1; } });   // anti-cintilar (z-fighting) das peças coladas
    return g;
  }

  function fishScene(op) {
    const root = new T.Group();
    const bg = box(16, 10, 0.2, 0x1e5fa0, { pos: [0, 0, -3], cast: false, outline: false }); root.add(bg);
    root.add(box(16, 0.3, 6, 0xe8d08a, { pos: [0, -2.2, -0.5], cast: false, outline: false }));
    const pivot = new T.Group(); root.add(pivot);
    let current = null;
    const bubbles = [0, 1, 2, 3, 4, 5].map((i) => { const b = sph(0.08 + (i % 3) * 0.03, 0xbfe6ff, { pos: [-1.5 + i * 0.6, -1.5, 0.3], outline: false, mat: { transparent: true, opacity: 0.7 } }); root.add(b); return b; });
    const set = (sp) => { if (current === sp) return; current = sp; pivot.clear(); pivot.add(fishModel(sp)); };
    set(op.species || "palhaco");
    return {
      root,
      apply(o) { set(o.species || "palhaco"); },
      tick(t) { pivot.rotation.y = t * 0.8; pivot.position.y = Math.sin(t * 1.4) * 0.12; bubbles.forEach((b, i) => { b.position.y = -1.8 + ((t * 0.5 + i * 0.7) % 3.6); }); }
    };
  }

  // o tanque sozinho, girando devagar (aba "Tanque" do aquário)
  function aquariumScene() {
    const root = new T.Group(), spec = (typeof Aquarium !== "undefined") ? Aquarium.spec3d() : { level: 1, w: 1.8, cap: 6, species: [], decor: [], gear: {}, health: 70 };
    const tank = AQ3D.tank(kitObj, spec); tank.position.y = -1.4; root.add(tank); root.scale.setScalar(Math.min(1.7, 3.3 / spec.w)); root.position.y = 0.15;
    root.add(box(14, 0.2, 8, 0x2a2e48, { pos: [0, -1.5, 0], cast: false, outline: false }));
    return { root, hotGroups: [], setHover() {}, needsFrames: true, apply() {}, tick(t) { tank.rotation.y = Math.sin(t * 0.35) * 0.4; }, width: spec.w };
  }

  const CAMS = {
    aquarium: { pos: [0, 1.0, 6.4], look: [0, 0.1, 0], fov: 34 },
    fish: { pos: [0, 0.4, 5.2], look: [0, 0, 0], fov: 34 },
    avatar: { pos: [0, 1.7, 4.0], look: [0, 1.5, 0], fov: 30 },   // a pessoa ficou mais alta na 5.12: a câmera sobe e chega um pouco mais perto
    wide: { pos: [2.0, 5.6, 12.4], look: [0.1, 1.9, -0.2], fov: 34 },
    // enquadra as DUAS poltronas (a da psicóloga em x=-1.9 e a do paciente em x=2.0): antes a câmera
    // olhava para a poltrona do paciente, o que jogava a psicóloga para o canto e deixava meia tela de vazio
    consult: { pos: [1.7, 3.5, 9.9], look: [0.1, 1.36, 0.4], fov: 32 },
    casa: { pos: [1.2, 5.0, 12.2], look: [0.3, 1.9, -0.5], fov: 34 },
    rua: { pos: [0, 4.6, 15], look: [0, 3.4, -2], fov: 36 },
    porta: { pos: [0, 3.4, 13], look: [0, 3.0, -1], fov: 34 },
    wideExt: { pos: [3.4, 6.2, 16.2], look: [3.0, 1.9, -0.2], fov: 34 },
    espera: { pos: [8.6, 5.6, 12.4], look: [8.4, 1.9, -0.2], fov: 34 },
    // Onde ficam os olhos de quem atende. Estava a 1,85 do chão e a 3,8 de distância com fov 42: o
    // paciente enchia a tela e, na borda do quadro, a grande angular entortava o rosto de quem estava
    // ao lado. Agora a câmera está na altura dos olhos de quem senta (o quadril a 0,73 mais o tronco) e
    // um pouco mais atrás, com menos abertura — dois rostos inteiros, sem deformar.
    firstPerson: { pos: [-2.2, 2.05, 0.8], look: [2.1, 1.82, 0.8], fov: 38, fp: true },
    firstPersonParent: { pos: [-2.5, 2.08, 0.8], look: [2.3, 1.82, 0.8], fov: 36, fp: true },
    consultParent: { pos: [3.3, 3.75, 12.0], look: [1.5, 1.3, 0.4], fov: 33 },   // com acompanhante são três poltronas (até x=4.7): a câmera abre e recentra
    casaExt: { pos: [3.2, 5.8, 15.6], look: [3.0, 1.9, -0.5], fov: 34 },
    cozinha: { pos: [8.6, 5.0, 12.2], look: [8.4, 1.9, -0.5], fov: 34 }
  };

  function camForBase(name, opts) {
    if (name === "room") {
      if (opts.camera === "consult" && opts.firstPerson) return opts.parent ? CAMS.firstPersonParent : CAMS.firstPerson;
      if (opts.camera === "consult") return opts.parent ? CAMS.consultParent : CAMS.consult;
      if (opts.focus === "espera" && opts.espera) return CAMS.espera;
      return opts.espera ? CAMS.wideExt : CAMS.wide;
    }
    if (name === "casa") {
      if (opts.focus === "cozinha" && opts.kitchen) return CAMS.cozinha;
      return opts.kitchen ? CAMS.casaExt : CAMS.casa;
    }
    return CAMS[name];
  }

  // sala maior: afasta e desloca a câmera para caber tudo (consulta e 1ª pessoa ficam nas poltronas, sem mudar)
  function camFor(name, opts) {
    const p = camForBase(name, opts);
    const lv = name === "room" ? opts.roomSize : name === "casa" ? opts.homeSize : 0;
    if (!p || !lv || p.fp || (name === "room" && opts.camera === "consult")) return p;
    const z = sizeOf(lv), k = 1 + 0.22 * lv, shiftX = -z.dxL * 0.5, shiftZ = z.dz * 0.4;
    const look = [p.look[0] + shiftX, p.look[1], p.look[2] + shiftZ];
    return Object.assign({}, p, { look, pos: [look[0] + (p.pos[0] - p.look[0]) * k, look[1] + (p.pos[1] - p.look[1]) * k, look[2] + (p.pos[2] - p.look[2]) * k] });
  }

  // ------------------------------------------------------------------ renderizador
  function ensureRenderer() {
    if (S.renderer) return;
    const r = new T.WebGLRenderer({ antialias: true, alpha: true });
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2, window.Perf ? Perf.pixelRatioCap() : 2));
    r.shadowMap.enabled = window.Perf ? Perf.shadows() : true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.ACESFilmicToneMapping;    // realce das luzes e cores mais ricas nas sombras
    r.toneMappingExposure = 1.12;
    r.setClearColor(0x000000, 0);
    S.renderer = r;
    S.canvas = r.domElement;
    S.canvas.className = "s3d-canvas";
    S.canvas.setAttribute("aria-hidden", "true");
    window.addEventListener("pointermove", (e) => {
      S.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      S.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (S.cur) S.cur.dirty = true;                       // a cena parada precisa voltar a desenhar para a câmera seguir o ponteiro
      if (S.drag.on && S.cur && S.cur.opts.drag) {
        // Na vista de FORA dá para girar bem mais: a sala é para ser olhada de vários ângulos. Na 1ª
        // pessoa continua curto, porque ali a câmera é a cabeça de quem atende — girar demais enjoa.
        const fp = Boolean(S.cur && S.cur.preset && S.cur.preset.fp);
        const limY = fp ? 0.75 : 1.5, limCima = fp ? 0.3 : 0.55, limBaixo = fp ? -0.25 : -0.45;
        S.drag.yaw = Math.max(-limY, Math.min(limY, S.drag.yaw + (e.clientX - S.drag.x) * (fp ? 0.006 : 0.008)));
        S.drag.pitch = Math.max(limBaixo, Math.min(limCima, S.drag.pitch + (e.clientY - S.drag.y) * (fp ? 0.003 : 0.004)));
        S.drag.x = e.clientX; S.drag.y = e.clientY;
        S.cur.dirty = true;
      }
    }, { passive: true });
    S.ray = new T.Raycaster();
    S.down = null;
    const pickAt = (e) => {
      const c = S.cur;
      if (!c || !c.api.hotGroups || !c.api.hotGroups.length) return null;
      const rect = S.canvas.getBoundingClientRect();
      S.ray.setFromCamera({ x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: -((e.clientY - rect.top) / rect.height) * 2 + 1 }, c.camera);
      const hits = S.ray.intersectObjects(c.api.hotGroups, true);
      if (!hits.length) return null;
      let o = hits[0].object;
      while (o && !(o.userData && o.userData.action)) o = o.parent;
      return o || null;
    };
    S.canvas.addEventListener("pointermove", (e) => {
      if (S.drag.on) return;
      const g = pickAt(e);
      if (g !== S.hover) {
        S.hover = g;
        if (S.cur && S.cur.api.setHover) S.cur.api.setHover(g);
        S.canvas.style.cursor = g ? "pointer" : "";
        if (S.cur) S.cur.dirty = true;
      }
    });
    S.canvas.addEventListener("pointerdown", (e) => {
      S.down = { x: e.clientX, y: e.clientY };
      if (!S.cur || !S.cur.opts.drag) return;
      S.drag.on = true; S.drag.x = e.clientX; S.drag.y = e.clientY;
      S.canvas.style.cursor = "grabbing";
    });
    S.canvas.addEventListener("pointerup", (e) => {
      if (S.down && Math.abs(e.clientX - S.down.x) < 6 && Math.abs(e.clientY - S.down.y) < 6) {
        const g = pickAt(e);
        if (g && S.cur && S.cur.opts.hot && S.cur.opts.hot.onPick) S.cur.opts.hot.onPick(g.userData.action);
        else if (!g && S.cur && S.cur.opts.walkTo) {   // clique no chão: a personagem anda até lá (modo "entrar no consultório")
          const rect = S.canvas.getBoundingClientRect();
          S.ray.setFromCamera({ x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: -((e.clientY - rect.top) / rect.height) * 2 + 1 }, S.cur.camera);
          const hit = new T.Vector3();
          if (S.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), hit)) S.cur.opts.walkTo(hit.x, hit.z);
        }
      }
      S.down = null;
    });
    window.addEventListener("pointerup", () => { S.drag.on = false; if (S.canvas && !S.hover) S.canvas.style.cursor = ""; });
  }

  // ambiente: um "estúdio" procedural (céu quente em cima, chão claro, três janelas luminosas) filtrado em PMREM.
  // Dá reflexos suaves e luz de rebote nos materiais físicos, sem precisar de nenhuma imagem HDR.
  function buildEnv(renderer) {
    const env = new T.Scene();
    const sky = new T.Mesh(new T.SphereGeometry(30, 32, 16), new T.ShaderMaterial({
      side: T.BackSide,
      vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec3 p; void main(){ vec3 top = vec3(1.0,0.95,0.85), mid = vec3(0.85,0.88,0.95), bot = vec3(0.55,0.5,0.45); float h = p.y; vec3 c = h > 0.0 ? mix(mid, top, h) : mix(mid, bot, -h); gl_FragColor = vec4(c, 1.0); }"
    }));
    env.add(sky);
    [[-12, 8, -6], [10, 9, -8], [0, 12, 10]].forEach(([x, y, z], i) => {
      const w = new T.Mesh(new T.PlaneGeometry(9, 5), new T.MeshBasicMaterial({ color: i === 2 ? 0xffffff : 0xfff2d8, side: T.DoubleSide }));
      w.material.color.multiplyScalar(6);
      w.position.set(x, y, z); w.lookAt(0, 0, 0); env.add(w);
    });
    const pm = new T.PMREMGenerator(renderer);
    const tex = pm.fromScene(env, 0.03).texture;
    pm.dispose();
    return tex;
  }

  // ---------------------------------------------------------------- luz do dia
  // A sala tinha SEMPRE a mesma luz: meio-dia às oito da manhã e meio-dia às onze da noite. Aqui a luz
  // que entra pela janela segue o relógio do jogo — o sol nasce baixo e alaranjado, sobe e esfria ao
  // meio-dia, cai de novo no fim da tarde e à noite sobra o azul da rua. É o que faz a lâmpada do teto
  // ter serventia: acendê-la de dia quase não muda nada, acendê-la à noite muda tudo.
  const HORAS = [
    [0, { cor: 0x4a5f92, forca: 0.10, alt: 0.25, az: -1.05, ceu: 0x33436b, chao: 0x2e3350, hemi: 0.11, amb: 0.10 }],
    [6, { cor: 0x6a7bb0, forca: 0.22, alt: 0.12, az: -1.15, ceu: 0x8a9ec8, chao: 0x4a4a50, hemi: 0.16, amb: 0.11 }],
    [8, { cor: 0xffc79a, forca: 0.78, alt: 0.38, az: -1.0, ceu: 0xffe2c8, chao: 0x6a5a48, hemi: 0.28, amb: 0.12 }],
    [12, { cor: 0xffeddb, forca: 1.3, alt: 1.0, az: -0.45, ceu: 0xfff3e2, chao: 0x6a5a48, hemi: 0.38, amb: 0.13 }],
    [16, { cor: 0xffe0b8, forca: 1.1, alt: 0.72, az: 0.45, ceu: 0xfff0dc, chao: 0x6a5a48, hemi: 0.33, amb: 0.12 }],
    [19, { cor: 0xff9a5c, forca: 0.6, alt: 0.2, az: 1.05, ceu: 0xffcfa4, chao: 0x5a4a40, hemi: 0.22, amb: 0.12 }],
    [21, { cor: 0x4a5f92, forca: 0.12, alt: 0.22, az: 1.1, ceu: 0x3a4a74, chao: 0x2e3350, hemi: 0.12, amb: 0.10 }],
    [24, { cor: 0x4a5f92, forca: 0.10, alt: 0.25, az: -1.05, ceu: 0x33436b, chao: 0x2e3350, hemi: 0.11, amb: 0.10 }]
  ];
  const misturaCor = (a2, b2, k) => {
    const r = Math.round(((a2 >> 16) & 255) + (((b2 >> 16) & 255) - ((a2 >> 16) & 255)) * k);
    const g = Math.round(((a2 >> 8) & 255) + (((b2 >> 8) & 255) - ((a2 >> 8) & 255)) * k);
    const bl = Math.round((a2 & 255) + ((b2 & 255) - (a2 & 255)) * k);
    return (r << 16) | (g << 8) | bl;
  };
  function luzDaHora(h) {
    const hh = ((Number(h) || 0) % 24 + 24) % 24;
    let i = 0;
    while (i < HORAS.length - 2 && HORAS[i + 1][0] <= hh) i += 1;
    const [h0, A] = HORAS[i], [h1, B] = HORAS[i + 1];
    const k = h1 === h0 ? 0 : (hh - h0) / (h1 - h0);
    const n = (p2) => A[p2] + (B[p2] - A[p2]) * k;
    return { cor: misturaCor(A.cor, B.cor, k), ceu: misturaCor(A.ceu, B.ceu, k), chao: misturaCor(A.chao, B.chao, k), forca: n("forca"), alt: n("alt"), az: n("az"), hemi: n("hemi"), amb: n("amb") };
  }
  // aplica a hora do dia e o interruptor da lâmpada de uma vez só: os dois mexem nas mesmas luzes
  function aplicarLuz(scene) {
    if (!scene) return false;
    const L = luzDaHora(S.hora === null || S.hora === undefined ? 12 : S.hora), on = Boolean(S.luzOn);
    let achou = false;
    scene.traverse((o) => {
      const papel = o.userData && o.userData.papel;
      if (papel === "sol") {
        o.color.setHex(L.cor);
        o.intensity = L.forca;
        o.position.set(Math.sin(L.az) * 11, 2.5 + L.alt * 10, 8);
      } else if (papel === "ceu") {
        o.color.setHex(L.ceu); o.groundColor.setHex(L.chao);
        o.intensity = L.hemi * (on ? 1.3 : 1);
      } else if (papel === "amb") {
        o.intensity = L.amb * (on ? 1.5 : 1);
      } else if (papel === "preenche") {
        o.intensity = 0.22 * Math.max(0.35, Math.min(1, L.forca));
      }
      if (o.userData && (o.userData.luzDoTeto || o.userData.luminaria)) {
        // de noite a lâmpada é a luz da sala; de dia ela só completa o que entra pela janela
        if (o.userData.baseInt === undefined) { o.userData.baseInt = o.intensity; o.userData.baseDist = o.distance; }
        const noite = 1 - Math.max(0, Math.min(1, L.forca));
        o.intensity = o.userData.baseInt * (on ? 1.3 + 0.95 * noite : 0.34);
        o.distance = o.userData.baseDist * (on ? 1.42 : 1);
        if (o.userData.luzDoTeto) { o.color.setHex(on ? 0xffd9a0 : 0xffc27a); achou = true; }
      }
      // o vidro da lâmpada acende junto: sem isto o abajur ficava apagado com a luz acesa
      if (o.userData && o.userData.vidro && o.material && o.material.emissiveIntensity !== undefined) {
        if (o.userData.emiBase === undefined) o.userData.emiBase = o.material.emissiveIntensity;
        o.material.emissiveIntensity = o.userData.emiBase * (on ? 2.1 : 1) * (1 + (1 - Math.max(0, Math.min(1, L.forca))) * 0.5);
      }
    });
    return achou;
  }

  function makeLights(scene) {
    if (!S.env) S.env = buildEnv(S.renderer);
    scene.environment = S.env;
    const ceu = new T.HemisphereLight(0xfff3e2, 0x6a5a48, 0.32); ceu.userData.papel = "ceu"; scene.add(ceu);
    // luz principal quente, vinda da janela, com sombras suaves
    const sun = new T.DirectionalLight(0xffe0b8, 1.15);
    sun.userData.papel = "sol";
    sun.position.set(-7, 11, 8);
    sun.castShadow = window.Perf ? Perf.shadows() : true;
    sun.shadow.mapSize.set(window.Perf ? Perf.shadowSize() : 2048, window.Perf ? Perf.shadowSize() : 2048);
    const c = sun.shadow.camera;
    c.left = -10; c.right = 10; c.top = 10; c.bottom = -10; c.near = 1; c.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 5;
    scene.add(sun);
    // luz de preenchimento fria do lado oposto, sem sombra (evita sombras pretas)
    const fill = new T.DirectionalLight(0xc6d6ff, 0.22);
    fill.userData.papel = "preenche";
    fill.position.set(9, 6, 5);
    scene.add(fill);
    const amb = new T.AmbientLight(0xfff6ea, 0.12); amb.userData.papel = "amb"; scene.add(amb);   // ambiente bem baixo: levanta só o preto das sombras
  }
  // lâmpada quente do teto: ponto de luz com sombra suave (só nos aparelhos que aguentam; nos outros vira luz sem sombra)
  function lampLight(x, y, z, o = {}) {
    const l = new T.PointLight(o.color || 0xffc27a, o.intensity !== undefined ? o.intensity : 0.9, o.dist || 14, 1.6);
    l.position.set(x, y, z);
    const podeSombra = window.Perf ? Perf.level() === "high" && Perf.shadows() : false;   // sombra de ponto de luz é cara (6 faces): só no modo completo
    if (podeSombra && o.shadow !== false) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; l.shadow.normalBias = 0.03; l.shadow.radius = 4; l.shadow.camera.near = 0.3; l.shadow.camera.far = o.dist || 14; }
    return l;
  }

  // A GPU não tem coletor de lixo: geometria, material e textura que saem de cena continuam ocupando
  // memória de vídeo até alguém dizer dispose(). Até a 5.9 só a geometria era liberada — cada ida e
  // volta ao consultório deixava para trás todos os materiais e todas as texturas daquela montagem.
  // As texturas de S.texCache são compartilhadas entre as cenas e NÃO podem ser liberadas: quem as
  // libera quebra a próxima montagem, que espera encontrá-las no cache.
  const MAPAS = ["map", "alphaMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "bumpMap", "emissiveMap", "lightMap", "displacementMap", "specularMap", "envMap"];
  function soltarMaterial(m, guardadas) {
    if (!m || m.__solto || m.__compartilhado) return;
    m.__solto = true;
    MAPAS.forEach((k) => { const t = m[k]; if (t && t.dispose && !t.__compartilhada && !guardadas.has(t)) t.dispose(); });
    m.dispose();
  }
  function dispose() {
    if (!S.cur) return;
    S.cur.ro && S.cur.ro.disconnect();
    if (S.canvas && S.canvas.parentNode) S.canvas.parentNode.removeChild(S.canvas);
    S.cur.container.classList.remove("is3d");
    const guardadas = new Set(Object.values(S.texCache));
    S.cur.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (!o.material) return;
      if (Array.isArray(o.material)) o.material.forEach((m) => soltarMaterial(m, guardadas));
      else soltarMaterial(o.material, guardadas);
    });
    S.cur = null;
  }

  function resize() {
    const c = S.cur;
    if (!c) return;
    const w = Math.max(2, c.container.clientWidth), h = Math.max(2, c.container.clientHeight);
    if (w === c.w && h === c.h) return;
    c.w = w; c.h = h;
    S.renderer.setSize(w, h, false);
    c.camera.aspect = w / h;
    c.camera.updateProjectionMatrix();
    c.dirty = true;
  }

  function placeCameraFirstPerson(c, t) {
    const p = c.preset, calm = reduceMotion();
    const fov = p.fov * Math.min(1.7, Math.max(1, 1.5 / (c.w / c.h)));   // telas estreitas: abre o campo de visão
    if (Math.abs(c.camera.fov - fov) > 0.01) { c.camera.fov = fov; c.camera.updateProjectionMatrix(); }
    const breathe = calm ? 0 : Math.sin(t * 0.9) * 0.012;
    S.smooth.x += (S.pointer.x - S.smooth.x) * 0.05;
    S.smooth.y += (S.pointer.y - S.smooth.y) * 0.05;
    c.camera.position.set(p.pos[0], p.pos[1] + breathe, p.pos[2]);
    const dir = new T.Vector3(p.look[0] - p.pos[0], p.look[1] - p.pos[1], p.look[2] - p.pos[2]);
    const yaw = Math.max(-0.7, Math.min(0.7, S.drag.yaw * 0.6 + (calm ? 0 : S.smooth.x * 0.05)));
    const pitch = Math.max(-0.35, Math.min(0.35, S.drag.pitch * 0.6 - (calm ? 0 : S.smooth.y * 0.03)));
    dir.applyAxisAngle(new T.Vector3(0, 1, 0), -yaw);
    dir.y += Math.tan(pitch) * Math.hypot(dir.x, dir.z);
    c.camera.lookAt(c.camera.position.clone().add(dir));
  }

  function placeCamera(c, t) {
    const preset = c.preset;
    if (preset.fp) return placeCameraFirstPerson(c, t);
    if (c.camera.fov !== preset.fov) { c.camera.fov = preset.fov; c.camera.updateProjectionMatrix(); }
    const base = new T.Vector3(...preset.pos);
    const look = new T.Vector3(...preset.look);
    const aspect = c.w / c.h;
    const fit = Math.min(3, Math.max(1, 1 + (1.6 / aspect - 1) * 1.15));   // telas estreitas: afasta a câmera para caberem os dois personagens
    const v = base.clone().sub(look).multiplyScalar(fit);
    if (c.name === "porta") v.multiplyScalar(1 - 0.22 * (c.scene.userData.dolly ? c.scene.userData.dolly() : 0));
    v.applyAxisAngle(new T.Vector3(0, 1, 0), S.drag.yaw);
    const right = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), S.drag.yaw);
    v.applyAxisAngle(right, S.drag.pitch);
    const calm = reduceMotion();
    const sway = calm ? 0 : Math.sin(t * 0.35) * 0.12;
    S.smooth.x += (S.pointer.x - S.smooth.x) * 0.05;
    S.smooth.y += (S.pointer.y - S.smooth.y) * 0.05;
    const px = calm ? 0 : S.smooth.x * 0.55 + sway;
    const py = calm ? 0 : -S.smooth.y * 0.25;
    c.camera.position.copy(look).add(v).add(new T.Vector3(px, py, 0));
    if (c.name === "rua" && c.scene.userData.follow) c.camera.position.x += c.scene.userData.follow(t);
    c.camera.lookAt(look.x + (c.name === "rua" && c.scene.userData.follow ? c.scene.userData.follow(t) : 0), look.y, look.z);
  }

  // Desenhar é a parte cara; a conta de animação não é. Duas economias, nesta ordem:
  //  1) CENA PARADA (nada animando e nada mudou) não é redesenhada — antes isso só valia para quem pede
  //     movimento reduzido no sistema, e o resto do mundo repintava 60 vezes por segundo uma imagem igual.
  //  2) TETO DE QUADROS do modo escolhido em Opções (Perf.frameGap): o Econômico já limitava a cidade 2D
  //     a 30 quadros e a cena 3D, que é a mais pesada das duas, passava batido.
  function frame() {
    S.raf = requestAnimationFrame(frame);
    const c = S.cur;
    if (!c || document.hidden || !c.container.isConnected || c.container.offsetParent === null) return;
    resize();
    const dt = Math.min(0.1, S.clock.getDelta());
    const t = S.clock.elapsedTime;
    c.api.tick && c.api.tick(t, dt, c.camera);
    // "parada" não é só não ter gente animando: a câmera ainda pode estar deslizando atrás do ponteiro.
    // Enquanto ela não alcança o alvo, continua a desenhar; depois disso a imagem é a mesma e não vale
    // o gasto. (O balanço lento da câmera para nas cenas sem ninguém — é justamente ali que se economiza.)
    const alcancou = Math.abs(S.smooth.x - S.pointer.x) < 0.002 && Math.abs(S.smooth.y - S.pointer.y) < 0.002;
    const anima = Boolean(c.api.needsFrames) && !reduceMotion();
    if (!anima && !c.dirty && alcancou) return;
    const teto = window.Perf && Perf.frameGap ? Perf.frameGap() : 0;
    const agora = performance.now();
    if (teto && !c.dirty && agora - (S.pintadoEm || 0) < teto) return;
    S.pintadoEm = agora;
    placeCamera(c, t);
    S.renderer.render(c.scene, c.camera);
    c.dirty = false;
  }

  function mount(container, name, opts = {}) {
    try {
      ensureRenderer();
      if (S.cur && S.cur.container === container && S.cur.name === name) {
        if (S.canvas.parentNode !== container) container.appendChild(S.canvas);
        S.cur.opts = opts;
        S.cur.preset = camFor(name, opts);
        S.cur.api.apply(opts);
        if (opts.hora !== undefined && opts.hora !== null) S.hora = opts.hora;
        aplicarLuz(S.cur.scene);
        S.cur.dirty = true;
        return true;
      }
      dispose();
      const scene = new T.Scene();
      makeLights(scene);
      let api;
      if (name === "room") api = roomScene(opts);
      else if (name === "casa") api = bedroomScene(opts);
      else if (name === "rua") { api = streetScene(opts); scene.userData.follow = (t) => api.camFollow(t).x; }
      else if (name === "porta") { api = facadeScene(); scene.userData.dolly = api.camDolly; }
      else if (name === "fish") api = fishScene(opts);
      else if (name === "avatar") api = avatarScene(opts);
      else if (name === "aquarium") api = aquariumScene();
      else return false;
      if (name === "room" || name === "casa") { const lz = lampLight(0, 5.4, 0.5); lz.userData.luzDoTeto = true; scene.add(lz); }   // lâmpada quente do teto (sombra suave só no modo completo)
      scene.add(api.root);
      const preset = camFor(name, opts);
      const camera = new T.PerspectiveCamera(preset.fov, 1.6, 0.4, 60);
      S.drag.yaw = 0; S.drag.pitch = 0;
      container.appendChild(S.canvas);
      container.classList.add("is3d");
      S.cur = { container, name, opts, scene, camera, api, preset, w: 0, h: 0, dirty: true };
      if (opts.hora !== undefined && opts.hora !== null) S.hora = opts.hora;
      aplicarLuz(scene);
      api.needsFrames = name !== "room" || Boolean(opts.character) || Boolean(opts.showProps) || Boolean(opts.player) || Boolean(opts.pets && opts.pets.length) || Boolean(window.AQ3D && AQ3D.active());
      S.cur.ro = new ResizeObserver(() => { if (S.cur) S.cur.dirty = true; });
      S.cur.ro.observe(container);
      S.clock.start();
      if (!S.raf) S.raf = requestAnimationFrame(frame);
      resize();
      return true;
    } catch (e) {
      if (window.console) console.warn("Cenário 3D indisponível, usando o 2D:", e);
      try { dispose(); } catch (e2) { /* nada */ }
      return false;
    }
  }

  function unmount(container) {
    if (S.cur && (!container || S.cur.container === container)) dispose();
  }

  // ------------------------------------------------------------------ ícones 3D dos móveis (no lugar dos emojis)
  // Cada peça é montada com o mesmo construtor da sala, enquadrada por uma câmera própria e guardada como imagem.
  const ICONS = {}, iconQueue = [];
  let iconR = null, iconBusy = false;
  function iconRenderer() {
    if (iconR) return iconR;
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(160, 160, false);
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
    r.setClearColor(0x000000, 0);
    iconR = { r, env: buildEnv(r), cam: new T.PerspectiveCamera(28, 1, 0.6, 60) };
    return iconR;
  }
  // fotografa um objeto 3D: câmera afastada até caber a esfera que o envolve, vista de cima e de lado
  function iconShot(obj, dir) {
    const R = iconRenderer(), scene = new T.Scene();
    scene.environment = R.env;
    scene.add(new T.HemisphereLight(0xfff3e2, 0x7a6a58, 0.5));
    const sun = new T.DirectionalLight(0xfff0dc, 1.25); sun.position.set(-4, 8, 7); scene.add(sun);
    const fill = new T.DirectionalLight(0xdde8ff, 0.35); fill.position.set(6, 3, 4); scene.add(fill);
    scene.add(obj);
    const box = new T.Box3().setFromObject(obj), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
    const rad = Math.max(0.4, Math.hypot(sz.x, sz.y, sz.z) / 2), d = (rad / Math.sin((R.cam.fov * Math.PI) / 360)) * 0.98;
    R.cam.position.copy(c).addScaledVector((dir || new T.Vector3(0.55, 0.42, 1)).clone().normalize(), d); R.cam.lookAt(c); R.cam.updateProjectionMatrix();
    R.r.render(scene, R.cam);
    const url = R.r.domElement.toDataURL("image/png");
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    return url;
  }
  const PET_ICONS = {};
  function petIcon(species, variant) {   // bichinho de estimação em 3D, de três quartos (loja, adoção, lista)
    const k = species + ":" + (variant || "");
    if (PET_ICONS[k] !== undefined) return PET_ICONS[k];
    try { const g = new T.Group(); const p = makePet({ species, variant: variant || null }); p.rotation.y = -0.7; g.add(p); PET_ICONS[k] = iconShot(g, new T.Vector3(0.2, 0.55, 1)); } catch (e) { PET_ICONS[k] = null; }
    return PET_ICONS[k];
  }
  function iconMake(id) {
    const ALIAS = { "e-quadro": "quadro-abstrato", "e-planta": "planta", poster: "quadro-cerebro", "casa-planta": "planta", "casa-abajur": "abajur", "casa-estante": "estante", "k-planta": "ficus", "k-quadro": "quadro-paisagem", bebedouro: "purificador", cafeteira: "cafe-bar" };   // peças da sala de espera/casa/cozinha reaproveitam o desenho parecido
    const src = ALIAS[id] || id, all = officeBuilders();
    const mk = all[src] || (EXTRA_ITEMS[src] && (() => EXTRA_ITEMS[src].build(kitObj)));
    return mk ? iconShot(mk()) : null;
  }
  // criaturas do aquário: o mesmo modelo do visualizador, de três quartos
  const FISH_ICONS = {};
  function fishIcon(id) {
    if (FISH_ICONS[id] !== undefined) return FISH_ICONS[id];
    try { const g = new T.Group(); g.add(fishModel(id)); g.rotation.y = -0.6; FISH_ICONS[id] = iconShot(g, new T.Vector3(0.15, 0.3, 1)); } catch (e) { FISH_ICONS[id] = null; }
    return FISH_ICONS[id];
  }
  // devolve a imagem (ou null se a peça não tem modelo 3D); a primeira vez custa alguns milissegundos
  function icon(id) {
    if (ICONS[id] !== undefined) return ICONS[id];
    try { ICONS[id] = iconMake(id); } catch (e) { ICONS[id] = null; }
    return ICONS[id];
  }
  // versão em fila: gera uma peça por vez, sem travar a tela, e avisa quando estiver pronta
  function iconAsync(id, cb) {
    if (ICONS[id] !== undefined) { cb(ICONS[id]); return; }
    iconQueue.push([id, cb]);
    if (iconBusy) return;
    iconBusy = true;
    const next = () => { const job = iconQueue.shift(); if (!job) { iconBusy = false; return; } job[1](icon(job[0])); setTimeout(next, 16); };
    setTimeout(next, 0);
  }

  window.Scene3D = {
    available: true, mount, unmount, icon, iconAsync, fishIcon, petIcon,
    update(opts) { if (S.cur) { S.cur.opts = opts; S.cur.api.apply(opts); S.cur.dirty = true; } },
    debugDoctor() { let d = null; if (S.cur) S.cur.scene.traverse((o) => { if (o.userData && o.userData.doctor) d = o.userData.doctor; }); return d; },
    // gancho de teste: onde estão paciente e acompanhante, e se ainda estão a caminho da poltrona
    debugGente() {
      const q = S.cur && S.cur.api && S.cur.api.gente ? S.cur.api.gente() : null;
      if (!q) return null;
      const ler = (p2) => (p2 ? { x: Math.round(p2.position().x * 100) / 100, z: Math.round(p2.position().z * 100) / 100, sentado: p2.isSeated(), andando: p2.busy(), passo: p2.debugStep && p2.debugStep() } : null);
      return { pat: ler(q.pat), comp: ler(q.comp) };
    },
    doctorMode(name, ms) { const a = S.cur && S.cur.api.doctor; if (a) a.mode(name, ms); },
    doctorSeq(steps) { const a = S.cur && S.cur.api.doctor; if (a) a.seq(steps); },
    doctorAct(key, aoFazer) { const a = S.cur && S.cur.api.doctor; return a ? a.act(key, aoFazer) : 0; },
    // Acender a luz acende a luz. Tocar no abajur fazia a psicóloga ESTENDER A MÃO e nada mudava na
    // sala: o gesto existia, o efeito não. Agora a lâmpada do teto ganha calor e alcance, e o ambiente
    // sobe junto, como quem acende o abajur no fim da tarde.
    luzAcesa(on) {
      if (!S.cur) return false;
      S.luzOn = Boolean(on);
      const achou = aplicarLuz(S.cur.scene);
      S.cur.dirty = true;
      return achou;
    },
    // hora do jogo (em horas, pode ter fração): muda a luz que entra pela janela
    hora(h) {
      S.hora = Number(h) || 0;
      if (S.cur) { aplicarLuz(S.cur.scene); S.cur.dirty = true; }
      return S.hora;
    },
    luzInfo() { const L = luzDaHora(S.hora); return { hora: S.hora, acesa: Boolean(S.luzOn), forca: L.forca, cor: L.cor, hemi: L.hemi }; },
    layoutInfo() { const a = S.cur && S.cur.api.layoutInfo; return a ? a() : null; },
    // guarda e devolve a cena atual (quem usa o 3D por cima, como o editor da personagem, restaura ao fechar)
    snapshot() { return S.cur ? { container: S.cur.container, name: S.cur.name, opts: S.cur.opts } : null; },
    restore(snap) { if (snap && snap.container && snap.container.isConnected) mount(snap.container, snap.name, snap.opts); },
    registerItems, sizeOf, roomBounds, loadModel, model, lampLight, PRESETS, ACABAMENTOS,
    doctorBusy() { const a = S.cur && S.cur.api.doctor; return a ? a.busy() : false; },
    _state: S
  };
})();

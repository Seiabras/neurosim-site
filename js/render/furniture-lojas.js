"use strict";

// Móveis exclusivos das lojas espalhadas pela cidade (Som & Cia, Verde Vivo, Páginas & Pausas, Ateliê Cor, Velho Tempo e Casa dos Brinquedos).
// Só o desenho 3D de cada peça, registrado pelo id; nome, preço, loja e categoria ficam em content/shop.json
// (gerado por tools/python/build_stores.py). A caixa de colisão vem da própria malha, como nos outros móveis.
(function () {
  if (!window.Scene3D || !window.Scene3D.registerItems) return;
  const WOOD = 0xb07a4a, DARK = 0x5a3d26, BLACK = 0x1e1a22, GOLD = 0xe2b84a;
  const P = (k) => new k.T.Group();
  const legs4 = (k, g, w, d, h, c, r = 0.05) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => g.add(k.cyl(r, r, h, c || DARK, { pos: [sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1)], outline: false })));
  const pot = (k, g, x, z, r, h, c = 0xc86f4a) => g.add(k.cyl(r, r * 0.75, h, c, { pos: [x, h / 2, z] }));
  const leaf = (k, g, x, y, z, len, c, rot) => g.add(k.solid(new k.T.ConeGeometry(0.08, len, 5), c, { pos: [x, y, z], rot, outline: false, mat: { roughness: 0.6 } }));

  const ITEMS = {
    // ============================================================ SOM & CIA (instrumentos)
    bateria: { area: "casa", build: (k) => { const g = P(k);
      g.add(k.cyl(0.5, 0.5, 0.55, 0xc9453a, { pos: [0, 0.55, 0], mat: { roughness: 0.3, metalness: 0.2 } })); g.add(k.cyl(0.52, 0.52, 0.05, 0xf4f0ea, { pos: [0, 0.84, 0] }));
      [[-0.75, 0.15], [0.75, 0.15]].forEach(([x, z]) => { g.add(k.cyl(0.3, 0.3, 0.25, 0x2a5a9a, { pos: [x, 1.0, z], mat: { metalness: 0.2 } })); g.add(k.cyl(0.03, 0.03, 0.8, 0x888a92, { pos: [x, 0.4, z], outline: false })); });
      g.add(k.cyl(0.4, 0.4, 0.45, 0xc9453a, { pos: [-0.35, 0.55, 0.65], mat: { metalness: 0.2 } }));
      [[-1.1, -0.4, 1.7], [1.05, -0.35, 1.55]].forEach(([x, z, y]) => { g.add(k.cyl(0.02, 0.02, y, 0x888a92, { pos: [x, y / 2, z], outline: false })); g.add(k.cyl(0.42, 0.42, 0.03, GOLD, { pos: [x, y, z], rot: [0.12, 0, 0.08], mat: { metalness: 0.9, roughness: 0.25 } })); });
      g.add(k.cyl(0.24, 0.24, 0.5, 0x3a3a44, { pos: [0.1, 0.25, 1.15], outline: false })); return g; } },
    teclado: { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(1.9, 0.14, 0.62, BLACK, { pos: [0, 0.9, 0], mat: { roughness: 0.35 } })); g.add(k.box(1.75, 0.05, 0.36, 0xfaf6ec, { pos: [0, 0.99, 0.08], outline: false }));
      for (let i = 0; i < 16; i++) g.add(k.box(0.05, 0.06, 0.2, k.INK, { pos: [-0.8 + i * 0.106, 1.03, 0.02], outline: false }));
      [[-0.75, 0.7, 0], [0.75, 0.7, 0]].forEach(([x]) => { g.add(k.box(0.06, 0.9, 0.5, 0x3a3a44, { pos: [x, 0.45, 0], rot: [0, 0, x < 0 ? 0.1 : -0.1] })); });
      g.add(k.box(0.9, 0.3, 0.1, 0x2a2a34, { pos: [0, 1.14, -0.24], outline: false })); return g; } },
    harpa: { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(0.9, 0.16, 0.6, 0x8a5a2c, { pos: [0, 0.08, 0] })); g.add(k.cyl(0.06, 0.09, 2.2, GOLD, { pos: [-0.35, 1.2, 0], mat: { metalness: 0.7, roughness: 0.35 } }));
      g.add(k.solid(new k.T.TorusGeometry(0.62, 0.06, 8, 24, Math.PI * 0.75), 0xa8703a, { pos: [0.02, 2.05, 0], rot: [0, 0, -0.35], outline: false }));
      for (let i = 0; i < 8; i++) g.add(k.cyl(0.008, 0.008, 1.9 - i * 0.18, 0xf4e6c8, { pos: [-0.28 + i * 0.09, 1.1 + i * 0.09, 0], outline: false })); return g; } },
    xilofone: { area: "casa", build: (k) => { const g = P(k);
      g.add(k.box(1.5, 0.06, 0.16, DARK, { pos: [0, 0.5, -0.32] })); g.add(k.box(1.5, 0.06, 0.16, DARK, { pos: [0, 0.5, 0.32] })); [-0.7, 0.7].forEach((x) => g.add(k.box(0.1, 0.5, 0.8, DARK, { pos: [x, 0.25, 0], outline: false })));
      for (let i = 0; i < 8; i++) g.add(k.box(0.15, 0.05, 0.85 - i * 0.07, [0xe2473a, 0xf2884a, 0xf2c230, 0x4fae5a, 0x3fa9e0, 0x5b64bf, 0x8a5ad8, 0xe2478a][i], { pos: [-0.6 + i * 0.17, 0.57, 0] })); return g; } },
    contrabaixo: { area: "consultorio", build: (k) => { const g = P(k);
      const b = k.sph(0.5, 0xa5602c, { pos: [0, 0.6, 0], mat: { roughness: 0.3 } }); b.scale.set(1, 1.15, 0.42); g.add(b);
      const t = k.sph(0.38, 0xa5602c, { pos: [0, 1.4, 0], mat: { roughness: 0.3 } }); t.scale.set(1, 0.9, 0.4); g.add(t);
      g.add(k.box(0.12, 1.5, 0.08, 0x2a1a10, { pos: [0, 2.2, 0.05] })); g.add(k.sph(0.12, 0x2a1a10, { pos: [0, 3.0, 0.05] }));
      g.add(k.cyl(0.02, 0.02, 0.4, 0x888a92, { pos: [0, 0.05, 0.1], outline: false })); [-0.05, 0.05].forEach((x) => g.add(k.box(0.012, 2.6, 0.012, 0xf0eadc, { pos: [x, 1.8, 0.11], outline: false }))); return g; } },
    "caixa-som": { area: "casa", build: (k) => { const g = P(k);
      g.add(k.box(0.8, 1.5, 0.7, 0x22222a, { pos: [0, 0.75, 0], mat: { roughness: 0.5 } })); g.add(k.cyl(0.28, 0.28, 0.06, 0x3a3a44, { pos: [0, 1.05, 0.36], rot: [Math.PI / 2, 0, 0] })); g.add(k.cyl(0.14, 0.14, 0.06, 0x3a3a44, { pos: [0, 0.45, 0.36], rot: [Math.PI / 2, 0, 0] }));
      g.add(k.sph(0.05, 0xe2473a, { pos: [0.28, 1.42, 0.36], outline: false, mat: { emissive: 0xe2473a, emissiveIntensity: 1 } })); return g; } },
    microfone: { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.cyl(0.32, 0.36, 0.06, 0x2a2a34, { pos: [0, 0.03, 0] })); g.add(k.cyl(0.03, 0.03, 1.9, 0x888a92, { pos: [0, 1.0, 0], outline: false }));
      g.add(k.cyl(0.02, 0.02, 0.35, 0x888a92, { pos: [0.14, 1.95, 0], rot: [0, 0, 1.0], outline: false })); g.add(k.sph(0.09, 0x3a3a44, { pos: [0.3, 2.08, 0], mat: { metalness: 0.8, roughness: 0.3 } })); return g; } },
    "estante-partitura": { area: "casa", build: (k) => { const g = P(k);
      g.add(k.cyl(0.03, 0.03, 1.5, 0x2a2a34, { pos: [0, 0.75, 0], outline: false })); [0, 2.1, 4.2].forEach((a) => g.add(k.cyl(0.02, 0.02, 0.5, 0x2a2a34, { pos: [Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2], rot: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1], outline: false })));
      g.add(k.box(0.75, 0.5, 0.05, 0x2a2a34, { pos: [0, 1.65, 0], rot: [-0.25, 0, 0] })); g.add(k.box(0.68, 0.42, 0.02, 0xfaf6ec, { pos: [0, 1.66, 0.04], rot: [-0.25, 0, 0], outline: false })); return g; } },

    // ============================================================ VERDE VIVO (plantas)
    samambaia: { area: "casa", build: (k) => { const g = P(k); pot(k, g, 0, 0, 0.42, 0.55);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; leaf(k, g, Math.cos(a) * 0.35, 1.0, Math.sin(a) * 0.35, 1.1, i % 2 ? 0x3f9b4f : 0x2f8442, [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]); } return g; } },
    bonsai: { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(0.7, 0.08, 0.5, 0x2a2a34, { pos: [0, 0.04, 0] })); g.add(k.box(0.55, 0.16, 0.38, 0x7a5232, { pos: [0, 0.16, 0] }));
      g.add(k.cyl(0.05, 0.08, 0.6, DARK, { pos: [0, 0.55, 0], rot: [0, 0, 0.15], outline: false })); [[0, 0.95, 0, 0.3], [-0.22, 0.82, 0.05, 0.22], [0.2, 0.86, -0.04, 0.24]].forEach(([x, y, z, r]) => { const c = k.sph(r, 0x3f9b4f, { pos: [x, y, z], mat: { roughness: 0.7 } }); c.scale.y = 0.65; g.add(c); }); return g; } },
    "fonte-mesa": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.cyl(0.5, 0.55, 0.25, 0x8a8f98, { pos: [0, 0.125, 0], mat: { roughness: 0.8 } })); g.add(k.cyl(0.42, 0.42, 0.04, 0x6fc3ea, { pos: [0, 0.26, 0], outline: false, mat: { transparent: true, opacity: 0.8, roughness: 0.05 } }));
      g.add(k.cyl(0.1, 0.14, 0.5, 0x8a8f98, { pos: [0, 0.5, 0] })); g.add(k.cyl(0.26, 0.2, 0.08, 0x8a8f98, { pos: [0, 0.78, 0] })); g.add(k.sph(0.06, 0xbfe6ff, { pos: [0, 0.9, 0], outline: false, mat: { transparent: true, opacity: 0.7 } })); return g; } },
    cacto: { area: "casa", build: (k) => { const g = P(k); pot(k, g, 0, 0, 0.36, 0.45, 0xd9a15f);
      g.add(k.cyl(0.2, 0.22, 1.5, 0x4a9a5a, { pos: [0, 1.2, 0], mat: { roughness: 0.7 } })); g.add(k.sph(0.2, 0x4a9a5a, { pos: [0, 1.95, 0] }));
      [[-1, 1.3], [1, 1.5]].forEach(([s, y]) => { g.add(k.cyl(0.11, 0.11, 0.45, 0x4a9a5a, { pos: [s * 0.32, y, 0], rot: [0, 0, s * 1.5], outline: false })); g.add(k.cyl(0.11, 0.11, 0.5, 0x4a9a5a, { pos: [s * 0.52, y + 0.25, 0], outline: false })); }); return g; } },
    orquideas: { area: "consultorio", build: (k) => { const g = P(k); pot(k, g, 0, 0, 0.2, 0.25, 0xf4f0ea);
      g.add(k.cyl(0.02, 0.02, 1.0, 0x4a7a3a, { pos: [0, 0.75, 0], rot: [0, 0, 0.12], outline: false })); [0.35, 0.55, 0.75, 0.95].forEach((y, i) => { [-1, 1].forEach((s) => g.add(k.sph(0.09, i % 2 ? 0xe58aa8 : 0xf4c0d8, { pos: [s * 0.1 + i * 0.03, y + 0.2, 0.02], outline: false, mat: { roughness: 0.5 } }))); });
      leaf(k, g, 0, 0.4, 0.1, 0.5, 0x2f8442, [0.7, 0, 0.3]); return g; } },
    terrario: { area: "casa", build: (k) => { const g = P(k);
      g.add(k.box(0.8, 0.1, 0.5, 0x3a3a44, { pos: [0, 0.05, 0] })); g.add(k.box(0.7, 0.16, 0.4, 0x7a5232, { pos: [0, 0.18, 0], outline: false }));
      g.add(new k.T.Mesh(new k.T.BoxGeometry(0.76, 0.6, 0.46), new k.T.MeshStandardMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.28, roughness: 0.05 }))).position.y = 0.55;
      [[-0.2, 0.42, 0.1], [0.15, 0.5, -0.05], [0.28, 0.38, 0.1]].forEach(([x, y, z]) => g.add(k.sph(0.13, 0x3f9b4f, { pos: [x, y, z], outline: false }))); g.add(k.sph(0.08, 0x8a8f98, { pos: [-0.28, 0.3, -0.1], outline: false })); return g; } },
    jardineira: { area: "casa", build: (k) => { const g = P(k);
      g.add(k.box(1.4, 0.3, 0.32, 0xa8703a, { pos: [0, 0.15, 0] })); g.add(k.box(1.3, 0.05, 0.24, 0x4a3220, { pos: [0, 0.3, 0], outline: false }));
      for (let i = 0; i < 7; i++) { g.add(k.cyl(0.015, 0.015, 0.4, 0x3f8a4a, { pos: [-0.55 + i * 0.185, 0.5, 0], outline: false })); g.add(k.sph(0.07, [0xe2473a, 0xf2c230, 0xe58aa8, 0xffffff][i % 4], { pos: [-0.55 + i * 0.185, 0.72, 0], outline: false })); } return g; } },
    "jardim-vertical": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(1.6, 2.0, 0.12, 0x5a3d26, { pos: [0, 2.6, 0] }));
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.add(k.cyl(0.13, 0.1, 0.16, 0xc86f4a, { pos: [-0.55 + c * 0.37, 1.85 + r * 0.45, 0.16], rot: [Math.PI / 2 - 0.3, 0, 0], outline: false })); g.add(k.sph(0.13, [0x2f8442, 0x3f9b4f, 0x5cb56a][(r + c) % 3], { pos: [-0.55 + c * 0.37, 1.9 + r * 0.45, 0.22], outline: false })); } return g; } },

    // ============================================================ PÁGINAS & PAUSAS (leitura)
    "carrinho-livros": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(1.0, 0.06, 0.5, WOOD, { pos: [0, 0.5, 0] })); g.add(k.box(1.0, 0.06, 0.5, WOOD, { pos: [0, 1.05, 0] })); [[-0.45, -0.2], [0.45, -0.2], [-0.45, 0.2], [0.45, 0.2]].forEach(([x, z]) => g.add(k.cyl(0.03, 0.03, 1.1, DARK, { pos: [x, 0.55, z], outline: false })));
      [[-0.4, 0], [0.4, 0], [0, 0.25], [-0.2, -0.25]].forEach(([x, z], i) => g.add(k.box(0.14 + (i % 2) * 0.05, 0.3, 0.36, [0xc9453a, 0x3a6ab0, 0x4a9a5a, 0xf2a83f][i], { pos: [x, 0.68 + (i > 1 ? 0.55 : 0), z], outline: false })));
      [[-0.45, 0.22], [0.45, 0.22]].forEach(([x, z]) => g.add(k.cyl(0.09, 0.09, 0.05, 0x2a2a34, { pos: [x, 0.09, z], rot: [0, 0, Math.PI / 2], outline: false }))); return g; } },
    "mesa-estudos": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(1.8, 0.1, 0.9, WOOD, { pos: [0, 1.0, 0] })); legs4(k, g, 1.8, 0.9, 1.0); g.add(k.box(0.35, 0.05, 0.28, 0xfaf6ec, { pos: [-0.5, 1.08, 0.05], outline: false }));
      g.add(k.box(0.3, 0.16, 0.24, 0x3a6ab0, { pos: [0.55, 1.13, -0.1] })); g.add(k.cyl(0.05, 0.05, 0.6, 0x2a2a34, { pos: [0.75, 1.35, -0.3], outline: false })); g.add(k.sph(0.16, 0xffe08a, { pos: [0.75, 1.68, -0.3], outline: false, mat: { emissive: 0xffc44d, emissiveIntensity: 0.5 } })); return g; } },
    "quadro-negro": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(2.2, 1.4, 0.12, 0x8a5a2c, { pos: [0, 3.2, 0] })); g.add(k.box(2.0, 1.2, 0.05, 0x2f4a3a, { pos: [0, 3.2, 0.05], outline: false }));
      g.add(k.box(0.5, 0.05, 0.03, 0xfaf6ec, { pos: [-0.5, 3.4, 0.09], outline: false })); g.add(k.box(0.7, 0.04, 0.03, 0xf2c230, { pos: [0.3, 3.15, 0.09], outline: false })); g.add(k.box(0.4, 0.04, 0.03, 0xe58aa8, { pos: [-0.3, 2.9, 0.09], outline: false })); g.add(k.box(1.0, 0.06, 0.16, 0x8a5a2c, { pos: [0, 2.52, 0.08], outline: false })); return g; } },
    "pilha-livros": { area: "casa", build: (k) => { const g = P(k);
      [[0.9, 0.16, 0.6, 0x3a6ab0], [0.8, 0.14, 0.55, 0xc9453a], [0.7, 0.18, 0.5, 0x4a9a5a], [0.62, 0.12, 0.46, 0xf2a83f], [0.5, 0.14, 0.4, 0x8a4fbf]].reduce((y, [w, h, d, c], i) => { g.add(k.box(w, h, d, c, { pos: [(i % 2 - 0.5) * 0.06, y + h / 2, 0], rot: [0, (i - 2) * 0.12, 0] })); return y + h; }, 0); return g; } },
    "relogio-mesa": { area: "casa", build: (k) => { const g = P(k);
      g.add(k.box(0.6, 0.9, 0.4, 0x7a5232, { pos: [0, 0.45, 0] })); g.add(k.cyl(0.22, 0.22, 0.06, 0xfaf6ec, { pos: [0, 0.6, 0.22], rot: [Math.PI / 2, 0, 0] })); g.add(k.box(0.03, 0.14, 0.02, k.INK, { pos: [0, 0.65, 0.26], outline: false })); g.add(k.box(0.1, 0.03, 0.02, k.INK, { pos: [0.04, 0.6, 0.26], outline: false }));
      g.add(k.cyl(0.05, 0.05, 0.5, GOLD, { pos: [0, 0.2, 0.22], outline: false, mat: { metalness: 0.8 } })); return g; } },
    "luminaria-leitura": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.cyl(0.3, 0.34, 0.06, 0x2a2a34, { pos: [0, 0.03, 0] })); g.add(k.cyl(0.03, 0.03, 2.2, 0x2a2a34, { pos: [0, 1.1, 0], outline: false })); g.add(k.cyl(0.02, 0.02, 0.8, 0x2a2a34, { pos: [0.35, 2.3, 0], rot: [0, 0, -1.2], outline: false }));
      const sh = k.solid(new k.T.ConeGeometry(0.3, 0.35, 16, 1, true), 0xf2c230, { pos: [0.72, 2.28, 0], rot: [0, 0, Math.PI], outline: false, mat: { emissive: 0xffc44d, emissiveIntensity: 0.5 } }); g.add(sh); return g; } },

    // ============================================================ ATELIÊ COR (arte)
    cavalete: { area: "consultorio", build: (k) => { const g = P(k);
      [[-0.4, 0.3], [0.4, 0.3], [0, -0.4]].forEach(([x, z]) => g.add(k.cyl(0.03, 0.03, 2.4, WOOD, { pos: [x * 0.8, 1.15, z * 0.5], rot: [z < 0 ? -0.15 : 0.15, 0, x * 0.08], outline: false })));
      g.add(k.box(1.0, 0.06, 0.16, DARK, { pos: [0, 0.9, 0.2] })); const tela = k.box(0.9, 1.15, 0.05, 0xfaf6ec, { pos: [0, 1.6, 0.16], rot: [-0.08, 0, 0] }); g.add(tela);
      g.add(k.sph(0.28, 0xe2473a, { pos: [-0.15, 1.7, 0.2], outline: false })); g.add(k.sph(0.22, 0xf2c230, { pos: [0.1, 1.45, 0.2], outline: false })); g.add(k.sph(0.18, 0x3a6ab0, { pos: [0.2, 1.85, 0.2], outline: false })); return g; } },
    "prateleira-tintas": { area: "casa", build: (k) => { const g = P(k);
      g.add(k.box(1.4, 1.6, 0.4, 0xfaf6ec, { pos: [0, 0.8, 0] })); [0.55, 1.1].forEach((y) => g.add(k.box(1.3, 0.05, 0.36, WOOD, { pos: [0, y, 0.02], outline: false })));
      for (let i = 0; i < 6; i++) g.add(k.cyl(0.07, 0.07, 0.22, [0xe2473a, 0xf2884a, 0xf2c230, 0x4fae5a, 0x3fa9e0, 0x8a5ad8][i], { pos: [-0.55 + i * 0.22, 0.7, 0.04], outline: false })); [-0.4, 0, 0.4].forEach((x) => g.add(k.cyl(0.04, 0.04, 0.35, WOOD, { pos: [x, 1.3, 0.04], outline: false }))); return g; } },
    "escultura-argila": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.cyl(0.3, 0.34, 1.0, 0xf4f0ea, { pos: [0, 0.5, 0] })); const b = k.sph(0.4, 0xc98a62, { pos: [0, 1.4, 0], mat: { roughness: 0.9 } }); b.scale.set(0.9, 1.2, 0.8); g.add(b); g.add(k.sph(0.22, 0xc98a62, { pos: [0.25, 1.85, 0.05], mat: { roughness: 0.9 } })); return g; } },
    "movel-mobile": { area: "casa", build: (k) => { const g = P(k);
      g.add(k.cyl(0.04, 0.04, 2.6, 0x2a2a34, { pos: [0, 1.3, 0], outline: false })); g.add(k.cyl(0.3, 0.34, 0.05, 0x2a2a34, { pos: [0, 0.03, 0] })); g.add(k.cyl(0.02, 0.02, 1.4, 0x2a2a34, { pos: [0.5, 2.5, 0], rot: [0, 0, Math.PI / 2], outline: false }));
      [[1.15, 2.2, 0xe2473a], [0.5, 2.0, 0xf2c230], [-0.2, 2.2, 0x3fa9e0]].forEach(([x, y, c]) => { g.add(k.cyl(0.006, 0.006, 0.4, 0xdddddd, { pos: [x, y + 0.2, 0], outline: false })); g.add(k.sph(0.16, c, { pos: [x, y, 0], outline: false })); }); return g; } },
    "mesa-desenho": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(1.5, 0.08, 1.0, 0xfaf6ec, { pos: [0, 1.0, 0], rot: [0.18, 0, 0] })); [[-0.6], [0.6]].forEach(([x]) => { g.add(k.box(0.08, 1.0, 0.08, DARK, { pos: [x, 0.5, -0.35], outline: false })); g.add(k.box(0.08, 0.85, 0.08, DARK, { pos: [x, 0.42, 0.45], outline: false })); });
      g.add(k.cyl(0.03, 0.03, 0.2, 0xe2473a, { pos: [-0.3, 1.14, 0.15], rot: [0, 0, 1.4], outline: false })); g.add(k.cyl(0.03, 0.03, 0.2, 0x3a6ab0, { pos: [-0.15, 1.14, 0.2], rot: [0, 0.4, 1.4], outline: false })); return g; } },
    manequim: { area: "casa", build: (k) => { const g = P(k);
      g.add(k.cyl(0.3, 0.34, 0.06, 0x2a2a34, { pos: [0, 0.03, 0] })); g.add(k.cyl(0.03, 0.03, 1.1, 0x2a2a34, { pos: [0, 0.6, 0], outline: false }));
      const t = k.cyl(0.32, 0.22, 1.0, 0xe58aa8, { pos: [0, 1.6, 0], mat: { fabric: true } }); g.add(t); g.add(k.sph(0.16, 0xe9c9a8, { pos: [0, 2.3, 0] })); g.add(k.sph(0.2, 0xe58aa8, { pos: [-0.3, 1.95, 0], mat: { fabric: true } })); g.add(k.sph(0.2, 0xe58aa8, { pos: [0.3, 1.95, 0], mat: { fabric: true } })); return g; } },

    // ============================================================ VELHO TEMPO (antiguidades)
    "bau-antigo": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(1.3, 0.6, 0.7, 0x6a4526, { pos: [0, 0.3, 0] })); const lid = k.cyl(0.35, 0.35, 1.3, 0x6a4526, { pos: [0, 0.68, 0], rot: [0, 0, Math.PI / 2] }); lid.scale.set(1, 1, 1); g.add(lid);
      [-0.45, 0.45].forEach((x) => g.add(k.box(0.08, 0.95, 0.74, GOLD, { pos: [x, 0.5, 0], outline: false, mat: { metalness: 0.8, roughness: 0.35 } }))); g.add(k.box(0.14, 0.18, 0.05, GOLD, { pos: [0, 0.6, 0.38], outline: false, mat: { metalness: 0.8 } })); return g; } },
    gramofone: { area: "casa", build: (k) => { const g = P(k);
      g.add(k.box(0.8, 0.9, 0.7, 0x6a4526, { pos: [0, 0.45, 0] })); g.add(k.cyl(0.3, 0.3, 0.05, k.INK, { pos: [0, 0.93, 0] })); g.add(k.cyl(0.02, 0.02, 0.5, 0x888a92, { pos: [0.28, 1.1, 0.1], rot: [0, 0, 0.6], outline: false }));
      g.add(k.cyl(0.03, 0.03, 0.8, GOLD, { pos: [0, 1.3, 0], outline: false, mat: { metalness: 0.8 } })); g.add(k.solid(new k.T.ConeGeometry(0.45, 0.7, 20, 1, true), GOLD, { pos: [0.1, 1.85, 0], rot: [0, 0, -0.9], outline: false, mat: { metalness: 0.85, roughness: 0.3, side: k.T.DoubleSide } })); return g; } },
    "cadeira-balanco": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(0.7, 0.08, 0.7, WOOD, { pos: [0, 0.6, 0] })); g.add(k.box(0.7, 0.9, 0.08, WOOD, { pos: [0, 1.1, -0.32], rot: [0.12, 0, 0] })); [-0.32, 0.32].forEach((x) => { g.add(k.box(0.06, 0.6, 0.06, DARK, { pos: [x, 0.3, 0.3], outline: false })); g.add(k.box(0.06, 0.6, 0.06, DARK, { pos: [x, 0.3, -0.3], outline: false })); g.add(k.solid(new k.T.TorusGeometry(0.75, 0.035, 6, 24, Math.PI * 0.55), DARK, { pos: [x, 0.7, 0], rot: [0, Math.PI / 2, Math.PI * 1.22], outline: false })); }); return g; } },
    lampiao: { area: "casa", build: (k) => { const g = P(k);
      g.add(k.cyl(0.18, 0.2, 0.1, 0x2a2a34, { pos: [0, 0.05, 0] })); g.add(k.cyl(0.03, 0.03, 1.2, 0x2a2a34, { pos: [0, 0.7, 0], outline: false })); g.add(k.box(0.34, 0.5, 0.34, 0x2a2a34, { pos: [0, 1.5, 0], outline: false }));
      g.add(k.box(0.26, 0.42, 0.26, 0xffd98a, { pos: [0, 1.5, 0], outline: false, mat: { emissive: 0xffb84d, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 } })); g.add(k.cyl(0.16, 0.02, 0.14, 0x2a2a34, { pos: [0, 1.82, 0], outline: false })); return g; } },
    "maquina-escrever": { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(1.3, 0.1, 0.8, DARK, { pos: [0, 1.0, 0] })); legs4(k, g, 1.3, 0.8, 1.0); g.add(k.box(0.7, 0.22, 0.5, 0x2a2a34, { pos: [0, 1.17, 0], mat: { metalness: 0.3 } })); g.add(k.box(0.55, 0.05, 0.3, 0x3a3a44, { pos: [0, 1.32, 0.05], rot: [-0.3, 0, 0], outline: false }));
      g.add(k.box(0.4, 0.28, 0.02, 0xfaf6ec, { pos: [0, 1.5, -0.2], rot: [-0.1, 0, 0], outline: false })); return g; } },
    "espelho-oval": { area: "casa", build: (k) => { const g = P(k);
      const fr = k.sph(0.85, GOLD, { pos: [0, 1.7, 0], mat: { metalness: 0.7, roughness: 0.35 } }); fr.scale.set(0.7, 1, 0.06); g.add(fr); const m = k.sph(0.76, 0xcfe6f2, { pos: [0, 1.7, 0.02], outline: false, mat: { roughness: 0.03, metalness: 1, envMapIntensity: 1.6 } }); m.scale.set(0.7, 1, 0.05); g.add(m);
      [-0.4, 0.4].forEach((x) => g.add(k.box(0.06, 0.5, 0.06, DARK, { pos: [x, 0.25, -0.2], rot: [0.35, 0, 0], outline: false }))); return g; } },

    // ============================================================ CASA DOS BRINQUEDOS (infantil)
    cavalinho: { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.solid(new k.T.TorusGeometry(0.7, 0.05, 6, 20, Math.PI * 0.6), DARK, { pos: [0, 0.35, 0.22], rot: [0, 0, Math.PI * 1.2], outline: false })); g.add(k.solid(new k.T.TorusGeometry(0.7, 0.05, 6, 20, Math.PI * 0.6), DARK, { pos: [0, 0.35, -0.22], rot: [0, 0, Math.PI * 1.2], outline: false }));
      const b = k.sph(0.4, 0xc98a4a, { pos: [0, 0.95, 0] }); b.scale.set(1.3, 0.75, 0.6); g.add(b); g.add(k.cyl(0.13, 0.17, 0.6, 0xc98a4a, { pos: [0.5, 1.25, 0], rot: [0, 0, -0.5] })); g.add(k.sph(0.2, 0xc98a4a, { pos: [0.78, 1.5, 0] })); g.add(k.box(0.18, 0.4, 0.06, 0x3a2a1c, { pos: [0.55, 1.35, 0], rot: [0, 0, 0.3], outline: false })); return g; } },
    escorregador: { area: "consultorio", build: (k) => { const g = P(k);
      g.add(k.box(0.7, 0.05, 0.7, 0xf2c230, { pos: [0, 1.2, -0.5] })); [[-0.3, -0.8], [0.3, -0.8], [-0.3, -0.2], [0.3, -0.2]].forEach(([x, z]) => g.add(k.cyl(0.04, 0.04, 1.2, 0xe2473a, { pos: [x, 0.6, z], outline: false })));
      g.add(k.box(0.6, 0.05, 1.7, 0x3fa9e0, { pos: [0, 0.65, 0.5], rot: [0.55, 0, 0] })); [-0.32, 0.32].forEach((x) => g.add(k.box(0.05, 0.16, 1.7, 0xe2473a, { pos: [x, 0.7, 0.5], rot: [0.55, 0, 0], outline: false })));
      for (let i = 0; i < 4; i++) g.add(k.box(0.6, 0.04, 0.12, 0xe2473a, { pos: [0, 0.2 + i * 0.28, -0.95 - i * 0.02], outline: false })); return g; } },
    "cesto-bolas": { area: "casa", build: (k) => { const g = P(k);
      g.add(k.cyl(0.5, 0.42, 0.55, 0xa8703a, { pos: [0, 0.28, 0] })); [[0, 0.62, 0, 0xe2473a], [0.22, 0.6, 0.1, 0x3fa9e0], [-0.2, 0.6, 0.12, 0xf2c230], [0.05, 0.58, -0.2, 0x4fae5a], [-0.18, 0.62, -0.1, 0xe58aa8]].forEach(([x, y, z, c]) => g.add(k.sph(0.2, c, { pos: [x, y, z], outline: false }))); return g; } },
    "mesa-blocos": { area: "casa", build: (k) => { const g = P(k);
      g.add(k.box(1.3, 0.08, 1.0, 0xfaf6ec, { pos: [0, 0.65, 0] })); legs4(k, g, 1.3, 1.0, 0.65, 0xf2c230, 0.06);
      [[-0.35, 0.05, 0xe2473a], [-0.1, 0.05, 0x3fa9e0], [0.2, 0.05, 0xf2c230], [-0.2, 0.32, 0x4fae5a], [0.05, 0.3, 0xe58aa8]].forEach(([x, y, c], i) => g.add(k.box(0.22, 0.18, 0.22, c, { pos: [x, 0.78 + (i > 2 ? 0.18 : 0), y * 0 + (i > 2 ? 0.08 : -0.1 + i * 0.05)], outline: false }))); return g; } },
    trem: { area: "casa", build: (k) => { const g = P(k);
      g.add(k.solid(new k.T.TorusGeometry(0.75, 0.03, 6, 32), 0x6a4526, { pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], outline: false })); g.add(k.solid(new k.T.TorusGeometry(0.85, 0.03, 6, 32), 0x6a4526, { pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], outline: false }));
      g.add(k.box(0.34, 0.2, 0.2, 0xe2473a, { pos: [0.8, 0.16, 0] })); g.add(k.cyl(0.07, 0.07, 0.2, 0x2a2a34, { pos: [0.9, 0.36, 0] })); [0.45, 0.1, -0.25].forEach((z, i) => g.add(k.box(0.28, 0.14, 0.2, [0x3fa9e0, 0xf2c230, 0x4fae5a][i], { pos: [0.72, 0.13, z * 1.2 - 0.5], rot: [0, 0.3 + i * 0.4, 0], outline: false }))); return g; } }
  };
  Scene3D.registerItems(ITEMS);
})();

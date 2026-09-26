"use strict";

// Móveis novos do consultório e da casa. Cada um é só a forma 3D: a caixa de colisão vem da própria malha
// (a psicóloga, os bichinhos e o posicionamento livre respeitam o contorno real de cada peça).
// Os dados (nome, preço, emoji) ficam em content/shop.json; aqui só o desenho, registrado pelo id.
(function () {
  if (!window.Scene3D || !window.Scene3D.registerItems) return;
  const WOOD = 0xb07a4a, DARK = 0x5a3d26;

  const pufe = (color) => (k) => {
    const g = new k.T.Group();
    g.add(k.cyl(0.5, 0.52, 0.42, color, { pos: [0, 0.21, 0], mat: { fabric: true }, seg: 28 }));
    const top = k.sph(0.5, color, { pos: [0, 0.42, 0], mat: { fabric: true } }); top.scale.y = 0.34; g.add(top);
    return g;
  };

  const tvRack = (k) => {
    const g = new k.T.Group();
    g.add(k.box(2.6, 0.75, 0.75, WOOD, { pos: [0, 0.375, 0] }));
    [-0.65, 0.65].forEach((x) => g.add(k.box(1.1, 0.55, 0.04, k.shade(WOOD, -0.2), { pos: [x, 0.38, 0.39], outline: false })));
    g.add(k.box(0.14, 0.18, 0.4, 0x222226, { pos: [0, 0.84, 0] }));
    g.add(k.box(2.0, 1.15, 0.1, 0x14141a, { pos: [0, 1.5, 0], mat: { roughness: 0.25, metalness: 0.3 } }));
    g.add(k.box(1.86, 1.02, 0.02, 0x2a6aa8, { pos: [0, 1.5, 0.06], outline: false, mat: { emissive: 0x1a4a88, emissiveIntensity: 0.55 } }));
    return g;
  };

  const chestOfDrawers = (k) => {
    const g = new k.T.Group();
    g.add(k.box(1.7, 1.25, 0.8, WOOD, { pos: [0, 0.625, 0] }));
    for (let i = 0; i < 3; i++) {
      g.add(k.box(1.5, 0.32, 0.05, k.shade(WOOD, 0.12), { pos: [0, 0.25 + i * 0.4, 0.41], outline: false }));
      g.add(k.sph(0.05, 0xe2b84a, { pos: [0, 0.25 + i * 0.4, 0.46], outline: false, mat: { metalness: 0.8, roughness: 0.3 } }));
    }
    return g;
  };

  const chairAt = (k, g, x, z, yaw, color) => {
    const c = new k.T.Group();
    c.add(k.box(0.6, 0.1, 0.6, color, { pos: [0, 0.55, 0] }));
    c.add(k.box(0.6, 0.7, 0.08, color, { pos: [0, 0.95, -0.28] }));
    [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].forEach(([lx, lz]) => c.add(k.box(0.07, 0.5, 0.07, DARK, { pos: [lx, 0.25, lz], outline: false })));
    c.position.set(x, 0, z); c.rotation.y = yaw; g.add(c);
  };

  const ITEMS = {
    // ---------------- consultório
    pufe: { area: "consultorio", build: pufe(0xb98adf) },
    "poltrona-extra": { area: "consultorio", build: (k) => k.armchair(0, 0, 0, 0x8fb98a) },
    "estante-dupla": { area: "consultorio", build: (k) => { const g = new k.T.Group(); g.add(k.bookshelf(-0.95, 0, 0)); g.add(k.bookshelf(0.95, 0, 0)); return g; } },
    "relogio-chao": {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(0.85, 3.5, 0.6, 0x6a4526, { pos: [0, 1.75, 0] }));
        g.add(k.box(0.95, 0.3, 0.7, 0x5a3a20, { pos: [0, 3.55, 0] }));
        const face = new k.T.Mesh(new k.T.CircleGeometry(0.3, 28), new k.T.MeshBasicMaterial({ color: 0xfff4dc })); face.position.set(0, 3.0, 0.31); g.add(face);
        g.add(k.box(0.04, 0.24, 0.02, k.INK, { pos: [0, 3.08, 0.32], outline: false })); g.add(k.box(0.18, 0.04, 0.02, k.INK, { pos: [0.07, 3.0, 0.32], outline: false }));
        g.add(k.box(0.5, 1.3, 0.04, 0x3a2a1c, { pos: [0, 1.7, 0.31], outline: false, mat: { roughness: 0.2, metalness: 0.4 } }));
        g.add(k.cyl(0.13, 0.13, 0.04, 0xd9a520, { pos: [0, 1.3, 0.33], rot: [Math.PI / 2, 0, 0], outline: false, mat: { metalness: 0.9, roughness: 0.25 } }));
        return g;
      }
    },
    piano: {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(2.7, 2.0, 0.95, 0x1e1a22, { pos: [0, 1.0, 0], mat: { roughness: 0.28, metalness: 0.1 } }));
        g.add(k.box(2.7, 0.14, 0.5, 0x1e1a22, { pos: [0, 1.05, 0.7], mat: { roughness: 0.28 } }));
        g.add(k.box(2.5, 0.12, 0.42, 0xfaf6ec, { pos: [0, 1.14, 0.72], outline: false }));
        for (let i = 0; i < 13; i++) g.add(k.box(0.09, 0.14, 0.26, k.INK, { pos: [-1.05 + i * 0.175, 1.2, 0.62], outline: false }));
        g.add(k.box(2.2, 0.5, 0.05, 0x2a262e, { pos: [0, 1.6, 0.4], outline: false }));
        g.add(k.box(1.1, 0.12, 0.55, 0x3a2a1c, { pos: [0, 0.6, 1.4], mat: { roughness: 0.4 } }));
        [[-0.45, 1.2], [0.45, 1.2], [-0.45, 1.6], [0.45, 1.6]].forEach(([x, z]) => g.add(k.box(0.07, 0.6, 0.07, 0x3a2a1c, { pos: [x, 0.3, z], outline: false })));
        return g;
      }
    },
    globo: {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        const tex = k.canvasTex(256, 128, (c, w, h) => { c.fillStyle = "#3f7fd8"; c.fillRect(0, 0, w, h); c.fillStyle = "#4aa85a"; [[40, 40, 34], [110, 60, 28], [170, 36, 30], [210, 80, 22], [70, 92, 20]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0.4, 0, 7); c.fill(); }); });
        g.add(k.cyl(0.32, 0.4, 0.1, 0x3a2a1c, { pos: [0, 0.05, 0] }));
        g.add(k.cyl(0.05, 0.05, 1.0, 0x3a2a1c, { pos: [0, 0.55, 0], outline: false }));
        const ball = new k.T.Mesh(new k.T.SphereGeometry(0.5, 28, 20), new k.T.MeshStandardMaterial({ map: tex, roughness: 0.4 })); ball.position.y = 1.45; ball.castShadow = true; ball.rotation.z = 0.4; g.add(ball);
        g.add(k.solid(new k.T.TorusGeometry(0.56, 0.03, 8, 28, Math.PI), 0xd9a520, { pos: [0, 1.45, 0], rot: [0, Math.PI / 2, 0.4], outline: false, mat: { metalness: 0.9, roughness: 0.3 } }));
        return g;
      }
    },
    cabideiro: {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.cyl(0.32, 0.36, 0.08, DARK, { pos: [0, 0.04, 0] }));
        g.add(k.cyl(0.05, 0.05, 3.0, DARK, { pos: [0, 1.5, 0], outline: false }));
        [0, 1.6, 3.2, 4.8].forEach((a) => g.add(k.cyl(0.03, 0.03, 0.4, DARK, { pos: [Math.cos(a) * 0.2, 2.9, Math.sin(a) * 0.2], rot: [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0], outline: false })));
        const coat = k.cyl(0.2, 0.32, 1.1, 0x4a5a8a, { pos: [0.24, 2.2, 0], mat: { fabric: true } }); g.add(coat);
        return g;
      }
    },
    "espelho-chao": {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(1.3, 3.1, 0.14, 0x8a6a3c, { pos: [0, 1.6, 0], rot: [-0.09, 0, 0] }));
        g.add(k.box(1.1, 2.9, 0.04, 0xcfe6f2, { pos: [0, 1.6, 0.06], rot: [-0.09, 0, 0], outline: false, mat: { roughness: 0.03, metalness: 1, envMapIntensity: 1.6 } }));
        [-0.5, 0.5].forEach((x) => g.add(k.box(0.06, 0.6, 0.06, 0x8a6a3c, { pos: [x, 0.3, -0.3], rot: [0.5, 0, 0], outline: false })));
        return g;
      }
    },
    biombo: {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        for (let i = 0; i < 3; i++) {
          const p = new k.T.Group();
          p.add(k.box(0.86, 2.6, 0.08, 0xa8794a, { pos: [0, 1.3, 0] }));
          p.add(k.box(0.7, 2.2, 0.03, i % 2 ? 0xe8c9a0 : 0xd9b98c, { pos: [0, 1.3, 0.05], outline: false }));
          p.position.set(-0.85 + i * 0.85, 0, i % 2 ? 0.22 : -0.22); p.rotation.y = i % 2 ? -0.5 : 0.5; g.add(p);
        }
        return g;
      }
    },
    gaveteiro: {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(0.95, 1.7, 0.75, 0x8c96a4, { pos: [0, 0.85, 0], mat: { metalness: 0.5, roughness: 0.4 } }));
        for (let i = 0; i < 4; i++) { g.add(k.box(0.8, 0.3, 0.04, 0xa9b3c1, { pos: [0, 0.3 + i * 0.4, 0.39], outline: false, mat: { metalness: 0.5 } })); g.add(k.box(0.3, 0.05, 0.05, 0x3a3a44, { pos: [0, 0.3 + i * 0.4, 0.43], outline: false })); }
        return g;
      }
    },
    purificador: {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.cyl(0.36, 0.4, 1.5, 0xf2f4f7, { pos: [0, 0.75, 0], seg: 28, mat: { roughness: 0.35 } }));
        g.add(k.cyl(0.3, 0.3, 0.06, 0xbfe3f5, { pos: [0, 1.52, 0], outline: false, mat: { emissive: 0x6fc3ea, emissiveIntensity: 0.6 } }));
        g.add(k.box(0.3, 0.05, 0.02, 0x3f9b4f, { pos: [0, 1.2, 0.4], outline: false, mat: { emissive: 0x3f9b4f, emissiveIntensity: 0.9 } }));
        return g;
      }
    },
    "rack-tv": { area: "consultorio", build: tvRack },
    "cafe-bar": {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(1.6, 1.15, 0.75, 0x7a5232, { pos: [0, 0.575, 0] }));
        g.add(k.box(1.7, 0.08, 0.82, 0xe8e0d0, { pos: [0, 1.19, 0], mat: { roughness: 0.3 } }));
        g.add(k.box(0.5, 0.62, 0.42, 0x2a2a32, { pos: [-0.35, 1.53, 0], mat: { metalness: 0.5, roughness: 0.3 } }));
        g.add(k.cyl(0.22, 0.2, 0.3, 0xf6efe4, { pos: [0.4, 1.38, 0.05] })); g.add(k.cyl(0.1, 0.1, 0.16, 0xd9534f, { pos: [0.7, 1.31, 0.15] }));
        return g;
      }
    },
    escultura: {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(0.7, 1.1, 0.7, 0xe9e4da, { pos: [0, 0.55, 0], mat: { roughness: 0.4 } }));
        g.add(k.sph(0.32, 0x4f7fc4, { pos: [0, 1.5, 0], mat: { roughness: 0.25, metalness: 0.4 } }));
        g.add(k.solid(new k.T.TorusGeometry(0.34, 0.07, 12, 26), 0xd9534f, { pos: [0, 1.85, 0], rot: [1.1, 0.4, 0], outline: false, mat: { roughness: 0.25, metalness: 0.5 } }));
        return g;
      }
    },
    "caixa-areia": {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(2.0, 0.4, 1.4, 0x9a6b3c, { pos: [0, 0.2, 0] }));
        g.add(k.box(1.8, 0.06, 1.2, 0xf0d9a0, { pos: [0, 0.41, 0], outline: false, mat: { roughness: 1 } }));
        [[-0.5, 0.1, 0x3f9b4f], [0.1, -0.2, 0xd9534f], [0.55, 0.25, 0x4f7fc4]].forEach(([x, z, c]) => g.add(k.cyl(0.1, 0.13, 0.32, c, { pos: [x, 0.6, z], outline: false })));
        g.add(k.sph(0.13, 0xe9c9a8, { pos: [0.1, 0.86, -0.2], outline: false }));
        return g;
      }
    },
    "casa-bonecas": {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(1.4, 1.1, 0.8, 0xf7c6d8, { pos: [0, 0.55, 0] }));
        g.add(k.box(1.22, 0.9, 0.06, 0xfff4e6, { pos: [0, 0.55, 0.38], outline: false }));
        const roof = k.solid(new k.T.ConeGeometry(1.05, 0.7, 4), 0xd9534f, { pos: [0, 1.45, 0], rot: [0, Math.PI / 4, 0] }); roof.scale.z = 0.62; g.add(roof);
        g.add(k.box(0.3, 0.5, 0.05, 0x8a5a2a, { pos: [0, 0.3, 0.41], outline: false })); g.add(k.box(0.3, 0.3, 0.05, 0xbfe3f5, { pos: [-0.4, 0.75, 0.41], outline: false })); g.add(k.box(0.3, 0.3, 0.05, 0xbfe3f5, { pos: [0.4, 0.75, 0.41], outline: false }));
        return g;
      }
    },
    "mesa-infantil": {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(1.2, 0.1, 0.9, 0xf2c230, { pos: [0, 0.6, 0] }));
        [[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]].forEach(([x, z]) => g.add(k.box(0.08, 0.55, 0.08, 0xd9a520, { pos: [x, 0.3, z], outline: false })));
        const seat = (x, yaw, c) => { const s = new k.T.Group(); s.add(k.box(0.4, 0.06, 0.4, c, { pos: [0, 0.36, 0] })); s.add(k.box(0.4, 0.4, 0.05, c, { pos: [0, 0.6, -0.18] })); [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].forEach(([a, b]) => s.add(k.box(0.05, 0.33, 0.05, DARK, { pos: [a, 0.17, b], outline: false }))); s.position.set(x, 0, 0); s.rotation.y = yaw; g.add(s); };
        seat(-0.95, Math.PI / 2, 0x4f7fc4); seat(0.95, -Math.PI / 2, 0xd9534f);
        return g;
      }
    },
    tenda: {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        const t = k.solid(new k.T.ConeGeometry(1.0, 1.9, 4), 0xe58aa8, { pos: [0, 0.95, 0], rot: [0, Math.PI / 4, 0], mat: { fabric: true } }); g.add(t);
        g.add(k.box(0.5, 0.8, 0.04, 0x3a2a4a, { pos: [0, 0.4, 0.68], outline: false }));
        g.add(k.cyl(0.02, 0.02, 0.4, 0xf2f4f7, { pos: [0, 2.0, 0], outline: false }));
        return g;
      }
    },
    "divisoria-plantas": {
      area: "consultorio", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(2.2, 0.55, 0.55, 0x8a6a4a, { pos: [0, 0.275, 0] }));
        [-0.8, -0.27, 0.27, 0.8].forEach((x, i) => { for (let j = 0; j < 4; j++) { const a = j * 1.57 + i; const leaf = k.sph(0.4, [0x3f9b4f, 0x56b35f, 0x2f8442][j % 3], { pos: [x + Math.cos(a) * 0.12, 0.95 + j * 0.13, Math.sin(a) * 0.12], outline: false }); leaf.scale.set(0.35, 1.1, 0.25); g.add(leaf); } });
        return g;
      }
    },
    // O DIVÃ. Não é um sofá baixo: é o móvel em que a pessoa deita e deixa de ver o seu rosto — a
    // cabeceira fica alta de um lado só, e o encosto corre por um lado só, porque quem deita não se
    // encosta atrás, se encosta do lado.
    diva: {
      area: "consultorio", build: (k) => {
        const cor = k.acabamento("base-diva", 0x7f9a72);
        const g = new k.T.Group();
        // o comprimento é o de uma pessoa deitada: 2,9 — com 2,15 a cabeça e os pés ficavam para fora
        g.add(k.box(2.95, 0.34, 0.96, k.shade(cor, -0.28), { pos: [0, 0.2, 0] }));                                  // a base
        g.add(k.box(2.9, 0.22, 0.92, cor, { pos: [0, 0.48, 0], mat: { fabric: true } }));                           // o estofado
        const cab = k.box(0.7, 0.28, 0.92, cor, { pos: [-1.08, 0.68, 0], mat: { fabric: true } });                  // a cabeceira, de um lado só
        cab.rotation.z = -0.24; g.add(cab);
        g.add(k.box(0.5, 0.14, 0.56, k.shade(cor, 0.22), { pos: [-1.14, 0.86, 0], mat: { fabric: true } }));        // a almofada
        g.add(k.box(2.9, 0.44, 0.13, cor, { pos: [0, 0.7, -0.46], mat: { fabric: true } }));                        // o encosto, por um lado só
        [[-1.32, 0.4], [1.32, 0.4], [-1.32, -0.4], [1.32, -0.4]].forEach(([x, z]) =>
          g.add(k.box(0.1, 0.16, 0.1, 0x5a3d26, { pos: [x, 0.08, z], outline: false })));                           // os pés
        return g;
      }
    },
    lixeira: {
      area: "consultorio", build: (k) => { const g = new k.T.Group(); g.add(k.cyl(0.24, 0.2, 0.55, 0x8c96a4, { pos: [0, 0.275, 0], mat: { metalness: 0.5 } })); g.add(k.cyl(0.25, 0.25, 0.05, 0x6a7280, { pos: [0, 0.57, 0] })); return g; }
    },

    // ---------------- casa
    "casa-pufe": { area: "casa", build: pufe(0x5aa3a0) },
    "casa-tv": { area: "casa", build: tvRack },
    "casa-comoda": { area: "casa", build: chestOfDrawers },
    "casa-sofa": { area: "casa", build: (k) => k.sofa(0, 0, 0x8790dd) },
    "casa-leitura": { area: "casa", build: (k) => { const g = new k.T.Group(); g.add(k.armchair(0, 0, 0, 0xd9a15f)); g.add(k.floorLamp(1.2, -0.4)); return g; } },
    "mesa-jantar": {
      area: "casa", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(2.2, 0.12, 1.3, 0x9a6b3c, { pos: [0, 1.0, 0], mat: { roughness: 0.5 } }));
        [[-0.95, -0.5], [0.95, -0.5], [-0.95, 0.5], [0.95, 0.5]].forEach(([x, z]) => g.add(k.box(0.12, 0.95, 0.12, 0x7a5232, { pos: [x, 0.5, z], outline: false })));
        chairAt(k, g, -0.55, -1.0, 0, 0xd9a15f); chairAt(k, g, 0.55, -1.0, 0, 0xd9a15f); chairAt(k, g, -0.55, 1.0, Math.PI, 0x4f9a6a); chairAt(k, g, 0.55, 1.0, Math.PI, 0x4f9a6a);
        g.add(k.cyl(0.22, 0.16, 0.24, 0xf6efe4, { pos: [0, 1.18, 0] }));
        return g;
      }
    },
    violao: {
      area: "casa", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(0.9, 0.06, 0.6, DARK, { pos: [0, 0.03, 0] }));
        const body = k.sph(0.34, 0xc98a4a, { pos: [0, 0.75, 0], mat: { roughness: 0.3 } }); body.scale.set(1, 1.15, 0.4); g.add(body);
        const top = k.sph(0.26, 0xc98a4a, { pos: [0, 1.15, 0], mat: { roughness: 0.3 } }); top.scale.set(1, 0.9, 0.4); g.add(top);
        g.add(k.box(0.09, 1.1, 0.06, 0x3a2a1c, { pos: [0, 1.75, 0], outline: false }));
        g.add(k.cyl(0.11, 0.11, 0.05, 0x1e1a22, { pos: [0, 0.85, 0.14], rot: [Math.PI / 2, 0, 0], outline: false }));
        g.add(k.box(0.05, 0.5, 0.05, DARK, { pos: [-0.3, 0.3, -0.15], rot: [0, 0, 0.3], outline: false })); g.add(k.box(0.05, 0.5, 0.05, DARK, { pos: [0.3, 0.3, -0.15], rot: [0, 0, -0.3], outline: false }));
        return g;
      }
    },
    bike: {
      area: "casa", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(0.5, 0.08, 1.4, 0x2a2a32, { pos: [0, 0.04, 0] }));
        g.add(k.cyl(0.4, 0.4, 0.18, 0x4a4a55, { pos: [0, 0.6, 0.4], rot: [0, 0, Math.PI / 2], outline: false }));
        g.add(k.box(0.08, 1.1, 0.08, 0xd9534f, { pos: [0, 0.95, -0.1], rot: [0.25, 0, 0] }));
        g.add(k.box(0.34, 0.1, 0.5, 0x2a2a32, { pos: [0, 1.5, -0.35] })); g.add(k.box(0.5, 0.08, 0.08, 0x2a2a32, { pos: [0, 1.6, 0.6] }));
        g.add(k.box(0.06, 0.8, 0.06, 0xd9534f, { pos: [0, 1.2, 0.5], rot: [-0.3, 0, 0], outline: false }));
        return g;
      }
    },
    "cama-pet": {
      area: "casa", build: (k) => { const g = new k.T.Group(); g.add(k.cyl(0.6, 0.55, 0.22, 0xc98a5a, { pos: [0, 0.11, 0], seg: 28, mat: { fabric: true } })); g.add(k.cyl(0.42, 0.42, 0.18, 0xf0d9b8, { pos: [0, 0.16, 0], seg: 28, outline: false, mat: { fabric: true } })); return g; }
    },
    "tapete-yoga": {
      area: "casa", build: (k) => { const g = new k.T.Group(); g.add(k.box(0.75, 0.05, 1.9, 0x7a5cc4, { pos: [0, 0.025, 0], outline: false, mat: { roughness: 0.9 } })); g.add(k.box(0.45, 0.06, 0.1, 0xe8dcff, { pos: [0, 0.03, -0.6], outline: false })); return g; }
    },
    "planta-grande": {
      area: "casa", build: (k) => {
        const g = new k.T.Group();
        g.add(k.cyl(0.42, 0.34, 0.75, 0xc9825a, { pos: [0, 0.375, 0] }));
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const leaf = k.sph(0.5, [0x3f9b4f, 0x56b35f, 0x2f8442][i % 3], { pos: [Math.sin(a) * 0.35, 1.5 + (i % 3) * 0.3, Math.cos(a) * 0.35], outline: false }); leaf.scale.set(0.3, 1.0, 0.1); leaf.rotation.set(Math.cos(a) * 0.6, a, -Math.sin(a) * 0.6); g.add(leaf); }
        return g;
      }
    },
    "casa-escrivaninha": {
      area: "casa", build: (k) => {
        const g = new k.T.Group();
        g.add(k.box(1.8, 0.1, 0.9, 0x9a6b3c, { pos: [0, 1.05, 0] }));
        [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]].forEach(([x, z]) => g.add(k.box(0.09, 1.0, 0.09, 0x7a5232, { pos: [x, 0.5, z], outline: false })));
        g.add(k.box(0.7, 0.04, 0.5, 0x8c96a4, { pos: [-0.2, 1.12, 0.05], mat: { metalness: 0.6, roughness: 0.3 } }));
        g.add(k.box(0.7, 0.45, 0.04, 0x2a6aa8, { pos: [-0.2, 1.4, -0.2], rot: [-0.25, 0, 0], mat: { emissive: 0x1a4a88, emissiveIntensity: 0.5 } }));
        chairAt(k, g, 0, 0.8, Math.PI, 0x4f7fc4);
        return g;
      }
    }
  };
  window.Scene3D.registerItems(ITEMS);
})();

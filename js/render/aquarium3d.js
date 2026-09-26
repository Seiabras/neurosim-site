"use strict";

// ===========================================================================
// Aquário em 3D: um modelo para cada espécie (montado a partir da forma e das cores em AQ_DATA) e o tanque do consultório
// (armário, vidro com reflexo, água, areia, decoração, luz, bolhas) com os bichos realmente nadando ou andando no fundo.
// Usa as peças de scene3d.js (Scene3D.kit). Tudo aponta para +x (o nariz); o tanque escala pelo tamanho da espécie.
// ===========================================================================
window.AQ3D = (function () {
  const live = [];   // { g, fn, seen } dos tanques ativos (scene3d chama AQ3D.tick a cada quadro; tanques desmontados saem da lista)
  const hexN = (c) => parseInt(String(c).replace("#", ""), 16);

  function model(k, spec) {
    const { T, sph, cyl, solid, box } = k;
    const [c1, c2, c3] = spec.cols.map(hexN), g = new T.Group();
    const eye = (x, y, z, r = 0.09) => { g.add(sph(r, 0xffffff, { pos: [x, y, z], outline: false })); g.add(sph(r * 0.55, 0x15131f, { pos: [x + r * 0.35, y, z + Math.sign(z || 1) * r * 0.5], outline: false })); };
    const tail = (x, c, s = 1) => g.add(solid(new T.ConeGeometry(0.3 * s, 0.6 * s, 4), c, { pos: [x, 0, 0], rot: [0, 0, Math.PI / 2], outline: false }));
    const body = (sx, sy, sz, c) => { const b = sph(0.6, c, { outline: false, mat: { roughness: 0.32, metalness: 0.15 } }); b.scale.set(sx, sy, sz); g.add(b); return b; };
    const fin = (x, y, z, c, s = 1) => g.add(solid(new T.ConeGeometry(0.2 * s, 0.5 * s, 4), c, { pos: [x, y, z], outline: false }));
    const dots = (color, n, sx, sy, sz, r = 0.05) => { for (let i = 0; i < n; i++) { const a = i * 2.4, y = Math.cos(a * 1.3) * sy, x = Math.sin(a * 0.9) * sx; g.add(sph(r, color, { pos: [x, y, sz * Math.sqrt(Math.max(0.05, 1 - (x * x) / (sx * sx + 0.01) - (y * y) / (sy * sy + 0.01)))], outline: false })); } };
    const sh = spec.shape;
    if (sh === "fish" || sh === "tall" || sh === "sunfish" || sh === "angler" || sh === "round") {
      const dims = { fish: [1.35, 0.85, 0.55], tall: [0.95, 1.35, 0.32], sunfish: [1, 1.25, 0.35], angler: [1.1, 0.95, 0.8], round: [1, 0.95, 0.95] }[sh];
      body(dims[0], dims[1], dims[2], c1);
      if (spec.stripe) [-0.25, 0.3].forEach((x) => { const s = sph(0.62, hexN(spec.stripe), { pos: [x, 0, 0], outline: false }); s.scale.set(0.12, dims[1] * 1.05, dims[2] * 1.08); g.add(s); });
      if (spec.spots) dots(hexN(spec.spots), 14, 0.7, 0.4, 0.5);
      tail(-0.6 * dims[0] - 0.25, c3, sh === "sunfish" ? 0.6 : 1);
      fin(0, 0.6 * dims[1] + 0.05, 0, c3, sh === "tall" ? 1.4 : 1);
      if (sh === "tall") fin(0, -0.6 * dims[1] - 0.05, 0, c3, 1.1).rotation.z = Math.PI;
      if (sh === "round") for (let i = 0; i < 20; i++) { const a = i * 2.4, y = Math.cos(i * 0.9) * 0.6, r = Math.sqrt(Math.max(0.02, 0.36 - y * y)); g.add(solid(new T.ConeGeometry(0.05, 0.22, 4), c2, { pos: [Math.cos(a) * r, y, Math.sin(a) * r], outline: false })); }
      if (sh === "angler") { g.add(cyl(0.02, 0.02, 0.6, c1, { pos: [0.6, 0.75, 0], rot: [0, 0, -0.7], outline: false })); g.add(sph(0.09, c2, { pos: [0.85, 1.0, 0], outline: false, mat: { emissive: c2, emissiveIntensity: 1.2 } })); }
      if (spec.id === "leao") { for (let i = 0; i < 11; i++) { const a = -0.9 + i * 0.18; g.add(solid(new T.ConeGeometry(0.035, 0.85, 4), i % 2 ? c2 : c1, { pos: [Math.sin(a) * 0.55, 0.55 + Math.cos(a) * 0.35, 0], rot: [0, 0, -a], outline: false })); } [-1, 1].forEach((sd) => { for (let i = 0; i < 6; i++) g.add(solid(new T.ConeGeometry(0.03, 0.7, 4), c2, { pos: [0.1 - i * 0.12, -0.05 + i * 0.03, sd * 0.4], rot: [sd * 1.1, 0, 0.25 - i * 0.12], outline: false })); }); }   // peixe-leão: leque de espinhos
      if (spec.id === "coelho-mar") { [-1, 1].forEach((sd) => g.add(cyl(0.05, 0.03, 0.55, c3, { pos: [0.4, 0.75, sd * 0.13], rot: [sd * 0.2, 0, -0.3], outline: false }))); for (let i = 0; i < 6; i++) g.add(sph(0.07, c2, { pos: [-0.5 + i * 0.16, 0.5, ((i % 2) - 0.5) * 0.3], outline: false })); }   // lesma-do-mar: antenas e franjas
      if (spec.glow) g.add(sph(0.05, c2, { pos: [0.2, -0.35, 0.3], outline: false, mat: { emissive: c2, emissiveIntensity: 1.4 } }));
      eye(0.55 * dims[0], 0.14 * dims[1], 0.3 * dims[2] + 0.1); eye(0.55 * dims[0], 0.14 * dims[1], -0.3 * dims[2] - 0.1);
    } else if (sh === "shark") {
      body(2, 0.72, 0.72, c1); const belly = sph(0.55, c2, { pos: [0.05, -0.15, 0], outline: false }); belly.scale.set(1.9, 0.5, 0.7); g.add(belly);
      if (spec.spots) dots(hexN(spec.spots), 22, 1.1, 0.35, 0.6, 0.04);
      fin(0, 0.72, 0, c1, 1.3); tail(-1.5, c1, 1.4); [-1, 1].forEach((s) => g.add(solid(new T.ConeGeometry(0.2, 0.6, 3), c1, { pos: [0.3, -0.35, s * 0.6], rot: [s * 0.9, 0, 0.5], outline: false }))); eye(1, 0.15, 0.36, 0.07); eye(1, 0.15, -0.36, 0.07);
    } else if (sh === "long") {
      for (let i = 0; i < 9; i++) { const s = sph(0.34 - i * 0.018, i % 3 ? c1 : c2, { pos: [0.7 - i * 0.28, Math.sin(i * 0.9) * 0.1, 0], outline: false, mat: { roughness: 0.4 } }); g.add(s); }
      g.add(sph(0.06, 0x15131f, { pos: [0.95, 0.12, 0.2], outline: false })); g.add(sph(0.06, 0x15131f, { pos: [0.95, 0.12, -0.2], outline: false }));
    } else if (sh === "flat") {
      const b = sph(0.7, c1, { outline: false, mat: { roughness: 0.4 } }); b.scale.set(1.6, 0.14, 1.9); g.add(b);
      [-1, 1].forEach((s) => { const w = sph(0.7, c1, { pos: [0, 0, s * 0.95], outline: false }); w.scale.set(1.2, 0.1, 0.9); g.add(w); });
      if (spec.spots) dots(hexN(spec.spots), 16, 0.8, 0.05, 0.7, 0.05);
      g.add(cyl(0.03, 0.05, 1.5, c3, { pos: [-1.5, 0, 0], rot: [0, 0, Math.PI / 2], outline: false })); eye(0.85, 0.1, 0.25, 0.06); eye(0.85, 0.1, -0.25, 0.06);
    } else if (sh === "jelly") {
      const dome = sph(0.6, c1, { outline: false, mat: { transparent: true, opacity: 0.6, roughness: 0.15, emissive: spec.glow ? c1 : 0x000000, emissiveIntensity: spec.glow ? 0.5 : 0 } }); dome.scale.set(1, 0.7, 1); dome.position.y = 0.3; g.add(dome);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(cyl(0.03, 0.015, 0.9, c2, { pos: [Math.cos(a) * 0.35, -0.3, Math.sin(a) * 0.35], outline: false, mat: { transparent: true, opacity: 0.7 } })); }
      if (spec.glow) for (let i = 0; i < 4; i++) g.add(sph(0.1, c2, { pos: [Math.cos(i * 1.57) * 0.18, 0.3, Math.sin(i * 1.57) * 0.18], outline: false, mat: { emissive: c2, emissiveIntensity: 1 } }));
    } else if (sh === "turtle") {
      const shell = sph(0.7, c1, { pos: [0, 0.05, 0], outline: false, mat: { roughness: 0.4 } }); shell.scale.set(1.2, 0.6, 1); g.add(shell);
      for (let i = 0; i < 6; i++) g.add(sph(0.14, c2, { pos: [Math.cos(i * 1.05) * 0.4, 0.3, Math.sin(i * 1.05) * 0.4], outline: false }));
      g.add(sph(0.26, 0x8ac48a, { pos: [0.95, 0.05, 0], outline: false })); eye(1.1, 0.15, 0.13, 0.05); eye(1.1, 0.15, -0.13, 0.05);
      [[0.5, 0.75], [0.5, -0.75], [-0.5, 0.75], [-0.5, -0.75]].forEach(([x, z]) => { const f = sph(0.22, 0x8ac48a, { pos: [x, -0.1, z], outline: false }); f.scale.set(1.4, 0.35, 0.6); g.add(f); });
    } else if (sh === "octo" || sh === "squid") {
      const head = sph(0.55, c1, { pos: [0, 0.35, 0], outline: false, mat: { roughness: 0.35 } }); if (sh === "squid") { head.scale.set(1, 1.5, 1); head.position.set(0.3, 0, 0); head.rotation.z = -Math.PI / 2; }
      g.add(head);
      const n = sh === "octo" ? 8 : 10;
      for (let i = 0; i < n; i++) { const a = (i * Math.PI * 2) / n; g.add(cyl(0.08, 0.025, sh === "octo" ? 1 : 1.2, c1, sh === "octo" ? { pos: [Math.cos(a) * 0.4, -0.45, Math.sin(a) * 0.4], rot: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], outline: false } : { pos: [-0.75, Math.sin(a) * 0.22, Math.cos(a) * 0.22], rot: [0, 0, Math.PI / 2], outline: false })); }
      if (sh === "squid") [-1, 1].forEach((s) => g.add(box(0.5, 0.05, 0.35, c3, { pos: [0.85, 0, s * 0.32], outline: false })));
      sh === "octo" ? (eye(0.3, 0.45, 0.5), eye(-0.3, 0.45, 0.5)) : (eye(-0.1, 0.2, 0.32), eye(-0.1, 0.2, -0.32));
    } else if (sh === "crab" || sh === "lobster") {
      const b = sph(0.6, c1, { outline: false, mat: { roughness: 0.35 } }); b.scale.set(sh === "lobster" ? 1.7 : 1.2, 0.5, sh === "lobster" ? 0.6 : 1); g.add(b);
      if (spec.shell) g.add(sph(0.5, c2, { pos: [-0.45, 0.4, 0], outline: false }));
      [-1, 1].forEach((s) => { g.add(sph(0.24, c1, { pos: [0.95, 0.1, s * 0.6], outline: false })); for (let i = 0; i < 3; i++) g.add(cyl(0.04, 0.03, 0.6, c1, { pos: [0.3 - i * 0.35, -0.2, s * 0.6], rot: [s * 0.9, 0, 0], outline: false })); });
      if (sh === "lobster") for (let i = 0; i < 3; i++) g.add(cyl(0.03, 0.01, 1.1, c1, { pos: [1.1, 0.2, (i - 1) * 0.15], rot: [0, 0, -1.2], outline: false }));
      eye(0.55, 0.35, 0.2, 0.07); eye(0.55, 0.35, -0.2, 0.07);
    } else if (sh === "shrimp") {
      for (let i = 0; i < 6; i++) { const s = sph(0.25 - i * 0.02, i % 2 ? c1 : c2, { pos: [0.4 - i * 0.22, Math.sin(i * 0.8) * 0.12, 0], outline: false }); s.scale.set(1, 0.9, 0.9); g.add(s); }
      for (let i = 0; i < 2; i++) g.add(cyl(0.015, 0.008, 0.9, c1, { pos: [0.75, 0.12, (i - 0.5) * 0.2], rot: [0, 0, -1.3], outline: false })); eye(0.55, 0.15, 0.13, 0.05); eye(0.55, 0.15, -0.13, 0.05);
    } else if (sh === "star") {
      g.add(sph(0.3, c1, { outline: false }));
      for (let i = 0; i < 5; i++) { const arm = new T.Group(); arm.rotation.y = (i * Math.PI * 2) / 5; arm.add(solid(new T.ConeGeometry(0.22, 0.95, 5), c1, { pos: [0.5, 0, 0], rot: [0, 0, -Math.PI / 2], outline: false })); [0.3, 0.5, 0.7].forEach((x) => arm.add(sph(0.05, c2, { pos: [x, 0.13, 0], outline: false }))); g.add(arm); }
    } else if (sh === "urchin") {
      g.add(sph(0.4, c1, { outline: false })); for (let i = 0; i < 40; i++) { const a = i * 2.4, y = Math.cos(i * 0.6) * 0.9, r = Math.sqrt(Math.max(0.01, 1 - y * y)); g.add(solid(new T.ConeGeometry(0.03, 0.5, 4), c2, { pos: [Math.cos(a) * r * 0.5, y * 0.5, Math.sin(a) * r * 0.5], rot: [Math.sin(a) * y, 0, -Math.cos(a) * y], outline: false })); }
    } else if (sh === "sponge") {
      g.add(cyl(0.5, 0.6, 1.1, c1, { outline: false, mat: { roughness: 0.9 } })); for (let i = 0; i < 9; i++) g.add(sph(0.09, c2, { pos: [Math.cos(i * 2.2) * 0.5, -0.4 + (i % 4) * 0.28, Math.sin(i * 2.2) * 0.5], outline: false })); g.add(cyl(0.3, 0.34, 0.25, c2, { pos: [0, 0.6, 0], outline: false }));
    } else if (sh === "seahorse") {
      for (let i = 0; i < 8; i++) g.add(sph(0.22 - i * 0.012, i % 2 ? c1 : c2, { pos: [Math.sin(i * 0.5) * 0.15, 0.6 - i * 0.2, 0], outline: false }));
      g.add(sph(0.26, c1, { pos: [0.1, 0.8, 0], outline: false })); g.add(cyl(0.05, 0.05, 0.4, c1, { pos: [0.4, 0.78, 0], rot: [0, 0, -1.5], outline: false })); eye(0.15, 0.88, 0.2, 0.05); eye(0.15, 0.88, -0.2, 0.05);
      for (let i = 0; i < 5; i++) g.add(sph(0.16 - i * 0.02, c1, { pos: [-0.3 - Math.sin(i * 0.8) * 0.1, -0.8 - i * 0.02, 0.15 * Math.cos(i)], outline: false }));
    } else if (sh === "nautilus") {
      const shell = sph(0.6, c1, { pos: [-0.1, 0.1, 0], outline: false, mat: { roughness: 0.35 } }); shell.scale.set(1, 1, 0.55); g.add(shell);
      for (let i = 0; i < 5; i++) g.add(box(0.05, 0.9 - i * 0.12, 0.62, c2, { pos: [-0.5 + i * 0.25, 0.1, 0], rot: [0, 0, 0.3 * i], outline: false }));
      for (let i = 0; i < 9; i++) g.add(cyl(0.025, 0.012, 0.6, 0xf2a888, { pos: [0.55, -0.15 + (i % 3) * 0.1, (i - 4) * 0.07], rot: [0, 0, -1.4], outline: false })); eye(0.45, 0.2, 0.3, 0.07); eye(0.45, 0.2, -0.3, 0.07);
    } else if (sh === "dragon") {
      for (let i = 0; i < 10; i++) { const y = Math.sin(i * 0.7) * 0.18; g.add(sph(0.16 - i * 0.009, c1, { pos: [0.7 - i * 0.2, y, 0], outline: false })); [-1, 1].forEach((s) => { const lf = sph(0.13, c2, { pos: [0.7 - i * 0.2, y + 0.22 + (i % 2) * 0.05, s * 0.05], outline: false }); lf.scale.set(0.5, 1.5, 0.25); g.add(lf); }); }
      g.add(sph(0.2, c1, { pos: [0.95, 0.05, 0], outline: false })); g.add(cyl(0.05, 0.04, 0.5, c1, { pos: [1.2, 0.02, 0], rot: [0, 0, -1.5], outline: false })); eye(0.98, 0.12, 0.15, 0.04); eye(0.98, 0.12, -0.15, 0.04);
    } else g.add(sph(0.5, 0x9fd8ff, { outline: false }));
    return g;
  }

  const CRAWLERS = new Set(["crab", "lobster", "star", "urchin", "sponge", "shrimp"]);
  // fundo do tanque: enfeites conforme o que o jogador comprou e ligou
  function decorPiece(k, id, c) {
    const { T, sph, cyl, box, solid } = k, g = new T.Group();
    if (id === "alga") for (let i = 0; i < 5; i++) { const s = solid(new T.ConeGeometry(0.07, 0.9 + (i % 3) * 0.25, 4), 0x3fa85a, { pos: [(i - 2) * 0.09, 0.5 + (i % 3) * 0.12, (i % 2) * 0.06], outline: false, mat: { roughness: 0.6 } }); s.userData.sway = i; g.add(s); }
    else if (id === "coral") for (let i = 0; i < 7; i++) { g.add(solid(new T.ConeGeometry(0.09, 0.5 + (i % 3) * 0.2, 5), [0xf2708a, 0xff9a4a, 0xc86af0][i % 3], { pos: [(i - 3) * 0.1, 0.3 + (i % 3) * 0.1, ((i * 7) % 3) * 0.05], rot: [0, 0, (i - 3) * 0.12], outline: false })); }
    else if (id === "pedras") { [[0, 0.2, 0.3], [0.3, 0.14, 0.2], [-0.28, 0.12, 0.17]].forEach(([x, y, r]) => { const s = sph(r, 0x8a8f98, { pos: [x, y, 0], outline: false, mat: { roughness: 0.85 } }); s.scale.y = 0.75; g.add(s); }); }
    else if (id === "castelo") { g.add(box(0.6, 0.45, 0.4, 0xc9a878, { pos: [0, 0.22, 0], outline: false })); [-0.28, 0.28].forEach((x) => { g.add(cyl(0.11, 0.11, 0.75, 0xd9b888, { pos: [x, 0.38, 0], outline: false })); g.add(solid(new T.ConeGeometry(0.15, 0.25, 8), 0xc8452a, { pos: [x, 0.86, 0], outline: false })); }); g.add(box(0.2, 0.28, 0.05, 0x4a3a2a, { pos: [0, 0.16, 0.21], outline: false })); }
    else if (id === "bau") { g.add(box(0.5, 0.28, 0.32, 0xa8793a, { pos: [0, 0.14, 0], outline: false })); const lid = cyl(0.16, 0.16, 0.5, 0xa8793a, { pos: [0, 0.3, 0], rot: [0, 0, Math.PI / 2], outline: false }); g.add(lid); g.add(sph(0.05, 0xffd84a, { pos: [0, 0.3, 0.17], outline: false, mat: { emissive: 0xffc000, emissiveIntensity: 0.6 } })); for (let i = 0; i < 5; i++) g.add(sph(0.045, 0xffd84a, { pos: [(i - 2) * 0.09, 0.34, 0.2], outline: false, mat: { metalness: 0.9, roughness: 0.25 } })); }
    else if (id === "tronco") { g.add(cyl(0.11, 0.13, 0.9, 0x7a5a3a, { pos: [0, 0.14, 0], rot: [0, 0, Math.PI / 2 - 0.15], outline: false, mat: { roughness: 0.9 } })); g.add(cyl(0.05, 0.06, 0.4, 0x7a5a3a, { pos: [0.15, 0.36, 0], rot: [0, 0, 0.7], outline: false })); }
    else if (id === "anemona") for (let j = 0; j < 2; j++) { g.add(sph(0.14, 0xb25aa0, { pos: [j * 0.32 - 0.16, 0.06, 0], outline: false })); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const t = cyl(0.014, 0.008, 0.3, 0xf28ad4, { pos: [j * 0.32 - 0.16 + Math.cos(a) * 0.1, 0.22, Math.sin(a) * 0.1], rot: [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], outline: false }); t.userData.sway = i + j; g.add(t); } }
    else if (id === "navio") { g.add(box(0.85, 0.2, 0.32, 0x6a4a2a, { pos: [0, 0.18, 0], rot: [0, 0, -0.22], outline: false })); [-0.2, 0.15].forEach((x, i) => { g.add(cyl(0.02, 0.02, 0.7 - i * 0.15, 0x3a2a1a, { pos: [x, 0.55, 0], rot: [0, 0, -0.22], outline: false })); g.add(box(0.28, 0.32, 0.02, 0xe8dcc0, { pos: [x + 0.05, 0.6 + i * 0.05, 0], rot: [0, 0, -0.22], outline: false })); }); }
    void c; return g;
  }

  // o tanque: retorna um Group já com a animação registrada; d = { level, w, cap, species:[spec…], decor:[ids], gear:{luz,filtro,bolhas…}, health }
  function tank(k, d) {
    const { T, box, cyl, sph } = k, g = new T.Group();
    const W = d.w || 1.8, H = 1.05, D = 0.72, y0 = 1.02;
    g.add(box(W + 0.2, 1.0, 0.9, 0x6a4526, { pos: [0, 0.5, 0] }));                                  // armário
    g.add(box(W + 0.06, 0.06, 0.78, 0x2f2b3a, { pos: [0, 1.03, 0], outline: false }));              // base preta
    const sand = box(W - 0.04, 0.12, D - 0.06, d.gear && d.gear.sandColor || 0xe9d9a8, { pos: [0, y0 + 0.08, 0], outline: false, mat: { roughness: 1 } }); g.add(sand);
    const dirty = Math.max(0, Math.min(1, (60 - (d.health || 60)) / 60));
    const water = new T.Mesh(new T.BoxGeometry(W - 0.06, H - 0.08, D - 0.08), new T.MeshStandardMaterial({ color: new T.Color(0x5fc0ee).lerp(new T.Color(0x6a8a3a), dirty * 0.7), transparent: true, opacity: 0.32 + dirty * 0.18, roughness: 0.08, metalness: 0, envMapIntensity: 0.9, depthWrite: false }));
    water.position.y = y0 + H / 2 + 0.02; g.add(water);
    const glass = new T.Mesh(new T.BoxGeometry(W, H, D), new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0, envMapIntensity: 1.6, side: T.DoubleSide, depthWrite: false }));
    glass.position.y = y0 + H / 2; g.add(glass);
    [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]].forEach(([x, z]) => g.add(box(0.05, H + 0.06, 0.05, 0x15131f, { pos: [x, y0 + H / 2, z], outline: false })));
    g.add(box(W + 0.06, 0.1, D + 0.06, 0x2f2b3a, { pos: [0, y0 + H + 0.05, 0], ol: 0.02 }));        // tampa
    if (d.gear && d.gear.luz) { const led = box(W - 0.2, 0.03, 0.25, 0xbfe6ff, { pos: [0, y0 + H - 0.02, 0.1], outline: false, mat: { emissive: 0xbfe6ff, emissiveIntensity: 1.6 } }); g.add(led); const pl = new T.PointLight(0xbfe6ff, 0.7, 4.5); pl.position.set(0, y0 + H, 0.1); g.add(pl); }
    // decoração distribuída ao longo do fundo
    const swayers = [], decor = (d.decor || []).slice(0, 8), span = W - 0.5;
    decor.forEach((id, i) => { const p = decorPiece(k, id); p.position.set(-span / 2 + (i + 0.5) * (span / Math.max(1, decor.length)) , y0 + 0.13, -0.12 + ((i % 2) ? 0.1 : -0.02)); p.traverse((o) => { if (o.userData.sway !== undefined) swayers.push(o); }); g.add(p); });
    // bichos
    const swim = [], crawl = [];
    let used = 0;
    (d.species || []).forEach((spec, i) => {
      if (used + spec.size > (d.cap || 6)) return; used += spec.size;
      const m = model(k, spec), s = 0.16 + spec.size * 0.055; m.scale.setScalar(s * (spec.shape === "tubarao" ? 1 : 1));
      const o = { g: m, ph: i * 1.7, spec, s, sp: 0.35 + ((i * 37) % 10) / 22, ry: 0.2 + ((i * 13) % 6) / 12, rx: Math.max(0.3, (W - 0.7) / 2 * (0.5 + ((i * 29) % 5) / 10)), yc: 0.35 + ((i * 17) % 6) / 10, kind: CRAWLERS.has(spec.shape) ? "crawl" : spec.shape === "jelly" ? "jelly" : spec.shape === "seahorse" || spec.shape === "dragon" ? "hover" : "swim" };
      m.position.set(0, y0 + 0.5, 0); g.add(m); (o.kind === "crawl" ? crawl : swim).push(o);
    });
    // bolhas
    const bubbles = []; const nb = d.gear && d.gear.bolhas ? 12 : 4;
    for (let i = 0; i < nb; i++) { const b = sph(0.03 + (i % 3) * 0.012, 0xe8f6ff, { outline: false, mat: { transparent: true, opacity: 0.55, roughness: 0.05 } }); g.add(b); bubbles.push({ b, x: (i % 2 ? 0.3 : -0.35) * (W / 1.8) + ((i * 0.13) % 0.2), ph: i * 0.9 }); }
    const fn = (t) => {
      swayers.forEach((o) => { o.rotation.z = Math.sin(t * 1.2 + o.userData.sway) * 0.16; });
      swim.forEach((o) => {
        const a = t * o.sp + o.ph, x = Math.cos(a) * o.rx, z = Math.sin(a * 1.3) * 0.16, y = y0 + 0.28 + o.yc * 0.55 + Math.sin(a * 1.9) * 0.1 * (o.kind === "hover" ? 0.4 : 1);
        o.g.position.set(x, o.kind === "jelly" ? y0 + 0.4 + (0.5 + 0.5 * Math.sin(t * 0.8 + o.ph)) * 0.45 : y, z);
        if (o.kind === "hover") { o.g.rotation.set(0, 0, 0); o.g.rotation.y = Math.sin(a) > 0 ? Math.PI : 0; }
        else if (o.kind === "jelly") { o.g.scale.set(o.s * (1 + Math.sin(t * 3 + o.ph) * 0.06), o.s * (1 - Math.sin(t * 3 + o.ph) * 0.08), o.s * (1 + Math.sin(t * 3 + o.ph) * 0.06)); }
        else { o.g.rotation.y = Math.sin(a) > 0 ? Math.PI : 0; o.g.rotation.z = Math.sin(a * 3) * 0.08; }
      });
      crawl.forEach((o) => { const a = t * o.sp * 0.4 + o.ph; o.g.position.set(Math.sin(a) * (W / 2 - 0.4), y0 + 0.16 + o.s * 0.25, 0.05 + Math.cos(a * 2) * 0.12); o.g.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI; });
      bubbles.forEach((q) => { const u = ((t * 0.35 + q.ph) % 1); q.b.position.set(q.x + Math.sin(t * 2 + q.ph) * 0.03, y0 + 0.2 + u * (H - 0.35), (q.ph % 2) * 0.05 - 0.05); q.b.scale.setScalar(0.6 + u * 0.7); });
    };
    live.push({ g, fn, seen: false }); fn(0);
    g.userData.aq = true; g.userData.fish = true;
    return g;
  }

  const attached = (g) => { let o = g; while (o.parent) o = o.parent; return o.type === "Scene"; };
  return { model, tank, live, active: () => live.some((e) => attached(e.g)), tick(t) {
    for (let i = live.length - 1; i >= 0; i--) { const e = live[i], on = attached(e.g); if (on) e.seen = true; else if (e.seen) { live.splice(i, 1); continue; } if (on) e.fn(t); }
  } };
})();

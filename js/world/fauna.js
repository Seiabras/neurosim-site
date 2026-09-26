"use strict";

// ===========================================================================
// Bichinhos da cidade: pássaros, insetos, caranguejos, gatos, peixes… Só enfeite vivo (não interagem no jogo),
// mas com regras: bichos de chão só andam onde dá para andar (fora de prédios e da água), bichos do mar só na água,
// e todos se assustam quando você chega perto. Cada espécie é desenhada em vetor, sem emoji.
// ===========================================================================
const Fauna = (() => {
  const ink = "#15131f";
  let list = [], locId = null, env = null, seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // onde cada espécie pode estar, por lugar: sand/sidewalk/walk (chão), sea (água), sky (qualquer ponto)
  const ZONES = {
    praia: { sand: (x, y) => y > 340 && y < 760, sea: (x, y) => y > 20 && y < 270 && !(x > 1400 && x < 1600) },
    mar: { sea: () => true },
    navio: { deck: () => true },
    holandes: { deck: () => true },
    fenda: { sea: () => true },
    rua: { sidewalk: (x, y) => (y > 350 && y < 465) || (y > 775 && y < 880), walk: (x, y) => (y > 350 && y < 465) || (y > 775 && y < 880) },
    praca: { walk: () => true, sidewalk: () => true, pond: (x, y) => nearPond(x, y) },
    bairro: { walk: () => true, sidewalk: () => true },
    parque: { walk: () => true, sidewalk: () => true, pond: (x, y) => x > 640 && x < 1260 && y > 190 && y < 510 },
    observatorio: { walk: () => true, sidewalk: () => true }
  };
  ["rua-lojas", "rua-campus", "rua-lazer"].forEach((id) => { ZONES[id] = ZONES.rua; });   // as outras ruas têm as mesmas calçadas da Rua Central
  const INDOOR = {};   // dentro de prédios só existem os bichinhos de estimação do jogador (nunca bichos selvagens)
  const CROWD = {   // espécie, quantidade
    praia: [["crab", 9], ["gull", 4], ["sandpiper", 3], ["seastar", 3], ["fish", 6], ["jumper", 2]],
    mar: [["gull", 5], ["fish", 10], ["jumper", 3], ["turtle", 2], ["whale", 1]],
    navio: [["parrot", 2], ["gull", 2]],
    holandes: [["bat", 6]],
    fenda: [["fish", 14], ["jelly", 6], ["seahorse", 3], ["turtle", 2], ["bubbler", 0]],
    rua: [["pigeon", 6], ["sparrow", 4], ["cat", 2], ["dog", 1], ["butterfly", 3]],
    praca: [["pigeon", 5], ["sparrow", 5], ["squirrel", 3], ["butterfly", 6], ["bee", 6], ["cat", 2], ["dog", 2], ["duck", 3]],
    parque: [["pigeon", 4], ["sparrow", 5], ["squirrel", 3], ["butterfly", 6], ["bee", 5], ["duck", 4], ["dog", 2]],
    observatorio: [["bat", 4]],
    bairro: [["sparrow", 5], ["cat", 3], ["dog", 3], ["butterfly", 5], ["bee", 4], ["pigeon", 3]]
  };
  ["rua-lojas", "rua-campus", "rua-lazer"].forEach((id) => { CROWD[id] = CROWD.rua; });
  const SP = {
    crab: { zone: "sand", mode: "walk", speed: 34, r: 12, flee: 110 },
    sandpiper: { zone: "sand", mode: "walk", speed: 60, r: 10, flee: 130, fly: true },
    seastar: { zone: "sand", mode: "still", r: 12 },
    gull: { mode: "fly", speed: 66, r: 16, alt: [70, 150], flee: 0 },
    pigeon: { zone: "walk", mode: "walk", speed: 42, r: 10, flee: 100, fly: true },
    sparrow: { zone: "walk", mode: "walk", speed: 50, r: 8, flee: 100, fly: true },
    cat: { zone: "walk", mode: "walk", speed: 40, r: 14, flee: 70 },
    dog: { zone: "walk", mode: "walk", speed: 55, r: 16, flee: 0 },
    squirrel: { zone: "walk", mode: "walk", speed: 70, r: 10, flee: 120 },
    duck: { zone: "pond", mode: "walk", speed: 28, r: 12, flee: 80 },
    butterfly: { mode: "fly", speed: 36, r: 8, alt: [24, 70], flee: 0, flutter: true, flowers: true },
    bee: { mode: "fly", speed: 60, r: 6, alt: [16, 44], flee: 0, flutter: true, flowers: true },
    bat: { mode: "fly", speed: 80, r: 12, alt: [50, 140], flee: 0, flutter: true, night: true },
    parrot: { zone: "deck", mode: "perch", r: 12 },
    fish: { zone: "sea", mode: "swim", speed: 44, r: 10, flee: 90 },
    jumper: { zone: "sea", mode: "jump", speed: 0, r: 16 },
    turtle: { zone: "sea", mode: "swim", speed: 16, r: 18, flee: 0 },
    whale: { zone: "sea", mode: "swim", speed: 12, r: 46, flee: 0 },
    jelly: { zone: "sea", mode: "swim", speed: 12, r: 14, flee: 0, bob: true },
    seahorse: { zone: "sea", mode: "swim", speed: 14, r: 12, flee: 0, bob: true }
  };


  // guia da fauna: nome, onde vive e uma curiosidade de cada bichinho (pt/en/es)
  const INFO = {
    crab: [L("Caranguejo", "Crab", "Cangrejo"), L("Anda de lado pela areia e foge para longe quando você chega perto. Os olhos ficam em cima de hastes.", "Walks sideways on the sand and scuttles away when you get close. Its eyes sit on stalks.", "Camina de lado por la arena y huye cuando te acercas. Sus ojos están sobre tallos.")],
    sandpiper: [L("Maçarico", "Sandpiper", "Correlimos"), L("Corre rente à beira do mar procurando comida na areia molhada e levanta voo se você se aproxima.", "Runs along the shoreline looking for food in the wet sand and takes off if you approach.", "Corre por la orilla buscando comida en la arena mojada y alza vuelo si te acercas.")],
    seastar: [L("Estrela-do-mar da praia", "Beach starfish", "Estrella de mar de la playa"), L("Fica paradinha na areia. Ela regenera um braço perdido, e cada braço tem um olhinho na ponta.", "Sits still on the sand. It can regrow a lost arm, and each arm has a tiny eye at the tip.", "Se queda quieta en la arena. Puede regenerar un brazo perdido y cada brazo tiene un ojito en la punta.")],
    gull: [L("Gaivota", "Gull", "Gaviota"), L("Plana sobre o mar e a praia com o vento. Sabe beber água salgada: tem glândulas que expulsam o sal.", "Glides over sea and beach on the wind. It can drink salt water: special glands get rid of the salt.", "Planea sobre el mar y la playa con el viento. Puede beber agua salada: tiene glándulas que expulsan la sal.")],
    pigeon: [L("Pombo", "Pigeon", "Paloma"), L("Vive na cidade e sempre acha o caminho de casa. Balança a cabeça ao andar para enxergar melhor.", "Lives in the city and always finds its way home. It bobs its head as it walks to see better.", "Vive en la ciudad y siempre encuentra el camino a casa. Cabecea al caminar para ver mejor.")],
    sparrow: [L("Pardal", "Sparrow", "Gorrión"), L("Pequenino e barulhento, pula pelo chão catando migalhas e sai voando em bando ao menor susto.", "Tiny and noisy, it hops around picking up crumbs and flies off in a flock at the slightest scare.", "Pequeñito y ruidoso, salta por el suelo recogiendo migas y sale volando en bandada ante el menor susto.")],
    cat: [L("Gato de rua", "Street cat", "Gato callejero"), L("Curioso e independente, passeia pelas calçadas e pelos cafés. Ronrona quando está calmo.", "Curious and independent, it strolls the sidewalks and cafés. It purrs when calm.", "Curioso e independiente, pasea por las aceras y los cafés. Ronronea cuando está tranquilo.")],
    dog: [L("Cachorro", "Dog", "Perro"), L("Simpático e brincalhão, não tem medo de você. Abana o rabo quando está feliz.", "Friendly and playful, it isn't afraid of you. It wags its tail when happy.", "Simpático y juguetón, no te tiene miedo. Mueve la cola cuando está feliz.")],
    squirrel: [L("Esquilo", "Squirrel", "Ardilla"), L("Guarda sementes para o inverno e às vezes esquece onde enterrou, o que ajuda a plantar árvores novas.", "Stores seeds for winter and sometimes forgets where it buried them, which helps plant new trees.", "Guarda semillas para el invierno y a veces olvida dónde las enterró, lo que ayuda a plantar árboles nuevos.")],
    duck: [L("Pato", "Duck", "Pato"), L("Nada no lago da praça e passeia na grama. As penas são impermeáveis, cobertas por uma oleosidade natural.", "Swims in the square's pond and strolls on the grass. Its feathers are waterproof, coated in natural oil.", "Nada en el estanque de la plaza y pasea por el césped. Sus plumas son impermeables, cubiertas de un aceite natural.")],
    butterfly: [L("Borboleta", "Butterfly", "Mariposa"), L("Nasce lagarta, vira casulo e depois voa. As asas têm minúsculas escamas coloridas.", "Starts as a caterpillar, becomes a chrysalis and then flies. Its wings have tiny colored scales.", "Nace oruga, se vuelve crisálida y luego vuela. Sus alas tienen diminutas escamas de colores.")],
    bee: [L("Abelha", "Bee", "Abeja"), L("Visita flor por flor levando pólen, e por isso ajuda plantas e frutas a nascer. Dança para avisar onde há flores.", "Visits flower after flower carrying pollen, helping plants and fruit grow. It dances to tell others where flowers are.", "Visita flor tras flor llevando polen, y así ayuda a que nazcan plantas y frutas. Baila para avisar dónde hay flores.")],
    bat: [L("Morcego", "Bat", "Murciélago"), L("Voa à noite e enxerga com o som: emite pios agudos e ouve o eco. Assombra o navio fantasma.", "Flies at night and sees with sound: it sends out high squeaks and listens for the echo. Haunts the ghost ship.", "Vuela de noche y ve con el sonido: emite chillidos agudos y escucha el eco. Ronda el barco fantasma.")],
    parrot: [L("Papagaio do navio", "Ship parrot", "Loro del barco"), L("Empoleirado no navio pirata, imita vozes. Se você chega perto, dá uns pulinhos.", "Perched on the pirate ship, it imitates voices. If you come close, it hops around.", "Posado en el barco pirata, imita voces. Si te acercas, da saltitos.")],
    fish: [L("Peixinho", "Little fish", "Pececito"), L("Nada em cardume pelo mar e pela fenda. Quando você se aproxima, dispara para longe.", "Swims in schools in the sea and the rift. When you get close it darts away.", "Nada en cardumen por el mar y la grieta. Cuando te acercas, sale disparado.")],
    jumper: [L("Golfinho", "Dolphin", "Delfín"), L("Salta da água de tempos em tempos. É um mamífero: respira ar e conversa com assobios.", "Leaps out of the water now and then. It is a mammal: it breathes air and talks with whistles.", "Salta del agua de vez en cuando. Es un mamífero: respira aire y se comunica con silbidos.")],
    turtle: [L("Tartaruga-marinha", "Sea turtle", "Tortuga marina"), L("Nada devagar por milhares de quilômetros e volta à praia onde nasceu para pôr os ovos.", "Swims slowly for thousands of kilometers and returns to the beach where it was born to lay eggs.", "Nada despacio miles de kilómetros y vuelve a la playa donde nació para poner sus huevos.")],
    whale: [L("Baleia", "Whale", "Ballena"), L("A gigante do mar aberto. Sua canção atravessa quilômetros debaixo d'água.", "The giant of the open sea. Its song travels for kilometers underwater.", "La gigante del mar abierto. Su canto atraviesa kilómetros bajo el agua.")],
    jelly: [L("Água-viva", "Jellyfish", "Medusa"), L("Não tem cérebro, nem coração, nem ossos: é quase só água. Pulsa para se mover pela fenda.", "Has no brain, heart or bones: it is almost all water. It pulses to move through the rift.", "No tiene cerebro, ni corazón, ni huesos: es casi solo agua. Pulsa para moverse por la grieta.")],
    seahorse: [L("Cavalo-marinho", "Seahorse", "Caballito de mar"), L("É o pai que carrega os filhotes na barriga! Nada em pé e se agarra às algas com o rabo.", "It's the dad who carries the babies in his belly! Swims upright and grips seaweed with its tail.", "¡Es el papá quien lleva las crías en la barriga! Nada de pie y se agarra a las algas con la cola.")]
  };
  function markSeen(name) {
    if (typeof state === "undefined" || !state) return;
    state.fauna = state.fauna || { seen: {} };
    if (!state.fauna.seen[name]) { state.fauna.seen[name] = true; if (typeof saveState === "function") saveState(); }
  }

  let pondRect = null, night = false;
  const nearPond = (x, y) => Boolean(pondRect) && x > pondRect.x - 70 && x < pondRect.x + pondRect.w + 70 && y > pondRect.y - 70 && y < pondRect.y + pondRect.h + 70;

  function zoneOk(a, x, y) {
    const sp = SP[a.sp], Z = (ZONES[locId] || {})[sp.zone];
    if (sp.mode === "fly") return true;
    if (Z && !Z(x, y)) return false;
    if (sp.mode === "swim" || sp.mode === "jump") return true;
    return !env.blocked(x, y);
  }

  const flowerSpot = (near) => { const sp = window.Nature ? Nature.spots(["flower", "bush"]) : []; if (!sp.length) return null; const pool = near ? sp.filter((q) => Math.hypot(q.x - near.x, q.y - near.y) < 380) : sp; const use = pool.length ? pool : sp; return use[Math.floor(rnd() * use.length)]; };

  function spawnOne(name) {
    const sp = SP[name], loc = env.loc;
    for (let tries = 0; tries < 60; tries++) {
      const x = 40 + rnd() * (loc.w - 80), y = 40 + rnd() * (loc.h - 80);
      const a = { sp: name, x, y, tx: x, ty: y, dir: rnd() < 0.5 ? -1 : 1, ph: rnd() * 6.28, st: "idle", t: rnd() * 3, alt: 0, flee: 0, jump: 0 };
      if (sp.mode === "fly") {
        if (sp.flowers) { const f = flowerSpot(); if (!f) return 0; a.x = f.x; a.y = f.y - 6; }   // só existem onde há flores
        a.alt = sp.alt[0] + rnd() * (sp.alt[1] - sp.alt[0]); a.tx = a.x; a.ty = a.y; a.st = "fly"; return list.push(a);
      }
      if (zoneOk(a, x, y)) { a.tx = x; a.ty = y; if (sp.mode === "perch") a.st = "perch"; return list.push(a); }
    }
    return 0;
  }

  function enter(loc, blocked) {
    locId = loc.id; env = { loc, blocked }; list = [];
    pondRect = (loc.solids || []).find((q) => q.emoji === "🦆") || null; seed = 7 + (loc.id.length * 131) % 997;
    const crowd = CROWD[loc.id] || (INDOOR[loc.id] || []).map((n) => [n, n === "cat" ? 1 : 2]);
    crowd.forEach(([n, k]) => { const kk = k > 0 ? Math.max(1, Math.round(k * (window.Perf ? Perf.crowd() : 1))) : 0; for (let i = 0; i < kk; i++) spawnOne(n); });   // modo Econômico: menos bichinhos
  }

  function newTarget(a, sp) {
    for (let k = 0; k < 14; k++) {
      const d = 40 + rnd() * 130, ang = rnd() * 6.28, x = a.x + Math.cos(ang) * d, y = a.y + Math.sin(ang) * d * (sp.mode === "swim" ? 0.5 : 1);
      if (x < 20 || y < 20 || x > env.loc.w - 20 || y > env.loc.h - 20) continue;
      const probe = { sp: a.sp };
      if (zoneOk(probe, x, y)) { a.tx = x; a.ty = y; return; }
    }
    a.tx = a.x; a.ty = a.y;
  }

  function update(dt, px, py, now) {
    if (!env) return;
    list.forEach((a) => {
      const sp = SP[a.sp];
      a.ph += dt * (sp.flutter ? 22 : 7);
      const dP = Math.hypot(a.x - px, a.y - py);
      if (dP < 240) markSeen(a.sp);   // bichinho "visto" para o guia da fauna
      if (sp.mode === "still") return;
      if (sp.mode === "perch") { if (dP < 60 && a.st === "perch") { a.st = "hop"; a.t = 1.2; } if (a.t > 0) a.t -= dt; else a.st = "perch"; return; }
      if (sp.mode === "jump") {   // golfinho/peixe que pula da água de tempos em tempos
        a.t -= dt;
        if (a.jump > 0) { a.jump += dt; if (a.jump > 1.4) { a.jump = 0; a.t = 3 + rnd() * 6; newTarget(a, sp); a.x = a.tx; a.y = a.ty; } } else if (a.t <= 0) a.jump = 0.001;
        return;
      }
      if (sp.mode === "fly") {   // voa até pontos aleatórios; pássaros grandes cruzam a tela
        if (sp.flowers && Math.hypot(a.tx - a.x, a.ty - a.y) < 8) { const f = flowerSpot(a); if (f) { a.tx = f.x + (rnd() - 0.5) * 16; a.ty = f.y - 8 - rnd() * 10; a.hover = 0.6 + rnd() * 1.6; } }
        if (a.hover > 0 && sp.flowers) { a.hover -= dt; a.ph += dt * 10; return; }   // pousa um instante na flor
        if (!sp.flowers && Math.hypot(a.tx - a.x, a.ty - a.y) < 8) {
          const far = a.sp === "gull" || a.sp === "bat";
          const d = far ? 260 : 90;
          a.tx = Math.max(10, Math.min(env.loc.w - 10, a.x + (rnd() - 0.5) * d * 2)); a.ty = Math.max(10, Math.min(env.loc.h - 10, a.y + (rnd() - 0.5) * d));
          if (a.sp === "gull" && locId === "praia") a.ty = Math.min(a.ty, 520);   // na praia, gaivota voa junto ao mar
        }
        const dx = a.tx - a.x, dy = a.ty - a.y, L = Math.hypot(dx, dy) || 1, v = sp.speed * (sp.flutter ? 0.7 + 0.5 * Math.abs(Math.sin(a.ph * 0.13)) : 1);
        a.x += (dx / L) * v * dt; a.y += (dy / L) * v * dt + (sp.flutter ? Math.sin(a.ph * 0.4) * 0.6 : 0); if (Math.abs(dx) > 2) a.dir = dx > 0 ? 1 : -1;
        return;
      }
      // andar / nadar: descansa, escolhe um ponto e vai; assustado, foge para longe de você
      if (sp.flee && dP < sp.flee && a.flee <= 0) {
        a.flee = 1.1;
        if (sp.fly && rnd() < 0.7) { a.st = "takeoff"; a.alt = 1; }
        const ang = Math.atan2(a.y - py, a.x - px) + (rnd() - 0.5) * 0.8, d = 90 + rnd() * 90;
        a.tx = a.x + Math.cos(ang) * d; a.ty = a.y + Math.sin(ang) * d;
        if (!zoneOk(a, a.tx, a.ty) && a.st !== "takeoff") newTarget(a, sp);
      }
      if (a.st === "takeoff") {   // ave que levantou voo: sobe, cruza e pousa em outro lugar
        a.alt += dt * 120; a.x += a.dir * 90 * dt; a.y -= 20 * dt;
        if (a.alt > 140) { a.st = "idle"; a.alt = 0; for (let k = 0; k < 30; k++) { const nx = 40 + rnd() * (env.loc.w - 80), ny = 40 + rnd() * (env.loc.h - 80); if (zoneOk(a, nx, ny) && Math.hypot(nx - px, ny - py) > 160) { a.x = nx; a.y = ny; break; } } a.tx = a.x; a.ty = a.y; a.t = 2; }
        return;
      }
      a.flee -= dt;
      if (a.st === "idle") { a.t -= dt; if (a.t <= 0) { newTarget(a, sp); a.st = "walk"; } if (sp.bob) a.y += Math.sin(a.ph * 0.2) * 0.1; return; }
      const dx = a.tx - a.x, dy = a.ty - a.y, L = Math.hypot(dx, dy);
      if (L < 3) { a.st = "idle"; a.t = 1 + rnd() * 4; return; }
      const v = sp.speed * (a.flee > 0 ? 2.3 : 1);
      const nx = a.x + (dx / L) * v * dt, ny = a.y + (dy / L) * v * dt;
      if (zoneOk(a, nx, ny)) { a.x = nx; a.y = ny; if (Math.abs(dx) > 1) a.dir = dx > 0 ? 1 : -1; } else { a.st = "idle"; a.t = 0.5 + rnd(); }
    });
  }

  // ---------------------------------------------------------------- desenho
  const shadow = (c, x, y, w, alt) => { c.fillStyle = `rgba(21,19,31,${0.22 - Math.min(0.12, (alt || 0) / 900)})`; c.beginPath(); c.ellipse(x, y, w, w * 0.32, 0, 0, 7); c.fill(); };
  const body = (c, col, w, h) => { c.fillStyle = col; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, w, h, 0, 0, 7); c.fill(); c.stroke(); };

  // A cor do bicho nasce UMA vez, de onde ele apareceu, e não muda mais. Antes ela era escolhida pela
  // posição ATUAL — e como o gato e o cachorro andam, a cor trocava várias vezes por segundo: o bicho
  // piscava entre laranja, creme e marrom escuro. Valia também para borboleta e peixe.
  const tom = (a) => { if (a.tom === undefined) a.tom = Math.abs(Math.round(a.x * 3 + a.y)); return a.tom; };

  const DRAW = {
    crab(c, a) {
      const sk = Math.sin(a.ph) * 3, dig = a.flee > 0.6;
      c.strokeStyle = "#b8452a"; c.lineWidth = 2; [-1, 1].forEach((s) => { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * 7, 2); c.lineTo(s * (13 + i * 2), 6 + i * 2 + (i % 2 ? sk : -sk) * 0.5); c.stroke(); } });
      c.fillStyle = "#e2573a"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 11, 7, 0, 0, 7); c.fill(); c.stroke();
      [-1, 1].forEach((s) => { c.fillStyle = "#e2573a"; c.beginPath(); c.arc(s * 14, -8 + sk * 0.4 * s, 5, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#fff"; c.beginPath(); c.arc(s * 4, -8, 2.6, 0, 7); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(s * 4, -8, 1.2, 0, 7); c.fill(); });
      void dig;
    },
    sandpiper(c, a) { const w = Math.sin(a.ph) * 3; c.strokeStyle = "#8a5a2a"; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, 4); c.lineTo(-3 - w, 12); c.moveTo(2, 4); c.lineTo(3 + w, 12); c.stroke(); body(c, "#cbb89a", 8, 5.5); c.fillStyle = "#cbb89a"; c.beginPath(); c.arc(7, -4, 3.5, 0, 7); c.fill(); c.stroke(); c.strokeStyle = "#e28a2a"; c.lineWidth = 2; c.beginPath(); c.moveTo(10, -4); c.lineTo(16, -3); c.stroke(); },
    seastar(c) { c.fillStyle = "#f08a4a"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12, ang = -1.57 + (i * Math.PI) / 5; c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); } c.closePath(); c.fill(); c.stroke(); },
    gull(c, a, t) { const f = Math.sin(a.ph * 0.7); c.strokeStyle = ink; c.lineWidth = 2; c.fillStyle = "#f7f7f5"; c.beginPath(); c.moveTo(-3, 0); c.quadraticCurveTo(-16, -12 * f - 4, -30, 2 + f * 6); c.quadraticCurveTo(-16, 3, 0, 4); c.quadraticCurveTo(16, 3, 30, 2 + f * 6); c.quadraticCurveTo(16, -12 * f - 4, 3, 0); c.fill(); c.stroke(); body(c, "#fff", 8, 4); c.fillStyle = "#f2a83a"; c.beginPath(); c.moveTo(8, 0); c.lineTo(14, 1); c.lineTo(8, 3); c.fill(); void t; },
    pigeon(c, a) { const w = Math.sin(a.ph) * 2.5; c.strokeStyle = "#c95a6a"; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, 5); c.lineTo(-3 - w, 12); c.moveTo(3, 5); c.lineTo(4 + w, 12); c.stroke(); body(c, "#8f97a8", 10, 7); c.fillStyle = "#6c8cb8"; c.beginPath(); c.arc(9, -5, 4.4, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#6a7488"; c.beginPath(); c.ellipse(-2, 0, 6, 3.5, 0, 0, 7); c.fill(); c.fillStyle = "#f2a83a"; c.beginPath(); c.moveTo(13, -5); c.lineTo(17, -4); c.lineTo(13, -3); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(10.5, -6, 0.9, 0, 7); c.fill(); },
    sparrow(c, a) { const w = Math.sin(a.ph) * 2; c.strokeStyle = "#8a5a2a"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-1, 4); c.lineTo(-2 - w, 10); c.moveTo(2, 4); c.lineTo(3 + w, 10); c.stroke(); body(c, "#a8794a", 7, 5); c.fillStyle = "#c9a878"; c.beginPath(); c.arc(6, -3.5, 3.4, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#f2a83a"; c.beginPath(); c.moveTo(9, -4); c.lineTo(12, -3); c.lineTo(9, -2); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(7, -4.5, 0.8, 0, 7); c.fill(); },
    cat(c, a) {
      const w = Math.sin(a.ph) * 2, col = ["#e08a3a", "#5a5a66", "#f2f0ea", "#3a3038"][tom(a) % 4];
      c.strokeStyle = col; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(-11, -2); c.quadraticCurveTo(-20, -12 + Math.sin(a.ph * 0.4) * 3, -15, -16); c.stroke(); c.lineCap = "butt";
      c.fillStyle = col; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 12, 7, 0, 0, 7); c.fill(); c.stroke();
      [[-7, 6], [7, 6]].forEach(([lx, ly], i) => { c.fillRect(lx - 2, ly, 4, 6 + (i ? w : -w) * 0.5); });
      c.beginPath(); c.arc(11, -4, 6, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.moveTo(7, -8); c.lineTo(8, -14); c.lineTo(11, -9); c.moveTo(12, -9); c.lineTo(15, -14); c.lineTo(16, -7); c.fill(); c.stroke();
      c.fillStyle = "#2f8a4a"; c.beginPath(); c.arc(13, -5, 1.1, 0, 7); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(13.4, -5, 0.5, 0, 7); c.fill();
    },
    dog(c, a) {
      const w = Math.sin(a.ph) * 3, col = ["#c98a4a", "#f2e8d8", "#6a4a32"][tom(a) % 3];
      c.fillStyle = col; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, -4); c.lineTo(-20, -12 + Math.sin(a.ph * 0.8) * 3); c.lineTo(-11, -7); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, 0, 15, 8, 0, 0, 7); c.fill(); c.stroke();
      [[-9, 6], [-3, 6], [6, 6], [11, 6]].forEach(([lx, ly], i) => { c.fillRect(lx - 2, ly, 4, 7 + (i % 2 ? w : -w) * 0.4); c.strokeRect(lx - 2, ly, 4, 7 + (i % 2 ? w : -w) * 0.4); });
      c.beginPath(); c.arc(15, -6, 7, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#3a2a20"; c.beginPath(); c.ellipse(11, -6, 3, 6, 0.2, 0, 7); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(21, -5, 2, 0, 7); c.fill(); c.beginPath(); c.arc(17, -8, 1.1, 0, 7); c.fill();
    },
    squirrel(c, a) { const w = Math.sin(a.ph) * 2.5; c.fillStyle = "#b8703a"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.ellipse(-13, -6, 8, 12, -0.5, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.ellipse(0, 0, 9, 6, 0, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.arc(9, -4, 5, 0, 7); c.fill(); c.stroke(); c.fillRect(-4, 5, 3, 5 + w * 0.3); c.fillRect(4, 5, 3, 5 - w * 0.3); c.fillStyle = ink; c.beginPath(); c.arc(11, -5, 1, 0, 7); c.fill(); },
    duck(c, a) { const w = Math.sin(a.ph) * 2; body(c, "#f4f0e0", 11, 7); c.fillStyle = "#3f7a4a"; c.beginPath(); c.arc(9, -8, 5, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#f2a83a"; c.beginPath(); c.moveTo(13, -8); c.lineTo(19, -6); c.lineTo(13, -5); c.fill(); c.fillStyle = "#d9d0b8"; c.beginPath(); c.ellipse(-4, -1, 6, 4, 0, 0, 7); c.fill(); c.strokeStyle = "#f2a83a"; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, 7); c.lineTo(-2 - w, 12); c.moveTo(3, 7); c.lineTo(3 + w, 12); c.stroke(); c.fillStyle = ink; c.beginPath(); c.arc(10.5, -9, 0.9, 0, 7); c.fill(); },
    butterfly(c, a) { const f = Math.abs(Math.sin(a.ph * 0.5)), col = ["#f2c230", "#e2478a", "#4f9bd8", "#f08a4a"][tom(a) % 4]; c.fillStyle = col; c.strokeStyle = ink; c.lineWidth = 1.2; [-1, 1].forEach((s) => { c.beginPath(); c.ellipse(s * 5 * (0.4 + f * 0.6), -3, 5 * (0.4 + f * 0.6), 6, s * 0.4, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.ellipse(s * 4 * (0.4 + f * 0.6), 4, 3.6 * (0.4 + f * 0.6), 4.4, -s * 0.4, 0, 7); c.fill(); c.stroke(); }); c.fillStyle = ink; c.fillRect(-1, -5, 2, 11); },
    moth(c, a) { const f = Math.abs(Math.sin(a.ph * 0.5)); c.fillStyle = "#d8cfba"; c.strokeStyle = ink; c.lineWidth = 1; [-1, 1].forEach((s) => { c.beginPath(); c.ellipse(s * 4 * (0.4 + f * 0.6), 0, 4 * (0.4 + f * 0.6), 5, 0, 0, 7); c.fill(); c.stroke(); }); c.fillStyle = ink; c.fillRect(-1, -4, 2, 8); },
    bee(c, a) { const f = Math.abs(Math.sin(a.ph * 0.6)); c.fillStyle = "rgba(220,240,255,0.8)"; c.strokeStyle = "rgba(21,19,31,0.4)"; c.lineWidth = 1; [-1, 1].forEach((s) => { c.beginPath(); c.ellipse(s * 3, -5, 3.4, 5.5 * (0.5 + f * 0.5), s * 0.5, 0, 7); c.fill(); c.stroke(); }); c.fillStyle = "#f2c230"; c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 6, 4.2, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = ink; c.fillRect(-2, -4, 2, 8); c.fillRect(2, -4, 2, 8); },
    fly(c, a) { const f = Math.abs(Math.sin(a.ph)); c.fillStyle = "rgba(220,240,255,0.7)"; c.beginPath(); c.ellipse(-2, -3, 3, 2 + f * 2, 0.5, 0, 7); c.ellipse(2, -3, 3, 2 + f * 2, -0.5, 0, 7); c.fill(); c.fillStyle = "#2a2a30"; c.beginPath(); c.arc(0, 0, 2.6, 0, 7); c.fill(); },
    bat(c, a) { const f = Math.sin(a.ph * 0.6); c.fillStyle = "#2a2233"; c.strokeStyle = "#9fe8c9"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(-10, -12 * f - 4, -22, 0 + f * 4); c.quadraticCurveTo(-14, 2, -9, 4); c.quadraticCurveTo(-4, 2, 0, 6); c.quadraticCurveTo(4, 2, 9, 4); c.quadraticCurveTo(14, 2, 22, f * 4); c.quadraticCurveTo(10, -12 * f - 4, 0, -2); c.fill(); c.stroke(); c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.fill(); c.fillStyle = "#ff6a5a"; c.fillRect(-3, -1, 1.6, 1.6); c.fillRect(1.4, -1, 1.6, 1.6); },
    parrot(c, a) { const hop = a.st === "hop" ? Math.abs(Math.sin(a.ph * 0.5)) * 5 : 0; c.translate(0, -hop); c.fillStyle = "#3fb04a"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 7, 12, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#e2473a"; c.beginPath(); c.moveTo(-4, 8); c.lineTo(-6, 22); c.lineTo(0, 14); c.lineTo(6, 22); c.lineTo(4, 8); c.fill(); c.stroke(); c.fillStyle = "#e2473a"; c.beginPath(); c.arc(1, -12, 6, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#f2c230"; c.beginPath(); c.moveTo(6, -13); c.quadraticCurveTo(13, -11, 9, -6); c.lineTo(5, -9); c.fill(); c.stroke(); c.fillStyle = "#fff"; c.beginPath(); c.arc(2, -13, 1.6, 0, 7); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(2.4, -13, 0.8, 0, 7); c.fill(); },
    fish(c, a) { const w = Math.sin(a.ph) * 3, col = ["#f2a83a", "#e2573a", "#4f9bd8", "#f2c230", "#8fd8b0"][tom(a) % 5]; c.fillStyle = col; c.strokeStyle = "rgba(21,19,31,0.75)"; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, 0, 11, 6, 0, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-9, 0); c.lineTo(-17, -6 + w); c.lineTo(-17, 6 + w); c.closePath(); c.fill(); c.stroke(); c.fillStyle = "#fff"; c.beginPath(); c.arc(6, -1.5, 2, 0, 7); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(6.6, -1.5, 1, 0, 7); c.fill(); },
    jumper(c, a) { const k = a.jump; if (k <= 0) { c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 10 + Math.sin(a.ph * 0.3) * 2, 3.5, 0, 0, 7); c.stroke(); return; } const u = k / 1.4, h = Math.sin(u * Math.PI) * 60, ang = (u - 0.5) * 2.2; c.translate(0, -h); c.rotate(ang * a.dir); c.fillStyle = "#7a93b0"; c.strokeStyle = ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-18, 2); c.quadraticCurveTo(-4, -12, 12, -2); c.quadraticCurveTo(20, 0, 24, -3); c.quadraticCurveTo(18, 5, 10, 5); c.quadraticCurveTo(-6, 10, -18, 2); c.fill(); c.stroke(); c.fillStyle = "#e7eef5"; c.beginPath(); c.ellipse(2, 4, 10, 2.6, 0, 0, 7); c.fill(); c.fillStyle = "#7a93b0"; c.beginPath(); c.moveTo(-18, 2); c.lineTo(-26, -6); c.lineTo(-24, 8); c.closePath(); c.fill(); c.stroke(); },
    turtle(c, a) { const w = Math.sin(a.ph * 0.5) * 3; c.fillStyle = "#5aa070"; c.strokeStyle = ink; c.lineWidth = 2; [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([fx, fy]) => { c.beginPath(); c.ellipse(fx, fy + w * Math.sign(fy) * 0.3, 6, 3.5, 0.6 * Math.sign(fx * fy), 0, 7); c.fill(); c.stroke(); }); c.beginPath(); c.ellipse(0, 0, 15, 12, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#3f7a52"; c.beginPath(); c.ellipse(0, 0, 9, 7, 0, 0, 7); c.fill(); c.fillStyle = "#5aa070"; c.beginPath(); c.arc(17, 0, 5, 0, 7); c.fill(); c.stroke(); },
    whale(c, a) { const w = Math.sin(a.ph * 0.3) * 4; c.fillStyle = "#4f6f95"; c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.moveTo(-60, 0); c.quadraticCurveTo(-30, -34, 20, -24); c.quadraticCurveTo(58, -18, 62, 6); c.quadraticCurveTo(30, 30, -30, 18); c.quadraticCurveTo(-52, 12, -60, 0); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-58, 0); c.lineTo(-84, -20 + w); c.lineTo(-78, 8 + w); c.lineTo(-88, 20 + w); c.closePath(); c.fill(); c.stroke(); c.fillStyle = "#c9d8ea"; c.beginPath(); c.ellipse(10, 14, 34, 5, 0.1, 0, 7); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(40, -6, 2.4, 0, 7); c.fill(); c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 3; c.beginPath(); c.moveTo(6, -26); c.lineTo(6, -40); c.moveTo(6, -40); c.lineTo(-2, -48); c.moveTo(6, -40); c.lineTo(14, -48); c.stroke(); },
    jelly(c, a) { const p = Math.sin(a.ph * 0.4); c.fillStyle = "rgba(240,150,220,0.7)"; c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 2; c.beginPath(); c.moveTo(-13, 2); c.quadraticCurveTo(-13, -14 - p * 3, 0, -14 - p * 3); c.quadraticCurveTo(13, -14 - p * 3, 13, 2); c.closePath(); c.fill(); c.stroke(); c.lineWidth = 2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 5, 2); c.quadraticCurveTo(i * 5 + Math.sin(a.ph * 0.4 + i) * 4, 12, i * 5, 22 + p * 2); c.stroke(); } },
    seahorse(c, a) { c.fillStyle = "#f0b040"; c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -14); c.quadraticCurveTo(10, -14, 8, -4); c.quadraticCurveTo(4, 6, 0, 8); c.quadraticCurveTo(-8, 14, -4, 20); c.quadraticCurveTo(4, 22, 2, 16); c.quadraticCurveTo(-2, 10, 2, 6); c.quadraticCurveTo(12, -2, 6, -12); c.quadraticCurveTo(4, -16, 0, -14); c.fill(); c.stroke(); c.beginPath(); c.moveTo(8, -12); c.lineTo(16, -10); c.lineTo(8, -8); c.fill(); c.stroke(); c.fillStyle = ink; c.beginPath(); c.arc(4, -10, 1.1, 0, 7); c.fill(); }
  };

  // itens ordenáveis por profundidade (y) junto com pessoas e objetos
  function entries() {
    if (!env) return [];
    return list.filter((a) => !SP[a.sp].night || night).map((a) => {
      const sp = SP[a.sp];
      const flying = sp.mode === "fly" || a.st === "takeoff";
      const alt = sp.mode === "fly" ? a.alt : a.st === "takeoff" ? a.alt : 0;
      return {
        y: a.y + (flying ? 5000 : 0), draw: (c, t) => {
          if (flying) shadow(c, a.x, a.y + 6, sp.r * 0.8, alt);
          else if (!(sp.mode === "swim" || sp.mode === "jump")) shadow(c, a.x, a.y + sp.r * 0.45, sp.r * 0.85, 0);
          c.save(); c.translate(a.x, a.y - alt); c.scale(a.dir < 0 ? -1 : 1, 1);
          const dm = DRAW[a.sp]; if (dm) dm(c, a, t); c.restore();
        }
      };
    });
  }

  // desenha um bichinho num canvas pequeno (guia da fauna)
  function drawIcon(c, name, x, y, scale, t) {
    const dm = DRAW[name]; if (!dm) return;
    c.save(); c.translate(x, y + (name === "jumper" ? 40 * scale : 0)); c.scale(scale, scale);
    dm(c, { sp: name, ph: (t || 0) / 110, dir: 1, st: "idle", flee: 0, jump: name === "jumper" ? 0.7 : 0, alt: 0, x: 3, y: 5 }, t || 0);
    c.restore();
  }
  const placesOf = (name) => { const out = []; Object.keys(CROWD).forEach((id) => { if (CROWD[id].some(([n, k]) => n === name && k > 0)) out.push(id); }); Object.keys(INDOOR).forEach((id) => { if (INDOOR[id].includes(name)) out.push(id); }); return out; };

  return {
    enter, update, entries, drawIcon, setNight(b) { night = Boolean(b); }, INFO, placesOf, markSeen,
    species: () => Object.keys(INFO),
    seen: () => ((typeof state !== "undefined" && state && state.fauna && state.fauna.seen) || {}),
    stats() { const o = {}; list.forEach((a) => { o[a.sp] = (o[a.sp] || 0) + 1; }); return o; },
    list: () => list.map((a) => ({ sp: a.sp, x: a.x, y: a.y, mode: SP[a.sp].mode, alt: a.alt })),
    zoneOf: (n) => SP[n].zone || null, _radius: (n) => (SP[n] || {}).r,
    _ok(sp, x, y) { return zoneOk({ sp }, x, y); }
  };
})();

window.Fauna = Fauna;

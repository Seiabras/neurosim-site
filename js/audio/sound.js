"use strict";

// Som do jogo, gerado pelo próprio navegador (Web Audio): sem arquivos de áudio.
// Os navegadores só liberam o áudio depois do primeiro clique ou tecla; até lá, tudo fica em silêncio.
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;

  const st = {
    ctx: null, master: null, sfxBus: null, musicBus: null, fade: null, lowpass: null,
    sfx: 0.7, music: 0.35, ambVol: 0.6, muted: false,   // ambVol é o volume; st.amb (lá embaixo) é a paisagem que está tocando
    unlocked: false,
    mood: null,          // clima da música pedido pelo jogo
    playingMood: null,   // clima que está tocando
    timer: null, nextChord: 0, chordIdx: 0,
    alarmTimer: null,
    instr: "bell",       // instrumento da melodia (opção do jogador): bell | piano | flute | harp
    key: 0,           // tom da trilha (cada paciente tem o seu)
    conv: null, wet: null, sfxSend: null, musicSend: null, ambBus: null, ambSend: null, space: "room",   // reverb e sons ambiente
    amb: null         // paisagem sonora em andamento
  };

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ---------------------------------------------------------------- base
  function ensure() {
    if (!AC || !st.unlocked) return null;
    if (st.ctx) return st.ctx;
    const c = new AC();
    st.ctx = c;
    st.master = c.createGain();
    st.sfxBus = c.createGain();
    st.musicBus = c.createGain();
    st.fade = c.createGain();
    st.lowpass = c.createBiquadFilter();
    st.lowpass.type = "lowpass";
    st.lowpass.frequency.value = 1500;
    st.sfxBus.connect(st.master);
    st.fade.connect(st.lowpass);
    st.lowpass.connect(st.musicBus);
    st.musicBus.connect(st.master);
    // reverb: um convolver com resposta ao impulso gerada por código; efeitos, música e ambiente mandam uma parte do sinal para ele
    st.conv = c.createConvolver();
    st.wet = c.createGain();
    st.conv.connect(st.wet);
    st.wet.connect(st.master);
    st.sfxSend = c.createGain(); st.musicSend = c.createGain(); st.ambSend = c.createGain();
    st.sfxBus.connect(st.sfxSend); st.sfxSend.connect(st.conv);   // (no modo Econômico o eco fica bem mais fraco: setSpace usa Perf.level)
    st.musicBus.connect(st.musicSend); st.musicSend.connect(st.conv);
    st.ambBus = c.createGain();
    st.ambBus.connect(st.master); st.ambBus.connect(st.ambSend); st.ambSend.connect(st.conv);
    setSpace(st.space);
    // proteção contra estouro: folga no volume geral, um compressor que segura os picos (várias notas + reverb somam alto) e um
    // limitador suave no final; assim a música principal não distorce mesmo com muitas vozes ao mesmo tempo
    st.master.gain.value = 0.7;
    st.comp = c.createDynamicsCompressor();
    st.comp.threshold.value = -20; st.comp.knee.value = 14; st.comp.ratio.value = 10; st.comp.attack.value = 0.004; st.comp.release.value = 0.25;
    const curve = new Float32Array(2048); for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.1) / Math.tanh(1.1); }
    st.clip = c.createWaveShaper(); st.clip.curve = curve; st.clip.oversample = "2x";
    st.master.connect(st.comp); st.comp.connect(st.clip); st.clip.connect(c.destination);
    applyVolumes(true);
    return c;
  }

  function applyVolumes(instant) {
    if (!st.ctx) return;
    const now = st.ctx.currentTime;
    const sfx = st.muted ? 0 : st.sfx;
    const music = st.muted ? 0 : st.music * 0.45;   // a música tende a soar mais alta que os efeitos
    const amb = st.muted ? 0 : st.sfx * 0.55 * st.ambVol;   // o ambiente fica atrás dos efeitos e tem o seu próprio corte (Opções → Ambiente)
    if (instant) {
      st.sfxBus.gain.value = sfx;
      st.musicBus.gain.value = music;
      st.ambBus.gain.value = amb;
    } else {
      st.sfxBus.gain.setTargetAtTime(sfx, now, 0.05);
      st.musicBus.gain.setTargetAtTime(music, now, 0.08);
      st.ambBus.gain.setTargetAtTime(amb, now, 0.08);
    }
  }

  function tone(o) {
    const c = ensure();
    if (!c) return;
    const { f, t = 0, d = 0.15, type = "sine", v = 0.3, a = 0.005, slide = null, bus = "sfx", dest = null } = o;
    const start = c.currentTime + t;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, start + d);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), start + a);
    g.gain.exponentialRampToValueAtTime(0.0001, start + d);
    osc.connect(g);
    g.connect(dest || (bus === "music" ? st.fade : st.sfxBus));
    osc.start(start);
    osc.stop(start + d + 0.05);
  }

  function noise(o) {
    const c = ensure();
    if (!c) return;
    const { t = 0, d = 0.2, v = 0.1, f0 = 800, f1 = 800, q = 1 } = o;
    const start = c.currentTime + t;
    const len = Math.max(1, Math.floor(c.sampleRate * d));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), start + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), start + d * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, start + d);
    src.connect(filter);
    filter.connect(g);
    g.connect(st.sfxBus);
    src.start(start);
  }

  // sino: fundamental + dois harmônicos que somem mais rápido
  function bell(f, t, d, v, bus) {
    tone({ f, t, d, v, a: 0.004, bus });
    tone({ f: f * 2, t, d: d * 0.6, v: v * 0.3, a: 0.004, bus });
    tone({ f: f * 3, t, d: d * 0.35, v: v * 0.12, a: 0.004, bus });
  }

  // instrumentos da melodia: cada um tem seu timbre e sua duração
  const INSTR = {
    bell:  (f, t, d, v, bus) => bell(f, t, d, v, bus),
    piano: (f, t, d, v, bus) => { tone({ f, t, d: d * 0.7, v: v * 1.1, a: 0.003, type: "triangle", bus }); tone({ f: f * 2, t, d: d * 0.3, v: v * 0.25, a: 0.003, type: "sine", bus }); },
    flute: (f, t, d, v, bus) => { tone({ f, t, d: d * 1.1, v: v * 0.9, a: 0.09, type: "sine", bus }); tone({ f: f * 1.004, t, d: d * 1.1, v: v * 0.5, a: 0.11, type: "sine", bus }); },
    harp:  (f, t, d, v, bus) => { tone({ f, t, d: d * 0.6, v: v * 1.2, a: 0.002, type: "triangle", bus }); tone({ f: f * 3, t, d: d * 0.15, v: v * 0.2, a: 0.002, type: "sine", bus }); }
  };
  const note = (f, t, d, v, bus, inst) => (INSTR[inst || st.instr] || INSTR.bell)(f, t, d, v, bus);
  const PENTA = [0, 2, 4, 7, 9];

  // tema de cada personagem: uma frase curta de 4 notas e um instrumento, sorteados pelo nome
  function motif(seed, inst) {
    if (!ensure()) return;
    const names = ["piano", "flute", "harp", "bell"];
    const who = inst || names[seed % 4];
    for (let i = 0; i < 4; i++) {
      const n = 72 + PENTA[Math.floor(seed / (3 + i)) % 5];
      note(midi(n), i * 0.16, 0.5, 0.14, "sfx", who);
    }
  }

  // ---------------------------------------------------------------- efeitos
  const SFX = {
    click: () => tone({ f: 720, d: 0.05, type: "triangle", v: 0.12 }),
    tick: () => tone({ f: 1100, d: 0.02, type: "square", v: 0.03 }),
    open: () => tone({ f: 420, slide: 720, d: 0.12, v: 0.1 }),
    screen: () => noise({ d: 0.24, v: 0.07, f0: 500, f1: 2400, q: 0.8 }),
    tip: () => { tone({ f: 660, d: 0.09, v: 0.14 }); tone({ f: 990, t: 0.07, d: 0.12, v: 0.1 }); },
    good: () => [523.25, 659.25, 783.99].forEach((f, i) => bell(f, i * 0.09, 0.9, 0.16)),
    deny: () => [0, 0.17, 0.34].forEach((t) => tone({ f: 170, t, d: 0.12, type: "square", v: 0.13 })),   // bem, bem, bem
    bad: () => { tone({ f: 240, slide: 165, d: 0.3, type: "triangle", v: 0.16 }); noise({ d: 0.12, v: 0.03, f0: 300, f1: 200 }); },
    unlock: () => [659.25, 783.99, 1046.5].forEach((f, i) => tone({ f, t: i * 0.06, d: 0.16, type: "triangle", v: 0.12 })),
    coin: () => { tone({ f: 987.77, d: 0.09, type: "square", v: 0.06 }); tone({ f: 1318.5, t: 0.08, d: 0.32, type: "square", v: 0.06 }); },
    buy: () => { SFX.coin(); tone({ f: 523.25, t: 0.22, d: 0.3, v: 0.12 }); },
    equip: () => tone({ f: 520, slide: 780, d: 0.09, type: "triangle", v: 0.12 }),
    levelup: () => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, i * 0.1, 1.1, 0.15)),
    day: () => [392, 523.25, 659.25].forEach((f, i) => bell(f, i * 0.14, 1.2, 0.14)),
    phone: () => { bell(1318.5, 0, 0.5, 0.12); bell(1760, 0.16, 0.6, 0.12); },
    result1: () => [523.25, 659.25].forEach((f, i) => bell(f, i * 0.16, 1, 0.14)),
    result2: () => [523.25, 659.25, 783.99].forEach((f, i) => bell(f, i * 0.15, 1.1, 0.15)),
    result3: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, i * 0.13, 1.3, 0.16)); SFX.coin(); },
    knock: () => [0, 0.2].forEach((t) => { tone({ f: 170, slide: 70, t, d: 0.14, v: 0.5 }); noise({ t, d: 0.05, v: 0.12, f0: 900, f1: 300 }); }),
    door: () => { noise({ d: 0.5, v: 0.1, f0: 300, f1: 900, q: 6 }); tone({ f: 210, slide: 140, d: 0.45, type: "sawtooth", v: 0.04 }); },
    arrive: () => { bell(783.99, 0, 1, 0.12); bell(987.77, 0.18, 1.1, 0.12); },
    alarm: () => [0, 0.2, 0.4, 0.6].forEach((t) => tone({ f: 880, t, d: 0.09, type: "square", v: 0.09 })),
    step: () => { noise({ d: 0.07, v: 0.05, f0: 260, f1: 140, q: 1 }); tone({ f: 120, slide: 70, d: 0.07, v: 0.12 }); },
    bell: () => { bell(1567.98, 0, 0.9, 0.12); bell(2093, 0.12, 1, 0.09); },
    sip: () => { tone({ f: 180, slide: 260, d: 0.16, type: "sine", v: 0.16 }); tone({ f: 200, slide: 300, t: 0.2, d: 0.14, v: 0.12 }); },
    water: () => { noise({ d: 0.5, v: 0.09, f0: 1800, f1: 2800, q: 1.5 }); tone({ f: 900, slide: 1400, t: 0.05, d: 0.12, v: 0.05 }); },
    page: () => noise({ d: 0.16, v: 0.08, f0: 2400, f1: 900, q: 0.6 }),
    // relógio: tic-tac de mesa (seis batidas alternadas) e um sininho no fim, para marcar que a sessão acabou
    clock: () => { for (let i = 0; i < 6; i++) { tone({ f: i % 2 ? 1500 : 1900, t: i * 0.22, d: 0.035, type: "square", v: 0.05 }); noise({ t: i * 0.22, d: 0.03, v: 0.04, f0: 3000, f1: 1500, q: 2 }); } bell(2093, 1.4, 0.9, 0.1); },
    // brilho ("tiling"): fagulhas agudas subindo, tocado quando o jogo abre
    sparkle: () => { [1568, 1976, 2349, 2637, 3136, 3520, 3951, 4186, 3520, 4699].forEach((f, i) => { tone({ f, t: i * 0.075, d: 0.45, v: 0.07, a: 0.003 }); tone({ f: f * 2, t: i * 0.075, d: 0.2, v: 0.02, a: 0.003 }); }); },
    rest: () => [261.63, 329.63, 392, 523.25].forEach((f, i) => tone({ f, t: i * 0.07, d: 1.2, v: 0.06 }))
  };

  // ---------------------------------------------------------------- passos, por chão e por meio de transporte
  // O passo genérico (SFX.step) servia para tudo. Aqui a areia chia, a grama sussurra, a madeira range e o
  // piso de loja estala — e de bicicleta ou de carro o que se ouve é o pneu e o motor, não o pé.
  const SURF = {
    asfalto: { f0: 900, f1: 260, q: 1.2, v: 0.045, low: 120 },
    terra:   { f0: 700, f1: 220, q: 1.0, v: 0.04, low: 100 },
    grama:   { f0: 1700, f1: 520, q: 0.8, v: 0.03, low: 0 },
    areia:   { f0: 2300, f1: 950, q: 0.6, v: 0.035, low: 0 },
    madeira: { f0: 520, f1: 190, q: 2.6, v: 0.045, low: 150 },
    piso:    { f0: 1900, f1: 720, q: 2.2, v: 0.03, low: 95 },
    agua:    { f0: 2600, f1: 900, q: 0.5, v: 0.045, low: 0 }
  };
  function foot(surface, mode) {
    if (!st.unlocked || st.muted || st.sfx <= 0 || !ensure()) return;
    if (mode === "bike") {   // pneu no chão e, de vez em quando, a corrente
      noise({ d: 0.13, v: 0.022, f0: 1400, f1: 600, q: 0.7 });
      if (Math.random() < 0.25) tone({ f: 2400, d: 0.03, type: "square", v: 0.022 });
      return;
    }
    if (mode === "car") {   // motor: grave curto com um pouco de aspereza
      tone({ f: 88, slide: 74, d: 0.3, type: "sawtooth", v: 0.035 });
      noise({ d: 0.3, v: 0.012, f0: 240, f1: 150, q: 1.4 });
      return;
    }
    const sp = SURF[surface] || SURF.asfalto;
    noise({ d: 0.08, v: sp.v, f0: sp.f0, f1: sp.f1, q: sp.q });
    if (sp.low) tone({ f: sp.low, slide: sp.low * 0.6, d: 0.07, v: 0.09 });
  }

  function play(name) {
    if (!st.unlocked || st.muted || st.sfx <= 0) return;
    if (!ensure()) return;
    const fn = SFX[name];
    if (fn) fn();
  }

  // O despertador da introdução repete até o jogador desligar.
  function alarm(on) {
    clearInterval(st.alarmTimer);
    st.alarmTimer = null;
    if (!on) return;
    play("alarm");
    st.alarmTimer = setInterval(() => play("alarm"), 1600);
  }

  // ---------------------------------------------------------------- música (gerada, sem arquivos)
  const MOODS = {
    calm:    { chords: [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 64]], bells: [72, 74, 76, 79, 81], bellChance: 0.55, vol: 1 },
    intro:   { chords: [[41, 48, 57, 64], [38, 45, 53, 60], [46, 53, 62, 69], [36, 43, 52, 57]], bells: [72, 74, 77, 79, 81], bellChance: 0.6, vol: 1 },
    natal:   { chords: [[48, 55, 64, 67], [53, 60, 64, 69], [55, 62, 67, 71], [48, 55, 64, 67]], bells: [79, 76, 84, 83, 81, 88], bellChance: 0.95, vol: 1 },
    pascoa:  { chords: [[50, 57, 66, 69], [55, 62, 66, 71], [52, 59, 64, 71], [50, 57, 62, 69]], bells: [81, 78, 86, 83], bellChance: 0.8, vol: 0.9 },
    halloween: { chords: [[45, 52, 57, 63], [41, 48, 56, 62], [44, 51, 56, 62], [45, 52, 57, 63]], bells: [69, 70, 75, 81], bellChance: 0.4, vol: 0.9 },
    consult: { chords: [[45, 52, 60, 64], [41, 48, 57, 64], [48, 55, 60, 64], [43, 50, 55, 62]], bells: [69, 72, 76], bellChance: 0.15, vol: 0.7 },
    // o instante em que a pessoa chega no limite: acorde suspenso, quase sem sino, para a sala ficar em suspenso junto
    tenso: { chords: [[40, 47, 53, 59], [40, 46, 53, 58], [38, 45, 51, 58], [40, 47, 52, 59]], bells: [67, 68], bellChance: 0.08, vol: 0.8 },
    // a cidade depois do anoitecer: o mesmo tema, mais grave e mais espaçado
    noite: { chords: [[36, 43, 52, 59], [33, 40, 48, 55], [38, 45, 53, 60], [31, 38, 47, 55]], bells: [67, 69, 72, 74], bellChance: 0.3, vol: 0.75 }
  };
  const CHORD_SECONDS = 4.5;

  function scheduleChord(mood, time, idx) {
    const c = st.ctx;
    const m = MOODS[mood];
    const chord = m.chords[idx % m.chords.length].map((n) => n + st.key);
    chord.forEach((n, k) => {
      [-4, 4].forEach((cents) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = k === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(midi(n), time);
        osc.detune.setValueAtTime(cents, time);
        const peak = (k === 0 ? 0.09 : 0.05) * m.vol;
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(peak, time + 1.1);
        g.gain.setValueAtTime(peak, time + CHORD_SECONDS - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, time + CHORD_SECONDS + 1.4);
        osc.connect(g);
        g.connect(st.fade);
        osc.start(time);
        osc.stop(time + CHORD_SECONDS + 1.5);
        const v = { osc, g }; (st.voices = st.voices || []).push(v);
        osc.onended = () => { const i = st.voices.indexOf(v); if (i >= 0) st.voices.splice(i, 1); };
      });
    });
    for (let i = 0; i < 3; i++) {
      if (Math.random() < m.bellChance) {
        const nt = m.bells[Math.floor(Math.random() * m.bells.length)];
        note(midi(nt + st.key), (time - c.currentTime) + 0.6 + i * 1.4 + Math.random() * 0.5, 2.2, 0.045 * m.vol, "music");
      }
    }
  }

  function tick() {
    const c = st.ctx;
    if (!c || !st.playingMood) return;
    while (st.nextChord < c.currentTime + 1.2) {
      scheduleChord(st.playingMood, st.nextChord, st.chordIdx);
      st.chordIdx += 1;
      st.nextChord += CHORD_SECONDS;
    }
  }

  function startMusic() {
    const c = ensure();
    if (!c || !st.mood) return;
    if (st.playingMood === st.mood && st.timer) return;
    const first = !st.playingMood;
    // troca de clima: as notas do clima antigo se apagam depressa, em vez de somar com as do novo (era isso que estourava o som)
    (st.voices || []).splice(0).forEach(({ osc, g }) => { try { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.07); osc.stop(t + 0.5); } catch (e) { /* já parou */ } });
    st.playingMood = st.mood;
    st.chordIdx = 0;
    const now = c.currentTime;
    // troca de clima: some rápido e volta devagar
    st.fade.gain.cancelScheduledValues(now);
    st.fade.gain.setValueAtTime(first ? 0.0001 : st.fade.gain.value || 1, now);
    st.fade.gain.linearRampToValueAtTime(0.0001, now + (first ? 0.01 : 0.35));
    st.fade.gain.linearRampToValueAtTime(1, now + (first ? 1.2 : 1.6));
    st.nextChord = now + (first ? 0.05 : 0.4);
    if (!st.timer) st.timer = setInterval(tick, 250);
    tick();
  }

  // o instante emocional troca a música e devolve a de antes quando passa
  function tension(on) {
    if (on) { if (st.mood === "tenso") return; st.moodAntes = st.mood; music("tenso"); return; }
    if (st.mood !== "tenso") return;
    const antes = st.moodAntes || "calm"; st.moodAntes = null; music(antes);
  }

  function music(mood) {
    if (mood !== "consult" && mood !== "tenso") st.key = 0;   // o tom próprio de cada paciente vale na consulta e no instante dentro dela
    st.mood = mood;
    if (st.unlocked) startMusic();
  }

  function stopMusic() {
    clearInterval(st.timer);
    st.timer = null;
    st.playingMood = null;
    st.mood = null;
  }

  function setVolume(v) {
    if (typeof v.sfx === "number") st.sfx = Math.min(1, Math.max(0, v.sfx));
    if (typeof v.music === "number") st.music = Math.min(1, Math.max(0, v.music));
    if (typeof v.amb === "number") st.ambVol = Math.min(1, Math.max(0, v.amb));
    if (typeof v.muted === "boolean") st.muted = v.muted;
    applyVolumes(false);
  }

  // ---------------------------------------------------------------- reverb (espaços)
  // cada tipo de lugar tem o seu "ambiente": duração da cauda, quanto é absorvido (damp) e quanto do som vai para o reverb
  const SPACES = {
    room: { sec: 0.9, damp: 0.55, sfx: 0.16, music: 0.22, amb: 0.1, wet: 0.9 },    // consultório, casa: quarto pequeno e macio
    hall: { sec: 1.9, damp: 0.4, sfx: 0.24, music: 0.3, amb: 0.2, wet: 1 },        // lojas grandes, shopping, universidade, hospital: sala ampla
    open: { sec: 0.55, damp: 0.75, sfx: 0.07, music: 0.1, amb: 0.03, wet: 0.7 },   // rua e praças: quase sem eco
    shore: { sec: 1.2, damp: 0.7, sfx: 0.1, music: 0.14, amb: 0.08, wet: 0.8 },    // praia e mar: eco distante
    water: { sec: 2.6, damp: 0.85, sfx: 0.34, music: 0.4, amb: 0.3, wet: 1 }       // fundo do mar: som abafado e longo
  };
  function buildIR(c, sp) {
    const len = Math.floor(c.sampleRate * sp.sec), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len, env = Math.pow(1 - t, 2.4) * (i < 400 ? i / 400 : 1);
        lp += (Math.random() * 2 - 1 - lp) * (1 - sp.damp * 0.9);   // filtro simples: agudos morrem antes, como no ar
        d[i] = lp * env;
      }
    }
    return buf;
  }
  function setSpace(name) {
    st.space = SPACES[name] ? name : "room";
    const c = st.ctx; if (!c || !st.conv) return;
    const sp = SPACES[st.space], now = c.currentTime;
    st.conv.buffer = buildIR(c, sp);
    st.wet.gain.setTargetAtTime(sp.wet, now, 0.1);
    st.sfxSend.gain.setTargetAtTime(sp.sfx, now, 0.1);
    st.musicSend.gain.setTargetAtTime(sp.music, now, 0.1);
    st.ambSend.gain.setTargetAtTime(sp.amb, now, 0.1);
  }

  // ---------------------------------------------------------------- sons ambiente
  // paisagens sonoras sem arquivos: camadas contínuas de ruído filtrado (vento, ondas, rumor) mais eventos sorteados
  // (pássaros, gaivotas, carros, grilos, bolhas…). Trocar de lugar faz uma passagem suave de uma para outra.
  let noiseBuf = null;
  const nbuf = (c) => {
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    const len = c.sampleRate * 4, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let l = 0; for (let i = 0; i < len; i++) { l = l * 0.5 + (Math.random() * 2 - 1) * 0.5; d[i] = l; }
    return (noiseBuf = b);
  };
  // ruído filtrado que sai pelo barramento do AMBIENTE (o noise() de cima vai sempre para os efeitos)
  function nz(c, out, { t = 0, d = 0.2, v = 0.05, f0 = 800, f1 = 800, q = 1 }) {
    const s = c.currentTime + t, src = c.createBufferSource(); src.buffer = nbuf(c);
    const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, s); fl.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), s + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), s + d * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, s + d);
    src.connect(fl); fl.connect(g); g.connect(out); src.start(s, Math.random() * 2, d + 0.1);
  }

  function bed(c, out, { type = "lowpass", f = 400, q = 0.7, v = 0.1, lfo = 0, depth = 0.5 }) {
    const src = c.createBufferSource(); src.buffer = nbuf(c); src.loop = true; src.loopStart = Math.random() * 2;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.value = v;
    src.connect(fl); fl.connect(g); g.connect(out); src.start();
    let osc = null;
    if (lfo) {   // o volume sobe e desce devagar (ondas, rajadas de vento)
      osc = c.createOscillator(); osc.frequency.value = lfo; const dg = c.createGain(); dg.gain.value = v * depth;
      osc.connect(dg); dg.connect(g.gain); osc.start();
    }
    return () => { try { src.stop(); if (osc) osc.stop(); } catch (e) { /* já parou */ } };
  }
  const ev = {
    chirp(c, out, pan) {   // pio de passarinho: dois ou três glissandos curtos e agudos
      const n = 2 + Math.floor(Math.random() * 3), f0 = 2400 + Math.random() * 1800, t0 = c.currentTime;
      for (let i = 0; i < n; i++) {
        const o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null, s = t0 + i * (0.09 + Math.random() * 0.05);
        o.type = "sine"; o.frequency.setValueAtTime(f0 + i * 120, s); o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.4), s + 0.07);
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.05, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
        o.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(out); } else g.connect(out);
        o.start(s); o.stop(s + 0.11);
      }
    },
    gull(c, out) {   // gaivota: grito agudo descendo, duas vezes
      const t0 = c.currentTime;
      [0, 0.38].forEach((dt, k) => {
        const o = c.createOscillator(), g = c.createGain(), s = t0 + dt; o.type = "sawtooth";
        o.frequency.setValueAtTime(1500 + k * 100, s); o.frequency.exponentialRampToValueAtTime(900, s + 0.32);
        const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 1500; fl.Q.value = 3;
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.04, s + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.36);
        o.connect(fl); fl.connect(g); g.connect(out); o.start(s); o.stop(s + 0.4);
      });
    },
    car(c, out) {   // carro passando ao longe: ruído que sobe e desce em frequência
      const s = c.currentTime, src = c.createBufferSource(); src.buffer = nbuf(c);
      const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 1.2; fl.frequency.setValueAtTime(200, s); fl.frequency.exponentialRampToValueAtTime(700, s + 1.4); fl.frequency.exponentialRampToValueAtTime(240, s + 3);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.09, s + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, s + 3);
      src.connect(fl); fl.connect(g); g.connect(out); src.start(s, Math.random() * 2, 3.2);
    },
    cricket(c, out) {   // grilos: pulsos rápidos num tom agudo
      const s = c.currentTime, f = 4200 + Math.random() * 600;
      for (let i = 0; i < 7; i++) { const o = c.createOscillator(), g = c.createGain(), t = s + i * 0.075; o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.06); }
    },
    owl(c, out) {   // coruja: dois "hu" graves
      const s = c.currentTime;
      [0, 0.55].forEach((dt) => { const o = c.createOscillator(), g = c.createGain(), t = s + dt; o.type = "sine"; o.frequency.setValueAtTime(390, t); o.frequency.exponentialRampToValueAtTime(330, t + 0.4); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.5); });
    },
    bubble(c, out) {
      const s = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = 380 + Math.random() * 500; o.type = "sine"; o.frequency.setValueAtTime(f, s); o.frequency.exponentialRampToValueAtTime(f * 2.2, s + 0.11);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.06, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.13); o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.15);
    },
    creak(c, out) {   // madeira do navio rangendo
      const s = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(110, s); o.frequency.linearRampToValueAtTime(150, s + 0.5); o.frequency.linearRampToValueAtTime(95, s + 1.1);
      const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 520; fl.Q.value = 6; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.035, s + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, s + 1.2);
      o.connect(fl); fl.connect(g); g.connect(out); o.start(s); o.stop(s + 1.3);
    },
    clink(c, out) {   // xícara tilintando
      const s = c.currentTime; [2600, 3900].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.03 / (i + 1), s + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.25); o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.3); });
    },
    beep(c, out) {   // monitor do hospital
      const s = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.025, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.16); o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.18);
    },
    tick(c, out) {   // relógio de parede
      const s = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "square"; o.frequency.value = 1800; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.012, s + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.03); o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.04);
    },
    weights(c, out) { const s = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(180, s); o.frequency.exponentialRampToValueAtTime(70, s + 0.18); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.05, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22); o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.25); },
    splash(c, out) { nz(c, out, { d: 0.5, v: 0.03, f0: 3000, f1: 800, q: 0.8 }); },

    // ---- lugares fechados: os 37 lugares que antes soavam todos iguais (um zumbido e um relógio)
    paper(c, out) { nz(c, out, { d: 0.22, v: 0.03, f0: 2600, f1: 900, q: 0.6 }); nz(c, out, { t: 0.3, d: 0.16, v: 0.02, f0: 2200, f1: 1100, q: 0.6 }); },   // folhear
    chair(c, out) { nz(c, out, { d: 0.5, v: 0.025, f0: 260, f1: 520, q: 3 }); },   // cadeira arrastando
    step(c, out) { for (let i = 0; i < 4; i++) nz(c, out, { t: i * 0.42, d: 0.09, v: 0.016 - i * 0.003, f0: 900, f1: 300, q: 1.5 }); },   // passos se afastando no salão
    murmur(c, out) {   // vozes ao longe, sem palavra nenhuma: ruído passa-banda com a frequência oscilando
      const s = c.currentTime, src = c.createBufferSource(); src.buffer = nbuf(c); src.loop = true;
      const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 3; fl.frequency.setValueAtTime(320, s);
      for (let i = 1; i <= 8; i++) fl.frequency.linearRampToValueAtTime(260 + Math.random() * 380, s + i * 0.28);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.03, s + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, s + 2.4);
      src.connect(fl); fl.connect(g); g.connect(out); src.start(s); src.stop(s + 2.5);
    },
    kids(c, out) {   // criança gritando longe: duas ou três notas agudas, curtas e soltas
      const s = c.currentTime, n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) { const o = c.createOscillator(), g = c.createGain(), t = s + i * (0.25 + Math.random() * 0.3), f = 700 + Math.random() * 500; o.type = "triangle"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (0.7 + Math.random() * 0.7), t + 0.3); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.36); }
    },
    chime(c, out) { [1975, 2637].forEach((f, i) => { const s = c.currentTime + i * 0.13, o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.03, s + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.7); o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.75); }); },   // sino da porta da loja
    register(c, out) { const s = c.currentTime; [1400, 1050].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = s + i * 0.07; o.type = "square"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12); }); nz(c, out, { t: 0.18, d: 0.25, v: 0.02, f0: 700, f1: 300, q: 2 }); },   // bipe do caixa e a gaveta
    sizzle(c, out) { nz(c, out, { d: 2.2, v: 0.03, f0: 3400, f1: 2600, q: 0.5 }); },                                                                      // fritura
    reel(c, out) { const s = c.currentTime; for (let i = 0; i < 10; i++) nz(c, out, { t: i * 0.055, d: 0.02, v: 0.012, f0: 1600, f1: 900, q: 4 }); void s; },   // projetor de cinema
    machine(c, out) { const s = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = 1240; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.016, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.14); o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.16); nz(c, out, { t: 0.5, d: 0.9, v: 0.012, f0: 420, f1: 380, q: 2 }); },   // aparelho de laboratório
    roar(c, out) { const s = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(120, s); o.frequency.exponentialRampToValueAtTime(75, s + 1.1); const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 500; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.035, s + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, s + 1.2); o.connect(fl); fl.connect(g); g.connect(out); o.start(s); o.stop(s + 1.3); },   // bicho grande ao longe
    dog(c, out) { const s = c.currentTime; [0, 0.22].forEach((dt) => { const o = c.createOscillator(), g = c.createGain(), t = s + dt; o.type = "sawtooth"; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.12); const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 700; fl.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + 0.17); }); },
    strum(c, out) { const s = c.currentTime; [329.63, 392, 493.88, 587.33].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = s + i * 0.045; o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.2); }); },   // cordas dedilhadas
    pot(c, out) { const s = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.setValueAtTime(70, s); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.02, s + 0.3); g.gain.setValueAtTime(0.02, s + 2); g.gain.exponentialRampToValueAtTime(0.0001, s + 2.6); o.connect(g); g.connect(out); o.start(s); o.stop(s + 2.7); nz(c, out, { d: 2.4, v: 0.008, f0: 900, f1: 700, q: 1 }); },   // torno de cerâmica
    chips(c, out) { const s = c.currentTime; for (let i = 0; i < 5; i++) nz(c, out, { t: i * 0.06 + Math.random() * 0.03, d: 0.06, v: 0.014, f0: 2600, f1: 1400, q: 3 }); void s; },   // fichas caindo
    piece(c, out) { nz(c, out, { d: 0.05, v: 0.02, f0: 1400, f1: 700, q: 3 }); const s = c.currentTime + 0.001, o = c.createOscillator(), g = c.createGain(); o.type = "square"; o.frequency.value = 2200; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.01, s + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.04); o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.05); },   // peça batendo no tabuleiro
    distbell(c, out) { const s = c.currentTime; [523.25, 392].forEach((f, i) => { const t = s + i * 0.9; [1, 2, 3].forEach((h, k) => { const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f * h; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022 / (k + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2 / (k + 1)); o.connect(g); g.connect(out); o.start(t); o.stop(t + 2.4); }); }); }   // sino ao longe
  };
  // receitas: camadas contínuas + eventos [nome, intervalo mínimo, intervalo máximo em segundos, chance de ir à esquerda/direita]
  const AMB = {
    street: { space: "open", beds: [{ f: 160, v: 0.05, lfo: 0.07 }, { type: "bandpass", f: 900, q: 0.5, v: 0.012, lfo: 0.13 }], events: [["chirp", 2.5, 7], ["car", 9, 20], ["chirp", 6, 14]] },
    park: { space: "open", beds: [{ f: 500, v: 0.02, lfo: 0.1 }, { type: "bandpass", f: 2500, q: 0.4, v: 0.008, lfo: 0.2 }], events: [["chirp", 1.2, 4], ["chirp", 2, 6], ["splash", 8, 16]] },
    neighborhood: { space: "open", beds: [{ f: 300, v: 0.03, lfo: 0.09 }], events: [["chirp", 2, 6], ["chirp", 4, 10], ["car", 20, 40]] },
    beach: { space: "shore", beds: [{ f: 700, v: 0.09, lfo: 0.11, depth: 0.85 }, { type: "highpass", f: 3200, q: 0.4, v: 0.012, lfo: 0.11, depth: 0.9 }], events: [["gull", 5, 12], ["chirp", 9, 18]] },
    sea: { space: "shore", beds: [{ f: 520, v: 0.1, lfo: 0.09, depth: 0.8 }, { f: 120, v: 0.05, lfo: 0.05 }], events: [["gull", 6, 14], ["creak", 9, 18]] },
    ship: { space: "shore", beds: [{ f: 420, v: 0.08, lfo: 0.09, depth: 0.8 }], events: [["creak", 3, 8], ["gull", 10, 20]] },
    ghost: { space: "hall", beds: [{ f: 90, v: 0.07, lfo: 0.04 }, { type: "bandpass", f: 700, q: 4, v: 0.008, lfo: 0.06 }], events: [["creak", 4, 9], ["owl", 12, 25]] },
    underwater: { space: "water", beds: [{ f: 260, v: 0.08, lfo: 0.06 }, { f: 90, v: 0.06 }], events: [["bubble", 0.7, 2.5], ["bubble", 1.5, 4]] },
    night: { space: "open", beds: [{ f: 200, v: 0.03, lfo: 0.06 }], events: [["cricket", 1.2, 3], ["cricket", 2, 5], ["owl", 14, 30]] },
    cafe: { space: "hall", beds: [{ type: "bandpass", f: 500, q: 0.6, v: 0.03, lfo: 0.4, depth: 0.6 }], events: [["clink", 4, 10]] },
    hospital: { space: "hall", beds: [{ f: 220, v: 0.02 }], events: [["beep", 2.2, 2.6]] },
    gym: { space: "hall", beds: [{ f: 260, v: 0.025 }], events: [["weights", 3, 8]] },
    mall: { space: "hall", beds: [{ type: "bandpass", f: 600, q: 0.5, v: 0.028, lfo: 0.2 }], events: [["clink", 9, 20]] },
    home: { space: "room", beds: [{ f: 220, v: 0.012 }], events: [["tick", 1, 1], ["chirp", 10, 22]] },
    room: { space: "room", beds: [{ f: 200, v: 0.01 }], events: [["tick", 1, 1]] },
    // lugares fechados com cara própria: até a 5.5 os 37 lugares abaixo caíam todos no "room" (um zumbido e um relógio)
    library: { space: "hall", beds: [{ f: 170, v: 0.01 }], events: [["paper", 4, 11], ["chair", 12, 26], ["paper", 9, 20]] },
    museum: { space: "hall", beds: [{ f: 180, v: 0.014 }], events: [["murmur", 7, 16], ["chair", 14, 30], ["step", 5, 12]] },
    school: { space: "hall", beds: [{ f: 240, v: 0.016 }], events: [["kids", 3, 9], ["chair", 9, 20], ["distbell", 40, 80]] },
    court: { space: "hall", beds: [{ f: 140, v: 0.016 }], events: [["paper", 6, 14], ["chair", 11, 24], ["distbell", 45, 90]] },
    clinic: { space: "room", beds: [{ f: 210, v: 0.012 }], events: [["murmur", 9, 20], ["chair", 12, 26], ["tick", 1, 1]] },
    store: { space: "room", beds: [{ f: 240, v: 0.014 }, { type: "bandpass", f: 700, q: 0.6, v: 0.006, lfo: 0.3 }], events: [["chime", 10, 24], ["register", 14, 30]] },
    market: { space: "hall", beds: [{ type: "bandpass", f: 520, q: 0.5, v: 0.026, lfo: 0.25 }], events: [["murmur", 4, 10], ["register", 7, 16], ["chime", 18, 40]] },
    food: { space: "hall", beds: [{ type: "bandpass", f: 560, q: 0.6, v: 0.022, lfo: 0.3 }], events: [["sizzle", 5, 12], ["clink", 6, 14], ["murmur", 8, 18]] },
    cinema: { space: "hall", beds: [{ f: 130, v: 0.02 }, { type: "bandpass", f: 1200, q: 2, v: 0.006 }], events: [["reel", 2, 4], ["murmur", 15, 35]] },
    lab: { space: "hall", beds: [{ f: 320, v: 0.016 }], events: [["machine", 3, 8], ["beep", 6, 14], ["paper", 15, 32]] },
    zoo: { space: "open", beds: [{ f: 420, v: 0.022, lfo: 0.1 }], events: [["chirp", 2, 6], ["roar", 12, 28], ["kids", 8, 18]] },
    pets: { space: "room", beds: [{ f: 260, v: 0.014 }], events: [["dog", 6, 15], ["chirp", 4, 10], ["chime", 20, 45]] },
    musicshop: { space: "room", beds: [{ f: 200, v: 0.01 }], events: [["strum", 6, 15], ["chime", 22, 48]] },
    craft: { space: "room", beds: [{ f: 230, v: 0.012 }], events: [["pot", 8, 18], ["clink", 10, 22]] },
    casino: { space: "hall", beds: [{ type: "bandpass", f: 640, q: 0.5, v: 0.024, lfo: 0.35 }], events: [["chips", 2.5, 7], ["murmur", 6, 14], ["register", 12, 26]] },
    toys: { space: "room", beds: [{ f: 280, v: 0.014 }], events: [["kids", 2.5, 7], ["chime", 18, 40]] },
    chess: { space: "room", beds: [{ f: 190, v: 0.01 }], events: [["piece", 3, 9], ["tick", 1, 1], ["chair", 20, 45]] },
    garden: { space: "room", beds: [{ f: 420, v: 0.016, lfo: 0.12 }], events: [["chirp", 3, 8], ["splash", 9, 20]] },
    memorial: { space: "open", beds: [{ f: 320, v: 0.026, lfo: 0.08, depth: 0.7 }], events: [["distbell", 25, 55], ["chirp", 8, 18]] },
    observatory: { space: "open", beds: [{ f: 150, v: 0.026, lfo: 0.05 }], events: [["cricket", 3, 8], ["machine", 18, 40], ["owl", 20, 45]] },
    university: { space: "hall", beds: [{ f: 200, v: 0.016 }], events: [["murmur", 5, 12], ["chair", 10, 22], ["paper", 12, 26]] }
  };
  function stopAmbient() {
    const a = st.amb; if (!a) return;
    st.amb = null; clearTimeout(a.timer);
    const c = st.ctx; if (c) { const g = a.out; g.gain.setTargetAtTime(0, c.currentTime, 0.4); setTimeout(() => { a.stops.forEach((f) => f()); try { g.disconnect(); } catch (e) { /* nada */ } }, 1800); }
  }
  function ambient(name) {
    if (st.ambName === name) return; st.ambName = name;
    stopAmbient();
    const rec = AMB[name]; if (!rec) return;
    const c = ensure(); if (!c) { st.ambPending = name; return; }
    setSpace(rec.space);
    const out = c.createGain(); out.gain.value = 0; out.connect(st.ambBus); out.gain.setTargetAtTime(1, c.currentTime, 0.6);
    const a = { name, out, stops: rec.beds.map((b) => bed(c, out, b)), timer: 0 };
    st.amb = a;
    const loop = (e) => {
      const [n, lo, hi] = e;
      a.timer = setTimeout(() => { if (st.amb !== a) return; if (!st.muted && !document.hidden) ev[n](c, out, Math.random() * 1.6 - 0.8); loop(e); }, (lo + Math.random() * (hi - lo)) * 1000);
    };
    rec.events.forEach((e, i) => { const first = setTimeout(() => { if (st.amb === a) loop(e); }, 400 + i * 700); a.stops.push(() => clearTimeout(first)); });
  }

  // ---------------------------------------------------------------- liberação pelo primeiro gesto
  function unlock() {
    if (st.unlocked || !AC) return;
    st.unlocked = true;
    const c = ensure();
    if (c && c.state === "suspended") c.resume();
    if (c && !st.opened) { st.opened = true; play("sparkle"); }   // o brilho de abertura, no primeiro toque (o navegador só libera o som depois dele)
    if (st.mood) startMusic();
    if (st.ambPending) { const n = st.ambPending; st.ambPending = null; st.ambName = null; ambient(n); }
  }

  ["pointerdown", "keydown", "touchstart"].forEach((evt) =>
    document.addEventListener(evt, unlock, { once: false, passive: true }));

  document.addEventListener("visibilitychange", () => {
    if (!st.ctx) return;
    if (document.hidden) st.ctx.suspend();
    else st.ctx.resume();
  });

  window.Sound = {
    play, alarm, music, stopMusic, setVolume, unlock, motif, ambient, setSpace, foot, tension,
    get moods() { return Object.keys(MOODS); },
    get surfaces() { return Object.keys(SURF); },
    get ambientName() { return st.ambName || null; },
    get ambients() { return Object.keys(AMB); },
    setInstrument(name) { if (INSTR[name]) st.instr = name; },
    get instrument() { return st.instr; },
    // cada paciente tem o seu tom (0 a 4 semitons para cima) na música da consulta
    setKey(seed) { st.key = [0, 2, 3, 5, 7][Math.abs(seed | 0) % 5]; },
    get supported() { return Boolean(AC); },
    _state: st, _tick: tick   // usados nos testes
  };
})();

"use strict";

// ===========================================================================
// Ludoteca da Mente: 9 minijogos inspirados nos testes que a neuropsicologia usa de verdade
// (Schulte, Trilhas A/B, Stroop, Dígitos, Simon/Corsi, Go/No-Go, 1-back, pares de emoções, respiração guiada).
// Cada jogo mostra, no fim, que função da mente ele exercita. Recompensa (moedas e experiência) só na primeira
// partida de cada jogo por dia; as demais valem pelo recorde. Textos em pt/en/es (outros idiomas caem no inglês).
// ===========================================================================
const Minigames = (() => {
  const P = (o) => I18N.pick(o);
  const cleaners = [];
  let cur = null;
  let SPEED = 1;   // 1 = normal; os testes aceleram os relógios dos jogos
  let trilha = false;   // false = Ludoteca (neuropsicologia), true = Oficina Clínica (psicologia)
  const later = (fn, ms) => { const id = setTimeout(fn, ms * SPEED); cleaners.push(() => clearTimeout(id)); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); cleaners.push(() => clearInterval(id)); return id; };
  const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const dayKey = () => `${state.week || 1}:${state.dayIndex}`;
  const now = () => performance.now();

  let actx = null;
  function beep(freq, ms = 220) {
    if (settings.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = freq; g.gain.value = 0.0001 + 0.12 * (settings.sfx === undefined ? 0.7 : settings.sfx);
      o.connect(g); g.connect(actx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + ms / 1000); o.stop(actx.currentTime + ms / 1000 + 0.02);
    } catch (e) { /* sem áudio */ }
  }

  // ---------------------------------------------------------------- jogos
  const GAMES = [
    {
      id: "schulte", emoji: "🔢", test: "Schulte",
      name: L("Tabela de Schulte", "Schulte table", "Tabla de Schulte"),
      desc: L("Toque nos números de 1 a 25, na ordem, o mais rápido que puder.", "Tap the numbers 1 to 25 in order, as fast as you can.", "Toca los números del 1 al 25, en orden, lo más rápido que puedas."),
      edu: L("Treina atenção visual e velocidade de busca. É usada para avaliar atenção sustentada e rastreio visual.", "Trains visual attention and search speed. Used to assess sustained attention and visual scanning.", "Entrena la atención visual y la velocidad de búsqueda. Se usa para evaluar atención sostenida y rastreo visual."),
      run(root, done) {
        const grid = el("div", "mg-grid five"), info = el("p", "mg-info", "1");
        root.append(info, grid);
        let next = 1, t0 = 0;
        shuffle(Array.from({ length: 25 }, (_, i) => i + 1)).forEach((n) => {
          const b = el("button", "mg-cell", String(n)); b.type = "button";
          b.addEventListener("click", () => {
            if (!t0) t0 = now();
            if (n === next) { b.classList.add("done"); b.disabled = true; sfx("click"); next++; info.textContent = next <= 25 ? String(next) : "✓"; if (next > 25) { const s = (now() - t0) / 1000; done({ stars: s <= 45 ? 3 : s <= 75 ? 2 : 1, detail: `${s.toFixed(1)} s` }); } }
            else { b.classList.add("bad"); sfx("deny"); setTimeout(() => b.classList.remove("bad"), 300); }
          });
          grid.appendChild(b);
        });
      }
    },
    {
      id: "trail", emoji: "🧭", test: "TMT",
      name: L("Trilhas A e B", "Trail making A and B", "Trazado A y B"),
      desc: L("A: ligue 1-2-3… em ordem. B: alterne número e letra (1-A-2-B…).", "A: connect 1-2-3… in order. B: alternate number and letter (1-A-2-B…).", "A: une 1-2-3… en orden. B: alterna número y letra (1-A-2-B…)."),
      edu: L("Espelha o Teste de Trilhas (TMT), que mede atenção, velocidade e flexibilidade mental (alternar regras é a parte B).", "Mirrors the Trail Making Test (TMT), which measures attention, speed and mental flexibility (switching rules is part B).", "Refleja el Test del Trazo (TMT), que mide atención, velocidad y flexibilidad mental (alternar reglas es la parte B)."),
      run(root, done) {
        const info = el("p", "mg-info"), area = el("div", "mg-trail");
        root.append(info, area);
        const seqA = Array.from({ length: 10 }, (_, i) => String(i + 1)), seqB = ["1", "A", "2", "B", "3", "C", "4", "D", "5", "E"];
        let part = 0, next = 0, t0 = 0, wrong = 0, total = 0, seq = seqA;
        function place(labels) {
          area.textContent = ""; const pts = [];
          labels.forEach((lb) => {
            let p; for (let k = 0; k < 200; k++) { p = [8 + Math.random() * 84, 8 + Math.random() * 84]; if (pts.every((q) => Math.hypot(q[0] - p[0], (q[1] - p[1]) * 0.9) > 15)) break; }
            pts.push(p);
            const b = el("button", "mg-node", lb); b.type = "button"; b.style.left = p[0] + "%"; b.style.top = p[1] + "%";
            b.addEventListener("click", () => {
              if (!t0) t0 = now();
              if (lb === seq[next]) { b.classList.add("done"); sfx("click"); next++; info.textContent = next < seq.length ? `${part ? "B" : "A"}: → ${seq[next]}` : ""; if (next >= seq.length) finishPart(); }
              else { wrong++; b.classList.add("bad"); sfx("deny"); setTimeout(() => b.classList.remove("bad"), 250); }
            });
            area.appendChild(b);
          });
        }
        function finishPart() {
          total += (now() - t0) / 1000; t0 = 0; next = 0;
          if (part === 0) { part = 1; seq = seqB; info.textContent = P(L("Parte B: alterne número e letra!", "Part B: alternate number and letter!", "Parte B: ¡alterna número y letra!")); later(() => { place(seqB); info.textContent = "B: → 1"; }, 1200); area.textContent = ""; }
          else { const s = total + wrong * 2; done({ stars: s <= 45 ? 3 : s <= 75 ? 2 : 1, detail: `${s.toFixed(1)} s (${wrong} ${P(L("erros", "errors", "errores"))})` }); }
        }
        info.textContent = "A: → 1"; place(seqA);
      }
    },
    {
      id: "stroop", emoji: "🎨", test: "Stroop",
      name: L("Cores e palavras (Stroop)", "Colors and words (Stroop)", "Colores y palabras (Stroop)"),
      desc: L("Toque na COR da tinta, não na palavra escrita. 20 rodadas.", "Tap the INK color, not the written word. 20 rounds.", "Toca el COLOR de la tinta, no la palabra escrita. 20 rondas."),
      edu: L("É o efeito Stroop: ler é automático e atrapalha nomear a cor. Mede controle inibitório e atenção seletiva.", "The Stroop effect: reading is automatic and interferes with naming the color. Measures inhibitory control and selective attention.", "Es el efecto Stroop: leer es automático y estorba al nombrar el color. Mide control inhibitorio y atención selectiva."),
      run(root, done) {
        const COLORS = [
          { k: "red", c: "#d9453a", n: L("VERMELHO", "RED", "ROJO") }, { k: "green", c: "#2f9b4a", n: L("VERDE", "GREEN", "VERDE") },
          { k: "blue", c: "#2f6bd8", n: L("AZUL", "BLUE", "AZUL") }, { k: "yellow", c: "#d9a51f", n: L("AMARELO", "YELLOW", "AMARILLO") }
        ];
        const word = el("div", "mg-word"), info = el("p", "mg-info"), pad = el("div", "mg-choices four");
        root.append(info, word, pad);
        let i = 0, ok = 0, rts = [], t0 = 0, cur2 = null;
        COLORS.forEach((col) => { const b = el("button", "mg-choice", P(col.n)); b.type = "button"; b.addEventListener("click", () => answer(col)); pad.appendChild(b); });
        function show() {
          if (i >= 20) { const acc = ok / 20, rt = rts.reduce((a, b) => a + b, 0) / (rts.length || 1); return done({ stars: acc >= 0.9 && rt < 1500 ? 3 : acc >= 0.8 ? 2 : acc >= 0.5 ? 1 : 0, detail: `${ok}/20 · ${(rt / 1000).toFixed(2)} s` }); }
          info.textContent = `${i + 1}/20`;
          const w = COLORS[Math.floor(Math.random() * 4)]; let ink = w; if (Math.random() < 0.65) while (ink === w) ink = COLORS[Math.floor(Math.random() * 4)];
          cur2 = ink; word.textContent = P(w.n); word.style.color = ink.c; t0 = now();
        }
        function answer(col) { if (!cur2) return; const good = col === cur2; if (good) { ok++; sfx("good"); } else sfx("deny"); rts.push(now() - t0); cur2 = null; i++; later(show, 250); word.textContent = good ? "✓" : "✗"; word.style.color = good ? "#2f9b4a" : "#a23a3a"; }
        show();
      }
    },
    {
      id: "digits", emoji: "🔟", test: "Dígitos",
      name: L("Memória de dígitos", "Digit span", "Span de dígitos"),
      desc: L("Memorize a sequência de números e repita. Ela cresce a cada acerto.", "Memorize the number sequence and repeat it. It grows with each success.", "Memoriza la secuencia de números y repítela. Crece con cada acierto."),
      edu: L("Espelha o span de dígitos das escalas Wechsler: na ordem direta mede atenção; na ordem inversa, memória de trabalho.", "Mirrors the digit span of the Wechsler scales: forward measures attention; backward, working memory.", "Refleja el span de dígitos de las escalas Wechsler: en orden directo mide atención; inverso, memoria de trabajo."),
      run(root, done) {
        const screen = el("div", "mg-digit"), info = el("p", "mg-info"), pad = el("div", "mg-keypad");
        root.append(info, screen, pad);
        let back = false, len = 3, seq = [], typed = [], fails = 0, best = 0, acceptInput = false;
        const pick = el("div", "mg-row");
        [[false, L("Ordem direta", "Forward", "Orden directo")], [true, L("Ordem inversa", "Backward", "Orden inverso")]].forEach(([b, name]) => { const btn = el("button", "pill-btn", P(name)); btn.type = "button"; btn.addEventListener("click", () => { back = b; pick.remove(); round(); }); pick.appendChild(btn); });
        root.insertBefore(pick, info);
        [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"].forEach((k) => {
          const b = el("button", "mg-key", String(k)); b.type = "button";
          b.addEventListener("click", () => {
            if (!acceptInput) return; sfx("click");
            if (k === "⌫") typed.pop(); else if (k === "OK") return check(); else if (typed.length < len) typed.push(k);
            screen.textContent = typed.join(" ");
          });
          pad.appendChild(b);
        });
        function round() {
          acceptInput = false; typed = []; screen.textContent = ""; pad.classList.add("off");
          seq = Array.from({ length: len }, () => Math.floor(Math.random() * 10));
          info.textContent = `${P(L("Memorize", "Memorize", "Memoriza"))} · ${len}`;
          seq.forEach((d, i) => { later(() => { screen.textContent = String(d); beep(300 + d * 40, 140); later(() => { screen.textContent = ""; }, 550); }, 700 + i * 900); });
          later(() => { acceptInput = true; pad.classList.remove("off"); info.textContent = P(back ? L("Digite AO CONTRÁRIO", "Type it BACKWARD", "Escríbelo AL REVÉS") : L("Digite na ordem", "Type it in order", "Escríbelo en orden")); screen.textContent = ""; }, 700 + len * 900);
        }
        function check() {
          if (!acceptInput) return; acceptInput = false;
          const want = back ? seq.slice().reverse() : seq, good = want.length === typed.length && want.every((d, i) => d === typed[i]);
          if (good) { sfx("good"); best = len; fails = 0; len++; if (len > 9) return finish(); screen.textContent = "✓"; later(round, 900); }
          else { sfx("deny"); fails++; screen.textContent = "✗ " + want.join(" "); if (fails >= 2) later(finish, 1400); else later(round, 1600); }
        }
        function finish() { const f = back ? [3, 4, 6] : [3, 5, 7]; done({ stars: best >= f[2] ? 3 : best >= f[1] ? 2 : best >= f[0] ? 1 : 0, detail: `${best} ${P(L("dígitos", "digits", "dígitos"))}` }); }
      }
    },
    ...["simon", "corsi"].map((kind) => ({
      id: kind, emoji: kind === "simon" ? "🟢" : "🟦", test: kind === "simon" ? "Simon" : "Corsi",
      name: kind === "simon" ? L("Simon (sequência de cores)", "Simon (color sequence)", "Simon (secuencia de colores)") : L("Blocos de Corsi", "Corsi blocks", "Bloques de Corsi"),
      desc: kind === "simon" ? L("Repita a sequência de luzes e sons. A cada rodada ela ganha um passo.", "Repeat the sequence of lights and sounds. Each round adds a step.", "Repite la secuencia de luces y sonidos. Cada ronda suma un paso.") : L("Repita a ordem em que os blocos acenderam.", "Repeat the order in which the blocks lit up.", "Repite el orden en que se encendieron los bloques."),
      edu: kind === "simon" ? L("Treina memória sequencial de curto prazo, base de muitas tarefas do dia a dia.", "Trains short-term sequential memory, the basis of many everyday tasks.", "Entrena la memoria secuencial a corto plazo, base de muchas tareas cotidianas.") : L("Os blocos de Corsi medem a memória de trabalho visuoespacial, o \"caderno de rascunho\" para lugares e posições.", "Corsi blocks measure visuospatial working memory, the \"scratchpad\" for places and positions.", "Los bloques de Corsi miden la memoria de trabajo visuoespacial, el \"cuaderno de borrador\" para lugares y posiciones."),
      run(root, done) {
        const n = kind === "simon" ? 4 : 9, cols = ["#3f9b4f", "#d9453a", "#e2b84a", "#3f6fd8"], freqs = [262, 330, 392, 523];
        const info = el("p", "mg-info"), grid = el("div", "mg-pads " + kind);
        root.append(info, grid);
        const pads = Array.from({ length: n }, (_, i) => { const b = el("button", "mg-pad"); b.type = "button"; if (kind === "simon") b.style.setProperty("--c", cols[i]); b.addEventListener("click", () => tap(i)); grid.appendChild(b); return b; });
        let seq = [], pos = 0, accept = false;
        const light = (i, ms = 420) => { pads[i].classList.add("on"); beep(kind === "simon" ? freqs[i] : 220 + i * 45, ms - 80); later(() => pads[i].classList.remove("on"), ms - 80); };
        function play() {
          accept = false; pos = 0; info.textContent = `${P(L("Rodada", "Round", "Ronda"))} ${seq.length}`;
          seq.forEach((v, i) => later(() => light(v), 700 + i * 620));
          later(() => { accept = true; info.textContent = P(L("Sua vez!", "Your turn!", "¡Tu turno!")); }, 700 + seq.length * 620);
        }
        function add() { seq.push(Math.floor(Math.random() * n)); play(); }
        function tap(i) {
          if (!accept) return; light(i, 300);
          if (i !== seq[pos]) { accept = false; sfx("deny"); const r = seq.length - 1, f = kind === "simon" ? [3, 6, 9] : [3, 5, 7]; return later(() => done({ stars: r >= f[2] ? 3 : r >= f[1] ? 2 : r >= f[0] ? 1 : 0, detail: `${r} ${P(L("rodadas", "rounds", "rondas"))}` }), 600); }
          pos++; if (pos >= seq.length) { accept = false; sfx("good"); later(add, 800); }
        }
        later(add, 500);
      }
    })),
    {
      id: "gonogo", emoji: "🚦", test: "Go/No-Go",
      name: L("Vai / Não vai (Go/No-Go)", "Go / No-Go", "Ve / No ve (Go/No-Go)"),
      desc: L("Toque quando o círculo for VERDE. Se for VERMELHO, segure o impulso!", "Tap when the circle is GREEN. If it is RED, hold back!", "Toca cuando el círculo sea VERDE. Si es ROJO, ¡contén el impulso!"),
      edu: L("Tarefa clássica de controle de resposta: mede impulsividade e atenção. Muito usada em TDAH.", "A classic response-control task: measures impulsivity and attention. Widely used in ADHD.", "Tarea clásica de control de respuesta: mide impulsividad y atención. Muy usada en TDAH."),
      run(root, done) {
        const info = el("p", "mg-info"), dot = el("button", "mg-dot");
        dot.type = "button"; root.append(info, dot);
        const N = 30, plan = shuffle(Array.from({ length: N }, (_, k) => k % 10 < 7));   // 70% verdes ("vai"), 30% vermelhos ("não vai")
        let i = 0, good = 0, comm = 0, go = false, answered = true;
        dot.addEventListener("click", () => {
          if (answered) return; answered = true;
          if (go) { good++; sfx("good"); dot.classList.add("hit"); } else { comm++; sfx("deny"); dot.classList.add("miss"); }
        });
        function trial() {
          dot.className = "mg-dot"; dot.textContent = "";
          if (i >= N) { const acc = good / N; return done({ stars: acc >= 0.9 ? 3 : acc >= 0.75 ? 2 : acc >= 0.5 ? 1 : 0, detail: `${Math.round(acc * 100)}% · ${comm} ${P(L("toques no vermelho", "taps on red", "toques en rojo"))}` }); }
          later(() => {
            go = plan[i]; answered = false; dot.classList.add(go ? "green" : "red"); dot.textContent = go ? "GO" : "STOP"; info.textContent = `${i + 1}/${N}`;
            later(() => { if (!answered) { answered = true; if (!go) good++; } i++; trial(); }, 850);
          }, 400 + Math.random() * 400);
        }
        trial();
      }
    },
    {
      id: "nback", emoji: "🔤", test: "N-back",
      name: L("1-back (mesma letra?)", "1-back (same letter?)", "1-back (¿misma letra?)"),
      desc: L("Uma letra aparece por vez. Toque em IGUAL se for a mesma da anterior.", "One letter appears at a time. Tap SAME if it matches the previous one.", "Aparece una letra a la vez. Toca IGUAL si coincide con la anterior."),
      edu: L("O N-back exercita a memória de trabalho: manter e atualizar informação enquanto novas chegam.", "The N-back exercises working memory: holding and updating information as new items arrive.", "El N-back ejercita la memoria de trabajo: mantener y actualizar información mientras llegan nuevos datos."),
      run(root, done) {
        const info = el("p", "mg-info"), big = el("div", "mg-word big"), btn = el("button", "pill-btn mg-same", P(L("IGUAL", "SAME", "IGUAL")));
        btn.type = "button"; root.append(info, big, btn);
        const N = 24, letters = "BCDFGHJKLM".split(""), seq = []; let tapped = false, i = 0, hits = 0, fa = 0, targets = 0;
        for (let k = 0; k < N; k++) seq.push(k > 0 && Math.random() < 0.3 ? seq[k - 1] : pick(letters, seq[k - 1]));
        function pick(a, not) { let x; do { x = a[Math.floor(Math.random() * a.length)]; } while (x === not); return x; }
        btn.addEventListener("click", () => { if (tapped || i === 0) return; tapped = true; if (seq[i - 1] === seq[i - 2]) { hits++; sfx("good"); big.classList.add("ok"); } else { fa++; sfx("deny"); big.classList.add("no"); } });
        function step() {
          if (i >= N) { const acc = Math.max(0, hits - fa) / Math.max(1, targets); return done({ stars: acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : acc >= 0.35 ? 1 : 0, detail: `${hits}/${targets} · ${fa} ${P(L("falsos alarmes", "false alarms", "falsas alarmas"))}` }); }
          big.className = "mg-word big"; big.textContent = seq[i]; tapped = false; info.textContent = `${i + 1}/${N}`; if (i > 0 && seq[i] === seq[i - 1]) targets++;
          i++; later(() => { big.textContent = ""; later(step, 250); }, 1450);
        }
        step();
      }
    },
    {
      id: "pairs", emoji: "😊", test: "Emoções",
      name: L("Pares de emoções", "Emotion pairs", "Pares de emociones"),
      desc: L("Encontre os pares de rostos iguais com o menor número de jogadas.", "Find the matching pairs of faces in as few moves as possible.", "Encuentra los pares de rostros iguales con el menor número de jugadas."),
      edu: L("Junta memória visual e reconhecimento de emoções, base da empatia e da leitura social.", "Combines visual memory and emotion recognition, the base of empathy and social reading.", "Une memoria visual y reconocimiento de emociones, base de la empatía y la lectura social."),
      run(root, done) {
        const info = el("p", "mg-info", "0"), grid = el("div", "mg-grid four");
        root.append(info, grid);
        const faces = ["😀", "😢", "😡", "😨", "🤢", "😲", "😴", "🥰"];
        let open = [], moves = 0, found = 0, lock = false;
        shuffle(faces.concat(faces)).forEach((f) => {
          const c = el("button", "mg-card"); c.type = "button"; c.dataset.f = f;
          c.addEventListener("click", () => {
            if (lock || c.classList.contains("up") || c.classList.contains("done")) return;
            c.classList.add("up"); c.textContent = f; sfx("click"); open.push(c);
            if (open.length === 2) {
              moves++; info.textContent = String(moves); lock = true;
              if (open[0].dataset.f === open[1].dataset.f) { open.forEach((x) => x.classList.add("done")); open = []; lock = false; found++; sfx("good"); if (found === 8) later(() => done({ stars: moves <= 14 ? 3 : moves <= 20 ? 2 : 1, detail: `${moves} ${P(L("jogadas", "moves", "jugadas"))}` }), 500); }
              else later(() => { open.forEach((x) => { x.classList.remove("up"); x.textContent = ""; }); open = []; lock = false; }, 800);
            }
          });
          grid.appendChild(c);
        });
      }
    },
    {
      id: "breath", emoji: "🌬️", test: "Respiração", energy: 3,
      name: L("Respiração guiada", "Guided breathing", "Respiración guiada"),
      desc: L("Acompanhe o círculo: inspire, segure e solte devagar. 4 ciclos.", "Follow the circle: breathe in, hold, and let go slowly. 4 cycles.", "Sigue el círculo: inspira, sostén y suelta despacio. 4 ciclos."),
      edu: L("A expiração longa ativa o sistema parassimpático e ajuda a baixar a ansiedade. Uma técnica simples para quem atende e para quem é atendido.", "A long exhale activates the parasympathetic system and helps lower anxiety. A simple technique for those who help and those who are helped.", "La exhalación larga activa el sistema parasimpático y ayuda a bajar la ansiedad. Una técnica simple para quien atiende y quien es atendido."),
      run(root, done) {
        const orb = el("div", "mg-orb"), msg = el("p", "mg-info big"), cyc = el("p", "mg-info");
        root.append(cyc, orb, msg);
        let n = 0; const CYCLES = 4;
        const phases = [[L("Inspire…", "Breathe in…", "Inspira…"), 4000, 1], [L("Segure", "Hold", "Sostén"), 3000, 1], [L("Solte devagar…", "Let go slowly…", "Suelta despacio…"), 6000, 0.45]];
        function phase(k) {
          if (n >= CYCLES) return done({ stars: 3, detail: P(L("Respirou com calma.", "You breathed calmly.", "Respiraste con calma.")) });
          const [name, ms, scale] = phases[k]; msg.textContent = P(name); cyc.textContent = `${n + 1}/${CYCLES}`;
          orb.style.transition = `transform ${ms}ms ease-in-out`; orb.style.transform = `scale(${scale})`;
          if (k === 0) beep(330, 400); else if (k === 2) beep(262, 400);
          later(() => { if (k === 2) { n++; phase(0); } else phase(k + 1); }, ms);
        }
        orb.style.transform = "scale(0.45)"; later(() => phase(0), 600);
      }
    }
  ];
  const byId = (id) => GAMES.find((g) => g.id === id);

  // ---------------------------------------------------------------- moldura: menu, jogo, resultado
  const T = {
    title: L("🧩 Ludoteca da Mente", "🧩 Mind Playroom", "🧩 Ludoteca de la Mente"),
    titleClin: L("🩺 Oficina Clínica", "🩺 Clinical Workshop", "🩺 Taller Clínico"),
    pickClin: L("Cinco exercícios do ofício. Não são testes da mente: são as coisas que um psicólogo faz — escutar, triar risco, desenhar a família, devolver em linguagem simples e decidir com o Código na mão.", "Five exercises of the craft. Not tests of the mind: the things a psychologist does — listening, triaging risk, drawing the family, giving feedback in plain language and deciding with the Code in hand.", "Cinco ejercicios del oficio. No son pruebas de la mente: son las cosas que hace un psicólogo: escuchar, triar riesgo, dibujar la familia, devolver en lenguaje simple y decidir con el Código en la mano."),
    pick: L("Escolha um jogo. Cada um treina uma função da mente.", "Pick a game. Each one trains a mind function.", "Elige un juego. Cada uno entrena una función de la mente."),
    best: L("Recorde", "Best", "Récord"), first: L("Primeira partida de hoje: ganha moedas e experiência.", "First play today: earns coins and experience.", "Primera partida de hoy: gana monedas y experiencia."),
    again: L("Jogar de novo", "Play again", "Jugar otra vez"), menu: L("Outros jogos", "Other games", "Otros juegos"), start: L("Começar", "Start", "Empezar"),
    reward: L("+{c} moedas · +{x} de experiência", "+{c} coins · +{x} experience", "+{c} monedas · +{x} de experiencia"), noreward: L("Você já ganhou o prêmio deste jogo hoje; agora vale pelo recorde.", "You already got today's reward for this game; now it counts for your record.", "Ya ganaste el premio de este juego hoy; ahora cuenta para tu récord."),
    energy: L("+{e} de energia", "+{e} energy", "+{e} de energía"), what: L("O que isto treina", "What this trains", "Qué entrena esto")
  };
  const fmtL = (o, v) => P(o).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const body = () => $("mg-body");
  function stop() { while (cleaners.length) cleaners.pop()(); }

  function menu(clinico) {
    stop(); cur = null;
    trilha = Boolean(clinico);
    const b = body(); b.textContent = "";
    $("mg-title").textContent = trilha ? P(T.titleClin) : P(T.title);
    b.appendChild(el("p", "opt-help", trilha ? P(T.pickClin) : P(T.pick)));
    const g = el("div", "mg-menu");
    daTrilha(trilha).forEach((gm) => {
      const best = (state.mg && state.mg.best && state.mg.best[gm.id]) || 0;
      const c = el("button", "mg-game"); c.type = "button"; c.dataset.game = gm.id;
      c.appendChild(el("span", "mg-emoji", gm.emoji)); const tx2 = el("span", "mg-gtext");
      tx2.appendChild(el("strong", null, P(gm.name))); tx2.appendChild(el("small", null, P(gm.desc)));
      tx2.appendChild(el("em", null, `${P(T.best)}: ${"⭐".repeat(best)}${"☆".repeat(3 - best)}`)); c.appendChild(tx2);
      c.addEventListener("click", () => intro(gm.id)); g.appendChild(c);
    });
    b.appendChild(g);
  }

  // OFICINA CLÍNICA: os jogos de psicologia moram noutro arquivo (minijogos-clinicos.js) e entram aqui
  // pelo mesmo caminho dos outros — o esqueleto (menu, prêmio do dia, recorde, tela do fim) é um só.
  function registrar(lista) { lista.forEach((g) => { if (!byId(g.id)) GAMES.push(g); }); }
  const daTrilha = (clinico) => GAMES.filter((g) => Boolean(g.clinico) === Boolean(clinico));

  function intro(id) {
    stop(); const gm = byId(id); cur = gm;
    const b = body(); b.textContent = "";
    $("mg-title").textContent = `${gm.emoji} ${P(gm.name)}`;
    b.appendChild(el("p", "mg-desc", P(gm.desc)));
    const paid = state.mg && state.mg.day && state.mg.day[id] === dayKey();
    b.appendChild(el("p", "shop-note", paid ? P(T.noreward) : P(T.first)));
    const go = el("button", "continue-btn", P(T.start)); go.type = "button"; go.dataset.start = id; go.addEventListener("click", () => play(id)); b.appendChild(go);
    const back = el("button", "link-btn", P(T.menu)); back.type = "button"; back.addEventListener("click", () => menu(trilha)); b.appendChild(back);
  }

  function play(id) {
    stop(); const gm = byId(id); cur = gm;
    const b = body(); b.textContent = "";
    $("mg-title").textContent = `${gm.emoji} ${P(gm.name)}`;
    const root = el("div", "mg-stage"); b.appendChild(root);
    let finished = false;
    gm.run(root, (res) => { if (finished) return; finished = true; stop(); result(gm, res); });
  }

  function result(gm, res) {
    state.mg = state.mg || { best: {}, day: {} };
    const stars = Math.max(0, Math.min(3, res.stars));
    state.mg.best[gm.id] = Math.max(state.mg.best[gm.id] || 0, stars);
    const first = state.mg.day[gm.id] !== dayKey();
    let extra = "";
    if (first && stars > 0) {
      state.mg.day[gm.id] = dayKey();
      const c = gm.energy ? 0 : Math.ceil(stars * 2 * Wheel.testMult()), x = Math.ceil(stars * Wheel.testMult()); Wheel.gain(gm.eixo || "psicometria", 1);
      state.coins += c; state.xp += x;
      if (gm.energy) { state.energy = clamp(state.energy + gm.energy, 0, 100); extra = fmtL(T.energy, { e: gm.energy }); } else extra = fmtL(T.reward, { c, x });
    } else if (!first) extra = P(T.noreward);
    saveState(); updateHud(); sfx(stars ? "levelup" : "deny");
    const b = body(); b.textContent = "";
    b.appendChild(el("div", "mg-stars", "⭐".repeat(stars) + "☆".repeat(3 - stars)));
    if (res.detail) b.appendChild(el("p", "mg-detail", res.detail));
    if (extra) b.appendChild(el("p", "mg-reward", extra));
    const edu = el("div", "mg-edu"); edu.appendChild(el("strong", null, `🧠 ${P(T.what)}`)); edu.appendChild(el("p", null, P(gm.edu))); b.appendChild(edu);
    const again = el("button", "continue-btn", P(T.again)); again.type = "button"; again.dataset.again = gm.id; again.addEventListener("click", () => play(gm.id)); b.appendChild(again);
    const back = el("button", "link-btn", P(T.menu)); back.type = "button"; back.addEventListener("click", () => menu(trilha)); b.appendChild(back);
  }

  function open(id, clinico) {
    openModal("mg-modal");
    trilha = Boolean(clinico);
    if (id && byId(id)) intro(id); else menu(trilha);
  }
  function close() { stop(); closeModal("mg-modal"); }
  function init() {
    document.querySelectorAll('[data-close="mg-modal"]').forEach((b) => b.addEventListener("click", stop));
  }

  return { open, close, init, menu, registrar, daTrilha, games: () => GAMES.map((g) => g.id), clinicos: () => daTrilha(true).map((g) => g.id), _play: play, _intro: intro, _speed(v) { SPEED = v; } };
})();
window.Minigames = Minigames;

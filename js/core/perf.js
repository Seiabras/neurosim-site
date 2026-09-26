"use strict";

// ===========================================================================
// Desempenho por aparelho: modo Econômico, Equilibrado ou Completo (ou Automático).
// O Automático olha o aparelho (celular, tablet ou computador, memória, núcleos, telas de alta resolução) e faz um teste rápido de
// desenho para escolher o nível. Cada nível liga ou desliga só enfeites, nunca o que muda o jogo:
//   Econômico:   sem sombras 3D, resolução 1×, chão liso, sem vinheta, menos bichinhos e plantas, 30 quadros por segundo, sem eco no som
//   Equilibrado: sombras leves, resolução até 1,5×, 70% dos bichinhos e plantas
//   Completo:    tudo ligado (o visual de sempre)
// Também sugere fonte e tamanho de letra para cada tipo de aparelho (só enquanto a pessoa não escolheu os dela).
// Configurações: settings.perf = "auto" | "low" | "balanced" | "high"; settings.perfAuto guarda o resultado do teste.
// ===========================================================================
const Perf = (function () {
  const NAMES = { low: window.L("Econômico", "Economy", "Económico"), balanced: window.L("Equilibrado", "Balanced", "Equilibrado"), high: window.L("Completo", "Full", "Completo") };
  const coarse = () => Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  function device() {
    const w = Math.min(screen.width || 1000, screen.height || 800), dpr = window.devicePixelRatio || 1;
    const kind = coarse() ? (w >= 700 ? "tablet" : "phone") : "desktop";
    return { kind, mem: navigator.deviceMemory || (kind === "desktop" ? 8 : 3), cores: navigator.hardwareConcurrency || (kind === "desktop" ? 8 : 4), dpr, w };
  }
  // teste de desenho: quantos milissegundos leva para pintar uma cena parecida com a cidade (menos é melhor)
  function bench() {
    try {
      const c = document.createElement("canvas"); c.width = 480; c.height = 270; const g = c.getContext("2d");
      const t0 = performance.now();
      for (let f = 0; f < 6; f++) { for (let i = 0; i < 260; i++) { const gr = g.createRadialGradient(i % 480, (i * 7) % 270, 2, i % 480, (i * 7) % 270, 30); gr.addColorStop(0, "rgba(90,160,90,0.6)"); gr.addColorStop(1, "rgba(90,160,90,0)"); g.fillStyle = gr; g.fillRect(0, 0, 480, 270); g.beginPath(); g.arc((i * 13) % 480, (i * 29) % 270, 14, 0, 7); g.fill(); } }
      return performance.now() - t0;
    } catch (e) { return 0; }
  }
  function classify(d, ms) {
    let score = d.cores * 1.2 + d.mem * 1.6 - (d.kind === "phone" ? 3 : d.kind === "tablet" ? 1.5 : 0) - (d.dpr > 2.5 ? 1.5 : 0);
    if (ms > 260) score -= 6; else if (ms > 120) score -= 3; else if (ms && ms < 40) score += 2;
    return score >= 14 ? "high" : score >= 8 ? "balanced" : "low";
  }
  function detect() { const d = device(), ms = bench(); return { device: d, ms: Math.round(ms), level: classify(d, ms) }; }
  // automático (padrão): testa o aparelho e escolhe o modo; repete o teste se a tela mudou ou se passaram 14 dias
  const devKey = () => { const d = device(); return `${d.kind}:${d.w}:${d.dpr}`; };
  const auto = () => {
    const a = settings.perfAuto;
    if (!a || a.key !== devKey() || !a.t || Date.now() - a.t > 14 * 86400000) { settings.perfAuto = Object.assign(detect(), { key: devKey(), t: Date.now() }); try { saveSettings(); } catch (e) { /* sem armazenamento */ } }
    return settings.perfAuto.level;
  };
  const level = () => { const p = settings.perf || "auto"; return p === "auto" ? auto() : p; };
  const is = (l) => level() === l;
  // fatores usados pelo resto do jogo
  const pixelRatioCap = () => ({ low: 1, balanced: 1.5, high: 2 }[level()]);
  const shadows = () => level() !== "low";
  const shadowSize = () => (level() === "high" ? 2048 : 1024);
  const crowd = () => ({ low: 0.4, balanced: 0.7, high: 1 }[level()]);       // bichinhos e plantas de enfeite
  const frameGap = () => (level() === "low" ? 1000 / 30 : 0);                  // ms mínimos entre quadros da cidade
  const fancy = () => level() === "high" || level() === "balanced";           // textura do chão e vinheta
  // sugestão de letra por aparelho
  function suggestLook() {
    const d = device();
    if (d.kind === "phone") return { fontScale: 1.15, font: "easy" };
    if (d.kind === "tablet") return { fontScale: 1.1, font: "auto" };
    return { fontScale: d.w >= 1600 ? 1.1 : 1, font: "auto" };
  }
  function applySuggestedLook() {   // a cada início de sessão, enquanto a pessoa não escolheu letra e tamanho
    if (settings.lookTouched) return;
    const s = suggestLook(); settings.fontScale = s.fontScale; settings.font = s.font;
  }
  // medidor de quadros por segundo (para o teste do aparelho)
  let fpsBox = null, fpsRaf = 0;
  function fpsMeter(on) {
    cancelAnimationFrame(fpsRaf);
    if (!on) { if (fpsBox) fpsBox.remove(); fpsBox = null; return; }
    if (!fpsBox) { fpsBox = document.createElement("div"); fpsBox.className = "fps-meter"; document.body.appendChild(fpsBox); }
    let n = 0, t0 = performance.now();
    const loop = (t) => { n++; if (t - t0 >= 1000) { fpsBox.textContent = `${n} fps · ${I18N.pick(NAMES[level()])}`; n = 0; t0 = t; } fpsRaf = requestAnimationFrame(loop); };
    fpsRaf = requestAnimationFrame(loop);
  }
  return { NAMES, device, detect, level, is, pixelRatioCap, shadows, shadowSize, crowd, frameGap, fancy, suggestLook, applySuggestedLook, fpsMeter, retest() { settings.perfAuto = Object.assign(detect(), { key: devKey(), t: Date.now() }); saveSettings(); return settings.perfAuto; } };
})();

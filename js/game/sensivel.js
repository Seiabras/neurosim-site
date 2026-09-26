"use strict";

// ===========================================================================
// Conteúdo sensível (Opções → "Ocultar suicídio, automutilação e temas parecidos").
// Com a opção ligada (settings.hideSensitive):
//  · some a área "risco" do Investigar, da ficha e das técnicas projetivas;
//  · o sistema de avaliação de risco, plano de segurança, crises no celular e negligência (risco.js) fica desligado;
//  · frases dos pacientes, anotações, achados e explicações que citam o tema são omitidas na tela (text()).
// O Manual (critérios clínicos) continua com a descrição técnica dos quadros, porque é material de estudo.
// ===========================================================================
const Sens = (function () {
  // termos em pt, en e es; a checagem é feita no texto já no idioma da tela
  const RX = /suicíd|suicid|automutil|autolesã|autolesi|self-harm|self harm|se machucar|hurt (yourself|themselves|myself)|tirar a (própria )?vida|end (my|your|their) (own )?life|quitarse la vida|quitarte la vida|pensamentos? (passivos? )?de morte|thoughts? of death|pensamientos? (pasivos? )?de muerte|não estar (mais )?aqui|not (being )?here anymore|no estar (más )?aquí|não acordar|not wake up|no despertar|hacerse daño|lastimarse|(mais leve|melhor|mais fácil) sem mim|better off without me|(más liviano|mejor|más fácil) sin mí|mais fácil não acordar|easier not to wake/i;
  const on = () => typeof settings !== "undefined" && Boolean(settings.hideSensitive);   // `settings` é um binding global, não uma propriedade de window
  // remove as frases que citam o tema; se sobrar nada, devolve `vazio` (padrão: "")
  function text(s, vazio) {
    if (!on() || !s || typeof s !== "string" || !RX.test(s)) return s;
    const kept = s.split(/(?<=[.!?…])\s+/).filter((p) => !RX.test(p));
    return kept.length ? kept.join(" ") : (vazio === undefined ? "" : vazio);
  }
  const has = (s) => typeof s === "string" && RX.test(s);
  const HIDDEN_DOMAINS = ["risco"];
  return { on, text, has, HIDDEN_DOMAINS };
})();
window.Sens = Sens;

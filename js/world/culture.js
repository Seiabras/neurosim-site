"use strict";

// ===========================================================================
// Cultura no shopping: lojinha de idiomas (uma seção por idioma, com troca manual do idioma do jogo
// e frases para aprender) e a linha do tempo da história da psicologia.
// Estado: state.culture = { langs: {código: true}, history: {id: true} }
// ===========================================================================
const Culture = (function () {
  const L = window.L;
  const pick = (v) => I18N.pick(v);
  const tr = (pt, en, es) => pick(L(pt, en, es));
  const st = () => { const c = (state.culture = state.culture || {}); c.langs = c.langs || {}; c.history = c.history || {}; c.xp = c.xp || {}; return c; };

  const CONCEPTS = [
    L("Olá", "Hello", "Hola"), L("Obrigado(a)", "Thank you", "Gracias"), L("Por favor", "Please", "Por favor"), L("Como você está?", "How are you?", "¿Cómo estás?"),
    L("Psicólogo(a)", "Psychologist", "Psicólogo(a)"), L("Ouvir", "To listen", "Escuchar"), L("Saúde", "Health", "Salud"), L("Amigo(a)", "Friend", "Amigo(a)")
  ];
  const PHRASES = {
    pt: ["Olá", "Obrigado(a)", "Por favor", "Como você está?", "Psicólogo(a)", "Ouvir", "Saúde", "Amigo(a)"],
    en: ["Hello", "Thank you", "Please", "How are you?", "Psychologist", "To listen", "Health", "Friend"],
    es: ["Hola", "Gracias", "Por favor", "¿Cómo estás?", "Psicólogo(a)", "Escuchar", "Salud", "Amigo(a)"],
    fr: ["Bonjour", "Merci", "S'il vous plaît", "Comment allez-vous ?", "Psychologue", "Écouter", "Santé", "Ami(e)"],
    de: ["Hallo", "Danke", "Bitte", "Wie geht es Ihnen?", "Psychologe / Psychologin", "Zuhören", "Gesundheit", "Freund(in)"],
    ja: ["こんにちは", "ありがとう", "お願いします", "お元気ですか?", "心理士", "聞く", "健康", "友だち"],
    zh: ["你好", "谢谢", "请", "你好吗?", "心理学家", "倾听", "健康", "朋友"],
    zt: ["你好", "謝謝", "請", "你好嗎?", "心理師", "傾聽", "健康", "朋友"],
    fi: ["Hei", "Kiitos", "Ole hyvä", "Mitä kuuluu?", "Psykologi", "Kuunnella", "Terveys", "Ystävä"],
    it: ["Ciao", "Grazie", "Per favore", "Come stai?", "Psicologo/a", "Ascoltare", "Salute", "Amico/a"],
    ru: ["Здравствуйте", "Спасибо", "Пожалуйста", "Как дела?", "Психолог", "Слушать", "Здоровье", "Друг"],
    ko: ["안녕하세요", "감사합니다", "부탁합니다", "잘 지내세요?", "심리학자", "듣다", "건강", "친구"],
    gn: ["Maitei", "Aguyje", "Ta'e", "Mba'éichapa reiko?", "Psicólogo", "Hendu", "Tesãi", "Angirũ"]
  };
  const FUN = {
    pt: L("O português tem cerca de 260 milhões de falantes e é a língua oficial do Brasil e de mais 8 países.", "Portuguese has about 260 million speakers and is official in Brazil and 8 other countries.", "El portugués tiene unos 260 millones de hablantes y es oficial en Brasil y otros 8 países."),
    en: L("O inglês é a língua mais usada como segunda língua no mundo, inclusive em artigos científicos de psicologia.", "English is the most widely used second language in the world, including in psychology research papers.", "El inglés es la segunda lengua más usada del mundo, incluso en artículos científicos de psicología."),
    es: L("O espanhol é oficial em 20 países e, com o português, é vizinho de muitos pacientes e pesquisadores da América Latina.", "Spanish is official in 20 countries and, with Portuguese, is spoken by many Latin American patients and researchers.", "El español es oficial en 20 países y, junto al portugués, lo hablan muchos pacientes e investigadores de América Latina."),
    fr: L("Foi em francês que Pinel, no século XVIII, propôs tratar pessoas internadas com humanidade, sem correntes.", "It was in French that Pinel, in the 18th century, proposed treating hospitalized people humanely, without chains.", "Fue en francés que Pinel, en el siglo XVIII, propuso tratar con humanidad a las personas internadas, sin cadenas."),
    de: L("O alemão é a língua de Wundt, Freud, Jung e Köhler: boa parte da psicologia nasceu nele.", "German is the language of Wundt, Freud, Jung and Köhler: a large part of psychology was born in it.", "El alemán es la lengua de Wundt, Freud, Jung y Köhler: buena parte de la psicología nació en él."),
    ja: L("No japonês há a palavra ikigai, o que dá sentido à vida, muito estudada em psicologia positiva.", "Japanese has the word ikigai, what gives life meaning, widely studied in positive psychology.", "El japonés tiene la palabra ikigai, aquello que da sentido a la vida, muy estudiada en psicología positiva."),
    zh: L("O chinês simplificado é escrito por mais de um bilhão de pessoas; a psicologia chinesa mistura tradição e ciência moderna.", "Simplified Chinese is written by over a billion people; Chinese psychology blends tradition and modern science.", "El chino simplificado lo escriben más de mil millones de personas; la psicología china mezcla tradición y ciencia moderna."),
    zt: L("O chinês tradicional é usado em Taiwan e Hong Kong e conserva caracteres com milhares de anos de história.", "Traditional Chinese is used in Taiwan and Hong Kong and keeps characters with thousands of years of history.", "El chino tradicional se usa en Taiwán y Hong Kong y conserva caracteres con miles de años de historia."),
    fi: L("Na Finlândia, a educação e a saúde mental têm grande destaque; o finlandês tem só 15 casos gramaticais... só!", "Finland gives great prominence to education and mental health; Finnish has just 15 grammatical cases... just!", "En Finlandia la educación y la salud mental tienen gran importancia; el finés tiene solo 15 casos gramaticales... ¡solo!"),
    it: L("Foi na Itália que Maria Montessori criou um método educativo baseado em observar e respeitar o ritmo de cada criança.", "It was in Italy that Maria Montessori created an educational method based on observing and respecting each child's pace.", "Fue en Italia donde María Montessori creó un método educativo basado en observar y respetar el ritmo de cada niño."),
    ru: L("Pavlov, Vygotsky e Luria, gigantes da psicologia, escreveram em russo: dali vêm os reflexos condicionados e a zona de desenvolvimento proximal.", "Pavlov, Vygotsky and Luria, giants of psychology, wrote in Russian: conditioned reflexes and the zone of proximal development come from there.", "Pávlov, Vygotski y Luria, gigantes de la psicología, escribieron en ruso: de ahí vienen los reflejos condicionados y la zona de desarrollo próximo."),
    ko: L("O alfabeto coreano (hangul) foi criado em 1443 pelo rei Sejong para ser fácil de aprender: dá para dominá-lo em poucas horas.", "The Korean alphabet (hangul) was created in 1443 by King Sejong to be easy to learn: you can master it in a few hours.", "El alfabeto coreano (hangul) fue creado en 1443 por el rey Sejong para que fuera fácil de aprender: se domina en pocas horas."),
    gn: L("O guarani é língua oficial do Paraguai, falada por cerca de 6 milhões de pessoas e por quase toda a população paraguaia.", "Guarani is an official language of Paraguay, spoken by about 6 million people and by almost the whole Paraguayan population.", "El guaraní es lengua oficial de Paraguay, hablada por unos 6 millones de personas y por casi toda la población paraguaya.")
  };

  function shell(title) {
    const body = $("hosp-body");
    body.textContent = "";
    $("hosp-title").textContent = title;
    return body;
  }

  function openLanguages() {
    const body = shell(`🌐 ${tr("Lojinha de idiomas", "Language shop", "Tienda de idiomas")}`);
    const seen = Object.keys(st().langs).length;
    body.appendChild(el("p", "uni-q", tr(`Cada balcão ensina frases de um idioma e deixa você trocar o idioma do jogo. Visitados: ${seen}/${I18N.LANGS.length}.`, `Each counter teaches phrases from one language and lets you switch the game's language. Visited: ${seen}/${I18N.LANGS.length}.`, `Cada mostrador enseña frases de un idioma y te deja cambiar el idioma del juego. Visitados: ${seen}/${I18N.LANGS.length}.`)));
    const box = el("div", "uni-opts");
    I18N.LANGS.forEach((code) => {
      const b = el("button", "choice-btn");
      b.type = "button";
      b.appendChild(I18N.flagImg(code));
      b.appendChild(document.createTextNode(` ${I18N.NAMES[code]}${st().langs[code] ? " ✓" : ""}`));
      b.addEventListener("click", () => { sfx("click"); openSection(code); });
      box.appendChild(b);
    });
    body.appendChild(box);
    openModal("hosp-modal");
  }

  function openSection(code) {
    st().langs[code] = true; if (!st().xp[code]) { st().xp[code] = true; state.xp += 2; } saveState(); updateHud();
    const body = shell(`${I18N.NAMES[code]}`);
    const head = el("p", "uni-q");
    head.appendChild(I18N.flagImg(code));
    head.appendChild(document.createTextNode(` ${pick(FUN[code])}`));
    body.appendChild(head);
    const table = el("div", "uni-opts");
    CONCEPTS.forEach((c, i) => table.appendChild(el("div", "choice-btn lang-phrase", `${pick(c)} → ${PHRASES[code][i]}`)));
    body.appendChild(table);
    const row = el("div", "uni-row");
    const back = el("button", "pill-btn small", `← ${t("souv.back")}`);
    back.type = "button"; back.addEventListener("click", openLanguages);
    row.appendChild(back);
    if (I18N.lang !== code) {
      const sw = el("button", "pill-btn", `🔄 ${tr("Trocar o idioma do jogo para", "Switch the game's language to", "Cambiar el idioma del juego a")} ${I18N.NAMES[code]}`);
      sw.type = "button";
      sw.addEventListener("click", () => { settings.lang = code; saveSettings(); I18N.setLang(code); closeModal("hosp-modal"); showToast(`🌐 ${I18N.NAMES[code]}`); });
      row.appendChild(sw);
    } else row.appendChild(el("span", "shop-note", `✓ ${tr("Idioma atual do jogo", "Current game language", "Idioma actual del juego")}`));
    body.appendChild(row);
  }

  // ------------------------------------------------------------ história da psicologia
  // A ORDEM É O CONTEÚDO (7.10): é uma LINHA DO TEMPO. Estava com 1952 antes de 1951 e 1969 antes de
  // 1960 — quem lê de cima para baixo aprendia a cronologia errada. Marco novo entra pelo ano.
  const HISTORY = [
    { id: "wundt", y: "1879", who: "Wilhelm Wundt", t: L("Funda em Leipzig o primeiro laboratório de psicologia experimental: a psicologia vira ciência.", "Founds the first experimental psychology laboratory in Leipzig: psychology becomes a science.", "Funda en Leipzig el primer laboratorio de psicología experimental: la psicología se vuelve ciencia.") },
    { id: "james", y: "1890", who: "William James", t: L("Publica \"Princípios de Psicologia\", que estuda a consciência como um fluxo.", "Publishes \"The Principles of Psychology\", studying consciousness as a stream.", "Publica \"Principios de Psicología\", que estudia la conciencia como un flujo.") },
    { id: "freud", y: "1899", who: "Sigmund Freud", t: L("\"A Interpretação dos Sonhos\": nasce a psicanálise, com inconsciente, defesas e associação livre.", "\"The Interpretation of Dreams\": psychoanalysis is born, with the unconscious, defenses and free association.", "\"La interpretación de los sueños\": nace el psicoanálisis, con inconsciente, defensas y asociación libre.") },
    { id: "binet", y: "1905", who: "Binet e Simon", t: L("Criam a primeira escala de inteligência, para identificar crianças que precisavam de apoio na escola.", "Create the first intelligence scale, to identify children who needed support at school.", "Crean la primera escala de inteligencia, para identificar niños que necesitaban apoyo en la escuela.") },
    { id: "watson", y: "1913", who: "John B. Watson", t: L("Manifesto do behaviorismo: estudar o comportamento observável.", "Behaviorism manifesto: studying observable behavior.", "Manifiesto del conductismo: estudiar la conducta observable.") },
    { id: "pavlov", y: "1927", who: "Ivan Pavlov", t: L("Descreve o condicionamento clássico com o famoso experimento dos cães e da campainha.", "Describes classical conditioning with the famous experiment with dogs and a bell.", "Describe el condicionamiento clásico con el famoso experimento de los perros y la campana.") },
    { id: "skinner", y: "1938", who: "B. F. Skinner", t: L("Propõe o condicionamento operante: o comportamento é moldado por suas consequências.", "Proposes operant conditioning: behavior is shaped by its consequences.", "Propone el condicionamiento operante: la conducta se moldea por sus consecuencias.") },
    { id: "rogers", y: "1951", who: "Carl Rogers", t: L("Terapia centrada na pessoa: empatia, aceitação e autenticidade curam.", "Person-centered therapy: empathy, acceptance and genuineness heal.", "Terapia centrada en la persona: empatía, aceptación y autenticidad curan.") },
    { id: "nise", y: "1952", who: "Nise da Silveira", t: L("No Brasil, funda o Museu de Imagens do Inconsciente e defende cuidar com arte e afeto, sem violência.", "In Brazil, founds the Museum of Images of the Unconscious and defends care through art and affection, without violence.", "En Brasil, funda el Museo de Imágenes del Inconsciente y defiende cuidar con arte y afecto, sin violencia.") },
    { id: "beck", y: "1960", who: "Aaron Beck", t: L("Cria a terapia cognitiva: pensamentos automáticos influenciam emoções e ações.", "Creates cognitive therapy: automatic thoughts influence emotions and actions.", "Crea la terapia cognitiva: los pensamientos automáticos influyen en emociones y acciones.") },
    { id: "brasil", y: "1962", who: "Brasil", t: L("A Lei 4.119 regulamenta a profissão de psicólogo no país.", "Law 4.119 regulates the psychologist profession in the country.", "La Ley 4.119 regula la profesión de psicólogo en el país.") },
    { id: "bowlby", y: "1969", who: "John Bowlby", t: L("Teoria do apego: os laços da infância moldam como nos ligamos aos outros.", "Attachment theory: childhood bonds shape how we connect to others.", "Teoría del apego: los lazos de la infancia moldean cómo nos vinculamos con los demás.") },
    { id: "dsm", y: "2022", who: "DSM-5-TR", t: L("A revisão do texto do DSM-5 atualiza critérios e textos: é a base do Manual que você usa no jogo.", "The DSM-5 text revision updates criteria and text: it is the basis of the Manual you use in the game.", "La revisión de texto del DSM-5 actualiza criterios y textos: es la base del Manual que usas en el juego.") }

  ];
  const HISTORY_SORTED = HISTORY.slice().sort((a, b) => Number(a.y) - Number(b.y));

  function openHistory() {
    const body = shell(`📚 ${tr("História da psicologia", "History of psychology", "Historia de la psicología")}`);
    const n = Object.keys(st().history).length;
    body.appendChild(el("p", "uni-q", tr(`Toque em cada marco para ler. Lidos: ${n}/${HISTORY.length}.`, `Tap each milestone to read it. Read: ${n}/${HISTORY.length}.`, `Toca cada hito para leerlo. Leídos: ${n}/${HISTORY.length}.`)));
    const box = el("div", "uni-opts");
    HISTORY_SORTED.forEach((h) => {
      const read = st().history[h.id];
      const b = el("button", "choice-btn", read ? `${h.y} · ${h.who}\n${pick(h.t)}` : `${h.y} · ${h.who}  📖`);
      b.type = "button";
      b.addEventListener("click", () => {
        if (!st().history[h.id]) { st().history[h.id] = true; state.xp += 2; saveState(); updateHud(); sfx("good"); }
        openHistory();
      });
      box.appendChild(b);
    });
    body.appendChild(box);
    openModal("hosp-modal");
  }

  return { openLanguages, openHistory, st, HISTORY, PHRASES };
})();

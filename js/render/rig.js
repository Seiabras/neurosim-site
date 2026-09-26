"use strict";

// ===========================================================================
// A ARMAÇÃO ARTICULADA (rig): o corpo que anda, senta, deita e usa objetos. Serve para a psicóloga,
// para o paciente e para o acompanhante — é o mesmo corpo, com aparência (`look`) diferente.
//
// Saiu de js/render/scene3d.js na 7.11. O arquivo tinha 2.976 linhas concentrando render, colisão,
// animação e regra, e foi de lá que nasceram quase todos os bugs visuais da 7.0 → 7.1. Aqui não há
// nenhuma mudança de comportamento: o mesmo código, com as peças de desenho recebidas de fora, para
// que o rig possa ser lido (e consertado) sem abrir a cena inteira.
//
// Duas medidas deste arquivo andam junto com os MÓVEIS e não se mexe numa sem a outra: STAND_Y (o
// quadril em pé) e THIGH/SHIN (a altura do joelho). O grupo de teste `sentar` guarda esse acoplamento.
// ===========================================================================
window.criarRig = function criarRig(dep) {
  const { T, box, canvasTex, cup, cyl, hex, loadTex, shade, solid, sph } = dep;

  function makeDoctor(look0) {
    const look = Object.assign({ gl: "", jewel: "" }, look0 || {});
    // A ROUPA da psicóloga ainda vem pintada da ilustração (`look.art`); o rosto e o cabelo de todo
    // mundo, inclusive o dela, são montados em 3D a partir da aparência escolhida.
    // Roupa pintada da ilustração: só a psicóloga, e só a ROUPA. O rosto é 3D para todo mundo.
    const artPsi = Boolean(look.art) && Boolean(window.TEX_DATA && window.TEX_DATA["assets/psi-camisa.png"]);
    const skin = hex(look.skin || "#eab98f"), hair = hex(look.hair || "#5a3a26"), top = hex(look.top || "#ffffff");
    const pants = look.pants ? hex(look.pants) : 0x3a3a4a, shoe = look.shoe ? hex(look.shoe) : 0x2a2530;
    const paint = (key) => (artPsi ? { map: loadTex(key) } : undefined);   // a ROUPA pintada continua só dela
    const shirtMat = paint("assets/psi-camisa.png"), pantsMat = paint("assets/psi-calca.png");
    const topC = artPsi ? 0xffffff : top, pantsC = artPsi ? 0xffffff : pants, hairC = hair;
    let faceUpdate = null;
    const root = new T.Group();                       // posição no chão e direção do corpo
    const body = new T.Group(); root.add(body);       // pivô do quadril
    const waist = new T.Group(); body.add(waist);     // tronco
    // Pernas: até a 5.11 a coxa e a canela somavam 1,05 e o quadril em pé ficava a 1,14 do chão — 40% da
    // altura da pessoa, contra os ~53% de gente de verdade. Sentado, o pé não alcançava o chão e ficava
    // enterrado na base da poltrona. Alongar as duas (a pessoa fica 3,0 de altura, contra 3,2 da porta)
    // resolve o encaixe e deixa a proporção menos de boneco.
    const STAND_Y = 1.33, ARM = 0.45, FORE = 0.4, THIGH = 0.58, SHIN = 0.66;

    // No provador dá para ver a peça de baixo antes de vestir a de cima — é para isso que serve um
    // provador. Fora dele, `semTop` nunca vem ligado.
    const semTop = Boolean(look.semTop), underC = look.under ? hex(look.under) : 0xe8e2d8;
    body.add(sph(0.3, semTop ? underC : pantsC, { pos: [0, 0.0, 0], ol: 0.04, mat: pantsMat }));
    if (semTop) {
      waist.add(cyl(0.3, 0.36, 0.85, skin, { pos: [0, 0.45, 0], ol: 0.05 }));
      waist.add(cyl(0.315, 0.335, 0.2, underC, { pos: [0, 0.68, 0], ol: 0.03 }));      // a peça de cima
    } else waist.add(cyl(0.3, 0.36, 0.85, topC, { pos: [0, 0.45, 0], ol: 0.05, mat: shirtMat }));
    // O CORPO. Todo mundo tinha o mesmo cilindro por tronco, e só o cabelo distinguia uma pessoa da
    // outra: um senhor de cabelo curto saía com cara de senhora. Agora o corpo diz algo — busto nas
    // mulheres, ombro mais largo e traço mais duro nos homens. "n" (neutro) segue como era.
    // TRAÇO DE ADULTO É DE ADULTO. Busto, maxilar, sombra de barba e pomo de adão são marcas que
    // aparecem na puberdade: numa criança não são só errados, são perturbadores. `look.scale` já traz a
    // altura pela idade (caseLook → alturaPorIdade), e é ela que decide.
    const corpo = look.corpo || "n";
    // a IDADE decide, não a altura: aos 15 anos a altura já é a de gente grande, e adolescente não é
    // adulto. Sem idade na ficha (moradores, gerados, a própria jogadora), cai na altura.
    const adulto = look.anos !== undefined ? Number(look.anos) >= 18 : (look.scale === undefined ? 1 : Number(look.scale) || 1) >= 0.92;
    // O BUSTO TEM DE SER A MESMA SUPERFÍCIE DO TRONCO, e não um objeto colado por cima. Antes ele saía
    // 4 cm para fora do cilindro do tronco e vinha com cor chapada: sobre o jaleco PINTADO da psicóloga
    // (uma ilustração, não uma cor) viravam duas bolhas soltas em cima do desenho. Agora ele fica dentro
    // da silhueta, herda o material da roupa — e, quando a roupa é pintada, não entra: a ilustração já
    // define o corpo dela, e geometria por cima de desenho é sempre remendo.
    if (corpo === "f" && adulto && !artPsi) {
      [-1, 1].forEach((sd) => {
        const b = sph(0.13, semTop ? (look.under ? hex(look.under) : 0xe8e2d8) : topC, { pos: [sd * 0.12, 0.68, 0.17], outline: false, mat: semTop ? undefined : shirtMat });
        b.scale.set(1, 0.8, 0.62);
        waist.add(b);
      });
    } else if (corpo === "m" && adulto) {
      waist.add(cyl(0.052, 0.045, 0.07, skin, { pos: [0, 0.96, 0.09], outline: false }));    // o pomo de adão
    }
    if (semTop) { /* no provador a peça de cima não entra: é o que se está escolhendo */ }
    else if (artPsi) {
      // gola aberta em "V", como na ilustração
      [-1, 1].forEach((sd) => waist.add(box(0.15, 0.17, 0.03, 0xeeeaf1, { pos: [sd * 0.085, 0.79, 0.3], rot: [0.1, 0, -sd * 0.55], ol: 0.015 })));
    } else if (look.style === "coat" || look.style === "shirt" || look.style === "polo") waist.add(box(0.36, 0.12, 0.05, 0xffffff, { pos: [0, 0.78, 0.28], ol: 0.02 }));
    // MOLDES NOVOS. Dezenove peças na loja usavam seis moldes: trocar de roupa mudava a cor e mais nada.
    // Cada uma destas tem uma forma que se reconhece de longe, que é o que faz uma roupa ser outra roupa.
    if (!semTop && look.style === "hoodie") {
      const cap = sph(0.34, shade(topC, -0.12), { pos: [0, 0.82, -0.2], ol: 0.03, mat: shirtMat });   // o capuz caído nas costas
      cap.scale.set(1.05, 0.75, 0.8); waist.add(cap);
      waist.add(cyl(0.02, 0.02, 0.3, 0xf4f1ea, { pos: [-0.08, 0.66, 0.31], rot: [0.12, 0, 0.06], outline: false }));   // os cordões
      waist.add(cyl(0.02, 0.02, 0.3, 0xf4f1ea, { pos: [0.08, 0.66, 0.31], rot: [0.12, 0, -0.06], outline: false }));
      waist.add(box(0.44, 0.22, 0.06, shade(topC, -0.14), { pos: [0, 0.25, 0.31], ol: 0.02, mat: shirtMat }));         // o bolso canguru
    } else if (look.style === "turtleneck") {
      waist.add(cyl(0.16, 0.15, 0.3, topC, { pos: [0, 0.98, 0], ol: 0.03, mat: shirtMat }));                           // a gola alta, subindo pelo pescoço
    } else if (look.style === "cardigan") {
      [-1, 1].forEach((sd) => waist.add(box(0.1, 0.78, 0.05, shade(topC, -0.2), { pos: [sd * 0.13, 0.48, 0.3], ol: 0.02, mat: shirtMat })));   // as duas frentes abertas
      waist.add(box(0.2, 0.8, 0.02, 0xf2eee6, { pos: [0, 0.48, 0.295], outline: false }));                             // a camiseta por baixo
      [0.68, 0.5, 0.32].forEach((y) => waist.add(sph(0.032, 0xf4f1ea, { pos: [-0.11, y, 0.335], outline: false })));   // os botões
    } else if (look.style === "tank") {
      waist.add(cyl(0.305, 0.365, 0.28, skin, { pos: [0, 0.74, 0], ol: 0.03 }));                                       // ombro e peito à mostra
      [-1, 1].forEach((sd) => waist.add(box(0.09, 0.3, 0.07, topC, { pos: [sd * 0.2, 0.76, 0.14], rot: [0, 0, sd * 0.1], ol: 0.02, mat: shirtMat })));   // as alças
    } else if (look.style === "tunic") {
      waist.add(cyl(0.38, 0.3, 0.42, topC, { pos: [0, -0.1, 0], ol: 0.04, mat: shirtMat }));                           // a barra comprida, passando do quadril
      waist.add(box(0.06, 0.46, 0.04, shade(topC, -0.24), { pos: [0, 0.6, 0.31], ol: 0.015, mat: shirtMat }));         // a abertura bordada no peito
    } else if (look.style === "overall") {
      waist.add(box(0.5, 0.42, 0.06, pantsC, { pos: [0, 0.3, 0.3], ol: 0.02, mat: pantsMat }));                        // o peitilho da jardineira
      [-1, 1].forEach((sd) => waist.add(box(0.08, 0.42, 0.06, pantsC, { pos: [sd * 0.19, 0.7, 0.26], rot: [0, 0, sd * 0.14], ol: 0.02, mat: pantsMat })));   // as alças por cima do ombro
      [-1, 1].forEach((sd) => waist.add(sph(0.035, 0xd9c07a, { pos: [sd * 0.19, 0.5, 0.33], outline: false })));       // as fivelas
    } else if (look.style === "polo") {
      waist.add(box(0.07, 0.24, 0.04, shade(topC, -0.25), { pos: [0, 0.7, 0.315], ol: 0.015, mat: shirtMat }));        // a carcela
      [0.74, 0.62].forEach((y) => waist.add(sph(0.026, 0xf4f1ea, { pos: [0, y, 0.34], outline: false })));
    }
    if (look.mark === "psi" && !semTop) {   // o Ψ no peito, como na ilustração da personagem
      const psiMap = artPsi ? loadTex("assets/psi-simbolo.png") : null;
      const psi = new T.Mesh(new T.PlaneGeometry(0.17, 0.17), new T.MeshBasicMaterial({ map: psiMap || canvasTex(64, 64, (c) => { c.clearRect(0, 0, 64, 64); c.fillStyle = "#15131f"; c.font = "bold 52px serif"; c.textAlign = "center"; c.fillText("Ψ", 32, 50); }), transparent: true }));
      psi.position.set(-0.13, 0.62, 0.345); waist.add(psi);
    }
    if (look.style === "blazer" && !semTop) waist.add(box(0.14, 0.7, 0.05, 0xffffff, { pos: [0, 0.5, 0.31], outline: false }));
    const shoulders = sph(0.4, semTop ? skin : topC, { pos: [0, 0.86, 0], outline: false, mat: semTop ? undefined : shirtMat });
    shoulders.scale.set(adulto ? (corpo === "m" ? 1.16 : corpo === "f" ? 0.94 : 1) : 1, 0.32, 0.7);   // ombro de adulto também é de adulto      // (antes o scale era aplicado ao tronco inteiro, pois waist.add() devolve o próprio grupo)
    waist.add(shoulders);
    waist.add(cyl(0.1, 0.11, 0.26, skin, { pos: [0, 1.02, 0], outline: false }));   // pescoço: mais curto que isto e a cabeça pousava direto no ombro
    if (look.pinColor) waist.add(sph(0.06, hex(look.pinColor), { pos: [-0.17, 0.62, 0.32], ol: 0.02 }));
    if (look.jewel.indexOf("neck") === 0) waist.add(solid(new T.TorusGeometry(0.2, 0.012, 6, 18), 0xd9a520, { pos: [0, 0.94, 0.12], rot: [Math.PI / 2.4, 0, 0], outline: false }));

    // cabeça
    const head = new T.Group(); head.position.set(0, 1.12, 0); waist.add(head);
    const hc = new T.Group(); hc.position.set(0, 0.3, 0.02); head.add(hc);
    const headMesh = solid(new T.SphereGeometry(0.34, 56, 40), skin, { pos: [0, 0, 0], ol: 0.05, mat: { roughness: 0.55, envMapIntensity: 0.5 } });   // malha fina: a linha onde o cabelo encontra a cabeça sai lisa, sem degraus
    // o rosto masculino é um pouco mais quadrado, e o feminino um pouco mais estreito: é pouca coisa
    // em número e muita coisa na leitura de quem olha
    { const fs = { round: [1, 1], oval: [0.93, 1.08], wide: [1.1, 0.96] }[look.face || "round"] || [1, 1];
      const gx = !adulto ? 1 : corpo === "m" ? 1.06 : corpo === "f" ? 0.96 : 1, gy = adulto && corpo === "m" ? 0.98 : 1;
      headMesh.scale.set(fs[0] * gx, fs[1] * gy, 1); }
    // O MAXILAR MASCULINO EM 3D. Eram duas CAIXAS coladas na cabeça, e caixa não cabe dentro de esfera:
    // os cantos saíam para fora e viravam uma placa chapada embaixo da boca, com cara de defeito.
    // Agora é uma esfera achatada, que acompanha a curva da cabeça — larga embaixo, sem canto nenhum.
    if (corpo === "m" && adulto) {
      const q = sph(0.335, skin, { pos: [0, -0.1, 0.01], outline: false, mat: { roughness: 0.55 } });
      q.scale.set(1.0, 0.62, 0.94);
      hc.add(q);
      const barba = sph(0.336, shade(skin, -0.14), { pos: [0, -0.16, 0.02], outline: false, mat: { roughness: 0.7 } });
      barba.scale.set(0.96, 0.44, 0.9);
      hc.add(barba);
    }
    hc.add(headMesh);
    const cap = solid(new T.SphereGeometry(0.37, 56, 40), hairC, { pos: [0, 0.09, -0.07], outline: false, mat: { roughness: 0.42, envMapIntensity: 0.7 } });
    cap.scale.y = 0.85; hc.add(cap);
    // Franja. Era uma BARRA achatada atravessando a testa: de perto virava uma faixa de cabelo solta no ar,
    // sem encostar no resto do penteado — é o que deixava o rosto da mãe estranho. Agora são mechas
    // arredondadas apoiadas na curva da cabeça, na linha do cabelo.
    const franja = (y, lado) => {
      const g = new T.Group();
      [-0.62, -0.21, 0.2, 0.61].forEach((a2, i) => {
        const m = sph(0.13, hairC, { pos: [Math.sin(a2) * 0.335, y + (i === 1 || i === 2 ? 0.015 : -0.02), Math.cos(a2) * 0.3], outline: false });
        m.scale.set(1.15, 0.72, 0.6);
        m.rotation.z = -a2 * 0.5 + (lado || 0);
        g.add(m);
      });
      return g;
    };
    const hs = look.hairStyle;
    if (hs === "long") hc.add(cyl(0.34, 0.3, 0.8, hair, { pos: [0, -0.2, -0.22], outline: false }));
    if (hs === "bun") hc.add(sph(0.16, hair, { pos: [0, 0.45, -0.07], ol: 0.03 }));
    if (hs === "curly") {
      // eram três bolas grandes (duas nas laterais e uma no alto): de longe parecia orelha de rato.
      // Agora é uma coroa de cachos menores acompanhando a cabeça, e na frente eles sobem para a linha do cabelo.
      const cacho = (cx, cy, cz, r) => { const m = sph(r, hairC, { pos: [cx, cy, cz], outline: false }); m.scale.set(1, 0.92, 1); hc.add(m); };
      for (let i = 0; i < 9; i++) {
        const a2 = (i / 9) * Math.PI * 2, frente = Math.cos(a2) > 0.45;
        cacho(Math.sin(a2) * 0.335, frente ? 0.25 : 0.04, Math.cos(a2) * 0.3 - 0.03, frente ? 0.12 : 0.14);
      }
      for (let i = 0; i < 6; i++) { const a2 = (i / 6) * Math.PI * 2 + 0.5; cacho(Math.sin(a2) * 0.25, 0.3, Math.cos(a2) * 0.24 - 0.03, 0.125); }
      cacho(0, 0.42, -0.04, 0.13);
    }
    // CABELO CURTO NÃO ENGOLE O PESCOÇO. O chanel e o ondulado desciam até y −0,37, e o pescoço começa
    // em −0,27: o cilindro do cabelo passava por fora dele e a nuca sumia, o que não existe em cabelo
    // deste comprimento. Agora os dois param na linha do maxilar. (Cabelo comprido continua caindo nas
    // costas, que é o que cabelo comprido faz.)
    if (hs === "wavy") hc.add(cyl(0.36, 0.32, 0.42, hair, { pos: [0, -0.02, -0.22], outline: false }));
    if (hs === "bob") {   // chanel ondulado com volume nas laterais e franja de lado
      hc.add(cyl(0.37, 0.34, 0.36, hairC, { pos: [0, -0.05, -0.2], outline: false }));
      [-0.33, 0.33].forEach((sx) => { const side = sph(0.2, hairC, { pos: [sx, -0.06, -0.02], outline: false }); side.scale.set(0.9, 1.0, 1); hc.add(side); });
      hc.add(franja(0.23, -0.12));
    }
    if (hs === "ponytail") { hc.add(sph(0.13, hair, { pos: [0.06, 0.17, -0.4], outline: false })); hc.add(cyl(0.11, 0.05, 0.75, hair, { pos: [0.06, -0.2, -0.5], outline: false })); }
    if (hs === "braids") [-0.3, 0.3].forEach((bx) => hc.add(cyl(0.07, 0.05, 0.9, hair, { pos: [bx, -0.33, -0.02], outline: false })));
    if (hs === "afro") hc.add(sph(0.52, hair, { pos: [0, 0.23, -0.1], outline: false }));
    if (hs === "buzz") cap.scale.set(0.93, 0.68, 0.93);
    if (hs === "pixie") { cap.scale.set(0.97, 0.78, 0.97); hc.add(franja(0.26, -0.2)); }
    const eyeC = hex(look.eye || "#2a1d17");
    let eyes = [], mouth = { scale: { set() {} } }, bocaAbre = null;
    {
      // ROSTO 3D PARA TODO MUNDO DA CLÍNICA (diretriz de 25/09). Havia um segundo caminho em que o rosto
      // era a aquarela recortada, colada numa calota da esfera da cabeça. Ficava parado — sem piscar, sem
      // boca — e de perto lia-se como um decalque: dava para ver a borda do oval e o tom da tinta não
      // batia com a pele da cabeça. Agora o rosto é sempre montado em 3D, a partir da aparência da
      // pessoa, e por isso ele anima igual para paciente, acompanhante e psicóloga. A aquarela continua
      // sendo o RETRATO (medalha da consulta, HUD, cidade, provador), que é onde ela funciona.
      // Olho com BRANCO, íris e brilho. Até a 5.9 cada olho era uma bola escura sozinha: sem esclera e
      // sem reflexo, o rosto virava dois buracos pretos encarando — a cara que assustava de perto.
      // achatar demais fechava o olho: com 0,7 e 0,5 de altura a íris sumia e o rosto ficava de olho fechado
      const EK = { round: [1, 1, 0.062], almond: [1.3, 0.86, 0.062], sleepy: [1.08, 0.74, 0.062], wide: [1.2, 1.18, 0.068] }[look.eyeShape || "round"] || [1, 1, 0.062];
      eyes = [-0.12, 0.12].map((ex) => {
        const olho = new T.Group(); olho.position.set(ex, 0.03, 0.305); hc.add(olho);
        olho.add(sph(EK[2], 0xfbf7f2, { pos: [0, 0, 0], outline: false, mat: { roughness: 0.35, envMapIntensity: 0.2 } }));          // esclera
        olho.add(sph(EK[2] * 0.58, eyeC, { pos: [0, -0.002, EK[2] * 0.52], outline: false, mat: { roughness: 0.25 } }));             // íris
        olho.add(sph(EK[2] * 0.26, 0x141019, { pos: [0, -0.002, EK[2] * 0.78], outline: false, mat: { roughness: 0.2 } }));          // pupila
        const brilho = sph(EK[2] * 0.2, 0xffffff, { pos: [-EK[2] * 0.3, EK[2] * 0.34, EK[2] * 0.82], outline: false });              // reflexo: é ele que dá vida
        brilho.material = new T.MeshBasicMaterial({ color: 0xffffff }); olho.add(brilho);
        // Pálpebra: uma casquinha por cima do olho. É o que separa "olho" de "bola". Ela era da cor do
        // CABELO — num cabelo escuro virava uma tampa preta e o rosto ficava de olho semicerrado. Agora
        // a pálpebra é pele, e quem faz o traço escuro é o cílio, uma risca fina na borda.
        const palp = sph(EK[2] * 1.06, skin, { pos: [0, EK[2] * 0.66, 0.006], outline: false, mat: { roughness: 0.6 } });
        palp.scale.set(1, 0.38, 0.75); olho.add(palp);
        const cilio = sph(EK[2] * 1.02, shade(hair, -0.25), { pos: [0, EK[2] * 0.36, 0.014], outline: false, mat: { roughness: 0.6 } });
        cilio.scale.set(1, 0.11, 0.55); olho.add(cilio);
        olho.scale.z = 0.62;                                                   // afunda o olho no rosto: sem isso ele fica esbugalhado
        olho.userData.kx = EK[0]; olho.userData.ky = EK[1]; olho.userData.kz = 0.62;   // o kz existe porque quem anima o piscar reescreve a escala inteira
        return olho;
      });
      const bk = look.brow || "soft";
      // sobrancelha: era uma barrinha reta espetada na testa. Arredondada e encostada na curva da cabeça
      // ela lê como pelo, e é a sobrancelha que carrega metade da expressão do rosto.
      if (bk !== "none") [-0.12, 0.12].forEach((ex, i) => {
        const cj = sph(0.078, shade(hair, -0.12), { pos: [ex, bk === "arched" ? 0.15 : 0.13, 0.302], outline: false, mat: { roughness: 0.6 } });
        cj.scale.set(adulto && corpo === "m" ? 1.12 : 1, (bk === "thick" ? 0.34 : 0.21) * (adulto && corpo === "m" ? 1.45 : 1), 0.26);
        cj.rotation.z = (i ? -1 : 1) * (bk === "arched" ? 0.3 : 0.12);
        hc.add(cj);
      });
      hc.add(sph(0.045, skin, { pos: [0, -0.04, 0.35], outline: false }));
      const mk = look.mouth || "soft", lip = 0xa4554b;
      mouth = new T.Group(); mouth.position.set(0, -0.16, 0.32); hc.add(mouth);
      if (mk === "smile") mouth.add(solid(new T.TorusGeometry(0.075, 0.016, 6, 14, Math.PI), lip, { rot: [0, 0, Math.PI], pos: [0, 0.05, 0], outline: false }));
      else if (mk === "grin") { mouth.add(box(0.2, 0.05, 0.03, 0xffffff, { pos: [0, 0, 0], outline: false })); mouth.add(box(0.21, 0.012, 0.032, lip, { pos: [0, 0.03, 0], outline: false })); }
      else if (mk === "smirk") mouth.add(box(0.13, 0.03, 0.03, lip, { rot: [0, 0, 0.22], pos: [0.02, 0, 0], outline: false }));
      else if (mk === "neutral") mouth.add(solid(new T.TorusGeometry(0.06, 0.012, 6, 14, Math.PI * 0.6), lip, { rot: [0, 0, Math.PI + 0.63], pos: [0, 0.018, 0], outline: false }));
      else mouth.add(solid(new T.TorusGeometry(0.07, 0.013, 6, 16, Math.PI * 0.75), lip, { rot: [0, 0, Math.PI + 0.39], pos: [0, 0.03, 0], outline: false }));   // lábio com uma curva de leve, no lugar da barra reta
      // O VÃO da boca. Até a 5.11 quem "abria a boca" era a escala do grupo inteiro (até 3,6× na vertical):
      // o lábio esticava e virava um borrão vermelho pendurado no queixo — de perto, uma língua de fora.
      // Agora o lábio fica quieto e o que cresce é este vão escuro atrás dele.
      bocaAbre = sph(0.072, 0x6b2f33, { pos: [0, -0.012, -0.004], outline: false, mat: { roughness: 0.85, envMapIntensity: 0.1 } });
      bocaAbre.scale.set(1, 0.02, 0.3);
      mouth.add(bocaAbre);
      [-0.2, 0.2].forEach((cx) => hc.add(sph(0.06, 0xf08a80, { pos: [cx, -0.09, 0.28], outline: false, mat: { transparent: true, opacity: 0.35 } })));
    }
    [-0.34, 0.34].forEach((ex) => hc.add(sph(0.06, skin, { pos: [ex, 0, 0], outline: false })));
    if (look.freckles) [[-0.2, -0.05], [-0.12, -0.08], [0.12, -0.08], [0.2, -0.05]].forEach(([fx, fy]) => hc.add(sph(0.012, 0x8a5a3a, { pos: [fx, fy, 0.34], outline: false })));
    if (look.gl) [-0.12, 0.12].forEach((ex) => hc.add(look.gl === "gl-sun" ? sph(0.1, 0x1d1a24, { pos: [ex, 0.03, 0.33], outline: false }) : solid(new T.TorusGeometry(0.09, 0.016, 6, 14), look.gl === "gl-aviator" ? 0xd9a520 : look.gl === "gl-cat" ? 0x8a2f5a : 0x2f2622, { pos: [ex, 0.03, 0.33], outline: false })));
    if (look.jewel.indexOf("ear") === 0) [-0.35, 0.35].forEach((ex) => hc.add(sph(0.05, look.jewel === "ear-pearl" ? 0xffffff : 0xd9a520, { pos: [ex, -0.08, 0.02], outline: false })));
    if (look.jewel.indexOf("tiara") === 0) hc.add(solid(new T.TorusGeometry(0.3, 0.02, 6, 20, Math.PI), look.jewel === "tiara-gold" ? 0xd9a520 : 0xe58aa8, { pos: [0, 0.28, 0.0], outline: false }));
    if (look.acc === "glasses") [-0.12, 0.12].forEach((ex) => hc.add(solid(new T.TorusGeometry(0.09, 0.015, 6, 14), 0x2f2622, { pos: [ex, 0.03, 0.33], outline: false })));
    if (look.acc === "asas-fada") [-1, 1].forEach((sd) => { const asa = sph(0.34, 0xd7ecff, { pos: [sd * 0.3, 0.72, -0.3], outline: false, mat: { transparent: true, opacity: 0.6, roughness: 0.1 } }); asa.scale.set(1.5, 0.95, 0.06); asa.rotation.z = sd * 0.5; waist.add(asa); });
    if (look.acc === "scarf") waist.add(solid(new T.TorusGeometry(0.34, 0.09, 8, 16), 0xd9534f, { pos: [0, 0.9, 0.02], rot: [Math.PI / 2, 0, 0], outline: false }));
    if (look.acc === "gorro-natal") { hc.add(solid(new T.ConeGeometry(0.34, 0.6, 14), 0xc9302c, { pos: [0, 0.55, -0.07], rot: [0, 0, 0.3], outline: false })); hc.add(sph(0.09, 0xffffff, { pos: [0.16, 0.85, -0.07], outline: false })); }
    if (look.acc === "chapeu-abobora") { const h = sph(0.4, 0xf08a1f, { pos: [0, 0.4, -0.07], outline: false }); h.scale.y = 0.6; hc.add(h); }
    if (look.acc === "gorro-sono") { const g = solid(new T.ConeGeometry(0.33, 0.66, 14), 0x3a3f8f, { pos: [0.08, 0.55, -0.06], rot: [0, 0, -0.42], outline: false }); hc.add(g); hc.add(sph(0.1, 0xf2f0ff, { pos: [0.34, 0.83, -0.06], outline: false })); hc.add(solid(new T.TorusGeometry(0.3, 0.06, 8, 18), 0xf2f0ff, { pos: [0, 0.25, -0.06], rot: [Math.PI / 2, 0, 0], outline: false })); }
    if (look.acc === "orelhas-coelho") [-0.14, 0.14].forEach((ex) => { const e = sph(0.1, 0xffffff, { pos: [ex, 0.8, -0.04], outline: false }); e.scale.set(0.7, 2.6, 0.5); hc.add(e); });

    // braços
    const semManga = semTop || look.style === "tank" || look.style === "dress" || look.style === "overall";
    const sleeve = semManga ? skin : top;   // braço nu na regata, na jardineira e no provador
    function makeArm(side) {
      const sh = new T.Group(); sh.position.set(side * 0.4, 0.82, 0); waist.add(sh);
      sh.add(cyl(0.1, 0.09, ARM, artPsi ? topC : sleeve, { pos: [0, -ARM / 2, 0], ol: 0.04, mat: shirtMat }));
      const el = new T.Group(); el.position.set(0, -ARM, 0); sh.add(el);
      el.add(cyl(0.09, 0.075, FORE, artPsi ? topC : sleeve, { pos: [0, -FORE / 2, 0], ol: 0.04, mat: shirtMat }));
      const hand = new T.Group(); hand.position.set(0, -FORE, 0); el.add(hand);
      hand.add(sph(0.09, skin, { ol: 0.03 }));
      return { sh, el, hand };
    }
    const L = makeArm(-1), R = makeArm(1);

    // pernas
    function makeLeg(side) {
      const hip = new T.Group(); hip.position.set(side * 0.17, 0, 0); body.add(hip);
      hip.add(cyl(0.13, 0.11, THIGH, pantsC, { pos: [0, -THIGH / 2, 0], ol: 0.04, mat: pantsMat }));
      const knee = new T.Group(); knee.position.set(0, -THIGH, 0); hip.add(knee);
      knee.add(cyl(0.1, 0.08, SHIN, pantsC, { pos: [0, -SHIN / 2, 0], ol: 0.04, mat: pantsMat }));
      // CALÇADO: cada tipo tem a sua forma. Um tênis não é um sapato de outra cor.
      const kd = look.shoeKind || "sapato";
      if (kd === "tenis") {
        knee.add(box(0.19, 0.11, 0.33, shoe, { pos: [0, -SHIN - 0.01, 0.08], ol: 0.03 }));
        knee.add(box(0.205, 0.05, 0.35, 0xf4f1ea, { pos: [0, -SHIN - 0.075, 0.085], ol: 0.02 }));     // o solado branco e grosso
        knee.add(box(0.1, 0.05, 0.02, 0xf4f1ea, { pos: [0, -SHIN + 0.02, 0.2], outline: false }));    // os cadarços
      } else if (kd === "bota") {
        knee.add(cyl(0.105, 0.1, 0.3, shoe, { pos: [0, -SHIN + 0.15, 0], ol: 0.03 }));                // o cano subindo pela canela
        knee.add(box(0.18, 0.11, 0.31, shoe, { pos: [0, -SHIN - 0.01, 0.06], ol: 0.03 }));
      } else if (kd === "sapatilha") {
        knee.add(box(0.16, 0.06, 0.28, shoe, { pos: [0, -SHIN - 0.035, 0.06], ol: 0.025 }));          // rasa, o peito do pé à mostra
        knee.add(sph(0.035, shade(shoe, 0.3), { pos: [0, -SHIN - 0.01, 0.17], outline: false }));     // o lacinho
      } else if (kd === "sandalia") {
        knee.add(box(0.17, 0.035, 0.29, shoe, { pos: [0, -SHIN - 0.05, 0.06], ol: 0.02 }));           // a sola
        [-1, 1].forEach((sd) => knee.add(box(0.03, 0.06, 0.1, shoe, { pos: [sd * 0.06, -SHIN - 0.01, 0.1], rot: [0, 0, sd * 0.3], outline: false })));   // as tiras
      } else if (kd === "social") {
        knee.add(box(0.165, 0.085, 0.31, shoe, { pos: [0, -SHIN - 0.02, 0.07], ol: 0.03 }));
        knee.add(box(0.1, 0.02, 0.05, shade(shoe, 0.35), { pos: [0, -SHIN + 0.015, 0.14], outline: false }));   // a tira do mocassim
      } else knee.add(box(0.17, 0.09, 0.3, shoe, { pos: [0, -SHIN - 0.02, 0.07], ol: 0.03 }));
      if (artPsi) { knee.add(box(0.185, 0.03, 0.32, 0xece7df, { pos: [0, -SHIN - 0.075, 0.075], ol: 0.02 })); knee.add(box(0.15, 0.05, 0.11, 0xd8b98c, { pos: [0, -SHIN - 0.005, 0.175], ol: 0.02 })); }   // solado branco e biqueira, como na ilustração
      return { hip, knee };
    }
    const LL = makeLeg(-1), RL = makeLeg(1);

    // objetos que ela segura. A mão dominante é escolhida na criação (state.player.hand); por padrão, direita.
    const canhota = () => Boolean(typeof state !== "undefined" && state.player && state.player.hand === "left");
    const maoBoa = () => (canhota() ? L.hand : R.hand);
    const maoOutra = () => (canhota() ? R.hand : L.hand);
    const cup3 = new T.Group(); cup3.add(cyl(0.08, 0.06, 0.13, 0xffffff, { pos: [0, -0.02, 0.06], ol: 0.02 })); maoBoa().add(cup3);
    const clip = new T.Group(); clip.add(box(0.3, 0.4, 0.03, 0xb98a5a, { pos: [0.02, 0.05, 0.07], ol: 0.02 })); clip.add(box(0.24, 0.32, 0.02, 0xfff7e4, { pos: [0.02, 0.05, 0.09], outline: false })); maoOutra().add(clip);
    const book = new T.Group(); book.add(box(0.36, 0.26, 0.05, 0x4f7fc4, { pos: [0, 0.02, 0.08], ol: 0.02 })); maoBoa().add(book);
    const phone = new T.Group(); phone.add(box(0.1, 0.18, 0.02, 0x15131f, { pos: [0, 0.03, 0.07], ol: 0.01 })); phone.add(box(0.08, 0.15, 0.005, 0x9fd6ff, { pos: [0, 0.03, 0.082], outline: false, mat: { emissive: 0x6fb8ff, emissiveIntensity: 0.6 } })); maoBoa().add(phone);
    const bag = new T.Group(); bag.add(box(0.5, 0.42, 0.2, 0xd9694a, { pos: [0.28, -0.12, 0.05], ol: 0.04 })); maoBoa().add(bag);
    // regador: corpo, bico com crivo e alca. Antes a pose de regar erguia a mao VAZIA.
    const regador = new T.Group();
    regador.add(cyl(0.1, 0.115, 0.17, 0x6f9e86, { pos: [0, -0.01, 0.08], ol: 0.02 }));                                  // corpo
    regador.add(cyl(0.028, 0.038, 0.24, 0x6f9e86, { pos: [0.01, 0.05, 0.2], rot: [1.05, 0, 0], ol: 0.015 }));           // bico para a frente e para baixo
    regador.add(cyl(0.055, 0.045, 0.025, 0xcfe6d8, { pos: [0.01, 0.16, 0.3], rot: [1.05, 0, 0], outline: false }));     // crivo na ponta
    regador.add(box(0.035, 0.13, 0.035, 0x6f9e86, { pos: [-0.1, 0.06, 0.04], rot: [0, 0, -0.45], ol: 0.015 }));         // alca
    regador.add(cyl(0.105, 0.105, 0.02, 0xcfe6d8, { pos: [0, 0.08, 0.08], outline: false }));                           // boca aberta em cima
    maoBoa().add(regador);
    // fio de agua: so aparece enquanto ela rega
    const agua = new T.Group();
    for (let i = 0; i < 5; i++) agua.add(sph(0.022 - i * 0.002, 0x8fd0ee, { pos: [0.01, 0.1 - i * 0.09, 0.34 + i * 0.02], outline: false, mat: { transparent: true, opacity: 0.75 } }));
    regador.add(agua);
    [cup3, clip, book, phone, bag, regador].forEach((g) => { g.visible = false; });
    const props = { cup: cup3, clip, book, phone, bag, regador };

    // ---------------------------------------------------------------- estado e animação
    const cur = { sit: 1, lean: 0, twist: 0, hx: 0, hy: 0, hz: 0, mouth: 0.15, eyes: 1, Lsh: 0.25, Lel: 1.1, Lsz: 0, Rsh: 0.25, Rel: 1.1, Rsz: 0, lie: 0, bob: 0, swing: 0, yaw: 0 };
    const st = { time: 0, mode: "listen", since: 0, until: Infinity, posture: "sit", queue: [], step: null, seat: { x: 0, y: 0.9, z: 0, yaw: 0 }, bodyY: null, walkPhase: 0, speed: 1.7, hold: null, lookYaw: 0, blinkAt: 2, moved: 0, forceWalk: false, last: { x: 0, z: 0 }, clima: null, deitado: false };
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const sm = (a, b, t) => { const k = clamp01((t - a) / (b - a)); return k * k * (3 - 2 * k); };
    const lerp = (a, b, k) => a + (b - a) * k;

    // ângulos-alvo de cada modo (u = segundos desde o início do modo)
    function targetFor(u) {
      const w = { sit: st.posture === "sit" ? 1 : 0, lean: 0, twist: 0, hx: 0, hy: 0, hz: 0, mouth: 0.12, eyes: 1, Lsh: 0.1, Lel: 0.15, Lsz: 0.08, Rsh: 0.1, Rel: 0.15, Rsz: 0.08, lie: 0, hold: null, walkOn: false };
      if (w.sit) { w.Lsh = 0.3; w.Lel = 1.15; w.Rsh = 0.3; w.Rel = 1.15; w.Lsz = 0.05; w.Rsz = 0.05; }
      const m = st.mode;
      const s = Math.sin;
      if (m === "listen") { w.hx = 0.05 + 0.05 * s(u * 1.3) + 0.14 * Math.max(0, s(u * 0.9 - 1)); w.hy = 0.05 * s(u * 0.6); }
      else if (m === "talk") { w.mouth = 0.35 + 0.65 * Math.abs(s(u * 9)); w.hx = 0.04 * s(u * 3); w.hy = 0.1 * s(u * 1.7); w.Rsh = 0.55 + 0.35 * s(u * 3.1); w.Rel = 1.1 + 0.5 * s(u * 3.1 + 1); w.Lsh = 0.4 + 0.2 * s(u * 2.3 + 2); w.Lel = 1.2; w.lean = 0.05; }
      else if (m === "write") { w.hx = 0.32; w.lean = 0.1; w.Lsh = 0.75; w.Lel = 1.75; w.Lsz = 0.2; w.Rsh = 0.65; w.Rel = 1.55 + 0.05 * s(u * 15); w.Rsz = -0.05; w.hold = "clip"; }
      else if (m === "drink") { const k = sm(0, 0.5, u) * (1 - sm(1.9, 2.4, u)); w.Rsh = lerp(0.3, 1.0, k); w.Rel = lerp(1.15, 2.3, k); w.hx = -0.18 * sm(0.5, 1.0, u) * (1 - sm(1.6, 2.0, u)); w.hold = "cup"; w.eyes = 1 - 0.7 * sm(0.9, 1.1, u) * (1 - sm(1.6, 1.8, u)); }
      else if (m === "stretch") { const k = sm(0, 0.7, u) * (1 - sm(1.6, 2.2, u)); w.Lsh = lerp(0.1, 3.0, k); w.Rsh = lerp(0.1, 3.0, k); w.Lel = lerp(0.15, 0.2, k); w.Rel = lerp(0.15, 0.2, k); w.Lsz = lerp(0.08, 0.35, k); w.Rsz = lerp(0.08, -0.35, k); w.lean = -0.18 * k; w.hx = -0.25 * k; w.mouth = 0.2 + 0.5 * k; w.eyes = 1 - 0.6 * k; }
      else if (m === "water") { w.lean = 0.14; w.Rsh = 1.15; w.Rel = 0.35 + 0.1 * s(u * 3); w.Lsh = 0.4; w.Lel = 1.0; w.hx = 0.15; w.hy = 0.1 * s(u * 1.2); w.hold = "regador"; w.Rsz = -0.35 - 0.08 * s(u * 3); }   // inclina o pulso para o bico virar para a planta
      else if (m === "read") { w.hx = 0.32; w.Lsh = 0.95; w.Lel = 1.7; w.Rsh = 0.95; w.Rel = 1.7; w.Lsz = 0.05; w.Rsz = -0.05; w.hold = "book"; w.eyes = 0.8 + 0.2 * (s(u * 0.7) > 0.9 ? 0 : 1); }
      else if (m === "look") { w.hy = st.lookYaw * sm(0, 0.6, u); w.hx = -0.08 * sm(0, 0.6, u); w.twist = st.lookYaw * 0.3 * sm(0, 0.6, u); }
      else if (m === "proud") { w.Lsz = 0.75; w.Rsz = -0.75; w.Lsh = 0.05; w.Rsh = 0.05; w.Lel = 1.2; w.Rel = 1.2; w.hx = -0.1; w.lean = -0.04; w.mouth = 0.4; }
      else if (m === "peek") { w.lean = 0.3; w.hx = 0.25; w.Lsh = 0.4; w.Rsh = 0.4; w.Lel = 0.8; w.Rel = 0.8; }
      else if (m === "crouch") { w.lean = 0.28; w.hx = 0.2; w.Lsh = 0.9; w.Rsh = 0.9; w.Lel = 0.7; w.Rel = 0.7; w.sit = 0.72; }
      else if (m === "dab") { const k = sm(0, 0.5, u) * (1 - sm(1.3, 1.7, u)); w.Rsh = lerp(0.1, 1.1, k); w.Rel = lerp(0.15, 2.4, k); w.hx = 0.08 * k; }
      else if (m === "reach") { const k = sm(0, 0.5, u) * (1 - sm(1.2, 1.7, u)); w.Rsh = lerp(0.1, 2.7, k); w.Rel = lerp(0.15, 0.4, k); w.hx = -0.2 * k; w.lean = -0.05 * k; }
      else if (m === "sniff") { w.lean = 0.3 * sm(0, 0.6, u); w.hx = 0.25 * sm(0, 0.6, u) + 0.05 * s(u * 5); w.Rsh = 0.5; w.Rel = 1.2; w.eyes = 0.6; }
      else if (m === "wave") { w.Rsh = 2.5; w.Rel = 0.5 + 0.55 * s(u * 8); w.Rsz = -0.25; w.mouth = 0.5; w.hy = -0.1; }
      else if (m === "yawn") { const k = sm(0, 0.6, u) * (1 - sm(1.5, 2.1, u)); w.mouth = 0.2 + 1.1 * k; w.Rsh = lerp(0.1, 2.4, k); w.Lsh = lerp(0.1, 2.4, k); w.Rel = 0.3; w.Lel = 0.3; w.eyes = 1 - 0.9 * k; w.hx = -0.15 * k; }
      else if (m === "phone") { w.hx = 0.4; w.Rsh = 0.95; w.Rel = 1.7; w.Lsh = 0.5; w.Lel = 1.3; w.hold = "phone"; w.eyes = 0.85; w.mouth = 0.2; }
      else if (m === "bag") { w.Rsh = 0.12; w.Rel = 0.55; w.Lsh = 0.1; w.hold = "bag"; }
      else if (m === "sleep") { w.lie = 1; w.eyes = 0.05 + 0.03 * s(u * 1.4); w.mouth = 0.1; w.Lsh = 0.05; w.Rsh = 0.05; w.Lel = 0.1; w.Rel = 0.1; w.Lsz = 0.15; w.Rsz = -0.15; }
      else if (m === "walk") { w.walkOn = true; }

      // O corpo responde ao estado da sessão. No jogo o não verbal já é mecânica ("notar o corpo"), mas
      // a figura ficava igual com a pessoa fechada ou aberta. Agora defesa alta fecha o corpo (braços
      // para dentro, tronco para trás, queixo baixo, olhar de lado) e aliança alta abre (inclina para a
      // frente, braços soltos, olha para quem fala). É o que se lê numa sala de verdade.
      const cl = st.clima;
      if (cl) {
        const d = clamp01(cl.defesa || 0), a2 = clamp01(cl.alianca || 0);
        if (d > 0.05) {
          w.Lsh = lerp(w.Lsh, 0.95, d * 0.8); w.Rsh = lerp(w.Rsh, 0.95, d * 0.8);
          w.Lel = lerp(w.Lel, 1.85, d * 0.8); w.Rel = lerp(w.Rel, 1.85, d * 0.8);
          w.Lsz = lerp(w.Lsz, -0.32, d); w.Rsz = lerp(w.Rsz, 0.32, d);
          w.lean = lerp(w.lean, -0.12, d);
          w.hx = lerp(w.hx, 0.18, d * 0.7);
          w.hy = lerp(w.hy, -0.26, d * 0.6);
          w.mouth = lerp(w.mouth, 0.05, d * 0.7);
          w.eyes = lerp(w.eyes, 0.78, d * 0.5);
        }
        if (a2 > 0.05) {
          w.lean = lerp(w.lean, 0.14, a2 * 0.8);
          w.Lsh = lerp(w.Lsh, 0.22, a2 * 0.55); w.Rsh = lerp(w.Rsh, 0.22, a2 * 0.55);
          w.hy = lerp(w.hy, 0, a2 * 0.8);
          w.hx = lerp(w.hx, -0.03, a2 * 0.5);
        }
        if (cl.crise) { const j = s(u * 13) * 0.05; w.Lsz += j; w.Rsz -= j; w.hy += s(u * 3.7) * 0.06; }
      }
      return w;
    }

    // ---- física simples: móveis são caixas no chão; a caminhada contorna tudo (A* numa grade de 0,2 m)
    let obstacles = [];
    let walkBounds = null;                          // { x0, x1, z0, z1 }: onde ela pode andar (paredes do cômodo)
    const RAD = 0.36, CELL = 0.2, GX0 = -8, GZ0 = -4.4, NX = 100, NZ = 46;
    const inBox = (b, x, z, m) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m;
    const HARD = 0.2, SOFT = RAD;   // HARD: o corpo nunca entra; SOFT: passa, mas com custo, para preferir dar folga
    function planPath(sx, sz, gx, gz, enter) {
      // só ignora o móvel em que o corpo já está (levantando da cama, da poltrona) ou onde vai chegar (sentar); perto dele ainda conta
      const active = obstacles.filter((b) => !inBox(b, sx, sz, 0.05) && !(enter && inBox(b, gx, gz, 0.05)));
      if (!active.length) return [[gx, gz]];
      const state = new Uint8Array(NX * NZ);   // 0 livre, 1 perto de móvel (custa mais), 2 bloqueado
      const cell = (x, z) => [Math.max(0, Math.min(NX - 1, Math.floor((x - GX0) / CELL))), Math.max(0, Math.min(NZ - 1, Math.floor((z - GZ0) / CELL)))];
      const center = (i, j) => [GX0 + (i + 0.5) * CELL, GZ0 + (j + 0.5) * CELL];
      for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
        const [x, z] = center(i, j);
        let v = 0;
        if (walkBounds && (x < walkBounds.x0 || x > walkBounds.x1 || z < walkBounds.z0 || z > walkBounds.z1)) v = 2;
        else for (const b of active) { if (inBox(b, x, z, HARD)) { v = 2; break; } if (inBox(b, x, z, SOFT)) v = 1; }
        state[i + j * NX] = v;
      }
      const [si, sj] = cell(sx, sz);
      // quem já está colado num móvel consegue sair: as células duras vizinhas viram "perto"
      for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
        const ni = si + di, nj = sj + dj;
        if (ni >= 0 && nj >= 0 && ni < NX && nj < NZ && state[ni + nj * NX] === 2) { const [x, z] = center(ni, nj); if (!active.some((b) => inBox(b, x, z, 0))) state[ni + nj * NX] = 1; }
      }
      state[si + sj * NX] = Math.min(state[si + sj * NX], 1);
      // destino colado num móvel: desloca para o ponto livre mais próximo
      let [gi, gj] = cell(gx, gz);
      if (state[gi + gj * NX] === 2) {
        let best = null;
        for (let r = 1; r < 14 && !best; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const ni = gi + di, nj = gj + dj;
          if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ || state[ni + nj * NX] === 2) continue;
          const d2 = di * di + dj * dj;
          if (!best || d2 < best.d2) best = { ni, nj, d2 };
        }
        if (best) { [gx, gz] = center(best.ni, best.nj); gi = best.ni; gj = best.nj; }
      }
      const free = (x, z) => !active.some((b) => inBox(b, x, z, 0.26));
      const line = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1); for (let k = 0; k <= n; k++) if (!free(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return false; return true; };
      if (line(sx, sz, gx, gz)) return [[gx, gz]];
      const g = new Float32Array(NX * NZ).fill(1e9), from = new Int32Array(NX * NZ).fill(-1), done = new Uint8Array(NX * NZ);
      const open = [[0, si + sj * NX]];
      g[si + sj * NX] = 0;
      const h = (i, j) => Math.hypot(i - gi, j - gj);
      let found = false, near = si + sj * NX, nearD = h(si, sj);
      while (open.length) {
        let bi = 0;
        for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
        const [, cur0] = open.splice(bi, 1)[0];
        if (done[cur0]) continue;
        done[cur0] = 1;
        const ci = cur0 % NX, cj = Math.floor(cur0 / NX);
        if (h(ci, cj) < nearD) { nearD = h(ci, cj); near = cur0; }
        if (ci === gi && cj === gj) { found = true; break; }
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ || state[ni + nj * NX] === 2) continue;
          if (di && dj && (state[ci + (cj + dj) * NX] === 2 || state[ni + cj * NX] === 2)) continue;   // sem cortar quina
          const nk = ni + nj * NX, ng = g[cur0] + Math.hypot(di, dj) * (state[nk] === 1 ? 2.5 : 1);
          if (ng < g[nk]) { g[nk] = ng; from[nk] = cur0; open.push([ng + h(ni, nj), nk]); }
        }
      }
      if (!found) { gi = near % NX; gj = Math.floor(near / NX); [gx, gz] = center(gi, gj); }   // cercado: chega o mais perto que der
      const pts = [];
      for (let k = gi + gj * NX; k !== -1; k = from[k]) pts.push(center(k % NX, Math.floor(k / NX)));
      pts.reverse();
      pts[pts.length - 1] = [gx, gz];
      // puxa o fio: tira os pontos intermediários quando dá para ir em linha reta
      const out = [];
      let a = [sx, sz], idx = 0;
      while (idx < pts.length) {
        let far = idx;
        for (let k = pts.length - 1; k > idx; k--) if (line(a[0], a[1], pts[k][0], pts[k][1])) { far = k; break; }
        out.push(pts[far]);
        a = pts[far];
        idx = far + 1;
      }
      return out;
    }
    // empurra o corpo para fora de qualquer móvel em que ele tenha entrado (sem afetar quem sai da cama ou do sofá)
    function pushOut(step) {
      obstacles.forEach((b) => {
        if (!b.solid) return;
        // o móvel onde o passo começa (levantar da poltrona) ou termina (sentar, beira da cama) não a empurra para fora
        if (step && ((step.from && inBox(b, step.from[0], step.from[1], 0.05)) || (step.enter && step.walk && inBox(b, step.walk[0], step.walk[1], 0.05)))) return;
        const x = root.position.x, z = root.position.z;
        if (!inBox(b, x, z, RAD * 0.5)) return;
        const dl = x - (b.x0 - RAD * 0.5), dr = b.x1 + RAD * 0.5 - x, dt2 = z - (b.z0 - RAD * 0.5), db = b.z1 + RAD * 0.5 - z, m = Math.min(dl, dr, dt2, db);
        if (m === dl) root.position.x -= dl; else if (m === dr) root.position.x += dr; else if (m === dt2) root.position.z -= dt2; else root.position.z += db;
      });
    }

    function update(t, dt) {
      // PASSO DE TEMPO COM TETO (7.11). O primeiro quadro depois de montar a cena — e o primeiro depois
      // de voltar de outra aba — chega com um `dt` enorme (segundos). Como o passo é `speed * dt`, a
      // pessoa atravessava a sala inteira num quadro só: quem estava entrando pela porta aparecia
      // sentada de imediato, e a caminhada nunca era vista. 1/20 s é o teto: quatro passos por segundo
      // no pior caso, e nada teleporta.
      dt = Math.min(Math.max(Number(dt) || 0, 0), 0.05);
      st.time = t;
      // fila de passos (andar, sentar, levantar, modos)
      if (!st.step && st.queue.length) { st.step = st.queue.shift(); st.step.t0 = t; if (st.step.aoComecar) { try { st.step.aoComecar(); } catch (e) { /* o passo continua mesmo se o aviso falhar */ } } if (st.step.mode) { st.mode = st.step.mode; st.since = t; } if (st.step.posture) { st.posture = st.step.posture; if (st.step.posture === "sit" && Math.hypot(root.position.x - st.seat.x, root.position.z - st.seat.z) > 0.6) { root.position.set(st.seat.x, root.position.y, st.seat.z); cur.yaw = st.seat.yaw; } } if (st.step.lookYaw !== undefined) st.lookYaw = st.step.lookYaw; if (st.step.snap) { root.position.set(st.step.snap[0], root.position.y, st.step.snap[1]); } }
      let walking = st.forceWalk;
      const s0 = st.step;
      if (s0) {
        if (s0.walk) {
          if (!s0.path) {
            s0.path = obstacles.length && !s0.free ? planPath(root.position.x, root.position.z, s0.walk[0], s0.walk[1], s0.enter) : [[s0.walk[0], s0.walk[1]]];
            s0.from = [root.position.x, root.position.z];
            s0.walk = s0.path[s0.path.length - 1];        // o planejador pode afastar o destino de um móvel
            s0.best = 1e9; s0.improveAt = t;
          }
          const wp = s0.path.length > 1 ? s0.path[0] : s0.walk;
          if (s0.path.length > 1 && Math.hypot(wp[0] - root.position.x, wp[1] - root.position.z) < 0.12) s0.path.shift();
          const tgt = s0.path.length > 1 ? s0.path[0] : s0.walk;
          const dx = tgt[0] - root.position.x, dz = tgt[1] - root.position.z, d = Math.hypot(dx, dz);
          st.posture = "stand"; st.mode = "walk";
          // vigia: se em 2 s ela não chegou mais perto do destino, dá o passo por concluído em vez de ficar presa
          const left = Math.hypot(s0.walk[0] - root.position.x, s0.walk[1] - root.position.z) + (s0.path.length - 1) * 0.5;
          if (left < s0.best - 0.02) { s0.best = left; s0.improveAt = t; }
          else if (t - s0.improveAt > 2) { st.step = null; return; }
          if (s0.path.length > 1 && d <= 0.06) s0.path.shift();
          if (d > 0.06 || s0.path.length > 1) {
            const sp = Math.min(d, st.speed * dt);
            root.position.x += (dx / d) * sp; root.position.z += (dz / d) * sp;
            const ty = Math.atan2(dx, dz);
            let dy = ty - cur.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
            cur.yaw += dy * Math.min(1, dt * 9);
            walking = true;
          } else {
            if (s0.face !== undefined) { let dy = s0.face - cur.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; cur.yaw += dy * Math.min(1, dt * 7); if (Math.abs(dy) > 0.05) walking = false; else st.step = null; }
            else st.step = null;
          }
        } else if (s0.wait !== undefined || s0.mode || s0.posture) {
          if (t - s0.t0 >= (s0.ms || s0.wait || 0) / 1000) {
            st.step = null;
            if (!st.queue.length && s0.mode && s0.ms < 60000) { st.mode = st.posture === "sit" ? "listen" : "idle"; st.since = t; }   // acabou a sequência: volta ao normal
          }
        } else st.step = null;
      }
      if (st.step && st.step.walk) pushOut(st.step);
      if (!st.step && !st.queue.length && st.mode === "walk" && !st.forceWalk) { st.mode = st.posture === "sit" ? "listen" : "idle"; st.since = t; }
      if (st.until < t) { st.mode = st.posture === "sit" ? "listen" : "idle"; st.since = t; st.until = Infinity; }

      const u = t - st.since;
      const w = targetFor(u);
      const k = Math.min(1, dt * 7);
      const ease = (key, v) => { cur[key] += (v - cur[key]) * k; };
      ["lean", "twist", "hx", "hy", "hz", "mouth", "Lsh", "Lel", "Lsz", "Rsh", "Rel", "Rsz"].forEach((key) => ease(key, w[key]));
      if (st.deitado) { w.lie = 1; w.sit = 0.3; }   // deitada, com o joelho de leve dobrado: ninguém deita de perna esticada num divã
      cur.eyes += (w.eyes - cur.eyes) * Math.min(1, dt * 14);
      cur.sit += (w.sit - cur.sit) * Math.min(1, dt * 4.5);
      cur.lie += (w.lie - cur.lie) * Math.min(1, dt * 2.2);

      // andar: pernas e braços balançam; o corpo sobe e desce
      const speedNow = walking ? 1 : 0;
      cur.swing += (speedNow - cur.swing) * Math.min(1, dt * 8);
      if (walking) st.walkPhase += dt * 8.5;
      const sw = Math.sin(st.walkPhase) * 0.55 * cur.swing;
      const bob = Math.abs(Math.sin(st.walkPhase)) * 0.06 * cur.swing;
      const breathe = 1 + 0.014 * Math.sin(t * 1.7);

      const seatY = st.seat.y;
      const baseY = lerp(STAND_Y, seatY, cur.sit);
      body.position.y = st.bodyY !== null ? st.bodyY : baseY + bob;
      body.rotation.z = cur.lie * Math.PI / 2;
      waist.rotation.x = cur.lean + 0.05 * cur.swing;
      waist.rotation.y = cur.twist;
      waist.scale.y = breathe;
      head.rotation.x = cur.hx; head.rotation.y = cur.hy; head.rotation.z = cur.hz;
      const thigh = -cur.sit * Math.PI / 2, knee = cur.sit * Math.PI / 2;
      LL.hip.rotation.x = thigh + sw; RL.hip.rotation.x = thigh - sw;
      LL.knee.rotation.x = knee + Math.max(0, -sw) * 0.9; RL.knee.rotation.x = knee + Math.max(0, sw) * 0.9;
      L.sh.rotation.x = -(cur.Lsh) - sw * 0.7 * (1 - Math.min(1, cur.Lsh)); R.sh.rotation.x = -(cur.Rsh) + sw * 0.7 * (1 - Math.min(1, cur.Rsh));
      L.sh.rotation.z = -cur.Lsz; R.sh.rotation.z = -cur.Rsz;
      L.el.rotation.x = -cur.Lel; R.el.rotation.x = -cur.Rel;
      if (faceUpdate) faceUpdate(t);
      eyes.forEach((e) => { e.scale.set(e.userData.kx || 1, Math.max(0.08, cur.eyes * (t > st.blinkAt && t < st.blinkAt + 0.13 ? 0.1 : 1)) * (e.userData.ky || 1), e.userData.kz || 1); });
      if (t > st.blinkAt + 0.13) st.blinkAt = t + 2.5 + Math.random() * 3;
      if (bocaAbre) bocaAbre.scale.set(1 - 0.16 * cur.mouth, Math.max(0.02, cur.mouth * 0.6), 0.3);
      else mouth.scale.set(1 - 0.3 * cur.mouth, 0.4 + cur.mouth * 3.2, 1);
      // Lateralidade: as poses são escritas para destra. Para canhota, espelha-se os braços e o objeto
      // troca de mão — assim a pessoa usa as coisas com a mão que ela escolheu na criação.
      if (canhota()) {
        const t2 = cur.Lsh; cur.Lsh = cur.Rsh; cur.Rsh = t2;
        const t3 = cur.Lel; cur.Lel = cur.Rel; cur.Rel = t3;
        const t4 = cur.Lsz; cur.Lsz = -cur.Rsz; cur.Rsz = -t4;
      }
      const hold = w.hold;
      Object.keys(props).forEach((k) => { props[k].visible = hold === k; });   // percorre a lista: assim um objeto novo nunca fica esquecido
      root.rotation.y = cur.yaw;
    }

    // ---------------------------------------------------------------- comandos
    const api = {
      root, props,
      update,
      setSeat(x, y, z, yaw) { st.seat = { x, y, z, yaw, yawOffset: 0 }; },
      setClima(c) { st.clima = c || null; },   // { defesa: 0..1, alianca: 0..1, crise: bool } — postura que responde à sessão
      placeSeated() { root.position.set(st.seat.x, 0, st.seat.z); cur.yaw = st.seat.yaw; st.posture = "sit"; cur.sit = 1; body.position.y = st.seat.y; },
      place(x, z, yaw) { root.position.set(x, 0, z); if (yaw !== undefined) cur.yaw = yaw; },
      setBodyY(y) { st.bodyY = y; },
      deitar(on) { st.deitado = Boolean(on); if (on) { st.posture = "stand"; cur.sit = 0; cur.lie = 1; } },
      _st: () => st,
      mode(name, ms) { st.queue.length = 0; st.step = null; st.mode = name; st.since = st.time; st.until = ms ? st.time + ms / 1000 : Infinity; },
      posture(p) { st.posture = p; },
      run(steps) { st.queue.push(...steps); },
      clear() { st.queue.length = 0; st.step = null; },
      busy() { return Boolean(st.step) || st.queue.length > 0; },
      setObstacles(list) { obstacles = list || []; },
      setBounds(b) { walkBounds = b || null; },
      getObstacles: () => obstacles,
      debugStep: () => (st.step ? { walk: st.step.walk, path: st.step.path, face: st.step.face, mode: st.mode } : null),
      position: () => ({ x: root.position.x, z: root.position.z }),
      walkPhaseOn(on) { st.forceWalk = on; if (on) { st.mode = "bag"; st.posture = "stand"; cur.sit = 0; } },
      isSeated: () => st.posture === "sit",
      current: () => st.mode,
      pose: cur
    };
    root.userData.doctor = api;
    return api;
  }
  return makeDoctor;
};

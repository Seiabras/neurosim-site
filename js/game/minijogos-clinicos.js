"use strict";

// ===========================================================================
// OFICINA CLÍNICA: cinco exercícios do ofício, no mesmo esqueleto da Ludoteca (js/game/minigames.js).
// A Ludoteca treina funções da mente — atenção, memória, inibição. Estes cinco treinam o que um
// psicólogo FAZ: escutar o sentimento por trás do conteúdo, triar risco contra critério, desenhar a
// família, devolver em linguagem que a pessoa entenda e decidir com o Código na mão.
// Cada um alimenta o eixo da Roda que lhe corresponde, e não a Psicometria.
// ===========================================================================
(function () {
  if (!window.Minigames || !Minigames.registrar) return;
  const L = window.L;
  const P = (o) => I18N.pick(o);
  const baralhar = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const estrelas = (acertos, total) => { const p = acertos / total; return p >= 0.9 ? 3 : p >= 0.7 ? 2 : p >= 0.5 ? 1 : 0; };

  // ------------------------------------------------------------------ 1) escuta reflexiva
  // Refletir não é repetir o que a pessoa disse nem dar conselho: é devolver o SENTIMENTO que estava
  // por baixo da frase. As três opções de cada rodada são exatamente as três coisas que se costuma
  // fazer no lugar disso.
  const ESCUTA = [
    { fala: L("Eu faço tudo certo, chego no horário, entrego tudo — e mesmo assim parece que nunca é o bastante.",
              "I do everything right, I'm on time, I deliver everything — and still it never seems to be enough.",
              "Hago todo bien, llego a tiempo, entrego todo, y aun así nunca parece suficiente."),
      certa: L("Por mais que você se esforce, fica a sensação de que não conta.", "However hard you try, the feeling stays that it doesn't count.", "Por más que te esfuerces, queda la sensación de que no cuenta."),
      erradas: [L("Então você é pontual e cumpre os prazos.", "So you're punctual and meet deadlines.", "Entonces eres puntual y cumples los plazos."),
                L("Já pensou em conversar com o seu chefe sobre isso?", "Have you thought about talking to your boss about it?", "¿Pensaste en hablar con tu jefe sobre eso?")],
      porque: L("A primeira repete o conteúdo; a segunda dá conselho. Refletir é devolver o sentimento que estava por baixo.", "The first repeats the content; the second gives advice. Reflecting is giving back the feeling underneath.", "La primera repite el contenido; la segunda da consejo. Reflejar es devolver el sentimiento de debajo.") },
    { fala: L("Minha mãe ligou ontem. A gente falou vinte minutos e eu desliguei com um aperto no peito que eu não sei explicar.",
              "My mother called yesterday. We talked twenty minutes and I hung up with a tightness in my chest I can't explain.",
              "Mi madre llamó ayer. Hablamos veinte minutos y colgué con una opresión en el pecho que no sé explicar."),
      certa: L("Foi uma conversa curta, mas ela deixou alguma coisa pesada em você.", "It was a short call, but it left something heavy in you.", "Fue una charla corta, pero te dejó algo pesado."),
      erradas: [L("Vinte minutos é bastante tempo para uma ligação.", "Twenty minutes is a fair while for a call.", "Veinte minutos es bastante para una llamada."),
                L("Aperto no peito pode ser ansiedade. Você já mediu a pressão?", "Chest tightness can be anxiety. Have you had your blood pressure checked?", "La opresión en el pecho puede ser ansiedad. ¿Te has medido la presión?")],
      porque: L("A segunda troca o afeto por um sintoma e leva a conversa para o corpo antes de a pessoa ter nomeado o que sentiu.", "The second swaps the affect for a symptom and takes the conversation to the body before the person has named what they felt.", "La segunda cambia el afecto por un síntoma y lleva la charla al cuerpo antes de que la persona nombre lo que sintió.") },
    { fala: L("Eu não chorei no enterro. Todo mundo chorou e eu fiquei ali, organizando as cadeiras.",
              "I didn't cry at the funeral. Everyone cried and I just stood there, arranging the chairs.",
              "No lloré en el entierro. Todos lloraron y yo me quedé ahí, ordenando las sillas."),
      certa: L("Você ficou cuidando do que dava para cuidar, enquanto o resto não cabia.", "You took care of what could be taken care of, while the rest didn't fit.", "Te quedaste cuidando lo que se podía cuidar, mientras el resto no cabía."),
      erradas: [L("Nem todo mundo demonstra luto da mesma forma; isso é normal.", "Not everyone shows grief the same way; that's normal.", "No todos muestran el duelo igual; eso es normal."),
                L("E por que você acha que não conseguiu chorar?", "And why do you think you couldn't cry?", "¿Y por qué crees que no pudiste llorar?")],
      porque: L("A primeira tranquiliza e fecha o assunto; a segunda cobra uma explicação que a pessoa ainda não tem.", "The first reassures and closes the subject; the second demands an explanation the person does not yet have.", "La primera tranquiliza y cierra el tema; la segunda exige una explicación que la persona aún no tiene.") },
    { fala: L("Eu larguei a faculdade. Meu pai não fala comigo desde então, e eu acho que ele tem razão.",
              "I dropped out of university. My father hasn't spoken to me since, and I think he's right.",
              "Dejé la facultad. Mi padre no me habla desde entonces, y creo que tiene razón."),
      certa: L("Além do silêncio dele, você carrega também a parte que acha que é sua.", "Beyond his silence, you're also carrying the part you think is yours.", "Además de su silencio, cargas también la parte que crees que es tuya."),
      erradas: [L("Você largou a faculdade e o seu pai parou de falar com você.", "You dropped out and your father stopped speaking to you.", "Dejaste la facultad y tu padre dejó de hablarte."),
                L("Ele não tem razão. Você tem o direito de escolher o seu caminho.", "He isn't right. You have the right to choose your own path.", "Él no tiene razón. Tienes derecho a elegir tu camino.")],
      porque: L("A segunda toma partido e tira da pessoa o trabalho de decidir o que ela pensa disso.", "The second takes sides and robs the person of the work of deciding what they think.", "La segunda toma partido y le quita a la persona el trabajo de decidir qué piensa.") },
    { fala: L("Tá tudo bem, doutora. Sério. Eu só não durmo, não como direito e chorei três vezes essa semana, mas tá tudo bem.",
              "Everything's fine, doctor. Really. I just don't sleep, don't eat properly and cried three times this week, but everything's fine.",
              "Todo bien, doctora. En serio. Solo que no duermo, no como bien y lloré tres veces esta semana, pero todo bien."),
      certa: L("Você diz que está tudo bem e me conta três coisas que dizem o contrário.", "You say everything's fine and tell me three things that say otherwise.", "Dices que todo está bien y me cuentas tres cosas que dicen lo contrario."),
      erradas: [L("Que bom que está tudo bem.", "I'm glad everything's fine.", "Qué bueno que todo esté bien."),
                L("Não dormir e não comer são sinais de depressão.", "Not sleeping and not eating are signs of depression.", "No dormir y no comer son signos de depresión.")],
      porque: L("A primeira aceita a fachada; a segunda diagnostica antes da hora. Refletir aqui é mostrar a contradição sem acusar.", "The first accepts the front; the second diagnoses too early. Reflecting here is showing the contradiction without accusing.", "La primera acepta la fachada; la segunda diagnostica antes de tiempo.") },
    { fala: L("Eu só queria que alguém perguntasse como eu tô sem esperar que eu responda 'bem'.",
              "I just wish someone would ask how I am without expecting me to answer 'fine'.",
              "Solo quería que alguien preguntara cómo estoy sin esperar que responda 'bien'."),
      certa: L("Você está me pedindo uma pergunta que aguente a resposta de verdade.", "You're asking me for a question that can take the real answer.", "Me estás pidiendo una pregunta que aguante la respuesta de verdad."),
      erradas: [L("Como você está?", "How are you?", "¿Cómo estás?"),
                L("Aqui você pode responder o que quiser, sem julgamento.", "Here you can answer whatever you like, without judgement.", "Aquí puedes responder lo que quieras, sin juicio.")],
      porque: L("A primeira faz literalmente o que ela pediu e perde o pedido; a segunda oferece a regra da sala em vez de escutar.", "The first literally does what she asked and misses the request; the second offers the room's rule instead of listening.", "La primera hace literalmente lo que pidió y pierde el pedido; la segunda ofrece la regla de la sala en vez de escuchar.") }
  ];

  // ------------------------------------------------------------------ 2) triagem de risco
  const RISCO = [
    { f: L("“Às vezes eu penso que seria mais fácil não acordar.”", "“Sometimes I think it would be easier not to wake up.”", "“A veces pienso que sería más fácil no despertar.”"), n: 1,
      p: L("Ideação passiva, sem plano nem intenção: é risco, mas é o degrau mais baixo dele.", "Passive ideation, no plan or intent: it is risk, but its lowest rung.", "Ideación pasiva, sin plan ni intención: es riesgo, pero el escalón más bajo.") },
    { f: L("“Eu já separei o que eu ia deixar para cada um. Tá tudo escrito.”", "“I've already set aside what I'd leave to each of them. It's all written down.”", "“Ya separé lo que le dejaría a cada uno. Está todo escrito.”"), n: 2,
      p: L("Preparativos concretos e despedida: é o sinal mais grave que uma frase pode carregar.", "Concrete preparations and farewell: the gravest sign a sentence can carry.", "Preparativos concretos y despedida: la señal más grave que puede llevar una frase.") },
    { f: L("“Ando muito triste, mas eu tenho meus filhos. Eu nunca faria isso com eles.”", "“I've been very sad, but I have my children. I would never do that to them.”", "“Estoy muy triste, pero tengo a mis hijos. Nunca les haría eso.”"), n: 0,
      p: L("Sofrimento com fator de proteção explícito e sem ideação: acompanhar, não alarmar.", "Suffering with an explicit protective factor and no ideation: follow up, do not alarm.", "Sufrimiento con factor de protección explícito y sin ideación: acompañar, no alarmar.") },
    { f: L("“Eu tentei em janeiro. Ninguém soube. Esses dias voltou a passar pela cabeça.”", "“I tried in January. Nobody knew. These days it's come back into my head.”", "“Lo intenté en enero. Nadie lo supo. Estos días volvió a pasarme por la cabeza.”"), n: 2,
      p: L("Tentativa anterior é o preditor isolado mais forte, e a ideação voltou: risco alto.", "A previous attempt is the single strongest predictor, and the ideation has returned: high risk.", "Un intento previo es el predictor aislado más fuerte, y la ideación volvió: riesgo alto.") },
    { f: L("“Me cortei de novo. Não é para morrer, é para parar de sentir.”", "“I cut myself again. It's not to die, it's to stop feeling.”", "“Me corté de nuevo. No es para morir, es para dejar de sentir.”"), n: 1,
      p: L("Autolesão sem intenção suicida é risco moderado — e não se confunde com tentativa, nem se despreza.", "Self-harm without suicidal intent is moderate risk — not to be confused with an attempt, nor dismissed.", "La autolesión sin intención suicida es riesgo moderado: ni se confunde con intento ni se desprecia.") },
    { f: L("“Eu bebo todo fim de semana, mas só socialmente. Ontem eu não lembrava como cheguei em casa.”", "“I drink every weekend, but only socially. Yesterday I couldn't remember how I got home.”", "“Bebo cada fin de semana, pero solo socialmente. Ayer no recordaba cómo llegué a casa.”"), n: 1,
      p: L("Lacuna de memória contradiz o “só socialmente”: é uso de risco, e o risco aqui é do corpo e do julgamento.", "A memory blackout contradicts “only socially”: risky use, and the risk here is to the body and to judgement.", "La laguna de memoria contradice el “solo socialmente”: uso de riesgo.") },
    { f: L("“Meu marido quebrou meu celular ontem. Ele só estava nervoso.”", "“My husband smashed my phone yesterday. He was just upset.”", "“Mi marido rompió mi celular ayer. Solo estaba nervioso.”"), n: 2,
      p: L("Violência em escalada, minimizada por quem a sofre: risco alto, e de outra pessoa além dela.", "Escalating violence, minimised by the person suffering it: high risk, and from someone other than herself.", "Violencia en escalada, minimizada por quien la sufre: riesgo alto.") },
    { f: L("“Eu tô cansada. Só isso. Cansada de trabalhar tanto.”", "“I'm tired. That's all. Tired of working so much.”", "“Estoy cansada. Nada más. Cansada de trabajar tanto.”"), n: 0,
      p: L("Cansaço nomeado e explicado, sem sinal de risco: nem tudo que dói é emergência.", "Tiredness named and explained, with no sign of risk: not everything that hurts is an emergency.", "Cansancio nombrado y explicado, sin señal de riesgo: no todo lo que duele es emergencia.") }
  ];
  const NIVEIS = [
    { ic: "🟢", n: L("Baixo", "Low", "Bajo") },
    { ic: "🟡", n: L("Moderado", "Moderate", "Moderado") },
    { ic: "🔴", n: L("Alto", "High", "Alto") }
  ];

  // ------------------------------------------------------------------ 3) genograma
  const GENO = [
    { q: L("O casal está separado há dois anos.", "The couple separated two years ago.", "La pareja se separó hace dos años."),
      certa: L("Duas barras cortando a linha do casal", "Two slashes cutting the couple's line", "Dos barras cortando la línea de la pareja"),
      erradas: [L("Linha pontilhada entre os dois", "A dotted line between the two", "Línea punteada entre los dos"), L("Linha dupla entre os dois", "A double line between the two", "Línea doble entre los dos")],
      porque: L("Pontilhado é união não formalizada; linha dupla é relação muito próxima. Separação se marca com duas barras cortando a linha.", "Dotted is an informal union; double line is a very close relationship. Separation is marked with two slashes cutting the line.", "Punteada es unión no formalizada; línea doble es relación muy cercana. La separación se marca con dos barras.") },
    { q: L("O filho mais velho morreu aos dezenove anos.", "The eldest son died at nineteen.", "El hijo mayor murió a los diecinueve."),
      certa: L("Quadrado com um X dentro", "A square with an X inside", "Cuadrado con una X dentro"),
      erradas: [L("Círculo com um X dentro", "A circle with an X inside", "Círculo con una X dentro"), L("Quadrado tracejado", "A dashed square", "Cuadrado discontinuo")],
      porque: L("Quadrado é homem, círculo é mulher, e o X marca quem morreu. O tracejado não é símbolo de morte.", "A square is a man, a circle is a woman, and the X marks who died. Dashed is not a death symbol.", "Cuadrado es hombre, círculo es mujer, y la X marca a quien murió.") },
    { q: L("Mãe e filha brigam sem parar, mas não se desgrudam.", "Mother and daughter fight constantly, but are inseparable.", "Madre e hija pelean sin parar, pero no se separan."),
      certa: L("Linha fusionada e conflituosa ao mesmo tempo (três linhas com o zigue-zague)", "A line both fused and conflictual (three lines with a zigzag)", "Línea fusionada y conflictiva a la vez (tres líneas con el zigzag)"),
      erradas: [L("Só o zigue-zague do conflito", "Just the conflict zigzag", "Solo el zigzag del conflicto"), L("Linha cortada de rompimento", "A cut-off line", "Línea cortada de ruptura")],
      porque: L("Brigar muito e não se desgrudar é o padrão fusionado-conflituoso: os dois símbolos juntos. Só o conflito perderia a parte que mais importa.", "Fighting a lot and never separating is the fused-conflictual pattern: both symbols together. Conflict alone would lose the part that matters most.", "Pelear mucho y no separarse es el patrón fusionado-conflictivo: los dos símbolos juntos.") },
    { q: L("A avó materna e a paciente não se falam há dez anos.", "The maternal grandmother and the patient haven't spoken in ten years.", "La abuela materna y la paciente no se hablan hace diez años."),
      certa: L("Linha interrompida no meio (rompimento)", "A line broken in the middle (cut-off)", "Línea interrumpida en el medio (ruptura)"),
      erradas: [L("Nenhuma linha entre as duas", "No line between them", "Ninguna línea entre las dos"), L("Zigue-zague de conflito", "A conflict zigzag", "Zigzag de conflicto")],
      porque: L("Não desenhar nada diria que não há relação; o zigue-zague diria briga ativa. Rompimento é uma relação que existe e foi cortada.", "Drawing nothing would say there is no relationship; the zigzag would say active fighting. Cut-off is a relationship that exists and was severed.", "No dibujar nada diría que no hay relación; el zigzag diría pelea activa.") },
    { q: L("A paciente é a segunda de três irmãos.", "The patient is the second of three siblings.", "La paciente es la segunda de tres hermanos."),
      certa: L("No meio da fila, com o mais velho à esquerda", "In the middle of the row, with the eldest on the left", "En medio de la fila, con el mayor a la izquierda"),
      erradas: [L("No meio da fila, com o mais velho à direita", "In the middle of the row, with the eldest on the right", "En medio de la fila, con el mayor a la derecha"), L("Fora da fila, ligada por uma seta", "Outside the row, linked by an arrow", "Fuera de la fila, unida por una flecha")],
      porque: L("A fraternidade se desenha da esquerda para a direita, do mais velho ao mais novo. É convenção, e é o que deixa o genograma legível por qualquer colega.", "Siblings are drawn left to right, eldest to youngest. It is convention, and it is what makes a genogram readable by any colleague.", "La fratría se dibuja de izquierda a derecha, del mayor al menor.") }
  ];

  // ------------------------------------------------------------------ 4) devolutiva em linguagem simples
  const DEVOL = [
    { tec: L("Observa-se rebaixamento do humor com anedonia e alterações neurovegetativas.", "We observe lowered mood with anhedonia and neurovegetative changes.", "Se observa descenso del ánimo con anhedonia y alteraciones neurovegetativas."),
      certa: L("A senhora anda triste a maior parte do tempo, perdeu o gosto pelas coisas que gostava, e isso mexeu com o seu sono e o seu apetite.", "You've been sad most of the time, lost your taste for things you used to enjoy, and that has affected your sleep and appetite.", "Está triste la mayor parte del tiempo, perdió el gusto por las cosas que disfrutaba, y eso afectó su sueño y su apetito."),
      erradas: [L("A senhora está com depressão.", "You have depression.", "Usted tiene depresión."), L("A senhora apresenta humor rebaixado com anedonia e sintomas neurovegetativos.", "You present lowered mood with anhedonia and neurovegetative symptoms.", "Usted presenta ánimo bajo con anhedonia y síntomas neurovegetativos.")],
      porque: L("A primeira troca a descrição por um rótulo e perde tudo o que foi observado; a segunda só tira as palavras difíceis de lugar sem traduzir nenhuma.", "The first swaps the description for a label and loses everything observed; the second just moves the hard words around without translating any.", "La primera cambia la descripción por una etiqueta; la segunda solo mueve las palabras difíciles sin traducir ninguna.") },
    { tec: L("O desempenho situa-se abaixo do esperado para a faixa etária em memória operacional.", "Performance falls below what is expected for the age range in working memory.", "El desempeño se sitúa por debajo de lo esperado para la edad en memoria de trabajo."),
      certa: L("Guardar uma informação na cabeça enquanto faz outra coisa está mais difícil para ele do que costuma ser em crianças da idade dele.", "Holding a piece of information in mind while doing something else is harder for him than it usually is for children his age.", "Guardar una información en la cabeza mientras hace otra cosa le cuesta más que a los niños de su edad."),
      erradas: [L("Ele tem memória fraca.", "He has a weak memory.", "Tiene mala memoria."), L("Ele foi mal no teste de memória.", "He did badly on the memory test.", "Le fue mal en la prueba de memoria.")],
      porque: L("A primeira generaliza para “memória” inteira o que era um tipo específico dela; a segunda transforma um dado normativo em nota de prova.", "The first generalises to “memory” as a whole what was one specific kind of it; the second turns a normative datum into an exam grade.", "La primera generaliza a toda la “memoria” lo que era un tipo específico; la segunda convierte un dato normativo en nota de examen.") },
    { tec: L("Os achados são sugestivos, porém não conclusivos, e requerem reavaliação.", "The findings are suggestive but not conclusive, and require reassessment.", "Los hallazgos son sugestivos pero no concluyentes y requieren reevaluación."),
      certa: L("O que eu vi aponta para essa direção, mas ainda não é o suficiente para eu afirmar. Eu prefiro olhar de novo daqui a um tempo a dizer uma coisa que pode estar errada.", "What I saw points that way, but it is not yet enough for me to state it. I would rather look again in a while than say something that may be wrong.", "Lo que vi apunta en esa dirección, pero aún no es suficiente para afirmarlo. Prefiero mirar de nuevo más adelante."),
      erradas: [L("Ainda não dá para saber.", "We can't know yet.", "Todavía no se puede saber."), L("Os achados são sugestivos, mas precisamos reavaliar.", "The findings are suggestive, but we need to reassess.", "Los hallazgos son sugestivos, pero hay que reevaluar.")],
      porque: L("A primeira devolve incerteza sem devolver a direção, e a família sai sem nada; a segunda mantém “achados sugestivos”, que não é português de quem escuta.", "The first gives back uncertainty without the direction, and the family leaves with nothing; the second keeps “suggestive findings”, which is not the language of the person listening.", "La primera devuelve incertidumbre sin dirección; la segunda mantiene “hallazgos sugestivos”, que no es el idioma de quien escucha.") },
    { tec: L("Recomenda-se psicoterapia com abordagem cognitivo-comportamental, semanal, por no mínimo seis meses.", "Weekly cognitive-behavioural psychotherapy is recommended for at least six months.", "Se recomienda psicoterapia cognitivo-conductual semanal durante al menos seis meses."),
      certa: L("O que eu recomendo é uma terapia uma vez por semana, com um jeito de trabalho que mexe no que a gente pensa e no que a gente faz. Por experiência, seis meses é o mínimo para começar a fazer diferença.", "What I recommend is therapy once a week, with a way of working that addresses what we think and what we do. From experience, six months is the minimum to start making a difference.", "Lo que recomiendo es terapia una vez por semana, con una forma de trabajo que toca lo que pensamos y lo que hacemos. Seis meses es el mínimo para empezar a notar diferencia."),
      erradas: [L("A senhora precisa fazer TCC semanal por seis meses.", "You need weekly CBT for six months.", "Necesita hacer TCC semanal durante seis meses."), L("Vou encaminhar para psicoterapia.", "I'll refer you for psychotherapy.", "La derivaré a psicoterapia.")],
      porque: L("A primeira usa a sigla como se todo mundo soubesse; a segunda tira a recomendação inteira e não diz nem com que frequência nem por quanto tempo.", "The first uses the acronym as if everyone knew it; the second removes the whole recommendation and says neither how often nor for how long.", "La primera usa la sigla como si todos la supieran; la segunda quita toda la recomendación.") }
  ];

  // ------------------------------------------------------------------ 5) ética em cinco minutos
  const ETICA = [
    { caso: L("A mãe de um adolescente de 15 anos que você atende pede, no corredor, “só um resumo” do que ele falou na sessão.", "The mother of a 15-year-old you see asks you, in the corridor, for “just a summary” of what he said in session.", "La madre de un adolescente de 15 años que atiendes te pide, en el pasillo, “solo un resumen” de lo que dijo en sesión."),
      certa: L("Explicar que o conteúdo é sigiloso, oferecer uma conversa combinada com o adolescente presente e informar só o que for indispensável à proteção dele.", "Explain that the content is confidential, offer a meeting agreed with the adolescent present, and share only what is indispensable to his protection.", "Explicar que el contenido es confidencial, ofrecer una charla acordada con el adolescente presente e informar solo lo indispensable para su protección."),
      erradas: [L("Contar o essencial: ela é a responsável legal e tem direito de saber.", "Tell the essentials: she is the legal guardian and has a right to know.", "Contar lo esencial: es la responsable legal y tiene derecho a saber."),
                L("Dizer que não pode falar nada, em hipótese alguma, e encerrar a conversa.", "Say you cannot say anything at all, under any circumstances, and end the conversation.", "Decir que no puede decir nada, bajo ninguna circunstancia, y terminar la conversación.")],
      porque: L("O sigilo do adolescente é regra, e a responsabilidade legal não o dissolve — mas fechar a porta na cara de quem cuida também não é conduta: o caminho é combinar com ele o que será dito.", "The adolescent's confidentiality is the rule, and legal guardianship does not dissolve it — but shutting the door on a carer is not conduct either: the way is to agree with him what will be said.", "El secreto del adolescente es regla y la responsabilidad legal no lo disuelve, pero cerrar la puerta a quien cuida tampoco es conducta.") },
    { caso: L("Um paciente seu, dono de uma padaria, oferece pagar as sessões em pães e bolos.", "A patient of yours who owns a bakery offers to pay for sessions in bread and cakes.", "Un paciente tuyo, dueño de una panadería, ofrece pagar las sesiones en panes y pasteles."),
      certa: L("Recusar com cuidado e renegociar o valor em dinheiro, inclusive para baixo se for o caso.", "Decline carefully and renegotiate the fee in money, including downwards if need be.", "Rechazar con cuidado y renegociar el valor en dinero, incluso a la baja si hace falta."),
      erradas: [L("Aceitar: é o que ele tem, e recusar seria humilhante.", "Accept: it is what he has, and refusing would be humiliating.", "Aceptar: es lo que tiene, y rechazar sería humillante."),
                L("Aceitar desde que ele assine um combinado por escrito.", "Accept as long as he signs a written agreement.", "Aceptar siempre que firme un acuerdo por escrito.")],
      porque: L("Pagamento em espécie cria uma segunda relação — comercial — dentro da clínica, e nenhum papel assinado desfaz isso. Reduzir o valor é conduta; virar cliente da padaria do paciente não é.", "Payment in kind creates a second, commercial relationship inside the clinic, and no signed paper undoes that. Reducing the fee is conduct; becoming a customer of the patient's bakery is not.", "El pago en especie crea una segunda relación, comercial, dentro de la clínica, y ningún papel firmado lo deshace.") },
    { caso: L("Você reconhece, na sala de espera, a irmã de uma paciente sua. Ela pergunta se a irmã está indo bem.", "In the waiting room you recognise the sister of one of your patients. She asks whether her sister is doing well.", "En la sala de espera reconoces a la hermana de una paciente tuya. Te pregunta si su hermana está bien."),
      certa: L("Não confirmar nem negar que a atende, e conversar com ela como conversaria com qualquer pessoa.", "Neither confirm nor deny that you see her, and talk as you would with anyone.", "No confirmar ni negar que la atiendes, y conversar como con cualquier persona."),
      erradas: [L("Dizer que está indo bem, já que é uma informação boa e não prejudica ninguém.", "Say she is doing well, since it is good news and harms nobody.", "Decir que va bien, ya que es una información buena y no perjudica a nadie."),
                L("Dizer que não pode falar sobre pacientes.", "Say you cannot talk about patients.", "Decir que no puede hablar de pacientes.")],
      porque: L("Dizer “não posso falar sobre pacientes” já confirma que ela é sua paciente. O sigilo começa antes do conteúdo: começa no fato de que a pessoa é atendida.", "Saying “I can't talk about patients” already confirms that she is your patient. Confidentiality starts before the content: it starts at the fact that the person is seen at all.", "Decir “no puedo hablar de pacientes” ya confirma que es tu paciente. El secreto empieza antes del contenido.") },
    { caso: L("Um convênio pede o seu relatório com “o diagnóstico e o conteúdo das sessões” para liberar a continuidade do tratamento.", "An insurer asks for your report with “the diagnosis and the content of the sessions” in order to authorise continued treatment.", "Una aseguradora pide tu informe con “el diagnóstico y el contenido de las sesiones” para autorizar la continuidad."),
      certa: L("Enviar só o indispensável para a finalidade — hipótese diagnóstica e plano —, com o paciente informado do que vai no documento.", "Send only what is indispensable to the purpose — diagnostic hypothesis and plan — with the patient informed of what goes in the document.", "Enviar solo lo indispensable para la finalidad —hipótesis diagnóstica y plan—, con el paciente informado de lo que va en el documento."),
      erradas: [L("Enviar o relatório completo: quem paga tem direito de saber no que o dinheiro é gasto.", "Send the full report: whoever pays has a right to know what the money is spent on.", "Enviar el informe completo: quien paga tiene derecho a saber en qué se gasta."),
                L("Recusar-se a enviar qualquer coisa e orientar o paciente a pagar do próprio bolso.", "Refuse to send anything and tell the patient to pay out of pocket.", "Negarse a enviar cualquier cosa y orientar al paciente a pagar de su bolsillo.")],
      porque: L("O relatório se limita ao necessário para a finalidade, e o conteúdo das sessões nunca é necessário para autorizar sessões. Mas recusar tudo transfere o custo para o paciente por uma questão que não é dele.", "A report is limited to what the purpose requires, and session content is never required to authorise sessions. But refusing everything shifts the cost onto the patient over a matter that is not theirs.", "El informe se limita a lo necesario para la finalidad, y el contenido de las sesiones nunca es necesario para autorizar sesiones.") }
  ];

  // ------------------------------------------------------------------ o esqueleto comum
  // Os cinco jogos têm a mesma forma: uma situação, três saídas, e a explicação DEPOIS de responder —
  // errar e ler por que é o que ensina; acertar e não saber por quê não ensina nada.
  function rodadas(root, done, itens, montaPergunta, eixo) {
    const lista = baralhar(itens).slice(0, Math.min(itens.length, 6));
    let i = 0, acertos = 0;
    const placar = el("p", "mg-info", "");
    const palco = el("div", "mgc-palco");
    root.append(placar, palco);
    function passo() {
      if (i >= lista.length) return done({ stars: estrelas(acertos, lista.length), detail: `${acertos}/${lista.length}` });
      palco.textContent = "";
      placar.textContent = `${i + 1}/${lista.length} · ${acertos} ${P(L("certas", "right", "correctas"))}`;
      const { enunciado, opcoes, certa, porque } = montaPergunta(lista[i]);
      palco.appendChild(el("p", "mgc-enunciado", enunciado));
      const cx = el("div", "mgc-ops");
      baralhar(opcoes).forEach((op) => {
        const b = el("button", "choice-btn mgc-op", op);
        b.type = "button";
        b.addEventListener("click", () => {
          const ok = op === certa;
          if (ok) acertos++;
          [...cx.querySelectorAll(".mgc-op")].forEach((x) => { x.disabled = true; if (x.textContent === certa) x.classList.add("certa"); });
          if (!ok) b.classList.add("errada");
          if (typeof sfx === "function") sfx(ok ? "good" : "bad");
          const ex = el("div", "mgc-porque" + (ok ? " ok" : ""));
          ex.appendChild(el("b", null, ok ? `✓ ${P(L("É essa", "That's it", "Es esa"))}` : `✗ ${P(L("A que fecha é a marcada", "The one that works is marked", "La que funciona está marcada"))}`));
          ex.appendChild(el("p", null, porque));
          palco.appendChild(ex);
          const seg = el("button", "continue-btn", P(L("Continuar", "Continue", "Continuar")));
          seg.type = "button";
          seg.addEventListener("click", () => { i++; passo(); });
          palco.appendChild(seg);
        });
        cx.appendChild(b);
      });
      palco.appendChild(cx);
    }
    passo();
    void eixo;
  }

  const JOGOS = [
    {
      id: "c-escuta", emoji: "🎧", clinico: true, eixo: "anamnese", test: "Escuta reflexiva",
      name: L("Escuta reflexiva", "Reflective listening", "Escucha reflexiva"),
      desc: L("A pessoa fala. Escolha a resposta que devolve o SENTIMENTO — não o conteúdo, e não um conselho.", "The person speaks. Pick the answer that gives back the FEELING — not the content, and not advice.", "La persona habla. Elige la respuesta que devuelve el SENTIMIENTO, no el contenido ni un consejo."),
      edu: L("Treina o reflexo de sentimento, que é a base da escuta rogeriana. As duas opções erradas de cada rodada são exatamente o que se costuma fazer no lugar dele: repetir o conteúdo e dar conselho.", "Trains the reflection of feeling, the basis of Rogerian listening. The two wrong options in each round are exactly what people do instead: repeat the content and give advice.", "Entrena el reflejo de sentimiento, base de la escucha rogeriana. Las dos opciones erradas son exactamente lo que se suele hacer en su lugar."),
      run(root, done) {
        rodadas(root, done, ESCUTA, (it) => ({
          enunciado: `💬 ${P(it.fala)}`,
          opcoes: [P(it.certa)].concat(it.erradas.map(P)),
          certa: P(it.certa), porque: P(it.porque)
        }), "anamnese");
      }
    },
    {
      id: "c-risco", emoji: "🚨", clinico: true, eixo: "observacao", test: "Triagem de risco",
      name: L("Triagem de risco", "Risk triage", "Triaje de riesgo"),
      desc: L("Uma frase dita em consulta. Classifique o risco: baixo, moderado ou alto.", "A sentence said in session. Rate the risk: low, moderate or high.", "Una frase dicha en consulta. Clasifica el riesgo: bajo, moderado o alto."),
      edu: L("Treina a triagem contra critério, e não contra susto: tentativa anterior e preparativos concretos pesam mais que a intensidade do sofrimento, e nem tudo que dói é emergência.", "Trains triage against criteria rather than against alarm: a previous attempt and concrete preparations weigh more than the intensity of suffering, and not everything that hurts is an emergency.", "Entrena el triaje contra criterio y no contra susto: el intento previo y los preparativos concretos pesan más que la intensidad del sufrimiento."),
      run(root, done) {
        rodadas(root, done, RISCO, (it) => ({
          enunciado: `💬 ${P(it.f)}`,
          opcoes: NIVEIS.map((n) => `${n.ic} ${P(n.n)}`),
          certa: `${NIVEIS[it.n].ic} ${P(NIVEIS[it.n].n)}`,
          porque: P(it.p)
        }), "observacao");
      }
    },
    {
      id: "c-genograma", emoji: "🧬", clinico: true, eixo: "multi", test: "Genograma",
      name: L("Genograma", "Genogram", "Genograma"),
      desc: L("Uma informação sobre a família. Escolha como ela se desenha no genograma.", "A piece of information about the family. Pick how it is drawn in the genogram.", "Una información sobre la familia. Elige cómo se dibuja en el genograma."),
      edu: L("Treina a convenção do genograma — quadrado, círculo, as linhas de união, rompimento, conflito e fusão. É convenção porque é o que faz o desenho ser legível por qualquer colega que pegue o caso depois de você.", "Trains genogram convention — square, circle, the lines of union, cut-off, conflict and fusion. It is convention because it is what makes the drawing readable by any colleague who takes the case after you.", "Entrena la convención del genograma. Es convención porque es lo que hace el dibujo legible para cualquier colega que tome el caso después."),
      run(root, done) {
        rodadas(root, done, GENO, (it) => ({
          enunciado: `🏠 ${P(it.q)}`,
          opcoes: [P(it.certa)].concat(it.erradas.map(P)),
          certa: P(it.certa), porque: P(it.porque)
        }), "multi");
      }
    },
    {
      id: "c-devolutiva", emoji: "🗣️", clinico: true, eixo: "devolutiva", test: "Devolutiva",
      name: L("Devolutiva em linguagem simples", "Feedback in plain language", "Devolutiva en lenguaje simple"),
      desc: L("Uma frase do laudo. Escolha a versão que a pessoa entende SEM perder o que foi dito.", "A sentence from the report. Pick the version the person understands WITHOUT losing what was said.", "Una frase del informe. Elige la versión que la persona entiende SIN perder lo que se dijo."),
      edu: L("Treina a devolutiva: traduzir não é trocar palavra difícil por palavra fácil nem substituir a descrição por um rótulo. É dizer a mesma coisa de um jeito que quem ouve possa usar.", "Trains feedback: translating is not swapping a hard word for an easy one, nor replacing the description with a label. It is saying the same thing in a way the listener can use.", "Entrena la devolutiva: traducir no es cambiar palabra difícil por fácil ni sustituir la descripción por una etiqueta."),
      run(root, done) {
        rodadas(root, done, DEVOL, (it) => ({
          enunciado: `📄 ${P(it.tec)}`,
          opcoes: [P(it.certa)].concat(it.erradas.map(P)),
          certa: P(it.certa), porque: P(it.porque)
        }), "devolutiva");
      }
    },
    {
      id: "c-etica", emoji: "⚖️", clinico: true, eixo: "laudo", test: "Ética",
      name: L("Ética em cinco minutos", "Ethics in five minutes", "Ética en cinco minutos"),
      desc: L("Um dilema do dia a dia. Escolha a conduta — e veja por que as outras duas não servem.", "An everyday dilemma. Pick the conduct — and see why the other two do not do.", "Un dilema del día a día. Elige la conducta y ve por qué las otras dos no sirven."),
      edu: L("Treina a conduta, e não a regra decorada: em quase todo dilema real existe uma saída rígida demais e uma frouxa demais, e as duas erram. O caminho costuma ser combinar com quem é atendido o que será dito.", "Trains conduct rather than memorised rules: in almost every real dilemma there is an answer that is too rigid and one that is too loose, and both are wrong. The way through is usually to agree with the person seen what will be said.", "Entrena la conducta y no la regla memorizada: en casi todo dilema real hay una salida demasiado rígida y una demasiado laxa, y las dos fallan."),
      run(root, done) {
        rodadas(root, done, ETICA, (it) => ({
          enunciado: `⚖️ ${P(it.caso)}`,
          opcoes: [P(it.certa)].concat(it.erradas.map(P)),
          certa: P(it.certa), porque: P(it.porque)
        }), "laudo");
      }
    }
  ];

  Minigames.registrar(JOGOS);
  window.MinijogosClinicos = { JOGOS: JOGOS.map((j) => j.id) };
})();

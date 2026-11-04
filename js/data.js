/* =========================================================================
 * MedRPG: Grimório Clínico — Base de dados do jogo
 * Tudo que é "conteúdo" mora aqui: métodos, raridades, traços, itens, etc.
 * Os efeitos dos itens são funções reais lidas pelo motor (engine.js).
 * ========================================================================= */
(function (MR) {
  'use strict';

  /* ---------------- Constantes de balanceamento ---------------- */
  const RULES = {
    STRIKE_EVERY_MIN: 5,          // um golpe a cada 5 min líquidos
    FLOW_T1: 25,                  // min contínuos para Fluxo I
    FLOW_T2: 50,                  // min contínuos para Fluxo II (golpe crítico garantido)
    FLOW_T1_MULT: 1.15,
    FLOW_T2_MULT: 1.30,
    BASE_CRIT: 0.08,              // chance base de crítico por golpe
    CRIT_PER_FOCO: 0.004,         // +0,4% por ponto de Foco
    STREAK_STEP: 0.05,            // +5% por dia de sequência
    STREAK_CAP_DAYS: 7,           // até 7 dias (x1,35)
    FATIGUE_START_MIN: 240,       // fadiga após 4h no dia
    FATIGUE_PER_HOUR: 0.06,       // -6% por hora extra
    FATIGUE_FLOOR: 0.70,
    COMPLETION_BONUS: 0.10,       // golpe de conclusão (meta fixa cumprida)
    POINTS_PER_LEVEL: 3,
    STOPWATCH_CAP_MIN: 240,       // modo livre: no máx. 4h por sessão
    HEARTBEAT_GAP_MS: 3 * 60 * 1000,
    FREEZE_MAX: 2,
    REFINE_MAX: 5,
    QUEST_XP: 90,
    QUEST_ESSENCE: 15,
    QUEST_ALL_BONUS: 40,
  };

  /* ---------------- Atributos ---------------- */
  const ATTRS = {
    poder:       { name: 'Poder',       short: 'POD', icon: 'crossed-swords',  desc: '+1% de dano em todos os golpes por ponto.' },
    intelecto:   { name: 'Intelecto',   short: 'INT', icon: 'brain',           desc: '+1% de XP em todas as sessões por ponto.' },
    foco:        { name: 'Foco',        short: 'FOC', icon: 'all-seeing-eye',  desc: '+0,4% de chance de crítico, +1% de dano crítico e +1% de dano após 50 min de sessão, por ponto.' },
    precisao:    { name: 'Precisão',    short: 'PRE', icon: 'archery-target',  desc: '+1% de dano em Questões e Simulados por ponto. Amplia o Golpe de Precisão.' },
    retencao:    { name: 'Retenção',    short: 'RET', icon: 'open-book',       desc: '+1% de dano em Flashcards e Combo Ativo por ponto.' },
    resistencia: { name: 'Resistência', short: 'RES', icon: 'heart-shield',    desc: 'Reduz em 2% (por ponto) a penalidade de fadiga após 4h de estudo no dia.' },
    fortuna:     { name: 'Fortuna',     short: 'FOR', icon: 'crystal-ball',    desc: 'Aumenta a chance de equipamentos Raros, Épicos e Lendários.' },
  };

  /* ---------------- Raridades ---------------- */
  const RARITIES = {
    common:    { name: 'Comum',    color: '#a3acb9', hpMult: 1.00, essence: 5,   refineBase: 10 },
    uncommon:  { name: 'Incomum',  color: '#4ade80', hpMult: 1.15, essence: 10,  refineBase: 20 },
    rare:      { name: 'Raro',     color: '#60a5fa', hpMult: 1.35, essence: 25,  refineBase: 40 },
    epic:      { name: 'Épico',    color: '#c084fc', hpMult: 1.80, essence: 60,  refineBase: 80 },
    legendary: { name: 'Lendário', color: '#fbbf24', hpMult: 2.50, essence: 150, refineBase: 160 },
  };
  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  /* ---------------- Métodos de estudo ---------------- */
  const METHODS = {
    passive_reading: { name: 'Leitura Passiva',          short: 'Leitura',    dph: 500,  xph: 100, icon: 'open-book',      color: '#3987e5', tip: 'Útil para o primeiro contato, mas é o método que menos fixa.' },
    flashcards:      { name: 'Flashcards',               short: 'Flashcards', dph: 1000, xph: 120, icon: 'card-random',    color: '#d95926', tip: 'Recuperação ativa com repetição espaçada (Anki).' },
    questions:       { name: 'Resolução de Questões',    short: 'Questões',   dph: 1500, xph: 130, icon: 'archery-target', color: '#199e70', tip: 'Prática de recuperação no formato da prova.' },
    active_combo:    { name: 'Combo Ativo / Explicação', short: 'Combo Ativo',dph: 2000, xph: 150, icon: 'conversation',   color: '#c98500', tip: 'Explicar em voz alta, ensinar, mapas sem consulta (Feynman).' },
    mock_exam:       { name: 'Simulado de Alta Carga',   short: 'Simulado',   dph: 2500, xph: 200, icon: 'scroll-unfurled',color: '#d55181', tip: 'Prova completa cronometrada. O golpe mais pesado.' },
  };
  const isPractice = (m) => m === 'questions' || m === 'mock_exam';
  const isReview = (m) => m === 'flashcards' || m === 'active_combo';

  /* ---------------- Traços dos bosses ---------------- */
  const TRAITS = {
    insatiable: { name: 'Insaciável',  icon: 'drop',                 desc: 'Regenera 5% do HP máximo a cada dia sem estudo.' },
    resistant:  { name: 'Resistente',  icon: 'checked-shield',       desc: '+20% de HP máximo.', hp: 1.20 },
    proud:      { name: 'Orgulhoso',   icon: 'crown',                desc: 'Se derrotado em até 3 dias após surgir, concede um saque extra.' },
    relentless: { name: 'Implacável',  icon: 'skull-crossed-bones',  desc: 'Recebe 15% menos dano de todos os golpes.', dmg: 0.85 },
    colossal:   { name: 'Colossal',    icon: 'giant',                desc: '+30% de HP, mas concede +40% de XP da sessão que o derrotar.', hp: 1.30 },
    eternal:    { name: 'Eterno',      icon: 'infinity',             desc: 'Golpes críticos causam apenas metade do bônus.' },
    volatile:   { name: 'Inconstante', icon: 'lightning-frequency',  desc: 'Cada golpe varia entre 60% e 160% do dano.' },
  };

  /* ---------------- Bosses (o Esquecimento em suas mil formas) ---------------- */
  const BOSS_POOL = {
    common: ['O Devorador de Eras', 'O Senhor do Vazio', 'O Arauto das Cinzas', 'A Besta Sem Nome', 'O Colosso Errante',
      'O Guardião Esquecido', 'O Rei das Ruínas', 'O Devorador de Mundos', 'A Fera do Abismo', 'O Vigia Eterno',
      'O Ceifador Silencioso', 'O Titã Adormecido', 'O Andarilho Negro', 'A Serpente Primordial', 'O Carrasco de Ferro',
      'O Senhor das Profundezas', 'O Monarca Caído', 'O Devorador de Sonhos', 'O Colosso das Sombras', 'O Último Guardião'],
    rare: ['O Rei Sem Trono', 'A Morte Que Caminha', 'O Arquiteto do Vazio', 'O Filho do Abismo', 'O Devorador de Estrelas',
      'O Imperador das Cinzas', 'O Deus Esquecido', 'O Senhor do Fim', 'A Coroa Negra', 'O Arauto do Último Dia',
      'O Titã do Eclipse', 'O Monarca do Abismo', 'A Besta Primordial', 'O Olho Que Tudo Vê', 'O Rei das Mil Faces'],
    epic: ['O Monarca do Fim', 'A Alma Devorada', 'O Juiz Abissal', 'O Flagelo Eterno', 'O Senhor da Ruína Absoluta',
      'A Forja das Almas', 'O Soberano das Trevas'],
    legendary: ['O Último Rei', 'A Entidade', 'O Vazio', 'O Fim', 'O Inominável', 'O Eterno', 'O Devorador de Deuses',
      'Aquele Que Permanece', 'O Primeiro', 'O Último'],
  };
  const BOSS_ICONS = ['grim-reaper', 'horned-skull', 'beast-eye', 'evil-comet', 'death-skull', 'cultist', 'dragon-head',
    'spectre', 'minotaur', 'cyclops', 'daemon-skull', 'octopus', 'wyvern', 'burning-skull', 'alien-skull', 'hydra',
    'sea-serpent', 'golem-head', 'imp', 'vampire-dracula', 'werewolf', 'cracked-mask', 'crowned-skull', 'overlord-helm',
    'evil-moon', 'black-hole-bolas', 'shambling-zombie', 'haunting', 'tentacle-heart'];
  const BOSS_EPITHETS = {
    common: 'Guardião do Esquecimento', uncommon: 'Guardião do Esquecimento', rare: 'Senhor da Curva de Ebbinghaus',
    epic: 'Flagelo da Memória', legendary: 'Avatar do Esquecimento Absoluto',
  };
  const DIFFICULTY = {
    5000:  { name: 'Rápidos',   desc: '≈ 3h por boss comum' },
    12000: { name: 'Padrão',    desc: '≈ 7h por boss comum' },
    30000: { name: 'Pesados',   desc: '≈ 18h por boss comum' },
    60000: { name: 'Titânicos', desc: '≈ 36h por boss comum' },
  };

  /* ---------------- Patentes ---------------- */
  const RANKS = [
    { level: 1,  title: 'Estudante de Medicina', elo: 'Ciclo Básico',      icon: 'hood',                  color: '#d4af37' },
    { level: 5,  title: 'Acadêmico Clínico',     elo: 'Ciclo Clínico',     icon: 'doctor-face',           color: '#60a5fa' },
    { level: 12, title: 'Interno de Medicina',   elo: 'Internato',         icon: 'caduceus',              color: '#c084fc' },
    { level: 20, title: 'Médico Residente',      elo: 'Residência Médica', icon: 'plague-doctor-profile', color: '#d55181' },
    { level: 35, title: 'Médico Especialista',   elo: 'Corpo Clínico',     icon: 'laurel-crown',          color: '#fbbf24' },
    { level: 50, title: 'Preceptor / Mestre',    elo: 'Lenda Médica',      icon: 'crown',                 color: '#f8fafc' },
  ];

  /* ---------------- Slots ---------------- */
  const SLOTS = {
    weapon:    { name: 'Arma',      icon: 'scalpel',       accepts: 'weapon' },
    grimoire:  { name: 'Grimório',  icon: 'spell-book',    accepts: 'grimoire' },
    armor:     { name: 'Armadura',  icon: 'lab-coat',      accepts: 'armor' },
    relic:     { name: 'Relíquia',  icon: 'crystal-shine', accepts: 'relic' },
    accessory: { name: 'Acessório', icon: 'stethoscope',   accepts: 'accessory' },
    ring1:     { name: 'Anel I',    icon: 'ring',          accepts: 'ring' },
    ring2:     { name: 'Anel II',   icon: 'ring',          accepts: 'ring' },
  };
  const ITEM_TYPES = { weapon: 'Arma', grimoire: 'Grimório', armor: 'Armadura', relic: 'Relíquia', accessory: 'Acessório', ring: 'Anel' };

  /* ---------------- Itens ----------------
   * Ganchos de efeito (todos opcionais), lidos pelo motor:
   *   dmg(c)  -> multiplicador de dano de cada golpe
   *   xp(c)   -> multiplicador de XP da sessão
   *   crit    -> chance extra de crítico (0..1)
   *   alwaysCrit(c) -> true força crítico
   *   streak  -> bônus somado ao multiplicador de sequência
   *   fatigue -> { delay: min, reduce: 0..1, immune: bool }
   *   loot    -> bônus de Fortuna no saque
   * c = contexto do golpe/sessão (veja engine.js > strikeContext)
   */
  const I = (id, name, slot, rarity, icon, stats, effect, origin, hooks = {}) =>
    ({ id, name, slot, rarity, icon, stats, effect, origin, ...hooks });

  const ITEMS = [
    // --- ARMAS ---
    I('bisturi_basico', 'Bisturi Cirúrgico N° 10', 'weapon', 'common', 'scalpel', { poder: 4 },
      'Sem efeito especial. Toda jornada começa com uma lâmina simples.', 'O primeiro contato de todo estudante no laboratório.'),
    I('pinca_hemostatica', 'Pinça Hemostática', 'weapon', 'uncommon', 'pincers', { poder: 6, retencao: 4 },
      '+5% de dano por sessão já concluída hoje (máx. +20%).', 'Impede o sangramento de rendimento ao longo do dia.',
      { dmg: (c) => 1 + Math.min(0.20, 0.05 * c.sessionsToday) }),
    I('tesoura_mayo', 'Tesoura de Mayo', 'weapon', 'uncommon', 'scissors', { poder: 5, foco: 5 },
      '+12% de dano enquanto a sessão não tiver nenhuma pausa.', 'Corta qualquer distração externa durante o cronômetro.',
      { dmg: (c) => (c.pauses === 0 ? 1.12 : 1) }),
    I('bisturi_anatomista', 'Bisturi do Anatomista', 'weapon', 'rare', 'scalpel', { poder: 8, foco: 5 },
      '+10% de dano nos golpes após 50 minutos de sessão.', 'Forjado para longos blocos de dissecação.',
      { dmg: (c) => (c.sessionMin >= 50 ? 1.10 : 1) }),
    I('bisturi_cooper', 'Bisturi de Cooper', 'weapon', 'epic', 'broad-dagger', { poder: 12, precisao: 8 },
      'A primeira sessão do dia causa +20% de dano.', 'Concedido a quem inicia o dia sem hesitação.',
      { dmg: (c) => (c.sessionsToday === 0 ? 1.20 : 1) }),
    I('seringa_prata', 'Seringa de Prata', 'weapon', 'epic', 'syringe', { poder: 8, precisao: 5, foco: 5 },
      '+15% de chance de Golpe Crítico.', 'Injeta foco concentrado direto no combate cognitivo.',
      { crit: 0.15 }),
    I('lamina_ultimo_corte', 'Lâmina do Último Corte', 'weapon', 'legendary', 'dripping-blade', { poder: 20, precisao: 12 },
      'Golpes contra bosses abaixo de 20% de HP causam +50% de dano.', 'A lâmina final que encerra ciclos de exaustão.',
      { dmg: (c) => (c.bossHpPct < 0.20 ? 1.50 : 1) }),
    I('lamina_asclepio', 'A Lâmina de Asclépio', 'weapon', 'legendary', 'caduceus', { poder: 22, intelecto: 15, fortuna: 8 },
      '+4% de dano por boss derrotado sem quebrar a sequência de dias (máx. +40%).', 'Forjada pelo pai da medicina para recompensar a persistência.',
      { dmg: (c) => 1 + Math.min(0.40, 0.04 * c.killChain) }),

    // --- GRIMÓRIOS ---
    I('manual_semiologia', 'Manual de Propedêutica', 'grimoire', 'uncommon', 'book-cover', { intelecto: 5, precisao: 5 },
      '+5% de XP em qualquer sessão.', 'Ensina os fundamentos da anamnese e do exame clínico.',
      { xp: () => 1.05 }),
    I('grimorio_guyton', 'Grimório de Guyton', 'grimoire', 'rare', 'spell-book', { intelecto: 10, retencao: 6 },
      '+8% de XP em todas as sessões.', 'O tratado fundamental dos mecanismos fisiológicos.',
      { xp: () => 1.08 }),
    I('atlas_netter', 'Atlas de Netter', 'grimoire', 'rare', 'open-book', { retencao: 8, intelecto: 6 },
      '+15% de dano em Flashcards e Combo Ativo.', 'Ilustrações arcanas que gravam estruturas na memória.',
      { dmg: (c) => (isReview(c.method) ? 1.15 : 1) }),
    I('codex_katzung', 'Códex de Katzung', 'grimoire', 'epic', 'book-cover', { intelecto: 8, precisao: 10 },
      '+15% de XP em sessões de Questões.', 'Sistematiza o raciocínio diagnóstico e terapêutico.',
      { xp: (c) => (c.method === 'questions' ? 1.15 : 1) }),
    I('grimorio_robbins', 'Grimório de Robbins', 'grimoire', 'epic', 'secret-book', { intelecto: 10, foco: 8 },
      '+25% de XP em sessões de 90 minutos ou mais (Raid).', 'O peso monumental dos processos patológicos.',
      { xp: (c) => (c.totalMin >= 90 ? 1.25 : 1) }),
    I('grimorio_recuperacao', 'Grimório da Recuperação', 'grimoire', 'epic', 'scroll-quill', { retencao: 12, precisao: 6 },
      '+20% de dano e XP em Flashcards e Combo Ativo.', 'Recompensa quem força a mente a resgatar sem consulta.',
      { dmg: (c) => (isReview(c.method) ? 1.20 : 1), xp: (c) => (isReview(c.method) ? 1.20 : 1) }),
    I('codex_diagnostico', 'Códex do Diagnóstico', 'grimoire', 'legendary', 'white-book', { precisao: 15, intelecto: 15, retencao: 10 },
      'Registrar que revisou os erros de Questões ou Simulado DOBRA o XP da sessão.', 'Transforma cada erro em aprendizado consolidado.',
      { xp: (c) => (c.reviewedErrors && isPractice(c.method) ? 2 : 1) }),

    // --- ARMADURAS ---
    I('jaleco_algodao', 'Jaleco de Algodão', 'armor', 'uncommon', 'lab-coat', { resistencia: 6, foco: 3 },
      'A fadiga começa 30 minutos mais tarde.', 'O uniforme clássico de proteção e disciplina.',
      { fatigue: { delay: 30 } }),
    I('coracao_ferro', 'Coração de Ferro', 'armor', 'rare', 'heart-shield', { resistencia: 12, poder: 5 },
      'Reduz em 20% a penalidade de fadiga.', 'Um miocárdio blindado contra o esgotamento.',
      { fatigue: { reduce: 0.20 } }),
    I('manto_persistencia', 'Manto da Persistência', 'armor', 'epic', 'cloak-dagger', { resistencia: 8, foco: 8 },
      '+1% de dano para cada 30 min estudados hoje (máx. +15%).', 'Tecido com horas ininterruptas de vigília.',
      { dmg: (c) => 1 + Math.min(0.15, Math.floor(c.todayMin / 30) * 0.01) }),
    I('calice_disciplina', 'Armadura da Disciplina', 'armor', 'epic', 'breastplate', { resistencia: 14, intelecto: 6 },
      'Imunidade total à fadiga.', 'A couraça inabalável que sobrepuja o cansaço.',
      { fatigue: { immune: true } }),

    // --- RELÍQUIAS ---
    I('diapasao_clinico', 'Diapasão Neurológico', 'relic', 'uncommon', 'sound-waves', { foco: 6, precisao: 4 },
      '+8% de dano em Questões e Simulados.', 'Vibrações que mantêm o raciocínio afiado.',
      { dmg: (c) => (isPractice(c.method) ? 1.08 : 1) }),
    I('ampulheta_foco', 'Ampulheta do Foco', 'relic', 'rare', 'sands-of-time', { foco: 15, retencao: 5 },
      '+15% de dano nos golpes após 50 minutos de sessão.', 'A areia que flui apenas durante concentração plena.',
      { dmg: (c) => (c.sessionMin >= 50 ? 1.15 : 1) }),
    I('sinapse_dourada', 'Sinapse Dourada', 'relic', 'epic', 'brain', { foco: 12, intelecto: 8 },
      '+20% de dano em Fluxo II (50+ min contínuos sem pausa).', 'O disparo perfeito de um conceito compreendido.',
      { dmg: (c) => (c.contMin >= 50 ? 1.20 : 1) }),
    I('medula_eterna', 'Medula Eterna', 'relic', 'epic', 'heart-beats', { resistencia: 10, retencao: 8 },
      'A fadiga começa 60 minutos mais tarde.', 'A fonte hematopoiética inesgotável de vitalidade.',
      { fatigue: { delay: 60 } }),
    I('cerebro_mnemosyne', 'Cérebro de Mnemosyne', 'relic', 'legendary', 'brain', { retencao: 20, intelecto: 10 },
      'A primeira sessão de Flashcards/Combo Ativo do dia causa +50% de dano.', 'Impede o declínio da curva de esquecimento.',
      { dmg: (c) => (isReview(c.method) && c.reviewSessionsToday === 0 ? 1.50 : 1) }),
    I('olho_hipocrates', 'Olho de Hipócrates', 'relic', 'legendary', 'all-seeing-eye', { precisao: 18, foco: 12, fortuna: 8 },
      'Todo golpe em Questões e Simulados é Crítico.', 'Enxerga o cerne de qualquer enunciado.',
      { alwaysCrit: (c) => isPractice(c.method) }),
    I('ampulheta_mnemosyne', 'A Ampulheta de Mnemosyne', 'relic', 'legendary', 'hourglass', { foco: 18, poder: 12 },
      '+1% de dano por minuto contínuo além de 30 min (máx. +60%).', 'Controla a dilatação temporal do estudo profundo.',
      { dmg: (c) => 1 + Math.min(0.60, Math.max(0, c.contMin - 30) * 0.01) }),
    I('orbe_conhecimento', 'Orbe do Conhecimento', 'relic', 'legendary', 'crystal-ball', { intelecto: 12, retencao: 12, poder: 10 },
      '+10% de dano e +10% de XP em tudo.', 'A síntese de todos os saberes biomédicos.',
      { dmg: () => 1.10, xp: () => 1.10 }),

    // --- ACESSÓRIOS ---
    I('estetoscopio_clinico', 'Estetoscópio do Clínico', 'accessory', 'uncommon', 'stethoscope', { precisao: 7, poder: 4 },
      '+12% de dano em Questões e Simulados.', 'O companheiro inseparável da rotina diagnóstica.',
      { dmg: (c) => (isPractice(c.method) ? 1.12 : 1) }),
    I('relogio_cirurgiao', 'Relógio do Cirurgião', 'accessory', 'rare', 'pocket-watch', { foco: 8, precisao: 6 },
      'Dobra o Golpe de Conclusão ao cumprir uma Meta Fixa.', 'Marca a precisão temporal do bloco cirúrgico.',
      { completion: 2 }),
    I('lupa_investigador', 'Lupa do Investigador', 'accessory', 'rare', 'magnifying-glass', { precisao: 12, retencao: 4 },
      '+15% de XP ao registrar que revisou os erros.', 'Projetada para esmiuçar pegadinhas e distratores.',
      { xp: (c) => (c.reviewedErrors ? 1.15 : 1) }),
    I('microscopio_patologista', 'Microscópio do Patologista', 'accessory', 'epic', 'microscope', { precisao: 12, intelecto: 6 },
      '+15% de dano e XP em sessões de Questões.', 'Permite examinar os mínimos detalhes conceituais.',
      { dmg: (c) => (c.method === 'questions' ? 1.15 : 1), xp: (c) => (c.method === 'questions' ? 1.15 : 1) }),
    I('estetoscopio_laennec', 'Estetoscópio de Laennec', 'accessory', 'legendary', 'stethoscope', { precisao: 14, intelecto: 10 },
      '+25% de XP em sessões de 60 minutos ou mais.', 'O primeiro a auscultar os segredos do corpo.',
      { xp: (c) => (c.totalMin >= 60 ? 1.25 : 1) }),
    I('coroa_clinico', 'A Coroa do Clínico', 'accessory', 'legendary', 'laurel-crown',
      { poder: 10, intelecto: 10, foco: 10, precisao: 10, retencao: 10, resistencia: 10, fortuna: 10 },
      '+10 em todos os atributos e +5% de dano e XP.', 'A láurea suprema dos mestres da arte médica.',
      { dmg: () => 1.05, xp: () => 1.05 }),

    // --- ANÉIS ---
    I('alianca_academico', 'Aliança do Acadêmico', 'ring', 'common', 'ring', { poder: 3, intelecto: 3 },
      'Sem efeito especial.', 'Forjada nos primeiros semestres de dedicação.'),
    I('anel_concentracao', 'Anel da Concentração', 'ring', 'uncommon', 'ring', { foco: 6, poder: 3 },
      '+8% de dano em Fluxo I ou superior (25+ min contínuos).', 'Uma pulsação sutil que afasta a procrastinação.',
      { dmg: (c) => (c.contMin >= 25 ? 1.08 : 1) }),
    I('marcapasso_ancestral', 'Anel do Marcapasso Ancestral', 'ring', 'rare', 'diamond-ring', { poder: 7, resistencia: 7 },
      'Teto do multiplicador de sequência +5% (x1,40).', 'Mantém o ritmo cadenciado dos estudos diários.',
      { streak: 0.05 }),
    I('camara_neubauer', 'Anel da Câmara de Neubauer', 'ring', 'rare', 'ring', { fortuna: 8, precisao: 4 },
      '+10 de Fortuna adicional ao rolar saques.', 'Quantifica as recompensas ocultas do destino.',
      { loot: 10 }),
    I('anel_sinapse', 'Anel da Sinapse', 'ring', 'epic', 'ring', { intelecto: 10, foco: 6 },
      '+8% de XP em todas as sessões.', 'Acelera a neurotransmissão durante o aprendizado.',
      { xp: () => 1.08 }),
    I('chave_memoria', 'Chave da Memória', 'ring', 'epic', 'key', { retencao: 12, intelecto: 6 },
      '+20% de XP em Flashcards.', 'Abre os compartimentos profundos da memória de longo prazo.',
      { xp: (c) => (c.method === 'flashcards' ? 1.20 : 1) }),
  ];
  const ITEMS_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

  /* ---------------- Contratos diários ----------------
   * check(day) recebe o resumo do dia (engine.daySummary). */
  const QUESTS = [
    { id: 'deep_block',  name: 'Bloco Profundo',      icon: 'sands-of-time',   desc: 'Alcance 50 min contínuos sem pausa numa sessão.', check: (d) => d.maxContMin >= 50 },
    { id: 'practice',    name: 'Prática Deliberada',  icon: 'archery-target',  desc: 'Estude 45 min com Questões ou Simulado.',          check: (d) => d.practiceMin >= 45 },
    { id: 'recall',      name: 'Recuperação Ativa',   icon: 'card-random',     desc: 'Estude 30 min com Flashcards ou Combo Ativo.',     check: (d) => d.reviewMin >= 30 },
    { id: 'marathon',    name: 'Maratona Clínica',    icon: 'heart-beats',     desc: 'Some 2 horas líquidas de estudo hoje.',            check: (d) => d.totalMin >= 120 },
    { id: 'interleave',  name: 'Intercalação',        icon: 'crossed-swords',  desc: 'Estude 2 matérias diferentes hoje.',               check: (d) => d.subjects >= 2 },
    { id: 'precision',   name: 'Precisão Clínica',    icon: 'all-seeing-eye',  desc: 'Registre 20+ questões com 70%+ de acerto.',        check: (d) => d.questions >= 20 && d.accuracy >= 0.7 },
    { id: 'no_pause',    name: 'Mão Firme',           icon: 'checked-shield',  desc: 'Cumpra uma Meta Fixa de 25+ min sem pausar.',      check: (d) => d.cleanGoals >= 1 },
    { id: 'two_battles', name: 'Dupla Jornada',       icon: 'swords-emblem',   desc: 'Conclua 2 sessões de 25+ min hoje.',               check: (d) => d.longSessions >= 2 },
  ];

  /* ---------------- Troféus ---------------- */
  const hours = (s) => s.sessions.reduce((a, x) => a + x.minutes, 0) / 60;
  const TROPHIES = [
    { id: 'first_blood',  name: 'Primeira Vitória',      icon: 'skull-crossed-bones', desc: 'Derrote seu primeiro boss.',              check: (s) => s.stats.bossesDefeated >= 1 },
    { id: 'hunter10',     name: 'Caçador de Titãs',      icon: 'swords-emblem',       desc: 'Derrote 10 bosses.',                       check: (s) => s.stats.bossesDefeated >= 10 },
    { id: 'centurion',    name: 'Centenário Abissal',    icon: 'trophy',              desc: 'Derrote 100 bosses.',                      check: (s) => s.stats.bossesDefeated >= 100 },
    { id: 'god_slayer',   name: 'Matador de Deuses',     icon: 'crown',               desc: 'Derrote um boss Lendário.',                check: (s) => Object.values(s.bestiary).some((b) => b.rarity === 'legendary') },
    { id: 'streak7',      name: 'Semana de Ferro',       icon: 'flame',               desc: 'Alcance 7 dias seguidos de estudo.',       check: (s) => s.streak.best >= 7 },
    { id: 'streak30',     name: 'Disciplina Inabalável', icon: 'heart-beats',         desc: 'Alcance 30 dias seguidos de estudo.',      check: (s) => s.streak.best >= 30 },
    { id: 'hours10',      name: 'Primeiras Dez Horas',   icon: 'hourglass',           desc: 'Acumule 10 horas líquidas.',               check: (s) => hours(s) >= 10 },
    { id: 'hours100',     name: 'Erudito Supremo',       icon: 'white-book',          desc: 'Acumule 100 horas líquidas.',              check: (s) => hours(s) >= 100 },
    { id: 'raid',         name: 'Raid Completa',         icon: 'sands-of-time',       desc: 'Cumpra uma Meta Fixa de 90 minutos.',       check: (s) => s.sessions.some((x) => x.goalMet && x.goal >= 90) },
    { id: 'sharpshooter', name: 'Olho Clínico',          icon: 'archery-target',      desc: 'Registre 50+ questões com 80%+ numa sessão.', check: (s) => s.sessions.some((x) => x.questions >= 50 && x.correct / x.questions >= 0.8) },
    { id: 'contracts',    name: 'Contratado',            icon: 'scroll-quill',        desc: 'Cumpra 30 contratos diários.',             check: (s) => s.stats.questsDone >= 30 },
    { id: 'legend_gear',  name: 'Arsenal Lendário',      icon: 'dripping-blade',      desc: 'Possua 3 itens Lendários.',                check: (s) => s.inventory.filter((id) => ITEMS_BY_ID[id] && ITEMS_BY_ID[id].rarity === 'legendary').length >= 3 },
    { id: 'blacksmith',   name: 'Ferreiro Arcano',       icon: 'anvil',               desc: 'Refine um item até +5.',                   check: (s) => Object.values(s.refine).some((r) => r >= 5) },
    { id: 'collector',    name: 'Colecionador Completo', icon: 'chest',               desc: 'Descubra todos os itens.',                 check: (s) => ITEMS.every((it) => s.inventory.includes(it.id)) },
  ];

  Object.assign(MR, {
    RULES, ATTRS, RARITIES, RARITY_ORDER, METHODS, TRAITS, BOSS_POOL, BOSS_ICONS, BOSS_EPITHETS, DIFFICULTY,
    RANKS, SLOTS, ITEM_TYPES, ITEMS, ITEMS_BY_ID, QUESTS, TROPHIES, isPractice, isReview,
  });
})(typeof window !== 'undefined' ? (window.MR = window.MR || {}) : (globalThis.MR = globalThis.MR || {}));

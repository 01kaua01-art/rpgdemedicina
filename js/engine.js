/* =========================================================================
 * Engine — regras do jogo. Sem DOM: tudo recebe o estado (s) e o tempo (now),
 * o que permite testar em Node (tests/engine.test.js).
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { RULES, ITEMS_BY_ID, RARITIES, METHODS, TRAITS } = MR;
  const S = () => MR.Store;
  const rand = () => (MR.rand || Math.random)();
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MIN = 60000;

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ------------------------------------------------------------------ */
  /* Personagem                                                          */
  /* ------------------------------------------------------------------ */
  function itemStats(id, refineLvl = 0) {
    const it = ITEMS_BY_ID[id];
    if (!it) return {};
    const out = {};
    for (const [k, v] of Object.entries(it.stats)) out[k] = Math.round(v * (1 + 0.2 * refineLvl));
    return out;
  }

  function equippedItems(s) {
    return Object.values(s.equipment).filter(Boolean).map((id) => ITEMS_BY_ID[id]).filter(Boolean);
  }

  function totalAttrs(s) {
    const t = { ...s.player.base };
    for (const id of Object.values(s.equipment)) {
      if (!id) continue;
      for (const [k, v] of Object.entries(itemStats(id, s.refine[id] || 0))) t[k] = (t[k] || 0) + v;
    }
    return t;
  }

  const xpForLevel = (lvl) => Math.round(120 + Math.pow(lvl, 1.5) * 90);

  function rankFor(level) {
    let r = MR.RANKS[0];
    for (const x of MR.RANKS) if (level >= x.level) r = x;
    return r;
  }
  function nextRank(level) { return MR.RANKS.find((x) => x.level > level) || null; }

  function allocate(s, attr) {
    if (s.player.points <= 0 || !(attr in s.player.base)) return false;
    s.player.points--; s.player.base[attr]++;
    return true;
  }

  const RESPEC_COST = 100;
  function respec(s) {
    if (s.essence < RESPEC_COST) return false;
    const spent = Object.values(s.player.base).reduce((a, v) => a + (v - 1), 0);
    for (const k of Object.keys(s.player.base)) s.player.base[k] = 1;
    s.player.points += spent;
    s.essence -= RESPEC_COST;
    return true;
  }

  function equip(s, id, slot) {
    const it = ITEMS_BY_ID[id];
    if (!it || !s.inventory.includes(id)) return false;
    if (it.slot === 'ring') {
      for (const r of ['ring1', 'ring2']) if (s.equipment[r] === id) s.equipment[r] = null; // um só exemplar
      if (slot !== 'ring1' && slot !== 'ring2') slot = !s.equipment.ring1 ? 'ring1' : !s.equipment.ring2 ? 'ring2' : 'ring1';
    } else slot = it.slot;
    s.equipment[slot] = id;
    return slot;
  }
  function unequip(s, slot) { if (slot in s.equipment) s.equipment[slot] = null; }
  function equippedSlotOf(s, id) { return Object.keys(s.equipment).find((k) => s.equipment[k] === id) || null; }

  const refineCost = (id, lvl) => RARITIES[ITEMS_BY_ID[id].rarity].refineBase * (lvl + 1);
  function refine(s, id) {
    const lvl = s.refine[id] || 0;
    if (!s.inventory.includes(id) || lvl >= RULES.REFINE_MAX) return false;
    const cost = refineCost(id, lvl);
    if (s.essence < cost) return false;
    s.essence -= cost; s.refine[id] = lvl + 1;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Bosses                                                              */
  /* ------------------------------------------------------------------ */
  const bossIconFor = (name) => MR.BOSS_ICONS[hash(name) % MR.BOSS_ICONS.length];
  const bossId = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

  function generateBoss(s, killsSoFar = s.stats.bossesDefeated, avoidName = s.boss && s.boss.name, today = S().dayKey()) {
    const roll = rand() * 100;
    const rarity = roll < 5 ? 'legendary' : roll < 20 ? 'epic' : roll < 50 ? 'rare' : 'common';
    let name = pick(MR.BOSS_POOL[rarity]);
    if (name === avoidName) name = pick(MR.BOSS_POOL[rarity]);
    const keys = Object.keys(TRAITS).sort(() => rand() - 0.5);
    const traits = keys.slice(0, rarity === 'epic' || rarity === 'legendary' ? 2 : 1);
    const level = 1 + Math.floor(killsSoFar * 1.2) + Math.floor(rand() * 3);
    let mult = RARITIES[rarity].hpMult;
    for (const t of traits) if (TRAITS[t].hp) mult *= TRAITS[t].hp;
    const maxHp = Math.round((s.difficulty * mult * (1 + level * 0.04)) / 10) * 10;
    return { id: bossId(name), name, rarity, level, maxHp, hp: maxHp, traits, icon: bossIconFor(name), spawnDate: today };
  }

  function ensureBoss(s) {
    if (!s.boss) s.boss = generateBoss(s, 0, null);
    if (!MR.BOSS_ICONS.includes(s.boss.icon)) s.boss.icon = bossIconFor(s.boss.name);
  }

  /* ------------------------------------------------------------------ */
  /* Dia, sequência e contratos                                         */
  /* ------------------------------------------------------------------ */
  function daySummary(s, day) {
    const list = s.sessions.filter((x) => x.date === day);
    const d = { sessions: list.length, totalMin: 0, practiceMin: 0, reviewMin: 0, subjects: 0, questions: 0, correct: 0,
      accuracy: 0, maxContMin: 0, cleanGoals: 0, longSessions: 0, reviewSessions: 0, damage: 0, xp: 0 };
    const subj = new Set();
    for (const x of list) {
      d.totalMin += x.minutes; d.damage += x.damage; d.xp += x.xp;
      if (MR.isPractice(x.method)) d.practiceMin += x.minutes;
      if (MR.isReview(x.method)) { d.reviewMin += x.minutes; d.reviewSessions++; }
      subj.add((x.subject || '').trim().toLowerCase());
      d.questions += x.questions || 0; d.correct += x.correct || 0;
      d.maxContMin = Math.max(d.maxContMin, x.maxContMin || 0);
      if (x.goalMet && x.pauses === 0 && x.goal >= 25) d.cleanGoals++;
      if (x.minutes >= 25) d.longSessions++;
    }
    d.subjects = subj.size;
    d.accuracy = d.questions ? d.correct / d.questions : 0;
    return d;
  }

  function streakNow(s, today = S().dayKey()) {
    const st = s.streak;
    if (!st.lastDay || st.count <= 0) return 0;
    const gap = S().daysBetween(st.lastDay, today);
    return gap <= 1 ? st.count : 0;
  }

  function comboMult(s, today) {
    const bonus = equippedItems(s).reduce((a, it) => a + (it.streak || 0), 0);
    const days = Math.min(RULES.STREAK_CAP_DAYS, streakNow(s, today));
    return 1 + days * RULES.STREAK_STEP + (days >= RULES.STREAK_CAP_DAYS ? bonus : 0);
  }

  function rollQuests(s, day) {
    const seed = hash('quests:' + day);
    const pool = MR.QUESTS.map((q, i) => ({ q, k: hash(seed + ':' + i) })).sort((a, b) => a.k - b.k);
    s.quests = { day, ids: pool.slice(0, 3).map((x) => x.q.id), done: [], bonus: false };
  }

  /**
   * Processa os dias que passaram desde a última abertura:
   * regeneração do boss Insaciável, quebra/proteção da sequência e novos contratos.
   */
  function rollover(s, today = S().dayKey()) {
    const events = [];
    ensureBoss(s);
    if (!s.quests || s.quests.day !== today) rollQuests(s, today);
    if (!s.lastRollover || s.lastRollover >= today) { s.lastRollover = today; return events; }

    const studied = new Set(s.sessions.map((x) => x.date));
    let regen = 0;
    for (let d = s.lastRollover; d < today; d = S().addDays(d, 1)) {
      if (studied.has(d)) continue;
      if (s.boss.traits.includes('insatiable') && s.boss.hp < s.boss.maxHp) {
        const amt = Math.min(s.boss.maxHp - s.boss.hp, Math.round(s.boss.maxHp * 0.05));
        s.boss.hp += amt; regen += amt;
      }
      if (s.streak.count > 0 && s.streak.lastDay && s.streak.lastDay < d) {
        if (s.streak.freezes > 0) {
          s.streak.freezes--; s.streak.frozenDays.push(d); s.streak.lastDay = d;
          events.push({ type: 'freeze', day: d });
        } else {
          events.push({ type: 'streak_lost', count: s.streak.count });
          s.streak.count = 0; s.killChain = 0;
        }
      }
    }
    if (regen > 0) events.push({ type: 'regen', amount: regen, boss: s.boss.name });
    s.lastRollover = today;
    return events;
  }

  /* ------------------------------------------------------------------ */
  /* Sessão ativa (batalha)                                              */
  /* ------------------------------------------------------------------ */
  function liquidMs(a, now) {
    return a.segments.reduce((acc, g) => acc + ((g.end != null ? g.end : now) - g.start), 0);
  }
  function openSegment(a) { const g = a.segments[a.segments.length - 1]; return g && g.end == null ? g : null; }
  function contMs(a, now) { const g = openSegment(a); return g ? now - g.start : 0; }

  function startSession(s, opts, now = Date.now()) {
    const today = S().dayKey(new Date(now));
    const day = daySummary(s, today);
    const method = METHODS[opts.method] ? opts.method : 'questions';
    s.active = {
      id: String(now), subject: (opts.subject || '').trim(), method, mode: opts.mode === 'stopwatch' ? 'stopwatch' : 'countdown',
      goal: opts.mode === 'stopwatch' ? 0 : clamp(Math.round(opts.goal || 50), 5, 240),
      startedAt: now, beat: now, day: today,
      segments: [{ start: now, end: null, liq0: 0, flowCrit: false }],
      pauses: 0, maxContMin: 0, strikes: [], struckMin: 0,
      ctx0: { sessionsToday: day.sessions, reviewSessionsToday: day.reviewSessions, todayMin: day.totalMin },
      chain: [{ ...s.boss }],   // bosses enfrentados nesta sessão (o último é o alvo)
    };
    return s.active;
  }

  function pause(s, now = Date.now()) {
    const a = s.active; const g = a && openSegment(a);
    if (!g) return false;
    tick(s, now);
    a.maxContMin = Math.max(a.maxContMin, (now - g.start) / MIN);
    g.end = now; a.pauses++;
    return true;
  }

  function resume(s, now = Date.now()) {
    const a = s.active;
    if (!a || openSegment(a)) return false;
    a.segments.push({ start: now, end: null, liq0: liquidMs(a, now), flowCrit: false });
    a.beat = now;
    return true;
  }

  /** Se a aba/navegador ficou fechado, pausa a sessão no último batimento conhecido. */
  function recoverStale(s, now = Date.now()) {
    const a = s.active; const g = a && openSegment(a);
    if (!g || now - a.beat <= RULES.HEARTBEAT_GAP_MS) return false;
    const end = Math.max(g.start, a.beat);
    tick(s, end);
    a.maxContMin = Math.max(a.maxContMin, (end - g.start) / MIN);
    g.end = end; a.pauses++;
    return true;
  }

  function target(a) { return a.chain[a.chain.length - 1]; }

  /** Contexto lido pelos ganchos de item no momento de um golpe. */
  function strikeContext(s, a, sessionMin, contMin) {
    const t = target(a);
    return {
      method: a.method, sessionMin, contMin, totalMin: sessionMin, pauses: a.pauses, mode: a.mode,
      sessionsToday: a.ctx0.sessionsToday, reviewSessionsToday: a.ctx0.reviewSessionsToday,
      todayMin: a.ctx0.todayMin + sessionMin, bossHpPct: t.hp / t.maxHp, killChain: s.killChain + (a.chain.length - 1),
    };
  }

  function fatigueMult(s, attrs, todayMin) {
    const items = equippedItems(s);
    if (items.some((it) => it.fatigue && it.fatigue.immune)) return 1;
    const delay = items.reduce((acc, it) => acc + ((it.fatigue && it.fatigue.delay) || 0), 0);
    const over = todayMin - (RULES.FATIGUE_START_MIN + delay);
    if (over <= 0) return 1;
    let penalty = (over / 60) * RULES.FATIGUE_PER_HOUR;
    penalty *= 1 - Math.min(0.6, (attrs.resistencia || 0) * 0.02);
    for (const it of items) if (it.fatigue && it.fatigue.reduce) penalty *= 1 - it.fatigue.reduce;
    return Math.max(RULES.FATIGUE_FLOOR, 1 - penalty);
  }

  function flowTier(contMin) { return contMin >= RULES.FLOW_T2 ? 2 : contMin >= RULES.FLOW_T1 ? 1 : 0; }

  /**
   * Calcula um golpe de `minutes` minutos terminando em `sessionMin`.
   * kind: 'tick' (golpe regular), 'final' (minutos restantes), 'bonus' (dano fixo).
   */
  function computeStrike(s, a, minutes, sessionMin, contMin, opts = {}) {
    const attrs = totalAttrs(s);
    const items = equippedItems(s);
    const c = strikeContext(s, a, sessionMin, contMin);
    const m = METHODS[a.method];
    const today = a.day;

    let dmg = (minutes / 60) * m.dph;
    const parts = { poder: 1 + attrs.poder / 100 };
    if (MR.isPractice(a.method)) parts.precisao = 1 + attrs.precisao / 100;
    if (MR.isReview(a.method)) parts.retencao = 1 + attrs.retencao / 100;
    if (sessionMin >= 50) parts.foco = 1 + attrs.foco / 100;
    const tier = flowTier(contMin);
    if (tier) parts.fluxo = tier === 2 ? RULES.FLOW_T2_MULT : RULES.FLOW_T1_MULT;
    parts.sequencia = comboMult(s, today);
    const fat = fatigueMult(s, attrs, c.todayMin);
    if (fat < 1) parts.fadiga = fat;
    let itemMult = 1;
    for (const it of items) if (it.dmg) itemMult *= it.dmg(c);
    if (itemMult !== 1) parts.itens = itemMult;
    if (target(a).traits.includes('relentless')) parts.implacavel = TRAITS.relentless.dmg;
    for (const v of Object.values(parts)) dmg *= v;

    // Crítico
    let critChance = RULES.BASE_CRIT + attrs.foco * RULES.CRIT_PER_FOCO + items.reduce((acc, it) => acc + (it.crit || 0), 0);
    let crit = rand() < critChance;
    if (items.some((it) => it.alwaysCrit && it.alwaysCrit(c))) crit = true;
    if (opts.flowCrit) crit = true;
    if (crit) {
      let bonus = 0.5 + attrs.foco / 100;
      if (target(a).traits.includes('eternal')) bonus /= 2;
      dmg *= 1 + bonus;
    }
    if (target(a).traits.includes('volatile')) dmg *= 0.6 + rand();

    return { dmg: Math.max(1, Math.round(dmg)), crit, tier, parts, critChance: Math.min(1, critChance) };
  }

  /** Aplica dano à cadeia de bosses da sessão, gerando o próximo boss quando um cai. */
  function applyToChain(s, a, dmg) {
    const kills = [];
    let left = dmg;
    while (left > 0) {
      const t = target(a);
      const hit = Math.min(t.hp, left);
      t.hp -= hit; left -= hit;
      if (t.hp <= 0) {
        kills.push(t.name);
        const next = generateBoss(s, s.stats.bossesDefeated + a.chain.length, t.name, a.day);
        a.chain.push(next);
      }
      if (hit === 0 && left > 0 && kills.length > 50) break; // trava de segurança
    }
    return kills;
  }

  function addStrike(s, a, strike, atMin, kind, label) {
    const before = target(a);
    const kills = applyToChain(s, a, strike.dmg);
    const rec = { at: Math.round(atMin * 10) / 10, dmg: strike.dmg, crit: strike.crit, tier: strike.tier, kind, label, kills, target: before.name };
    a.strikes.push(rec);
    return rec;
  }

  /** Gera os golpes devidos até `now`. Retorna a lista de golpes novos. */
  function tick(s, now = Date.now()) {
    const a = s.active;
    if (!a) return [];
    const out = [];
    const liq = liquidMs(a, now) / MIN;
    const every = RULES.STRIKE_EVERY_MIN;
    const cap = a.mode === 'countdown' ? a.goal : RULES.STOPWATCH_CAP_MIN;
    while (a.struckMin + every <= Math.min(liq, cap) + 1e-9) {
      const at = a.struckMin + every;
      // segmento onde esse minuto líquido caiu
      let seg = a.segments[0];
      for (const g of a.segments) if (g.liq0 / MIN <= at) seg = g;
      const cont = at - seg.liq0 / MIN;
      a.maxContMin = Math.max(a.maxContMin, cont);
      const flowCrit = cont >= RULES.FLOW_T2 && !seg.flowCrit;
      if (flowCrit) seg.flowCrit = true;
      const st = computeStrike(s, a, every, at, cont, { flowCrit });
      out.push(addStrike(s, a, st, at, flowCrit ? 'flow' : 'tick', null));
      a.struckMin = at;
    }
    const g = openSegment(a);
    if (g) a.maxContMin = Math.max(a.maxContMin, (now - g.start) / MIN);
    a.beat = now;
    return out;
  }

  function sessionView(s, now = Date.now()) {
    const a = s.active;
    if (!a) return null;
    const liq = liquidMs(a, now) / MIN;
    const cont = contMs(a, now) / MIN;
    const dmg = a.strikes.reduce((acc, x) => acc + x.dmg, 0);
    const t = target(a);
    const nextStrikeIn = (a.struckMin + RULES.STRIKE_EVERY_MIN - liq) * 60;
    return {
      liquidMin: liq, contMin: cont, paused: !openSegment(a), dmg, target: t,
      kills: a.chain.length - 1, flow: flowTier(cont), nextStrikeSec: Math.max(0, nextStrikeIn),
      remainingSec: a.mode === 'countdown' ? Math.max(0, (a.goal - liq) * 60) : null,
      done: a.mode === 'countdown' ? liq >= a.goal - 1e-6 : liq >= RULES.STOPWATCH_CAP_MIN,
      critChance: computeStrike(s, a, 0, liq, cont).critChance,
    };
  }

  function abandon(s) { s.active = null; }

  /* ------------------------------------------------------------------ */
  /* Saque                                                               */
  /* ------------------------------------------------------------------ */
  function rollLoot(s, bossRarity) {
    const attrs = totalAttrs(s);
    const F = (attrs.fortuna || 0) + equippedItems(s).reduce((acc, it) => acc + (it.loot || 0), 0);
    const bonus = { legendary: 20, epic: 10, rare: 5 }[bossRarity] || 0;
    const r = rand() * 100;
    const rarity = r < 1 + F * 0.25 + bonus ? 'legendary' : r < 6 + F * 0.45 + bonus ? 'epic' : r < 22 + F * 0.7 + bonus ? 'rare' : 'uncommon';
    const pool = MR.ITEMS.filter((it) => it.rarity === rarity);
    const fresh = pool.filter((it) => !s.inventory.includes(it.id));
    const item = fresh.length ? pick(fresh) : pick(pool);
    const duplicate = s.inventory.includes(item.id);
    const essence = duplicate ? RARITIES[item.rarity].essence : 0;
    if (duplicate) { s.essence += essence; s.stats.essenceEarned += essence; } else { s.inventory.push(item.id); s.newItems.push(item.id); }
    return { id: item.id, duplicate, essence };
  }

  /* ------------------------------------------------------------------ */
  /* Concluir batalha                                                    */
  /* ------------------------------------------------------------------ */
  function addXp(s, amount) {
    s.player.xp += amount; s.player.totalXp += amount;
    let ups = 0;
    while (s.player.xp >= xpForLevel(s.player.level)) {
      s.player.xp -= xpForLevel(s.player.level);
      s.player.level++; ups++;
      s.player.points += RULES.POINTS_PER_LEVEL;
    }
    return ups;
  }

  function checkTrophies(s) {
    const fresh = [];
    for (const t of MR.TROPHIES) {
      if (!s.trophies[t.id] && t.check(s)) { s.trophies[t.id] = new Date().toISOString(); fresh.push(t.id); }
    }
    return fresh;
  }

  /**
   * report: { questions, correct, reviewedErrors, note, focus }
   * Retorna o relatório completo para a tela de resultado, ou {discarded:true}.
   */
  function finishSession(s, report = {}, now = Date.now()) {
    const a = s.active;
    if (!a) return null;
    const g = openSegment(a);
    if (g) { tick(s, now); a.maxContMin = Math.max(a.maxContMin, (now - g.start) / MIN); g.end = now; }
    const cap = a.mode === 'countdown' ? a.goal : RULES.STOPWATCH_CAP_MIN;
    const liq = Math.min(cap, liquidMs(a, now) / MIN);
    if (liq < 1) { s.active = null; return { discarded: true }; }

    // Golpe final com os minutos que sobraram desde o último golpe
    const rest = liq - a.struckMin;
    if (rest >= 0.05) {
      const lastSeg = a.segments[a.segments.length - 1];
      const st = computeStrike(s, a, rest, liq, liq - lastSeg.liq0 / MIN);
      addStrike(s, a, st, liq, 'final', 'Golpe Final');
    }
    const baseDmg = a.strikes.reduce((acc, x) => acc + x.dmg, 0);
    const goalMet = a.mode === 'countdown' && liq >= a.goal - 1e-6;
    const items = equippedItems(s);
    const attrs = totalAttrs(s);

    if (goalMet) {
      const mult = items.reduce((acc, it) => acc * (it.completion || 1), 1);
      const dmg = Math.round(baseDmg * RULES.COMPLETION_BONUS * mult);
      if (dmg > 0) addStrike(s, a, { dmg, crit: false, tier: 0 }, liq, 'completion', 'Golpe de Conclusão');
    }
    const q = Math.max(0, Math.floor(report.questions || 0));
    const c = clamp(Math.floor(report.correct || 0), 0, q);
    const acc = q ? c / q : 0;
    if (MR.isPractice(a.method) && q >= 10) {
      const pct = clamp((acc - 0.5) * 0.5, 0, 0.25) * (1 + attrs.precisao / 200);
      const dmg = Math.round(baseDmg * pct);
      if (dmg > 0) addStrike(s, a, { dmg, crit: false, tier: 0 }, liq, 'precision', 'Golpe de Precisão');
    }
    const totalDmg = a.strikes.reduce((acc2, x) => acc2 + x.dmg, 0);
    const crits = a.strikes.filter((x) => x.crit).length;
    const regular = a.strikes.filter((x) => x.kind === 'tick' || x.kind === 'flow' || x.kind === 'final').length;

    // XP
    const m = METHODS[a.method];
    const xpCtx = { method: a.method, totalMin: liq, sessionMin: liq, contMin: a.maxContMin, reviewedErrors: !!report.reviewedErrors,
      pauses: a.pauses, sessionsToday: a.ctx0.sessionsToday, reviewSessionsToday: a.ctx0.reviewSessionsToday };
    const xpParts = { intelecto: 1 + attrs.intelecto / 100 };
    let itemXp = 1;
    for (const it of items) if (it.xp) itemXp *= it.xp(xpCtx);
    if (itemXp !== 1) xpParts.itens = itemXp;
    if (crits) xpParts.criticos = 1 + 0.2 * Math.min(1, crits / Math.max(1, regular));
    if (a.maxContMin >= RULES.FLOW_T2) xpParts.fluxo = 1.10;
    if (MR.isPractice(a.method) && q >= 10 && acc > 0.5) xpParts.precisao = 1 + clamp(acc - 0.5, 0, 0.5) * 0.4;
    if (goalMet) xpParts.meta = 1.05;
    const killed = a.chain.slice(0, -1);
    if (killed.some((b) => b.traits.includes('colossal'))) xpParts.colossal = 1.40;
    let xp = (liq / 60) * m.xph;
    for (const v of Object.values(xpParts)) xp *= v;
    xp = Math.round(xp);

    // Bosses derrotados e saque
    const kills = [];
    for (const b of killed) {
      s.stats.bossesDefeated++;
      s.killChain++;
      const e = s.bestiary[b.id] || { name: b.name, rarity: b.rarity, icon: b.icon, traits: b.traits, kills: 0, firstKill: a.day };
      e.kills++; e.lastKill = a.day; e.icon = e.icon || b.icon; e.rarity = b.rarity;
      s.bestiary[b.id] = e;
      const loot = [rollLoot(s, b.rarity)];
      const proud = b.traits.includes('proud') && S().daysBetween(b.spawnDate, a.day) <= 3;
      if (proud) loot.push(rollLoot(s, b.rarity));
      kills.push({ boss: b, loot, proud });
    }
    s.boss = { ...target(a) };

    // Sequência
    const today = a.day;
    const st = s.streak;
    let streakUp = false;
    if (st.lastDay !== today) {
      st.count = st.lastDay && S().daysBetween(st.lastDay, today) === 1 ? st.count + 1 : 1;
      st.lastDay = today; streakUp = true;
      if (st.count % 7 === 0 && st.freezes < RULES.FREEZE_MAX) { st.freezes++; }
    }
    st.best = Math.max(st.best, st.count);

    // Registro
    const session = {
      id: a.id, date: today, startedAt: a.startedAt, endedAt: now, minutes: Math.round(liq), subject: a.subject || 'Estudo Geral',
      method: a.method, mode: a.mode, goal: a.goal, goalMet, pauses: a.pauses, maxContMin: Math.round(a.maxContMin),
      damage: totalDmg, xp, crits, strikes: a.strikes.length, bosses: [...new Set(a.strikes.map((x) => x.target))],
      kills: killed.length, questions: q, correct: c, reviewedErrors: !!report.reviewedErrors,
      focus: report.focus || 0, note: (report.note || '').slice(0, 280),
    };
    s.sessions.unshift(session);
    s.stats.totalDamage += totalDmg;
    s.stats.maxSessionDamage = Math.max(s.stats.maxSessionDamage, totalDmg);

    // Contratos
    if (!s.quests || s.quests.day !== today) rollQuests(s, today);
    const day = daySummary(s, today);
    const questsDone = [];
    let questXp = 0;
    for (const id of s.quests.ids) {
      const qd = MR.QUESTS.find((x) => x.id === id);
      if (!s.quests.done.includes(id) && qd.check(day)) {
        s.quests.done.push(id); questsDone.push(id); s.stats.questsDone++;
        questXp += RULES.QUEST_XP; s.essence += RULES.QUEST_ESSENCE; s.stats.essenceEarned += RULES.QUEST_ESSENCE;
      }
    }
    let questBonus = false;
    if (!s.quests.bonus && s.quests.done.length === s.quests.ids.length) {
      s.quests.bonus = true; questBonus = true;
      s.essence += RULES.QUEST_ALL_BONUS; s.stats.essenceEarned += RULES.QUEST_ALL_BONUS;
    }

    const fromLevel = s.player.level;
    const ups = addXp(s, xp + questXp);
    const trophies = checkTrophies(s);
    s.active = null;

    return {
      session, kills, xp, questXp, xpParts, baseDmg, totalDmg, crits, goalMet, strikes: a.strikes,
      level: { from: fromLevel, to: s.player.level, ups, points: ups * RULES.POINTS_PER_LEVEL },
      streak: { count: st.count, up: streakUp }, questsDone, questBonus, trophies, chain: a.chain,
    };
  }

  /**
   * Estimativa (sem efeitos colaterais) do dano/XP de uma sessão planejada,
   * assumindo foco contínuo, sem pausas e críticos pelo valor esperado.
   */
  function estimate(s, { method = 'questions', mode = 'countdown', goal = 50 } = {}, now = Date.now()) {
    const minutes = mode === 'stopwatch' ? 60 : goal;
    const day = daySummary(s, S().dayKey(new Date(now)));
    const a = { method, mode, goal: minutes, pauses: 0, day: S().dayKey(new Date(now)),
      ctx0: { sessionsToday: day.sessions, reviewSessionsToday: day.reviewSessions, todayMin: day.totalMin },
      chain: [{ ...s.boss, hp: Infinity }] };
    const saved = MR.rand; MR.rand = () => 0.4; // sem crítico aleatório; Inconstante = x1,0
    const attrs = totalAttrs(s);
    let dmg = 0, crits = 0, n = 0;
    try {
      let flowDone = false;
      for (let at = RULES.STRIKE_EVERY_MIN; at <= minutes + 1e-9; at += RULES.STRIKE_EVERY_MIN) {
        const fc = at >= RULES.FLOW_T2 && !flowDone; if (fc) flowDone = true;
        const st = computeStrike(s, a, RULES.STRIKE_EVERY_MIN, at, at, { flowCrit: false });
        let bonus = 0.5 + attrs.foco / 100; if (s.boss.traits.includes('eternal')) bonus /= 2;
        const forced = fc || equippedItems(s).some((it) => it.alwaysCrit && it.alwaysCrit({ method }));
        const p = forced ? 1 : Math.min(1, st.critChance);
        const raw = st.crit ? st.dmg / (1 + bonus) : st.dmg;
        dmg += raw * (1 + p * bonus); crits += p; n++;
      }
    } finally { MR.rand = saved; }
    if (mode === 'countdown') dmg *= 1 + RULES.COMPLETION_BONUS * equippedItems(s).reduce((acc, it) => acc * (it.completion || 1), 1);
    let xp = (minutes / 60) * METHODS[method].xph * (1 + attrs.intelecto / 100);
    const xpCtx = { method, totalMin: minutes, sessionMin: minutes, contMin: minutes, reviewedErrors: false, pauses: 0,
      sessionsToday: day.sessions, reviewSessionsToday: day.reviewSessions };
    for (const it of equippedItems(s)) if (it.xp) xp *= it.xp(xpCtx);
    if (minutes >= RULES.FLOW_T2) xp *= 1.10;
    return { dmg: Math.round(dmg), xp: Math.round(xp), minutes, perHour: (dmg / minutes) * 60, critRate: n ? crits / n : 0 };
  }

  MR.Engine = {
    estimate, hash, clamp, itemStats, equippedItems, totalAttrs, xpForLevel, rankFor, nextRank, allocate, respec, RESPEC_COST,
    equip, unequip, equippedSlotOf, refine, refineCost, generateBoss, ensureBoss, bossIconFor, daySummary, streakNow,
    comboMult, rollQuests, rollover, liquidMs, contMs, startSession, pause, resume, recoverStale, tick, sessionView,
    abandon, finishSession, rollLoot, checkTrophies, fatigueMult, flowTier, computeStrike, addXp,
  };
})(typeof window !== 'undefined' ? (window.MR = window.MR || {}) : (globalThis.MR = globalThis.MR || {}));

/* =========================================================================
 * Store — estado do jogo, persistência em localStorage e migração de saves.
 * Um único objeto de estado vive em memória; save() grava e notifica a UI.
 * ========================================================================= */
(function (MR) {
  'use strict';

  const KEY = 'medrpg_save_v3';
  const LEGACY_KEYS = ['medrpg_save_v2', 'medrpg_save_v1'];
  const VERSION = 3;

  const pad = (n) => String(n).padStart(2, '0');
  /** Data local no formato AAAA-MM-DD (nunca UTC, para não "virar o dia" às 21h). */
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
  const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);

  function defaults() {
    return {
      version: VERSION,
      player: {
        name: 'Acadêmico', level: 1, xp: 0, totalXp: 0, points: 0,
        base: { poder: 1, intelecto: 1, foco: 1, precisao: 1, retencao: 1, resistencia: 1, fortuna: 1 },
        createdAt: new Date().toISOString(),
      },
      equipment: { weapon: 'bisturi_basico', grimoire: null, armor: null, relic: null, accessory: null, ring1: 'alianca_academico', ring2: null },
      inventory: ['bisturi_basico', 'alianca_academico'],
      refine: {},
      essence: 0,
      boss: null,            // gerado pelo engine no boot
      difficulty: 12000,
      sessions: [],
      bestiary: {},
      trophies: {},
      streak: { count: 0, best: 0, lastDay: null, freezes: 0, frozenDays: [] },
      killChain: 0,
      quests: null,
      stats: { totalDamage: 0, maxSessionDamage: 0, bossesDefeated: 0, questsDone: 0, essenceEarned: 0 },
      lastRollover: dayKey(),
      active: null,
      settings: { sound: true, music: false, volume: 0.6, notifications: false, reducedMotion: false, lastMethod: 'questions', lastMode: 'countdown', lastGoal: 50 },
      onboarded: false,
      newItems: [],
    };
  }

  /** Converte um save do MedRPG original (v1/v2) para o formato v3. */
  function fromLegacy(old) {
    const s = defaults();
    const p = old.player || {};
    s.player.level = p.level || 1;
    s.player.xp = p.currentXp || 0;
    s.player.totalXp = p.totalXpEarned || 0;
    s.player.points = p.attributePoints || 0;
    s.player.name = p.name || s.player.name;
    if (p.baseAttributes) s.player.base = { ...s.player.base, ...p.baseAttributes };

    const known = (id) => !!MR.ITEMS_BY_ID[id];
    s.inventory = [...new Set([...(old.inventory || []), ...s.inventory])].filter(known);
    if (old.equipment) {
      for (const slot of Object.keys(s.equipment)) {
        const id = old.equipment[slot];
        s.equipment[slot] = id && known(id) ? id : s.equipment[slot];
      }
    }
    if (old.boss && old.boss.name) {
      const b = old.boss;
      s.difficulty = b.preset || 12000;
      s.boss = {
        id: b.id, name: b.name, rarity: b.rarity || 'common', level: b.level || 1,
        maxHp: b.maxHp, hp: b.currentHp, traits: (b.traits || []).filter((t) => MR.TRAITS[t]),
        icon: MR.BOSS_ICONS[0], spawnDate: dayKey(b.spawnDate ? new Date(b.spawnDate) : new Date()),
      };
      s.stats.bossesDefeated = b.bossesDefeated || 0;
    }
    s.sessions = (old.sessions || []).map((x) => ({
      id: x.id || String(Math.random()), date: x.date, endedAt: null, minutes: x.durationMinutes || 0,
      subject: x.subject || 'Estudo Geral', method: x.methodKey || 'questions', mode: 'countdown',
      goal: 0, goalMet: false, pauses: 0, maxContMin: 0, damage: x.damage || 0, xp: x.xp || 0,
      crits: x.isCrit ? 1 : 0, strikes: 0, bosses: x.bossName ? [x.bossName] : [], kills: 0,
      questions: 0, correct: 0, reviewedErrors: false, legacy: true,
    }));
    for (const [id, b] of Object.entries(old.bestiary || {})) {
      s.bestiary[id] = { name: b.name, rarity: b.rarity, icon: null, traits: b.traits || [], kills: b.defeatedCount || 1,
        firstKill: b.firstDefeatDate || null };
    }
    const tmap = { first_blood: 'first_blood', titan_hunter: 'hunter10', god_slayer: 'god_slayer', discipline: 'streak30', centurion: 'centurion', erudite: 'hours100' };
    for (const t of old.unlockedTrophies || []) if (tmap[t]) s.trophies[tmap[t]] = new Date().toISOString();
    s.stats.totalDamage = (old.stats && old.stats.totalDamage) || 0;
    s.stats.maxSessionDamage = (old.stats && old.stats.maxSessionDamage) || 0;
    s.streak.count = p.lastStudyDate ? (p.consecutiveDays || 1) : 0;
    s.streak.best = s.streak.count;
    s.streak.lastDay = p.lastStudyDate || null;
    s.lastRollover = p.lastStudyDate || dayKey();
    s.onboarded = true;
    s.migratedFrom = old._version || 1;
    return s;
  }

  /** Garante que campos novos existam em saves antigos do próprio v3. */
  function normalize(s) {
    const d = defaults();
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    s.player = { ...d.player, ...s.player, base: { ...d.player.base, ...(s.player && s.player.base) } };
    s.settings = { ...d.settings, ...s.settings };
    s.streak = { ...d.streak, ...s.streak };
    s.stats = { ...d.stats, ...s.stats };
    s.equipment = { ...d.equipment, ...s.equipment };
    s.inventory = [...new Set(s.inventory)].filter((id) => MR.ITEMS_BY_ID[id]);
    return s;
  }

  const listeners = new Set();
  let state = null;

  const Store = {
    KEY, dayKey, parseDay, addDays, daysBetween, defaults,

    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { /* modo privado */ }
      if (raw) {
        try { state = normalize(JSON.parse(raw)); return state; } catch (e) { console.warn('Save corrompido, criando novo.', e); }
      }
      for (const k of LEGACY_KEYS) {
        try {
          const legacy = localStorage.getItem(k);
          if (legacy) { state = normalize(fromLegacy(JSON.parse(legacy))); this.save(); return state; }
        } catch (e) { console.warn('Falha ao migrar save legado', e); }
      }
      state = defaults();
      return state;
    },

    get() { return state; },

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('Falha ao salvar', e); }
      listeners.forEach((fn) => fn(state));
    },

    /** Grava sem notificar a UI (usado pelo "batimento" do timer). */
    persistQuiet() {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
    },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    exportJSON() { return JSON.stringify(state, null, 2); },

    importJSON(text) {
      const parsed = JSON.parse(text);
      let next;
      if (parsed.version === VERSION) next = normalize(parsed);
      else if (parsed.player && (parsed.boss || parsed.equipment)) next = normalize(fromLegacy(parsed));
      else throw new Error('Arquivo não reconhecido como save do MedRPG.');
      state = next;
      this.save();
      return state;
    },

    reset() {
      try { localStorage.removeItem(KEY); LEGACY_KEYS.forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignora */ }
      state = defaults();
      return state;
    },

    /** Usado nos testes (Node) para injetar estado. */
    _set(s) { state = normalize(s); },
    _fromLegacy: fromLegacy,
  };

  MR.Store = Store;
})(typeof window !== 'undefined' ? (window.MR = window.MR || {}) : (globalThis.MR = globalThis.MR || {}));

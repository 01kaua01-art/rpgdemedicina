/* Testes do motor do jogo — rode com: node tests/engine.test.js */
const fs = require('fs'); const path = require('path'); const vm = require('vm'); const assert = require('assert');
const ctx = { console, Math, Date, JSON, Object, Array, Set, String, Number, Promise };
ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['data.js', 'store.js', 'engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const { MR } = ctx; const E = MR.Engine; const St = MR.Store;
let seed = 42; MR.rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const MIN = 60000; let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok -', name); };
const fresh = () => { St._set(St.defaults()); const st = St.get(); st.lastRollover = '2026-11-03'; E.rollover(st, '2026-11-03'); return st; };
const T0 = new Date(2026, 10, 3, 9, 0).getTime();
const tank = (s) => { s.boss.hp = s.boss.maxHp = 1e9; s.boss.traits = []; };

test('boss inicial é gerado', () => { const s = fresh(); assert(s.boss && s.boss.hp === s.boss.maxHp && s.boss.maxHp > 0); });

test('sessão de 50 min gera 10 golpes, com crítico de Fluxo garantido', () => {
  const s = fresh(); tank(s);
  E.startSession(s, { method: 'questions', mode: 'countdown', goal: 50 }, T0);
  const strikes = E.tick(s, T0 + 50 * MIN);
  assert.strictEqual(strikes.length, 10);
  assert(strikes[9].crit && strikes[9].kind === 'flow');
  const r = E.finishSession(s, {}, T0 + 50 * MIN);
  assert(r.goalMet); assert(r.totalDmg > r.baseDmg, 'golpe de conclusão');
  assert.strictEqual(r.session.minutes, 50); assert(r.xp > 0); assert.strictEqual(s.streak.count, 1);
});

test('pausa não conta tempo e quebra o fluxo', () => {
  const s = fresh(); tank(s);
  E.startSession(s, { method: 'flashcards', mode: 'stopwatch' }, T0);
  E.pause(s, T0 + 20 * MIN); E.resume(s, T0 + 80 * MIN);
  const v = E.sessionView(s, T0 + 90 * MIN);
  assert(Math.abs(v.liquidMin - 30) < 1e-6 && Math.abs(v.contMin - 10) < 1e-6);
  const r = E.finishSession(s, {}, T0 + 90 * MIN);
  assert.strictEqual(r.session.minutes, 30); assert.strictEqual(r.session.pauses, 1); assert.strictEqual(r.session.maxContMin, 20);
});

test('dano excedente passa para o próximo boss e gera saque', () => {
  const s = fresh(); s.boss.hp = 100; s.boss.traits = [];
  const name = s.boss.name;
  E.startSession(s, { method: 'mock_exam', mode: 'countdown', goal: 25 }, T0);
  const r = E.finishSession(s, {}, T0 + 25 * MIN);
  assert(r.kills.length >= 1 && r.kills[0].boss.name === name);
  assert(s.boss.hp < s.boss.maxHp, 'excedente aplicado ao novo boss');
  assert(r.kills[0].loot.length >= 1); assert(s.stats.bossesDefeated >= 1); assert(s.trophies.first_blood);
});

test('desistir não altera o boss', () => {
  const s = fresh(); const hp = s.boss.hp;
  E.startSession(s, { method: 'questions', mode: 'countdown', goal: 50 }, T0); E.tick(s, T0 + 40 * MIN); E.abandon(s);
  assert.strictEqual(s.boss.hp, hp); assert.strictEqual(s.active, null); assert.strictEqual(s.sessions.length, 0);
});

test('aba fechada: sessão é pausada no último batimento', () => {
  const s = fresh(); tank(s);
  E.startSession(s, { method: 'questions', mode: 'stopwatch' }, T0); E.tick(s, T0 + 12 * MIN);
  assert(E.recoverStale(s, T0 + 300 * MIN));
  const v = E.sessionView(s, T0 + 300 * MIN); assert(v.paused && Math.abs(v.liquidMin - 12) < 1e-6);
});

test('sequência: dias seguidos sobem, falta quebra, proteção salva', () => {
  const s = fresh(); tank(s);
  const day = (d, h = 9) => new Date(2026, 10, d, h).getTime();
  for (let d = 3; d <= 9; d++) {
    E.rollover(s, St.dayKey(new Date(day(d))));
    E.startSession(s, { method: 'questions', goal: 25 }, day(d)); E.finishSession(s, {}, day(d) + 25 * MIN);
  }
  assert.strictEqual(s.streak.count, 7); assert.strictEqual(s.streak.freezes, 1);
  const ev = E.rollover(s, '2026-11-11'); // faltou o dia 10
  assert(ev.some((e) => e.type === 'freeze')); assert.strictEqual(E.streakNow(s, '2026-11-11'), 7);
  const ev2 = E.rollover(s, '2026-11-13'); // faltou 11 e 12
  assert(ev2.some((e) => e.type === 'streak_lost')); assert.strictEqual(E.streakNow(s, '2026-11-13'), 0);
});

test('Insaciável regenera 5% por dia sem estudo', () => {
  const s = fresh(); s.boss.traits = ['insatiable']; s.boss.hp = s.boss.maxHp - 3000; s.lastRollover = '2026-11-01';
  const ev = E.rollover(s, '2026-11-03');
  assert.strictEqual(s.boss.hp, s.boss.maxHp - 3000 + Math.round(s.boss.maxHp * 0.05) * 2);
  assert(ev.some((e) => e.type === 'regen'));
});

test('Olho de Hipócrates força crítico em Questões', () => {
  const s = fresh(); tank(s);
  s.inventory.push('olho_hipocrates'); E.equip(s, 'olho_hipocrates');
  E.startSession(s, { method: 'questions', mode: 'stopwatch' }, T0);
  assert(E.tick(s, T0 + 30 * MIN).every((x) => x.crit));
});

test('Armadura da Disciplina anula fadiga; sem ela há penalidade', () => {
  const s = fresh(); const at = E.totalAttrs(s);
  assert(E.fatigueMult(s, at, 400) < 1);
  s.inventory.push('calice_disciplina'); E.equip(s, 'calice_disciplina');
  assert.strictEqual(E.fatigueMult(s, at, 400), 1);
});

test('anéis: o mesmo item não ocupa dois slots', () => {
  const s = fresh(); s.inventory.push('anel_sinapse');
  E.equip(s, 'anel_sinapse', 'ring2'); E.equip(s, 'anel_sinapse', 'ring1');
  assert.strictEqual(s.equipment.ring1, 'anel_sinapse'); assert.strictEqual(s.equipment.ring2, null);
});

test('refino consome essência e aumenta atributos', () => {
  const s = fresh(); s.essence = 1000; const before = E.totalAttrs(s).poder;
  assert(E.refine(s, 'bisturi_basico')); assert(E.totalAttrs(s).poder > before); assert(s.essence < 1000);
});

test('contratos diários: 3 por dia, determinísticos', () => {
  const s = fresh(); const a = s.quests.ids.join(); E.rollQuests(s, '2026-11-03');
  assert.strictEqual(s.quests.ids.length, 3); assert.strictEqual(s.quests.ids.join(), a);
});

test('Golpe de Precisão com 80% de acerto', () => {
  const s = fresh(); tank(s);
  E.startSession(s, { method: 'questions', mode: 'countdown', goal: 25 }, T0);
  const r = E.finishSession(s, { questions: 40, correct: 32, reviewedErrors: true }, T0 + 25 * MIN);
  assert(r.strikes.some((x) => x.kind === 'precision')); assert(r.xpParts.precisao > 1);
});

test('sessão com menos de 1 minuto é descartada', () => {
  const s = fresh();
  E.startSession(s, { method: 'questions', goal: 25 }, T0);
  assert(E.finishSession(s, {}, T0 + 30000).discarded); assert.strictEqual(s.sessions.length, 0);
});

test('migração do save original (v2)', () => {
  const legacy = {
    _version: 2,
    player: { level: 7, currentXp: 50, totalXpEarned: 3000, consecutiveDays: 3, lastStudyDate: '2026-11-02', attributePoints: 4,
      baseAttributes: { poder: 5, intelecto: 2, foco: 1, precisao: 1, retencao: 1, resistencia: 1, fortuna: 1 } },
    equipment: { weapon: 'bisturi_anatomista', ring1: 'alianca_academico' },
    inventory: ['alianca_academico', 'bisturi_anatomista', 'item_inexistente'],
    boss: { id: 'x', name: 'O Vazio', rarity: 'legendary', level: 3, maxHp: 30000, currentHp: 12000, traits: ['eternal'], icon: 'http://x', bossesDefeated: 4, preset: 12000 },
    sessions: [{ id: '1', date: '2026-11-02', durationMinutes: 50, subject: 'Cardio', methodKey: 'questions', damage: 2000, xp: 150, isCrit: true }],
    unlockedTrophies: ['first_blood'], bestiary: {}, stats: { totalDamage: 9000, maxSessionDamage: 2000 },
  };
  const s = St._fromLegacy(legacy);
  assert.strictEqual(s.player.level, 7); assert.strictEqual(s.boss.hp, 12000); assert.strictEqual(s.equipment.weapon, 'bisturi_anatomista');
  assert(!s.inventory.includes('item_inexistente')); assert.strictEqual(s.sessions[0].minutes, 50); assert.strictEqual(s.streak.count, 3);
  assert(s.trophies.first_blood);
});

test('estresse: 300 sessões aleatórias mantêm o estado consistente', () => {
  const s = fresh(); let t = T0;
  const methods = Object.keys(MR.METHODS);
  for (let i = 0; i < 300; i++) {
    E.startSession(s, { method: methods[i % 5], mode: i % 3 ? 'countdown' : 'stopwatch', goal: [25, 50, 90][i % 3] }, t);
    if (i % 4 === 0) { E.pause(s, t + 10 * MIN); E.resume(s, t + 15 * MIN); }
    const r = E.finishSession(s, { questions: 30, correct: 20 }, t + 95 * MIN);
    assert(!r.discarded && r.totalDmg > 0 && Number.isFinite(r.xp));
    assert(s.boss.hp > 0 && s.boss.hp <= s.boss.maxHp);
    t += 6 * 60 * MIN; E.rollover(s, St.dayKey(new Date(t)));
  }
  assert.strictEqual(new Set(s.inventory).size, s.inventory.length);
  for (const it of s.inventory) assert(MR.ITEMS_BY_ID[it]);
  console.log(`      -> nível ${s.player.level}, ${s.stats.bossesDefeated} bosses, ${s.inventory.length}/${MR.ITEMS.length} itens, essência ${s.essence}`);
});

console.log(`\n${passed} testes passaram.`);

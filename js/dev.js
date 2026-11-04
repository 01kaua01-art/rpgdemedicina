/* =========================================================================
 * Dev — painel de testes. Só aparece abrindo o jogo com ?dev na URL.
 * ========================================================================= */
(function (MR) {
  'use strict';
  if (!/[?&]dev\b/.test(location.search)) return;
  const MIN = 60000;
  const S = () => MR.Store.get();
  const done = (msg) => { MR.Store.save(); if (MR.Focus.isOpen()) MR.Focus.tick(); MR.UI.toast('[dev] ' + msg, { icon: 'hammer', uiIcon: true, color: 'var(--crimson)', ms: 1800 }); };

  const tools = {
    '+5 min': () => warp(5), '+25 min': () => warp(25), '+50 min': () => warp(50),
    'Boss a 1 HP': () => { S().boss.hp = 1; if (S().active) S().active.chain[S().active.chain.length - 1].hp = 1; done('boss com 1 HP'); },
    '+1 nível': () => { MR.Engine.addXp(S(), MR.Engine.xpForLevel(S().player.level) - S().player.xp); done('subiu de nível'); },
    '+500 Essência': () => { S().essence += 500; done('+500 essência'); },
    'Todos os itens': () => { for (const it of MR.ITEMS) if (!S().inventory.includes(it.id)) S().inventory.push(it.id); done('todos os itens'); },
    'Simular amanhã': () => { S().lastRollover = MR.Store.addDays(S().lastRollover, -1); S().streak.lastDay = S().streak.lastDay && MR.Store.addDays(S().streak.lastDay, -1);
      S().sessions.forEach((x) => { x.date = MR.Store.addDays(x.date, -1); }); MR.Engine.rollover(S()); done('um dia se passou'); },
    'Semana de histórico': () => {
      const methods = Object.keys(MR.METHODS); const subj = ['Cardiologia', 'Farmacologia', 'Neuroanatomia', 'Pediatria', 'Infectologia'];
      for (let d = 1; d <= 21; d++) {
        if (Math.random() < 0.25) continue;
        const day = MR.Store.addDays(MR.Store.dayKey(), -d);
        for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k++) {
          const m = methods[Math.floor(Math.random() * 5)]; const min = [25, 50, 90][Math.floor(Math.random() * 3)]; const q = MR.isPractice(m) ? 20 + Math.floor(Math.random() * 40) : 0;
          S().sessions.push({ id: day + k, date: day, startedAt: MR.Store.parseDay(day).getTime() + (9 + k * 2) * 3600000, minutes: min, subject: subj[Math.floor(Math.random() * 5)], method: m, mode: 'countdown', goal: min, goalMet: true, pauses: 0, maxContMin: min, damage: min * 30, xp: min * 2, crits: 1, strikes: min / 5, bosses: [], kills: 0, questions: q, correct: Math.round(q * (0.5 + Math.random() * 0.4)), reviewedErrors: false });
        }
      }
      S().sessions.sort((a, b) => (b.date + b.id > a.date + a.id ? 1 : -1)); done('histórico gerado');
    },
  };
  function warp(min) {
    const a = S().active; if (!a) return done('sem sessão ativa');
    // Estica o último segmento para trás: soma tempo líquido sem mexer nos anteriores.
    a.segments[a.segments.length - 1].start -= min * MIN;
    a.startedAt -= min * MIN;
    a.beat = Date.now(); done(`+${min} min`);
  }

  addEventListener('DOMContentLoaded', () => {
    const p = document.createElement('div');
    p.className = 'dev-panel';
    p.innerHTML = '<b>🛠 Painel de testes (?dev)</b>' + Object.keys(tools).map((k) => `<button data-dev="${k}">${k}</button>`).join('');
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-dev]'); if (b) tools[b.dataset.dev](); });
    document.body.appendChild(p);
  });
})(window.MR = window.MR || {});

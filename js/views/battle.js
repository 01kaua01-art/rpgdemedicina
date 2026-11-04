/* =========================================================================
 * Tela: Batalha — boss atual, preparação da sessão, contratos e o dia.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi, ui } = MR;
  const U = MR.UI, E = MR.Engine;

  function bossCard(s) {
    const b = s.boss;
    const r = MR.RARITIES[b.rarity];
    const pctHp = b.hp / b.maxHp;
    const method = U.draft.method || s.settings.lastMethod;
    const est = E.estimate(s, { method, mode: 'stopwatch' });
    const hoursLeft = b.hp / Math.max(1, est.perHour);
    const age = MR.Store.daysBetween(b.spawnDate, MR.Store.dayKey());
    const proud = b.traits.includes('proud') ? (age <= 3 ? ` · <b style="color:var(--gold)">Orgulhoso: ${3 - age} dia(s) para o saque extra</b>` : ' · Orgulhoso: prazo expirado') : '';
    return `
    <section class="card boss-card" style="${U.rc(b.rarity)}">
      <div class="boss-inner">
        <div>
          <div class="boss-meta">
            <span class="chip rar">${gi('crowned-skull')} ${r.name}</span>
            <span class="chip">Nível ${b.level}</span>
            <span class="chip">${gi('swords-emblem')} ${U.fmt(s.stats.bossesDefeated)} derrotados</span>
          </div>
          <div class="boss-epithet">${MR.BOSS_EPITHETS[b.rarity]}</div>
          <h1 class="boss-name">${U.esc(b.name)}</h1>
          <div class="traits">${b.traits.map((t) => `<span class="trait" data-tip="${U.esc(MR.TRAITS[t].desc)}">${gi(MR.TRAITS[t].icon)} ${MR.TRAITS[t].name}</span>`).join('')}</div>
          <div class="hp">
            <div class="hp-meta"><span>${gi('heart-beats')} Vitalidade do Guardião</span><span><b>${U.fmt(b.hp)}</b> / ${U.fmt(b.maxHp)} · ${U.pct(pctHp)}</span></div>
            <div class="hp-bar big"><div class="ghost" style="width:${pctHp * 100}%"></div><div class="fill" style="width:${pctHp * 100}%"></div></div>
          </div>
          <div class="boss-foot">
            <span>${ui('hourglass')} ≈ <b>${U.fmtMin(hoursLeft * 60)}</b> de ${MR.METHODS[method].short} para derrotá-lo</span>
            <span>${ui('calendar-days')} Surgiu ${age === 0 ? 'hoje' : age === 1 ? 'ontem' : `há ${age} dias`}${proud}</span>
          </div>
        </div>
        <div class="boss-figure"><div class="aura"></div><div class="rune"></div><div class="boss-sprite" id="boss-sprite">${gi(b.icon)}</div></div>
      </div>
    </section>`;
  }

  function launcher(s) {
    const d = U.draft;
    const method = d.method || s.settings.lastMethod;
    const mode = d.mode || s.settings.lastMode;
    const goal = d.goal || s.settings.lastGoal;
    const est = E.estimate(s, { method, mode, goal });
    const maxDph = 2500;
    const subjects = [...new Set(s.sessions.map((x) => x.subject).filter((x) => x && x !== 'Estudo Geral'))].slice(0, 30);
    const presets = [25, 50, 90];
    return `
    <section class="card launcher">
      <h2 class="card-title">${gi('crossed-swords')} Preparar Batalha <span class="aside">Cada 5 min de estudo líquido = 1 golpe no boss</span></h2>
      <div class="field">
        <label for="in-subject">O que você vai estudar?</label>
        <input id="in-subject" class="input" list="subjects" maxlength="60" placeholder="Ex.: Cardiologia — ECG, Farmacologia, Anatomia do plexo braquial…" value="${U.esc(d.subject)}" data-input="subject">
        <datalist id="subjects">${subjects.map((x) => `<option value="${U.esc(x)}">`).join('')}</datalist>
      </div>
      <div class="field">
        <label>Método de estudo — define o poder do golpe</label>
        <div class="methods">
          ${Object.entries(MR.METHODS).map(([k, m]) => `
            <button class="method ${k === method ? 'on' : ''}" style="${U.mc(k)}" data-act="pick-method" data-method="${k}" data-tip="${U.esc(m.tip)}">
              <span class="eff">${[500, 1000, 1500, 2000, 2500].map((v) => `<i class="${m.dph >= v ? 'on' : ''}"></i>`).join('')}</span>
              ${gi(m.icon)}
              <span class="m-name">${m.short}</span>
              <span class="m-rate"><b>${U.fmt(m.dph)}</b> dano/h<br><i>${m.xph}</i> XP/h</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="launch-row">
        <div class="field" style="flex:0 0 auto">
          <label>Relógio</label>
          <div class="seg">
            <button class="${mode === 'countdown' ? 'on' : ''}" data-act="pick-mode" data-mode="countdown">${ui('hourglass')} Meta Fixa</button>
            <button class="${mode === 'stopwatch' ? 'on' : ''}" data-act="pick-mode" data-mode="stopwatch">${ui('timer')} Livre</button>
          </div>
        </div>
        <div class="field" style="${mode === 'stopwatch' ? 'opacity:.35;pointer-events:none' : ''}">
          <label>Duração da meta</label>
          <div class="goal-row">
            <div class="seg">${presets.map((p) => `<button class="${goal === p ? 'on' : ''}" data-act="pick-goal" data-goal="${p}">${p} min${p === 90 ? ' · Raid' : ''}</button>`).join('')}</div>
            <input class="input" type="number" min="5" max="240" step="5" value="${goal}" data-change="goal" aria-label="Minutos personalizados"> <span class="muted">min</span>
          </div>
        </div>
      </div>
      <div class="launch-cta">
        <div class="estimate">
          <div><span>Dano estimado${mode === 'stopwatch' ? ' / hora' : ''}</span><b style="color:#fca5a5">~${U.fmt(est.dmg)}</b></div>
          <div><span>XP estimado</span><b style="color:var(--mana)">~${U.fmt(est.xp)}</b></div>
          <div><span>Golpes</span><b>${Math.floor(est.minutes / 5)}</b></div>
          <div><span>Chance de crítico</span><b style="color:var(--gold)">${U.pct(est.critRate)}</b></div>
        </div>
        <button class="btn primary lg" data-act="battle-start">${gi('crossed-swords')} Iniciar Batalha</button>
      </div>
      <div class="tip-line">${gi('sands-of-time')} <span>Sem pausar, aos <b>25 min</b> você entra em <b>Fluxo I</b> (+15% de dano) e aos <b>50 min</b> em <b>Fluxo II</b> (+30% e um golpe crítico garantido).</span></div>
    </section>`;
  }

  function quests(s) {
    const q = s.quests;
    const day = E.daySummary(s, MR.Store.dayKey());
    return `
    <section class="card">
      <h2 class="card-title">${gi('scroll-quill')} Contratos do Dia <span class="aside">${q.done.length}/3 · renovam à meia-noite</span></h2>
      ${q.ids.map((id) => {
        const def = MR.QUESTS.find((x) => x.id === id);
        const done = q.done.includes(id);
        return `<div class="quest ${done ? 'done' : ''}">
          <div class="q-ic">${done ? ui('check') : gi(def.icon)}</div>
          <div><div class="q-name">${def.name}</div><div class="q-desc">${def.desc}</div></div>
          <div class="q-rew">+${MR.RULES.QUEST_XP} XP<br>+${MR.RULES.QUEST_ESSENCE} ${gi('crystal-shine')}</div>
        </div>`;
      }).join('')}
      <div class="tip-line" style="margin-top:12px">${gi('chest')} <span>Cumpra os 3 para ganhar <b>+${MR.RULES.QUEST_ALL_BONUS} Essência</b> bônus.${q.bonus ? ' <b style="color:var(--green)">Recebido!</b>' : ''}</span></div>
      ${day.totalMin ? '' : '<div class="tip-line" style="margin-top:6px">' + ui('info') + ' <span>Os contratos são verificados ao concluir cada sessão.</span></div>'}
    </section>`;
  }

  function streakCard(s) {
    const n = E.streakNow(s);
    const combo = E.comboMult(s);
    const studiedToday = s.streak.lastDay === MR.Store.dayKey();
    return `
    <section class="card">
      <h2 class="card-title">${gi('flame')} Combo de Foco</h2>
      <div class="streak-box">
        <div class="streak-flame ${n ? '' : 'off'}">${gi('flame')}</div>
        <div style="flex:1">
          <div class="streak-num">${n} <span class="muted" style="font-size:14px;font-weight:500">dia${n === 1 ? '' : 's'} seguidos</span></div>
          <div class="muted" style="font-size:13px">Multiplicador de dano <b style="color:var(--flame)">x${combo.toFixed(2)}</b> · recorde ${s.streak.best}</div>
          <div class="streak-dots">${Array.from({ length: 7 }, (_, i) => `<i class="${i < Math.min(7, n) ? 'on' : ''}"></i>`).join('')}</div>
        </div>
      </div>
      <div class="tip-line" style="margin-top:12px">${studiedToday ? ui('check') + ' <span>Sequência garantida hoje.</span>' : gi('sands-of-time') + ' <span>Estude hoje para ' + (n ? 'manter' : 'iniciar') + ' a sequência.</span>'}
        <span style="margin-left:auto;color:#7dd3fc" data-tip="Proteções de sequência: salvam um dia perdido. Ganhe 1 a cada 7 dias seguidos (máx. 2).">❄ ${s.streak.freezes}/${MR.RULES.FREEZE_MAX}</span></div>
    </section>`;
  }

  function today(s) {
    const d = E.daySummary(s, MR.Store.dayKey());
    const recent = s.sessions.slice(0, 5);
    return `
    <section class="card">
      <h2 class="card-title">${gi('sands-of-time')} Hoje</h2>
      <div class="mini-stats">
        <div class="mini"><span>Tempo líquido</span><b>${U.fmtMin(d.totalMin)}</b></div>
        <div class="mini"><span>Dano</span><b style="color:#fca5a5">${U.fmtShort(d.damage)}</b></div>
        <div class="mini"><span>XP</span><b style="color:var(--mana)">${U.fmt(d.xp)}</b></div>
        <div class="mini"><span>Sessões</span><b>${d.sessions}</b></div>
      </div>
      <h3 class="card-title" style="margin-top:18px">${gi('scroll-unfurled')} Últimas batalhas</h3>
      ${recent.length ? recent.map(sessionRow).join('') : `<div class="empty">${gi('crossed-swords')}Nenhuma batalha ainda.<br>Sua jornada começa com o primeiro golpe.</div>`}
    </section>`;
  }

  function sessionRow(x) {
    const m = MR.METHODS[x.method] || MR.METHODS.questions;
    return `<div class="session-row" style="${U.mc(x.method)}">
      <div class="s-ic">${gi(m.icon)}</div>
      <div style="min-width:0"><div class="s-title">${U.esc(x.subject)}</div>
        <div class="s-sub">${U.fmtDate(x.date)} · ${m.short} · ${U.fmtMin(x.minutes)}${x.kills ? ` · <span style="color:var(--r-epic)">${x.kills} boss${x.kills > 1 ? 'es' : ''}</span>` : ''}</div></div>
      <div class="s-val" style="color:#fca5a5">${U.fmtShort(x.damage)}<small>+${U.fmt(x.xp)} XP</small></div>
    </div>`;
  }

  MR.Views.battle = {
    title: 'Batalha', icon: 'crossed-swords',
    render(s) {
      return `<div class="battle-layout">
        <div class="battle-main">${bossCard(s)}${launcher(s)}</div>
        <div class="battle-side">${quests(s)}${streakCard(s)}${today(s)}</div>
      </div>`;
    },
    after(root) {
      root.querySelectorAll('[data-input="subject"]').forEach((el) => el.addEventListener('input', () => { U.draft.subject = el.value; }));
      root.querySelectorAll('[data-change="goal"]').forEach((el) => el.addEventListener('change', () => {
        const v = E.clamp(Math.round(Number(el.value) / 5) * 5 || 50, 5, 240);
        U.draft.goal = v; const s = MR.Store.get(); s.settings.lastGoal = v; MR.Store.save();
      }));
    },
  };
  MR.sessionRow = sessionRow;

  U.on('pick-method', (el) => { const s = MR.Store.get(); U.draft.method = el.dataset.method; s.settings.lastMethod = el.dataset.method; MR.Audio.play('click'); MR.Store.save(); });
  U.on('pick-mode', (el) => { const s = MR.Store.get(); U.draft.mode = el.dataset.mode; s.settings.lastMode = el.dataset.mode; MR.Audio.play('click'); MR.Store.save(); });
  U.on('pick-goal', (el) => { const s = MR.Store.get(); U.draft.goal = Number(el.dataset.goal); s.settings.lastGoal = U.draft.goal; MR.Audio.play('click'); MR.Store.save(); });
  U.on('battle-start', () => {
    const s = MR.Store.get();
    if (s.active) { MR.Focus.open(); return; }
    E.startSession(s, {
      subject: U.draft.subject, method: U.draft.method || s.settings.lastMethod,
      mode: U.draft.mode || s.settings.lastMode, goal: U.draft.goal || s.settings.lastGoal,
    });
    MR.Audio.play('start');
    MR.Store.save();
    MR.Focus.open();
  });
})(window.MR = window.MR || {});

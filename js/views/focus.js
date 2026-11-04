/* =========================================================================
 * Focus — a tela de batalha em tela cheia, com o relógio e os golpes ao vivo.
 * A sessão vive no estado (s.active) e sobrevive a recarregar a página.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi, ui } = MR;
  const U = MR.UI, E = MR.Engine;
  const R_OUT = 140, R_IN = 124;
  const C_OUT = 2 * Math.PI * R_OUT, C_IN = 2 * Math.PI * R_IN;

  let timer = null, lastPersist = 0, renderedTarget = null, finishing = false, wakeLock = null, notified = false;
  const el = () => document.getElementById('focus');
  const $ = (sel) => el().querySelector(sel);

  function skeleton(s) {
    const a = s.active;
    const t = a.chain[a.chain.length - 1];
    const rank = E.rankFor(s.player.level);
    const m = MR.METHODS[a.method];
    renderedTarget = t.name + ':' + a.chain.length;
    el().style.setProperty('--rc', MR.RARITIES[t.rarity].color);
    el().innerHTML = `
    <div class="focus-wrap">
      <div class="focus-top">
        <div class="subject">${U.esc(a.subject || 'Estudo Livre')}</div>
        <span class="chip" style="${U.mc(a.method)};color:var(--mc)">${gi(m.icon)} ${m.short}</span>
        <span class="chip">${a.mode === 'countdown' ? ui('hourglass') + ' Meta ' + a.goal + ' min' : ui('timer') + ' Modo Livre'}</span>
        <button class="btn ghost sm" data-act="focus-minimize" data-tip="Voltar ao grimório sem parar o relógio">${ui('minus')} Minimizar</button>
      </div>

      <div class="arena">
        <div class="actor hero" style="--rank:${rank.color}">
          <div class="sprite" id="f-hero">${gi(rank.icon)}</div>
          <div class="tag">${U.esc(s.player.name)}<b>${rank.title}</b></div>
        </div>
        <div class="clock-wrap">
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <defs><linearGradient id="clockGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d98b"/><stop offset="1" stop-color="#b88c33"/></linearGradient></defs>
            <circle class="track" cx="150" cy="150" r="${R_OUT}"/>
            <circle class="prog" id="f-ring" cx="150" cy="150" r="${R_OUT}" stroke-dasharray="${C_OUT}" stroke-dashoffset="${C_OUT}"/>
            <circle class="strike" id="f-ring2" cx="150" cy="150" r="${R_IN}" stroke-dasharray="${C_IN}" stroke-dashoffset="${C_IN}"/>
          </svg>
          <div class="clock">
            <div class="time" id="f-time">00:00</div>
            <div class="label" id="f-label">${a.mode === 'countdown' ? 'restantes' : 'tempo líquido'}</div>
            <div class="next" id="f-next"></div>
          </div>
        </div>
        <div class="actor foe">
          <div class="sprite" id="f-foe">${gi(t.icon)}</div>
          <div class="tag">${MR.RARITIES[t.rarity].name} · Nv. ${t.level}<b>${U.esc(t.name)}</b></div>
        </div>
      </div>

      <div class="focus-hp">
        <div class="hp-meta"><span id="f-hp-label">${gi('heart-beats')} Vitalidade de ${U.esc(t.name)}</span><span><b id="f-hp">0</b> / ${U.fmt(t.maxHp)}</span></div>
        <div class="hp-bar big"><div class="ghost" id="f-ghost"></div><div class="fill" id="f-fill"></div></div>
      </div>
      <div id="f-kill"></div>

      <div class="focus-chips">
        <div class="stat-chip flow-chip" id="f-flow"><span>Fluxo</span><b id="f-flow-v">—</b><div class="bar"><i id="f-flow-bar"></i></div></div>
        <div class="stat-chip"><span>Dano causado</span><b id="f-dmg" style="color:#fca5a5">0</b></div>
        <div class="stat-chip"><span>Golpes</span><b id="f-strikes">0</b></div>
        <div class="stat-chip"><span>Crítico</span><b id="f-crit" style="color:var(--gold)">0%</b></div>
        <div class="stat-chip"><span>Pausas</span><b id="f-pauses">0</b></div>
      </div>

      <div class="focus-actions">
        <button class="btn lg" id="f-pause" data-act="focus-pause"></button>
        <button class="btn primary lg" data-act="focus-finish">${ui('flag')} Encerrar sessão</button>
        <button class="btn danger lg" data-act="focus-abandon">${ui('x')} Desistir</button>
      </div>
      <div class="muted" style="text-align:center;font-size:12px"><span class="kbd">Espaço</span> pausa/retoma · o progresso é salvo mesmo se você fechar a aba</div>

      <div class="strike-log" id="f-log"></div>
    </div>`;
    renderLog(a);
  }

  function renderLog(a) {
    const log = $('#f-log'); if (!log) return;
    const items = a.strikes.slice(-6).reverse();
    log.innerHTML = items.map((x) => {
      const label = x.label || (x.kind === 'flow' ? 'Golpe de Fluxo' : x.crit ? 'Golpe Crítico' : 'Golpe');
      return `<div class="s ${x.crit ? 'crit' : ''} ${x.kills.length ? 'kill' : ''}">
        <span>${x.crit ? gi('sparkles') : gi('crossed-swords')} <span class="muted">min ${Math.round(x.at)}</span> · ${label}${x.kills.length ? ` · <b style="color:#e9d5ff">${x.kills.map(U.esc).join(', ')} caiu!</b>` : ''}</span>
        <b>-${U.fmt(x.dmg)}</b></div>`;
    }).join('') || '<div class="muted" style="text-align:center;font-size:13px">O primeiro golpe acontece após 5 minutos de foco.</div>';
  }

  function update(s, now) {
    const a = s.active;
    const v = E.sessionView(s, now);
    const t = v.target;
    if (renderedTarget !== t.name + ':' + a.chain.length) skeleton(s);

    el().classList.toggle('paused', v.paused);
    const timeSec = a.mode === 'countdown' ? v.remainingSec : v.liquidMin * 60;
    $('#f-time').textContent = U.fmtClock(timeSec);
    $('#f-label').textContent = v.paused ? 'pausado' : a.mode === 'countdown' ? 'restantes' : 'tempo líquido';
    const prog = a.mode === 'countdown' ? Math.min(1, v.liquidMin / a.goal) : (v.liquidMin % 60) / 60;
    $('#f-ring').setAttribute('stroke-dashoffset', C_OUT * (1 - prog));
    const strikeProg = 1 - v.nextStrikeSec / (MR.RULES.STRIKE_EVERY_MIN * 60);
    $('#f-ring2').setAttribute('stroke-dashoffset', C_IN * (1 - Math.max(0, Math.min(1, strikeProg))));
    $('#f-next').innerHTML = v.done ? 'meta cumprida!' : `próximo golpe em ${U.fmtClock(v.nextStrikeSec)}`;

    const hpPct = Math.max(0, t.hp / t.maxHp) * 100;
    $('#f-hp').textContent = U.fmt(t.hp);
    $('#f-fill').style.width = hpPct + '%';
    $('#f-ghost').style.width = hpPct + '%';
    $('#f-dmg').textContent = U.fmt(v.dmg);
    $('#f-strikes').textContent = a.strikes.length;
    $('#f-crit').textContent = U.pct(v.critChance);
    $('#f-pauses').textContent = a.pauses;
    $('#f-kill').innerHTML = v.kills ? `<div class="focus-kill-banner">${gi('skull-crossed-bones')} ${v.kills} boss${v.kills > 1 ? 'es' : ''} derrotado${v.kills > 1 ? 's' : ''} nesta batalha! O saque será revelado ao encerrar a sessão.</div>` : '';

    const flow = $('#f-flow');
    flow.className = 'stat-chip flow-chip ' + (v.flow === 2 ? 't2' : v.flow === 1 ? 't1' : '');
    $('#f-flow-v').textContent = v.paused ? 'Pausado' : v.flow === 2 ? 'II · +30%' : v.flow === 1 ? 'I · +15%' : `${Math.floor(v.contMin)}/${MR.RULES.FLOW_T1} min`;
    const nextT = v.flow === 0 ? MR.RULES.FLOW_T1 : MR.RULES.FLOW_T2;
    $('#f-flow-bar').style.width = (v.flow === 2 ? 100 : Math.min(100, (v.contMin / nextT) * 100)) + '%';
    $('#f-pause').innerHTML = v.paused ? `${ui('play')} Retomar` : `${ui('pause')} Pausar`;

    document.title = `${v.paused ? '⏸' : '⚔'} ${U.fmtClock(timeSec)} · ${t.name} — MedRPG`;
    return v;
  }

  function animateStrike(st) {
    const hero = $('#f-hero'), foe = $('#f-foe');
    MR.FX.anim(hero, 'lunge');
    setTimeout(() => {
      MR.FX.anim(foe, 'hit');
      MR.FX.floatText(foe, `-${U.fmt(st.dmg)}${st.crit ? '<small>CRÍTICO</small>' : ''}`, st.crit ? 'crit' : '');
      MR.FX.burstAt(foe, st.crit ? '#fbbf24' : '#ef4455', st.crit ? 70 : 30, st.crit ? 9 : 5);
      MR.Audio.play(st.crit ? 'crit' : 'hit');
      if (st.crit) MR.FX.anim(el().querySelector('.focus-wrap'), 'shake');
      if (st.kills.length) {
        setTimeout(() => {
          MR.Audio.play('kill');
          MR.FX.burstAt(foe, '#c084fc', 140, 12);
          U.toast(`<b>${st.kills.map(U.esc).join(', ')}</b> foi derrotado! Um novo Guardião surge…`, { icon: 'skull-crossed-bones', color: 'var(--r-epic)' });
        }, 350);
      }
    }, 160);
  }

  function loop() {
    const s = MR.Store.get();
    if (!s.active) { Focus.close(true); return; }
    if (finishing) return;
    const now = Date.now();
    const fresh = E.tick(s, now);
    const v = update(s, now);
    if (fresh.length) {
      renderLog(s.active);
      if (Focus.isOpen()) animateStrike(fresh[fresh.length - 1]);
      MR.Store.persistQuiet(); lastPersist = now;
    } else if (now - lastPersist > 15000) { MR.Store.persistQuiet(); lastPersist = now; }
    if (v.done) autoFinish();
  }

  async function autoFinish() {
    if (finishing) return;
    MR.Audio.play('complete');
    if (document.hidden && !notified) {
      notified = true;
      const s = MR.Store.get();
      if (s.settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification('Meta cumprida! ⚔', { body: 'Sua sessão terminou. Volte para registrar a vitória.', icon: 'assets/icon.svg' }); } catch (e) { /* ignora */ }
      }
    }
    Focus.open();
    await finishFlow(true);
  }

  async function finishFlow(goalReached) {
    const s = MR.Store.get();
    if (!s.active || finishing) return;
    finishing = true;
    try {
      const v = E.sessionView(s, Date.now());
      if (v.liquidMin < 1) {
        const ok = await U.confirm({ title: 'Sessão curta demais', text: 'Menos de 1 minuto líquido não conta como batalha. Deseja descartá-la?', ok: 'Descartar', danger: true });
        if (ok) { E.abandon(s); MR.Store.save(); Focus.close(true); }
        return;
      }
      if (!goalReached && s.active.mode === 'countdown' && !v.done) {
        const ok = await U.confirm({ title: 'Encerrar antes da meta?', icon: 'flag',
          text: `Você mantém todo o dano e XP de <b>${U.fmtMin(v.liquidMin)}</b>, mas perde o <b>Golpe de Conclusão</b> (+10% do dano).`, ok: 'Encerrar mesmo assim' });
        if (!ok) return;
      }
      // O relógio "congela" no clique: o tempo gasto preenchendo o relatório não conta.
      const endAt = Date.now();
      const report = await MR.Results.askReport(s.active, E.sessionView(s, endAt));
      if (!report) return; // voltou para a batalha; o loop retoma normalmente
      const res = E.finishSession(s, report, endAt);
      MR.Store.save();
      Focus.close(true);
      if (res && !res.discarded) MR.Results.show(res);
    } finally { finishing = false; }
  }

  async function requestWake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* sem suporte */ }
  }

  const Focus = {
    isOpen: () => el().classList.contains('open'),
    open() {
      const s = MR.Store.get();
      if (!s.active) return;
      notified = false;
      skeleton(s);
      el().classList.add('open'); el().setAttribute('aria-hidden', 'false');
      update(s, Date.now());
      Focus.ensureLoop();
      requestWake();
      MR.FX.setTint(MR.RARITIES[s.active.chain[s.active.chain.length - 1].rarity].color);
    },
    /** Mantém o relógio rodando mesmo com a tela minimizada. */
    ensureLoop() { if (!timer) timer = setInterval(loop, 250); },
    close(stopLoop) {
      el().classList.remove('open'); el().setAttribute('aria-hidden', 'true');
      if (stopLoop || !MR.Store.get().active) {
        clearInterval(timer); timer = null; document.title = 'MedRPG · Grimório Clínico';
        if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
      }
      U.render();
    },
    togglePause() {
      const s = MR.Store.get(); if (!s.active || finishing) return;
      const now = Date.now();
      if (E.sessionView(s, now).paused) { E.resume(s, now); MR.Audio.play('resume'); }
      else { E.pause(s, now); MR.Audio.play('pause'); }
      MR.Store.persistQuiet();
      update(s, now);
    },
    finish: () => finishFlow(false),
    tick: loop,
  };

  U.on('focus-open', () => Focus.open());
  U.on('focus-minimize', () => { Focus.close(false); U.toast('A batalha continua em segundo plano. Use <b>Voltar à batalha</b> na barra lateral.', { icon: 'hourglass', uiIcon: true }); });
  U.on('focus-pause', () => Focus.togglePause());
  U.on('focus-finish', () => Focus.finish());
  U.on('focus-abandon', async () => {
    const s = MR.Store.get();
    const v = E.sessionView(s, Date.now());
    const ok = await U.confirm({ title: 'Desistir da batalha?', danger: true, ok: 'Desistir',
      text: `Os <b>${U.fmtMin(v.liquidMin)}</b> desta sessão e os <b>${U.fmt(v.dmg)}</b> de dano serão perdidos. O boss não sofrerá nada.` });
    if (!ok) return;
    E.abandon(s); MR.Store.save(); Focus.close(true);
    U.toast('Você recuou. O Esquecimento agradece…', { icon: 'skull-crossed-bones', color: 'var(--crimson)' });
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !Focus.isOpen() || U.topModal()) return;
    if (/input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) return;
    e.preventDefault(); Focus.togglePause();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && MR.Store.get() && MR.Store.get().active) { loop(); if (Focus.isOpen()) requestWake(); }
  });

  MR.Focus = Focus;
})(window.MR = window.MR || {});

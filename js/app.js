/* =========================================================================
 * App — inicialização: carrega o save, processa os dias passados, retoma
 * batalhas em andamento e liga os ouvintes globais.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi } = MR;
  const U = MR.UI, E = MR.Engine, St = MR.Store;

  function announce(events) {
    for (const ev of events) {
      if (ev.type === 'regen') U.toast(`<b>${U.esc(ev.boss)}</b> é Insaciável e regenerou <b>${U.fmt(ev.amount)} HP</b> nos dias sem estudo.`, { icon: 'drop', color: 'var(--crimson)', ms: 7000 });
      if (ev.type === 'freeze') U.toast(`❄ Uma proteção salvou sua sequência no dia ${U.fmtDate(ev.day)}.`, { icon: 'checked-shield', color: '#7dd3fc', ms: 7000 });
      if (ev.type === 'streak_lost') U.toast(`Sua sequência de <b>${ev.count} dia(s)</b> foi quebrada. Recomece hoje!`, { icon: 'flame', color: 'var(--flame)', ms: 7000 });
    }
  }

  function dailyCheck() {
    const s = St.get();
    if (s.lastRollover !== St.dayKey() || !s.quests || s.quests.day !== St.dayKey()) {
      const ev = E.rollover(s); St.save(); announce(ev);
    }
  }

  function onboarding() {
    const s = St.get();
    if (s.onboarded) return;
    const m = U.modal(`
      <div style="text-align:center">
        <div style="font-size:72px;color:var(--gold);filter:drop-shadow(0 0 20px rgba(226,184,87,.4))">${gi('caduceus')}</div>
        <h2 style="font-size:26px">Bem-vindo ao Grimório Clínico</h2>
        <p class="sub">O <b>Esquecimento</b> ganhou forma. Seu único poder contra ele é o tempo de estudo de verdade.</p>
      </div>
      <div class="effects-list" style="margin:14px 0">
        <div class="effect" style="--rc:var(--crimson)">${gi('crossed-swords')}<div><b>Estude para atacar.</b> A cada 5 min de foco você desfere um golpe no Guardião. Questões e simulados batem mais forte que a leitura passiva.</div></div>
        <div class="effect" style="--rc:var(--teal)">${gi('sands-of-time')}<div><b>Não pare.</b> Blocos contínuos ativam o <b>Fluxo</b> e dias seguidos aumentam o <b>Combo de Foco</b>.</div></div>
        <div class="effect" style="--rc:var(--gold)">${gi('chest')}<div><b>Colete e evolua.</b> Bosses derrotados deixam equipamentos com efeitos reais nas suas sessões.</div></div>
      </div>
      <div class="field"><label for="ob-name">Como devemos chamar você?</label><input id="ob-name" class="input" maxlength="24" placeholder="Seu nome de herói" value=""></div>
      <div class="modal-actions"><button class="btn primary lg block" id="ob-go">${gi('crossed-swords')} Começar a jornada</button></div>`, { dismissable: false });
    const go = () => {
      const v = m.el.querySelector('#ob-name').value.trim();
      if (v) s.player.name = v;
      s.onboarded = true; St.save(); m.close(true);
      MR.Audio.unlock(); MR.Audio.play('start');
    };
    m.el.querySelector('#ob-go').addEventListener('click', go);
    m.el.querySelector('#ob-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  function boot() {
    const s = St.load();
    E.ensureBoss(s);
    const events = E.rollover(s);
    const stale = s.active ? E.recoverStale(s) : false;
    const newTrophies = E.checkTrophies(s);
    St.save();
    document.body.classList.toggle('reduce-motion', !!s.settings.reducedMotion);

    MR.FX.init();
    St.subscribe(() => U.render());
    const hash = location.hash.replace('#', '');
    U.current = MR.Views[hash] ? hash : 'battle';
    U.render();

    if (s.migratedFrom && !s.migrationAnnounced) {
      s.migrationAnnounced = true; St.save();
      U.toast('Seu progresso do MedRPG antigo foi importado para a nova versão!', { icon: 'chest', ms: 8000 });
    }
    announce(events);
    for (const id of newTrophies) { const t = MR.TROPHIES.find((x) => x.id === id); U.toast(`Troféu conquistado: <b>${t.name}</b>`, { icon: t.icon }); }
    if (s.active) {
      MR.Focus.open();
      if (stale) U.toast('A batalha ficou sem registro enquanto o navegador esteve fechado e foi <b>pausada</b> no último momento salvo. Retome quando quiser.', { icon: 'pause', uiIcon: true, ms: 9000 });
    }
    onboarding();

    setInterval(dailyCheck, 60000);
    addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h !== U.current && MR.Views[h]) U.go(h); });
    addEventListener('pointerdown', () => MR.Audio.unlock(), { once: true });
    addEventListener('storage', (e) => {
      if (e.key !== St.KEY) return;
      // Outra aba alterou o save: recarrega para não sobrescrever o progresso dela.
      St.load(); U.closeAllModals(); U.render();
      if (St.get().active) MR.Focus.open(); else MR.Focus.close(true);
    });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  MR.App = { boot, onboarding };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.MR = window.MR || {});

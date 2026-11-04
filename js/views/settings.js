/* =========================================================================
 * Tela: Ajustes — preferências, dificuldade, backup e o guia "Como jogar".
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi, ui } = MR;
  const U = MR.UI, E = MR.Engine;

  const toggle = (key, on) => `<button class="toggle ${on ? 'on' : ''}" data-act="set-toggle" data-key="${key}" role="switch" aria-checked="${on}"></button>`;

  function guideHTML() {
    const R = MR.RULES;
    return `<div class="guide">
      <p>O <b>Esquecimento</b> assume a forma de Guardiões. A única arma que os fere é o seu <b>tempo de estudo de verdade</b>.</p>
      <h3>${gi('crossed-swords')} Batalhas e golpes</h3>
      <ul><li>Escolha a matéria, o método e o relógio (<b>Meta Fixa</b> ou <b>Livre</b>, até ${R.STOPWATCH_CAP_MIN / 60}h).</li>
        <li>A cada <b>${R.STRIKE_EVERY_MIN} minutos líquidos</b> você desfere um golpe. Pausas não contam tempo.</li>
        <li>O dano depende do método: leitura passiva é o golpe mais fraco; simulados e questões, os mais fortes.</li>
        <li>Cumprir a Meta Fixa dá o <b>Golpe de Conclusão</b> (+${R.COMPLETION_BONUS * 100}% do dano). Encerrar antes mantém o dano, mas sem esse bônus. <b>Desistir</b> descarta a sessão.</li>
        <li>Se o boss cair no meio da sessão, o dano que sobra passa para o próximo Guardião.</li>
        <li>Pode fechar a aba: o progresso é salvo. Se você ficar mais de 3 min fora com o navegador fechado, a sessão é pausada automaticamente no último momento registrado.</li></ul>
      <h3>${gi('sands-of-time')} Fluxo (foco contínuo)</h3>
      <ul><li><b>Fluxo I</b>: ${R.FLOW_T1} min sem pausar → +15% de dano.</li>
        <li><b>Fluxo II</b>: ${R.FLOW_T2} min sem pausar → +30% de dano, um <b>golpe crítico garantido</b> e +10% de XP.</li>
        <li>Pausar zera o Fluxo.</li></ul>
      <h3>${gi('flame')} Combo de Foco (sequência de dias)</h3>
      <ul><li>Cada dia seguido de estudo soma +5% de dano, até x1,35 com 7 dias.</li>
        <li>A cada 7 dias seguidos você ganha uma <b>❄ proteção</b> (máx. ${R.FREEZE_MAX}) que salva automaticamente um dia perdido.</li></ul>
      <h3>${gi('heart-beats')} Fadiga</h3>
      <ul><li>Depois de ${R.FATIGUE_START_MIN / 60}h de estudo no mesmo dia, o dano cai ${R.FATIGUE_PER_HOUR * 100}% por hora extra (mínimo ${R.FATIGUE_FLOOR * 100}%).</li>
        <li><b>Resistência</b> e algumas armaduras/relíquias reduzem ou anulam a fadiga. Descanso também é estratégia.</li></ul>
      <h3>${gi('archery-target')} Relatório e precisão</h3>
      <ul><li>Em Questões e Simulados, informe quantas questões fez e acertou. Com 10+ questões e mais de 50% de acerto você ganha o <b>Golpe de Precisão</b> e XP extra.</li>
        <li>Marcar "revisei meus erros" ativa itens como o Códex do Diagnóstico e a Lupa do Investigador.</li></ul>
      <h3>${gi('crowned-skull')} Traços dos Guardiões</h3>
      <ul>${Object.values(MR.TRAITS).map((t) => `<li><b>${t.name}</b>: ${t.desc}</li>`).join('')}</ul>
      <h3>${gi('chest')} Saque, Essência e refino</h3>
      <ul><li>Todo boss derrotado deixa um item. <b>Fortuna</b> e a raridade do boss melhoram as chances.</li>
        <li>Itens repetidos viram <b>Essência Arcana</b>. Contratos diários também dão Essência.</li>
        <li>Use Essência para <b>refinar</b> itens (+20% de atributos por nível, até +${R.REFINE_MAX}) ou redistribuir seus pontos.</li></ul>
      <h3>${gi('scroll-quill')} Contratos diários</h3>
      <ul><li>Três objetivos por dia, baseados em boas práticas de estudo: blocos profundos, prática de recuperação, intercalação…</li></ul>
    </div>`;
  }

  MR.Views.settings = {
    title: 'Ajustes', icon: 'settings', uiIcon: true,
    render(s) {
      const st = s.settings;
      return `
        <div class="page-head"><div><h1>Ajustes</h1><p>Preferências, dificuldade e backup do seu progresso.</p></div>
          <button class="btn" data-act="guide">${gi('open-book')} Como jogar</button></div>
        <div class="hero-layout">
          <section class="card">
            <h2 class="card-title">${ui('settings')} Preferências</h2>
            <div class="set-row"><div><b>Nome do herói</b><span>${U.esc(s.player.name)}</span></div><button class="btn sm" data-act="rename">Alterar</button></div>
            <div class="set-row"><div><b>Efeitos sonoros</b><span>Golpes, saques e alertas sintetizados.</span></div>${toggle('sound', st.sound)}</div>
            <div class="set-row"><div><b>Volume</b><span>${Math.round(st.volume * 100)}%</span></div><input type="range" min="0" max="1" step="0.05" value="${st.volume}" data-input="volume" style="width:160px;accent-color:var(--gold)"></div>
            <div class="set-row"><div><b>Trilha ambiente</b><span>Drone suave e sinos esparsos para foco.</span></div>${toggle('music', st.music)}</div>
            <div class="set-row"><div><b>Notificação no fim da meta</b><span>Avisa quando a sessão termina com a aba em segundo plano.</span></div>${toggle('notifications', st.notifications)}</div>
            <div class="set-row"><div><b>Reduzir animações</b><span>Desliga partículas, tremores e animações.</span></div>${toggle('reducedMotion', st.reducedMotion)}</div>
          </section>
          <div class="grid">
            <section class="card">
              <h2 class="card-title">${gi('crowned-skull')} Vitalidade dos Guardiões</h2>
              <p class="muted" style="font-size:13px;margin-top:0">Vale a partir do <b>próximo</b> boss — o atual não é alterado.</p>
              <div class="filters">${Object.entries(MR.DIFFICULTY).map(([hp, d]) => `<button class="chip ${Number(hp) === s.difficulty ? 'on' : ''}" data-act="set-diff" data-v="${hp}" data-tip="${d.desc}">${d.name} · ${U.fmtShort(Number(hp))} HP</button>`).join('')}</div>
            </section>
            <section class="card">
              <h2 class="card-title">${ui('download')} Backup</h2>
              <p class="muted" style="font-size:13px;margin-top:0">Seu progresso fica salvo neste navegador. Exporte para não perder ou levar para outro dispositivo. Saves do MedRPG antigo também podem ser importados.</p>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn" data-act="export">${ui('download')} Exportar save</button>
                <label class="btn">${ui('upload')} Importar save<input type="file" accept=".json,application/json" data-change="import" hidden></label>
                <button class="btn danger" data-act="reset">${ui('trash-2')} Apagar progresso</button>
              </div>
            </section>
            <section class="card">
              <h2 class="card-title">${gi('caduceus')} Sobre</h2>
              <p class="muted" style="font-size:13px;margin:0">MedRPG · Grimório Clínico v3. Funciona offline e roda direto no navegador.<br>
              Ícones: <a href="https://game-icons.net" target="_blank" rel="noopener" style="color:var(--gold)">game-icons.net</a> (CC BY 3.0, Lorc, Delapouite e colaboradores) e <a href="https://lucide.dev" target="_blank" rel="noopener" style="color:var(--gold)">Lucide</a> (ISC).</p>
            </section>
          </div>
        </div>`;
    },
    after(root) {
      const vol = root.querySelector('[data-input="volume"]');
      if (vol) vol.addEventListener('change', () => { const s = MR.Store.get(); s.settings.volume = Number(vol.value); MR.Audio.setVolume(s.settings.volume); MR.Store.save(); MR.Audio.play('hit'); });
      const imp = root.querySelector('[data-change="import"]');
      if (imp) imp.addEventListener('change', async () => {
        const f = imp.files[0]; if (!f) return;
        const text = await f.text();
        const ok = await U.confirm({ title: 'Importar save?', text: 'O progresso atual deste navegador será <b>substituído</b> pelo do arquivo.', ok: 'Importar', danger: true });
        if (!ok) return;
        try { const s = MR.Store.importJSON(text); E.rollover(s); MR.Store.save(); U.toast('Save importado com sucesso!', { icon: 'check', uiIcon: true, color: 'var(--green)' }); }
        catch (e) { U.toast('Não foi possível importar: ' + U.esc(e.message), { icon: 'x', uiIcon: true, color: 'var(--crimson)' }); }
      });
    },
  };

  U.on('guide', () => U.modal(`<h2>${gi('open-book')} Como jogar</h2>${guideHTML()}<div class="modal-actions"><button class="btn primary" data-act="modal-close">Entendi</button></div>`, { wide: true }));
  U.on('set-toggle', async (el) => {
    const s = MR.Store.get(); const k = el.dataset.key;
    if (k === 'notifications' && !s.settings.notifications) {
      if (!('Notification' in window)) { U.toast('Este navegador não suporta notificações.', { icon: 'bell', uiIcon: true }); return; }
      const p = await Notification.requestPermission();
      if (p !== 'granted') { U.toast('Permissão de notificação negada.', { icon: 'bell', uiIcon: true, color: 'var(--crimson)' }); return; }
    }
    s.settings[k] = !s.settings[k];
    document.body.classList.toggle('reduce-motion', !!s.settings.reducedMotion);
    MR.Store.save();
    if (k === 'music') MR.Audio.syncMusic();
    MR.Audio.play('click');
  });
  U.on('set-diff', (el) => { const s = MR.Store.get(); s.difficulty = Number(el.dataset.v); MR.Store.save(); U.toast(`Próximos Guardiões: <b>${MR.DIFFICULTY[el.dataset.v].name}</b>.`, { icon: 'crowned-skull' }); });
  U.on('export', () => {
    const s = MR.Store.get();
    const blob = new Blob([MR.Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `medrpg_save_nv${s.player.level}_${MR.Store.dayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  U.on('reset', async () => {
    const ok = await U.confirm({ title: 'Apagar todo o progresso?', danger: true, ok: 'Apagar tudo', text: 'Nível, itens, histórico e conquistas serão apagados deste navegador. <b>Não há como desfazer.</b> Exporte um backup antes, se quiser.' });
    if (!ok) return;
    const s = MR.Store.reset(); E.rollover(s); MR.Store.save(); U.go('battle'); MR.App.onboarding();
  });
  MR.guideHTML = guideHTML;
})(window.MR = window.MR || {});

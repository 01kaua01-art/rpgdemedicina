/* =========================================================================
 * Results — relatório pós-batalha (perguntas) e tela de recompensas.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi, ui } = MR;
  const U = MR.UI;

  const PART_LABELS = {
    poder: 'Poder', precisao: 'Precisão', retencao: 'Retenção', foco: 'Foco (50+ min)', fluxo: 'Fluxo', sequencia: 'Combo de Foco',
    fadiga: 'Fadiga', itens: 'Equipamentos', implacavel: 'Implacável', intelecto: 'Intelecto', criticos: 'Críticos', meta: 'Meta cumprida',
    colossal: 'Colossal derrotado',
  };

  function askReport(a, view) {
    const s = MR.Store.get();
    const practice = MR.isPractice(a.method);
    const eqIds = Object.values(s.equipment);
    const hint = eqIds.includes('codex_diagnostico') ? 'Códex do Diagnóstico: revisar os erros DOBRA o XP desta sessão!'
      : eqIds.includes('lupa_investigador') ? 'Lupa do Investigador: +15% de XP ao revisar os erros.' : 'Revisar os erros é onde o aprendizado acontece.';
    const forced = view.done;
    return new Promise((resolve) => {
      let focus = 0, done = false;
      const m = U.modal(`
        <h2>${gi('scroll-quill')} Relatório de Batalha</h2>
        <p class="sub">${U.fmtMin(view.liquidMin)} de foco líquido · ${U.fmt(view.dmg)} de dano até agora. Tudo abaixo é opcional.</p>
        ${practice ? `
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
            <div class="field"><label>Questões feitas</label><input class="input" type="number" min="0" max="999" id="r-q" placeholder="0"></div>
            <div class="field"><label>Acertos</label><input class="input" type="number" min="0" max="999" id="r-c" placeholder="0"></div>
          </div>
          <p class="muted" style="font-size:12.5px;margin:8px 0 12px">${gi('archery-target')} Com 10+ questões e mais de 50% de acerto você desfere um <b>Golpe de Precisão</b> e ganha XP extra.</p>
          <label class="check"><input type="checkbox" id="r-rev"> Revisei e anotei meus erros</label>
          <p class="muted" style="font-size:12.5px;margin:6px 0 14px 28px">${U.esc(hint)}</p>` : ''}
        <div class="field" style="margin-top:6px"><label>Como foi seu foco?</label>
          <div class="stars" id="r-stars">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" aria-label="${i} estrela(s)">★</button>`).join('')}</div></div>
        <div class="field" style="margin-top:12px"><label>Nota rápida (o que ficou de dúvida?)</label>
          <textarea class="input" id="r-note" maxlength="280" placeholder="Ex.: revisar critérios de Duke, confundi Mobitz I e II…"></textarea></div>
        <div class="modal-actions">
          ${forced ? '' : `<button class="btn ghost" data-r="back">${ui('chevron-left')} Voltar à batalha</button>`}
          <button class="btn primary" data-r="ok">${gi('chest')} Concluir e coletar</button>
        </div>`, { dismissable: !forced, onClose: () => { if (!done) resolve(null); } });
      const root = m.el;
      root.querySelector('#r-stars').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        focus = Number(b.dataset.v);
        root.querySelectorAll('#r-stars button').forEach((x) => x.classList.toggle('on', Number(x.dataset.v) <= focus));
      });
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]'); if (!b) return;
        done = true;
        if (b.dataset.r === 'back') { m.close(true); resolve(null); return; }
        const q = Number((root.querySelector('#r-q') || {}).value || 0);
        const c = Number((root.querySelector('#r-c') || {}).value || 0);
        if (practice && c > q) { done = false; U.toast('Acertos não podem passar do total de questões.', { icon: 'x', uiIcon: true, color: 'var(--crimson)' }); return; }
        m.close(true);
        resolve({ questions: q, correct: c, reviewedErrors: !!(root.querySelector('#r-rev') || {}).checked, focus, note: root.querySelector('#r-note').value });
      });
    });
  }

  function partsList(parts) {
    return Object.entries(parts).filter(([, v]) => Math.abs(v - 1) > 0.001)
      .map(([k, v]) => `<div><span>${PART_LABELS[k] || k}</span><b style="color:${v >= 1 ? 'var(--green)' : '#fca5a5'}">x${v.toFixed(2)}</b></div>`).join('');
  }

  function show(res) {
    const s = MR.Store.get();
    const sess = res.session;
    const m = MR.METHODS[sess.method];
    const regular = res.strikes.filter((x) => ['tick', 'flow', 'final'].includes(x.kind));
    const sum = (arr) => arr.reduce((a, x) => a + x.dmg, 0);
    const bonus = (kind) => res.strikes.filter((x) => x.kind === kind);

    const loot = res.kills.flatMap((k) => k.loot.map((l) => ({ ...l, boss: k.boss.name, proud: k.proud })));
    const html = `
      <div class="result-hero">
        <div class="lbl">${res.kills.length ? 'Vitória!' : res.goalMet ? 'Meta cumprida' : 'Batalha encerrada'} · ${U.esc(sess.subject)}</div>
        <div class="big num">-${U.fmt(res.totalDmg)}</div>
        <div class="muted">${m.short} · ${U.fmtMin(sess.minutes)} líquidos · ${sess.strikes} golpe${sess.strikes === 1 ? '' : 's'} · ${res.crits} crítico${res.crits === 1 ? '' : 's'}</div>
      </div>
      <div class="result-cols">
        <div class="card" style="padding:16px">
          <h3 class="card-title">${gi('crossed-swords')} Dano</h3>
          <div class="breakdown">
            <div><span>Golpes (${regular.length})</span><b>${U.fmt(sum(regular))}</b></div>
            ${bonus('completion').length ? `<div><span>Golpe de Conclusão</span><b style="color:var(--gold)">+${U.fmt(sum(bonus('completion')))}</b></div>` : ''}
            ${bonus('precision').length ? `<div><span>Golpe de Precisão (${U.pct(sess.correct / sess.questions)})</span><b style="color:var(--gold)">+${U.fmt(sum(bonus('precision')))}</b></div>` : ''}
            <div><span>Maior golpe</span><b>${U.fmt(Math.max(...res.strikes.map((x) => x.dmg), 0))}</b></div>
            <div><span>Fluxo máximo</span><b>${sess.maxContMin} min contínuos</b></div>
          </div>
        </div>
        <div class="card" style="padding:16px">
          <h3 class="card-title">${gi('brain')} Experiência <span class="aside num" style="color:var(--mana);font-size:16px">+${U.fmt(res.xp + res.questXp)}</span></h3>
          <div class="breakdown">
            <div><span>Base (${m.xph} XP/h)</span><b>${U.fmt((sess.minutes / 60) * m.xph)}</b></div>
            ${partsList(res.xpParts)}
            ${res.questXp ? `<div><span>Contratos</span><b style="color:var(--gold)">+${res.questXp}</b></div>` : ''}
          </div>
        </div>
      </div>
      ${res.level.ups ? `<div class="banner" style="--bc:var(--gold)">${gi('laurel-crown')}<div><b>Subiu para o nível ${res.level.to}!</b><span>+${res.level.points} pontos de atributo para distribuir.${MR.Engine.rankFor(res.level.to).level > res.level.from ? ` Nova patente: <b style="color:var(--gold)">${MR.Engine.rankFor(res.level.to).title}</b>!` : ''}</span></div></div>` : ''}
      ${res.streak.up ? `<div class="banner" style="--bc:var(--flame)">${gi('flame')}<div><b>Sequência: ${res.streak.count} dia${res.streak.count > 1 ? 's' : ''}</b><span>Combo de Foco agora em x${MR.Engine.comboMult(s).toFixed(2)}.${res.streak.count % 7 === 0 ? ' Você ganhou uma ❄ proteção de sequência!' : ''}</span></div></div>` : ''}
      ${res.questsDone.map((id) => { const q = MR.QUESTS.find((x) => x.id === id); return `<div class="banner" style="--bc:var(--green)">${gi(q.icon)}<div><b>Contrato cumprido: ${q.name}</b><span>+${MR.RULES.QUEST_XP} XP · +${MR.RULES.QUEST_ESSENCE} Essência${res.questBonus ? ` · todos os contratos: +${MR.RULES.QUEST_ALL_BONUS} Essência bônus!` : ''}</span></div></div>`; }).join('')}
      ${res.trophies.map((id) => { const t = MR.TROPHIES.find((x) => x.id === id); return `<div class="banner" style="--bc:var(--gold)">${gi(t.icon)}<div><b>Troféu conquistado: ${t.name}</b><span>${t.desc}</span></div></div>`; }).join('')}
      ${res.kills.length ? `
        <h3 class="card-title" style="margin-top:20px">${gi('chest')} Saque — ${res.kills.map((k) => U.esc(k.boss.name)).join(', ')} <span class="aside">clique para revelar</span></h3>
        <div class="loot-grid">${loot.map((l, i) => {
          const it = MR.ITEMS_BY_ID[l.id];
          return `<div class="loot-card" style="${U.rc(it.rarity)}" data-loot="${i}">
            <div class="flip">
              <div class="face back-face">${gi('chest')}<span class="muted">${l.proud && i > 0 ? 'Saque extra (Orgulhoso)' : 'Toque para abrir'}</span></div>
              <div class="face front-face">${gi(it.icon)}<b>${U.esc(it.name)}</b><span class="chip rar">${MR.RARITIES[it.rarity].name} · ${MR.ITEM_TYPES[it.slot]}</span>
                ${l.duplicate ? `<span class="muted" style="font-size:12px">Repetido → <b style="color:var(--teal)">+${l.essence} Essência</b></span>` : `<button class="btn sm primary" data-act="item-open" data-id="${it.id}">Ver / equipar</button>`}
              </div>
            </div>
          </div>`;
        }).join('')}</div>` : ''}
      <div class="modal-actions"><button class="btn primary" data-act="modal-close">Continuar jornada</button></div>`;

    const modal = U.modal(html, { wide: true });
    MR.Audio.play('complete');
    MR.FX.burst(innerWidth / 2, innerHeight * 0.3, '#ef4455', 80, 9);
    const cards = [...modal.el.querySelectorAll('.loot-card')];
    const reveal = (card) => {
      if (card.classList.contains('revealed')) return;
      card.classList.add('revealed');
      const l = loot[Number(card.dataset.loot)];
      const r = MR.ITEMS_BY_ID[l.id].rarity;
      MR.Audio.play('loot', r);
      setTimeout(() => MR.FX.burstAt(card, MR.RARITIES[r].color, r === 'legendary' ? 160 : 70, r === 'legendary' ? 12 : 7), 300);
    };
    cards.forEach((c) => c.addEventListener('click', (e) => { if (!e.target.closest('[data-act]')) reveal(c); }));
    if (res.kills.length) setTimeout(() => MR.Audio.play('kill'), 400);
    if (res.level.ups) setTimeout(() => { MR.Audio.play('levelUp'); MR.FX.burst(innerWidth / 2, innerHeight / 2, '#fbbf24', 120, 10); }, res.kills.length ? 1600 : 700);
  }

  MR.Results = { askReport, show };
})(window.MR = window.MR || {});

/* =========================================================================
 * Tela: Herói — ficha, atributos (com distribuição de pontos) e equipamento.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi, ui } = MR;
  const U = MR.UI, E = MR.Engine;

  function idCard(s) {
    const rank = E.rankFor(s.player.level);
    const next = E.nextRank(s.player.level);
    const need = E.xpForLevel(s.player.level);
    const hours = s.sessions.reduce((a, x) => a + x.minutes, 0) / 60;
    return `
    <section class="card">
      <div class="id-card">
        <div class="id-avatar" style="--rank:${rank.color}">${gi(rank.icon)}</div>
        <div style="flex:1;min-width:0">
          <span class="chip" style="color:${rank.color}">${rank.elo}</span>
          <div class="id-name" style="margin-top:8px">${U.esc(s.player.name)} <button class="btn ghost sm" data-act="rename" aria-label="Renomear">${ui('scroll-text')}</button></div>
          <div class="id-title">${rank.title} · Nível <b class="num" style="color:var(--gold)">${s.player.level}</b></div>
          <div class="hud-xp-meta"><span>${U.fmt(s.player.xp)} / ${U.fmt(need)} XP</span><span>faltam ${U.fmt(need - s.player.xp)}</span></div>
          <div class="bar xp"><i style="width:${(s.player.xp / need) * 100}%"></i></div>
          <div class="muted" style="font-size:12.5px;margin-top:8px">${next ? `Próxima patente: <b style="color:${next.color}">${next.title}</b> no nível ${next.level}` : 'Você alcançou a patente máxima.'}</div>
        </div>
      </div>
      <div class="mini-stats" style="grid-template-columns:repeat(4,1fr);margin-top:16px">
        <div class="mini"><span>Bosses</span><b>${s.stats.bossesDefeated}</b></div>
        <div class="mini"><span>Horas</span><b>${hours.toFixed(1)}</b></div>
        <div class="mini"><span>Recorde</span><b>${s.streak.best}d</b></div>
        <div class="mini"><span>Itens</span><b>${s.inventory.length}/${MR.ITEMS.length}</b></div>
      </div>
    </section>`;
  }

  function attributes(s) {
    const tot = E.totalAttrs(s);
    const pts = s.player.points;
    const spent = Object.values(s.player.base).reduce((a, v) => a + v - 1, 0);
    return `
    <section class="card">
      <h2 class="card-title">${gi('swords-emblem')} Atributos
        <span class="aside">${pts ? `<b style="color:var(--gold)">${pts} ponto${pts > 1 ? 's' : ''} livre${pts > 1 ? 's' : ''}</b>` : `+${MR.RULES.POINTS_PER_LEVEL} pontos por nível`}</span></h2>
      ${Object.entries(MR.ATTRS).map(([k, a]) => {
        const gear = tot[k] - s.player.base[k];
        return `<div class="attr-row">
          <div class="a-ic">${gi(a.icon)}</div>
          <div><div class="a-name">${a.name}</div><div class="a-desc">${a.desc}</div></div>
          <div class="a-val">${tot[k]}<small>${s.player.base[k]} base${gear ? ` <em>+${gear}</em>` : ''}</small></div>
          <button class="plus" data-act="alloc" data-attr="${k}" ${pts ? '' : 'disabled'} aria-label="Adicionar ponto em ${a.name}">+</button>
        </div>`;
      }).join('')}
      ${spent ? `<div style="display:flex;justify-content:flex-end;margin-top:10px">
        <button class="btn sm" data-act="respec" ${s.essence < E.RESPEC_COST ? 'disabled' : ''} data-tip="Devolve todos os pontos distribuídos">${ui('history')} Redistribuir (${E.RESPEC_COST} ${gi('crystal-shine')})</button></div>` : ''}
    </section>`;
  }

  function slotBtn(s, key) {
    const id = s.equipment[key];
    const def = MR.SLOTS[key];
    if (!id) return `<button class="slot" data-act="slot" data-slot="${key}"><div class="sl-ic">${gi(def.icon)}</div><div><div class="sl-name muted">Vazio</div><div class="sl-type">${def.name}</div></div></button>`;
    const it = MR.ITEMS_BY_ID[id];
    const rf = s.refine[id] || 0;
    return `<button class="slot filled" style="${U.rc(it.rarity)}" data-act="slot" data-slot="${key}">
      <div class="sl-ic">${gi(it.icon)}</div><div style="min-width:0"><div class="sl-name">${U.esc(it.name)}${rf ? ` <span style="color:var(--teal)">+${rf}</span>` : ''}</div><div class="sl-type">${def.name} · <span class="rar-text">${MR.RARITIES[it.rarity].name}</span></div></div></button>`;
  }

  function equipment(s) {
    const rank = E.rankFor(s.player.level);
    const items = E.equippedItems(s).filter((it) => !/^Sem efeito/.test(it.effect));
    return `
    <section class="card">
      <h2 class="card-title">${gi('breastplate')} Equipamento <span class="aside">clique num slot para trocar</span></h2>
      <div class="paperdoll">
        <div class="slots">${['weapon', 'grimoire', 'armor'].map((k) => slotBtn(s, k)).join('')}</div>
        <div class="doll-center"><div class="doll-figure" style="--rank:${rank.color}">${gi(rank.icon)}</div><span class="chip" style="color:${rank.color}">${rank.title}</span></div>
        <div class="slots">${['relic', 'accessory', 'ring1', 'ring2'].map((k) => slotBtn(s, k)).join('')}</div>
      </div>
      <h3 class="card-title" style="margin-top:22px">${gi('sparkles')} Efeitos ativos</h3>
      <div class="effects-list">${items.length ? items.map((it) => `<div class="effect" style="${U.rc(it.rarity)}">${gi(it.icon)}<div><b>${U.esc(it.name)}:</b> ${U.esc(it.effect)}</div></div>`).join('')
        : '<div class="empty" style="padding:12px">Nenhum efeito especial equipado. Derrote bosses para conseguir equipamentos.</div>'}</div>
    </section>`;
  }

  function slotPicker(slot) {
    const s = MR.Store.get();
    const def = MR.SLOTS[slot];
    const cur = s.equipment[slot];
    const options = s.inventory.map((id) => MR.ITEMS_BY_ID[id]).filter((it) => it.slot === def.accepts && it.id !== cur)
      .sort((a, b) => MR.RARITY_ORDER.indexOf(b.rarity) - MR.RARITY_ORDER.indexOf(a.rarity));
    const curStats = cur ? E.itemStats(cur, s.refine[cur] || 0) : {};
    U.modal(`
      <h2>${gi(def.icon)} ${def.name}</h2>
      <p class="sub">${cur ? `Equipado: <b class="rar-text" style="${U.rc(MR.ITEMS_BY_ID[cur].rarity)}">${U.esc(MR.ITEMS_BY_ID[cur].name)}</b>` : 'Slot vazio.'} As setas mostram a diferença de atributos.</p>
      <div class="picker-list">
        ${options.length ? options.map((it) => {
          const other = it.slot === 'ring' ? E.equippedSlotOf(s, it.id) : null;
          return `<button class="pick" style="${U.rc(it.rarity)}" data-act="item-equip" data-id="${it.id}" data-slot="${slot}">
            ${gi(it.icon)}
            <div><b>${U.esc(it.name)}</b>${s.refine[it.id] ? ` <span style="color:var(--teal)">+${s.refine[it.id]}</span>` : ''}
              <div class="muted" style="font-size:12px">${U.esc(it.effect)}${other ? ` · (sairá do ${MR.SLOTS[other].name})` : ''}</div>
              <div class="stat-list" style="justify-content:flex-start;margin-top:4px">${U.statTags(E.itemStats(it.id, s.refine[it.id] || 0), curStats)}</div></div>
            <span class="chip rar">${MR.RARITIES[it.rarity].name}</span>
          </button>`;
        }).join('') : `<div class="empty">${gi('chest')}Nenhum item compatível na mochila.</div>`}
      </div>
      <div class="modal-actions">
        ${cur ? `<button class="btn" data-act="item-open" data-id="${cur}">Detalhes do equipado</button><button class="btn danger" data-act="item-unequip" data-slot="${slot}">Desequipar</button>` : ''}
      </div>`, { wide: true, key: 'slot' });
  }

  MR.Views.hero = {
    title: 'Herói', icon: 'hood',
    render(s) {
      return `<div class="page-head"><div><h1>Ficha do Herói</h1><p>Seus atributos e equipamentos multiplicam o dano de cada golpe de estudo.</p></div></div>
        <div class="hero-layout"><div class="grid">${idCard(s)}${attributes(s)}</div><div class="grid">${equipment(s)}</div></div>`;
    },
  };

  U.on('alloc', (el) => {
    const s = MR.Store.get();
    if (E.allocate(s, el.dataset.attr)) {
      MR.Audio.play('click');
      const r = el.getBoundingClientRect(); MR.FX.burst(r.left + r.width / 2, r.top + r.height / 2, '#e2b857', 18, 3);
      MR.Store.save();
    }
  });
  U.on('respec', async () => {
    const ok = await U.confirm({ title: 'Redistribuir pontos?', icon: 'crystal-shine', text: `Todos os pontos voltam a ficar livres por <b>${E.RESPEC_COST} Essência</b>.`, ok: 'Redistribuir' });
    if (ok) { const s = MR.Store.get(); if (E.respec(s)) { MR.Store.save(); U.toast('Pontos devolvidos. Distribua com sabedoria.', { icon: 'sparkles' }); } }
  });
  U.on('slot', (el) => slotPicker(el.dataset.slot));
  U.on('rename', () => {
    const s = MR.Store.get();
    const m = U.modal(`<h2>Nome do herói</h2><div class="field"><input class="input" id="nm" maxlength="24" value="${U.esc(s.player.name)}"></div>
      <div class="modal-actions"><button class="btn primary" id="nm-ok">Salvar</button></div>`);
    const save = () => { const v = m.el.querySelector('#nm').value.trim(); if (v) { s.player.name = v; MR.Store.save(); } m.close(true); };
    m.el.querySelector('#nm-ok').addEventListener('click', save);
    m.el.querySelector('#nm').addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  });
})(window.MR = window.MR || {});

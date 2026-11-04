/* =========================================================================
 * Tela: Arsenal — todos os itens (descobertos e não), filtros e refino.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi } = MR;
  const U = MR.UI;
  const filter = { type: 'all', owned: 'all' };

  MR.Views.arsenal = {
    title: 'Arsenal', icon: 'chest',
    render(s) {
      const types = [['all', 'Todos'], ...Object.entries(MR.ITEM_TYPES)];
      let list = MR.ITEMS.slice();
      if (filter.type !== 'all') list = list.filter((it) => it.slot === filter.type);
      if (filter.owned === 'owned') list = list.filter((it) => s.inventory.includes(it.id));
      if (filter.owned === 'missing') list = list.filter((it) => !s.inventory.includes(it.id));
      list.sort((a, b) => (s.inventory.includes(b.id) - s.inventory.includes(a.id)) || (MR.RARITY_ORDER.indexOf(b.rarity) - MR.RARITY_ORDER.indexOf(a.rarity)));
      const byRarity = MR.RARITY_ORDER.map((r) => {
        const all = MR.ITEMS.filter((it) => it.rarity === r);
        return `<span class="chip rar" style="${U.rc(r)}">${MR.RARITIES[r].name} ${all.filter((it) => s.inventory.includes(it.id)).length}/${all.length}</span>`;
      }).join('');
      return `
        <div class="page-head"><div><h1>Arsenal</h1><p>Itens repetidos viram <b style="color:var(--teal)">Essência Arcana</b>, usada para refinar equipamentos (+20% de atributos por nível, até +5).</p></div>
          <span class="pill essence">${gi('crystal-shine')} <b>${U.fmt(s.essence)}</b> Essência</span></div>
        <div class="filters">${byRarity}</div>
        <div class="filters">
          ${types.map(([k, n]) => `<button class="chip ${filter.type === k ? 'on' : ''}" data-act="ars-type" data-v="${k}">${n}</button>`).join('')}
          <span style="flex:1"></span>
          ${[['all', 'Todos'], ['owned', 'Descobertos'], ['missing', 'Faltando']].map(([k, n]) => `<button class="chip ${filter.owned === k ? 'on' : ''}" data-act="ars-own" data-v="${k}">${n}</button>`).join('')}
        </div>
        <div class="items-grid">${list.map((it) => U.itemCard(it.id, s)).join('') || '<div class="empty">Nada por aqui.</div>'}</div>`;
    },
  };
  U.on('ars-type', (el) => { filter.type = el.dataset.v; U.render(); });
  U.on('ars-own', (el) => { filter.owned = el.dataset.v; U.render(); });
})(window.MR = window.MR || {});

/* =========================================================================
 * Tela: Coleção — Bestiário dos Guardiões e Sala de Troféus.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi } = MR;
  const U = MR.UI, E = MR.Engine;

  MR.Views.collection = {
    title: 'Coleção', icon: 'trophy',
    render(s) {
      const all = MR.RARITY_ORDER.flatMap((r) => (MR.BOSS_POOL[r] || []).map((name) => ({ name, rarity: r })));
      const byName = Object.values(s.bestiary).reduce((m, b) => { m[b.name] = b; return m; }, {});
      const known = all.filter((b) => byName[b.name]).length;
      const got = MR.TROPHIES.filter((t) => s.trophies[t.id]).length;
      return `
        <div class="page-head"><div><h1>Coleção</h1><p>Cada Guardião derrotado é catalogado. Cada hábito consistente vira um troféu.</p></div>
          <div style="display:flex;gap:10px"><span class="pill">${gi('book-cover')} <b>${known}/${all.length}</b> bosses</span><span class="pill" style="color:var(--gold)">${gi('trophy')} <b>${got}/${MR.TROPHIES.length}</b> troféus</span></div></div>
        <section class="card" style="margin-bottom:18px">
          <h2 class="card-title">${gi('trophy')} Sala de Troféus</h2>
          <div class="trophies">${MR.TROPHIES.map((t) => {
            const when = s.trophies[t.id];
            return `<div class="trophy ${when ? 'got' : ''}"><div class="t-ic">${gi(t.icon)}</div><div><b>${t.name}</b><span>${t.desc}${when ? `<br><span style="color:var(--gold)">Conquistado em ${new Date(when).toLocaleDateString('pt-BR')}</span>` : ''}</span></div></div>`;
          }).join('')}</div>
        </section>
        <section class="card">
          <h2 class="card-title">${gi('crowned-skull')} Bestiário dos Guardiões</h2>
          <div class="bestiary">${all.map((b) => {
            const e = byName[b.name];
            if (!e) return `<div class="beast unknown">${gi(E.bossIconFor(b.name))}<b>???</b><span>${MR.RARITIES[b.rarity].name}</span></div>`;
            return `<div class="beast" style="${U.rc(b.rarity)}" data-tip="${U.esc((e.traits || []).map((t) => MR.TRAITS[t] ? MR.TRAITS[t].name : t).join(' · ') || 'Sem traços registrados')}">
              ${gi(E.bossIconFor(b.name))}<b>${U.esc(b.name)}</b><span class="rar-text">${MR.RARITIES[b.rarity].name}</span><br><span>${e.kills}× derrotado</span></div>`;
          }).join('')}</div>
        </section>`;
    },
  };
})(window.MR = window.MR || {});

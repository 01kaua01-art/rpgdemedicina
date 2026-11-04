/* =========================================================================
 * UI — utilitários de interface, navegação, HUD, modais, toasts e ações.
 * Cada tela (js/views/*.js) se registra em MR.Views e devolve HTML.
 * Cliques são tratados por delegação via atributo data-act="nome".
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi, ui } = MR;

  /* ---------------- Formatação ---------------- */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString('pt-BR');
  const fmtShort = (n) => {
    n = Math.round(n || 0);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
    return fmt(n);
  };
  const fmtMin = (m) => {
    m = Math.round(m || 0);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h ${String(r).padStart(2, '0')}` : `${h}h`;
  };
  const fmtClock = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = (x) => String(x).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  };
  const fmtDate = (key, opts = { day: '2-digit', month: 'short' }) => MR.Store.parseDay(key).toLocaleDateString('pt-BR', opts);
  const pct = (v) => `${Math.round(v * 100)}%`;
  const rc = (rarity) => `--rc:${MR.RARITIES[rarity] ? MR.RARITIES[rarity].color : '#a3acb9'}`;
  const mc = (method) => `--mc:${(MR.METHODS[method] || MR.METHODS.questions).color}`;

  /* ---------------- Itens ---------------- */
  function statTags(stats, compare = null) {
    const keys = new Set([...Object.keys(stats), ...(compare ? Object.keys(compare) : [])]);
    return [...keys].map((k) => {
      const v = stats[k] || 0;
      if (!compare) return `<span class="stat-tag" data-tip="${esc(MR.ATTRS[k].name)}">+${v} ${MR.ATTRS[k].short}</span>`;
      const d = v - (compare[k] || 0);
      if (!d) return `<span class="stat-tag">${v} ${MR.ATTRS[k].short}</span>`;
      return `<span class="stat-tag ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d} ${MR.ATTRS[k].short}</span>`;
    }).join('');
  }

  function itemCard(id, s, { act = 'item-open' } = {}) {
    const it = MR.ITEMS_BY_ID[id];
    const owned = s.inventory.includes(id);
    if (!owned) {
      return `<div class="item-card unknown">${gi(it.icon)}<div class="i-name">???</div><div class="i-type">${MR.ITEM_TYPES[it.slot]} · ${MR.RARITIES[it.rarity].name}</div></div>`;
    }
    const eq = MR.Engine.equippedSlotOf(s, id);
    const rf = s.refine[id] || 0;
    const isNew = s.newItems.includes(id);
    return `<button class="item-card" style="${rc(it.rarity)}" data-act="${act}" data-id="${id}">
      ${eq ? '<span class="badge-eq">EQUIPADO</span>' : isNew ? '<span class="badge-eq" style="background:var(--teal)">NOVO</span>' : ''}
      ${rf ? `<span class="badge-rf">+${rf}</span>` : ''}
      ${gi(it.icon)}
      <div class="i-name">${esc(it.name)}</div>
      <div class="i-type rar-text">${MR.RARITIES[it.rarity].name} · ${MR.ITEM_TYPES[it.slot]}</div>
      <div class="stat-list">${statTags(MR.Engine.itemStats(id, rf))}</div>
    </button>`;
  }

  function compareBlock(s, id) {
    const it = MR.ITEMS_BY_ID[id];
    const E = MR.Engine;
    const slots = it.slot === 'ring' ? ['ring1', 'ring2'] : [it.slot];
    const eqSlot = E.equippedSlotOf(s, id);
    if (eqSlot) return '';
    const cur = slots.map((sl) => s.equipment[sl]).filter(Boolean);
    const mine = E.itemStats(id, s.refine[id] || 0);
    if (!cur.length) return `<div class="compare">${ui('info')} O slot <b>${slots.map((x) => MR.SLOTS[x].name).join(' / ')}</b> está vazio — equipar só traz ganhos.</div>`;
    return cur.map((cid) => {
      const other = MR.ITEMS_BY_ID[cid];
      return `<div class="compare"><div class="muted" style="margin-bottom:6px">Comparado a <b class="rar-text" style="${rc(other.rarity)}">${esc(other.name)}</b>:</div>
        <div class="stat-list" style="justify-content:flex-start">${statTags(mine, E.itemStats(cid, s.refine[cid] || 0))}</div></div>`;
    }).join('');
  }

  function itemModal(id) {
    const s = MR.Store.get();
    const it = MR.ITEMS_BY_ID[id];
    const E = MR.Engine;
    if (s.newItems.includes(id)) { s.newItems = s.newItems.filter((x) => x !== id); MR.Store.save(); }
    const rf = s.refine[id] || 0;
    const eqSlot = E.equippedSlotOf(s, id);
    const cost = rf < MR.RULES.REFINE_MAX ? E.refineCost(id, rf) : null;
    const ringBtns = it.slot === 'ring' && !eqSlot
      ? `<button class="btn primary" data-act="item-equip" data-id="${id}" data-slot="ring1">Equipar no Anel I</button>
         <button class="btn primary" data-act="item-equip" data-id="${id}" data-slot="ring2">Equipar no Anel II</button>`
      : '';
    const html = `
      <div class="item-detail" style="${rc(it.rarity)}">
        <div class="big-ic">${gi(it.icon)}</div>
        <div>
          <span class="chip rar">${MR.RARITIES[it.rarity].name} · ${MR.ITEM_TYPES[it.slot]}</span>
          <h2 style="margin-top:8px">${esc(it.name)} ${rf ? `<span class="num" style="color:var(--teal)">+${rf}</span>` : ''}</h2>
          <div class="stat-list" style="justify-content:flex-start">${statTags(E.itemStats(id, rf))}</div>
          <div class="effect-box">${gi('sparkles')} ${esc(it.effect)}</div>
          <div class="origin">“${esc(it.origin)}”</div>
          ${compareBlock(s, id)}
        </div>
      </div>
      <div class="modal-actions">
        ${cost != null ? `<button class="btn" data-act="item-refine" data-id="${id}" ${s.essence < cost ? 'disabled' : ''} data-tip="Refino +${rf + 1}: +20% nos atributos base do item">${gi('anvil')} Refinar (${fmt(cost)} ${gi('crystal-shine')})</button>`
          : '<span class="chip" style="color:var(--teal)">Refino máximo</span>'}
        ${eqSlot ? `<button class="btn danger" data-act="item-unequip" data-slot="${eqSlot}">Desequipar</button>`
          : ringBtns || `<button class="btn primary" data-act="item-equip" data-id="${id}">Equipar</button>`}
      </div>`;
    return UI.modal(html, { wide: true, key: 'item:' + id });
  }

  /* ---------------- Modais ---------------- */
  const root = () => document.getElementById('modal-root');
  const stack = [];

  const UI = {
    esc, fmt, fmtShort, fmtMin, fmtClock, fmtDate, pct, rc, mc, statTags, itemCard, itemModal,
    current: 'battle',
    draft: { subject: '', method: null, mode: null, goal: null },

    modal(html, { wide = false, dismissable = true, onClose = null, key = null } = {}) {
      if (key) { const ex = stack.find((m) => m.key === key); if (ex) ex.close(true); }
      const bd = document.createElement('div');
      bd.className = 'modal-backdrop';
      bd.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        ${dismissable ? `<button class="icon-btn modal-x" data-act="modal-close" aria-label="Fechar">${ui('x')}</button>` : ''}${html}</div>`;
      const entry = {
        el: bd, key, dismissable,
        close(silent) {
          const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
          bd.remove(); if (!silent && onClose) onClose();
        },
        set(h) { bd.querySelector('.modal').innerHTML = (dismissable ? `<button class="icon-btn modal-x" data-act="modal-close" aria-label="Fechar">${ui('x')}</button>` : '') + h; },
      };
      if (dismissable) bd.addEventListener('mousedown', (e) => { if (e.target === bd) entry.close(); });
      root().appendChild(bd);
      stack.push(entry);
      const f = bd.querySelector('input, textarea, .btn.primary'); if (f) setTimeout(() => f.focus(), 50);
      return entry;
    },
    closeTopModal() { const m = stack[stack.length - 1]; if (m && m.dismissable) { m.close(); return true; } return false; },
    closeAllModals() { [...stack].forEach((m) => m.close(true)); },
    topModal() { return stack[stack.length - 1] || null; },

    confirm({ title, text, ok = 'Confirmar', cancel = 'Cancelar', danger = false, icon = 'skull-crossed-bones' }) {
      return new Promise((resolve) => {
        let done = false;
        const m = UI.modal(`
          <h2>${gi(icon)} ${esc(title)}</h2>
          <p class="sub">${text}</p>
          <div class="modal-actions">
            <button class="btn ghost" data-act="confirm-no">${esc(cancel)}</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirm-yes">${esc(ok)}</button>
          </div>`, { onClose: () => { if (!done) resolve(false); } });
        m.el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-act]'); if (!b) return;
          if (b.dataset.act === 'confirm-yes') { done = true; m.close(true); resolve(true); }
          if (b.dataset.act === 'confirm-no') { done = true; m.close(true); resolve(false); }
        });
      });
    },

    toast(text, { icon = 'sparkles', color = 'var(--gold)', ms = 4200, uiIcon = false } = {}) {
      const box = document.getElementById('toasts');
      const t = document.createElement('div');
      t.className = 'toast';
      t.style.setProperty('--tc', color);
      t.innerHTML = `${uiIcon ? ui(icon) : gi(icon)}<div>${text}</div>`;
      box.appendChild(t);
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
    },

    /* ---------------- Navegação ---------------- */
    go(view) {
      if (!MR.Views[view]) view = 'battle';
      UI.current = view;
      if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
      UI.render();
      document.getElementById('view').scrollTop = 0;
    },

    renderNav(s) {
      const badges = { hero: s.player.points, arsenal: s.newItems.length };
      document.getElementById('nav').innerHTML = Object.entries(MR.Views).map(([k, v]) => `
        <button class="nav-btn ${UI.current === k ? 'active' : ''}" data-act="go" data-view="${k}">
          ${v.uiIcon ? ui(v.icon) : gi(v.icon)}<span class="lbl-long">${v.title}</span><span class="lbl-short">${v.short || v.title}</span>
          ${badges[k] ? `<span class="nav-badge">${badges[k]}</span>` : ''}
        </button>`).join('');
      const foot = document.getElementById('sidebar-foot');
      if (s.active) {
        foot.innerHTML = `<button class="btn primary block sm" data-act="focus-open">${gi('crossed-swords')} Voltar à batalha</button>`;
      } else {
        const q = s.quests ? s.quests.done.length : 0;
        foot.innerHTML = `<div style="display:flex;justify-content:space-between"><span>Contratos de hoje</span><b class="num" style="color:var(--gold)">${q}/3</b></div>
          <div class="bar gold" style="margin-top:8px"><i style="width:${(q / 3) * 100}%"></i></div>`;
      }
      document.getElementById('brand-mark').innerHTML = gi('caduceus');
    },

    renderHud(s) {
      const E = MR.Engine;
      const rank = E.rankFor(s.player.level);
      const need = E.xpForLevel(s.player.level);
      const streak = E.streakNow(s);
      const combo = E.comboMult(s);
      const sound = s.settings.sound;
      document.getElementById('hud').innerHTML = `
        <div class="hud-id">
          <div class="hud-avatar" style="--rank:${rank.color}">${gi(rank.icon)}<span class="lvl">${s.player.level}</span></div>
          <div style="min-width:0"><div class="hud-name">${esc(s.player.name)}</div><div class="hud-title">${rank.title} · ${rank.elo}</div></div>
        </div>
        <div class="hud-xp">
          <div class="hud-xp-meta"><span>Experiência</span><span><b>${fmt(s.player.xp)}</b> / ${fmt(need)} XP</span></div>
          <div class="bar xp"><i style="width:${Math.min(100, (s.player.xp / need) * 100)}%"></i></div>
        </div>
        <div class="hud-stats">
          ${s.player.points ? `<button class="pill points" data-act="go" data-view="hero">${gi('sparkles')} <b>${s.player.points}</b> <span>pontos</span></button>` : ''}
          <span class="pill flame ${streak ? '' : 'off'}" data-tip="Sequência de ${streak} dia(s). Combo de Foco x${combo.toFixed(2)} no dano.${s.streak.freezes ? ` ${s.streak.freezes} proteção(ões) de sequência.` : ''}">${gi('flame')} <b>${streak}</b> <span>x${combo.toFixed(2)}</span>${s.streak.freezes ? ` <span style="color:#7dd3fc">❄${s.streak.freezes}</span>` : ''}</span>
          <span class="pill essence" data-tip="Essência Arcana: obtida com contratos e itens repetidos. Use para refinar equipamentos.">${gi('crystal-shine')} <b>${fmt(s.essence)}</b></span>
          <button class="icon-btn" data-act="toggle-sound" aria-label="Som" data-tip="${sound ? 'Silenciar' : 'Ativar som'}">${ui(sound ? 'volume-2' : 'volume-x')}</button>
        </div>`;
    },

    render() {
      const s = MR.Store.get();
      if (!s) return;
      UI.renderNav(s);
      UI.renderHud(s);
      const v = MR.Views[UI.current];
      const el = document.getElementById('view');
      const scroll = el.scrollTop;
      el.innerHTML = `<div class="view-inner">${v.render(s)}</div>`;
      el.scrollTop = scroll;
      if (v.after) v.after(el, s);
      const boss = s.boss;
      if (boss) MR.FX.setTint(MR.RARITIES[boss.rarity].color);
    },
  };

  /* ---------------- Ações (delegação) ---------------- */
  const Actions = {
    go: (el) => { MR.Audio.play('click'); UI.go(el.dataset.view); },
    'modal-close': () => UI.closeTopModal(),
    'toggle-sound': () => { const s = MR.Store.get(); s.settings.sound = !s.settings.sound; MR.Store.save(); if (s.settings.sound) MR.Audio.play('click'); },
    'item-open': (el) => itemModal(el.dataset.id),
    'item-equip': (el) => {
      const s = MR.Store.get(); const slot = MR.Engine.equip(s, el.dataset.id, el.dataset.slot);
      if (slot) { MR.Audio.play('loot', MR.ITEMS_BY_ID[el.dataset.id].rarity); UI.toast(`<b>${esc(MR.ITEMS_BY_ID[el.dataset.id].name)}</b> equipado em ${MR.SLOTS[slot].name}.`, { icon: MR.ITEMS_BY_ID[el.dataset.id].icon }); }
      MR.Store.save(); UI.closeTopModal();
    },
    'item-unequip': (el) => { const s = MR.Store.get(); MR.Engine.unequip(s, el.dataset.slot); MR.Store.save(); UI.closeTopModal(); },
    'item-refine': (el) => {
      const s = MR.Store.get(); const id = el.dataset.id;
      if (MR.Engine.refine(s, id)) {
        MR.Audio.play('levelUp'); MR.Store.save();
        UI.toast(`<b>${esc(MR.ITEMS_BY_ID[id].name)}</b> refinado para <b>+${s.refine[id]}</b>!`, { icon: 'anvil', color: 'var(--teal)' });
        const r = el.getBoundingClientRect(); MR.FX.burst(r.left + r.width / 2, r.top, '#2dd4bf', 50);
        itemModal(id);
      } else MR.Audio.play('error');
    },
  };
  UI.on = (name, fn) => { Actions[name] = fn; };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = Actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && UI.closeTopModal()) e.preventDefault();
  });

  MR.Views = {};
  MR.UI = UI;
})(window.MR = window.MR || {});

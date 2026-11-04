/* =========================================================================
 * Tela: Crônicas — calendário mensal de estudo e histórico filtrável.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi, ui } = MR;
  const U = MR.UI, E = MR.Engine, St = () => MR.Store;
  const cal = { y: new Date().getFullYear(), m: new Date().getMonth() };
  const hist = { method: 'all', q: '', limit: 40 };

  const level = (min) => (min <= 0 ? '' : min < 30 ? 'l1' : min < 90 ? 'l2' : min < 180 ? 'l3' : 'l4');

  function calendar(s) {
    const first = new Date(cal.y, cal.m, 1);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7)); // semana começa na segunda
    const byDay = {};
    for (const x of s.sessions) byDay[x.date] = (byDay[x.date] || 0) + x.minutes;
    const frozen = new Set(s.streak.frozenDays || []);
    const today = St().dayKey();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = St().dayKey(d);
      const min = byDay[k] || 0;
      const out = d.getMonth() !== cal.m;
      cells.push(`<button class="day ${out ? 'out' : ''} ${level(min)} ${k === today ? 'today' : ''} ${frozen.has(k) ? 'frozen' : ''}" data-act="day-open" data-day="${k}" ${out ? 'tabindex="-1"' : ''}
        aria-label="${d.toLocaleDateString('pt-BR')}: ${U.fmtMin(min)}"><span class="d-n">${d.getDate()}</span>${min ? `<span class="d-m">${U.fmtMin(min)}</span>` : ''}</button>`);
    }
    const monthMin = s.sessions.filter((x) => x.date.startsWith(`${cal.y}-${String(cal.m + 1).padStart(2, '0')}`)).reduce((a, x) => a + x.minutes, 0);
    const studiedDays = Object.keys(byDay).filter((k) => k.startsWith(`${cal.y}-${String(cal.m + 1).padStart(2, '0')}`)).length;
    return `
      <section class="card">
        <div class="cal-head">
          <button class="icon-btn" data-act="cal-prev" aria-label="Mês anterior">${ui('chevron-left')}</button>
          <h3>${first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
          <span class="chip">${U.fmtMin(monthMin)} · ${studiedDays} dia(s)</span>
          <button class="icon-btn" data-act="cal-next" aria-label="Próximo mês">${ui('chevron-right')}</button>
        </div>
        <div class="cal">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
        <div class="legend"><span><i style="background:rgba(226,184,87,.08)"></i>até 30 min</span><span><i style="background:rgba(226,184,87,.18)"></i>até 1h30</span><span><i style="background:rgba(226,184,87,.32)"></i>até 3h</span><span><i style="background:rgba(226,184,87,.5)"></i>3h+</span><span>❄ dia salvo por proteção</span></div>
      </section>`;
  }

  function row(x) {
    const m = MR.METHODS[x.method] || MR.METHODS.questions;
    const time = x.startedAt ? new Date(x.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="history-row" style="${U.mc(x.method)}">
      <div><b>${U.fmtDate(x.date)}</b> <span class="muted">${time}</span></div>
      <div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${U.esc(x.subject)}</div>
        ${x.note ? `<div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">“${U.esc(x.note)}”</div>` : ''}</div>
      <div><span class="chip" style="color:var(--mc)">${gi(m.icon)} ${m.short}</span>${x.goalMet ? ` <span data-tip="Meta cumprida">${ui('check')}</span>` : ''}</div>
      <div class="num">${U.fmtMin(x.minutes)}</div>
      <div class="num" style="color:#fca5a5">${U.fmtShort(x.damage)}${x.kills ? ` <span style="color:var(--r-epic)" data-tip="Bosses derrotados">☠${x.kills}</span>` : ''}</div>
      <div class="num" style="color:var(--mana)">${x.questions ? `<span data-tip="${x.correct}/${x.questions} questões">${U.pct(x.correct / x.questions)}</span>` : '+' + U.fmt(x.xp)}</div>
    </div>`;
  }

  function history(s) {
    const q = hist.q.trim().toLowerCase();
    const list = s.sessions.filter((x) => (hist.method === 'all' || x.method === hist.method) && (!q || (x.subject || '').toLowerCase().includes(q) || (x.note || '').toLowerCase().includes(q)));
    return `
      <section class="card">
        <h2 class="card-title">${gi('scroll-unfurled')} Histórico de Batalhas <span class="aside">${list.length} sessões</span></h2>
        <div class="filters">
          <input class="input" style="max-width:280px;padding:8px 12px" placeholder="Buscar matéria ou nota…" value="${U.esc(hist.q)}" data-input="hist-q">
          <button class="chip ${hist.method === 'all' ? 'on' : ''}" data-act="hist-m" data-v="all">Todos</button>
          ${Object.entries(MR.METHODS).map(([k, m]) => `<button class="chip ${hist.method === k ? 'on' : ''}" data-act="hist-m" data-v="${k}">${m.short}</button>`).join('')}
        </div>
        <div class="history-row head"><div>Data</div><div>Matéria</div><div>Método</div><div class="num">Tempo</div><div class="num">Dano</div><div class="num">Acerto/XP</div></div>
        ${list.slice(0, hist.limit).map(row).join('') || `<div class="empty">${gi('scroll-unfurled')}Nenhuma sessão encontrada.</div>`}
        ${list.length > hist.limit ? `<div style="text-align:center;margin-top:12px"><button class="btn sm" data-act="hist-more">Mostrar mais</button></div>` : ''}
      </section>`;
  }

  function dayModal(day) {
    const s = MR.Store.get();
    const d = E.daySummary(s, day);
    const list = s.sessions.filter((x) => x.date === day);
    U.modal(`
      <h2>${MR.Store.parseDay(day).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
      <div class="mini-stats" style="grid-template-columns:repeat(4,1fr);margin:14px 0">
        <div class="mini"><span>Tempo</span><b>${U.fmtMin(d.totalMin)}</b></div>
        <div class="mini"><span>Dano</span><b style="color:#fca5a5">${U.fmtShort(d.damage)}</b></div>
        <div class="mini"><span>XP</span><b style="color:var(--mana)">${U.fmt(d.xp)}</b></div>
        <div class="mini"><span>Sessões</span><b>${d.sessions}</b></div>
      </div>
      ${list.length ? list.map(MR.sessionRow).join('') : `<div class="empty">${(s.streak.frozenDays || []).includes(day) ? '❄ Dia protegido pela proteção de sequência.' : 'Nenhuma batalha neste dia.'}</div>`}
    `, { wide: true });
  }

  MR.Views.chronicle = {
    title: 'Crônicas', icon: 'scroll-unfurled',
    render(s) {
      return `<div class="page-head"><div><h1>Crônicas</h1><p>O registro de cada dia de batalha contra o Esquecimento.</p></div></div>
        <div class="grid">${calendar(s)}${history(s)}</div>`;
    },
    after(root) {
      const inp = root.querySelector('[data-input="hist-q"]');
      if (inp) inp.addEventListener('input', () => {
        hist.q = inp.value; const pos = inp.selectionStart; U.render();
        const again = document.querySelector('[data-input="hist-q"]'); again.focus(); again.setSelectionRange(pos, pos);
      });
    },
  };

  U.on('cal-prev', () => { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } U.render(); });
  U.on('cal-next', () => { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } U.render(); });
  U.on('day-open', (el) => dayModal(el.dataset.day));
  U.on('hist-m', (el) => { hist.method = el.dataset.v; U.render(); });
  U.on('hist-more', () => { hist.limit += 40; U.render(); });
})(window.MR = window.MR || {});

/* =========================================================================
 * Tela: Estatísticas — indicadores, gráfico de 14 dias, métodos, matérias
 * e mapa de calor. Gráficos em SVG puro, com tooltip e tabela acessível.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const { gi, ui } = MR;
  const U = MR.UI, St = () => MR.Store;
  let range = 14;

  function lastDays(n) {
    const out = []; const today = St().dayKey();
    for (let i = n - 1; i >= 0; i--) out.push(St().addDays(today, -i));
    return out;
  }

  /** Barras empilhadas por método (minutos/dia). */
  function stackedBars(s, days) {
    const methods = Object.keys(MR.METHODS);
    const data = days.map((d) => {
      const row = { day: d, total: 0 };
      for (const m of methods) row[m] = 0;
      for (const x of s.sessions) if (x.date === d) { row[x.method] = (row[x.method] || 0) + x.minutes; row.total += x.minutes; }
      return row;
    });
    const max = Math.max(60, ...data.map((r) => r.total));
    const step = max > 360 ? 120 : max > 180 ? 60 : 30;
    const top = Math.ceil(max / step) * step;
    const W = 720, H = 240, L = 44, B = 26, T = 10, R = 6;
    const cw = (W - L - R) / data.length; const bw = Math.min(24, cw * 0.55);
    const y = (v) => T + (H - T - B) * (1 - v / top);
    let svg = '';
    for (let v = 0; v <= top; v += step) {
      svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,${v ? 0.05 : 0.14})"/>`;
      svg += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v >= 60 ? v / 60 + 'h' : v + 'm'}</text>`;
    }
    data.forEach((r, i) => {
      const x = L + i * cw + (cw - bw) / 2;
      let acc = 0;
      const segs = methods.filter((m) => r[m] > 0);
      segs.forEach((m, j) => {
        const y1 = y(acc + r[m]), y0 = y(acc);
        const h = Math.max(1, y0 - y1 - (j < segs.length - 1 ? 2 : 0)); // 2px de respiro entre segmentos
        const isTop = j === segs.length - 1;
        const rad = isTop ? Math.min(4, h / 2) : 0;
        const tip = `${U.fmtDate(r.day)} · ${MR.METHODS[m].short}: ${U.fmtMin(r[m])} (total ${U.fmtMin(r.total)})`;
        svg += isTop
          ? `<path d="M${x},${y0 - (j ? 0 : 0)} V${y1 + rad} Q${x},${y1} ${x + rad},${y1} H${x + bw - rad} Q${x + bw},${y1} ${x + bw},${y1 + rad} V${y0} Z" fill="${MR.METHODS[m].color}" data-tipc="${U.esc(tip)}"/>`
          : `<rect x="${x}" y="${y0 - h}" width="${bw}" height="${h}" fill="${MR.METHODS[m].color}" data-tipc="${U.esc(tip)}"/>`;
        acc += r[m];
      });
      if (!segs.length) svg += `<rect x="${x}" y="${y(0) - 2}" width="${bw}" height="2" rx="1" fill="rgba(255,255,255,.08)"/>`;
      // alvo de hover maior que a marca
      svg += `<rect x="${L + i * cw}" y="${T}" width="${cw}" height="${H - T - B}" fill="transparent" data-tipc="${U.esc(`${U.fmtDate(r.day, { weekday: 'short', day: '2-digit', month: 'short' })}: ${U.fmtMin(r.total)}${segs.length ? ' — ' + segs.map((m) => MR.METHODS[m].short + ' ' + U.fmtMin(r[m])).join(', ') : ''}`)}" style="pointer-events:${segs.length ? 'none' : 'all'}"/>`;
      const lbl = data.length <= 14 || i % Math.ceil(data.length / 14) === 0;
      if (lbl) svg += `<text x="${L + i * cw + cw / 2}" y="${H - 8}" text-anchor="middle">${MR.Store.parseDay(r.day).getDate()}</text>`;
    });
    const used = methods.filter((m) => data.some((r) => r[m] > 0));
    const table = `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:12px">Ver como tabela</summary>
      <table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:8px"><tr class="muted"><th align="left">Dia</th>${used.map((m) => `<th align="right">${MR.METHODS[m].short}</th>`).join('')}<th align="right">Total</th></tr>
      ${data.filter((r) => r.total).map((r) => `<tr><td>${U.fmtDate(r.day)}</td>${used.map((m) => `<td align="right">${r[m] ? U.fmtMin(r[m]) : '—'}</td>`).join('')}<td align="right"><b>${U.fmtMin(r.total)}</b></td></tr>`).join('')}</table></details>`;
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutos estudados por dia, empilhados por método">${svg}</svg></div>
      <div class="legend">${(used.length ? used : methods).map((m) => `<span><i style="background:${MR.METHODS[m].color}"></i>${MR.METHODS[m].short}</span>`).join('')}</div>${table}`;
  }

  function methodBars(s) {
    const tot = {}; let all = 0;
    for (const x of s.sessions) { tot[x.method] = (tot[x.method] || 0) + x.minutes; all += x.minutes; }
    const max = Math.max(1, ...Object.values(tot));
    return Object.entries(MR.METHODS).map(([k, m]) => `
      <div class="hbar"><span>${gi(m.icon)} ${m.short}</span>
        <div class="track"><i style="width:${((tot[k] || 0) / max) * 100}%;background:${m.color}"></i></div>
        <span class="num" style="text-align:right">${U.fmtMin(tot[k] || 0)} <span class="muted">${all ? U.pct((tot[k] || 0) / all) : ''}</span></span></div>`).join('');
  }

  function subjects(s) {
    const map = {};
    for (const x of s.sessions) {
      const k = (x.subject || 'Estudo Geral').trim();
      const e = map[k] || (map[k] = { name: k, min: 0, n: 0, q: 0, c: 0, dmg: 0, last: x.date });
      e.min += x.minutes; e.n++; e.q += x.questions || 0; e.c += x.correct || 0; e.dmg += x.damage;
      if (x.date > e.last) e.last = x.date;
    }
    const list = Object.values(map).sort((a, b) => b.min - a.min).slice(0, 15);
    if (!list.length) return `<div class="empty">${gi('book-cover')}As matérias aparecem aqui depois das primeiras batalhas.</div>`;
    const max = list[0].min;
    const today = St().dayKey();
    return `<div class="history-row head" style="grid-template-columns:1.6fr 1fr 70px 80px 90px"><div>Matéria</div><div>Tempo</div><div class="num">Sessões</div><div class="num">Acerto</div><div class="num">Última vez</div></div>
      ${list.map((e) => {
        const ago = St().daysBetween(e.last, today);
        return `<div class="history-row" style="grid-template-columns:1.6fr 1fr 70px 80px 90px">
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${U.esc(e.name)}</div>
          <div><div class="track" style="height:8px;border-radius:5px;background:rgba(255,255,255,.05);overflow:hidden"><i style="display:block;height:100%;width:${(e.min / max) * 100}%;background:var(--gold);border-radius:5px"></i></div><span class="muted" style="font-size:12px">${U.fmtMin(e.min)}</span></div>
          <div class="num">${e.n}</div>
          <div class="num">${e.q ? `<span style="color:${e.c / e.q >= 0.7 ? 'var(--green)' : e.c / e.q >= 0.5 ? 'var(--gold)' : '#fca5a5'}">${U.pct(e.c / e.q)}</span>` : '<span class="muted">—</span>'}</div>
          <div class="num ${ago > 14 ? '' : 'muted'}" ${ago > 14 ? 'style="color:#fca5a5" data-tip="Há mais de 2 semanas sem revisar — a curva do esquecimento está agindo!"' : ''}>${ago === 0 ? 'hoje' : ago + 'd'}</div>
        </div>`;
      }).join('')}`;
  }

  function heatmap(s) {
    const byDay = {};
    for (const x of s.sessions) byDay[x.date] = (byDay[x.date] || 0) + x.minutes;
    const today = St().dayKey();
    const weeks = 26;
    const end = St().parseDay(today);
    const start = new Date(end); start.setDate(end.getDate() - (weeks * 7 - 1));
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // alinha na segunda-feira
    const cells = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = St().dayKey(d); const m = byDay[k] || 0;
      const l = m <= 0 ? '' : m < 30 ? 'l1' : m < 90 ? 'l2' : m < 180 ? 'l3' : 'l4';
      cells.push(`<i class="${l}" data-tipc="${U.esc(`${d.toLocaleDateString('pt-BR')}: ${U.fmtMin(m)}`)}"></i>`);
    }
    return `<div class="heat">${cells.join('')}</div>
      <div class="legend"><span>Menos</span><span><i style="background:rgba(255,255,255,.04)"></i></span><span><i style="background:rgba(226,184,87,.22)"></i></span><span><i style="background:rgba(226,184,87,.42)"></i></span><span><i style="background:rgba(226,184,87,.68)"></i></span><span><i style="background:var(--gold-hi)"></i>Mais</span></div>`;
  }

  MR.Views.stats = {
    title: 'Estatísticas', short: 'Números', icon: 'bar-chart-3', uiIcon: true,
    render(s) {
      const totalMin = s.sessions.reduce((a, x) => a + x.minutes, 0);
      const days = new Set(s.sessions.map((x) => x.date)).size;
      const q = s.sessions.reduce((a, x) => a + (x.questions || 0), 0);
      const c = s.sessions.reduce((a, x) => a + (x.correct || 0), 0);
      const week = lastDays(7);
      const weekMin = s.sessions.filter((x) => week.includes(x.date)).reduce((a, x) => a + x.minutes, 0);
      const prevWeek = lastDays(14).slice(0, 7);
      const prevMin = s.sessions.filter((x) => prevWeek.includes(x.date)).reduce((a, x) => a + x.minutes, 0);
      const delta = prevMin ? (weekMin - prevMin) / prevMin : null;
      const longest = s.sessions.reduce((a, x) => Math.max(a, x.maxContMin || 0), 0);
      const kpi = (icon, label, value, sub = '') => `<div class="kpi"><span>${gi(icon)} ${label}</span><b>${value}</b><small>${sub}</small></div>`;
      return `
        <div class="page-head"><div><h1>Estatísticas</h1><p>Seus números de estudo, sem fantasia.</p></div></div>
        <div class="kpis" style="margin-bottom:18px">
          ${kpi('hourglass', 'Tempo total', U.fmtMin(totalMin), `${s.sessions.length} sessões`)}
          ${kpi('sands-of-time', 'Últimos 7 dias', U.fmtMin(weekMin), delta == null ? 'sem semana anterior' : `<span style="color:${delta >= 0 ? 'var(--green)' : '#fca5a5'}">${delta >= 0 ? '▲' : '▼'} ${U.pct(Math.abs(delta))}</span> vs. semana anterior`)}
          ${kpi('heart-beats', 'Média por dia estudado', U.fmtMin(days ? totalMin / days : 0), `${days} dias com estudo`)}
          ${kpi('archery-target', 'Acerto em questões', q ? U.pct(c / q) : '—', q ? `${U.fmt(c)} de ${U.fmt(q)} questões` : 'registre no fim das sessões')}
          ${kpi('brain', 'Maior bloco contínuo', U.fmtMin(longest), 'sem pausa')}
          ${kpi('skull-crossed-bones', 'Dano total', U.fmtShort(s.stats.totalDamage), `recorde ${U.fmtShort(s.stats.maxSessionDamage)} numa sessão`)}
        </div>
        <section class="card" style="margin-bottom:18px">
          <h2 class="card-title">${ui('bar-chart-3')} Minutos por dia, por método
            <span class="aside"><span class="seg">${[14, 30].map((n) => `<button class="${range === n ? 'on' : ''}" data-act="stats-range" data-v="${n}">${n} dias</button>`).join('')}</span></span></h2>
          ${stackedBars(s, lastDays(range))}
        </section>
        <div class="hero-layout" style="margin-bottom:18px">
          <section class="card"><h2 class="card-title">${gi('swords-emblem')} Tempo por método</h2>${methodBars(s)}
            <p class="muted" style="font-size:12.5px;margin-top:12px">${gi('sparkles')} Métodos ativos (Questões, Flashcards, Combo Ativo, Simulado) fixam mais que a leitura passiva — e causam mais dano.</p></section>
          <section class="card"><h2 class="card-title">${gi('flame')} Últimos 6 meses</h2>${heatmap(s)}</section>
        </div>
        <section class="card"><h2 class="card-title">${gi('book-cover')} Matérias</h2>${subjects(s)}</section>`;
    },
    after(root) {
      if (root._tipBound) return;
      root._tipBound = true;
      let tip = null;
      root.addEventListener('mousemove', (e) => {
        const t = e.target.closest('[data-tipc]');
        if (!t || MR.UI.current !== 'stats') { if (tip) { tip.remove(); tip = null; } return; }
        if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; document.body.appendChild(tip); }
        tip.textContent = t.getAttribute('data-tipc');
        tip.style.left = Math.min(innerWidth - tip.offsetWidth - 10, e.clientX + 14) + 'px';
        tip.style.top = e.clientY + 14 + 'px';
      });
      root.addEventListener('mouseleave', () => { if (tip) { tip.remove(); tip = null; } });
    },
  };
  U.on('stats-range', (el) => { range = Number(el.dataset.v); U.render(); });
})(window.MR = window.MR || {});

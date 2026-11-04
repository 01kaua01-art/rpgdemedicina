/* =========================================================================
 * FX — brasas ambientes (fundo), explosões de partículas e números de dano.
 * ========================================================================= */
(function (MR) {
  'use strict';
  const reduced = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeLayer(id) {
    const cv = document.getElementById(id);
    const cx = cv.getContext('2d');
    const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener('resize', fit);
    return { cv, cx };
  }

  let bg, top, embers = [], parts = [], running = false, tint = '#e2b857';

  function seedEmbers() {
    const n = Math.round(Math.min(70, innerWidth / 22));
    embers = Array.from({ length: n }, () => newEmber(true));
  }
  function newEmber(anyY) {
    return { x: Math.random() * innerWidth, y: anyY ? Math.random() * innerHeight : innerHeight + 10, r: Math.random() * 1.8 + 0.4,
      vy: -(Math.random() * 0.35 + 0.08), vx: (Math.random() - 0.5) * 0.15, a: Math.random() * 0.5 + 0.15, ph: Math.random() * 6.28 };
  }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    if (document.hidden) return;
    // fundo
    const b = bg.cx; b.clearRect(0, 0, innerWidth, innerHeight);
    if (!reduced()) {
      for (const e of embers) {
        e.y += e.vy; e.x += e.vx + Math.sin((e.ph += 0.01)) * 0.12;
        if (e.y < -10) Object.assign(e, newEmber(false));
        b.globalAlpha = e.a * (0.6 + 0.4 * Math.sin(e.ph * 3));
        b.fillStyle = tint; b.shadowColor = tint; b.shadowBlur = 8;
        b.beginPath(); b.arc(e.x, e.y, e.r, 0, 6.283); b.fill();
      }
    }
    // explosões
    const t = top.cx; t.clearRect(0, 0, innerWidth, innerHeight);
    if (parts.length) {
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.98; p.life -= p.decay;
        t.globalAlpha = Math.max(0, p.life);
        t.fillStyle = p.color; t.shadowColor = p.color; t.shadowBlur = 12;
        t.beginPath(); t.arc(p.x, p.y, p.r * p.life + 0.3, 0, 6.283); t.fill();
      }
    }
    b.globalAlpha = 1; t.globalAlpha = 1;
  }

  MR.FX = {
    init() {
      bg = makeLayer('fx-bg'); top = makeLayer('fx-top');
      seedEmbers(); addEventListener('resize', seedEmbers);
      running = true; loop();
    },
    setTint(color) { tint = color || '#e2b857'; },
    burst(x, y, color = '#e2b857', count = 40, power = 6) {
      if (reduced()) return;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2; const v = Math.random() * power + 1;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.12, r: Math.random() * 3 + 1.2, life: 1, decay: Math.random() * 0.015 + 0.012, color });
      }
    },
    burstAt(el, color, count, power) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, color, count, power);
    },
    floatText(el, html, cls = '') {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = document.createElement('div');
      d.className = 'dmg-float ' + cls;
      d.innerHTML = html;
      d.style.left = r.left + r.width / 2 + (Math.random() - 0.5) * 60 + 'px';
      d.style.top = r.top + r.height * 0.3 + 'px';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 1600);
    },
    anim(el, cls) {
      if (!el || reduced()) return;
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 600);
    },
  };
})(window.MR = window.MR || {});

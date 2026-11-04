/* =========================================================================
 * Audio — efeitos e trilha 100% sintetizados com Web Audio (sem arquivos).
 * ========================================================================= */
(function (MR) {
  'use strict';
  let ctx = null, master = null, musicGain = null, music = null;

  const settings = () => (MR.Store.get() && MR.Store.get().settings) || {};

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.value = settings().volume ?? 0.6;
    return ctx;
  }

  function tone({ freq = 440, to = null, type = 'sine', dur = 0.2, vol = 0.3, delay = 0, attack = 0.005, filter = null }) {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (filter) { const f = c.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; o.connect(f); node = f; }
    node.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.25, vol = 0.3, delay = 0, freq = 1200, type = 'bandpass', q = 1 }) {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const notes = (base, steps) => steps.map((s) => base * Math.pow(2, s / 12));

  const SFX = {
    click() { tone({ freq: 880, dur: 0.05, vol: 0.06, type: 'triangle' }); },
    start() {
      noise({ dur: 0.6, vol: 0.18, freq: 400, type: 'lowpass' });
      notes(146.8, [0, 7, 12]).forEach((f, i) => tone({ freq: f, dur: 0.9, vol: 0.12, type: 'sawtooth', delay: i * 0.09, filter: { freq: 1400 } }));
    },
    hit() { noise({ dur: 0.18, vol: 0.35, freq: 2500, q: 0.8 }); tone({ freq: 180, to: 60, dur: 0.22, vol: 0.35, type: 'square', filter: { freq: 900 } }); },
    crit() {
      noise({ dur: 0.35, vol: 0.4, freq: 3500, q: 0.6 });
      tone({ freq: 220, to: 50, dur: 0.4, vol: 0.45, type: 'sawtooth', filter: { freq: 1200 } });
      notes(880, [0, 4, 7, 12]).forEach((f, i) => tone({ freq: f, dur: 0.25, vol: 0.08, type: 'triangle', delay: 0.05 + i * 0.04 }));
    },
    kill() {
      tone({ freq: 90, to: 30, dur: 1.4, vol: 0.5, type: 'sawtooth', filter: { freq: 600 } });
      noise({ dur: 1.2, vol: 0.3, freq: 300, type: 'lowpass' });
      notes(261.6, [0, 3, 7, 10, 15]).forEach((f, i) => tone({ freq: f, dur: 0.8, vol: 0.1, type: 'triangle', delay: 0.4 + i * 0.12 }));
    },
    pause() { tone({ freq: 520, to: 330, dur: 0.18, vol: 0.12, type: 'triangle' }); },
    resume() { tone({ freq: 330, to: 520, dur: 0.18, vol: 0.12, type: 'triangle' }); },
    complete() { notes(523.25, [0, 4, 7, 12, 16]).forEach((f, i) => tone({ freq: f, dur: 0.6, vol: 0.12, type: 'sine', delay: i * 0.11 })); },
    loot(rarity = 'uncommon') {
      const steps = { uncommon: [0, 7], rare: [0, 4, 7], epic: [0, 4, 7, 11], legendary: [0, 4, 7, 11, 14, 19] }[rarity] || [0, 7];
      steps.forEach((s, i) => tone({ freq: 659.25 * Math.pow(2, s / 12), dur: 0.7, vol: 0.12, type: 'triangle', delay: i * 0.08 }));
      if (rarity === 'legendary' || rarity === 'epic') noise({ dur: 1.0, vol: 0.12, freq: 6000, type: 'highpass', delay: 0.1 });
    },
    levelUp() {
      notes(392, [0, 4, 7, 12]).forEach((f, i) => tone({ freq: f, dur: 0.35, vol: 0.14, type: 'square', delay: i * 0.1, filter: { freq: 2400 } }));
      tone({ freq: 784, dur: 1.2, vol: 0.12, type: 'triangle', delay: 0.42 });
    },
    error() { tone({ freq: 200, to: 140, dur: 0.2, vol: 0.12, type: 'square', filter: { freq: 800 } }); },
  };

  /* Trilha ambiente: drone grave com filtro respirando e sinos esparsos */
  function startMusic() {
    const c = ensure(); if (!c || music) return;
    musicGain = c.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    musicGain.gain.linearRampToValueAtTime(0.16, c.currentTime + 3);
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 500; filt.connect(musicGain);
    const lfo = c.createOscillator(); const lfoG = c.createGain(); lfo.frequency.value = 0.05; lfoG.gain.value = 260;
    lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
    const oscs = [55, 82.4, 110.2, 164.8].map((f, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6;
      const g = c.createGain(); g.gain.value = 0.25 / (i + 1); o.connect(g); g.connect(filt); o.start(); return o;
    });
    const scale = notes(220, [0, 3, 5, 7, 10, 12, 15]);
    const bell = setInterval(() => {
      if (!musicGain) return;
      const f = scale[Math.floor(Math.random() * scale.length)];
      const t0 = c.currentTime; const o = c.createOscillator(); const g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * 2;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
      o.connect(g); g.connect(musicGain); o.start(t0); o.stop(t0 + 4.2);
    }, 3800);
    music = { oscs, lfo, bell };
  }
  function stopMusic() {
    if (!music) return;
    const c = ctx; const g = musicGain; const m = music;
    g.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);
    clearInterval(m.bell);
    setTimeout(() => { m.oscs.forEach((o) => o.stop()); m.lfo.stop(); g.disconnect(); }, 1400);
    music = null; musicGain = null;
  }

  MR.Audio = {
    play(name, arg) { if (settings().sound === false) return; try { SFX[name] && SFX[name](arg); } catch (e) { /* sem áudio */ } },
    setVolume(v) { if (master) master.gain.value = v; },
    syncMusic() { if (settings().music) startMusic(); else stopMusic(); },
    unlock() { ensure(); if (settings().music) startMusic(); },
  };
})(window.MR = window.MR || {});

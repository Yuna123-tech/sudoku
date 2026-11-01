/* 효과음: 소리 파일 없이 브라우저에서 바로 만들어 냄 (오프라인에서도 동작)
   Sfx.play('tap' | 'note' | 'erase' | 'wrong' | 'win' | 'lose' | 'stone' | 'piece' | 'capture')
   Sfx.enabled 를 false로 하면 소리가 나지 않음 (설정 > 효과음) */
(function () {
  'use strict';
  let ctx = null;
  const getCtx = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  // 아이폰 등은 화면을 처음 누를 때 소리를 켤 수 있음
  const unlock = () => { if (Sfx.enabled) getCtx(); };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  function tone(c, t0, freq, dur, { type = 'sine', vol = 0.15, to = null } = {}) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  let noiseBuf = null;
  function knock(c, t0, { freq = 1800, q = 1.2, vol = 0.35, dur = 0.05 } = {}) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.1), c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(c.destination);
    s.start(t0); s.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    tap: (c, t) => tone(c, t, 880, 0.07, { to: 700, vol: 0.12 }),                 // 숫자 넣기
    note: (c, t) => tone(c, t, 1320, 0.04, { vol: 0.06 }),                         // 메모
    erase: (c, t) => tone(c, t, 520, 0.06, { to: 380, vol: 0.08 }),                // 지우기
    wrong: (c, t) => { tone(c, t, 240, 0.12, { type: 'triangle', vol: 0.16 }); tone(c, t + 0.13, 190, 0.16, { type: 'triangle', vol: 0.16 }); },
    win: (c, t) => [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.11, f, 0.22, { type: 'triangle', vol: 0.13 })),
    lose: (c, t) => [392, 330, 262].forEach((f, i) => tone(c, t + i * 0.14, f, 0.24, { type: 'triangle', vol: 0.12 })),
    draw: (c, t) => [523, 523].forEach((f, i) => tone(c, t + i * 0.14, f, 0.18, { type: 'triangle', vol: 0.1 })),
    stone: (c, t) => { knock(c, t, { freq: 2200, q: 2, vol: 0.5, dur: 0.045 }); tone(c, t, 210, 0.07, { vol: 0.12 }); },   // 바둑돌·오목·오델로
    piece: (c, t) => { knock(c, t, { freq: 900, q: 1, vol: 0.45, dur: 0.06 }); tone(c, t, 150, 0.08, { vol: 0.14 }); },    // 체스·장기 말
    capture: (c, t) => { SOUNDS.piece(c, t); knock(c, t + 0.07, { freq: 1500, q: 1.5, vol: 0.35, dur: 0.05 }); },
  };

  const Sfx = {
    enabled: true,
    play(name) {
      if (!Sfx.enabled || !SOUNDS[name]) return;
      const c = getCtx();
      if (!c) return;
      try { SOUNDS[name](c, c.currentTime + 0.005); } catch { /* 소리가 안 나도 게임은 계속 */ }
    },
  };
  // 저장된 설정 반영 (기본: 켬)
  try { const s = JSON.parse(localStorage.getItem('sudoku:settings') || '{}'); if (s.sound === false) Sfx.enabled = false; } catch { /* 무시 */ }
  window.Sfx = Sfx;
})();

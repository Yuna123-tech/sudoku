/* 체스·장기·바둑 화면: 탭 전환, 판 그리기, 대국 진행, 컴퓨터, 저장·기록 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const LEVELS = ['beginner', 'easy', 'medium', 'hard', 'expert'];
  const AI_MIN_DELAY = 2000; // 컴퓨터가 수를 두기까지 최소 시간(ms)
  const KEY = 'sudoku:bg';

  /* ---------- 저장 (이 브라우저에만) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 실패는 무시 */ } },
  };
  const data = Object.assign({ game: 'sudoku', opts: {}, saves: {}, records: {}, recent: [] }, store.get(KEY, {}));
  const saveData = () => store.set(KEY, data);

  /* ---------- 문구 ---------- */
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'ko');
  const t = (k, p) => {
    let s = (I18N[lang()] || I18N.ko)[k] ?? I18N.ko[k] ?? k;
    if (p) for (const [a, b] of Object.entries(p)) s = s.split(`{${a}}`).join(b);
    return s;
  };
  const fmt = (s) => { const m = Math.floor(s / 60), x = s % 60; return `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
  const sideName = (game, s) => t(`side.${game}.${s}`);
  const levelName = (l) => t(`d.${l}`);
  const toast = (m) => window.SudokuApp && window.SudokuApp.toast(m);
  const openDialog = (title, html) => window.SudokuApp && window.SudokuApp.openDialog(title, html);

  /* ---------- 게임별 정의 ---------- */
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const HANJA = { c: { K: '楚', A: '士', R: '車', C: '包', N: '馬', E: '象', P: '卒' }, h: { K: '漢', A: '士', R: '車', C: '包', N: '馬', E: '象', P: '兵' } };
  const STAR = { 9: [2, 4, 6], 13: [3, 6, 9], 19: [3, 9, 15] };
  // 아주 작은 글자 크기에서는 브라우저가 글자 위치를 부정확하게 잡으므로,
  // 100배 큰 글자로 배치한 뒤 0.01배로 줄여서 칸 가운데에 정확히 놓음
  const label = (x, y, size, cls, content, extra = '') =>
    `<text class="${cls}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(0.01)" font-size="${Math.round(size * 100)}" ${extra}>${content}</text>`;
  // 입체감을 위한 그라데이션·그림자
  const SVG_DEFS = `<defs>
    <radialGradient id="g-sb" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#77746c"/><stop offset=".35" stop-color="#2c2a26"/><stop offset="1" stop-color="#050505"/></radialGradient>
    <radialGradient id="g-sw" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eeebe3"/><stop offset="1" stop-color="#bdb6a6"/></radialGradient>
    <linearGradient id="g-cw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f1ebde"/><stop offset="1" stop-color="#cfc4ae"/></linearGradient>
    <linearGradient id="g-cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#57524a"/><stop offset=".45" stop-color="#2a2722"/><stop offset="1" stop-color="#0d0c0a"/></linearGradient>
    <linearGradient id="g-jp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#eadcc0"/></linearGradient>
    <filter id="f-stone" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".05" dy=".07" stdDeviation=".05" flood-color="#000" flood-opacity=".45"/></filter>
    <filter id="f-piece" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000" flood-opacity=".4"/></filter>
    <filter id="f-jp" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".03" dy=".05" stdDeviation=".04" flood-color="#000" flood-opacity=".4"/></filter>
  </defs>`;

  const DEFS = {
    chess: {
      sides: ['w', 'b'],
      defaults: { mode: 'ai', level: 'easy', mySide: 'w' },
      create: () => ChessEngine.create(),
      apply: (st, mv) => !!ChessEngine.play(st, mv),
      turn: (st) => st.turn,
      status: (st) => ChessEngine.status(st),
      inCheck: (st) => ChessEngine.inCheck(st),
      canPass: () => false,
      aspect: 1,
    },
    janggi: {
      sides: ['c', 'h'],
      defaults: { mode: 'ai', level: 'easy', mySide: 'c', setupCho: '마상상마', setupHan: '마상상마' },
      create: (o) => JanggiEngine.create(o.setupCho, o.setupHan),
      apply: (st, mv) => !!JanggiEngine.play(st, mv),
      turn: (st) => st.turn,
      status: (st) => JanggiEngine.status(st),
      inCheck: (st) => JanggiEngine.inCheck(st),
      canPass: (st) => JanggiEngine.canPass(st),
      aspect: 9.2 / 10.2,
    },
    baduk: {
      sides: [1, 2],
      defaults: { mode: 'ai', level: 'easy', mySide: 1, size: 9 },
      create: (o) => GoEngine.create(o.size || 9),
      apply: (st, mv) => GoEngine.play(st, mv),
      turn: (st) => st.turn,
      status: () => null, // 바둑은 두 번 연속 패스 후 계가로 끝남
      inCheck: () => false,
      canPass: () => true,
      aspect: 1,
    },
    omok: {
      sides: [1, 2],
      defaults: { mode: 'ai', level: 'easy', mySide: 1, rule: 'renju' },
      create: (o) => OmokEngine.create(o.rule || 'renju'),
      apply: (st, mv) => OmokEngine.play(st, mv),
      turn: (st) => st.turn,
      status: (st) => OmokEngine.status(st),
      inCheck: () => false,
      canPass: () => false,
      aspect: 1,
    },
  };

  /* ---------- 현재 대국 ---------- */
  let G = null; // { id, def, opts, moves, st, elapsed, hints, over, sel, targets, hint, thinking, scoring, paused }
  let reqId = 0;

  const isAiTurn = () => G && G.opts.mode === 'ai' && G.def.turn(G.st) !== G.opts.mySide;
  const flipped = () => {
    if (!G) return false;
    if (G.id === 'chess') return G.opts.mode === 'ai' && G.opts.mySide === 'b';
    if (G.id === 'janggi') return G.opts.mode === 'ai' && G.opts.mySide === 'h';
    return false;
  };

  function rebuild() {
    G.st = G.def.create(G.opts);
    for (const m of G.moves) G.def.apply(G.st, m);
  }

  function persist() {
    if (!G) return;
    if (G.over) { delete data.saves[G.id]; saveData(); return; }
    data.saves[G.id] = { opts: G.opts, moves: G.moves, elapsed: G.elapsed, hints: G.hints, scoring: G.scoring ? { dead: G.scoring.dead } : null };
    saveData();
  }

  function resolveOpts(id, o) {
    const opts = Object.assign({}, DEFS[id].defaults, o);
    if (opts.mySide === 'random') {
      const s = DEFS[id].sides;
      opts.mySide = s[Math.floor(Math.random() * 2)];
    }
    if (id === 'janggi' && opts.mode === 'ai') {
      // 컴퓨터 상차림은 무작위
      const ai = JanggiEngine.SETUPS[Math.floor(Math.random() * 4)];
      if (opts.mySide === 'c') opts.setupHan = ai; else opts.setupCho = ai;
    }
    return opts;
  }

  function startGame(id, o) {
    G = { id, def: DEFS[id], opts: resolveOpts(id, o), moves: [], elapsed: 0, hints: 0, over: null, sel: -1, targets: [], hint: null, thinking: false, scoring: null, paused: false };
    rebuild();
    persist();
    render();
    if (isAiTurn()) aiMove();
  }

  function resumeGame(id) {
    const s = data.saves[id];
    if (!s) return false;
    G = { id, def: DEFS[id], opts: s.opts, moves: s.moves || [], elapsed: s.elapsed || 0, hints: s.hints || 0, over: null, sel: -1, targets: [], hint: null, thinking: false, scoring: null, paused: false };
    try { rebuild(); } catch { return false; }
    if (s.scoring) G.scoring = { dead: s.scoring.dead || [] };
    render();
    if (!G.scoring && isAiTurn()) aiMove();
    return true;
  }

  /* ---------- 컴퓨터 (웹 워커) ---------- */
  let worker = null;
  const pending = new Map();
  try {
    worker = new Worker('ai-worker.js');
    worker.onmessage = (e) => { const cb = pending.get(e.data.id); if (cb) { pending.delete(e.data.id); cb(e.data.result); } };
    worker.onerror = () => { worker = null; };
  } catch { worker = null; }

  function ask(task, level) {
    const id = ++reqId, game = G.id, opts = G.opts, moves = G.moves.slice();
    return new Promise((resolve) => {
      if (worker) {
        pending.set(id, (r) => resolve({ id, r }));
        worker.postMessage({ id, game, opts, moves, level, task });
      } else {
        setTimeout(() => {
          const st = DEFS[game].create(opts);
          for (const m of moves) DEFS[game].apply(st, m);
          let r;
          if (game === 'baduk') r = task === 'dead' ? GoEngine.estimateDead(st, 400) : GoEngine.bestMove(st, level);
          else if (game === 'omok') r = OmokEngine.bestMove(st, level);
          else {
            const m = (game === 'chess' ? ChessEngine : JanggiEngine).bestMove(st, level);
            r = m ? (m.pass ? { pass: true } : { from: m.from, to: m.to, promo: m.promo || null }) : null;
          }
          resolve({ id, r });
        }, 30);
      }
    });
  }

  async function aiMove() {
    if (!G || G.over || G.scoring) return;
    G.thinking = true;
    renderStatus();
    const game = G, started = Date.now();
    const { id, r } = await ask('move', G.opts.level);
    // 사람처럼 생각하는 시간: 최소 2초 뒤에 둠
    const wait = AI_MIN_DELAY - (Date.now() - started);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    if (G !== game || id !== reqId || G.over) return; // 그사이 무르기·새 대국
    G.thinking = false;
    if (r == null) { renderStatus(); return; }
    commit(r);
  }

  /* ---------- 수 두기 ---------- */
  function commit(mv) {
    const st = G.st;
    if (!G.def.apply(st, mv)) { toast(t('bg.illegal')); return false; }
    G.moves.push(mv);
    G.sel = -1; G.targets = []; G.hint = null;
    if (mv && mv.pass) toast(t('bg.passed', { side: sideName(G.id, G.def.turn(st) === G.def.sides[0] ? G.def.sides[1] : G.def.sides[0]) }));
    if (G.id === 'baduk' && mv === -1) toast(t('bg.passed', { side: sideName('baduk', st.turn === 1 ? 2 : 1) }));
    if (G.id === 'baduk' && st.passes >= 2) { enterScoring(); return true; }
    const s = G.def.status(st);
    if (s) finish(s.winner, G.id === 'janggi' && (s.reason === 'checkmate' || s.reason === 'repetition') ? `janggi.${s.reason}` : s.reason, s);
    else if (G.def.inCheck(st)) toast(t(`bg.check.${G.id}`));
    persist();
    render();
    if (!G.over && isAiTurn()) aiMove();
    return true;
  }

  function finish(winner, reason, extra) {
    G.over = { winner, reason, extra: extra || null };
    G.thinking = false;
    const rec = data.records[G.id] = data.records[G.id] || {};
    let result;
    if (G.opts.mode === 'ai') {
      result = winner == null ? 'draw' : winner === G.opts.mySide ? 'win' : 'loss';
      const r = rec[G.opts.level] = rec[G.opts.level] || { w: 0, l: 0, d: 0 };
      r[result[0]]++;
    } else {
      rec.pvp = (rec.pvp || 0) + 1;
      result = 'pvp';
    }
    data.recent.unshift({ game: G.id, mode: G.opts.mode, level: G.opts.level, result, winner, reason, moves: G.moves.length, time: G.elapsed, date: Date.now() });
    data.recent = data.recent.slice(0, 100);
    persist();
    render();
    showOverlay(overResult);
  }

  function overResult() {
    const o = G.over;
    let head;
    if (G.opts.mode === 'ai') head = o.winner == null ? t('bg.draw') : o.winner === G.opts.mySide ? '🎉 ' + t('bg.win') : t('bg.loss');
    else head = o.winner == null ? t('bg.draw') : '🎉 ' + t('bg.sideWins', { side: sideName(G.id, o.winner) });
    let detail = t(`r.${o.reason}`);
    if (o.extra && o.extra.points) detail += `<br>${t('bg.points', { c: o.extra.points.c, h: o.extra.points.h })}`;
    if (o.extra && o.extra.score) {
      const sc = o.extra.score;
      detail = `${t('bg.scoreLine', { b: sc.black, w: sc.white })}<br><b>${t('bg.goResult', { side: sideName('baduk', sc.winner), m: sc.margin })}</b>`;
    }
    return `<h3>${head}</h3><p>${detail}<br>${t('bg.moves', { n: G.moves.length })} · ${fmt(G.elapsed)}</p>
      <div class="actions"><button class="btn primary" data-act="bg-new">${t('bg.newGame')}</button><button class="btn" data-act="bg-records">${t('top.records')}</button></div>`;
  }

  /* ---------- 바둑 계가 ---------- */
  async function enterScoring() {
    G.scoring = { dead: [], loading: true };
    persist();
    render();
    const game = G;
    const { r } = await ask('dead');
    if (G !== game || !G.scoring) return;
    G.scoring = { dead: r || [] };
    persist();
    render();
  }
  function toggleDead(p) {
    const grp = GoEngine.groupAt(G.st, p);
    if (!grp.length) return;
    const set = new Set(G.scoring.dead);
    const isDead = set.has(grp[0]);
    for (const q of grp) isDead ? set.delete(q) : set.add(q);
    G.scoring.dead = [...set];
    persist();
    render();
  }
  function confirmScore() {
    const sc = GoEngine.score(G.st, G.scoring.dead);
    G.scoring = null;
    finish(sc.winner, 'score', { score: sc });
  }
  function resumePlay() {
    G.scoring = null;
    // 패스 두 번을 무르고 이어 둠
    while (G.moves.length && G.moves[G.moves.length - 1] === -1) G.moves.pop();
    rebuild();
    persist();
    render();
    if (isAiTurn()) aiMove();
  }

  /* ---------- 판 클릭 ---------- */
  function boardPoint(e) {
    const svg = $('bg-board');
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    let r, c;
    if (G.id === 'chess') { r = Math.floor(p.y); c = Math.floor(p.x); if (flipped()) { r = 7 - r; c = 7 - c; } if (r < 0 || r > 7 || c < 0 || c > 7) return null; }
    else if (G.id === 'janggi') { r = Math.round(p.y - 0.6); c = Math.round(p.x - 0.6); if (flipped()) { r = 9 - r; c = 8 - c; } if (r < 0 || r > 9 || c < 0 || c > 8) return null; }
    else { const N = G.st.N; r = Math.round(p.y - 1); c = Math.round(p.x - 1); if (r < 0 || r >= N || c < 0 || c >= N) return null; }
    return { r, c };
  }

  function onBoard(e) {
    if (!G || G.over || G.paused) return;
    const pos = boardPoint(e);
    if (!pos) return;
    if (G.id === 'omok') {
      if (G.thinking || isAiTurn()) return;
      const p = pos.r * G.st.N + pos.c;
      if (G.st.b[p]) return;
      const why = OmokEngine.forbidden(G.st, p);
      if (why) { toast(t(`omok.${why}`)); return; }
      commit(p);
      return;
    }
    if (G.id === 'baduk') {
      const p = pos.r * G.st.N + pos.c;
      if (G.scoring) { if (!G.scoring.loading) toggleDead(p); return; }
      if (G.thinking || isAiTurn()) return;
      if (!GoEngine.isLegal(G.st, p)) { toast(t('bg.illegal')); return; }
      commit(p);
      return;
    }
    if (G.thinking || isAiTurn()) return;
    const cols = G.id === 'chess' ? 8 : 9;
    const i = pos.r * cols + pos.c;
    const st = G.st, me = G.def.turn(st);
    const own = G.id === 'chess' ? ChessEngine.colorOf(st.b[i]) === me : st.b[i] && st.b[i][0] === me;
    const tgt = G.targets.filter((m) => m.to === i);
    if (G.sel >= 0 && tgt.length) {
      if (tgt.length > 1) return askPromotion(tgt[0]);
      commit({ from: tgt[0].from, to: tgt[0].to, promo: tgt[0].promo || null });
      return;
    }
    if (own) {
      G.sel = i;
      const all = G.id === 'chess' ? ChessEngine.legalMoves(st) : JanggiEngine.legalMoves(st);
      G.targets = all.filter((m) => m.from === i);
    } else { G.sel = -1; G.targets = []; }
    renderBoard();
  }

  function askPromotion(m) {
    const white = G.def.turn(G.st) === 'w';
    openDialog(t('bg.promoteTitle'), `<p class="rule">${t('bg.promote')}</p><div class="promo-row">${['q', 'r', 'b', 'n'].map((p) =>
      `<button type="button" class="promo-btn ${white ? 'pw' : 'pb'}" data-promo="${p}">${GLYPH[p]}︎</button>`).join('')}</div>`);
    $('dlg-body').querySelectorAll('[data-promo]').forEach((b) => (b.onclick = () => {
      $('dlg').close();
      commit({ from: m.from, to: m.to, promo: b.dataset.promo });
    }));
  }

  /* ---------- 도구 ---------- */
  function takeback() {
    if (!G || G.over || !G.moves.length) { toast(t('noUndo')); return; }
    reqId++; G.thinking = false; G.scoring = null;
    G.moves.pop();
    rebuild();
    if (G.opts.mode === 'ai' && G.def.turn(G.st) !== G.opts.mySide && G.moves.length) { G.moves.pop(); rebuild(); }
    G.sel = -1; G.targets = []; G.hint = null;
    persist();
    render();
    if (isAiTurn()) aiMove();
  }

  async function hint() {
    if (!G || G.over || G.thinking || G.scoring || isAiTurn()) return;
    G.thinking = true; renderStatus();
    const game = G;
    const { id, r } = await ask('hint', 'hard');
    if (G !== game || id !== reqId) return;
    G.thinking = false;
    G.hints++;
    if (r == null) toast(t('bg.noHint'));
    else if (r === -1 || r.pass) toast(t('bg.hintPass'));
    else G.hint = r;
    persist();
    render();
  }

  function pass() {
    if (!G || G.over || G.thinking || G.scoring || isAiTurn()) return;
    if (G.id === 'janggi') { if (!G.def.canPass(G.st)) { toast(t('bg.cantPass')); return; } commit({ pass: true }); }
    else if (G.id === 'baduk') commit(-1);
  }

  function resign() {
    if (!G || G.over) return;
    if (!confirm(t('bg.confirmResign'))) return;
    reqId++;
    const loser = G.opts.mode === 'ai' ? G.opts.mySide : G.def.turn(G.st);
    const winner = G.def.sides[0] === loser ? G.def.sides[1] : G.def.sides[0];
    G.scoring = null;
    finish(winner, 'resign');
  }

  /* ---------- 새 대국 설정 ---------- */
  function newGameDialog() {
    const id = G ? G.id : data.game;
    const o = Object.assign({}, DEFS[id].defaults, data.opts[id] || {});
    const seg = (name, items, cur) => `<div class="seg" data-name="${name}">${items.map(([v, label]) =>
      `<button type="button" class="chip ${String(v) === String(cur) ? 'active' : ''}" data-v="${v}">${label}</button>`).join('')}</div>`;
    const sides = DEFS[id].sides.map((s) => [s, sideName(id, s) + (s === DEFS[id].sides[0] ? (lang() === 'en' ? ' (first)' : ' (먼저)') : '')]);
    let html = `<div class="ng"><label>${t('bg.mode')}</label>${seg('mode', [['ai', t('bg.mode.ai')], ['pvp', t('bg.mode.pvp')]], o.mode)}
      <div class="ai-only"><label>${t('bg.level')}</label>${seg('level', LEVELS.map((l) => [l, levelName(l)]), o.level)}
      <label>${t('bg.mySide')}</label>${seg('mySide', [...sides, ['random', t('bg.random')]], o.mySide)}</div>`;
    if (id === 'baduk') html += `<label>${t('bg.size')}</label>${seg('size', [9, 13, 19].map((n) => [n, t('bg.lines', { n })]), o.size)}`;
    if (id === 'omok') html += `<label>${t('omok.rule')}</label>${seg('rule', [['renju', t('omok.rule.renju')], ['free', t('omok.rule.free')]], o.rule)}<p class="hint-text">${t('omok.ruleHelp')}</p>`;
    if (id === 'janggi') {
      const setups = JanggiEngine.SETUPS.map((s) => [s, s]);
      html += `<div class="ai-only"><label>${t('bg.setup')} <small>${t('bg.setupHint')}</small></label>${seg('setupMine', setups, o.mySide === 'h' ? o.setupHan : o.setupCho)}</div>
        <div class="pvp-only"><label>${t('bg.setupCho')}</label>${seg('setupCho', setups, o.setupCho)}<label>${t('bg.setupHan')}</label>${seg('setupHan', setups, o.setupHan)}</div>`;
    }
    html += `<button type="button" class="btn primary ng-start" id="ng-start">${t('bg.start')}</button></div>`;
    openDialog(`${t(`tab.${id}`)} · ${t('bg.newGame')}`, html);
    const body = $('dlg-body');
    const vals = { mode: o.mode, level: o.level, mySide: o.mySide, size: o.size, rule: o.rule, setupCho: o.setupCho, setupHan: o.setupHan, setupMine: o.mySide === 'h' ? o.setupHan : o.setupCho };
    const sync = () => { body.querySelector('.ng').dataset.mode = vals.mode; };
    body.querySelectorAll('.seg').forEach((sg) => sg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      sg.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b));
      vals[sg.dataset.name] = b.dataset.v;
      sync();
    }));
    sync();
    $('ng-start').onclick = () => {
      const opts = { mode: vals.mode, level: vals.level, mySide: vals.mySide };
      if (id === 'chess') { /* 기본값 */ }
      if (id === 'baduk') { opts.size = +vals.size; if (opts.mySide !== 'random') opts.mySide = +opts.mySide; }
      if (id === 'omok') { opts.rule = vals.rule; if (opts.mySide !== 'random') opts.mySide = +opts.mySide; }
      if (id === 'janggi') {
        if (vals.mode === 'ai') { opts.setupCho = vals.setupMine; opts.setupHan = vals.setupMine; }
        else { opts.setupCho = vals.setupCho; opts.setupHan = vals.setupHan; }
      }
      if (vals.mode === 'pvp') opts.mySide = DEFS[id].sides[0];
      data.opts[id] = Object.assign({}, opts, id === 'janggi' && vals.mode === 'ai' ? { setupCho: vals.setupMine, setupHan: vals.setupMine } : {});
      saveData();
      $('dlg').close();
      reqId++;
      hideOverlay();
      startGame(id, opts);
    };
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (!G) return;
    document.documentElement.dataset.variant = G.id;
    renderBoard();
    renderStatus();
    renderTools();
    renderSide();
  }

  function renderBoard() {
    const svg = $('bg-board');
    const wrap = $('bg-wrap');
    wrap.style.setProperty('--ar', G.def.aspect);
    svg.setAttribute('viewBox', G.id === 'chess' ? '0 0 8 8' : G.id === 'janggi' ? '0 0 9.2 10.2' : `0 0 ${G.st.N + 1} ${G.st.N + 1}`);
    let html = '';
    if (G.id === 'chess') html = drawChess();
    else if (G.id === 'janggi') html = drawJanggi();
    else if (G.id === 'omok') html = drawOmok();
    else html = drawGo();
    svg.innerHTML = SVG_DEFS + html;
  }

  function drawChess() {
    const st = G.st, f = flipped(), last = G.moves.length ? G.moves[G.moves.length - 1] : null;
    const pos = (s) => { let r = s >> 3, c = s & 7; if (f) { r = 7 - r; c = 7 - c; } return [c, r]; };
    let h = '';
    for (let s = 0; s < 64; s++) {
      const [x, y] = pos(s), dark = ((s >> 3) + (s & 7)) % 2 === 1;
      let cls = dark ? 'sq-d' : 'sq-l';
      if (last && (last.from === s || last.to === s)) cls += ' sq-last';
      if (G.sel === s) cls += ' sq-sel';
      if (G.hint && (G.hint.from === s || G.hint.to === s)) cls += ' sq-hint';
      h += `<rect class="${cls}" x="${x}" y="${y}" width="1" height="1"/>`;
    }
    // 체크된 킹
    if (ChessEngine.inCheck(st)) { const [x, y] = pos(st.kings[st.turn]); h += `<circle class="check-glow" cx="${x + 0.5}" cy="${y + 0.5}" r="0.48"/>`; }
    // 좌표
    for (let i = 0; i < 8; i++) {
      const file = 'abcdefgh'[f ? 7 - i : i], rank = f ? i + 1 : 8 - i;
      h += label(i + 0.9, 7.9, 0.17, 'coord', file, 'text-anchor="middle"') + label(0.08, i + 0.15, 0.17, 'coord', rank);
    }
    for (let s = 0; s < 64; s++) {
      const p = st.b[s];
      if (!p) continue;
      const [x, y] = pos(s), white = p === p.toUpperCase();
      h += label(x + 0.5, y + 0.5, 0.82, `cp ${white ? 'cw' : 'cb'}`, GLYPH[p.toLowerCase()] + '\uFE0E');
    }
    for (const m of G.targets.filter((x, i, arr) => arr.findIndex((y) => y.to === x.to) === i)) {
      const [x, y] = pos(m.to);
      h += st.b[m.to] || (m.flags && m.flags.includes('e')) ? `<circle class="tgt-cap" cx="${x + 0.5}" cy="${y + 0.5}" r="0.44"/>` : `<circle class="tgt" cx="${x + 0.5}" cy="${y + 0.5}" r="0.15"/>`;
    }
    return h;
  }

  function drawJanggi() {
    const st = G.st, f = flipped(), O = 0.6;
    const P = (r, c) => (f ? [8 - c + O, 9 - r + O] : [c + O, r + O]);
    let h = `<rect class="jg-bg" x="0" y="0" width="9.2" height="10.2" rx="0.25"/>`;
    for (let r = 0; r < 10; r++) h += `<line class="jg-l" x1="${O}" y1="${r + O}" x2="${8 + O}" y2="${r + O}"/>`;
    for (let c = 0; c < 9; c++) h += `<line class="jg-l" x1="${c + O}" y1="${O}" x2="${c + O}" y2="${9 + O}"/>`;
    for (const [r1, c1, r2, c2] of [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]]) {
      const [x1, y1] = P(r1, c1), [x2, y2] = P(r2, c2);
      h += `<line class="jg-l" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }
    const last = [...G.moves].reverse().find((m) => !m.pass);
    if (last && G.moves.length) {
      for (const i of [last.from, last.to]) { const [x, y] = P(Math.floor(i / 9), i % 9); h += `<circle class="jg-last" cx="${x}" cy="${y}" r="0.46"/>`; }
    }
    if (G.hint && !G.hint.pass) for (const i of [G.hint.from, G.hint.to]) { const [x, y] = P(Math.floor(i / 9), i % 9); h += `<circle class="jg-hint" cx="${x}" cy="${y}" r="0.48"/>`; }
    const checked = JanggiEngine.inCheck(st) ? st.b.indexOf(st.turn + 'K') : -1;
    const oct = (x, y, rad) => {
      const pts = [];
      for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; pts.push(`${(x + rad * Math.cos(a)).toFixed(3)},${(y + rad * Math.sin(a)).toFixed(3)}`); }
      return pts.join(' ');
    };
    for (let i = 0; i < 90; i++) {
      const p = st.b[i];
      if (!p) continue;
      const [x, y] = P(Math.floor(i / 9), i % 9), side = p[0], tp = p[1];
      const rad = tp === 'K' ? 0.46 : tp === 'A' || tp === 'P' ? 0.32 : 0.4;
      let cls = `jp jp-${side}`;
      if (G.sel === i) cls += ' jp-sel';
      if (checked === i) cls += ' jp-check';
      h += `<polygon class="${cls}" points="${oct(x, y, rad)}"/>` + label(x, y, rad * 1.15, `jt jt-${side}`, HANJA[side][tp]);
    }
    for (const m of G.targets) {
      const [x, y] = P(Math.floor(m.to / 9), m.to % 9);
      h += st.b[m.to] ? `<circle class="tgt-cap" cx="${x}" cy="${y}" r="0.45"/>` : `<circle class="tgt" cx="${x}" cy="${y}" r="0.14"/>`;
    }
    return h;
  }

  function drawGo() {
    const st = G.st, N = st.N;
    let h = `<rect class="go-bg" x="0" y="0" width="${N + 1}" height="${N + 1}" rx="0.3"/>`;
    for (let i = 0; i < N; i++) {
      h += `<line class="go-l" x1="1" y1="${i + 1}" x2="${N}" y2="${i + 1}"/><line class="go-l" x1="${i + 1}" y1="1" x2="${i + 1}" y2="${N}"/>`;
    }
    for (const r of STAR[N] || []) for (const c of STAR[N] || []) {
      if (N === 9 && (r === 4) !== (c === 4)) continue;
      h += `<circle class="go-star" cx="${c + 1}" cy="${r + 1}" r="${N > 13 ? 0.12 : 0.1}"/>`;
    }
    const dead = new Set(G.scoring ? G.scoring.dead : []);
    let owner = null;
    if (G.scoring && !G.scoring.loading) owner = GoEngine.score(st, G.scoring.dead).owner;
    for (let p = 0; p < N * N; p++) {
      const v = st.b[p], x = (p % N) + 1, y = Math.floor(p / N) + 1;
      if (v) h += `<circle class="stone ${v === 1 ? 'sb' : 'sw'}${dead.has(p) ? ' s-dead' : ''}" cx="${x}" cy="${y}" r="0.47"/>`
        + (v === 1 && !dead.has(p) ? `<ellipse class="glint" cx="${x - 0.15}" cy="${y - 0.17}" rx="0.13" ry="0.08" transform="rotate(-35 ${x - 0.15} ${y - 0.17})"/>` : '');
      if (owner && (owner[p] === 1 || owner[p] === 2) && (!v || dead.has(p))) h += `<rect class="terr ${owner[p] === 1 ? 'tb' : 'tw'}" x="${x - 0.17}" y="${y - 0.17}" width="0.34" height="0.34"/>`;
    }
    if (st.last >= 0 && st.last != null && !G.scoring) {
      const x = (st.last % N) + 1, y = Math.floor(st.last / N) + 1;
      h += `<circle class="go-last ${st.b[st.last] === 1 ? 'on-b' : 'on-w'}" cx="${x}" cy="${y}" r="0.16"/>`;
    }
    if (G.hint != null && typeof G.hint === 'number' && G.hint >= 0) {
      h += `<circle class="go-hint" cx="${(G.hint % N) + 1}" cy="${Math.floor(G.hint / N) + 1}" r="0.42"/>`;
    }
    return h;
  }

  function drawOmok() {
    const st = G.st, N = st.N;
    let h = `<rect class="go-bg" x="0" y="0" width="${N + 1}" height="${N + 1}" rx="0.3"/>`;
    for (let i = 0; i < N; i++) {
      h += `<line class="go-l" x1="1" y1="${i + 1}" x2="${N}" y2="${i + 1}"/><line class="go-l" x1="${i + 1}" y1="1" x2="${i + 1}" y2="${N}"/>`;
    }
    for (const [r, c] of [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]]) h += `<circle class="go-star" cx="${c + 1}" cy="${r + 1}" r="0.12"/>`;
    const win = new Set(st.winLine || []);
    for (let p = 0; p < N * N; p++) {
      const v = st.b[p], x = (p % N) + 1, y = Math.floor(p / N) + 1;
      if (!v) continue;
      h += `<circle class="stone ${v === 1 ? 'sb' : 'sw'}" cx="${x}" cy="${y}" r="0.47"/>` + (v === 1 ? `<ellipse class="glint" cx="${x - 0.15}" cy="${y - 0.17}" rx="0.13" ry="0.08" transform="rotate(-35 ${x - 0.15} ${y - 0.17})"/>` : '');
      if (win.has(p)) h += `<circle class="win-ring" cx="${x}" cy="${y}" r="0.3"/>`;
    }
    if (st.last >= 0 && !st.winner) h += `<circle class="go-last ${st.b[st.last] === 1 ? 'on-b' : 'on-w'}" cx="${(st.last % N) + 1}" cy="${Math.floor(st.last / N) + 1}" r="0.16"/>`;
    // 흑 차례(사람)일 때 금수 자리를 × 로 표시
    if (!G.over && !(G.opts.mode === 'ai' && st.turn !== G.opts.mySide)) {
      for (const p of OmokEngine.forbiddenPoints(st)) {
        const x = (p % N) + 1, y = Math.floor(p / N) + 1;
        h += `<path class="ban" d="M${x - 0.2} ${y - 0.2}L${x + 0.2} ${y + 0.2}M${x + 0.2} ${y - 0.2}L${x - 0.2} ${y + 0.2}"/>`;
      }
    }
    if (typeof G.hint === 'number' && G.hint >= 0) h += `<circle class="go-hint" cx="${(G.hint % N) + 1}" cy="${Math.floor(G.hint / N) + 1}" r="0.42"/>`;
    return h;
  }

  function renderStatus() {
    if (!G) return;
    $('bg-title').textContent = t(`tab.${G.id}`);
    $('bg-sub').textContent = G.opts.mode === 'ai' ? t('bg.vsAi', { level: levelName(G.opts.level) }) : t('bg.vsPvp');
    const turn = G.def.turn(G.st);
    let label;
    if (G.over) label = '';
    else if (G.thinking) label = t('bg.thinking');
    else if (G.scoring) label = t('bg.counting');
    else if (G.opts.mode === 'ai') label = turn === G.opts.mySide ? t('bg.myTurn') : t('bg.aiTurn');
    else label = t('bg.turnOf', { side: sideName(G.id, turn) });
    const chip = $('bg-turn');
    chip.innerHTML = label ? `<i class="dot-${G.id}-${turn}"></i>${label}` : '';
    chip.classList.toggle('thinking', !!G.thinking);
    $('bg-time').textContent = fmt(G.elapsed);
    // 정보 줄
    let info = '';
    if (G.id === 'chess') {
      const count = (c) => { const start = { p: 8, n: 2, b: 2, r: 2, q: 1 }; const now = { p: 0, n: 0, b: 0, r: 0, q: 0 }; for (const p of G.st.b) if (p && ChessEngine.colorOf(p) === c && p.toLowerCase() !== 'k') now[p.toLowerCase()]++; return Object.keys(start).map((k) => GLYPH[k].repeat(Math.max(0, start[k] - now[k]))).join(''); };
      info = `<span class="cap-w">${count('b')}</span><span class="cap-b">${count('w')}</span>`;
    } else if (G.id === 'janggi') {
      const p = JanggiEngine.points(G.st);
      info = t('bg.points', { c: p.c, h: p.h });
    } else if (G.id === 'omok') {
      info = `${t(`omok.rule.${G.st.rule}`)} · ${t('bg.moves', { n: G.st.moves })}`;
    } else {
      if (G.scoring && !G.scoring.loading) { const sc = GoEngine.score(G.st, G.scoring.dead); info = t('bg.scoreLine', { b: sc.black, w: sc.white }); }
      else info = t('bg.goCaps', { b: G.st.captures[1], w: G.st.captures[2], k: GoEngine.KOMI });
    }
    $('bg-info').innerHTML = info;
  }

  function renderTools() {
    const tools = $('bg-tools');
    if (G.id === 'baduk' && G.scoring) {
      tools.innerHTML = `<p class="score-help">${t('bg.scoring')}</p><button class="btn" id="bg-resume">${t('bg.resume')}</button><button class="btn primary" id="bg-count" ${G.scoring.loading ? 'disabled' : ''}>${t('bg.count')}</button>`;
      tools.className = 'tools scoring';
      $('bg-resume').onclick = resumePlay;
      $('bg-count').onclick = confirmScore;
      return;
    }
    tools.className = 'tools bg-tools';
    const passBtn = G.id === 'chess' || G.id === 'omok' ? '' : `<button class="tool" data-tool="pass"><span class="ti">${ICON.pass}</span><span>${t(`tool.pass.${G.id}`)}</span></button>`;
    tools.innerHTML = `<button class="tool" data-tool="undo"><span class="ti">${ICON.undo}</span><span>${t('tool.takeback')}</span></button>
      <button class="tool" data-tool="hint"><span class="ti">${ICON.bulb}</span><span>${t('tool.hint')}</span></button>
      ${passBtn}
      <button class="tool" data-tool="resign"><span class="ti">${ICON.flag}</span><span>${t('tool.resign')}</span></button>
      <button class="tool" data-tool="new"><span class="ti">${ICON.plus}</span><span>${t('bg.newGame')}</span></button>`;
  }

  function renderSide() {
    const id = G ? G.id : data.game;
    $('bg-rules').innerHTML = t(`rules.${id}`);
    $('bg-side-title').textContent = t(`tab.${id}`);
    if (G) {
      const o = G.opts;
      let s = o.mode === 'ai' ? `${t('bg.mode.ai')} · ${levelName(o.level)} · ${t('bg.mySide')}: ${sideName(id, o.mySide)}` : t('bg.mode.pvp');
      if (id === 'baduk') s += ` · ${t('bg.lines', { n: o.size })}`;
      if (id === 'omok') s += ` · ${t(`omok.rule.${o.rule}`)}`;
      if (id === 'janggi') s += ` · ${o.setupCho} / ${o.setupHan}`;
      document.querySelectorAll('#bg-mode [data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === o.mode));
      $('bg-side-sum').textContent = s;
    }
  }

  const ICON = {
    undo: '<svg class="ico" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    bulb: '<svg class="ico" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg>',
    pass: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
    flag: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg>',
    plus: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  };

  /* ---------- 오버레이 / 일시정지 ---------- */
  let overlayFn = null;
  function showOverlay(fn) { overlayFn = fn; $('bg-overlay-content').innerHTML = fn(); $('bg-overlay').classList.remove('hidden'); }
  function hideOverlay() { overlayFn = null; $('bg-overlay').classList.add('hidden'); }
  function togglePause() {
    if (!G || G.over) return;
    G.paused = !G.paused;
    $('bg-pause').innerHTML = G.paused ? '<svg class="ico" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>' : '<svg class="ico" viewBox="0 0 24 24"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>';
    if (G.paused) showOverlay(() => `<h3>${t('paused')}</h3><p>${fmt(G.elapsed)}</p><button class="btn primary" data-act="bg-resume-pause">${t('resume')}</button>`);
    else hideOverlay();
  }

  /* ---------- 기록 ---------- */
  function showRecords() {
    const id = G ? G.id : data.game;
    const rec = data.records[id] || {};
    let tw = 0, tl = 0, td = 0;
    const rows = LEVELS.map((l) => {
      const r = rec[l] || { w: 0, l: 0, d: 0 };
      tw += r.w; tl += r.l; td += r.d;
      const n = r.w + r.l + r.d;
      return `<tr><td>${levelName(l)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.d}</td><td>${n ? Math.round((r.w / n) * 100) + '%' : '–'}</td></tr>`;
    }).join('');
    const tn = tw + tl + td;
    const recent = data.recent.filter((x) => x.game === id).slice(0, 15).map((x) => {
      const res = x.result === 'pvp' ? (x.winner == null ? t('bg.draw') : t('bg.sideWins', { side: sideName(id, x.winner) })) : t(`bg.result${x.result[0].toUpperCase()}${x.result.slice(1)}`);
      const who = x.mode === 'ai' ? t('bg.vsAi', { level: levelName(x.level) }) : t('bg.vsPvp');
      return `<div class="list-item"><span><b>${res}</b> · ${who}<br><small>${new Date(x.date).toLocaleString(lang() === 'en' ? 'en-US' : 'ko-KR')}</small></span><small>${t(`r.${x.reason}`)}<br>${t('bg.moves', { n: x.moves })} · ${fmt(x.time)}</small></div>`;
    }).join('');
    openDialog(t('bg.records', { game: t(`tab.${id}`) }), `
      <div class="stat-row"><div class="stat"><b>${tw}</b><span>${t('bg.wins')}</span></div><div class="stat"><b>${tl}</b><span>${t('bg.losses')}</span></div><div class="stat"><b>${tn ? Math.round((tw / tn) * 100) + '%' : '–'}</b><span>${t('bg.winRate')}</span></div></div>
      <div class="tbl-wrap"><table><tr><th>${t('bg.level')}</th><th>${t('bg.wins')}</th><th>${t('bg.losses')}</th><th>${t('bg.draws')}</th><th>${t('bg.winRate')}</th></tr>${rows}
      <tr><td><b>${t('bg.total')}</b></td><td>${tw}</td><td>${tl}</td><td>${td}</td><td>${tn ? Math.round((tw / tn) * 100) + '%' : '–'}</td></tr></table></div>
      <p class="hint-text">${t('bg.pvpGames', { n: rec.pvp || 0 })}</p>
      <h3 class="sub">${t('bg.recent')}</h3><div class="list">${recent || `<p class="empty">${t('bg.noGames')}</p>`}</div>
      <p class="hint-text">${t('storageNote')}</p>`);
  }

  /* ---------- 탭 전환 ---------- */
  function switchTo(id) {
    if (G && G.id !== id) { persist(); reqId++; }
    data.game = id;
    saveData();
    document.body.dataset.game = id;
    document.querySelectorAll('#game-tabs [data-game]').forEach((b) => b.classList.toggle('active', b.dataset.game === id));
    if (id === 'sudoku') {
      G = null;
      hideOverlay();
      if (window.SudokuApp) window.SudokuApp.refresh();
      return;
    }
    hideOverlay();
    if (!resumeGame(id)) startGame(id, data.opts[id] || {});
    // 처음 여는 게임이면 게임 방법을 한 번 보여줌
    data.seenGuide = data.seenGuide || {};
    if (!data.seenGuide[id]) { data.seenGuide[id] = 1; saveData(); setTimeout(() => showGuide(id), 300); }
  }

  /* ---------- 이벤트 ---------- */
  $('game-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-game]');
    if (b && b.dataset.game !== data.game) switchTo(b.dataset.game);
  });
  $('bg-board').addEventListener('pointerdown', onBoard);
  $('bg-tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    ({ undo: takeback, hint, pass, resign, new: () => { if (G && !G.over && G.moves.length && !confirm(t('bg.confirmNew'))) return; newGameDialog(); } })[b.dataset.tool]();
  });
  $('bg-new').onclick = () => { if (G && !G.over && G.moves.length && !confirm(t('bg.confirmNew'))) return; newGameDialog(); };
  $('bg-side-new').onclick = $('bg-new').onclick;
  // 컴퓨터와 / 둘이서 바로 바꾸기 (새 대국으로 시작)
  $('bg-mode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b || !G || b.dataset.mode === G.opts.mode) return;
    if (!G.over && G.moves.length && !confirm(t('bg.confirmNew'))) return;
    const opts = Object.assign({}, DEFS[G.id].defaults, data.opts[G.id] || {}, { mode: b.dataset.mode });
    if (opts.mode === 'pvp') opts.mySide = DEFS[G.id].sides[0];
    data.opts[G.id] = opts;
    saveData();
    reqId++;
    hideOverlay();
    startGame(G.id, opts);
  });
  const showGuide = (id) => openDialog(`${t('howto')} · ${t(`tab.${id}`)}`, t(`guide.${id}`));
  $('bg-rule').onclick = () => showGuide(G ? G.id : data.game);
  $('bg-pause').onclick = togglePause;
  $('bg-overlay').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'bg-new') { hideOverlay(); newGameDialog(); }
    else if (act === 'bg-records') showRecords();
    else if (act === 'bg-resume-pause') togglePause();
  });

  setInterval(() => {
    if (!G || G.over || G.paused || document.body.dataset.game === 'sudoku' || document.visibilityState !== 'visible') return;
    G.elapsed++;
    $('bg-time').textContent = fmt(G.elapsed);
    if (G.elapsed % 5 === 0) persist();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
  window.addEventListener('pagehide', persist);

  window.BoardGames = {
    active: () => document.body.dataset.game && document.body.dataset.game !== 'sudoku',
    showRecords,
    refresh() { if (G) { render(); if (overlayFn && !$('bg-overlay').classList.contains('hidden')) showOverlay(overlayFn); } else renderSide(); },
  };

  // 시작: 마지막으로 보던 탭
  document.body.dataset.game = 'sudoku';
  if (data.game && data.game !== 'sudoku' && DEFS[data.game]) switchTo(data.game);
  else document.querySelectorAll('#game-tabs [data-game]').forEach((b) => b.classList.toggle('active', b.dataset.game === 'sudoku'));
})();

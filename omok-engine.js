/* 오목 엔진: 15줄, 렌주룰(흑 3·3·4·4·장목 금지, 흑은 정확히 5목) / 자유룰(5목 이상) + 컴퓨터 */
(function (root) {
  'use strict';
  const N = 15, SIZE = N * N, BLACK = 1, WHITE = 2;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const other = (c) => 3 - c;
  const at = (r, c) => (r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1);

  function create(rule = 'renju') {
    return { N, b: new Int8Array(SIZE), turn: BLACK, rule, moves: 0, last: -1, winner: 0, winLine: null };
  }

  // p를 지나는 d 방향으로 color가 이어진 칸들 (p 포함)
  function runThrough(b, p, d, color) {
    const r = Math.floor(p / N), c = p % N, cells = [p];
    for (const s of [1, -1]) {
      let rr = r + d[0] * s, cc = c + d[1] * s, q;
      while ((q = at(rr, cc)) >= 0 && b[q] === color) { cells.push(q); rr += d[0] * s; cc += d[1] * s; }
    }
    return cells;
  }

  // color가 p에 둔 상태에서 5목(흑 렌주는 정확히 5, 나머지는 5 이상)이 되는지
  function fiveAt(st, b, p, color) {
    for (const d of DIRS) {
      const n = runThrough(b, p, d, color).length;
      if (st.rule === 'renju' && color === BLACK ? n === 5 : n >= 5) return d;
    }
    return null;
  }

  /* ---------- 렌주 금수 ---------- */
  // p에 흑을 둔 상태에서, d 방향으로 p를 포함하는 '4'의 개수 (4개 돌의 조합이 다르면 따로 셈)
  function foursInDir(b, p, d) {
    const r = Math.floor(p / N), c = p % N, sets = new Set();
    for (let k = -4; k <= 4; k++) {
      if (!k) continue;
      const q = at(r + d[0] * k, c + d[1] * k);
      if (q < 0 || b[q]) continue;
      b[q] = BLACK;
      const run = runThrough(b, q, d, BLACK);
      if (run.length === 5 && run.includes(p)) sets.add(run.filter((x) => x !== q).sort((x, y) => x - y).join());
      b[q] = 0;
    }
    return sets.size;
  }

  // p에 흑을 둔 상태에서, d 방향으로 열린 3(한 수 더 두면 열린 4가 되는 3)이 있는지
  function openThreeInDir(b, p, d, depth) {
    const r = Math.floor(p / N), c = p % N;
    for (let k = -4; k <= 4; k++) {
      if (!k) continue;
      const q = at(r + d[0] * k, c + d[1] * k);
      if (q < 0 || b[q]) continue;
      b[q] = BLACK;
      let ok = false;
      const run = runThrough(b, q, d, BLACK);
      if (run.length === 4 && run.includes(p)) {
        // 열린 4: 양 끝이 비어 있고, 어느 쪽에 둬도 정확히 5목
        const ends = [];
        const rr = run.map((x) => [Math.floor(x / N), x % N]).sort((a, bb) => (a[0] - bb[0]) * d[0] + (a[1] - bb[1]) * d[1] || (a[0] - bb[0]) || (a[1] - bb[1]));
        const first = rr[0], last = rr[rr.length - 1];
        ends.push([first[0] - d[0], first[1] - d[1], first[0] - 2 * d[0], first[1] - 2 * d[1]]);
        ends.push([last[0] + d[0], last[1] + d[1], last[0] + 2 * d[0], last[1] + 2 * d[1]]);
        ok = ends.every(([er, ec, br, bc]) => { const e = at(er, ec), bb = at(br, bc); return e >= 0 && !b[e] && (bb < 0 || b[bb] !== BLACK); });
        if (ok && depth > 0) ok = !forbiddenReason(b, q, depth - 1, true);
      }
      b[q] = 0;
      if (ok) return true;
    }
    return false;
  }

  // 흑이 p에 두면 금수인가 → 'overline' | 'double-four' | 'double-three' | null
  function forbiddenReason(b, p, depth = 2, placed = false) {
    if (!placed) { if (b[p]) return null; b[p] = BLACK; }
    let reason = null;
    const lens = DIRS.map((d) => runThrough(b, p, d, BLACK).length);
    if (!lens.includes(5)) { // 정확히 5목이 되면 금수보다 우선
      if (lens.some((n) => n > 5)) reason = 'overline';
      else {
        let fours = 0;
        for (const d of DIRS) fours += foursInDir(b, p, d);
        if (fours >= 2) reason = 'double-four';
        else {
          let threes = 0;
          for (const d of DIRS) if (openThreeInDir(b, p, d, depth)) threes++;
          if (threes >= 2) reason = 'double-three';
        }
      }
    }
    if (!placed) b[p] = 0;
    return reason;
  }

  const forbidden = (st, p) => (st.rule === 'renju' && st.turn === BLACK ? forbiddenReason(st.b, p) : null);

  function isLegal(st, p) {
    return p >= 0 && p < SIZE && !st.b[p] && !st.winner && !forbidden(st, p);
  }

  function play(st, p) {
    if (!isLegal(st, p)) return false;
    const color = st.turn;
    st.b[p] = color;
    st.moves++; st.last = p;
    const d = fiveAt(st, st.b, p, color);
    if (d) { st.winner = color; st.winLine = runThrough(st.b, p, d, color); }
    st.turn = other(color);
    return true;
  }

  function status(st) {
    if (st.winner) return { winner: st.winner, reason: 'five' };
    if (st.moves >= SIZE) return { winner: null, reason: 'full' };
    return null;
  }

  // 판에서 흑의 금수 자리 (돌 근처만 확인)
  function forbiddenPoints(st) {
    if (st.rule !== 'renju' || st.turn !== BLACK || st.winner) return [];
    const out = [];
    for (const p of candidates(st.b, 1)) { const r = forbiddenReason(st.b, p); if (r) out.push(p); }
    return out;
  }

  /* ---------- 컴퓨터 ---------- */
  // 돌이 있는 곳에서 dist칸 이내의 빈칸
  function candidates(b, dist = 2) {
    const seen = new Uint8Array(SIZE), out = [];
    let any = false;
    for (let p = 0; p < SIZE; p++) {
      if (!b[p]) continue;
      any = true;
      const r = Math.floor(p / N), c = p % N;
      for (let dr = -dist; dr <= dist; dr++) for (let dc = -dist; dc <= dist; dc++) {
        const q = at(r + dr, c + dc);
        if (q >= 0 && !b[q] && !seen[q]) { seen[q] = 1; out.push(q); }
      }
    }
    if (!any) out.push(at(7, 7));
    return out;
  }

  // 5칸 창(window) 점수: 상대 돌이 없는 창에서 내 돌 수에 따라
  const WIN = [0, 1, 12, 150, 2500, 100000];
  function pointScore(st, b, p, color) {
    const r = Math.floor(p / N), c = p % N, opp = other(color);
    let s = 0, fours = 0, threes = 0;
    b[p] = color;
    for (const d of DIRS) {
      let best = 0;
      for (let k = -4; k <= 0; k++) {
        let mine = 0, blocked = false;
        for (let j = 0; j < 5; j++) {
          const q = at(r + d[0] * (k + j), c + d[1] * (k + j));
          if (q < 0 || b[q] === opp) { blocked = true; break; }
          if (b[q] === color) mine++;
        }
        if (blocked) continue;
        s += WIN[mine];
        if (mine > best) best = mine;
      }
      const run = runThrough(b, p, d, color).length;
      if (run >= 5) s += st.rule === 'renju' && color === BLACK && run > 5 ? -1e6 : 1e7;
      if (best === 4) fours++;
      if (best === 3) threes++;
    }
    b[p] = 0;
    // 겹치는 위협(4-3, 3-3 등)은 크게 가산
    if (fours >= 2 || (fours && threes)) s += 50000;
    else if (threes >= 2) s += 8000;
    return s;
  }

  function moveScore(st, b, p, color, defense = 1) {
    if (st.rule === 'renju' && color === BLACK && forbiddenReason(b, p)) return -Infinity;
    return pointScore(st, b, p, color) + defense * 0.9 * pointScore(st, b, p, other(color));
  }

  function ranked(st, b, color, defense) {
    return candidates(b).map((p) => ({ p, s: moveScore(st, b, p, color, defense) }))
      .filter((x) => x.s > -Infinity).sort((a, c) => c.s - a.s);
  }

  // 판 전체 평가 (color 입장)
  function evaluate(st, b, color) {
    let s = 0;
    for (let p = 0; p < SIZE; p++) {
      const r = Math.floor(p / N), c = p % N;
      for (const d of DIRS) {
        const er = r + d[0] * 4, ec = c + d[1] * 4;
        if (at(er, ec) < 0) continue;
        let m = 0, o = 0;
        for (let j = 0; j < 5; j++) { const v = b[at(r + d[0] * j, c + d[1] * j)]; if (v === color) m++; else if (v) o++; }
        if (!o && m) s += WIN[m];
        else if (!m && o) s -= WIN[o] * 1.2;
      }
    }
    return s;
  }

  function search(st, opts) {
    const b = Int8Array.from(st.b), me = st.turn;
    const deadline = Date.now() + (opts.timeMs || 1000);
    const top = ranked(st, b, me, opts.defense ?? 1);
    if (!top.length) return -1;
    // 바로 이기는 수, 바로 막아야 하는 수는 탐색 없이
    for (const x of top) { b[x.p] = me; const w = fiveAt(st, b, x.p, me); b[x.p] = 0; if (w) return x.p; }
    const opp = other(me);
    for (const x of top) {
      if (st.rule === 'renju' && opp === BLACK && forbiddenReason(b, x.p)) continue;
      b[x.p] = opp; const w = fiveAt(st, b, x.p, opp); b[x.p] = 0;
      if (w) return x.p;
    }
    if (opts.depth <= 1) {
      const pool = top.slice(0, opts.pick || 1);
      return pool[Math.floor(Math.random() * pool.length)].p;
    }
    let stop = false;
    function negamax(color, depth, alpha, beta) {
      if (Date.now() > deadline) { stop = true; return 0; }
      if (depth === 0) return evaluate(st, b, color);
      const moves = ranked(st, b, color, 1).slice(0, opts.width || 8);
      if (!moves.length) return 0;
      let best = -Infinity;
      for (const { p } of moves) {
        b[p] = color;
        const win = fiveAt(st, b, p, color);
        const sc = win ? 1e9 - (10 - depth) : -negamax(other(color), depth - 1, -beta, -alpha);
        b[p] = 0;
        if (stop) return best === -Infinity ? 0 : best;
        if (sc > best) best = sc;
        if (sc > alpha) alpha = sc;
        if (alpha >= beta) break;
      }
      return best;
    }
    let bestP = top[0].p;
    for (let depth = 2; depth <= opts.depth; depth += 2) {
      let alpha = -Infinity, cur = null;
      for (const { p } of top.slice(0, opts.width || 8)) {
        b[p] = me;
        const sc = -negamax(opp, depth - 1, -Infinity, -alpha);
        b[p] = 0;
        if (stop) break;
        if (sc > alpha) { alpha = sc; cur = p; }
      }
      if (stop) break;
      if (cur != null) bestP = cur;
    }
    return bestP;
  }

  const LEVELS = {
    beginner: { depth: 1, pick: 6, defense: 0.4, timeMs: 300 },
    easy: { depth: 1, pick: 2, defense: 0.8, timeMs: 400 },
    medium: { depth: 1, pick: 1, defense: 1, timeMs: 600 },
    hard: { depth: 2, width: 8, defense: 1, timeMs: 2000 },
    expert: { depth: 4, width: 8, defense: 1, timeMs: 4000 },
  };
  const bestMove = (st, level) => search(st, LEVELS[level] || LEVELS.medium);

  const api = { N, BLACK, WHITE, create, play, isLegal, forbidden, forbiddenReason, forbiddenPoints, status, bestMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OmokEngine = api;
})(typeof self !== 'undefined' ? self : this);

/* 오델로 엔진: 8×8, 정식 시작 배치(백 d4·e5, 흑 d5·e4), 흑 먼저, 끼우면 뒤집기,
   둘 곳이 없으면 자동 패스, 둘 다 둘 곳이 없으면 종료(돌 많은 쪽 승) + 컴퓨터 */
(function (root) {
  'use strict';
  const N = 8, SIZE = 64, BLACK = 1, WHITE = 2;
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const other = (c) => 3 - c;

  function create() {
    const b = new Int8Array(SIZE);
    // 위쪽이 8번 줄: d5(3,3) 흑, e5(3,4) 백, d4(4,3) 백, e4(4,4) 흑
    b[3 * 8 + 3] = BLACK; b[3 * 8 + 4] = WHITE; b[4 * 8 + 3] = WHITE; b[4 * 8 + 4] = BLACK;
    return { N, b, turn: BLACK, last: -1, passed: 0, over: false, moves: 0 };
  }

  // color가 p에 두면 뒤집히는 돌들
  function flips(b, p, color) {
    if (b[p]) return [];
    const r = p >> 3, c = p & 7, opp = other(color), out = [];
    for (const [dr, dc] of DIRS) {
      let rr = r + dr, cc = c + dc;
      const line = [];
      while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * 8 + cc] === opp) { line.push(rr * 8 + cc); rr += dr; cc += dc; }
      if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * 8 + cc] === color) out.push(...line);
    }
    return out;
  }

  function movesFor(b, color) {
    const out = [];
    for (let p = 0; p < SIZE; p++) if (!b[p] && flips(b, p, color).length) out.push(p);
    return out;
  }
  const legalMoves = (st) => (st.over ? [] : movesFor(st.b, st.turn));

  function count(b) {
    let bl = 0, wh = 0;
    for (let p = 0; p < SIZE; p++) { if (b[p] === BLACK) bl++; else if (b[p] === WHITE) wh++; }
    return { black: bl, white: wh };
  }

  function play(st, p) {
    if (st.over) return false;
    const f = flips(st.b, p, st.turn);
    if (!f.length) return false;
    const me = st.turn;
    st.b[p] = me;
    for (const q of f) st.b[q] = me;
    st.last = p; st.moves++;
    st.passed = 0;
    const opp = other(me);
    if (movesFor(st.b, opp).length) st.turn = opp;
    else if (movesFor(st.b, me).length) { st.turn = me; st.passed = opp; } // 상대는 둘 곳이 없어 자동 패스
    else st.over = true;
    return true;
  }

  function status(st) {
    if (!st.over) return null;
    const c = count(st.b);
    return { winner: c.black > c.white ? BLACK : c.white > c.black ? WHITE : null, reason: 'discs', count: c };
  }

  /* ---------- 컴퓨터 ---------- */
  const W = [
    100, -20, 10, 5, 5, 10, -20, 100,
    -20, -50, -2, -2, -2, -2, -50, -20,
    10, -2, -1, -1, -1, -1, -2, 10,
    5, -2, -1, -1, -1, -1, -2, 5,
    5, -2, -1, -1, -1, -1, -2, 5,
    10, -2, -1, -1, -1, -1, -2, 10,
    -20, -50, -2, -2, -2, -2, -50, -20,
    100, -20, 10, 5, 5, 10, -20, 100,
  ];
  const CORNERS = [[0, 1, 8, 9], [7, 6, 15, 14], [56, 57, 48, 49], [63, 62, 55, 54]];

  function evaluate(b, color) {
    const opp = other(color);
    let pos = 0, empty = 0;
    const w = W.slice();
    // 모서리를 이미 차지했으면 그 옆 칸의 감점을 없앰
    for (const [corner, ...adj] of CORNERS) if (b[corner]) for (const a of adj) w[a] = 5;
    for (let p = 0; p < SIZE; p++) {
      if (b[p] === color) pos += w[p];
      else if (b[p] === opp) pos -= w[p];
      else empty++;
    }
    const mob = movesFor(b, color).length - movesFor(b, opp).length;
    const c = count(b), disc = color === BLACK ? c.black - c.white : c.white - c.black;
    return pos + mob * 8 + (empty < 14 ? disc * 4 : 0);
  }

  function search(st, opts) {
    const b = Int8Array.from(st.b), me = st.turn;
    const deadline = Date.now() + (opts.timeMs || 1000);
    let stop = false, nodes = 0;
    const empties = () => { let e = 0; for (let p = 0; p < SIZE; p++) if (!b[p]) e++; return e; };
    function apply(p, color) { const f = flips(b, p, color); b[p] = color; for (const q of f) b[q] = color; return f; }
    function undo(p, f, color) { b[p] = 0; for (const q of f) b[q] = other(color); }
    function negamax(color, depth, alpha, beta, passed, exact) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
      const moves = movesFor(b, color);
      if (!moves.length) {
        if (passed) { const c = count(b); const d = color === BLACK ? c.black - c.white : c.white - c.black; return d * 10000; }
        return -negamax(other(color), depth, -beta, -alpha, true, exact);
      }
      if (depth <= 0 && !exact) return evaluate(b, color);
      moves.sort((x, y) => W[y] - W[x]);
      let best = -Infinity;
      for (const p of moves) {
        const f = apply(p, color);
        const sc = -negamax(other(color), depth - 1, -beta, -alpha, false, exact);
        undo(p, f, color);
        if (stop) return best === -Infinity ? 0 : best;
        if (sc > best) best = sc;
        if (sc > alpha) alpha = sc;
        if (alpha >= beta) break;
      }
      return best;
    }
    const root = movesFor(b, me);
    if (!root.length) return -1;
    if (root.length === 1) return root[0];
    let scored = root.map((p) => ({ p, s: W[p] })).sort((x, y) => y.s - x.s);
    const exact = empties() <= (opts.exact || 0);
    const noise = Math.max(opts.noise || 0, st.moves < 10 ? 4 : 0); // 초반 다양성
    for (let d = 1; d <= (exact ? 1 : opts.depth); d++) {
      const cur = [];
      let alpha = -Infinity;
      for (const { p } of scored) {
        const f = apply(p, me);
        const sc = -negamax(other(me), d - 1, -Infinity, -alpha + noise, false, exact);
        undo(p, f, me);
        if (stop) break;
        cur.push({ p, s: sc });
        if (sc > alpha) alpha = sc;
      }
      if (stop) { if (cur.length) { const done = new Set(cur.map((x) => x.p)); scored = [...cur.sort((x, y) => y.s - x.s), ...scored.filter((x) => !done.has(x.p))]; } break; }
      scored = cur.map((x, i) => ({ ...x, i })).sort((x, y) => y.s - x.s || x.i - y.i);
    }
    const top = scored[0].s;
    if (!noise) return scored[0].p;
    const pool = scored.filter((x) => x.s > top - noise);
    return pool[Math.floor(Math.random() * pool.length)].p;
  }

  const LEVELS = {
    beginner: { depth: 1, noise: 60, timeMs: 300 },
    easy: { depth: 2, noise: 20, timeMs: 500 },
    medium: { depth: 4, timeMs: 1200, exact: 8 },
    hard: { depth: 6, timeMs: 2500, exact: 12 },
    expert: { depth: 10, timeMs: 6000, exact: 16 }, // 끝 16수는 끝까지 완전히 읽음
  };
  const bestMove = (st, level) => search(st, LEVELS[level] || LEVELS.medium);

  const api = { LEVELS, N, BLACK, WHITE, create, flips, legalMoves, play, status, count, bestMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OthelloEngine = api;
})(typeof self !== 'undefined' ? self : this);

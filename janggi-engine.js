/* 장기 엔진: 궁성·대각선, 포 규칙, 마·상 멱, 상차림, 장군, 한수쉼, 빅장, 점수 판정 + 컴퓨터 */
(function (root) {
  'use strict';

  // 판: 9줄(c 0~8) × 10줄(r 0~9). 한(h)은 위(0~3줄), 초(c)는 아래(6~9줄). 초가 먼저 둠.
  // 기물: K 궁, A 사, R 차, C 포, N 마, E 상, P 졸·병  →  'cR', 'hK' …
  const COLS = 9, ROWS = 10;
  const idx = (r, c) => r * COLS + c;
  const on = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const SCORE = { R: 13, C: 7, N: 5, E: 3, A: 3, P: 2, K: 0 };
  const HAN_BONUS = 1.5; // 후수(한) 덤
  const MOVE_LIMIT = 200; // 총 수가 이만큼 되면 점수로 판정
  const SETUPS = ['마상상마', '상마마상', '마상마상', '상마상마']; // 자기 쪽에서 볼 때 왼쪽→오른쪽

  const enemy = (s) => (s === 'c' ? 'h' : 'c');
  const fwd = (s) => (s === 'c' ? -1 : 1);

  // 궁성: 3~5칸, 위 0~2줄 / 아래 7~9줄. 대각선은 가운데 ↔ 모서리
  const inPalace = (r, c) => c >= 3 && c <= 5 && (r <= 2 || r >= 7);
  const palaceOf = (s) => (s === 'h' ? [0, 2] : [7, 9]);
  const inOwnPalace = (s, r, c) => { const [a, b] = palaceOf(s); return c >= 3 && c <= 5 && r >= a && r <= b; };
  const centerOf = (r) => (r <= 2 ? [1, 4] : [8, 4]);
  function diagLinks(r, c) {
    if (!inPalace(r, c)) return [];
    const [cr, cc] = centerOf(r);
    if (r === cr && c === cc) return [[cr - 1, cc - 1], [cr - 1, cc + 1], [cr + 1, cc - 1], [cr + 1, cc + 1]];
    if (Math.abs(r - cr) === 1 && Math.abs(c - cc) === 1) return [[cr, cc]];
    return [];
  }

  function create(setupCho = '마상상마', setupHan = '마상상마') {
    const b = new Array(ROWS * COLS).fill(null);
    const back = (s, setup) => {
      const row = s === 'c' ? 9 : 0;
      // 자기 쪽에서 왼쪽→오른쪽: 초는 c 1,2,6,7 / 한은 거꾸로 c 7,6,2,1
      const cols = s === 'c' ? [1, 2, 6, 7] : [7, 6, 2, 1];
      [...setup].forEach((ch, i) => (b[idx(row, cols[i])] = s + (ch === '마' ? 'N' : 'E')));
      b[idx(row, 0)] = s + 'R'; b[idx(row, 8)] = s + 'R';
      b[idx(row, 3)] = s + 'A'; b[idx(row, 5)] = s + 'A';
      b[idx(s === 'c' ? 8 : 1, 4)] = s + 'K';
      const cr = s === 'c' ? 7 : 2;
      b[idx(cr, 1)] = s + 'C'; b[idx(cr, 7)] = s + 'C';
      const pr = s === 'c' ? 6 : 3;
      for (const c of [0, 2, 4, 6, 8]) b[idx(pr, c)] = s + 'P';
    };
    back('c', setupCho); back('h', setupHan);
    const st = { b, turn: 'c', ply: 0, keys: [], facingBefore: false };
    st.keys.push(key(st));
    return st;
  }

  const key = (st) => st.b.map((p) => p || '..').join('') + st.turn;
  const findKing = (st, s) => st.b.indexOf(s + 'K');

  /* 한 기물의 이동 가능한 칸 (자기 궁이 장군 받는지는 아직 따지지 않음) */
  function pieceMoves(st, i, out, capturesOnly) {
    const b = st.b, p = b[i], s = p[0], t = p[1], r = Math.floor(i / COLS), c = i % COLS;
    const push = (rr, cc) => {
      const j = idx(rr, cc), q = b[j];
      if (q && q[0] === s) return;
      if (capturesOnly && !q) return;
      out.push({ from: i, to: j, piece: p, captured: q || null });
    };
    if (t === 'K' || t === 'A') {
      for (const [dr, dc] of ORTH) if (inOwnPalace(s, r + dr, c + dc)) push(r + dr, c + dc);
      for (const [rr, cc] of diagLinks(r, c)) if (inOwnPalace(s, rr, cc)) push(rr, cc);
    } else if (t === 'R') {
      for (const [dr, dc] of ORTH) {
        let rr = r + dr, cc = c + dc;
        while (on(rr, cc)) { push(rr, cc); if (b[idx(rr, cc)]) break; rr += dr; cc += dc; }
      }
      // 궁성 대각선: 모서리 → 가운데 → 반대 모서리
      for (const [mr, mc] of diagLinks(r, c)) {
        push(mr, mc);
        const [cr, cc] = centerOf(r);
        if (mr === cr && mc === cc && !b[idx(mr, mc)]) push(2 * cr - r, 2 * cc - c);
      }
    } else if (t === 'C') {
      for (const [dr, dc] of ORTH) {
        let rr = r + dr, cc = c + dc;
        while (on(rr, cc) && !b[idx(rr, cc)]) { rr += dr; cc += dc; }
        if (!on(rr, cc) || b[idx(rr, cc)][1] === 'C') continue; // 다리가 없거나 포는 넘을 수 없음
        rr += dr; cc += dc;
        while (on(rr, cc)) {
          const q = b[idx(rr, cc)];
          if (!q) { if (!capturesOnly) push(rr, cc); }
          else { if (q[0] !== s && q[1] !== 'C') push(rr, cc); break; } // 포는 포를 잡을 수 없음
          rr += dr; cc += dc;
        }
      }
      const [cr, cc] = centerOf(r);
      if (diagLinks(r, c).length === 1) { // 모서리에서 가운데를 넘어 반대 모서리로
        const mid = b[idx(cr, cc)], tr = 2 * cr - r, tc = 2 * cc - c, q = b[idx(tr, tc)];
        if (mid && mid[1] !== 'C' && !(q && (q[0] === s || q[1] === 'C'))) push(tr, tc);
      }
    } else if (t === 'N') {
      for (const [dr, dc] of ORTH) {
        if (!on(r + dr, c + dc) || b[idx(r + dr, c + dc)]) continue; // 멱
        for (const k of [-1, 1]) {
          const rr = r + 2 * dr + (dc ? k : 0), cc = c + 2 * dc + (dr ? k : 0);
          if (on(rr, cc)) push(rr, cc);
        }
      }
    } else if (t === 'E') {
      for (const [dr, dc] of ORTH) {
        if (!on(r + dr, c + dc) || b[idx(r + dr, c + dc)]) continue; // 첫 번째 멱
        for (const k of [-1, 1]) {
          const pr = dc ? k : 0, pc = dr ? k : 0;
          const mr = r + 2 * dr + pr, mc = c + 2 * dc + pc;
          if (!on(mr, mc) || b[idx(mr, mc)]) continue; // 두 번째 멱
          const rr = r + 3 * dr + 2 * pr, cc = c + 3 * dc + 2 * pc;
          if (on(rr, cc)) push(rr, cc);
        }
      }
    } else if (t === 'P') {
      const f = fwd(s);
      if (on(r + f, c)) push(r + f, c);
      if (on(r, c - 1)) push(r, c - 1);
      if (on(r, c + 1)) push(r, c + 1);
      // 상대 궁성 안에서는 앞쪽 대각선으로도 이동
      for (const [rr, cc] of diagLinks(r, c)) if (rr === r + f && !inOwnPalace(s, rr, cc)) push(rr, cc);
    }
  }

  function pseudoMoves(st, capturesOnly) {
    const out = [], s = st.turn;
    for (let i = 0; i < st.b.length; i++) if (st.b[i] && st.b[i][0] === s) pieceMoves(st, i, out, capturesOnly);
    return out;
  }

  // by 진영이 칸 i를 공격하는가 (궁이 장군 받는지 확인용)
  function attacked(st, i, by) {
    const b = st.b, r = Math.floor(i / COLS), c = i % COLS;
    const is = (rr, cc, t) => on(rr, cc) && b[idx(rr, cc)] === by + t;
    for (const [dr, dc] of ORTH) {
      let rr = r + dr, cc = c + dc;
      while (on(rr, cc) && !b[idx(rr, cc)]) { rr += dr; cc += dc; }
      if (!on(rr, cc)) continue;
      const first = b[idx(rr, cc)];
      if (first === by + 'R') return true;
      if (first[1] === 'C') continue;
      rr += dr; cc += dc;
      while (on(rr, cc) && !b[idx(rr, cc)]) { rr += dr; cc += dc; }
      if (on(rr, cc) && b[idx(rr, cc)] === by + 'C') return true;
    }
    if (inPalace(r, c)) {
      const [cr, cc] = centerOf(r);
      const links = diagLinks(r, c);
      if (links.length === 1) { // 모서리
        const mid = b[idx(cr, cc)], or = 2 * cr - r, oc = 2 * cc - c;
        if (mid === by + 'R') return true;
        if (!mid && is(or, oc, 'R')) return true;
        if (mid && mid[1] !== 'C' && is(or, oc, 'C')) return true;
      } else if (links.length === 4) {
        for (const [rr, c2] of links) if (is(rr, c2, 'R')) return true;
      }
    }
    for (const [dr, dc] of ORTH) {
      for (const k of [-1, 1]) {
        const pr = dc ? k : 0, pc = dr ? k : 0;
        // 마: (2,1) 거리, 마 쪽에서 첫 칸이 멱
        const nr = r - 2 * dr - pr, nc = c - 2 * dc - pc;
        if (is(nr, nc, 'N') && !b[idx(nr + dr, nc + dc)]) return true;
        // 상: (3,2) 거리, 두 칸 멱
        const er = r - 3 * dr - 2 * pr, ec = c - 3 * dc - 2 * pc;
        if (is(er, ec, 'E') && !b[idx(er + dr, ec + dc)] && !b[idx(er + 2 * dr + pr, ec + 2 * dc + pc)]) return true;
      }
    }
    const f = fwd(by);
    if (is(r - f, c, 'P') || is(r, c - 1, 'P') || is(r, c + 1, 'P')) return true;
    for (const [rr, cc] of diagLinks(r, c)) if (rr === r - f && is(rr, cc, 'P') && !inOwnPalace(by, r, c)) return true;
    for (const [dr, dc] of ORTH) if ((is(r + dr, c + dc, 'K') || is(r + dr, c + dc, 'A')) && inOwnPalace(by, r, c)) return true;
    for (const [rr, cc] of diagLinks(r, c)) if ((is(rr, cc, 'K') || is(rr, cc, 'A')) && inOwnPalace(by, r, c)) return true;
    return false;
  }

  const inCheck = (st, s = st.turn) => { const k = findKing(st, s); return k >= 0 && attacked(st, k, enemy(s)); };

  // 빅장: 두 궁이 같은 세로줄에서 사이에 아무것도 없이 마주 봄
  function facing(st) {
    const a = findKing(st, 'c'), h = findKing(st, 'h');
    if (a < 0 || h < 0 || a % COLS !== h % COLS) return false;
    for (let j = h + COLS; j < a; j += COLS) if (st.b[j]) return false;
    return true;
  }

  function make(st, m) {
    const u = { m, captured: null, facingBefore: st.facingBefore };
    st.facingBefore = facing(st);
    if (!m.pass) { u.captured = st.b[m.to]; st.b[m.to] = st.b[m.from]; st.b[m.from] = null; }
    st.turn = enemy(st.turn);
    st.ply++;
    return u;
  }
  function unmake(st, u) {
    const m = u.m;
    st.turn = enemy(st.turn);
    st.ply--;
    if (!m.pass) { st.b[m.from] = st.b[m.to]; st.b[m.to] = u.captured; }
    st.facingBefore = u.facingBefore;
  }

  function legalMoves(st, capturesOnly) {
    const me = st.turn, out = [];
    for (const m of pseudoMoves(st, capturesOnly)) {
      const u = make(st, m);
      if (!inCheck(st, me)) out.push(m);
      unmake(st, u);
    }
    return out;
  }
  // 한수쉼: 장군을 받지 않았을 때만 가능
  const canPass = (st) => !inCheck(st);

  function play(st, mv) {
    let m;
    if (mv.pass) { if (!canPass(st)) return null; m = { pass: true }; }
    else m = legalMoves(st).find((x) => x.from === mv.from && x.to === mv.to);
    if (!m) return null;
    make(st, m);
    st.keys.push(key(st));
    return m;
  }

  function points(st) {
    const p = { c: 0, h: HAN_BONUS };
    for (const q of st.b) if (q) p[q[0]] += SCORE[q[1]];
    return p;
  }
  function byPoints(st, reason) {
    const p = points(st);
    return { winner: p.c > p.h ? 'c' : 'h', reason, points: p };
  }

  /* 결과: null(진행 중) 또는 {winner:'c'|'h', reason, points?} */
  function status(st) {
    if (inCheck(st) && !legalMoves(st).length) return { winner: enemy(st.turn), reason: 'checkmate' };
    // 빅장을 받고도 피하지 않으면 점수로 판정
    if (st.ply > 0 && st.facingBefore && facing(st)) return byPoints(st, 'bikjang');
    if (st.ply >= MOVE_LIMIT) return byPoints(st, 'limit');
    const k = st.keys[st.keys.length - 1];
    if (st.keys.filter((x) => x === k).length >= 3) return byPoints(st, 'repetition');
    return null;
  }

  /* ---------- 컴퓨터 ---------- */
  const VAL = { R: 1300, C: 700, N: 500, E: 300, A: 300, P: 200, K: 0 };
  function evaluate(st) {
    let s = 0;
    for (let i = 0; i < st.b.length; i++) {
      const p = st.b[i];
      if (!p) continue;
      const r = Math.floor(i / COLS), c = i % COLS, t = p[1];
      let v = VAL[t];
      const adv = p[0] === 'c' ? 9 - r : r; // 앞으로 나간 정도
      if (t === 'P') v += adv >= 4 ? 30 + (inPalace(r, c) ? 40 : 0) : 0;
      if (t === 'N' || t === 'C') v += (4 - Math.abs(c - 4)) * 6;
      if (t === 'R') v += adv > 3 ? 20 : 0;
      s += p[0] === 'c' ? v : -v;
    }
    return st.turn === 'c' ? s : -s;
  }

  const MATE = 100000;
  function search(st, opts) {
    const deadline = Date.now() + (opts.timeMs || 1000);
    let stop = false, nodes = 0;
    const order = (ms) => ms.sort((a, b) =>
      (b.captured ? VAL[b.captured[1]] * 10 - VAL[b.piece[1]] : 0) - (a.captured ? VAL[a.captured[1]] * 10 - VAL[a.piece[1]] : 0));
    function quiesce(alpha, beta, qd) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
      const sp = evaluate(st);
      if (sp >= beta || qd > 5) return sp;
      if (sp > alpha) alpha = sp;
      const me = st.turn;
      for (const m of order(pseudoMoves(st, true))) {
        if (m.captured[1] === 'K') return MATE; // 궁을 잡을 수 있으면 상대가 불법 수를 둔 것
        const u = make(st, m);
        if (inCheck(st, me)) { unmake(st, u); continue; }
        const sc = -quiesce(-beta, -alpha, qd + 1);
        unmake(st, u);
        if (stop) return alpha;
        if (sc >= beta) return sc;
        if (sc > alpha) alpha = sc;
      }
      return alpha;
    }
    function negamax(depth, alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
      if (depth <= 0) return quiesce(alpha, beta, 0);
      const me = st.turn;
      let best = -Infinity, any = false;
      for (const m of order(pseudoMoves(st, false))) {
        const u = make(st, m);
        if (inCheck(st, me)) { unmake(st, u); continue; }
        any = true;
        const sc = -negamax(depth - 1, -beta, -alpha, ply + 1);
        unmake(st, u);
        if (stop) return best === -Infinity ? 0 : best;
        if (sc > best) best = sc;
        if (sc > alpha) alpha = sc;
        if (alpha >= beta) break;
      }
      if (!any) {
        if (inCheck(st, me)) return -MATE + ply;
        const u = make(st, { pass: true }); // 둘 수가 없으면 한수쉼
        const sc = -negamax(depth - 1, -beta, -alpha, ply + 1);
        unmake(st, u);
        return sc;
      }
      return best;
    }
    const rootMoves = order(legalMoves(st));
    if (!rootMoves.length) return canPass(st) ? { pass: true } : null;
    let scored = rootMoves.map((m) => ({ m, s: 0 }));
    for (let d = 1; d <= (opts.depth || 3); d++) {
      const cur = [];
      let alpha = -Infinity;
      for (const { m } of scored) {
        const u = make(st, m);
        const sc = -negamax(d - 1, -Infinity, -alpha + (opts.noise || 0), 1);
        unmake(st, u);
        if (stop) break;
        cur.push({ m, s: sc });
        if (sc > alpha) alpha = sc;
      }
      if (stop) {
        if (cur.length) { const done = new Set(cur.map((x) => x.m)); scored = [...cur.sort((a, b) => b.s - a.s), ...scored.filter((x) => !done.has(x.m))]; }
        break;
      }
      scored = cur.map((x, i) => ({ ...x, i })).sort((a, b) => b.s - a.s || a.i - b.i);
      if (Math.abs(scored[0].s) > MATE - 1000) break;
    }
    const top = scored[0].s, noise = opts.noise || 0;
    if (!noise || top > MATE - 1000) return scored[0].m;
    const pool = scored.filter((x) => x.s > top - noise);
    return pool[Math.floor(Math.random() * pool.length)].m;
  }

  const LEVELS = {
    beginner: { depth: 1, timeMs: 300, noise: 400 },
    easy: { depth: 2, timeMs: 600, noise: 150 },
    medium: { depth: 3, timeMs: 1500, noise: 40 },
    hard: { depth: 4, timeMs: 3000, noise: 0 },
    expert: { depth: 5, timeMs: 5000, noise: 0 },
  };
  const bestMove = (st, level) => search(st, LEVELS[level] || LEVELS.medium);

  const api = { COLS, ROWS, SETUPS, SCORE, HAN_BONUS, create, legalMoves, pseudoMoves, canPass, play, make, unmake, inCheck, facing, status, points, bestMove, idx, inPalace, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JanggiEngine = api;
})(typeof self !== 'undefined' ? self : this);

/* 체스 엔진: 정확한 규칙(캐슬링·앙파상·프로모션·체크메이트·스테일메이트·50수·3회 반복·기물 부족) + 컴퓨터 */
(function (root) {
  'use strict';

  // 칸 번호: 0 = a8 … 7 = h8, 56 = a1 … 63 = h1 (행 0이 8랭크)
  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const CASTLE = { K: 1, Q: 2, k: 4, q: 8 };
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const colorOf = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
  const sq = (r, c) => r * 8 + c;
  const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const sqName = (s) => 'abcdefgh'[s & 7] + (8 - (s >> 3));

  function fromFEN(fen) {
    const [pos, turn, cas, ep, half, full] = fen.split(' ');
    const b = new Array(64).fill('');
    let i = 0;
    for (const ch of pos) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) i += +ch;
      else b[i++] = ch;
    }
    let castle = 0;
    for (const ch of cas) if (CASTLE[ch]) castle |= CASTLE[ch];
    const epSq = ep === '-' ? -1 : (8 - +ep[1]) * 8 + 'abcdefgh'.indexOf(ep[0]);
    const st = { b, turn, castle, ep: epSq, half: +half || 0, full: +full || 1, kings: { w: b.indexOf('K'), b: b.indexOf('k') }, keys: [] };
    st.keys.push(key(st));
    return st;
  }
  const create = () => fromFEN(START);

  function key(st) {
    return st.b.map((p) => p || '.').join('') + st.turn + st.castle + (st.ep >= 0 ? st.ep : '');
  }

  // by 색이 sq 칸을 공격하는가
  function attacked(st, s, by) {
    const b = st.b, r = s >> 3, c = s & 7;
    const pawnRow = by === 'w' ? r + 1 : r - 1;
    const P = by === 'w' ? 'P' : 'p', N = by === 'w' ? 'N' : 'n', K = by === 'w' ? 'K' : 'k';
    const B = by === 'w' ? 'B' : 'b', R = by === 'w' ? 'R' : 'r', Q = by === 'w' ? 'Q' : 'q';
    for (const dc of [-1, 1]) if (onBoard(pawnRow, c + dc) && b[sq(pawnRow, c + dc)] === P) return true;
    for (const [dr, dc] of KNIGHT) if (onBoard(r + dr, c + dc) && b[sq(r + dr, c + dc)] === N) return true;
    for (const [dr, dc] of KING) if (onBoard(r + dr, c + dc) && b[sq(r + dr, c + dc)] === K) return true;
    for (const [dr, dc] of DIAG) {
      let rr = r + dr, cc = c + dc;
      while (onBoard(rr, cc)) {
        const p = b[sq(rr, cc)];
        if (p) { if (p === B || p === Q) return true; break; }
        rr += dr; cc += dc;
      }
    }
    for (const [dr, dc] of ORTH) {
      let rr = r + dr, cc = c + dc;
      while (onBoard(rr, cc)) {
        const p = b[sq(rr, cc)];
        if (p) { if (p === R || p === Q) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  }

  const inCheck = (st, side = st.turn) => attacked(st, st.kings[side], side === 'w' ? 'b' : 'w');

  function pseudoMoves(st, capturesOnly) {
    const b = st.b, me = st.turn, them = me === 'w' ? 'b' : 'w', out = [];
    const add = (from, to, flags, promo) => out.push({ from, to, flags: flags || '', promo: promo || null, piece: b[from], captured: b[to] || null });
    for (let s = 0; s < 64; s++) {
      const p = b[s];
      if (!p || colorOf(p) !== me) continue;
      const r = s >> 3, c = s & 7, t = p.toLowerCase();
      if (t === 'p') {
        const dir = me === 'w' ? -1 : 1, last = me === 'w' ? 0 : 7, startRow = me === 'w' ? 6 : 1;
        const fwd = r + dir;
        const pushPromo = (to, flags) => { for (const pr of ['q', 'r', 'b', 'n']) add(s, to, flags + 'p', pr); };
        if (onBoard(fwd, c) && !b[sq(fwd, c)] && !capturesOnly) {
          if (fwd === last) pushPromo(sq(fwd, c), '');
          else {
            add(s, sq(fwd, c));
            if (r === startRow && !b[sq(fwd + dir, c)]) add(s, sq(fwd + dir, c), 'd');
          }
        }
        for (const dc of [-1, 1]) {
          if (!onBoard(fwd, c + dc)) continue;
          const to = sq(fwd, c + dc), q = b[to];
          if (q && colorOf(q) === them) { if (fwd === last) pushPromo(to, 'c'); else add(s, to, 'c'); }
          else if (to === st.ep) add(s, to, 'ce');
        }
        continue;
      }
      const step = (list, slide) => {
        for (const [dr, dc] of list) {
          let rr = r + dr, cc = c + dc;
          while (onBoard(rr, cc)) {
            const to = sq(rr, cc), q = b[to];
            if (!q) { if (!capturesOnly) add(s, to); }
            else { if (colorOf(q) === them) add(s, to, 'c'); break; }
            if (!slide) break;
            rr += dr; cc += dc;
          }
        }
      };
      if (t === 'n') step(KNIGHT, false);
      else if (t === 'b') step(DIAG, true);
      else if (t === 'r') step(ORTH, true);
      else if (t === 'q') { step(DIAG, true); step(ORTH, true); }
      else if (t === 'k') {
        step(KING, false);
        if (capturesOnly) continue;
        // 캐슬링: 권리 있음, 사이 칸 비어 있음, 왕이 체크 아님, 지나가는 칸이 공격받지 않음
        const home = me === 'w' ? 60 : 4;
        if (s === home && !attacked(st, s, them)) {
          const kSide = me === 'w' ? CASTLE.K : CASTLE.k, qSide = me === 'w' ? CASTLE.Q : CASTLE.q;
          const rook = me === 'w' ? 'R' : 'r';
          if ((st.castle & kSide) && !b[s + 1] && !b[s + 2] && b[s + 3] === rook &&
              !attacked(st, s + 1, them) && !attacked(st, s + 2, them)) add(s, s + 2, 'k');
          if ((st.castle & qSide) && !b[s - 1] && !b[s - 2] && !b[s - 3] && b[s - 4] === rook &&
              !attacked(st, s - 1, them) && !attacked(st, s - 2, them)) add(s, s - 2, 'q');
        }
      }
    }
    return out;
  }

  function make(st, m) {
    const b = st.b, me = st.turn;
    const undo = { m, castle: st.castle, ep: st.ep, half: st.half, captured: m.captured, capSq: m.to };
    let piece = b[m.from];
    if (m.flags.includes('e')) {
      undo.capSq = m.to + (me === 'w' ? 8 : -8);
      undo.captured = b[undo.capSq];
      b[undo.capSq] = '';
    }
    if (m.promo) piece = me === 'w' ? m.promo.toUpperCase() : m.promo;
    b[m.to] = piece;
    b[m.from] = '';
    if (m.flags.includes('k')) { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = ''; }
    if (m.flags.includes('q')) { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = ''; }
    if (piece.toLowerCase() === 'k') {
      st.kings[me] = m.to;
      st.castle &= me === 'w' ? ~(CASTLE.K | CASTLE.Q) : ~(CASTLE.k | CASTLE.q);
    }
    for (const s of [m.from, m.to]) {
      if (s === 63) st.castle &= ~CASTLE.K;
      if (s === 56) st.castle &= ~CASTLE.Q;
      if (s === 7) st.castle &= ~CASTLE.k;
      if (s === 0) st.castle &= ~CASTLE.q;
    }
    st.ep = m.flags.includes('d') ? (m.from + m.to) / 2 : -1;
    st.half = m.piece.toLowerCase() === 'p' || undo.captured ? 0 : st.half + 1;
    if (me === 'b') st.full++;
    st.turn = me === 'w' ? 'b' : 'w';
    return undo;
  }

  function unmake(st, u) {
    const m = u.m, b = st.b;
    st.turn = st.turn === 'w' ? 'b' : 'w';
    const me = st.turn;
    if (me === 'b') st.full--;
    b[m.from] = m.piece;
    b[m.to] = '';
    if (u.captured) b[u.capSq] = u.captured;
    if (m.flags.includes('k')) { b[m.from + 3] = b[m.from + 1]; b[m.from + 1] = ''; }
    if (m.flags.includes('q')) { b[m.from - 4] = b[m.from - 1]; b[m.from - 1] = ''; }
    if (m.piece.toLowerCase() === 'k') st.kings[me] = m.from;
    st.castle = u.castle; st.ep = u.ep; st.half = u.half;
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

  /* 게임용: 수를 두고 반복 기록까지 갱신 */
  function play(st, mv) {
    const m = legalMoves(st).find((x) => x.from === mv.from && x.to === mv.to && (x.promo || null) === (mv.promo || null));
    if (!m) return null;
    make(st, m);
    st.keys.push(key(st));
    return m;
  }

  function insufficient(st) {
    const pieces = [];
    st.b.forEach((p, s) => { if (p && p.toLowerCase() !== 'k') pieces.push({ p: p.toLowerCase(), s }); });
    if (!pieces.length) return true;
    if (pieces.length === 1 && (pieces[0].p === 'b' || pieces[0].p === 'n')) return true;
    if (pieces.every((x) => x.p === 'b')) {
      const shade = (s) => ((s >> 3) + (s & 7)) & 1;
      return pieces.every((x) => shade(x.s) === shade(pieces[0].s));
    }
    return false;
  }

  /* 결과: null(진행 중) 또는 {winner:'w'|'b'|null, reason} */
  function status(st) {
    const moves = legalMoves(st);
    if (!moves.length) {
      return inCheck(st) ? { winner: st.turn === 'w' ? 'b' : 'w', reason: 'checkmate' } : { winner: null, reason: 'stalemate' };
    }
    if (st.half >= 100) return { winner: null, reason: 'fifty' };
    const k = st.keys[st.keys.length - 1];
    if (st.keys.filter((x) => x === k).length >= 3) return { winner: null, reason: 'repetition' };
    if (insufficient(st)) return { winner: null, reason: 'material' };
    return null;
  }

  /* ---------- 컴퓨터 (알파베타 탐색) ---------- */
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    ke: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };

  function evaluate(st) {
    let score = 0, material = 0;
    for (let s = 0; s < 64; s++) { const p = st.b[s]; if (p && p.toLowerCase() !== 'p' && p.toLowerCase() !== 'k') material += VAL[p.toLowerCase()]; }
    const endgame = material <= 2600;
    for (let s = 0; s < 64; s++) {
      const p = st.b[s];
      if (!p) continue;
      const t = p.toLowerCase(), white = p !== t;
      const idx = white ? s : (7 - (s >> 3)) * 8 + (s & 7);
      const v = VAL[t] + PST[t === 'k' && endgame ? 'ke' : t][idx];
      score += white ? v : -v;
    }
    return st.turn === 'w' ? score : -score;
  }

  const MATE = 100000;
  function search(st, opts) {
    const deadline = Date.now() + (opts.timeMs || 1000);
    const maxDepth = opts.depth || 4;
    let nodes = 0, stop = false;
    const order = (moves) => moves.sort((a, b) =>
      ((b.captured ? VAL[b.captured.toLowerCase()] * 10 - VAL[b.piece.toLowerCase()] : 0) + (b.promo ? 800 : 0)) -
      ((a.captured ? VAL[a.captured.toLowerCase()] * 10 - VAL[a.piece.toLowerCase()] : 0) + (a.promo ? 800 : 0)));

    function quiesce(alpha, beta, qd) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
      const standPat = evaluate(st);
      if (standPat >= beta || qd > 6) return standPat;
      if (standPat > alpha) alpha = standPat;
      const me = st.turn;
      for (const m of order(pseudoMoves(st, true))) {
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
      if (st.half >= 100) return 0;
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
      if (!any) return inCheck(st, me) ? -MATE + ply : 0;
      return best;
    }

    const rootMoves = order(legalMoves(st));
    if (!rootMoves.length) return null;
    let scored = rootMoves.map((m) => ({ m, s: 0 }));
    for (let d = 1; d <= maxDepth; d++) {
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
      if (stop && cur.length < scored.length) {
        // 이번 깊이를 다 못 봤으면 끝까지 본 수만 반영
        if (cur.length) { const done = new Set(cur.map((x) => x.m)); scored = [...cur, ...scored.filter((x) => !done.has(x.m))]; }
        break;
      }
      scored = cur.map((x, i) => ({ ...x, i })).sort((a, b) => b.s - a.s || a.i - b.i);
      if (Math.abs(scored[0].s) > MATE - 1000) break;
    }
    // 낮은 난이도: 최선 수와 점수 차이가 noise 미만인 수 중에서 무작위 (외통수가 보이면 항상 최선 수)
    // (탐색 창 밖으로 잘린 수의 점수는 상한값이라 '미만' 비교로 걸러짐)
    const top = scored[0].s, noise = opts.noise || 0;
    if (!noise || top > MATE - 1000) return scored[0].m;
    const pool = scored.filter((x) => x.s > top - noise);
    return pool[Math.floor(Math.random() * pool.length)].m;
  }

  const LEVELS = {
    beginner: { depth: 1, timeMs: 300, noise: 250 },
    easy: { depth: 2, timeMs: 500, noise: 90 },
    medium: { depth: 3, timeMs: 1200, noise: 25 },
    hard: { depth: 4, timeMs: 2500, noise: 0 },
    expert: { depth: 6, timeMs: 4500, noise: 0 },
  };
  const bestMove = (st, level) => search(st, LEVELS[level] || LEVELS.medium);

  const api = { create, fromFEN, legalMoves, pseudoMoves, play, make, unmake, inCheck, status, bestMove, key, sqName, colorOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessEngine = api;
})(typeof self !== 'undefined' ? self : this);

/* 바둑 엔진: 따내기, 패(같은 모양 바로 되따기 금지), 자충수 금지, 연속 두 번 패스로 종국,
   사석 표시 후 계가(한국·일본식 집 계산, 백 덤 6.5) + 컴퓨터(몬테카를로 트리 탐색) */
(function (root) {
  'use strict';
  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const other = (c) => 3 - c;
  const KOMI = 6.5;

  const nbCache = {}, diagCache = {};
  function neighbors(N) {
    if (nbCache[N]) return nbCache[N];
    const nb = [], dg = [];
    for (let p = 0; p < N * N; p++) {
      const r = Math.floor(p / N), c = p % N, a = [], d = [];
      if (r > 0) a.push(p - N); if (r < N - 1) a.push(p + N); if (c > 0) a.push(p - 1); if (c < N - 1) a.push(p + 1);
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N) d.push(rr * N + cc);
      }
      nb.push(a); dg.push(d);
    }
    nbCache[N] = nb; diagCache[N] = dg;
    return nb;
  }

  function create(N = 9) {
    neighbors(N);
    return { N, b: new Int8Array(N * N), turn: BLACK, ko: -1, passes: 0, captures: [0, 0, 0], moves: 0, last: null };
  }

  /* 판 위 연산: 그룹·활로 (작업용 버퍼 재사용) */
  const work = { stamp: null, gen: 0, stack: null, group: null };
  function ensure(n) {
    if (!work.stamp || work.stamp.length < n) {
      work.stamp = new Int32Array(n); work.stack = new Int32Array(n); work.group = new Int32Array(n); work.gen = 0;
    }
  }
  // p가 속한 그룹을 work.group에 담고 크기를 돌려줌. 활로가 있으면 libs>0
  function floodGroup(b, N, p) {
    ensure(N * N);
    const nb = nbCache[N], color = b[p], stamp = work.stamp, stack = work.stack, group = work.group;
    if (work.gen > 0x3fffffff) { work.stamp.fill(0); work.gen = 0; } // 오래 쓰면 번호가 넘치지 않게 초기화
    const g = ++work.gen;
    let sp = 0, gs = 0, libs = 0;
    work.lastLib = -1;
    stack[sp++] = p; stamp[p] = g;
    while (sp) {
      const q = stack[--sp];
      group[gs++] = q;
      for (const n of nb[q]) {
        if (stamp[n] === g) continue;
        const v = b[n];
        if (v === color) { stamp[n] = g; stack[sp++] = n; }
        else if (v === EMPTY) { stamp[n] = g; libs++; work.lastLib = n; }
      }
    }
    return { size: gs, libs };
  }

  // 돌을 놓음. 불법이면 false (판은 그대로). 성공하면 따낸 수와 패 자리를 돌려줌
  function place(b, N, p, color, ko) {
    if (p === ko || b[p] !== EMPTY) return false;
    const nb = nbCache[N], opp = other(color);
    b[p] = color;
    let captured = 0, lastCap = -1;
    for (const n of nb[p]) {
      if (b[n] !== opp) continue;
      const g = floodGroup(b, N, n);
      if (g.libs === 0) {
        for (let i = 0; i < g.size; i++) { b[work.group[i]] = EMPTY; lastCap = work.group[i]; }
        captured += g.size;
      }
    }
    const own = floodGroup(b, N, p);
    if (own.libs === 0) { b[p] = EMPTY; return false; } // 자충수
    const newKo = captured === 1 && own.size === 1 && own.libs === 1 ? lastCap : -1;
    return { captured, ko: newKo, libs: own.libs, size: own.size };
  }

  function play(st, p) {
    if (p === -1) {
      st.passes++; st.ko = -1; st.turn = other(st.turn); st.moves++; st.last = -1;
      return true;
    }
    const res = place(st.b, st.N, p, st.turn, st.ko);
    if (!res) return false;
    st.captures[st.turn] += res.captured;
    st.ko = res.ko; st.passes = 0; st.turn = other(st.turn); st.moves++; st.last = p;
    return true;
  }

  function isLegal(st, p) {
    if (p === -1) return true;
    if (st.b[p] !== EMPTY || p === st.ko) return false;
    const copy = Int8Array.from(st.b);
    return !!place(copy, st.N, p, st.turn, st.ko);
  }

  // 자기 눈(메우면 손해인 자리)인지
  function isEye(b, N, p, color) {
    for (const n of nbCache[N][p]) if (b[n] !== color) return false;
    const dg = diagCache[N][p];
    let bad = 0;
    for (const d of dg) if (b[d] === other(color)) bad++;
    return dg.length < 4 ? bad === 0 : bad < 2;
  }

  /* ---------- 계가 (한국·일본식) ---------- */
  // dead: 사석으로 표시한 칸 번호 목록
  function score(st, dead = []) {
    const N = st.N, b = Int8Array.from(st.b), nb = nbCache[N];
    const prisoners = [0, st.captures[1], st.captures[2]];
    for (const p of dead) if (b[p]) { prisoners[other(b[p])]++; b[p] = EMPTY; }
    const owner = new Int8Array(N * N); // 집: 1 흑, 2 백, 3 공배
    const seen = new Uint8Array(N * N);
    const terr = [0, 0, 0];
    for (let p = 0; p < N * N; p++) {
      if (b[p] || seen[p]) continue;
      const region = [], stack = [p];
      let touch = 0;
      seen[p] = 1;
      while (stack.length) {
        const q = stack.pop();
        region.push(q);
        for (const n of nb[q]) {
          if (b[n]) touch |= b[n];
          else if (!seen[n]) { seen[n] = 1; stack.push(n); }
        }
      }
      const who = touch === 1 ? 1 : touch === 2 ? 2 : 3;
      for (const q of region) owner[q] = who;
      if (who < 3) terr[who] += region.length;
    }
    for (const p of dead) owner[p] = owner[p] || 0;
    const black = terr[1] + prisoners[1], white = terr[2] + prisoners[2] + KOMI;
    return { black, white, terr, prisoners, komi: KOMI, owner, winner: black > white ? BLACK : WHITE, margin: Math.abs(black - white) };
  }

  /* ---------- 몬테카를로 (무작위 대국 + RAVE) ---------- */
  function randInt(n) { return Math.floor(Math.random() * n); }

  // 무작위로 끝까지 둬 보고 결과를 돌려줌. first[p]에 그 자리에 처음 둔 색을 기록(AMAF)
  // 방금 둔 수 주변에서 급한 수: 단수 걸린 상대 돌 따내기, 단수 걸린 내 돌 달아나기
  const scanSeen = { arr: null };
  function urgentMove(b, N, last, turn, ko) {
    const nb = nbCache[N], cands = [], total = N * N;
    let around;
    if (N <= 13) {
      // 작은 판은 판 전체에서 단수 걸린 돌을 찾음
      if (!scanSeen.arr || scanSeen.arr.length < total) scanSeen.arr = new Uint8Array(total);
      const seen = scanSeen.arr; seen.fill(0, 0, total);
      around = [];
      for (let q = 0; q < total; q++) {
        if (b[q] === EMPTY || seen[q]) continue;
        const g = floodGroup(b, N, q);
        for (let i = 0; i < g.size; i++) seen[work.group[i]] = 1;
        if (g.libs === 1) around.push(q);
      }
    } else {
      if (last < 0) return -1;
      around = [last, ...nb[last]];
    }
    for (const q of around) {
      if (b[q] === EMPTY) continue;
      const g = floodGroup(b, N, q);
      if (g.libs !== 1) continue;
      const lib = work.lastLib;
      if (b[q] !== turn) cands.push(lib); // 따내기
      else {
        // 달아나기: 그 자리에 두면 활로가 2개 이상이 되는지
        const copy = Int8Array.from(b);
        const res = place(copy, N, lib, turn, ko);
        if (res && floodGroup(copy, N, lib).libs >= 2) cands.push(lib);
      }
    }
    for (let i = 0; i < cands.length; i++) {
      const p = cands[randInt(cands.length)];
      if (p !== ko && b[p] === EMPTY) return p;
    }
    return -1;
  }

  function playout(b, N, turn, ko, first, firstGen, gen, own, last = -1) {
    const total = N * N, limit = total * 3;
    let passes = 0, moves = 0;
    while (passes < 2 && moves < limit) {
      let chosen = -1;
      const urgent = Math.random() < 0.9 ? urgentMove(b, N, last, turn, ko) : -1;
      if (urgent >= 0) {
        const res = place(b, N, urgent, turn, ko);
        if (res) { ko = res.ko; chosen = urgent; }
      }
      const start = randInt(total);
      for (let k = 0; chosen < 0 && k < total; k++) {
        const p = (start + k) % total;
        if (b[p] !== EMPTY || p === ko || isEye(b, N, p, turn)) continue;
        const res = place(b, N, p, turn, ko);
        if (!res) continue;
        if (res.libs === 1 && !res.captured && Math.random() < 0.9) { b[p] = EMPTY; continue; } // 자충(스스로 단수) 피하기
        ko = res.ko; chosen = p;
        break;
      }
      if (chosen < 0) { passes++; ko = -1; last = -1; }
      else {
        passes = 0; last = chosen;
        if (firstGen[chosen] !== gen) { firstGen[chosen] = gen; first[chosen] = turn; }
      }
      turn = other(turn); moves++;
    }
    // 집 계산(놓인 돌 + 한 색으로만 둘러싸인 빈칸)
    let s = 0;
    const nb = nbCache[N];
    for (let p = 0; p < total; p++) {
      let v = b[p];
      if (v === EMPTY) {
        let t = 0;
        for (const n of nb[p]) t |= b[n];
        v = t === 1 ? 1 : t === 2 ? 2 : 0;
      }
      if (v === 1) s++; else if (v === 2) s--;
      if (own) own[p] += v === 1 ? 1 : v === 2 ? -1 : 0;
    }
    return s - KOMI > 0 ? BLACK : WHITE;
  }

  function candidateMoves(b, N, turn, ko) {
    const out = [];
    for (let p = 0; p < N * N; p++) {
      if (b[p] !== EMPTY || p === ko || isEye(b, N, p, turn)) continue;
      const copy = Int8Array.from(b);
      if (place(copy, N, p, turn, ko)) out.push(p);
    }
    return out;
  }

  /* 바둑 상식으로 매긴 수의 점수 (사전 지식) */
  function urgentPoints(b, N) {
    const total = N * N, map = new Map(), seen = new Uint8Array(total);
    for (let p = 0; p < total; p++) {
      if (!b[p] || seen[p]) continue;
      const g = floodGroup(b, N, p);
      for (let i = 0; i < g.size; i++) seen[work.group[i]] = 1;
      if (g.libs === 1) map.set(work.lastLib, (map.get(work.lastLib) || 0) + g.size);
    }
    return map;
  }
  function heuristic(b, N, p, turn, ko, moveNo, urgent) {
    const r = Math.floor(p / N), c = p % N;
    const line = Math.min(r, c, N - 1 - r, N - 1 - c); // 0 = 1선
    const early = moveNo < N * N * (N >= 13 ? 0.12 : 0.15);
    let s = 0;
    if (urgent.has(p)) s += 2 + Math.min(3, urgent.get(p) * 0.5);
    if (N >= 13) {
      if (line === 0) s -= early ? 4 : 1.5;
      else if (line === 1) s -= early ? 2 : 0.4;
      else if (early && (line === 2 || line === 3)) s += 1;
    } else if (line === 0) s -= early ? 2 : 0.5;
    // 돌 근처(전투가 있는 곳) 우대, 초반이 지나면 멀리 동떨어진 수는 감점
    let near = 0;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc]) near++;
    }
    if (!early) s += near ? 0.6 : -0.8;
    // 스스로 단수가 되는 수는 크게 감점
    const copy = Int8Array.from(b);
    const res = place(copy, N, p, turn, ko);
    if (res && res.libs === 1 && !res.captured) s -= 3;
    return s;
  }
  // 13·19줄 초반: 비어 있는 귀의 화점·소목 자리
  function openingMove(st) {
    const N = st.N;
    if (N < 13) return -1;
    let stones = 0;
    for (let p = 0; p < N * N; p++) if (st.b[p]) stones++;
    if (stones > 6) return -1;
    const k = N >= 19 ? 3 : 3, far = N - 1 - k;
    const corners = [[k, k], [k, far], [far, k], [far, far]];
    const options = [];
    for (const [cr, cc] of corners) {
      // 이 귀 근처(6×6)에 돌이 없으면 빈 귀
      let busy = false;
      for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
        const rr = cr + dr, c2 = cc + dc;
        if (rr >= 0 && rr < N && c2 >= 0 && c2 < N && st.b[rr * N + c2]) busy = true;
      }
      if (busy) continue;
      const toward = (v) => (v < N / 2 ? v - 1 : v + 1); // 소목: 화점에서 한 칸 바깥쪽
      for (const [r, c] of [[cr, cc], [toward(cr), cc], [cr, toward(cc)]]) options.push(r * N + c);
    }
    return options.length ? options[Math.floor(Math.random() * options.length)] : -1;
  }

  function mcts(st, opts) {
    const N = st.N, total = N * N;
    const deadline = Date.now() + (opts.timeMs || 1000);
    const maxPlayouts = opts.playouts || 1000;
    const book = openingMove(st);
    if (book >= 0 && isLegal(st, book)) return { move: book, winrate: 0.5, own: new Float64Array(total), playouts: 0 };
    let rootMoves = candidateMoves(st.b, N, st.turn, st.ko);
    const rootUrgent = urgentPoints(st.b, N);
    const scoreOf = new Map(rootMoves.map((m) => [m, heuristic(st.b, N, m, st.turn, st.ko, st.moves, rootUrgent)]));
    // 입문: 바둑 상식 점수 상위 몇 수 중에서 고름 (탐색 없이)
    if (opts.heuristicOnly) {
      if (!rootMoves.length) return { move: -1, winrate: 0.5, own: new Float64Array(total) };
      const top = rootMoves.sort((a, c) => scoreOf.get(c) - scoreOf.get(a)).slice(0, opts.pick || 5);
      return { move: top[Math.floor(Math.random() * top.length)], winrate: 0.5, own: new Float64Array(total) };
    }
    // 큰 판은 유력한 후보만 깊게 봄
    const keep = N >= 19 ? 40 : N >= 13 ? 45 : 81;
    if (rootMoves.length > keep) rootMoves = rootMoves.sort((a, c) => scoreOf.get(c) - scoreOf.get(a)).slice(0, keep);
    // 둘 곳이 많은 초반에는 패스를 고려하지 않음
    const allowPass = st.passes > 0 || rootMoves.length <= total * 0.25 || st.moves > total * 0.8;
    const mk = (move, parent, toMove) => ({ move, parent, toMove, n: 0, w: 0, rv: 0, an: 0, aw: 0, kids: null });
    const EXPAND_AT = N >= 13 ? 8 : 2; // 실제로 이만큼 둘러본 수만 다음 단계를 펼침
    // 사전 지식: 단수 걸린 돌을 따내거나 살리는 수는 좋게, 초반의 1선은 나쁘게 시작
    const withPrior = (node, b, turn, ko, moves, scores) => {
      const urgent = scores ? null : urgentPoints(b, N);
      for (const c of node.kids) {
        if (c.move < 0) continue;
        const h = scores ? scores.get(c.move) : heuristic(b, N, c.move, turn, ko, moves, urgent);
        const q = Math.max(0.1, Math.min(0.9, 0.5 + 0.1 * h));
        c.n = 12; c.w = 12 * q;
      }
      return node;
    };
    const rootNode = mk(null, null, st.turn);
    rootNode.kids = rootMoves.map((m) => mk(m, rootNode, other(st.turn)));
    if (allowPass || !rootMoves.length) rootNode.kids.push(mk(-1, rootNode, other(st.turn)));
    withPrior(rootNode, st.b, st.turn, st.ko, st.moves, scoreOf);

    const first = new Int8Array(total), firstGen = new Int32Array(total), own = new Float64Array(total);
    let gen = 0, done = 0;
    const B2 = 0.1 * 0.1 * 4;
    const pick = (node) => {
      let best = null, bv = -Infinity;
      for (const c of node.kids) {
        const q = c.n ? c.w / c.n : 0.5;
        const a = c.an ? c.aw / c.an : 0.5;
        const beta = c.an / (c.n + c.an + B2 * c.n * c.an + 1e-9);
        let v = (1 - beta) * q + beta * a + (c.n ? 0 : 0.6) + Math.random() * 1e-6;
        v += 0.25 * Math.sqrt(Math.log(node.n + 1) / (c.n + 1));
        if (v > bv) { bv = v; best = c; }
      }
      return best;
    };

    while (done < maxPlayouts && (done < 30 || Date.now() < deadline)) {
      gen++;
      const b = Int8Array.from(st.b);
      let ko = st.ko, turn = st.turn, node = rootNode, passes = st.passes;
      const path = [rootNode];
      // 트리 따라 내려가기
      while (node.kids && node.kids.length) {
        const c = pick(node);
        if (c.move === -1) { passes++; ko = -1; }
        else {
          const res = place(b, N, c.move, turn, ko);
          if (!res) { node.kids.splice(node.kids.indexOf(c), 1); continue; }
          ko = res.ko; passes = 0;
          if (firstGen[c.move] !== gen) { firstGen[c.move] = gen; first[c.move] = turn; }
        }
        turn = other(turn); node = c; path.push(c);
        if (passes >= 2) break;
        if (node.rv >= EXPAND_AT && !node.kids) { // 충분히 둘러본 자리에서 펼치기
          let cand = candidateMoves(b, N, turn, ko);
          if (N >= 13 && cand.length > 30) {
            const u = urgentPoints(b, N), mv = st.moves + path.length;
            cand = cand.map((m) => [m, heuristic(b, N, m, turn, ko, mv, u)]).sort((a, c) => c[1] - a[1]).slice(0, 30).map((x) => x[0]);
          }
          node.kids = cand.map((m) => mk(m, node, other(turn)));
          if (!node.kids.length) node.kids.push(mk(-1, node, other(turn)));
          withPrior(node, b, turn, ko, st.moves + path.length);
        }
        if (!node.kids) break;
      }
      const lastMove = path.length > 1 ? path[path.length - 1].move : st.last;
      const winner = playout(b, N, turn, ko, first, firstGen, gen, passes >= 2 ? null : own, lastMove == null ? -1 : lastMove);
      done++;
      for (const nd of path) {
        nd.n++; nd.rv++;
        // 수를 둔 쪽(=부모의 차례) 기준 승리
        if (nd.parent && winner === nd.parent.toMove) nd.w++;
        if (nd.kids) for (const c of nd.kids) {
          if (c.move >= 0 && firstGen[c.move] === gen && first[c.move] === nd.toMove) { c.an++; if (winner === nd.toMove) c.aw++; }
        }
      }
    }
    if (!rootNode.kids.length) return { move: -1, winrate: 0.5, own };
    // 최종 선택: 충분히 본 수 중 승률이 가장 높은 수. 비슷하면 돌을 따내거나 살리는 수를 우선
    const tactical = new Map();
    {
      const seen = new Uint8Array(total);
      for (let p = 0; p < total; p++) {
        if (!st.b[p] || seen[p]) continue;
        const g = floodGroup(st.b, N, p);
        for (let i = 0; i < g.size; i++) seen[work.group[i]] = 1;
        if (g.libs === 1) tactical.set(work.lastLib, (tactical.get(work.lastLib) || 0) + g.size);
      }
    }
    const maxN = Math.max(...rootNode.kids.map((c) => c.rv));
    let best = rootNode.kids[0], bestV = -Infinity;
    for (const c of rootNode.kids) {
      if (c.rv < maxN * (tactical.has(c.move) ? 0.05 : 0.15)) continue; // 따내기·살리기 수는 덜 둘러봤어도 후보로 남김
      const v = c.w / c.n + (tactical.has(c.move) ? Math.min(0.25, 0.08 + 0.04 * tactical.get(c.move)) : 0);
      if (v > bestV) { bestV = v; best = c; }
    }
    if (opts.pickTop) {
      const ranked = rootNode.kids.filter((c) => c.move >= 0 && c.rv > 0).sort((a, c) => c.rv - a.rv).slice(0, opts.pickTop);
      if (ranked.length) best = ranked[Math.floor(Math.random() * ranked.length)];
    }
    const winrate = best.n ? best.w / best.n : 0.5;
    for (let p = 0; p < total; p++) own[p] /= Math.max(1, done);
    // 확실한 내 집 안에 두는 수는 손해이므로 그럴 땐 패스
    if (best.move >= 0 && allowPass) {
      const mine = st.turn === BLACK ? own[best.move] : -own[best.move];
      if (mine > 0.9) return { move: -1, winrate, own, playouts: done };
    }
    return { move: best.move, winrate, own, playouts: done };
  }

  // 종국 후 사석 추정: 무작위 대국으로 각 칸의 주인을 어림
  function estimateDead(st, playouts = 300) {
    const N = st.N, total = N * N, own = new Float64Array(total);
    const first = new Int8Array(total), firstGen = new Int32Array(total);
    for (let i = 0; i < playouts; i++) playout(Int8Array.from(st.b), N, i % 2 ? BLACK : WHITE, -1, first, firstGen, i + 1, own, -1);
    const dead = [], seen = new Uint8Array(total);
    for (let p = 0; p < total; p++) {
      if (!st.b[p] || seen[p]) continue;
      const g = floodGroup(st.b, N, p);
      const pts = Array.from(work.group.slice(0, g.size));
      let sum = 0;
      for (const q of pts) { seen[q] = 1; sum += own[q] / playouts; }
      const mean = sum / pts.length, color = st.b[p];
      if ((color === BLACK && mean < -0.2) || (color === WHITE && mean > 0.2) || isolated(st, pts, color)) dead.push(...pts);
    }
    return dead;
  }

  // 몇 점 안 되는 돌이 상대 돌로만 둘러싸인 넓은 빈 곳에 홀로 있으면 사석으로 봄
  function isolated(st, pts, color) {
    if (pts.length > 3) return false;
    const N = st.N, nb = nbCache[N], b = st.b, opp = other(color);
    const seen = new Uint8Array(N * N), stack = [];
    for (const q of pts) seen[q] = 1;
    for (const q of pts) for (const n of nb[q]) if (!b[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
    let size = 0, touchOwnElsewhere = false, touchOpp = false;
    while (stack.length) {
      const q = stack.pop();
      size++;
      for (const n of nb[q]) {
        if (seen[n]) continue;
        if (!b[n]) { seen[n] = 1; stack.push(n); }
        else if (b[n] === opp) touchOpp = true;
        else touchOwnElsewhere = true;
      }
    }
    return touchOpp && !touchOwnElsewhere && size >= 6;
  }

  function groupAt(st, p) {
    if (!st.b[p]) return [];
    const g = floodGroup(st.b, st.N, p);
    return Array.from(work.group.slice(0, g.size));
  }

  const LEVELS = {
    beginner: { heuristicOnly: true, pick: 6 },  // 바둑 상식 상위 6수 중 하나 (탐색 없음)
    easy: { playouts: 200, timeMs: 1000, pickTop: 3 },  // 적게 보고, 상위 3수 중 하나
    medium: { playouts: 1500, timeMs: 2500 },
    hard: { playouts: 4000, timeMs: 3500 },
    expert: { playouts: 20000, timeMs: 9000 }, // 어려움보다 2.5배 이상 더 많이 읽음
  };
  const bestMove = (st, level) => mcts(st, LEVELS[level] || LEVELS.medium).move;

  const api = { LEVELS, EMPTY, BLACK, WHITE, KOMI, create, play, isLegal, score, estimateDead, groupAt, bestMove, mcts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GoEngine = api;
})(typeof self !== 'undefined' ? self : this);

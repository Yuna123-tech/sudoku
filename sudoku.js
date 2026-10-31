/* 스도쿠 엔진: 변형 규칙, 풀이기, 생성기 (브라우저/워커/Node 공용) */
(function (root) {
  'use strict';

  const ALL = 0x1ff;
  const POP = new Uint8Array(512);
  for (let i = 1; i < 512; i++) POP[i] = POP[i >> 1] + (i & 1);
  const bitToDigit = (b) => 32 - Math.clz32(b);

  const VARIANTS = [
    { id: 'classic', name: '클래식', short: '클래식', desc: '각 행, 열, 3×3 박스에 1부터 9까지의 숫자가 한 번씩 들어갑니다.' },
    { id: 'diagonal', name: '대각선 (X)', short: '대각선', desc: '클래식 규칙에 더해, 색칠된 두 대각선에도 1~9가 한 번씩 들어갑니다.' },
    { id: 'hyper', name: '하이퍼 (윈도쿠)', short: '하이퍼', desc: '클래식 규칙에 더해, 색칠된 네 개의 3×3 창에도 1~9가 한 번씩 들어갑니다.' },
    { id: 'jigsaw', name: '지그소 (불규칙)', short: '지그소', desc: '박스 대신 굵은 선으로 나뉜 불규칙한 9칸 영역마다 1~9가 한 번씩 들어갑니다.' },
    { id: 'killer', name: '킬러', short: '킬러', desc: '점선 케이지 안 숫자의 합이 왼쪽 위의 숫자와 같아야 하며, 케이지 안에서는 숫자가 반복되지 않습니다.' },
    { id: 'evenodd', name: '홀짝', short: '홀짝', desc: '회색 네모 칸에는 짝수, 회색 동그라미 칸에는 홀수만 들어갑니다.' },
    { id: 'centerdot', name: '센터 도트', short: '센터도트', desc: '클래식 규칙에 더해, 각 박스의 가운데 칸(색칠된 9칸)에도 1~9가 한 번씩 들어갑니다.' },
    { id: 'asterisk', name: '아스테리스크', short: '별표', desc: '클래식 규칙에 더해, 별 모양으로 색칠된 9칸에도 1~9가 한 번씩 들어갑니다.' },
  ];

  const DIFFICULTIES = [
    { id: 'beginner', name: '입문', clues: 48, killer: 40, singles: true },
    { id: 'easy', name: '쉬움', clues: 42, killer: 32, singles: true },
    { id: 'medium', name: '보통', clues: 34, killer: 22, singles: false },
    { id: 'hard', name: '어려움', clues: 27, killer: 10, singles: false },
    { id: 'expert', name: '전문가', clues: 22, killer: 0, singles: false },
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const rc = (r, c) => r * 9 + c;

  function standardRegions() {
    return range(81).map((i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));
  }

  function neighbors(i) {
    const r = Math.floor(i / 9), c = i % 9, out = [];
    if (r > 0) out.push(i - 9);
    if (r < 8) out.push(i + 9);
    if (c > 0) out.push(i - 1);
    if (c < 8) out.push(i + 1);
    return out;
  }

  function extraGroups(variant) {
    switch (variant) {
      case 'diagonal':
        return [range(9).map((i) => rc(i, i)), range(9).map((i) => rc(i, 8 - i))];
      case 'hyper':
        return [[1, 1], [1, 5], [5, 1], [5, 5]].map(([r0, c0]) =>
          range(9).map((k) => rc(r0 + Math.floor(k / 3), c0 + (k % 3))));
      case 'centerdot':
        return [range(9).map((k) => rc(1 + 3 * Math.floor(k / 3), 1 + 3 * (k % 3)))];
      case 'asterisk':
        return [[[1, 4], [2, 2], [2, 6], [4, 1], [4, 4], [4, 7], [6, 2], [6, 6], [7, 4]].map(([r, c]) => rc(r, c))];
      default:
        return [];
    }
  }

  /* p: { variant, regions, cages, marks } → 풀이에 필요한 구조 */
  function buildContext(p) {
    const groups = [];
    for (let r = 0; r < 9; r++) groups.push(range(9).map((c) => rc(r, c)));
    for (let c = 0; c < 9; c++) groups.push(range(9).map((r) => rc(r, c)));
    const regions = p.regions || standardRegions();
    for (let k = 0; k < 9; k++) groups.push(range(81).filter((i) => regions[i] === k));
    const extras = extraGroups(p.variant);
    extras.forEach((g) => groups.push(g));

    const cellGroups = range(81).map(() => []);
    groups.forEach((g, gi) => g.forEach((c) => cellGroups[c].push(gi)));

    const allowed = new Int16Array(81).fill(ALL);
    const marks = p.marks || [];
    for (let i = 0; i < 81; i++) {
      if (marks[i] === 1) allowed[i] = 0x155; // 홀수
      else if (marks[i] === 2) allowed[i] = 0x0aa; // 짝수
    }

    const cages = p.cages || [];
    const cageOf = new Int16Array(81).fill(-1);
    cages.forEach((cg, k) => cg.cells.forEach((c) => (cageOf[c] = k)));

    const peers = range(81).map((c) => {
      const s = new Set();
      cellGroups[c].forEach((gi) => groups[gi].forEach((x) => s.add(x)));
      if (cageOf[c] >= 0) cages[cageOf[c]].cells.forEach((x) => s.add(x));
      s.delete(c);
      return Array.from(s);
    });

    const extraCells = new Set();
    extras.forEach((g) => g.forEach((c) => extraCells.add(c)));

    return { groups, cellGroups, allowed, cages, cageOf, peers, regions, extraCells };
  }

  /* 백트래킹 풀이기 (MRV). opts: limit(해 개수 상한), nodeLimit, rnd(무작위 순서) */
  function solve(grid, ctx, opts) {
    opts = opts || {};
    const limit = opts.limit || 1;
    const nodeLimit = opts.nodeLimit || Infinity;
    const rnd = opts.rnd || null;
    const g = Int8Array.from(grid);
    const { cellGroups, allowed, cageOf, cages } = ctx;
    const used = new Int32Array(ctx.groups.length);
    const nc = cages.length;
    const cSum = new Int32Array(nc), cUsed = new Int32Array(nc), cLeft = new Int32Array(nc);
    for (let k = 0; k < nc; k++) cLeft[k] = cages[k].cells.length;
    const fail = { count: 0, solution: null, aborted: false };

    for (let c = 0; c < 81; c++) {
      const d = g[c];
      if (!d) continue;
      const b = 1 << (d - 1);
      if (!(allowed[c] & b)) return fail;
      const gs = cellGroups[c];
      for (let i = 0; i < gs.length; i++) {
        if (used[gs[i]] & b) return fail;
        used[gs[i]] |= b;
      }
      const k = cageOf[c];
      if (k >= 0) {
        if (cUsed[k] & b) return fail;
        cUsed[k] |= b; cSum[k] += d; cLeft[k]--;
      }
    }
    for (let k = 0; k < nc; k++) {
      if (cLeft[k] === 0 && cSum[k] !== cages[k].sum) return fail;
      if (cSum[k] >= cages[k].sum && cLeft[k] > 0) return fail;
    }

    function cageOk(k, d, b) {
      const rem = cages[k].sum - cSum[k] - d;
      const left = cLeft[k] - 1;
      if (left === 0) return rem === 0;
      if (rem <= 0) return false;
      const avail = ALL & ~(cUsed[k] | b);
      let mn = 0, mx = 0, cnt = 0;
      for (let x = 1; x <= 9 && cnt < left; x++) if (avail & (1 << (x - 1))) { mn += x; cnt++; }
      if (cnt < left) return false;
      cnt = 0;
      for (let x = 9; x >= 1 && cnt < left; x--) if (avail & (1 << (x - 1))) { mx += x; cnt++; }
      return rem >= mn && rem <= mx;
    }

    function cand(c) {
      let m = allowed[c];
      const gs = cellGroups[c];
      for (let i = 0; i < gs.length; i++) m &= ~used[gs[i]];
      const k = cageOf[c];
      if (k >= 0 && m) {
        m &= ~cUsed[k];
        let out = 0;
        for (let mm = m; mm; mm &= mm - 1) {
          const b = mm & -mm;
          if (cageOk(k, bitToDigit(b), b)) out |= b;
        }
        m = out;
      }
      return m;
    }

    let count = 0, nodes = 0, solution = null, aborted = false;

    function rec() {
      if (++nodes > nodeLimit) { aborted = true; return true; }
      let best = -1, bestM = 0, bestN = 10;
      for (let c = 0; c < 81; c++) {
        if (g[c]) continue;
        const m = cand(c), n = POP[m];
        if (n < bestN) {
          if (n === 0) return false;
          bestN = n; best = c; bestM = m;
          if (n === 1) break;
        }
      }
      if (best < 0) {
        count++;
        if (!solution) solution = Array.from(g);
        return count >= limit;
      }
      const digits = [];
      for (let mm = bestM; mm; mm &= mm - 1) digits.push(bitToDigit(mm & -mm));
      if (rnd) shuffle(digits, rnd);
      const gs = cellGroups[best], k = cageOf[best];
      for (let di = 0; di < digits.length; di++) {
        const d = digits[di], b = 1 << (d - 1);
        g[best] = d;
        for (let i = 0; i < gs.length; i++) used[gs[i]] |= b;
        if (k >= 0) { cSum[k] += d; cUsed[k] |= b; cLeft[k]--; }
        const stop = rec();
        g[best] = 0;
        for (let i = 0; i < gs.length; i++) used[gs[i]] &= ~b;
        if (k >= 0) { cSum[k] -= d; cUsed[k] &= ~b; cLeft[k]++; }
        if (stop) return true;
      }
      return false;
    }

    rec();
    return { count, solution, aborted };
  }

  /* 네이키드/히든 싱글만으로 풀리는지 (쉬운 난이도 판정용) */
  function singlesSolvable(grid, ctx) {
    const g = Int8Array.from(grid);
    const { groups, cellGroups, allowed } = ctx;
    const used = new Int32Array(groups.length);
    const place = (c, d) => {
      g[c] = d;
      const b = 1 << (d - 1);
      cellGroups[c].forEach((gi) => (used[gi] |= b));
    };
    for (let c = 0; c < 81; c++) if (g[c]) { const d = g[c]; g[c] = 0; place(c, d); }
    const cand = (c) => {
      let m = allowed[c];
      cellGroups[c].forEach((gi) => (m &= ~used[gi]));
      return m;
    };
    let progress = true;
    while (progress) {
      progress = false;
      for (let c = 0; c < 81; c++) {
        if (g[c]) continue;
        const m = cand(c);
        if (!m) return false;
        if (POP[m] === 1) { place(c, bitToDigit(m)); progress = true; }
      }
      if (progress) continue;
      for (let gi = 0; gi < groups.length && !progress; gi++) {
        for (let d = 1; d <= 9; d++) {
          const b = 1 << (d - 1);
          if (used[gi] & b) continue;
          let pos = -1, n = 0;
          for (const c of groups[gi]) if (!g[c] && (cand(c) & b)) { pos = c; n++; }
          if (n === 1) { place(pos, d); progress = true; break; }
        }
      }
    }
    for (let c = 0; c < 81; c++) if (!g[c]) return false;
    return true;
  }

  function isConnected(reg, k) {
    const cells = [];
    for (let i = 0; i < 81; i++) if (reg[i] === k) cells.push(i);
    if (!cells.length) return false;
    const seen = new Set([cells[0]]), stack = [cells[0]];
    while (stack.length) {
      const x = stack.pop();
      for (const n of neighbors(x)) if (reg[n] === k && !seen.has(n)) { seen.add(n); stack.push(n); }
    }
    return seen.size === cells.length;
  }

  function jigsawRegions(rnd) {
    const reg = standardRegions();
    let swaps = 0, tries = 0;
    while (swaps < 70 && tries < 6000) {
      tries++;
      const a = Math.floor(rnd() * 81);
      const nbs = neighbors(a).filter((n) => reg[n] !== reg[a]);
      if (!nbs.length) continue;
      const A = reg[a], B = reg[nbs[Math.floor(rnd() * nbs.length)]];
      const bs = [];
      for (let i = 0; i < 81; i++) if (reg[i] === B && neighbors(i).some((n) => reg[n] === A && n !== a)) bs.push(i);
      if (!bs.length) continue;
      const b = bs[Math.floor(rnd() * bs.length)];
      reg[a] = B; reg[b] = A;
      if (isConnected(reg, A) && isConnected(reg, B)) swaps++;
      else { reg[a] = A; reg[b] = B; }
    }
    return reg;
  }

  function makeCages(sol, rnd) {
    const owner = new Int16Array(81).fill(-1);
    const cages = [];
    const sizes = [1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5];
    for (const s of shuffle(range(81), rnd)) {
      if (owner[s] >= 0) continue;
      const id = cages.length;
      const target = sizes[Math.floor(rnd() * sizes.length)];
      const cells = [s];
      let mask = 1 << (sol[s] - 1);
      owner[s] = id;
      while (cells.length < target) {
        const frontier = [];
        for (const c of cells) for (const n of neighbors(c))
          if (owner[n] < 0 && !(mask & (1 << (sol[n] - 1))) && !frontier.includes(n)) frontier.push(n);
        if (!frontier.length) break;
        const n = frontier[Math.floor(rnd() * frontier.length)];
        cells.push(n); owner[n] = id; mask |= 1 << (sol[n] - 1);
      }
      cells.sort((x, y) => x - y);
      cages.push({ cells, sum: cells.reduce((t, c) => t + sol[c], 0) });
    }
    return cages;
  }

  function dig(sol, ctx, diff, isKiller, rnd) {
    const target = isKiller ? diff.killer : diff.clues;
    const nodeLimit = isKiller ? 15000 : 60000;
    const useSingles = diff.singles && !isKiller;
    const puzzle = sol.slice();
    let clues = 81;

    const tryRemove = (cells) => {
      const saved = cells.map((c) => puzzle[c]);
      cells.forEach((c) => (puzzle[c] = 0));
      const res = solve(puzzle, ctx, { limit: 2, nodeLimit });
      let ok = res.count === 1 && !res.aborted;
      if (ok && useSingles) ok = singlesSolvable(puzzle, ctx);
      if (ok) clues -= cells.length;
      else cells.forEach((c, i) => (puzzle[c] = saved[i]));
    };

    // 1단계: 점대칭으로 쌍 제거
    for (const c of shuffle(range(41), rnd)) {
      if (clues <= target) break;
      tryRemove(c === 40 ? [40] : [c, 80 - c]);
    }
    // 2단계: 목표에 못 미치면 한 칸씩 추가 제거
    if (clues > target) {
      for (const c of shuffle(range(81), rnd)) {
        if (clues <= target) break;
        if (puzzle[c]) tryRemove([c]);
      }
    }
    return puzzle;
  }

  function generate(variantId, diffId, seed) {
    if (seed == null) seed = Math.floor(Math.random() * 4294967296);
    const rnd = mulberry32(seed);
    const diff = DIFFICULTIES.find((d) => d.id === diffId) || DIFFICULTIES[2];
    const variant = VARIANTS.find((v) => v.id === variantId) ? variantId : 'classic';

    for (let attempt = 0; attempt < 50; attempt++) {
      const p = {
        variant,
        regions: variant === 'jigsaw' ? jigsawRegions(rnd) : standardRegions(),
        cages: [],
        marks: new Array(81).fill(0),
      };
      const res = solve(new Array(81).fill(0), buildContext(p), { rnd, nodeLimit: 80000 });
      if (!res.solution) continue;
      const sol = res.solution;

      if (variant === 'killer') p.cages = makeCages(sol, rnd);
      if (variant === 'evenodd') {
        const n = 16 + Math.floor(rnd() * 6);
        shuffle(range(81), rnd).slice(0, n).forEach((c) => (p.marks[c] = sol[c] % 2 ? 1 : 2));
      }
      const ctx = buildContext(p);
      const givens = dig(sol, ctx, diff, variant === 'killer', rnd);
      return {
        variant, difficulty: diff.id, seed,
        regions: p.regions, cages: p.cages, marks: p.marks,
        givens, solution: sol,
      };
    }
    throw new Error('퍼즐 생성 실패');
  }

  const api = { VARIANTS, DIFFICULTIES, buildContext, solve, singlesSolvable, generate, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sudoku = api;
})(typeof self !== 'undefined' ? self : this);

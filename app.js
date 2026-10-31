(() => {
  'use strict';
  const { VARIANTS, DIFFICULTIES, buildContext } = Sudoku;
  const $ = (id) => document.getElementById(id);

  /* ---------- 로컬 저장소 (이 브라우저에만 저장) ---------- */
  const KEYS = { settings: 'sudoku:settings', saves: 'sudoku:saves', records: 'sudoku:records' };
  const store = {
    get(k, def) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
    },
  };

  const settings = Object.assign({
    variant: 'classic', difficulty: 'medium', theme: 'auto', lastKey: null,
    lang: (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en',
    mistakeLimit: true, showMistakes: true, highlightSame: true, highlightPeers: true, autoClean: true,
  }, store.get(KEYS.settings, {}));
  let saves = store.get(KEYS.saves, {});
  let records = Object.assign({ completed: [], best: {}, started: {}, daily: {} }, store.get(KEYS.records, {}));

  const saveSettings = () => store.set(KEYS.settings, settings);
  const saveRecords = () => store.set(KEYS.records, records);
  function persist() {
    if (!game || game.won) return;
    game.updatedAt = Date.now();
    saves[game.key] = Object.assign({}, game, { history: game.history.slice(-60) });
    if (!store.set(KEYS.saves, saves)) {
      // 용량 초과 시 실행취소 기록을 버리고 재시도
      Object.values(saves).forEach((s) => (s.history = []));
      store.set(KEYS.saves, saves);
    }
  }

  /* ---------- 상태 ---------- */
  const MAX_MISTAKES = 3;
  const ICON_PAUSE = '<svg class="ico" viewBox="0 0 24 24"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>';
  const ICON_PLAY = '<svg class="ico" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
  let game = null, ctx = null, sel = 40, notesMode = false, paused = false, generating = false;
  let cells = [];

  /* ---------- 언어 ---------- */
  const t = (k, params) => {
    const dict = I18N[settings.lang] || I18N.ko;
    let str = dict[k] ?? I18N.ko[k] ?? k;
    if (params) for (const [x, y] of Object.entries(params)) str = str.split(`{${x}}`).join(y);
    return str;
  };
  const locale = () => (settings.lang === 'en' ? 'en-US' : 'ko-KR');
  const vName = (id) => t(`v.${id}`), vShort = (id) => t(`v.${id}.short`), vDesc = (id) => t(`v.${id}.desc`);
  const dName = (id) => t(`d.${id}`);

  function applyLang() {
    document.documentElement.lang = settings.lang;
    document.title = t('appName');
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    document.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $('lang-label').textContent = settings.lang === 'ko' ? 'English' : '한국어';
  }

  function setLang(lang) {
    settings.lang = lang;
    saveSettings();
    applyLang();
    renderSide();
    update();
    if (overlayFn && !$('overlay').classList.contains('hidden')) showOverlay(overlayFn);
    if (window.BoardGames) window.BoardGames.refresh();
  }
  const comboKey = (v, d) => `${v}-${d}`;
  const fmt = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
  };
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /* ---------- 퍼즐 생성 (웹 워커, 실패 시 메인 스레드) ---------- */
  let worker = null, reqId = 0;
  const pending = new Map();
  try {
    worker = new Worker('worker.js');
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data.puzzle);
    };
    worker.onerror = () => { worker = null; };
  } catch { worker = null; }

  function requestPuzzle(variant, difficulty, seed) {
    if (worker) {
      return new Promise((resolve, reject) => {
        const id = ++reqId;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, variant, difficulty, seed });
      });
    }
    return new Promise((resolve) => setTimeout(() => resolve(Sudoku.generate(variant, difficulty, seed)), 30));
  }

  async function startNew(variant, difficulty, opts = {}) {
    generating = true;
    showOverlay(() => `<div class="spinner"></div><p>${t('generating')}</p>`);
    let puzzle;
    try {
      puzzle = await requestPuzzle(variant, difficulty, opts.seed);
    } catch (err) {
      generating = false;
      showOverlay(() => `<h3>${t('oops')}</h3><p>${t('genFail')}</p><button class="btn primary" data-act="retry">${t('retry')}</button>`);
      return;
    }
    const key = opts.daily ? `daily-${opts.daily}` : comboKey(variant, difficulty);
    game = {
      key, puzzle, daily: opts.daily || null,
      values: puzzle.givens.slice(), notes: new Array(81).fill(0), hinted: [],
      elapsed: 0, mistakes: 0, hints: 0, history: [], won: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    records.started[comboKey(variant, difficulty)] = (records.started[comboKey(variant, difficulty)] || 0) + 1;
    saveRecords();
    generating = false;
    paused = false;
    activate();
    persist();
  }

  function loadSave(key) {
    const s = saves[key];
    if (!s) return false;
    game = Object.assign({ history: [], hinted: [] }, s);
    paused = false;
    activate();
    return true;
  }

  function activate() {
    ctx = buildContext(game.puzzle);
    settings.lastKey = game.key;
    if (!game.daily) {
      settings.variant = game.puzzle.variant;
      settings.difficulty = game.puzzle.difficulty;
    }
    saveSettings();
    sel = game.values.findIndex((v) => !v);
    if (sel < 0) sel = 40;
    hideOverlay();
    buildBoard();
    renderSide();
    update();
    if (game.over) showGameOver();
  }

  /* ---------- 판 그리기 ---------- */
  function buildBoard() {
    const grid = $('grid');
    const p = game.puzzle;
    const reg = ctx.regions;
    grid.innerHTML = '';
    $('board').className = `board ${p.variant}`;
    cells = [];
    const cageFirst = new Map(p.cages.map((cg) => [cg.cells[0], cg.sum]));
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const el = document.createElement('div');
      let cls = 'cell';
      if (c === 8) cls += ' c8'; else if (reg[i] !== reg[i + 1]) cls += ' tr';
      if (r === 8) cls += ' r8'; else if (reg[i] !== reg[i + 9]) cls += ' tb';
      if (ctx.extraCells.has(i)) cls += ' shade';
      el.dataset.base = cls;
      el.dataset.reg = reg[i];
      el.dataset.i = i;
      let html = '';
      if (p.marks[i]) html += `<div class="mark ${p.marks[i] === 2 ? 'even' : 'odd'}"></div>`;
      if (cageFirst.has(i)) html += `<div class="cage-sum">${cageFirst.get(i)}</div>`;
      html += `<span class="val"></span><div class="notes">${'<span></span>'.repeat(9)}</div>`;
      el.innerHTML = html;
      el.addEventListener('pointerdown', () => { sel = i; update(); });
      grid.appendChild(el);
      cells.push({ el, val: el.querySelector('.val'), notes: el.querySelector('.notes').children });
    }
    if (p.cages.length) grid.insertAdjacentHTML('beforeend', cageSvg(p.cages));
  }

  function cageSvg(cages) {
    const owner = new Int16Array(81).fill(-1);
    cages.forEach((cg, k) => cg.cells.forEach((c) => (owner[c] = k)));
    const I = 8, S = 100;
    let d = '';
    cages.forEach((cg, k) => {
      const same = (r, c) => r >= 0 && r < 9 && c >= 0 && c < 9 && owner[r * 9 + c] === k;
      cg.cells.forEach((i, idx) => {
        const r = Math.floor(i / 9), c = i % 9;
        const x0 = c * S, y0 = r * S, x1 = x0 + S, y1 = y0 + S;
        const lab = idx === 0;
        const ext = (along, diag, edge, sign) => (along ? (diag ? edge + sign * I : edge) : edge - sign * I);
        if (!same(r - 1, c)) {
          const a = ext(same(r, c - 1), same(r - 1, c - 1), x0, -1) + (lab ? 30 : 0);
          d += `M${a} ${y0 + I}H${ext(same(r, c + 1), same(r - 1, c + 1), x1, 1)}`;
        }
        if (!same(r + 1, c)) d += `M${ext(same(r, c - 1), same(r + 1, c - 1), x0, -1)} ${y1 - I}H${ext(same(r, c + 1), same(r + 1, c + 1), x1, 1)}`;
        if (!same(r, c - 1)) {
          const a = ext(same(r - 1, c), same(r - 1, c - 1), y0, -1) + (lab ? 28 : 0);
          d += `M${x0 + I} ${a}V${ext(same(r + 1, c), same(r + 1, c - 1), y1, 1)}`;
        }
        if (!same(r, c + 1)) d += `M${x1 - I} ${ext(same(r - 1, c), same(r - 1, c + 1), y0, -1)}V${ext(same(r + 1, c), same(r + 1, c + 1), y1, 1)}`;
      });
    });
    return `<svg class="cages" viewBox="0 0 900 900" preserveAspectRatio="none"><path d="${d}"/></svg>`;
  }

  function update() {
    if (!game) return;
    const { values, notes, puzzle } = game;
    const selVal = values[sel];
    const peerSet = new Set(settings.highlightPeers ? ctx.peers[sel] : []);
    const hinted = new Set(game.hinted);
    for (let i = 0; i < 81; i++) {
      const { el, val, notes: ns } = cells[i];
      const v = values[i];
      let cls = el.dataset.base;
      if (puzzle.givens[i]) cls += ' given';
      if (hinted.has(i)) cls += ' hinted';
      if (i === sel) cls += ' selected';
      else if (settings.highlightSame && selVal && v === selVal) cls += ' same';
      else if (peerSet.has(i)) cls += ' peer';
      if (v && ctx.peers[i].some((p) => values[p] === v)) cls += ' conflict';
      if (v && settings.showMistakes && v !== puzzle.solution[i]) cls += ' wrong';
      el.className = cls;
      val.textContent = v || '';
      for (let d = 0; d < 9; d++) {
        const on = !v && (notes[i] >> d) & 1;
        ns[d].textContent = on ? d + 1 : '';
        ns[d].className = on && settings.highlightSame && selVal === d + 1 ? 'hl' : '';
      }
    }
    // 숫자 패드
    const counts = new Array(10).fill(0);
    values.forEach((v) => counts[v]++);
    document.querySelectorAll('.num').forEach((b) => {
      const d = +b.dataset.d;
      b.querySelector('small').textContent = Math.max(0, 9 - counts[d]);
      b.classList.toggle('done', counts[d] >= 9);
    });
    $('st-mistakes').innerHTML = settings.mistakeLimit
      ? Array.from({ length: MAX_MISTAKES }, (_, k) => `<i class="${k < game.mistakes ? 'used' : ''}"></i>`).join('')
      : `<i class="${game.mistakes ? 'used' : ''}"></i><b>${game.mistakes}</b>`;
    // 진행률: 빈칸 중 채운 비율
    const empty = puzzle.givens.filter((x) => !x).length;
    const filled = values.filter((x, k) => x && !puzzle.givens[k]).length;
    $('st-progress').style.width = `${empty ? Math.round((filled / empty) * 100) : 0}%`;
    $('st-hints').textContent = game.hints;
    $('st-time').textContent = fmt(game.elapsed);
    $('btn-notes').classList.toggle('on', notesMode);
    $('notes-state').textContent = notesMode ? t('on') : t('off');
    $('numpad').classList.toggle('notes-mode', notesMode);
  }

  function renderSide() {
    const v = game ? game.puzzle.variant : settings.variant;
    const d = game ? game.puzzle.difficulty : settings.difficulty;
    if (!document.body.dataset.game || document.body.dataset.game === 'sudoku') document.documentElement.dataset.variant = v;
    $('st-variant').textContent = vName(v);
    $('st-diff').textContent = dName(d);
    $('st-daily').classList.toggle('hidden', !(game && game.daily));
    $('rule').textContent = vDesc(v);
    $('variants').innerHTML = VARIANTS.map((x) => {
      const has = saves[comboKey(x.id, settings.difficulty)];
      return `<button class="chip ${x.id === settings.variant && !(game && game.daily) ? 'active' : ''}" data-v="${x.id}" data-variant="${x.id}"><span class="dot"></span><span class="name">${vShort(x.id)}</span>${has ? `<span class="prog" title="${t('inProgress')}"></span>` : ''}</button>`;
    }).join('');
    // 좁은 화면용 선택 상자
    $('pick-v').innerHTML = VARIANTS.map((x) =>
      `<option value="${x.id}"${x.id === settings.variant ? ' selected' : ''}>${vName(x.id)}${saves[comboKey(x.id, settings.difficulty)] ? ' •' : ''}</option>`).join('');
    $('pick-d').innerHTML = DIFFICULTIES.map((x) =>
      `<option value="${x.id}"${x.id === settings.difficulty ? ' selected' : ''}>${dName(x.id)}</option>`).join('');
    $('diffs').innerHTML = DIFFICULTIES.map((x) =>
      `<button class="chip ${x.id === settings.difficulty && !(game && game.daily) ? 'active' : ''}" data-d="${x.id}">${dName(x.id)}</button>`).join('');
  }

  /* ---------- 오버레이 / 토스트 ---------- */
  /* 내용을 함수로 받아 두었다가 언어를 바꾸면 다시 그림 */
  let overlayFn = null;
  function showOverlay(fn) {
    overlayFn = fn;
    $('overlay-content').innerHTML = fn();
    $('overlay').classList.remove('hidden');
  }
  function hideOverlay() { $('overlay').classList.add('hidden'); }
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  /* ---------- 플레이 ---------- */
  const canPlay = () => game && !game.won && !game.over && !paused && !generating;
  const editable = (i) => !game.puzzle.givens[i] && !game.hinted.includes(i);

  function pushHistory() {
    game.history.push({ v: game.values.slice(), n: game.notes.slice() });
    if (game.history.length > 200) game.history.shift();
  }

  function clearPeerNotes(i, d) {
    if (!settings.autoClean) return;
    const b = 1 << (d - 1);
    ctx.peers[i].forEach((p) => (game.notes[p] &= ~b));
  }

  function input(d, forceNotes) {
    if (!canPlay() || !editable(sel)) return;
    const i = sel;
    if ((notesMode || forceNotes) && !game.values[i]) {
      pushHistory();
      game.notes[i] ^= 1 << (d - 1);
    } else {
      pushHistory();
      if (game.values[i] === d) {
        game.values[i] = 0;
      } else {
        game.values[i] = d;
        game.notes[i] = 0;
        popCell(i);
        clearPeerNotes(i, d);
        if (d !== game.puzzle.solution[i]) game.mistakes++;
      }
    }
    if (settings.mistakeLimit && game.mistakes >= MAX_MISTAKES) return gameOver();
    afterMove();
  }

  /* 실수 제한 초과: 판 종료 (저장해 두어 새로고침해도 유지) */
  function gameOver() {
    game.over = true;
    records.failed = (records.failed || 0) + 1;
    saveRecords();
    update();
    persist();
    showGameOver();
  }

  function showGameOver() {
    showOverlay(() => `
      <h3>${t('gameOver')}</h3>
      <p>${t('gameOverMsg', { n: MAX_MISTAKES })}<br>${t('time', { t: fmt(game.elapsed) })}</p>
      <div class="actions"><button class="btn primary" data-act="restart">${t('restartSame')}</button><button class="btn" data-act="new">${t('newPuzzle')}</button></div>`);
  }

  function restart() {
    Object.assign(game, {
      values: game.puzzle.givens.slice(), notes: new Array(81).fill(0), hinted: [],
      elapsed: 0, mistakes: 0, hints: 0, history: [], over: false,
    });
    sel = game.values.findIndex((v) => !v);
    hideOverlay();
    update();
    persist();
  }

  function popCell(i) {
    const v = cells[i] && cells[i].val;
    if (!v) return;
    v.classList.remove('pop');
    void v.offsetWidth; // 애니메이션 다시 시작
    v.classList.add('pop');
  }

  function erase() {
    if (!canPlay() || !editable(sel)) return;
    if (!game.values[sel] && !game.notes[sel]) return;
    pushHistory();
    game.values[sel] = 0;
    game.notes[sel] = 0;
    afterMove();
  }

  function undo() {
    if (!canPlay()) return;
    const h = game.history.pop();
    if (!h) return toast(t('noUndo'));
    game.values = h.v;
    game.notes = h.n;
    afterMove();
  }

  function candidates(i) {
    let m = ctx.allowed[i];
    ctx.peers[i].forEach((p) => { if (game.values[p]) m &= ~(1 << (game.values[p] - 1)); });
    return m;
  }

  function autoNotes() {
    if (!canPlay()) return;
    pushHistory();
    for (let i = 0; i < 81; i++) game.notes[i] = game.values[i] ? 0 : candidates(i);
    afterMove();
    toast(t('autoNotesDone'));
  }

  function hint() {
    if (!canPlay()) return;
    const { values, puzzle } = game;
    let target = -1;
    if (editable(sel) && values[sel] !== puzzle.solution[sel]) target = sel;
    else {
      let best = 99;
      for (let i = 0; i < 81; i++) {
        if (values[i] === puzzle.solution[i]) continue;
        let n = 0;
        for (let m = candidates(i); m; m &= m - 1) n++;
        if (n < best) { best = n; target = i; }
      }
    }
    if (target < 0) return;
    pushHistory();
    values[target] = puzzle.solution[target];
    popCell(target);
    game.notes[target] = 0;
    clearPeerNotes(target, values[target]);
    if (!game.hinted.includes(target)) game.hinted.push(target);
    game.hints++;
    sel = target;
    afterMove();
  }

  function afterMove() {
    update();
    if (game.values.every((v, i) => v === game.puzzle.solution[i])) win();
    else persist();
  }

  /* 힌트 없이 완료한 기록을 빠른 순으로 (개인 랭킹) */
  function rankList(variant, difficulty) {
    return records.completed
      .filter((r) => r.variant === variant && r.difficulty === difficulty && !r.hints)
      .sort((a, b) => a.time - b.time || a.date - b.date);
  }

  function rankHtml(variant, difficulty) {
    const list = rankList(variant, difficulty);
    if (!list.length) return `<p class="empty">${t('rankEmpty')}</p>`;
    const avg = Math.round(list.reduce((t, r) => t + r.time, 0) / list.length);
    const latest = Math.max(...list.map((r) => r.date));
    const medals = ['🥇', '🥈', '🥉'];
    return `<p class="hint-text rank-sum">${t('rankSum', { n: list.length, best: fmt(list[0].time), avg: fmt(avg) })}</p>
      <div class="list">${list.slice(0, 10).map((r, i) => `<div class="list-item${r.date === latest ? ' latest' : ''}">
        <span><b class="rk">${medals[i] || i + 1}</b>${fmt(r.time)}${r.date === latest ? ` <small>· ${t('latest')}</small>` : ''}</span>
        <small>${new Date(r.date).toLocaleDateString(locale())} · ${t('mistakesN', { n: r.mistakes })}${r.daily ? ' · 📅' : ''}</small></div>`).join('')}</div>`;
  }

  function win() {
    game.won = true;
    const p = game.puzzle;
    const ck = comboKey(p.variant, p.difficulty);
    const prevBest = records.best[ck];
    const isBest = !game.hints && (!prevBest || game.elapsed < prevBest);
    if (isBest) records.best[ck] = game.elapsed;
    const entry = {
      variant: p.variant, difficulty: p.difficulty, time: game.elapsed,
      mistakes: game.mistakes, hints: game.hints, daily: game.daily, date: Date.now(),
    };
    records.completed.unshift(entry);
    records.completed = records.completed.slice(0, 500);
    const ranked = rankList(p.variant, p.difficulty);
    const rank = ranked.indexOf(entry) + 1;
    const hints = game.hints, mistakes = game.mistakes, elapsed = game.elapsed, isDaily = game.daily;
    const rankMsg = () => (hints
      ? t('hintNoRank')
      : `${rank === 1 && ranked.length > 1 ? t('newBest') : ''}${t('rankMsg', { rank, n: ranked.length })}${rank > 1 ? ` · ${t('bestT', { t: fmt(ranked[0].time) })}` : ''}`);
    if (game.daily && !records.daily[game.daily]) records.daily[game.daily] = game.elapsed;
    saveRecords();
    delete saves[game.key];
    store.set(KEYS.saves, saves);
    renderSide();
    update();
    showOverlay(() => `
      <h3>${t('solved')}</h3>
      <p>${vName(p.variant)} · ${dName(p.difficulty)}${isDaily ? ` · ${t('daily')}` : ''}</p>
      <p>${t('resultLine', { t: fmt(elapsed), m: mistakes, h: hints })}<br>
      ${rankMsg()}</p>
      <div class="actions"><button class="btn primary" data-act="new">${t('newGame')}</button><button class="btn" data-act="records">${t('viewRecords')}</button></div>`);
  }

  function togglePause(force) {
    if (!game || game.won || game.over || generating) return;
    paused = force !== undefined ? force : !paused;
    $('btn-pause').innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    if (paused) {
      persist();
      showOverlay(() => `<h3>${t('paused')}</h3><p>${fmt(game.elapsed)}</p><button class="btn primary" data-act="resume">${t('resume')}</button>`);
    } else hideOverlay();
  }

  function move(dr, dc) {
    const r = (Math.floor(sel / 9) + dr + 9) % 9, c = ((sel % 9) + dc + 9) % 9;
    sel = r * 9 + c;
    update();
  }

  /* ---------- 게임 선택 ---------- */
  function choose(variant, difficulty) {
    settings.variant = variant;
    settings.difficulty = difficulty;
    saveSettings();
    const key = comboKey(variant, difficulty);
    if (game && game.key === key && !game.won) return renderSide();
    persist();
    if (!loadSave(key)) startNew(variant, difficulty).then(renderSide);
  }

  function newGame() {
    const inProgress = game && !game.won && !game.daily && game.history.length > 0;
    if (inProgress && !confirm(t('confirmNew'))) return;
    if (game && !game.daily) delete saves[game.key];
    startNew(settings.variant, settings.difficulty).then(renderSide);
  }

  function daily() {
    const ds = todayStr();
    const key = `daily-${ds}`;
    if (game && game.key === key && !game.won) return;
    persist();
    if (loadSave(key)) return;
    const n = +ds.replace(/-/g, '');
    const dayIndex = Math.floor(Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8)) / 86400000);
    const variant = VARIANTS[dayIndex % VARIANTS.length].id;
    if (records.daily[ds]) toast(t('dailyDone', { t: fmt(records.daily[ds]) }));
    startNew(variant, 'medium', { seed: n, daily: ds }).then(renderSide);
  }

  /* ---------- 대화상자 ---------- */
  function openDialog(title, html) {
    $('dlg-title').textContent = title;
    $('dlg-body').innerHTML = html;
    if (!$('dlg').open) $('dlg').showModal();
  }

  function showRecords() {
    persist();
    const done = records.completed;
    const totalTime = done.reduce((t, r) => t + r.time, 0);
    const dailyCount = Object.keys(records.daily).length;
    const head = `<tr><th>${t('type')}</th>${DIFFICULTIES.map((d) => `<th>${dName(d.id)}</th>`).join('')}</tr>`;
    const rows = VARIANTS.map((v) => `<tr><td>${vShort(v.id)}</td>${DIFFICULTIES.map((d) => {
      const b = records.best[comboKey(v.id, d.id)];
      return `<td>${b ? fmt(b) : '–'}</td>`;
    }).join('')}</tr>`).join('');
    const prog = Object.values(saves).sort((a, b) => b.updatedAt - a.updatedAt).map((s) => {
      const p = s.puzzle;
      const empty = p.givens.filter((x) => !x).length;
      const filled = s.values.filter((v, i) => v && !p.givens[i]).length;
      const pct = empty ? Math.round((filled / empty) * 100) : 0;
      return `<button type="button" class="list-item" data-resume="${s.key}">
        <span>${s.daily ? '📅 ' : ''}${vName(p.variant)} · ${dName(p.difficulty)}<br><small>${fmt(s.elapsed)} · ${new Date(s.updatedAt).toLocaleString(locale())}</small></span>
        <span class="progress"><i style="width:${pct}%"></i></span></button>`;
    }).join('');
    const recent = done.slice(0, 20).map((r) => `<div class="list-item">
      <span>${r.daily ? '📅 ' : ''}${vName(r.variant)} · ${dName(r.difficulty)}<br><small>${new Date(r.date).toLocaleString(locale())}</small></span>
      <span>${fmt(r.time)}<br><small>${t('mistakesN', { n: r.mistakes })} · ${t('hintsN', { n: r.hints })}</small></span></div>`).join('');
    openDialog(t('records'), `
      <div class="stat-row">
        <div class="stat"><b>${done.length}</b><span>${t('statDone')}</span></div>
        <div class="stat"><b>${fmt(totalTime)}</b><span>${t('statTime')}</span></div>
        <div class="stat"><b>${dailyCount}</b><span>${t('statDaily')}</span></div>
      </div>
      <h3 class="sub">${t('myRank')}</h3>
      <div class="rank-filter">
        <select id="rk-v">${VARIANTS.map((v) => `<option value="${v.id}"${v.id === settings.variant ? ' selected' : ''}>${vName(v.id)}</option>`).join('')}</select>
        <select id="rk-d">${DIFFICULTIES.map((d) => `<option value="${d.id}"${d.id === settings.difficulty ? ' selected' : ''}>${dName(d.id)}</option>`).join('')}</select>
      </div>
      <div id="rk-list">${rankHtml(settings.variant, settings.difficulty)}</div>
      <h3 class="sub">${t('bestTable')}</h3>
      <div class="tbl-wrap"><table>${head}${rows}</table></div>
      <h3 class="sub">${t('continue')}</h3>
      <div class="list">${prog || `<p class="empty">${t('noProgress')}</p>`}</div>
      <h3 class="sub">${t('recentDone')}</h3>
      <div class="list">${recent || `<p class="empty">${t('noDone')}</p>`}</div>
      <p class="hint-text">${t('storageNote')}</p>
      <div class="btn-row">
        <button type="button" class="btn" data-act="export">${t('export')}</button>
        <button type="button" class="btn" data-act="import">${t('import')}</button>
        <button type="button" class="btn danger" data-act="reset">${t('reset')}</button>
      </div>`);
  }

  function showSettings() {
    const n = { n: MAX_MISTAKES };
    const opt = (k) => `<label class="setting"><span>${t(`set.${k}`, n)}<small>${t(`set.${k}Sub`, n)}</small></span><input type="checkbox" data-set="${k}" ${settings[k] ? 'checked' : ''}></label>`;
    const langRow = `<label class="setting"><span>${t('set.lang')}<small>${t('set.langSub')}</small></span>
      <select id="set-lang" class="lang-select">${Object.keys(I18N).map((l) => `<option value="${l}"${l === settings.lang ? ' selected' : ''}>${I18N[l].langName}</option>`).join('')}</select></label>`;
    const themeRow = `<label class="setting"><span>${t('set.theme')}<small>${t('set.themeSub')}</small></span>
      <select id="set-theme" class="lang-select">${['auto', 'light', 'dark'].map((x) => `<option value="${x}"${x === settings.theme ? ' selected' : ''}>${t(`theme.${x}`)}</option>`).join('')}</select></label>`;
    openDialog(t('settings'), langRow + themeRow + ['mistakeLimit', 'showMistakes', 'highlightSame', 'highlightPeers', 'autoClean'].map(opt).join(''));
  }

  function exportData() {
    persist();
    const data = { app: 'sudoku-playground', version: 1, exportedAt: new Date().toISOString(), settings, saves, records };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sudoku-backup-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.app !== 'sudoku-playground') throw new Error();
        records = Object.assign({ completed: [], best: {}, started: {}, daily: {} }, data.records);
        saves = data.saves || {};
        Object.assign(settings, data.settings || {});
        saveRecords(); store.set(KEYS.saves, saves); saveSettings();
        toast(t('imported'));
        $('dlg').close();
        applyTheme();
        applyLang();
        if (!(settings.lastKey && loadSave(settings.lastKey))) renderSide();
      } catch { toast(t('badBackup')); }
    };
    reader.readAsText(file);
  }

  function resetData() {
    if (!confirm(t('confirmReset'))) return;
    records = { completed: [], best: {}, started: {}, daily: {} };
    saves = {};
    saveRecords(); store.set(KEYS.saves, saves);
    $('dlg').close();
    toast(t('resetDone'));
    startNew(settings.variant, settings.difficulty).then(renderSide);
  }

  /* ---------- 테마 ---------- */
  function applyTheme() {
    if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = settings.theme;
  }

  /* ---------- 이벤트 ---------- */
  $('numpad').innerHTML = Array.from({ length: 9 }, (_, i) =>
    `<button class="num" data-d="${i + 1}"><b>${i + 1}</b><small>9</small></button>`).join('');
  $('numpad').addEventListener('click', (e) => {
    const b = e.target.closest('.num');
    if (b) input(+b.dataset.d);
  });
  $('btn-undo').onclick = undo;
  $('btn-erase').onclick = erase;
  $('btn-notes').onclick = () => { notesMode = !notesMode; update(); };
  $('btn-autonotes').onclick = autoNotes;
  $('btn-hint').onclick = hint;
  $('btn-pause').onclick = () => togglePause();
  $('btn-new').onclick = newGame;
  $('btn-daily').onclick = daily;
  $('btn-records').onclick = () => (window.BoardGames && window.BoardGames.active() ? window.BoardGames.showRecords() : showRecords());
  $('btn-settings').onclick = showSettings;
  $('btn-lang').onclick = () => setLang(settings.lang === 'ko' ? 'en' : 'ko');
  $('btn-new-m').onclick = newGame;
  $('btn-daily-top').onclick = daily;
  $('btn-rule').onclick = () => {
    const v = game ? game.puzzle.variant : settings.variant;
    openDialog(`${t('howto')} · ${t('tab.sudoku')}`, t('guide.sudoku'));
    const slot = $('g-variant');
    if (slot) slot.innerHTML = `<b>${vName(v)}</b>: ${vDesc(v)}`;
  };
  $('pick-v').onchange = (e) => choose(e.target.value, settings.difficulty);
  $('pick-d').onchange = (e) => choose(settings.variant, e.target.value);
  $('variants').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (b) choose(b.dataset.v, settings.difficulty);
  });
  $('diffs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (b) choose(settings.variant, b.dataset.d);
  });
  $('overlay').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'resume') togglePause(false);
    else if (act === 'restart') restart();
    else if (act === 'new') startNew(settings.variant, settings.difficulty).then(renderSide);
    else if (act === 'records') showRecords();
    else if (act === 'retry') startNew(settings.variant, settings.difficulty).then(renderSide);
  });
  $('dlg-body').addEventListener('click', (e) => {
    const resume = e.target.closest('[data-resume]');
    if (resume) {
      persist();
      $('dlg').close();
      loadSave(resume.dataset.resume);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'export') exportData();
    else if (act === 'import') $('import-file').click();
    else if (act === 'reset') resetData();
  });
  $('dlg-body').addEventListener('change', (e) => {
    if (e.target.id === 'set-lang') {
      setLang(e.target.value);
      showSettings();
      return;
    }
    if (e.target.id === 'set-theme') {
      settings.theme = e.target.value;
      saveSettings();
      applyTheme();
      return;
    }
    if (e.target.id === 'rk-v' || e.target.id === 'rk-d') {
      $('rk-list').innerHTML = rankHtml($('rk-v').value, $('rk-d').value);
      return;
    }
    const k = e.target.dataset.set;
    if (!k) return;
    settings[k] = e.target.checked;
    saveSettings();
    update();
  });
  $('import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  const sudokuActive = () => !document.body.dataset.game || document.body.dataset.game === 'sudoku';
  document.addEventListener('keydown', (e) => {
    if ($('dlg').open || !game || !sudokuActive()) return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); return input(+m[1], e.shiftKey); }
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return undo(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); return move(-1, 0);
      case 'ArrowDown': e.preventDefault(); return move(1, 0);
      case 'ArrowLeft': e.preventDefault(); return move(0, -1);
      case 'ArrowRight': e.preventDefault(); return move(0, 1);
      case 'Backspace': case 'Delete': case '0': e.preventDefault(); return erase();
    }
    if (k === 'n') { notesMode = !notesMode; update(); }
    else if (k === 'h') hint();
    else if (k === 'p') togglePause();
  });

  setInterval(() => {
    if (!canPlay() || !sudokuActive() || document.visibilityState !== 'visible') return;
    game.elapsed++;
    $('st-time').textContent = fmt(game.elapsed);
    if (game.elapsed % 5 === 0) persist();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
  window.addEventListener('pagehide', persist);

  /* ---------- 앱 설치 (PWA) ---------- */
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installPrompt = null;
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isNative) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // 새 버전을 다 받아 두면 업데이트 알림을 띄움 (처음 설치할 때는 띄우지 않음)
      const offer = (w) => { if (w && navigator.serviceWorker.controller) showUpdateBar(w); };
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
      });
      // 앱을 켜 둔 채로 있어도 새 버전을 확인
      const check = () => reg.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
  }

  function showUpdateBar(worker) {
    if ($('update-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.className = 'update-bar';
    bar.innerHTML = `<span>${t('updateReady')}</span><button class="btn primary">${t('updateNow')}</button><button class="update-close" aria-label="${t('close')}">✕</button>`;
    bar.querySelector('.btn').onclick = () => {
      persist(); // 하던 게임을 저장한 뒤 새 버전으로 교체
      worker.postMessage('skipWaiting');
    };
    bar.querySelector('.update-close').onclick = () => bar.remove();
    document.body.appendChild(bar);
  }
  // 설치 버튼은 항상 보여줌 (이미 앱으로 실행 중일 때만 숨김).
  // 브라우저가 바로 설치를 지원하면 설치 창을, 아니면 기기별 설치 방법을 안내
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    toast(t('installed'));
  });
  if (!standalone && !isNative) $('btn-install').classList.remove('hidden');
  $('btn-install').onclick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      return;
    }
    const isAndroid = /android/i.test(navigator.userAgent);
    const steps = isIOS ? t('installIos') : isAndroid ? t('installAndroid') : t('installPc');
    openDialog(t('installTitle'), steps + t('installNote'));
  };

  // 체스·장기·바둑 화면(games.js)이 함께 쓰는 기능
  window.SudokuApp = {
    toast, openDialog,
    refresh() { renderSide(); update(); },
  };

  /* ---------- 시작 ---------- */
  applyTheme();
  applyLang();
  renderSide();
  if (!(settings.lastKey && loadSave(settings.lastKey))) {
    startNew(settings.variant, settings.difficulty).then(renderSide);
  }
})();

/* 체스·장기·바둑 컴퓨터를 화면과 따로(백그라운드에서) 계산 */
importScripts('chess-engine.js', 'janggi-engine.js', 'go-engine.js');

function rebuild(game, opts, moves) {
  if (game === 'chess') {
    const st = ChessEngine.create();
    for (const m of moves) ChessEngine.play(st, m);
    return st;
  }
  if (game === 'janggi') {
    const st = JanggiEngine.create(opts.setupCho, opts.setupHan);
    for (const m of moves) JanggiEngine.play(st, m);
    return st;
  }
  const st = GoEngine.create(opts.size);
  for (const p of moves) GoEngine.play(st, p);
  return st;
}

function think(game, st, level, task) {
  if (game === 'go' || game === 'baduk') {
    if (task === 'dead') return GoEngine.estimateDead(st, 400);
    return GoEngine.bestMove(st, level);
  }
  const E = game === 'chess' ? ChessEngine : JanggiEngine;
  const m = E.bestMove(st, level);
  if (!m) return null;
  return m.pass ? { pass: true } : { from: m.from, to: m.to, promo: m.promo || null };
}

self.onmessage = (e) => {
  const { id, game, opts, moves, level, task } = e.data;
  try {
    self.postMessage({ id, result: think(game, rebuild(game, opts, moves), level, task) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};

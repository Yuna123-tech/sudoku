importScripts('sudoku.js');

self.onmessage = (e) => {
  const { id, variant, difficulty, seed } = e.data;
  try {
    self.postMessage({ id, puzzle: Sudoku.generate(variant, difficulty, seed) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};

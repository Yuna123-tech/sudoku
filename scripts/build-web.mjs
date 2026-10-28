// 게임 파일만 골라 배포 폴더로 복사 (사이트: _site, 앱: www)
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'www';
const FILES = [
  'index.html', 'style.css', 'app.js', 'sudoku.js', 'i18n.js', 'ads.js', 'worker.js', 'sw.js',
  'manifest.webmanifest', 'privacy.html', '.nojekyll', 'icons',
];
const EXTRA = { _site: ['store'] }; // 사이트에는 매니페스트 스크린샷용 store 폴더도 포함

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of [...FILES, ...(EXTRA[out] || [])]) cpSync(f, join(out, f), { recursive: true });
console.log(`web files → ${out}/`);

// 게임 파일만 골라 배포 폴더로 복사 (사이트: _site, 앱: www)
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'www';
const FILES = [
  'index.html', 'style.css', 'app.js', 'sudoku.js', 'i18n.js', 'guide.js', 'worker.js', 'sw.js',
  'games.js', 'chess-engine.js', 'janggi-engine.js', 'go-engine.js', 'omok-engine.js', 'othello-engine.js', 'ai-worker.js',
  'manifest.webmanifest', 'privacy.html', '.nojekyll', 'icons',
];
const EXTRA = { _site: ['store'] }; // 사이트에는 매니페스트 스크린샷용 store 폴더도 포함

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of [...FILES, ...(EXTRA[out] || [])]) cpSync(f, join(out, f), { recursive: true });
// 배포할 때마다 서비스 워커 버전을 커밋 번호로 바꿔서, 설치된 앱이 새 버전을 알아채게 함
const version = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : null;
if (version) {
  const sw = join(out, 'sw.js');
  writeFileSync(sw, readFileSync(sw, 'utf8').replace(/const CACHE = '[^']*'/, `const CACHE = 'sudoku-${version}'`));
}
console.log(`web files → ${out}/${version ? ` (version ${version})` : ''}`);

# 스도쿠 놀이터 – 개발 안내 (AI·개발자용)

이 문서는 이 프로젝트를 이어서 수정할 사람(또는 Claude 같은 AI)을 위한 안내입니다.
소유자는 코딩을 하지 않으므로, 설명과 대답은 **한국어로, 쉬운 말로** 해 주세요.

## 무엇인가
- 탭으로 고르는 4가지 게임: **스도쿠**(8종류 × 5단계) + **체스 · 장기 · 바둑**(컴퓨터 5단계 / 둘이서). 한국어/영어 지원.
- **웹사이트**: https://yuna123-tech.github.io/sudoku/ (PWA로 홈 화면 설치·오프라인 가능)
- **안드로이드 앱**: 같은 게임 파일을 Capacitor로 감싼 앱 (아직 스토어 미등록).
- **광고 없음, 완전 무료**: 소유자가 학급에 무료로 공유하기로 결정함. 광고를 넣자는 요청이 다시 오기 전에는 광고를 추가하지 않기.
- 서버·데이터베이스 없음. 진행 중인 게임과 기록은 이용자 기기의 localStorage에 저장.

## 파일 구조
| 파일 | 역할 |
| --- | --- |
| `index.html`, `style.css` | 화면. 모든 기기에서 스크롤 없이 한 화면에 들어가야 함 (세로/가로/PC 미디어쿼리) |
| `app.js` | 게임 진행, 저장(localStorage), 기록·랭킹, 설정, 대화상자 |
| `sudoku.js` | 퍼즐 엔진: 변형 규칙, 풀이기, 생성기(해답 유일성 보장). 브라우저·워커·Node 공용 |
| `worker.js` | 퍼즐 생성을 웹 워커에서 실행 |
| `games.js` | 체스·장기·바둑 화면: 탭 전환, SVG 판 그리기, 대국 진행, 무르기·힌트·패스·기권, 바둑 계가, 저장(`sudoku:bg`)·기록 |
| `chess-engine.js` | 체스 규칙 + 컴퓨터(알파베타). perft 표준 위치 5개로 규칙 검증됨 |
| `janggi-engine.js` | 장기 규칙(궁성·포·멱·한수쉼·빅장·점수) + 컴퓨터(알파베타) |
| `go-engine.js` | 바둑 규칙(따내기·패·자충수·계가) + 컴퓨터(몬테카를로 트리 탐색 + RAVE), 사석 추정 |
| `ai-worker.js` | 세 게임의 컴퓨터를 백그라운드에서 계산 |
| `i18n.js` | 화면 문구 번역 (ko/en). 새 문구는 반드시 두 언어 모두 추가 |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA(오프라인·설치). 캐시 우선으로 한 버전을 통째로 저장. 배포 때 캐시 이름이 커밋 번호로 자동 교체되어, 설치된 앱에 "새 버전이 있어요 · 지금 업데이트" 알림이 뜸. 웹 파일을 추가하면 `sw.js`의 ASSETS 목록에도 추가 |
| `privacy.html` | 개인정보처리방침 (한/영) |
| `scripts/build-web.mjs` | 게임 파일만 골라 `_site`(사이트) 또는 `www`(앱)로 복사. 새 웹 파일을 만들면 여기 목록에도 추가 |
| `android/` | Capacitor 안드로이드 프로젝트 |
| `store/` | 플레이 스토어 등록 자료(문구, 스크린샷, 배너, 안내서) |

## 배포 (자동)
- `main` 브랜치에 푸시하면:
  - `.github/workflows/deploy.yml` → GitHub Pages 사이트 갱신
  - `.github/workflows/android.yml` → 안드로이드 앱 빌드 점검
    - 시험용 APK는 소유자 요청으로 만들지 않음 (평소에는 사이트에서 홈 화면 설치로 사용)
    - 스토어용 AAB: 저장소 Secrets에 서명 열쇠가 있을 때만 만들어져 Actions 실행 결과(Artifacts)에 30일 보관
      (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)
- 버전 번호는 Actions 실행 번호로 자동 증가 (`1.0.<번호>`).

## 로컬에서 확인
```bash
python3 -m http.server 8000
```
→ http://localhost:8000 . 앱 빌드는 Android SDK가 필요하므로 GitHub Actions를 사용.

## 지켜야 할 것
- 게임 동작을 바꾸면 웹과 앱 둘 다 영향을 받음.
- 한 화면 맞춤 레이아웃을 깨지 않기 (휴대폰 세로·가로, 폴드, 태블릿, PC에서 스크롤 없음).
- 서명 열쇠(.jks/.keystore)와 비밀번호는 절대 저장소에 커밋하지 않기.
- localStorage 키 이름(`sudoku:saves`, `sudoku:records`, `sudoku:settings`, `sudoku:bg`)을 바꾸면 이용자 기록이 사라지므로 바꾸지 않기.
- 규칙 엔진을 고치면 Node로 규칙 시험(체스 perft, 장기·바둑 규칙 시험)을 다시 돌려 확인하기.

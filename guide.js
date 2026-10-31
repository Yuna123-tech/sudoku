/* 게임 방법 설명 (한국어 / English) — "게임 방법" 버튼을 누르면 나옴 */
(() => {
  const H = (title) => `<h4 class="g-h">${title}</h4>`;
  const UL = (items) => `<ul class="g-list">${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  const TIP = (text) => `<p class="g-tip">💡 ${text}</p>`;
  const GOAL = (text) => `<p class="g-goal">🏆 ${text}</p>`;

  const ko = {
    howto: '게임 방법',
    'guide.sudoku': GOAL('빈칸을 모두 채우면 완성! 가로줄·세로줄·굵은 선 3×3 칸 <b>각각에 1~9가 한 번씩</b> 들어가야 해요.') +
      H('두는 방법') + UL([
        '빈칸을 누르고 → 아래 <b>숫자 버튼</b>을 눌러요.',
        '같은 줄이나 같은 칸에 같은 숫자가 있으면 빨갛게 표시돼요.',
        '<b>실수는 3번까지</b>예요. 3번 틀리면 그 판은 끝나요. (설정에서 끌 수 있어요)',
      ]) +
      H('도구') + UL([
        '<b>메모</b>: 켜고 숫자를 누르면 칸에 작게 적혀요. "여기는 3이나 5가 들어갈 것 같아"를 적어 둘 때 써요.',
        '<b>자동 메모</b>: 들어갈 수 있는 숫자를 모든 칸에 한 번에 적어 줘요.',
        '<b>힌트</b>: 한 칸의 정답을 알려 줘요. (힌트를 쓰면 최고 기록에는 들어가지 않아요)',
        '<b>실행취소</b>·<b>지우기</b>: 방금 한 것을 되돌리거나 칸을 비워요.',
      ]) +
      H('지금 종류의 규칙') + '<p class="g-p" id="g-variant"></p>' +
      TIP('어떤 칸에 <b>들어갈 수 있는 숫자가 하나뿐</b>인 곳을 찾으세요. 또는 어떤 숫자가 한 줄에서 <b>들어갈 자리가 한 곳뿐</b>인 곳을 찾아도 돼요.'),

    'guide.chess': GOAL('상대 <b>킹(♚)</b>을 공격해서 어디로도 피할 수 없게 만들면(<b>체크메이트</b>) 이겨요.') +
      H('말 움직이는 법') + UL([
        '<b>킹 ♚</b>: 모든 방향으로 한 칸.',
        '<b>퀸 ♛</b>: 가로·세로·대각선으로 원하는 만큼.',
        '<b>룩 ♜</b>: 가로·세로로 원하는 만큼.',
        '<b>비숍 ♝</b>: 대각선으로 원하는 만큼.',
        '<b>나이트 ♞</b>: L자 모양(두 칸 + 옆 한 칸). 다른 말을 <b>뛰어넘을 수 있는</b> 유일한 말이에요.',
        '<b>폰 ♟</b>: 앞으로 한 칸(처음엔 두 칸도 가능). 상대 말은 <b>대각선 앞</b>으로만 잡아요.',
        '상대 말이 있는 칸으로 가면 그 말을 잡아요. 말은 다른 말을 뛰어넘을 수 없어요(나이트 제외).',
      ]) +
      H('특별 규칙') + UL([
        '<b>체크</b>: 킹이 공격받는 상태예요. 다음 수에 반드시 피해야 해요.',
        '<b>캐슬링</b>: 킹과 룩이 한 번도 안 움직였고 사이가 비어 있으면, 킹을 룩 쪽으로 두 칸 옮기고 룩이 킹을 넘어와요. 킹을 안전하게 지켜요.',
        '<b>앙파상</b>: 상대 폰이 두 칸 전진해 내 폰 바로 옆에 오면, 바로 다음 수에 대각선으로 잡을 수 있어요.',
        '<b>프로모션</b>: 폰이 맨 끝 줄에 닿으면 퀸·룩·비숍·나이트 중 하나로 바뀌어요.',
      ]) +
      H('비기는 경우') + UL([
        '<b>스테일메이트</b>: 체크는 아닌데 둘 수 있는 수가 하나도 없을 때',
        '50수 동안 잡거나 폰을 움직이지 않았을 때, 같은 모양이 3번 나왔을 때, 체크메이트할 말이 부족할 때',
      ]) +
      H('조작') + UL(['내 말을 누르면 갈 수 있는 곳에 점이 표시돼요. 점을 누르면 이동해요.', '<b>무르기</b>: 한 수 되돌리기 · <b>힌트</b>: 추천 수 표시 · <b>기권</b>: 대국 포기']) +
      TIP('처음에는 가운데 폰을 움직이고, 나이트와 비숍을 빨리 꺼내고, <b>캐슬링</b>으로 킹을 안전하게 하세요. 말을 공짜로 주지 않게 조심!'),

    'guide.janggi': GOAL('상대 <b>궁(楚·漢)</b>이 어디로도 피할 수 없게 공격하면(<b>외통</b>) 이겨요. <b>초(파랑)</b>가 먼저 둬요.') +
      H('말 움직이는 법') + UL([
        '<b>궁 楚/漢</b>·<b>사 士</b>: <b>궁성</b>(대각선이 그려진 9칸) 안에서만, 선을 따라 한 칸씩.',
        '<b>차 車</b>: 가로·세로로 원하는 만큼. 가장 강한 말이에요.',
        '<b>포 包</b>: 가로·세로로 <b>다른 말 하나를 뛰어넘어야만</b> 움직여요. <b>포는 포를 넘을 수도, 잡을 수도 없어요.</b>',
        '<b>마 馬</b>: 한 칸 직진 + 대각선 한 칸. 첫 칸이 막히면(<b>멱</b>) 못 가요.',
        '<b>상 象</b>: 한 칸 직진 + 대각선 두 칸. 지나가는 칸이 막히면 못 가요.',
        '<b>졸 卒/병 兵</b>: 앞이나 옆으로 한 칸. <b>뒤로는 못 가요.</b> 상대 궁성 안에서는 대각선 앞으로도 가요.',
        '궁성 안에서는 <b>차·포·졸</b>도 대각선을 따라 움직일 수 있어요.',
      ]) +
      H('특별 규칙') + UL([
        '<b>장군</b>: 궁이 공격받는 상태. 반드시 피하거나 막아야 해요.',
        '<b>한수쉼</b>: 장군이 아닐 때는 한 번 쉬어 갈 수 있어요.',
        '<b>빅장</b>: 두 궁이 사이에 아무것도 없이 마주 보는 것. 상대가 피하지 않으면 <b>점수로 승부</b>를 내요.',
        '<b>점수</b>: 차 13 · 포 7 · 마 5 · 상 3 · 사 3 · 졸 2점. 한(후수)은 1.5점 덤을 받아요. 200수가 되거나 같은 모양이 3번 나와도 점수로 판정해요.',
        '<b>상차림</b>: 시작할 때 마·상의 자리를 4가지로 고를 수 있어요(새 대국 설정).',
      ]) +
      H('조작') + UL(['내 말을 누르면 갈 수 있는 곳이 표시돼요. 그곳을 누르면 이동해요.', '<b>한수쉼</b>·<b>무르기</b>·<b>힌트</b>·<b>기권</b> 버튼을 쓸 수 있어요.']) +
      TIP('<b>차</b>는 가장 귀한 말이니 쉽게 주지 마세요. <b>포</b>는 다리(넘을 말)가 있어야 움직이니 다리를 만들어 주세요.'),

    'guide.baduk': GOAL('돌로 둘러싼 <b>집</b>(빈 교차점)과 <b>따낸 돌</b>을 합한 점수가 더 많은 쪽이 이겨요. 흑이 먼저 두고, 백은 <b>덤 6.5집</b>을 받아요.') +
      H('두는 방법') + UL([
        '번갈아 가며 선이 만나는 곳(<b>교차점</b>)에 돌을 하나씩 놓아요. 놓은 돌은 움직이지 않아요.',
        '돌 옆의 빈 교차점을 <b>활로</b>(숨구멍)라고 해요. 활로가 1개 남으면 <b>단수</b>예요.',
        '상대 돌의 활로를 모두 막으면 그 돌을 <b>따내요</b>(판에서 들어내요).',
      ]) +
      H('둘 수 없는 곳') + UL([
        '<b>자충수</b>: 놓자마자 활로가 없어지는 곳 (단, 상대 돌을 따낼 수 있으면 둘 수 있어요)',
        '<b>패</b>: 상대가 방금 내 돌 하나를 따낸 곳을, 바로 되따낼 수는 없어요. 다른 곳에 한 수 둔 뒤에는 가능해요.',
      ]) +
      H('끝내는 방법') + UL([
        '더 둘 곳이 없으면 <b>패스</b>를 눌러요. <b>둘 다 연속으로 패스</b>하면 끝나요.',
        '죽은 돌(살 수 없는 돌)을 눌러 표시하고 <b>계가하기</b>를 누르면 점수가 계산돼요.',
      ]) +
      TIP('정식 대국은 <b>19줄</b>이에요. 처음 배울 때는 새 대국에서 <b>9줄</b>을 골라 연습해 보세요. <b>귀(모서리) → 변 → 가운데</b> 순서로 집을 짓기 쉬워요. 내 돌이 단수가 되면 먼저 살리세요!'),

    'guide.omok': GOAL('가로·세로·대각선 어느 방향이든 <b>내 돌 5개를 먼저 한 줄로</b> 이으면 이겨요. 흑이 먼저 둬요.') +
      H('두는 방법') + UL([
        '번갈아 가며 교차점에 돌을 하나씩 놓아요. 따내기는 없어요.',
        '판이 모두 차면 무승부예요.',
      ]) +
      H('렌주룰 (흑만 금지)') + UL([
        '먼저 두는 흑이 너무 유리해서, 흑은 아래 자리에 둘 수 없어요. 판에 <b style="color:#d2402f">×</b>로 표시돼요.',
        '<b>3·3</b>: 한 수로 <b>열린 3</b>(양쪽이 막히지 않은 3개)이 두 개 생기는 자리',
        '<b>4·4</b>: 한 수로 4가 두 개 생기는 자리',
        '<b>장목</b>: 6개 이상 이어지는 자리 (흑은 <b>정확히 5개</b>여야 이겨요. 백은 6개 이상도 승리)',
        '단, 그 수로 <b>5목이 되면 금수여도 이겨요.</b>',
        '<b>자유룰</b>을 고르면 금지 없이 5개 이상이면 이겨요. (새 대국 설정)',
      ]) +
      TIP('상대가 <b>열린 3</b>을 만들면 바로 막으세요! 내가 이기려면 <b>4와 3을 한 번에</b> 만드는 자리(4·3)를 노리세요.'),
  };

  const en = {
    howto: 'How to play',
    'guide.sudoku': GOAL('Fill every empty cell. Each row, column and bold 3×3 box must contain <b>1–9 exactly once</b>.') +
      H('How to play') + UL(['Tap an empty cell, then tap a <b>number button</b>.', 'Repeated numbers in a row or box turn red.', '<b>Three mistakes</b> end the game (you can turn this off in Settings).']) +
      H('Tools') + UL(['<b>Notes</b>: write small candidate numbers in a cell.', '<b>Auto notes</b>: fill every cell with its possible numbers.', '<b>Hint</b>: reveals one cell (hinted games don’t count for best times).', '<b>Undo</b> / <b>Erase</b>: take back or clear.']) +
      H('Rules of this type') + '<p class="g-p" id="g-variant"></p>' +
      TIP('Look for a cell where <b>only one number fits</b>, or a number that has <b>only one place</b> in a row, column or box.'),
    'guide.chess': GOAL('Attack the enemy <b>king ♚</b> so it cannot escape — <b>checkmate</b> — to win.') +
      H('How pieces move') + UL(['<b>King ♚</b>: one square any direction.', '<b>Queen ♛</b>: any distance across, down or diagonally.', '<b>Rook ♜</b>: any distance across or down.', '<b>Bishop ♝</b>: any distance diagonally.', '<b>Knight ♞</b>: an L-shape (two + one). The only piece that <b>jumps</b>.', '<b>Pawn ♟</b>: one square forward (two on its first move); captures <b>diagonally forward</b>.']) +
      H('Special rules') + UL(['<b>Check</b>: your king is attacked — you must get out of it.', '<b>Castling</b>: if king and rook haven’t moved and the path is clear, the king moves two squares toward the rook and the rook jumps over.', '<b>En passant</b>: a pawn that just moved two squares past yours can be captured diagonally on the next move.', '<b>Promotion</b>: a pawn reaching the last rank becomes a queen, rook, bishop or knight.']) +
      H('Draws') + UL(['<b>Stalemate</b>: no legal move but not in check.', '50 moves without capture or pawn move, threefold repetition, or not enough pieces to mate.']) +
      H('Controls') + UL(['Tap your piece to see dots where it can go, then tap a dot.', '<b>Undo</b> · <b>Hint</b> · <b>Resign</b>']) +
      TIP('Move a center pawn, develop knights and bishops early, and <b>castle</b> to keep your king safe.'),
    'guide.janggi': GOAL('Trap the enemy <b>general</b> so it cannot escape (checkmate) to win. <b>Cho (blue)</b> moves first.') +
      H('How pieces move') + UL(['<b>General</b> & <b>Guards 士</b>: one step along the lines, only inside the <b>palace</b> (the 9 points with diagonals).', '<b>Chariot 車</b>: any distance across or down. The strongest piece.', '<b>Cannon 包</b>: must <b>jump over exactly one piece</b>. Cannons can never jump or capture cannons.', '<b>Horse 馬</b>: one step straight, then one diagonal. Blocked if the first point is occupied.', '<b>Elephant 象</b>: one step straight, then two diagonal. Blocked by any piece on its path.', '<b>Soldier 卒/兵</b>: one step forward or sideways, never back. Diagonal forward inside the enemy palace.', 'Inside a palace, chariots, cannons and soldiers can also follow the diagonals.']) +
      H('Special rules') + UL(['<b>Janggun</b> (check): your general is attacked — escape or block.', '<b>Pass</b>: allowed when you are not in check.', '<b>Bikjang</b>: generals facing each other with nothing between. If not broken, the game is decided on <b>points</b>.', '<b>Points</b>: chariot 13 · cannon 7 · horse 5 · elephant 3 · guard 3 · soldier 2, Han +1.5. Also used after 200 moves or threefold repetition.', '<b>Setup</b>: choose one of 4 horse/elephant arrangements.']) +
      TIP('Don’t give away your chariots. Cannons need a piece to jump over — give them a “bridge”.'),
    'guide.baduk': GOAL('Win by having more <b>territory</b> (empty points you surround) plus <b>captured stones</b>. Black plays first; White gets <b>6.5 komi</b>.') +
      H('How to play') + UL(['Take turns placing a stone on an <b>intersection</b>. Stones never move.', 'Empty points next to a group are its <b>liberties</b>. With one left it is in <b>atari</b>.', 'Fill all of a group’s liberties to <b>capture</b> it.']) +
      H('Not allowed') + UL(['<b>Suicide</b>: a move that leaves your own stones with no liberties (unless it captures).', '<b>Ko</b>: you cannot immediately recapture a single stone that just captured yours. Play elsewhere first.']) +
      H('Ending') + UL(['When nothing is left, press <b>Pass</b>. Two passes in a row end the game.', 'Tap dead stones to mark them, then press <b>Count</b>.']) +
      TIP('A standard game is <b>19×19</b>; beginners can practise on <b>9×9</b> (New game). Corners first, then sides, then the center. Save your stones in atari!'),
    'guide.omok': GOAL('Be the first to get <b>five of your stones in a row</b> — across, down or diagonally. Black moves first.') +
      H('How to play') + UL(['Take turns placing stones on intersections. Nothing is captured.', 'A full board is a draw.']) +
      H('Renju rule (Black only)') + UL(['Black moves first and has an advantage, so Black may not play these points (marked <b style="color:#d2402f">×</b>):', '<b>Double three</b>: a move making two open threes at once', '<b>Double four</b>: a move making two fours at once', '<b>Overline</b>: six or more in a row (Black must make <b>exactly five</b>; White may make more)', 'A move that makes five always wins.', 'Choose <b>Freestyle</b> for no restrictions (five or more wins).']) +
      TIP('Block an <b>open three</b> right away! To win, aim for a move that makes a <b>four and a three</b> at once.'),
  };
  Object.assign(window.I18N.ko, ko);
  Object.assign(window.I18N.en, en);
})();

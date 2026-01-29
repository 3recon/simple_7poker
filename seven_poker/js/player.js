/**
 * 플레이어 / AI: chips, hand, folded, 이번 판 베팅액
 */
function createPlayer(isAI = false) {
  return {
    isAI,
    chips: 0,
    hand: [],
    folded: false,
    betThisRound: 0,
  };
}

function resetPlayerForRound(p) {
  p.hand = [];
  p.folded = false;
  p.betThisRound = 0;
}

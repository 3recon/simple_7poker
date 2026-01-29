/**
 * AI: 상대 오픈 5장 + AI 7장만 보고 Check/Bet/Call/Raise/Fold
 * 기본은 결정적 + 난이도용 블러핑 + 플레이어 블러 의심(오픈 약한데 레이즈 시).
 */
const BLUFF_BET_CHANCE = 0.14;   // 체크할 상황에서 가끔 베팅 (블러핑)
const BLUFF_RAISE_CHANCE = 0.12; // 콜할 상황에서 가끔 레이즈
const BLUFF_CALL_CHANCE = 0.11;  // 폴드할 상황에서 가끔 콜 (블러캐치)
const OPP_WEAK_THRESHOLD = 1200;  // 이하면 플레이어 오픈을 "약함"으로 봄 (하이카드~약한 원페어)
const BLUFF_CATCH_CHANCE = 0.45;  // 오픈 약한데 플레이어 레이즈 시, 원래 폴드할 손에서 콜할 확률
const BLUFF_SQUEEZE_CHANCE = 0.25; // 오픈 약한데 플레이어 레이즈 시, 원래 콜만 할 손에서 레이즈 견제 확률
function analyzeOpponentThreat(oppOpenCards) {
  if (!oppOpenCards || oppOpenCards.length < 5) return 0;
  const parsed = parseAll(oppOpenCards);
  if (parsed.length < 5) return 0;

  let threat = 0;

  // 1) 무늬 개수 - 플러시 드로우
  const suitCounts = {};
  for (const c of parsed) {
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  }
  const maxSuit = Math.max(...Object.values(suitCounts), 0);
  if (maxSuit >= 4) threat += 400;
  else if (maxSuit >= 3) threat += 200;

  // 2) 스트레이트 드로우 - 4장이 4 랭크 이내
  const ranks = [...new Set(parsed.map((c) => rankToNum(c.rank)))].sort((a, b) => a - b);
  for (let i = 0; i <= ranks.length - 4; i++) {
    const seg = ranks.slice(i, i + 4);
    if (seg[3] - seg[0] <= 4) {
      threat += 150;
      break;
    }
  }

  // 3) 페어
  const rankCounts = countRanks(parsed);
  for (const [, count] of rankCounts) {
    if (count >= 2) {
      threat += 80;
      break;
    }
  }

  // 4) 하이카드 (A/K/Q 2장 이상)
  const highCount = parsed.filter((c) => [14, 13, 12].includes(rankToNum(c.rank))).length;
  if (highCount >= 2) threat += 50;

  return threat;
}

function aiDecide(state) {
  const g = state;
  if (!g || g.turn !== "ai" || g.ai.folded) return null;

  const oppOpen = playerOpenCards();
  const myHand = g.ai.hand;

  const myEval = bestOf7(myHand);
  const myScore = myEval.category * 1000 + (myEval.tiebreaker[0] || 0);

  const canCheck = g.currentBet === 0;
  const canBet = g.currentBet === 0 && g.ai.chips >= 3;
  const canCall = g.currentBet > 0 && g.ai.chips >= g.currentBet - g.ai.betThisRound;
  const canRaise = g.raisesThisRound < 3 && g.currentBet + 3 - g.ai.betThisRound <= g.ai.chips;

  const oppEval = oppOpen.length >= 5 ? eval5(oppOpen) : { category: 0, tiebreaker: [0] };
  const oppScore = oppEval.category * 1000 + (oppEval.tiebreaker[0] || 0);
  const oppThreat = analyzeOpponentThreat(oppOpen);
  const oppEffective = oppScore + oppThreat;
  const diff = myScore - oppEffective;
  const playerRaised = g.currentBet > 0 && g.lastAggressor === "player";
  const oppWeak = oppEffective < OPP_WEAK_THRESHOLD;
  const suspectBluff = playerRaised && oppWeak;

  if (canCheck && !canBet) {
    return { action: "check" };
  }

  if (g.currentBet === 0) {
    if (diff >= 800 && canBet) return { action: "bet", amount: 5 };
    if (diff >= 200 && canBet) return { action: "bet", amount: 3 };
    // 블러핑: 체크할 상황에서 가끔 베팅
    if (canBet && Math.random() < BLUFF_BET_CHANCE) return { action: "bet", amount: 3 };
    if (canCheck) return { action: "check" };
    return { action: "check" };
  }

  if (!canCall && !canRaise) return { action: "fold" };
  if (diff >= 600 && canRaise) return { action: "raise", amount: g.currentBet + 5 };
  if (diff >= 200 && canRaise) return { action: "raise", amount: g.currentBet + 3 };
  // 블러핑: 콜할 상황에서 가끔 레이즈 (공격적)
  if (diff >= -200 && canRaise && Math.random() < BLUFF_RAISE_CHANCE) return { action: "raise", amount: g.currentBet + 3 };
  // 플레이어 블러 의심: 오픈 약한데 플레이어가 레이즈 → 콜 구간에서 가끔 레이즈로 견제
  if (suspectBluff && diff >= -500 && canRaise && Math.random() < BLUFF_SQUEEZE_CHANCE) return { action: "raise", amount: g.currentBet + 3 };
  if (diff >= -200 && canCall) return { action: "call" };
  if (diff >= -500 && canCall) return { action: "call" };
  // diff < -500: 원래 폴드할 손. 플레이어 블러 의심 시 45% 블러캐치, 아니면 11% 랜덤 콜, 나머지 폴드
  if (canCall) {
    if (suspectBluff && Math.random() < BLUFF_CATCH_CHANCE) return { action: "call" };
    if (Math.random() < BLUFF_CALL_CHANCE) return { action: "call" };
    return { action: "fold" };
  }
  return { action: "fold" };
}

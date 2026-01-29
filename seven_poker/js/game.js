/**
 * 7포커 게임: 앤티, 딜, 베팅, 쇼다운, 동점 환불, 레이즈 캡 3
 */
const ANTE = 3;
const MIN_BET = 3;
const MIN_RAISE = 3;
const RAISE_CAP = 3;

let gameState = null;

function getState() {
  return gameState;
}

function createGame(playerChips, aiChips = 100) {
  const deck = createDeck();
  shuffleDeck(deck);

  const player = createPlayer(false);
  player.chips = playerChips;
  player.hand = chooseOpenCards(draw(deck, 7));

  const ai = createPlayer(true);
  ai.chips = aiChips;
  ai.hand = chooseOpenCards(draw(deck, 7));

  const pot = ANTE * 2;
  player.chips -= ANTE;
  ai.chips -= ANTE;

  gameState = {
    deck,
    player,
    ai,
    pot,
    currentBet: 0,
    raisesThisRound: 0,
    phase: "betting",
    turn: "player",
    playerTotalPutIn: ANTE,
    aiTotalPutIn: ANTE,
    lastAggressor: null,
  };
  return gameState;
}

function playerOpenCards() {
  if (!gameState || !gameState.player.hand.length) return [];
  return gameState.player.hand.slice(0, 5);
}

function playerHiddenCards() {
  if (!gameState || !gameState.player.hand.length) return [];
  return gameState.player.hand.slice(5, 7);
}

function aiOpenCards() {
  if (!gameState || !gameState.ai.hand.length) return [];
  return gameState.ai.hand.slice(0, 5);
}

function aiHiddenCards() {
  if (!gameState || !gameState.ai.hand.length) return [];
  return gameState.ai.hand.slice(5, 7);
}

function canCheck() {
  const g = gameState;
  if (!g || g.phase !== "betting" || g.turn !== "player") return false;
  return g.currentBet === 0;
}

function canBet() {
  const g = gameState;
  if (!g || g.phase !== "betting" || g.turn !== "player" || g.player.folded) return false;
  return g.currentBet === 0 && g.player.chips >= MIN_BET;
}

function canCall() {
  const g = gameState;
  if (!g || g.phase !== "betting" || g.turn !== "player" || g.player.folded) return false;
  if (g.currentBet === 0) return false;
  const toCall = g.currentBet - g.player.betThisRound;
  return toCall > 0 && g.player.chips >= toCall;
}

function canRaise() {
  const g = gameState;
  if (!g || g.phase !== "betting" || g.turn !== "player" || g.player.folded) return false;
  if (g.raisesThisRound >= RAISE_CAP) return false;
  const minRaiseTo = g.currentBet + MIN_RAISE;
  const toPay = minRaiseTo - g.player.betThisRound;
  return g.player.chips >= toPay;
}

function minRaiseAmount() {
  const g = gameState;
  if (!g) return MIN_BET;
  return g.currentBet + MIN_RAISE;
}

function callAmount() {
  const g = gameState;
  if (!g || g.currentBet === 0) return 0;
  return Math.min(g.currentBet - g.player.betThisRound, g.player.chips);
}

function applyPlayerAction(action, amount) {
  const g = gameState;
  if (!g || g.phase !== "betting" || g.turn !== "player" || g.player.folded) return null;

  if (action === "fold") {
    g.player.folded = true;
    g.phase = "showdown";
    g.winner = "ai";
    g.settled = true;
    return { done: true, winner: "ai", reason: "fold" };
  }

  if (action === "check") {
    if (g.currentBet !== 0) return null;
    g.turn = "ai";
    return { done: false, runAi: true };
  }

  if (action === "bet") {
    if (g.currentBet !== 0) return null;
    const amt = Math.max(MIN_BET, amount || MIN_BET);
    const pay = Math.min(amt, g.player.chips);
    g.player.chips -= pay;
    g.player.betThisRound += pay;
    g.playerTotalPutIn += pay;
    g.pot += pay;
    g.currentBet = g.player.betThisRound;
    g.lastAggressor = "player";
    g.turn = "ai";
    return { done: false, runAi: true };
  }

  if (action === "call") {
    if (g.currentBet === 0) return null;
    const toCall = g.currentBet - g.player.betThisRound;
    const pay = Math.min(toCall, g.player.chips);
    g.player.chips -= pay;
    g.player.betThisRound += pay;
    g.playerTotalPutIn += pay;
    g.pot += pay;
    if (g.ai.folded || g.ai.betThisRound === g.currentBet) {
      g.phase = "showdown";
      g.settled = true;
      return { done: true, showdown: true };
    }
    g.turn = "ai";
    return { done: false, runAi: true };
  }

  if (action === "raise") {
    if (g.raisesThisRound >= RAISE_CAP) return null;
    const minTo = g.currentBet + MIN_RAISE;
    const to = Math.max(minTo, amount || minTo);
    const pay = Math.min(to - g.player.betThisRound, g.player.chips);
    if (pay <= 0) return null;
    g.player.chips -= pay;
    g.player.betThisRound += pay;
    g.playerTotalPutIn += pay;
    g.pot += pay;
    g.currentBet = g.player.betThisRound;
    g.raisesThisRound += 1;
    g.lastAggressor = "player";
    g.turn = "ai";
    return { done: false, runAi: true };
  }

  return null;
}

function applyAiAction(action, amount) {
  const g = gameState;
  if (!g || g.phase !== "betting" || g.turn !== "ai" || g.ai.folded) return null;

  if (action === "fold") {
    g.ai.folded = true;
    g.phase = "showdown";
    g.winner = "player";
    g.settled = true;
    return { done: true, winner: "player", reason: "fold" };
  }

  if (action === "check") {
    if (g.currentBet !== 0) return null;
    g.phase = "showdown";
    g.settled = true;
    return { done: true, showdown: true };
  }

  if (action === "bet") {
    if (g.currentBet !== 0) return null;
    const amt = Math.max(MIN_BET, amount || MIN_BET);
    const pay = Math.min(amt, g.ai.chips);
    g.ai.chips -= pay;
    g.ai.betThisRound += pay;
    g.aiTotalPutIn += pay;
    g.pot += pay;
    g.currentBet = g.ai.betThisRound;
    g.lastAggressor = "ai";
    g.turn = "player";
    return { done: false };
  }

  if (action === "call") {
    if (g.currentBet === 0) return null;
    const toCall = g.currentBet - g.ai.betThisRound;
    const pay = Math.min(toCall, g.ai.chips);
    g.ai.chips -= pay;
    g.ai.betThisRound += pay;
    g.aiTotalPutIn += pay;
    g.pot += pay;
    g.phase = "showdown";
    g.settled = true;
    return { done: true, showdown: true };
  }

  if (action === "raise") {
    if (g.raisesThisRound >= RAISE_CAP) return null;
    const minTo = g.currentBet + MIN_RAISE;
    const to = Math.max(minTo, amount || minTo);
    const pay = Math.min(to - g.ai.betThisRound, g.ai.chips);
    if (pay <= 0) return null;
    g.ai.chips -= pay;
    g.ai.betThisRound += pay;
    g.aiTotalPutIn += pay;
    g.pot += pay;
    g.currentBet = g.ai.betThisRound;
    g.raisesThisRound += 1;
    g.lastAggressor = "ai";
    g.turn = "player";
    return { done: false };
  }

  return null;
}

function runShowdown() {
  const g = gameState;
  if (!g || g.phase !== "showdown" || !g.settled) return null;
  if (g.winner) return { winner: g.winner, reason: g.reason || "fold" };

  const cmp = compareHands(g.player.hand, g.ai.hand);
  if (cmp > 0) {
    g.winner = "player";
    return { winner: "player", reason: "hand" };
  }
  if (cmp < 0) {
    g.winner = "ai";
    return { winner: "ai", reason: "hand" };
  }
  g.winner = "tie";
  return { winner: "tie", reason: "tie" };
}

function settleCoins() {
  const g = gameState;
  if (!g || !g.settled) return null;

  if (g.winner === "tie") {
    g.player.chips += g.playerTotalPutIn;
    g.ai.chips += g.aiTotalPutIn;
    return { refundPlayer: g.playerTotalPutIn, refundAi: g.aiTotalPutIn };
  }

  if (g.winner === "player") {
    g.player.chips += g.pot;
    return { playerGain: g.pot };
  }

  g.ai.chips += g.pot;
  return { aiGain: g.pot };
}

function endGame() {
  gameState = null;
}

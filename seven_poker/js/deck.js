/**
 * 52장 덱, 셔플, pop으로 뽑기
 */
function createDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push(cardToString({ suit: s, rank: r }));
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function draw(deck, n) {
  const out = [];
  for (let i = 0; i < n && deck.length; i++) {
    out.push(deck.pop());
  }
  return out;
}

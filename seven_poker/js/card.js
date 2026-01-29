/**
 * 카드 표현: SUITS, RANKS, 포맷/파싱
 */
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A"].concat([2, 3, 4, 5, 6, 7, 8, 9, 10].map(String), ["J", "Q", "K"]);

const RED_SUITS = new Set(["♥", "♦"]);

function isRed(suit) {
  return RED_SUITS.has(suit);
}

/**
 * 카드 문자열 -> { suit, rank }
 * @param {string} s e.g. "♠A", "10♥"
 */
function parseCard(s) {
  if (!s || s.length < 2) return null;
  const suit = SUITS.find((u) => s.includes(u));
  if (!suit) return null;
  const r = s.replace(suit, "").trim();
  if (!RANKS.includes(r)) return null;
  return { suit, rank: r };
}

/**
 * { suit, rank } -> "♠A" 형식
 */
function cardToString(c) {
  if (!c) return "";
  return c.suit + c.rank;
}

/**
 * rank -> 숫자 (비교용). 2=2, ... K=13, A=14.
 */
function rankToNum(rank) {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  const n = parseInt(rank, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * 카드 한 장 렌더 (DOM)
 * @param {string} card "♠A" 등
 * @param {boolean} hidden true면 뒷면(??)
 * @param {HTMLElement} container
 */
function renderCard(card, hidden, container) {
  const el = document.createElement("div");
  el.className = "card";

  if (hidden) {
    // 히든 카드는 항상 뒷면으로 표시 (??)
    el.classList.add("card-concealed");
    el.innerHTML = `
      <div class="card-top">??</div>
      <div class="card-center">?</div>
      <div class="card-bottom">??</div>
    `;
  } else {
    const p = parseCard(card);
    if (!p) {
      el.classList.add("card-concealed");
      el.innerHTML = `
        <div class="card-top">??</div>
        <div class="card-center">?</div>
        <div class="card-bottom">??</div>
      `;
    } else {
      const { suit, rank } = p;
      const red = isRed(suit);
      if (red) el.classList.add("red");
      el.innerHTML = `
        <div class="card-top">${rank}</div>
        <div class="card-center">${suit}</div>
        <div class="card-bottom">${rank}</div>
      `;
    }
  }

  container.appendChild(el);
}

/**
 * 여러 카드 렌더. 기존 자식 비우고 채움.
 */
function renderCards(cards, hidden, container) {
  container.innerHTML = "";
  (cards || []).forEach((c) => renderCard(c, hidden, container));
}

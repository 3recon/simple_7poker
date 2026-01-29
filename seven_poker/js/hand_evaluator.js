/**
 * 7장 중 최고 5장 조합, 풀 족보 판정 및 타이브레이커
 */
const CATEGORY_NAMES = {
  9: "Royal Straight Flush",
  8: "Straight Flush",
  7: "Four of a Kind",
  6: "Full House",
  5: "Flush",
  4: "Straight",
  3: "Three of a Kind",
  2: "Two Pair",
  1: "One Pair",
  0: "High Card",
};

function getCategoryName(cat) {
  return CATEGORY_NAMES[cat] ?? "High Card";
}

function parseAll(cards) {
  return cards.map((c) => parseCard(c)).filter(Boolean);
}

function nums(cards) {
  return cards.map((c) => rankToNum(c.rank));
}

function allSameSuit(cards) {
  if (cards.length < 5) return false;
  const s = cards[0].suit;
  return cards.every((c) => c.suit === s);
}

function isWheel(numsSorted) {
  // A-2-3-4-5
  const w = [14, 5, 4, 3, 2].every((v, i) => numsSorted[i] === v);
  if (!w) return false;
  return 5; // high card of wheel
}

function straightsFromNums(nums) {
  const a = [...new Set(nums)].sort((x, y) => y - x);
  const out = [];
  for (let i = 0; i <= a.length - 5; i++) {
    const seg = a.slice(i, i + 5);
    const ok = seg.every((v, j) => (j === 0 ? true : seg[j - 1] - v === 1));
    if (ok) out.push(seg[0]);
  }
  // wheel: 14,5,4,3,2
  if (a.includes(14) && a.includes(5) && a.includes(4) && a.includes(3) && a.includes(2)) {
    out.push(5);
  }
  return out;
}

function countRanks(cards) {
  const m = new Map();
  for (const c of cards) {
    const n = rankToNum(c.rank);
    m.set(n, (m.get(n) || 0) + 1);
  }
  return m;
}

function eval5(cards) {
  const parsed = parseAll(cards);
  if (parsed.length !== 5) return { category: 0, tiebreaker: [0, 0, 0, 0, 0] };
  const n = nums(parsed).sort((a, b) => b - a);
  const flush = allSameSuit(parsed);
  const str = straightsFromNums(n);
  const high = str.length ? Math.max(...str) : 0;

  if (flush && str.length) {
    const cat = high === 14 ? 9 : 8;
    return { category: cat, tiebreaker: [high] };
  }

  const cnt = countRanks(parsed);
  const quads = [...cnt.entries()].filter(([, v]) => v === 4);
  const trips = [...cnt.entries()].filter(([, v]) => v === 3);
  const pairs = [...cnt.entries()].filter(([, v]) => v === 2);

  if (quads.length) {
    const q = quads[0][0];
    const k = n.find((x) => x !== q);
    return { category: 7, tiebreaker: [q, k ?? 0] };
  }

  if (trips.length && pairs.length) {
    const t = trips[0][0];
    const p = pairs[0][0];
    return { category: 6, tiebreaker: [t, p] };
  }

  if (flush) {
    return { category: 5, tiebreaker: [...n] };
  }

  if (str.length) {
    return { category: 4, tiebreaker: [high] };
  }

  if (trips.length) {
    const t = trips[0][0];
    const kickers = n.filter((x) => x !== t).slice(0, 2);
    return { category: 3, tiebreaker: [t, ...kickers] };
  }

  if (pairs.length >= 2) {
    const pp = pairs
      .map(([r]) => r)
      .sort((a, b) => b - a)
      .slice(0, 2);
    const k = n.find((x) => !pp.includes(x));
    return { category: 2, tiebreaker: [pp[0], pp[1], k ?? 0] };
  }

  if (pairs.length === 1) {
    const p = pairs[0][0];
    const kickers = n.filter((x) => x !== p).slice(0, 3);
    return { category: 1, tiebreaker: [p, ...kickers] };
  }

  return { category: 0, tiebreaker: [...n] };
}

function comb(arr, k) {
  const out = [];
  const buf = [];
  function go(i, j) {
    if (j === k) {
      out.push([...buf]);
      return;
    }
    if (i >= arr.length) return;
    buf.push(arr[i]);
    go(i + 1, j + 1);
    buf.pop();
    go(i + 1, j);
  }
  go(0, 0);
  return out;
}

function bestOf7(cards) {
  const parsed = parseAll(cards);
  if (parsed.length !== 7) return { category: 0, tiebreaker: [0, 0, 0, 0, 0], best5: [] };
  const five = comb(parsed, 5);
  let bestE = eval5(five[0].map((c) => cardToString(c)));
  let bestCards = five[0];

  for (let i = 1; i < five.length; i++) {
    const cs = five[i].map((c) => cardToString(c));
    const e = eval5(cs);
    if (compareEval(e, bestE) > 0) {
      bestE = e;
      bestCards = five[i];
    }
  }

  return {
    category: bestE.category,
    tiebreaker: bestE.tiebreaker,
    best5: bestCards.map((c) => cardToString(c)),
  };
}

function compareEval(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  const ta = a.tiebreaker || [];
  const tb = b.tiebreaker || [];
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
    const va = ta[i] || 0;
    const vb = tb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function compareHands(cardsA, cardsB) {
  const ea = bestOf7(cardsA);
  const eb = bestOf7(cardsB);
  return compareEval(
    { category: ea.category, tiebreaker: ea.tiebreaker },
    { category: eb.category, tiebreaker: eb.tiebreaker }
  );
}

/**
 * 7장 중 "가장 약한" 5장을 오픈으로 선택 (상대에게 약하게 보이도록)
 * 반환: [...open5, ...hidden2] 순서의 7장 문자열 배열
 */
function chooseOpenCards(hand7) {
  if (!hand7 || hand7.length !== 7) return hand7 || [];
  const parsed = parseAll(hand7);
  if (parsed.length !== 7) return hand7;

  const fiveCombos = comb(parsed, 5);
  let worstE = eval5(fiveCombos[0].map((c) => cardToString(c)));
  let worstOpen = fiveCombos[0];
  let worstHidden = parsed.filter((p) => !fiveCombos[0].includes(p));

  for (let i = 1; i < fiveCombos.length; i++) {
    const open5 = fiveCombos[i].map((c) => cardToString(c));
    const e = eval5(open5);
    if (compareEval(e, worstE) < 0) {
      worstE = e;
      worstOpen = fiveCombos[i];
      worstHidden = parsed.filter((p) => !fiveCombos[i].includes(p));
    }
  }

  return [...worstOpen.map((c) => cardToString(c)), ...worstHidden.map((c) => cardToString(c))];
}

// ---- Result formatting helpers (UI) ----

function numToRank(n) {
  if (n === 14) return "A";
  if (n === 13) return "K";
  if (n === 12) return "Q";
  if (n === 11) return "J";
  return String(n);
}

/**
 * bestOf7 결과를 사람이 읽는 문자열로 요약
 * 예: "A, 2 투페어", "3 원페어", "K 스트레이트", "풀하우스(10 over 3)" 등
 */
function formatHandSummary(eval7) {
  if (!eval7) return "Unknown";
  const cat = eval7.category ?? 0;
  const t = eval7.tiebreaker ?? [];
  const name = getCategoryName(cat);

  if (cat === 9) return name;
  if (cat === 8) return `${numToRank(t[0] || 0)} ${name}`;
  if (cat === 7) return `${numToRank(t[0] || 0)} ${name}`;
  if (cat === 6) return `${numToRank(t[0] || 0)}, ${numToRank(t[1] || 0)} ${name}`;
  if (cat === 5) return `${numToRank(t[0] || 0)} high ${name}`;
  if (cat === 4) return `${numToRank(t[0] || 0)} ${name}`;
  if (cat === 3) return `${numToRank(t[0] || 0)} ${name}`;
  if (cat === 2) return `${numToRank(t[0] || 0)}, ${numToRank(t[1] || 0)} ${name}`;
  if (cat === 1) return `${numToRank(t[0] || 0)} ${name}`;
  return `${numToRank(t[0] || 0)} ${name}`;
}

/**
 * 코인: 첫 100 지급, 10분마다 10 리필.
 * 시간 리필으로는 REFILL_CAP(100)을 넘을 수 없고, 승리로 얻은 코인은 상한 없음(COIN_CAP까지).
 */
const COIN_KEY = "seven_poker_coins";
const REFILL_CAP = 100;
const COIN_CAP = 9999;
const REFILL_INTERVAL_MS = 10 * 60 * 1000;
const REFILL_AMOUNT = 10;

async function loadCoinState() {
  const raw = await chrome.storage.local.get(COIN_KEY);
  const s = raw[COIN_KEY];
  if (s) return s;
  return {
    chips: 0,
    lastRefillTime: Date.now(),
    hasReceivedFirstGrant: false,
  };
}

async function saveCoinState(s) {
  await chrome.storage.local.set({ [COIN_KEY]: s });
}

async function ensureCoins() {
  const s = await loadCoinState();
  const now = Date.now();

  if (!s.hasReceivedFirstGrant) {
    s.chips = Math.min(s.chips + 100, REFILL_CAP);
    s.hasReceivedFirstGrant = true;
    s.lastRefillTime = now;
    await saveCoinState(s);
    return { chips: s.chips, nextRefillMs: null };
  }

  const elapsed = now - s.lastRefillTime;
  if (elapsed < REFILL_INTERVAL_MS) {
    return { chips: s.chips, nextRefillMs: REFILL_INTERVAL_MS - elapsed };
  }

  const n = Math.floor(elapsed / REFILL_INTERVAL_MS);
  const add = Math.min(n * REFILL_AMOUNT, Math.max(0, REFILL_CAP - s.chips));
  s.chips += add;
  s.lastRefillTime = now;
  await saveCoinState(s);

  return { chips: s.chips, nextRefillMs: add > 0 ? REFILL_INTERVAL_MS : null };
}

async function getChips() {
  const s = await loadCoinState();
  return s.chips;
}

async function spendChips(amount) {
  const s = await loadCoinState();
  if (s.chips < amount) return false;
  s.chips -= amount;
  await saveCoinState(s);
  return true;
}

async function addChips(amount) {
  const s = await loadCoinState();
  s.chips = Math.min(s.chips + amount, COIN_CAP);
  await saveCoinState(s);
}

/** 보유 코인 설정 (승리 시 사용). 시간 리필 상한(100)을 넘어도 저장됨. */
async function setChips(value) {
  const s = await loadCoinState();
  s.chips = Math.max(0, Math.min(Number(value), COIN_CAP));
  await saveCoinState(s);
}

function formatNextRefill(ms) {
  if (ms == null) return "";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m > 0) return `+10 coins in ${m}m ${s}s`;
  return `+10 coins in ${s}s`;
}

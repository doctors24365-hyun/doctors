/*
 * 아고다 페이지에서 "실제로 화면에 찍힌" 가격을 읽어 오는 스크립트.
 * 백그라운드가 GET_PRICE 메시지를 보내면, 가격이 렌더링될 때까지 기다렸다가 돌려준다.
 */

const PRICE_SELECTORS = [
  '[data-selenium="display-price"]',
  '[data-element-name="final-price"]',
  '[data-selenium="display-price-main"]',
  '[data-selenium="hotel-room-price"]',
  '[data-element-name="property-card-price"]',
  '[data-selenium="price-box"]',
  '[data-testid="price-box"]',
  ".PropertyCardPrice__Value",
  ".pd-price",
  ".Price__Value"
];

const SOLDOUT_PATTERNS = [
  "예약 가능한 객실이 없",
  "객실이 모두",
  "sold out",
  "no rooms available",
  "満室"
];

const CURRENCY_SIGNS = [
  { re: /(?:₩|KRW|원)/i, code: "KRW" },
  { re: /(?:US\$|USD|\$)/i, code: "USD" },
  { re: /(?:JPY|¥|円)/i, code: "JPY" },
  { re: /(?:EUR|€)/i, code: "EUR" },
  { re: /(?:THB|฿)/i, code: "THB" },
  { re: /(?:SGD|S\$)/i, code: "SGD" }
];

// 통화별로 "이 값보다 작으면 가격이 아니라 잡음" 하한선
const MIN_PLAUSIBLE = { KRW: 5000, JPY: 500, USD: 5, EUR: 5, SGD: 5, THB: 50 };

function detectCurrency(text) {
  for (const c of CURRENCY_SIGNS) if (c.re.test(text)) return c.code;
  return null;
}

/** "₩ 157,278" / "1,572.80" 같은 문자열에서 숫자만 뽑는다. */
function parseAmount(text) {
  const m = String(text).match(/\d[\d.,\s]*\d|\d/);
  if (!m) return null;
  let s = m[0].replace(/\s/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const sep = Math.max(lastComma, lastDot);
  if (sep > -1) {
    const tail = s.length - sep - 1;
    // 마지막 구분자 뒤가 3자리면 천 단위, 1~2자리면 소수점
    if (tail === 3) s = s.replace(/[.,]/g, "");
    else s = s.slice(0, sep).replace(/[.,]/g, "") + "." + s.slice(sep + 1).replace(/[.,]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function collectFromSelectors() {
  const found = [];
  for (const sel of PRICE_SELECTORS) {
    let nodes;
    try {
      nodes = document.querySelectorAll(sel);
    } catch (_) {
      continue;
    }
    for (const el of nodes) {
      const text = (el.textContent || "").trim();
      if (!text || text.length > 60) continue;
      const amount = parseAmount(text);
      if (amount === null) continue;
      found.push({ amount, currency: detectCurrency(text), raw: text });
    }
  }
  return found;
}

/** 셀렉터가 전부 빗나갔을 때: 통화 기호가 붙은 문자열만 본문에서 훑는다. */
function collectFromText() {
  const body = document.body ? document.body.innerText || "" : "";
  const found = [];
  const re = /(?:₩|KRW|US\$|USD|\$|¥|JPY|€|EUR|฿|THB)\s?\d[\d.,]{2,}|\d[\d.,]{2,}\s?원/gi;
  const hits = body.match(re) || [];
  for (const hit of hits) {
    const amount = parseAmount(hit);
    if (amount === null) continue;
    found.push({ amount, currency: detectCurrency(hit), raw: hit.trim() });
  }
  return found;
}

function pickBest(candidates) {
  if (!candidates.length) return null;
  // 가장 많이 등장한 통화를 기준 통화로 삼는다
  const counts = {};
  for (const c of candidates) if (c.currency) counts[c.currency] = (counts[c.currency] || 0) + 1;
  const currency = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
  const floor = MIN_PLAUSIBLE[currency] || 1;
  const pool = candidates
    .filter((c) => (!currency || !c.currency || c.currency === currency) && c.amount >= floor)
    .sort((a, b) => a.amount - b.amount);
  if (!pool.length) return null;
  // 할인 전 가격(취소선)과 최종가가 같이 노출되므로 더 낮은 쪽이 실제 결제가
  return { amount: pool[0].amount, currency, raw: pool[0].raw };
}

function readPriceNow() {
  const fromSel = collectFromSelectors();
  const best = pickBest(fromSel);
  if (best) return best;
  return pickBest(collectFromText());
}

function isSoldOut() {
  const body = (document.body ? document.body.innerText || "" : "").toLowerCase();
  return SOLDOUT_PATTERNS.some((p) => body.includes(p.toLowerCase()));
}

function waitForPrice(timeoutMs) {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const price = readPriceNow();
      if (price) {
        resolve({ ok: true, ...price, url: location.href });
        return;
      }
      if (isSoldOut()) {
        resolve({ ok: false, reason: "soldout", url: location.href });
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve({ ok: false, reason: "timeout", url: location.href });
        return;
      }
      setTimeout(tick, 600);
    };
    tick();
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "GET_PRICE") return false;
  waitForPrice(msg.timeoutMs || 25000).then(sendResponse);
  return true; // 비동기 응답
});

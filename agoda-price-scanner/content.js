/*
 * 아고다 페이지에서 "실제 결제가"를 찾아내는 스크립트.
 *
 * 페이지에는 세금·수수료, 1박 단가, 다른 객실·추천 호텔 가격이 잔뜩 섞여 있어서
 * 단순히 제일 작은 값을 고르면 엉뚱한 숫자가 잡힌다. 그래서
 *   1) 취소선(정가)이 아니고
 *   2) 화면에 실제로 보이며
 *   3) 글자가 가장 크고 위쪽에 있는
 * 가격을 결제가로 본다. 사용자가 "가격 위치 지정"으로 영역을 학습시키면
 * 그 영역 안에서만 같은 방식으로 찾는다.
 */

const KNOWN_SELECTORS = [
  '[data-selenium="display-price"]',
  '[data-element-name="final-price"]',
  '[data-selenium="display-price-main"]',
  '[data-selenium="hotel-room-price"]',
  '[data-element-name="property-card-price"]',
  '[data-testid="price-box"]'
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

const MIN_PLAUSIBLE = { KRW: 5000, JPY: 500, USD: 5, EUR: 5, SGD: 5, THB: 50 };

function detectCurrency(text) {
  for (const c of CURRENCY_SIGNS) if (c.re.test(text)) return c.code;
  return null;
}

/** 천 단위/소수점 표기를 숫자로 바꾼다. */
function normalizeNumber(str) {
  let t = String(str).replace(/\s/g, "");
  const sep = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  if (sep > -1) {
    const tail = t.length - sep - 1;
    // 마지막 구분자 뒤가 3자리면 천 단위, 1~2자리면 소수점
    if (tail === 3) t = t.replace(/[.,]/g, "");
    else t = t.slice(0, sep).replace(/[.,]/g, "") + "." + t.slice(sep + 1).replace(/[.,]/g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const SIGN_BEFORE = /(?:₩|US\$|S\$|\$|¥|€|฿|KRW|USD|JPY|EUR|THB|SGD)\s*$/i;
const SIGN_AFTER = /^\s*(?:원|엔|KRW|USD|JPY|EUR|THB|SGD)/i;

/**
 * "1박당 ₩360,667", "3박 총액 ₩1,082,000" 처럼 앞뒤에 다른 숫자가 섞여 있어도
 * 통화 기호에 붙은 숫자를 우선해서 금액을 뽑는다.
 */
function parseAmount(text) {
  const s = String(text);
  const re = /\d[\d.,]*\d|\d/g;
  const attached = [];
  const loose = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const value = normalizeNumber(m[0]);
    if (value === null) continue;
    const before = s.slice(Math.max(0, m.index - 6), m.index);
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 6);
    if (SIGN_BEFORE.test(before) || SIGN_AFTER.test(after)) attached.push(value);
    else loose.push(value);
  }
  const pool = attached.length ? attached : loose;
  if (!pool.length) return null;
  return Math.max(...pool);
}

function hasLineThrough(el) {
  let node = el;
  for (let i = 0; node && i < 4; i++, node = node.parentElement) {
    const st = getComputedStyle(node);
    if (st.textDecorationLine && st.textDecorationLine.includes("line-through")) return true;
  }
  return false;
}

function matchesKnown(el) {
  return KNOWN_SELECTORS.some((sel) => {
    try {
      return el.matches(sel) || el.closest(sel);
    } catch (_) {
      return false;
    }
  });
}

/** 이 엘리먼트를 다시 찾기 위한 "영역 선택자"(가장 가까운 data-* 조상) */
function areaSelectorFor(el) {
  let node = el;
  for (let i = 0; node && node !== document.body && i < 8; i++, node = node.parentElement) {
    for (const attr of ["data-selenium", "data-element-name", "data-testid", "id"]) {
      const v = node.getAttribute && node.getAttribute(attr);
      if (v && /^[\w .:\-/]+$/.test(v)) {
        return attr === "id" ? `#${CSS.escape(v)}` : `[${attr}="${CSS.escape(v).replace(/\\/g, "")}"]`;
      }
    }
  }
  // data-* 가 하나도 없으면 클래스로라도 범위를 좁힌다
  node = el.parentElement;
  for (let i = 0; node && node !== document.body && i < 4; i++, node = node.parentElement) {
    const cls = (node.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) return cls.map((c) => `.${CSS.escape(c)}`).join("");
  }
  return "";
}

/** 가격처럼 보이는 엘리먼트를 전부 모아 점수를 매긴다. */
function collectCandidates(root) {
  const scope = root || document.body;
  if (!scope) return [];
  const raw = [];

  for (const el of scope.querySelectorAll("*")) {
    const text = (el.textContent || "").trim();
    if (!text || text.length > 30) continue;
    if (!/\d[\d.,]{2,}/.test(text)) continue;
    // 자식이 같은 텍스트를 그대로 갖고 있으면 더 깊은 쪽만 남긴다
    let redundant = false;
    for (const c of el.children) {
      if ((c.textContent || "").trim() === text) { redundant = true; break; }
    }
    if (redundant) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (hasLineThrough(el)) continue;

    const amount = parseAmount(text);
    if (amount === null) continue;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const fontSize = parseFloat(style.fontSize) || 0;
    if (fontSize < 10) continue;

    raw.push({
      amount,
      currency: detectCurrency(text),
      text,
      fontSize,
      bold: (parseInt(style.fontWeight, 10) || 400) >= 600,
      top: Math.round(rect.top + window.scrollY),
      known: matchesKnown(el),
      area: areaSelectorFor(el)
    });
  }

  // 같은 금액이 같은 위치에서 중복으로 잡히면 통화 기호가 붙은 쪽을 남긴다
  const byKey = new Map();
  for (const c of raw) {
    const key = `${c.amount}|${Math.round(c.top / 8)}`;
    const prev = byKey.get(key);
    if (!prev || (!prev.currency && c.currency) || (prev.fontSize < c.fontSize)) byKey.set(key, c);
  }
  let list = [...byKey.values()];

  // 페이지에서 가장 많이 쓰인 통화를 기준으로 삼는다
  const counts = {};
  for (const c of list) if (c.currency) counts[c.currency] = (counts[c.currency] || 0) + 1;
  const currency = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
  const floor = MIN_PLAUSIBLE[currency] || 1;
  list = list.filter((c) => (!currency || !c.currency || c.currency === currency) && c.amount >= floor);

  for (const c of list) {
    c.currency = c.currency || currency;
    // 큰 글씨 > 굵은 글씨 > 알려진 셀렉터 > 페이지 위쪽
    c.score = c.fontSize * 10 + (c.bold ? 15 : 0) + (c.known ? 60 : 0) - c.top / 400;
  }
  list.sort((a, b) => b.score - a.score);
  return list;
}

/** 학습된 영역이 있으면 그 안에서만 찾는다. */
function pickPrice(areaSelector) {
  if (areaSelector) {
    let root = null;
    try {
      root = document.querySelector(areaSelector);
    } catch (_) {
      root = null;
    }
    if (root) {
      const scoped = collectCandidates(root);
      if (scoped.length) return { ...scoped[0], via: "area" };
    }
  }
  const all = collectCandidates(null);
  return all.length ? { ...all[0], via: areaSelector ? "fallback" : "auto" } : null;
}

function isSoldOut() {
  const body = (document.body ? document.body.innerText || "" : "").toLowerCase();
  return SOLDOUT_PATTERNS.some((p) => body.includes(p.toLowerCase()));
}

function waitForPrice(timeoutMs, areaSelector) {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const price = pickPrice(areaSelector);
      if (price) {
        resolve({
          ok: true,
          amount: price.amount,
          currency: price.currency,
          raw: price.text,
          via: price.via,
          url: location.href
        });
        return;
      }
      if (isSoldOut()) return resolve({ ok: false, reason: "soldout", url: location.href });
      if (Date.now() - started > timeoutMs) return resolve({ ok: false, reason: "timeout", url: location.href });
      setTimeout(tick, 600);
    };
    tick();
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  if (msg.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "GET_PRICE") {
    waitForPrice(msg.timeoutMs || 25000, msg.areaSelector || "").then(sendResponse);
    return true;
  }

  if (msg.type === "GET_CANDIDATES") {
    // 가격 위치 지정용: 지금 화면에서 가격처럼 보이는 것들을 점수순으로 돌려준다
    const list = collectCandidates(null).slice(0, 12);
    const chosen = pickPrice(msg.areaSelector || "");
    sendResponse({ ok: true, candidates: list, chosen, url: location.href, soldOut: isSoldOut() });
    return false;
  }

  if (msg.type === "HIGHLIGHT") {
    try {
      const el = document.querySelector(msg.areaSelector);
      if (el) {
        el.scrollIntoView({ block: "center" });
        const old = el.style.outline;
        el.style.outline = "3px solid #d1344a";
        setTimeout(() => { el.style.outline = old; }, 2500);
      }
    } catch (_) {}
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

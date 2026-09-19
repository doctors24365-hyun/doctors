/*
 * 스캔 오케스트레이터.
 *  1) (옵션) 아고다 쿠키를 지운다  - 영상의 "쿠키 싹 지우고 가격 본다"
 *  2) CID만 바꾼 URL들을 백그라운드 창에서 하나씩 열고
 *  3) content.js가 읽어 온 실제 가격을 모아 최저가를 고른다
 */
import { DEFAULT_SETTINGS } from "./cids.js";

const AGODA_ORIGINS = [
  "https://www.agoda.com",
  "https://agoda.com",
  "https://cdn.agoda.net",
  "https://www.agoda.net"
];

const state = {
  running: false,
  cancelled: false,
  windowId: null,
  baseUrl: "",
  results: [],
  total: 0,
  done: 0,
  startedAt: 0,
  finishedAt: 0,
  error: ""
};

let keepAliveTimer = null;

function keepAliveStart() {
  if (keepAliveTimer) return;
  // 스캔 중 서비스 워커가 잠들지 않도록 주기적으로 깨운다
  keepAliveTimer = setInterval(() => chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError), 20000);
}

function keepAliveStop() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

function snapshot() {
  return {
    running: state.running,
    cancelled: state.cancelled,
    baseUrl: state.baseUrl,
    results: state.results,
    total: state.total,
    done: state.done,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    error: state.error
  };
}

async function publish() {
  const snap = snapshot();
  await chrome.storage.local.set({ lastScan: snap });
  chrome.runtime.sendMessage({ type: "SCAN_STATE", state: snap }).catch(() => {});
}

/** 예약 링크에서 cid만 갈아끼운 URL을 만든다. */
export function buildUrl(baseUrl, cid) {
  const u = new URL(baseUrl);
  if (cid) u.searchParams.set("cid", String(cid));
  else u.searchParams.delete("cid");
  // 제휴 추적 파라미터가 남아 있으면 cid보다 우선될 수 있어 함께 정리한다
  for (const p of ["tag", "gclid", "ddiscount", "tmcid"]) u.searchParams.delete(p);
  return u.toString();
}

function isAgodaUrl(url) {
  try {
    return /(^|\.)agoda\.com$/i.test(new URL(url).hostname);
  } catch (_) {
    return false;
  }
}

async function clearAgodaCookies() {
  await chrome.browsingData.remove(
    { origins: AGODA_ORIGINS },
    { cookies: true, localStorage: true, cacheStorage: true, indexedDB: true, serviceWorkers: true }
  );
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve(ok);
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) finish(false);
      else if (tab && tab.status === "complete") finish(true);
    });
  });
}

async function askPrice(tabId, timeoutMs) {
  // content.js 주입이 끝나기 전일 수 있어 몇 번 재시도한다
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "GET_PRICE", timeoutMs });
      if (res) return res;
    } catch (_) {
      await sleep(800);
    }
  }
  return { ok: false, reason: "no_content_script" };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureWindow(firstUrl, minimize) {
  if (state.windowId !== null) return state.windowId;
  // 크롬은 state:"minimized"와 width/height를 함께 지정하면 오류를 낸다
  const opts = minimize
    ? { url: firstUrl, focused: false, state: "minimized" }
    : { url: firstUrl, focused: false, width: 1000, height: 800 };
  const win = await chrome.windows.create(opts);
  state.windowId = win.id;
  return win.id;
}

async function scanOne(entry, settings) {
  const url = buildUrl(state.baseUrl, entry.cid);
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url, windowId: state.windowId, active: false });
    tabId = tab.id;
    if (tabId == null) throw new Error("탭을 열지 못했습니다");

    await waitForTabComplete(tabId, settings.loadTimeoutMs);
    if (state.cancelled) return { ...entry, url, status: "cancelled" };

    const res = await askPrice(tabId, Math.max(8000, settings.loadTimeoutMs - 10000));
    if (res.ok) {
      return { ...entry, url, status: "ok", amount: res.amount, currency: res.currency, raw: res.raw };
    }
    return { ...entry, url, status: res.reason || "failed" };
  } catch (e) {
    return { ...entry, url, status: "error", message: String(e && e.message ? e.message : e) };
  } finally {
    if (tabId != null) chrome.tabs.remove(tabId).catch(() => {});
  }
}

async function runScan({ url, cids, settings }) {
  if (state.running) return { ok: false, error: "이미 스캔이 진행 중입니다." };
  if (!isAgodaUrl(url)) return { ok: false, error: "아고다(agoda.com) 링크만 스캔할 수 있습니다." };
  if (!cids.length) return { ok: false, error: "비교할 CID가 없습니다." };

  Object.assign(state, {
    running: true,
    cancelled: false,
    windowId: null,
    baseUrl: url,
    results: [],
    total: cids.length,
    done: 0,
    startedAt: Date.now(),
    finishedAt: 0,
    error: ""
  });
  keepAliveStart();
  await publish();

  try {
    if (settings.clearCookies) await clearAgodaCookies();
    await ensureWindow("about:blank", settings.minimizeWindow);

    const queue = cids.slice();
    const workers = [];
    const workerCount = Math.max(1, Math.min(4, Number(settings.concurrency) || 1));

    for (let i = 0; i < workerCount; i++) {
      workers.push(
        (async () => {
          // 첫 탭은 창을 만들며 열리므로 워커들이 동시에 달려들지 않게 살짝 어긋나게 시작
          await sleep(i * settings.betweenDelayMs);
          while (!state.cancelled) {
            const entry = queue.shift();
            if (!entry) break;
            const result = await scanOne(entry, settings);
            state.results.push(result);
            state.done += 1;
            await publish();
            await sleep(settings.betweenDelayMs);
          }
        })()
      );
    }
    await Promise.all(workers);
  } catch (e) {
    state.error = String(e && e.message ? e.message : e);
  } finally {
    if (state.windowId !== null) {
      chrome.windows.remove(state.windowId).catch(() => {});
      state.windowId = null;
    }
    state.running = false;
    state.finishedAt = Date.now();
    keepAliveStop();
    await publish();
  }
  return { ok: true };
}

function cancelScan() {
  if (!state.running) return;
  state.cancelled = true;
  if (state.windowId !== null) {
    chrome.windows.remove(state.windowId).catch(() => {});
    state.windowId = null;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;
  switch (msg.type) {
    case "START_SCAN":
      runScan({
        url: msg.url,
        cids: msg.cids || [],
        settings: { ...DEFAULT_SETTINGS, ...(msg.settings || {}) }
      }).then(sendResponse);
      return true;
    case "CANCEL_SCAN":
      cancelScan();
      sendResponse({ ok: true });
      return false;
    case "GET_STATE":
      sendResponse({ ok: true, state: snapshot() });
      return false;
    case "CLEAR_COOKIES":
      clearAgodaCookies()
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    default:
      return false;
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (state.windowId === windowId) state.windowId = null;
});

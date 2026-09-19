import { DEFAULT_CIDS, DEFAULT_SETTINGS, parseCidText, cidsToText } from "./cids.js";

const $ = (id) => document.getElementById(id);
const el = {
  url: $("url"), urlInfo: $("urlInfo"), fromTab: $("fromTab"),
  optBox: $("optBox"), clearCookies: $("clearCookies"), minimizeWindow: $("minimizeWindow"),
  concurrency: $("concurrency"), cidText: $("cidText"), resetCids: $("resetCids"), cidCount: $("cidCount"),
  start: $("start"), cancel: $("cancel"), cookieOnly: $("cookieOnly"),
  progressBox: $("progressBox"), barFill: $("barFill"), progressText: $("progressText"),
  msg: $("msg"), best: $("best"), resultBox: $("resultBox"), rows: $("rows")
};

const STATUS_TEXT = {
  timeout: "시간 초과",
  soldout: "객실 없음",
  failed: "가격 못 읽음",
  no_content_script: "페이지 로드 실패",
  cancelled: "중지됨",
  error: "오류"
};

function money(amount, currency) {
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency", currency: currency || "KRW", maximumFractionDigits: currency === "KRW" || currency === "JPY" ? 0 : 2
    }).format(amount);
  } catch (_) {
    return `${Math.round(amount).toLocaleString("ko-KR")} ${currency || ""}`.trim();
  }
}

function showMsg(text, kind) {
  el.msg.textContent = text;
  el.msg.classList.toggle("hidden", !text);
  el.msg.style.background = kind === "ok" ? "var(--good-l)" : "var(--danger-l)";
  el.msg.style.color = kind === "ok" ? "var(--good)" : "var(--danger)";
}

function hotelName(url) {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean);
    const seg = path.find((p) => p.endsWith(".html")) || path[path.length - 1] || "";
    return decodeURIComponent(seg.replace(/\.html$/, "").replace(/[-_]/g, " ")).trim();
  } catch (_) {
    return "";
  }
}

/* ---------- 설정 저장/복원 ---------- */

async function loadSettings() {
  const { settings, cidText, lastUrl } = await chrome.storage.local.get(["settings", "cidText", "lastUrl"]);
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  el.clearCookies.checked = s.clearCookies;
  el.minimizeWindow.checked = s.minimizeWindow;
  el.concurrency.value = s.concurrency;
  el.cidText.value = cidText || cidsToText(DEFAULT_CIDS);
  if (lastUrl) el.url.value = lastUrl;
  updateCidCount();
  updateUrlInfo();
}

function currentSettings() {
  return {
    ...DEFAULT_SETTINGS,
    clearCookies: el.clearCookies.checked,
    minimizeWindow: el.minimizeWindow.checked,
    concurrency: Math.max(1, Math.min(4, Number(el.concurrency.value) || 1))
  };
}

async function saveSettings() {
  await chrome.storage.local.set({ settings: currentSettings(), cidText: el.cidText.value });
}

function updateCidCount() {
  el.cidCount.textContent = `${parseCidText(el.cidText.value).length}개 비교`;
}

function updateUrlInfo() {
  const name = hotelName(el.url.value.trim());
  el.urlInfo.textContent = name ? name.slice(0, 40) : "";
}

/* ---------- 결과 렌더링 ---------- */

function render(state) {
  const running = state.running;
  el.start.classList.toggle("hidden", running);
  el.cancel.classList.toggle("hidden", !running);
  el.cookieOnly.disabled = running;
  el.progressBox.classList.toggle("hidden", !state.total);

  if (state.total) {
    const pct = Math.round((state.done / state.total) * 100);
    el.barFill.style.width = `${pct}%`;
    el.progressText.textContent = running
      ? `${state.done} / ${state.total} 조회 중…`
      : `${state.done} / ${state.total} 조회 완료`;
  }
  if (state.error) showMsg(state.error);

  const ok = state.results.filter((r) => r.status === "ok" && typeof r.amount === "number");
  const failed = state.results.filter((r) => r.status !== "ok");
  ok.sort((a, b) => a.amount - b.amount);

  el.resultBox.classList.toggle("hidden", !state.results.length);
  el.rows.innerHTML = "";
  [...ok, ...failed].forEach((r, i) => {
    const tr = document.createElement("tr");
    if (r.status === "ok" && i === 0) tr.className = "top";
    if (r.status !== "ok") tr.className = "fail";

    const c1 = document.createElement("td");
    const cid = document.createElement("span");
    cid.className = "cid";
    cid.textContent = r.cid || "기본";
    c1.appendChild(cid);
    if (r.label) {
      const note = document.createElement("span");
      note.className = "note";
      note.textContent = r.label;
      c1.appendChild(note);
    }

    const c2 = document.createElement("td");
    c2.textContent = r.status === "ok" ? money(r.amount, r.currency) : STATUS_TEXT[r.status] || r.status;

    const c3 = document.createElement("td");
    if (r.url) {
      const b = document.createElement("button");
      b.className = "open";
      b.textContent = "열기";
      b.addEventListener("click", () => chrome.tabs.create({ url: r.url }));
      c3.appendChild(b);
    }
    tr.append(c1, c2, c3);
    el.rows.appendChild(tr);
  });

  // 최저가 카드
  el.best.classList.toggle("hidden", ok.length < 1);
  if (ok.length) {
    const top = ok[0];
    const base = state.results.find((r) => !r.cid && r.status === "ok");
    const worst = ok[ok.length - 1];
    const ref = base && base.amount > top.amount ? base : worst;
    const saved = ref && ref.amount > top.amount ? ref.amount - top.amount : 0;

    el.best.innerHTML = "";
    const cap = document.createElement("div");
    cap.className = "cap";
    cap.textContent = `최저가 · CID ${top.cid || "기본"}`;
    const price = document.createElement("div");
    price.className = "price";
    price.textContent = money(top.amount, top.currency);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${ok.length}개 CID 중 최저 · 최고 ${money(worst.amount, worst.currency)}`;
    el.best.append(cap, price, meta);

    if (saved > 0) {
      const save = document.createElement("div");
      save.className = "save";
      save.textContent = `${money(saved, top.currency)} 절약 (${Math.round((saved / ref.amount) * 100)}%)`;
      el.best.appendChild(save);
    }
    const go = document.createElement("button");
    go.className = "btn";
    go.textContent = "이 가격으로 예약 페이지 열기";
    go.addEventListener("click", () => chrome.tabs.create({ url: top.url }));
    el.best.appendChild(go);
  }
}

/* ---------- 이벤트 ---------- */

el.fromTab.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/agoda\.com/i.test(tab.url)) {
    showMsg("현재 탭이 아고다 페이지가 아닙니다.");
    return;
  }
  el.url.value = tab.url;
  showMsg("");
  updateUrlInfo();
  chrome.storage.local.set({ lastUrl: tab.url });
});

el.url.addEventListener("input", () => {
  updateUrlInfo();
  chrome.storage.local.set({ lastUrl: el.url.value.trim() });
});

el.cidText.addEventListener("input", () => {
  updateCidCount();
  saveSettings();
});

[el.clearCookies, el.minimizeWindow, el.concurrency].forEach((n) =>
  n.addEventListener("change", saveSettings)
);

el.resetCids.addEventListener("click", () => {
  el.cidText.value = cidsToText(DEFAULT_CIDS);
  updateCidCount();
  saveSettings();
});

el.start.addEventListener("click", async () => {
  const url = el.url.value.trim();
  if (!url) return showMsg("아고다 예약 링크를 입력하세요.");
  const cids = parseCidText(el.cidText.value);
  if (!cids.length) return showMsg("비교할 CID를 한 개 이상 입력하세요.");

  showMsg("");
  el.best.classList.add("hidden");
  el.rows.innerHTML = "";
  await saveSettings();
  await chrome.storage.local.set({ lastUrl: url });

  const res = await chrome.runtime.sendMessage({
    type: "START_SCAN", url, cids, settings: currentSettings()
  });
  if (res && !res.ok) showMsg(res.error || "스캔을 시작하지 못했습니다.");
});

el.cancel.addEventListener("click", () => chrome.runtime.sendMessage({ type: "CANCEL_SCAN" }));

el.cookieOnly.addEventListener("click", async () => {
  const res = await chrome.runtime.sendMessage({ type: "CLEAR_COOKIES" });
  showMsg(res && res.ok ? "아고다 쿠키·로컬 데이터를 삭제했습니다." : "삭제에 실패했습니다.", res && res.ok ? "ok" : "");
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "SCAN_STATE") render(msg.state);
});

(async function init() {
  await loadSettings();
  const res = await chrome.runtime.sendMessage({ type: "GET_STATE" }).catch(() => null);
  if (res && res.state) render(res.state);
  else {
    const { lastScan } = await chrome.storage.local.get("lastScan");
    if (lastScan) render(lastScan);
  }
})();

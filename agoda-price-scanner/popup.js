import { DEFAULT_CIDS, DEFAULT_SETTINGS, parseCidText, cidsToText } from "./cids.js";

const $ = (id) => document.getElementById(id);
const el = {
  url: $("url"), urlInfo: $("urlInfo"), fromTab: $("fromTab"),
  optBox: $("optBox"), cookieMode: $("cookieMode"), minimizeWindow: $("minimizeWindow"),
  concurrency: $("concurrency"), concHint: $("concHint"),
  cidText: $("cidText"), resetCids: $("resetCids"), cidCount: $("cidCount"),
  areaBox: $("areaBox"), areaTag: $("areaTag"), inspect: $("inspect"),
  clearArea: $("clearArea"), cands: $("cands"),
  start: $("start"), cancel: $("cancel"), cookieOnly: $("cookieOnly"),
  progressBox: $("progressBox"), barFill: $("barFill"), progressText: $("progressText"),
  msg: $("msg"), warn: $("warn"), best: $("best"), resultBox: $("resultBox"), rows: $("rows")
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

let areaSelector = "";

async function loadSettings() {
  const { settings, cidText, lastUrl } = await chrome.storage.local.get(["settings", "cidText", "lastUrl"]);
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  el.cookieMode.value = s.cookieMode;
  el.minimizeWindow.checked = s.minimizeWindow;
  el.concurrency.value = s.concurrency;
  areaSelector = s.areaSelector || "";
  renderArea();
  el.cidText.value = cidText || cidsToText(DEFAULT_CIDS);
  if (lastUrl) el.url.value = lastUrl;
  updateCidCount();
  updateUrlInfo();
  updateConcHint();
}

function currentSettings() {
  return {
    ...DEFAULT_SETTINGS,
    cookieMode: el.cookieMode.value,
    minimizeWindow: el.minimizeWindow.checked,
    concurrency: Math.max(1, Math.min(4, Number(el.concurrency.value) || 1)),
    areaSelector
  };
}

function updateConcHint() {
  el.concHint.textContent = el.cookieMode.value === "each" ? "쿠키 초기화 때문에 1개로 고정" : "";
}

function renderArea() {
  el.areaTag.textContent = areaSelector ? "지정됨" : "";
  el.areaTag.classList.toggle("hidden", !areaSelector);
  el.clearArea.classList.toggle("hidden", !areaSelector);
}

async function activeAgodaTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/agoda\.com/i.test(tab.url)) return null;
  return tab;
}

function renderCandidates(res) {
  el.cands.innerHTML = "";
  if (!res || !res.ok) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = (res && res.error) || "가격을 찾지 못했습니다.";
    el.cands.appendChild(p);
    return;
  }
  if (res.soldOut) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "이 페이지는 예약 가능한 객실이 없는 상태로 보입니다.";
    el.cands.appendChild(p);
  }
  if (!res.candidates.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "가격처럼 보이는 요소가 없습니다. 객실 가격이 보이는 화면에서 다시 시도하세요.";
    el.cands.appendChild(p);
    return;
  }
  res.candidates.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "cand" + (i === 0 && !areaSelector ? " picked" : "");

    const info = document.createElement("div");
    info.className = "info";
    const amt = document.createElement("div");
    amt.className = "amt";
    amt.textContent = money(c.amount, c.currency);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `${c.text} · ${Math.round(c.fontSize)}px${c.known ? " · 아고다 가격요소" : ""}`;
    info.append(amt, sub);

    const pick = document.createElement("button");
    pick.className = "btn ghost sm";
    pick.textContent = "이걸로";
    pick.addEventListener("click", async () => {
      areaSelector = c.area || "";
      renderArea();
      await saveSettings();
      showMsg(areaSelector ? "이 위치를 기억했습니다." : "이 요소는 위치를 특정할 수 없습니다.", areaSelector ? "ok" : "");
      renderCandidates(res);
    });

    row.append(info, pick);
    el.cands.appendChild(row);
  });
}

async function saveSettings() {
  await chrome.storage.local.set({ settings: currentSettings(), cidText: el.cidText.value });
}

function updateCidCount() {
  el.cidCount.textContent = `${parseCidText(el.cidText.value).length}개 비교`;
}

function updateUrlInfo() {
  const raw = el.url.value.trim();
  const name = hotelName(raw);
  el.urlInfo.textContent = name ? name.slice(0, 40) : "";
  if (!raw) return;
  const looksDetail = /\/hotel\//i.test(raw);
  const hasDates = /checkIn=|checkin=/i.test(raw);
  if (!looksDetail || !hasDates) {
    el.urlInfo.textContent = !looksDetail
      ? "호텔 상세 페이지 링크가 아닌 것 같습니다"
      : "날짜 정보가 없는 링크입니다";
  }
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

  // CID를 바꿔도 값이 전부 같으면 대개 쿠키 때문에 CID가 무시된 것이다
  const identical = ok.length >= 3 && ok.every((r) => r.amount === ok[0].amount);
  let warnText = "";
  if (!running && identical) {
    warnText = el.cookieMode.value === "each"
      ? "모든 CID의 가격이 같습니다. 이 호텔·날짜에는 CID별 차이가 없거나, 목록의 CID가 만료됐을 수 있습니다."
      : "모든 CID의 가격이 같습니다. 쿠키 초기화를 \"CID마다 초기화\"로 바꾸고 다시 시도해 보세요.";
  } else if (!running && ok.length && ok[0].via === "fallback") {
    warnText = "지정한 가격 위치를 찾지 못해 자동 판단으로 읽었습니다. 가격이 이상하면 위치를 다시 지정하세요.";
  }
  el.warn.textContent = warnText;
  el.warn.classList.toggle("hidden", !warnText);

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

[el.cookieMode, el.minimizeWindow, el.concurrency].forEach((n) =>
  n.addEventListener("change", () => {
    updateConcHint();
    saveSettings();
  })
);

el.inspect.addEventListener("click", async () => {
  const tab = await activeAgodaTab();
  if (!tab) return showMsg("현재 탭이 아고다 페이지가 아닙니다.");
  showMsg("");
  el.cands.innerHTML = '<p class="hint">확인 중…</p>';
  const res = await chrome.runtime.sendMessage({ type: "INSPECT_TAB", tabId: tab.id, areaSelector });
  renderCandidates(res);
});

el.clearArea.addEventListener("click", async () => {
  areaSelector = "";
  renderArea();
  await saveSettings();
  showMsg("지정을 해제했습니다. 자동 판단으로 돌아갑니다.", "ok");
});

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

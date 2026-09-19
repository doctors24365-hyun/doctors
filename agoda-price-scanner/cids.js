// 공개적으로 널리 공유되는 아고다 CID(제휴/캠페인 코드) 목록입니다.
// 같은 객실이라도 CID에 따라 적용되는 할인/수수료 구조가 달라 최종가가 달라집니다.
// 코드는 수시로 만료되거나 새로 생기므로, 팝업에서 직접 추가/삭제해서 쓰세요.
// (유효하지 않은 CID는 기본가와 동일한 값이 나올 뿐 문제가 되지 않습니다.)
export const DEFAULT_CIDS = [
  { cid: "", label: "기본 (CID 없음)" },
  { cid: "1833981", label: "영상에 나온 CID" },
  { cid: "1844104", label: "" },
  { cid: "1829968", label: "" },
  { cid: "1917614", label: "" },
  { cid: "1891473", label: "" },
  { cid: "1908612", label: "" },
  { cid: "1921868", label: "" },
  { cid: "1922868", label: "" },
  { cid: "1730453", label: "" },
  { cid: "1718834", label: "" },
  { cid: "1877417", label: "" },
  { cid: "1889810", label: "" },
  { cid: "1902573", label: "" }
];

export const DEFAULT_SETTINGS = {
  clearCookies: true,       // 스캔 전 아고다 쿠키 삭제 (영상의 1번 방법)
  minimizeWindow: true,     // 스캔용 창을 최소화해서 방해받지 않게
  concurrency: 2,           // 동시에 열 탭 수
  loadTimeoutMs: 45000,     // 탭 하나당 최대 대기 시간
  betweenDelayMs: 700       // 탭 사이 간격
};

// 저장된 문자열("cid  라벨" 줄 단위)을 목록으로 변환
export function parseCidText(text) {
  const out = [];
  const seen = new Set();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(\d*)\s*(?:[,|\t]\s*|\s{2,})?(.*)$/);
    const cid = (m && m[1]) || "";
    const label = ((m && m[2]) || "").trim();
    if (seen.has(cid)) continue;
    seen.add(cid);
    out.push({ cid, label });
  }
  return out;
}

export function cidsToText(list) {
  return list.map((c) => (c.label ? `${c.cid}\t${c.label}` : c.cid)).join("\n");
}

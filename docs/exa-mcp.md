# Exa 논문/웹 검색 붙이기

Claude 가 실제 논문·웹 문서를 찾아 근거와 함께 답하도록 Exa 를 연결하는 방법.
API 키나 카드 등록 없이 Exa 계정 로그인만으로 쓴다.

붙이는 곳이 두 군데다. 세션이 **어디서 실행되느냐**에 따라 읽는 설정이 다르기 때문이다.

| 세션 실행 위치 | 필요한 설정 |
|---|---|
| 내 PC (터미널 · IDE · 데스크탑 앱의 Local) | 아래 **1. 내 PC** |
| 클라우드 (claude.ai · 휴대폰 · 데스크탑 앱의 Cloud) | 아래 **2. 클라우드** |

둘 다 해두면 어디서 시작하든 Exa 가 잡힌다.

## 1. 내 PC — CLI 로 등록

터미널에서 한 줄이면 끝난다. user 스코프라 이 PC 의 모든 프로젝트에서 쓸 수 있다.

```bash
claude mcp add --transport http --scope user exa https://mcp.exa.ai/mcp
```

등록 후 `claude` 실행 → `/mcp` → `exa` 선택 → Authenticate → 브라우저에서 Exa 로그인.
`/mcp` 에 `exa ✓ connected` 로 보이면 완료. 제거는 `claude mcp remove exa`.

## 2. 클라우드 — 커넥터로 등록

[claude.ai/customize/connectors](https://claude.ai/customize/connectors) 에서:

1. `+` → **Add custom connector**
2. **Name**: `Exa`, **MCP server URL**: `https://mcp.exa.ai/mcp`
3. Advanced settings(OAuth Client ID/Secret)는 비워둔다 — 자동으로 잡힌다
4. 목록의 **Exa** 옆 **Connect** → Exa 로그인
5. **새 세션을 시작한다** — 커넥터는 세션이 켜질 때 한 번 읽는다

커넥터는 계정 단위라 기기와 무관하다. 휴대폰에서 시작한 클라우드 세션에서도 그대로 잡힌다.

### 저장소에 `.mcp.json` 을 두지 않는 이유

프로젝트 스코프 `.mcp.json` 에 `https://mcp.exa.ai/mcp` 를 넣으면 **클라우드 세션에서는
연결에 실패한다**(`ERR_PROXY_TUNNEL: 403 Forbidden`). 클라우드 환경의 네트워크 정책이
기본적으로 `mcp.exa.ai` 를 막기 때문이다. 커넥터 트래픽은 Anthropic 서버를 거쳐 나가므로
이 허용목록을 타지 않는다 — 그래서 클라우드에는 커넥터 방식을 쓴다.

굳이 `.mcp.json` 으로 가야 한다면, 클라우드 환경 설정(claude.ai/code 의 메시지 입력창
윗줄 클라우드 아이콘 → 환경의 톱니 아이콘)에서 **Network access** 를 **Custom** 으로 바꾸고
**Allowed domains** 에 `mcp.exa.ai` 를 추가해야 한다. 이때
**"Also include default list of common package managers"** 를 반드시 체크할 것. 체크하지
않으면 npm·GitHub 등 기존 허용 도메인이 전부 막힌다.

## 논문만 검색하게 하려면

URL 에 쿼리 파라미터로 도구를 제한할 수 있다.

```
https://mcp.exa.ai/mcp?tools=research_paper_search
```

주요 도구: `web_search_exa`, `research_paper_search`, `web_fetch_exa`, `agent_run`,
`company_research`, `crawling`.

## 논문이 잘 잡히는 질문법

- 한글로 묻더라도 **영문 키워드를 같이** 준다.
  예) "PLLA 인체 사용 (poly-L-lactic acid human clinical study) 논문 찾아줘"
- **기간·연구 유형을 지정**한다. 예) "2020년 이후 RCT 와 메타분석 위주로"
- **출력 형식을 못박는다.** 예) "제목·저널·연도·링크를 표로 정리하고 핵심결론을 한 줄씩"
- 한 번에 넓게 묻지 말고 쪼갠다. 개괄 먼저 → 그다음 특정 논문 전문 읽기.
- 깊게 파야 하면 "deep research 로 조사해줘" 라고 명시한다.

## 참고

- 무료 티어는 월 1,000회 수준이며 정책은 Exa 쪽에서 바뀔 수 있다.
- 무료 플랜 계정은 커스텀 커넥터를 1개만 등록할 수 있다.
- Team/Enterprise 계정은 조직 Owner 가 먼저 커넥터를 추가해야 개인이 연결할 수 있다.

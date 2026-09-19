# Exa 논문/웹 검색 붙이기 (Claude Code MCP)

Claude 가 실제 논문·웹 문서를 찾아서 근거와 함께 답하도록 Exa MCP 서버를 연결한다.
API 키·카드 등록 없이 호스팅 엔드포인트를 그대로 쓴다.

## 이 저장소에서

루트의 `.mcp.json` 에 이미 설정되어 있다. 저장소를 연 뒤 Claude Code 를 실행하면
프로젝트 MCP 서버 사용 여부를 한 번 묻고, 승인하면 바로 붙는다.

```bash
claude            # 실행 → "Use this project's MCP servers?" → Yes
claude mcp list   # exa 가 connected 로 보이면 완료
```

## 다른 프로젝트에 붙일 때 (명령어 한 줄)

```bash
# 이 프로젝트에서만 사용 (.mcp.json 생성, 팀 공유됨)
claude mcp add --transport http --scope project exa https://mcp.exa.ai/mcp

# 내 모든 프로젝트에서 사용
claude mcp add --transport http --scope user exa https://mcp.exa.ai/mcp
```

제거는 `claude mcp remove exa`.

## 논문만 검색하게 하려면

호스팅 엔드포인트는 쿼리 파라미터로 도구를 고를 수 있다. 논문 검색 도구만 켜면
Claude 가 일반 웹 검색 대신 논문 쪽으로 붙는다.

```bash
claude mcp add --transport http --scope project exa \
  "https://mcp.exa.ai/mcp?tools=research_paper_search"
```

`.mcp.json` 의 `url` 을 같은 값으로 바꿔도 된다.
사용 가능한 주요 도구: `web_search_exa`, `research_paper_search`,
`company_research`, `crawling`, `deep_researcher_start`, `deep_researcher_check`.

## 논문이 잘 잡히는 질문법

- 주제어는 한글로 묻더라도 **영문 키워드를 같이** 준다.
  예) "성장호르몬 치료 키 성장 효과 (growth hormone therapy final adult height) 논문 찾아줘"
- **기간·연구 유형을 지정**한다.
  예) "2020년 이후 RCT 와 메타분석 위주로"
- **출처를 요구**한다.
  예) "각 논문 제목·저널·연도·링크를 표로 정리하고, 본문 근거 문장을 인용해줘"
- 한 번에 넓게 묻지 말고 **질문을 쪼갠다**. 먼저 개괄 → 그다음 특정 논문 전문 크롤링.
- 깊게 파야 하면 "deep research 로 조사해줘" 라고 명시한다.

## 참고

- 무료 티어는 월 1,000회 수준이며, 정책은 Exa 쪽에서 바뀔 수 있다.
- 사내망/프록시 환경에서는 `https://mcp.exa.ai` 아웃바운드가 열려 있어야 한다.

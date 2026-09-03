---
type: concept
tags: [claude-academy, 개념, 개발]
---

# Tool Use (도구 호출)
> [!tip] 한 문장
> 모델에게 **함수 목록을 주고**, 필요할 때 "이 함수를 이 인자로 불러줘"라고 말하게 하는 것.

---

## 흐름
```
1. 요청 + 도구 정의(JSON schema)를 함께 전송
2. 모델이 tool_use 블록으로 응답  ← 모델은 실행하지 않는다
3. 내 코드가 실제 함수를 실행
4. 결과를 tool_result로 다시 전송
5. 모델이 최종 답변 생성
```

> [!warning] 오해 주의
> 모델이 함수를 직접 실행하는 게 아니다. **실행은 항상 내 코드**가 한다.
> 따라서 인자 검증·권한 확인도 내 코드의 책임이다.

---

## 도구 정의를 잘 쓰는 법
- `description`에 **언제 쓰는지**를 쓴다 (Skills의 description과 같은 원리)
- 인자는 적을수록 정확해진다
- enum으로 선택지를 좁혀주면 오호출이 줄어든다

---

## MCP와의 관계
MCP 서버의 **Tools**가 결국 이 tool use 규격으로 모델에 전달된다.
직접 만들면 Tool Use, 표준으로 포장하면 MCP.

---
**출처 코스:** [[06 Claude API로 개발하기]]
**관련:** [[MCP (Model Context Protocol)]]

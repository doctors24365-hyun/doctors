---
type: concept
tags: [claude-academy, 개념]
---

# Claude 제품 지도
> [!tip] 한 문장
> 같은 모델을 **어떤 껍데기로 쓰느냐**의 차이. 일의 성격으로 고른다.

---

| 제품 | 무엇을 하나 | 이럴 때 |
|---|---|---|
| **Claude 앱/웹** | 대화형 작업, Projects, Artifacts | 글쓰기, 분석, 자료 정리 |
| **Claude Code** | 터미널에서 코드를 직접 읽고 수정 | 개발·리팩터링·버그 수정 |
| **Claude Cowork** | 코딩 아닌 다단계 업무를 위임 | 리서치→정리→산출물 |
| **Claude API / Platform** | 내 서비스에 Claude를 내장 | 제품 기능으로 탑재 |
| **Bedrock / Vertex AI** | 클라우드 사업자 경유 배포 | 데이터 경계 요구가 있을 때 |

---

## 선택 흐름
```
코드를 고쳐야 하나? ── 예 ──> Claude Code
      └ 아니오
여러 단계 · 오래 걸리는 업무인가? ── 예 ──> Cowork
      └ 아니오
내 서비스 안에서 자동으로 돌아야 하나? ── 예 ──> API
      └ 아니오 ──> Claude 앱
```

---
**출처 코스:** [[02 Claude Platform 101]]

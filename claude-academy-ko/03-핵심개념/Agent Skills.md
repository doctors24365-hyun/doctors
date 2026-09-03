---
type: concept
tags: [claude-academy, 개념, 개발]
---

# Agent Skills
> [!tip] 한 문장
> 반복 업무의 노하우를 **폴더 하나**로 포장해 Claude에게 영구히 가르치는 것.

---

## 구조
```
my-skill/
├── SKILL.md        ← 필수. 앞부분에 name + description
├── reference.md    ← 필요할 때만 읽히는 상세 자료
└── scripts/        ← 실행 가능한 스크립트
```

`SKILL.md` 상단:
```yaml
---
name: 원내-공지문-작성
description: 신사닥터스 직원/환자 공지문을 원내 톤과 형식에 맞게 작성할 때 사용.
---
```

---

## 핵심 원리 두 개

**1. description이 전부다.**
Claude는 평소엔 name+description만 본다. 여기에 **언제 써야 하는지**가 안 적혀 있으면 스킬은 영원히 호출되지 않는다.

**2. 점진적 로딩 (progressive disclosure)**
- 평소: description만 (수십 토큰)
- 관련 작업 등장: SKILL.md 본문 로드
- 더 필요하면: 참조 파일 로드

덕분에 스킬을 수십 개 깔아도 컨텍스트가 터지지 않는다.

---

## Skill로 만들 신호
- [ ] 같은 프롬프트를 **3번 이상** 붙여넣었다
- [ ] 결과물 형식이 매번 같아야 한다
- [ ] 팀원에게 "이렇게 시키면 돼" 라고 설명한 적 있다

---

## 내가 만들 것 (아이디어)
- `원내-공지문-작성` — 톤·금지어·심의 기준 내장
- `월간-운영리포트` — 데이터 넣으면 정해진 포맷으로
- `업무관리앱-컨벤션` — index.html/Supabase 코딩 규칙

---
**출처 코스:** [[09 Agent Skills 입문]]
**관련:** [[MCP (Model Context Protocol)]] · [[프롬프트 설계 기초]]

# Wave 115 — 자급제 동일 효과 표현 catalog 추가 ("정상해지/확정기변/노옵션")

> Status: **applied (code + production).** 사용자 지적: "자급제란 말 말고 다른 용어 쓰는지 description 분석하고 얘기하는거임? 자급제인 흔적 찾을 수 있지 않을까?" → production sample 측정 결과 다수 발견.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — broad SKU 매물 description에서 자급제 흔적 표현 측정

- 시간: 2026-05-15
- 발견: 7일 iPhone Pro broad 매물 181건 중 자급제 흔적 표현:
  - "정상해지": **10건** ⭐
  - "확정기변": (정상해지와 같이 명시되는 매물 다수)
  - "공기계": 3건 (이미 catalog)
  - "언락": 0건
  - "타통신사 가능", "유심 분리" 등: 1건 (긴 phrase, 단어 매칭 어려움)
- Sample 검증: "정상해지" 매물 다 진짜 자급제 효과:
  - "3사 유심 꽂아서 바로 사용가능"
  - "선택약정 가능" (새 약정 자유)
  - "확정기변 가능" (통신사 변경 자유)
  - "유심 꽂고 바로 쓰시면 됩니다"
- 변경: 측정만.
- 다음: catalog mustContain group 확장.

## 2. narrow lane 23개 self token group 확장

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** replace_all로 23 narrow lane 동시 수정:
  ```diff
  - ["자급제", "자급", "공기계", "언락"]
  + ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변"]
  ```
- 영향 SKU: iPhone 11/12/13/14/15/16 Pro 128/256/Pro Max 256 self, iPhone 15/16 256 self, iPhone Air 256/512 self, Galaxy S23/S24/S25 256 self, Galaxy S23/S24/S25 Ultra 256 self, Galaxy Z Flip 5/7 256 self.
- 위험: 매우 낮음. "정상해지"/"확정기변"은 약정 끝난 폰 명시 = 자급제와 동일 효과 (sample 100% 검증).

## 3. M2 narrow lane "노옵션" 추가 (사용자 지적)

- 시간: 2026-05-15
- 발견: 사용자 지적 — "기본형/노옵션 같은 말 있으면 제일 아래 옵션 (=8GB 기본)이라 생각하는 로직 있어야 될 듯"
- 변경: **macbook-air-m2-13-256** mustContain group 5에 "노옵션", "노 옵션" 추가:
  ```diff
  - ["8gb", "8 gb", "8기가", "8램", "8g", "기본형", "기본 모델", "깡통"]
  + ["8gb", "8 gb", "8기가", "8램", "8g", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"]
  ```
- 위험: 매우 낮음. "노옵션" 매물은 기본 옵션 (8GB/256GB) 의미.

## 4. 검증

- 시간: 2026-05-15
- 변경:
  - **139/139 test pass** (parts 분류 영향 X)
  - audit-precision-wave114.ts 37/39 (정책 의도 2 fail)
  - 수동 test 7/8 pass:
    - "갤럭시 S23 256 정상해지" → galaxy-s23-256-self ✓
    - "아이폰 14 프로 256 정상해지 풀박스" → iphone-14-pro-256-self ✓
    - "갤럭시 S23 울트라 256 확정기변" → galaxy-s23-ultra-256-self ✓
    - "아이폰 16 프로 256 정상해지 KT 약정" → null (통신사 reject) ✓
    - "맥북에어 M2 13 256 노옵션" → macbook-air-m2-13-256 ✓

## 5. Production reclassify 결과 — 14건 broad → narrow 흡수

- 시간: 2026-05-15
- 실행: scripts/reclassify-self-implied.ts (자급제 명시 X + 정상해지/확정기변 명시 122 매물 sweep)
- 결과:
  - galaxy-s24-ultra → 256-self: **4건**
  - galaxy-s25-ultra → 256-self: **3건**
  - iphone-15 → 256-self: 2건
  - galaxy-s25 → 256-self: 2건
  - iphone-15-pro → 128-self: 1건
  - galaxy-s25 → galaxy-s25-edge: 1건
  - galaxy-s24 → 256-self: 1건
  - **총 14건 narrow lane 추가 흡수**

## 6. 거론 금지

- 110건 후보 중 14건만 narrow — 나머지는 storage/통신사/다른 reject 이유. 정상.
- "유심 꽂고 바로 사용" / "3사 사용 가능" 같은 긴 phrase는 token 매칭 어려움. regex 필요 (별도 wave).
- "선택약정" — 약정 가입 자유 의미지만 단독 token은 약정폰과 헷갈림. 추가 X.

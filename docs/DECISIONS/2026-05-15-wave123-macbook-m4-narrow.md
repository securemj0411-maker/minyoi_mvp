# Wave 123 — MacBook Air M4 + Pro 14 M4 narrow lane

## 1. 진단
- 시간: 2026-05-15
- 발견 (14일 매물):
  - MacBook Air M4: 192건
  - MacBook Pro 14 M4: 121건
  - MacBook Pro 16 M3/M4: 321건
  - MacBook Pro M1: 211건
- 기존 narrow: M2/M3 13인치 256, Pro 14 M3 18/512만.

## 2. catalog 추가 (2 narrow)
- 시간: 2026-05-15
- 변경:
  - macbook-air-m4-13-256 (msrp 1,390k, 2025)
    - LAUNCH_PLAN 1.6e 정책: 16GB/기본형/깡통/노옵션 명시 강제 (M4 Air base는 16GB)
    - mustNotContain: M1/M2/M3, 15인치, 24GB/32GB, 512+, 8GB (M4 Air는 16GB base)
  - macbook-pro-14-m4-256 (msrp 2,390k, 2024)
    - 16GB 명시 강제. M4 Pro/Max 차단.
- LANE_READINESS 2개 ready 등록.

## 3. 검증
- 139/139 test pass.

## 4. 거론 금지
- MacBook Pro 16" narrow (M3/M4 321건) — owner decision (200만원 상한 정책 충돌, 매물 다수 1,890k+).
- MacBook Pro 14 M2 narrow (72건) — sample 보더라인.
- MacBook Air M1/M2 narrow 8GB base — M2는 이미 narrow, M1은 옛 모델.

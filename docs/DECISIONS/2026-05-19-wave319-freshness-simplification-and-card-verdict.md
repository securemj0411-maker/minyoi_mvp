# 2026-05-19 Wave 319 — 신선도 단순화 + 카드 매입가 verdict

사용자 피드백(2026-05-19, "그냥 몇시간 전 검증이 의미가 있나??") 기반 wave 318 일부 되돌리기 + 카드 리스트에 매입가 가이드 적용 (외부인 C).

## 결정

### 1. 신선도 stale 표시 단순화 (사용자 의견 반영)
- 사용자 의견: 매물 reveal 시점에 실시간 검증 1회 (`pack-open.ts:1361-1387` `verifyAndCheckSold`)가 일어남. 그래서 사용자 화면에 노출된 매물은 reveal 시 살아있던 매물. 시간 경과는 "사용자가 다시 안 들어와서" 생기는 표시 노이즈.
- Wave 318에서 박은 stale 배너 (헤드라인 위 노란/빨간 띠) 제거.
- `verificationDisplay()` 5단계 → 2단계 단순화:
  - 30분 이내 → "검증 완료" (good)
  - 그 이상 → "검증 완료 · 번개장터에서 한 번 더 확인 권장" (info)
- `tone === "warn"/"danger"` 분기 제거. `stale` 플래그 필드 제거.
- `freshLabel()` 표시 자체는 정보로 유지 (사용자 의견: "방금 전 검증이라고 하면 되는거 아니야?" — 단 진짜 백그라운드 재검증은 인프라 변경이라 별도 결정 대기).

### 2. 매입가 가이드 헬퍼 공유 lib 분리
- 신규 파일 `src/lib/buy-price-guidance.ts`. 
- 입력 `{ price, medianPrice }`로 일반화 → 모달(`pack-reveal-modal`)과 카드 리스트(`user-reveal-dashboard`, `admin-pool-browser`) 모두 같은 헬퍼 사용.
- 출력: `breakEven`, `targetBuy` (+18%), `passBuy` (+10% 임계), `currentMarginPct`, `verdict` (good/warn/danger), `verdictLabel`, `verdictSub`.
- 기존 `pack-reveal-modal` 내부 함수 제거 후 import로 교체.

### 3. 카드 리스트에 매입가 verdict 미니 칩 (외부인 C — 부분)
- `user-reveal-dashboard` 카드의 "차익" 라인 옆에 verdict 칩:
  - 18%+ 마진 → 초록 "{N}% 마진 확보"
  - 10~18% → amber "{N}% 마진 낮음"
  - <10% → rose "{N}% 마진 — 패스 권장" / "손익분기 미달"
- title 속성에 추천/패스 가격 노출.
- `admin-pool-browser` 카드 메타 줄에도 동일 칩 추가 — 운영자 풀에서 빠른 의사결정.
- `isTerminal` (판매완료 처리된 매물)에는 표시 안 함.

### 4. 운영자 풀 stale 배지 유지 (wave 318)
- 운영자는 stale 매물 식별이 본 업무 → 6h/24h 임계 stale 배지 그대로.
- 사용자 화면 신선도 단순화와 분리.

## 거절 — 외부인 피드백 중

### "거래 결과 입력 + 개인 ROI 대시보드" (외부인 wave 2 1순위)
- 사용자 의견 (2026-05-19): "거래 결과는 너무 믿을 수 없어서 안됨".
- 이유: 사용자 직접 입력한 실 매입가/실 판매가/실 회수일은 가짜/실수/주관적 → 학습 데이터로 못 씀.
- 결정: ROI 대시보드 후보 영구 거절. `mvp_reveal_feedback` 의 `feedback_type` enum (`listed`/`resold`)은 단순 상태 추적에 한정. 가격 컬럼 추가 안 함.
- 사회적 증명("이번 달 N명 평균 +Y원 실현") 후보도 의존성 따라 영구 거절.

## 보류 — 사용자 논의 필요

### A. 판매 단계 도우미 — 사용자 OK
- 사용자 OK했으나 LLM 호출 vs 정적 템플릿, UX 깊이 결정 필요.
- 정적 템플릿(제목/사진 가이드/추천 호가 — SKU별 정적 룰) 부터 시작 권장. LLM은 비용/모더레이션 책임.
- 별도 wave에서 진행.

### B. 카테고리별 가품 체크리스트 — 사용자 OK
- 사용자 의견: "에어팟이 문제가 아니라 우리 카테고리 한번봐바 가품 체크할거 존나많음".
- 카탈로그 분포(558 SKU, 20 카테고리) 분석 별도 보고 — 가품 위험도별 그룹화 + 카테고리별 체크리스트 3~5개 후보.
- 시작 후보: 가품 매우 높음 카테고리(shoe 115 / smartphone 87 / earphone 36 / bag 25 / watch 5 / perfume 22) 우선.
- 별도 wave 검토.

### C. 카드 리스트 신선도/회수 속도 prop 확장
- 매입가 verdict는 이번 박음. 신선도는 사용자 의견상 단순화로 충분 (시간 표시 자체 빼는 방향), 회수 속도는 카드에 표시 자체가 없어 별도 결정.

### 인프라 변경
- /me 진입 시 백그라운드 재검증 (사용자 기대) — cron 외 매물 진입 시 ping. 비용/구현 결정 필요.
- 24h 매물 풀 자동 숨김 — 풀 알고리즘 변경.
- 자본/예산 관리 (DB+온보딩).
- 첫 거래 보호 모드 (welcome 로직 변경 + 풀 필터).

## 변경 파일

- 신규: `src/lib/buy-price-guidance.ts`.
- 수정: `src/components/pack-reveal-modal.tsx` (헬퍼 import 교체, verificationDisplay 단순화, stale 배너 제거).
- 수정: `src/components/user-reveal-dashboard.tsx` (헬퍼 import, 카드 차익 라인에 verdict 칩).
- 수정: `src/components/admin-pool-browser.tsx` (헬퍼 import, 카드 메타에 verdict 칩).

## 검증

- `tsc --noEmit` — 4개 파일 신규 에러 0.

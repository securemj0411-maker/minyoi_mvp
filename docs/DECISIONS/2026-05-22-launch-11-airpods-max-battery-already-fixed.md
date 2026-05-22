# 2026-05-22 — Launch CRITICAL #10: AirPods Max 카테고리 함정 (이미 처리됨)

## audit 발견
UX audit 가 짚음:
> AirPods Max (earphone) 카테고리 함정 잔존. earphone 제외라 AirPods Max 에 배터리
> 질문 안 뜸. 하지만 line 514의 batteryCheckAsk fallback 은 "배터리 효율 화면이
> 있는 기기면" 무지성 카피로 다른 earphone 매물에 노출 가능.

## 실제 상태 (직전 Wave 394.7.z fix 됨)
직전 사용자 짚음:
> "배터리 상태 물어보라는거 에어팟맥스도 배터리효율이 있나?? 너무 무지성 아닌가"

→ Wave 394.7.z 에서 fix:
- `BEGINNER_BATTERY_CHECK_CATEGORIES = {smartphone, tablet, smartwatch, laptop, drone, camera}`
  — **earphone 자체가 set 에서 제외** → AirPods Max 매물엔 배터리 step 안 뜸
- `batteryCheckAsk("earphone")` 분기 카피 정직화:
  > "이어폰/헤드폰은 배터리 효율 표시가 따로 없어요. 한 번 완충 후 실제 몇 시간
  >  들었는지 셀러에게 물어보세요. 페어링 화면, (모델에 충전 케이스가 있다면)
  >  케이스 상태도 함께."
- fallback 카피도 정직화:
  > "배터리 효율 화면이 있는 기기면 캡처를 받고, 없으면 실제 사용 시간을 셀러에게
  >  직접 물어보세요."

## audit 와 실제 코드 diff
- audit = launch 직전 시점 캡처. 단 직전 wave 작업으로 이미 처리된 항목 재기록.
- audit agent 가 .env.local 못 봐서 #2 false positive 냈던 패턴과 동일.

## 추가 액션
없음. 코드 변경 X.

## 검증
- `grep "BEGINNER_BATTERY_CHECK_CATEGORIES" src/components/pack-reveal-modal.tsx`
  → earphone 제외 확인 (line 376)
- `batteryCheckAsk("earphone")` 카피 정직 확인 (line 425+)

## 교훈 (audit 룰 보강)
직전 wave 작업 (특히 같은 영역) 와 audit 시점 mismatch 시 false positive 발생.
audit 결과 받으면 docs/DECISIONS 의 최근 wave 도 같이 확인.

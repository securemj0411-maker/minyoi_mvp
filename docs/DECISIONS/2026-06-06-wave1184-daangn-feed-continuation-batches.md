# 2026-06-06 Wave 1184: 당근 피드 continuation 배치화

## 결정
- 동작구 사당동 기준 `15만원 이하 + 당근 + 가까운 순` 조건을 DB 기준으로 재현했다.
- raw active/done 후보는 많지만 실제 사용자 피드는 `ready + 당근 source 시세 표본 + 실수익 재계산 + 거리`를 다시 통과해야 한다.
- 해당 조건에서 최종 노출 가능한 후보가 6개보다 많게 확인되어, 초기 6개만 보이는 상태는 데이터 부족보다는 continuation/snapshot 경로 병목으로 판단했다.

## 구현
- 당근 배경 continuation 요청 크기를 `500`에서 `30`으로 낮췄다.
- 한 번의 무거운 요청이 실패하거나 오래 걸려 초기 6개만 남는 흐름을 줄이기 위해, 30개 배치가 꽉 차면 다음 배치를 자동으로 이어서 요청하도록 했다.
- append 직후 `itemsRef`를 즉시 갱신해 다음 continuation이 이미 붙은 매물을 정확히 제외하도록 했다.
- silent continuation 실패 시 재시도 가능하도록 `initialRemainderRequestedRef`를 되돌린다.

## 보류
- feed snapshot 자체의 TTL/부분 snapshot 저장 정책은 유지했다. 별도 wave에서 “partial snapshot은 speed hint로만 쓰고 full snapshot과 분리”하는 구조를 검토할 수 있다.
- 카테고리 필터가 켜졌을 때 숨겨진 후보 수를 UI에 보여주는 진단 뱃지는 아직 추가하지 않았다.

# 2026-06-04 Wave 1097 - Plans Social Proof / Light Pass

## 결정

- plans 사회적 증명 토스트에서 이름 없는 DB row가 항상 `이**님`으로 보이던 fallback을 제거했다.
- 이름/이메일 seed를 기반으로 다양한 성씨를 안정적으로 고르도록 바꿨다.
- 오래된 DB row를 `59분 전`으로 clamp하지 않고 제외한다. 최근 2~58분 안의 실제 row만 쓰고, 나머지는 fallback pool이 자연스럽게 채운다.
- 멤버십 패스 패널은 라이트 모드에서 검정 배경 고정이 아니라 밝은 배경/텍스트로 보이게 조정했다.

## 보류

- 토스트 이벤트 DB 별도 테이블은 만들지 않았다. 현재는 최근 membership application row + fallback pool 조합을 유지한다.

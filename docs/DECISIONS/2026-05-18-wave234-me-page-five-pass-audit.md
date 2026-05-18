# 2026-05-18 Wave 234 — /me 페이지 5회전 전수 점검

## 배경

사용자 요청: `/me` 페이지를 넓게 반복 점검해 남은 괴리/버그를 잡는다.

## 5회전 점검 결과

1. 컴포넌트 흐름: `PACK_REVEALS_UPDATED_EVENT` 직후 낙관적 목록은 갱신되지만 서버 메타(`total`, `totalPages`)가 다음 수동 새로고침 전까지 낡을 수 있었다.
2. API 계약: `/api/packs/me`는 `mvp_listing_parsed`를 쓰는데 `/api/packs/reveals/detail`만 옛 테이블명 `mvp_parsed_listings`를 보고 있었다. 상품 보기 모달의 lazy 시세/회전 분석이 실패할 수 있는 드리프트.
3. 판매완료/tombstone: 실시간 검증과 pool invalidation write-through는 유지. 다만 현재 순차익 0원은 여전히 정상 카드로 남을 수 있어 사용자 기준과 불일치했다.
4. UX/문구: 사용자 모달에 개발자용 `MarketSourceDebug` 패널이 남아 있었다. `/me`와 모달의 일부 텍스트 이모지도 이전 요청의 "담백한 UI" 방향과 맞지 않았다.
5. 그래프: 다나와 reference label이 차트 상단에서 답답하게 붙어 보일 수 있어 chart viewBox/padding을 조정했다.

## 반영

- pack reveal 이벤트 후 `/me`를 `page=1&q=&sort=latest`로 silent reload 하도록 고정했다.
- 이벤트 리스너는 ref로 최신 `loadItems`를 참조하게 해서 highlight timer가 query/sort 변경 때 조기 clear되지 않게 했다.
- detail analysis route의 parsed table을 `mvp_listing_parsed`로 통일했다.
- 현재 순차익 `<= 0`은 `/me` API sync와 프론트 표시 모두 판매완료 tombstone 기준으로 접는다.
- `PackRevealModal`에서 `MarketSourceDebug`를 제거했다. 디버그 비교는 사용자 상품 보기에서 노출하지 않는다.
- `/me` 주변 CTA/피드백/모달 라벨의 이모지성 문구를 일부 제거했다.
- `me-page-contract.test.ts`를 추가해 핵심 계약을 회귀 테스트로 잠갔다.
- 전체 테스트 중 기존 `wave159h-condition-fallback` 테스트가 Wave 193 정책(default `minSamples=1`)과 충돌해 실패했다. fallback 동작 검증 의도를 보존하도록 해당 테스트만 `minSamples=3`을 명시했다.

## 보류

- 실제 사용자 데이터에서 특정 pid별 history chart 품질 검증은 브라우저/로그인 세션에 의존하므로 이번 wave에서는 빌드·테스트·로컬 UI smoke로 확인한다.
- `MarketSourceDebug` 자체는 admin/debug 화면에서 아직 필요하므로 컴포넌트 파일은 삭제하지 않는다.

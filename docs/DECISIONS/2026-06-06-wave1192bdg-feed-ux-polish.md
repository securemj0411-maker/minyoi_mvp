# Wave 1192b/d/g — 피드 UX 마무리 (첫화면 / empty 가드 / floating 위치)

날짜: 2026-06-06
관련: Wave 1192 (무한스크롤), 1192e (RPC), 1192f (확장 버튼)

오늘 피드 로딩 근본 작업(1192~1192f) 중 발견한 UX 버그 3개를 별도 commit 으로 박음. decision log 누락분 보강.

## Wave 1192b — 첫 화면 6 → 24 (점프 제거) · commit 51798160

owner: 무한스크롤 후 "막 바뀜" — 6개 떴다 갑자기 늘어나 어수선.
원인: `INITIAL_FEED_PAGE_SIZE 6` → remainder 교체 시 visibleCount(24)만큼 점프.
fix: 6 → 24 (STEP 과 일치). 처음부터 24개 안정, remainder 는 화면 안 바꾸고 뒤에 쌓임.

## Wave 1192d — "매물 없어요" 로딩 중 깜빡 fix · commit fbd83728

owner: "매물 없어요" 라고 해놓고 몇 초 뒤 갑자기 빡 나타남.
원인: 로딩 스켈레톤 조건이 `loading && items.length === 0`. quick 응답 와서
  loading=false 됐지만 remainder 대기 중일 때 items 0 이면 → 바로 "없어요" empty.
fix: `items.length === 0 && (loading || continuationLoading || refreshing ||
  feedState?.shouldRequestContinuation === true)` → 더 불러올 게 있으면 스켈레톤 유지.
  진짜 다 불러왔는데 0개일 때만 empty.

## Wave 1192g — 모바일 고객센터 floating 우하단으로 · commit ac2fd709

owner: 모바일 floating 고객센터가 화면 중간(~30% 위)에 붕 떠있음. 우하단에 붙어야.
원인: `site-help-faq.tsx` 의 `bottom-[88px]` — 피할 하단 탭바도 없는데(AppNav는 상단 top-0)
  박혀있던 잔재값.
fix: `bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]` → 우하단 딱.
  home indicator 만 safe-area 로 피함. 데스크탑 `sm:bottom-5` 유지. 고객센터 자체는 유지.

## 1192c (revert 됨, 참고)

quick page 가 근처 96 region 한 번에 보게(batch 4→전체) + budget 2.8s 시도했으나,
첫 로딩이 2.8초로 느려지고 그동안 "없어요" 노출 → owner 피드백으로 revert (afb2fc5b).
대신 근본은 1192e (candidate_pool RPC) 로 해결.

## TS check
각 commit src/ 0 error.

## Sign-off
1192~1192g 피드 로딩/UX 작업 마무리. decision log 누락분 보강 완료.

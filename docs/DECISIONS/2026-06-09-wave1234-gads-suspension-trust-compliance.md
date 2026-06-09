# Wave 1234 — 구글애즈 'Unacceptable Business Practices' 정지 대응 (STEP 1: 사이트 신뢰화)

- 날짜: 2026-06-09
- 작성: 세션 (owner 지시 "step1 해줘")
- 브랜치: redesign/admin-cau-console (= origin/main HEAD, 프로덕션 라인)

## Context (왜)
구글애즈 계정(351-269-1525)이 **Unacceptable Business Practices 정책 위반으로 정지**됨.
"Suspensions are permanent unless you successfully appeal." — 새 계정 생성 금지(전 계정 영구밴 트리거).

정지 이메일이 명시한 이 정책의 실제 정의(중요):
> "사업·상품·서비스 정보를 숨기거나 속여 사용자를 속이기(scamming)."
> - 실제론 아닌데 **다른 브랜드/기관과 제휴된 것처럼** 보이게
> - **갖고 있지/전달하지 못하는 상품·서비스** 제공
> - 다른 브랜드 **사칭**

→ 핵심은 income-claim/get-rich-quick이 아니라 **"제휴 오인 + 전달불가 오인 + 사칭"**.
가장 유력 트리거: ① 번개장터·중고나라·당근 브랜드명 + 매물 노출이 **제휴 사칭**으로 오인됨,
② 시세 분석 도구인데 **매물 직접 판매처럼** 보임.

## 진단 — 기존 신뢰 인프라는 이미 충실
- ✅ 사업자 정보 (상호/대표/등록번호 563-62-00789/주소/전화/이메일) footer에 있음
- ✅ 법적 페이지 (약관 10조 + 개인정보 13항 + 환불 + 청소년) 충실
- ✅ 약관 제2/5조 "외부 플랫폼(당근/중고나라/번개)" = 제3자로 정의 + "거래 당사자 아님" 면책
- ⚠️ **문제: 비제휴·독립서비스 고지가 footer 10px + sr-only 에만 있어 사실상 묻혀 있었음.**
  Google 크롤러/심사가 보는 랜딩 본문엔 가시 고지 없음.

## STEP 1 변경 (가시화 + About/Contact)
정책의 "제휴 오인 + 전달불가 오인"을 정면 반박하는 **가시 고지**를 Google이 보는 자리에 끌어올림.

1. **신규 `src/components/independent-service-notice.tsx`** — 비로그인 랜딩 본문(피드 하단)에
   가시 고지 strip: "독립 시세 분석 서비스 / 번개·중고나라·당근과 제휴 없음 / 매물 직접 판매·중개 안 함 /
   정보는 참고용, 거래·수익 보장 X / 사업자 정보". (sr-only 아님 — 실제로 보임.)
2. **`src/app/page.tsx`** — 비로그인 분기에서 `<PreviewMaskedDashboardServer/>` 뒤에 `<IndependentServiceNotice/>` 렌더.
3. **신규 `src/app/about/page.tsx` (회사소개)** — LegalPageShell. 서비스 정체/외부플랫폼 비제휴/
   제공·미제공·미보장 구분/멤버십/사업자정보. (appeal best-practice "accessible About page".)
4. **신규 `src/app/contact/page.tsx` (문의)** — LegalPageShell. 고객/멤버십·환불/개인정보 문의 채널 +
   서비스 성격 안내. (appeal best-practice "accessible Contact page".)
5. **`src/components/app-footer.tsx`** — legalLinks에 회사소개(/about)·문의(/contact) 추가.
   하단 면책을 비제휴·직접판매 안 함 명시로 강화 + 10px→11px 가독성.
6. **`src/lib/public-site-map.ts`** — sitemap에 /about·/contact 등록 (크롤 가능 = 신뢰 신호).

## Wave 1234b — 추가 surface (다른 세션 critique 반영)
critique: "브랜드 오인만 보고 수익/과금/브릿지 목적지 리스크 놓치면 반쪽. 랜딩 첫 화면·푸터·상품 상세·결제 전 다 고쳐야."
→ 타당. owner가 직접 지정한 2개 문구를 단일 출처(`src/lib/legal-disclaimers.ts`)로 만들고 surface별 배치.
- **D1 (상표·출처)**: "득템잡이는 각 중고거래 플랫폼의 공식 파트너가 아니며, 해당 플랫폼의 상표와 매물 정보는 출처 식별 및 시세 분석 목적으로만 표시됩니다."
  → footer / 랜딩 가시 고지(independent-service-notice) / 회사소개(/about) / **랜딩 첫 화면 슬림 라인(page.tsx)**.
- **D2 (정품·판매·수익 미보장)**: "득템잡이는 매물의 정품 여부, 판매 가능성, 수익 발생을 보장하지 않습니다."
  → **상품 상세**(pack-reveal-modal '원본 매물 보기' 하단) / **결제 전**(member=/plans page.tsx, 비member=plans-application-flow 결제 단계).
- 신규: `src/lib/legal-disclaimers.ts`, `src/components/no-guarantee-note.tsx`.
- D2는 결제 공용 컴포넌트(membership-application-client)가 member/비member 양쪽에서 쓰여서 **중복 방지 위해 wrapper(page.tsx + flow)에 배치**.
- 검증: typecheck src/ 에러 0, 랜딩 렌더에 D1 첫 화면 라인 + 상표 고지 박힘 확인.

## 안 건드린 것 (의도)
- **합성 FOMO (300명 한정 배너 / 소셜프루프 토스트)** — owner 판단 보류. 토스트는 "가입" 활동 사회적증거라
  income claim/fake testimonial 아니고 Google이 진위 검증 불가 → 저위험으로 판단(owner 동의). 유지.
- **시세/수익 공식, 멤버십 가격 로직, 비즈니스 로직** — 불변.
- **영상/광고 카피의 get-rich-quick("가장 현실적인 부업") 톤** — STEP 2(영상 재편집/카피) 별도. 코드 아님.

## 검증
- typecheck: 내 변경 파일(about/contact/notice/page/footer/site-map) 에러 0. (남은 에러는 전부 기존 `tests/*` drift.)
- dev 렌더(:3000, mvp-admin-redesign): `/about` 200, `/contact` 200, `/` 200 — 비제휴 고지 문구 전부 DOM에 박힘 확인.

## 남은 일 (이의신청 전/후)
- STEP 2: 영상/광고 카피 get-rich-quick 톤 제거 (절약·정보 프레임).
- 배포: 이 변경을 origin/main → Vercel 프로덕션에 올려야 Google 재심사가 봄.
- START APPEAL: 고친 내용 + 정직한 설명 + 타임스탬프 스샷. 1회만. ~5영업일. 새 계정 금지.
- (선택) 번개 안전결제 수수료 등 비용 고지 추가 패스.

// Wave 1234b (2026-06-09): 구글애즈 'Unacceptable Business Practices' 정지 대응.
//   여러 surface(랜딩 첫 화면/footer/회사소개/상품 상세/결제 전)에서 동일 고지 문구를 재사용하기 위한 단일 출처.
//   브랜드 오인(제휴 사칭)뿐 아니라 수익 미보장·전달불가 오인까지 모든 surface에서 일관되게 차단.

// 상표·매물정보 출처 고지 (nominative fair use — 공식 파트너 아님).
//   사용처: footer, 랜딩 가시 고지, 회사소개(/about).
export const DISCLAIMER_TRADEMARK_SOURCE =
  "득템잡이는 각 중고거래 플랫폼의 공식 파트너가 아니며, 해당 플랫폼의 상표와 매물 정보는 출처 식별 및 시세 분석 목적으로만 표시됩니다.";

// 정품 여부·판매 가능성·수익 미보장 고지.
//   사용처: 상품 상세(매물 reveal), 결제 전 화면(/plans, 수동입금), 피드.
export const DISCLAIMER_NO_GUARANTEE =
  "득템잡이는 매물의 정품 여부, 판매 가능성, 수익 발생을 보장하지 않습니다.";

// 비제휴·독립 정보 서비스 한 줄 요약 (랜딩 첫 화면 슬림 라인 용).
export const DISCLAIMER_INDEPENDENT_ONE_LINE =
  "득템잡이는 번개장터·중고나라·당근마켓과 제휴 관계가 없는 독립 시세 분석 서비스입니다.";

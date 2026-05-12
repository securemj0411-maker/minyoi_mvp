import LegalPageShell from "@/components/legal-page-shell";

const sections = [
  {
    heading: "1. 기본 원칙",
    body: [
      "미뇨이는 현재 MVP 단계의 추천/모니터링 서비스이며, 실제 결제와 환불 조건은 향후 정식 운영 정책에 따라 확정됩니다.",
      "본 페이지는 환불정책 구조 검토용 mock 문서로, 실제 운영 전 전자상거래 및 소비자보호 기준에 맞춰 최종 문안으로 교체됩니다.",
    ],
  },
  {
    heading: "2. 크레딧 환불 기준",
    body: [
      "서비스 내 오류, 검증 실패, 중대한 데이터 누락 등 회사 책임 사유가 확인되는 경우 사용한 크레딧은 환불 또는 복구될 수 있습니다.",
      "정상적으로 제공된 추천 열람 이후 단순 변심, 외부 거래 실패, 기대 수익 미달만으로는 즉시 환불 대상이 되지 않을 수 있습니다.",
    ],
  },
  {
    heading: "3. 구독 환불 기준",
    body: [
      "정기결제가 도입될 경우 결제일, 사용량, 이미 제공된 서비스 범위에 따라 환불 가능 여부가 달라질 수 있습니다.",
      "정확한 구독 환불 조건은 실제 유료 플랜 출시 전 별도 공지 및 약관에 반영됩니다.",
    ],
  },
  {
    heading: "4. 문의 및 처리",
    body: [
      "환불 또는 복구 요청은 help@minyoi.kr로 접수할 수 있습니다.",
      "회사는 접수 순서와 사유 확인 절차에 따라 최대한 빠르게 처리 결과를 안내합니다.",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="환불정책"
      title="미뇨이 환불정책"
      updatedAt="2026.05.12"
      sections={sections}
    />
  );
}

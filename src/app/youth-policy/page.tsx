import LegalPageShell from "@/components/legal-page-shell";

const sections = [
  {
    heading: "1. 청소년 보호 원칙",
    body: [
      "회사는 청소년이 유해한 정보에 노출되지 않도록 관련 법령과 내부 기준에 따라 서비스를 운영합니다.",
      "서비스 내 노출 정보, 공지, 문의 응대 과정에서 청소년 보호를 고려한 운영 원칙을 유지합니다.",
    ],
  },
  {
    heading: "2. 유해 정보 차단",
    body: [
      "회사는 서비스 목적과 무관한 불법·유해 정보, 사행성 조장 정보, 청소년에게 부적절한 콘텐츠가 발견될 경우 노출 제한 또는 삭제 조치를 할 수 있습니다.",
      "이용자는 해당 정보 발견 시 고객센터를 통해 신고할 수 있습니다.",
    ],
  },
  {
    heading: "3. 보호 책임자",
    body: [
      "청소년 보호 책임자: 이민제",
      "이메일: help@minyoi.kr",
      "운영시간: 평일 10:00 - 18:00",
    ],
  },
  {
    heading: "4. 고지 및 개정",
    body: [
      "본 청소년보호정책은 서비스 운영 정책 변경 또는 관련 법령 개정에 따라 수정될 수 있습니다.",
      "중요 변경 사항은 서비스 내 공지 또는 별도 안내를 통해 고지합니다.",
    ],
  },
];

export default function YouthPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="청소년보호정책"
      title="미뇨이 청소년보호정책"
      updatedAt="2026.05.12"
      sections={sections}
    />
  );
}

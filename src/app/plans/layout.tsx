// Wave 1037: /plans 는 결제 페이지가 아니라 300명 한정 멤버십 신청 페이지.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "멤버십 신청 · 300명 한정",
  description: "득템잡이 300명 한정 멤버십 신청 페이지입니다. 승인된 계정은 추천 피드와 상세 리포트를 이용할 수 있습니다.",
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}

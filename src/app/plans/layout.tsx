// Wave 106: /plans 는 client component 라 metadata 별도 layout 에서.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "요금제",
  description: "득템잡이 요금제 — Free 5크레딧 / Starter 9,900원 / Plus 19,900원 / Pro 39,900원 (핫딜 알림 전용). 베타 기간 mock 결제로 운영, 실제 청구 X.",
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}

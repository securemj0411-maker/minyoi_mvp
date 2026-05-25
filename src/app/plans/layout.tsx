// Wave 106: /plans 는 client component 라 metadata 별도 layout 에서.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "크레딧 충전",
  description: "득템잡이 크레딧 충전 — 690원 1크레딧 / 2,900원 5크레딧 / 9,900원 20크레딧 / 19,900원 45크레딧 / 49,900원 130크레딧. 자동 갱신 없는 단건 결제 방식입니다.",
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}

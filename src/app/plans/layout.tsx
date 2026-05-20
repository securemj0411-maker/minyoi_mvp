// Wave 106: /plans 는 client component 라 metadata 별도 layout 에서.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "크레딧 충전",
  description: "득템잡이 크레딧 충전 — 3,900원 20크레딧 / 19,900원 200크레딧 / 39,900원 500크레딧. 자동 갱신 없는 단건 결제 방식입니다.",
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}

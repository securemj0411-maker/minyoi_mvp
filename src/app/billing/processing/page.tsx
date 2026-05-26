// Wave 775 (2026-05-27): mock PG processing 페이지.
//   manual-deposit page 의 "토스 앱으로 송금하기" 클릭 → 이 페이지로 navigate.
//   페이지 로드 시 토스 deep link 자동 호출 + "결제 처리 중" UI + 입금 확인 버튼.
//   카톡 닉네임 자동 (displayNameForUser) — 사용자 입금자명 input 불필요.

import { Suspense } from "react";
import ProcessingClient from "./processing-client";

export const dynamic = "force-dynamic";

export default function ProcessingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f7fb] dark:bg-zinc-950" />}>
      <ProcessingClient />
    </Suspense>
  );
}

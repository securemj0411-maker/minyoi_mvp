// Wave 1225: 수동 입금 승인 라우트 — 기존 고아(manual-deposit-panel, 어디에도 미마운트)를 nav 도달 가능하게.
//   thin wrapper(pool/page.tsx 패턴). 패널 내부 테마/배지 정리는 후속 단계.

import ManualDepositPanel from "../manual-deposit-panel";
import { SectionHeader } from "../_ui/primitives";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ManualDepositPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-6">
      <SectionHeader
        eyebrow="▌수동 입금 승인"
        title="수동 충전 신청 처리"
        caption="입금 확인 요청을 승인/거절합니다. 텔레그램 외에 이 화면에서도 처리할 수 있어요."
      />
      <ManualDepositPanel />
    </main>
  );
}

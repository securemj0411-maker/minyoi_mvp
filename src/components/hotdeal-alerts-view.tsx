"use client";

import { useEffect, useState } from "react";
import HotdealReservations from "@/components/hotdeal-reservations";
import { FlameIcon } from "@/components/icons";
import TelegramConnectPanel from "@/components/telegram-connect-panel";

// Wave 93b: 핫딜/실시간 매물 알림 메뉴 view (텔레그램 연동 + 활성 reservation 카드).

export default function HotdealAlertsView() {
  // URL ?pid=123 → 핫딜 deep link로 들어왔을 때 해당 매물 카드 강조.
  const [initialPid, setInitialPid] = useState<number | null>(null);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("pid");
    if (v) {
      const n = Number(v);
      if (Number.isFinite(n)) setInitialPid(n);
    }
  }, []);

  return (
    <section className="px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-blue-400">
            New Listing Alerts
          </p>
          <h2 className="mt-2 flex items-center gap-3 text-2xl font-black tracking-tight text-[#223127] dark:text-white sm:text-3xl">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-200 text-orange-600 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300">
              <FlameIcon className="h-6 w-6" />
            </span>
            새매물 알림
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
            내 동네에 차익 나는 새 매물이 잡히면 텔레그램으로 알려드려요.
            같은 매물을 반복해서 보내지 않도록 중복 알림은 줄입니다.
          </p>
        </header>

        <TelegramConnectPanel />

        {initialPid != null ? (
          <div>
            <div className="mb-3 text-sm font-black text-[#223127] dark:text-zinc-100">알림 매물 확인</div>
            <HotdealReservations initialPid={initialPid} />
          </div>
        ) : null}

        <details className="rounded-2xl border border-[#e2d9cb] bg-[#fffbf4] p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <summary className="cursor-pointer text-sm font-black text-[#223127] dark:text-zinc-100">알림 기준</summary>
          <ol className="mt-3 space-y-2 text-xs font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
            <li><strong>1.</strong> 텔레그램 봇 연결 (위에서)</li>
            <li><strong>2.</strong> 내 동네 기준으로 새로 잡힌 차익 후보를 확인</li>
            <li><strong>3.</strong> 같은 매물을 반복 발송하지 않도록 중복 알림을 줄임</li>
            <li><strong>4.</strong> 알림 링크로 들어오면 해당 알림 매물을 확인</li>
          </ol>
        </details>
      </div>
    </section>
  );
}

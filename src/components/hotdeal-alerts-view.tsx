"use client";

import { FlameIcon } from "@/components/icons";
import TelegramConnectPanel from "@/components/telegram-connect-panel";

// Wave 93a: 핫딜 알림 메뉴 view.
// 현재는 텔레그램 연동만. 후속 wave에서 알림 통계, 받은 핫딜 기록, 응답률 등 추가.

export default function HotdealAlertsView() {
  return (
    <section className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
            Hot Deal Alerts
          </p>
          <h2 className="mt-2 flex items-center gap-3 text-2xl font-black tracking-tight text-[#223127] dark:text-white sm:text-3xl">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-200 text-orange-600 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300">
              <FlameIcon className="h-6 w-6" />
            </span>
            핫딜 알림
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
            큰 차익이 나는 매물이 풀에 들어오면 텔레그램으로 즉시 알려드려요.
            한 매물은 한 사람에게만 일정 시간 reserve되니까, 알림 받으면 빠르게 확인하세요.
          </p>
        </header>

        <TelegramConnectPanel />

        <div className="rounded-2xl border border-[#e2d9cb] bg-[#fffbf4] p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-black text-[#223127] dark:text-zinc-100">동작 방식</div>
          <ol className="mt-3 space-y-2 text-xs font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
            <li><strong>1.</strong> 텔레그램 봇 연결 (위에서)</li>
            <li><strong>2.</strong> 핫딜 매물 발견 시 가중치 랜덤으로 1명에게 알림</li>
            <li><strong>3.</strong> 알림 받으면 정해진 시간 안에 미뇨이 사이트에서 매물 확인</li>
            <li><strong>4.</strong> 시간 안에 응답 안 하면 다른 사용자에게 기회</li>
            <li><strong>5.</strong> 거래 후 "샀어요/포기" 응답으로 정확도 향상에 기여</li>
          </ol>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs font-bold leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          현재 Wave 93a — 텔레그램 연동만 가능. 핫딜 큐 + 알림 발송 기능은 곧 추가됩니다.
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

export type PlansSocialProofEvent = {
  id: string;
  label: string;
  minutesAgo: number;
  kind: "approved" | "seat_check" | "reserved";
};

const FALLBACK_EVENTS: PlansSocialProofEvent[] = [
  { id: "fallback-1", label: "이**님", minutesAgo: 9, kind: "seat_check" },
  { id: "fallback-2", label: "김**님", minutesAgo: 14, kind: "reserved" },
  { id: "fallback-3", label: "박**님", minutesAgo: 21, kind: "seat_check" },
  { id: "fallback-4", label: "최**님", minutesAgo: 27, kind: "reserved" },
  { id: "fallback-5", label: "정**님", minutesAgo: 36, kind: "seat_check" },
];

function proofCopy(event: PlansSocialProofEvent) {
  if (event.kind === "approved") {
    return `${event.label}이 ${event.minutesAgo}분 전에 멤버십 가입을 완료했습니다.`;
  }
  if (event.kind === "reserved") {
    return `${event.label}이 ${event.minutesAgo}분 전에 멤버십 자리를 예약했습니다.`;
  }
  return `${event.label}이 ${event.minutesAgo}분 전에 내 지역 티오를 확인했습니다.`;
}

export default function PlansSocialProofToasts({ events }: { events: PlansSocialProofEvent[] }) {
  const queue = useMemo(() => {
    const merged = [...events, ...FALLBACK_EVENTS];
    return merged.slice(0, Math.max(3, Math.min(8, merged.length)));
  }, [events]);
  const [index, setIndex] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (queue.length === 0) return;
    const timers: number[] = [];
    const showNext = () => {
      setIndex((prev) => (prev + 1) % queue.length);
      setVisible(true);
      timers.push(window.setTimeout(() => setVisible(false), 5200));
    };

    timers.push(window.setTimeout(showNext, 5500));
    const interval = window.setInterval(showNext, 200_000);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
    };
  }, [queue]);

  const event = index >= 0 ? queue[index] : null;
  if (!event) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-4 left-3 right-3 z-[80] mx-auto max-w-[420px] transition duration-300 sm:left-auto sm:right-5 sm:mx-0 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"
      }`}
    >
      <div className="rounded-2xl border border-blue-100 bg-white/96 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur dark:border-blue-900/60 dark:bg-zinc-900/96">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[15px] font-black text-[#3182f6] dark:bg-blue-950/50 dark:text-blue-200">
            ✓
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-black text-zinc-950 dark:text-zinc-50">
              {proofCopy(event)}
            </div>
            <div className="mt-0.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              선공개 300명 멤버십 · 지역별 티오 확인 중
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

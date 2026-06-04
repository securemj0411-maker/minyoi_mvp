"use client";

import { useEffect, useMemo, useState } from "react";

export type PlansSocialProofEvent = {
  id: string;
  label: string;
  minutesAgo: number;
  kind: "approved" | "seat_check" | "reserved";
};

const FALLBACK_SURNAMES = [
  "김",
  "이",
  "박",
  "최",
  "정",
  "강",
  "조",
  "윤",
  "장",
  "임",
  "한",
  "오",
  "서",
  "신",
  "권",
  "황",
  "안",
  "송",
  "전",
  "홍",
  "유",
  "고",
  "문",
  "양",
  "손",
  "배",
  "백",
  "허",
  "남",
  "심",
  "노",
  "하",
  "곽",
  "성",
  "차",
  "주",
  "우",
  "구",
  "민",
  "류",
  "나",
  "진",
  "지",
  "엄",
  "채",
  "원",
  "천",
  "방",
  "공",
  "현",
];

const FALLBACK_MINUTES = [
  4, 7, 9, 12, 14, 16, 18, 21, 24, 27, 29, 31, 34, 36, 39, 42, 44, 47, 51, 56,
];

function buildFallbackEvents(): PlansSocialProofEvent[] {
  return FALLBACK_SURNAMES.map((surname, index) => {
    const minute = FALLBACK_MINUTES[index % FALLBACK_MINUTES.length];
    const kind: PlansSocialProofEvent["kind"] =
      index % 4 === 0
        ? "approved"
        : index % 5 === 0
          ? "reserved"
          : index % 3 === 0
            ? "seat_check"
            : "reserved";
    return {
      id: `fallback-${index + 1}`,
      label: `${surname}**님`,
      minutesAgo: minute,
      kind,
    };
  });
}

const FALLBACK_EVENTS = buildFallbackEvents();

function proofCopy(event: PlansSocialProofEvent) {
  if (event.kind === "approved") {
    return `${event.label}이 ${event.minutesAgo}분 전에 멤버십 가입을 완료했습니다.`;
  }
  if (event.kind === "reserved") {
    return `${event.label}이 ${event.minutesAgo}분 전에 멤버십 자리를 예약했습니다.`;
  }
  return `${event.label}이 ${event.minutesAgo}분 전에 내 지역 티오를 확인했습니다.`;
}

export default function PlansSocialProofToasts({
  events,
}: {
  events: PlansSocialProofEvent[];
}) {
  const queue = useMemo(() => {
    const merged = [...events, ...FALLBACK_EVENTS];
    return merged.slice(0, Math.max(12, Math.min(32, merged.length)));
  }, [events]);
  const [index, setIndex] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (queue.length === 0) return;
    const timers: number[] = [];
    const showNext = () => {
      setIndex((prev) => (prev + 1) % queue.length);
      setVisible(true);
      timers.push(window.setTimeout(() => setVisible(false), 8200));
    };

    timers.push(window.setTimeout(showNext, 2500));
    const interval = window.setInterval(showNext, 140_000);
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
      className={`fixed bottom-4 left-3 right-3 z-[80] mx-auto max-w-[460px] transition duration-500 sm:left-auto sm:right-5 sm:mx-0 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-3 opacity-0 pointer-events-none"
      }`}
    >
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/98 px-4 py-3.5 shadow-[0_18px_50px_rgba(16,185,129,0.26)] backdrop-blur dark:border-emerald-400/30 dark:bg-emerald-950/95 dark:shadow-[0_18px_52px_rgba(16,185,129,0.2)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[16px] font-black text-white shadow-[0_10px_24px_rgba(5,150,105,0.32)] dark:bg-emerald-400 dark:text-emerald-950">
            ✓
          </div>
          <div className="min-w-0">
            <div className="break-keep text-[13px] font-black leading-5 text-emerald-950 dark:text-white">
              {proofCopy(event)}
            </div>
            <div className="mt-1 text-[11.5px] font-black text-emerald-700 dark:text-emerald-200">
              선공개 300명 멤버십 · 남은 티오 확인 중
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

// 2026-05-17: 비로그인 사용자 메인 페이지 — 마스킹된 매물 5개 + 로그인 CTA.
// 사용자 의도: 즉시 가치 인식 ("와 이게 돈 되는 거구나") + curiosity gap → 가입 motivation.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConditionChip } from "@/components/condition-chip";

type PreviewItem = {
  slot: number;
  maskedName: string;
  category: string;
  conditionClass: string | null;
  price: number;
  expectedProfitMin: number;
  expectedProfitMax: number;
  profitBand: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  smartphone: "📱 스마트폰",
  tablet: "📲 태블릿",
  laptop: "💻 노트북",
  smartwatch: "⌚ 스마트워치",
  earphone: "🎧 이어폰",
  headphone: "🎧 헤드폰",
  camera: "📷 카메라",
  monitor: "🖥️ 모니터",
  desktop: "🖥️ 데스크탑",
  speaker: "🔊 스피커",
  home_appliance: "🏠 가전",
  small_appliance: "🏠 소형가전",
  sport_golf: "⛳ 골프용품",
  shoe: "👟 신발",
  bag: "👜 가방",
  bike: "🚲 자전거",
  other: "🛒 기타",
};

// 카테고리별 image placeholder — emoji + gradient 다양화 (모든 카드 동일 자물쇠 회피).
const CATEGORY_ICON: Record<string, { emoji: string; gradient: string }> = {
  smartphone: { emoji: "📱", gradient: "from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40" },
  tablet: { emoji: "📲", gradient: "from-sky-100 to-cyan-100 dark:from-sky-900/40 dark:to-cyan-900/40" },
  laptop: { emoji: "💻", gradient: "from-slate-100 to-zinc-200 dark:from-slate-800 dark:to-zinc-700" },
  smartwatch: { emoji: "⌚", gradient: "from-rose-100 to-pink-100 dark:from-rose-900/40 dark:to-pink-900/40" },
  earphone: { emoji: "🎧", gradient: "from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40" },
  headphone: { emoji: "🎧", gradient: "from-fuchsia-100 to-purple-100 dark:from-fuchsia-900/40 dark:to-purple-900/40" },
  camera: { emoji: "📷", gradient: "from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40" },
  monitor: { emoji: "🖥️", gradient: "from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40" },
  desktop: { emoji: "🖥️", gradient: "from-stone-100 to-neutral-200 dark:from-stone-800 dark:to-neutral-700" },
  speaker: { emoji: "🔊", gradient: "from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40" },
  home_appliance: { emoji: "🏠", gradient: "from-lime-100 to-green-100 dark:from-lime-900/40 dark:to-green-900/40" },
  small_appliance: { emoji: "🏠", gradient: "from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40" },
  sport_golf: { emoji: "⛳", gradient: "from-teal-100 to-cyan-100 dark:from-teal-900/40 dark:to-cyan-900/40" },
  shoe: { emoji: "👟", gradient: "from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40" },
  bag: { emoji: "👜", gradient: "from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40" },
  bike: { emoji: "🚲", gradient: "from-cyan-100 to-sky-100 dark:from-cyan-900/40 dark:to-sky-900/40" },
  other: { emoji: "🛒", gradient: "from-zinc-100 to-stone-200 dark:from-zinc-800 dark:to-stone-700" },
};

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export default function PreviewMaskedDashboard() {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/preview-pool", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ items?: PreviewItem[] }>)
      .then((data) => {
        if (mounted) setItems(data.items ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      {/* SEO hidden — 옛 landing 키워드 보존. */}
      <div className="sr-only">
        <h1>미뇨이 — 중고 매물 AI 차익 분석</h1>
        <p>중고 거래 가격 차이 자동 분석. 시세보다 싼 매물 자동 추천. 일반인도 편하게 돈 벌 수 있는 AI 사이트.</p>
        <p>스마트폰, 태블릿, 노트북, 애플워치, 에어팟, 카메라, 신발, 가방 등 카테고리 매물 시세 비교.</p>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {/* 상단 hook + 고정 CTA */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            🔥 LIVE
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-[#223127] dark:text-zinc-100 sm:text-3xl">
            지금 사면<br />
            <span className="text-[var(--brand-accent-strong)]">차익 나는 상품</span>
          </h1>
          <p className="mt-2 text-sm text-[#5a6658] dark:text-zinc-400">
            AI가 시세와 비교해서 찾았어요. 로그인하면 매물 다 보입니다.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent-strong)] px-6 py-3 text-sm font-black text-[var(--brand-cream)] shadow-md transition hover:opacity-90"
          >
            🔓 로그인하고 다 보기
          </Link>
        </div>

        {/* 마스킹 매물 5개 */}
        <div className="mt-8 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-[#fffdf9] dark:bg-zinc-900" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-[#ddd4c7] bg-[#fffdf9] p-6 text-center text-sm text-[#6b7269] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              지금 차익 매물 준비 중. 잠시 후 다시 와 보세요.
            </div>
          ) : (
            items.map((item) => {
              const icon = CATEGORY_ICON[item.category] ?? CATEGORY_ICON.other;
              return (
                <Link
                  href="/login"
                  key={item.slot}
                  className="block rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-4 transition hover:border-[var(--brand-accent)] hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
                >
                  <div className="flex items-start gap-3">
                    {/* 카테고리별 emoji + gradient (실제 이미지 X — 마스킹). */}
                    <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${icon.gradient}`}>
                      <span className="text-4xl">{icon.emoji}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-[#5d735f] dark:text-emerald-400">
                          {CATEGORY_LABEL[item.category] ?? item.category}
                        </span>
                        <ConditionChip conditionClass={item.conditionClass} />
                      </div>
                      {/* 매물명 마스킹 (XXX 처리, blur X — 사용자 피드백). */}
                      <div className="mt-1 select-none truncate text-sm font-bold text-zinc-400 dark:text-zinc-500">
                        {item.maskedName}
                      </div>
                      {/* 가격 / 차익 — 정확 표시 (hook) */}
                      <div className="mt-2 flex flex-wrap items-baseline gap-2 text-xs">
                        <span className="text-[#6b7269] dark:text-zinc-400">매입</span>
                        <span className="font-black tabular-nums text-[#223127] dark:text-zinc-100">{krw(item.price)}</span>
                        <span className="text-zinc-300 dark:text-zinc-600">·</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black tabular-nums text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          +{krw(item.expectedProfitMin)}~{krw(item.expectedProfitMax)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* 하단 CTA 강조 */}
        <div className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] p-5 text-center dark:border-emerald-700 dark:bg-emerald-950/30">
          <div className="text-base font-black text-[#223127] dark:text-zinc-100">
            🔥 매물 다 보고 싶나요?
          </div>
          <p className="mt-1 text-xs text-[#5a6658] dark:text-zinc-400">
            로그인하면 매물 이름 / 사진 / 상세 정보 까지 다 보입니다. 무료.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Link
              href="/login"
              className="rounded-full bg-[var(--brand-accent-strong)] px-5 py-2 text-sm font-black text-[var(--brand-cream)] shadow-sm transition hover:opacity-90"
            >
              🔓 로그인
            </Link>
            <Link
              href="/intro"
              className="rounded-full border border-[#ddd4c7] bg-white px-5 py-2 text-sm font-bold text-[#344136] hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              미뇨이 소개
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

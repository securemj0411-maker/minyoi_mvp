"use client";

// 2026-05-17: 비로그인 사용자 메인 페이지 — 마스킹된 매물 5개 + 로그인 CTA.
// 사용자 의도: 즉시 가치 인식 ("와 이게 돈 되는 거구나") + curiosity gap → 가입 motivation.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConditionChip } from "@/components/condition-chip";
import { buildVerdicts, VERDICT_TONE_CLASS } from "@/lib/listing-verdicts";
import {
  BagIcon,
  BikeIcon,
  CameraIcon,
  FlameIcon,
  HeadphoneIcon,
  LaptopIcon,
  MonitorIcon,
  PackageIcon,
  SearchIcon,
  ShoeIcon,
  SmartphoneIcon,
  SpeakerIcon,
  TabletIcon,
  UnlockIcon,
  WatchIcon,
} from "@/components/icons";
import type { SVGProps } from "react";

type IconComponent = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

type PreviewItem = {
  slot: number;
  maskedName: string;
  // 2026-05-17: blurredImage = 서버 sharp 처리된 base64 (원본 URL 노출 X). DevTools 우회 불가.
  blurredImage: string | null;
  category: string;
  conditionClass: string | null;
  price: number;
  skuMedian: number | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  profitBand: number;
  // 2026-05-17: 신뢰 시그널 (dashboard 패턴).
  confidence: "high" | "medium" | "low";
  freeShipping: boolean;
  isFresh: boolean;
  // 2026-05-17 Phase 3: 근거 chip 데이터.
  soldSampleCount: number | null;
  medianHoursToSold: number | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  smartphone: "스마트폰",
  tablet: "태블릿",
  laptop: "노트북",
  smartwatch: "스마트워치",
  earphone: "이어폰",
  headphone: "헤드폰",
  camera: "카메라",
  monitor: "모니터",
  desktop: "데스크탑",
  speaker: "스피커",
  home_appliance: "가전",
  small_appliance: "소형가전",
  sport_golf: "골프용품",
  shoe: "신발",
  bag: "가방",
  bike: "자전거",
  other: "기타",
};

const CATEGORY_SVG: Record<string, IconComponent> = {
  smartphone: SmartphoneIcon,
  tablet: TabletIcon,
  laptop: LaptopIcon,
  smartwatch: WatchIcon,
  earphone: HeadphoneIcon,
  headphone: HeadphoneIcon,
  camera: CameraIcon,
  monitor: MonitorIcon,
  desktop: MonitorIcon,
  speaker: SpeakerIcon,
  home_appliance: PackageIcon,
  small_appliance: PackageIcon,
  sport_golf: PackageIcon,
  shoe: ShoeIcon,
  bag: BagIcon,
  bike: BikeIcon,
  other: PackageIcon,
};

const CATEGORY_GRADIENT: Record<string, string> = {
  smartphone: "from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40",
  tablet: "from-sky-100 to-cyan-100 dark:from-sky-900/40 dark:to-cyan-900/40",
  laptop: "from-slate-100 to-zinc-200 dark:from-slate-800 dark:to-zinc-700",
  smartwatch: "from-rose-100 to-pink-100 dark:from-rose-900/40 dark:to-pink-900/40",
  earphone: "from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40",
  headphone: "from-fuchsia-100 to-purple-100 dark:from-fuchsia-900/40 dark:to-purple-900/40",
  camera: "from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40",
  monitor: "from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40",
  desktop: "from-stone-100 to-neutral-200 dark:from-stone-800 dark:to-neutral-700",
  speaker: "from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40",
  home_appliance: "from-lime-100 to-green-100 dark:from-lime-900/40 dark:to-green-900/40",
  small_appliance: "from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40",
  sport_golf: "from-teal-100 to-cyan-100 dark:from-teal-900/40 dark:to-cyan-900/40",
  shoe: "from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40",
  bag: "from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40",
  bike: "from-cyan-100 to-sky-100 dark:from-cyan-900/40 dark:to-sky-900/40",
  other: "from-zinc-100 to-stone-200 dark:from-zinc-800 dark:to-stone-700",
};

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

// 2026-05-17: 차익 표시 — min === max 면 단일 (구간 표시 어색 fix).
function profitLabel(min: number, max: number): string {
  if (Math.round(min) === Math.round(max)) return `+${Math.round(min).toLocaleString("ko-KR")}원`;
  return `+${Math.round(min).toLocaleString("ko-KR")}~${Math.round(max).toLocaleString("ko-KR")}원`;
}

// 수익률 % — 매입 대비 차익 비율 (대시보드 통일 패턴).
function profitPctLabel(price: number, profitMin: number, profitMax: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const avg = (profitMin + profitMax) / 2;
  const pct = Math.round((avg / price) * 100);
  if (!Number.isFinite(pct)) return null;
  return `+${pct}%`;
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
        <h1>차익잡이 — 중고 매물 AI 차익 분석</h1>
        <p>중고 거래 가격 차이 자동 분석. 시세보다 싼 매물 자동 추천. 일반인도 편하게 돈 벌 수 있는 AI 사이트.</p>
        <p>스마트폰, 태블릿, 노트북, 애플워치, 에어팟, 카메라, 신발, 가방 등 카테고리 매물 시세 비교.</p>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {/* 상단 hook + 고정 CTA */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            <FlameIcon width={12} height={12} /> LIVE
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
            <UnlockIcon width={16} height={16} /> 로그인하고 다 보기
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
              const gradient = CATEGORY_GRADIENT[item.category] ?? CATEGORY_GRADIENT.other;
              const CategoryIcon = CATEGORY_SVG[item.category] ?? CATEGORY_SVG.other;
              return (
                <Link
                  href="/login"
                  key={item.slot}
                  className="block rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-4 transition hover:border-[var(--brand-accent)] hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
                >
                  <div className="flex items-start gap-3">
                    {/* 2026-05-17 보안: 서버 sharp blur 된 base64 — 원본 URL 노출 X. DevTools 우회 불가. */}
                    <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${gradient} text-zinc-500 dark:text-zinc-400`}>
                      {item.blurredImage ? (
                        <img
                          src={item.blurredImage}
                          alt={item.category}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <CategoryIcon width={36} height={36} />
                      )}
                    </div>
                    {/* 2026-05-17: PC 에서는 info 와 신뢰 chip 좌우 분리 (모바일은 stack). */}
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5d735f] dark:text-emerald-400">
                          <CategoryIcon width={12} height={12} />
                          {CATEGORY_LABEL[item.category] ?? item.category}
                        </span>
                        <ConditionChip conditionClass={item.conditionClass} />
                      </div>
                      {/* 매물명 — 서버에서 마스킹 ("갤** S** 울**") + CSS blur 살짝.
                          데이터는 이미 마스킹 (DevTools 안전), blur 는 시각 효과만. */}
                      <div className="mt-1 select-none truncate text-sm font-bold text-[#223127] blur-[1px] dark:text-zinc-100">
                        {item.maskedName}
                      </div>
                      {/* 매입 · 시세 (대시보드 패턴) */}
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold text-[#6b7269] dark:text-zinc-400">
                        <span>매입 <span className="font-black tabular-nums text-[#223127] dark:text-zinc-100">{krw(item.price)}</span></span>
                        {item.skuMedian && item.skuMedian > 0 ? (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span>시세 <span className="font-black tabular-nums text-[#223127] dark:text-zinc-100">{krw(item.skuMedian)}</span></span>
                          </>
                        ) : null}
                      </div>
                      {/* 차익 (원) + 수익률 (%) */}
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black tabular-nums text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {profitLabel(item.expectedProfitMin, item.expectedProfitMax)}
                        </span>
                        {(() => {
                          const pct = profitPctLabel(item.price, item.expectedProfitMin, item.expectedProfitMax);
                          return pct ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black tabular-nums text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                              {pct}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      </div>
                      {/* 2026-05-17 Phase 3: buildVerdicts 통합 — pack-reveal/admin-pool/user-reveal 와 통일.
                          비로그인 사용자에 안전한 데이터만 input (셀러 정보/desc 노출 X). */}
                      {(() => {
                        const verdicts = buildVerdicts({
                          price: item.price,
                          skuMedian: item.skuMedian,
                          expectedProfitMin: item.expectedProfitMin,
                          expectedProfitMax: item.expectedProfitMax,
                          marketConfidenceLabel: item.confidence,
                          soldSampleCount: item.soldSampleCount,
                          medianHoursToSold: item.medianHoursToSold,
                          freeShipping: item.freeShipping,
                          lastSeenAt: item.isFresh ? new Date(Date.now() - 30 * 60 * 1000).toISOString() : null,
                        });
                        return verdicts.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1 lg:flex-col lg:items-end lg:justify-center lg:gap-1.5">
                            {verdicts.map((v) => (
                              <span
                                key={v.label}
                                className={`whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${VERDICT_TONE_CLASS[v.tone]}`}
                              >
                                {v.label}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* 하단 CTA 강조 */}
        <div className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] p-5 text-center dark:border-emerald-700 dark:bg-emerald-950/30">
          <div className="inline-flex items-center gap-2 text-base font-black text-[#223127] dark:text-zinc-100">
            <SearchIcon width={18} height={18} className="text-[var(--brand-accent-strong)]" />
            매물 다 보고 싶나요?
          </div>
          <p className="mt-1 text-xs text-[#5a6658] dark:text-zinc-400">
            로그인하면 매물 이름 / 사진 / 상세 정보 까지 다 보입니다. 무료.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-accent-strong)] px-5 py-2 text-sm font-black text-[var(--brand-cream)] shadow-sm transition hover:opacity-90"
            >
              <UnlockIcon width={14} height={14} /> 로그인
            </Link>
            <Link
              href="/intro"
              className="rounded-full border border-[#ddd4c7] bg-white px-5 py-2 text-sm font-bold text-[#344136] hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              차익잡이 소개
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

// Wave 185 (2026-05-17): 사용자 본인 피드백 활동 가시화 widget.
// 사업 보고서: feedback 가시화 = retention compound loop 활성화.
// "내 신고가 사이트 보정에 반영됨" 인지 → 더 신고 → AI sample 증가 → 정확도 ↑ → 더 사용

import Image from "next/image";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Stats = {
  totalCount: number;
  resolvedCount: number;
  pendingCount: number;
  dismissedCount: number;
  tokensReceived: number;
};

type RecentReport = {
  id: number;
  pid: number;
  note: string;
  adminStatus: "pending" | "resolved" | "dismissed";
  adminResponseNote: string | null;
  adminRespondedAt: string | null;
  compensationTokens: number;
  createdAt: string;
  listing: {
    name: string | null;
    price: number | null;
    thumbnailUrl: string | null;
    bunjangUrl: string;
  } | null;
};

type ActivityResponse = {
  thisMonth: Stats;
  allTime: Stats;
  recentReports: RecentReport[];
  monthLabel: string;
};

function krw(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function timeLabel(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function relAge(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 24) return `${h.toFixed(1)}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

type StatusFilter = "all" | "pending" | "resolved" | "dismissed";

export function MyFeedbackActivity() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) throw new Error("no_supabase");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("no_session");
        const res = await fetch("/api/packs/me/feedback-activity", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`status_${res.status}`);
        const json = (await res.json()) as ActivityResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError("피드백 활동을 불러오지 못했어요.");
        console.error("[my-feedback-activity] failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="mb-4 h-24 animate-pulse rounded-xl bg-[#efe7d7] dark:bg-zinc-800" />;
  }
  if (error || !data) {
    // 조용히 hide.
    return null;
  }

  const { thisMonth, allTime } = data;
  const hasAny = allTime.totalCount > 0;

  return (
    <>
      <div className="mb-4 rounded-xl border-2 border-[#d5dfd2] bg-[#f3f7f1] p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
            🔍 내 피드백 활동
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {data.monthLabel}
          </span>
        </div>

        {!hasAny ? (
          // 빈 상태 — 신고 권장 메시지
          <div className="text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            아직 신고한 매물이 없어요. 시세/매물 정보가 다르면 매물 상세에서 <b className="text-amber-700 dark:text-amber-300">[🔍 정보 오류 신고]</b> 클릭 → 즉시 <b>토큰 +3</b> 보상 + 24시간 안에 운영자가 검토합니다.
            <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              회원님 신고가 알고리즘 보정 데이터로 들어가요.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-white px-2 py-2 dark:bg-zinc-900">
                <div className="text-base font-black tabular-nums text-[#223127] dark:text-zinc-100">
                  {thisMonth.totalCount}
                </div>
                <div className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400">신고</div>
              </div>
              <div className="rounded-lg bg-emerald-100 px-2 py-2 dark:bg-emerald-900/40">
                <div className="text-base font-black tabular-nums text-emerald-900 dark:text-emerald-100">
                  {thisMonth.resolvedCount}
                </div>
                <div className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300">✅ 보정</div>
              </div>
              <div className="rounded-lg bg-amber-100 px-2 py-2 dark:bg-amber-900/40">
                <div className="text-base font-black tabular-nums text-amber-900 dark:text-amber-100">
                  {thisMonth.pendingCount}
                </div>
                <div className="text-[9px] font-bold text-amber-800 dark:text-amber-300">⏳ 대기</div>
              </div>
              <div className="rounded-lg bg-zinc-100 px-2 py-2 dark:bg-zinc-800">
                <div className="text-base font-black tabular-nums text-zinc-700 dark:text-zinc-200">
                  🪙 {thisMonth.tokensReceived}
                </div>
                <div className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400">토큰</div>
              </div>
            </div>

            {/* 누적 (allTime) — thisMonth 와 다르면 표시 */}
            {allTime.totalCount > thisMonth.totalCount && (
              <div className="mt-2 text-[10px] text-zinc-600 dark:text-zinc-400">
                📊 누적: 신고 <b>{allTime.totalCount}건</b> · 보정 <b className="text-emerald-700 dark:text-emerald-300">{allTime.resolvedCount}건</b> · 토큰 <b>+{allTime.tokensReceived}</b>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="mt-2 w-full rounded-lg border border-[#d5dfd2] bg-white px-3 py-1.5 text-[11px] font-black text-[#5d735f] hover:bg-[#edf3ea] dark:border-emerald-900/40 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              자세히 보기 →
            </button>
          </>
        )}
      </div>

      {/* 자세히 보기 모달 */}
      {detailOpen && data.recentReports.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setDetailOpen(false)}>
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                🔍 내 피드백 신고 ({data.allTime.totalCount}건)
              </h3>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
              >
                닫기 ✕
              </button>
            </div>

            {/* 필터 */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(["all", "pending", "resolved", "dismissed"] as StatusFilter[]).map((s) => {
                const label = s === "all" ? `전체 (${data.allTime.totalCount})`
                  : s === "pending" ? `⏳ 대기 (${data.allTime.pendingCount})`
                  : s === "resolved" ? `✅ 보정 (${data.allTime.resolvedCount})`
                  : `❌ 기각 (${data.allTime.dismissedCount})`;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilter(s)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      filter === s
                        ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]"
                        : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* 신고 list */}
            <div className="space-y-2">
              {data.recentReports
                .filter((r) => filter === "all" || r.adminStatus === filter)
                .map((report) => (
                  <article key={report.id} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="flex gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        {report.listing?.thumbnailUrl ? (
                          <Image src={report.listing.thumbnailUrl} alt={report.listing.name ?? ""} fill sizes="56px" unoptimized className="object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="line-clamp-1 text-[12px] font-black text-zinc-900 dark:text-zinc-100">
                              {report.listing?.name ?? `pid ${report.pid}`}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              신고 {timeLabel(report.createdAt)} ({relAge(report.createdAt)})
                              {report.listing?.price != null && <> · 매입 {krw(report.listing.price)}</>}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                              report.adminStatus === "resolved"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : report.adminStatus === "dismissed"
                                  ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                            }`}>
                              {report.adminStatus === "resolved" ? "✅ 보정 완료"
                                : report.adminStatus === "dismissed" ? "❌ 기각"
                                : "⏳ 대기 중"}
                            </span>
                            {report.compensationTokens > 0 && (
                              <div className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                🪙 +{report.compensationTokens}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-200">
                          <span className="font-black text-zinc-500">내 신고:</span> {report.note}
                        </div>
                        {report.adminResponseNote && (
                          <div className="mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                            <span className="font-black">운영자 응답:</span> {report.adminResponseNote}
                            {report.adminRespondedAt && (
                              <div className="mt-0.5 text-[9px] text-emerald-700 dark:text-emerald-400">
                                {timeLabel(report.adminRespondedAt)} ({relAge(report.adminRespondedAt)})
                              </div>
                            )}
                          </div>
                        )}
                        {!report.adminResponseNote && report.adminStatus === "pending" && (
                          <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                            🕐 신고 후 24시간 안에 운영자가 검토하고 응답합니다.
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              {data.recentReports.filter((r) => filter === "all" || r.adminStatus === filter).length === 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  이 필터에 해당하는 신고가 없어요.
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-zinc-200 pt-2 text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              회원님 신고는 미뇨이 알고리즘 보정 데이터로 들어가요. 비슷한 매물이 다른 사용자에게 잘못 가지 않도록 시스템이 자동 학습합니다.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

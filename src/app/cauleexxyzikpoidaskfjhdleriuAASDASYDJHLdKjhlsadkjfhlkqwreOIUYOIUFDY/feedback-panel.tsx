"use client";

// Wave launch-103 / launch-104 / Wave 1225: 사용자 피드백 브리프 — 대기 건수 + 최근 3건 미리보기 + 전체 검토 link.
//   read-only 브리프(실제 승인/거절은 전체 검토=loss-reports 페이지). 공용 _ui 컴포넌트/포맷터/폴링 사용.

import Link from "next/link";
import { useCallback, useState } from "react";

import { OPS_ADMIN_LOSS_REPORTS_PATH } from "@/lib/admin-routes";

import { fmtKst } from "./_ui/format";
import { usePolling } from "./_ui/hooks";
import { Badge, EmptyState, Notice, Spinner, StatCard, StatusBadge } from "./_ui/primitives";
import { cn, FONT, FOCUS, INK, SURFACE } from "./_ui/tokens";

type FeedbackRow = {
  id: number;
  auth_user_id: string;
  user_ref: string;
  pid: number | null;
  pid_context: Record<string, unknown> | null;
  category: string;
  message: string;
  status: string;
  reward_amount: number;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  reward_granted_at: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  fake: "가품 의심",
  price_wrong: "시세 이상",
  sold_out: "거래 완료",
  category_wrong: "카테고리 오류",
  other: "기타",
};

export default function FeedbackPanel() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feedback/list", { cache: "no-store" });
      if (!res.ok) {
        setError(`목록 조회 실패 (${res.status})`);
        return;
      }
      const data = (await res.json()) as { feedback: FeedbackRow[] };
      setRows(data.feedback ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(refresh, 10_000);

  const pending = rows.filter((r) => r.status === "pending");
  const approved7d = rows.filter((r) => r.status === "approved").length;
  const rejected7d = rows.filter((r) => r.status === "rejected").length;
  const previewItems = pending.slice(0, 3);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className={cn(FONT.h3, "font-black", INK.primary)}>
          오류 신고 브리프 <span className={cn(FONT.meta, "font-bold", INK.muted)}>최근 7일</span>
        </h2>
        <Link
          href={OPS_ADMIN_LOSS_REPORTS_PATH}
          className={cn(
            "inline-flex h-8 items-center rounded-lg border px-3 font-bold",
            FONT.meta,
            SURFACE.line,
            SURFACE.cardSolid,
            INK.secondary,
            "hover:border-zinc-700 hover:text-white",
            FOCUS,
          )}
        >
          전체 검토 →
        </Link>
      </div>

      {error ? (
        <Notice tone="rose" className="mb-3">
          {error}
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="대기 중" value={pending.length} tone="amber" loading={loading} />
        <StatCard label="승인 (7일)" value={approved7d} tone="blue" loading={loading} />
        <StatCard label="거절 (7일)" value={rejected7d} tone="rose" loading={loading} />
      </div>

      {previewItems.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {previewItems.map((r) => (
            <li
              key={r.id}
              className={cn("flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2", SURFACE.line, SURFACE.card, FONT.meta)}
            >
              <Badge tone="slate">#{r.id}</Badge>
              <StatusBadge tone="amber">{CATEGORY_LABEL[r.category] ?? r.category}</StatusBadge>
              {r.category === "sold_out" ? <StatusBadge tone="rose">⚠ 풀 제외</StatusBadge> : null}
              <span className={cn("min-w-0 flex-1 truncate", INK.secondary)} title={r.message}>
                {r.message}
              </span>
              <span className={cn("tabular-nums", INK.muted)}>{fmtKst(r.created_at)}</span>
            </li>
          ))}
          {pending.length > 3 ? (
            <li className={cn("px-3 py-1", FONT.meta, INK.muted)}>+{pending.length - 3}건 더 대기 — 전체 검토에서 처리</li>
          ) : null}
        </ul>
      ) : (
        <div className="mt-3">
          {loading ? <Spinner label="불러오는 중…" /> : <EmptyState icon="✓">대기 중인 신고가 없어요</EmptyState>}
        </div>
      )}
    </section>
  );
}

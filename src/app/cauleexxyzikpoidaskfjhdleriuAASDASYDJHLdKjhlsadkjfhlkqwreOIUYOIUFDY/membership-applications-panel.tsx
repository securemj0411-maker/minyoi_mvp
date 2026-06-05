"use client";

import { useMemo, useState } from "react";
import { getMembershipPlan } from "@/lib/membership-plans";

export type MembershipApplicationRow = {
  id: number;
  userRef: string;
  authUserId: string;
  email: string | null;
  displayName: string | null;
  applicationKind: "new" | "renewal";
  productKey: string;
  priceKrw: number;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  depositConfirmedAt: string | null;
  scheduledAutoApproveAt: string | null;
  decidedAt: string | null;
  createdAt: string;
};

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmt(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value.slice(0, 16).replace("T", " ");
  const parts = KST_FORMATTER.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function krw(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function userLabel(row: MembershipApplicationRow): string {
  return row.displayName || row.email || row.authUserId;
}

function applicationKindLabel(row: MembershipApplicationRow): string {
  return row.applicationKind === "renewal" ? "연장" : "신규";
}

function statusLabel(row: MembershipApplicationRow): string {
  if (row.status === "approved") return "승인 완료";
  if (row.status === "rejected" && row.adminNote?.includes("auto_expired_unpaid_reservation")) return "입금 시간 만료";
  if (row.status === "rejected" && row.adminNote?.includes("user_cancelled_reservation")) return "사용자 취소";
  if (row.status === "rejected") return "거절";
  if (row.depositConfirmedAt) return "입금 확인 요청";
  return "입금 전 예약";
}

function minutesLeft(value: string | null | undefined): string {
  if (!value) return "";
  const ms = Date.parse(value) - Date.now();
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "자동승인 보정 대상";
  return `${Math.ceil(ms / 60_000)}분 남음`;
}

function isAutoDue(row: MembershipApplicationRow): boolean {
  return Boolean(
    row.status === "pending" &&
      row.depositConfirmedAt &&
      row.scheduledAutoApproveAt &&
      Date.parse(row.scheduledAutoApproveAt) <= Date.now(),
  );
}

export default function MembershipApplicationsPanel({ initialRows }: { initialRows: MembershipApplicationRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const depositRequests = rows
      .filter((row) => row.status === "pending" && row.depositConfirmedAt)
      .sort((a, b) => new Date(a.depositConfirmedAt ?? a.createdAt).getTime() - new Date(b.depositConfirmedAt ?? b.createdAt).getTime());
    const unpaidReservations = rows
      .filter((row) => row.status === "pending" && !row.depositConfirmedAt)
      .slice(0, 12);
    const recentDone = rows
      .filter((row) => row.status !== "pending")
      .slice(0, 18);
    return { depositRequests, unpaidReservations, recentDone };
  }, [rows]);

  async function decide(row: MembershipApplicationRow, decision: "approve" | "reject") {
    const target = userLabel(row);
    const plan = getMembershipPlan(row.productKey);
    const confirmText =
      decision === "approve"
        ? `${target}의 ${plan.label} ${applicationKindLabel(row)}을 승인할까요?`
        : `${target}의 ${plan.label} ${applicationKindLabel(row)} 신청을 거절할까요?`;
    const adminNote = window.prompt(`${confirmText}\n메모가 필요하면 적어주세요.`, "");
    if (adminNote === null) return;
    setPendingId(row.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/membership-applications/decide", {
        method: "POST",
        headers: { "content-type": "application/json", "x-minyoi-admin-action": "1" },
        body: JSON.stringify({ id: row.id, decision, adminNote }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: "approved" | "rejected";
        planEndAt?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.status) {
        setError(data.error ?? `처리 실패 (${res.status})`);
        return;
      }
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status: data.status!,
                adminNote: adminNote || item.adminNote,
                decidedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setNotice(
        decision === "approve"
          ? `${target} 승인 완료 · 만료 ${fmt(data.planEndAt)}`
          : `${target} 거절 완료`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mb-5 overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
      <div className="border-b border-zinc-800 bg-zinc-900/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-300">
              멤버십 입금 확인
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
              입금했어요를 누른 사람만 처리합니다
            </h2>
            <p className="mt-1 break-keep text-sm font-bold leading-6 text-zinc-400">
              입금 전 예약은 7분이 지나면 자동 만료되고, 입금 확인 요청은 5분이 지나면 자동승인됩니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <QueuePill label="입금 요청" value={grouped.depositRequests.length} tone="blue" />
            <QueuePill label="입금 전" value={grouped.unpaidReservations.length} tone="amber" />
            <QueuePill label="처리 기록" value={grouped.recentDone.length} tone="zinc" />
          </div>
        </div>
      </div>

      <div className="p-5">
        {notice ? <div className="mb-3 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-100">{notice}</div> : null}
        {error ? <div className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100">{error}</div> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="space-y-3">
            <SectionTitle title="입금 확인 요청" caption="사용자가 입금했어요를 누른 건입니다. 자동승인 전에 직접 처리할 수 있어요." />
            {grouped.depositRequests.length === 0 ? (
              <EmptyBox text="현재 입금 확인 요청이 없습니다." />
            ) : (
              grouped.depositRequests.map((row) => (
                <ApplicationCard
                  key={row.id}
                  row={row}
                  primaryMeta={`입금 요청 ${fmt(row.depositConfirmedAt)} · ${minutesLeft(row.scheduledAutoApproveAt)}`}
                  highlight={isAutoDue(row) ? "5분 경과 · 자동승인 보정 확인 필요" : "5분 내 자동승인 대기"}
                  pending={pendingId === row.id}
                  onApprove={() => void decide(row, "approve")}
                  onReject={() => void decide(row, "reject")}
                />
              ))
            )}
          </div>

          <div className="space-y-4">
            <div>
              <SectionTitle title="입금 전 예약" caption="아직 입금했어요를 누르지 않은 자리 예약입니다." />
              <div className="mt-2 space-y-2">
                {grouped.unpaidReservations.length === 0 ? (
                  <EmptyBox text="입금 전 예약이 없습니다." compact />
                ) : (
                  grouped.unpaidReservations.map((row) => (
                    <MiniApplicationRow key={row.id} row={row} />
                  ))
                )}
              </div>
            </div>

            <div>
              <SectionTitle title="최근 처리 기록" caption="승인, 자동승인, 만료, 거절 기록입니다." />
              <div className="mt-2 space-y-2">
                {grouped.recentDone.length === 0 ? (
                  <EmptyBox text="최근 처리 기록이 없습니다." compact />
                ) : (
                  grouped.recentDone.map((row) => (
                    <MiniApplicationRow key={row.id} row={row} showStatus />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QueuePill({ label, value, tone }: { label: string; value: number; tone: "blue" | "amber" | "zinc" }) {
  const cls = {
    blue: "border-blue-400/25 bg-blue-500/12 text-blue-100",
    amber: "border-amber-400/25 bg-amber-500/12 text-amber-100",
    zinc: "border-zinc-600 bg-zinc-900 text-zinc-100",
  }[tone];
  return (
    <div className={`min-w-[82px] rounded-2xl border px-3 py-2 ${cls}`}>
      <div className="text-xl font-black tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] font-black text-white/60">{label}</div>
    </div>
  );
}

function SectionTitle({ title, caption }: { title: string; caption: string }) {
  return (
    <div>
      <h3 className="text-base font-black text-white">{title}</h3>
      <p className="mt-1 break-keep text-xs font-bold leading-5 text-zinc-500">{caption}</p>
    </div>
  );
}

function EmptyBox({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/45 px-4 text-sm font-bold text-zinc-500 ${compact ? "py-4" : "py-10 text-center"}`}>
      {text}
    </div>
  );
}

function ApplicationCard({
  row,
  primaryMeta,
  highlight,
  pending,
  onApprove,
  onReject,
}: {
  row: MembershipApplicationRow;
  primaryMeta: string;
  highlight: string;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const plan = getMembershipPlan(row.productKey);
  return (
    <article className="rounded-3xl border border-zinc-800 bg-zinc-900/72 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-zinc-950">#{row.id}</span>
            <span className="rounded-full border border-blue-300/25 bg-blue-400/10 px-2.5 py-1 text-xs font-black text-blue-100">
              {applicationKindLabel(row)}
            </span>
            <span className="text-xs font-bold text-zinc-500">{primaryMeta}</span>
          </div>
          <div className="mt-3 text-lg font-black text-white">{row.displayName || "이름 없음"}</div>
          <div className="mt-1 break-all text-sm font-bold text-zinc-400">{row.email || row.authUserId}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-white">{plan.label} · {krw(row.priceKrw)}</div>
          <div className="mt-1 text-xs font-black text-zinc-500">{plan.monthlyLabel}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-400/15 bg-blue-500/10 px-4 py-3">
        <div className="text-sm font-black text-blue-100">{highlight}</div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onApprove}
            className="h-10 rounded-full bg-emerald-400 px-4 text-sm font-black text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-40"
          >
            승인
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onReject}
            className="h-10 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 text-sm font-black text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-40"
          >
            거절
          </button>
        </div>
      </div>
    </article>
  );
}

function MiniApplicationRow({ row, showStatus = false }: { row: MembershipApplicationRow; showStatus?: boolean }) {
  const plan = getMembershipPlan(row.productKey);
  const tone =
    row.status === "approved"
      ? "text-emerald-200 bg-emerald-500/10 border-emerald-400/20"
      : row.status === "rejected"
        ? "text-zinc-300 bg-zinc-900 border-zinc-800"
        : "text-amber-100 bg-amber-500/10 border-amber-400/20";
  return (
    <div className={`rounded-2xl border px-3 py-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black">#{row.id} · {row.displayName || "이름 없음"}</div>
          <div className="mt-1 truncate text-xs font-bold opacity-70">{row.email || row.authUserId}</div>
        </div>
        <div className="shrink-0 text-right text-xs font-black">
          {showStatus ? statusLabel(row) : "입금 전"}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold opacity-75">
        <span>{applicationKindLabel(row)}</span>
        <span>·</span>
        <span>{plan.label}</span>
        <span>·</span>
        <span>{krw(row.priceKrw)}</span>
        <span>·</span>
        <span>{fmt(showStatus ? row.decidedAt ?? row.createdAt : row.createdAt)}</span>
      </div>
    </div>
  );
}

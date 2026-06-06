"use client";

// Wave launch-97 / launch-101 / Wave 1225: 수동 충전 신청 패널 — pending list + 승인/거절.
//   5초 폴링(새 신청 + 텔레그램/타 운영자 변경 반영). 공용 _ui 컴포넌트로 — 라이트 배지/notice 누출 제거.

import { useCallback, useState } from "react";

import { fmtCountdown, fmtKrwSign, fmtKst, fmtNum } from "./_ui/format";
import { useCountdown, usePolling } from "./_ui/hooks";
import { Badge, Button, EmptyState, Notice, Spinner, StatusBadge } from "./_ui/primitives";
import { Table, TBody, TD, TH, THead, TR, ResponsiveTable } from "./_ui/Table";
import { cn, FONT, INK, SURFACE, TONE, type Tone } from "./_ui/tokens";

type DepositRequest = {
  id: number;
  user_ref: string;
  auth_user_id: string;
  plan_key: string;
  amount: number;
  price_krw: number;
  depositor_name: string;
  status: string;
  scheduled_auto_approve_at: string;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
};

function statusMeta(status: string): { tone: Tone; label: string } {
  switch (status) {
    case "approved":
      return { tone: "blue", label: "운영자 승인" };
    case "auto_approved":
      return { tone: "violet", label: "자동 지급" };
    case "rejected":
      return { tone: "rose", label: "거절" };
    default:
      return { tone: "amber", label: "대기 중" };
  }
}

function Countdown({ iso }: { iso: string }) {
  const sec = useCountdown(iso);
  return <span className="font-black tabular-nums text-amber-300">{fmtCountdown(sec)}</span>;
}

export default function ManualDepositPanel() {
  const [rows, setRows] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/manual-deposit/list", { cache: "no-store" });
      if (!res.ok) {
        setError(`목록 조회 실패 (${res.status})`);
        return;
      }
      const data = (await res.json()) as { requests: DepositRequest[] };
      setRows(data.requests ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(refresh, 5000);

  async function decide(id: number, decision: "approve" | "reject") {
    if (pendingIds.has(id)) return;
    const action = decision === "approve" ? "승인" : "거절";
    const ok = window.confirm(`신청 #${id} ${action}할까요?`);
    if (!ok) return;
    setPendingIds((prev) => new Set(prev).add(id));
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/manual-deposit/decide?id=${id}&decision=${decision}`, {
        method: "POST",
        cache: "no-store",
        headers: { "x-minyoi-admin-action": "1" },
      });
      if (!res.ok) {
        setError(`${action} 실패 (${res.status})`);
        return;
      }
      setNotice(`신청 #${id} ${action} 완료`);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const recent = rows.filter((r) => r.status !== "pending").slice(0, 10);
  const empty = !loading && pending.length === 0 && recent.length === 0;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className={cn(FONT.h3, "font-black", INK.primary)}>
          입금 대기열 <span className={cn(FONT.meta, "font-bold", INK.muted)}>최근 24시간</span>
        </h2>
        <Button variant="subtle" size="sm" onClick={() => void refresh()}>
          새로고침
        </Button>
      </div>

      {notice ? (
        <Notice tone="blue" className="mb-3">
          {notice}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="rose" className="mb-3">
          {error}
        </Notice>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="py-6">
          <Spinner label="불러오는 중…" />
        </div>
      ) : empty ? (
        <EmptyState icon="🧾">최근 24시간 신청이 없어요</EmptyState>
      ) : (
        <ResponsiveTable
          mobile={
            <>
              {pending.map((r) => {
                const inProgress = pendingIds.has(r.id);
                return (
                  <div key={`m-${r.id}`} className={cn("rounded-lg border p-3", TONE.amber.border, TONE.amber.soft)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <Badge tone="slate">#{r.id}</Badge>
                        <span className={cn(FONT.body, "font-bold", INK.primary)}>{r.depositor_name}</span>
                      </div>
                      <StatusBadge tone="amber">대기 중</StatusBadge>
                    </div>
                    <div className={cn("mt-2 grid grid-cols-2 gap-x-3 gap-y-1", FONT.meta)}>
                      <div>
                        <span className={INK.muted}>패키지 </span>
                        <span className={cn("font-bold", INK.secondary)}>{fmtNum(r.amount)} 크레딧</span>
                      </div>
                      <div>
                        <span className={INK.muted}>금액 </span>
                        <span className={cn("font-bold tabular-nums", INK.secondary)}>{fmtKrwSign(r.price_krw)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className={INK.muted}>남은 시간 </span>
                        <Countdown iso={r.scheduled_auto_approve_at} />
                      </div>
                      <div className="col-span-2">
                        <span className={INK.muted}>신청 </span>
                        <span className={cn("tabular-nums", INK.muted)}>{fmtKst(r.created_at)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button variant="primary" size="sm" className="flex-1" disabled={inProgress} onClick={() => void decide(r.id, "approve")}>
                        {inProgress ? "처리 중…" : "✓ 승인"}
                      </Button>
                      <Button variant="danger" size="sm" className="flex-1" disabled={inProgress} onClick={() => void decide(r.id, "reject")}>
                        {inProgress ? "처리 중…" : "✕ 거절"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {recent.map((r) => {
                const m = statusMeta(r.status);
                return (
                  <div key={`m-${r.id}`} className={cn("rounded-lg border px-3 py-2 opacity-80", SURFACE.line, SURFACE.card)}>
                    <div className={cn("flex items-center justify-between gap-2", FONT.meta)}>
                      <div className="flex items-baseline gap-2">
                        <Badge tone="slate">#{r.id}</Badge>
                        <span className={cn("font-semibold", INK.secondary)}>{r.depositor_name}</span>
                        <span className={cn("tabular-nums", INK.muted)}>{fmtKrwSign(r.price_krw)}</span>
                      </div>
                      <StatusBadge tone={m.tone}>{m.label}</StatusBadge>
                    </div>
                    <div className={cn("mt-0.5", FONT.meta, INK.muted)}>{fmtKst(r.decided_at ?? r.created_at)} · 처리됨</div>
                  </div>
                );
              })}
            </>
          }
          desktop={
            <Table minWidth={900}>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>입금자명</TH>
                  <TH>패키지</TH>
                  <TH>금액</TH>
                  <TH>상태</TH>
                  <TH>남은 시간</TH>
                  <TH>신청 시각</TH>
                  <TH align="right">작업</TH>
                </TR>
              </THead>
              <TBody>
                {pending.map((r) => {
                  const inProgress = pendingIds.has(r.id);
                  return (
                    <TR key={r.id} className={TONE.amber.soft}>
                      <TD className="tabular-nums">{r.id}</TD>
                      <TD className={cn("font-semibold", INK.primary)}>{r.depositor_name}</TD>
                      <TD>{fmtNum(r.amount)} 크레딧</TD>
                      <TD className="tabular-nums">{fmtKrwSign(r.price_krw)}</TD>
                      <TD>
                        <StatusBadge tone="amber">대기 중</StatusBadge>
                      </TD>
                      <TD>
                        <Countdown iso={r.scheduled_auto_approve_at} />
                      </TD>
                      <TD className={cn("tabular-nums", INK.muted)}>{fmtKst(r.created_at)}</TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="primary" size="sm" disabled={inProgress} onClick={() => void decide(r.id, "approve")}>
                            {inProgress ? "…" : "✓ 승인"}
                          </Button>
                          <Button variant="danger" size="sm" disabled={inProgress} onClick={() => void decide(r.id, "reject")}>
                            {inProgress ? "…" : "✕ 거절"}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
                {recent.map((r) => {
                  const m = statusMeta(r.status);
                  return (
                    <TR key={r.id} className="opacity-80">
                      <TD className="tabular-nums">{r.id}</TD>
                      <TD className={INK.secondary}>{r.depositor_name}</TD>
                      <TD>{fmtNum(r.amount)} 크레딧</TD>
                      <TD className="tabular-nums">{fmtKrwSign(r.price_krw)}</TD>
                      <TD>
                        <StatusBadge tone={m.tone}>{m.label}</StatusBadge>
                      </TD>
                      <TD className={INK.muted}>—</TD>
                      <TD className={cn("tabular-nums", INK.muted)}>{fmtKst(r.decided_at ?? r.created_at)}</TD>
                      <TD align="right" className={INK.muted}>
                        처리됨
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          }
        />
      )}
    </section>
  );
}

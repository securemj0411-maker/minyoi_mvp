"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircleIcon, FlameIcon } from "@/components/icons";

// Wave 93b: 사용자 활성 핫딜 reservation 카드 + 열기/한번에 까기/샀어요/포기.

type Reservation = {
  id: number;
  pid: number;
  attemptNo: number;
  sentAt: string;
  expiresAt: string;
  openedAt: string | null;
  decision: "pending" | "opened" | "purchased" | "rejected" | "expired";
  // 열기 전엔 null (서버가 차단). 열린 후에만 매물 정보 포함.
  listing: {
    name: string;
    skuName: string | null;
    price: number;
    skuMedian: number;
    thumbnailUrl: string | null;
    sourceUrl: string | null;
  } | null;
  deal: {
    profitAmount: number;
    profitMargin: number;
    band: number | null;
  };
};

function fmtMin(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m <= 0 && s <= 0) return "만료됨";
  return `${m}:${String(Math.max(0, s)).padStart(2, "0")}`;
}

function fmtWan(n: number): string {
  return `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
}

export default function HotdealReservations({ initialPid }: { initialPid: number | null }) {
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPids, setBusyPids] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me/hotdeal/reservations", { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status}`);
      const data = (await r.json()) as { reservations: Reservation[] };
      setItems(data.reservations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // initialPid (URL ?pid=...) 자동 강조 → 하이라이트
  const highlightPid = initialPid;

  const pending = useMemo(() => items.filter((i) => i.decision === "pending"), [items]);
  const opened = useMemo(() => items.filter((i) => i.decision === "opened"), [items]);

  async function openOne(pid: number) {
    setBusyPids((s) => new Set(s).add(pid));
    try {
      const r = await fetch("/api/me/hotdeal/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pids: [pid] }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyPids((s) => { const n = new Set(s); n.delete(pid); return n; });
    }
  }

  async function openAll() {
    if (pending.length === 0) return;
    if (!confirm(`새매물 알림 ${pending.length}건을 한 번에 열까요?`)) return;
    try {
      const r = await fetch("/api/me/hotdeal/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pids: "all" }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Wave 106: "샀어요/포기" 응답 폐기. 카드 열기 = 자동 consumed. decide 함수 삭제.

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e2d9cb] bg-[#fffaf6] p-5 text-sm font-bold text-[#5a6658] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        활성 reservation 확인 중…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d6cdb8] bg-[#fffbf4] p-6 text-center text-sm font-semibold text-[#5a6658] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        이 알림 매물은 이미 만료됐거나 확인 가능한 상태가 아니에요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {pending.length > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-[#c8d8c4] bg-[var(--brand-accent-soft)] p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="text-sm font-black text-[#223127] dark:text-zinc-100">
            새매물 알림 {pending.length}건
          </div>
          <button
            type="button"
            onClick={openAll}
            className="h-9 rounded-lg bg-[var(--brand-accent-strong)] px-3 text-xs font-black text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950"
          >
            한 번에 열기
          </button>
        </div>
      )}

      {[...pending, ...opened].map((r) => (
        <ReservationCard
          key={r.id}
          item={r}
          highlight={r.pid === highlightPid}
          remainingMs={new Date(r.expiresAt).getTime() - now}
          busy={busyPids.has(r.pid)}
          onOpen={() => openOne(r.pid)}
        />
      ))}
    </div>
  );
}

function ReservationCard({ item, highlight, remainingMs, busy, onOpen }: {
  item: Reservation;
  highlight: boolean;
  remainingMs: number;
  busy: boolean;
  onOpen: () => void;
}) {
  const isOpened = item.decision === "opened";
  const expired = remainingMs <= 0;
  const profitWan = Math.round(item.deal.profitAmount / 10000);
  const pct = Math.round(item.deal.profitMargin * 100);

  // 열기 전 OR 서버가 listing 차단: 매물 정보 잠금. 차익 정도만 teaser.
  const lst = item.listing;
  if (!isOpened || !lst) {
    if (expired && !lst) {
      // 만료됐고 정보도 없으면 minimal expired card.
      return (
        <article className="rounded-2xl border border-[#eee5d8] bg-[#faf5ec] p-5 opacity-60 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-red-600 dark:text-red-400">만료된 알림 (기회 종료)</span>
            <span className="text-xs font-semibold text-[#7a8577] dark:text-zinc-500">
              차익 ₩{profitWan.toLocaleString("ko-KR")}만 ({pct}%)
            </span>
          </div>
        </article>
      );
    }
    return (
      <article
        className={`overflow-hidden rounded-2xl border p-5 transition ${
          highlight
            ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-soft)] ring-2 ring-[var(--brand-accent-strong)] dark:border-blue-400 dark:bg-blue-950/30 dark:ring-blue-400"
            : "border-[#e2d9cb] bg-[#fffaf6] dark:border-zinc-800 dark:bg-zinc-900"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-200 text-orange-600 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300">
            <FlameIcon className="h-9 w-9" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-orange-600 dark:text-orange-300">
              <FlameIcon className="h-3.5 w-3.5" />
              <span>새매물 알림 도착</span>
            </div>
            <h3 className="mt-1 text-base font-black leading-6 text-[#223127] dark:text-zinc-100">
              차익 ₩{profitWan.toLocaleString("ko-KR")}만 ({pct}%)
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#5a6658] dark:text-zinc-400">
              매물 정보는 “열기” 후 공개됩니다.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eee5d8] pt-3 dark:border-zinc-800">
          <div className="text-xs font-black text-[#5a6658] dark:text-zinc-400">
            {fmtMin(remainingMs)} 남음
          </div>
          <button
            type="button"
            onClick={onOpen}
            disabled={busy}
            className="h-10 rounded-xl bg-[var(--brand-accent-strong)] px-6 text-sm font-black text-[var(--brand-cream)] transition disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
          >
            {busy ? "여는 중…" : "열기"}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border p-5 transition ${
        highlight
          ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-soft)] ring-2 ring-[var(--brand-accent-strong)] dark:border-blue-400 dark:bg-blue-950/30 dark:ring-blue-400"
          : "border-[#e2d9cb] bg-[#fffaf6] dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start gap-4">
        {lst.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lst.thumbnailUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300">
            <FlameIcon className="h-8 w-8" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-orange-600 dark:text-orange-300">
            <FlameIcon className="h-3.5 w-3.5" />
            <span>{lst.skuName ?? "새매물 알림"}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-base font-black leading-6 text-[#223127] dark:text-zinc-100">
            {lst.name}
          </h3>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#7a8577] dark:text-zinc-500">매입</div>
              <div className="mt-0.5 text-[#223127] dark:text-zinc-200">₩{fmtWan(lst.price)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#7a8577] dark:text-zinc-500">시세</div>
              <div className="mt-0.5 text-[#223127] dark:text-zinc-200">₩{fmtWan(lst.skuMedian)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#7a8577] dark:text-zinc-500">차익</div>
              <div className="mt-0.5 font-black text-blue-700 dark:text-blue-300">
                ₩{profitWan.toLocaleString("ko-KR")}만 ({pct}%)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5d8] pt-3 dark:border-zinc-800">
        <div className={`text-xs font-black ${expired ? "text-red-600 dark:text-red-400" : "text-[#5a6658] dark:text-zinc-400"}`}>
          {expired ? "만료됨" : `${fmtMin(remainingMs)} 남음`}
        </div>

        {expired ? (
          <span className="text-xs font-semibold text-[#7a8577] dark:text-zinc-500">기회 종료</span>
        ) : (
          // Wave 106: 응답 버튼 ("샀어요/포기") 제거. 카드 까는 순간 = consumed.
          // 원문 링크만 제공 — 매물 보고 살지 말지는 본인 결정, 추가 응답 없음.
          <a
            href={lst.sourceUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 ${busy || !lst.sourceUrl ? "pointer-events-none opacity-50" : ""}`}
          >
            <CheckCircleIcon className="h-3.5 w-3.5" /> 원문 열기
          </a>
        )}
      </div>
    </article>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { addTokens, loadTokens, spendTokens } from "@/lib/mock-tokens";
import type { InventorySnapshot, PackBand, RevealFeedbackType } from "@/lib/pack-open";
import { getOrCreateUserRef } from "@/lib/user-ref";

type ThemeMode = "system" | "light" | "dark";
const THEME_STORAGE_KEY = "minyoi-theme-v1";

type PackDef = {
  band: PackBand;
  title: string;
  tagline: string;
  cost: number;
  cards: number;
  profitLabel: string;
  ctaTone: "sky" | "emerald" | "amber";
};

type PackOpenApiResult = RevealResult | {
  result: "error";
  message?: string;
  error?: string;
  tokensRefunded?: number;
};

const PACKS: PackDef[] = [
  {
    band: 1,
    title: "라이트 후보팩",
    tagline: "가벼운 시작 — 카드 2장",
    cost: 1,
    cards: 2,
    profitLabel: "예상 순익 2~3만원",
    ctaTone: "sky",
  },
  {
    band: 2,
    title: "스탠다드 후보팩",
    tagline: "꾸준한 수익 — 카드 2장",
    cost: 2,
    cards: 2,
    profitLabel: "예상 순익 4~6만원",
    ctaTone: "emerald",
  },
  {
    band: 3,
    title: "프리미엄 후보팩",
    tagline: "고가치 슬롯 — 카드 2장",
    cost: 3,
    cards: 2,
    profitLabel: "예상 순익 7만원+",
    ctaTone: "amber",
  },
];

function applyTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function loadTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // ignore
  }
  return "system";
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => (typeof window === "undefined" ? "system" : loadTheme()));

  useEffect(() => {
    applyTheme(theme);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div className="flex rounded-lg border border-zinc-200 bg-white p-1 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-800">
      {[
        ["system", "시스템"],
        ["light", "라이트"],
        ["dark", "다크"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value as ThemeMode)}
          className={`rounded-md px-2 py-1 transition ${
            theme === value
              ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TokenBadge({ tokens, onTopUp }: { tokens: number; onTopUp: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-900/60 dark:bg-amber-950/40">
      <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">토큰</span>
      <span className="text-sm font-black tabular-nums text-amber-900 dark:text-amber-200">{tokens}</span>
      <button
        type="button"
        onClick={onTopUp}
        className="rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow hover:bg-amber-700"
      >
        + 충전
      </button>
    </div>
  );
}

function packCardClasses(band: PackBand) {
  if (band === 3)
    return "border-amber-300/70 bg-gradient-to-br from-amber-50 via-white to-amber-100 shadow-2xl shadow-amber-500/20 hover:shadow-amber-500/40 dark:border-amber-800/60 dark:from-amber-950/40 dark:via-zinc-900 dark:to-amber-950/20 dark:shadow-amber-950/40";
  if (band === 2)
    return "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 shadow-xl shadow-emerald-500/15 hover:shadow-emerald-500/30 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-emerald-950/10";
  return "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-sky-50 shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 dark:border-sky-900/40 dark:from-sky-950/30 dark:via-zinc-900 dark:to-sky-950/10";
}

function packAccentText(band: PackBand) {
  if (band === 3) return "text-amber-700 dark:text-amber-300";
  if (band === 2) return "text-emerald-700 dark:text-emerald-300";
  return "text-sky-700 dark:text-sky-300";
}

function ctaClasses(tone: PackDef["ctaTone"], disabled: boolean) {
  const base = "w-full rounded-xl px-4 py-3 text-sm font-black text-white transition";
  if (disabled) return `${base} cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-800`;
  if (tone === "amber")
    return `${base} bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 hover:from-amber-600 hover:to-amber-700`;
  if (tone === "emerald")
    return `${base} bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700`;
  return `${base} bg-gradient-to-r from-sky-500 to-sky-600 shadow-lg shadow-sky-500/30 hover:from-sky-600 hover:to-sky-700`;
}

function PackCard({
  pack,
  inventory,
  tokens,
  onOpen,
  busy,
}: {
  pack: PackDef;
  inventory?: InventorySnapshot;
  tokens: number;
  onOpen: (pack: PackDef) => void;
  busy: boolean;
}) {
  const ready = inventory?.ready ?? 0;
  const usableReady = inventory?.usableReady ?? ready;
  const fresh = inventory?.freshUnder2h ?? 0;
  const insufficient = tokens < pack.cost;
  const sold = usableReady === 0;
  const disabled = busy || insufficient || sold;

  return (
    <div className={`group flex h-full flex-col overflow-hidden rounded-3xl border p-6 transition-transform duration-200 hover:-translate-y-1 ${packCardClasses(pack.band)}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-widest ${packAccentText(pack.band)}`}>
          {pack.tagline}
        </span>
        {pack.band === 3 ? (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow">
            Premium
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
        {pack.title}
      </h3>
      <p className={`mt-1 text-sm font-bold ${packAccentText(pack.band)}`}>{pack.profitLabel}</p>

      <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white/70 p-2 backdrop-blur dark:bg-zinc-800/40">
          <div className="text-[10px] text-zinc-500">필요 토큰</div>
          <div className="mt-0.5 text-base font-black tabular-nums text-zinc-900 dark:text-zinc-50">
            {pack.cost}개
          </div>
        </div>
        <div className="rounded-xl bg-white/70 p-2 backdrop-blur dark:bg-zinc-800/40">
          <div className="text-[10px] text-zinc-500">공개 카드</div>
          <div className="mt-0.5 text-base font-black tabular-nums text-zinc-900 dark:text-zinc-50">
            {pack.cards}장
          </div>
        </div>
        <div className="rounded-xl bg-white/70 p-2 backdrop-blur dark:bg-zinc-800/40">
          <div className="text-[10px] text-zinc-500">공개 가능</div>
          <div className="mt-0.5 text-base font-black tabular-nums text-zinc-900 dark:text-zinc-50">
            {usableReady}건
          </div>
        </div>
        <div className="rounded-xl bg-white/70 p-2 backdrop-blur dark:bg-zinc-800/40">
          <div className="text-[10px] text-zinc-500">신선 (&lt;2h)</div>
          <div className="mt-0.5 text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">
            {fresh}건
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(pack)}
        disabled={disabled}
        className={`mt-6 ${ctaClasses(pack.ctaTone, disabled)}`}
      >
        {busy ? "처리 중..." : sold ? "재고 부족" : insufficient ? `토큰 부족 (${pack.cost}개 필요)` : `${pack.cost}토큰으로 열기`}
      </button>

      <div className="mt-3 text-center text-[11px] text-zinc-500">
        검증 실패 시 토큰 자동 환불
      </div>
    </div>
  );
}

type Props = {
  initialInventory: InventorySnapshot[];
};

export default function PackShop({ initialInventory }: Props) {
  const [inventory, setInventory] = useState<InventorySnapshot[]>(initialInventory);
  const [tokens, setTokens] = useState<number>(0);
  const [userRef, setUserRef] = useState<string>("");
  const [activeBand, setActiveBand] = useState<PackBand | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RevealResult | null>(null);
  const [lastPack, setLastPack] = useState<PackDef | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens(loadTokens());
    setUserRef(getOrCreateUserRef());
  }, []);

  const inventoryByBand = useMemo(() => {
    const map = new Map<PackBand, InventorySnapshot>();
    for (const snap of inventory) map.set(snap.band, snap);
    return map;
  }, [inventory]);

  const refreshInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/packs/inventory", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { inventory: InventorySnapshot[] };
      if (Array.isArray(data?.inventory)) setInventory(data.inventory);
    } catch {
      // ignore
    }
  }, []);

  const openPack = useCallback(
    async (pack: PackDef) => {
      if (loading) return;
      if (tokens < pack.cost) return;
      setLastPack(pack);
      setActiveBand(pack.band);
      setLoading(true);
      setResult(null);
      const prevTokens = tokens;
      const nextTokens = spendTokens(pack.cost);
      setTokens(nextTokens);
      try {
        const res = await fetch("/api/packs/open", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-ref": userRef,
          },
          body: JSON.stringify({
            band: pack.band,
            tokensSpent: pack.cost,
            requestedCards: pack.cards,
          }),
        });
        const data = (await res.json()) as PackOpenApiResult;
        if (data.result === "success") {
          setResult({
            result: "success",
            reveals: data.reveals,
            attemptedCount: data.attemptedCount,
            durationMs: data.durationMs,
          });
        } else if (data.result === "refunded") {
          const refunded = data.tokensRefunded ?? pack.cost;
          setTokens(addTokens(refunded));
          setResult({
            result: "refunded",
            reason: data.reason,
            tokensRefunded: refunded,
            durationMs: data.durationMs,
          });
        } else if (data.result === "unavailable") {
          setTokens(addTokens(pack.cost));
          setResult({
            result: "unavailable",
            reason: data.reason,
            durationMs: data.durationMs,
          });
        } else {
          setTokens(prevTokens);
          setResult({
            result: "refunded",
            reason: data.message ?? data.error ?? "예상치 못한 응답이에요. 다시 시도해주세요.",
            tokensRefunded: pack.cost,
            durationMs: 0,
          });
        }
      } catch (err) {
        setTokens(prevTokens);
        setResult({
          result: "refunded",
          reason: err instanceof Error ? err.message : "네트워크 오류",
          tokensRefunded: pack.cost,
          durationMs: 0,
        });
      } finally {
        setLoading(false);
        refreshInventory();
      }
    },
    [loading, tokens, userRef, refreshInventory],
  );

  const handleClose = useCallback(() => {
    setActiveBand(null);
    setResult(null);
    setLastPack(null);
  }, []);

  const handleRetry = useCallback(() => {
    if (!lastPack) {
      handleClose();
      return;
    }
    setResult(null);
    void openPack(lastPack);
  }, [lastPack, openPack, handleClose]);

  const handleLinkClicked = useCallback((pid: number) => {
    if (!userRef) return;
    void fetch("/api/packs/reveals/click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-ref": userRef,
      },
      body: JSON.stringify({ pid }),
      cache: "no-store",
    }).catch(() => undefined);
  }, [userRef]);

  const handleFeedback = useCallback((pid: number, feedbackType: RevealFeedbackType) => {
    if (!userRef) return;
    void fetch("/api/packs/reveals/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-ref": userRef,
      },
      body: JSON.stringify({ pid, feedbackType }),
      cache: "no-store",
    }).catch(() => undefined);
  }, [userRef]);

  const handleTopUp = useCallback(() => {
    setTokens(addTokens(5));
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-sm font-black text-white shadow-md shadow-emerald-500/30">
              M
            </div>
            <span className="font-black tracking-tight text-zinc-900 dark:text-white">미뇨이</span>
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-900">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <TokenBadge tokens={tokens} onTopUp={handleTopUp} />
            <ThemeToggle />
            <Link
              href="/admin"
              className="hidden text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 sm:block"
            >
              운영자
            </Link>
          </div>
        </div>
      </nav>

      <main className="min-h-screen bg-[#f4f6f8] dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
          <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-8 text-white shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.18),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(245,158,11,0.12),transparent_55%)]" />
            <div className="relative max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-300/80">오늘의 카드팩</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                내 손에 들어올
                <br />
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-200 to-amber-300 bg-clip-text text-transparent">
                  검증된 리셀 후보
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300">
                AI 정밀 검증을 통과한 매물을 무작위로 공개합니다.
                팩 하나당 카드 2장. 매물 판매됐으면 즉시 토큰 환불.
              </p>
            </div>
          </header>

          <section className="grid gap-5 md:grid-cols-3">
            {PACKS.map((pack) => (
              <PackCard
                key={pack.band}
                pack={pack}
                inventory={inventoryByBand.get(pack.band)}
                tokens={tokens}
                onOpen={openPack}
                busy={loading}
              />
            ))}
          </section>

          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 text-xs leading-6 text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <div className="mb-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">어떻게 동작하나요?</div>
            <ol className="list-decimal space-y-1 pl-5">
              <li>백그라운드에서 매물을 수집하고 정밀 분류해서 후보 풀을 만듭니다.</li>
              <li>토큰을 써서 팩을 열면 풀에서 카드 2장을 무작위로 뽑습니다.</li>
              <li>각 카드는 그 순간 매물이 살아있는지 다시 확인한 뒤 공개됩니다.</li>
              <li>모든 후보가 검증 실패하면 토큰을 즉시 환불해드려요.</li>
              <li>한 번 본 카드는 같은 사람에게 다시 공개되지 않습니다.</li>
            </ol>
          </section>
        </div>
      </main>

      <PackRevealModal
        open={activeBand !== null}
        band={activeBand ?? 1}
        loading={loading}
        result={result}
        onClose={handleClose}
        onLinkClicked={handleLinkClicked}
        onFeedback={handleFeedback}
        onRetry={handleRetry}
      />
    </>
  );
}

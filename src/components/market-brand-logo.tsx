import { marketplaceSourceLabel, normalizeMarketplaceSource } from "@/lib/marketplace-source";

type LogoProps = {
  className?: string;
};

export function BunjangLogo({ className = "h-4 w-4" }: LogoProps) {
  return (
    <img
      src="/brand/bunjang.webp"
      alt=""
      aria-hidden="true"
      className={`${className} shrink-0 rounded-md object-cover`}
    />
  );
}

export function DanawaLogo({ className = "h-4 w-4" }: LogoProps) {
  return (
    <img
      src="/brand/danawa.jpg"
      alt=""
      aria-hidden="true"
      className={`${className} shrink-0 rounded-md object-cover`}
    />
  );
}

export function JoongnaLogo({ className = "h-4 w-4" }: LogoProps) {
  return (
    <img
      src="/brand/jungna.svg"
      alt=""
      aria-hidden="true"
      className={`${className} shrink-0 rounded-md object-cover`}
    />
  );
}

// Wave 886.8 (2026-05-27): 당근 공식 로고 (public/brand/daangn.png) 박음. 기존 🥕 emoji 대체.
export function DaangnLogo({ className = "h-4 w-4" }: LogoProps) {
  return (
    <img
      src="/brand/daangn.png"
      alt=""
      aria-hidden="true"
      className={`${className} shrink-0 rounded-md object-contain`}
    />
  );
}

// Wave 886.8 (2026-05-27): 모든 source 배지 흰색 통일. 로고로 식별, 배경 다양화는 가시성 떨어짐.
const BADGE_BASE = "inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700";

export function DanawaSourceBadge({ label = "다나와" }: { label?: string }) {
  return (
    <span className={BADGE_BASE}>
      <DanawaLogo className="h-3.5 w-3.5 rounded-[3px]" />
      {label}
    </span>
  );
}

export function BunjangSourceBadge({ label = "번개" }: { label?: string }) {
  return (
    <span className={BADGE_BASE}>
      <BunjangLogo className="h-3.5 w-3.5 rounded-[3px]" />
      {label}
    </span>
  );
}

export function JoongnaSourceBadge({ label = "중고나라" }: { label?: string }) {
  return (
    <span className={BADGE_BASE}>
      <JoongnaLogo className="h-3.5 w-3.5 rounded-[3px]" />
      {label}
    </span>
  );
}

export function DaangnSourceBadge({ label = "당근" }: { label?: string }) {
  return (
    <span className={BADGE_BASE}>
      <DaangnLogo className="h-3.5 w-3.5 rounded-[3px]" />
      {label}
    </span>
  );
}

export function MarketplaceSourceBadge({ source, label }: { source?: string | null; label?: string | null }) {
  const normalized = normalizeMarketplaceSource(source);
  const displayLabel = label ?? marketplaceSourceLabel(normalized);
  if (normalized === "joongna") return <JoongnaSourceBadge label={displayLabel} />;
  if (normalized === "daangn") return <DaangnSourceBadge label={displayLabel} />;
  return <BunjangSourceBadge label={displayLabel} />;
}

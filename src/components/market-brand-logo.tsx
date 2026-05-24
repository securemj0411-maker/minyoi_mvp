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

export function DanawaSourceBadge({ label = "다나와" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900/50">
      <DanawaLogo className="h-3.5 w-3.5 rounded-[3px]" />
      {label}
    </span>
  );
}

export function BunjangSourceBadge({ label = "번개" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[9px] font-black text-white ring-1 ring-zinc-900/10 dark:bg-zinc-100 dark:text-zinc-900">
      <BunjangLogo className="h-3.5 w-3.5 rounded-[3px]" />
      {label}
    </span>
  );
}

export function JoongnaSourceBadge({ label = "중고나라" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-black text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60">
      <JoongnaLogo className="h-3.5 w-3.5 rounded-[3px]" />
      {label}
    </span>
  );
}

export function MarketplaceSourceBadge({ source, label }: { source?: string | null; label?: string | null }) {
  const normalized = normalizeMarketplaceSource(source);
  const displayLabel = label ?? marketplaceSourceLabel(normalized);
  if (normalized === "joongna") return <JoongnaSourceBadge label={displayLabel} />;
  return <BunjangSourceBadge label={displayLabel} />;
}

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

export function DanawaSourceBadge({ label = "다나와" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50">
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

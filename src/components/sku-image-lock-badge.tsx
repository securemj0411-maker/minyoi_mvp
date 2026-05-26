// Wave 886 (2026-05-27): SKU 일반 이미지 노출 시 "탭하면 실제 매물 사진 공개" CTA.
// 사용자에게 "이건 위장 이미지고, 진짜는 클릭하면 본다"는 신뢰 + 액션 유도.

type Props = {
  variant?: "default" | "compact";
};

export function SkuImageLockBadge({ variant = "default" }: Props) {
  const compact = variant === "compact";
  return (
    <div
      className={`pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-zinc-900/85 shadow-[0_4px_12px_rgba(0,0,0,0.25)] backdrop-blur-sm ${
        compact
          ? "bottom-1.5 left-1.5 px-2 py-1 text-[9.5px]"
          : "bottom-2 left-2 px-2.5 py-1.5 text-[10.5px]"
      }`}
      aria-label="실제 매물 사진은 탭해서 공개"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-amber-300 shrink-0`}
        aria-hidden="true"
      >
        <rect x="3" y="7" width="10" height="6.5" rx="1.4" />
        <path d="M5.5 7V5a2.5 2.5 0 1 1 5 0v2" />
      </svg>
      <span className="font-bold tracking-tight text-white whitespace-nowrap">
        {compact ? "탭해서 실제 사진" : "탭해서 실제 매물 사진 보기"}
      </span>
    </div>
  );
}

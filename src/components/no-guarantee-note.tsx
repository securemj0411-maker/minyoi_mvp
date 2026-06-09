import { DISCLAIMER_NO_GUARANTEE } from "@/lib/legal-disclaimers";

// Wave 1234b (2026-06-09): 정품/판매가능성/수익 미보장 고지 — 상품 상세·결제 전 화면 공용 노트.
//   surface마다 톤이 달라서 className 으로 여백/색 미세조정 가능. 기본은 light/dark 양쪽 안전한 muted.
export default function NoGuaranteeNote({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-[11px] leading-[1.6] text-zinc-500 dark:text-zinc-400 ${className}`.trim()}
    >
      {DISCLAIMER_NO_GUARANTEE}
    </p>
  );
}

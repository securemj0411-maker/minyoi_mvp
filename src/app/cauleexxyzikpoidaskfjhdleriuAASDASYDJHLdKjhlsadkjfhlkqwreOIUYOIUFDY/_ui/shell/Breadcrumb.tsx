// 브레드크럼 (서버-ok, pathname prop). 서브페이지에 "운영 오버뷰 › 현재화면" — 기존 '현재 위치/뒤로' 부재 해소.

import Link from "next/link";

import { OPS_ADMIN_BASE_PATH } from "@/lib/admin-routes";

import { cn, FONT, INK } from "../tokens";
import { currentSurfaceLabel } from "./nav";

export function Breadcrumb({ pathname }: { pathname: string }) {
  const label = currentSurfaceLabel(pathname);
  if (!label) return null; // 오버뷰면 트레일 없음

  return (
    <nav aria-label="이동 경로" className={cn("flex items-center gap-1.5 px-4 pt-4 sm:px-6", FONT.meta)}>
      <Link href={OPS_ADMIN_BASE_PATH} className={cn(INK.muted, "hover:text-blue-200")}>
        운영 오버뷰
      </Link>
      <span aria-hidden className={INK.faint}>
        ›
      </span>
      <span className={cn("font-bold", INK.secondary)} aria-current="page">
        {label}
      </span>
    </nav>
  );
}

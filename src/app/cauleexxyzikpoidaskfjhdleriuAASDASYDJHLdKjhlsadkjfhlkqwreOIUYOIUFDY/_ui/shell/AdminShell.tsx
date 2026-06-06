"use client";

// 영속 앱 셸 — layout.tsx(서버, auth 유지)가 마운트. children=prop 으로 받아 서버페이지 서버렌더 보존.
//   셸은 layout 에 살아 soft-nav 에도 안 풀림(티커 폴링/사이드바 유지).
//   구조: h-screen 컬럼 → 상단바(고정행) + [사이드바 | 본문] 각자 스크롤. 본문은 div(페이지가 자체 <main> 보유).

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Drawer } from "../Drawer";
import { ToastProvider } from "../Toast";
import { cn, FOCUS, SURFACE } from "../tokens";
import { Breadcrumb } from "./Breadcrumb";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  // 라우트 바뀌면 모바일 드로어 닫기.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <ToastProvider>
      <div className="flex h-screen flex-col">
        <a
          href="#admin-content"
          className={cn(
            "sr-only rounded-lg bg-blue-500 px-3 py-2 font-bold text-white",
            "focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[300]",
            FOCUS,
          )}
        >
          본문 바로가기
        </a>

        <TopBar onMenuClick={() => setMobileOpen(true)} />

        <div className="flex min-h-0 flex-1">
          <div className={cn("hidden w-60 shrink-0 overflow-y-auto border-r md:block", SURFACE.line, SURFACE.page)}>
            <Sidebar pathname={pathname} />
          </div>

          <div id="admin-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
            <Breadcrumb pathname={pathname} />
            {children}
          </div>
        </div>

        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left" title="운영자 메뉴" widthClass="max-w-xs">
          <Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      </div>
    </ToastProvider>
  );
}

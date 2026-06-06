"use client";

// 좌측 그룹 사이드바 — 직무별 nav 단일 트리. usePathname active(aria-current=page).
//   데스크탑=고정, 모바일=Drawer 안에서 재사용(onNavigate 로 닫기).

import Link from "next/link";

import { cn, FONT, FOCUS, INK, TONE } from "../tokens";
import { isItemActive, NAV_GROUPS, type NavCounts } from "./nav";

export function Sidebar({
  pathname,
  onNavigate,
  counts,
}: {
  pathname: string;
  onNavigate?: () => void;
  counts?: NavCounts;
}) {
  return (
    <nav aria-label="운영자 메뉴" className="flex flex-col gap-4 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className={cn("px-2 pb-1.5 font-black uppercase tracking-[0.14em]", FONT.meta, INK.faint)}>
            {group.label}
          </div>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isItemActive(item, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={!item.external}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-bold transition",
                      FONT.body,
                      FOCUS,
                      active
                        ? cn(TONE.blue.soft, TONE.blue.text, "ring-1 ring-inset", TONE.blue.border)
                        : cn(INK.secondary, "hover:bg-white/5 hover:text-white"),
                    )}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge && (counts?.[item.badge] ?? 0) > 0 ? (
                      <span
                        className={cn(
                          "inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 font-black tabular-nums text-white",
                          FONT.meta,
                        )}
                        aria-label={`대기 ${counts?.[item.badge]}건`}
                      >
                        {(counts?.[item.badge] ?? 0) > 99 ? "99+" : counts?.[item.badge]}
                      </span>
                    ) : null}
                    {item.external ? (
                      <span className={cn(FONT.meta, INK.faint)} aria-label="별도 화면">
                        ↗
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

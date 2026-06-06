// 운영자 nav 단일 출처 — Sidebar(active 표시) + Breadcrumb(현재 위치) 공유.
//   경로는 admin-routes 상수에서만 (하드코딩 X). 라벨은 한글.
//   기존 2중구조(상단바 라우트 6 + 페이지내 앵커 4) → 직무별 그룹 1트리로 통합.

import {
  OPS_ADMIN_BASE_PATH,
  OPS_ADMIN_DETAIL_EVENTS_PATH,
  OPS_ADMIN_EXPLORE_MONITOR_PATH,
  OPS_ADMIN_FEEDBACK_STATS_PATH,
  OPS_ADMIN_LOSS_REPORTS_PATH,
  OPS_ADMIN_MANUAL_DEPOSIT_PATH,
  OPS_ADMIN_POOL_PATH,
  OPS_ADMIN_REVEAL_ANALYTICS_PATH,
} from "@/lib/admin-routes";

export type NavItem = {
  label: string;
  href: string;
  icon: string; // 이모지(collapse/모바일 식별용). 아이콘 라이브러리 미도입.
  /** href 에 #앵커 포함 = 오버뷰 내 스크롤 타깃(라우트 아님 → active 표시 X). */
  anchor?: boolean;
  /** 별도 layout(다크 아님) 외부 화면. ↗ 표식. */
  external?: boolean;
  /** 정확히 일치할 때만 active (BASE 처럼 모든 하위의 접두사인 경우). */
  exact?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

const A = OPS_ADMIN_BASE_PATH;

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "운영",
    items: [{ label: "운영 오버뷰", href: A, icon: "🏠", exact: true }],
  },
  {
    label: "결제 · 입금",
    items: [
      { label: "멤버십 입금 확인", href: `${A}#membership-payments`, icon: "💳", anchor: true },
      { label: "수동 입금 승인", href: OPS_ADMIN_MANUAL_DEPOSIT_PATH, icon: "🧾" },
    ],
  },
  {
    label: "사용자",
    items: [
      { label: "회원 관리", href: `${A}#member-management`, icon: "👤", anchor: true },
      { label: "고객 상담", href: `${A}#customer-support`, icon: "💬", anchor: true },
    ],
  },
  {
    label: "품질 · 신고",
    items: [
      { label: "손해 신고", href: OPS_ADMIN_LOSS_REPORTS_PATH, icon: "🚩" },
      { label: "신고 통계", href: OPS_ADMIN_FEEDBACK_STATS_PATH, icon: "📈" },
    ],
  },
  {
    label: "분석",
    items: [
      { label: "열람 통계", href: OPS_ADMIN_REVEAL_ANALYTICS_PATH, icon: "📊" },
      { label: "상세 이벤트", href: OPS_ADMIN_DETAIL_EVENTS_PATH, icon: "🔎" },
      { label: "탐색 모니터", href: OPS_ADMIN_EXPLORE_MONITOR_PATH, icon: "🧭" },
    ],
  },
  {
    label: "풀 · 시스템",
    items: [
      { label: "매물 풀", href: OPS_ADMIN_POOL_PATH, icon: "📦" },
      { label: "시스템 상태", href: "/admin/status", icon: "⚙️", external: true },
    ],
  },
];

function stripHash(href: string): string {
  const i = href.indexOf("#");
  return i === -1 ? href : href.slice(0, i);
}

/** 사이드바 active 판정. 앵커/외부는 항상 false. exact 는 정확히, 그 외는 접두사. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.anchor || item.external) return false;
  const base = stripHash(item.href);
  if (item.exact) return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** 브레드크럼용 현재 화면 라벨. BASE(오버뷰)면 null(트레일 X). 매칭 없으면 null. */
export function currentSurfaceLabel(pathname: string): string | null {
  if (pathname === A) return null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.anchor || item.external) continue;
      const base = stripHash(item.href);
      if (base === A) continue;
      if (pathname === base || pathname.startsWith(`${base}/`)) return item.label;
    }
  }
  return null;
}

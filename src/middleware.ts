// Wave 731 (2026-05-24): 레퍼럴 추적 미들웨어.
// URL `?ref=ABC123` 으로 진입 시 쿠키 `minyoi_referral` 에 30일 저장.
// 가입 callback (`/auth/callback`) 에서 쿠키 읽고 추천 관계 생성.
//
// matcher: 사용자가 처음 진입할 만한 페이지만. API route / static asset 안 잡음.

import { NextRequest, NextResponse } from "next/server";

const REFERRAL_COOKIE = "minyoi_referral";
const REFERRAL_COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30일
const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/; // referral.ts 와 동일 alphabet (헷갈리는 문자 제외)
const DAANGN_WORKER_ONLY_CRON_PATHS: Record<string, Set<string>> = {
  daangn_b: new Set([
    "/api/cron/daangn-worker-b",
    "/api/cron/score-worker-b",
    "/api/cron/daangn-detail-worker",
  ]),
  daangn_c: new Set([
    "/api/cron/daangn-worker-c",
    "/api/cron/daangn-detail-worker",
  ]),
};

function cronProjectRole() {
  return String(process.env.CRON_PROJECT_ROLE ?? "").trim().toLowerCase();
}

function isDaangnWorkerOnlyProject() {
  const role = cronProjectRole();
  return role === "daangn_b" || role === "daangn_c";
}

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (isDaangnWorkerOnlyProject()) {
    const role = cronProjectRole();
    if (DAANGN_WORKER_ONLY_CRON_PATHS[role]?.has(path)) return NextResponse.next();
    if (path.startsWith("/api/cron/")) {
      return NextResponse.json({
        ok: true,
        started: false,
        skipped: true,
        reason: "project_role_disabled",
        projectRole: role,
        path,
      });
    }
    return new NextResponse("Not found", { status: 404 });
  }

  const ref = url.searchParams.get("ref");
  if (!ref) return NextResponse.next();

  const normalized = ref.toUpperCase();
  if (!REFERRAL_CODE_PATTERN.test(normalized)) return NextResponse.next();

  const res = NextResponse.next();
  res.cookies.set(REFERRAL_COOKIE, normalized, {
    maxAge: REFERRAL_COOKIE_TTL_SECONDS,
    sameSite: "lax",
    path: "/",
    // httpOnly: false — auth-form.tsx (client) 에서도 prefill 용으로 읽을 수 있게
  });
  return res;
}

// Daangn-B 전용 프로젝트에서는 프론트/API 전체를 차단해야 하므로 모든 앱 라우트를 본다.
// 정적 에셋은 제외해서 일반 프로젝트의 asset path 비용/동작은 건드리지 않는다.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2)$).*)",
  ],
};

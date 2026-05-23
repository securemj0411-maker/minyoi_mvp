// Wave 731 (2026-05-24): 레퍼럴 추적 미들웨어.
// URL `?ref=ABC123` 으로 진입 시 쿠키 `minyoi_referral` 에 30일 저장.
// 가입 callback (`/auth/callback`) 에서 쿠키 읽고 추천 관계 생성.
//
// matcher: 사용자가 처음 진입할 만한 페이지만. API route / static asset 안 잡음.

import { NextRequest, NextResponse } from "next/server";

const REFERRAL_COOKIE = "minyoi_referral";
const REFERRAL_COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30일
const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/; // referral.ts 와 동일 alphabet (헷갈리는 문자 제외)

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
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

// 사용자 첫 진입 페이지에만 적용 — API / static / image 제외
export const config = {
  matcher: ["/", "/signup", "/login", "/invite", "/how-it-works", "/plans"],
};

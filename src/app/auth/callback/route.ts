import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { classifyOAuthCallbackError } from "@/lib/auth-error-messages";
import { createReferralAndGrantSignupBonus, ensureReferralCode } from "@/lib/referral";
import { userRefForAuthUser } from "@/lib/user-ref";
import { getProStatus, hasMembershipAccess } from "@/lib/user-subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/me";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));
  const origin = requestUrl.origin;

  // Wave 724 (2026-05-23): 카카오/Supabase 가 OAuth 거절/실패 시 보내는 `error`, `error_description` 처리.
  //   이전엔 `code` 없음만 잡아서 사용자 취소(access_denied)와 DB 에러(server_error)를 같은 메시지로 묶음.
  //   사용자가 같은 화면에서 무한 retry 하는 stuck 패턴 방지.
  const providerError = requestUrl.searchParams.get("error");
  const providerErrorDesc = requestUrl.searchParams.get("error_description");
  if (providerError) {
    // 운영자 추적용 로그. response/redirect URL 엔 자세한 desc 노출 X.
    console.error("[auth/callback] provider error", {
      error: providerError,
      description: providerErrorDesc,
    });
    const code = classifyOAuthCallbackError(providerError, providerErrorDesc);
    return NextResponse.redirect(`${origin}/login?auth=${code}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?auth=missing-code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/login?auth=missing-env`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Route handlers can set cookies; this protects future reuse in read-only contexts.
        }
      },
    },
  });

  const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Wave 724: 운영자 추적용 로그. DB 저장 실패면 oauth-db-error 로 분기.
    console.error("[auth/callback] exchangeCodeForSession failed", error.message);
    if (/database/i.test(error.message)) {
      return NextResponse.redirect(`${origin}/login?auth=oauth-db-error`);
    }
    return NextResponse.redirect(`${origin}/login?auth=exchange-failed`);
  }

  // Wave 731 (2026-05-24): 레퍼럴 처리
  //   1. 가입자에게 referral_code 자동 부여 (없으면 생성)
  //   2. 쿠키 `minyoi_referral` 있으면 추천 관계 생성 + 양쪽 +5 토큰
  //   가입 자체 흐름은 막지 않음 — 보상 실패해도 redirect 진행.
  const authUser = exchangeData?.user;
  if (authUser?.id) {
    const userRef = userRefForAuthUser(authUser.id);
    try {
      await ensureReferralCode(authUser.id, userRef);
    } catch (err) {
      console.warn("[auth/callback] ensureReferralCode failed", err instanceof Error ? err.message : String(err));
    }

    // Wave 733 (2026-05-24): URL ?ref= 먼저 (signInWithOAuth redirectTo 에 박힘), 쿠키 fallback.
    //   카카오 OAuth flow 중 쿠키 손실 가능성 → URL 이 더 안전.
    const refFromUrl = requestUrl.searchParams.get("ref");
    const refFromCookie = cookieStore.get("minyoi_referral")?.value;
    const referrerCode = refFromUrl || refFromCookie;
    if (referrerCode) {
      console.log("[auth/callback] referral signup attempt", {
        source: refFromUrl ? "url" : "cookie",
        code: referrerCode,
        userId: authUser.id,
      });
      try {
        const result = await createReferralAndGrantSignupBonus({
          referrerCode,
          referredUserId: authUser.id,
          referredUserRef: userRef,
        });
        if (!result.ok) {
          console.warn("[auth/callback] referral signup skipped", { reason: result.error, code: referrerCode });
        } else {
          console.log("[auth/callback] referral signup granted", { code: referrerCode, userId: authUser.id });
        }
      } catch (err) {
        console.warn("[auth/callback] referral signup threw", err instanceof Error ? err.message : String(err));
      }
      // 쿠키 clear (한 번 시도) — URL 은 redirect 후 사라짐
      try {
        cookieStore.set("minyoi_referral", "", { maxAge: 0, path: "/" });
      } catch {
        // route handler 외부 context 에서 set 실패 가능 — silent
      }
    }
  }

  // Wave 1212 (2026-06-06, audit P2): next가 기본 피드 착지(/me)인데 비멤버면 → /plans로 직접 보내
  //   이중 점프(로그인 → /me 잠깐 → /plans) 깜빡임 제거. (멤버나 명시적 next는 그대로.)
  let finalNext = next;
  if (next === "/me" && authUser?.id) {
    try {
      const membership = await getProStatus(authUser, userRefForAuthUser(authUser.id));
      if (!hasMembershipAccess(membership)) finalNext = "/plans";
    } catch {
      // 멤버십 조회 실패 시 기본 next 유지 (/me가 다시 게이트로 처리).
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    return NextResponse.redirect(`${forwardedProto}://${forwardedHost}${finalNext}`);
  }

  return NextResponse.redirect(`${origin}${finalNext}`);
}

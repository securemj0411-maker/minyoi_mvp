import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { classifyOAuthCallbackError } from "@/lib/auth-error-messages";

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Wave 724: 운영자 추적용 로그. DB 저장 실패면 oauth-db-error 로 분기.
    console.error("[auth/callback] exchangeCodeForSession failed", error.message);
    if (/database/i.test(error.message)) {
      return NextResponse.redirect(`${origin}/login?auth=oauth-db-error`);
    }
    return NextResponse.redirect(`${origin}/login?auth=exchange-failed`);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    return NextResponse.redirect(`${forwardedProto}://${forwardedHost}${next}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

// Wave 1230 (2026-06-08): 광고 유입 추적.
//   계기: owner — "구글 애즈가 진짜 우리 사이트로 오는지 확인하고 싶다. Final URL에 쿼리 달고 DB 카운팅."
//   동작: 메인 페이지(server)가 광고 신호(?src= / utm_* / gclid·gbraid·wbraid) 감지 → mvp_ad_visits 1건 기록.
//   원칙: 페이지 렌더를 절대 막지 않음(모든 에러 무시). 일반 방문(광고 신호 없음)은 기록 안 함.

import { headers } from "next/headers";

import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * 광고 유입이면 mvp_ad_visits 에 1건 기록. 광고 신호 없으면 no-op.
 * 절대 throw 안 함 — 추적 실패가 페이지를 깨면 안 됨.
 */
export async function logAdVisitIfPresent(searchParams: SearchParams, landingPath = "/"): Promise<void> {
  try {
    const gclid = first(searchParams.gclid);
    const gbraid = first(searchParams.gbraid);
    const wbraid = first(searchParams.wbraid);
    const utmSource = first(searchParams.utm_source);
    const src = first(searchParams.src);

    const clickId = gclid ?? gbraid ?? wbraid ?? null;
    const clickIdType = gclid ? "gclid" : gbraid ? "gbraid" : wbraid ? "wbraid" : null;
    const source = utmSource ?? src ?? (clickId ? "google_ads" : null);

    // 광고 신호 전혀 없으면 기록 안 함 (일반 유기 방문 제외).
    if (!source && !clickId) return;

    const headerStore = await headers();
    const userAgent = headerStore.get("user-agent") ?? "";
    // Wave 1230b: 봇 제외 — 구글 크롤러/AdsBot 이 Final URL 검증하느라 들어옴(진짜 사람 아님).
    //   진짜 광고 클릭은 모바일/데스크탑 브라우저 UA. 봇 UA면 기록 안 함 → count(*)=진짜 사람.
    if (/bot|crawl|spider|slurp|mediapartners|headless|facebookexternalhit|lighthouse|monitor|preview|google-|googleother|googleweblight/i.test(userAgent)) {
      return;
    }
    // Wave 1230c: IP + 지역(Vercel edge geo) 기록 — 관리자에서 기기/IP/지역 확인용.
    const ip =
      (headerStore.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      null;
    const cityRaw = headerStore.get("x-vercel-ip-city");
    const row = {
      source,
      medium: first(searchParams.utm_medium),
      campaign: first(searchParams.utm_campaign),
      content: first(searchParams.utm_content),
      term: first(searchParams.utm_term),
      click_id: clickId,
      click_id_type: clickIdType,
      landing_path: landingPath,
      ip,
      country: headerStore.get("x-vercel-ip-country") || null,
      city: cityRaw ? decodeURIComponent(cityRaw) : null,
      region: headerStore.get("x-vercel-ip-country-region") || null,
      referer: (headerStore.get("referer") ?? "").slice(0, 500) || null,
      user_agent: userAgent.slice(0, 400) || null,
    };

    await restFetch(tableUrl("mvp_ad_visits"), {
      method: "POST",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody(row),
    });
  } catch {
    // 추적 실패는 절대 페이지에 영향 주지 않음.
  }
}

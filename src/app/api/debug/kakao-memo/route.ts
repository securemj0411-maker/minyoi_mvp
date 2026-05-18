import { NextRequest, NextResponse } from "next/server";

import { requireDebugAdmin } from "@/lib/debug-admin";
import { DEFAULT_KAKAO_MEMO_TEMPLATE_ID } from "@/lib/kakao";

export const runtime = "nodejs";
export const maxDuration = 30;

type KakaoMemoPayload = {
  kakaoAccessToken?: string;
  mode?: "default" | "custom";
  linkUrl?: string;
  text?: string;
  templateId?: string;
  templateArgs?: Record<string, string | number | boolean | null>;
};

function appBaseUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return req.nextUrl.origin.replace(/\/$/, "");
}

function safeLinkUrl(req: NextRequest, raw: unknown) {
  const fallback = `${appBaseUrl(req)}/me`;
  if (typeof raw !== "string" || raw.trim().length === 0) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function trimText(value: unknown, fallback: string, max: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

async function readJson(req: NextRequest): Promise<KakaoMemoPayload> {
  try {
    const body = await req.json();
    return typeof body === "object" && body !== null ? body as KakaoMemoPayload : {};
  } catch {
    return {};
  }
}

async function kakaoPost(path: string, token: string, params: URLSearchParams) {
  const res = await fetch(`https://kapi.kakao.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: params.toString(),
  });
  const raw = await res.text();
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {}
  return { res, data };
}

export async function POST(req: NextRequest) {
  const auth = await requireDebugAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const payload = await readJson(req);
  const kakaoAccessToken = payload.kakaoAccessToken?.trim();
  if (!kakaoAccessToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "kakaoAccessToken is required",
        hint: "카카오 scope 재동의 후 Supabase session.provider_token을 보내야 합니다.",
      },
      { status: 400 },
    );
  }

  const linkUrl = safeLinkUrl(req, payload.linkUrl);
  const mode = payload.mode === "custom" ? "custom" : "default";
  const params = new URLSearchParams();
  let path = "/v2/api/talk/memo/default/send";

  if (mode === "custom") {
    path = "/v2/api/talk/memo/send";
    params.set("template_id", trimText(
      payload.templateId ?? process.env.KAKAO_MEMO_TEMPLATE_ID ?? DEFAULT_KAKAO_MEMO_TEMPLATE_ID,
      DEFAULT_KAKAO_MEMO_TEMPLATE_ID,
      24,
    ));
    params.set("template_args", JSON.stringify({
      PRODUCT_NAME: "차익잡이 테스트 추천",
      PROFIT: "+67,057원",
      URL: linkUrl,
      ...payload.templateArgs,
    }));
  } else {
    const text = trimText(
      payload.text,
      "차익잡이 테스트 알림\n새 추천 후보가 도착했어요. 버튼을 눌러 /me에서 확인해보세요.",
      200,
    );
    params.set("template_object", JSON.stringify({
      object_type: "text",
      text,
      link: {
        web_url: linkUrl,
        mobile_web_url: linkUrl,
      },
      button_title: "추천 확인하기",
    }));
  }

  const { res, data } = await kakaoPost(path, kakaoAccessToken, params);
  const ok = res.ok && typeof data === "object" && data !== null && (data as { result_code?: number }).result_code === 0;
  return NextResponse.json({
    ok,
    mode,
    status: res.status,
    data,
    sentAt: new Date().toISOString(),
  }, { status: ok ? 200 : res.status || 502 });
}

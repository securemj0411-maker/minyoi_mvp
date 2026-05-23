// Wave launch-96: 운영자 텔레그램 link 클릭 → 신청 승인/거절.
//   GET (link 클릭) 또는 POST (admin UI). admin auth 필수.

import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { grantManualDeposit, rejectManualDeposit, type ManualDepositRequest } from "@/lib/manual-deposit-grant";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, decision: "approve" | "reject", id: number) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) {
    // 운영자 로그인 redirect 안내 HTML (텔레그램 link 클릭 시).
    return new NextResponse(loginPromptHtml(req.url), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  if (!isAdminUser(auth.user)) {
    return new NextResponse(forbiddenHtml(), { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const lookupRes = await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?select=*&id=eq.${id}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!lookupRes.ok) {
    return new NextResponse(resultHtml("조회 실패", "DB 응답이 비정상이에요."), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const rows = (await lookupRes.json()) as ManualDepositRequest[];
  const request = rows[0];
  if (!request) {
    return new NextResponse(resultHtml("신청 없음", `신청 #${id} 가 없어요.`), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  if (request.status !== "pending") {
    return new NextResponse(resultHtml("이미 처리됨", `신청 #${id} 상태: ${request.status}`), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  if (decision === "approve") {
    const result = await grantManualDeposit(request, "admin");
    if (!result.ok) {
      return new NextResponse(resultHtml("승인 실패", result.error ?? "unknown"), { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return new NextResponse(resultHtml(
      "✅ 승인 완료",
      `${request.depositor_name} 회원에게 ${request.amount.toLocaleString("ko-KR")} 크레딧 지급 완료 (잔액 ${result.newBalance?.toLocaleString("ko-KR")})`,
    ), { headers: { "content-type": "text/html; charset=utf-8" } });
  } else {
    await rejectManualDeposit(request);
    return new NextResponse(resultHtml(
      "❌ 거절 완료",
      `${request.depositor_name} 회원 신청 #${id} 거절됨. 크레딧 지급 X.`,
    ), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const idRaw = url.searchParams.get("id");
  const decisionRaw = url.searchParams.get("decision");
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (decisionRaw !== "approve" && decisionRaw !== "reject") {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }
  return handle(req, decisionRaw, id);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

function htmlShell(title: string, body: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Pretendard Variable",sans-serif;background:#f5f7fb;color:#191f28;margin:0;padding:24px;display:flex;align-items:center;justify-content:center;min-height:100vh}main{max-width:420px;width:100%;background:#fff;border-radius:24px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.08);text-align:center}h1{font-size:22px;font-weight:900;margin:0 0 12px}p{font-size:14px;color:#6b7684;line-height:1.6;margin:0}a{color:#3182f6;font-weight:800;text-decoration:none}</style></head><body><main>${body}</main></body></html>`;
}

function loginPromptHtml(returnUrl: string): string {
  return htmlShell("로그인 필요", `<h1>로그인 필요</h1><p>운영자 계정으로 로그인 후 다시 클릭해주세요.<br/><a href="/login?next=${encodeURIComponent(returnUrl)}">로그인하러 가기</a></p>`);
}

function forbiddenHtml(): string {
  return htmlShell("권한 없음", `<h1>권한 없음</h1><p>운영자 계정이 아니에요.</p>`);
}

function resultHtml(title: string, message: string): string {
  return htmlShell(title, `<h1>${title}</h1><p>${message.replace(/</g, "&lt;")}</p>`);
}

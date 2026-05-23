// Wave launch-103: 피드백 승인/거절. 승인 시 +20 크레딧 grant. HTML 응답 (텔레그램 link 클릭).
// Wave launch-107 (2026-05-24): sold_out 카테고리 풀 status 처리.
//   submit 단계에서 임시 invalidate (reason=user_report_sold_pending:fbXXX) 박혀 있음.
//   approve → user_report_sold_confirmed + raw_listings.listing_state=sold_confirmed (정식)
//   reject  → status=ready 복귀 + reason 클리어 (단, 다른 이유로 invalidate 됐으면 보존)

import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: number;
  auth_user_id: string;
  user_ref: string;
  category: string;
  status: string;
  reward_amount: number;
  pid: number | null;
};

async function handle(req: NextRequest, decision: "approve" | "reject", id: number) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return new NextResponse(loginHtml(req.url), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
  if (!isAdminUser(auth.user)) return new NextResponse(forbiddenHtml(), { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });

  const lookupRes = await restFetch(
    `${tableUrl("mvp_user_feedback")}?select=*&id=eq.${id}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!lookupRes.ok) return new NextResponse(resultHtml("조회 실패", "DB 응답이 비정상이에요."), { headers: { "content-type": "text/html; charset=utf-8" } });
  const rows = (await lookupRes.json()) as FeedbackRow[];
  const fb = rows[0];
  if (!fb) return new NextResponse(resultHtml("신고 없음", `피드백 #${id} 가 없어요.`), { headers: { "content-type": "text/html; charset=utf-8" } });
  if (fb.status !== "pending") {
    return new NextResponse(resultHtml("이미 처리됨", `피드백 #${id} 상태: ${fb.status}`), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const nowIso = new Date().toISOString();

  if (decision === "approve") {
    // 1) 크레딧 grant (RPC refund_mvp_user_credits 재사용)
    const grantRes = await restFetch(
      `${(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/rest/v1/rpc/refund_mvp_user_credits`,
      {
        method: "POST",
        headers: serviceHeaders(),
        body: jsonBody({
          p_user_ref: fb.user_ref,
          p_auth_user_id: fb.auth_user_id,
          p_amount: fb.reward_amount,
          p_metadata: {
            source: "feedback_reward",
            feedback_id: fb.id,
            admin_email: auth.user.email ?? null,
          },
        }),
      },
    );
    if (!grantRes.ok) {
      const text = await grantRes.text().catch(() => "");
      console.error("[feedback/decide] grant failed", { status: grantRes.status, body: text.slice(0, 200) });
      return new NextResponse(resultHtml("크레딧 지급 실패", text.slice(0, 200)), { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    const grantRows = (await grantRes.json()) as Array<{ balance?: number }>;
    const newBalance = grantRows[0]?.balance ?? null;

    // 2) status update + reward_granted_at
    await restFetch(
      `${tableUrl("mvp_user_feedback")}?id=eq.${fb.id}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: jsonBody({
          status: "approved",
          decided_at: nowIso,
          decided_by: "admin",
          reward_granted_at: nowIso,
        }),
      },
    );

    // Wave launch-107: sold_out approve — pool reason 정정 + raw_listings 정식 sold_confirmed.
    //   submit 단계에서 이미 status=invalidated 박혀 있으니 reason 만 정정 + 원본 매물 마킹.
    //   recovery-worker 가 user_report_sold_confirmed reason 도 차단해야 다시 복귀 안 함 (별도 patch).
    let poolNote = "";
    if (fb.category === "sold_out" && fb.pid != null) {
      await Promise.allSettled([
        restFetch(
          `${tableUrl("mvp_candidate_pool")}?pid=eq.${fb.pid}`,
          {
            method: "PATCH",
            headers: { ...serviceHeaders(), Prefer: "return=minimal" },
            body: jsonBody({
              invalidated_reason: `user_report_sold_confirmed:fb${fb.id}`,
              updated_at: nowIso,
            }),
          },
        ),
        restFetch(
          `${tableUrl("mvp_raw_listings")}?pid=eq.${fb.pid}`,
          {
            method: "PATCH",
            headers: { ...serviceHeaders(), Prefer: "return=minimal" },
            body: jsonBody({
              listing_state: "sold_confirmed",
              sold_detected_at: nowIso,
              updated_at: nowIso,
            }),
          },
        ),
      ]);
      poolNote = `<br/><span style="color:#34d399">매물 #${fb.pid} 정식 sold_confirmed 마킹.</span>`;
    }

    // 3) ledger event_type=feedback_reward (RPC 가 이미 박지만 명시 metadata 보강 — RPC 결과에 의존)
    return new NextResponse(resultHtml(
      "✅ 승인 + 보상 지급",
      `피드백 #${id} 승인. +${fb.reward_amount} 크레딧 (잔액 ${newBalance?.toLocaleString("ko-KR") ?? "-"})${poolNote}`,
    ), { headers: { "content-type": "text/html; charset=utf-8" } });
  } else {
    await restFetch(
      `${tableUrl("mvp_user_feedback")}?id=eq.${fb.id}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
        body: jsonBody({ status: "rejected", decided_at: nowIso, decided_by: "admin" }),
      },
    );

    // Wave launch-107: sold_out reject — submit 단계에서 임시 invalidate 한 거 복귀.
    //   단, 다른 이유 (cron 의 진짜 sold 감지 등) 로 invalidate 됐으면 보존.
    //   reason prefix "user_report_sold_pending:fb<id>" 정확 매칭으로만 복귀.
    let poolNote = "";
    if (fb.category === "sold_out" && fb.pid != null) {
      const expectedReason = `user_report_sold_pending:fb${fb.id}`;
      const revertRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?pid=eq.${fb.pid}&status=eq.invalidated&invalidated_reason=eq.${encodeURIComponent(expectedReason)}`,
        {
          method: "PATCH",
          headers: { ...serviceHeaders(), Prefer: "return=representation" },
          body: jsonBody({
            status: "ready",
            invalidated_reason: null,
            updated_at: nowIso,
            score_dirty: true,
          }),
        },
      );
      if (revertRes.ok) {
        const reverted = (await revertRes.json().catch(() => [])) as Array<unknown>;
        poolNote = reverted.length > 0
          ? `<br/><span style="color:#fbbf24">매물 #${fb.pid} 풀로 자동 복귀.</span>`
          : `<br/><span style="color:#a1a1aa">매물 #${fb.pid} 풀 복귀 안 함 (다른 이유로 이미 invalidate 됨).</span>`;
      }
    }

    return new NextResponse(resultHtml(
      "❌ 거절 완료",
      `피드백 #${id} 거절됨. 보상 지급 X.${poolNote}`,
    ), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const decision = url.searchParams.get("decision");
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  return handle(req, decision, id);
}
export async function POST(req: NextRequest) { return GET(req); }

function htmlShell(title: string, body: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Pretendard Variable",sans-serif;background:#0a0a0a;color:#fafafa;margin:0;padding:24px;display:flex;align-items:center;justify-content:center;min-height:100vh}main{max-width:420px;width:100%;background:#18181b;border:1px solid #27272a;border-radius:8px;padding:32px;text-align:center;font-family:"SFMono-Regular",Consolas,monospace}h1{font-size:18px;font-weight:900;margin:0 0 12px;color:#fbbf24;letter-spacing:0.04em}p{font-size:13px;color:#a1a1aa;line-height:1.6;margin:0}a{color:#fbbf24;font-weight:800;text-decoration:none}</style></head><body><main>${body}</main></body></html>`;
}
function loginHtml(returnUrl: string): string {
  return htmlShell("LOGIN", `<h1>LOGIN REQUIRED</h1><p>운영자 계정으로 로그인 후 다시 클릭해주세요.<br/><a href="/login?next=${encodeURIComponent(returnUrl)}">로그인</a></p>`);
}
function forbiddenHtml(): string { return htmlShell("FORBIDDEN", `<h1>FORBIDDEN</h1><p>운영자 계정이 아니에요.</p>`); }
function resultHtml(title: string, message: string): string {
  return htmlShell(title, `<h1>${title}</h1><p>${message.replace(/</g, "&lt;")}</p>`);
}

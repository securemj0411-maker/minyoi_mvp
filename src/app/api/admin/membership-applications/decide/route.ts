import { NextResponse, type NextRequest } from "next/server";
import { hasAdminActionHeader, verifyAdminActionToken } from "@/lib/admin-action-token";
import { isAdminUser } from "@/lib/auth-users";
import {
  approveMembershipApplication,
  rejectMembershipApplication,
  type MembershipDecisionSource,
} from "@/lib/membership-application-approval";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Decision = "approve" | "reject";

async function decideApplication(
  id: number,
  decision: Decision,
  source: MembershipDecisionSource,
  decidedByUserId: string | null,
  adminNote: string | null = null,
) {
  if (decision === "approve") {
    return approveMembershipApplication(id, source, decidedByUserId);
  }
  return rejectMembershipApplication(id, source, decidedByUserId, adminNote);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const decision = url.searchParams.get("decision");
  const token = url.searchParams.get("token");
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  if (!verifyAdminActionToken("membership_application", id, decision, token)) {
    return new NextResponse(actionGuardHtml(), { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const actionUrl = `/api/admin/membership-applications/decide?id=${id}&decision=${decision}&token=${encodeURIComponent(token ?? "")}`;
  return new NextResponse(confirmHtml(id, decision, actionUrl), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function handleTelegramTokenPost(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const decision = url.searchParams.get("decision");
  const token = url.searchParams.get("token");
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  if (!verifyAdminActionToken("membership_application", id, decision, token)) {
    return new NextResponse(actionGuardHtml(), { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const form = await req.formData().catch(() => null);
  if (form?.get("confirm") !== "1") {
    return new NextResponse(resultHtml("확인 필요", "승인/거절 확인 버튼을 눌러야 처리됩니다."), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  let result: Awaited<ReturnType<typeof decideApplication>>;
  try {
    result = await decideApplication(id, decision, "telegram", null);
  } catch (err) {
    console.error("[admin/membership-applications/decide] telegram decision failed", {
      id,
      decision,
      message: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse(resultHtml("처리 실패", "server_error"), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  if (!result.ok) {
    return new NextResponse(resultHtml("처리 실패", result.error ?? "unknown"), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  if (result.status && result.status !== "pending" && !result.activated && decision === "approve") {
    return new NextResponse(resultHtml("이미 처리됨", `신청 #${id} 상태: ${result.status}`), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const title = decision === "approve" ? "✅ 멤버십 승인 완료" : "❌ 멤버십 거절 완료";
  const message = decision === "approve"
    ? `신청 #${id} 멤버십이 활성화됐어요. 사용자는 곧 피드로 이동합니다.`
    : `신청 #${id} 예약이 거절됐어요.`;
  return new NextResponse(resultHtml(title, message), { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.has("token")) {
    return handleTelegramTokenPost(req);
  }

  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  if (!hasAdminActionHeader(req.headers)) {
    return NextResponse.json({ error: "missing_admin_action_header" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = Number(payload.id);
  const decision = typeof payload.decision === "string" ? payload.decision.trim() : "";
  const adminNote = typeof payload.adminNote === "string" ? payload.adminNote.trim().slice(0, 1000) : "";
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "invalid_decision" }, { status: 400 });

  const result = await decideApplication(id, decision, "admin", auth.user.id, adminNote);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "decision_failed", status: result.status }, { status: 409 });

  return NextResponse.json({
    ok: true,
    id: result.id,
    status: result.status,
    authUserId: result.authUserId,
    planEndAt: result.planEndAt ?? null,
    activated: result.activated,
  });
}

function htmlShell(title: string, body: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Pretendard Variable",sans-serif;background:#f5f7fb;color:#191f28;margin:0;padding:24px;display:flex;align-items:center;justify-content:center;min-height:100vh}main{max-width:420px;width:100%;background:#fff;border-radius:24px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.08);text-align:center}h1{font-size:22px;font-weight:900;margin:0 0 12px}p{font-size:14px;color:#6b7684;line-height:1.6;margin:0}.actions{margin-top:20px;display:grid;gap:10px}button{width:100%;border:0;border-radius:14px;padding:14px 16px;background:#111827;color:#fff;font-size:15px;font-weight:900;cursor:pointer}button.reject{background:#991b1b}.hint{margin-top:12px;font-size:12px;color:#8b95a1}</style></head><body><main>${body}</main></body></html>`;
}

function actionGuardHtml(): string {
  return htmlShell("보안 확인 필요", `<h1>보안 확인 필요</h1><p>이전 링크이거나 유효하지 않은 승인 링크예요.<br/>관리자 페이지에서 다시 처리해주세요.</p>`);
}

function resultHtml(title: string, message: string): string {
  return htmlShell(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`);
}

function confirmHtml(id: number, decision: Decision, actionUrl: string): string {
  const isApprove = decision === "approve";
  const title = isApprove ? "멤버십 승인 확인" : "멤버십 거절 확인";
  const label = isApprove ? "멤버십 승인 실행" : "멤버십 거절 실행";
  const message = isApprove
    ? `신청 #${id} 멤버십을 활성화할까요?`
    : `신청 #${id} 예약을 거절할까요?`;
  return htmlShell(title, [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(message)}</p>`,
    `<form class="actions" method="post" action="${escapeHtml(actionUrl)}">`,
    `<input type="hidden" name="confirm" value="1" />`,
    `<button class="${isApprove ? "" : "reject"}" type="submit">${escapeHtml(label)}</button>`,
    `</form>`,
    `<p class="hint">텔레그램/브라우저 링크 미리보기는 이 화면까지만 열고, 버튼을 눌러야 실제 처리됩니다.</p>`,
  ].join(""));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

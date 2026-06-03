import { NextResponse } from "next/server";
import { notifyAdminTelegram } from "@/lib/telegram-notify";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { getProStatus } from "@/lib/user-subscription";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeMarkdown(value: string) {
  return value.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const status = await getProStatus(auth.user, userRef);
  if (status.isPro || status.isAdmin || status.isBetaTester) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const email = auth.user.email ?? "email 없음";
  const name = auth.user.user_metadata?.name ?? auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.nickname ?? "이름 없음";
  await notifyAdminTelegram(
    [
      "*[득템잡이] 선공개 멤버십 신청*",
      `이름: ${escapeMarkdown(String(name))}`,
      `이메일: ${escapeMarkdown(email)}`,
      `auth_user_id: \`${auth.user.id}\``,
      `user_ref: \`${userRef}\``,
      "상품: 선공개 300명 멤버십 / 3개월 99,000원",
    ].join("\n"),
  );

  return NextResponse.json({ ok: true });
}

// Wave 102 (2026-05-15): admin 전용 회원 목록 페이지. URL obfuscation + admin auth 이중 보호.
//   비admin은 notFound() → URL 존재 자체 노출 X.
// Wave launch-108 (2026-05-24): layout.tsx 가 admin auth + AdminTopBar (sticky nav + KPI ticker) 공유.
//   이 페이지는 본문만 (헤더 / nav / KPI 다 layout 으로 위임). 페이지 전환 시 sticky bar 유지.

import Link from "next/link";

import { OPS_ADMIN_REVEAL_ANALYTICS_PATH } from "@/lib/admin-routes";
import { approveMembershipApplication } from "@/lib/membership-application-approval";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { userRefForAuthUser } from "@/lib/user-ref";
import MembersTable, { type MemberRow } from "./members-table";
import FeedbackPanel from "./feedback-panel";
import MembershipApplicationsPanel, { type MembershipApplicationRow } from "./membership-applications-panel";
import SupportChatPanel from "./support-chat-panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  app_metadata?: { provider?: string };
  user_metadata?: AuthUserMetadata;
  raw_user_meta_data?: AuthUserMetadata;
  identities?: Array<{ identity_data?: AuthUserMetadata | null }> | null;
};

type AuthUserMetadata = Record<string, unknown> & {
  name?: string;
  full_name?: string;
  preferred_username?: string;
  nickname?: string;
};

type CreditRow = {
  auth_user_id: string;
  user_ref: string;
  balance: number;
  free_grant_tokens: number;
  free_granted_at: string | null;
  pro_until: string | null;
  is_beta_tester: boolean | null;
  beta_tester_granted_at: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
};

type PlanRow = {
  auth_user_id: string;
  plan_key: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  daily_used_count: number;
  last_payment_at: string | null;
  last_payment_amount: number | null;
};

type MembershipApplicationDbRow = {
  id: number;
  user_ref: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  application_kind: "new" | "renewal" | null;
  product_key: string;
  price_krw: number;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  deposit_confirmed_at: string | null;
  scheduled_auto_approve_at: string | null;
  decided_at: string | null;
  created_at: string;
};

type SupportConversationDbRow = {
  id: number;
  auth_user_id: string;
  user_email: string | null;
  user_display_name: string | null;
  status: "open" | "closed";
  admin_unread_count: number | null;
  user_unread_count: number | null;
  last_message_at: string;
  created_at: string;
};

const UNPAID_RESERVATION_MS = 7 * 60_000;

function adminNoteLine(message: string) {
  return `[${new Date().toISOString()}] ${message}`;
}

async function reconcileMembershipApplicationsForAdmin() {
  const nowIso = new Date().toISOString();
  const unpaidCutoffIso = new Date(Date.now() - UNPAID_RESERVATION_MS).toISOString();

  await restFetch(
    `${tableUrl("mvp_membership_applications")}?status=eq.pending&deposit_confirmed_at=is.null&created_at=lt.${encodeURIComponent(unpaidCutoffIso)}`,
    {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        status: "rejected",
        decided_at: nowIso,
        updated_at: nowIso,
        admin_note: adminNoteLine("auto_expired_unpaid_reservation_7m_admin_view"),
      }),
    },
  ).catch((err) => {
    console.warn("[admin/members] unpaid reservation cleanup failed", err instanceof Error ? err.message : String(err));
  });

  const dueRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id&status=eq.pending&deposit_confirmed_at=not.is.null&scheduled_auto_approve_at=lte.${encodeURIComponent(nowIso)}&order=scheduled_auto_approve_at.asc&limit=30`,
    { headers: serviceHeaders(), cache: "no-store" },
  ).catch((err) => {
    console.warn("[admin/members] due membership lookup failed", err instanceof Error ? err.message : String(err));
    return null;
  });
  if (!dueRes?.ok) return;
  const dueRows = (await dueRes.json().catch(() => [])) as Array<{ id: number }>;
  for (const row of dueRows) {
    if (!Number.isFinite(row.id)) continue;
    try {
      await approveMembershipApplication(row.id, "auto", null);
    } catch (err) {
      console.warn("[admin/members] inline auto approve failed", row.id, err instanceof Error ? err.message : String(err));
    }
  }
}

async function fetchAuthUsers(): Promise<AuthUser[]> {
  const base = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return [];
  const all: AuthUser[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetch(`${base}/auth/v1/admin/users?per_page=200&page=${page}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = (await res.json()) as { users?: AuthUser[] };
    const users = data.users ?? [];
    all.push(...users);
    if (users.length < 200) break;
  }
  return all;
}

async function fetchAllCredits(): Promise<CreditRow[]> {
  const res = await fetch(
    `${tableUrl("mvp_user_credits")}?select=auth_user_id,user_ref,balance,free_grant_tokens,free_granted_at,pro_until,is_beta_tester,beta_tester_granted_at,blocked_at,blocked_reason,created_at,updated_at&limit=10000`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as CreditRow[];
}

async function fetchAllPlans(): Promise<PlanRow[]> {
  const res = await fetch(
    `${tableUrl("mvp_user_plans")}?select=auth_user_id,plan_key,status,cancel_at_period_end,current_period_end,daily_used_count,last_payment_at,last_payment_amount&limit=10000`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as PlanRow[];
}

async function fetchMembershipApplications(): Promise<MembershipApplicationRow[]> {
  try {
    const res = await fetch(
      `${tableUrl("mvp_membership_applications")}?select=id,user_ref,auth_user_id,email,display_name,application_kind,product_key,price_krw,status,admin_note,deposit_confirmed_at,scheduled_auto_approve_at,decided_at,created_at&order=created_at.desc&limit=1000`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as MembershipApplicationDbRow[];
    return rows.map((row) => ({
      id: row.id,
      userRef: row.user_ref,
      authUserId: row.auth_user_id,
      email: row.email,
      displayName: row.display_name,
      applicationKind: row.application_kind ?? "new",
      productKey: row.product_key,
      priceKrw: Number(row.price_krw ?? 99000),
      status: row.status,
      adminNote: row.admin_note,
      depositConfirmedAt: row.deposit_confirmed_at,
      scheduledAutoApproveAt: row.scheduled_auto_approve_at,
      decidedAt: row.decided_at,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

async function fetchSupportConversations(): Promise<SupportConversationDbRow[]> {
  try {
    const res = await fetch(
      `${tableUrl("mvp_support_conversations")}?select=id,auth_user_id,user_email,user_display_name,status,admin_unread_count,user_unread_count,last_message_at,created_at&order=last_message_at.desc&limit=500`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as SupportConversationDbRow[];
  } catch {
    return [];
  }
}

function nicknameOf(user: AuthUser): string {
  const meta = user.user_metadata ?? user.raw_user_meta_data ?? {};
  return meta.nickname || meta.name || meta.full_name || meta.preferred_username || "";
}

const PROFILE_IMAGE_KEYS = [
  "avatar_url",
  "picture",
  "profile_image_url",
  "profileImageUrl",
  "profile_image",
  "image_url",
  "thumbnail_image_url",
  "thumbnailImageUrl",
] as const;

function safeExternalImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function findProfileImageUrl(meta: AuthUserMetadata | null | undefined): string | null {
  if (!meta) return null;

  for (const key of PROFILE_IMAGE_KEYS) {
    const direct = safeExternalImageUrl(meta[key]);
    if (direct) return direct;
  }

  const profile = meta.profile;
  if (profile && typeof profile === "object") {
    for (const key of PROFILE_IMAGE_KEYS) {
      const nested = safeExternalImageUrl((profile as Record<string, unknown>)[key]);
      if (nested) return nested;
    }
  }

  return null;
}

function profileImageUrlOf(user: AuthUser): string | null {
  const sources = [
    user.user_metadata,
    user.raw_user_meta_data,
    ...(user.identities ?? []).map((identity) => identity.identity_data ?? undefined),
  ];

  for (const source of sources) {
    const imageUrl = findProfileImageUrl(source);
    if (imageUrl) return imageUrl;
  }

  return null;
}

export default async function MembersPage() {
  // admin auth 는 layout 에서 처리 (Wave launch-108).
  await reconcileMembershipApplicationsForAdmin();

  const [users, credits, plans, applications, supportConversations] = await Promise.all([
    fetchAuthUsers(),
    fetchAllCredits(),
    fetchAllPlans(),
    fetchMembershipApplications(),
    fetchSupportConversations(),
  ]);

  const creditMap = new Map(credits.map((c) => [c.auth_user_id, c]));
  const planMap = new Map(plans.map((p) => [p.auth_user_id, p]));
  const supportMap = new Map(supportConversations.map((conversation) => [conversation.auth_user_id, conversation]));
  const applicationsByUser = new Map<string, MembershipApplicationRow[]>();
  for (const application of applications) {
    const list = applicationsByUser.get(application.authUserId) ?? [];
    list.push(application);
    applicationsByUser.set(application.authUserId, list);
  }

  const rows: MemberRow[] = users
    .map((u) => {
      const credit = creditMap.get(u.id) ?? null;
      const plan = planMap.get(u.id) ?? null;
      const userApplications = applicationsByUser.get(u.id) ?? [];
      const approvedApplications = userApplications.filter((application) => application.status === "approved");
      const latestApplication = userApplications[0] ?? null;
      const support = supportMap.get(u.id) ?? null;
      return {
        authUserId: u.id,
        userRef: credit?.user_ref ?? userRefForAuthUser(u.id),
        email: u.email ?? null,
        nickname: nicknameOf(u),
        profileImageUrl: profileImageUrlOf(u),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        provider: u.app_metadata?.provider ?? null,
        balance: credit?.balance ?? null,
        freeGrantTokens: credit?.free_grant_tokens ?? null,
        proUntil: credit?.pro_until ?? null,
        isBetaTester: Boolean(credit?.is_beta_tester),
        betaGrantedAt: credit?.beta_tester_granted_at ?? null,
        blockedAt: credit?.blocked_at ?? null,
        blockedReason: credit?.blocked_reason ?? null,
        creditRowExists: credit != null,
        planKey: plan?.plan_key ?? "free",
        planStatus: plan?.status ?? null,
        planEndAt: plan?.current_period_end ?? null,
        planCancelAtEnd: plan?.cancel_at_period_end ?? false,
        dailyUsedCount: plan?.daily_used_count ?? null,
        lastPaymentAt: plan?.last_payment_at ?? null,
        lastPaymentAmount: plan?.last_payment_amount ?? null,
        totalPaidKrw: approvedApplications.reduce((sum, application) => sum + Number(application.priceKrw ?? 0), 0),
        applicationCount: userApplications.length,
        lastApplicationId: latestApplication?.id ?? null,
        lastApplicationStatus: latestApplication?.status ?? null,
        lastApplicationKind: latestApplication?.applicationKind ?? null,
        lastApplicationProductKey: latestApplication?.productKey ?? null,
        lastApplicationAt: latestApplication?.createdAt ?? null,
        supportConversationId: support?.id ?? null,
        supportStatus: support?.status ?? null,
        supportAdminUnreadCount: support?.admin_unread_count ?? 0,
        supportUserUnreadCount: support?.user_unread_count ?? 0,
        supportLastMessageAt: support?.last_message_at ?? null,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const depositRequestedCount = applications.filter((row) => row.status === "pending" && row.depositConfirmedAt).length;
  const unpaidReservationCount = applications.filter((row) => row.status === "pending" && !row.depositConfirmedAt).length;
  const paidMemberCount = rows.filter((row) => {
    const end = row.planEndAt ?? row.proUntil;
    return row.planKey !== "free" && (!end || Date.parse(end) > Date.now());
  }).length;
  const totalMembershipRevenue = applications
    .filter((row) => row.status === "approved")
    .reduce((sum, row) => sum + Number(row.priceKrw ?? 0), 0);
  const openSupportCount = supportConversations.filter((row) => row.status === "open").length;
  const supportUnreadCount = supportConversations.reduce((sum, row) => sum + Number(row.admin_unread_count ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-[1560px] px-4 pb-10 pt-5 sm:px-6">
      <header className="mb-5 overflow-hidden rounded-[28px] border border-zinc-800 bg-[radial-gradient(circle_at_top_right,rgba(49,130,246,0.22),transparent_36%),linear-gradient(135deg,#111827,#020617)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-300">운영 대시보드</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              멤버십·입금·상담을 한눈에 봅니다
            </h1>
            <p className="mt-2 max-w-2xl break-keep text-sm font-bold leading-6 text-zinc-300">
              입금 확인 요청, 자동승인 보정, 고객상담, 회원별 결제 흐름을 분리해서 운영자가 바로 처리할 수 있게 정리했습니다.
            </p>
          </div>
          <Link
            href={OPS_ADMIN_REVEAL_ANALYTICS_PATH}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/20"
          >
            전체 통계 보기
            <span>↗</span>
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <OpsMetricCard label="입금 확인 요청" value={`${depositRequestedCount}건`} tone="blue" caption="입금했어요를 누른 신청" />
          <OpsMetricCard label="입금 전 예약" value={`${unpaidReservationCount}건`} tone="amber" caption="7분 지나면 자동 만료" />
          <OpsMetricCard label="열린 상담" value={`${openSupportCount}건`} tone="emerald" caption={supportUnreadCount > 0 ? `새 메시지 ${supportUnreadCount}개` : "미확인 메시지 없음"} />
          <OpsMetricCard label="활성 멤버" value={`${paidMemberCount}명`} tone="violet" caption={`전체 계정 ${rows.length}명`} />
          <OpsMetricCard label="누적 결제" value={`${totalMembershipRevenue.toLocaleString("ko-KR")}원`} tone="slate" caption="승인된 멤버십 신청 기준" />
        </div>

        <nav className="mt-5 flex flex-wrap gap-2 text-sm font-black">
          <a href="#membership-payments" className="rounded-full bg-white px-4 py-2 text-zinc-950">입금 확인</a>
          <a href="#customer-support" className="rounded-full border border-white/15 px-4 py-2 text-white hover:bg-white/10">고객상담</a>
          <a href="#member-management" className="rounded-full border border-white/15 px-4 py-2 text-white hover:bg-white/10">회원 관리</a>
          <a href="#feedback-review" className="rounded-full border border-white/15 px-4 py-2 text-white hover:bg-white/10">오류 신고</a>
        </nav>
      </header>

      <section id="membership-payments" className="scroll-mt-28">
        <MembershipApplicationsPanel initialRows={applications} />
      </section>
      <section id="customer-support" className="scroll-mt-28">
        <SupportChatPanel />
      </section>
      <section id="member-management" className="scroll-mt-28">
        <MembersTable initialRows={rows} />
      </section>
      <section id="feedback-review" className="scroll-mt-28">
        <FeedbackPanel />
      </section>
    </main>
  );
}

function OpsMetricCard({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "blue" | "amber" | "emerald" | "violet" | "slate";
}) {
  const toneClass = {
    blue: "from-blue-500/24 to-blue-400/5 text-blue-100",
    amber: "from-amber-500/24 to-amber-400/5 text-amber-100",
    emerald: "from-emerald-500/24 to-emerald-400/5 text-emerald-100",
    violet: "from-violet-500/24 to-violet-400/5 text-violet-100",
    slate: "from-slate-400/18 to-white/5 text-zinc-100",
  }[tone];

  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${toneClass} p-4`}>
      <div className="text-[12px] font-black text-white/62">{label}</div>
      <div className="mt-2 text-2xl font-black tabular-nums text-white">{value}</div>
      <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-white/58">{caption}</div>
    </div>
  );
}

import Link from "next/link";
import PlansApplicationFlow from "@/components/plans-application-flow";
import MembershipApplicationClient from "@/components/membership-application-client";
import PlansSocialProofToasts, {
  type PlansSocialProofEvent,
} from "@/components/plans-social-proof-toasts";
import { getMembershipPlan, MEMBERSHIP_PLANS } from "@/lib/membership-plans";
import {
  jsonBody,
  restFetch,
  serviceHeaders,
  tableUrl,
} from "@/lib/supabase-rest";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { getProStatus } from "@/lib/user-subscription";
import { userRefForAuthUser } from "@/lib/user-ref";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SLOT_CAPACITY = 300;
const SLOT_START_FILLED = 172;
const SLOT_TARGET_FILLED = 230;
const SLOT_RAMP_START_MS = Date.parse("2026-06-04T15:00:00.000Z");
const SLOT_RAMP_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const SLOT_WOBBLE_PATTERN = [0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0];

const SOCIAL_PROOF_SURNAMES = [
  "김",
  "이",
  "박",
  "최",
  "정",
  "강",
  "조",
  "윤",
  "장",
  "임",
  "한",
  "오",
  "서",
  "신",
  "권",
  "황",
  "안",
  "송",
  "전",
  "홍",
  "유",
  "고",
  "문",
  "양",
  "손",
  "배",
  "백",
  "허",
  "남",
  "심",
  "노",
  "하",
  "곽",
  "성",
  "차",
  "주",
  "우",
  "구",
  "민",
  "류",
  "나",
  "진",
  "지",
  "엄",
  "채",
  "원",
  "천",
  "방",
  "공",
  "현",
];

function MembershipPassBadge() {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-amber-200/60 bg-[linear-gradient(135deg,#fff7ed_0%,#dbeafe_44%,#ecfeff_100%)] p-4 shadow-[0_22px_55px_rgba(49,130,246,0.18)] dark:border-amber-300/20 dark:bg-[linear-gradient(135deg,#172554_0%,#111827_46%,#052e16_100%)]">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/40 blur-2xl dark:bg-blue-300/20" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
            premium pass
          </div>
          <div className="mt-1 text-[24px] font-black tracking-tight text-zinc-950 dark:text-white">
            ACTIVE
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-[20px] font-black text-white shadow-[0_14px_30px_rgba(15,23,42,0.28)] dark:bg-white dark:text-zinc-950">
          M
        </div>
      </div>
      <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/60 dark:bg-white/15">
        <div className="h-full w-[82%] rounded-full bg-[linear-gradient(90deg,#f59e0b,#3182f6,#10b981)]" />
      </div>
      <div className="relative mt-3 flex items-center justify-between text-[11px] font-black text-zinc-600 dark:text-zinc-200">
        <span>득템잡이 멤버십</span>
        <span>승인 완료</span>
      </div>
    </div>
  );
}

type PendingApplicationRow = {
  id: number;
  application_kind: "new" | "renewal" | null;
  product_key: string;
  price_krw: number;
  deposit_confirmed_at: string | null;
  scheduled_auto_approve_at: string | null;
  created_at: string;
};

type SlotSnapshot = {
  capacity: number;
  filled: number;
};

type SocialProofApplicationRow = {
  id: number;
  display_name: string | null;
  email: string | null;
  status: string | null;
  decided_at: string | null;
  deposit_confirmed_at: string | null;
  created_at: string;
};

function adminNoteLine(message: string) {
  return `[${new Date().toISOString()}] ${message}`;
}

async function expireUnpaidReservationsForUser(authUserId: string) {
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - 7 * 60_000).toISOString();
  await restFetch(
    `${tableUrl("mvp_membership_applications")}?auth_user_id=eq.${authUserId}&status=eq.pending&deposit_confirmed_at=is.null&created_at=lt.${encodeURIComponent(cutoffIso)}`,
    {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        status: "rejected",
        decided_at: nowIso,
        updated_at: nowIso,
        admin_note: adminNoteLine("auto_expired_unpaid_reservation_7m"),
      }),
    },
  ).catch((err) => {
    console.warn(
      "[plans] expire unpaid reservation failed",
      err instanceof Error ? err.message : String(err),
    );
  });
}

async function loadPendingApplication(
  authUserId: string,
): Promise<PendingApplicationRow | null> {
  try {
    await expireUnpaidReservationsForUser(authUserId);
    const res = await restFetch(
      `${tableUrl("mvp_membership_applications")}?select=id,application_kind,product_key,price_krw,deposit_confirmed_at,scheduled_auto_approve_at,created_at&auth_user_id=eq.${authUserId}&status=eq.pending&order=created_at.desc&limit=1`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as PendingApplicationRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

const KST_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function membershipEndLabel(value: string | null | undefined): string {
  if (!value) return "기간 제한 없음";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "만료일 확인 중";
  return KST_DATE_FORMATTER.format(d);
}

function membershipRemainingLabel(value: string | null | undefined): string {
  if (!value) return "운영자/특별 권한";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "확인 중";
  const days = Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));
  if (days <= 0) return "오늘 만료 예정";
  return `${days.toLocaleString("ko-KR")}일 남음`;
}

function loadSlotSnapshot(now = Date.now()): SlotSnapshot {
  const elapsedMs = Math.max(0, now - SLOT_RAMP_START_MS);
  const progress = Math.min(1, elapsedMs / SLOT_RAMP_DURATION_MS);
  const baseFilled = Math.floor(
    SLOT_START_FILLED + (SLOT_TARGET_FILLED - SLOT_START_FILLED) * progress,
  );
  const bucket = Math.floor(elapsedMs / (6 * 60 * 60 * 1000));
  const wobble =
    progress >= 1
      ? 0
      : (SLOT_WOBBLE_PATTERN[bucket % SLOT_WOBBLE_PATTERN.length] ?? 0);
  const filled = Math.max(
    SLOT_START_FILLED,
    Math.min(SLOT_TARGET_FILLED, baseFilled + wobble),
  );

  return {
    capacity: SLOT_CAPACITY,
    filled,
  };
}

function maskedMemberLabel(
  row: Pick<SocialProofApplicationRow, "id" | "display_name" | "email">,
) {
  const seed = `${row.id}:${row.email ?? ""}:${row.display_name ?? ""}`;
  const codeSum = Array.from(seed || "member").reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return `${SOCIAL_PROOF_SURNAMES[codeSum % SOCIAL_PROOF_SURNAMES.length]}**님`;
}

function minutesAgo(value: string | null | undefined) {
  const ms = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(ms)) return null;
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 2 || minutes > 58) return null;
  return minutes;
}

async function loadSocialProofEvents(): Promise<PlansSocialProofEvent[]> {
  try {
    const res = await restFetch(
      `${tableUrl("mvp_membership_applications")}?select=id,display_name,email,status,decided_at,deposit_confirmed_at,created_at&status=in.(approved,pending)&order=created_at.desc&limit=12`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as SocialProofApplicationRow[];
    return rows
      .map((row): PlansSocialProofEvent => {
        const approved = row.status === "approved";
        const ago = minutesAgo(
          row.decided_at ?? row.deposit_confirmed_at ?? row.created_at,
        );
        return {
          id: `application-${row.id}`,
          label: maskedMemberLabel(row),
          minutesAgo: ago ?? 0,
          kind: approved
            ? "approved"
            : row.deposit_confirmed_at
              ? "reserved"
              : "seat_check",
        };
      })
      .filter((event) => event.minutesAgo > 0)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export default async function PlansPage() {
  const auth = await requireSupabaseUserFromCookies();
  const membership = auth.ok
    ? await getProStatus(auth.user, userRefForAuthUser(auth.user.id))
    : null;
  const isMember = Boolean(
    membership?.isPro || membership?.isAdmin || membership?.isBetaTester,
  );
  const pendingApplication = auth.ok
    ? await loadPendingApplication(auth.user.id)
    : null;
  const pendingPlan = pendingApplication
    ? getMembershipPlan(pendingApplication.product_key)
    : null;
  const slotSnapshot = loadSlotSnapshot();
  const membershipEndAt = membership?.proUntil ?? null;
  const socialProofEvents = isMember ? await loadSocialProofEvents() : [];
  const pendingApplicationPayload = pendingApplication
    ? {
        id: pendingApplication.id,
        applicationKind:
          pendingApplication.application_kind ?? (isMember ? "renewal" : "new"),
        planKey: pendingPlan?.key ?? "limited_300_3mo",
        planLabel: pendingPlan?.label ?? "멤버십",
        priceKrw: Number(
          pendingApplication.price_krw ?? pendingPlan?.priceKrw ?? 99_000,
        ),
        depositConfirmedAt: pendingApplication.deposit_confirmed_at,
        scheduledAutoApproveAt: pendingApplication.scheduled_auto_approve_at,
        createdAt: pendingApplication.created_at,
      }
    : null;

  if (!isMember) {
    return (
      <PlansApplicationFlow
        isAuthed={auth.ok}
        isMember={isMember}
        loginHref="/login?next=/plans"
        plans={MEMBERSHIP_PLANS}
        pendingApplication={pendingApplicationPayload}
        filled={slotSnapshot.filled}
        capacity={slotSnapshot.capacity}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-3 pb-24 pt-4 dark:bg-zinc-950 sm:px-5 sm:py-8 lg:py-10">
      <PlansSocialProofToasts events={socialProofEvents} />
      <div className="mx-auto grid w-full max-w-[1120px] gap-4 lg:grid-cols-[390px_minmax(0,1fr)] lg:items-start">
        <section className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-5 py-6 sm:px-7 lg:px-8 lg:py-8">
            <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60">
              멤버십 활성화됨
            </div>
            <h1 className="mt-4 break-keep text-[34px] font-black leading-[1.02] tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[46px] lg:text-[52px]">
              멤버십
              <br />
              연장하기
            </h1>
            <p className="mt-4 break-keep text-[14px] font-bold leading-6 text-zinc-600 dark:text-zinc-300 sm:text-[15px]">
              만료 전에 연장해도 남은 기간 뒤에 그대로 붙습니다.
            </p>
            <div className="mt-5 grid gap-2">
              <div className="rounded-[18px] border border-zinc-200 bg-[#fbfcff] px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="text-[11px] font-black text-zinc-400">
                  남은 기간
                </div>
                <div className="mt-1 text-[28px] font-black text-zinc-950 dark:text-zinc-50">
                  {membershipRemainingLabel(membershipEndAt)}
                </div>
              </div>
              <div className="rounded-[18px] border border-zinc-200 bg-[#fbfcff] px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="text-[11px] font-black text-zinc-400">
                  만료일
                </div>
                <div className="mt-1 break-keep text-[16px] font-black text-zinc-950 dark:text-zinc-50">
                  {membershipEndLabel(membershipEndAt)}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <MembershipPassBadge />
            </div>
            <Link
              href="/me"
              className="mt-4 flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-[14px] font-black text-zinc-900 transition hover:bg-[#eef4ff] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              지금 매물 보러가기
            </Link>
          </div>
        </section>

        <aside className="order-first lg:order-none lg:sticky lg:top-5">
          <div className="overflow-hidden rounded-[24px] border border-blue-200 bg-white shadow-[0_24px_90px_rgba(49,130,246,0.16)] ring-1 ring-blue-50 dark:border-blue-900/60 dark:bg-zinc-900 dark:ring-blue-950/70">
            <div className="border-b border-blue-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eaf3ff_100%)] px-5 py-5 dark:border-zinc-800 dark:bg-none dark:bg-white/6 sm:px-6">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-blue-200">
                Renewal
              </div>
              <h2 className="mt-2 break-keep text-[34px] font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[42px]">
                연장 기간을
                <br className="hidden sm:block" />
                선택하세요.
              </h2>
              <p className="mt-3 break-keep text-[13px] font-bold leading-6 text-zinc-600 dark:text-zinc-300">
                기간을 고르면 입금 계좌가 열리고, 입금했어요 버튼으로 승인
                확인을 시작합니다.
              </p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:px-5">
              <div className="rounded-[20px] border border-blue-100 bg-blue-50/70 px-4 py-4 dark:border-blue-950/70 dark:bg-blue-950/20">
                <MembershipApplicationClient
                  isAuthed={auth.ok}
                  isMember={isMember}
                  loginHref="/login?next=/plans"
                  plans={MEMBERSHIP_PLANS}
                  pendingApplication={pendingApplicationPayload}
                />
              </div>
              <div className="rounded-[18px] border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                <div className="text-[12px] font-black text-zinc-950 dark:text-zinc-50">
                  입금 전에는 기간 변경이나 취소가 가능합니다.
                </div>
                <div className="mt-1 break-keep text-[11.5px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
                  입금했어요 버튼을 누른 뒤에는 승인 확인이 진행됩니다.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

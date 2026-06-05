import Image from "next/image";
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
    `${tableUrl("mvp_membership_applications")}?auth_user_id=eq.${authUserId}&status=eq.pending&deposit_confirmed_at=is.null&created_at=lt.${encodeURIComponent(cutoffIso)}&or=(application_kind.eq.new,application_kind.is.null)`,
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

function membershipTimeline(value: string | null | undefined) {
  const end = value ? new Date(value) : null;
  if (!end || !Number.isFinite(end.getTime())) {
    return {
      startLabel: "가입일 확인 중",
      progressLabel: "활성",
      progressPercent: 100,
    };
  }

  const remainingDays = Math.max(
    0,
    Math.ceil((end.getTime() - Date.now()) / 86_400_000),
  );
  const totalDays =
    remainingDays > 366 ? Math.ceil(remainingDays / 365) * 365 : 365;
  const start = new Date(end.getTime() - totalDays * 86_400_000);
  const progressPercent = Math.max(
    8,
    Math.min(100, Math.round((remainingDays / totalDays) * 100)),
  );

  return {
    startLabel: `가입 ${KST_DATE_FORMATTER.format(start)}`,
    progressLabel: `${progressPercent}% 남음`,
    progressPercent,
  };
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
  const membershipTimelineState = membershipTimeline(membershipEndAt);
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
      <section className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[26px] border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.11)] dark:border-zinc-800 dark:bg-[#18191d]">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full shadow-[0_12px_28px_rgba(49,130,246,0.34)] ring-1 ring-blue-300/40 dark:ring-blue-300/20">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="text-[15px] font-black text-blue-700 dark:text-blue-200">
                멤버십 관리
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              활성
            </span>
          </div>

          <div className="mt-6 flex flex-col items-center text-center">
            <div
              className="flex h-[92px] w-[92px] items-center justify-center rounded-full p-[6px] shadow-[0_16px_34px_rgba(49,130,246,0.20)]"
              style={{
                background: `conic-gradient(#3b74ff ${membershipTimelineState.progressPercent}%, rgba(49,130,246,0.16) 0)`,
              }}
            >
              <div className="h-full w-full overflow-hidden rounded-full ring-[7px] ring-blue-950/10 dark:ring-blue-950/50">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <h1 className="mt-4 text-[23px] font-black tracking-tight text-zinc-950 dark:text-zinc-50">
              득템잡이 멤버십
            </h1>
            <p className="mt-1 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
              프리미엄 매물 알림 · 무제한 열람
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <div className="text-[13px] font-black text-zinc-500 dark:text-zinc-400">
                남은 기간
              </div>
              <div className="text-[24px] font-black leading-none tracking-tight text-[#3b74ff]">
                {membershipRemainingLabel(membershipEndAt)}
              </div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#2f65ff,#8eb3ff)]"
                style={{
                  width: `${membershipTimelineState.progressPercent}%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
              <span>{membershipTimelineState.startLabel}</span>
              <span>{membershipTimelineState.progressLabel}</span>
              <span>만료 {membershipEndLabel(membershipEndAt)}</span>
            </div>
          </div>

          <div className="mt-4 rounded-[16px] border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/30">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[12px] font-black text-zinc-400">연장 방식</span>
              <span className="text-right text-[13px] font-black text-zinc-950 dark:text-zinc-50">
                만료일 뒤에 자동 추가
              </span>
            </div>
          </div>

          <div className="mt-4">
            <MembershipApplicationClient
              isAuthed={auth.ok}
              isMember={isMember}
              loginHref="/login?next=/plans"
              plans={MEMBERSHIP_PLANS}
              pendingApplication={pendingApplicationPayload}
            />
            <p className="mt-3 break-keep text-center text-[11.5px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              입금 전에는 기간 변경이나 취소가 가능하고, 입금했어요 버튼을 누르면
              승인 확인이 진행됩니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

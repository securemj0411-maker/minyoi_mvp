import Link from "next/link";
import MembershipApplicationClient from "@/components/membership-application-client";
import PlansUrgencyCountdown from "@/components/plans-urgency-countdown";
import PlansSocialProofToasts, {
  type PlansSocialProofEvent,
} from "@/components/plans-social-proof-toasts";
import { getMembershipPlan, MEMBERSHIP_PLANS } from "@/lib/membership-plans";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { getProStatus } from "@/lib/user-subscription";
import { userRefForAuthUser } from "@/lib/user-ref";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SLOT_CAPACITY = 300;

const FEATURES = [
  "승인된 멤버만 원본 링크, 시세 근거, 예상 수익, 셀러 신뢰 신호를 한 화면에서 봅니다.",
  "당근은 내 근처에 떠야 실전성이 생기기 때문에 지역별 티오를 먼저 확인합니다.",
  "좋은 매물은 보는 사람이 많아질수록 바로 사라져서, 공개 범위를 일부러 좁게 유지합니다.",
];

const PAYMENT_HELP = [
  {
    label: "입금했어요 버튼",
    value: "송금 후 버튼을 누르면 운영자에게 입금 확인 알림이 바로 갑니다.",
  },
  {
    label: "5분 내 승인 보장",
    value:
      "운영자가 놓쳐도 5분이 지나면 자동 승인되어 추천 상품 피드가 열립니다.",
  },
  {
    label: "승인 전 변경 가능",
    value: "입금 전에는 기간/금액 변경이나 예약 취소를 직접 할 수 있습니다.",
  },
];

const SCARCITY_ROWS = [
  {
    label: "아무나 안 받음",
    value:
      "돈 되는 매물은 전체 중고 매물 중 극소수라서, 무제한 공개하면 기회가 바로 깨집니다.",
  },
  {
    label: "지역별 티오",
    value:
      "당근은 내 근처에 떠야 의미가 있어서, 같은 지역에 너무 많이 열지 않습니다.",
  },
  {
    label: "시장 교란 방지",
    value:
      "같은 매물을 모두가 보면 가격도 속도도 망가져서, 소수만 안정적으로 보게 합니다.",
  },
];

const NON_MEMBER_BADGES = ["선공개 300명", "선착순 티오", "승인 후 원본 공개"];

const MEMBER_ROWS = [
  {
    label: "패스 유지",
    value: "만료 전에 연장해도 남은 기간 뒤에 그대로 붙습니다.",
  },
  {
    label: "피드 접근",
    value: "추천 상품, 원본 링크, 시세 근거를 계속 열어볼 수 있습니다.",
  },
  {
    label: "연장 예약",
    value: "기간 선택 후 입금하면 5분 내 승인 흐름으로 처리됩니다.",
  },
];

const MEMBER_PASS_SIGNALS = [
  { label: "원본 링크", value: "열림" },
  { label: "시세 근거", value: "유지" },
  { label: "연장 처리", value: "5분 내" },
];

function MarketSignalIllustration() {
  return (
    <svg
      viewBox="0 0 520 360"
      role="img"
      aria-label="득템잡이 멤버십 시그널"
      className="h-auto w-full"
    >
      <defs>
        <linearGradient id="plansPulse" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#3182f6" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="plansWarm" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <rect x="28" y="34" width="464" height="292" rx="28" fill="#0f172a" />
      <rect x="52" y="62" width="170" height="42" rx="14" fill="#172554" />
      <circle cx="78" cy="83" r="10" fill="#10b981" />
      <path
        d="M98 84h88"
        stroke="#bfdbfe"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect
        x="242"
        y="62"
        width="196"
        height="42"
        rx="14"
        fill="#111827"
        stroke="#334155"
      />
      <path
        d="M268 83h58M346 83h64"
        stroke="#94a3b8"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M80 254c40-74 82-92 128-68 38 20 62 10 88-38 25-46 64-62 112-22"
        fill="none"
        stroke="url(#plansPulse)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M78 256h364"
        stroke="#334155"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g>
        <rect
          x="70"
          y="128"
          width="108"
          height="72"
          rx="18"
          fill="#020617"
          stroke="#1d4ed8"
        />
        <path
          d="M94 154h56M94 176h36"
          stroke="#bfdbfe"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="154" cy="176" r="11" fill="#3182f6" />
      </g>
      <g>
        <rect
          x="206"
          y="116"
          width="118"
          height="82"
          rx="18"
          fill="#052e16"
          stroke="#16a34a"
        />
        <path
          d="M230 145h48M230 169h68"
          stroke="#bbf7d0"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M292 134l12 12 20-28"
          fill="none"
          stroke="#34d399"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g>
        <rect
          x="352"
          y="126"
          width="88"
          height="66"
          rx="18"
          fill="#451a03"
          stroke="#f59e0b"
        />
        <path
          d="M376 154h40M376 174h26"
          stroke="#fed7aa"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      <circle cx="110" cy="254" r="9" fill="#3182f6" />
      <circle cx="226" cy="190" r="9" fill="#10b981" />
      <circle cx="384" cy="126" r="9" fill="#f59e0b" />
      <rect
        x="272"
        y="238"
        width="158"
        height="42"
        rx="21"
        fill="url(#plansWarm)"
      />
      <path
        d="M300 259h78"
        stroke="#fff7ed"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M394 249l12 10-12 10"
        fill="none"
        stroke="#fff7ed"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function MembershipPassPanel() {
  return (
    <div className="flex h-full min-h-[360px] flex-col justify-between gap-4">
      <MembershipPassBadge />
      <div className="grid gap-2">
        {MEMBER_PASS_SIGNALS.map((signal) => (
          <div
            key={signal.label}
            className="flex items-center justify-between rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <div className="text-[12px] font-black text-zinc-300">
              {signal.label}
            </div>
            <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-zinc-950">
              {signal.value}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-[18px] border border-blue-400/20 bg-blue-400/10 px-4 py-4">
        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-200">
          pass benefit
        </div>
        <div className="mt-2 break-keep text-[13px] font-black leading-6 text-white">
          만료 전에 연장하면 지금 남은 기간 뒤에 그대로 붙어서 손실 없이
          이어집니다.
        </div>
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

async function loadPendingApplication(
  authUserId: string,
): Promise<PendingApplicationRow | null> {
  try {
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

function loadSlotSnapshot(): SlotSnapshot {
  return {
    capacity: SLOT_CAPACITY,
    filled: 161 + Math.floor(Math.random() * 73),
  };
}

function maskedMemberLabel(
  row: Pick<SocialProofApplicationRow, "display_name" | "email">,
) {
  const name = String(row.display_name ?? "").trim();
  if (name) return `${name.slice(0, 1)}**님`;
  const local =
    String(row.email ?? "")
      .split("@")[0]
      ?.trim() ?? "";
  if (local) return `${local.slice(0, 1)}**님`;
  return "이**님";
}

function minutesAgo(value: string | null | undefined) {
  const ms = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(ms)) return 9;
  return Math.max(2, Math.min(59, Math.round((Date.now() - ms) / 60_000)));
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
        return {
          id: `application-${row.id}`,
          label: maskedMemberLabel(row),
          minutesAgo: minutesAgo(
            row.decided_at ?? row.deposit_confirmed_at ?? row.created_at,
          ),
          kind: approved
            ? "approved"
            : row.deposit_confirmed_at
              ? "reserved"
              : "seat_check",
        };
      })
      .filter((event) => event.minutesAgo <= 59)
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
  const socialProofEvents = await loadSocialProofEvents();
  const infoRows = isMember ? MEMBER_ROWS : SCARCITY_ROWS;
  const heroBadges = isMember
    ? ["활성 멤버", "남은 기간 확인", "기간 연장 가능"]
    : NON_MEMBER_BADGES;
  const reservationRate = Math.round(
    (slotSnapshot.filled / slotSnapshot.capacity) * 100,
  );

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-3 py-4 dark:bg-zinc-950 sm:px-5 sm:py-8 lg:py-10">
      <PlansSocialProofToasts events={socialProofEvents} />
      <div className="mx-auto grid w-full max-w-[1100px] gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="px-5 py-6 sm:px-8 sm:py-8 lg:px-9 lg:py-9">
              <div className="flex flex-wrap gap-1.5">
                {heroBadges.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-[#3182f6] ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/60"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <h1 className="mt-5 max-w-[560px] break-keep text-[34px] font-black leading-[1.02] tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[50px]">
                {isMember
                  ? "멤버십 패스 활성화"
                  : "아무나 보면, 아무도 못 법니다."}
              </h1>
              <p className="mt-5 max-w-[560px] break-keep text-[15px] font-bold leading-7 text-zinc-600 dark:text-zinc-300 sm:text-[16px] sm:leading-8">
                {isMember
                  ? "연장하면 현재 만료일 뒤에 기간이 그대로 붙습니다. 매물 피드, 원본 링크, 시세 근거를 끊기지 않게 유지하세요."
                  : "득템잡이는 시세보다 싼 매물을 모두에게 뿌리지 않습니다. 선착순 티오와 지역별 접근 수를 관리해서, 실제로 움직일 수 있는 소수 멤버만 원본 링크와 시세 근거를 봅니다."}
              </p>
              {!isMember ? (
                <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    member cap
                  </div>
                  <div className="mt-1 break-keep text-[13px] font-black leading-6 text-zinc-800 dark:text-zinc-100">
                    지금은 선공개 {SLOT_CAPACITY}명만 받습니다. 지역이 겹치면
                    티오가 먼저 닫힐 수 있어요.
                  </div>
                </div>
              ) : null}
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {infoRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-[16px] border border-zinc-200 bg-[#fbfcff] px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                  >
                    <div className="text-[11px] font-black text-[#3182f6] dark:text-blue-300">
                      {row.label}
                    </div>
                    <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-zinc-200 bg-zinc-950 px-4 py-5 dark:border-zinc-800 lg:border-l lg:border-t-0">
              {isMember ? (
                <MembershipPassPanel />
              ) : (
                <MarketSignalIllustration />
              )}
            </div>
          </div>
          <div className="grid gap-3 border-t border-zinc-200 px-5 py-5 dark:border-zinc-800 sm:grid-cols-3 sm:px-8">
            {PAYMENT_HELP.map((item, index) => (
              <div
                key={item.label}
                className="flex gap-3 rounded-[16px] bg-[#f5f7fb] px-3.5 py-3 dark:bg-zinc-950/70"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-black text-[#3182f6] ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                  {index + 1}
                </div>
                <div>
                  <div className="text-[12px] font-black text-zinc-950 dark:text-zinc-50">
                    {item.label}
                  </div>
                  <div className="mt-1 break-keep text-[11.5px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside
          className={`${isMember ? "order-first lg:order-none" : ""} lg:sticky lg:top-5`}
        >
          <div className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.1)] dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-blue-200">
                    {isMember ? "Membership active" : "Seat check"}
                  </div>
                  <div className="mt-1 text-[28px] font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                    {isMember
                      ? membershipRemainingLabel(membershipEndAt)
                      : `${slotSnapshot.filled}/${slotSnapshot.capacity}명 예약`}
                  </div>
                  <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
                    {isMember
                      ? `만료일 ${membershipEndLabel(membershipEndAt)}`
                      : "기간 선택 전에 내 지역 티오부터 확인합니다."}
                  </div>
                </div>
                <div
                  className={
                    isMember
                      ? "rounded-2xl border border-amber-200/70 bg-[linear-gradient(135deg,#fef3c7,#dbeafe)] px-3.5 py-2.5 text-right text-zinc-950 shadow-[0_12px_30px_rgba(245,158,11,0.18)] dark:border-amber-300/20 dark:bg-[linear-gradient(135deg,#1e3a8a,#052e16)] dark:text-white"
                      : "rounded-2xl bg-zinc-950 px-3 py-2 text-right text-white dark:bg-white dark:text-zinc-950"
                  }
                >
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] opacity-70">
                    {isMember ? "premium" : "filled"}
                  </div>
                  <div className="mt-0.5 text-[18px] font-black">
                    {isMember ? "PASS" : `${reservationRate}%`}
                  </div>
                </div>
              </div>
              {!isMember ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] font-black text-zinc-500 dark:text-zinc-400">
                    <span>선공개 예약률</span>
                    <span>{reservationRate}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-[#3182f6]"
                      style={{
                        width: `${Math.min(96, Math.max(24, (slotSnapshot.filled / slotSnapshot.capacity) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 px-4 py-4 sm:px-5">
              {!isMember && auth.ok ? <PlansUrgencyCountdown /> : null}
              <div className="rounded-[18px] border border-blue-100 bg-blue-50/70 px-4 py-4 dark:border-blue-950/70 dark:bg-blue-950/20">
                <div className="mb-3 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                  {isMember
                    ? "연장 기간을 고르면 계좌가 열립니다. 송금 후 입금했어요 버튼을 누르면 5분 내 승인됩니다."
                    : auth.ok
                      ? "티오가 열려 있으면 기간을 고른 뒤 계좌가 열립니다. 이 페이지는 결제 페이지가 아니라 자리 확인 페이지입니다."
                      : "카카오 로그인 후 내 지역 티오를 확인합니다. 가격은 티오 확인 뒤 기간 선택 단계에서 고릅니다."}
                </div>
                <MembershipApplicationClient
                  isAuthed={auth.ok}
                  isMember={isMember}
                  loginHref="/login?next=/plans"
                  plans={MEMBERSHIP_PLANS}
                  pendingApplication={
                    pendingApplication
                      ? {
                          id: pendingApplication.id,
                          applicationKind:
                            pendingApplication.application_kind ??
                            (isMember ? "renewal" : "new"),
                          planKey: pendingPlan?.key ?? "limited_300_3mo",
                          planLabel: pendingPlan?.label ?? "멤버십",
                          priceKrw: Number(
                            pendingApplication.price_krw ??
                              pendingPlan?.priceKrw ??
                              99_000,
                          ),
                          depositConfirmedAt:
                            pendingApplication.deposit_confirmed_at,
                          scheduledAutoApproveAt:
                            pendingApplication.scheduled_auto_approve_at,
                          createdAt: pendingApplication.created_at,
                        }
                      : null
                  }
                />
              </div>
              <ul className="grid gap-2">
                {FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 break-keep text-[12.5px] font-bold leading-5 text-zinc-600 dark:text-zinc-300"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {isMember ? (
                <Link
                  href="/me"
                  className="flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-[13px] font-black text-zinc-900 transition hover:bg-[#eef4ff] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  내 상품 피드로 가기
                </Link>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

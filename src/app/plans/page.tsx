import Link from "next/link";
import MembershipApplicationClient from "@/components/membership-application-client";
import { getMembershipPlan, MEMBERSHIP_PLANS } from "@/lib/membership-plans";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { getProStatus } from "@/lib/user-subscription";
import { userRefForAuthUser } from "@/lib/user-ref";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SLOT_CAPACITY = 300;

const FEATURES = [
  "승인된 계정만 원본 링크, 시세 근거, 예상 수익, 셀러 신뢰 신호를 한 화면에서 봅니다.",
  "당근은 내 근처에 떠야 실전성이 생겨서, 지역별 티오를 먼저 확인합니다.",
  "돈 되는 매물은 적고 오래 남지 않아서, 보는 사람 수를 무제한으로 열지 않습니다.",
];

const REVIEW_STEPS = [
  { label: "1. 신청", value: "카카오 로그인 후 기간을 선택합니다." },
  { label: "2. 지역 조회", value: "신청자 기준 내 지역 티오를 확인합니다." },
  { label: "3. 입금 후 활성", value: "입금 확인 후 상품 피드를 엽니다." },
];

const SCARCITY_ROWS = [
  { label: "희소성", value: "시세보다 충분히 싸고, 상태가 맞고, 셀러 리스크가 낮은 매물은 전체 매물 중 일부예요." },
  { label: "지역성", value: "번개·중나는 전국 단위지만, 당근은 가까운 동네에 떠야 실전성이 생겨요." },
  { label: "쿼터", value: "같은 매물을 너무 많은 사람이 보면 결국 아무도 안정적으로 돈을 못 벌어요." },
];

type PendingApplicationRow = {
  id: number;
  product_key: string;
  price_krw: number;
  created_at: string;
};

type SlotSnapshot = {
  capacity: number;
  filled: number;
};

async function loadPendingApplication(authUserId: string): Promise<PendingApplicationRow | null> {
  try {
    const res = await restFetch(
      `${tableUrl("mvp_membership_applications")}?select=id,product_key,price_krw,created_at&auth_user_id=eq.${authUserId}&status=eq.pending&limit=1`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as PendingApplicationRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function loadSlotSnapshot(): SlotSnapshot {
  return {
    capacity: SLOT_CAPACITY,
    filled: 161 + Math.floor(Math.random() * 73),
  };
}

export default async function PlansPage() {
  const auth = await requireSupabaseUserFromCookies();
  const membership = auth.ok ? await getProStatus(auth.user, userRefForAuthUser(auth.user.id)) : null;
  const isMember = Boolean(membership?.isPro || membership?.isAdmin || membership?.isBetaTester);
  const pendingApplication = auth.ok && !isMember ? await loadPendingApplication(auth.user.id) : null;
  const pendingPlan = pendingApplication ? getMembershipPlan(pendingApplication.product_key) : null;
  const slotSnapshot = loadSlotSnapshot();

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-3 py-4 dark:bg-zinc-950 sm:px-5 sm:py-8">
      <div className="mx-auto w-full max-w-[760px]">
        <section className="overflow-hidden rounded-[18px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-6 dark:border-zinc-800 sm:px-6 sm:py-7">
            <h1 className="break-keep text-[30px] font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[42px]">
              선공개 300명 멤버십
            </h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["선공개 300명", "내 지역 티오 조회", "운영자 입금 확인"].map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-[#3182f6] ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/60"
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-5 max-w-[520px] break-keep text-[16px] font-black leading-7 text-zinc-900 dark:text-zinc-100 sm:text-[18px] sm:leading-8">
              하루에 올라오는 중고 매물 중 진짜 돈 되는 건 극소수예요.
              아무나 보면 그마저도 사라집니다.
            </p>
            <p className="mt-3 max-w-[480px] break-keep text-[13px] font-semibold leading-6 text-zinc-600 dark:text-zinc-300 sm:text-[14px]">
              신청자의 지역을 기준으로 남은 티오를 확인하고 자리를 예약합니다.
              선공개 300명 기준으로 지역별로 티오를 관리하고, 계좌이체 입금 확인 후 승인된 분만 봅니다.
            </p>
            <div className="mt-5 rounded-[14px] border border-blue-100 bg-blue-50/70 px-4 py-4 dark:border-blue-950/70 dark:bg-blue-950/20">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-blue-200">Membership note</div>
              <div className="mt-1 text-[24px] font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                월 33,000원꼴
              </div>
              <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                3개월 99,000원 · 자리 예약 후 계좌이체
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[12px] bg-white px-3 py-2 dark:bg-zinc-950/60">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">선착순 현황</div>
                  <div className="mt-1 text-[15px] font-black text-zinc-950 dark:text-zinc-50">
                    {slotSnapshot.capacity}명 중 {slotSnapshot.filled}명 예약
                  </div>
                </div>
                <div className="rounded-[12px] bg-white px-3 py-2 dark:bg-zinc-950/60">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">내 지역 티오</div>
                  <div className="mt-1 text-[15px] font-black text-emerald-700 dark:text-emerald-300">
                    신청 후 즉시 조회
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-blue-100 pt-3 dark:border-blue-950/70">
                <div className="mb-2 break-keep text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
                  신청하면 내 지역 티오를 확인한 뒤 가능 판정이면 기간 선택과 입금 안내가 열립니다.
                </div>
                <MembershipApplicationClient
                  isAuthed={auth.ok}
                  isMember={isMember}
                  loginHref="/login?next=/plans"
                  plans={MEMBERSHIP_PLANS}
                  pendingApplication={pendingApplication ? {
                    id: pendingApplication.id,
                    planKey: pendingPlan?.key ?? "limited_300_3mo",
                    planLabel: pendingPlan?.label ?? "멤버십",
                    priceKrw: Number(pendingApplication.price_krw ?? pendingPlan?.priceKrw ?? 99_000),
                    createdAt: pendingApplication.created_at,
                  } : null}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6">
            {REVIEW_STEPS.map((step) => (
              <div key={step.label} className="rounded-[12px] border border-zinc-200 bg-[#fbfcff] px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="text-[12px] font-black text-[#3182f6] dark:text-blue-300">{step.label}</div>
                <div className="mt-1.5 break-keep text-[12px] font-semibold leading-5 text-zinc-600 dark:text-zinc-300">{step.value}</div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-5 sm:px-6 sm:pb-6">
            <div className="mb-3 grid gap-2.5">
              {SCARCITY_ROWS.map((row) => (
                <div key={row.label} className="rounded-[12px] border border-zinc-200 bg-[#fbfcff] px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="text-[11px] font-black text-[#3182f6] dark:text-blue-300">{row.label}</div>
                  <div className="mt-1 break-keep text-[12px] font-semibold leading-5 text-zinc-600 dark:text-zinc-300">{row.value}</div>
                </div>
              ))}
            </div>

            <ul className="mt-4 space-y-2.5">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 break-keep text-[13px] font-semibold leading-5 text-zinc-600 dark:text-zinc-300">
                  <span className="mt-px shrink-0 text-[#3182f6]">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isMember ? (
              <Link
                href="/me"
                className="mt-4 flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-[13px] font-black text-zinc-900 transition hover:bg-[#eef4ff] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                내 상품 피드로 가기
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

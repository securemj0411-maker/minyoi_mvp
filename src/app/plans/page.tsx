import Link from "next/link";
import MembershipApplicationClient from "@/components/membership-application-client";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { getProStatus } from "@/lib/user-subscription";
import { userRefForAuthUser } from "@/lib/user-ref";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FEATURES = [
  "하루에 올라오는 매물 중 실제로 돈 되는 후보는 극소수라서 티오를 관리해요.",
  "당근은 특히 내 근처에 떠야 거래가 가능해서, 지역별로 볼 수 있는 사람이 너무 많으면 기회가 금방 사라져요.",
  "승인된 계정만 원본 링크, 시세 근거, 예상 수익, 셀러 신뢰 신호를 한 화면에서 확인해요.",
];

const REVIEW_STEPS = [
  { label: "1. 신청", value: "카카오 로그인 후 신청서를 남겨요." },
  { label: "2. 확인", value: "운영자가 지역·사용 목적·현재 티오를 확인해요." },
  { label: "3. 승인", value: "승인되면 결제 안내 후 상품 피드를 열어요." },
];

const SCARCITY_ROWS = [
  { label: "희소성", value: "시세보다 충분히 싸고, 상태가 맞고, 셀러 리스크가 낮은 매물은 전체 매물 중 일부예요." },
  { label: "지역성", value: "번개·중나는 전국 단위지만, 당근은 가까운 동네에 떠야 실전성이 생겨요." },
  { label: "쿼터", value: "같은 매물을 너무 많은 사람이 보면 결국 아무도 안정적으로 돈을 못 벌어요." },
];

export default async function PlansPage() {
  const auth = await requireSupabaseUserFromCookies();
  const membership = auth.ok ? await getProStatus(auth.user, userRefForAuthUser(auth.user.id)) : null;
  const isMember = Boolean(membership?.isPro || membership?.isAdmin || membership?.isBetaTester);

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-3 py-4 dark:bg-zinc-950 sm:px-5 sm:py-8">
      <div className="mx-auto w-full max-w-[720px]">
        <section className="overflow-hidden rounded-[18px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-6 sm:py-6">
            <div className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-[#3182f6] ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/60">
              선공개 300명 멤버십
            </div>
            <h1 className="mt-3 break-keep text-[26px] font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[34px]">
              결제 페이지가 아니라 신청 페이지예요.
            </h1>
            <p className="mt-3 break-keep text-[14px] font-semibold leading-6 text-zinc-600 dark:text-zinc-300">
              득템잡이는 아무나 바로 결제해서 쓰는 대중형 공개 서비스가 아니에요.
              돈 되는 매물은 적고, 특히 당근은 내 근처에 떠야 의미가 있어서 계정과 지역별로 티오를 관리합니다.
            </p>
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

            <div className="rounded-[14px] border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[12px] font-black uppercase tracking-[0.16em] text-zinc-400">Membership</div>
                  <div className="mt-1 text-[24px] font-black tracking-tight text-zinc-950 dark:text-zinc-50">3개월 99,000원</div>
                  <div className="mt-1 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">월 33,000원꼴 · 승인 후 결제 안내</div>
                </div>
                <MembershipApplicationClient
                  isAuthed={auth.ok}
                  isMember={isMember}
                  loginHref="/login?next=/plans"
                />
              </div>
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

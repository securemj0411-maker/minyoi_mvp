// 요금제 정의 — UI/API/RPC 공통 SoT.
// 변경 시 supabase RPC (subscribe_mvp_plan) 인자도 같이 본다.

export type PlanKey = "free" | "starter" | "plus" | "pro";

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  priceKrw: number;
  monthlyCredits: number;
  dailyOpenLimit: number; // -1 = 무제한 (admin), 0 = 차단
  cadence: string;
  tagline: string;
  highlight?: boolean;
  badge?: string;
  features: string[];
};

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    name: "Free",
    priceKrw: 0,
    monthlyCredits: 5,
    dailyOpenLimit: 3,
    cadence: "가입 시 1회 지급",
    tagline: "무료 탐색",
    features: ["매일 추천 피드 30개", "상세보기 하루 3회", "가입 보너스 5크레딧"],
  },
  starter: {
    key: "starter",
    name: "Starter",
    priceKrw: 9_900,
    monthlyCredits: 30,
    dailyOpenLimit: 2,
    cadence: "월 결제",
    tagline: "처음 리셀 시도하는 분",
    badge: "입문",
    features: [
      "월 30 크레딧 지급",
      "하루 2회 추천 열람",
      "월 자동 갱신 (Free 는 1회 지급)",
    ],
  },
  plus: {
    key: "plus",
    name: "Plus",
    priceKrw: 19_900,
    monthlyCredits: 200,
    dailyOpenLimit: 200,
    cadence: "단건 충전",
    tagline: "자주 확인하는 사용자",
    highlight: true,
    badge: "Most popular",
    features: [
      "200 크레딧 즉시 충전",
      "크레딧 1개당 약 100원",
      "상세보기/원본 확인 하루 200회",
      "여러 카테고리와 조건을 넉넉하게 탐색",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    priceKrw: 39_900,
    monthlyCredits: 200,
    dailyOpenLimit: 20,
    cadence: "월 결제",
    tagline: "본업처럼 돌리는 분",
    badge: "Pro",
    features: [
      "월 200 크레딧 지급",
      "하루 20회 추천 열람",
      "🔥 핫딜 텔레그램 알림 (Pro 전용)",
      "사용 패턴 리포트 (예정)",
    ],
  },
};

export function planForKey(key: string | null | undefined): PlanDefinition {
  if (!key) return PLANS.free;
  const lower = key.toLowerCase();
  if (lower === "free" || lower === "starter" || lower === "plus" || lower === "pro") {
    return PLANS[lower];
  }
  return PLANS.free;
}

export function formatKrw(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "0원";
  return `${amount.toLocaleString("ko-KR")}원`;
}

export const PAID_PLAN_KEYS: PlanKey[] = ["starter", "plus", "pro"];

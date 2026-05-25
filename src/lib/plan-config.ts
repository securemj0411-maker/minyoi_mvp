// 크레딧 패키지 정의 — UI/API/RPC 공통 SoT.
// 변경 시 supabase RPC (subscribe_mvp_plan) 인자도 같이 본다.

export type PlanKey = "free" | "single" | "trial" | "starter" | "plus" | "pro";

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
    monthlyCredits: 0,
    dailyOpenLimit: 1,
    cadence: "첫 상세 1회 무료",
    tagline: "무료 탐색",
    features: ["추천 피드 무료 탐색", "첫 상세보기 1회 무료", "이후 새 상품 1개당 1크레딧"],
  },
  single: {
    key: "single",
    name: "1 크레딧",
    priceKrw: 690,
    monthlyCredits: 1,
    dailyOpenLimit: 1,
    cadence: "이번 매물만",
    tagline: "지금 눈에 띈 매물 하나만 열 때",
    badge: "단건",
    features: [
      "1 크레딧 즉시 충전",
      "이번 매물 상세보기 1회분",
      "자동 갱신 없는 단건 결제",
    ],
  },
  trial: {
    key: "trial",
    name: "5 크레딧",
    priceKrw: 2_900,
    monthlyCredits: 5,
    dailyOpenLimit: 5,
    cadence: "체험팩",
    tagline: "몇 개만 더 확인해보고 싶을 때",
    badge: "체험",
    features: [
      "5 크레딧 즉시 충전",
      "크레딧 1개당 약 580원",
      "자동 갱신 없는 단건 결제",
    ],
  },
  starter: {
    key: "starter",
    name: "20 크레딧",
    priceKrw: 9_900,
    monthlyCredits: 20,
    dailyOpenLimit: 20,
    cadence: "단건 충전",
    tagline: "일상적으로 후보를 열어볼 때",
    highlight: true,
    badge: "추천",
    features: [
      "20 크레딧 즉시 충전",
      "크레딧 1개당 약 495원",
      "자동 갱신 없는 단건 결제",
    ],
  },
  plus: {
    key: "plus",
    name: "45 크레딧",
    priceKrw: 19_900,
    monthlyCredits: 45,
    dailyOpenLimit: 45,
    cadence: "단건 충전",
    tagline: "여러 카테고리를 꾸준히 보는 사용자",
    badge: "가성비",
    features: [
      "45 크레딧 즉시 충전",
      "크레딧 1개당 약 442원",
      "상세보기/원본 확인 45회분",
      "여러 카테고리와 조건을 넉넉하게 확인",
    ],
  },
  pro: {
    key: "pro",
    name: "130 크레딧",
    priceKrw: 49_900,
    monthlyCredits: 130,
    dailyOpenLimit: 130,
    cadence: "단건 충전",
    tagline: "대량 탐색/고빈도 사용자",
    badge: "최대 효율",
    features: [
      "130 크레딧 즉시 충전",
      "크레딧 1개당 약 384원",
      "대량 상세보기와 원본 확인에 적합",
    ],
  },
};

export function planForKey(key: string | null | undefined): PlanDefinition {
  if (!key) return PLANS.free;
  const lower = key.toLowerCase();
  if (lower === "free" || lower === "single" || lower === "trial" || lower === "starter" || lower === "plus" || lower === "pro") {
    return PLANS[lower];
  }
  return PLANS.free;
}

export function formatKrw(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "0원";
  return `${amount.toLocaleString("ko-KR")}원`;
}

export const PAID_PLAN_KEYS: PlanKey[] = ["single", "trial", "starter", "plus", "pro"];

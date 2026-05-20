// 크레딧 패키지 정의 — UI/API/RPC 공통 SoT.
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
    monthlyCredits: 0,
    dailyOpenLimit: 3,
    cadence: "첫 3개 무료",
    tagline: "무료 탐색",
    features: ["매일 추천 피드 30개", "첫 상세보기 3개 무료", "이후 새 상품 1개당 1크레딧"],
  },
  starter: {
    key: "starter",
    name: "20 크레딧",
    priceKrw: 3_900,
    monthlyCredits: 20,
    dailyOpenLimit: 20,
    cadence: "단건 충전",
    tagline: "가볍게 한두 번 써볼 때",
    badge: "입문",
    features: [
      "20 크레딧 즉시 충전",
      "크레딧 1개당 약 195원",
      "자동 갱신 없는 단건 결제",
    ],
  },
  plus: {
    key: "plus",
    name: "200 크레딧",
    priceKrw: 19_900,
    monthlyCredits: 200,
    dailyOpenLimit: 200,
    cadence: "단건 충전",
    tagline: "자주 확인하는 사용자",
    highlight: true,
    badge: "추천",
    features: [
      "200 크레딧 즉시 충전",
      "크레딧 1개당 약 100원",
      "상세보기/원본 확인 200회분",
      "여러 카테고리와 조건을 넉넉하게 확인",
    ],
  },
  pro: {
    key: "pro",
    name: "500 크레딧",
    priceKrw: 39_900,
    monthlyCredits: 500,
    dailyOpenLimit: 500,
    cadence: "단건 충전",
    tagline: "대량 탐색/고빈도 사용자",
    badge: "최대 효율",
    features: [
      "500 크레딧 즉시 충전",
      "크레딧 1개당 약 80원",
      "대량 상세보기와 원본 확인에 적합",
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

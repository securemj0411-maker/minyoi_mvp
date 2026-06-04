export type MembershipPlanKey =
  | "limited_300_1mo"
  | "limited_300_3mo"
  | "limited_300_6mo"
  | "limited_300_12mo"
  | "limited_300_upsell_3mo_59"
  | "limited_300_upsell_6mo_109"
  | "limited_300_upsell_12mo_199"
  | "limited_300_upsell_6mo_139"
  | "limited_300_upsell_12mo_249"
  | "limited_300_upgrade_to_6mo_50"
  | "limited_300_upgrade_to_12mo_100"
  | "limited_300_upgrade_to_12mo_70"
  | "limited_300_upgrade_to_12mo_50";

export type MembershipPlan = {
  key: MembershipPlanKey;
  months: number;
  priceKrw: number;
  label: string;
  monthlyLabel: string;
  badge?: string;
  valueNote: string;
  paybackNote: string;
  isUpsell?: boolean;
  upgradeTargetMonths?: number;
};

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    key: "limited_300_1mo",
    months: 1,
    priceKrw: 49_000,
    label: "1개월",
    monthlyLabel: "49,000원",
    badge: "체험",
    valueNote: "먼저 감 잡는 짧은 신청",
    paybackNote: "목표: 1건만 잡아도 비용 회수",
  },
  {
    key: "limited_300_3mo",
    months: 3,
    priceKrw: 99_000,
    label: "3개월",
    monthlyLabel: "월 33,000원꼴",
    badge: "추천",
    valueNote: "가장 무난한 시작 구간",
    paybackNote: "월 1건 목표로 루틴 만들기",
  },
  {
    key: "limited_300_6mo",
    months: 6,
    priceKrw: 169_000,
    label: "6개월",
    monthlyLabel: "월 28,000원대",
    badge: "할인",
    valueNote: "시즌별 상품군까지 테스트",
    paybackNote: "장기 카테고리 감 잡기",
  },
  {
    key: "limited_300_12mo",
    months: 12,
    priceKrw: 299_000,
    label: "12개월",
    monthlyLabel: "월 25,000원대",
    badge: "최저 단가",
    valueNote: "1년 동안 조용히 누적",
    paybackNote: "월 단가 약 49% 절감",
  },
];

export const UPSELL_PLANS_FROM_1MO: MembershipPlan[] = [
  {
    key: "limited_300_upsell_3mo_59",
    months: 3,
    priceKrw: 59_000,
    label: "3개월 특별가",
    monthlyLabel: "월 19,600원대",
    badge: "추천 전환",
    valueNote: "1개월보다 1만원만 더 내고 3개월",
    paybackNote: "정가 99,000원 대비 40,000원 절감",
    isUpsell: true,
  },
  {
    key: "limited_300_upsell_6mo_109",
    months: 6,
    priceKrw: 109_000,
    label: "6개월 특별가",
    monthlyLabel: "월 18,100원대",
    badge: "장기 할인",
    valueNote: "시즌 테스트까지 넉넉하게",
    paybackNote: "정가 169,000원 대비 60,000원 절감",
    isUpsell: true,
  },
  {
    key: "limited_300_upsell_12mo_199",
    months: 12,
    priceKrw: 199_000,
    label: "12개월 특별가",
    monthlyLabel: "월 16,500원대",
    badge: "최대 할인",
    valueNote: "오래 쓸 사람에게 제일 낮은 단가",
    paybackNote: "정가 299,000원 대비 100,000원 절감",
    isUpsell: true,
  },
];

export const UPSELL_PLANS_FROM_3MO: MembershipPlan[] = [
  {
    key: "limited_300_upsell_6mo_139",
    months: 6,
    priceKrw: 139_000,
    label: "6개월 전환가",
    monthlyLabel: "월 23,100원대",
    badge: "기간 2배",
    valueNote: "3개월 신청자 전용 장기 조건",
    paybackNote: "정가 169,000원 대비 30,000원 절감",
    isUpsell: true,
  },
  {
    key: "limited_300_upsell_12mo_249",
    months: 12,
    priceKrw: 249_000,
    label: "12개월 전환가",
    monthlyLabel: "월 20,700원대",
    badge: "장기 고정",
    valueNote: "니즈 강한 사람용 1년 조건",
    paybackNote: "정가 299,000원 대비 50,000원 절감",
    isUpsell: true,
  },
];

export const RENEWAL_UPGRADE_PLANS: MembershipPlan[] = [
  {
    key: "limited_300_upgrade_to_6mo_50",
    months: 6,
    priceKrw: 50_000,
    label: "6개월 전환",
    monthlyLabel: "차액 50,000원",
    badge: "1시간 한정",
    valueNote: "1개월권을 6개월권으로 바꾸는 차액 조건",
    paybackNote: "기존 기간에 단순 추가가 아니라 목표 기간까지 전환",
    isUpsell: true,
    upgradeTargetMonths: 6,
  },
  {
    key: "limited_300_upgrade_to_12mo_100",
    months: 12,
    priceKrw: 100_000,
    label: "12개월 전환",
    monthlyLabel: "차액 100,000원",
    badge: "최대 전환",
    valueNote: "1개월권을 12개월권으로 바꾸는 차액 조건",
    paybackNote: "1년권 정가보다 낮은 전환 조건",
    isUpsell: true,
    upgradeTargetMonths: 12,
  },
  {
    key: "limited_300_upgrade_to_12mo_70",
    months: 12,
    priceKrw: 70_000,
    label: "12개월 전환",
    monthlyLabel: "차액 70,000원",
    badge: "3개월 멤버 전용",
    valueNote: "3개월권을 12개월권으로 바꾸는 차액 조건",
    paybackNote: "몇 만원만 더 내고 1년권으로 고정",
    isUpsell: true,
    upgradeTargetMonths: 12,
  },
  {
    key: "limited_300_upgrade_to_12mo_50",
    months: 12,
    priceKrw: 50_000,
    label: "12개월 전환",
    monthlyLabel: "차액 50,000원",
    badge: "장기 멤버 전용",
    valueNote: "6개월권 이상 멤버를 12개월권으로 바꾸는 차액 조건",
    paybackNote: "남은 기간을 1년권으로 맞추는 전환 조건",
    isUpsell: true,
    upgradeTargetMonths: 12,
  },
];

export const ALL_MEMBERSHIP_PLANS = [
  ...MEMBERSHIP_PLANS,
  ...UPSELL_PLANS_FROM_1MO,
  ...UPSELL_PLANS_FROM_3MO,
  ...RENEWAL_UPGRADE_PLANS,
];

export function getMembershipPlan(key: string | null | undefined): MembershipPlan {
  return ALL_MEMBERSHIP_PLANS.find((plan) => plan.key === key) ?? MEMBERSHIP_PLANS[1];
}

export function krw(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

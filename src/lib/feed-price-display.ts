function formatManwon(value: number) {
  return value.toLocaleString("ko-KR");
}

export function teaserBudgetRangeLabel(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "예산 확인";

  const manwon = Math.max(1, Math.round(n / 10000));
  if (manwon <= 15) return "15만원 이하";

  let lower: number;
  let upper: number;

  if (manwon <= 40) {
    lower = Math.max(15, Math.floor((manwon - 10) / 10) * 10);
    upper = Math.ceil((manwon + 10) / 10) * 10;
  } else if (manwon <= 80) {
    lower = Math.max(30, Math.floor((manwon - 10) / 10) * 10);
    upper = Math.ceil((manwon + 20) / 10) * 10;
  } else if (manwon <= 150) {
    lower = Math.floor((manwon - 20) / 10) * 10;
    upper = Math.ceil((manwon + 10) / 10) * 10;
  } else if (manwon <= 300) {
    lower = Math.floor((manwon - 30) / 10) * 10;
    upper = Math.ceil((manwon + 30) / 10) * 10;
  } else if (manwon <= 800) {
    lower = Math.floor((manwon * 0.85) / 50) * 50;
    upper = Math.ceil((manwon * 1.15) / 50) * 50;
  } else {
    lower = Math.floor((manwon * 0.85) / 100) * 100;
    upper = Math.ceil((manwon * 1.15) / 100) * 100;
  }

  lower = Math.max(1, lower);
  if (upper <= lower) upper = lower + 10;

  return `${formatManwon(lower)}~${formatManwon(upper)}만원`;
}

export function teaserProfitLabel(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "수익 후보";
  if (n < 10000) return "약 +1만원 미만";
  const manwon = Math.max(1, Math.round(n / 10000));
  return `약 +${formatManwon(manwon)}만원`;
}

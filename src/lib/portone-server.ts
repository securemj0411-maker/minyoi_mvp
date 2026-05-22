type PortOnePayment = {
  status?: string;
  amount?: {
    total?: number;
  };
};

export type PortOneVerificationResult =
  | { ok: true; skipped: false; status: string; amount: number }
  | { ok: true; skipped: true; status: "SKIPPED_DEV_NO_SECRET"; amount: number }
  | { ok: false; error: string; message: string; statusCode: number };

export async function verifyPortOnePayment(input: {
  paymentId: string;
  expectedAmount: number;
}): Promise<PortOneVerificationResult> {
  const apiSecret = process.env.PORTONE_API_SECRET?.trim();
  // Wave launch-15 (audit HIGH): prod 에서는 PORTONE_SKIP_VERIFY 무시.
  // 이전엔 prod 라도 env 켜면 검증 skip → ops 실수 시 위조 paymentId 무한 credit risk.
  // 이제 dev / preview 에서만 skip 허용.
  const canSkipVerification = process.env.NODE_ENV !== "production";

  if (!apiSecret) {
    if (canSkipVerification) {
      return {
        ok: true,
        skipped: true,
        status: "SKIPPED_DEV_NO_SECRET",
        amount: input.expectedAmount,
      };
    }
    return {
      ok: false,
      error: "portone_secret_missing",
      message: "결제 검증 설정이 아직 완료되지 않았어요.",
      statusCode: 500,
    };
  }

  const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(input.paymentId)}`, {
    headers: { Authorization: `PortOne ${apiSecret}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      ok: false,
      error: "portone_lookup_failed",
      message: "결제 승인 내역을 확인하지 못했어요.",
      statusCode: 502,
    };
  }

  const payment = (await res.json()) as PortOnePayment;
  const paidAmount = Number(payment.amount?.total ?? NaN);

  if (payment.status !== "PAID") {
    return {
      ok: false,
      error: "portone_not_paid",
      message: "아직 결제가 완료되지 않았어요.",
      statusCode: 402,
    };
  }

  if (!Number.isFinite(paidAmount) || paidAmount !== input.expectedAmount) {
    return {
      ok: false,
      error: "portone_amount_mismatch",
      message: "결제 금액이 선택한 충전권과 일치하지 않아요.",
      statusCode: 400,
    };
  }

  return { ok: true, skipped: false, status: payment.status, amount: paidAmount };
}

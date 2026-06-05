"use client";

import Image from "next/image";

export function TossPaymentLogo({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-12 w-[132px] items-center justify-center rounded-2xl bg-[#0b1220] px-4 ring-1 ring-white/15 shadow-[0_10px_22px_rgba(15,23,42,0.20)] ${className}`}
    >
      <Image
        src="/payment/toss-logo-white.png"
        alt="Toss"
        width={104}
        height={52}
        className="h-auto w-[86px] object-contain"
        priority={false}
      />
    </span>
  );
}

export function KbankPaymentLogo({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-12 w-[132px] items-center justify-center rounded-2xl bg-[#101bb5] px-4 ring-1 ring-blue-200/50 shadow-[0_10px_22px_rgba(16,27,181,0.20)] ${className}`}
    >
      <Image
        src="/payment/kbank-logo.png"
        alt="Kbank"
        width={96}
        height={48}
        className="h-auto w-[86px] object-contain"
        priority={false}
      />
    </span>
  );
}

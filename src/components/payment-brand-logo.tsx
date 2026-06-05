"use client";

import Image from "next/image";

export function TossPaymentLogo({
  className = "w-[70px]",
}: {
  className?: string;
}) {
  return (
    <Image
      src="/payment/toss-logo.png"
      alt="Toss"
      width={104}
      height={52}
      className={`h-auto object-contain ${className}`}
      priority={false}
    />
  );
}

export function KbankPaymentLogo({
  className = "w-[58px]",
}: {
  className?: string;
}) {
  return (
    <Image
      src="/payment/kbank-logo.png"
      alt="Kbank"
      width={72}
      height={36}
      className={`h-auto object-contain ${className}`}
      priority={false}
    />
  );
}

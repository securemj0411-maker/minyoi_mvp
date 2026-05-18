"use client";

import { useId } from "react";

type CreditIconProps = {
  size?: number;
  className?: string;
};

export default function CreditIcon({ size = 24, className = "" }: CreditIconProps) {
  const id = useId().replace(/:/g, "");
  const faceId = `${id}-credit-coin-face`;
  const rimId = `${id}-credit-coin-rim`;
  const shineId = `${id}-credit-coin-shine`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={faceId} x1="18" y1="10" x2="47" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d3aa3e" />
          <stop offset="0.48" stopColor="#bf9430" />
          <stop offset="1" stopColor="#9c7621" />
        </linearGradient>
        <linearGradient id={rimId} x1="13" y1="7" x2="52" y2="59" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b88b28" />
          <stop offset="0.5" stopColor="#8f6a1f" />
          <stop offset="1" stopColor="#6f5218" />
        </linearGradient>
        <radialGradient id={shineId} cx="0" cy="0" r="1" gradientTransform="translate(24 18) rotate(55) scale(35 31)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e8c862" stopOpacity="0.9" />
          <stop offset="0.62" stopColor="#d0a23c" stopOpacity="0.18" />
          <stop offset="1" stopColor="#7b5c1d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${rimId})`} />
      <circle cx="32" cy="32" r="26.5" fill={`url(#${faceId})`} />
      <circle cx="32" cy="32" r="23.5" stroke="#7f5d1b" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="26.5" fill={`url(#${shineId})`} />
      <rect x="25.5" y="25.5" width="13" height="13" fill="#6f5218" opacity="0.9" />
      <rect x="31.8" y="12.5" width="5.2" height="5.2" transform="rotate(45 31.8 12.5)" fill="#33270e" opacity="0.9" />
      <rect x="31.8" y="45.5" width="5.2" height="5.2" transform="rotate(45 31.8 45.5)" fill="#33270e" opacity="0.9" />
      <rect x="14.8" y="28.8" width="5.2" height="5.2" transform="rotate(45 14.8 28.8)" fill="#33270e" opacity="0.9" />
      <rect x="48.8" y="28.8" width="5.2" height="5.2" transform="rotate(45 48.8 28.8)" fill="#33270e" opacity="0.9" />
    </svg>
  );
}

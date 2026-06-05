"use client";

// Credit-balance reward toasts belonged to the old credit/referral model.
// Keep the component mounted by layout.tsx, but make it a no-op so stale
// mvp_user_credits updates can never surface legacy rewards to members.
export default function BalanceToast() {
  return null;
}

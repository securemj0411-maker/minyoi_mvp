import type { PackBand, RevealCard } from "@/lib/pack-open";

export const PACK_REVEALS_UPDATED_EVENT = "minyoi:pack-reveals-updated";

export type PackRevealsUpdatedDetail = {
  band: PackBand;
  reveals: RevealCard[];
};

export function dispatchPackRevealsUpdated(detail: PackRevealsUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PackRevealsUpdatedDetail>(PACK_REVEALS_UPDATED_EVENT, { detail }));
}

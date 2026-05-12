import MeDashboardClient from "@/components/me-dashboard-client";
import { loadInventory, type InventorySnapshot } from "@/lib/pack-open";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MePage() {
  let inventory: InventorySnapshot[] = [];
  try {
    inventory = await loadInventory();
  } catch {
    inventory = [];
  }

  return <MeDashboardClient initialInventory={inventory} />;
}

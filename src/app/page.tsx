import PackShop from "@/components/pack-shop";
import { loadInventory, type InventorySnapshot } from "@/lib/pack-open";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  let inventory: InventorySnapshot[] = [];
  try {
    inventory = await loadInventory();
  } catch {
    inventory = [];
  }
  return <PackShop initialInventory={inventory} />;
}

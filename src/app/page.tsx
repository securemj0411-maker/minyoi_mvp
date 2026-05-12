import PackShop from "@/components/pack-shop";
import { getLandingKpis, getLandingShowcases } from "@/lib/landing-showcases";

export default async function Home() {
  const [showcases, kpis] = await Promise.all([getLandingShowcases(), getLandingKpis()]);
  return <PackShop showcases={showcases} kpis={kpis} />;
}

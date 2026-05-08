import Dashboard from "@/components/dashboard";
import { loadCandidates } from "@/lib/candidates";

export default async function Home() {
  const data = await loadCandidates();
  return <Dashboard {...data} />;
}

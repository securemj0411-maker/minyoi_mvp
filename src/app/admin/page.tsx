import Dashboard from "@/components/dashboard";
import { loadCandidates } from "@/lib/candidates";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await loadCandidates();
  return <Dashboard {...data} />;
}

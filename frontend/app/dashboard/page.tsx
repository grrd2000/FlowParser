import { fetchUserProfile } from "@/lib/serverApi";
import { DashboardClient, RangeKey } from "@/components/DashboardClient";

function normalizeRange(value: string | null | undefined): RangeKey {
  const allowed: RangeKey[] = ["1m", "3m", "6m", "ytd", "all"];
  return allowed.includes(value as RangeKey) ? (value as RangeKey) : "3m";
}

export default async function DashboardPage() {
  const profile = await fetchUserProfile();
  const initialRange = normalizeRange(profile?.default_range);

  return <DashboardClient initialRange={initialRange} />;
}

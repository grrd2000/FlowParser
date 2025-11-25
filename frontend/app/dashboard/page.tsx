import { fetchTransactions, fetchUserProfile } from "@/lib/serverApi";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const [transactions, profile] = await Promise.all([
    fetchTransactions(),
    fetchUserProfile(),
  ]);

  return (
    <DashboardClient
      transactions={transactions}
      initialRange={profile.default_range as any} // "1m" | "3m" | ...
    />
  );
}
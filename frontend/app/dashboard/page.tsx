// frontend/app/dashboard/page.tsx
import { fetchTransactions } from "@/lib/serverApi";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const transactions = await fetchTransactions();

  return <DashboardClient transactions={transactions} />;
}

// frontend/app/profile/accounts/page.tsx
import { fetchAccounts } from "@/lib/serverApi";
import { AccountsClient } from "@/components/AccountsClient";

export default async function AccountsPage() {
  const accounts = await fetchAccounts();

  return <AccountsClient accounts={accounts} />;
}

// frontend/app/profile/statements/page.tsx
import { fetchStatements } from "@/lib/serverApi";
import { StatementsClient } from "@/components/StatementsClient";

export default async function StatementsPage() {
  const statements = await fetchStatements();

  return <StatementsClient statements={statements} />;
}

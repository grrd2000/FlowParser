// frontend/lib/api.ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://api:8000";

export type Transaction = {
  id: number;
  account_id: number;
  operation_date: string;
  value_date: string | null;
  description: string;
  amount: string;
  category: string | null;
  is_manual: boolean;
};

export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE_URL}/transactions`, {
    cache: "no-store", // zawsze świeże dane
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

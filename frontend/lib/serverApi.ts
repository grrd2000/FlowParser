// frontend/lib/serverApi.ts

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

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  currency: string;
  default_range: string;
  default_granularity: string;
  theme: string;
};

// Używamy innych adresów w SSR (Node) i w przeglądarce
const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_BASE_URL ?? "http://api:8000"
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE_URL}/transactions`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/user/me`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return res.json();
}

export type AccountSummary = {
  id: number;
  name: string;
  institution: string | null;
  currency: string;
  account_number: string | null;
  owner: string | null;
  created_at: string | null;
  transaction_count: number;
};

export async function fetchAccounts(): Promise<AccountSummary[]> {
  const res = await fetch(`${API_BASE_URL}/accounts`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export type StatementSummary = {
  id: number;
  account_id: number;
  account_name: string;
  account_number: string | null;
  institution: string | null;
  currency: string;

  file_name: string;
  source_type: string | null;

  period_start: string | null;
  period_end: string | null;
  issue_date: string | null;

  pages_total: number | null;

  turnover_ma: number | null;
  turnover_wn: number | null;
  previous_balance: number | null;

  import_status: string | null;
  total_rows: number | null;
  imported_rows: number | null;
  error_rows: number | null;
  finished_at: string | null;

  import_runs_count: number;
  is_reimported: boolean;
};

export async function fetchStatements(): Promise<StatementSummary[]> {
  const res = await fetch(`${API_BASE_URL}/statements`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
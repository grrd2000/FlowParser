// frontend/lib/clientApi.ts
export const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

import type { Transaction } from "@/lib/serverApi";

/**
 * Client-side fetch transakcji z filtrami.
 * Używane w komponentach "use client" (np. z datepickerem).
 */
export async function fetchTransactionsClient(opts: {
  accountId?: number;
  from?: string;
  to?: string;
}): Promise<Transaction[]> {
  const url = new URL("/transactions", PUBLIC_API_BASE_URL);

  if (opts.accountId != null) {
    url.searchParams.set("account_id", String(opts.accountId));
  }
  if (opts.from) {
    url.searchParams.set("from", opts.from); // backend używa aliasu "from"
  }
  if (opts.to) {
    url.searchParams.set("to", opts.to);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

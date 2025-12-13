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
  category_id?: number | null;
  category_source?: string | null;
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

export type Category = {
  id: number;
  name: string;
  color?: string | null;
  icon?: string | null;
  is_system: boolean;
};

export type CategoryRule = {
  id: number;
  category_id: number;
  field: string;
  pattern_type: string;
  pattern_value: string;
  priority: number;
  enabled: boolean;
};

export type RuleSuggestion = {
  pattern_value: string;
  pattern_type: "contains" | "startswith";
  category_id: number;
  similar_count: number;
};

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE_URL}/categories`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }

  return res.json();
}

export async function updateTransactionCategory(
  txId: number,
  categoryId: number | null
): Promise<{ transaction: Transaction; rule_suggestion: RuleSuggestion | null }> {
  const res = await fetch(`${API_BASE_URL}/transactions/${txId}/category`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category_id: categoryId }),
  });
  if (!res.ok) {
    throw new Error("Failed to update category");
  }

  const data = await res.json();

  const { rule_suggestion, ...txRest } = data;

  return {
    transaction: txRest as Transaction,
    rule_suggestion: (rule_suggestion ?? null) as RuleSuggestion | null,
  };
}



export type LabSuggestion = {
  suggestion_key: string;
  pattern_value: string;
  pattern_type: "contains" | "startswith";
  category_id: number;
  category_name: string;
  manual_occurrences: number;
  potential_matches: number;
};

export type LabInsights = {
  coverage_total: number;
  coverage_categorized: number;
  coverage_pct: number;
  assignments_manual: number;
  assignments_rule: number;
  suggestions: LabSuggestion[];
};

export async function fetchLabInsights(): Promise<LabInsights> {
  const res = await fetch(`${API_BASE_URL}/lab/insights`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch lab insights");
  return res.json();
}

export async function enableLabRule(payload: {
  pattern_value: string;
  pattern_type: "contains" | "startswith";
  category_id: number;
}): Promise<{ created: boolean; applied: number }> {
  const res = await fetch(`${API_BASE_URL}/lab/enable-rule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to enable rule");
  return res.json();
}

export type LabOverview = {
  coverage_total: number;
  coverage_categorized: number;
  coverage_pct: number;
  assignments_manual: number;
  assignments_rule: number;
};

export async function fetchLabOverview(): Promise<LabOverview> {
  const res = await fetch(`${API_BASE_URL}/lab/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch lab overview");
  return res.json();
}

export type CategoryRuleUI = {
  id: number;
  enabled: boolean;
  priority: number;
  field: string;
  pattern_type: string;
  pattern_value: string;
  category_id: number;
  category_name: string;
  used_count: number;
};


export async function toggleCategoryRule(ruleId: number): Promise<{ id: number; enabled: boolean }> {
  const res = await fetch(`${API_BASE_URL}/category-rules/${ruleId}/toggle`, {
    method: "PUT",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to toggle rule");
  return res.json();
}

export async function fetchCategoryStats(): Promise<Record<number, number>> {
  const res = await fetch(`${API_BASE_URL}/categories/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function createCategory(payload: {
  name: string;
  color?: string | null;
  icon?: string | null;
}): Promise<Category> {
  const res = await fetch(`${API_BASE_URL}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function updateCategory(
  id: number,
  payload: { name?: string; color?: string | null; icon?: string | null }
): Promise<Category> {
  const res = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function deleteCategory(
  id: number,
  unassign: boolean,
  deleteRules: boolean = false
): Promise<void> {
  const params = new URLSearchParams();
  if (unassign) params.set("unassign", "true");
  if (deleteRules) params.set("delete_rules", "true");

  const res = await fetch(`${API_BASE_URL}/categories/${id}?${params.toString()}`, {
    method: "DELETE",
    cache: "no-store",
  });

  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch {}
    const detail = payload?.detail ?? payload ?? null;
    // przekaż w error jako JSON-string (łatwiej zdekodować w UI)
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}


export async function fetchCategoryRules(): Promise<CategoryRule[]> {
  const res = await fetch(`${API_BASE_URL}/category-rules`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function createCategoryRule(payload: {
  category_id: number;
  pattern_value: string;
  pattern_type?: string;
  field?: string;
}): Promise<CategoryRule> {
  const res = await fetch(`${API_BASE_URL}/category-rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function updateCategoryRule(
  id: number,
  payload: Partial<{
    category_id: number;
    pattern_value: string;
    pattern_type: string;
    field: string;
    priority: number;
    enabled: boolean;
  }>
): Promise<CategoryRule> {
  const res = await fetch(`${API_BASE_URL}/category-rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function deleteCategoryRule(id: number): Promise<{ deleted: boolean }> {
  const res = await fetch(`${API_BASE_URL}/category-rules/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function reorderCategoryRules(ruleIds: number[]): Promise<CategoryRule[]> {
  const res = await fetch(`${API_BASE_URL}/category-rules/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rule_ids: ruleIds }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function applyCategoryRules(): Promise<{ assigned: number }> {
  const res = await fetch(`${API_BASE_URL}/category-rules/apply`, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}


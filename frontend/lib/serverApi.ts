// frontend/lib/serverApi.ts
// Jedno miejsce do komunikacji z backendem.
// - SSR (kod serwerowy Next): INTERNAL_API_BASE_URL = http://api:8000 (docker network)
// - Browser (kod klienta): NEXT_PUBLIC_API_BASE_URL = http://localhost:8000

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

export type StatementSummary = {
  id: number;
  account_id: number;
  file_name: string;
  storage_path: string | null;
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
  is_reimported: boolean | null;

  account_name: string | null;
  institution: string | null;
  currency: string | null;
  account_number: string | null;
};

export type Category = {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
};

export type CategoryRule = {
  id: number;
  category_id: number;
  pattern_type: "contains" | "startswith";
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

export type LabSuggestion = {
  tx_id: number;
  description: string;
  suggested_category_id: number;
  suggested_category_name: string;
  confidence: number;
};

export type LabInsights = {
  coverage_total: number;
  coverage_categorized: number;
  coverage_pct: number;
  assignments_manual: number;
  assignments_rule: number;
  suggestions: LabSuggestion[];
};

export type LabOverview = {
  coverage_total: number;
  coverage_categorized: number;
  coverage_pct: number;
  assignments_manual: number;
  assignments_rule: number;
};

export type CategoryRuleUI = {
  id: number;
  category_id: number;
  category_name: string;
  pattern_type: "contains" | "startswith";
  pattern_value: string;
  priority: number;
  enabled: boolean;
};

// Używamy innych adresów bazowych w zależności od środowiska (SSR vs browser)
const API_BASE_URL = (() => {
  const fallback = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_BASE_URL ?? fallback;
  }

  return fallback;
})();

function buildUrl(path: string) {
  return path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function getServerCookieHeader(): Promise<string | undefined> {
  if (typeof window !== "undefined") return undefined;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const serialized = cookieStore
      .getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");

    return serialized || undefined;
  } catch (err) {
    console.warn("Nie udało się odczytać ciasteczek w środowisku serwera", err);
    return undefined;
  }
}

async function parseJsonSafe(res: Response) {
  // dla 204/empty body
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  opts?: {
    allowUnauthorized?: boolean;
    unauthorizedValue?: T;
  }
): Promise<T> {
  const cookieHeader = await getServerCookieHeader();

  const res = await fetch(buildUrl(path), {
    cache: init.cache ?? "no-store",
    credentials: "include", // kluczowe: cookie-session/JWT w HttpOnly
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });

  if (opts?.allowUnauthorized && res.status === 401) {
    return opts.unauthorizedValue as T;
  }

  if (!res.ok) {
    const payload = await parseJsonSafe(res);
    const detail = (payload as any)?.detail ?? payload ?? null;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return (await parseJsonSafe(res)) as T;
}

export async function fetchTransactions(): Promise<Transaction[]> {
  return requestJson<Transaction[]>("/transactions", {}, {
    allowUnauthorized: true,
    unauthorizedValue: [],
  });
}

// Zwraca null, jeśli user nie jest zalogowany (401)
export async function fetchUserProfile(): Promise<UserProfile | null> {
  return requestJson<UserProfile | null>("/user/me", {}, {
    allowUnauthorized: true,
    unauthorizedValue: null,
  });
}

export async function updateUserProfile(payload: {
  name: string;
  email: string;
  currency: string;
  default_range: string;
  default_granularity: string;
  theme: string;
}): Promise<UserProfile> {
  return requestJson<UserProfile>("/user/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAccounts(): Promise<AccountSummary[]> {
  return requestJson<AccountSummary[]>("/accounts", {}, {
    allowUnauthorized: true,
    unauthorizedValue: [],
  });
}

export async function fetchStatements(): Promise<StatementSummary[]> {
  return requestJson<StatementSummary[]>("/statements", {}, {
    allowUnauthorized: true,
    unauthorizedValue: [],
  });
}

export async function fetchCategories(): Promise<Category[]> {
  return requestJson<Category[]>("/categories", {}, {
    allowUnauthorized: true,
    unauthorizedValue: [],
  });
}

export async function updateTransactionCategory(
  txId: number,
  categoryId: number | null
): Promise<{ transaction: Transaction; rule_suggestion: RuleSuggestion | null }> {
  return requestJson<{ transaction: Transaction; rule_suggestion: RuleSuggestion | null }>(
    `/transactions/${txId}/category`,
    {
      method: "PUT",
      body: JSON.stringify({ category_id: categoryId }),
    }
  );
}

export async function fetchLabInsights(): Promise<LabInsights> {
  return requestJson<LabInsights>("/lab/insights", {}, {
    allowUnauthorized: true,
    unauthorizedValue: {
      coverage_total: 0,
      coverage_categorized: 0,
      coverage_pct: 0,
      assignments_manual: 0,
      assignments_rule: 0,
      suggestions: [],
    },
  });
}

export async function enableLabRule(payload: {
  pattern_type: "contains" | "startswith";
  pattern_value: string;
  category_id: number;
}): Promise<{ created: boolean }> {
  return requestJson<{ created: boolean }>("/lab/enable-rule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchLabOverview(): Promise<LabOverview> {
  return requestJson<LabOverview>("/lab/overview", {}, {
    allowUnauthorized: true,
    unauthorizedValue: {
      coverage_total: 0,
      coverage_categorized: 0,
      coverage_pct: 0,
      assignments_manual: 0,
      assignments_rule: 0,
    },
  });
}

export async function toggleCategoryRule(
  ruleId: number
): Promise<{ id: number; enabled: boolean }> {
  return requestJson<{ id: number; enabled: boolean }>(
    `/category-rules/${ruleId}/toggle`,
    { method: "PUT" }
  );
}

export async function fetchCategoryStats(): Promise<Record<number, number>> {
  return requestJson<Record<number, number>>("/categories/stats", {}, {
    allowUnauthorized: true,
    unauthorizedValue: {},
  });
}

export async function createCategory(payload: {
  name: string;
  color?: string | null;
  icon?: string | null;
}): Promise<Category> {
  return requestJson<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(
  id: number,
  payload: {
    name?: string;
    color?: string | null;
    icon?: string | null;
  }
): Promise<Category> {
  return requestJson<Category>(`/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(
  id: number,
  unassign: boolean,
  deleteRules: boolean = false
): Promise<void> {
  const params = new URLSearchParams();
  if (unassign) params.set("unassign", "true");
  if (deleteRules) params.set("delete_rules", "true");

  await requestJson<unknown>(`/categories/${id}?${params.toString()}`, {
    method: "DELETE",
  });
}

export async function fetchCategoryRules(): Promise<CategoryRule[]> {
  return requestJson<CategoryRule[]>("/category-rules", {}, {
    allowUnauthorized: true,
    unauthorizedValue: [],
  });
}

export async function createCategoryRule(payload: {
  category_id: number;
  pattern_type: "contains" | "startswith";
  pattern_value: string;
  priority?: number | null;
  enabled?: boolean | null;
}): Promise<CategoryRule> {
  return requestJson<CategoryRule>("/category-rules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategoryRule(
  id: number,
  payload: {
    category_id?: number;
    pattern_type?: "contains" | "startswith";
    pattern_value?: string;
    priority?: number | null;
    enabled?: boolean | null;
  }
): Promise<CategoryRule> {
  return requestJson<CategoryRule>(`/category-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategoryRule(id: number): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>(`/category-rules/${id}`, {
    method: "DELETE",
  });
}

export async function reorderCategoryRules(ruleIds: number[]): Promise<CategoryRule[]> {
  return requestJson<CategoryRule[]>("/category-rules/reorder", {
    method: "POST",
    body: JSON.stringify({ rule_ids: ruleIds }),
  });
}

export async function applyCategoryRules(): Promise<{ assigned: number }> {
  return requestJson<{ assigned: number }>("/category-rules/apply", {
    method: "POST",
  });
}

// --- AUTH (cookie-based) ---

export type AuthUser = {
  id: number;
  email: string;
  full_name?: string | null;
};

export async function authMe(): Promise<AuthUser | null> {
  return requestJson<AuthUser | null>("/auth/me", {}, {
    allowUnauthorized: true,
    unauthorizedValue: null,
  });
}

export async function authLogin(payload: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  return requestJson<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function authRegister(payload: {
  email: string;
  password: string;
  full_name?: string;
}): Promise<AuthUser> {
  return requestJson<AuthUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function authLogout(): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/auth/logout", {
    method: "POST",
  });
}


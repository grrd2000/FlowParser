import { LabClient } from "@/components/LabClient";
import {
  fetchCategories,
  fetchCategoryRules,
  fetchCategoryStats,
  fetchLabInsights,
} from "@/lib/serverApi";

export default async function LabPage() {
  const [insights, categories, stats, rules] = await Promise.all([
    fetchLabInsights(),
    fetchCategories(),
    fetchCategoryStats(),
    fetchCategoryRules(),
  ]);

  return (
    <LabClient
      initialData={{
        insights,
        categories,
        stats,
        rules,
      }}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { Card, PageShell } from "@/components/PageShell";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets — PaisaPulse" },
      {
        name: "description",
        content: "Set monthly category budgets in rupees and see what's safe, tight or overspent.",
      },
      { property: "og:title", content: "Budgets — PaisaPulse" },
      {
        property: "og:description",
        content: "Monthly category budgets in rupees with safe, tight and overspent status.",
      },
    ],
  }),
  component: BudgetsScreen,
});

const budgets = [
  { name: "Food & dining", spent: 8400, limit: 12000 },
  { name: "Travel", spent: 5200, limit: 6000 },
  { name: "Shopping", spent: 9800, limit: 7000 },
  { name: "Bills & utilities", spent: 3100, limit: 9000 },
];

function status(ratio: number) {
  if (ratio >= 1) return { label: "Overspent", chip: "bg-danger-soft text-danger", bar: "bg-danger" };
  if (ratio >= 0.8) return { label: "Tight", chip: "bg-warning-soft text-warning", bar: "bg-warning" };
  return { label: "On track", chip: "bg-success-soft text-success", bar: "bg-success" };
}

function BudgetsScreen() {
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalLimit = budgets.reduce((sum, b) => sum + b.limit, 0);

  return (
    <PageShell title="Budgets" subtitle="September 2026">
      <Card>
        <p className="text-sm text-muted-foreground">Spent this month</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{formatINR(totalSpent)}</p>
        <p className="mt-1 text-xs text-muted-foreground">of {formatINR(totalLimit)} budgeted</p>
      </Card>

      {budgets.map((budget) => {
        const ratio = budget.spent / budget.limit;
        const s = status(ratio);
        return (
          <Card key={budget.name}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <p className="truncate text-sm font-semibold">{budget.name}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.chip}`}>
                {s.label}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${s.bar}`}
                style={{ width: `${Math.min(ratio, 1) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatINR(budget.spent)} of {formatINR(budget.limit)}
            </p>
          </Card>
        );
      })}
    </PageShell>
  );
}

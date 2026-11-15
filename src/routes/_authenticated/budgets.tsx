import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  LayoutGrid,
  Table as TableIcon,
  Download,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

import { Card, PageShell, EmptyState } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { exportBudgetStatementToExcel, type BudgetStatementRow } from "@/lib/export-utils";

export const Route = createFileRoute("/_authenticated/budgets")({
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

const DEFAULT_CATEGORIES = [
  "Food & dining",
  "Groceries",
  "Travel",
  "Shopping",
  "Bills & utilities",
  "Entertainment",
  "Healthcare",
  "Education",
  "Investment",
  "Other",
];

function status(ratio: number) {
  if (ratio >= 1) return { label: "Overspent", chip: "bg-danger-soft text-danger", bar: "bg-danger", icon: AlertTriangle };
  if (ratio >= 0.8) return { label: "Tight", chip: "bg-warning-soft text-warning", bar: "bg-warning", icon: AlertTriangle };
  return { label: "On track", chip: "bg-success-soft text-success", bar: "bg-success", icon: CheckCircle2 };
}

function getMonthNameAndYear() {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export function BudgetsScreen() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const budgetsQuery = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [bRes, txRes] = await Promise.all([
        supabase
          .from("budgets")
          .select("*")
          .order("category", { ascending: true }),
        supabase
          .from("transactions")
          .select("amount,category,occurred_at")
          .eq("type", "expense")
          .gte("occurred_at", startOfMonth.toISOString()),
      ]);

      if (bRes.error) throw bRes.error;
      if (txRes.error) throw txRes.error;

      // Group spent amounts by category
      const spendMap = new Map<string, number>();
      (txRes.data ?? []).forEach((tx) => {
        const cat = tx.category || "Other";
        spendMap.set(cat, (spendMap.get(cat) ?? 0) + Number(tx.amount));
      });

      return {
        budgets: (bRes.data ?? []).map((b) => ({
          ...b,
          spent: spendMap.get(b.category) ?? 0,
        })),
        totalSpend: Array.from(spendMap.values()).reduce((sum, v) => sum + v, 0),
      };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      id,
      category,
      monthly_limit,
    }: {
      id?: string | null;
      category: string;
      monthly_limit: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      if (id) {
        const { error } = await supabase
          .from("budgets")
          .update({ category, monthly_limit })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("budgets")
          .upsert(
            { user_id: auth.user.id, category, monthly_limit },
            { onConflict: "user_id,category" },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editingId ? "Budget updated" : "Budget created");
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save budget");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Budget deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete budget");
    },
  });

  function openCreate() {
    setEditingId(null);
    setCategory(DEFAULT_CATEGORIES[0]!);
    setMonthlyLimit("");
    setDialogOpen(true);
  }

  function openEdit(b: { id: string; category: string; monthly_limit: number }) {
    setEditingId(b.id);
    setCategory(b.category);
    setMonthlyLimit(String(b.monthly_limit));
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setCategory("");
    setMonthlyLimit("");
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const limit = Number(monthlyLimit);
    if (!category.trim()) {
      toast.error("Please choose or enter a category");
      return;
    }
    if (!limit || limit <= 0) {
      toast.error("Please enter a valid monthly limit");
      return;
    }
    saveMutation.mutate({
      id: editingId,
      category: category.trim(),
      monthly_limit: limit,
    });
  }

  const now = new Date();
  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth);
  const endOfMonthFormatted = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
  }).format(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const items = budgetsQuery.data?.budgets ?? [];
  const totalBudgeted = items.reduce((sum, b) => sum + Number(b.monthly_limit), 0);
  const totalSpent = items.reduce((sum, b) => sum + Number(b.spent), 0);
  const totalVariance = totalBudgeted - totalSpent;

  // Calculate detailed pace & forecasts for each category
  const analyzedBudgets = items.map((b) => {
    const limit = Number(b.monthly_limit);
    const spent = Number(b.spent);
    const ratio = limit > 0 ? spent / limit : 0;
    const variance = limit - spent;
    const dailyBurn = spent / dayOfMonth;
    const projectedMonthEnd = Math.round(dailyBurn * daysInMonth);
    const projectedOverspend = projectedMonthEnd - limit;
    const isPaceOver = limit > 0 && projectedOverspend > 0;
    const safeDailySpend = Math.max(0, Math.round(variance / daysRemaining));

    return {
      ...b,
      limit,
      spent,
      ratio,
      variance,
      dailyBurn,
      projectedMonthEnd,
      projectedOverspend,
      isPaceOver,
      safeDailySpend,
      statusInfo: status(ratio),
    };
  });

  const overshootingCategories = analyzedBudgets.filter((b) => b.isPaceOver);

  function handleExportExcel() {
    try {
      const rows: BudgetStatementRow[] = analyzedBudgets.map((b) => ({
        category: b.category,
        monthly_limit: b.limit,
        spent: b.spent,
        variance: b.variance,
        percentUtilized: Math.round(b.ratio * 100),
        status: b.statusInfo.label,
        safeDailySpend: b.safeDailySpend,
      }));

      exportBudgetStatementToExcel(
        rows,
        {
          totalBudget: totalBudgeted,
          totalSpent: totalSpent,
          totalVariance: totalVariance,
        },
        getMonthNameAndYear()
      );
      toast.success("Comparative statement exported to Excel");
    } catch (err: any) {
      toast.error(err.message || "Failed to export Excel");
    }
  }

  return (
    <PageShell title="Budgets" subtitle={getMonthNameAndYear()}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Monthly Category Limits</h2>
          <p className="text-xs text-muted-foreground">Manage your spending limits in ₹</p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "cards"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Cards view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Comparative Statement table"
              >
                <TableIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-xl">
            <Plus className="h-4 w-4" /> Add Budget
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Spent this month</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatINR(totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Budgeted</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatINR(totalBudgeted)}
            </p>
          </div>
        </div>
        {totalBudgeted > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Overall utilization</span>
              <span>{Math.round((totalSpent / totalBudgeted) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  totalSpent > totalBudgeted
                    ? "bg-danger"
                    : totalSpent >= totalBudgeted * 0.8
                    ? "bg-warning"
                    : "bg-primary"
                }`}
                style={{ width: `${Math.min((totalSpent / totalBudgeted) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Dynamic Pace Forecast Banner */}
      {overshootingCategories.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-warning/15 text-warning shrink-0 mt-0.5">
              <Flame className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-warning">Dynamic Pace Forecast Alert</p>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Day {dayOfMonth} of {daysInMonth} ({daysRemaining}d left)
                </span>
              </div>
              <p className="text-xs text-foreground/90">
                At your current daily burn rate, you are on pace to overshoot{" "}
                <span className="font-semibold">{overshootingCategories.length}</span> category{" "}
                {overshootingCategories.length === 1 ? "budget" : "budgets"} by month-end ({endOfMonthFormatted}):
              </p>
              <div className="mt-2 space-y-1.5 pt-1">
                {overshootingCategories.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-background/80 border border-warning/20 text-xs"
                  >
                    <span className="font-medium text-foreground">
                      {c.category}:{" "}
                      <span className="text-danger font-semibold">
                        overspend ~{formatINR(c.projectedOverspend)}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Safe daily cap: <strong className="text-foreground">{formatINR(c.safeDailySpend)}/day</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {budgetsQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-8 w-8 text-muted-foreground" />}
          title="No budgets set yet"
          description="Create budgets for your major spending categories to keep your monthly finances on track."
        />
      ) : viewMode === "table" ? (
        /* Comparative Statement Table View */
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Budget vs. Actual Comparative Statement
              </p>
              <p className="text-[11px] text-muted-foreground">
                Detailed variance statement for {getMonthNameAndYear()}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              className="gap-1.5 rounded-xl h-8 text-xs"
            >
              <Download className="h-3.5 w-3.5" /> Export Excel
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Budget (₹)</th>
                  <th className="px-3 py-2.5 text-right">Actual (₹)</th>
                  <th className="px-3 py-2.5 text-right">Variance (₹)</th>
                  <th className="px-3 py-2.5 text-right">Safe Daily</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analyzedBudgets.map((budget) => {
                  return (
                    <tr key={budget.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {budget.category}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-foreground">
                        {formatINR(budget.limit)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-foreground">
                        {formatINR(budget.spent)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            budget.variance >= 0 ? "text-success" : "text-danger"
                          }`}
                        >
                          {budget.variance >= 0
                            ? `+${formatINR(budget.variance)}`
                            : `-${formatINR(Math.abs(budget.variance))}`}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground">
                        {formatINR(budget.safeDailySpend)}/d
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${budget.statusInfo.chip}`}
                        >
                          {budget.statusInfo.label} · {Math.round(budget.ratio * 100)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(budget)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Edit budget"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(budget.id)}
                            className="p-1 text-muted-foreground hover:text-danger transition-colors"
                            aria-label="Delete budget"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-muted/40 font-semibold text-xs">
                <tr>
                  <td className="px-4 py-3 text-foreground uppercase tracking-wide">Total</td>
                  <td className="px-3 py-3 text-right text-foreground">
                    {formatINR(totalBudgeted)}
                  </td>
                  <td className="px-3 py-3 text-right text-foreground">
                    {formatINR(totalSpent)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`font-bold ${
                        totalVariance >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {totalVariance >= 0
                        ? `+${formatINR(totalVariance)}`
                        : `-${formatINR(Math.abs(totalVariance))}`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground">
                    {formatINR(Math.max(0, Math.round(totalVariance / daysRemaining)))}/d
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        totalSpent > totalBudgeted
                          ? "bg-danger-soft text-danger"
                          : "bg-success-soft text-success"
                      }`}
                    >
                      {totalSpent > totalBudgeted ? "Overspent" : "On track"}
                    </span>
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        /* Cards View */
        <div className="space-y-3">
          {analyzedBudgets.map((budget) => {
            return (
              <Card key={budget.id} className="relative group">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {budget.category}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatINR(budget.spent)} of {formatINR(budget.limit)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${budget.statusInfo.chip}`}
                    >
                      {budget.statusInfo.label} · {Math.round(budget.ratio * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(budget)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Edit budget"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(budget.id)}
                      className="p-1 text-muted-foreground hover:text-danger transition-colors"
                      aria-label="Delete budget"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${budget.statusInfo.bar}`}
                    style={{ width: `${Math.min(budget.ratio, 1) * 100}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {budget.variance >= 0
                      ? `${formatINR(budget.variance)} left`
                      : `${formatINR(Math.abs(budget.variance))} over limit`}
                  </span>
                  <span>Safe daily: {formatINR(budget.safeDailySpend)}/day</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Budget" : "New Category Budget"}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="category-select">Category</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {DEFAULT_CATEGORIES.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        category === c
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <Input
                  id="category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Food & dining, Rent"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="monthly-limit">Monthly Limit (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="monthly-limit"
                    type="number"
                    min="1"
                    step="100"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                    placeholder="10000"
                    className="pl-7"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 flex gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl flex-1">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl flex-1" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editingId ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

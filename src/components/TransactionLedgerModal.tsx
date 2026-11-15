import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Download,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { exportTransactionsToExcel } from "@/lib/export-utils";

export function TransactionLedgerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState<"all" | "expense" | "income">("all");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["all_transactions"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Transaction deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete");
    },
  });

  const categories = Array.from(
    new Set(transactions.map((t) => t.category).filter(Boolean))
  );

  const filtered = transactions.filter((tx) => {
    if (selectedType !== "all" && tx.type !== selectedType) return false;
    if (selectedCategory !== "all" && tx.category !== selectedCategory) return false;
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      const matchNote = tx.note?.toLowerCase().includes(s);
      const matchMerchant = tx.merchant?.toLowerCase().includes(s);
      const matchCategory = tx.category.toLowerCase().includes(s);
      const matchAmount = String(tx.amount).includes(s);
      if (!matchNote && !matchMerchant && !matchCategory && !matchAmount) return false;
    }
    return true;
  });

  function handleExport() {
    try {
      exportTransactionsToExcel(filtered.length ? filtered : transactions);
      toast.success("Excel statement downloaded!");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Export failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-6 rounded-2xl">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> All Transactions
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={!transactions.length}
              className="gap-1.5 rounded-xl text-xs font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
            </Button>
          </div>
        </DialogHeader>

        {/* Search & Filters */}
        <div className="flex-shrink-0 space-y-2.5 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by merchant, note, or amount…"
              className="pl-9 h-10 rounded-xl text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Type Filter */}
            <div className="flex rounded-lg bg-muted p-0.5 font-medium">
              {(["all", "expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                    selectedType === t
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <span className="ml-auto text-muted-foreground text-[11px]">
              Showing {filtered.length} of {transactions.length}
            </span>
          </div>
        </div>

        {/* Scrollable Ledger list */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
          {isLoading ? (
            <p className="text-center py-8 text-xs text-muted-foreground">Loading transactions…</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <Receipt className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No transactions match your search.</p>
            </div>
          ) : (
            filtered.map((tx) => {
              const isExpense = tx.type === "expense";
              const formattedDate = new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }).format(new Date(tx.occurred_at));

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card text-xs hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isExpense ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
                      }`}
                    >
                      {isExpense ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-foreground text-sm">
                          {tx.merchant || tx.category}
                        </p>
                        {tx.source && tx.source !== "manual" && (
                          <span className="rounded-full bg-primary-soft px-1.5 py-0.2 text-[9px] font-semibold text-primary capitalize">
                            {tx.source}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-muted-foreground mt-0.5">
                        {tx.category} · {tx.payment_mode || "UPI"} {tx.note ? `· ${tx.note}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p
                        className={`font-bold text-sm ${
                          isExpense ? "text-foreground" : "text-success"
                        }`}
                      >
                        {isExpense ? "-" : "+"}
                        {formatINR(Number(tx.amount))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{formattedDate}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTxMutation.mutate(tx.id)}
                      className="p-1 text-muted-foreground hover:text-danger transition-colors ml-1"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

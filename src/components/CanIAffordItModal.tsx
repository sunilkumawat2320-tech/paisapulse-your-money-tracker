import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Calendar,
  Wallet,
  TrendingDown,
  ArrowRight,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";

interface CanIAffordItModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_IDEAS = [
  { label: "₹2,500 Dinner", name: "Weekend Dinner & Drinks", amount: 2500, category: "Food & dining" },
  { label: "₹8,000 Flight", name: "Weekend Goa Trip", amount: 8000, category: "Travel" },
  { label: "₹25,000 Phone", name: "Smartphone Upgrade", amount: 25000, category: "Shopping" },
  { label: "₹4,500 Concert", name: "Music Festival Ticket", amount: 4500, category: "Entertainment" },
];

export function CanIAffordItModal({ open, onOpenChange }: CanIAffordItModalProps) {
  const [purchaseName, setPurchaseName] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [category, setCategory] = useState("Shopping");
  const [analyzed, setAnalyzed] = useState(false);

  // Live financial snapshot query
  const snapshotQuery = useQuery({
    queryKey: ["can-i-afford-snapshot"],
    enabled: open,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [profRes, txRes, subsRes, budgetRes] = await Promise.all([
        supabase.from("profiles").select("monthly_income").eq("id", auth.user.id).single(),
        supabase
          .from("transactions")
          .select("amount,category")
          .eq("type", "expense")
          .gte("occurred_at", startOfMonth),
        supabase.from("subscriptions").select("amount,active").eq("active", true),
        supabase.from("budgets").select("category,monthly_limit"),
      ]);

      const monthlyIncome = Number(profRes.data?.monthly_income ?? 0);
      const currentMonthSpend = (txRes.data ?? []).reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const upcomingSubs = (subsRes.data ?? []).reduce((acc, s) => acc + Number(s.amount || 0), 0);

      const categorySpendMap = new Map<string, number>();
      for (const t of txRes.data ?? []) {
        categorySpendMap.set(t.category, (categorySpendMap.get(t.category) || 0) + Number(t.amount || 0));
      }

      const budgetMap = new Map<string, number>();
      for (const b of budgetRes.data ?? []) {
        budgetMap.set(b.category, Number(b.monthly_limit || 0));
      }

      return {
        monthlyIncome,
        currentMonthSpend,
        upcomingSubs,
        categorySpendMap,
        budgetMap,
      };
    },
  });

  const snap = snapshotQuery.data;
  const numAmount = Number(purchaseAmount) || 0;

  // Analysis calculations
  const now = new Date();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, totalDaysInMonth - now.getDate() + 1);

  const income = snap?.monthlyIncome || 0;
  const spentSoFar = snap?.currentMonthSpend || 0;
  const upcomingBills = snap?.upcomingSubs || 0;

  // Disposable cash buffer
  const currentBuffer = Math.max(0, income - spentSoFar - upcomingBills);
  const remainingAfterPurchase = income - spentSoFar - upcomingBills - numAmount;
  const safeDailySpendBefore = Math.round(currentBuffer / daysRemaining);
  const safeDailySpendAfter = Math.round(Math.max(0, remainingAfterPurchase) / daysRemaining);

  // Category Budget check
  const catLimit = snap?.budgetMap.get(category) ?? null;
  const catSpent = snap?.categorySpendMap.get(category) ?? 0;
  const catRemaining = catLimit ? catLimit - catSpent : null;

  // Verdict logic
  let verdict: "YES" | "WAIT" | "NO" = "YES";
  let verdictHeadline = "";
  let verdictReason = "";

  if (numAmount <= 0) {
    verdict = "WAIT";
  } else if (income === 0) {
    verdict = "WAIT";
    verdictHeadline = "Set your monthly income first";
    verdictReason = "Please configure your take-home income in Profile Settings so we can calculate your disposable buffer.";
  } else if (remainingAfterPurchase < 0) {
    verdict = "NO";
    verdictHeadline = "Not recommended this month";
    verdictReason = `Spending ${formatINR(numAmount)} will put you in a ${formatINR(Math.abs(remainingAfterPurchase))} deficit before month-end. You have already spent ${formatINR(spentSoFar)} and have ${formatINR(upcomingBills)} in recurring bills.`;
  } else if (safeDailySpendAfter < 250 || (catRemaining !== null && numAmount > catRemaining * 1.25)) {
    verdict = "WAIT";
    verdictHeadline = "Hold on until next salary cycle";
    verdictReason = `While you have the balance, this purchase compresses your daily runway to just ${formatINR(safeDailySpendAfter)}/day for the next ${daysRemaining} days. Waiting for salary day prevents unexpected cash stress.`;
  } else {
    verdict = "YES";
    verdictHeadline = "Go for it! You can afford this comfortably";
    verdictReason = `After spending ${formatINR(numAmount)}, you will retain ${formatINR(remainingAfterPurchase)} for the next ${daysRemaining} days (${formatINR(safeDailySpendAfter)}/day safe spend). Your upcoming subscriptions (${formatINR(upcomingBills)}) remain fully cushioned.`;
  }

  function handlePickPreset(preset: (typeof PRESET_IDEAS)[0]) {
    setPurchaseName(preset.name);
    setPurchaseAmount(String(preset.amount));
    setCategory(preset.category);
    setAnalyzed(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Can I Afford It? Advisor</DialogTitle>
              <DialogDescription className="text-xs">
                Check disposable buffer, upcoming bills, and runway before buying.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Preset quick ideas */}
        <div className="space-y-1.5 pt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Quick test ideas:</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_IDEAS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handlePickPreset(item)}
                className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <div className="space-y-3.5 pt-2">
          <div className="space-y-1">
            <Label htmlFor="item-name" className="text-xs">
              What do you want to buy?
            </Label>
            <Input
              id="item-name"
              placeholder="e.g. Sony WH-1000XM5, Goa Trip, Gym Shoes"
              value={purchaseName}
              onChange={(e) => {
                setPurchaseName(e.target.value);
                setAnalyzed(true);
              }}
              className="h-10 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="item-amount" className="text-xs">
                Estimated Price (₹)
              </Label>
              <Input
                id="item-amount"
                type="number"
                placeholder="25000"
                value={purchaseAmount}
                onChange={(e) => {
                  setPurchaseAmount(e.target.value);
                  setAnalyzed(true);
                }}
                className="h-10 text-sm font-semibold"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-cat" className="text-xs">
                Category
              </Label>
              <select
                id="item-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="Shopping">Shopping</option>
                <option value="Travel">Travel</option>
                <option value="Food & dining">Food & dining</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Bills & utilities">Bills & utilities</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Analysis Verdict Card */}
        {analyzed && numAmount > 0 && (
          <div className="mt-4 space-y-3 rounded-2xl border p-4 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Financial Verdict
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  verdict === "YES"
                    ? "bg-success-soft text-success border border-success/30"
                    : verdict === "WAIT"
                    ? "bg-warning-soft text-warning border border-warning/30"
                    : "bg-danger-soft text-danger border border-danger/30"
                }`}
              >
                {verdict === "YES" && <CheckCircle2 className="h-4 w-4" />}
                {verdict === "WAIT" && <AlertTriangle className="h-4 w-4" />}
                {verdict === "NO" && <XCircle className="h-4 w-4" />}
                {verdict}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground">{verdictHeadline}</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{verdictReason}</p>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
              <div className="rounded-xl bg-muted/40 p-2.5">
                <span className="text-[11px] text-muted-foreground">Daily Spend Runway</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {formatINR(safeDailySpendAfter)}
                  <span className="text-[10px] text-muted-foreground font-normal"> / day</span>
                </p>
                <span className="text-[10px] text-muted-foreground">
                  ({daysRemaining} days left in month)
                </span>
              </div>
              <div className="rounded-xl bg-muted/40 p-2.5">
                <span className="text-[11px] text-muted-foreground">Cash Cushion Left</span>
                <p
                  className={`font-semibold mt-0.5 ${
                    remainingAfterPurchase < 0 ? "text-danger" : "text-foreground"
                  }`}
                >
                  {formatINR(remainingAfterPurchase)}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  after {formatINR(upcomingBills)} bills
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

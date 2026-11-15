import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Share2,
  Copy,
  Check,
  TrendingUp,
  Award,
  Sparkles,
  PieChart,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";

interface MoneyReportCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoneyReportCardModal({ open, onOpenChange }: MoneyReportCardModalProps) {
  const [copied, setCopied] = useState(false);

  const monthName = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const cardQuery = useQuery({
    queryKey: ["money-report-card"],
    enabled: open,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [profRes, txRes, budgetRes] = await Promise.all([
        supabase.from("profiles").select("full_name,monthly_income").eq("id", auth.user.id).single(),
        supabase
          .from("transactions")
          .select("amount,category,type")
          .gte("occurred_at", startOfMonth),
        supabase.from("budgets").select("category,monthly_limit"),
      ]);

      const income = Number(profRes.data?.monthly_income || 0);
      const txs = txRes.data ?? [];
      const expenses = txs
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Top category
      const catMap = new Map<string, number>();
      for (const t of txs.filter((t) => t.type === "expense")) {
        catMap.set(t.category, (catMap.get(t.category) || 0) + Number(t.amount || 0));
      }
      let topCategory = "None";
      let topAmount = 0;
      for (const [cat, amt] of catMap.entries()) {
        if (amt > topAmount) {
          topAmount = amt;
          topCategory = cat;
        }
      }

      // Savings rate
      const savings = Math.max(0, income - expenses);
      const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

      // Grade calculation
      let grade = "B";
      let title = "Balanced Rhythm";
      let badgeColor = "from-emerald-500 to-teal-700";
      let tip = "Keep monitoring discretionary weekend spends to protect your monthly savings buffer.";

      if (savingsRate >= 40) {
        grade = "A+";
        title = "Elite Saver";
        badgeColor = "from-amber-400 to-yellow-600 text-amber-950";
        tip = "Outstanding financial control! Directing 15% of surplus into an index SIP will accelerate wealth accumulation.";
      } else if (savingsRate >= 25) {
        grade = "A";
        title = "Disciplined Builder";
        badgeColor = "from-emerald-400 to-teal-600 text-white";
        tip = "Solid financial health! You are consistently living within your means and maintaining a healthy cushion.";
      } else if (savingsRate >= 15) {
        grade = "B";
        title = "Steady Rhythm";
        badgeColor = "from-blue-400 to-cyan-600 text-white";
        tip = "Good stability, but watch out for incremental delivery and subscription creep.";
      } else if (savingsRate >= 5) {
        grade = "C";
        title = "Tight Runway";
        badgeColor = "from-orange-400 to-amber-600 text-white";
        tip = "Discretionary spends are compressing your savings. Consider setting tighter caps on top categories.";
      } else {
        grade = "D";
        title = "Course Correction";
        badgeColor = "from-rose-500 to-red-700 text-white";
        tip = "Monthly expenditures have exceeded safe margins. Use the 'Can I Afford It?' advisor before any new purchases.";
      }

      return {
        fullName: profRes.data?.full_name || "PaisaPulse Member",
        income,
        expenses,
        savings,
        savingsRate,
        topCategory,
        topAmount,
        txCount: txs.length,
        grade,
        title,
        badgeColor,
        tip,
      };
    },
  });

  const d = cardQuery.data;

  const shareText = `🏆 My PaisaPulse Money Report Card (${monthName}):
• Financial Grade: ${d?.grade || "A"} (${d?.title || "Saver"})
• Savings Rate: ${d?.savingsRate || 0}%
• Top Spending: ${d?.topCategory || "General"} (${formatINR(d?.topAmount || 0)})
• Monthly Spends: ${formatINR(d?.expenses || 0)} across ${d?.txCount || 0} transactions

Track your money in rhythm with PaisaPulse!
👉 https://paisapulse-tracker-7559.netlify.app`;

  function copySummary() {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success("Money Report Card copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-6 overflow-hidden">
        <DialogHeader className="text-center">
          <DialogTitle className="text-lg font-bold flex items-center justify-center gap-1.5">
            <Trophy className="h-5 w-5 text-amber-500" /> Money Report Card
          </DialogTitle>
          <DialogDescription className="text-xs">
            Your monthly spending score and financial rhythm for {monthName}.
          </DialogDescription>
        </DialogHeader>

        {/* Visual Score Card */}
        <div className="relative mt-2 overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/40 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Financial Grade
              </span>
              <h3 className="text-base font-bold text-foreground">{d?.title || "Analyzing..."}</h3>
            </div>
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${
                d?.badgeColor || "from-teal-500 to-emerald-700"
              } text-2xl font-black shadow-md`}
            >
              {d?.grade || "A"}
            </div>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-background/80 p-2.5 border border-border/60">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> Savings Rate
              </span>
              <p className="font-bold text-base text-foreground mt-0.5">{d?.savingsRate || 0}%</p>
              <span className="text-[10px] text-muted-foreground">
                {formatINR(d?.savings || 0)} retained
              </span>
            </div>
            <div className="rounded-xl bg-background/80 p-2.5 border border-border/60">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <PieChart className="h-3 w-3 text-primary" /> Top Category
              </span>
              <p className="font-bold text-sm text-foreground mt-0.5 truncate">{d?.topCategory || "—"}</p>
              <span className="text-[10px] text-muted-foreground">
                {formatINR(d?.topAmount || 0)} spent
              </span>
            </div>
          </div>

          {/* AI Tip Box */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
            <span className="font-semibold text-primary flex items-center gap-1 text-[11px]">
              <Sparkles className="h-3.5 w-3.5" /> Coach's Recommendation
            </span>
            <p className="mt-1 text-muted-foreground leading-relaxed text-[11.5px]">{d?.tip}</p>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
            <span>Logged on PaisaPulse</span>
            <span>{d?.txCount || 0} Spends Analyzed</span>
          </div>
        </div>

        {/* Share Actions */}
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            onClick={shareWhatsApp}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
          >
            <Share2 className="mr-1.5 h-4 w-4" /> Share on WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={copySummary}
            className="rounded-xl text-xs"
            title="Copy Report Card"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

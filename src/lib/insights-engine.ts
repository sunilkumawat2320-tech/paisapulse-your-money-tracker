import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { getStoredGeminiKey } from "@/lib/capture-utils";

export interface DashboardMetrics {
  income: number;
  expense: number;
  savingsRate: number;
  categories: Array<{ name: string; value: number }>;
  alerts: Array<{ category: string; limit: number; spent: number; pct: number }>;
  renewals: Array<{ name: string; amount: number; next_renewal: string }>;
  owedTotal: number;
}

export async function generateAndSaveInsight(
  userId: string,
  metrics: DashboardMetrics
): Promise<{ title: string; message: string; type: string }> {
  const geminiKey = getStoredGeminiKey();

  let title = "Monthly Financial Snapshot";
  let message = "";
  let type = "general";

  // Check critical budget alerts first
  const overBudget = metrics.alerts.find((a) => a.pct >= 100);
  const nearBudget = metrics.alerts.find((a) => a.pct >= 80 && a.pct < 100);

  if (geminiKey) {
    try {
      const prompt = [
        "You are an empathetic, expert Indian personal finance advisor for PaisaPulse.",
        `Here is the user's monthly money snapshot:`,
        `- Monthly Income: ₹${metrics.income}`,
        `- Monthly Spends: ₹${metrics.expense}`,
        `- Savings Rate: ${metrics.savingsRate}%`,
        `- Top Categories: ${metrics.categories.map((c) => `${c.name}: ₹${c.value}`).join(", ") || "None"}`,
        `- Budget Alerts: ${metrics.alerts.map((a) => `${a.category}: ${a.pct}% used (₹${a.spent} of ₹${a.limit})`).join("; ") || "All budgets on track"}`,
        `- Renewals in 7 Days: ${metrics.renewals.map((r) => `${r.name} (₹${r.amount})`).join(", ") || "None"}`,
        `- Money Owed to User: ₹${metrics.owedTotal}`,
        "",
        "Provide ONE concise, high-impact insight (2-3 sentences max) with practical Rupee (₹) advice tailored for India (e.g. SIP, UPI discipline, food delivery moderation).",
        "Return format: Title | Advice Message",
      ].join("\n");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        }
      );

      if (response.ok) {
        const payload = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          if (text.includes("|")) {
            const [t, ...m] = text.split("|");
            title = t?.trim() || title;
            message = m.join("|").trim();
          } else {
            message = text;
          }
          type = overBudget ? "budget_alert" : "ai_advice";
        }
      }
    } catch {
      // Fallback to local rule engine if AI call fails
    }
  }

  // Local Indian financial rules engine fallback
  if (!message) {
    if (overBudget) {
      title = `${overBudget.category} Over Budget`;
      type = "budget_alert";
      message = `You've exceeded your monthly ${overBudget.category} limit by spending ${formatINR(
        overBudget.spent
      )} against your ${formatINR(overBudget.limit)} budget (${overBudget.pct}%). Consider holding back discretionary spends here until next month.`;
    } else if (nearBudget) {
      title = `Watch Your ${nearBudget.category} Spend`;
      type = "warning";
      message = `You have used ${nearBudget.pct}% of your ${nearBudget.category} budget (${formatINR(
        nearBudget.spent
      )} of ${formatINR(nearBudget.limit)}). You have ${formatINR(
        nearBudget.limit - nearBudget.spent
      )} left for the rest of the month.`;
    } else if (metrics.savingsRate >= 50 && metrics.income > 0) {
      title = "Excellent Savings Pace";
      type = "savings";
      const savedAmount = metrics.income - metrics.expense;
      message = `Outstanding discipline! You are retaining ${metrics.savingsRate}% of your income (${formatINR(
        savedAmount
      )} saved). Setting aside a portion into a monthly index fund SIP or liquid emergency fund will compound this momentum.`;
    } else if (metrics.categories.length > 0) {
      const top = metrics.categories[0]!;
      title = "Spending Rhythm";
      type = "spending";
      message = `You have spent ${formatINR(metrics.expense)} so far this month. ${
        top.name
      } leads your outflows at ${formatINR(top.value)} (${Math.round(
        (top.value / (metrics.expense || 1)) * 100
      )}% of total spends).`;
    } else {
      title = "Welcome to PaisaPulse";
      type = "general";
      message =
        "Log your daily UPI spends, scan bills, or track recurring subscriptions to unlock real-time financial insights.";
    }
  }

  // Persist directly to live Supabase `insights` table
  const { data, error } = await supabase
    .from("insights")
    .insert({
      user_id: userId,
      title,
      message,
      type,
    })
    .select("title,message,type")
    .single();

  if (error) {
    console.error("Failed to persist insight to Supabase:", error);
    return { title, message, type };
  }

  return {
    title: data.title || title,
    message: data.message,
    type: data.type || type,
  };
}

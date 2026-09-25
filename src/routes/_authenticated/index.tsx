import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  HandCoins,
  Loader2,
  PiggyBank,
  Percent,
  Receipt,
  Sparkles,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, EmptyState, PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { formatINR, todayIST } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Home — PaisaPulse" },
      {
        name: "description",
        content: "Your monthly money snapshot: income, spends, savings rate, budgets, dues and renewals in rupees.",
      },
      { property: "og:title", content: "Home — PaisaPulse" },
      { property: "og:description", content: "Monthly income, spends, budgets and dues at a glance, in ₹." },
    ],
  }),
  component: HomeScreen,
});

const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-primary)",
  "var(--color-muted-foreground)",
];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-card-foreground)",
  fontSize: 12,
};

const monthKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" });
const monthLabelFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short" });
const monthKey = (d: Date | string) => monthKeyFmt.format(new Date(d)).slice(0, 7);

function lastSixMonths() {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    out.push({ key: monthKey(d), label: monthLabelFmt.format(d) });
  }
  return out;
}

async function fetchDashboard() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user!.id;
  const since = new Date();
  since.setMonth(since.getMonth() - 6);
  since.setDate(1);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [profile, tx, budgets, owed, subs, insight] = await Promise.all([
    supabase.from("profiles").select("monthly_income,full_name").eq("id", uid).maybeSingle(),
    supabase.from("transactions").select("amount,type,category,occurred_at").gte("occurred_at", since.toISOString()),
    supabase.from("budgets").select("category,monthly_limit"),
    supabase.from("owed_items").select("amount").eq("settled", false),
    supabase.from("subscriptions").select("name,amount,next_renewal").eq("active", true).gte("next_renewal", today).lte("next_renewal", in7),
    supabase.from("insights").select("message,created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const r of [profile, tx, budgets, owed, subs, insight]) if (r.error) throw r.error;
  return {
    profile: profile.data,
    tx: tx.data ?? [],
    budgets: budgets.data ?? [],
    owed: owed.data ?? [],
    renewals: subs.data ?? [],
    insight: insight.data,
  };
}

function HomeScreen() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });
  const { pull, refreshing, ready } = usePullToRefresh(() => q.refetch());
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  const d = useMemo(() => {
    if (!q.data) return null;
    const { tx, budgets, owed, renewals, profile, insight } = q.data;
    const months = lastSixMonths();
    const cur = months[5]!.key;
    const prev = months[4]!.key;

    const expenses = tx.filter((t) => t.type === "expense");
    const thisMonth = expenses.filter((t) => monthKey(t.occurred_at) === cur);
    const lastMonthSpend = expenses.filter((t) => monthKey(t.occurred_at) === prev).reduce((s, t) => s + Number(t.amount), 0);
    const expense = thisMonth.reduce((s, t) => s + Number(t.amount), 0);
    const incomeTx = tx.filter((t) => t.type === "income" && monthKey(t.occurred_at) === cur).reduce((s, t) => s + Number(t.amount), 0);
    const income = incomeTx || Number(profile?.monthly_income ?? 0);
    const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

    const byCat = new Map<string, number>();
    thisMonth.forEach((t) => byCat.set(t.category, (byCat.get(t.category) ?? 0) + Number(t.amount)));
    const categories = [...byCat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const totalBudget = budgets.reduce((s, b) => s + Number(b.monthly_limit), 0);
    const budgetUsed = totalBudget > 0 ? Math.round((expense / totalBudget) * 100) : 0;

    const alerts = budgets
      .map((b) => ({ category: b.category, limit: Number(b.monthly_limit), spent: byCat.get(b.category) ?? 0 }))
      .filter((b) => b.limit > 0 && b.spent / b.limit >= 0.8)
      .map((b) => ({ ...b, pct: Math.round((b.spent / b.limit) * 100) }))
      .sort((a, b) => b.pct - a.pct);

    const trend = months.map((m) => ({
      month: m.label,
      amount: expenses.filter((t) => monthKey(t.occurred_at) === m.key).reduce((s, t) => s + Number(t.amount), 0),
    }));

    let summary = insight?.message ?? null;
    if (!summary && expense > 0) {
      if (lastMonthSpend > 0) {
        const diff = Math.round(((expense - lastMonthSpend) / lastMonthSpend) * 100);
        summary = `You've spent ${formatINR(expense)} so far this month — ${Math.abs(diff)}% ${diff >= 0 ? "more" : "less"} than last month's ${formatINR(lastMonthSpend)}.${categories[0] ? ` ${categories[0].name} is your top category.` : ""}`;
      } else {
        summary = `You've spent ${formatINR(expense)} this month.${categories[0] ? ` ${categories[0].name} leads at ${formatINR(categories[0].value)}.` : ""}`;
      }
    }

    return {
      income, expense, savingsRate, budgetUsed, totalBudget,
      owedTotal: owed.reduce((s, o) => s + Number(o.amount), 0),
      renewals, categories, trend, alerts, summary,
      hasTx: tx.length > 0,
      firstName: profile?.full_name?.split(" ")[0],
    };
  }, [q.data]);

  const catTotal = d?.categories.reduce((s, c) => s + c.value, 0) ?? 0;
  const active = activeSlice != null ? d?.categories[activeSlice] : null;

  return (
    <PageShell title={d?.firstName ? `Namaste, ${d.firstName}` : "Namaste 👋"} subtitle={todayIST()}>
      <div className="flex items-center justify-center overflow-hidden text-muted-foreground transition-[height]" style={{ height: pull }} aria-hidden={pull === 0}>
        <Loader2 className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} />
        <span className="ml-2 text-xs">{refreshing ? "Refreshing…" : ready ? "Release to refresh" : "Pull to refresh"}</span>
      </div>

      {q.isPending || !d ? (
        q.isError ? (
          <Card><p className="text-sm text-danger">Couldn't load your dashboard. Pull down to try again.</p></Card>
        ) : (
          <DashboardSkeleton />
        )
      ) : (
        <>
          {d.summary && (
            <Card className="bg-primary text-primary-foreground">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
                <Sparkles className="h-4 w-4" /> Insight
              </div>
              <p className="mt-2 text-sm leading-relaxed">{d.summary}</p>
            </Card>
          )}

          {d.alerts.length > 0 && (
            <div className="space-y-2">
              {d.alerts.slice(0, 3).map((a) => {
                const over = a.pct >= 100;
                return (
                  <Link key={a.category} to="/budgets" className={`flex items-start gap-3 rounded-2xl p-3 ${over ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning-foreground"}`}>
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">{a.category} {over ? "over budget" : "nearing limit"} · {a.pct}%</p>
                      <p className="opacity-80">{formatINR(a.spent)} of {formatINR(a.limit)} spent</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Kpi icon={<ArrowUpRight className="h-4 w-4" />} label="Monthly income" value={formatINR(d.income)} tone="success" />
            <Kpi icon={<ArrowDownRight className="h-4 w-4" />} label="Monthly expense" value={formatINR(d.expense)} tone="danger" />
            <Kpi icon={<Percent className="h-4 w-4" />} label="Savings rate" value={`${d.savingsRate}%`} tone={d.savingsRate >= 20 ? "success" : d.savingsRate >= 0 ? "warning" : "danger"} />
            <Kpi icon={<PiggyBank className="h-4 w-4" />} label="Budget used" value={d.totalBudget ? `${d.budgetUsed}%` : "—"} tone={d.budgetUsed >= 100 ? "danger" : d.budgetUsed >= 80 ? "warning" : "success"} />
            <Kpi icon={<HandCoins className="h-4 w-4" />} label="Owed to me" value={formatINR(d.owedTotal)} tone="primary" to="/owed" />
            <Kpi icon={<CalendarClock className="h-4 w-4" />} label="Renewals in 7 days" value={String(d.renewals.length)} sub={d.renewals.length ? formatINR(d.renewals.reduce((s, r) => s + Number(r.amount), 0)) : undefined} tone={d.renewals.length ? "warning" : "primary"} to="/subscriptions" />
          </div>

          {!d.hasTx ? (
            <>
              <EmptyState icon={<Receipt className="h-6 w-6" />} title="No transactions yet" description="Add your first spend and your category breakdown and trends will appear here." />
              <Link to="/capture" className="flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">Add a transaction</Link>
            </>
          ) : (
            <>
              <Card>
                <h2 className="text-sm font-semibold text-muted-foreground">Where your money went</h2>
                {d.categories.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No spends this month yet.</p>
                ) : (
                  <>
                    <div className="relative mt-2 h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={d.categories} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none" onClick={(_, i) => setActiveSlice(activeSlice === i ? null : i)}>
                            {d.categories.map((c, i) => (
                              <Cell key={c.name} fill={PALETTE[i % PALETTE.length]} opacity={activeSlice == null || activeSlice === i ? 1 : 0.35} className="cursor-pointer outline-none" />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-muted-foreground">{active ? active.name : "Total"}</p>
                        <p className="text-lg font-bold">{formatINR(active ? active.value : catTotal)}</p>
                        {active && <p className="text-xs text-muted-foreground">{Math.round((active.value / catTotal) * 100)}%</p>}
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {d.categories.map((c, i) => (
                        <li key={c.name}>
                          <button onClick={() => setActiveSlice(activeSlice === i ? null : i)} className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm ${activeSlice === i ? "bg-muted" : ""}`}>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="flex-1 truncate text-left">{c.name}</span>
                            <span className="font-medium">{formatINR(c.value)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>

              <Card>
                <h2 className="text-sm font-semibold text-muted-foreground">6-month spending trend</h2>
                <div className="mt-3 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={d.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                      <YAxis hide />
                      <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={tooltipStyle} cursor={{ stroke: "var(--color-border)" }} />
                      <Line type="monotone" dataKey="amount" name="Spent" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--color-primary)" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}

const toneCls = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  primary: "bg-primary-soft text-primary",
} as const;

function Kpi({ icon, label, value, sub, tone, to }: { icon: React.ReactNode; label: string; value: string; sub?: string | undefined; tone: keyof typeof toneCls; to?: "/owed" | "/subscriptions" }) {
  const body = (
    <Card className="h-full">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${toneCls[tone]}`}>{icon}</div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-lg font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-52 w-full rounded-2xl" />
    </div>
  );
}

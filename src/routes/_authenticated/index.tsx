import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { Card, PageShell } from "@/components/PageShell";
import { formatINR, todayIST } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "PaisaPulse — Track spends, budgets & dues in ₹" },
      {
        name: "description",
        content:
          "PaisaPulse is a mobile-first money tracker for India: daily spends, budgets, subscriptions and money owed to you, all in rupees.",
      },
      { property: "og:title", content: "PaisaPulse — Track spends, budgets & dues in ₹" },
      {
        property: "og:description",
        content: "Mobile-first personal finance tracking for Indian users, in rupees.",
      },
    ],
  }),
  component: HomeScreen,
});

const spendTrend = [
  { day: "Mon", amount: 620 },
  { day: "Tue", amount: 1480 },
  { day: "Wed", amount: 340 },
  { day: "Thu", amount: 2250 },
  { day: "Fri", amount: 980 },
  { day: "Sat", amount: 3150 },
  { day: "Sun", amount: 1420 },
];

const recent = [
  { name: "Swiggy — dinner", category: "Food", amount: -640, tone: "danger" as const },
  { name: "Salary credit", category: "Income", amount: 125000, tone: "success" as const },
  { name: "Metro card recharge", category: "Travel", amount: -500, tone: "danger" as const },
  { name: "Electricity bill", category: "Bills", amount: -2180, tone: "warning" as const },
];

function HomeScreen() {
  return (
    <PageShell title="Namaste 👋" subtitle={todayIST()}>
      <Card className="bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 text-sm/none opacity-80">
          <Wallet className="h-4 w-4" />
          Balance this month
        </div>
        <p className="mt-2 text-3xl font-bold tracking-tight">{formatINR(125000)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-primary-foreground/10 p-3">
            <p className="flex items-center gap-1 opacity-80">
              <ArrowUpRight className="h-4 w-4" /> Income
            </p>
            <p className="mt-1 font-semibold">{formatINR(145000)}</p>
          </div>
          <div className="rounded-xl bg-primary-foreground/10 p-3">
            <p className="flex items-center gap-1 opacity-80">
              <ArrowDownRight className="h-4 w-4" /> Spends
            </p>
            <p className="mt-1 font-semibold">{formatINR(20000)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-muted-foreground">This week's spending</h2>
        <div className="mt-3 h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spendTrend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-border)" }}
                formatter={(value: number) => formatINR(value)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  color: "var(--color-card-foreground)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#spendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-muted-foreground">Recent activity</h2>
        <ul className="mt-2 divide-y divide-border">
          {recent.map((item) => (
            <li key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
              <p
                className={`shrink-0 text-sm font-semibold ${
                  item.amount > 0 ? "text-success" : "text-foreground"
                }`}
              >
                {item.amount > 0 ? "+" : "−"}
                {formatINR(Math.abs(item.amount))}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </PageShell>
  );
}

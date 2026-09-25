import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";

import { Card, PageShell } from "@/components/PageShell";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — PaisaPulse" },
      {
        name: "description",
        content: "Track recurring payments like OTT, mobile recharges and SIPs with renewal dates.",
      },
      { property: "og:title", content: "Subscriptions — PaisaPulse" },
      {
        property: "og:description",
        content: "Recurring payments and renewal dates, tracked in rupees.",
      },
    ],
  }),
  component: SubscriptionsScreen,
});

const subs = [
  { name: "Netflix", amount: 649, renews: "28 Sep", tone: "bg-danger-soft text-danger" },
  { name: "Jio postpaid", amount: 399, renews: "2 Oct", tone: "bg-warning-soft text-warning" },
  { name: "Spotify Premium", amount: 119, renews: "11 Oct", tone: "bg-success-soft text-success" },
  { name: "Gym membership", amount: 1500, renews: "15 Oct", tone: "bg-success-soft text-success" },
];

function SubscriptionsScreen() {
  const monthly = subs.reduce((sum, s) => sum + s.amount, 0);

  return (
    <PageShell title="Subscriptions" subtitle="Recurring payments">
      <Card>
        <p className="text-sm text-muted-foreground">Monthly commitment</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{formatINR(monthly)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatINR(monthly * 12)} over a year
        </p>
      </Card>

      {subs.map((sub) => (
        <Card key={sub.name}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{sub.name}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${sub.tone}`}
              >
                Renews {sub.renews}
              </span>
            </div>
            <p className="shrink-0 text-sm font-semibold">{formatINR(sub.amount)}</p>
          </div>
        </Card>
      ))}
    </PageShell>
  );
}

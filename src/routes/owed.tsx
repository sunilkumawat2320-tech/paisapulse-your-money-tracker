import { createFileRoute } from "@tanstack/react-router";

import { Card, PageShell } from "@/components/PageShell";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/owed")({
  head: () => ({
    meta: [
      { title: "Owed to Me — PaisaPulse" },
      {
        name: "description",
        content: "Keep track of money friends and family owe you, with gentle reminder nudges.",
      },
      { property: "og:title", content: "Owed to Me — PaisaPulse" },
      {
        property: "og:description",
        content: "Money friends and family owe you, tracked in rupees.",
      },
    ],
  }),
  component: OwedScreen,
});

const dues = [
  { person: "Rahul", note: "Goa trip cab", amount: 3200, age: "4 days", tone: "bg-success-soft text-success" },
  { person: "Ananya", note: "Dinner split", amount: 860, age: "18 days", tone: "bg-warning-soft text-warning" },
  { person: "Vikram", note: "Cricket kit", amount: 5400, age: "52 days", tone: "bg-danger-soft text-danger" },
];

function OwedScreen() {
  const total = dues.reduce((sum, d) => sum + d.amount, 0);

  return (
    <PageShell title="Owed to Me" subtitle="Money to collect">
      <Card>
        <p className="text-sm text-muted-foreground">Total pending</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{formatINR(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">across {dues.length} people</p>
      </Card>

      {dues.map((due) => (
        <Card key={due.person}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
              {due.person.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{due.person}</p>
              <p className="truncate text-xs text-muted-foreground">{due.note}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold">{formatINR(due.amount)}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${due.tone}`}>
                {due.age}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </PageShell>
  );
}

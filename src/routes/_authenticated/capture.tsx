import { createFileRoute } from "@tanstack/react-router";
import { Camera, Keyboard, Mic, ScanLine } from "lucide-react";

import { Card, PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({
    meta: [
      { title: "Capture an expense — PaisaPulse" },
      {
        name: "description",
        content: "Add a spend in seconds: type it, scan a bill, or share an SMS into PaisaPulse.",
      },
      { property: "og:title", content: "Capture an expense — PaisaPulse" },
      {
        property: "og:description",
        content: "Add a spend in seconds: type it, scan a bill, or share an SMS.",
      },
    ],
  }),
  component: CaptureScreen,
});

const methods = [
  { icon: Keyboard, title: "Quick entry", hint: "Type amount, category and note" },
  { icon: ScanLine, title: "Scan a bill", hint: "Read totals from a receipt photo" },
  { icon: Mic, title: "Speak it", hint: "“Chai 40 rupees at office”" },
  { icon: Camera, title: "Shared SMS / UPI", hint: "Share a payment message into the app" },
];

function CaptureScreen() {
  return (
    <PageShell title="Capture" subtitle="Log a spend in a few taps">
      <Card>
        <p className="text-sm text-muted-foreground">Amount</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">₹0</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Entry form coming next — this screen is a placeholder.
        </p>
      </Card>

      <div className="grid gap-3">
        {methods.map(({ icon: Icon, title, hint }) => (
          <Card key={title}>
            <div className="flex min-h-14 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{title}</p>
                <p className="truncate text-xs text-muted-foreground">{hint}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  CalendarClock,
  Power,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
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

export const Route = createFileRoute("/_authenticated/subscriptions")({
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

const POPULAR_SERVICES = [
  { name: "Netflix", amount: "649", cycle: "monthly" },
  { name: "Spotify Premium", amount: "119", cycle: "monthly" },
  { name: "YouTube Premium", amount: "149", cycle: "monthly" },
  { name: "Amazon Prime", amount: "1499", cycle: "yearly" },
  { name: "Jio Fiber / Postpaid", amount: "499", cycle: "monthly" },
  { name: "Gym Membership", amount: "1500", cycle: "monthly" },
];

function getRenewalStatus(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(d);

  if (diffDays < 0) return { label: `Overdue (${formattedDate})`, tone: "bg-danger-soft text-danger" };
  if (diffDays === 0) return { label: "Renews today", tone: "bg-danger-soft text-danger" };
  if (diffDays === 1) return { label: "Renews tomorrow", tone: "bg-danger-soft text-danger" };
  if (diffDays <= 7) return { label: `Renews in ${diffDays}d (${formattedDate})`, tone: "bg-warning-soft text-warning" };
  return { label: `Renews ${formattedDate}`, tone: "bg-success-soft text-success" };
}

function getInactivityInfo(sub: {
  amount: number;
  billing_cycle: string;
  last_used_at?: string | null;
  created_at: string;
}) {
  const now = new Date();
  const refDateStr = sub.last_used_at || sub.created_at;
  const refDate = refDateStr ? new Date(refDateStr) : now;
  const diffDays = Math.max(0, Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)));
  const isUnused = diffDays >= 30;

  const amt = Number(sub.amount);
  let annualSavings = amt;
  if (sub.billing_cycle === "monthly") annualSavings = amt * 12;
  else if (sub.billing_cycle === "quarterly") annualSavings = amt * 4;

  const lastUsedLabel = sub.last_used_at
    ? new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(sub.last_used_at))
    : null;

  return { isUnused, diffDays, annualSavings, lastUsedLabel };
}

export function SubscriptionsScreen() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [nextRenewal, setNextRenewal] = useState("");
  const [lastUsedAt, setLastUsedAt] = useState(new Date().toISOString().slice(0, 10));

  const subsQuery = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("next_renewal", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({
      name,
      amount,
      billing_cycle,
      next_renewal,
      last_used_at,
    }: {
      name: string;
      amount: number;
      billing_cycle: string;
      next_renewal: string;
      last_used_at?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const { error } = await supabase.from("subscriptions").insert({
        user_id: auth.user.id,
        name,
        amount,
        billing_cycle,
        next_renewal,
        last_used_at: last_used_at || null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Subscription added");
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add subscription");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(variables.active ? "Subscription resumed" : "Subscription paused");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update subscription");
    },
  });

  const markUsedMutation = useMutation({
    mutationFn: async (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("subscriptions")
        .update({ last_used_at: today })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Updated last active date to today");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update last used date");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Subscription deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete subscription");
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setName("");
    setAmount("");
    setBillingCycle("monthly");
    setNextRenewal("");
    setLastUsedAt(new Date().toISOString().slice(0, 10));
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!name.trim()) {
      toast.error("Please enter a service name");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!nextRenewal) {
      toast.error("Please choose a next renewal date");
      return;
    }
    addMutation.mutate({
      name: name.trim(),
      amount: parsedAmount,
      billing_cycle: billingCycle,
      next_renewal: nextRenewal,
      last_used_at: lastUsedAt || null,
    });
  }

  const items = subsQuery.data ?? [];
  const activeSubs = items.filter((s) => s.active);

  // Normalize monthly commitment
  const monthlyCommitment = activeSubs.reduce((sum, s) => {
    const amt = Number(s.amount);
    if (s.billing_cycle === "yearly") return sum + amt / 12;
    if (s.billing_cycle === "quarterly") return sum + amt / 3;
    return sum + amt;
  }, 0);

  const yearlyCommitment = monthlyCommitment * 12;

  // Check for unused active subscriptions
  const unusedActiveSubs = activeSubs.filter((s) => {
    const info = getInactivityInfo(s);
    return info.isUnused;
  });

  const potentialUnusedAnnualSavings = unusedActiveSubs.reduce((sum, s) => {
    return sum + getInactivityInfo(s).annualSavings;
  }, 0);

  return (
    <PageShell title="Subscriptions" subtitle="Recurring payments & renewals">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recurring Services</h2>
          <p className="text-xs text-muted-foreground">Keep track of renewals and auto-debits</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5 rounded-xl">
          <Plus className="h-4 w-4" /> Add Subscription
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Monthly commitment</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatINR(Math.round(monthlyCommitment))}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeSubs.length} active renewals
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Yearly projection</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatINR(Math.round(yearlyCommitment))}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">estimated per year</p>
          </div>
        </div>
      </Card>

      {/* 30-Day Inactivity Warning Summary Banner */}
      {unusedActiveSubs.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-warning/15 text-warning shrink-0 mt-0.5">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-warning">Subscription Inactivity Alert</p>
                <span className="text-[10px] rounded-full bg-warning/20 px-2 py-0.5 font-bold text-warning">
                  Save up to {formatINR(potentialUnusedAnnualSavings)}/yr
                </span>
              </div>
              <p className="text-xs text-foreground/90">
                You have <span className="font-semibold text-foreground">{unusedActiveSubs.length}</span>{" "}
                {unusedActiveSubs.length === 1 ? "subscription" : "subscriptions"} unused for over 30 days.
                Review below to cancel or mark active.
              </p>
            </div>
          </div>
        </Card>
      )}

      {subsQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8 text-muted-foreground" />}
          title="No subscriptions added"
          description="Add OTT, gym memberships, mobile recharges or SIPs to track their renewal dates."
        />
      ) : (
        <div className="space-y-3">
          {items.map((sub) => {
            const status = getRenewalStatus(sub.next_renewal);
            const inactivity = getInactivityInfo(sub);

            return (
              <Card
                key={sub.id}
                className={`${!sub.active ? "opacity-60 bg-muted/40" : ""} ${
                  sub.active && inactivity.isUnused ? "border-warning/40 ring-1 ring-warning/20" : ""
                }`}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{sub.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          sub.active ? status.tone : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {sub.active ? status.label : "Paused"}
                      </span>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {sub.billing_cycle}
                      </span>
                      {inactivity.lastUsedLabel && !inactivity.isUnused && (
                        <span className="text-[10px] text-muted-foreground/80">
                          · Active {inactivity.lastUsedLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {formatINR(Number(sub.amount))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/{sub.billing_cycle}</p>
                  </div>
                </div>

                {/* 30-Day Inactivity Banner & Decision Badge */}
                {sub.active && inactivity.isUnused && (
                  <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Unused for {inactivity.diffDays}+ days · Cancel or keep?</span>
                      </div>
                      <span className="shrink-0 rounded-md bg-warning/25 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                        Save {formatINR(inactivity.annualSavings)}/yr
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {inactivity.lastUsedLabel
                        ? `Last activity detected on ${inactivity.lastUsedLabel}.`
                        : "No recent activity recorded for 30+ days."}{" "}
                      If you're not using this, pausing it frees up recurring cash.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg text-xs border-warning/30 bg-background hover:bg-warning/10"
                        onClick={() => markUsedMutation.mutate(sub.id)}
                        disabled={markUsedMutation.isPending}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-success" /> Mark used today
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-7 rounded-lg text-xs"
                        onClick={() => toggleActiveMutation.mutate({ id: sub.id, active: false })}
                        disabled={toggleActiveMutation.isPending}
                      >
                        Pause & Save
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-2 text-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 rounded-lg text-xs"
                    onClick={() =>
                      toggleActiveMutation.mutate({ id: sub.id, active: !sub.active })
                    }
                  >
                    <Power className={`h-3.5 w-3.5 ${sub.active ? "text-primary" : "text-muted-foreground"}`} />
                    {sub.active ? "Pause" : "Resume"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(sub.id)}
                    className="p-1 text-muted-foreground hover:text-danger transition-colors"
                    aria-label="Delete subscription"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Subscription Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add Subscription</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sub-name">Service / Plan Name</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_SERVICES.slice(0, 4).map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setName(item.name);
                        setAmount(item.amount);
                        setBillingCycle(item.cycle);
                      }}
                      className="px-2 py-0.5 rounded-lg text-xs font-medium border border-border bg-muted text-muted-foreground hover:bg-muted/80"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <Input
                  id="sub-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Netflix, Jio Postpaid, Gym"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sub-amount">Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="sub-amount"
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="649"
                    className="pl-7"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="billing-cycle">Billing Frequency</Label>
                <select
                  id="billing-cycle"
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly (3 months)</option>
                  <option value="yearly">Yearly (Annual)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="renewal-date">Next Renewal Date</Label>
                <Input
                  id="renewal-date"
                  type="date"
                  value={nextRenewal}
                  onChange={(e) => setNextRenewal(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="last-used">Last Used / Active Date</Label>
                <Input
                  id="last-used"
                  type="date"
                  value={lastUsedAt}
                  onChange={(e) => setLastUsedAt(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  PaisaPulse flags services unused for 30+ days to prevent wasted money.
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6 flex gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl flex-1">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl flex-1" disabled={addMutation.isPending}>
                {addMutation.isPending ? "Adding…" : "Add Subscription"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

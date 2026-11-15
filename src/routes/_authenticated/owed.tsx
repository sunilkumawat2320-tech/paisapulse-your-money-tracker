import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Check, Undo, Trash2, HandCoins, Send, Calendar } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/owed")({
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

function formatAge(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} mo ago`;
}

function getTone(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) return "bg-danger-soft text-danger";
  if (diffDays > 14) return "bg-warning-soft text-warning";
  return "bg-success-soft text-success";
}

export function OwedScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "settled" | "all">("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");

  const owedQuery = useQuery({
    queryKey: ["owed"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("owed_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({
      person_name,
      amount,
      reason,
      due_date,
    }: {
      person_name: string;
      amount: number;
      reason?: string | null;
      due_date?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const { error } = await supabase.from("owed_items").insert({
        user_id: auth.user.id,
        person_name,
        amount,
        reason: reason || null,
        due_date: due_date || null,
        settled: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owed"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Added pending due");
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add item");
    },
  });

  const toggleSettleMutation = useMutation({
    mutationFn: async ({ id, settled }: { id: string; settled: boolean }) => {
      const { error } = await supabase
        .from("owed_items")
        .update({ settled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["owed"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(variables.settled ? "Marked as settled" : "Restored to pending");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("owed_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owed"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Item removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove item");
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setPersonName("");
    setAmount("");
    setReason("");
    setDueDate("");
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!personName.trim()) {
      toast.error("Please enter a person's name");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    addMutation.mutate({
      person_name: personName.trim(),
      amount: parsedAmount,
      reason: reason.trim() || null,
      due_date: dueDate || null,
    });
  }

  const items = owedQuery.data ?? [];
  const pendingItems = items.filter((i) => !i.settled);
  const settledItems = items.filter((i) => i.settled);

  const totalPending = pendingItems.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalSettled = settledItems.reduce((sum, d) => sum + Number(d.amount), 0);

  const displayedItems =
    filter === "pending" ? pendingItems : filter === "settled" ? settledItems : items;

  return (
    <PageShell title="Owed to Me" subtitle="Money to collect">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Pending Splits & Dues</h2>
          <p className="text-xs text-muted-foreground">Track amounts friends owe you</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5 rounded-xl">
          <Plus className="h-4 w-4" /> Add Due
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Pending</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatINR(totalPending)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              across {pendingItems.length} {pendingItems.length === 1 ? "person" : "people"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatINR(totalSettled)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {settledItems.length} settled
            </p>
          </div>
        </div>
      </Card>

      {/* Filter Tabs */}
      <div className="flex rounded-xl bg-muted p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`flex-1 rounded-lg py-1.5 transition-all ${
            filter === "pending" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Pending ({pendingItems.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("settled")}
          className={`flex-1 rounded-lg py-1.5 transition-all ${
            filter === "settled" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Settled ({settledItems.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`flex-1 rounded-lg py-1.5 transition-all ${
            filter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          All ({items.length})
        </button>
      </div>

      {owedQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : displayedItems.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-8 w-8 text-muted-foreground" />}
          title={filter === "settled" ? "No settled dues" : "No pending dues"}
          description={
            filter === "settled"
              ? "Dues marked as settled will appear here."
              : "When you pay for a group dinner or cab, add it here to keep track."
          }
        />
      ) : (
        <div className="space-y-3">
          {displayedItems.map((due) => {
            const age = formatAge(due.created_at);
            const tone = getTone(due.created_at);
            const shareText = encodeURIComponent(
              `Hi ${due.person_name}, gentle reminder about ₹${due.amount}${
                due.reason ? ` for ${due.reason}` : ""
              } via PaisaPulse.`
            );

            return (
              <Card key={due.id} className={due.settled ? "opacity-70 bg-muted/40" : ""}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                    {due.person_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {due.person_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {due.reason || "No note specified"}
                    </p>
                    {due.due_date && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3" /> Due {due.due_date}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {formatINR(Number(due.amount))}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        due.settled ? "bg-muted text-muted-foreground" : tone
                      }`}
                    >
                      {due.settled ? "Settled" : age}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-2 text-xs">
                  {!due.settled ? (
                    <>
                      <a
                        href={`https://wa.me/?text=${shareText}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-primary hover:bg-primary-soft transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" /> Remind
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 rounded-lg text-xs"
                        onClick={() =>
                          toggleSettleMutation.mutate({ id: due.id, settled: true })
                        }
                      >
                        <Check className="h-3.5 w-3.5 text-success" /> Mark Settled
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 rounded-lg text-xs"
                      onClick={() =>
                        toggleSettleMutation.mutate({ id: due.id, settled: false })
                      }
                    >
                      <Undo className="h-3.5 w-3.5" /> Reopen
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(due.id)}
                    className="p-1 text-muted-foreground hover:text-danger transition-colors"
                    aria-label="Delete due"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Due Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add Money Owed to You</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="person-name">Person Name</Label>
                <Input
                  id="person-name"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="e.g. Rahul, Ananya"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="due-amount">Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="due-amount"
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1200"
                    className="pl-7"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="due-reason">Reason / Note</Label>
                <Input
                  id="due-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Goa trip cab, dinner split"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="due-date">Due Date (Optional)</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 flex gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl flex-1">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl flex-1" disabled={addMutation.isPending}>
                {addMutation.isPending ? "Adding…" : "Add Due"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

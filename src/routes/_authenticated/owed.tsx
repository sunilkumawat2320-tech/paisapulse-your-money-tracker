import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  Check,
  Undo,
  Trash2,
  HandCoins,
  Send,
  Calendar,
  Split,
  ArrowDownLeft,
  ArrowUpRight,
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
import { SplitBillModal } from "@/components/SplitBillModal";
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
  const [direction, setDirection] = useState<"owed_to_me" | "i_owe">("owed_to_me");
  const [filter, setFilter] = useState<"pending" | "settled" | "all">("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  // Add dialog state
  const [addDirection, setAddDirection] = useState<"owed_to_me" | "i_owe">("owed_to_me");
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");

  const owedQuery = useQuery({
    queryKey: ["owed"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const [itemsRes, profRes] = await Promise.all([
        supabase
          .from("owed_items")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("full_name,upi_id")
          .eq("id", auth.user.id)
          .maybeSingle(),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      return {
        items: itemsRes.data ?? [],
        profile: profRes.data,
      };
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({
      person_name,
      amount,
      reason,
      due_date,
      type,
    }: {
      person_name: string;
      amount: number;
      reason?: string | null;
      due_date?: string | null;
      type: "owed_to_me" | "i_owe";
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
        type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owed"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Added due entry");
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
    setAddDirection("owed_to_me");
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
      type: addDirection,
    });
  }

  const allItems = owedQuery.data?.items ?? [];
  const profile = owedQuery.data?.profile;
  const userUpi = profile?.upi_id;
  const userName = profile?.full_name?.split(" ")[0] || "Me";

  // Filter items by direction ("owed_to_me" vs "i_owe")
  const directionItems = allItems.filter(
    (i) => (i.type || "owed_to_me") === direction
  );

  const pendingItems = directionItems.filter((i) => !i.settled);
  const settledItems = directionItems.filter((i) => i.settled);

  const totalPending = pendingItems.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalSettled = settledItems.reduce((sum, d) => sum + Number(d.amount), 0);

  const displayedItems =
    filter === "pending" ? pendingItems : filter === "settled" ? settledItems : directionItems;

  return (
    <PageShell
      title={direction === "owed_to_me" ? "Who Owes Me" : "I Owe (Payables)"}
      subtitle={direction === "owed_to_me" ? "Receivables & Split Dues" : "Your Outstanding Bills & Debts"}
    >
      {/* Primary Direction Switcher: Who Owes Me vs I Owe */}
      <div className="grid grid-cols-2 rounded-2xl bg-muted p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setDirection("owed_to_me");
            setAddDirection("owed_to_me");
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
            direction === "owed_to_me"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
          <span>Who Owes Me</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setDirection("i_owe");
            setAddDirection("i_owe");
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
            direction === "i_owe"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowUpRight className="h-4 w-4 text-amber-600" />
          <span>I Owe (Payables)</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {direction === "owed_to_me" ? "Pending Receivables" : "Pending Payables"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {direction === "owed_to_me"
              ? "Track dues friends owe you with WhatsApp nudges"
              : "Track your dues to friends, rent & card bills"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {direction === "owed_to_me" && (
            <Button
              onClick={() => setSplitOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl text-xs font-semibold border-primary/30 text-primary bg-primary-soft hover:bg-primary-soft/80"
            >
              <Split className="h-4 w-4" /> Split Bill
            </Button>
          )}
          <Button
            onClick={() => {
              setAddDirection(direction);
              setDialogOpen(true);
            }}
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-semibold"
          >
            <Plus className="h-4 w-4" /> Add Due
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">
              {direction === "owed_to_me" ? "Total to Collect" : "Total to Pay"}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatINR(totalPending)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              across {pendingItems.length} {pendingItems.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Settled</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatINR(totalSettled)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {settledItems.length} completed
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
          All ({directionItems.length})
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
          title={filter === "settled" ? "No settled entries" : `No pending ${direction === "owed_to_me" ? "receivables" : "payables"}`}
          description={
            filter === "settled"
              ? "Items marked as settled will appear here."
              : direction === "owed_to_me"
              ? "When you pay for a group dinner or cab, tap 'Split Bill' or 'Add Due' to keep track."
              : "Keep track of money you borrowed or upcoming card dues."
          }
        />
      ) : (
        <div className="space-y-3">
          {displayedItems.map((due) => {
            const age = formatAge(due.created_at);
            const tone = getTone(due.created_at);

            // One-tap UPI deep-link message as defined in Section 3D & S8
            const upiParam = userUpi
              ? `\n\nPay in 1 tap via UPI:\nupi://pay?pa=${encodeURIComponent(userUpi)}&pn=${encodeURIComponent(userName)}&am=${due.amount}&cu=INR&tn=${encodeURIComponent(due.reason || "Split Dues")}`
              : "";

            const shareText = encodeURIComponent(
              `Hi ${due.person_name}, a gentle reminder from ${userName}: ₹${due.amount}${
                due.reason ? ` for ${due.reason}` : ""
              } is pending.${upiParam}\n\nThank you! — sent via PaisaPulse`
            );

            return (
              <Card key={due.id} className={due.settled ? "opacity-70 bg-muted/40" : ""}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      due.type === "i_owe"
                        ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                        : "bg-primary-soft text-primary"
                    }`}
                  >
                    {due.person_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {due.person_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {due.reason || (due.type === "i_owe" ? "Payable" : "Receivable")}
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
                      {due.type !== "i_owe" && (
                        <a
                          href={`https://wa.me/?text=${shareText}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-primary hover:bg-primary-soft transition-colors"
                          title="Send prefilled WhatsApp reminder with 1-tap UPI link"
                        >
                          <Send className="h-3.5 w-3.5" /> Remind
                        </a>
                      )}
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
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {addDirection === "owed_to_me" ? "Add Money Owed to You" : "Add Money You Owe"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            {/* Direction toggle in modal */}
            <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddDirection("owed_to_me")}
                className={`rounded-lg py-1.5 transition-all ${
                  addDirection === "owed_to_me" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                They Owe Me
              </button>
              <button
                type="button"
                onClick={() => setAddDirection("i_owe")}
                className={`rounded-lg py-1.5 transition-all ${
                  addDirection === "i_owe" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                I Owe Them
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due-person" className="text-xs">
                {addDirection === "owed_to_me" ? "Who owes you?" : "Who do you owe?"}
              </Label>
              <Input
                id="due-person"
                placeholder="e.g. Amit Sharma, Landlord, CRED"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due-amount" className="text-xs">
                Amount (₹)
              </Label>
              <Input
                id="due-amount"
                type="number"
                placeholder="1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due-reason" className="text-xs">
                Reason / Note
              </Label>
              <Input
                id="due-reason"
                placeholder="e.g. Dinner split, Goa flight, Flat maintenance"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due-date" className="text-xs">
                Target Due Date (optional)
              </Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={addMutation.isPending} className="rounded-xl font-semibold">
                {addMutation.isPending ? "Adding…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Split Bill Modal */}
      <SplitBillModal open={splitOpen} onOpenChange={setSplitOpen} />
    </PageShell>
  );
}

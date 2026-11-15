import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, CheckCircle2, Split, Receipt } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { fingerprintTransaction } from "@/lib/capture-utils";

interface SplitBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SplitBillModal({ open, onOpenChange }: SplitBillModalProps) {
  const queryClient = useQueryClient();
  const [billTitle, setBillTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [category, setCategory] = useState("Food & dining");
  const [includeSelf, setIncludeSelf] = useState(true);
  const [logFullExpense, setLogFullExpense] = useState(true);
  const [friendsInput, setFriendsInput] = useState("");
  const [friendList, setFriendList] = useState<string[]>(["Amit", "Neha", "Raj"]);

  const numTotal = Number(totalAmount) || 0;
  const totalPeople = friendList.length + (includeSelf ? 1 : 0);
  const perPersonShare = totalPeople > 0 ? Math.round((numTotal / totalPeople) * 100) / 100 : 0;

  function addFriend() {
    const trimmed = friendsInput.trim();
    if (!trimmed) return;
    if (friendList.includes(trimmed)) {
      toast.error("Friend already in split list");
      return;
    }
    setFriendList([...friendList, trimmed]);
    setFriendsInput("");
  }

  function removeFriend(name: string) {
    setFriendList(friendList.filter((f) => f !== name));
  }

  const splitMutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      if (numTotal <= 0) throw new Error("Please enter a valid bill amount");
      if (friendList.length === 0) throw new Error("Add at least one person to split with");

      const now = new Date().toISOString();
      const dueDate = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

      // 1. Create receivable rows for each friend
      const owedRows = friendList.map((friend) => ({
        user_id: auth.user.id,
        person_name: friend,
        amount: perPersonShare,
        reason: billTitle.trim() || "Group split",
        due_date: dueDate,
        settled: false,
        type: "owed_to_me",
      }));

      const { error: owedError } = await supabase.from("owed_items").insert(owedRows);
      if (owedError) throw owedError;

      // 2. Optionally log the expense in transactions (as specified in PDF Section 3D: full debit logged)
      if (logFullExpense) {
        const fp = await fingerprintTransaction({
          amount: numTotal,
          category,
          merchant: billTitle.trim() || "Group Bill Split",
          paymentMode: "UPI",
          note: `Split with ${friendList.join(", ")} (₹${perPersonShare} each)`,
          occurredAt: now,
        });

        await supabase.from("transactions").insert({
          user_id: auth.user.id,
          amount: numTotal,
          type: "expense",
          category,
          merchant: billTitle.trim() || "Group Split",
          payment_mode: "UPI",
          note: `Split bill: ₹${perPersonShare} due from each of ${friendList.join(", ")}`,
          occurred_at: now,
          source: "manual",
          source_fingerprint: fp,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owed"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(
        `Created ${friendList.length} dues of ${formatINR(perPersonShare)} each!`
      );
      onOpenChange(false);
      setBillTitle("");
      setTotalAmount("");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Failed to split bill");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Split className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Split a Bill</DialogTitle>
              <DialogDescription className="text-xs">
                Log a group dinner, trip, or flat expense and create individual dues.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Bill Info */}
          <div className="space-y-1">
            <Label htmlFor="bill-title" className="text-xs">
              What was this for?
            </Label>
            <Input
              id="bill-title"
              placeholder="e.g. Dinner at Social, Goa Airbnb, Grocery Run"
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="bill-amount" className="text-xs">
                Total Bill (₹)
              </Label>
              <Input
                id="bill-amount"
                type="number"
                placeholder="3600"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="h-10 text-sm font-semibold"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bill-cat" className="text-xs">
                Category
              </Label>
              <select
                id="bill-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="Food & dining">Food & dining</option>
                <option value="Travel">Travel</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Groceries">Groceries</option>
                <option value="Shopping">Shopping</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Friends List */}
          <div className="space-y-2">
            <Label className="text-xs">Friends to Split With ({friendList.length})</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter friend's name (e.g. Rahul)"
                value={friendsInput}
                onChange={(e) => setFriendsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFriend();
                  }
                }}
                className="h-9 text-xs"
              />
              <Button type="button" size="sm" onClick={addFriend} className="rounded-xl px-3">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {friendList.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {f}
                  <button
                    type="button"
                    onClick={() => removeFriend(f)}
                    className="text-muted-foreground hover:text-danger"
                    title={`Remove ${f}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Split Calculation Banner */}
          {numTotal > 0 && friendList.length > 0 && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-muted-foreground">Each person owes:</span>
                <span className="text-base font-bold text-primary">
                  {formatINR(perPersonShare)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Total {formatINR(numTotal)} split across {totalPeople} people
                {includeSelf ? " (including you)" : ""}.
              </p>

              <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSelf}
                    onChange={(e) => setIncludeSelf(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Include myself in the split</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logFullExpense}
                    onChange={(e) => setLogFullExpense(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Log full {formatINR(numTotal)} bill in expense transactions</span>
                </label>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => splitMutation.mutate()}
              disabled={splitMutation.isPending || numTotal <= 0 || friendList.length === 0}
              className="rounded-xl text-xs font-semibold"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {splitMutation.isPending ? "Creating Dues…" : "Confirm & Split"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

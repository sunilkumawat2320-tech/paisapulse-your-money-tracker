import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { User, LogOut, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

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

export function ProfileSettingsDialog({
  open,
  onOpenChange,
  userId,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  initialData?: {
    full_name?: string | null;
    monthly_income?: number | null;
    upi_id?: string | null;
    whatsapp_number?: string | null;
  } | null;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(initialData?.full_name || "");
  const [income, setIncome] = useState(String(initialData?.monthly_income || ""));
  const [upi, setUpi] = useState(initialData?.upi_id || "");
  const [whatsapp, setWhatsapp] = useState(
    (initialData?.whatsapp_number || "").replace(/^\+91/, "")
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const numIncome = parseFloat(income) || 0;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        monthly_income: numIncome || null,
        upi_id: upi.trim() || null,
        whatsapp_number: whatsapp.trim() ? `+91${whatsapp.trim()}` : null,
      })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    toast.info("Signed out");
    navigate({ to: "/auth" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Profile & Money Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name">Full Name</Label>
              <Input
                id="prof-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Priya Sharma"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-income">Monthly Take-Home Income (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="prof-income"
                  type="number"
                  min="0"
                  step="100"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="75000"
                  className="pl-7"
                />
              </div>
              {Number(income) > 0 && (
                <p className="text-xs text-primary font-medium">
                  {formatINR(Number(income))} / month
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-upi">Default UPI ID</Label>
              <Input
                id="prof-upi"
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                placeholder="name@okhdfc"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-whatsapp">WhatsApp Number</Label>
              <div className="flex gap-2">
                <span className="flex h-10 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">
                  +91
                </span>
                <Input
                  id="prof-whatsapp"
                  inputMode="numeric"
                  maxLength={10}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="rounded-xl text-danger hover:bg-danger-soft hover:text-danger flex items-center gap-1.5"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
            <div className="flex gap-2 flex-1 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl flex-1 sm:flex-none">
                <Check className="mr-1.5 h-4 w-4" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

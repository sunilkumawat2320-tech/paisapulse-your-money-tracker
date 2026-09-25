import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/format";

const DEFAULT_BUDGETS = [
  { category: "Food & dining", share: 0.15 },
  { category: "Groceries", share: 0.1 },
  { category: "Travel", share: 0.08 },
  { category: "Shopping", share: 0.08 },
  { category: "Bills & utilities", share: 0.1 },
  { category: "Entertainment", share: 0.05 },
];

const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function OnboardingWizard({
  userId,
  defaults,
  onDone,
}: {
  userId: string;
  defaults: { full_name: string; whatsapp_number: string };
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(defaults.full_name);
  const [whatsapp, setWhatsapp] = useState(defaults.whatsapp_number.replace(/^\+?91/, ""));
  const [upi, setUpi] = useState("");
  const [income, setIncome] = useState("");
  const [budgets, setBudgets] = useState<Record<string, string>>({});

  const incomeNum = Number(income) || 0;

  function goToBudgets() {
    if (!incomeNum || incomeNum <= 0) { toast.error("Enter your monthly income"); return; }
    const next: Record<string, string> = {};
    DEFAULT_BUDGETS.forEach((b) => {
      next[b.category] = budgets[b.category] ?? String(Math.round((incomeNum * b.share) / 100) * 100);
    });
    setBudgets(next);
    setStep(2);
  }

  function nextFromProfile() {
    if (fullName.trim().length < 2) { toast.error("Enter your full name"); return; }
    if (!/^[6-9]\d{9}$/.test(whatsapp)) { toast.error("Enter a valid 10-digit WhatsApp number"); return; }
    if (!UPI_RE.test(upi.trim())) { toast.error("Enter a valid UPI ID, e.g. name@okhdfc"); return; }
    setStep(1);
  }

  async function finish() {
    setSaving(true);
    const { error: pErr } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      whatsapp_number: `+91${whatsapp}`,
      upi_id: upi.trim().toLowerCase(),
      monthly_income: incomeNum,
      onboarded: true,
    });
    if (pErr) {
      setSaving(false);
      toast.error(pErr.message); return;
    }
    const rows = Object.entries(budgets)
      .map(([category, v]) => ({ user_id: userId, category, monthly_limit: Number(v) || 0 }))
      .filter((r) => r.monthly_limit > 0);
    if (rows.length) {
      const { error } = await supabase.from("budgets").upsert(rows, { onConflict: "user_id,category" });
      if (error) {
        setSaving(false);
        toast.error(error.message); return;
      }
    }
    setSaving(false);
    toast.success("You're all set!");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-6 shadow-float sm:rounded-2xl">
        <div className="mb-5 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Welcome to PaisaPulse</h2>
              <p className="text-sm text-muted-foreground">Tell us a little about yourself.</p>
            </div>
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Priya Sharma" className="h-12" />
            </Field>
            <Field label="WhatsApp number">
              <div className="flex gap-2">
                <span className="flex h-12 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">+91</span>
                <Input inputMode="numeric" maxLength={10} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))} placeholder="9876543210" className="h-12" />
              </div>
            </Field>
            <Field label="UPI ID">
              <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@okhdfc" autoCapitalize="none" className="h-12" />
            </Field>
            <Button className="h-12 w-full rounded-xl" onClick={nextFromProfile}>Continue</Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Monthly income</h2>
              <p className="text-sm text-muted-foreground">Take-home pay after tax. We use it to suggest budgets.</p>
            </div>
            <Field label="Amount (₹)">
              <Input inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/\D/g, ""))} placeholder="75000" className="h-12 text-lg" />
            </Field>
            {incomeNum > 0 && <p className="text-sm font-medium text-primary">{formatINR(incomeNum)} per month</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => setStep(0)}>Back</Button>
              <Button className="h-12 flex-1 rounded-xl" onClick={goToBudgets}>Continue</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Starting budgets</h2>
              <p className="text-sm text-muted-foreground">Suggested from your income — adjust any amount.</p>
            </div>
            <div className="space-y-3">
              {DEFAULT_BUDGETS.map((b) => (
                <div key={b.category} className="flex items-center justify-between gap-3">
                  <Label className="text-sm">{b.category}</Label>
                  <div className="relative w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <Input inputMode="numeric" value={budgets[b.category] ?? ""} onChange={(e) => setBudgets({ ...budgets, [b.category]: e.target.value.replace(/\D/g, "") })} className="h-11 pl-7 text-right" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatINR(Object.values(budgets).reduce((s, v) => s + (Number(v) || 0), 0))} of {formatINR(incomeNum)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => setStep(1)}>Back</Button>
              <Button className="h-12 flex-1 rounded-xl" onClick={finish} disabled={saving}>{saving ? "Saving…" : "Finish"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

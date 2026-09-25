import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PaisaPulse" },
      { name: "description", content: "Sign in to PaisaPulse with your mobile number or Google account." },
      { property: "og:title", content: "Sign in — PaisaPulse" },
      { property: "og:description", content: "Track spends, budgets and dues in rupees. Sign in with phone OTP or Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const fullPhone = `+91${phone}`;

  async function sendOtp() {
    if (!/^[6-9]\d{9}$/.test(phone)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("OTP sent via SMS");
  }

  async function verifyOtp() {
    if (otp.length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: "sms" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message ?? "Google sign-in failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img src="/icons/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">PaisaPulse</h1>
          <p className="text-sm text-muted-foreground">Your money, in rhythm.</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          {!sent ? (
            <>
              <label className="text-sm font-medium text-foreground">Mobile number</label>
              <div className="flex gap-2">
                <span className="flex h-12 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">+91</span>
                <Input inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="9876543210" className="h-12" />
              </div>
              <Button className="h-12 w-full rounded-xl" onClick={sendOtp} disabled={busy}>Send OTP</Button>
            </>
          ) : (
            <>
              <label className="text-sm font-medium text-foreground">Enter OTP sent to {fullPhone}</label>
              <Input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="h-12 text-center text-lg tracking-[0.5em]" />
              <Button className="h-12 w-full rounded-xl" onClick={verifyOtp} disabled={busy}>Verify & continue</Button>
              <button className="w-full text-sm text-muted-foreground" onClick={() => { setSent(false); setOtp(""); }}>Change number</button>
            </>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="h-12 w-full rounded-xl" onClick={google} disabled={busy}>
            Continue with Google
          </Button>
        </div>
      </div>
    </main>
  );
}

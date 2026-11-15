import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogIn, Sparkles, Mail, Phone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PaisaPulse" },
      { name: "description", content: "Sign in to PaisaPulse with your mobile number, email, or Google account." },
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
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
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
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("OTP sent via SMS");
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: "sms" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setBusy(true);
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: email.split("@")[0] } },
      });
      if (error) {
        setBusy(false);
        toast.error(error.message);
      } else if (data.session) {
        setBusy(false);
        toast.success("Account created and signed in!");
        navigate({ to: "/", replace: true });
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (signInErr) {
          toast.info("Account created! Please enter your password to sign in.");
          setIsSignUp(false);
        } else {
          toast.success("Account created and signed in!");
          navigate({ to: "/", replace: true });
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Signed in successfully!");
        navigate({ to: "/", replace: true });
      }
    }
  }

  async function demoLogin() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: "test@paisapulse.in",
      password: "PaisaPulse@2026",
    });
    setBusy(false);
    if (error) {
      toast.error(`Demo sign-in failed: ${error.message}`);
    } else {
      toast.success("Signed in to demo account!");
      navigate({ to: "/", replace: true });
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message ?? "Google sign-in failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img src="/icons/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">PaisaPulse</h1>
          <p className="text-sm text-muted-foreground">Your money, in rhythm.</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          {/* Method switch tabs */}
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setMethod("phone"); setSent(false); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                method === "phone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Phone className="h-3.5 w-3.5" /> Mobile OTP
            </button>
            <button
              type="button"
              onClick={() => setMethod("email")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                method === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
          </div>

          {method === "phone" ? (
            !sent ? (
              <>
                <label className="text-sm font-medium text-foreground">Mobile number</label>
                <div className="flex gap-2">
                  <span className="flex h-12 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="9876543210"
                    className="h-12"
                  />
                </div>
                <Button className="h-12 w-full rounded-xl" onClick={sendOtp} disabled={busy}>
                  Send OTP
                </Button>
              </>
            ) : (
              <>
                <label className="text-sm font-medium text-foreground">
                  Enter OTP sent to {fullPhone}
                </label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="h-12 text-center text-lg tracking-[0.5em]"
                />
                <Button className="h-12 w-full rounded-xl" onClick={verifyOtp} disabled={busy}>
                  Verify & continue
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => { setSent(false); setOtp(""); }}
                >
                  Change number
                </button>
              </>
            )
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="mt-1 h-12"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 h-12"
                  required
                />
              </div>
              <Button type="submit" className="h-12 w-full rounded-xl" disabled={busy}>
                {busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-primary underline hover:opacity-80"
                >
                  {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/5"
            onClick={demoLogin}
            disabled={busy}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Sign in with Demo Account
          </Button>

          <Button variant="outline" className="h-12 w-full rounded-xl" onClick={google} disabled={busy}>
            Continue with Google
          </Button>
        </div>
      </div>
    </main>
  );
}

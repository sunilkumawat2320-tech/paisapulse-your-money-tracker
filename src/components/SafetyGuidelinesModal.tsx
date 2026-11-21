import {
  ShieldCheck,
  Lock,
  Smartphone,
  Key,
  FileCheck2,
  Trash2,
  CheckCircle2,
  XCircle,
  EyeOff,
  ServerOff,
  Database,
  ExternalLink,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Pillar {
  id: string;
  icon: typeof ShieldCheck;
  title: string;
  subtitle: string;
  badge: string;
  badgeVariant?: "default" | "secondary" | "outline";
  explanation: string;
  points: string[];
}

const safetyPillars: Pillar[] = [
  {
    id: "rls",
    icon: Database,
    title: "PostgreSQL Row-Level Security (RLS)",
    subtitle: "Mathematical Multi-Tenant Database Isolation",
    badge: "Engine Enforced",
    explanation:
      "Every single table in our PostgreSQL database has Row-Level Security (RLS) strictly enforced at the database engine level (auth.uid() = user_id).",
    points: [
      "No Cross-User Access: Even if someone has our public Supabase keys and knows your user ID, PostgreSQL will physically reject any query that does not carry your cryptographically signed session token.",
      "Zero Shared Queries: Your transactions, budgets, subscriptions, and debts are physically partitioned to your account.",
      "Protected Tables: transactions, profiles, budgets, subscriptions, owed_items, and insights all have active RLS policies.",
    ],
  },
  {
    id: "sms",
    icon: Smartphone,
    title: "100% Client-Side SMS Parsing",
    subtitle: "Zero Raw Message Transmission or Storage",
    badge: "Device Only",
    explanation:
      "When you use 1-Tap Daily SMS Batch Sync or paste UPI debit texts, all pattern recognition and parsing runs 100% inside your device's browser memory.",
    points: [
      "No SMS Uploads: Your raw SMS inbox messages, personal WhatsApp texts, and OTPs are never uploaded to any server or cloud database.",
      "Account Number Masking: Bank account identifiers are automatically masked (e.g. **1234) before anything is saved.",
      "Balance Stripping: Your total account balances ('Avail Bal: Rs X') are filtered out client-side so balance information is never logged.",
      "Structured Extraction Only: Only the final clean expense event (Amount, Merchant, Category, Timestamp) is ever written to your private database row.",
    ],
  },
  {
    id: "byok",
    icon: Key,
    title: "Bring Your Own Key (BYOK) AI Architecture",
    subtitle: "No Middleman or AI Proxy Servers",
    badge: "Zero-Trust",
    explanation:
      "If you connect your free Google AI Studio (Gemini) API key for multimodal receipt OCR or voice parsing, your key and data remain completely under your control.",
    points: [
      "Local Storage Only: Your Gemini API key is stored strictly inside your phone's browser localStorage (paisapulse_gemini_api_key).",
      "Direct Google Connection: Requests travel directly from your browser to Google's official encrypted API endpoint (generativelanguage.googleapis.com).",
      "No Developer Access: PaisaPulse developers and servers cannot view, log, or proxy your receipt images or API tokens.",
      "1-Click Key Removal: You can purge your API key from your device at any moment with one click.",
    ],
  },
  {
    id: "encryption",
    icon: Lock,
    title: "Bank-Grade Encryption in Transit",
    subtitle: "TLS 1.3, HSTS & Salted Password Hashing",
    badge: "Enterprise Grade",
    explanation:
      "All network traffic is encrypted end-to-end to prevent interception, eavesdropping, or man-in-the-middle attacks.",
    points: [
      "TLS 1.3 & HSTS: Enforced across all Netlify hosting endpoints and Supabase database gateways with HTTP Strict Transport Security.",
      "Salted Password Hashing: Handled via Supabase Auth (SOC2 Type II, ISO 27001, and GDPR compliant). Plaintext passwords are never stored.",
      "Rotating JWT Sessions: Authentication uses short-lived tokens with secure refresh token rotation to protect against session hijacking.",
    ],
  },
  {
    id: "portability",
    icon: FileCheck2,
    title: "Full Data Ownership & Portability",
    subtitle: "Instant Excel Export & Right to Delete",
    badge: "Zero Lock-In",
    explanation:
      "You own your financial data completely. PaisaPulse guarantees frictionless export and deletion at any time.",
    points: [
      "1-Tap Excel Export: Download your full transaction history anytime as a formatted .xlsx spreadsheet from the Transaction Ledger.",
      "Granular Deletion: Permanently delete individual transactions, debts, or budgets whenever you wish.",
      "Secure Sign-Out: Clearing your session immediately wipes your cached credentials from browser memory.",
    ],
  },
];

export function SafetyGuidelinesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Safety & Privacy Guidelines
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                How PaisaPulse isolates, encrypts, and shields your financial data
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Top trust banner */}
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
            <p className="font-semibold flex items-center gap-1.5 mb-1 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Privacy-First Architecture
            </p>
            PaisaPulse is designed with zero cross-user visibility. Other users, third-party advertisers, and even app maintainers have no technical capability to view your transactions.
          </div>

          {/* 5 Security Pillars */}
          <div className="space-y-3">
            {safetyPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.id}
                  className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {pillar.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          {pillar.subtitle}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-medium py-0.5">
                      {pillar.badge}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {pillar.explanation}
                  </p>

                  <ul className="space-y-1.5 pt-1 border-t border-border/40 text-xs text-foreground/85">
                    {pillar.points.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Comparison Table */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5 shadow-xs">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-primary" /> What We Store vs What Never Leaves Your Device
            </h4>

            <div className="space-y-2 text-xs">
              <div className="rounded-xl bg-muted/40 p-2.5 space-y-1.5">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> What Is Securely Stored (Locked to Your Account via RLS):
                </span>
                <p className="text-muted-foreground pl-5">
                  • Extracted transaction details (Amount, Merchant, Category, Timestamp, Note)<br />
                  • Your monthly budget goals and recurring subscriptions<br />
                  • Informal debt records (Split & Owed names and amounts)<br />
                  • Your profile name, income preference, and UPI ID for payment requests
                </p>
              </div>

              <div className="rounded-xl bg-danger-soft/60 p-2.5 space-y-1.5">
                <span className="font-semibold text-danger flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5" /> What NEVER Leaves Your Device:
                </span>
                <p className="text-muted-foreground pl-5">
                  • Raw SMS inbox messages and OTPs (parsed locally in browser memory only)<br />
                  • Full bank account numbers (automatically masked as **1234)<br />
                  • Bank account balance totals (stripped before logging)<br />
                  • Google AI Studio API keys (saved strictly in device localStorage)
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

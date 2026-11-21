import { useState } from "react";
import {
  BookOpen,
  Search,
  Home,
  Zap,
  PiggyBank,
  RefreshCw,
  HandCoins,
  HelpCircle,
  Trophy,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface ManualSection {
  id: string;
  title: string;
  badge: string;
  icon: typeof Home;
  summary: string;
  purpose: string;
  howToUse: string[];
  proTip: string;
}

const manualSections: ManualSection[] = [
  {
    id: "dashboard",
    title: "Home & Smart Dashboard",
    badge: "Overview",
    icon: Home,
    summary: "Your daily financial cockpit showing net balance, safe daily spend, and interactive category analytics.",
    purpose:
      "Gives you an immediate, anxiety-free pulse of your finances the moment you open the app without navigating complex menus.",
    howToUse: [
      "View your Current Month Spend and Total Income right at the top.",
      "Check your Safe Daily Spend — calculated as your remaining budget divided by the days left in the month.",
      "Tap slices of the Interactive Donut Chart to see exact spend totals per category (Food, Shopping, Bills, etc.).",
      "Read the AI Financial Insight banner for customized, actionable money-saving advice based on your current pace.",
      "Pull down on mobile (or tap Refresh) anytime to reload live data.",
    ],
    proTip: "Keep your Safe Daily Spend in the green by logging small spends (like chai, auto, or snacks) right as they happen.",
  },
  {
    id: "capture",
    title: "Smart Capture (Voice, SMS & Receipts)",
    badge: "1-Tap Entry",
    icon: Zap,
    summary: "Fastest way to log expenses: 1-Tap Clipboard SMS sync, Hinglish voice recognition, manual quick entry, and receipt OCR.",
    purpose:
      "Eliminates the friction of manual bookkeeping by letting you speak naturally or copy-paste bank SMS texts in bulk.",
    howToUse: [
      "1-Tap Daily SMS Batch Sync: Copy all bank SMS messages or UPI debit alerts from Google Messages or WhatsApp, open Capture, and tap 'Sync from Clipboard'. All expenses are extracted and logged in 1 second with duplicates automatically skipped.",
      "Hinglish Voice Entry: Tap '🇮🇳 Hinglish' or '🇬🇧 English', press 'Speak Expense', and say: 'Auto 150 rupees from station' or 'Chai 40 rupees with team'.",
      "Manual Quick Entry: Type amount, select category (Food, Travel, Bills, etc.), pick payment method (UPI, Card, Cash), and save.",
      "Bill Scan (OCR): Upload a restaurant bill or grocery receipt to auto-extract items, tax, and merchant with Gemini AI.",
      "Statement Import: Upload bank account PDF/Excel statements to bulk-import past transactions.",
    ],
    proTip: "You never need to edit bank SMS text before pasting—PaisaPulse automatically strips your account balance and masks account numbers (**1234).",
  },
  {
    id: "budgets",
    title: "Budgets & Category Limits",
    badge: "Overspend Shield",
    icon: PiggyBank,
    summary: "Set realistic monthly spend ceilings across categories and get proactive alerts before you run out of money.",
    purpose:
      "Prevents end-of-month budget shock by monitoring your burn rate and warning you when a category reaches 80% or 100% capacity.",
    howToUse: [
      "Tap 'Set Budget' on any category (e.g. Food & Dining, Shopping, Entertainment).",
      "Input your monthly budget cap in ₹ (e.g. ₹15,000 for Food).",
      "Track live progress bars: Green (<80%), Amber warning (80-99%), and Red alert (Overbudget).",
      "Check your Suggested Safe Pace to know how much you can spend per remaining day without exceeding your ceiling.",
    ],
    proTip: "Assign budgets to your top 3 leak categories first (usually Food Delivery, Weekend Outings, and Impulse Online Shopping).",
  },
  {
    id: "subscriptions",
    title: "Subscriptions & Recurring Bills",
    badge: "Never Miss Renewal",
    icon: RefreshCw,
    summary: "Track all recurring commitments: Netflix, Spotify, Gym, Rent, Wi-Fi, EMIs, and cloud subscriptions.",
    purpose:
      "Keeps a dedicated ledger of fixed monthly obligations and alerts you before renewal dates so you can cancel unused services.",
    howToUse: [
      "Tap 'Add Subscription', enter the service name (e.g. Netflix, Cult.fit, House Rent), amount, and billing frequency (Monthly/Yearly).",
      "Pick your Next Renewal Date and payment method.",
      "View the 'Total Monthly Commitment' card to know your baseline fixed expenses before any discretionary spending.",
      "Review the 'Renewing Soon' countdown to cancel services you no longer use before auto-debit strikes.",
    ],
    proTip: "Toggle 'Active / Paused' when you temporarily pause a subscription (e.g. gym during travel) to keep accurate metrics.",
  },
  {
    id: "owed",
    title: "Split Bill & Owed (Hisab-Kitab)",
    badge: "Debt Tracker",
    icon: HandCoins,
    summary: "Manage informal group expenses, split dinner bills, track borrowed funds, and send 1-tap WhatsApp reminders with UPI payment links.",
    purpose:
      "Avoids awkward money conversations by keeping a clear ledger of who owes you vs. who you owe, complete with ready-to-pay UPI links.",
    howToUse: [
      "Tap 'Split a Bill' to divide a group restaurant or trip bill equally or with custom amounts.",
      "Track 'You are Owed' (money friends need to pay you back) vs 'You Owe' (money you need to return).",
      "Tap 'Send WhatsApp Reminder' next to any person: PaisaPulse generates a polite message with your prefilled UPI payment link (e.g. upi://pay?pa=your-id&am=450).",
      "Tap 'Mark Settled' once the payment is received to clear the debt.",
    ],
    proTip: "Set your default UPI ID in your Profile so payment links in WhatsApp reminders automatically point directly to your bank account.",
  },
  {
    id: "afford_it",
    title: "\"Can I Afford It?\" Decision Tool",
    badge: "Impulse Checker",
    icon: HelpCircle,
    summary: "Interactive financial simulator that tests a potential purchase against your upcoming bills and bank cushion.",
    purpose:
      "Prevents regretful impulse buys by calculating your exact post-purchase daily budget and upcoming subscription safety.",
    howToUse: [
      "Tap 'Afford It?' in the top action strip on the Home dashboard.",
      "Enter the price of the item you want to buy (e.g. ₹8,000 for new headphones or ₹2,500 for a weekend party).",
      "Select the category and target date.",
      "Review the Instant Verdict: Green (Safe to Buy), Amber (Proceed with Caution), or Red (Unsafe / Exceeds Cushions).",
      "Check the mathematical breakdown showing remaining daily safe spend and upcoming bill coverage.",
    ],
    proTip: "Use this before clicking 'Buy Now' on Amazon or Flipkart during festive sales.",
  },
  {
    id: "report_card",
    title: "Monthly Money Report Card",
    badge: "Health Score",
    icon: Trophy,
    summary: "Comprehensive financial audit scoring your monthly habits from 0 to 100 based on savings rate, delivery habits, and budget discipline.",
    purpose:
      "Provides objective feedback on your financial health, celebrating your wins and highlighting high-leak habits.",
    howToUse: [
      "Tap 'Report Card' in the top action strip on the Home dashboard.",
      "View your overall Letter Grade (A+, A, B, C) and Score out of 100.",
      "Audit your Delivery vs Groceries Ratio (identifies if food delivery apps are draining savings).",
      "Review your Discretionary vs Fixed Expense split.",
      "Read actionable recommendations tailored to boost your savings score for next month.",
    ],
    proTip: "Aim to keep your Food Delivery ratio under 30% of total food spend to dramatically increase your financial grade.",
  },
  {
    id: "ledger",
    title: "Transaction Ledger & Excel Export",
    badge: "Full History",
    icon: FileSpreadsheet,
    summary: "Complete chronological history of every transaction, with powerful search, category filters, and 1-tap Excel (.xlsx) export.",
    purpose:
      "Gives you total transparency and data ownership so you can audit, search, delete, or export your complete financial records anytime.",
    howToUse: [
      "Open the Ledger from the top-right profile avatar or the 'Ledger' button on the Home dashboard.",
      "Use the Search Bar to instantly find any transaction by merchant name, note, or amount.",
      "Filter by Type (All / Expense / Income) or Category.",
      "Delete any accidental or duplicate entries with the trash icon.",
      "Tap 'Export to Excel' to download a clean, formatted `.xlsx` spreadsheet for your tax filing or personal archival.",
    ],
    proTip: "Export your ledger at the end of each month to maintain an offline backup of your spending history.",
  },
];

export function UserManualModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = manualSections.filter((section) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      section.title.toLowerCase().includes(q) ||
      section.summary.toLowerCase().includes(q) ||
      section.purpose.toLowerCase().includes(q) ||
      section.howToUse.some((step) => step.toLowerCase().includes(q))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                PaisaPulse User Manual
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Complete guide to every feature, tool & financial workflow
              </p>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features (e.g. SMS sync, budgets, report card, UPI)..."
              className="pl-9 h-10 rounded-xl text-xs bg-muted/40"
            />
          </div>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-foreground">No features matched &quot;{search}&quot;</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for keywords like &apos;SMS&apos;, &apos;voice&apos;, &apos;budget&apos;, &apos;owed&apos;, or &apos;export&apos;.
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible defaultValue={filtered[0]?.id || "dashboard"} className="space-y-2.5">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border border-border/80 rounded-2xl bg-card px-4 py-1 transition-colors hover:border-primary/40 shadow-xs"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 text-left">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {item.title}
                            </span>
                            <Badge variant="secondary" className="text-[10px] py-0 px-2 rounded-md font-medium">
                              {item.badge}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.summary}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pt-1 pb-4 text-xs space-y-3.5 border-t border-border/40 mt-1">
                      <div>
                        <span className="font-semibold text-foreground block mb-1">
                          🎯 Purpose & Benefits:
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          {item.purpose}
                        </p>
                      </div>

                      <div>
                        <span className="font-semibold text-foreground block mb-1.5">
                          📋 Step-by-Step Guide:
                        </span>
                        <ul className="space-y-1.5 text-muted-foreground">
                          {item.howToUse.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl bg-primary-soft/60 border border-primary/20 p-2.5 flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-primary block text-[11px]">
                            Pro-Tip:
                          </span>
                          <span className="text-[11px] text-foreground/80 leading-relaxed">
                            {item.proTip}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

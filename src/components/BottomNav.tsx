import { Link } from "@tanstack/react-router";
import { Home, PiggyBank, RefreshCw, HandCoins, Plus } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/budgets", label: "Budgets", icon: PiggyBank, exact: false },
  { to: "/subscriptions", label: "Subs", icon: RefreshCw, exact: false },
  { to: "/owed", label: "Owed", icon: HandCoins, exact: false },
] as const;

export function BottomNav() {
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="pb-safe mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-2">
        {left.map((tab) => (
          <NavItem key={tab.to} {...tab} />
        ))}

        <div className="flex justify-center">
          <Link
            to="/capture"
            aria-label="Capture an expense"
            className="-mt-8 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-transform active:scale-95"
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
            <span className="text-[10px] font-semibold">Add</span>
          </Link>
        </div>

        {right.map((tab) => (
          <NavItem key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  exact: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors"
      activeProps={{ className: "text-primary" }}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}

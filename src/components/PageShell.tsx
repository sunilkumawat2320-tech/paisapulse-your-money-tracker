import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-32">
      <header className="pt-safe grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-5">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <ThemeToggle />
      </header>
      <main className="space-y-4">{children}</main>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-card ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon}
      </div>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-[16rem] text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}

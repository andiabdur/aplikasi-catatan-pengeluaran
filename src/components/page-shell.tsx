import Link from "next/link";
import { BottomNav } from "./bottom-nav";
import { HeaderQuickActions } from "./header-quick-actions";
import { ThemeToggle } from "./theme-toggle";
import { getCurrentHouseholdId } from "@/lib/supabase/household";

export async function PageShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const householdId = await getCurrentHouseholdId();

  return (
    <div className="min-h-dvh pb-28 bg-background text-foreground">
      <header className="sticky top-0 z-30 h-[68px] flex items-center bg-background/90 backdrop-blur-md border-b border-border transition-colors">
        <div className="mx-auto w-full max-w-md px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Link
              href="/"
              aria-label="Kembali ke Beranda"
              className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-xs shrink-0 shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              CFO
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <HeaderQuickActions householdId={householdId ?? undefined} />
            <ThemeToggle />
            {right}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4 space-y-4 animate-slide-up">{children}</main>
      <BottomNav />
    </div>
  );
}

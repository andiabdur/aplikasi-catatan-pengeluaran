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
    <div className="min-h-dvh pb-28 bg-slate-50 dark:bg-background-dark">
      <header className="sticky top-0 z-30 h-[68px] flex items-center bg-white dark:bg-surface-dark border-b-4 border-slate-950 dark:border-slate-100 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[0px_4px_0px_0px_rgba(255,255,255,1)] transition-colors">
        <div className="mx-auto w-full max-w-md px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Link
              href="/"
              aria-label="Kembali ke Beranda"
              className="w-9 h-9 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-brand-500 text-slate-950 flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              CFO
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-bold font-headline uppercase tracking-tight text-slate-950 dark:text-slate-50 truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
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

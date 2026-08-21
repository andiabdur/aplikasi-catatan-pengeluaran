import { BottomNav } from "./bottom-nav";
import { FloatingActions } from "./floating-actions";
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
      <header className="sticky top-0 z-30 bg-white dark:bg-surface-dark border-b-4 border-slate-950 dark:border-slate-100 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[0px_4px_0px_0px_rgba(255,255,255,1)] transition-colors">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-brand-500 text-slate-950 flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
              CFO
            </div>
            <div>
              <h1 className="text-base font-bold font-headline uppercase tracking-tight text-slate-950 dark:text-slate-50 flex items-center gap-1.5">
                {title}
              </h1>
              {subtitle && <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {right}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4 space-y-4 animate-slide-up">{children}</main>
      <BottomNav />
      <FloatingActions householdId={householdId ?? undefined} />
    </div>
  );
}

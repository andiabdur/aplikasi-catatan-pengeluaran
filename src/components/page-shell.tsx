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
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-[0px_2px_0px_0px_rgba(0,0,0,0.04)] dark:shadow-[0px_2px_0px_0px_rgba(0,0,0,0.4)]">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center font-bold text-brand-600 dark:text-brand-400 text-xs shrink-0 shadow-sm">
              CFO
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                {title}
              </h1>
              {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
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

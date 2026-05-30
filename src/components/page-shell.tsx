import { BottomNav } from "./bottom-nav";
import { FloatingChat } from "./floating-chat";
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
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">{children}</main>
      <BottomNav />
      {householdId && <FloatingChat householdId={householdId} />}
    </div>
  );
}

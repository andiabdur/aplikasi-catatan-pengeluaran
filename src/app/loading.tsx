import { BottomNav } from "@/components/bottom-nav";

export default function DashboardLoading() {
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white dark:bg-surface-dark border-b-4 border-slate-950 dark:border-slate-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-36 rounded-none" />
            <div className="skeleton h-3 w-44 mt-1.5 rounded-none" />
          </div>
          <div className="skeleton h-8 w-8 rounded-none border border-slate-950" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="skeleton h-10 w-full rounded-none border-2 border-slate-950" />

        <div className="rounded-none border-4 border-slate-950 dark:border-slate-100 bg-brand-500 p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="skeleton h-4 w-32 rounded-none !bg-slate-950/20" />
          <div className="skeleton h-8 w-48 mt-2 rounded-none !bg-slate-950/30" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="skeleton h-16 rounded-none !bg-slate-950/20" />
            <div className="skeleton h-16 rounded-none !bg-slate-950/20" />
          </div>
        </div>

        <section className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-950 dark:border-slate-100">
            <div className="skeleton h-4 w-32 rounded-none" />
            <div className="skeleton h-4 w-16 rounded-none" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton h-4 w-4 rounded-none" />
                <div className="skeleton h-4 w-24 rounded-none" />
              </div>
              <div className="skeleton h-4 w-20 rounded-none" />
            </div>
          ))}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

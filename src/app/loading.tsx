import { BottomNav } from "@/components/bottom-nav";

export default function DashboardLoading() {
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-3 w-44 mt-1.5" />
          </div>
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="skeleton h-10 w-full rounded-xl" />

        <div className="rounded-2xl bg-gradient-to-br from-brand-600/20 to-brand-700/20 dark:from-brand-900/30 dark:to-brand-800/30 p-5">
          <div className="skeleton h-4 w-32 !bg-brand-200/50 dark:!bg-brand-800/50" />
          <div className="skeleton h-8 w-48 mt-2 !bg-brand-200/50 dark:!bg-brand-800/50" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="skeleton h-16 rounded-xl !bg-brand-200/30 dark:!bg-brand-800/30" />
            <div className="skeleton h-16 rounded-xl !bg-brand-200/30 dark:!bg-brand-800/30" />
          </div>
        </div>

        <section className="card p-0">
          <div className="p-4 flex items-center justify-between">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-16" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton h-3 w-3 rounded-full" />
                <div className="skeleton h-4 w-24" />
              </div>
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </section>

        <section className="card p-0">
          <div className="p-4 flex items-center justify-between">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-4 w-16" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-2 w-2 rounded-full" />
                  <div className="skeleton h-4 w-32" />
                </div>
                <div className="skeleton h-3 w-24 ml-4" />
              </div>
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

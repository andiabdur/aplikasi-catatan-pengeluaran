import { BottomNav } from "@/components/bottom-nav";

export default function SettingsLoading() {
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-28" />
            <div className="skeleton h-3 w-48 mt-1.5" />
          </div>
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <section key={i} className="card p-0">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="skeleton h-4 w-28" />
            </div>
            {Array.from({ length: i < 2 ? 3 : 2 }).map((_, j) => (
              <div
                key={j}
                className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0"
              >
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </section>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}

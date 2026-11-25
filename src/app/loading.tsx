import { BottomNav } from "@/components/bottom-nav";

export default function DashboardLoading() {
  return (
    <div className="min-h-dvh pb-28 bg-background">
      <header className="sticky top-0 z-20 h-[68px] flex items-center bg-background/90 border-b border-border">
        <div className="mx-auto w-full max-w-md px-4 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-3 w-44 mt-1.5" />
          </div>
          <div className="skeleton h-9 w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="skeleton h-12 w-full rounded-2xl" />

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="skeleton h-16 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
          </div>
        </div>

        <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-16" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton h-8 w-8 rounded-xl" />
                <div className="skeleton h-4 w-24" />
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

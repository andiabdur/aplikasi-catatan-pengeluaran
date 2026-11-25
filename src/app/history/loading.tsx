import { BottomNav } from "@/components/bottom-nav";

export default function HistoryLoading() {
  return (
    <div className="min-h-dvh pb-28 bg-background">
      <header className="sticky top-0 z-20 h-[68px] flex items-center bg-background/90 border-b border-border">
        <div className="mx-auto w-full max-w-md px-4 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-20" />
            <div className="skeleton h-3 w-36 mt-1.5" />
          </div>
          <div className="skeleton h-9 w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="flex gap-2">
          <div className="skeleton h-10 flex-1 rounded-xl" />
          <div className="skeleton h-10 flex-1 rounded-xl" />
          <div className="skeleton h-10 flex-1 rounded-xl" />
        </div>

        <div className="skeleton h-10 w-full rounded-xl" />

        <div className="card">
          <div className="skeleton h-4 w-28 mb-2" />
          <div className="skeleton h-6 w-36" />
        </div>

        <div className="card p-0 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-2 w-2 rounded-full" />
                  <div className="skeleton h-4 w-36" />
                </div>
                <div className="skeleton h-3 w-28 ml-4" />
              </div>
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

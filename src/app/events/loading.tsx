import { BottomNav } from "@/components/bottom-nav";

export default function EventsLoading() {
  return (
    <div className="min-h-dvh pb-28 bg-background">
      <header className="sticky top-0 z-20 h-[68px] flex items-center bg-background/90 border-b border-border">
        <div className="mx-auto w-full max-w-md px-4 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-3 w-48 mt-1.5" />
          </div>
          <div className="skeleton h-9 w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="space-y-1.5">
                <div className="skeleton h-4 w-28" />
                <div className="skeleton h-3 w-36" />
              </div>
            </div>
            <div className="skeleton h-10 w-28 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
          </div>
        </div>

        <div className="skeleton h-11 w-full rounded-xl" />

        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="skeleton h-5 w-36" />
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
              <div className="skeleton h-6 w-32" />
              <div className="skeleton h-2 w-full rounded-full" />
              <div className="flex gap-2">
                <div className="skeleton h-9 flex-1 rounded-xl" />
                <div className="skeleton h-9 flex-1 rounded-xl" />
                <div className="skeleton h-9 flex-1 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

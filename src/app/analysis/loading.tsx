import { BottomNav } from "@/components/bottom-nav";

export default function AnalysisLoading() {
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
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-8 w-20 rounded-xl" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-9 w-24 rounded-xl" />
            <div className="skeleton h-9 w-24 rounded-xl" />
            <div className="skeleton h-9 w-20 rounded-xl" />
            <div className="skeleton h-9 w-20 rounded-xl" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-9 w-24 rounded-xl" />
            <div className="skeleton h-9 w-32 rounded-xl" />
            <div className="skeleton h-9 w-28 rounded-xl" />
          </div>
        </div>

        <div className="skeleton h-16 w-full rounded-2xl" />

        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-4 min-h-[116px] shadow-sm space-y-3"
            >
              <div className="skeleton h-3.5 w-24" />
              <div className="skeleton h-6 w-28" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="skeleton h-60 w-full rounded-xl" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <div className="skeleton h-10 w-full rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <div className="skeleton h-8 w-8 rounded-xl" />
                <div className="space-y-1.5">
                  <div className="skeleton h-3.5 w-28" />
                  <div className="skeleton h-3 w-20" />
                </div>
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

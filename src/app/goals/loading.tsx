import { BottomNav } from "@/components/bottom-nav";

export default function GoalsLoading() {
  return (
    <div className="min-h-dvh pb-28 bg-background">
      <header className="sticky top-0 z-20 h-[68px] flex items-center bg-background/90 border-b border-border">
        <div className="mx-auto w-full max-w-md px-4 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-3 w-48 mt-1.5" />
          </div>
          <div className="skeleton h-9 w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="skeleton h-10 w-full rounded-xl" />

        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-28" />
            </div>
          </div>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}

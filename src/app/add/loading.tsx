import { BottomNav } from "@/components/bottom-nav";

export default function AddLoading() {
  return (
    <div className="min-h-dvh pb-28 bg-background">
      <header className="sticky top-0 z-20 h-[68px] flex items-center bg-background/90 border-b border-border">
        <div className="mx-auto w-full max-w-md px-4 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-3 w-44 mt-1.5" />
          </div>
          <div className="skeleton h-9 w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-20 rounded-full" />
          ))}
        </div>

        <div>
          <div className="skeleton h-4 w-16 mb-1.5" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>

        <div>
          <div className="skeleton h-4 w-20 mb-1.5" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-xl" />
            ))}
          </div>
        </div>

        <div>
          <div className="skeleton h-4 w-16 mb-1.5" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>

        <div>
          <div className="skeleton h-4 w-20 mb-1.5" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>

        <div className="skeleton h-12 w-full rounded-xl" />
      </main>

      <BottomNav />
    </div>
  );
}

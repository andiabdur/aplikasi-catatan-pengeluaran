export default function EventsLoading() {
  return (
    <div className="container max-w-lg mx-auto p-4 pb-32 space-y-4 bg-background">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="skeleton h-6 w-48" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="skeleton h-5 w-32" />
        <div className="space-y-3">
          <div>
            <div className="skeleton h-3 w-20 mb-1.5" />
            <div className="skeleton h-11 w-full rounded-xl" />
          </div>
          <div>
            <div className="skeleton h-3 w-24 mb-1.5" />
            <div className="skeleton h-11 w-full rounded-xl" />
          </div>
          <div className="skeleton h-11 w-full rounded-xl" />
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
            <div className="skeleton h-3 w-24 mb-1.5" />
            <div className="skeleton h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

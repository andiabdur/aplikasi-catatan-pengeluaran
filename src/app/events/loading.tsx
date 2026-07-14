export default function EventsLoading() {
  return (
    <div className="container max-w-lg mx-auto p-4 pb-32">
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton h-9 w-9 rounded-full" />
        <div className="skeleton h-6 w-48" />
      </div>

      <div className="mb-6 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="skeleton h-5 w-32 mb-3" />
        <div className="space-y-3">
          <div>
            <div className="skeleton h-3 w-20 mb-1" />
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
          <div>
            <div className="skeleton h-3 w-24 mb-1" />
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
          <div className="skeleton h-10 w-full rounded-xl" />
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
            <div className="skeleton h-3 w-24 mb-1" />
            <div className="skeleton h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

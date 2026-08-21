export default function EventsLoading() {
  return (
    <div className="container max-w-lg mx-auto p-4 pb-32 space-y-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-9 w-9 rounded-none border-2 border-slate-950" />
        <div className="skeleton h-6 w-48 rounded-none" />
      </div>

      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="skeleton h-5 w-32 rounded-none" />
        <div className="space-y-3">
          <div>
            <div className="skeleton h-3 w-20 mb-1 rounded-none" />
            <div className="skeleton h-10 w-full rounded-none border border-slate-950" />
          </div>
          <div>
            <div className="skeleton h-3 w-24 mb-1 rounded-none" />
            <div className="skeleton h-10 w-full rounded-none border border-slate-950" />
          </div>
          <div className="skeleton h-10 w-full rounded-none bg-brand-500 border border-slate-950" />
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="skeleton h-5 w-32 rounded-none" />
              <div className="skeleton h-5 w-16 rounded-none border border-slate-950" />
            </div>
            <div className="skeleton h-3 w-24 mb-1 rounded-none" />
            <div className="skeleton h-4 w-28 rounded-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

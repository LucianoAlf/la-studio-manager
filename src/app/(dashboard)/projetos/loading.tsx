export default function ProjetosLoading() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Header skeleton */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-800/60" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-slate-800" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto p-6 bg-slate-950">
        {/* Kanban columns skeleton */}
        <div className="flex gap-4 h-full">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-72 rounded-xl border border-slate-800 bg-slate-900/50"
            >
              {/* Column header */}
              <div className="p-3 border-b border-slate-800">
                <div className="h-5 w-24 animate-pulse rounded bg-slate-800" />
              </div>
              {/* Cards */}
              <div className="p-3 space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div
                    key={j}
                    className="rounded-lg border border-slate-800 bg-slate-800/50 p-4"
                  >
                    <div className="h-4 w-full animate-pulse rounded bg-slate-700/50 mb-2" />
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-700/30" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

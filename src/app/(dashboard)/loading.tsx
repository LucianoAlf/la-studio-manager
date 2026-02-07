export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Header skeleton */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-800/60" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto p-8 bg-slate-950">
        <div className="mx-auto max-w-7xl">
          {/* Stat cards skeleton */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-700/30 bg-gradient-to-br from-slate-800 to-slate-900 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-700/50" />
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-700/50" />
                </div>
                <div className="h-10 w-16 animate-pulse rounded bg-slate-700/50" />
                <div className="mt-4 h-1.5 w-full animate-pulse rounded-full bg-slate-700/30" />
              </div>
            ))}
          </div>

          {/* Pipeline + Entregas skeleton */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
            <div className="col-span-2 rounded-2xl border border-slate-700/30 bg-gradient-to-br from-slate-800 to-slate-900 p-6">
              <div className="h-6 w-48 animate-pulse rounded bg-slate-700/50 mb-4" />
              <div className="h-4 w-full animate-pulse rounded-full bg-slate-700/30 mb-4" />
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 w-20 animate-pulse rounded bg-slate-700/30" />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700/30 bg-gradient-to-br from-slate-800 to-slate-900 p-6">
              <div className="h-6 w-40 animate-pulse rounded bg-slate-700/50 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-700/50" />
                    <div className="flex-1">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-700/30" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

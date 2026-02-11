export default function CalendarioLoading() {
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

      {/* Calendar skeleton */}
      <div className="flex-1 overflow-auto p-6 bg-slate-950">
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-800">
          {/* Header days */}
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-slate-900 p-3">
              <div className="h-4 w-12 animate-pulse rounded bg-slate-800 mx-auto" />
            </div>
          ))}
          {/* Calendar days */}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="bg-slate-900/50 min-h-[100px] p-2">
              <div className="h-5 w-5 animate-pulse rounded bg-slate-800/50 mb-2" />
              <div className="space-y-1">
                <div className="h-4 w-full animate-pulse rounded bg-slate-800/30" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

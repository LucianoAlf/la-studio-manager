export default function ConfiguracoesLoading() {
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
      <div className="flex-1 overflow-auto p-6 bg-slate-950">
        <div className="mx-auto max-w-3xl">
          {/* Tabs skeleton */}
          <div className="flex gap-2 mb-8 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-1 h-9 animate-pulse rounded-lg bg-slate-800/50" />
            ))}
          </div>

          {/* Form skeleton */}
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-800 mb-6" />
            
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-800/60" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-slate-800/50" />
              </div>
            ))}

            <div className="h-10 w-32 animate-pulse rounded-lg bg-slate-800 mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

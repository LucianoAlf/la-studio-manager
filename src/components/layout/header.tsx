"use client";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-800 px-8 bg-slate-950">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {title}
        </h1>
        {subtitle && (
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400">
            {subtitle}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {children}
      </div>
    </header>
  );
}

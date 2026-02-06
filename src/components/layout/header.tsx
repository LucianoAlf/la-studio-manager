"use client";

import { MagnifyingGlass, Bell } from "@phosphor-icons/react";

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
        {/* Search */}
        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4">
          <MagnifyingGlass size={16} className="text-slate-500" />
          <input
            placeholder="Buscar..."
            className="w-48 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
        </div>

        {/* Notifications */}
        <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400 transition-colors hover:text-white hover:border-accent-cyan">
          <Bell size={18} weight="duotone" />
        </button>

        {/* Actions from parent */}
        {children}
      </div>
    </header>
  );
}

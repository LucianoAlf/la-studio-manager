"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MusicNotes, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV } from "@/lib/constants";

export function AppSidebar() {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300 z-50",
        expanded ? "w-72" : "w-16"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 px-6 py-6",
          !expanded && "justify-center px-3"
        )}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-cyan to-accent-purple">
          <MusicNotes size={22} weight="duotone" className="text-slate-900" />
        </div>
        {expanded && (
          <div className="overflow-hidden">
            <div className="text-base font-bold tracking-tight text-white">
              LA Studio
            </div>
            <div className="text-[10px] font-medium tracking-widest text-slate-500 uppercase">
              Manager
            </div>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex flex-1 flex-col gap-1 px-4 py-4">
        {SIDEBAR_NAV.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const IconComponent = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                expanded
                  ? `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                  }`
                  : "w-full flex items-center justify-center py-3 rounded-xl transition-all",
                !expanded && (isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-slate-800/50')
              )}
            >
              <IconComponent
                size={20}
                weight="duotone"
                className={cn(
                  "flex-shrink-0 transition-colors",
                  isActive ? "text-cyan-400" : "text-gray-400"
                )}
              />
              {expanded && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex h-12 items-center justify-center border-t border-slate-800 text-slate-500 transition-colors hover:text-slate-300"
      >
        {expanded ? <CaretLeft size={16} /> : <CaretRight size={16} />}
      </button>
    </aside>
  );
}

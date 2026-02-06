"use client";

import { } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV } from "@/lib/constants";

export function AppSidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col border-r border-slate-800 bg-slate-900 transition-[width] duration-200 z-50",
        expanded ? "w-[250px]" : "w-16"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-5",
          !expanded && "justify-center px-3"
        )}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
          <Image src="/images/logos/logo-LA-colapsed.png" alt="LA Studio" width={40} height={40} className="object-contain" />
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
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
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
                  ? `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                  }`
                  : "w-full flex items-center justify-center py-2.5 rounded-xl transition-colors",
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
        onClick={onToggle}
        className="flex h-12 items-center justify-center border-t border-slate-800 text-slate-500 transition-colors hover:text-slate-300"
      >
        {expanded ? <CaretLeft size={16} /> : <CaretRight size={16} />}
      </button>
    </aside>
  );
}

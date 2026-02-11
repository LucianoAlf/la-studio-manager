"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretLeft, CaretRight, User, SignOut } from "@phosphor-icons/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV } from "@/lib/constants";
import { logout } from "@/lib/auth/logout";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/shadcn/dropdown-menu";

interface UserInfo {
  displayName: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
}

export function AppSidebar({ 
  expanded, 
  onToggle, 
  userInfo 
}: { 
  expanded: boolean; 
  onToggle: () => void;
  userInfo: UserInfo | null;
}) {
  const pathname = usePathname();

  // UserInfo agora vem via props do layout (que já carregou corretamente)
  // Removido o useEffect que buscava internamente - causava "Carregando..." infinito no Simple Browser

  const initials = userInfo
    ? userInfo.displayName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : "?";

  const roleLabel = userInfo?.role === "admin" ? "Admin" : "Usuário";

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
          const isActive = pathname.startsWith(item.href);
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

      {/* User Section + Collapse */}
      <div className="border-t border-slate-800">
        <div className={cn("flex items-center", expanded ? "px-3 py-3" : "flex-col py-3 gap-2")}>
          {/* Avatar + Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-3 rounded-xl transition-colors hover:bg-slate-800/50",
                  expanded ? "flex-1 min-w-0 px-2 py-2" : "justify-center w-10 h-10 mx-auto"
                )}
              >
                {/* Avatar */}
                {userInfo?.avatarUrl ? (
                  <Image
                    src={userInfo.avatarUrl}
                    alt={userInfo.displayName}
                    width={32}
                    height={32}
                    className="h-8 w-8 flex-shrink-0 rounded-full object-cover ring-2 ring-slate-700"
                  />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-xs font-bold text-white ring-2 ring-slate-700">
                    {initials}
                  </div>
                )}

                {/* Nome + Role */}
                {expanded && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {userInfo?.displayName || "Carregando..."}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {roleLabel}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent side="top" align={expanded ? "start" : "center"} className="w-56">
              <DropdownMenuLabel>
                {userInfo?.fullName || "Usuário"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/configuracoes">
                <DropdownMenuItem>
                  <User size={16} weight="duotone" />
                  Meu Perfil
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
              >
                <SignOut size={16} weight="duotone" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Collapse Toggle */}
          <button
            onClick={onToggle}
            className={cn(
              "flex items-center justify-center text-slate-500 transition-colors hover:text-slate-300",
              expanded ? "h-8 w-8 flex-shrink-0 rounded-lg hover:bg-slate-800/50" : "h-8 w-8 mx-auto"
            )}
          >
            {expanded ? <CaretLeft size={14} /> : <CaretRight size={14} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

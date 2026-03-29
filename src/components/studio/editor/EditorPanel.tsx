"use client";

import { useState } from "react";

interface Props {
  title: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function EditorPanel({ title, defaultOpen = false, action, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-slate-800/50"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">{title}</span>
        <div className="flex items-center gap-2">
          {action}
          <span className={`text-xs text-slate-500 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}>▾</span>
        </div>
      </button>
      {open ? <div className="border-t border-slate-800/50 px-3 pb-3 pt-2">{children}</div> : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { MusicNotes, Envelope, Lock } from "@phosphor-icons/react";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent-cyan text-sm font-bold text-slate-900 transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await loginAction(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-accent-cyan to-accent-purple shadow-lg shadow-accent-cyan/20">
            <MusicNotes size={28} weight="duotone" className="text-slate-900" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            LA Studio
          </h1>
          <p className="text-[10px] font-medium tracking-[0.3em] text-slate-500 uppercase">
            Manager
          </p>
        </div>

        {/* Form */}
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-400">
              Email
            </label>
            <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 focus-within:border-accent-cyan focus-within:ring-1 focus-within:ring-accent-cyan/50 transition-all">
              <Envelope size={18} className="text-slate-500" />
              <input
                type="email"
                name="email"
                placeholder="seu@email.com"
                required
                className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-400">
              Senha
            </label>
            <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 focus-within:border-accent-cyan focus-within:ring-1 focus-within:ring-accent-cyan/50 transition-all">
              <Lock size={18} className="text-slate-500" />
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-accent-pink/10 border border-accent-pink/30 px-4 py-3 text-sm text-accent-pink">
              {error}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="mt-8 text-center text-xs text-slate-600">
          LA Music School © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

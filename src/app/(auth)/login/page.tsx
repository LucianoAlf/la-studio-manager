"use client";

import { useState } from "react";
import { MusicNotes, Envelope, Lock } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email ou senha incorretos.");
      setLoading(false);
      return;
    }

    // Aguardar cookies serem salvos e redirecionar
    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  };

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
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-400">
              Email
            </label>
            <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 focus-within:border-accent-cyan focus-within:ring-1 focus-within:ring-accent-cyan/50 transition-all">
              <Envelope size={18} className="text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent-cyan text-sm font-bold text-slate-900 transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-600">
          LA Music School © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

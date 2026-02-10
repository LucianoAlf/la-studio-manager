"use client";

import { useState, useEffect } from "react";
import { Envelope, Lock, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

const AUTH_TOKEN_KEY = "la-studio-auth-token";
const AUTH_REFRESH_KEY = "la-studio-auth-refresh";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Verificar se já está logado
  useEffect(() => {
    async function check() {
      // Verificar localStorage primeiro (fallback para Simple Browser)
      if (localStorage.getItem(AUTH_TOKEN_KEY)) {
        window.location.replace("/");
        return;
      }
      // Verificar sessão Supabase (cookies)
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) window.location.replace("/");
    }
    check();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.session) {
        setError("Email ou senha incorretos.");
        setLoading(false);
        return;
      }

      // Salvar tokens no localStorage como fallback (Simple Browser não persiste cookies)
      localStorage.setItem(AUTH_TOKEN_KEY, data.session.access_token);
      localStorage.setItem(AUTH_REFRESH_KEY, data.session.refresh_token);

      window.location.replace("/");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Informe seu email para recuperar a senha.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (resetError) {
        setError("Erro ao enviar email de recuperação. Tente novamente.");
        setLoading(false);
        return;
      }

      setResetSent(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center">
            <Image
              src="/images/logos/logo-LA-colapsed.png"
              alt="LA Studio"
              width={64}
              height={64}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            LA Studio
          </h1>
          <p className="text-[10px] font-medium tracking-[0.3em] text-slate-500 uppercase">
            Manager
          </p>
        </div>

        {/* Reset Password Success */}
        {resetSent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle size={28} weight="duotone" className="text-emerald-400" />
            </div>
            <p className="text-sm text-slate-300">
              Enviamos um link de recuperação para <strong className="text-white">{email}</strong>
            </p>
            <p className="text-xs text-slate-500">
              Verifique sua caixa de entrada e spam.
            </p>
            <button
              onClick={() => { setResetMode(false); setResetSent(false); setError(null); }}
              className="text-sm text-accent-cyan hover:underline"
            >
              Voltar ao login
            </button>
          </div>
        ) : resetMode ? (
          /* Reset Password Form */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-sm text-slate-400 text-center mb-2">
              Informe seu email para receber o link de recuperação.
            </p>
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
                  autoFocus
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
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </button>

            <button
              type="button"
              onClick={() => { setResetMode(false); setError(null); }}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Voltar ao login
            </button>
          </form>
        ) : (
          /* Login Form */
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
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-400">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => { setResetMode(true); setError(null); }}
                  className="text-xs text-slate-500 hover:text-accent-cyan transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
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
              {loading ? "Entrando..." : (
                <>
                  Entrar
                  <ArrowRight size={16} weight="bold" />
                </>
              )}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-slate-600">
          LA Music School © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

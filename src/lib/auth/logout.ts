import { createClient } from "@/lib/supabase/client";

const AUTH_TOKEN_KEY = "la-studio-auth-token";
const AUTH_REFRESH_KEY = "la-studio-auth-refresh";

/**
 * Executa logout completo: limpa sessão Supabase + localStorage + redireciona.
 */
export async function logout() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[logout] Erro ao deslogar:", err);
  }

  // Limpar tokens do localStorage (fallback do Simple Browser)
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_KEY);

  // Redirecionar para login
  window.location.replace("/login");
}

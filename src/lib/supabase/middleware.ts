import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas públicas que não precisam de autenticação
const PUBLIC_ROUTES = ["/login", "/api/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh da sessão
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  
  // IMPORTANTE: Em desenvolvimento (Simple Browser), NÃO fazemos redirect aqui
  // A proteção de rotas é feita client-side no layout.tsx
  // Em produção, o middleware redireciona para /login se não autenticado
  const isVercel = request.headers.get('host')?.includes('vercel.app');
  const isProduction = process.env.NODE_ENV === "production" || isVercel;

  // Redirecionar para /login se não autenticado em rota protegida (apenas em produção/Vercel)
  if (isProduction && !user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirecionar para / se autenticado e tentando acessar /login
  if (isProduction && user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

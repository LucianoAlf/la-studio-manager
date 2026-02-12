import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Criar cliente admin com service_role
function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Normaliza telefone: remove +, espaços, traços, parênteses.
 * Adiciona 55 se necessário.
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s+\-()]/g, '');
  if (cleaned.length > 0 && cleaned.length <= 11 && !cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned || null;
}

/**
 * Sincroniza o registro em contacts (fonte única de verdade para telefones).
 * Se já existe um contact com user_profile_id, atualiza.
 * Se não existe, cria um novo com contact_type='user'.
 */
async function syncContact(
  admin: ReturnType<typeof getAdminClient>,
  profileId: string,
  fullName: string,
  phone: string | null,
  createdBy: string
) {
  const normalizedPhone = normalizePhone(phone);

  // Buscar contact existente para este perfil
  const { data: existing } = await admin
    .from("contacts")
    .select("id")
    .eq("user_profile_id", profileId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Atualizar contact existente
    const updates: Record<string, unknown> = {
      name: fullName,
      updated_at: new Date().toISOString(),
    };
    if (normalizedPhone) updates.phone = normalizedPhone;

    await admin.from("contacts").update(updates).eq("id", existing.id);
    console.log(`[manage-team] Contact atualizado: ${fullName} (${normalizedPhone})`);
  } else if (normalizedPhone) {
    // Criar novo contact
    await admin.from("contacts").insert({
      name: fullName,
      phone: normalizedPhone,
      contact_type: "user",
      user_profile_id: profileId,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    console.log(`[manage-team] Contact criado: ${fullName} (${normalizedPhone})`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Método não permitido", 405);
  }

  try {
    const body = await req.json();
    const { action } = body;

    const admin = getAdminClient();

    switch (action) {
      case "create": {
        const { email, password, full_name, display_name, phone, role } = body;

        if (!email || !password || !full_name) {
          return errorResponse("Email, senha e nome são obrigatórios.");
        }
        if (password.length < 6) {
          return errorResponse("Senha deve ter no mínimo 6 caracteres.");
        }
        const validRole = role === "admin" ? "admin" : "usuario";
        const isAdmin = validRole === "admin";

        // 1. Criar user no auth
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError) {
          if (authError.message.includes("already been registered")) {
            return errorResponse("Este email já está cadastrado.");
          }
          return errorResponse(`Erro ao criar usuário: ${authError.message}`);
        }

        const userId = authData.user.id;
        const normalizedPhone = normalizePhone(phone);

        // 2. Criar perfil
        const { data: profile, error: profileError } = await admin
          .from("user_profiles")
          .insert({
            user_id: userId,
            full_name,
            display_name: display_name || full_name.split(" ")[0],
            role: validRole,
            is_admin: isAdmin,
            is_active: true,
          })
          .select()
          .single();

        if (profileError) {
          // Rollback: deletar user do auth
          await admin.auth.admin.deleteUser(userId);
          return errorResponse(`Erro ao criar perfil: ${profileError.message}`);
        }

        // 3. Sincronizar contacts (fonte única de verdade)
        await syncContact(admin, profile.id, full_name, normalizedPhone, userId);

        return jsonResponse({
          success: true,
          message: `Membro ${full_name} criado com sucesso.`,
          profile,
        });
      }

      case "update": {
        const { profile_id, full_name, display_name, phone, role } = body;

        if (!profile_id) {
          return errorResponse("ID do perfil é obrigatório.");
        }

        const updates: Record<string, unknown> = {};
        if (full_name !== undefined) updates.full_name = full_name;
        if (display_name !== undefined) updates.display_name = display_name;
        // phone NÃO vai mais para user_profiles — vai para contacts via syncContact
        if (role !== undefined) {
          const validRole = role === "admin" ? "admin" : "usuario";
          updates.role = validRole;
          updates.is_admin = validRole === "admin";
        }
        updates.updated_at = new Date().toISOString();

        const { data: profile, error: updateError } = await admin
          .from("user_profiles")
          .update(updates)
          .eq("id", profile_id)
          .select()
          .single();

        if (updateError) {
          return errorResponse(`Erro ao atualizar: ${updateError.message}`);
        }

        // Sincronizar contacts (fonte única de verdade)
        const syncName = full_name || profile.full_name;
        const syncPhone = phone !== undefined ? normalizePhone(phone) : profile.phone;
        await syncContact(admin, profile_id, syncName, syncPhone, profile.user_id);

        return jsonResponse({
          success: true,
          message: "Perfil atualizado com sucesso.",
          profile,
        });
      }

      case "deactivate": {
        const { profile_id } = body;
        if (!profile_id) return errorResponse("ID do perfil é obrigatório.");

        // Buscar user_id do perfil
        const { data: prof } = await admin
          .from("user_profiles")
          .select("user_id")
          .eq("id", profile_id)
          .single();

        if (!prof) return errorResponse("Perfil não encontrado.", 404);

        // 1. Desativar perfil
        const { error: deactivateError } = await admin
          .from("user_profiles")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", profile_id);

        if (deactivateError) {
          return errorResponse(`Erro ao desativar: ${deactivateError.message}`);
        }

        // 2. Banir user no auth (bloqueia login imediato)
        const { error: banError } = await admin.auth.admin.updateUserById(
          prof.user_id,
          { ban_duration: "876600h" } // ~100 anos
        );

        if (banError) {
          console.error("Erro ao banir user:", banError.message);
        }

        // 3. Invalidar sessões ativas
        await admin.auth.admin.signOut(prof.user_id, "global");

        return jsonResponse({
          success: true,
          message: "Membro desativado e acesso bloqueado.",
        });
      }

      case "reactivate": {
        const { profile_id } = body;
        if (!profile_id) return errorResponse("ID do perfil é obrigatório.");

        const { data: prof } = await admin
          .from("user_profiles")
          .select("user_id")
          .eq("id", profile_id)
          .single();

        if (!prof) return errorResponse("Perfil não encontrado.", 404);

        // 1. Reativar perfil
        const { error: reactivateError } = await admin
          .from("user_profiles")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("id", profile_id);

        if (reactivateError) {
          return errorResponse(`Erro ao reativar: ${reactivateError.message}`);
        }

        // 2. Desbanir user no auth
        const { error: unbanError } = await admin.auth.admin.updateUserById(
          prof.user_id,
          { ban_duration: "none" }
        );

        if (unbanError) {
          console.error("Erro ao desbanir user:", unbanError.message);
        }

        return jsonResponse({
          success: true,
          message: "Membro reativado com sucesso.",
        });
      }

      case "reset-password": {
        const { profile_id, new_password } = body;
        if (!profile_id || !new_password) {
          return errorResponse("ID do perfil e nova senha são obrigatórios.");
        }
        if (new_password.length < 6) {
          return errorResponse("Senha deve ter no mínimo 6 caracteres.");
        }

        const { data: prof } = await admin
          .from("user_profiles")
          .select("user_id, full_name")
          .eq("id", profile_id)
          .single();

        if (!prof) return errorResponse("Perfil não encontrado.", 404);

        const { error: pwError } = await admin.auth.admin.updateUserById(
          prof.user_id,
          { password: new_password }
        );

        if (pwError) {
          return errorResponse(`Erro ao resetar senha: ${pwError.message}`);
        }

        return jsonResponse({
          success: true,
          message: `Senha de ${prof.full_name} resetada com sucesso.`,
        });
      }

      default:
        return errorResponse(`Ação desconhecida: ${action}`, 400);
    }
  } catch (err) {
    console.error("[manage-team] Erro:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Erro interno",
      500
    );
  }
});

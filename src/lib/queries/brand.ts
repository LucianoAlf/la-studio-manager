import { createClient } from "@/lib/supabase/client"
import type { BrandIdentity, BrandReferenceTemplate, BrandKey, ReferenceCategory } from "@/types/brand"

function getSupabase() {
  return createClient()
}

// ==========================================
// Brand Identity CRUD
// ==========================================

export async function getBrandIdentities(): Promise<BrandIdentity[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("brand_identity")
    .select("*")
    .order("brand_key")

  if (error) {
    console.error("[brand] getBrandIdentities error:", error)
    throw error
  }

  return (data as unknown as BrandIdentity[]) || []
}

export async function getBrandIdentity(brandKey: BrandKey): Promise<BrandIdentity | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("brand_identity")
    .select("*")
    .eq("brand_key", brandKey)
    .single()

  if (error) {
    console.error("[brand] getBrandIdentity error:", error)
    return null
  }

  return data as unknown as BrandIdentity
}

export async function updateBrandIdentity(
  brandKey: BrandKey,
  updates: Partial<BrandIdentity>
): Promise<BrandIdentity | null> {
  const supabase = getSupabase()

  // Remove campos que não devem ser atualizados
  const { id, brand_key, created_at, ...safeUpdates } = updates as BrandIdentity

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("brand_identity")
    .update({
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq("brand_key", brandKey)
    .select()
    .single()

  if (error) {
    console.error("[brand] updateBrandIdentity error:", error)
    throw error
  }

  return data as unknown as BrandIdentity
}

// ==========================================
// Logo Upload
// ==========================================

export async function uploadBrandLogo(
  brandKey: BrandKey,
  variant: string,
  file: File
): Promise<string> {
  const supabase = getSupabase()

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "png"
  const filePath = `${brandKey}/logos/${variant}.${fileExt}`

  // Deletar arquivo existente (se houver)
  await supabase.storage.from("brand-assets").remove([filePath])

  // Upload do novo arquivo
  const { error: uploadError } = await supabase.storage
    .from("brand-assets")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    })

  if (uploadError) {
    console.error("[brand] uploadBrandLogo error:", uploadError)
    throw uploadError
  }

  // Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from("brand-assets")
    .getPublicUrl(filePath)

  // Atualizar brand_identity com a nova URL
  const fieldName = `logo_${variant}_url` as keyof BrandIdentity
  await updateBrandIdentity(brandKey, { [fieldName]: publicUrl } as Partial<BrandIdentity>)

  return publicUrl
}

export async function deleteBrandLogo(
  brandKey: BrandKey,
  variant: string
): Promise<void> {
  const supabase = getSupabase()

  // Buscar URL atual para extrair o path
  const brand = await getBrandIdentity(brandKey)
  if (!brand) return

  const fieldName = `logo_${variant}_url` as keyof BrandIdentity
  const currentUrl = brand[fieldName] as string | null

  if (currentUrl) {
    // Extrair path do URL
    const urlParts = currentUrl.split("/brand-assets/")
    if (urlParts[1]) {
      await supabase.storage.from("brand-assets").remove([urlParts[1]])
    }
  }

  // Limpar o campo no banco
  await updateBrandIdentity(brandKey, { [fieldName]: null } as Partial<BrandIdentity>)
}

// ==========================================
// Reference Templates CRUD
// ==========================================

export async function getReferenceTemplates(
  brandKey: BrandKey,
  category?: ReferenceCategory
): Promise<BrandReferenceTemplate[]> {
  const supabase = getSupabase()

  let query = supabase
    .from("brand_reference_templates")
    .select("*")
    .eq("brand_key", brandKey)
    .order("sort_order")

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query

  if (error) {
    console.error("[brand] getReferenceTemplates error:", error)
    throw error
  }

  return (data as unknown as BrandReferenceTemplate[]) || []
}

export async function countReferenceTemplates(
  brandKey: BrandKey,
  category: ReferenceCategory
): Promise<number> {
  const supabase = getSupabase()

  const { count, error } = await supabase
    .from("brand_reference_templates")
    .select("*", { count: "exact", head: true })
    .eq("brand_key", brandKey)
    .eq("category", category)

  if (error) {
    console.error("[brand] countReferenceTemplates error:", error)
    return 0
  }

  return count || 0
}

export async function addReferenceTemplate(
  brandKey: BrandKey,
  category: ReferenceCategory,
  name: string,
  file: File
): Promise<BrandReferenceTemplate> {
  const supabase = getSupabase()

  // Verificar limite de 20 por categoria
  const count = await countReferenceTemplates(brandKey, category)
  if (count >= 20) {
    throw new Error(`Limite de 20 referências por categoria atingido.`)
  }

  // Gerar ID único para o arquivo
  const fileId = crypto.randomUUID()
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const filePath = `${brandKey}/references/${category}/${fileId}.${fileExt}`

  // Upload
  const { error: uploadError } = await supabase.storage
    .from("brand-assets")
    .upload(filePath, file, {
      cacheControl: "3600",
    })

  if (uploadError) {
    console.error("[brand] addReferenceTemplate upload error:", uploadError)
    throw uploadError
  }

  // Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from("brand-assets")
    .getPublicUrl(filePath)

  // Inserir no banco
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("brand_reference_templates")
    .insert({
      brand_key: brandKey,
      category,
      name: name || null,
      image_url: publicUrl,
      use_as_reference: true,
      sort_order: count,
    })
    .select()
    .single()

  if (error) {
    console.error("[brand] addReferenceTemplate insert error:", error)
    throw error
  }

  return data as unknown as BrandReferenceTemplate
}

export async function updateReferenceTemplate(
  id: string,
  updates: Partial<BrandReferenceTemplate>
): Promise<void> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("brand_reference_templates")
    .update(updates)
    .eq("id", id)

  if (error) {
    console.error("[brand] updateReferenceTemplate error:", error)
    throw error
  }
}

export async function deleteReferenceTemplate(id: string): Promise<void> {
  const supabase = getSupabase()

  // Buscar para obter o image_url
  const { data: rawTemplate } = await supabase
    .from("brand_reference_templates")
    .select("image_url")
    .eq("id", id)
    .single()

  const template = rawTemplate as { image_url: string } | null

  if (template?.image_url) {
    // Extrair path do URL e deletar do storage
    const urlParts = template.image_url.split("/brand-assets/")
    if (urlParts[1]) {
      await supabase.storage.from("brand-assets").remove([urlParts[1]])
    }
  }

  // Deletar do banco
  const { error } = await supabase
    .from("brand_reference_templates")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("[brand] deleteReferenceTemplate error:", error)
    throw error
  }
}

// ==========================================
// Nina Config (carousel AI model)
// ==========================================

interface NinaConfig {
  id: string
  carousel_ai_model: string | null
  carousel_system_prompt: string | null
  carousel_max_tokens: number | null
  carousel_temperature: number | null
  created_at: string
  updated_at: string
}

export async function getNinaConfig(): Promise<NinaConfig | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("nina_config")
    .select("*")
    .limit(1)
    .single()

  if (error) {
    console.error("[brand] getNinaConfig error:", error)
    return null
  }

  return data as unknown as NinaConfig
}

export async function updateNinaConfig(updates: Record<string, unknown>): Promise<void> {
  const supabase = getSupabase()

  const config = await getNinaConfig()
  if (!config?.id) {
    throw new Error("Nina config not found")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("nina_config")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", config.id)

  if (error) {
    console.error("[brand] updateNinaConfig error:", error)
    throw error
  }
}

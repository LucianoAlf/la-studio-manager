// ==========================================
// Brand Identity Types
// ==========================================

export type BrandKey = 'la_music_school' | 'la_music_kids' | 'sonoramente'

export interface BrandIdentity {
  id: string
  brand_key: BrandKey
  brand_name: string
  is_active: boolean
  logo_primary_url?: string | null
  logo_light_url?: string | null
  logo_dark_url?: string | null
  logo_icon_url?: string | null
  logo_horizontal_url?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_accent?: string | null
  color_bg_light?: string | null
  color_bg_dark?: string | null
  color_text_primary?: string | null
  color_text_secondary?: string | null
  color_text_light?: string | null
  color_gradient_start?: string | null
  color_gradient_end?: string | null
  font_display?: string | null
  font_body?: string | null
  font_accent?: string | null
  font_weight_title?: number | null
  font_weight_body?: number | null
  style_notes?: string | null
  canva_brand_kit_id?: string | null
  preview_url?: string | null
  preview_updated_at?: string | null
  created_at: string
  updated_at: string
}

export type ReferenceCategory = 'carousel' | 'feed' | 'stories' | 'birthday' | 'commemorative'

export interface BrandReferenceTemplate {
  id: string
  brand_key: string
  category: ReferenceCategory
  name?: string | null
  image_url: string
  use_as_reference: boolean
  sort_order: number
  created_at: string
}

export type LogoVariant = 'primary' | 'light' | 'dark' | 'icon' | 'horizontal'

export const LOGO_VARIANTS: { key: LogoVariant; label: string; description: string }[] = [
  { key: 'primary', label: 'Logo Principal', description: 'PNG transparente — uso geral' },
  { key: 'light', label: 'Versão Clara', description: 'Para fundos escuros' },
  { key: 'dark', label: 'Versão Escura', description: 'Para fundos claros' },
  { key: 'icon', label: 'Ícone/Avatar', description: 'Quadrado — para perfil' },
  { key: 'horizontal', label: 'Horizontal', description: 'Para rodapés de posts' },
]

export const REFERENCE_CATEGORIES: { value: ReferenceCategory; label: string }[] = [
  { value: 'carousel', label: 'Carrossel' },
  { value: 'feed', label: 'Feed' },
  { value: 'stories', label: 'Stories' },
  { value: 'birthday', label: 'Aniversário' },
  { value: 'commemorative', label: 'Data Comemorativa' },
]

export const GOOGLE_FONTS = [
  'Fredoka',
  'Nunito',
  'Poppins',
  'Montserrat',
  'Plus Jakarta Sans',
  'Open Sans',
  'Inter',
  'Lato',
  'Raleway',
  'Playfair Display',
  'Oswald',
  'Roboto',
] as const

export const FONT_WEIGHTS_TITLE = [400, 500, 600, 700, 800] as const
export const FONT_WEIGHTS_BODY = [400, 500, 600] as const

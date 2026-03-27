"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { Upload, Trash, SpinnerGap, Image as ImageIcon } from "@phosphor-icons/react"
import { uploadBrandLogo, deleteBrandLogo } from "@/lib/queries/brand"
import { LOGO_VARIANTS, type BrandIdentity, type LogoVariant } from "@/types/brand"
import { cn } from "@/lib/utils"

interface LogosSectionProps {
  brand: BrandIdentity
  onRefetch: () => Promise<void>
}

export function LogosSection({ brand, onRefetch }: LogosSectionProps) {
  const [uploading, setUploading] = useState<LogoVariant | null>(null)
  const [deleting, setDeleting] = useState<LogoVariant | null>(null)

  const getLogoUrl = (variant: LogoVariant): string | null => {
    const key = `logo_${variant}_url` as keyof BrandIdentity
    return brand[key] as string | null
  }

  const handleUpload = useCallback(async (variant: LogoVariant, file: File) => {
    // Validar tipo
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG, WebP ou SVG.")
      return
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.")
      return
    }

    setUploading(variant)
    try {
      await uploadBrandLogo(brand.brand_key, variant, file)
      toast.success("Logo enviada com sucesso!")
      await onRefetch()
    } catch (err) {
      console.error("Erro ao enviar logo:", err)
      toast.error("Erro ao enviar logo. Tente novamente.")
    } finally {
      setUploading(null)
    }
  }, [brand.brand_key, onRefetch])

  const handleDelete = useCallback(async (variant: LogoVariant) => {
    if (!confirm("Tem certeza que deseja remover esta logo?")) return

    setDeleting(variant)
    try {
      await deleteBrandLogo(brand.brand_key, variant)
      toast.success("Logo removida.")
      await onRefetch()
    } catch (err) {
      console.error("Erro ao remover logo:", err)
      toast.error("Erro ao remover logo.")
    } finally {
      setDeleting(null)
    }
  }, [brand.brand_key, onRefetch])

  const handleDrop = useCallback((variant: LogoVariant, e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleUpload(variant, file)
    }
  }, [handleUpload])

  const handleFileSelect = useCallback((variant: LogoVariant, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(variant, file)
    }
    // Reset input
    e.target.value = ""
  }, [handleUpload])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {LOGO_VARIANTS.map(({ key, label, description }) => {
        const logoUrl = getLogoUrl(key)
        const isUploading = uploading === key
        const isDeleting = deleting === key

        return (
          <div
            key={key}
            className="relative border border-slate-700 rounded-xl bg-slate-800/30 overflow-hidden"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-slate-700/50">
              <p className="text-sm font-medium text-slate-200">{label}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>

            {/* Área de upload/preview */}
            <div
              className={cn(
                "relative aspect-square flex items-center justify-center p-4",
                !logoUrl && "cursor-pointer hover:bg-slate-700/20 transition-colors"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(key, e)}
              onClick={() => {
                if (!logoUrl && !isUploading) {
                  document.getElementById(`logo-input-${key}`)?.click()
                }
              }}
            >
              {/* Loading overlay */}
              {(isUploading || isDeleting) && (
                <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
                  <SpinnerGap size={32} className="animate-spin text-cyan-400" />
                </div>
              )}

              {/* Preview ou placeholder */}
              {logoUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt={label}
                    className="max-w-full max-h-full object-contain"
                  />
                  {/* Botões de ação */}
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <label
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 cursor-pointer transition-colors"
                      title="Trocar imagem"
                    >
                      <Upload size={16} className="text-slate-300" />
                      <input
                        id={`logo-input-${key}`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => handleFileSelect(key, e)}
                      />
                    </label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(key)
                      }}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors"
                      title="Remover"
                    >
                      <Trash size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <ImageIcon size={40} weight="duotone" />
                  <p className="text-xs text-center">
                    Arraste uma imagem ou<br />clique para enviar
                  </p>
                  <input
                    id={`logo-input-${key}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => handleFileSelect(key, e)}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

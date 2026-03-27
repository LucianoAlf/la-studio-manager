"use client"

import { useCallback } from "react"
import type { BrandIdentity } from "@/types/brand"
import { cn } from "@/lib/utils"

interface ColorsSectionProps {
  brand: BrandIdentity
  updateField: <K extends keyof BrandIdentity>(field: K, value: BrandIdentity[K]) => void
}

interface ColorFieldConfig {
  key: keyof BrandIdentity
  label: string
  previewBg?: keyof BrandIdentity
}

const COLOR_FIELDS: ColorFieldConfig[] = [
  { key: "color_primary", label: "Cor Primária" },
  { key: "color_secondary", label: "Cor Secundária" },
  { key: "color_accent", label: "Cor de Destaque" },
  { key: "color_bg_light", label: "Fundo Claro" },
  { key: "color_bg_dark", label: "Fundo Escuro" },
  { key: "color_text_primary", label: "Texto Principal", previewBg: "color_bg_light" },
  { key: "color_text_secondary", label: "Texto Secundário", previewBg: "color_bg_light" },
  { key: "color_text_light", label: "Texto Claro", previewBg: "color_bg_dark" },
]

export function ColorsSection({ brand, updateField }: ColorsSectionProps) {
  const handleColorChange = useCallback((key: keyof BrandIdentity, value: string) => {
    updateField(key, value as BrandIdentity[typeof key])
  }, [updateField])

  const getColorValue = (key: keyof BrandIdentity): string => {
    return (brand[key] as string) || "#000000"
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {COLOR_FIELDS.map(({ key, label, previewBg }) => {
        const colorValue = getColorValue(key)
        const bgColorValue = previewBg ? getColorValue(previewBg) : undefined

        return (
          <div
            key={key}
            className="flex items-center gap-4 p-3 border border-slate-700 rounded-xl bg-slate-800/30"
          >
            {/* Color picker */}
            <div className="relative">
              <input
                type="color"
                value={colorValue}
                onChange={(e) => handleColorChange(key, e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-2 border-slate-600 bg-transparent"
                style={{ padding: 0 }}
              />
            </div>

            {/* Label e hex input */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {label}
              </label>
              <input
                type="text"
                value={colorValue}
                onChange={(e) => {
                  const val = e.target.value
                  // Aceitar hex com ou sem #
                  if (/^#?[0-9A-Fa-f]{0,6}$/.test(val.replace("#", ""))) {
                    const formatted = val.startsWith("#") ? val : `#${val}`
                    if (formatted.length <= 7) {
                      handleColorChange(key, formatted.toUpperCase())
                    }
                  }
                }}
                placeholder="#000000"
                className={cn(
                  "w-full px-3 py-1.5 text-sm rounded-lg",
                  "bg-slate-900/50 border border-slate-700",
                  "text-slate-200 placeholder-slate-500",
                  "focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                )}
              />
            </div>

            {/* Preview de contraste */}
            <div
              className="flex items-center justify-center w-20 h-12 rounded-lg text-xs font-medium border border-slate-700"
              style={{
                backgroundColor: bgColorValue || (key.includes("bg") ? colorValue : "#1e293b"),
                color: key.includes("text") ? colorValue : "#ffffff",
              }}
            >
              {key.includes("text") ? "Aa" : ""}
            </div>
          </div>
        )
      })}
    </div>
  )
}

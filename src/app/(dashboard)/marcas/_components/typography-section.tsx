"use client"

import { useCallback, useEffect } from "react"
import type { BrandIdentity } from "@/types/brand"
import { GOOGLE_FONTS, FONT_WEIGHTS_TITLE, FONT_WEIGHTS_BODY } from "@/types/brand"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select"

interface TypographySectionProps {
  brand: BrandIdentity
  updateField: <K extends keyof BrandIdentity>(field: K, value: BrandIdentity[K]) => void
}

const WEIGHT_LABELS: Record<number, string> = {
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra Bold",
}

export function TypographySection({ brand, updateField }: TypographySectionProps) {
  const fontDisplay = brand.font_display || "Inter"
  const fontBody = brand.font_body || "Inter"
  const fontAccent = brand.font_accent || ""
  const weightTitle = brand.font_weight_title || 700
  const weightBody = brand.font_weight_body || 400

  // Carregar Google Fonts dinamicamente
  useEffect(() => {
    const fonts = [fontDisplay, fontBody, fontAccent].filter(Boolean)
    const uniqueFonts = [...new Set(fonts)]

    if (uniqueFonts.length > 0) {
      const link = document.createElement("link")
      link.href = `https://fonts.googleapis.com/css2?${uniqueFonts
        .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700;800`)
        .join("&")}&display=swap`
      link.rel = "stylesheet"
      document.head.appendChild(link)

      return () => {
        document.head.removeChild(link)
      }
    }
  }, [fontDisplay, fontBody, fontAccent])

  const handleFontChange = useCallback((field: keyof BrandIdentity, value: string | number) => {
    updateField(field, value as BrandIdentity[typeof field])
  }, [updateField])

  return (
    <div className="space-y-6">
      {/* Seletores de fonte */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fonte Display */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Fonte Display (títulos)
          </label>
          <Select value={fontDisplay} onValueChange={(v) => handleFontChange("font_display", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma fonte" />
            </SelectTrigger>
            <SelectContent>
              {GOOGLE_FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  <span style={{ fontFamily: `"${font}", sans-serif` }}>{font}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fonte Corpo */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Fonte Corpo (texto corrido)
          </label>
          <Select value={fontBody} onValueChange={(v) => handleFontChange("font_body", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma fonte" />
            </SelectTrigger>
            <SelectContent>
              {GOOGLE_FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  <span style={{ fontFamily: `"${font}", sans-serif` }}>{font}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fonte Acento (opcional) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Fonte Acento (opcional)
          </label>
          <Select value={fontAccent || "none"} onValueChange={(v) => handleFontChange("font_accent", v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Nenhuma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {GOOGLE_FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  <span style={{ fontFamily: `"${font}", sans-serif` }}>{font}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pesos das fontes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Peso do Título
          </label>
          <Select value={String(weightTitle)} onValueChange={(v) => handleFontChange("font_weight_title", Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS_TITLE.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w} ({WEIGHT_LABELS[w]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Peso do Corpo
          </label>
          <Select value={String(weightBody)} onValueChange={(v) => handleFontChange("font_weight_body", Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS_BODY.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w} ({WEIGHT_LABELS[w]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview */}
      <div className="p-6 border border-slate-700 rounded-xl bg-slate-800/30">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Preview</p>
        <div className="space-y-3">
          <h2
            style={{
              fontFamily: `"${fontDisplay}", sans-serif`,
              fontWeight: weightTitle,
            }}
            className="text-2xl text-white"
          >
            {brand.brand_name} — A música transforma vidas
          </h2>
          <p
            style={{
              fontFamily: `"${fontBody}", sans-serif`,
              fontWeight: weightBody,
            }}
            className="text-slate-300 leading-relaxed"
          >
            Descubra o poder da educação musical de qualidade.
            Nossa metodologia única desenvolve talentos e desperta paixões.
          </p>
          {fontAccent && (
            <p
              style={{
                fontFamily: `"${fontAccent}", sans-serif`,
                fontWeight: 600,
              }}
              className="text-cyan-400 text-sm"
            >
              Matricule-se agora
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

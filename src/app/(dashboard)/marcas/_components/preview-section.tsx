"use client"

import { useState, useEffect } from "react"
import { ArrowsClockwise } from "@phosphor-icons/react"
import type { BrandIdentity } from "@/types/brand"

interface PreviewSectionProps {
  brand: BrandIdentity
}

export function PreviewSection({ brand }: PreviewSectionProps) {
  const [key, setKey] = useState(0)

  // Carregar fontes
  useEffect(() => {
    const fonts = [brand.font_display, brand.font_body].filter(Boolean)
    const uniqueFonts = [...new Set(fonts)]

    if (uniqueFonts.length > 0) {
      const link = document.createElement("link")
      link.href = `https://fonts.googleapis.com/css2?${uniqueFonts
        .map((f) => `family=${f?.replace(/ /g, "+")}:wght@400;500;600;700;800`)
        .join("&")}&display=swap`
      link.rel = "stylesheet"
      document.head.appendChild(link)

      return () => {
        document.head.removeChild(link)
      }
    }
  }, [brand.font_display, brand.font_body])

  const regenerate = () => {
    setKey((k) => k + 1)
  }

  // Valores com fallbacks
  const primaryColor = brand.color_primary || "#0D1B3E"
  const accentColor = brand.color_accent || "#FF6B2B"
  const textLight = brand.color_text_light || "#FFFFFF"
  const fontDisplay = brand.font_display || "Inter"
  const fontBody = brand.font_body || "Inter"
  const weightTitle = brand.font_weight_title || 700
  const weightBody = brand.font_weight_body || 400
  const logoUrl = brand.logo_primary_url || brand.logo_light_url

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Preview visual com as configurações atuais da marca
        </p>
        <button
          onClick={regenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <ArrowsClockwise size={14} />
          Regenerar
        </button>
      </div>

      {/* Preview mockup */}
      <div className="flex justify-center">
        <div
          key={key}
          className="relative w-[300px] rounded-2xl overflow-hidden shadow-2xl"
          style={{ aspectRatio: "1080/1350" }}
        >
          {/* Background */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: primaryColor }}
          />

          {/* Conteúdo */}
          <div className="relative h-full flex flex-col items-center justify-center p-6 text-center">
            {/* Logo */}
            {logoUrl && (
              <div className="mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={brand.brand_name}
                  className="h-16 w-auto object-contain"
                />
              </div>
            )}

            {/* Título */}
            <h2
              style={{
                fontFamily: `"${fontDisplay}", sans-serif`,
                fontWeight: weightTitle,
                color: textLight,
              }}
              className="text-2xl mb-3 leading-tight"
            >
              Exemplo de Post
            </h2>

            {/* Subtítulo */}
            <p
              style={{
                fontFamily: `"${fontBody}", sans-serif`,
                fontWeight: weightBody,
                color: textLight,
                opacity: 0.8,
              }}
              className="text-sm mb-6 max-w-[200px]"
            >
              A música transforma vidas através da educação e da arte.
            </p>

            {/* CTA com cor de destaque */}
            <div
              className="px-6 py-2 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: accentColor,
                color: textLight,
                fontFamily: `"${fontBody}", sans-serif`,
              }}
            >
              Saiba mais
            </div>

            {/* Rodapé com nome da marca */}
            <p
              className="absolute bottom-4 text-xs opacity-60"
              style={{
                color: textLight,
                fontFamily: `"${fontBody}", sans-serif`,
              }}
            >
              {brand.brand_name}
            </p>
          </div>

          {/* Paleta de cores no canto */}
          <div className="absolute bottom-4 right-4 flex gap-1">
            {[
              brand.color_primary,
              brand.color_secondary,
              brand.color_accent,
            ]
              .filter(Boolean)
              .map((color, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full border border-white/20"
                  style={{ backgroundColor: color || "#000" }}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-center text-xs text-slate-500">
        Este preview é apenas uma representação visual. O resultado final pode variar.
      </div>
    </div>
  )
}

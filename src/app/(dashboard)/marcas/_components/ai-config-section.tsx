"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Robot, SpinnerGap } from "@phosphor-icons/react"
import { getNinaConfig, updateNinaConfig } from "@/lib/queries/brand"
import type { BrandKey } from "@/types/brand"
import { cn } from "@/lib/utils"

interface AIConfigSectionProps {
  brandKey: BrandKey
}

const AI_MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Alta qualidade, melhor para HTML complexo" },
  { value: "gemini-flash", label: "Gemini Flash", description: "Rápido e econômico" },
] as const

export function AIConfigSection({ brandKey }: AIConfigSectionProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentModel, setCurrentModel] = useState<string>("claude-sonnet-4-6")

  // Não mostrar para Sonoramente
  if (brandKey === "sonoramente") {
    return null
  }

  // Carregar config atual
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const config = await getNinaConfig()
        if (config?.carousel_ai_model) {
          setCurrentModel(config.carousel_ai_model)
        }
      } catch (err) {
        console.error("Erro ao carregar config:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = useCallback(async (model: string) => {
    setCurrentModel(model)
    setSaving(true)
    try {
      await updateNinaConfig({ carousel_ai_model: model })
      toast.success("Modelo de IA atualizado")
    } catch (err) {
      toast.error("Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="p-4 border border-slate-800 rounded-xl bg-slate-900/50">
        <div className="flex items-center gap-3 text-slate-400">
          <SpinnerGap size={20} className="animate-spin" />
          <span className="text-sm">Carregando configuração...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border border-slate-800 rounded-xl bg-slate-900/50 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/20">
          <Robot size={20} weight="duotone" className="text-orange-400" />
        </div>
        <div>
          <h3 className="font-medium text-slate-200">Configuração de IA para Carrosséis</h3>
          <p className="text-xs text-slate-500">
            Modelo usado para gerar HTML dos carrosséis tipográficos
          </p>
        </div>
        {saving && (
          <SpinnerGap size={16} className="animate-spin text-cyan-400 ml-auto" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {AI_MODELS.map(({ value, label, description }) => (
          <button
            key={value}
            onClick={() => handleChange(value)}
            className={cn(
              "p-4 rounded-xl border text-left transition-all",
              currentModel === value
                ? "border-cyan-500/50 bg-cyan-500/10"
                : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className={cn(
                  "w-3 h-3 rounded-full border-2",
                  currentModel === value
                    ? "border-cyan-400 bg-cyan-400"
                    : "border-slate-500"
                )}
              />
              <span className={cn(
                "font-medium",
                currentModel === value ? "text-cyan-400" : "text-slate-300"
              )}>
                {label}
              </span>
            </div>
            <p className="text-xs text-slate-500 ml-5">{description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

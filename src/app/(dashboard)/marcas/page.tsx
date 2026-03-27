"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { useBrandIdentity } from "@/hooks/use-brand-identity"
import { SpinnerGap, FolderSimple, Palette, TextAa, Images, Eye } from "@phosphor-icons/react"
import { motion, LayoutGroup } from "framer-motion"
import { cn } from "@/lib/utils"

import { LogosSection } from "./_components/logos-section"
import { ColorsSection } from "./_components/colors-section"
import { TypographySection } from "./_components/typography-section"
import { ReferencesSection } from "./_components/references-section"
import { PreviewSection } from "./_components/preview-section"
import { AIConfigSection } from "./_components/ai-config-section"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import type { BrandKey } from "@/types/brand"

export default function MarcasPage() {
  const { brands, selectedBrand, loading, error, selectBrand, updateField, refetch } = useBrandIdentity()
  const [openSections, setOpenSections] = useState<string[]>(["logos"])

  // Loading state
  if (loading) {
    return (
      <>
        <Header title="Marcas" subtitle="Identidade Visual" />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex items-center gap-3 text-slate-400">
            <SpinnerGap size={24} className="animate-spin" />
            <span className="text-sm">Carregando marcas...</span>
          </div>
        </div>
      </>
    )
  }

  // Error state
  if (error) {
    return (
      <>
        <Header title="Marcas" subtitle="Identidade Visual" />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Marcas" subtitle="Identidade Visual" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
          {/* Tabs de Marcas */}
          <LayoutGroup>
            <nav className="relative flex p-1 rounded-xl bg-slate-900/60 border border-slate-800">
              {brands.map((brand) => {
                const isActive = selectedBrand?.brand_key === brand.brand_key
                const isDisabled = !brand.is_active

                return (
                  <button
                    key={brand.brand_key}
                    type="button"
                    onClick={() => !isDisabled && selectBrand(brand.brand_key)}
                    disabled={isDisabled}
                    className={cn(
                      "relative flex-1 px-4 py-2.5 text-sm font-medium z-10 transition-colors",
                      isDisabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {isActive && !isDisabled && (
                      <motion.div
                        layoutId="activeBrandTab"
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 -z-10"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className={cn(
                      isActive && !isDisabled ? "text-cyan-400" : "text-slate-400 hover:text-slate-200",
                      isDisabled && "text-slate-600"
                    )}>
                      {brand.brand_name}
                    </span>
                    {isDisabled && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
                        Em breve
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </LayoutGroup>

          {/* Conteúdo da marca selecionada */}
          {selectedBrand && selectedBrand.is_active && (
            <div className="space-y-4">
              {/* Accordions das seções */}
              <Accordion
                type="multiple"
                value={openSections}
                onValueChange={setOpenSections}
                className="space-y-3"
              >
                {/* 1. Logos */}
                <AccordionItem value="logos" className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <FolderSimple size={20} weight="duotone" className="text-cyan-400" />
                      <span className="font-medium text-slate-200">Logos</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <LogosSection brand={selectedBrand} onRefetch={refetch} />
                  </AccordionContent>
                </AccordionItem>

                {/* 2. Paleta de Cores */}
                <AccordionItem value="colors" className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <Palette size={20} weight="duotone" className="text-orange-400" />
                      <span className="font-medium text-slate-200">Paleta de Cores</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <ColorsSection brand={selectedBrand} updateField={updateField} />
                  </AccordionContent>
                </AccordionItem>

                {/* 3. Tipografia */}
                <AccordionItem value="typography" className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <TextAa size={20} weight="duotone" className="text-purple-400" />
                      <span className="font-medium text-slate-200">Tipografia</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <TypographySection brand={selectedBrand} updateField={updateField} />
                  </AccordionContent>
                </AccordionItem>

                {/* 4. Templates de Referência */}
                <AccordionItem value="references" className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <Images size={20} weight="duotone" className="text-emerald-400" />
                      <span className="font-medium text-slate-200">Templates de Referência</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <ReferencesSection brandKey={selectedBrand.brand_key} />
                  </AccordionContent>
                </AccordionItem>

                {/* 5. Preview ao Vivo */}
                <AccordionItem value="preview" className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <Eye size={20} weight="duotone" className="text-pink-400" />
                      <span className="font-medium text-slate-200">Preview ao Vivo</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <PreviewSection brand={selectedBrand} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Config de IA (fora do accordion) */}
              <AIConfigSection brandKey={selectedBrand.brand_key} />
            </div>
          )}

          {/* Sonoramente desabilitada */}
          {selectedBrand && !selectedBrand.is_active && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl mb-4">🎵</span>
              <h3 className="text-lg font-medium text-slate-300 mb-2">Sonoramente</h3>
              <p className="text-sm text-slate-500 max-w-md">
                A configuração da marca Sonoramente estará disponível em breve.
                No momento, o foco está em LA Music School e LA Music Kids.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

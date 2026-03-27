"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Plus, Trash, SpinnerGap, Eye, EyeSlash } from "@phosphor-icons/react"
import {
  getReferenceTemplates,
  addReferenceTemplate,
  updateReferenceTemplate,
  deleteReferenceTemplate,
} from "@/lib/queries/brand"
import {
  REFERENCE_CATEGORIES,
  type BrandKey,
  type BrandReferenceTemplate,
  type ReferenceCategory,
} from "@/types/brand"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select"

interface ReferencesSectionProps {
  brandKey: BrandKey
}

export function ReferencesSection({ brandKey }: ReferencesSectionProps) {
  const [templates, setTemplates] = useState<BrandReferenceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<ReferenceCategory | "all">("all")
  const [uploading, setUploading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Form state
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState<ReferenceCategory>("carousel")
  const [newFile, setNewFile] = useState<File | null>(null)

  // Carregar templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReferenceTemplates(brandKey)
      setTemplates(data)
    } catch (err) {
      console.error("Erro ao carregar templates:", err)
      toast.error("Erro ao carregar referências")
    } finally {
      setLoading(false)
    }
  }, [brandKey])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Filtrar por categoria
  const filteredTemplates = selectedCategory === "all"
    ? templates
    : templates.filter((t) => t.category === selectedCategory)

  // Adicionar template
  const handleAdd = async () => {
    if (!newFile) {
      toast.error("Selecione uma imagem")
      return
    }

    // Validar tipo
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"]
    if (!allowedTypes.includes(newFile.type)) {
      toast.error("Formato inválido. Use PNG, JPG ou WebP.")
      return
    }

    // Validar tamanho (5MB)
    if (newFile.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.")
      return
    }

    setUploading(true)
    try {
      await addReferenceTemplate(brandKey, newCategory, newName, newFile)
      toast.success("Referência adicionada!")
      setShowAddForm(false)
      setNewName("")
      setNewCategory("carousel")
      setNewFile(null)
      await fetchTemplates()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao adicionar"
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  // Toggle use_as_reference
  const handleToggleReference = async (template: BrandReferenceTemplate) => {
    try {
      await updateReferenceTemplate(template.id, {
        use_as_reference: !template.use_as_reference,
      })
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id ? { ...t, use_as_reference: !t.use_as_reference } : t
        )
      )
      toast.success(template.use_as_reference ? "Desativado" : "Ativado")
    } catch (err) {
      toast.error("Erro ao atualizar")
    }
  }

  // Deletar template
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta referência?")) return

    try {
      await deleteReferenceTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Referência removida")
    } catch (err) {
      toast.error("Erro ao remover")
    }
  }

  // Contagem por categoria
  const getCategoryCount = (cat: ReferenceCategory) =>
    templates.filter((t) => t.category === cat).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <SpinnerGap size={24} className="animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros + Botão adicionar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
            selectedCategory === "all"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          )}
        >
          Todos ({templates.length})
        </button>
        {REFERENCE_CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedCategory(value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              selectedCategory === value
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            )}
          >
            {label} ({getCategoryCount(value)})
          </button>
        ))}

        <button
          onClick={() => setShowAddForm(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
        >
          <Plus size={14} />
          Adicionar
        </button>
      </div>

      {/* Form de adicionar */}
      {showAddForm && (
        <div className="p-4 border border-slate-700 rounded-xl bg-slate-800/50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Nome (opcional)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Post viral março"
                className={cn(
                  "w-full px-3 py-2 text-sm rounded-lg",
                  "bg-slate-900/50 border border-slate-700",
                  "text-slate-200 placeholder-slate-500",
                  "focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Categoria</label>
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v as ReferenceCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERENCE_CATEGORIES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Imagem</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={uploading || !newFile}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                "bg-cyan-500 text-white hover:bg-cyan-600",
                (uploading || !newFile) && "opacity-50 cursor-not-allowed"
              )}
            >
              {uploading && <SpinnerGap size={16} className="animate-spin" />}
              Salvar
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewName("")
                setNewFile(null)
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Grid de templates */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          Nenhuma referência cadastrada
          {selectedCategory !== "all" && " nesta categoria"}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={cn(
                "relative group border rounded-xl overflow-hidden",
                template.use_as_reference
                  ? "border-cyan-500/30 bg-cyan-500/5"
                  : "border-slate-700 bg-slate-800/30"
              )}
            >
              {/* Imagem */}
              <div className="aspect-[4/5] relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={template.image_url}
                  alt={template.name || "Referência"}
                  className="w-full h-full object-cover"
                />

                {/* Overlay com ações */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleToggleReference(template)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      template.use_as_reference
                        ? "bg-cyan-500/30 text-cyan-400"
                        : "bg-slate-700 text-slate-300"
                    )}
                    title={template.use_as_reference ? "Desativar referência" : "Ativar referência"}
                  >
                    {template.use_as_reference ? <Eye size={20} /> : <EyeSlash size={20} />}
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 rounded-lg bg-red-500/30 text-red-400 hover:bg-red-500/50 transition-colors"
                    title="Remover"
                  >
                    <Trash size={20} />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-sm text-slate-200 truncate">{template.name || "Sem nome"}</p>
                <p className="text-xs text-slate-500">
                  {REFERENCE_CATEGORIES.find((c) => c.value === template.category)?.label}
                </p>
              </div>

              {/* Badge ativo */}
              {template.use_as_reference && (
                <div className="absolute top-2 right-2">
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/30 text-cyan-400 rounded">
                    Ativo
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

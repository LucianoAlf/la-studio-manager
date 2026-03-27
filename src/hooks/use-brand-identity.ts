"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import type { BrandIdentity, BrandKey } from "@/types/brand"
import { getBrandIdentities, getBrandIdentity, updateBrandIdentity } from "@/lib/queries/brand"

interface UseBrandIdentityReturn {
  brands: BrandIdentity[]
  selectedBrand: BrandIdentity | null
  loading: boolean
  error: string | null
  selectBrand: (brandKey: BrandKey) => void
  updateField: <K extends keyof BrandIdentity>(field: K, value: BrandIdentity[K]) => void
  refetch: () => Promise<void>
}

const DEBOUNCE_MS = 800

export function useBrandIdentity(): UseBrandIdentityReturn {
  const [brands, setBrands] = useState<BrandIdentity[]>([])
  const [selectedBrand, setSelectedBrand] = useState<BrandIdentity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Para debounce
  const pendingUpdates = useRef<Partial<BrandIdentity>>({})
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const isSaving = useRef(false)

  // Carregar todas as marcas
  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getBrandIdentities()
      setBrands(data)

      // Se já tinha uma marca selecionada, atualizar com dados frescos
      if (selectedBrand) {
        const updated = data.find(b => b.brand_key === selectedBrand.brand_key)
        if (updated) {
          setSelectedBrand(updated)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar marcas"
      setError(msg)
      console.error("[useBrandIdentity] fetchBrands error:", err)
    } finally {
      setLoading(false)
    }
  }, [selectedBrand])

  // Selecionar uma marca
  const selectBrand = useCallback((brandKey: BrandKey) => {
    const brand = brands.find(b => b.brand_key === brandKey)
    if (brand) {
      setSelectedBrand(brand)
    }
  }, [brands])

  // Flush: envia todas as atualizações pendentes
  const flushUpdates = useCallback(async () => {
    if (!selectedBrand || Object.keys(pendingUpdates.current).length === 0) return

    if (isSaving.current) return
    isSaving.current = true

    const updates = { ...pendingUpdates.current }
    pendingUpdates.current = {}

    try {
      await updateBrandIdentity(selectedBrand.brand_key, updates)
      toast.success("Salvo ✓", { duration: 1500 })

      // Atualizar estado local
      setSelectedBrand(prev => prev ? { ...prev, ...updates } : null)
      setBrands(prev =>
        prev.map(b =>
          b.brand_key === selectedBrand.brand_key ? { ...b, ...updates } : b
        )
      )
    } catch (err) {
      console.error("[useBrandIdentity] flushUpdates error:", err)
      toast.error("Erro ao salvar. Tente novamente.")
    } finally {
      isSaving.current = false
    }
  }, [selectedBrand])

  // Atualizar um campo (com debounce)
  const updateField = useCallback(<K extends keyof BrandIdentity>(
    field: K,
    value: BrandIdentity[K]
  ) => {
    if (!selectedBrand) return

    // Atualizar estado local imediatamente (optimistic)
    setSelectedBrand(prev => prev ? { ...prev, [field]: value } : null)
    setBrands(prev =>
      prev.map(b =>
        b.brand_key === selectedBrand.brand_key ? { ...b, [field]: value } : b
      )
    )

    // Acumular updates pendentes
    pendingUpdates.current = {
      ...pendingUpdates.current,
      [field]: value,
    }

    // Debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      flushUpdates()
    }, DEBOUNCE_MS)
  }, [selectedBrand, flushUpdates])

  // Carregar marcas ao montar
  useEffect(() => {
    fetchBrands()
  }, [])

  // Selecionar primeira marca ativa após carregar
  useEffect(() => {
    if (brands.length > 0 && !selectedBrand) {
      const firstActive = brands.find(b => b.is_active) || brands[0]
      setSelectedBrand(firstActive)
    }
  }, [brands, selectedBrand])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      // Flush pendentes ao desmontar
      if (Object.keys(pendingUpdates.current).length > 0) {
        flushUpdates()
      }
    }
  }, [flushUpdates])

  return {
    brands,
    selectedBrand,
    loading,
    error,
    selectBrand,
    updateField,
    refetch: fetchBrands,
  }
}

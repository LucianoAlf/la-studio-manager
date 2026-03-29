"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StudioBrand } from "@/lib/queries/studio";

interface ReferenceTemplate {
  id: string;
  image_url: string;
  name: string | null;
  category: string;
}

interface Props {
  brand: StudioBrand;
  category?: string; // story, single_image, carousel, etc.
  onSelect: (imageUrl: string) => void;
  selectedUrl?: string | null;
}

export function ReferenceTemplatePicker({ brand, category, onSelect, selectedUrl }: Props) {
  const [templates, setTemplates] = useState<ReferenceTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("brand_reference_templates" as never)
        .select("id, image_url, name, category")
        .eq("brand_key", brand === "la_music_kids" ? "la_music_kids" : "la_music_school")
        .eq("use_as_reference", true)
        .order("sort_order", { ascending: true })
        .limit(20);

      if (category) {
        query = query.eq("category", category);
      }

      const { data } = await query;
      setTemplates((data as unknown as ReferenceTemplate[]) || []);
      setLoading(false);
    };
    load();
  }, [brand, category]);

  if (loading) return <div className="text-xs text-slate-500 py-2">Carregando templates...</div>;
  if (templates.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-400 block">Referências visuais</label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.image_url)}
            className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
              selectedUrl === t.image_url
                ? "border-cyan-500 ring-1 ring-cyan-500"
                : "border-slate-700 hover:border-slate-500"
            }`}
          >
            <img
              src={t.image_url}
              alt={t.name || "Template"}
              className="h-16 w-12 object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

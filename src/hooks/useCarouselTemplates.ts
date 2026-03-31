import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CarouselTemplate {
  id: string;
  name: string;
  type: string;
  brand_key: string;
  description: string | null;
  html_template: string | null;
  style_config: Record<string, unknown> | null;
  preview_url: string | null;
}

export function useCarouselTemplates(brandKey: string) {
  const [templates, setTemplates] = useState<CarouselTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!brandKey) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("carousel_templates" as never)
      .select("id, name, type, brand_key, description, html_template, style_config, preview_url")
      .eq("is_active", true)
      .eq("brand_key", brandKey)
      .order("name")
      .then(({ data }) => {
        setTemplates((data ?? []) as unknown as CarouselTemplate[]);
        setLoading(false);
      });
  }, [brandKey]);

  return { templates, loading };
}

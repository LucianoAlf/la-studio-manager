import { createClient } from "@/lib/supabase/client";

function getSupabase() {
  return createClient();
}

export type StudioBrand = "la_music_school" | "la_music_kids";
export type StudioPlatform = "story" | "feed" | "reels" | "carousel";

export interface NinaConfig {
  id: string;
  is_enabled: boolean;
  default_post_time: string | null;
  default_brand: StudioBrand | null;
}

export interface StudioPost {
  id: string;
  title: string;
  caption: string | null;
  post_type: string;
  status: "draft" | "awaiting_approval" | "approved" | "scheduled" | "published" | "failed" | "rejected";
  brand: StudioBrand;
  scheduled_for: string | null;
  published_at: string | null;
  created_by_ai: boolean;
  platform_ids: Record<string, unknown> | null;
  created_at: string;
}

export interface PhotoAsset {
  id: string;
  person_name: string | null;
  brand: string | null;
  file_url: string;
  birth_date: string | null;
  source: string;
  metadata: Record<string, unknown> | null;
}

export interface BirthdayLogItem {
  id: string;
  student_id: string;
  student_name: string;
  brand: StudioBrand;
  approval_status: string;
  created_at: string;
  published_at: string | null;
}

export interface CommemorativeDateItem {
  id: string;
  name: string;
  date_month: number;
  date_day: number;
  brand: string;
  caption_hint: string | null;
}

export interface IntegrationCredentialItem {
  id: string;
  integration_name: string;
  is_active: boolean;
  last_validated_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface StudioMetricsSummary {
  alcance: number;
  engajamento: number;
  taxaEngajamento: number;
  publicados: number;
}

export async function getNinaConfig(): Promise<NinaConfig | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("nina_config" as never)
    .select("id, is_enabled, default_post_time, default_brand")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return data as unknown as NinaConfig;
}

export async function getPendingApprovalsCount(): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getStudioPostsByBrand(brand: StudioBrand): Promise<StudioPost[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts" as never)
    .select("id, title, caption, post_type, status, brand, scheduled_for, published_at, created_by_ai, platform_ids, created_at")
    .eq("brand", brand)
    .is("deleted_at", null)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as StudioPost[];
}

export async function getPhotoAssets(
  brand: StudioBrand,
  page: number,
  pageSize: number,
  onlyWithPhoto: boolean | null,
  search: string
): Promise<{ rows: PhotoAsset[]; total: number }> {
  const supabase = getSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("assets" as never)
    .select("id, person_name, brand, file_url, birth_date, source, metadata", { count: "exact" })
    .eq("source", "emusys")
    .or(`brand.eq.${brand},brand.eq.both`)
    .is("deleted_at", null)
    .order("person_name", { ascending: true });

  if (onlyWithPhoto === true) {
    query = query.not("file_url", "is", null);
  }

  if (onlyWithPhoto === false) {
    query = query.eq("metadata->>has_real_photo", "false");
  }

  if (search.trim()) {
    query = query.ilike("person_name", `%${search.trim()}%`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: (data ?? []) as unknown as PhotoAsset[],
    total: count ?? 0,
  };
}

export async function getBirthdaysOverview(brand: StudioBrand): Promise<{ upcoming: PhotoAsset[]; history: BirthdayLogItem[] }> {
  const supabase = getSupabase();

  const [assetsResp, historyResp] = await Promise.all([
    supabase
      .from("assets" as never)
      .select("id, person_name, brand, file_url, birth_date, source, metadata")
      .eq("source", "emusys")
      .or(`brand.eq.${brand},brand.eq.both`)
      .not("birth_date", "is", null)
      .is("deleted_at", null)
      .limit(2000),
    supabase
      .from("birthday_automation_log" as never)
      .select("id, student_id, student_name, brand, approval_status, created_at, published_at")
      .eq("brand", brand)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (assetsResp.error) {
    throw new Error(assetsResp.error.message);
  }

  if (historyResp.error) {
    throw new Error(historyResp.error.message);
  }

  const now = new Date();
  const todayY = now.getFullYear();
  const upcomingLimit = new Date(now);
  upcomingLimit.setDate(now.getDate() + 7);

  const upcoming = ((assetsResp.data ?? []) as unknown as PhotoAsset[])
    .filter((item) => {
      if (!item.birth_date) return false;
      const [year, month, day] = item.birth_date.split("-").map(Number);
      if (!month || !day) return false;
      const nextBirthday = new Date(todayY, month - 1, day);
      if (nextBirthday < now) {
        nextBirthday.setFullYear(todayY + 1);
      }
      return nextBirthday <= upcomingLimit;
    })
    .sort((a, b) => {
      const da = a.birth_date ?? "9999-12-31";
      const db = b.birth_date ?? "9999-12-31";
      return da.localeCompare(db);
    })
    .slice(0, 12);

  return {
    upcoming,
    history: (historyResp.data ?? []) as unknown as BirthdayLogItem[],
  };
}

export async function getCommemorativeDates(brand: StudioBrand): Promise<CommemorativeDateItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("commemorative_dates" as never)
    .select("id, name, date_month, date_day, brand, caption_hint")
    .eq("is_active", true)
    .or(`brand.eq.${brand},brand.eq.both`)
    .order("date_month", { ascending: true })
    .order("date_day", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as CommemorativeDateItem[];
}

export async function getIntegrations(): Promise<IntegrationCredentialItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("integration_credentials" as never)
    .select("id, integration_name, is_active, last_validated_at, metadata")
    .order("integration_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as IntegrationCredentialItem[];
}

export async function getPerformanceSummaryByBrand(brand: StudioBrand): Promise<StudioMetricsSummary> {
  const supabase = getSupabase();

  const { data: postsData, error: postsError } = await supabase
    .from("posts" as never)
    .select("id, total_views, total_likes, total_comments, total_shares")
    .eq("brand", brand)
    .eq("status", "published")
    .is("deleted_at", null)
    .limit(500);

  if (postsError) {
    throw new Error(postsError.message);
  }

  const rows = (postsData ?? []) as Array<{
    total_views?: number | null;
    total_likes?: number | null;
    total_comments?: number | null;
    total_shares?: number | null;
  }>;

  const alcance = rows.reduce((acc, row) => acc + (row.total_views ?? 0), 0);
  const engajamento = rows.reduce(
    (acc, row) => acc + (row.total_likes ?? 0) + (row.total_comments ?? 0) + (row.total_shares ?? 0),
    0
  );

  return {
    alcance,
    engajamento,
    taxaEngajamento: alcance > 0 ? (engajamento / alcance) * 100 : 0,
    publicados: rows.length,
  };
}

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
  event_name?: string | null;
  event_date?: string | null;
  unit?: string | null;
}

export type AssetFilterType = "alunos" | "eventos" | "todos";

export interface GroupedEvent {
  event_name: string;
  event_date: string | null;
  brand: string | null;
  photo_count: number;
  preview_photos: Array<{ id: string; file_url: string }>;
  storage_paths: string[];
  asset_ids: string[];
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
  category: string;
  brand: string;
  caption_hint: string | null;
  post_idea: string | null;
  description: string | null;
  hashtags: string[];
  assigned_to: string;
  auto_generate: boolean;
  post_type: string;
  days_advance: number;
  content_status: string;
  is_active: boolean;
  last_published_at: string | null;
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

export type StudioVideoStatus = "uploaded" | "transcribing" | "transcribed" | "analyzing" | "ready" | "failed";
export type StudioClipStatus = "pending" | "rendering" | "ready" | "approved" | "published" | "failed";

export interface StudioVideoItem {
  id: string;
  title: string | null;
  brand: StudioBrand | null;
  event_name: string | null;
  status: StudioVideoStatus;
  file_size: number | null;
  file_url: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface StudioClipItem {
  id: string;
  video_id: string;
  brand: StudioBrand | null;
  title: string | null;
  phrase: string | null;
  start_seconds: number | null;
  end_seconds: number | null;
  duration_seconds: number | null;
  status: StudioClipStatus;
  file_url: string | null;
  post_id: string | null;
  published_at: string | null;
}

export interface StudioVideoPollingItem {
  id: string;
  status: StudioVideoStatus;
  key_moments: unknown;
}

export interface StudioClipPollingItem {
  id: string;
  status: StudioClipStatus;
  file_url: string | null;
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
  search: string,
  filterType: AssetFilterType = "alunos"
): Promise<{ rows: PhotoAsset[]; total: number }> {
  const supabase = getSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("assets" as never)
    .select("id, person_name, brand, file_url, birth_date, source, metadata, event_name, event_date", { count: "exact" })
    .or(`brand.eq.${brand},brand.eq.both`)
    .is("deleted_at", null);

  // Filtro por tipo: alunos (emusys) ou eventos (upload com event_name)
  if (filterType === "alunos") {
    query = query.eq("source", "emusys");
    query = query.order("person_name", { ascending: true });
  } else if (filterType === "eventos") {
    query = query.not("event_name", "is", null);
    query = query.order("event_date", { ascending: false, nullsFirst: false });
  } else {
    // todos
    query = query.order("created_at", { ascending: false });
  }

  if (onlyWithPhoto === true) {
    query = query.not("file_url", "is", null);
  }

  if (onlyWithPhoto === false) {
    query = query.eq("metadata->>has_real_photo", "false");
  }

  if (search.trim()) {
    if (filterType === "eventos") {
      query = query.ilike("event_name", `%${search.trim()}%`);
    } else {
      query = query.ilike("person_name", `%${search.trim()}%`);
    }
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
      .select("id, person_name, brand, file_url, birth_date, source, metadata, unit")
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

  // Normaliza para início do dia para comparação correta de aniversários de hoje
  const todayStart = new Date(todayY, now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const upcomingLimit = new Date(todayStart);
  upcomingLimit.setDate(todayStart.getDate() + 7);

  const allAssets = (assetsResp.data ?? []) as unknown as PhotoAsset[];
  console.log(`[BIRTHDAYS] Total assets fetched: ${allAssets.length}`);

  const upcoming = allAssets
    .filter((item) => {
      if (!item.birth_date) return false;
      const [, month, day] = item.birth_date.split("-").map(Number);
      if (!month || !day) return false;
      const nextBirthday = new Date(todayY, month - 1, day, 0, 0, 0, 0);
      if (nextBirthday < todayStart) {
        nextBirthday.setFullYear(todayY + 1);
      }
      return nextBirthday <= upcomingLimit;
    })
    .sort((a, b) => {
      // Sort by month-day (birthday), not by year
      const [, am, ad] = (a.birth_date ?? "").split("-");
      const [, bm, bd] = (b.birth_date ?? "").split("-");
      return `${am}-${ad}`.localeCompare(`${bm}-${bd}`);
    })
    .slice(0, 20);

  console.log(`[BIRTHDAYS] Upcoming: ${upcoming.length}`, upcoming.map(u => `${u.person_name} (${u.birth_date})`));

  return {
    upcoming,
    history: (historyResp.data ?? []) as unknown as BirthdayLogItem[],
  };
}

export interface GenerateBirthdayResult {
  success: boolean;
  image_url?: string;
  student_name?: string;
  brand?: string;
  error?: string;
}

export async function generateBirthdayPost(
  assetId: string,
  brand: StudioBrand
): Promise<GenerateBirthdayResult> {
  const supabase = getSupabase();

  // Usa a função generate-birthday-post que aceita asset_id diretamente
  const { data, error } = await supabase.functions.invoke("generate-birthday-post", {
    body: {
      asset_id: assetId,
      brand: brand,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Extrair resultado
  const result = data as {
    success?: boolean;
    image_url?: string;
    student_name?: string;
    brand?: string;
    error?: string;
  };

  if (result.success && result.image_url) {
    return {
      success: true,
      image_url: result.image_url,
      student_name: result.student_name,
      brand: result.brand,
    };
  }

  return { success: false, error: result.error || "Erro ao gerar post de aniversário" };
}

export async function publishBirthdayStory(
  imageUrl: string,
  brand: StudioBrand,
  studentName: string
): Promise<{ success: boolean; error?: string; post_id?: string }> {
  // Calls server-side API route to avoid CORS issues with Meta Graph API
  const res = await fetch("/api/publish-story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, brand, studentName }),
  });

  const data = await res.json();
  return data;
}

export async function getCommemorativeDates(brand: StudioBrand): Promise<CommemorativeDateItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("commemorative_dates" as never)
    .select("id, name, date_month, date_day, category, brand, caption_hint, post_idea, description, hashtags, assigned_to, auto_generate, post_type, days_advance, content_status, is_active, last_published_at")
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

export async function addCommemorativeDate(data: Omit<CommemorativeDateItem, "id" | "last_published_at">): Promise<CommemorativeDateItem> {
  const supabase = getSupabase();
  const { data: result, error } = await supabase
    .from("commemorative_dates" as never)
    .insert({
      name: data.name,
      date_month: data.date_month,
      date_day: data.date_day,
      category: data.category || "music",
      brand: data.brand || "both",
      caption_hint: data.caption_hint,
      post_idea: data.post_idea,
      description: data.description,
      hashtags: data.hashtags || [],
      assigned_to: data.assigned_to || "nina",
      auto_generate: data.auto_generate || false,
      post_type: data.post_type || "story",
      days_advance: data.days_advance || 7,
      content_status: data.content_status || "pending",
      is_active: data.is_active !== false,
    } as never)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result as unknown as CommemorativeDateItem;
}

export async function updateCommemorativeDate(id: string, data: Partial<CommemorativeDateItem>): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("commemorative_dates" as never)
    .update({ ...data, updated_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteCommemorativeDate(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("commemorative_dates" as never)
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
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

export async function getStudioVideosByBrand(brand: StudioBrand): Promise<StudioVideoItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("studio_videos" as never)
    .select("id, title, brand, event_name, status, file_size, file_url, error_message, duration_seconds, created_at")
    .eq("brand", brand)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as StudioVideoItem[];
}

export async function getStudioClipsByVideoId(videoId: string): Promise<StudioClipItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("studio_clips" as never)
    .select("id, video_id, brand, title, phrase, start_seconds, end_seconds, duration_seconds, status, file_url, post_id, published_at")
    .eq("video_id", videoId)
    .order("start_seconds", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as StudioClipItem[];
}

export async function getStudioVideoPollingById(videoId: string): Promise<StudioVideoPollingItem | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("studio_videos" as never)
    .select("id, status, key_moments")
    .eq("id", videoId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return data as unknown as StudioVideoPollingItem;
}

export async function getStudioClipPollingById(clipId: string): Promise<StudioClipPollingItem | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("studio_clips" as never)
    .select("id, status, file_url")
    .eq("id", clipId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return data as unknown as StudioClipPollingItem;
}

export async function getGroupedEvents(
  brand: StudioBrand,
  page: number,
  pageSize: number,
  search: string
): Promise<{ events: GroupedEvent[]; total: number }> {
  const supabase = getSupabase();

  let query = supabase
    .from("assets" as never)
    .select("id, file_url, event_name, event_date, brand, storage_path")
    .not("event_name", "is", null)
    .or(`brand.eq.${brand},brand.eq.both`)
    .is("deleted_at", null)
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (search.trim()) {
    query = query.ilike("event_name", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Group by event_name
  const eventMap = new Map<string, GroupedEvent>();
  for (const asset of (data ?? []) as Array<{
    id: string;
    file_url: string;
    event_name: string;
    event_date: string | null;
    brand: string | null;
    storage_path: string | null;
  }>) {
    const key = asset.event_name;
    if (!eventMap.has(key)) {
      eventMap.set(key, {
        event_name: key,
        event_date: asset.event_date,
        brand: asset.brand,
        photo_count: 0,
        preview_photos: [],
        storage_paths: [],
        asset_ids: [],
      });
    }
    const group = eventMap.get(key)!;
    group.photo_count += 1;
    group.asset_ids.push(asset.id);
    if (asset.storage_path) group.storage_paths.push(asset.storage_path);
    if (group.preview_photos.length < 4) {
      group.preview_photos.push({ id: asset.id, file_url: asset.file_url });
    }
  }

  // Convert to array and sort by date
  const allEvents = Array.from(eventMap.values()).sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return b.event_date.localeCompare(a.event_date);
  });

  // Paginate
  const from = (page - 1) * pageSize;
  const events = allEvents.slice(from, from + pageSize);

  return { events, total: allEvents.length };
}

export async function getEventPhotos(
  eventName: string,
  brand: StudioBrand
): Promise<PhotoAsset[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("assets" as never)
    .select("id, person_name, brand, file_url, birth_date, source, metadata, event_name, event_date")
    .eq("event_name", eventName)
    .or(`brand.eq.${brand},brand.eq.both`)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  return (data ?? []) as unknown as PhotoAsset[];
}

export async function deleteEvent(
  assetIds: string[],
  storagePaths: string[]
): Promise<void> {
  const supabase = getSupabase();

  // Soft-delete all assets for this event
  const { error: dbError } = await supabase
    .from("assets" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .in("id", assetIds);

  if (dbError) throw new Error(dbError.message);

  // Delete from storage (fire-and-forget)
  if (storagePaths.length > 0) {
    await supabase.storage.from("posts").remove(storagePaths).catch(console.error);
  }
}

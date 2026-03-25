"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/layout/header";
import { Badge, Button, Card } from "@/components/ui";
import {
  CalendarDots,
  Sparkle,
  Images,
  Lightning,
  ChartBar,
  Link,
  Bell,
  CaretLeft,
  CaretRight,
  Clock,
  Upload,
  Warning,
  CheckCircle,
  X,
  Plus,
  SpinnerGap,
  Folder,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import {
  getBirthdaysOverview,
  getCommemorativeDates,
  getIntegrations,
  getNinaConfig,
  getPendingApprovalsCount,
  getPerformanceSummaryByBrand,
  getPhotoAssets,
  getStudioPostsByBrand,
  type AssetFilterType,
  type CommemorativeDateItem,
  type IntegrationCredentialItem,
  type NinaConfig,
  type PhotoAsset,
  type StudioBrand,
  type StudioPlatform,
  type StudioPost,
} from "@/lib/queries/studio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-time-picker";

type StudioTab = "calendario" | "criar" | "banco" | "automacoes" | "performance" | "conexoes";
type AutomationTab = "aniversarios" | "datas";

type PostStatus = StudioPost["status"];
type NinaGenerationResponse = {
  image_url?: string | null;
  caption?: string | null;
  hashtags?: string[] | string | null;
  generation_method?: string | null;
};

const TABS: { id: StudioTab; label: string; icon: Icon }[] = [
  { id: "calendario", label: "Calendário", icon: CalendarDots },
  { id: "criar", label: "Criar", icon: Sparkle },
  { id: "banco", label: "Banco de Fotos", icon: Images },
  { id: "automacoes", label: "Automações", icon: Lightning },
  { id: "performance", label: "Performance", icon: ChartBar },
  { id: "conexoes", label: "Conexões", icon: Link },
];

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: "#94A3B8",
  awaiting_approval: "#F97316",
  approved: "#38BDF8",
  scheduled: "#0EA5E9",
  published: "#22C55E",
  failed: "#EF4444",
  rejected: "#EF4444",
};

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Rascunho",
  awaiting_approval: "Aguardando",
  approved: "Aprovado",
  scheduled: "Agendado",
  published: "Publicado",
  failed: "Falhou",
  rejected: "Rejeitado",
};

const BRAND_OPTIONS: { value: StudioBrand; label: string }[] = [
  { value: "la_music_school", label: "LA Music School" },
  { value: "la_music_kids", label: "LA Music Kids" },
];

const PLATFORM_OPTIONS: { value: StudioPlatform; label: string }[] = [
  { value: "story", label: "Story" },
  { value: "feed", label: "Feed" },
  { value: "reels", label: "Reels" },
  { value: "carousel", label: "Carrossel" },
];

function toIsoDate(input: Date) {
  return `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, "0")}-${String(input.getDate()).padStart(2, "0")}`;
}

function getStatusBadgeColor(isActive: boolean, lastValidatedAt: string | null) {
  if (!isActive) return "#F97316";
  if (!lastValidatedAt) return "#EF4444";
  const days = (Date.now() - new Date(lastValidatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 30) return "#22C55E";
  if (days <= 60) return "#F97316";
  return "#EF4444";
}

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>("calendario");
  const [automationTab, setAutomationTab] = useState<AutomationTab>("aniversarios");
  const [brand, setBrand] = useState<StudioBrand>("la_music_school");
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const [ninaConfig, setNinaConfig] = useState<NinaConfig | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [birthdays, setBirthdays] = useState<PhotoAsset[]>([]);
  const [birthdayHistory, setBirthdayHistory] = useState<Array<{ id: string; student_name: string; approval_status: string; created_at: string }>>([]);
  const [commemorativeDates, setCommemorativeDates] = useState<CommemorativeDateItem[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationCredentialItem[]>([]);
  const [metrics, setMetrics] = useState({ alcance: 0, engajamento: 0, taxaEngajamento: 0, publicados: 0 });

  const [assets, setAssets] = useState<PhotoAsset[]>([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsPage, setAssetsPage] = useState(1);
  const [assetsSearch, setAssetsSearch] = useState("");
  const [assetsOnlyWithPhoto, setAssetsOnlyWithPhoto] = useState<"todos" | "com" | "sem">("todos");
  const [assetsFilterType, setAssetsFilterType] = useState<AssetFilterType>("alunos");

  // Modal de upload em lote (alunos)
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchMatches, setBatchMatches] = useState<Array<{ file: File; asset: PhotoAsset | null; confirmed: boolean }>>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // Modal de upload de evento
  const [showEventUploadModal, setShowEventUploadModal] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(toIsoDate(new Date()));
  const [eventBrand, setEventBrand] = useState<StudioBrand>("la_music_school");
  const [eventFiles, setEventFiles] = useState<File[]>([]);
  const [isEventUploading, setIsEventUploading] = useState(false);
  const [eventUploadProgress, setEventUploadProgress] = useState(0);
  const [eventDragOver, setEventDragOver] = useState(false);

  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [postPlatform, setPostPlatform] = useState<StudioPlatform>("story");
  const [postCaption, setPostCaption] = useState("");
  const [postBrief, setPostBrief] = useState("");
  const [postDate, setPostDate] = useState(toIsoDate(new Date()));
  const [postTime, setPostTime] = useState("14:00");
  const [creationMode, setCreationMode] = useState<"nina" | "manual">("nina");
  const [ninaPreviewUrl, setNinaPreviewUrl] = useState<string | null>(null);
  const [ninaHashtags, setNinaHashtags] = useState<string[]>([]);
  const [ninaGenerationMethod, setNinaGenerationMethod] = useState<string | null>(null);
  const [isGeneratingWithNina, setIsGeneratingWithNina] = useState(false);
  const [isPublishingNow, setIsPublishingNow] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAssetId, setUploadingAssetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAssetForUpload, setSelectedAssetForUpload] = useState<PhotoAsset | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (typeFilter !== "all" && post.post_type !== typeFilter) return false;
      if (platformFilter !== "all") {
        const ids = (post.platform_ids as unknown as Record<string, unknown>) || {};
        if (!Object.prototype.hasOwnProperty.call(ids, platformFilter)) return false;
      }
      return true;
    });
  }, [posts, statusFilter, typeFilter, platformFilter]);

  const publishTargetPost = useMemo(() => {
    return posts.find((post) => post.status !== "published") ?? null;
  }, [posts]);

  const monthLabel = useMemo(
    () => calendarDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [calendarDate]
  );

  const monthDays = useMemo(() => {
    const start = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const end = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
    const days: Date[] = [];

    const firstWeekday = start.getDay();
    for (let i = 0; i < firstWeekday; i += 1) {
      days.push(new Date(start.getFullYear(), start.getMonth(), i - firstWeekday + 1));
    }

    for (let day = 1; day <= end.getDate(); day += 1) {
      days.push(new Date(start.getFullYear(), start.getMonth(), day));
    }

    while (days.length % 7 !== 0) {
      const last = days[days.length - 1];
      days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
    }

    return days;
  }, [calendarDate]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, StudioPost[]>();
    for (const post of filteredPosts) {
      const raw = post.scheduled_for || post.published_at || post.created_at;
      if (!raw) continue;
      const key = new Date(raw).toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [filteredPosts]);

  const assetsPages = Math.max(1, Math.ceil(assetsTotal / 48));

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [ninaRes, approvalsRes, postsRes, birthdaysRes, commemorativeRes, integrationsRes, metricsRes] = await Promise.allSettled([
      getNinaConfig(),
      getPendingApprovalsCount(),
      getStudioPostsByBrand(brand),
      getBirthdaysOverview(brand),
      getCommemorativeDates(brand),
      getIntegrations(),
      getPerformanceSummaryByBrand(brand),
    ]);

    if (ninaRes.status === "fulfilled") setNinaConfig(ninaRes.value);
    if (approvalsRes.status === "fulfilled") setPendingApprovals(approvalsRes.value);
    if (postsRes.status === "fulfilled") setPosts(postsRes.value);
    if (birthdaysRes.status === "fulfilled") {
      setBirthdays(birthdaysRes.value.upcoming);
      setBirthdayHistory(birthdaysRes.value.history);
    }
    if (commemorativeRes.status === "fulfilled") setCommemorativeDates(commemorativeRes.value);
    if (integrationsRes.status === "fulfilled") setIntegrations(integrationsRes.value);
    if (metricsRes.status === "fulfilled") setMetrics(metricsRes.value);

    const fatalErrors = [postsRes, birthdaysRes, commemorativeRes].filter((r) => r.status === "rejected");
    if (fatalErrors.length > 0) {
      setError("Não foi possível carregar todos os dados do Studio.");
    }

    if (integrationsRes.status === "rejected") {
      toast.warning("Conexões: sem permissão para ler credenciais neste usuário.");
      setIntegrations([]);
    }

    setLoading(false);
  }, [brand]);

  const loadAssets = useCallback(async () => {
    const onlyWithPhoto = assetsOnlyWithPhoto === "todos" ? null : assetsOnlyWithPhoto === "com";
    try {
      const response = await getPhotoAssets(brand, assetsPage, 48, onlyWithPhoto, assetsSearch, assetsFilterType);
      setAssets(response.rows);
      setAssetsTotal(response.total);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar banco de fotos.");
    }
  }, [assetsOnlyWithPhoto, assetsPage, assetsSearch, brand, assetsFilterType]);

  // Comprime imagem se > 2MB usando canvas
  const compressImage = useCallback(async (file: File, maxSizeMB = 2): Promise<Blob> => {
    if (file.size <= maxSizeMB * 1024 * 1024) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Reduz proporcionalmente até ficar abaixo do limite
        const maxDimension = 1920;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Erro ao criar contexto do canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Erro ao comprimir imagem"));
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Upload de foto para um asset específico
  const handleUploadPhoto = useCallback(async (assetId: string, file: File) => {
    setUploadingAssetId(assetId);

    try {
      // Validação
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor, selecione uma imagem válida.");
        return;
      }

      // Comprime se necessário
      const blob = await compressImage(file);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `students/${assetId}.${ext}`;

      // Upload para Supabase Storage (bucket posts)
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(storagePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      // Pega URL pública
      const { data: urlData } = supabase.storage
        .from("posts")
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      // Atualiza o registro no banco
      const { error: updateError } = await supabase
        .from("assets")
        .update({
          file_url: publicUrl,
          storage_path: storagePath,
          metadata: { has_real_photo: true },
        } as never)
        .eq("id", assetId);

      if (updateError) throw new Error(updateError.message);

      // Atualiza estado local
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, file_url: publicUrl } : a
        )
      );

      toast.success("Foto atualizada com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao fazer upload");
    } finally {
      setUploadingAssetId(null);
      setSelectedAssetForUpload(null);
    }
  }, [compressImage, supabase]);

  // Handler para quando arquivo é selecionado
  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAssetForUpload) return;

    void handleUploadPhoto(selectedAssetForUpload.id, file);

    // Reset input para permitir selecionar mesmo arquivo novamente
    e.target.value = "";
  }, [handleUploadPhoto, selectedAssetForUpload]);

  // Abre seletor de arquivo para um asset
  const openFileSelector = useCallback((asset: PhotoAsset) => {
    setSelectedAssetForUpload(asset);
    fileInputRef.current?.click();
  }, []);

  // Fuzzy match: compara nome do arquivo com person_name dos assets
  const fuzzyMatchAsset = useCallback((fileName: string, allAssets: PhotoAsset[]): PhotoAsset | null => {
    // Remove extensão e normaliza
    const baseName = fileName.replace(/\.[^.]+$/, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    for (const asset of allAssets) {
      if (!asset.person_name) continue;
      const assetName = asset.person_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Match exato
      if (baseName === assetName) return asset;

      // Match parcial (primeiro nome ou primeiro + último)
      const baseTokens = baseName.split(/[\s_-]+/);
      const assetTokens = assetName.split(/\s+/);

      if (baseTokens[0] === assetTokens[0]) {
        // Primeiro nome igual
        if (baseTokens.length === 1 || assetTokens.length === 1) return asset;
        // Último nome também igual
        if (baseTokens[baseTokens.length - 1] === assetTokens[assetTokens.length - 1]) return asset;
      }
    }

    return null;
  }, []);

  // Carrega todos os assets para matching (sem paginação)
  const loadAllAssetsForMatching = useCallback(async (): Promise<PhotoAsset[]> => {
    const response = await getPhotoAssets(brand, 1, 2000, null, "", "alunos");
    return response.rows;
  }, [brand]);

  // Processar arquivos selecionados para upload em lote
  const handleBatchFilesSelected = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;

    setBatchFiles(fileArray);
    setShowBatchUploadModal(true);

    // Carregar todos assets para fazer matching
    const allAssets = await loadAllAssetsForMatching();

    const matches = fileArray.map(file => ({
      file,
      asset: fuzzyMatchAsset(file.name, allAssets),
      confirmed: false,
    }));

    setBatchMatches(matches);
  }, [fuzzyMatchAsset, loadAllAssetsForMatching]);

  // Confirmar upload em lote
  const handleBatchUploadConfirm = useCallback(async () => {
    const toUpload = batchMatches.filter(m => m.asset && m.confirmed);
    if (toUpload.length === 0) {
      toast.error("Nenhum arquivo confirmado para upload.");
      return;
    }

    setIsBatchUploading(true);
    setBatchProgress(0);

    let uploaded = 0;
    for (const match of toUpload) {
      if (!match.asset) continue;
      try {
        await handleUploadPhoto(match.asset.id, match.file);
        uploaded++;
        setBatchProgress(Math.round((uploaded / toUpload.length) * 100));
      } catch (err) {
        console.error(`Erro ao fazer upload de ${match.file.name}:`, err);
      }
    }

    setIsBatchUploading(false);
    setShowBatchUploadModal(false);
    setBatchFiles([]);
    setBatchMatches([]);
    toast.success(`${uploaded} foto(s) enviada(s) com sucesso!`);
    void loadAssets();
  }, [batchMatches, handleUploadPhoto, loadAssets]);

  // Gerar slug para evento
  const generateEventSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  // Processa drop de pasta ou arquivos no modal de evento
  const handleEventDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setEventDragOver(false);

    const files: File[] = [];
    let folderName: string | null = null;

    // Tenta usar webkitGetAsEntry para detectar pasta
    const items = e.dataTransfer.items;
    let usedWebkitApi = false;

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = item.webkitGetAsEntry?.();

        if (entry?.isDirectory) {
          usedWebkitApi = true;
          folderName = entry.name;

          // Ler arquivos da pasta
          const dirReader = (entry as FileSystemDirectoryEntry).createReader();
          const readAllEntries = (): Promise<FileSystemEntry[]> => {
            return new Promise((resolve) => {
              const allEntries: FileSystemEntry[] = [];
              const readBatch = () => {
                dirReader.readEntries((entries) => {
                  if (entries.length === 0) {
                    resolve(allEntries);
                  } else {
                    allEntries.push(...entries);
                    readBatch();
                  }
                });
              };
              readBatch();
            });
          };

          try {
            const entries = await readAllEntries();
            for (const fileEntry of entries) {
              if (fileEntry.isFile) {
                const file = await new Promise<File>((resolve, reject) => {
                  (fileEntry as FileSystemFileEntry).file(resolve, reject);
                });
                if (file.type.startsWith("image/")) {
                  files.push(file);
                }
              }
            }
          } catch (err) {
            console.error("Erro ao ler pasta:", err);
          }
        } else if (entry?.isFile) {
          usedWebkitApi = true;
          const file = item.getAsFile();
          if (file?.type.startsWith("image/")) {
            files.push(file);
          }
        }
      }
    }

    // Fallback: usar dataTransfer.files (não detecta nome de pasta)
    if (!usedWebkitApi && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      for (const file of droppedFiles) {
        if (file.type.startsWith("image/")) {
          files.push(file);
        }
      }
      // Tentar extrair nome da pasta do path (se disponível)
      const firstFile = droppedFiles[0];
      if (firstFile && "webkitRelativePath" in firstFile && firstFile.webkitRelativePath) {
        const pathParts = (firstFile.webkitRelativePath as string).split("/");
        if (pathParts.length > 1) {
          folderName = pathParts[0];
        }
      }
    }

    if (files.length > 0) {
      setEventFiles(files);
      if (folderName && !eventName.trim()) {
        setEventName(folderName);
      }
      toast.success(`${files.length} foto(s) carregada(s)`);
    } else {
      toast.error("Nenhuma imagem encontrada");
    }
  }, [eventName]);

  // Upload de evento
  const handleEventUpload = useCallback(async () => {
    if (!eventName.trim()) {
      toast.error("Digite o nome do evento.");
      return;
    }
    if (eventFiles.length === 0) {
      toast.error("Selecione pelo menos uma foto.");
      return;
    }

    setIsEventUploading(true);
    setEventUploadProgress(0);

    const slug = generateEventSlug(eventName);
    let uploaded = 0;

    for (const file of eventFiles) {
      try {
        const blob = await compressImage(file);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const timestamp = Date.now();
        const storagePath = `events/${slug}/${timestamp}-${uploaded}.${ext}`;

        // Upload para Storage
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(storagePath, blob, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (uploadError) throw new Error(uploadError.message);

        // Pega URL pública
        const { data: urlData } = supabase.storage
          .from("posts")
          .getPublicUrl(storagePath);

        // Insere registro em assets
        const { error: insertError } = await supabase
          .from("assets")
          .insert({
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: blob.size,
            mime_type: "image/jpeg",
            asset_type: "image",
            source: "upload",
            storage_path: storagePath,
            storage_provider: "supabase",
            event_name: eventName.trim(),
            event_date: eventDate,
            brand: eventBrand,
            is_approved: true,
          } as never);

        if (insertError) throw new Error(insertError.message);

        uploaded++;
        setEventUploadProgress(Math.round((uploaded / eventFiles.length) * 100));
      } catch (err) {
        console.error(`Erro ao fazer upload de ${file.name}:`, err);
      }
    }

    setIsEventUploading(false);
    setShowEventUploadModal(false);
    setEventName("");
    setEventFiles([]);
    toast.success(`${uploaded} foto(s) do evento enviada(s)!`);

    // Muda para aba de eventos e recarrega
    setAssetsFilterType("eventos");
    void loadAssets();
  }, [eventName, eventDate, eventBrand, eventFiles, compressImage, supabase, loadAssets]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleGenerateWithNina = async () => {
    setIsGeneratingWithNina(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<NinaGenerationResponse>("process-nina-request", {
        body: {
          mode: "brief",
          brand,
          brief: postBrief,
          post_type: postPlatform,
        },
      });

      if (fnError) {
        toast.error("Não foi possível gerar com a Nina agora.");
        return;
      }

      const hashtags = Array.isArray(data?.hashtags)
        ? data.hashtags.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : typeof data?.hashtags === "string"
          ? data.hashtags
              .split(/\s+/)
              .filter((item) => item.startsWith("#") && item.trim().length > 1)
          : [];

      setNinaPreviewUrl(data?.image_url ?? null);
      setNinaHashtags(hashtags);
      setNinaGenerationMethod(data?.generation_method ?? null);

      const generatedCaption = [data?.caption?.trim(), hashtags.join(" ")].filter(Boolean).join("\n\n");
      if (generatedCaption) {
        setPostCaption(generatedCaption);
      }

      toast.success("Prévia gerada com sucesso!");
    } catch {
      toast.error("Falha ao gerar conteúdo com a Nina.");
    } finally {
      setIsGeneratingWithNina(false);
    }
  };

  const handlePublishNow = async () => {
    if (!publishTargetPost) {
      toast.info("Nenhum post disponível para publicação imediata.");
      return;
    }

    setIsPublishingNow(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("publish-scheduled-posts", {
        body: { post_id: publishTargetPost.id },
      });

      if (fnError) {
        toast.error("Não foi possível publicar agora.");
        return;
      }

      toast.success("Publicação disparada com sucesso.");
      await loadBaseData();
    } catch {
      toast.error("Falha ao publicar agora.");
    } finally {
      setIsPublishingNow(false);
    }
  };

  const renderCalendarTab = () => (
    <div className="space-y-4">
      <Card variant="compact" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px] border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[170px] border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="image">Feed</SelectItem>
              <SelectItem value="reels">Reels</SelectItem>
              <SelectItem value="carousel">Carrossel</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
              <CaretLeft size={16} />
            </Button>
            <span className="min-w-[160px] text-center text-sm capitalize text-slate-200">{monthLabel}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
              <CaretRight size={16} />
            </Button>
            <Button variant="primary" size="sm" onClick={() => setActiveTab("criar")}>
              <Sparkle size={14} /> + Novo post
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-7 gap-2 text-xs text-slate-400">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div key={day} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-center font-semibold">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {monthDays.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayPosts = postsByDate.get(key) ?? [];
          const inCurrentMonth = day.getMonth() === calendarDate.getMonth();

          return (
            <div key={key} className={cn("min-h-[118px] rounded-xl border p-2", inCurrentMonth ? "border-slate-800 bg-slate-900/60" : "border-slate-900 bg-slate-950/50") }>
              <div className={cn("mb-2 text-xs", inCurrentMonth ? "text-slate-300" : "text-slate-600")}>{day.getDate()}</div>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <Badge key={post.id} variant="status" color={STATUS_COLORS[post.status]} className="w-full justify-start rounded-md px-2 py-1 text-[10px]">
                    {STATUS_LABELS[post.status]}
                  </Badge>
                ))}
                {dayPosts.length > 3 && <p className="text-[10px] text-slate-500">+{dayPosts.length - 3} posts</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCreateTab = () => (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1.5fr_1fr]">
      <Card variant="default" className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Configuração</h3>
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">Marca</label>
          <Select value={brand} onValueChange={(v) => setBrand(v as StudioBrand)}>
            <SelectTrigger className="border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BRAND_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-slate-400">Plataforma</label>
          <Select value={postPlatform} onValueChange={(v) => setPostPlatform(v as StudioPlatform)}>
            <SelectTrigger className="border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-400">Buscar aluno</label>
          <input className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100" placeholder="Nome do aluno..." />
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-400">Legenda</label>
          <textarea
            value={postCaption}
            onChange={(e) => setPostCaption(e.target.value)}
            className="min-h-[130px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            placeholder="Legenda editável do post..."
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DatePicker value={postDate} onChange={setPostDate} placeholder="Data" className="h-10 border-slate-700 bg-slate-900/70" />
          <input type="time" value={postTime} onChange={(e) => setPostTime(e.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100" />
        </div>
      </Card>

      <Card variant="default" className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant={creationMode === "nina" ? "primary" : "outline"} size="sm" onClick={() => setCreationMode("nina")}>🤖 Nina cria</Button>
          <Button variant={creationMode === "manual" ? "primary" : "outline"} size="sm" onClick={() => setCreationMode("manual")}>✏ Manual</Button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-400">Brief para Nina</label>
          <textarea
            value={postBrief}
            onChange={(e) => setPostBrief(e.target.value)}
            className="min-h-[150px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            placeholder="Descreva o estilo da arte e objetivo do post..."
          />
        </div>

        <Button
          variant="primary"
          size="md"
          disabled={isGeneratingWithNina || !postBrief.trim()}
          onClick={() => void handleGenerateWithNina()}
          className="w-full"
        >
          <Sparkle size={14} /> {isGeneratingWithNina ? "Gerando..." : "Gerar com Nina"}
        </Button>

        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
          {ninaPreviewUrl ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ninaPreviewUrl} alt="Prévia gerada pela Nina" className="max-h-[260px] w-full rounded-lg object-cover" />
              {ninaGenerationMethod ? <p className="text-[11px] text-slate-500">Método: {ninaGenerationMethod}</p> : null}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Preview da arte gerada aparecerá aqui.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" disabled>Regenerar</Button>
            <Button variant="outline" size="sm" disabled>Editar no Canva ↗</Button>
          </div>
        </div>

        {ninaHashtags.length > 0 ? <p className="text-xs text-slate-500">Hashtags: {ninaHashtags.join(" ")}</p> : null}
      </Card>

      <Card variant="default" className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Preview</h3>
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-b from-cyan-500/10 to-orange-500/10",
            postPlatform === "story" || postPlatform === "reels" ? "aspect-[9/16] w-[180px]" : "aspect-square w-[180px]"
          )}
        >
          {ninaPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ninaPreviewUrl} alt="Preview final do post" className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="space-y-2">
          <Button className="w-full" variant="outline" size="sm">Enviar para aprovação</Button>
          <Button className="w-full" variant="accent" size="sm" disabled={isPublishingNow || !publishTargetPost} onClick={() => void handlePublishNow()}>
            {isPublishingNow ? "Publicando..." : "Publicar agora"}
          </Button>
          <Button className="w-full" variant="primary" size="sm">Agendar ▾</Button>
        </div>

        <p className="text-[11px] text-slate-500">
          {publishTargetPost ? `Post alvo: ${publishTargetPost.title}` : "Sem post disponível para publicar agora."}
        </p>
      </Card>
    </div>
  );

  const renderPhotosTab = () => (
    <div className="space-y-4">
      {/* Input file hidden para upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
      />

      <Card variant="compact" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro: Alunos / Eventos */}
          <Select value={assetsFilterType} onValueChange={(v) => {
            setAssetsFilterType(v as AssetFilterType);
            setAssetsPage(1);
            setAssetsSearch("");
          }}>
            <SelectTrigger className="w-[130px] border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alunos">Alunos</SelectItem>
              <SelectItem value="eventos">Eventos</SelectItem>
            </SelectContent>
          </Select>

          <input
            value={assetsSearch}
            onChange={(e) => {
              setAssetsSearch(e.target.value);
              setAssetsPage(1);
            }}
            className="h-10 min-w-[180px] rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
            placeholder={assetsFilterType === "eventos" ? "Buscar evento..." : "Buscar por nome..."}
          />

          {assetsFilterType === "alunos" && (
            <Select value={assetsOnlyWithPhoto} onValueChange={(v) => {
              setAssetsOnlyWithPhoto(v as "todos" | "com" | "sem");
              setAssetsPage(1);
            }}>
              <SelectTrigger className="w-[130px] border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com">Com foto</SelectItem>
                <SelectItem value="sem">Sem foto</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto flex items-center gap-2">
            {assetsFilterType === "alunos" ? (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => e.target.files && handleBatchFilesSelected(e.target.files)}
                  className="hidden"
                />
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-transparent px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800">
                  <Upload size={14} /> Upload em lote
                </span>
              </label>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowEventUploadModal(true)}>
                <Plus size={14} /> Novo evento
              </Button>
            )}
          </div>
        </div>
      </Card>

      {assetsFilterType === "alunos" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {assets.map((asset) => {
            const hasPhoto = Boolean(asset.file_url);
            const isUploading = uploadingAssetId === asset.id;
            return (
              <Card key={asset.id} variant="compact" className="space-y-2 p-3">
                <div className="aspect-square overflow-hidden rounded-lg bg-slate-800">
                  {hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.file_url} alt={asset.person_name ?? "Aluno"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      <Images size={28} />
                    </div>
                  )}
                </div>
                <p className="line-clamp-1 text-xs font-semibold text-slate-200">{asset.person_name ?? "Sem nome"}</p>
                <Badge variant="neutral" size="sm">{asset.brand === "la_music_kids" ? "Kids" : "School"}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => openFileSelector(asset)}
                >
                  {isUploading ? "Enviando..." : "↑ Trocar"}
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Grid de eventos */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {assets.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 py-12">
              <Folder size={48} className="text-slate-600" />
              <p className="text-sm text-slate-400">Nenhum evento cadastrado</p>
              <Button variant="outline" size="sm" onClick={() => setShowEventUploadModal(true)}>
                <Plus size={14} /> Criar primeiro evento
              </Button>
            </div>
          ) : (
            assets.map((asset) => (
              <Card key={asset.id} variant="compact" className="space-y-2 p-3">
                <div className="aspect-video overflow-hidden rounded-lg bg-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.file_url} alt={asset.event_name ?? "Evento"} className="h-full w-full object-cover" />
                </div>
                <p className="line-clamp-1 text-xs font-semibold text-slate-200">{asset.event_name ?? "Sem nome"}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="neutral" size="sm">{asset.brand === "la_music_kids" ? "Kids" : "School"}</Badge>
                  {asset.event_date && (
                    <span className="text-[10px] text-slate-500">
                      {new Date(asset.event_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <p className="text-xs text-slate-400">Página {assetsPage} de {assetsPages} · {assetsTotal} registros</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon-sm" disabled={assetsPage <= 1} onClick={() => setAssetsPage((v) => Math.max(1, v - 1))}><CaretLeft size={16} /></Button>
          <Button variant="ghost" size="icon-sm" disabled={assetsPage >= assetsPages} onClick={() => setAssetsPage((v) => Math.min(assetsPages, v + 1))}><CaretRight size={16} /></Button>
        </div>
      </div>
    </div>
  );

  const renderAutomationsTab = () => (
    <div className="space-y-4">
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        <button className={cn("flex-1 rounded-lg px-3 py-2 text-sm", automationTab === "aniversarios" ? "bg-slate-800 text-slate-100" : "text-slate-400")} onClick={() => setAutomationTab("aniversarios")}>🎂 Aniversários</button>
        <button className={cn("flex-1 rounded-lg px-3 py-2 text-sm", automationTab === "datas" ? "bg-slate-800 text-slate-100" : "text-slate-400")} onClick={() => setAutomationTab("datas")}>📅 Datas Comemorativas</button>
      </div>

      {automationTab === "aniversarios" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card variant="default" className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">Próximos 7 dias</h3>
            {birthdays.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum aniversariante para este período.</p>
            ) : (
              birthdays.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <p className="text-sm text-slate-100">{item.person_name ?? "Aluno"}</p>
                  <p className="text-xs text-slate-400">{item.brand === "la_music_kids" ? "LA Music Kids" : "LA Music School"}</p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="accent" size="sm">Publicar agora</Button>
                    <Button variant="outline" size="sm">Pular</Button>
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card variant="default" className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">Histórico</h3>
            {birthdayHistory.length === 0 ? (
              <p className="text-sm text-slate-500">Sem histórico recente.</p>
            ) : (
              birthdayHistory.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <div>
                    <p className="text-sm text-slate-100">{row.student_name}</p>
                    <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <Badge variant="status" color={row.approval_status.includes("approved") ? "#22C55E" : "#F59E0B"}>{row.approval_status}</Badge>
                </div>
              ))
            )}
          </Card>
        </div>
      ) : (
        <Card variant="default" className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">Datas comemorativas</h3>
          {commemorativeDates.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma data configurada.</p>
          ) : (
            commemorativeDates.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div>
                  <p className="text-sm text-slate-100">{row.name}</p>
                  <p className="text-xs text-slate-500">{String(row.date_day).padStart(2, "0")}/{String(row.date_month).padStart(2, "0")} • {row.brand}</p>
                </div>
                <Button size="sm" variant="primary" onClick={() => setActiveTab("criar")}>Criar post</Button>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card variant="compact">
          <p className="text-xs text-slate-400">Alcance</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{metrics.alcance.toLocaleString("pt-BR")}</p>
        </Card>
        <Card variant="compact">
          <p className="text-xs text-slate-400">Engajamento</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{metrics.engajamento.toLocaleString("pt-BR")}</p>
        </Card>
        <Card variant="compact">
          <p className="text-xs text-slate-400">Taxa de engajamento</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{metrics.taxaEngajamento.toFixed(2)}%</p>
        </Card>
        <Card variant="compact">
          <p className="text-xs text-slate-400">Posts publicados</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{metrics.publicados}</p>
        </Card>
      </div>

      <Card variant="default" className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Posts recentes</h3>
        <div className="space-y-2">
          {posts.slice(0, 10).map((post) => (
            <div key={post.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div>
                <p className="text-sm text-slate-100">{post.title}</p>
                <p className="text-xs text-slate-500">{post.brand} • {post.post_type}</p>
              </div>
              <Badge variant="status" color={STATUS_COLORS[post.status]}>{STATUS_LABELS[post.status]}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderConnectionsTab = () => (
    <Card variant="default" className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">Conexões</h3>
      {integrations.length === 0 ? (
        <p className="text-sm text-slate-500">Sem acesso às integrações para este perfil.</p>
      ) : (
        integrations.map((item) => {
          const color = getStatusBadgeColor(item.is_active, item.last_validated_at);
          return (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div>
                <p className="text-sm text-slate-100">{item.integration_name}</p>
                <p className="text-xs text-slate-500">{item.last_validated_at ? `Validado em ${new Date(item.last_validated_at).toLocaleDateString("pt-BR")}` : "Sem validação recente"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="status" color={color}>{item.is_active ? "Ativo" : "Inativo"}</Badge>
                <Button variant="outline" size="sm">Reconectar</Button>
              </div>
            </div>
          );
        })
      )}
    </Card>
  );

  return (
    <>
      <Header title="Nina Studio" subtitle="Estúdio IA">
        <Select value={brand} onValueChange={(v) => setBrand(v as StudioBrand)}>
          <SelectTrigger className="w-[180px] border-slate-700 bg-slate-900/70 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRAND_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Badge variant="status" color={ninaConfig?.is_enabled ? "#22C55E" : "#64748B"}>
          <span className="inline-flex items-center gap-1">
            {ninaConfig?.is_enabled ? <CheckCircle size={12} /> : <Warning size={12} />} Nina {ninaConfig?.is_enabled ? "ativa" : "pausada"}
          </span>
        </Badge>

        <Button variant="primary" size="sm" onClick={() => setActiveTab("criar")}>
          <Sparkle size={14} /> Criar agora
        </Button>

        <Badge variant="status" color={pendingApprovals > 0 ? "#F59E0B" : "#22C55E"}>
          <Bell size={12} /> {pendingApprovals} aprovações pendentes
        </Badge>
      </Header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-1 md:grid-cols-6">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-gradient-to-r from-cyan-500/20 to-orange-500/20 text-cyan-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  )}
                >
                  <Icon size={15} /> {tab.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <Card variant="default" className="flex items-center gap-3">
              <Clock size={16} className="animate-pulse text-cyan-400" />
              <p className="text-sm text-slate-300">Carregando dados do Studio...</p>
            </Card>
          ) : error ? (
            <Card variant="default" className="flex items-center gap-3 border-orange-500/30">
              <Warning size={16} className="text-orange-400" />
              <p className="text-sm text-orange-200">{error}</p>
            </Card>
          ) : null}

          {activeTab === "calendario" && renderCalendarTab()}
          {activeTab === "criar" && renderCreateTab()}
          {activeTab === "banco" && renderPhotosTab()}
          {activeTab === "automacoes" && renderAutomationsTab()}
          {activeTab === "performance" && renderPerformanceTab()}
          {activeTab === "conexoes" && renderConnectionsTab()}
        </div>
      </div>

      {/* Modal: Upload em lote de alunos */}
      {showBatchUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <h3 className="text-base font-semibold text-slate-100">Upload em lote - Alunos</h3>
              <button onClick={() => { setShowBatchUploadModal(false); setBatchFiles([]); setBatchMatches([]); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {batchMatches.length === 0 ? (
                <p className="text-sm text-slate-400">Processando arquivos...</p>
              ) : (
                <div className="space-y-2">
                  <p className="mb-3 text-xs text-slate-500">{batchMatches.length} arquivo(s) · Clique em "Confirmar" nos que deseja enviar</p>
                  {batchMatches.map((match, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="h-12 w-12 overflow-hidden rounded bg-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(match.file)} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-200">{match.file.name}</p>
                        {match.asset ? (
                          <p className="text-xs text-cyan-400">→ {match.asset.person_name}</p>
                        ) : (
                          <p className="text-xs text-orange-400">Nenhum aluno encontrado</p>
                        )}
                      </div>
                      {match.asset && (
                        <Button
                          variant={match.confirmed ? "accent" : "outline"}
                          size="sm"
                          onClick={() => setBatchMatches(prev => prev.map((m, i) => i === idx ? { ...m, confirmed: !m.confirmed } : m))}
                        >
                          {match.confirmed ? <CheckCircle size={14} /> : null} {match.confirmed ? "Confirmado" : "Confirmar"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
              {isBatchUploading ? (
                <div className="flex items-center gap-2">
                  <SpinnerGap size={16} className="animate-spin text-cyan-400" />
                  <span className="text-sm text-slate-300">{batchProgress}%</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500">{batchMatches.filter(m => m.confirmed).length} confirmado(s)</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={isBatchUploading} onClick={() => { setShowBatchUploadModal(false); setBatchFiles([]); setBatchMatches([]); }}>
                  Cancelar
                </Button>
                <Button variant="accent" size="sm" disabled={isBatchUploading || batchMatches.filter(m => m.confirmed).length === 0} onClick={() => void handleBatchUploadConfirm()}>
                  {isBatchUploading ? "Enviando..." : "Enviar confirmados"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Upload de evento */}
      {showEventUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <h3 className="text-base font-semibold text-slate-100">Novo evento</h3>
              <button onClick={() => { setShowEventUploadModal(false); setEventName(""); setEventFiles([]); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Nome do evento</label>
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ex: LA All Stars Rock in Rio"
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Data</label>
                  <DatePicker
                    value={eventDate}
                    onChange={setEventDate}
                    placeholder="Selecione a data"
                    className="h-10 border-slate-700 bg-slate-900/70"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Marca</label>
                  <Select value={eventBrand} onValueChange={(v) => setEventBrand(v as StudioBrand)}>
                    <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="la_music_school">LA Music School</SelectItem>
                      <SelectItem value="la_music_kids">LA Music Kids</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Fotos do evento</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setEventDragOver(true); }}
                  onDragLeave={() => setEventDragOver(false)}
                  onDrop={(e) => void handleEventDrop(e)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors",
                    eventDragOver
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-slate-700 bg-slate-900/40 hover:border-cyan-500/50 hover:bg-slate-900/60"
                  )}
                >
                  <Upload size={32} className={eventDragOver ? "text-cyan-400" : "text-slate-500"} />
                  <span className="text-sm text-slate-400">
                    {eventDragOver ? "Solte aqui!" : "Arraste uma pasta ou clique para selecionar"}
                  </span>
                  <span className="text-xs text-slate-600">O nome da pasta vira o nome do evento</span>
                  <label className="mt-2 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                    Selecionar arquivos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => e.target.files && setEventFiles(Array.from(e.target.files))}
                      className="hidden"
                    />
                  </label>
                </div>
                {eventFiles.length > 0 && (
                  <p className="mt-2 text-xs text-cyan-400">{eventFiles.length} foto(s) selecionada(s)</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
              {isEventUploading ? (
                <div className="flex items-center gap-2">
                  <SpinnerGap size={16} className="animate-spin text-cyan-400" />
                  <span className="text-sm text-slate-300">{eventUploadProgress}%</span>
                </div>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={isEventUploading} onClick={() => { setShowEventUploadModal(false); setEventName(""); setEventFiles([]); }}>
                  Cancelar
                </Button>
                <Button variant="accent" size="sm" disabled={isEventUploading || !eventName.trim() || eventFiles.length === 0} onClick={() => void handleEventUpload()}>
                  {isEventUploading ? "Enviando..." : "Criar evento"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

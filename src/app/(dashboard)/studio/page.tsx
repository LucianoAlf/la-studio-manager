"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type StudioTab = "calendario" | "criar" | "banco" | "automacoes" | "performance" | "conexoes";
type AutomationTab = "aniversarios" | "datas";

type PostStatus = StudioPost["status"];

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

  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [postPlatform, setPostPlatform] = useState<StudioPlatform>("story");
  const [postCaption, setPostCaption] = useState("");
  const [postBrief, setPostBrief] = useState("");
  const [postDate, setPostDate] = useState(toIsoDate(new Date()));
  const [postTime, setPostTime] = useState("14:00");
  const [creationMode, setCreationMode] = useState<"nina" | "manual">("nina");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const response = await getPhotoAssets(brand, assetsPage, 48, onlyWithPhoto, assetsSearch);
      setAssets(response.rows);
      setAssetsTotal(response.total);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar banco de fotos.");
    }
  }, [assetsOnlyWithPhoto, assetsPage, assetsSearch, brand]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleGenerateWithNina = async () => {
    try {
      const { error: fnError } = await supabase.functions.invoke("process-nina-request", {
        body: {
          mode: "brief",
          brand,
          brief: postBrief,
          post_type: postPlatform,
        },
      });

      if (fnError) {
        toast.info("✨ Geração da Nina em breve. Backend ainda não disponível.");
        return;
      }

      toast.success("Prévia gerada com sucesso!");
    } catch {
      toast.info("✨ Geração da Nina em breve. Backend ainda não disponível.");
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
          <input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100" />
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

        <Button variant="primary" size="md" disabled onClick={() => void handleGenerateWithNina()} className="w-full">
          <Sparkle size={14} /> Gerar com Nina (em breve)
        </Button>

        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-400">Preview da arte gerada aparecerá aqui.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" disabled>Regenerar</Button>
            <Button variant="outline" size="sm" disabled>Editar no Canva ↗</Button>
          </div>
        </div>
      </Card>

      <Card variant="default" className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Preview</h3>
        <div className={cn("mx-auto rounded-xl border border-slate-700 bg-gradient-to-b from-cyan-500/10 to-orange-500/10", postPlatform === "story" || postPlatform === "reels" ? "aspect-[9/16] w-[180px]" : "aspect-square w-[180px]") } />

        <div className="space-y-2">
          <Button className="w-full" variant="outline" size="sm">Enviar para aprovação</Button>
          <Button className="w-full" variant="accent" size="sm">Publicar agora</Button>
          <Button className="w-full" variant="primary" size="sm">Agendar ▾</Button>
        </div>
      </Card>
    </div>
  );

  const renderPhotosTab = () => (
    <div className="space-y-4">
      <Card variant="compact" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={assetsSearch}
            onChange={(e) => {
              setAssetsSearch(e.target.value);
              setAssetsPage(1);
            }}
            className="h-10 min-w-[220px] rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
            placeholder="Buscar por nome..."
          />

          <Select value={assetsOnlyWithPhoto} onValueChange={(v) => {
            setAssetsOnlyWithPhoto(v as "todos" | "com" | "sem");
            setAssetsPage(1);
          }}>
            <SelectTrigger className="w-[170px] border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="com">Com foto</SelectItem>
              <SelectItem value="sem">Sem foto</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm"><Upload size={14} /> Upload em lote</Button>
            <Button variant="outline" size="sm"><Upload size={14} /> Upload individual</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {assets.map((asset) => {
          const hasPhoto = Boolean(asset.file_url);
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
              <Button variant="outline" size="sm" className="w-full">↑ Trocar</Button>
            </Card>
          );
        })}
      </div>

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
    </>
  );
}

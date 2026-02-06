import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import {
  Briefcase,
  Play,
  CheckCircle,
  Clock,
  TrendUp,
  TrendDown,
  CalendarBlank,
  FolderOpen,
  Plus,
  User
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

// Cores das colunas do Kanban
const COLUMN_COLORS: Record<string, string> = {
  brainstorming: "#8B5CF6",
  planning: "#3B82F6",
  todo: "#3B9CC2",
  capturing: "#F59E0B",
  editing: "#F97316",
  awaiting_approval: "#22C55E",
  approved: "#38BDF8",
  published: "#64748B",
  archived: "#6B7280",
};

// Cores dos tipos de calendar items
const CALENDAR_TYPE_COLORS: Record<string, string> = {
  event: "#F97316",
  delivery: "#EF4444",
  creation: "#1AA8BF",
  task: "#22C55E",
  meeting: "#A78BFA",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // ===== STAT CARDS DATA =====
  // Projetos Ativos (todos os cards não deletados)
  const { count: totalProjects } = await supabase
    .from("kanban_cards")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  // Em Produção (capturing ou editing)
  const { count: inProduction } = await supabase
    .from("kanban_cards")
    .select("*, kanban_columns!inner(slug)", { count: "exact", head: true })
    .is("deleted_at", null)
    .in("kanban_columns.slug", ["capturing", "editing"]);

  // Publicados
  const { count: published } = await supabase
    .from("kanban_cards")
    .select("*, kanban_columns!inner(slug)", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("kanban_columns.slug", "published");

  // Aguardando Aprovação
  const { count: awaitingApproval } = await supabase
    .from("kanban_cards")
    .select("*, kanban_columns!inner(slug)", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("kanban_columns.slug", "awaiting_approval");

  // ===== PIPELINE DATA =====
  const { data: columns } = await supabase
    .from("kanban_columns")
    .select("id, slug, name, position")
    .order("position", { ascending: true });

  // Contar cards por coluna
  const { data: cardCounts } = await supabase
    .from("kanban_cards")
    .select("column_id")
    .is("deleted_at", null);

  const countByColumn: Record<string, number> = {};
  cardCounts?.forEach((card) => {
    countByColumn[card.column_id] = (countByColumn[card.column_id] || 0) + 1;
  });

  const totalCards = cardCounts?.length || 0;

  // ===== PRÓXIMAS ENTREGAS (48h) =====
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data: upcomingItems } = await supabase
    .from("calendar_items")
    .select("id, title, item_type, start_time")
    .is("deleted_at", null)
    .gte("start_time", now.toISOString())
    .lte("start_time", in48h.toISOString())
    .order("start_time", { ascending: true })
    .limit(5);

  // ===== CARGA DO TIME =====
  const { data: teamMembers } = await supabase
    .from("user_profiles")
    .select("id, user_id, full_name, display_name, role");

  // Contar projetos por usuário
  const { data: userCardCounts } = await supabase
    .from("kanban_cards")
    .select("responsible_user_id")
    .is("deleted_at", null)
    .not("responsible_user_id", "is", null);

  const projectsByUser: Record<string, number> = {};
  userCardCounts?.forEach((card) => {
    if (card.responsible_user_id) {
      projectsByUser[card.responsible_user_id] = (projectsByUser[card.responsible_user_id] || 0) + 1;
    }
  });

  const maxProjects = Math.max(...Object.values(projectsByUser), 1);

  return (
    <>
      <Header title="Dashboard" subtitle="Visão Geral" />
      <div className="flex-1 overflow-auto p-8 bg-slate-950">
        <div className="mx-auto max-w-7xl">
          {/* Stat Cards */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Projetos Ativos"
              value={totalProjects || 0}
              icon={<Briefcase size={20} weight="duotone" className="text-slate-900" />}
              accentColor="cyan"
            />
            <StatCard
              label="Em Produção"
              value={inProduction || 0}
              icon={<Play size={20} weight="duotone" className="text-slate-900" />}
              accentColor="yellow"
            />
            <StatCard
              label="Publicados"
              value={published || 0}
              icon={<CheckCircle size={20} weight="duotone" className="text-slate-900" />}
              accentColor="green"
            />
            <StatCard
              label="Aguardando Aprovação"
              value={awaitingApproval || 0}
              icon={<Clock size={20} weight="duotone" className="text-slate-900" />}
              accentColor="pink"
            />
          </div>

          {/* Pipeline + Próximas Entregas */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
            {/* Pipeline de Projetos */}
            <div className="col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="mb-4 text-xl font-bold text-white">
                Pipeline de Projetos
              </h2>

              {totalCards === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderOpen size={48} className="text-slate-600 mb-3" />
                  <p className="text-slate-400 mb-4">Nenhum projeto ainda</p>
                  <Link
                    href="/projetos"
                    className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold px-4 py-2 rounded-[10px] transition-colors"
                  >
                    <Plus size={18} />
                    Criar Primeiro Projeto
                  </Link>
                </div>
              ) : (
                <>
                  {/* Barra segmentada */}
                  <div className="flex h-4 w-full rounded-full overflow-hidden mb-4">
                    {columns?.map((col) => {
                      const count = countByColumn[col.id] || 0;
                      const width = (count / totalCards) * 100;
                      if (width === 0) return null;
                      return (
                        <div
                          key={col.id}
                          style={{
                            width: `${width}%`,
                            backgroundColor: COLUMN_COLORS[col.slug] || "#64748B",
                          }}
                          title={`${col.name}: ${count}`}
                        />
                      );
                    })}
                  </div>

                  {/* Labels */}
                  <div className="flex flex-wrap gap-3">
                    {columns?.map((col) => {
                      const count = countByColumn[col.id] || 0;
                      return (
                        <div key={col.id} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLUMN_COLORS[col.slug] || "#64748B" }}
                          />
                          <span className="text-xs text-slate-400">
                            {col.name} ({count})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Próximas Entregas */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="mb-4 text-xl font-bold text-white">
                Próximas Entregas
              </h2>

              {!upcomingItems || upcomingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarBlank size={48} className="text-slate-600 mb-3" />
                  <p className="text-slate-400">Nenhuma entrega próxima</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: CALENDAR_TYPE_COLORS[item.item_type] || "#64748B"
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(item.start_time)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Carga do Time */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="mb-4 text-xl font-bold text-white">
              Carga do Time
            </h2>

            {!teamMembers || teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User size={48} className="text-slate-600 mb-3" />
                <p className="text-slate-400">Nenhum membro do time</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map((member) => {
                  const projectCount = projectsByUser[member.user_id] || 0;
                  const progressPercent = (projectCount / maxProjects) * 100;
                  const initials = getInitials(member.display_name || member.full_name);

                  return (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {member.display_name || member.full_name}
                        </p>
                        <p className="text-xs text-slate-500 capitalize">{member.role}</p>

                        {/* Progress bar */}
                        <div className="mt-1.5 h-1 w-full rounded-full bg-slate-700/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-cyan-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Count */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-white">{projectCount}</p>
                        <p className="text-[10px] text-slate-500">projetos</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ===== COMPONENTS =====

type AccentColor = "cyan" | "green" | "pink" | "yellow";

const accentColors: Record<AccentColor, { border: string; iconBg: string }> = {
  cyan: {
    border: "border-cyan-500/30",
    iconBg: "bg-cyan-500",
  },
  green: {
    border: "border-emerald-500/30",
    iconBg: "bg-emerald-500",
  },
  pink: {
    border: "border-pink-500/30",
    iconBg: "bg-pink-500",
  },
  yellow: {
    border: "border-amber-500/30",
    iconBg: "bg-amber-500",
  },
};

function StatCard({
  label,
  value,
  icon,
  accentColor = "cyan",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentColor?: AccentColor;
}) {
  const colors = accentColors[accentColor];

  return (
    <div className={`bg-gradient-to-br from-slate-800 to-slate-900 border ${colors.border} rounded-2xl p-6 transition-colors hover:border-opacity-60`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.iconBg}`}>
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-bold tracking-tight text-white">
          {value}
        </span>
      </div>

      {/* Progress bar visual */}
      <div className="mt-4 h-1.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
        <div
          className={`h-full rounded-full ${colors.iconBg}`}
          style={{ width: `${Math.min(100, value * 8)}%` }}
        />
      </div>
    </div>
  );
}

// ===== UTILS =====

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `Hoje às ${time}`;
  if (isTomorrow) return `Amanhã às ${time}`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + ` às ${time}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

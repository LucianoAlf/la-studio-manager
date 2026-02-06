"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import {
  SquaresFour,
  List,
  Kanban,
  CalendarDots,
  ChartLine,
  Users,
  Gear,
  Plus,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: SquaresFour },
  { id: "lista", label: "Lista", icon: List },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "calendario", label: "Calendário", icon: CalendarDots },
  { id: "timeline", label: "Timeline", icon: ChartLine },
  { id: "por-pessoa", label: "Por Pessoa", icon: Users },
  { id: "configuracoes", label: "Configurações", icon: Gear },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProjetosPage() {
  const [activeTab, setActiveTab] = useState<TabId>("kanban");

  return (
    <>
      <Header title="Projetos" subtitle="Mission Control">
        <button className="flex h-[34px] items-center gap-2 rounded-md bg-primary-500 px-3 text-body-md font-medium text-neutral-950 transition-colors hover:bg-primary-400">
          <Plus size={16} weight="bold" />
          Novo Projeto
        </button>
      </Header>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-850 px-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-3 text-body-md font-medium transition-colors",
                isActive
                  ? "border-primary-500 text-primary-400"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              )}
            >
              <Icon size={16} weight="duotone" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <TabContent activeTab={activeTab} />
      </div>
    </>
  );
}

function TabContent({ activeTab }: { activeTab: TabId }) {
  // Placeholder content for each tab
  const content: Record<TabId, { title: string; description: string }> = {
    dashboard: {
      title: "Dashboard de Projetos",
      description: "Visão geral com métricas, pipeline e próximas entregas.",
    },
    lista: {
      title: "Lista de Projetos",
      description: "Tabela ordenável com todos os projetos.",
    },
    kanban: {
      title: "Quadro Kanban",
      description:
        "Brainstorm → Planning → A Fazer → Captando → Editando → Aprovação → Publicado",
    },
    calendario: {
      title: "Calendário de Entregas",
      description: "Visão semanal/mensal com deadlines de todos os projetos.",
    },
    timeline: {
      title: "Timeline / Gantt",
      description: "Visão temporal de todos os projetos em andamento.",
    },
    "por-pessoa": {
      title: "Projetos por Pessoa",
      description: "Carga de trabalho por membro do time: Yuri, John, Rayan.",
    },
    configuracoes: {
      title: "Configurações do Projeto",
      description: "Colunas do Kanban, notificações WhatsApp, membros do time.",
    },
  };

  const tab = content[activeTab];

  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-800 bg-neutral-900/50">
      <h2 className="text-h3 font-bold text-neutral-50">{tab.title}</h2>
      <p className="mt-2 max-w-md text-center text-body text-neutral-400">
        {tab.description}
      </p>
      <p className="mt-4 text-small text-neutral-500">
        Implementação em progresso...
      </p>
    </div>
  );
}

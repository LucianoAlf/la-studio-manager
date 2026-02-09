# LA Studio Manager — Relatório Executivo Completo

> **Versão:** 1.0 — 09 de fevereiro de 2026
> **Projeto:** LA Studio Manager + Mike (Agente WhatsApp IA)
> **Cliente:** Grupo LA Music (Luciano Alf)
> **Líder de Marketing:** Yuri Santos
> **Stack:** Next.js 14 + TypeScript + Supabase + Tailwind CSS + shadcn/ui
> **Repositório:** `la-studio-manager`
> **Supabase Project ID:** `rhxqwraqpabgecgojytj`
> **Região:** South America (São Paulo)

---

## ÍNDICE

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [O Mike — Agente IA WhatsApp](#2-o-mike--agente-ia-whatsapp)
3. [Arquitetura Técnica](#3-arquitetura-técnica)
4. [Infraestrutura WhatsApp (UAZAPI)](#4-infraestrutura-whatsapp-uazapi)
5. [Edge Functions — Backend Serverless](#5-edge-functions--backend-serverless)
6. [Intents e Classificação NLP](#6-intents-e-classificação-nlp)
7. [Fluxos de Conversação](#7-fluxos-de-conversação)
8. [Sistema de Memória](#8-sistema-de-memória)
9. [Knowledge Base — Conhecimento do Negócio](#9-knowledge-base--conhecimento-do-negócio)
10. [Cron Jobs e Automações](#10-cron-jobs-e-automações)
11. [Banco de Dados — Estrutura Completa](#11-banco-de-dados--estrutura-completa)
12. [Frontend — Dashboard Web](#12-frontend--dashboard-web)
13. [Página de Configurações](#13-página-de-configurações)
14. [Gestão de Equipe](#14-gestão-de-equipe)
15. [Agenda de Contatos](#15-agenda-de-contatos)
16. [Credenciais e Secrets](#16-credenciais-e-secrets)
17. [Métricas de Uso](#17-métricas-de-uso)
18. [Histórico de Versões (WA-01 a WA-09)](#18-histórico-de-versões-wa-01-a-wa-09)
19. [Bugs Conhecidos e Limitações](#19-bugs-conhecidos-e-limitações)
20. [Roadmap e Próximos Passos](#20-roadmap-e-próximos-passos)

---

## 1. Visão Geral do Projeto

O **LA Studio Manager** é uma plataforma completa de gestão de marketing digital para o **Grupo LA Music**, a maior rede de escolas de música infantil do Rio de Janeiro (~1.500 alunos em 3 unidades).

O sistema combina:
- **Dashboard Web** — Kanban de produção de conteúdo, calendário editorial, gestão de equipe
- **Mike** — Agente IA integrado ao WhatsApp que funciona como membro da equipe de marketing
- **Automações** — Cron jobs para lembretes, relatórios diários/semanais/mensais, alertas em tempo real

### 1.1 O Grupo LA Music

| Unidade | Endereço | Horário | Consultor(a) |
|---------|----------|---------|-------------|
| **Campo Grande (CG)** | Rua Luiz Barata, 164 | Seg-Sex 10h-21h, Sáb 8h-16h | Vitória |
| **Recreio (RC)** | Av das Américas, 15700 - Time Center | Seg-Sex 8h-21h, Sáb 9h-16h | Clayton |
| **Barra (BR)** | Av Ator José Wilker, 600 - Bloco 2 | Seg-Sex 9h-20h, Sáb 9h-16h | Angélica |

**Marcas:** LA Music Kids (6m-11a) + LA Music School (12+)
**Total:** ~1.500 alunos | ~41 professores | 3 unidades

### 1.2 Equipe de Marketing (Usuários do Sistema)

| Nome | Role | Telefone | is_admin | Função |
|------|------|----------|----------|--------|
| **Yuri Santos** | admin | +5521981278047 | ✅ | Líder de Marketing |
| **Luciano Alf** | admin | — | ✅ | Diretor LA Music |
| **John** | usuario | +5521966950296 | ❌ | Filmmaker / Editor |
| **Jereh** | usuario | — | ❌ | Auxiliar de Conteúdo |
| **Rayan** | usuario | — | ❌ | Gestor de Tráfego |

### 1.3 Cursos Oferecidos

**LA Music Kids (por faixa etária):**
- 6 meses a 2 anos: Musicalização para bebês
- 3 a 4 anos: Musicalização preparatória
- 5+ anos: Iniciação ao instrumento ou canto infantil

**LA Music School (instrumentos):**
- **CG (mais completa):** Teclado, Piano, Bateria, Canto, Guitarra, Violão, Contrabaixo, Ukulele, Violino, Flauta, Saxofone, Produção Musical, Teatro Musical
- **RC e BR:** Teclado, Piano, Bateria, Canto, Guitarra, Violão, Contrabaixo, Ukulele, Violino, Flauta

**Formato:** 1x/semana, 50 min, turmas de 3-4 alunos, 40 aulas/módulo, presencial apenas.

---

## 2. O Mike — Agente IA WhatsApp

### 2.1 Quem é o Mike

O Mike é um **membro sênior da equipe de marketing** do Grupo LA Music. Ele NÃO é um chatbot genérico — é um profissional de marketing digital que:

- Conhece o negócio profundamente (unidades, cursos, professores, estratégia)
- Contribui ativamente em decisões e produção de conteúdo
- Faz brainstorming com a equipe nos grupos de WhatsApp
- Gerencia agenda, tarefas e lembretes via conversa natural
- Processa áudio e imagem
- Envia relatórios automáticos (diário, semanal, mensal)

### 2.2 Personalidade

- **Tom:** informal brasileiro, direto, colega de trabalho carioca
- Profissional que sabe o que fala, mas sem arrogância
- Quando perguntam opinião, SEMPRE dá resposta substancial com sugestões concretas
- Sempre que sugerir algo, oferece criar card/agendar
- Sabe fazer perguntas inteligentes quando precisa de dados reais
- Crítica construtiva: fala com respeito mas com clareza
- Emojis: 2-5 por mensagem (marcadores, não decorativos)
- Formatação WhatsApp: *negrito* para títulos, listas com emoji, blocos separados

### 2.3 Onde o Mike Atua

**DM (1:1):**
- Yuri Santos (+5521981278047)
- John (+5521966950296)
- Qualquer membro com registro em `whatsapp_connections`

**Grupos WhatsApp:**
- Marketing 2.0 L.A (`120363154727577617@g.us`)
- Marketing LA Music (`120363422932217390@g.us`)

**Trigger names:** "mike", "maike", "maik", "mik"
**Session timeout em grupo:** 5 minutos
**Número do bot:** 5521989784688

### 2.4 Capabilities Completas do Mike

| Capability | Via DM | Via Grupo | Detalhes |
|-----------|--------|-----------|----------|
| Criar card Kanban | ✅ | ✅ | Título, prioridade, tipo, plataforma, marca, coluna |
| Criar evento no calendário | ✅ | ✅ | Título, data, hora, duração, local, participantes, tipo |
| Criar lembrete | ✅ | ✅ | Texto, data, hora, recorrência (diário/semanal/mensal/dias úteis) |
| Alterar evento | ✅ | ❌ | Busca fuzzy + muda data/hora/local/título |
| Cancelar evento | ✅ | ❌ | Busca fuzzy + confirmação + hard delete |
| Alterar lembrete | ✅ | ❌ | Busca fuzzy + muda hora/data/recorrência |
| Cancelar lembrete | ✅ | ❌ | Busca fuzzy + confirmação |
| Consultar agenda | ✅ | ✅ | Hoje, amanhã, semana, mês, meus eventos |
| Consultar cards | ✅ | ✅ | Por prioridade, coluna, período |
| Consultar projetos | ✅ | ✅ | Status, andamento |
| Atualizar card | ✅ | ✅ | Mover coluna, mudar prioridade |
| Salvar contato | ✅ | ❌ | Nome, telefone, tipo (aluno/fornecedor/etc) |
| Consultar contato | ✅ | ❌ | Busca por nome |
| Processar áudio | ✅ | ✅ | Transcrição Whisper → classifica → executa |
| Processar imagem | ✅ | ✅ | GPT-4o Vision → sugere ação |
| Brainstorm/Opinião | ✅ | ✅ | Estratégia de conteúdo, ideias de Reels, copywriting |
| Notificar participantes | ✅ | ❌ | Envia convite DM + processa confirmação/recusa |
| Relatório diário | ✅ (auto) | ❌ | Agenda do dia + cards urgentes + insight |
| Relatório semanal | ✅ (auto) | ❌ | Produção + eventos + kanban + alertas |
| Relatório mensal | ✅ (auto) | ❌ | Comparativo mês anterior + top conteúdo |
| Alertas em tempo real | ✅ (auto) | ❌ | Cards urgentes, prazos D-0/D-1, atribuições |
| Lembretes de calendário | ✅ (auto) | ❌ | 3 dias antes + 1 dia antes de eventos |
| Conversa livre | ✅ | ✅ | Responde como colega, com expertise de marketing |

---

## 3. Arquitetura Técnica

### 3.1 Stack Completa

```
FRONTEND
  Next.js 14 (App Router) + TypeScript + Tailwind CSS
  shadcn/ui + Radix UI + Phosphor Icons + Framer Motion
  Supabase Client (auth + realtime + queries)

BACKEND (Supabase)
  Auth (GoTrue) — 5 users
  Database (PostgreSQL) — 49 tabelas, RLS enabled
  Edge Functions (Deno Runtime) — 3 functions, 28 arquivos
  Storage (avatars)
  pg_cron — 8 jobs ativos

INTEGRAÇÕES
  UAZAPI (WhatsApp API) — webhook → Edge Function
  Google Gemini 2.5 Flash Preview (classificador NLP)
  OpenAI GPT-4.1 (fallback NLP)
  OpenAI GPT-4o Vision (análise de imagem)
  Whisper via UAZAPI (transcrição de áudio)
```

### 3.2 Fluxo de uma Mensagem WhatsApp

```
Usuário envia mensagem no WhatsApp
         │
         ▼
┌─────────────────┐
│  UAZAPI Webhook  │ → POST /functions/v1/process-whatsapp-message
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  index.ts        │ Parse payload → Identifica usuário → Salva mensagem
└────────┬────────┘
         │
         ├── É grupo? → group-handler.ts → group-memory.ts → Gemini
         ├── É áudio? → audio-handler.ts → Whisper transcrição → NLP
         ├── É imagem? → image-handler.ts → GPT-4o Vision → Sugestão
         │
         ▼
┌─────────────────┐
│ message-router.ts│
│                  │
│ 1. Event confirm?│ → participant-notifier.ts
│ 2. Pending action│ → followup-handler.ts
│ 3. Confirmation? │ → action-executor.ts
│ 4. NLP classify  │ → gemini-classifier.ts
│ 5. Route intent  │ → handler específico
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ send-message.ts  │ → UAZAPI POST /send/text
└─────────────────┘
```

### 3.3 Estrutura de Arquivos do Projeto

```
la-studio-manager/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx                    # Dashboard home
│   │   │   ├── agentes/page.tsx            # Agentes IA (placeholder)
│   │   │   ├── ativos/page.tsx             # Assets (placeholder)
│   │   │   ├── calendario/page.tsx         # Calendário editorial
│   │   │   ├── configuracoes/
│   │   │   │   ├── page.tsx                # 4 tabs: Perfil, Notificações, Mike, Equipe
│   │   │   │   └── _components/
│   │   │   │       ├── profile-section.tsx
│   │   │   │       ├── notifications-section.tsx
│   │   │   │       ├── mike-section.tsx
│   │   │   │       ├── team-section.tsx
│   │   │   │       └── reminders-section.tsx
│   │   │   ├── projetos/page.tsx           # Kanban board
│   │   │   └── relatorios/page.tsx         # Relatórios (placeholder)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── calendar/CalendarItemModal.tsx   # Modal de evento
│   │   ├── kanban/KanbanCardModal.tsx       # Modal de card
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx              # Sidebar navegação
│   │   │   └── header.tsx                   # Header com user menu
│   │   └── ui/ (14 componentes base)
│   │       ├── avatar.tsx, badge.tsx, button.tsx, card.tsx
│   │       ├── chip.tsx, date-time-picker.tsx, dot.tsx
│   │       ├── form-field.tsx, icon-button.tsx, progress-bar.tsx
│   │       ├── platform-checkboxes.tsx, switch.tsx, avatar-upload.tsx
│   │       └── index.ts
│   ├── hooks/
│   │   └── use-current-user.ts              # Hook: useCurrentUser()
│   ├── lib/
│   │   ├── queries/
│   │   │   ├── calendar.ts                  # CRUD calendário
│   │   │   ├── kanban.ts                    # CRUD kanban
│   │   │   ├── settings.ts                  # Config + notificações + lembretes
│   │   │   ├── users.ts                     # Perfis de usuário
│   │   │   └── whatsapp.ts                  # Queries WhatsApp
│   │   ├── supabase/
│   │   │   ├── client.ts                    # createBrowserClient
│   │   │   ├── server.ts                    # createServerClient
│   │   │   └── ensure-profile.ts            # Auto-create profile on login
│   │   ├── types/
│   │   │   ├── database.ts                  # Tipos do domínio
│   │   │   └── settings.ts                  # Tipos de configuração
│   │   └── utils/
│   │       └── calendar-helpers.ts          # Helpers de formatação
│   └── types/
│       └── database.ts                      # Database types (Supabase generated)
│
├── supabase/
│   └── functions/
│       ├── process-whatsapp-message/ (19 arquivos, ~245kB)
│       ├── process-scheduled-tasks/ (8 arquivos, ~115kB)
│       └── manage-team/ (1 arquivo)
│
├── docs/
│   ├── UAZAPI.md                            # Documentação OpenAPI (~13.4k linhas)
│   ├── PROFESSORES-LAMUSIC.md               # 41 professores detalhados (~1400 linhas)
│   └── RELATORIO-EXECUTIVO-MIKE.md          # Este arquivo
│
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## 4. Infraestrutura WhatsApp (UAZAPI)

### 4.1 Provedor

| Campo | Valor |
|-------|-------|
| **Provedor** | UAZAPI (API WhatsApp não-oficial) |
| **Server URL** | `https://lamusic.uazapi.com` |
| **Instance Token** | `b9ca8a2c-ec93-4ff7-8805-6fa634949282` |
| **Número conectado** | `5521989784688` (número do bot Mike) |
| **Status** | ✅ Connected |
| **Webhook ID** | `r46efae1d89f709` |
| **Documentação** | `docs/UAZAPI.md` (OpenAPI 3.1.0, ~13.4k linhas) |

### 4.2 Formato do Payload UAZAPI (flat, NÃO Baileys)

```typescript
{
  EventType: "messages",
  message: {
    text: "Oi Mike",
    chatid: "5521981278047@s.whatsapp.net",  // DM
    // ou: "120363154727577617@g.us"          // Grupo
    sender_pn: "5521981278047",
    fromMe: false,
    messageType: "text",  // ou "audio", "image", "sticker"
    messageid: "3EB0...",
  }
}
```

### 4.3 Endpoints Utilizados

| Endpoint | Uso |
|----------|-----|
| `POST /send/text` | Enviar mensagem de texto (number, text) |
| `POST /send/media` | Enviar mídia (image, video, document) |
| `POST /message/download` | Download + transcrição de áudio (transcribe: true → Whisper) |
| `POST /webhook` | Configurar webhook (excludeMessages: ["wasSentByApi"] para evitar loops) |

### 4.4 Webhook Configuration

```json
{
  "url": "https://rhxqwraqpabgecgojytj.supabase.co/functions/v1/process-whatsapp-message",
  "events": ["messages"],
  "excludeMessages": ["wasSentByApi"]
}
```

> **IMPORTANTE:** `excludeMessages: ["wasSentByApi"]` evita loops infinitos — o webhook não dispara para mensagens enviadas pela própria API.

---

## 5. Edge Functions — Backend Serverless

### 5.1 process-whatsapp-message (19 arquivos, ~245kB)

A principal Edge Function do sistema. Recebe webhooks do UAZAPI e processa todas as mensagens.

| Arquivo | Linhas aprox. | Responsabilidade |
|---------|---------------|-----------------|
| `index.ts` | ~580 | Entry point: parse webhook, identifica usuário via RPC `get_user_by_phone`, salva mensagem em `whatsapp_messages`, roteia (DM vs grupo), envia resposta via UAZAPI |
| `types.ts` | ~60 | WebhookPayload, ParsedMessage, UserInfo, RouteMessageParams, MessageResponse |
| `utils.ts` | ~50 | corsHeaders, normalizePhoneNumber, parseWebhookPayload |
| `gemini-classifier.ts` | ~750 | System prompt completo com identidade Mike + knowledge base + classificação via Gemini 2.5 Flash → GPT-4.1 fallback → regex fallback |
| `gemini-followup-parser.ts` | ~100 | Parser inteligente de respostas de follow-up usando Gemini |
| `message-router.ts` | ~2600 | Roteador principal: verifica event_confirmation → pending_action → creating_*/updating_*/cancelling_* → NLP classify → route por intent. Handlers de criação, update, cancel, query. Busca fuzzy de lembretes e eventos. |
| `action-executor.ts` | ~1020 | Executa ações confirmadas: createCard (INSERT kanban_cards), createCalendar (INSERT calendar_items com verificação de conflito), createReminder (INSERT whatsapp_scheduled_messages com recorrência), updateReminder, cancelReminder, updateCalendar (resolve datas relativas pt-BR), cancelCalendar (hard delete) |
| `mike-personality.ts` | ~200 | MIKE_IDENTITY (system prompt), ACTION_REQUIRED_FIELDS (campos obrigatórios por ação), FOLLOWUP_QUESTIONS (perguntas por campo faltante), getMissingFields(), generateFollowUp(), buildPartialSummary(), isSubjectChange(), CANCEL_WORDS, SUBJECT_CHANGE_PATTERNS |
| `mike-knowledge-base.ts` | ~320 | Conhecimento real da LA Music: unidades, cursos, professores, frameworks criativos, template de briefing. Duas versões: completa (~4000 palavras) e condensada (~900 palavras) |
| `followup-handler.ts` | ~150 | savePendingAction, getPendingAction, clearPendingAction, processFollowUpResponse. Usa `whatsapp_conversation_context` com context_type='pending_action'. Expiração 5 min. parseTimeResponse (hora < 7 → PM), parseLocationResponse (online/zoom/meet/teams) |
| `query-handler.ts` | ~400 | handleQueryCalendar (por período, participante, self), handleQueryCards (por prioridade, coluna), handleListReminders |
| `memory-manager.ts` | ~200 | saveEpisode (agent_memory_episodes), getRelevantMemory, buildMemoryPrompt |
| `audio-handler.ts` | ~120 | Transcrição via UAZAPI POST /message/download com transcribe: true (Whisper). Recebe serverUrl/token como params |
| `image-handler.ts` | ~180 | Download base64 via UAZAPI + análise GPT-4o Vision. System prompt contextualizado para LA Music. Parse JSON com fallback robusto |
| `send-message.ts` | ~80 | sendTextMessage, sendMediaMessage, sendTypingIndicator via UAZAPI |
| `group-handler.ts` | ~250 | Lógica de grupo: detecta menção ao Mike, session timeout (5min), responde com contexto de grupo |
| `group-config.ts` | ~100 | loadMikeConfig() do banco (mike_config) com cache por invocação + fallback hardcoded |
| `group-memory.ts` | ~150 | Memória de grupo: salva em group_message_memory, recupera últimas 50 msgs / 4 horas, importance_score |
| `participant-notifier.ts` | ~350 | findParticipantByName (busca em contacts), notifyParticipants (envia DM + salva event_confirmation), processParticipantResponse (sim/não/ambíguo), processPhoneResponse (salva contato + envia convite), parseParticipantNames |

### 5.2 process-scheduled-tasks (8 arquivos, ~115kB)

Edge Function para tarefas agendadas via pg_cron.

| Arquivo | Responsabilidade |
|---------|-----------------|
| `index.ts` | Router por action: send-reminders, daily-digest, weekly-summary, monthly-summary, calendar-reminders, realtime-alerts, memory-maintenance |
| `reminder-processor.ts` | Busca lembretes pendentes (scheduled_for <= now) → envia via UAZAPI → retry/max_retries → quiet hours → gera próxima ocorrência para recorrentes |
| `calendar-reminder-processor.ts` | Gera lembretes automáticos de calendar_items (3d antes, 1d antes). Dedup via metadata.source_reference (`cal:{event_id}:d-{days}`). Respeita calendar_reminder_days e calendar_reminder_time do user_notification_settings |
| `daily-digest.ts` | Resumo diário personalizado: agenda do dia + cards urgentes + insight de memória. Verifica daily_summary_time do usuário |
| `weekly-summary.ts` | Resumo semanal: produção (cards criados/publicados) + eventos da semana + kanban snapshot + alertas. Verifica weekly_summary_day |
| `monthly-summary.ts` | Resumo mensal: comparativo mês anterior ↑↓ + top tipos de conteúdo + eventos + kanban + alertas. Verifica monthly_summary_day |
| `realtime-alerts.ts` | Alertas em tempo real: cards urgentes (últimas 24h), prazos D-0/D-1, novas atribuições (últimas 2h). Dedup via `alert:{tipo}:{card_id}:{YYYY-MM-DD}` |
| `report-helpers.ts` | Funções compartilhadas: sendWhatsApp, getUserPhone, getSPNow, formatDateTimeBR, formatDateOnlyBR, formatDateShort, getDateRangeForPeriod, resolveUserNames, isInQuietHours, areRemindersEnabled, isWithinScheduledTime, getCalendarTypeEmoji, getPriorityEmoji |

### 5.3 manage-team (1 arquivo)

Edge Function para gestão de membros da equipe (CRUD via admin API do Supabase Auth). `verify_jwt=false` (usa service_role internamente).

| Action | Descrição |
|--------|-----------|
| `create` | Cria user no auth.users + perfil em user_profiles (email_confirm: true) |
| `update` | Atualiza perfil (nome, telefone, role) |
| `deactivate` | is_active=false + ban_duration=876600h + signOut global |
| `reactivate` | is_active=true + ban_duration=none |
| `reset-password` | Reseta senha via admin API |

---

## 6. Intents e Classificação NLP

### 6.1 Modelo de IA

| Papel | Modelo | Detalhes |
|-------|--------|---------|
| **Primário** | Google Gemini 2.5 Flash Preview | `gemini-2.5-flash-preview-05-20`, temperature 0.3, max 2048 tokens |
| **Fallback** | OpenAI GPT-4.1 | Ativado quando Gemini falha ou retorna JSON inválido |
| **Último recurso** | Regex fallback | Palavras-chave hardcoded |
| **Áudio** | Whisper | Via UAZAPI POST /message/download (transcribe: true) |
| **Imagem** | GPT-4o Vision | Via OpenAI API direta |

### 6.2 Lista Completa de Intents (16)

| # | Intent | Descrição | Gatilhos exemplos |
|---|--------|-----------|-------------------|
| 1 | `create_card` | Criar card no Kanban | "cria card", "nova tarefa", "adiciona no kanban" |
| 2 | `create_calendar` | Criar evento no calendário | "agenda reunião", "marca evento", "cria compromisso" |
| 3 | `create_reminder` | Criar lembrete | "me lembra", "cria lembrete", "avisa às 10h" |
| 4 | `update_reminder` | Alterar lembrete existente | "muda o lembrete", "adia pra 10h", "troca o horário" |
| 5 | `cancel_reminder` | Cancelar lembrete | "cancela o lembrete", "para de me lembrar" |
| 6 | `update_calendar` | Alterar evento existente | "muda a reunião", "adia o evento", "reagenda", "troca pra quinta" |
| 7 | `cancel_calendar` | Cancelar evento | "cancela a reunião", "desmarca", "remove da agenda" |
| 8 | `save_contact` | Salvar contato na agenda | "salva na agenda", "anota o número" |
| 9 | `query_contact` | Consultar contato | "qual o número do", "contato do" |
| 10 | `query_calendar` | Consultar agenda | "o que tem hoje", "meus compromissos", "agenda da semana" |
| 11 | `query_cards` | Consultar cards | "cards urgentes", "o que tem no kanban" |
| 12 | `query_projects` | Consultar projetos | "status do projeto", "andamento" |
| 13 | `generate_report` | Gerar relatório | "relatório", "resumo da semana" |
| 14 | `update_card` | Atualizar card | "move o card", "muda prioridade" |
| 15 | `general_chat` | Conversa livre / brainstorm | Saudações, opiniões, ideias, perguntas gerais |
| 16 | `help` | Pedir ajuda | "ajuda", "o que você faz", "comandos" |

### 6.3 Entidades Extraídas (ExtractedEntities)

```typescript
interface ExtractedEntities {
  // Card / Calendar
  title?: string
  description?: string
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  content_type?: 'video' | 'carousel' | 'reels' | 'story' | 'photo' | 'live'
  platforms?: ('instagram' | 'youtube' | 'tiktok' | 'facebook' | 'whatsapp')[]
  brand?: 'la_music' | 'la_kids'
  date?: string
  time?: string
  duration_minutes?: number
  calendar_type?: 'event' | 'delivery' | 'creation' | 'task' | 'meeting'
  location?: string
  participants?: string
  column?: string
  deadline?: string
  assigned_to?: string

  // Query
  query_period?: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month'
  query_filter?: string
  query_title?: string
  query_participant?: string
  query_self?: boolean

  // Reminder
  reminder_date?: string
  reminder_time?: string
  reminder_text?: string
  reminder_recurrence?: 'daily' | 'weekdays' | 'weekly' | 'monthly' | null
  reminder_search_text?: string
  reminder_new_time?: string
  reminder_new_date?: string
  reminder_new_recurrence?: string

  // Calendar update/cancel
  event_search_text?: string
  event_new_date?: string
  event_new_time?: string
  event_new_location?: string
  event_new_title?: string

  // Contacts
  contact_name?: string
  contact_phone?: string
  contact_type?: string
  notes?: string

  // Chat
  response_text?: string  // Resposta gerada pelo Gemini para general_chat
}
```

### 6.4 Contexto Injetado no Gemini

O classificador recebe contexto real do banco antes de classificar:

1. **Histórico recente da conversa** — últimas 20 mensagens das últimas 2h de `whatsapp_messages`
2. **Lembretes pendentes** — dados reais de `whatsapp_scheduled_messages` (conteúdo, data, recorrência)
3. **Próximos eventos do calendário** — próximos 30 dias de `calendar_items` (título, data, local, participantes)
4. **Memória episódica** — insights relevantes de `agent_memory_episodes`
5. **Knowledge base condensado** — ~900 palavras sobre LA Music (unidades, professores, frameworks)
6. **Data/hora atual** — em São Paulo (UTC-3), com dia da semana

### 6.5 Regras de Classificação

- Perguntas sobre eventos/reuniões/agenda → SEMPRE `query_calendar`
- Perguntas sobre cards/tarefas/kanban → SEMPRE `query_cards`
- Pedidos para criar algo → `create_card` / `create_calendar` / `create_reminder`
- Pedidos para alterar/adiar → `update_calendar` / `update_reminder`
- Pedidos para cancelar/remover → `cancel_calendar` / `cancel_reminder`
- Saudações, conversa livre, brainstorm → `general_chat`
- Na DÚVIDA entre `general_chat` e `query_*` → prefere `query_*` (melhor consultar banco do que inventar)

---

## 7. Fluxos de Conversação

### 7.1 Prioridade de Processamento no Router

```
1. event_confirmation (participante respondendo convite) → participant-notifier.ts
2. pending_action (follow-up de campos faltantes) → followup-handler.ts
3. creating_*/updating_*/cancelling_* (confirmação sim/não) → action-executor.ts
4. awaiting_external_confirmation (confirmação de participante externo)
5. awaiting_decline_decision (manter evento após recusa?)
6. NLP classify → gemini-classifier.ts → route por intent
```

### 7.2 Fluxo de Criação (com confirmação e follow-up)

```
Usuário: "Agenda reunião com John amanhã"
         │
    Gemini classifica: create_calendar
    Entidades: { title: "Reunião com John", date: "amanhã", participants: "John" }
         │
    Campos faltantes? → SIM: falta "time"
         │
    Mike: "Que horas a reunião com John?"
    Salva pending_action (expira 5min)
         │
    Usuário: "10h"
         │
    processFollowUpResponse → parseTimeResponse("10h") → "10:00"
    Dados completos → Monta confirmação:
         │
    Mike: "🤝 *Reunião com John*
           📅 amanhã
           🕐 10:00
           👥 John
           Confirma? (sim/não)"
         │
    Salva contexto: creating_calendar (expira 10min)
         │
    Usuário: "sim"
         │
    executeConfirmedAction → INSERT calendar_items
    Verifica conflitos de horário
    Verifica participantes → John cadastrado → Envia convite DM
         │
    Mike: "Pronto, agendei! 📅 Notifiquei John pelo WhatsApp."
```

### 7.3 Fluxo de Alteração de Evento (busca fuzzy)

```
Usuário: "Muda a reunião de terça pra quinta às 15h"
         │
    Gemini classifica: update_calendar
    Entidades: { event_search_text: "reunião terça",
                 event_new_date: "quinta", event_new_time: "15:00" }
         │
    findUserCalendarEvents → busca eventos (últimos 7d + próximos 30d)
    findBestCalendarMatch → Busca fuzzy por:
      - Título (peso 4)
      - Participante (peso 3-4)
      - Dia da semana (peso 3)
      - Data relativa: hoje/amanhã/semana que vem (peso 3)
      - Tipo: reunião→meeting, gravação→creation (peso 2-3)
      - Horário mencionado (peso 2)
      - Prioriza futuros sobre passados (+1)
         │
    Match encontrado → Mostra resumo + alterações + "Confirma?"
    Sem match → Lista próximos 5 eventos → "Qual deles?"
         │
    Usuário: "sim" → executeUpdateCalendar
    Resolve datas relativas (pt-BR) → UPDATE calendar_items
    Mantém duração original → Ajusta end_time
         │
    Mike: "Pronto, alterei o evento! ✏️"
```

### 7.4 Fluxo de Áudio

```
Usuário: [envia áudio de 15 segundos]
         │
    UAZAPI POST /message/download (transcribe: true)
    Whisper transcreve → "Agenda reunião com John amanhã às 10h"
         │
    Gemini classifica texto transcrito (mesmo fluxo de texto)
    Resposta inclui prefixo: "🎤 Entendi: 'Agenda reunião com John amanhã às 10h'"
         │
    Executa intent normalmente (create_calendar)
```

### 7.5 Fluxo de Imagem

```
Usuário: [envia foto de um briefing escrito à mão]
         │
    UAZAPI POST /message/download → base64
    GPT-4o Vision analisa → sugere ação (create_card/create_calendar/general_info)
         │
    Mike: "📸 Analisei a imagem:
           Parece um briefing de vídeo para a LA Music Kids.
           Quer que eu crie um card com essas informações?"
         │
    Salva contexto para confirmação
```

### 7.6 Fluxo de Grupo

```
Mensagem no grupo "Marketing 2.0 L.A"
         │
    É grupo habilitado? (mike_config.enabled_groups)
         │
    ├── NÃO → Ignora
    ├── SIM → Menciona "mike"/"maike"/"maik"?
    │          ├── SIM → Processa como DM (com contexto de grupo)
    │          └── NÃO → Dentro de session? (5min desde última interação)
    │                    ├── SIM → Processa (continuação de conversa)
    │                    └── NÃO → Salva na memória de grupo (não responde)
         │
    group-memory.ts salva em group_message_memory
    Contexto: últimas 50 msgs / 4 horas
```

### 7.7 Fluxo de Notificação de Participantes

```
Evento criado com participante "John"
         │
    findParticipantByName → Busca em contacts (tabela mestre)
         │
    ├── Encontrado + tem WhatsApp:
    │   Envia DM para John: "Yuri agendou reunião amanhã 10h. Confirma?"
    │   Salva event_confirmation (expira 24h)
    │
    ├── Não encontrado:
    │   Mike → Yuri: "John não está cadastrado. Qual o WhatsApp dele?"
    │   └── Yuri: "5521..." → Salva contato automaticamente + envia convite
         │
    John responde "sim" → Confirma presença → Notifica Yuri
    John responde "não" → Recusa → Notifica Yuri → "Quer manter o evento?"
    John responde ambíguo → Re-pergunta com dados do evento
```

---

## 8. Sistema de Memória

### 8.1 Memória Episódica (agent_memory_episodes) — 78 registros

Registra interações significativas para dar contexto ao Mike.

```
Campos: id, agent_id, user_id, summary, entities (JSONB),
        outcome, importance (0.0-1.0), created_at, expires_at

Exemplo: "Yuri consultou agenda (this_week). 10 itens."
         entities: { query_type: 'calendar', period: 'this_week', result_count: 10 }
         outcome: 'query_answered'
```

### 8.2 Memória de Fatos (agent_memory_facts) — 3 registros

Fatos aprendidos sobre o negócio e a equipe.

```
Campos: id, category, subject, fact, confidence,
        source, learned_by_agent_id, verified_by_user_id
```

### 8.3 Memória de Grupo (group_message_memory) — 223 registros

Histórico de mensagens de grupo para contexto.

```
Campos: id, group_jid, sender_phone, sender_name,
        message_text, message_type, is_from_mike,
        metadata, session_id, importance_score, created_at

Configuração:
  Retenção: 7 dias (cleanup via pg_cron diário às 4h UTC)
  Contexto: últimas 50 mensagens / 4 horas
  Session timeout: 5 minutos
```

### 8.4 Contexto de Conversa (whatsapp_conversation_context)

Estado temporário da conversa (confirmações, follow-ups, pending actions).

```
Campos: id, user_id, context_type, context_data (JSONB),
        is_active, created_at, updated_at, expires_at

context_type possíveis:
  - creating_card, creating_calendar, creating_reminder
  - updating_reminder, cancelling_reminder
  - updating_calendar, cancelling_calendar
  - pending_action (follow-up de campos faltantes)
  - awaiting_external_confirmation (participante externo)
  - awaiting_decline_decision (manter evento após recusa?)
  - event_confirmation (participante respondendo convite)
```

### 8.5 Histórico de DM (whatsapp_messages)

Últimas 20 mensagens das últimas 2h são injetadas no contexto do Gemini.

```
Formato: "HISTÓRICO RECENTE DA CONVERSA:
          Yuri: Oi Mike, o que tem na agenda hoje?
          Mike: 📅 *Agenda de hoje:* ..."
```

---

## 9. Knowledge Base — Conhecimento do Negócio

### 9.1 Arquivo: mike-knowledge-base.ts

Duas versões do conhecimento injetadas no prompt:

**`getLaMusicKnowledge()` — Versão completa (~4000 palavras):**
- Unidades (CG, RC, BR) com endereços, horários, consultores
- Cursos por faixa etária e por unidade
- Formato das aulas
- Diferenciais competitivos (Kids vs School)
- Estratégia comercial (captação, retenção, eventos)
- Campanhas sazonais
- Público-alvo detalhado
- 41 professores por unidade com destaques para conteúdo
- Frameworks criativos (5 pilares, 3 variações de Reels)
- Template de briefing completo
- Boas práticas por plataforma
- 10 tipos de conteúdo que convertem

**`getLaMusicKnowledgeCondensed()` — Versão condensada (~900 palavras):**
- Injetada no system prompt do classificador a cada chamada
- 16 professores-chave com potencial de conteúdo
- Pilares e estrutura de Reels resumidos
- Template de briefing resumido

### 9.2 Professores-Chave para Conteúdo

| Professor | Destaque | Potencial |
|-----------|----------|-----------|
| Leticia Turques | Baterista, presença digital forte | Influencer |
| Jordan Barbosa | Sideman de Eyshila, Sandra de Sá | Autoridade |
| Daiana Pacífico | Theatro Municipal, 100% neuroatípicos | Inclusão |
| Léo Castro | 8 instrumentos, regente coral | Multi-talento |
| Willian Andrade | 8 instrumentos, 100% neuroatípicos | Inclusão |
| Valdo Delfino | Rock/blues/metal, guitarra | Rock content |
| Matheus Sterque | De aluno a professor, Heavy Metal | Narrativa |
| Jeyson Gaia | Começou aos 15 com Luciano | Narrativa |
| Gabriel Antony | Aluno desde 11 anos, banda All Star | Narrativa |
| Joel de Salles | Violinista em 3 unidades | Versatilidade |
| Miquéias Oliveira | Saxofonista/maestro, Musical Dream | Orquestra |
| Vicente Pinheiro | Militar + criador de conteúdo | Dual life |
| Peterson Biancamano | 15+ anos, Jazz/R&B/Soul | Experiência |

### 9.3 Frameworks Criativos

**5 Pilares de Conteúdo:**
1. **Educacional** — "O Pulo do Gato" (dicas rápidas de instrumento)
2. **Bastidores** — "Bastidor Real" (autenticidade, dia a dia da escola)
3. **Prova Social** — Depoimentos, resultados de alunos
4. **Entretenimento** — Trends, humor musical, challenges
5. **Conversão** — CTAs, promoções, matrículas

**3 Variações de Reels:**
1. "O Pulo do Gato" — Educacional (hook → dica → CTA)
2. "Bastidor Real" — Autenticidade (cena real → narração → convite)
3. "Prova Social" — Conversão (antes/depois → depoimento → CTA)

**Boas práticas por plataforma:**
- Instagram: 4-5 Reels/semana
- TikTok: 3-5 vídeos/semana
- YouTube: 2-3 Shorts + 1 longo/mês

### 9.4 Documento de Professores

Arquivo: `docs/PROFESSORES-LAMUSIC.md` (~1400 linhas, 41 professores)

Cada professor tem: nome, função, email, telefone, Instagram, unidades, aulas, estilos musicais, habilidades com nível (%), atendimento a neuroatípicos, bio completa, perfil comportamental (AMY/SLASH/CAZUZA/FRANK = Melancólico/Sanguíneo/Colérico/Fleumático).

Índices rápidos no final: por instrumento (14 categorias), por unidade (CG ~30, RC ~22, BR ~16), por perfil comportamental (11 combinações).

---

## 10. Cron Jobs e Automações

### 10.1 Jobs Configurados (pg_cron) — 8 ativos

| Job | Schedule | Action | Descrição |
|-----|----------|--------|-----------|
| `wa05-send-reminders` | `*/5 * * * *` | `send-reminders` | Envia lembretes pendentes (a cada 5 min) |
| `wa05-daily-digest` | `0 12 * * *` | `daily-digest` | Resumo diário (12h UTC = 9h SP) |
| `wa05-weekly-summary` | `0 12 * * 1` | `weekly-summary` | Resumo semanal (segunda 9h SP) |
| `calendar-reminders` | `0 * * * *` | `calendar-reminders` | Gera lembretes de eventos (cada hora) |
| `monthly-summary` | `0 12 * * *` | `monthly-summary` | Resumo mensal (9h SP, verifica dia internamente) |
| `realtime-alerts` | `*/15 * * * *` | `realtime-alerts` | Alertas urgentes (cada 15 min) |
| `wa05-memory-maintenance` | `0 3 * * *` | `memory-maintenance` | Limpeza de memória (0h SP) |
| `wa067-cleanup-group-memory` | `0 4 * * *` | SQL function | Limpa mensagens de grupo > 7 dias (1h SP) |

### 10.2 Sistema de Lembretes (whatsapp_scheduled_messages)

```
Total: 18 registros
├── Pendentes: 5
├── Enviados: 12
└── Cancelados/Falhos: 1

Sources:
├── manual — criado via Mike no WhatsApp
├── dashboard — criado via frontend (/configuracoes)
├── calendar_reminder — gerado automaticamente de eventos
├── daily_digest — resumo diário
├── weekly_summary — resumo semanal
└── monthly_summary — resumo mensal

Recorrência suportada:
├── null — único (dispara uma vez)
├── daily — todo dia
├── weekdays — segunda a sexta
├── weekly — toda semana
└── monthly — todo mês

Deduplicação: metadata.source_reference
├── Calendário: cal:{event_id}:d-{days}
├── Alertas: alert:{tipo}:{card_id}:{YYYY-MM-DD}
└── Relatórios: report:{tipo}:{YYYY-MM-DD}
```

### 10.3 Quiet Hours

Respeita horário de silêncio configurado pelo usuário:
- Default: 22:00 - 07:00 (São Paulo)
- Configurável por usuário em `/configuracoes`
- Lembretes que caem em quiet hours são adiados para o próximo horário permitido

---

## 11. Banco de Dados — Estrutura Completa

### 11.1 Visão Geral

- **Engine:** PostgreSQL (Supabase managed)
- **Tabelas:** 49 no schema public
- **RLS:** Habilitado nas tabelas principais
- **Extensões:** pg_cron + pg_net habilitados
- **Cron jobs:** 8 ativos
- **RPCs:** `get_team_members_with_email()` (SECURITY DEFINER)
- **SQL functions:** `cleanup_old_group_messages()`

### 11.2 Tabelas por Domínio

#### WhatsApp & Mike (10 tabelas)

| Tabela | Rows | Descrição |
|--------|------|-----------|
| `whatsapp_messages` | 585 | Todas as mensagens (313 inbound, 272 outbound) |
| `whatsapp_connections` | 2 | Mapeia user_profile → telefone WhatsApp |
| `whatsapp_conversation_context` | ~10 | Estado temporário de conversa (confirmações, follow-ups) |
| `whatsapp_scheduled_messages` | 18 | Fila de lembretes/relatórios (5 pendentes, 12 enviados) |
| `whatsapp_groups` | 0 | Grupos cadastrados (não usado ativamente) |
| `whatsapp_notification_settings` | 1 | Preferências (legado, substituído por user_notification_settings) |
| `group_message_memory` | 223 | Memória de grupo (últimas 50 msgs / 4h) |
| `wa_media_processing_log` | 38 | Log de áudio/imagem processados |
| `mike_config` | 1 | Configuração singleton do Mike (grupos, triggers, IA, personalidade) |
| `user_notification_settings` | 1 | Preferências de notificação por usuário (atual) |

#### Calendário (3 tabelas)

| Tabela | Rows | Descrição |
|--------|------|-----------|
| `calendar_items` | 39 | Eventos, reuniões, entregas, tarefas, criações |
| `calendar_item_comments` | ~5 | Comentários em eventos |
| `calendar_item_connections` | ~3 | Conexões entre eventos e cards Kanban |

#### Kanban (6 tabelas)

| Tabela | Rows | Descrição |
|--------|------|-----------|
| `kanban_columns` | 9 | Colunas do board (brainstorm → archived) |
| `kanban_cards` | 20 | Cards de conteúdo |
| `kanban_card_comments` | 0 | Comentários em cards |
| `kanban_card_checklists` | 0 | Checklists em cards |
| `kanban_card_attachments` | 0 | Anexos em cards |
| `kanban_card_history` | 0 | Histórico de movimentação |

#### Memória IA (3 tabelas)

| Tabela | Rows | Descrição |
|--------|------|-----------|
| `agent_memory_episodes` | 78 | Memória episódica (interações significativas) |
| `agent_memory_facts` | 3 | Fatos aprendidos sobre o negócio |
| `agent_memory_team` | 0 | Conhecimento de equipe (não usado) |

#### Agentes IA (4 tabelas)

| Tabela | Rows | Descrição |
|--------|------|-----------|
| `ai_agents` | 6 | Agentes cadastrados (Maestro, Luna, Theo, Atlas, Ada, Nina) |
| `ai_conversations` | 0 | Conversas com agentes (não usado) |
| `ai_executions` | 0 | Execuções de agentes (não usado) |
| `ai_logs` | 0 | Logs de agentes (não usado) |

#### Usuários & Equipe (3 tabelas)

| Tabela | Rows | Descrição |
|--------|------|-----------|
| `user_profiles` | 5 | Perfis de usuário (nome, role, telefone, bio, especializações, avatar) |
| `contacts` | 7 | Agenda de contatos unificada (tabela mestre) |
| `user_notification_preferences` | 0 | Preferências (legado, não usar) |

#### Conteúdo & Publicação (10+ tabelas — placeholder)

| Tabela | Rows | Descrição |
|--------|------|-----------|
| `posts` | 0 | Posts de conteúdo |
| `post_platforms` | 0 | Plataformas por post |
| `post_metrics` | 0 | Métricas por post |
| `post_versions` | 0 | Versões de post |
| `post_assets` | 0 | Assets por post |
| `campaigns` | 0 | Campanhas |
| `campaign_posts` | 0 | Posts por campanha |
| `campaign_metrics` | 0 | Métricas por campanha |
| `platforms` | 4 | Plataformas (Instagram, YouTube, TikTok, Facebook) |
| `templates` | 0 | Templates de conteúdo |

#### Outros (10+ tabelas — placeholder)

| Tabela | Descrição |
|--------|-----------|
| `assets` | Arquivos/mídia |
| `asset_tags` | Tags de assets |
| `asset_tag_relations` | Relação asset-tag |
| `approvals` | Aprovações de conteúdo |
| `audit_logs` | Logs de auditoria |
| `notifications_queue` | Fila de notificações |
| `notifications_log` | Log de notificações |
| `system_settings` | Configurações do sistema |
| `integration_credentials` | Credenciais de integração |
| `daily_metrics_summary` | Resumo diário de métricas |

### 11.3 Colunas do Kanban

| Slug | Nome | Posição |
|------|------|---------|
| `brainstorm` | Brainstorm 💡 | 0 |
| `planning` | Planejamento 📋 | 1 |
| `todo` | A Fazer ✅ | 2 |
| `capturing` | Captando 🎬 | 3 |
| `editing` | Editando ✂️ | 4 |
| `awaiting_approval` | Aguardando Aprovação 👀 | 5 |
| `approved` | Aprovado ✅ | 6 |
| `published` | Publicado 🚀 | 7 |
| `archived` | Arquivado 📦 | 8 |

### 11.4 Agentes IA Cadastrados (ai_agents)

| Nome | Role | Provider | Model | Status |
|------|------|----------|-------|--------|
| Maestro | orchestrator | OpenAI | gpt-4 | Cadastrado, não ativo |
| Luna | ideation | OpenAI | gpt-4 | Cadastrado, não ativo |
| Theo | copywriting | OpenAI | gpt-4 | Cadastrado, não ativo |
| Atlas | planning | OpenAI | gpt-3.5-turbo | Cadastrado, não ativo |
| Ada | analytics | Google | gemini-pro | Cadastrado, não ativo |
| Nina | design | Google | gemini-pro | Cadastrado, não ativo |

> **Nota:** Estes agentes estão cadastrados mas NÃO estão ativos no fluxo atual. O Mike é o único agente operacional via WhatsApp.

### 11.5 RLS Policies (padrão)

```sql
-- Tabelas principais (kanban_cards, calendar_items, etc.)
SELECT:  USING (true)  -- App filtra deleted_at IS NULL nas queries
INSERT:  WITH CHECK (created_by = auth.uid())
UPDATE:  USING (auth.uid() IS NOT NULL) WITH CHECK (true)
DELETE:  USING (auth.uid() IS NOT NULL)

-- mike_config: admin-only para escrita
SELECT:  USING (true)
UPDATE:  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true))

-- user_notification_settings: por usuário
SELECT:  USING (user_id = auth.uid())
INSERT:  WITH CHECK (user_id = auth.uid())
UPDATE:  USING (user_id = auth.uid())

-- whatsapp_messages, wa_media_processing_log: service_role full + admin view
SELECT:  USING (true) -- via service_role ou admin
INSERT:  WITH CHECK (true) -- via service_role
```

### 11.6 Tabela user_profiles (campos)

```sql
user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('admin', 'usuario')),
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  phone TEXT,
  bio TEXT,
  specializations TEXT[],
  whatsapp_jid TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### 11.7 Tabela contacts (campos)

```sql
contacts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),  -- quem cadastrou
  name TEXT NOT NULL,
  phone TEXT,
  type TEXT,  -- 'user', 'aluno', 'professor', 'fornecedor', 'outro'
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### 11.8 Tabela mike_config (singleton)

```sql
mike_config (
  id UUID PRIMARY KEY,
  enabled_groups JSONB,  -- [{ jid, name }]
  trigger_names TEXT[],  -- ['mike', 'maike', 'maik', 'mik']
  session_timeout_minutes INTEGER DEFAULT 5,
  memory_config JSONB,   -- { context_hours: 4, max_messages: 50, retention_days: 7 }
  personality JSONB,     -- { tone: 'casual_profissional', emoji_level: 'moderado' }
  ai_models JSONB,       -- { primary: 'gemini-2.5-flash-preview-05-20', fallback: 'gpt-4.1', max_tokens: 4096 }
  bot_phone TEXT,        -- '5521989784688'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

---

## 12. Frontend — Dashboard Web

### 12.1 Stack Frontend

| Tecnologia | Uso |
|-----------|-----|
| Next.js 14 | Framework (App Router) |
| TypeScript | Linguagem (strict mode) |
| Tailwind CSS | Estilização |
| shadcn/ui + Radix UI | Componentes |
| Phosphor Icons | Ícones |
| Framer Motion | Animações |
| Supabase Auth | Autenticação (email/password) |
| Supabase Client | Queries + Realtime |

### 12.2 Páginas do Dashboard

#### `/` — Dashboard Home
- Visão geral do sistema (placeholder para métricas futuras)
- Acesso rápido às seções principais

#### `/projetos` — Kanban Board
- Board completo com 9 colunas (brainstorm → archived)
- Drag & drop entre colunas
- Cards com: título, prioridade (badge colorido), tipo de conteúdo, plataformas, marca
- Modal de card (`KanbanCardModal.tsx`): edição completa, comentários, checklist, anexos, histórico
- Filtros por prioridade, tipo, plataforma
- Criação de card via modal
- Dados reais do Supabase

#### `/calendario` — Calendário Editorial
- Visualização: dia, semana, mês
- Tipos de evento com emojis e cores: event, delivery, creation, task, meeting
- Modal de evento (`CalendarItemModal.tsx`): edição completa, participantes, local, conexões com cards
- Comentários em eventos
- Criação de evento via modal
- Dados reais do Supabase (não mock)

#### `/configuracoes` — Configurações (4 abas + seção lembretes)
- **Perfil:** Nome, display name, bio, especializações, avatar
- **Notificações:** Lembretes de calendário, resumos diário/semanal/mensal, alertas, quiet hours, timezone (11 opções)
- **Notificações > Lembretes:** Lista de pendentes, criar lembrete, cancelar, histórico
- **Mike (admin only):** Grupos habilitados, trigger names, personalidade, modelos IA, timeout
- **Equipe:** Lista de membros, criar/editar/desativar/reativar, resetar senha

#### `/agentes` — Agentes IA (placeholder)
- Lista dos 6 agentes cadastrados

#### `/ativos` — Assets (placeholder)
- Gestão de arquivos/mídia

#### `/relatorios` — Relatórios (placeholder)
- Relatórios e analytics

### 12.3 Componentes Reutilizáveis (src/components/ui/)

| Componente | Descrição |
|-----------|-----------|
| `avatar.tsx` | Avatar com initials fallback (hash-based color) |
| `avatar-upload.tsx` | Upload de avatar com preview |
| `badge.tsx` | Badge colorido (prioridade, status) |
| `button.tsx` | Botão com variantes (primary, secondary, ghost, destructive) |
| `card.tsx` | Card container (CardHeader, CardContent, CardTitle) |
| `chip.tsx` | Chip/tag removível |
| `date-time-picker.tsx` | Seletor de data/hora |
| `dot.tsx` | Indicador de status (online/offline) |
| `form-field.tsx` | Campo de formulário com label e erro |
| `icon-button.tsx` | Botão com ícone |
| `platform-checkboxes.tsx` | Checkboxes de plataforma (IG, YT, TT, FB) |
| `progress-bar.tsx` | Barra de progresso |
| `switch.tsx` | Toggle switch |

### 12.4 Hooks Customizados

**`useCurrentUser()`** — `src/hooks/use-current-user.ts`
```typescript
// Retorna:
{
  user: {
    authUserId: string,
    profile: UserProfileExtended,
    isAdmin: boolean
  } | null,
  loading: boolean,
  error: Error | null,
  refetch: () => void
}
```

### 12.5 Queries (src/lib/queries/)

**calendar.ts:**
- `getCalendarItems(supabase, startDate, endDate)` — Lista eventos por período
- `getCalendarItemConnections(supabase, itemId)` — Conexões com cards
- `getCalendarItemComments(supabase, itemId)` — Comentários
- `addCalendarComment(supabase, itemId, userId, text)` — Adicionar comentário
- `createCalendarItem(supabase, data)` — Criar evento
- `updateCalendarItem(supabase, id, data)` — Atualizar evento
- `deleteCalendarItem(supabase, id)` — Soft delete

**kanban.ts:**
- `getKanbanColumns(supabase)` — Lista colunas
- `getKanbanCards(supabase)` — Lista cards
- `createKanbanCard(supabase, data)` — Criar card
- `updateKanbanCard(supabase, id, data)` — Atualizar card
- `moveKanbanCard(supabase, id, columnId, position)` — Mover card
- `deleteKanbanCard(supabase, id)` — Soft delete

**settings.ts:**
- `getMyProfile(supabase, userId)` — Perfil do usuário
- `updateMyProfile(supabase, userId, data)` — Atualizar perfil
- `getMyNotificationSettings(supabase, userId)` — Preferências de notificação
- `upsertNotificationSettings(supabase, userId, data)` — Salvar preferências
- `getMikeConfig(supabase)` — Configuração do Mike
- `updateMikeConfig(supabase, data)` — Atualizar config do Mike
- `getMyReminders(supabase, profileId)` — Lembretes do usuário
- `createDashboardReminder(supabase, profileId, data)` — Criar lembrete via dashboard
- `cancelReminder(supabase, reminderId)` — Cancelar lembrete
- `getNotificationHistory(supabase, profileId)` — Histórico de notificações

**users.ts:**
- `getCurrentUserProfile(supabase)` — Perfil do usuário logado
- `getAllUsers(supabase)` — Todos os usuários

---

## 13. Página de Configurações (/configuracoes)

### 13.1 Aba Perfil (profile-section.tsx)

Campos editáveis:
- **Nome completo** — text input
- **Nome de exibição** — text input
- **Bio** — textarea
- **Especializações** — tags editáveis (add/remove)
- **Avatar** — upload com preview (Supabase Storage)
- Botão salvar → `updateMyProfile()`

### 13.2 Aba Notificações (notifications-section.tsx)

Seções configuráveis:
- **Lembretes de Calendário** — toggle on/off, dias de antecedência (ex: 3, 1), horário
- **Resumo Diário** — toggle, horário (ex: 09:00)
- **Resumo Semanal** — toggle, dia da semana, horário
- **Resumo Mensal** — toggle, dia do mês, horário
- **Alertas** — toggles individuais: cards urgentes, prazos próximos, novas atribuições, relatórios de grupo
- **Horário de Silêncio** — toggle, início/fim (ex: 22:00-07:00)
- **Fuso Horário** — selector com 11 opções (BR + NY + Lisboa)

### 13.3 Aba Notificações > Seção Lembretes (reminders-section.tsx)

- **Criar Lembrete** — formulário: conteúdo + data/hora → `createDashboardReminder()`
- **Pendentes** — lista com labels por source (🔵 Mike, 🟡 Calendário, 🟢 Dashboard) + botão cancelar
- **Histórico** — últimas 20 notificações enviadas

### 13.4 Aba Mike — Admin Only (mike-section.tsx)

Campos configuráveis (somente admin):
- **Grupos Habilitados** — lista de grupos com JID + nome
- **Trigger Names** — tags editáveis (mike, maike, maik, mik)
- **Session Timeout** — minutos (default: 5)
- **Memória de Grupo** — horas de contexto (4), máx mensagens (50), retenção dias (7)
- **Personalidade** — tom (casual_profissional), nível de emoji (moderado)
- **Modelos de IA** — primário (gemini-2.5-flash-preview-05-20), fallback (gpt-4.1), max tokens (4096)
- **Número do Bot** — telefone do Mike (5521989784688)

### 13.5 Aba Equipe (team-section.tsx)

- **Tabela de membros** — nome, email, telefone, role, status (ativo/inativo)
- **Criar Membro (admin)** — modal: email, nome, telefone, perfil de acesso, senha inicial
- **Editar Membro (admin)** — modal: todos os campos + resetar senha
- **Desativar/Reativar (admin)** — modal de confirmação
- **Usuário comum** — vê lista read-only (sem ações)
- **Restrição** — não pode editar a si mesmo na aba equipe

---

## 14. Gestão de Equipe

### 14.1 Roles Simplificados

Apenas dois roles: `admin` e `usuario`.
- **admin** — acesso total, configura Mike, gerencia equipe
- **usuario** — acesso ao dashboard, calendário, projetos, configurações pessoais

Campo `is_admin` (boolean) sincronizado com `role`:
- `role = 'admin'` → `is_admin = true`
- `role = 'usuario'` → `is_admin = false`

### 14.2 Edge Function manage-team

Todas as operações de equipe passam pela Edge Function `manage-team` que usa a Admin API do Supabase Auth:

- **Criar:** `auth.admin.createUser()` + INSERT `user_profiles`
- **Desativar:** UPDATE `user_profiles` (is_active=false) + `auth.admin.updateUserById()` (ban_duration) + `auth.admin.signOut()` (global)
- **Reativar:** UPDATE `user_profiles` (is_active=true) + `auth.admin.updateUserById()` (ban_duration=none)
- **Resetar senha:** `auth.admin.updateUserById()` (password)

### 14.3 RPC get_team_members_with_email()

```sql
-- SECURITY DEFINER para acessar auth.users
-- Retorna perfil + email de todos os membros
CREATE FUNCTION get_team_members_with_email()
RETURNS TABLE (
  id UUID, full_name TEXT, display_name TEXT, avatar_url TEXT,
  role TEXT, is_admin BOOLEAN, is_active BOOLEAN, phone TEXT,
  bio TEXT, specializations TEXT[], email TEXT
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT p.*, u.email
  FROM user_profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.full_name;
$$;
```

---

## 15. Agenda de Contatos

### 15.1 Tabela contacts (tabela mestre unificada)

A tabela `contacts` é a fonte única de verdade para todos os contatos do sistema. Usada pelo Mike para:
- Buscar participantes de eventos
- Enviar notificações
- Salvar novos contatos via WhatsApp

### 15.2 Contatos Cadastrados (7)

| Nome | Tipo | Telefone | Cadastrado por |
|------|------|----------|---------------|
| Yuri Santos | user | +5521981278047 | Sistema |
| John | user | +5521966950296 | Sistema |
| Jereh | outro | — | Sistema |
| Pedro | aluno | — | Mike (WhatsApp) |
| Rayan | user | — | Sistema |
| Luciano Alf | user | — | Sistema |
| Mila | outro | — | Mike (WhatsApp) |

### 15.3 Fluxo de Cadastro via Mike

```
Yuri: "Agenda reunião com Pedro amanhã"
Mike: "Pedro não está cadastrado. Qual o WhatsApp dele?"
Yuri: "21999887766"
Mike: [Salva contato automaticamente] + [Envia convite DM para Pedro]
```

---

## 16. Credenciais e Secrets

### 16.1 Supabase

| Variável | Valor |
|----------|-------|
| **Project ID** | `rhxqwraqpabgecgojytj` |
| **Project URL** | `https://rhxqwraqpabgecgojytj.supabase.co` |
| **Anon Key** | Configurada no `.env.local` do frontend |
| **Service Role Key** | Usada nos cron jobs e Edge Functions |

### 16.2 Secrets das Edge Functions

| Secret | Uso |
|--------|-----|
| `GEMINI_API_KEY` | Google Gemini API (classificador NLP) |
| `OPENAI_API_KEY` | OpenAI GPT-4.1 (fallback) + GPT-4o Vision (imagem) |
| `UAZAPI_SERVER_URL` | `https://lamusic.uazapi.com` |
| `UAZAPI_TOKEN` | `b9ca8a2c-ec93-4ff7-8805-6fa634949282` |

### 16.3 Variáveis de Ambiente do Frontend (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://rhxqwraqpabgecgojytj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
```

---

## 17. Métricas de Uso

### 17.1 Estatísticas Gerais (em 09/02/2026)

| Métrica | Valor |
|---------|-------|
| **Total de mensagens WhatsApp** | 585 |
| **Mensagens recebidas (inbound)** | 313 |
| **Mensagens enviadas (outbound)** | 272 |
| **Eventos no calendário** | 39 |
| **Cards no Kanban** | 20 |
| **Lembretes agendados** | 18 (5 pendentes, 12 enviados) |
| **Episódios de memória** | 78 |
| **Fatos aprendidos** | 3 |
| **Mensagens de grupo salvas** | 223 |
| **Contatos cadastrados** | 7 |
| **Mídias processadas (áudio/imagem)** | 38 |
| **Usuários ativos** | 5 |
| **Grupos habilitados** | 2 |

### 17.2 Distribuição de Mensagens

```
Total: 585 mensagens
├── Inbound (usuários → Mike): 313 (53.5%)
└── Outbound (Mike → usuários): 272 (46.5%)

Ratio: ~1.15 mensagens recebidas por enviada
(indica que Mike responde quase todas as mensagens)
```

---

## 18. Histórico de Versões (WA-01 a WA-09)

### WA-01 — Infraestrutura Base (07/02/2026)
- Webhook UAZAPI configurado
- Edge Function `process-whatsapp-message` (esqueleto)
- Tabelas WhatsApp criadas
- Envio/recebimento de texto funcionando
- Identificação de usuário por telefone

### WA-02 — NLP + Intent Classification (07/02/2026)
- Classificador Gemini 3 Flash → GPT-4.1 fallback → regex
- 11 intents iniciais
- Extração de entidades
- Fluxo de confirmação (sim/não) com contexto temporário
- Teste real bem-sucedido (oi → general_chat, criar card → create_card com entidades)

### WA-03 — Execute-First Actions (07/02/2026)
- Criação de card Kanban via WhatsApp
- Criação de evento no calendário via WhatsApp
- Criação de lembrete via WhatsApp
- Follow-up para campos faltantes
- Verificação de conflitos de horário

### WA-04 — Consultas (07/02/2026)
- Consulta de agenda (hoje, amanhã, semana, mês)
- Consulta de cards (por prioridade, coluna)
- Consulta de projetos
- Dados reais do Supabase

### WA-05 — Cron Jobs + Relatórios (07/02/2026)
- Edge Function `process-scheduled-tasks` (5 arquivos)
- Envio de lembretes (a cada 5 min)
- Resumo diário (9h SP)
- Resumo semanal (segunda 9h SP)
- Manutenção de memória (0h SP)
- Quiet hours
- Preferências de notificação por usuário

### WA-06 — Áudio + Imagem (08/02/2026)
- Transcrição de áudio via UAZAPI/Whisper
- Análise de imagem via GPT-4o Vision
- Tabela `wa_media_processing_log`
- Integração com fluxo NLP (áudio transcrito → classifica → executa)
- Sugestão de ação para imagens

### WA-06.9 — Mike Especialista em Marketing (08/02/2026)
- Knowledge base completo da LA Music (~4000 palavras)
- 41 professores com destaques para conteúdo
- Frameworks criativos (5 pilares, 3 variações de Reels)
- Template de briefing
- Versão condensada (~900 palavras) injetada no classificador
- Pós-processamento de formatação WhatsApp

### WA-06.9b — Correções de Bugs (08/02/2026)
- Fix: pattern matching "marca" criava evento prematuramente
- Fix: recusa de participante não salvava contexto
- Fix: falta de memória de curto prazo na DM (adicionado histórico últimas 20 msgs / 2h)
- Fix: detecção de recusa por firstWord
- Anti-loop: timeout de 10 min para confirmações ambíguas
- Suporte a múltiplos participantes (fila pending_participants_queue)

### WA-07 — Página de Configurações (08/02/2026)
- Migrations: user_profiles (is_admin, whatsapp_jid, bio, specializations), user_notification_settings, mike_config
- Frontend: `/configuracoes` com 4 tabs (Perfil, Notificações, Mike, Equipe)
- Hook `useCurrentUser()`
- Componente Switch
- group-config.ts refatorado para carregar do banco
- Fix: daily-digest e weekly-summary consultavam tabela inexistente

### WA-08 — Cron Jobs Avançados (08/02/2026)
- calendar-reminder-processor.ts (lembretes automáticos de eventos)
- monthly-summary.ts (resumo mensal com comparativo)
- realtime-alerts.ts (cards urgentes, prazos, atribuições)
- 3 novos cron jobs
- Seção "Meus Lembretes" no frontend
- Timezone selector (11 fusos)

### WA-09 — Update/Cancel Calendar (09/02/2026)
- Intents `update_calendar` e `cancel_calendar`
- Novas entidades: event_search_text, event_new_date/time/location/title
- Handlers com busca fuzzy de eventos (título, participante, dia, horário, tipo)
- Executores com resolução de datas relativas pt-BR
- Injeção de próximos eventos do calendário no contexto do Gemini
- Deploy v58 (245.6kB)

---

## 19. Bugs Conhecidos e Limitações

### 19.1 Limitações Atuais

1. **Sem suporte a stickers** — Stickers são ignorados pelo processamento
2. **Sem suporte a documentos** — PDFs e outros documentos não são processados
3. **Sem suporte a vídeo** — Vídeos enviados não são analisados
4. **Update/Cancel apenas em DM** — Alteração e cancelamento de eventos/lembretes não funcionam em grupo
5. **Sem paginação de resultados** — Consultas retornam todos os resultados de uma vez
6. **Sem suporte a reações** — Reações de emoji não são processadas
7. **Agentes IA inativos** — Os 6 agentes cadastrados (Maestro, Luna, etc.) não estão operacionais
8. **Tabelas de conteúdo vazias** — Posts, campaigns, metrics, approvals não estão em uso
9. **Sem integração com redes sociais** — Não publica diretamente no Instagram/YouTube/TikTok
10. **Sem dashboard de métricas** — Página de relatórios é placeholder

### 19.2 Bugs Conhecidos

1. **Tipagem `as never`** — Alguns inserts/updates usam `as never` para contornar Database type incompleto
2. **Deno lint warnings** — Erros de lint do Deno ignorados (irrelevantes para deploy)
3. **Timezone hardcoded** — Alguns cálculos usam UTC-3 hardcoded em vez do timezone do usuário

---

## 20. Roadmap e Próximos Passos

### 20.1 Funcionalidades Pendentes

1. **Integração com redes sociais** — Publicação direta no Instagram, YouTube, TikTok
2. **Dashboard de métricas** — Gráficos de performance, engagement, crescimento
3. **Agentes IA operacionais** — Ativar Maestro (orquestrador), Luna (ideação), Theo (copywriting)
4. **Gestão de assets** — Upload, organização e busca de arquivos/mídia
5. **Aprovações de conteúdo** — Fluxo de aprovação com notificação
6. **Campanhas** — Planejamento e tracking de campanhas
7. **Templates de conteúdo** — Biblioteca de templates reutilizáveis
8. **Relatórios avançados** — Analytics com filtros, exportação, comparativos
9. **Suporte a vídeo/documento** — Processamento de vídeos e PDFs via WhatsApp
10. **Mike em mais grupos** — Expandir para outros grupos da LA Music

### 20.2 Melhorias Técnicas

1. **Regenerar Database types** — Atualizar `src/types/database.ts` com todas as tabelas
2. **Remover `as never`** — Corrigir tipagem dos inserts/updates
3. **Testes automatizados** — Vitest para queries, Playwright para fluxos críticos
4. **CI/CD** — Pipeline de lint, type-check, tests, build
5. **Monitoramento** — Alertas de erro nas Edge Functions
6. **Rate limiting** — Proteção contra spam no webhook
7. **Backup de memória** — Exportação periódica da memória do Mike

---

## Apêndice A — Wireframes das Páginas

### A.1 Dashboard Home

```
┌──────────────────────────────────────────────────────────┐
│  [Sidebar]  │  LA Studio Manager                    [👤] │
│             │                                            │
│  🏠 Home    │  ┌────────┐ ┌────────┐ ┌────────┐        │
│  📋 Projetos│  │ Cards  │ │ Eventos│ │ Alertas│        │
│  📅 Calendá.│  │  20    │ │  39    │ │   5    │        │
│  📊 Relatór.│  └────────┘ └────────┘ └────────┘        │
│  🤖 Agentes │                                            │
│  📁 Ativos  │  ┌─────────────────────────────────┐      │
│  ⚙️ Config  │  │  Atividade Recente              │      │
│             │  │  • Card criado: "Reels Bateria"  │      │
│             │  │  • Reunião agendada: 10/02 10h   │      │
│             │  │  • Lembrete enviado: Yuri         │      │
│             │  └─────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

### A.2 Kanban Board (/projetos)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Projetos                                              [+ Novo Card]│
│                                                                      │
│  💡 Brainstorm  │ 📋 Planejamento │ ✅ A Fazer  │ 🎬 Captando │ ...│
│  ┌───────────┐  │ ┌───────────┐   │ ┌─────────┐│             │     │
│  │ 🔴 Urgent │  │ │ 🟡 Medium │   │ │ 🟢 Low  ││             │     │
│  │ Reels     │  │ │ Carousel  │   │ │ Story   ││             │     │
│  │ Bateria   │  │ │ Professores│  │ │ Bastidor││             │     │
│  │ 📱 IG     │  │ │ 📱 IG 🎬 YT│  │ │ 📱 IG   ││             │     │
│  │ LA Kids   │  │ │ LA Music  │   │ │ LA Music││             │     │
│  └───────────┘  │ └───────────┘   │ └─────────┘│             │     │
│  ┌───────────┐  │                 │             │             │     │
│  │ 🟠 High   │  │                 │             │             │     │
│  │ Video     │  │                 │             │             │     │
│  │ Recital   │  │                 │             │             │     │
│  └───────────┘  │                 │             │             │     │
└──────────────────────────────────────────────────────────────────────┘
```

### A.3 Calendário (/calendario)

```
┌──────────────────────────────────────────────────────────┐
│  Calendário                        [Dia] [Semana] [Mês] │
│                                                          │
│  ◀ Fevereiro 2026 ▶                                     │
│                                                          │
│  Seg    Ter    Qua    Qui    Sex    Sáb    Dom          │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐    │
│  │      │      │      │      │      │  1   │  2   │    │
│  │      │      │      │      │      │      │      │    │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤    │
│  │  3   │  4   │  5   │  6   │  7   │  8   │  9   │    │
│  │      │ 🤝10h│      │ 📦14h│      │      │      │    │
│  │      │Reunião│     │Entrega│      │      │      │    │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤    │
│  │  10  │  11  │  12  │  13  │  14  │  15  │  16  │    │
│  │🎬 9h │      │ 🤝15h│      │ 📦18h│      │      │    │
│  │Gravação│    │Planning│    │Entrega│      │      │    │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘    │
└──────────────────────────────────────────────────────────┘
```

### A.4 Configurações (/configuracoes)

```
┌──────────────────────────────────────────────────────────┐
│  Configurações                                           │
│                                                          │
│  [Perfil] [Notificações] [Mike 🔒] [Equipe]            │
│  ─────────────────────────────────────────────           │
│                                                          │
│  👤 Perfil                                               │
│  ┌────────────────────────────────────────┐              │
│  │ Nome: [Yuri Santos          ]          │              │
│  │ Display: [Yuri              ]          │              │
│  │ Bio: [Líder de Marketing    ]          │              │
│  │ Especializações:                       │              │
│  │ [Social Media] [Conteúdo] [+]          │              │
│  │ Avatar: [📷 Upload]                    │              │
│  │                                        │              │
│  │ [💾 Salvar]                            │              │
│  └────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────┘
```

---

## Apêndice B — Exemplos de Conversas Reais

### B.1 Criação de Card via WhatsApp

```
Yuri: Mike, cria um card urgente pra gravar vídeo da LA Music Kids
Mike: 🎬 *Novo Card:*
      📌 Título: Gravar vídeo da LA Music Kids
      🔴 Prioridade: Urgente
      🎥 Tipo: Vídeo
      🏷️ Marca: LA Kids
      💡 Coluna: Brainstorm

      Confirma? (sim/não)
Yuri: sim
Mike: Pronto, criei o card! 🎯
```

### B.2 Consulta de Agenda

```
Yuri: O que tem na minha agenda essa semana?
Mike: 📅 *Agenda da semana (10-16/02):*

      🤝 *Reunião de Planejamento*
      📅 ter., 11/02, 10:00-11:00
      📍 Sala de reunião CG
      👥 Yuri, John

      🎬 *Gravação Reels Bateria*
      📅 qua., 12/02, 14:00-16:00
      📍 Estúdio CG
      👥 Yuri, Leticia Turques

      📦 *Entrega: Carousel Professores*
      📅 sex., 14/02, 18:00

      Total: 3 eventos esta semana ✨
```

### B.3 Brainstorm em Grupo

```
[Grupo: Marketing 2.0 L.A]
Yuri: Mike, preciso de ideias de Reels pro Instagram essa semana
Mike: 🎬 *5 ideias de Reels pra essa semana:*

      1️⃣ *"O Pulo do Gato" — Bateria*
      🥁 Leticia Turques mostra técnica de baqueta
      ⏱️ 15-30s | Hook: "Você segura a baqueta errado"

      2️⃣ *"Bastidor Real" — Aula Kids*
      👶 Câmera no ombro, aula de musicalização
      ⏱️ 20s | Narração: "É assim que começa..."

      3️⃣ *"Prova Social" — Aluno → Professor*
      🎸 Gabriel Antony conta sua história
      ⏱️ 30-45s | Antes/depois

      4️⃣ *Trend Musical*
      🎵 Professor tocando trend viral no instrumento
      ⏱️ 15s | Usar áudio em alta

      5️⃣ *"Tour pela Escola"*
      🏫 POV entrando na unidade CG
      ⏱️ 20s | Mostrar estrutura premium

      Quer que eu crie cards pra alguma dessas? 📋
```

### B.4 Lembrete com Recorrência

```
Yuri: Mike, me lembra todo dia útil às 9h pra revisar o Instagram
Mike: ⏰ *Novo Lembrete:*
      📝 Revisar o Instagram
      🕐 09:00
      🔄 Dias úteis (seg-sex)

      Confirma? (sim/não)
Yuri: sim
Mike: Pronto, lembrete criado! Vou te avisar todo dia útil às 9h 📱
```

---

## Apêndice C — Diagrama de Tabelas Principais

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  user_profiles   │     │  calendar_items   │     │  kanban_cards    │
│─────────────────│     │──────────────────│     │─────────────────│
│ id (PK)         │◄────│ created_by (FK)   │     │ id (PK)         │
│ full_name       │     │ id (PK)           │     │ title           │
│ display_name    │     │ title             │     │ column_id (FK)──│──┐
│ role            │     │ start_time        │     │ priority        │  │
│ is_admin        │     │ end_time          │     │ content_type    │  │
│ phone           │     │ type              │     │ platforms       │  │
│ bio             │     │ location          │     │ brand           │  │
│ specializations │     │ participants      │     │ created_by (FK)─│──┤
│ whatsapp_jid    │     │ deleted_at        │     │ assigned_to     │  │
└────────┬────────┘     └──────────────────┘     │ deadline        │  │
         │                                        │ deleted_at      │  │
         │              ┌──────────────────┐     └─────────────────┘  │
         │              │  contacts         │                          │
         │              │──────────────────│     ┌─────────────────┐  │
         ├──────────────│ user_id (FK)      │     │ kanban_columns   │  │
         │              │ id (PK)           │     │─────────────────│  │
         │              │ name              │     │ id (PK)     ◄───│──┘
         │              │ phone             │     │ name            │
         │              │ type              │     │ slug            │
         │              │ notes             │     │ position        │
         │              └──────────────────┘     └─────────────────┘
         │
         │              ┌──────────────────────────┐
         │              │ whatsapp_scheduled_msgs    │
         │              │──────────────────────────│
         ├──────────────│ target_user_id (FK)       │
         │              │ id (PK)                   │
         │              │ content                   │
         │              │ scheduled_for             │
         │              │ status (pending/sent/...)  │
         │              │ recurrence                │
         │              │ source                    │
         │              │ metadata (JSONB)           │
         │              └──────────────────────────┘
         │
         │              ┌──────────────────────────┐
         │              │ whatsapp_messages          │
         │              │──────────────────────────│
         ├──────────────│ user_id (FK)              │
         │              │ id (PK)                   │
         │              │ direction (in/out)         │
         │              │ content                   │
         │              │ message_type              │
         │              │ chat_id                   │
         │              │ uazapi_message_id         │
         │              └──────────────────────────┘
         │
         │              ┌──────────────────────────┐
         │              │ user_notification_settings │
         │              │──────────────────────────│
         └──────────────│ user_id (FK, PK)          │
                        │ calendar_reminders        │
                        │ daily_summary_enabled     │
                        │ weekly_summary_enabled    │
                        │ monthly_summary_enabled   │
                        │ quiet_hours_enabled       │
                        │ quiet_hours_start/end     │
                        │ timezone                  │
                        └──────────────────────────┘
```

---

> **Fim do Relatório Executivo**
> Documento gerado em 09/02/2026 para contextualização completa do projeto LA Studio Manager + Mike.
> Total: ~1600 linhas | Última versão da Edge Function: v58 (245.6kB)

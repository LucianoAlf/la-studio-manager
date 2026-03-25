# Nina Studio — PRD Completo
**LA Studio Manager · v1.0 · Março 2026**
> Estúdio de Criação de Conteúdo com IA — Rota: `/studio`

---

## 1. Visão e Posicionamento

Nina Studio é o estúdio de criação de conteúdo da LA Music School, acessível pela rota `/studio` no LA Studio Manager. **Não é uma página de automação** — é o equivalente interno de um mLabs potencializado por IA, com acesso ao banco de fotos dos alunos, identidade visual da escola e agentes inteligentes.

### 1.1 Princípio Central

O mLabs é a referência de UX. Nina Studio tem as mesmas capacidades funcionais — calendário editorial, agendamento, relatórios, workflow de aprovação — mas com três diferenciais que o mLabs não tem:

- **IA generativa integrada** — Nina gera artes via Canva API + Gemini Imagen, Theo gera copy, Luna sugere ideias
- **Banco de fotos exclusivo** dos 1.181 alunos da LA Music School e LA Music Kids
- **Automações proprietárias** — aniversários, datas comemorativas, posts de alunos

### 1.2 Posição no Sistema

| Módulo | Rota | O que muda com Nina Studio |
|---|---|---|
| Kanban de Produção | `/projetos` | Permanece. Conectado ao Studio via `kanban_card_id` |
| Calendário Geral | `/calendario` | Permanece. Studio tem calendário editorial específico de redes sociais |
| Agentes IA | `/agentes` (em breve) | Studio é onde Yuri interage com Nina diretamente via dashboard |
| Configurações | `/configuracoes` | Studio tem `nina_config` próprio similar ao `mike_config` |
| **Nina Studio** | **`/studio` (NOVO)** | **Estúdio completo: criar, agendar, aprovar, publicar, analisar** |

---

## 2. Estrutura da Página `/studio`

Navegação horizontal por tabs. Layout: topbar de contexto fixo + tabs + área de conteúdo.

### 2.1 Topbar do Studio (persistente)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [🎵 LA Music School ▾]  ● Nina ativa  ──────  [✨ Criar] [🔔 3]    │
└─────────────────────────────────────────────────────────────────────┘
```

- **Seletor de marca:** `[🎵 LA Music School ▾]` / `[🎵 LA Music Kids ▾]`
- **Status da Nina:** ponto verde "Nina ativa" / cinza "Nina pausada"
- **Botão primário:** `[✨ Criar agora]` — atalho para Tab Criar
- **Badge:** `[🔔 3 aprovações pendentes]`

### 2.2 Tabs de Navegação

| # | Tab | Ícone | Descrição | Equivalente mLabs |
|---|---|---|---|---|
| 1 | Calendário | 📅 | Visão mensal/semanal de posts agendados e publicados | CALENDÁRIO |
| 2 | Criar | ✨ | Editor de conteúdo com IA — coração do Studio | AGENDAR POST |
| 3 | Banco de Fotos | 🖼️ | Grid dos 1.181 alunos + upload + gestão | — exclusivo |
| 4 | Automações | ⚡ | Aniversários, datas comemorativas, templates | — exclusivo |
| 5 | Performance | 📊 | Métricas Instagram/YouTube via API | RELATÓRIOS |
| 6 | Conexões | 🔗 | Gerenciar integrações | CONEXÕES |

---

## 3. Tab 1 — Calendário Editorial

### Descrição

Calendário focado exclusivamente em redes sociais. Instagram no MVP, YouTube e TikTok futuros.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ [📷 Instagram ×] [Status ▾] [Tipo ▾]          [< Março 2026 >]     │
│ [≡ Lista] [📅 Calendário ●]  [Semana ▾]              [+ Novo post] │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ Dom  │ Seg  │ Ter  │ Qua  │ Qui  │ Sex  │ Sáb  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│   1  │   2  │   3  │   4  │   5  │   6  │   7  │
│      │[📷]  │      │[📷]  │      │      │      │
│      │story │      │feed  │      │      │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│   8  │   9  │  10  │  11  │  12  │  13  │  14  │
│      │      │[📷]  │      │      │[📷]  │      │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

### Funcionalidades

- Visão mensal (padrão) e semanal — toggle
- Filtros: plataforma, status, tipo de conteúdo
- Células clicáveis → modal de detalhes do post
- Drag-and-drop para reagendar
- Status por cor: cinza=rascunho, laranja=aguardando aprovação, azul=agendado, verde=publicado, vermelho=falhou
- `[+ Novo post]` abre Tab Criar

### Dados

- `posts` WHERE `brand = marca_selecionada` AND `deleted_at IS NULL`
- JOIN `post_platforms` para múltiplas contas
- JOIN `post_metrics` para métricas nos posts publicados

---

## 4. Tab 2 — Criar

### Descrição

O coração do Studio. Editor com IA integrada. Layout de 3 colunas.

### Wireframe

```
┌──────────────────┬───────────────────────────────┬───────────────┐
│ COL 1 — CONFIG   │ COL 2 — CONTEÚDO              │ COL 3 — PREV  │
│ (~28%)           │ (~47%)                         │ (~25%)        │
│                  │                                │               │
│ 1. Marca         │ 3. Modo                        │ ┌───────────┐ │
│ [🎵 School ▾]    │ [🤖 Nina cria] [✏ Manual]     │ │           │ │
│                  │                                │ │  Preview  │ │
│ 2. Plataforma    │ 4. Brief para Nina             │ │  do Post  │ │
│ [📷 Instagram ▾] │ ┌──────────────────────────┐  │ │           │ │
│ [Story][Feed]    │ │ Descreva o post para      │  │ │ 📱 Story  │ │
│ [Reels][Carrossel│ │ a Nina...                 │  │ └───────────┘ │
│                  │ └──────────────────────────┘  │               │
│ 2a. Aluno        │ [✨ Gerar com Nina]            │ Formato:      │
│ [🔍 Buscar...]   │                                │ [📱][🔲][▶][📑]│
│                  │ 5. Arte gerada                 │               │
│ 3. Legenda       │ ┌──────────────────────────┐  │ [Enviar para  │
│ [Theo escreve ✨] │ │ [Preview 1080x1920]      │  │  aprovação]   │
│                  │ │ [Regenerar][Canva ↗]      │  │ [Publicar]    │
│ 4. Agendamento   │ └──────────────────────────┘  │ [Agendar ▾]   │
│ [📅 Data][⏰ h]  │                                │               │
└──────────────────┴───────────────────────────────┴───────────────┘
```

### Modos de Criação

| Modo | Descrição | Fluxo |
|---|---|---|
| 🤖 Nina cria | Yuri descreve em linguagem natural, Nina gera arte + Theo gera legenda | Brief → Gerar → Preview → Aprovar → Publicar |
| ✏ Manual | Upload de imagem/vídeo + escreve legenda | Upload → Legenda → Data → Publicar |
| 🎂 Aniversário | Arte personalizada para aniversariante do dia | Aluno → Template Canva → Customizar → Publicar |
| 📅 Data comemorativa | Usa o calendário comemorativo para gerar conteúdo | Data → Foto do aluno → Gerar → Publicar |
| 📸 Foto do aluno | Escolhe foto do banco + Nina gera frase | Foto → Tom/Estilo → Gerar frase → Publicar |
| 📑 Carrossel | Nina cria sequência de slides com tema definido | Tema → Qtd slides → Gerar → Revisar → Publicar |

### Stacks de Geração de Imagens

| Stack | Quando usar | Qualidade | Velocidade |
|---|---|---|---|
| **Canva API + Brand Kit** | Templates de aniversário, carrosseis de marca, posts estruturados com identidade visual | ⭐⭐⭐⭐⭐ | 🟡 Médio |
| **Gemini Imagen API** | Posts criativos com foto do aluno + frase sobreposta, artes comemorativas artísticas, composições com foto real | ⭐⭐⭐⭐⭐ | 🟢 Rápido |
| **SVG gerado** | Fallback quando APIs externas falham, posts simples de texto, aniversários sem foto | ⭐⭐⭐ | 🟢 Muito rápido |

> **Gemini Imagen:** modelo `gemini-2.0-flash-preview-image-generation`
> Suporta geração com imagem de referência — a foto do aluno entra como input e o modelo compõe a arte em volta dela.

### Fluxo de Aprovação

1. `[Enviar para aprovação]` → cria registro em `approvals` (status: `pending`) + notifica Yuri via WhatsApp com preview
2. Yuri responde no WhatsApp: "aprovar", "rejeitar" ou "ajustar [feedback]"
3. Mike processa resposta → atualiza `approvals`
4. Se aprovado → `status = 'approved'`, pode ser agendado ou publicado
5. Se ajustar → `revision_notes` vai para Nina → ela regenera com o feedback

### Edge Function `process-nina-request` (a criar)

**Input:**
```json
{
  "mode": "student_photo | birthday | commemorative | brief | carousel",
  "brand": "la_music_school | la_music_kids",
  "brief": "texto livre do Yuri",
  "student_id": "person_id do aluno (opcional)",
  "commemorative_date_id": "uuid (opcional)",
  "post_type": "story | feed | carousel | reels",
  "template_id": "canva_template_id (opcional)"
}
```

**Output:**
```json
{
  "image_url": "https://... (PNG no Supabase Storage)",
  "caption": "legenda sugerida pelo Theo",
  "hashtags": ["#LAMusic", "..."],
  "canva_edit_url": "https://canva.com/d/... (se gerado via Canva)"
}
```

**Lógica interna:**
```
1. Se tem template_id → Canva API (autofill campos dinâmicos → exporta PNG)
2. Se tem student_id + foto real → Gemini Imagen (foto como referência + prompt)
3. Se não tem foto → Gemini Imagen (geração pura por prompt com identidade visual)
4. Fallback → SVG gerado internamente
5. Upload PNG → Supabase Storage bucket 'posts'
6. Chama Theo (Gemini text) → gera legenda + hashtags
7. Retorna resultado
```

---

## 5. Tab 3 — Banco de Fotos

### Descrição

Central de gerenciamento das fotos dos 1.181 alunos. Fonte de imagens para todos os posts da Nina.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ BANCO DE FOTOS  (1.181 alunos)                                      │
│ [🔍 Buscar aluno...] [🎵 Escola ▾] [🎸 Instrumento ▾] [📸 Status ▾]│
│ [↑ Upload em lote]  [↑ Upload individual]   Exibindo 48 de 1.181   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │  📷  │ │  👤  │ │  📷  │ │  📷  │ │  👤  │ │  📷  │ │  👤  │  │
│ │ foto │ │avatar│ │ foto │ │ foto │ │avatar│ │ foto │ │avatar│  │
│ │ João │ │ Maria│ │Pedro │ │ Ana  │ │Lucas │ │Carla │ │Bruno │  │
│ │School│ │ Kids │ │School│ │School│ │ Kids │ │ Kids │ │School│  │
│ │  🎸  │ │  🎹  │ │  🥁  │ │  🎤  │ │  🎸  │ │  🎹  │ │  🎸  │  │
│ │ [↑]  │ │ [↑]  │ │ [↑]  │ │ [↑]  │ │ [↑]  │ │ [↑]  │ │ [↑]  │  │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
│  ● tem foto real   ○ sem foto (avatar gerado)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Funcionalidades

- Grid 7 colunas, 48 alunos por página, paginação
- Filtros: marca, instrumento, tem foto/sem foto, busca por nome
- **Upload individual:** clicar em `[↑]` → modal → comprime → Supabase Storage bucket `assets` → atualiza `file_url` e `metadata.has_real_photo = true`
- **Upload em lote:** drag-and-drop de pasta → match por nome → confirma → sobe com barra de progresso
- **Tags de instrumento:** ao fazer upload, taguear instrumento para Nina buscar "foto de baterista"
- **Click no card:** modal com histórico de posts em que apareceu, data de aniversário, instagram handle

### Upload em Lote — Fluxo

1. Yuri arrasta pasta (ex: `Fotos_dezembro_2025/`)
2. Sistema faz match por nome de arquivo → `assets.person_name`
3. Tabela de confirmação: `[arquivo.jpg] → [Aluno encontrado] [✓ | ✏ Trocar]`
4. Yuri corrige os não-encontrados
5. Upload em background com progresso

### Tags de instrumento

Usar `asset_tags` + `asset_tag_relations` já existentes. Tags base a criar:
`violão`, `guitarra`, `baixo`, `bateria`, `piano`, `teclado`, `canto`, `violino`, `sax`, `trompete`, `flauta`

---

## 6. Tab 4 — Automações

### Sub-tabs

| Sub-tab | Status | Descrição |
|---|---|---|
| 🎂 Aniversários | ✅ Funcionando | Posts diários às 14h SP — roda via cron |
| 📅 Datas Comemorativas | 🟡 UI pendente | 26 datas cadastradas |
| 📋 Templates | 🟡 UI pendente | Gerenciar templates Canva com campos dinâmicos |
| ⚙️ Configurações | 🟡 UI pendente | `nina_config`: modelo IA, aprovação, horários |

### Sub-tab Aniversários

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🎂 ANIVERSARIANTES                                    [Hoje ▾]      │
│ Próximos 7 dias                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ HOJE — 25 de Março                                                   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 📷 Carlos Silva · LA Music School · 15 anos hoje 🎉           │   │
│ │    [✅ Publicado às 14:00]  [Ver no Instagram ↗]              │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ AMANHÃ — 26 de Março                                                 │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 👤 Ana Beatriz · LA Music Kids · 8 anos amanhã                │   │
│ │    [🟡 Pendente]  [Publicar agora]  [Pular]                   │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ HISTÓRICO   Mar/2026: 12 publicados · 0 erros · 0 pulados  [Todos] │
└─────────────────────────────────────────────────────────────────────┘
```

### Sub-tab Datas Comemorativas

- Lista `commemorative_dates` ordenada por proximidade
- Badge: "Hoje", "Amanhã", "3 dias", "1 semana"
- `[Criar post]` → abre Tab Criar no modo comemorativo com data pré-selecionada
- Toggle por data: habilitar criação automática
- `[+ Nova data]` → formulário: nome, mês/dia, categoria, caption hint

### Sub-tab Templates

- Lista de `templates` (vazia → a popular)
- Card: thumbnail Canva, nome, tipo, marca, vezes usado
- `[+ Vincular template Canva]` → cole design ID → sistema busca via API → salva thumbnail + campos
- Campos dinâmicos: `{{nome}}`, `{{foto}}`, `{{frase}}`, `{{idade}}`
- Preview com dados reais de um aluno ao clicar

### Sub-tab Configurações — `nina_config` (tabela a criar)

```sql
CREATE TABLE nina_config (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled                 BOOLEAN DEFAULT true,
  default_ai_model           TEXT DEFAULT 'gemini-2.0-flash-preview-image-generation',
  auto_publish_birthdays     BOOLEAN DEFAULT true,
  birthday_approval_required BOOLEAN DEFAULT false,
  default_post_time          TIME DEFAULT '14:00:00',
  default_brand              TEXT DEFAULT 'la_music_school',
  canva_brand_kit_school     TEXT DEFAULT 'kAFo5_-JW7Q',
  canva_brand_kit_kids       TEXT,
  gemini_image_style         TEXT DEFAULT 'vibrant photographic',
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Tab 5 — Performance

### Seções

| Seção | Dados | Source |
|---|---|---|
| Resumo geral | Alcance, engajamento, taxa de eng., frequência | Meta Graph API `/insights` |
| Melhores posts | Top 10 por engajamento no período | `post_metrics JOIN posts` |
| Seguidores | Crescimento no período | Meta Graph API `/followers` |
| Por tipo | Engajamento médio por tipo (story/feed/reels) | `post_metrics GROUP BY post_type` |
| Melhores horários | Análise por dia/hora | Ada processa `post_metrics` |
| Nina vs Manual | Posts `created_by_ai=true` vs `false` | `posts.created_by_ai` |

### Insights da Ada

- Ada analisa `post_metrics` → escreve em `agent_memory_facts` com `category = 'platform_rule'`
- Exemplo: *"Posts com foto de aluno têm 40% mais engajamento que artes geradas por IA"*
- Esses fatos são injetados no system_prompt da Nina dinamicamente
- Relatório semanal enviado para Yuri via WhatsApp (Mike já faz via `process-scheduled-tasks`)

### Edge Function `collect-post-metrics` (a criar)

- Cron diário às 6h UTC
- Para cada `post` com `status = 'published'` nos últimos 30 dias
- `GET /v21.0/{instagram_post_id}/insights?metric=reach,impressions,likes,comments,shares,saves`
- Salva em `post_metrics` + atualiza `daily_metrics_summary`

---

## 8. Tab 6 — Conexões

| Integração | Status | Expira | Ação |
|---|---|---|---|
| 📷 Instagram LA Music School | ✅ Ativo | 24/05/2026 | Reconectar |
| 📷 Instagram LA Music Kids | ✅ Ativo | 24/05/2026 | Reconectar |
| 🎨 Canva | 🟡 Parcial (sem OAuth) | — | Conectar via OAuth |
| 🤖 Gemini API | ✅ Configurado | — | Ver status |
| 📊 Meta Business | 🔴 Não conectado | — | Conectar |
| ▶ YouTube Analytics | 🔵 Futuro | — | Em desenvolvimento |
| ♪ TikTok | 🔵 Futuro | — | Em desenvolvimento |

---

## 9. Banco de Dados

### Tabelas que JÁ EXISTEM e serão usadas

| Tabela | Rows | Uso no Studio |
|---|---|---|
| `posts` | 0 (pronto) | Posts criados/agendados/publicados — `post_type`, `status`, `brand`, `scheduled_for`, `created_by_ai` |
| `assets` | 1.181 | Banco de fotos — `birth_date`, `instagram_handle`, `person_name`, `brand` |
| `templates` | 0 (pronto) | Templates Canva — `canva_template_id`, `editable_fields`, `thumbnail_url` |
| `post_metrics` | 0 (pronto) | Métricas — `views`, `likes`, `comments`, `shares`, `saves`, `engagement_rate` |
| `daily_metrics_summary` | 0 (pronto) | Resumo diário — `followers_count`, `total_engagement` |
| `approvals` | 0 (pronto) | Aprovações — `status`, `feedback`, `revision_notes`, `whatsapp_message_id` |
| `post_versions` | 0 (pronto) | Histórico de versões — para regenerações da Nina |
| `commemorative_dates` | 26 | Datas comemorativas musicais |
| `birthday_automation_log` | 2 | Log de posts de aniversário |
| `campaigns` | 0 (pronto) | Campanhas — agrupa posts relacionados |
| `ai_agents` | 6 | Nina (com system_prompt), Theo, Luna, Atlas, Ada, Maestro |
| `asset_tags` | 0 | Tags de instrumento para busca da Nina |
| `integration_credentials` | 3 | `instagram_school` ✅, `instagram_kids` ✅, `canva` 🟡 |

### O que precisa ser CRIADO

| Item | Tipo | Motivo |
|---|---|---|
| `nina_config` | Nova tabela | Config da Nina: modelo IA, aprovação automática, horário padrão, brand kit IDs |
| `studio_publish_queue` | Nova tabela | Fila de publicação com retry logic |
| Tags de instrumento | Seed em `asset_tags` | violão, guitarra, bateria etc. para busca por instrumento |
| Gemini API key | `integration_credentials` | Adicionar como nova credencial (variável de ambiente no Supabase) |

---

## 10. Edge Functions a Criar

| Função | Prioridade | Descrição |
|---|---|---|
| `process-nina-request` | 🔴 MVP | Agente Nina: brief → Canva API ou Gemini Imagen → PNG → retorna `image_url` + legenda |
| `publish-scheduled-posts` | 🔴 MVP | Cron a cada 5min: publica posts com `status='approved'` e `scheduled_for <= now()` |
| `collect-post-metrics` | 🔴 MVP | Cron diário: coleta métricas dos posts publicados via Meta Graph API |
| `canva-autofill` | 🟡 Fase 2 | `template_id` + campos → Canva Autofill API → exporta PNG |
| `collect-youtube-metrics` | 🔵 Futuro | YouTube Analytics API |
| `process-video-edit` | 🔵 Futuro | Edição de vídeo para Reels automáticos |

### Como o Gemini Imagen funciona na Nina

```
Yuri: "Nina, faz um post do Dia do Guitarrista com foto do João"

Nina:
1. Busca foto do João em assets
   (person_name LIKE '%João%' AND tag = 'guitarra')
2. Baixa foto como base64
3. Chama Gemini Imagen com:
   - imagem de referência: foto do João
   - prompt: "Post Instagram escola de música, Dia do Guitarrista,
     aluno tocando guitarra, fundo teal e dourado, texto em destaque,
     estilo vibrante profissional, identidade LA Music School"
4. Recebe PNG 1080x1080 gerado
5. Upload no Supabase Storage bucket 'posts'
6. Chama Gemini text → gera legenda + hashtags (Theo)
7. Retorna para preview no Studio
```

---

## 11. Roadmap

### MVP — construir agora

| Fase | O que entra | Quem faz |
|---|---|---|
| **MVP 1 — Backend** | `nina_config`, `process-nina-request` (Gemini Imagen + SVG fallback), `publish-scheduled-posts`, `collect-post-metrics` | Claude (Supabase direto) |
| **MVP 2 — Frontend** | Tab Calendário, Tab Criar (Nina + Manual), Tab Banco de Fotos, Tab Automações | Cascade (Next.js) |
| **MVP 3 — Canva** | `canva-autofill`, Tab Templates, templates dinâmicos com campos `{{nome}}` `{{foto}}` | Claude + Cascade |
| **MVP 4 — Performance** | Tab Performance, `collect-post-metrics` cron, insights básicos da Ada | Claude + Cascade |

### Fase 2 — Próximo trimestre

- Gemini Imagen avançado: composição com foto do aluno + fundo + texto estilizado
- Carrossel automático via Canva API: Nina cria múltiplos slides em sequência
- Aprovação via WhatsApp com preview da imagem (não só texto)
- Upload em lote com matching automático por nome
- Ada aprende por post: `agent_memory_facts` alimenta o estilo de geração da Nina

### Fase 3 — Futuro

- Edição de vídeo: Reels e Shorts automáticos
- YouTube: publicação e métricas
- TikTok: publicação via API
- Campanha inteligente: Luna propõe → Atlas planeja → Nina gera tudo de uma vez
- Nina aprende com performance: correlaciona estilo de arte + horário + engajamento

---


## Apêndice — Estado do Banco (`rhxqwraqpabgecgojytj`)

| Tabela | Rows | Status |
|---|---|---|
| `posts` | 0 | ✅ Estrutura pronta |
| `assets` | 1.181 | ✅ Alunos com nome + aniversário. Sem fotos reais ainda |
| `templates` | 0 | ✅ Estrutura pronta |
| `post_metrics` | 0 | ✅ Estrutura pronta |
| `approvals` | 0 | ✅ Estrutura pronta |
| `commemorative_dates` | 26 | ✅ 13 datas originais + extensões |
| `birthday_automation_log` | 2 | ✅ Testes de hoje |
| `integration_credentials` | 3 | `instagram_school` ✅ · `instagram_kids` ✅ · `canva` 🟡 |
| `ai_agents` | 6 | Nina ✅ · todos ativos |
| `platforms` | 4 | Instagram, YouTube, TikTok, Facebook |

---

*Próximo passo imediato: MVP 1 Backend — criar `nina_config`, deploy de `process-nina-request` com Gemini Imagen, e `publish-scheduled-posts`.*
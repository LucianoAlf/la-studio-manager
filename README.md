# 🎸 LA Studio Manager

> Mission Control de Marketing — LA Music School

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **UI**: shadcn/ui + TailwindCSS + Phosphor Icons (duotone)
- **Tipografia**: Geist Sans + Mono
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime)
- **Automação**: n8n (workflows externos)
- **Deploy**: Vercel

## Setup Rápido

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Supabase

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com a URL e Anon Key do seu projeto Supabase.

### 3. Aplicar migrations

Se usando Supabase CLI local:

```bash
npx supabase db push
```

Ou aplique os arquivos SQL em `supabase/migrations/` diretamente no SQL Editor do Supabase Dashboard, na ordem numérica.

### 4. Criar primeiro usuário

No Supabase Dashboard → Authentication → Users → criar os usuários do time.
Depois, inserir os perfis via SQL:

```sql
INSERT INTO user_profiles (user_id, full_name, display_name, role) VALUES
  ('<yuri-user-id>', 'Yuri', 'Yuri', 'admin'),
  ('<john-user-id>', 'John', 'John', 'editor'),
  ('<rayan-user-id>', 'Rayan', 'Rayan', 'editor'),
  ('<alf-user-id>', 'Alf', 'Alf', 'developer'),
  ('<hugo-user-id>', 'Hugo', 'Hugo', 'developer');
```

### 5. Rodar o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/           → Login
│   ├── (dashboard)/      → Páginas autenticadas
│   │   ├── projetos/     → Painel de projetos (7 views)
│   │   ├── calendario/   → Super calendário
│   │   ├── agentes/      → Agentes de IA
│   │   ├── ativos/       → Banco de mídias
│   │   ├── relatorios/   → Analytics
│   │   └── configuracoes/→ Settings
│   ├── layout.tsx        → Root layout (fonts, theme)
│   └── globals.css       → Design tokens
├── components/
│   ├── ui/               → shadcn/ui customizados
│   ├── layout/           → Sidebar, Header
│   └── [feature]/        → Componentes por feature
├── lib/
│   ├── supabase/         → Client, server, middleware
│   ├── constants.ts      → Nav, kanban, teams, agents
│   └── utils.ts          → cn(), formatDate, etc.
├── hooks/                → Custom hooks
├── types/                → TypeScript types
└── middleware.ts         → Auth middleware
```

## Design System

- **Cor primária**: Teal (#1AA8BF)
- **Cor accent**: Orange (#F97316)
- **Dark mode**: Default
- **Border radius**: 10px (padrão), 14px (cards)
- **Espaçamento**: Base-4 (4, 8, 12, 16, 24, 32...)

Ver `.cursorrules` para guia completo do Design System.

## Banco de Dados

6 migrations em `supabase/migrations/`:

1. **001**: Enums + User Profiles
2. **002**: Kanban (columns, cards, history, comments, checklists, attachments)
3. **003**: Calendar (items, connections, comments)
4. **004**: Posts, Platforms, Assets, Templates
5. **005**: Approvals, Metrics, Campaigns, AI Agents, Notifications
6. **006**: Seed data + Storage buckets

## Time

| Nome  | Role       | Função no App   |
|-------|------------|-----------------|
| Yuri  | admin      | Líder Marketing |
| John  | editor     | Produção        |
| Rayan | editor     | Tráfego         |
| Alf   | developer  | Desenvolvimento |
| Hugo  | developer  | Desenvolvimento |

---

**LA Music School** — A maior escola de música do Brasil 🎵

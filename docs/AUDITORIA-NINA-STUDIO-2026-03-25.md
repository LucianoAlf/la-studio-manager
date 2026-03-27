# Auditoria Nina Studio — 25/03/2026

**Objetivo**: Contextualizar o Claude sobre o estado atual do Nina Studio para definir próximos passos de implementação.

---

## 1. Infraestrutura Backend — COMPLETA ✅

### Edge Functions Deployadas (9 funções ativas)

| Função | Versão | Status | Descrição |
|--------|--------|--------|-----------|
| `process-nina-request` | v12 | ✅ Ativo | Core da Nina - gera artes com foto real + overlay texto |
| `publish-scheduled-posts` | v1 | ✅ Ativo | Publica posts agendados no Instagram |
| `collect-post-metrics` | v1 | ✅ Ativo | Coleta métricas dos posts via Meta Graph API |
| `birthday-automation` | v2 | ✅ Ativo | Gera e publica posts de aniversário automaticamente |
| `process-video` | v1 | ✅ Ativo | Processamento de vídeo (futuro: Reels) |
| `process-whatsapp-message` | v96 | ✅ Ativo | Mike processa mensagens WhatsApp |
| `process-scheduled-tasks` | v11 | ✅ Ativo | Tarefas agendadas (lembretes, resumos) |
| `manage-team` | v4 | ✅ Ativo | Gestão de equipe |
| `receive-student-data` | v2 | ✅ Ativo | Recebe dados de alunos do Emusys |

### Crons Ativos

| Job | Schedule | Função |
|-----|----------|--------|
| `birthday-automation-daily` | 17h UTC (14h BR) | Publica aniversários automaticamente |
| `studio-publish-scheduled` | */5 min | Publica posts com `scheduled_for <= now()` |
| `studio-collect-metrics` | 6h UTC (3h BR) | Coleta métricas Instagram |

### Tabelas do Studio

| Tabela | Rows | Status |
|--------|------|--------|
| `nina_config` | 1 | ✅ Configurada |
| `posts` | 0 | ✅ Pronta (vazia) |
| `approvals` | 0 | ✅ Pronta |
| `assets` | 1.181 | ✅ Alunos importados |
| `post_metrics` | 0 | ✅ Pronta |
| `post_versions` | 0 | ✅ Pronta |
| `studio_publish_queue` | ? | ✅ Criada |
| `studio_videos` | ? | ✅ Criada |
| `studio_clips` | ? | ✅ Criada |
| `asset_tags` | 0 | ✅ Pronta |
| `asset_tag_relations` | 0 | ✅ Pronta |

### nina_config (Configuração Atual)

```json
{
  "is_enabled": true,
  "default_ai_model": "gemini-2.0-flash",
  "auto_publish_birthdays": true,
  "birthday_approval_required": false,
  "default_post_time": "14:00:00",
  "default_brand": "la_music_school",
  "canva_brand_kit_school": "kAFo5_-JW7Q",
  "canva_brand_kit_kids": null,
  "gemini_image_style": "vibrant photographic professional",
  "auto_commemorative_posts": false,
  "commemorative_approval_required": true
}
```

---

## 2. process-nina-request v12 — Como Funciona

### Input esperado
```json
{
  "mode": "brief | birthday | commemorative | student_photo",
  "brand": "la_music_school | la_music_kids",
  "brief": "texto livre descrevendo o post",
  "post_type": "story | feed | carousel | reels",
  "reference_image_url": "URL da foto real do Storage (opcional)",
  "event_asset_id": "UUID do asset de evento (opcional)",
  "student_name": "nome do aluno (opcional)",
  "event_name": "nome do evento (opcional)"
}
```

### Output
```json
{
  "image_url": "https://...supabase.co/storage/v1/object/public/posts/nina/...",
  "caption": "legenda gerada pelo Gemini",
  "hashtags": ["#LAMusic", "#EscolaDeMúsica", ...],
  "main_phrase": "frase curta (máx 6 palavras)",
  "generation_method": "real_photo_overlay | svg_no_photo"
}
```

### Fluxo interno (v12)
1. Recebe `reference_image_url` ou `event_asset_id`
2. Baixa a foto real do Storage
3. Gemini 2.0 Flash gera frase curta (máx 6 palavras)
4. Monta SVG: foto real + gradiente escuro na base + texto com stroke+fill
5. Converte SVG → PNG via resvg-wasm
6. Upload para `posts/nina/{timestamp}.png`
7. Gemini gera caption + hashtags
8. Retorna resultado

### Bug conhecido (v12)
- Texto às vezes não aparece na foto
- Causa: `paint-order` no resvg-wasm
- Fix proposto: texto renderizado duas vezes (stroke preto + fill branco)
- Status: aguardando confirmação de teste

---

## 3. Integrações — Status

| Integração | Status | Detalhes |
|------------|--------|----------|
| Instagram LA Music School | ✅ Funcionando | Já publicou posts de teste |
| Instagram LA Music Kids | ✅ Funcionando | Token válido |
| Canva App | 🟡 Parcial | App ID: `AAHAAG7XCH8`, Brand Kit: `kAFo5_-JW7Q` |
| Gemini API | ✅ Configurado | gemini-2.0-flash |
| WhatsApp (Mike) | ✅ Funcionando | v96 |

---

## 4. Frontend — Estado Atual

### Aba "Criar" (`/studio` → tab "Criar")

**O que funciona:**
- UI renderiza corretamente (3 colunas)
- Seletor de marca (School/Kids)
- Seletor de plataforma (Story/Feed/Reels/Carrossel)
- Campo de brief para Nina
- Botão "Gerar com Nina" → chama `process-nina-request`
- Preview da imagem gerada
- Campo de legenda editável
- Seletor de data/hora

**O que NÃO funciona:**
- Campo "Buscar aluno" → desconectado (sem funcionalidade)
- Botão "Regenerar" → disabled
- Botão "Editar no Canva" → disabled
- Botão "Enviar para aprovação" → sem handler
- Botão "Agendar ▾" → sem dropdown/handler
- Não passa `reference_image_url` para a Nina (sempre gera sem foto)

### Aba "Banco de Fotos"

**O que funciona:**
- Grid de alunos com fotos
- Filtro Alunos/Eventos
- Upload individual (trocar foto de aluno)
- Upload de evento com pasta (webkitdirectory)
- Cards agrupados por evento com preview 2x2
- CRUD: adicionar fotos, excluir evento
- Upload paralelo (5 simultâneos) com progresso

**Dados:**
- 1.181 alunos (maioria sem foto real)
- 1 evento: "FOTOS LA MUSIC KIDS" com 14 fotos

---

## 5. Fotos de Eventos — O Foco Principal

O usuário esclareceu:
> "Não precisa de busca por nome de aluno. O foco é usar as **fotos reais dos EVENTOS** (milhares de fotos). As artes são estáticas para Instagram — não precisa personalizar com nome do aluno."

### Fluxo desejado (automatizado pela Nina):
1. Nina acessa fotos de eventos no banco (`assets` com `event_name IS NOT NULL`)
2. Seleciona uma foto automaticamente (critérios a definir)
3. Gera arte com a foto real + texto/branding
4. Publica automaticamente no Instagram

### Dados atuais de eventos:
```sql
SELECT event_name, event_date, brand, COUNT(*) as total_fotos
FROM assets
WHERE event_name IS NOT NULL AND deleted_at IS NULL
GROUP BY event_name, event_date, brand;

-- Resultado:
-- "FOTOS LA MUSIC KIDS" | 2026-03-24 | la_music_kids | 14 fotos
```

---

## 6. Perguntas para Definir Implementação

1. **Seleção automática de foto**: Como a Nina deve escolher qual foto usar?
   - Aleatória do evento mais recente?
   - Baseada em critérios (qualidade, composição)?
   - Rotação para não repetir?

2. **Frequência de posts**: Quantos posts por dia/semana?

3. **Tipos de post**:
   - Só fotos de eventos?
   - Aniversários já estão automatizados
   - Datas comemorativas também?

4. **Aprovação**:
   - Publicar direto sem aprovação?
   - Ou enviar preview para Yuri aprovar via WhatsApp?

5. **Fluxo manual na aba "Criar"**:
   - Ainda precisa funcionar para casos especiais?
   - Ou é 100% automatizado pela Nina?

---

## 7. Próximos Passos Sugeridos

### Opção A: 100% Automatizado
A Nina roda sozinha, seleciona fotos de eventos, gera artes e publica sem intervenção humana.

**Implementação:**
1. Criar cron `nina-daily-event-post` que:
   - Busca foto de evento não usada
   - Chama `process-nina-request` com `reference_image_url`
   - Cria post com `status = 'scheduled'`
   - `publish-scheduled-posts` publica no horário

### Opção B: Semi-automatizado
Nina sugere posts, Yuri aprova via WhatsApp antes de publicar.

**Implementação:**
1. Mesmo fluxo do A, mas com `status = 'awaiting_approval'`
2. Mike envia preview para Yuri
3. Yuri responde "ok" ou "ajustar X"
4. Se ok → muda para `scheduled` → publica

### Opção C: Manual via UI
Yuri vai na aba "Criar", seleciona foto de evento, gera com Nina, agenda.

**Implementação:**
1. Adicionar botão "Selecionar do banco" na aba Criar
2. Abre modal com fotos de eventos
3. Ao selecionar, passa como `reference_image_url`
4. Gerar → Preview → Agendar

---

## 8. Conclusão

A infraestrutura backend está **100% pronta**:
- Edge Functions deployadas e funcionando
- Crons configurados
- Tabelas criadas
- Integrações ativas (Instagram, Gemini)

O que falta definir é o **fluxo de uso das fotos de eventos**:
- Quem seleciona a foto? (Nina automaticamente ou Yuri manualmente)
- Quando publicar? (frequência)
- Precisa de aprovação?

**Aguardando decisão do Claude (Cascade) para implementar.**

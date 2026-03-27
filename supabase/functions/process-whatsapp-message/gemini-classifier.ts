/**
 * gemini-classifier.ts
 * Classifica mensagens do WhatsApp usando Gemini API
 * Retorna intent + entidades extraídas em JSON estruturado
 */

import { getLaMusicKnowledgeCondensed } from './mike-knowledge-base.ts'
import { getDefaultAiModel, getFallbackAiModel, getMaxOutputTokens } from './group-config.ts'

// ============================================
// TIPOS
// ============================================

export interface ClassificationResult {
  intent: Intent
  confidence: number
  entities: ExtractedEntities
  response_text: string
  needs_confirmation: boolean
}

export type Intent =
  | 'create_card'
  | 'create_calendar'
  | 'create_reminder'
  | 'update_reminder'
  | 'cancel_reminder'
  | 'update_calendar'
  | 'cancel_calendar'
  | 'save_contact'
  | 'query_contact'
  | 'query_calendar'
  | 'query_cards'
  | 'query_projects'
  | 'generate_report'
  | 'update_card'
  | 'notify_user'
  | 'approve_clips'
  | 'list_clips'
  | 'select_clip'
  | 'select_format'
  | 'set_mentions'
  | 'set_schedule'
  | 'confirm_publish'
  | 'cancel_publish'
  | 'delegate_to_john'
  | 'general_chat'
  | 'help'
  | 'unknown'

export interface ExtractedEntities {
  // Card / Calendar
  title?: string
  description?: string
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  content_type?: 'video' | 'carousel' | 'reels' | 'story' | 'photo' | 'live'
  platforms?: ('instagram' | 'youtube' | 'tiktok' | 'facebook' | 'whatsapp')[]
  brand?: 'la_music' | 'la_kids'

  // Calendar específico
  date?: string
  time?: string
  duration_minutes?: number
  calendar_type?: 'event' | 'delivery' | 'creation' | 'task' | 'meeting'
  location?: string
  participants?: string

  // Kanban específico
  column?: 'brainstorm' | 'planning' | 'todo' | 'capturing' | 'editing' | 'awaiting_approval' | 'approved' | 'published' | 'archived'
  deadline?: string           // Prazo da tarefa (ex: "terça-feira", "amanhã", "15/02")
  assigned_to?: string        // Responsável pela tarefa (nome da pessoa)

  // Query
  query_period?: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month'
  query_filter?: string
  query_title?: string          // Busca por título de evento/card (ex: "reunião", "entrega do vídeo")
  query_participant?: string    // Busca por participante (ex: "John", "Jereh")
  query_self?: boolean          // true quando o usuário pergunta sobre SEUS PRÓPRIOS eventos ("as minhas", "meus eventos")

  // Reminder
  reminder_date?: string
  reminder_time?: string
  reminder_text?: string
  reminder_recurrence?: 'daily' | 'weekdays' | 'weekly' | 'monthly' | null
  reminder_search_text?: string   // Texto para buscar lembrete existente (update/cancel)
  reminder_new_time?: string      // Novo horário para update_reminder
  reminder_new_date?: string      // Nova data para update_reminder
  reminder_new_recurrence?: 'daily' | 'weekdays' | 'weekly' | 'monthly' | null

  // Calendar update/cancel
  event_search_text?: string      // Texto para buscar evento existente (título, participante, dia)
  event_new_date?: string         // Nova data para update_calendar
  event_new_time?: string         // Novo horário para update_calendar
  event_new_location?: string     // Novo local para update_calendar
  event_new_title?: string        // Novo título para update_calendar

  // Contacts (agenda)
  contact_name?: string
  contact_phone?: string
  contact_type?: string  // fornecedor, aluno, cliente, parceiro, artista, outro
  notes?: string

  // Notify user
  notify_target?: string       // Nome da pessoa a notificar
  notify_message?: string      // Mensagem ou contexto a enviar
  card_title?: string          // Título do card relacionado (se mencionado)

  // Clips approval (Submagic → Instagram) — LEGADO (mantido para compatibilidade)
  approval_type?: 'all' | 'top_n' | 'specific'
  approval_count?: number
  approval_indices?: number[]
  publish_format?: 'reels' | 'stories'

  // Clips approval — NOVO FLUXO CONVERSACIONAL
  clip_index?: number                            // Número do clip selecionado (1-10)
  format?: 'R' | 'S' | 'RS'                      // R=Reels, S=Stories, RS=ambos
  mentions?: string[]                            // @usernames para marcar
  skip_mentions?: boolean                        // true se "pular" ou "sem marcação"
  schedule_type?: 'now' | 'scheduled'            // Publicar agora ou agendar
  schedule_datetime?: string                     // ISO datetime se agendado

  // Genérico
  raw_text?: string
}

// ============================================
// SYSTEM PROMPT
// ============================================

function buildSystemPrompt(): string {
  // Calcular data/hora atual em São Paulo (UTC-3) para o Gemini saber o contexto temporal
  const now = new Date(Date.now() - 3 * 60 * 60000)
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const diaSemana = dias[now.getUTCDay()]
  const dia = now.getUTCDate()
  const mes = meses[now.getUTCMonth()]
  const ano = now.getUTCFullYear()
  const hora = now.getUTCHours().toString().padStart(2, '0')
  const minuto = now.getUTCMinutes().toString().padStart(2, '0')
  const dataAtual = `${diaSemana}, ${dia} de ${mes} de ${ano}, ${hora}:${minuto} (horário de São Paulo)`

  // Injetar knowledge base condensado
  const knowledge = getLaMusicKnowledgeCondensed()

  return `Você é o Mike, membro sênior da equipe de marketing do Grupo LA Music.
Você NÃO é um chatbot genérico. Você é um profissional de marketing digital que trabalha dentro da equipe, conhece o negócio profundamente e contribui ativamente nas decisões e produção de conteúdo.

SUA EQUIPE:
- Luciano Alf — Diretor da LA Music (seu chefe)
- Yuri Santos — Líder de Marketing (seu parceiro direto)
- John — Filmmaker e Editor de vídeo
- Rayan — Gestor de Tráfego Pago
- Jereh — Auxiliar de Conteúdo
Trata todo mundo pelo primeiro nome. Direciona sugestões para a pessoa certa.

PERSONALIDADE:
- Tom: informal brasileiro, direto, colega de trabalho carioca
- Profissional que sabe o que fala, mas sem arrogância
- Quando perguntam opinião, SEMPRE dá resposta substancial com sugestões concretas e explica o PORQUÊ
- Sempre que sugerir algo, oferece criar card/agendar
- Sabe fazer perguntas inteligentes quando precisa de dados reais ("Qual post performou melhor?", "Quantos seguidores tem hoje?")
- Crítica construtiva: fala com respeito mas com clareza

FORMATAÇÃO (WhatsApp — OBRIGATÓRIO):
- Use *negrito* para títulos e destaques (WhatsApp usa asterisco)
- Listas SEMPRE com emoji no início de cada item + quebra de linha entre itens
- Separe blocos/seções com uma linha em branco
- Respostas curtas (1-2 frases): texto corrido, sem lista
- Respostas médias (3+ itens): use lista com emojis
- Respostas longas (opinião/estratégia): divida em blocos com título em negrito + lista abaixo
- NUNCA faça um parágrafo corrido com mais de 3 linhas — quebre em tópicos
- Emojis: 2-5 por mensagem, usados como marcadores de lista ou destaque (não decorativos)

Exemplo de resposta BEM formatada:
"🎸 *Instrumentos em Campo Grande:*

🥁 Bateria
🎤 Canto
🎹 Teclado e Piano
🎸 Guitarra, Violão e Contrabaixo
🎻 Violino
🪈 Flauta e Saxofone
🪕 Ukulele

✨ *Exclusivos de CG:*
🎧 Produção Musical (Home Studio)
🎭 Teatro Musical

Quer que eu crie um card ou material visual com essa lista?"

REGRAS ABSOLUTAS:
1. NUNCA invente métricas, números de seguidores ou dados de performance. Se não sabe, PERGUNTE pra equipe.
2. NUNCA passe preços ou valores de matrícula. Direcione para: Vitória (CG), Clayton (Recreio), Angélica (Barra).
3. SEMPRE ofereça transformar sugestões em ações concretas (cards/agenda).
4. SEMPRE direcione tarefas pra pessoa certa da equipe.
5. Respostas de opinião/estratégia: 8-20 linhas. Respostas operacionais: 3-8 linhas.
6. Em grupo, mencione a pessoa pelo nome quando responder.
7. Quando o assunto NÃO é marketing, responda normalmente como assistente.

EXPERTISE: Produção de conteúdo, Social Media (Instagram/YouTube/TikTok), Copywriting, Direção criativa, Planejamento editorial, Estratégia de captação de alunos, Tráfego pago (conceitos).

${knowledge}

📅 DATA/HORA ATUAL: ${dataAtual}
⚠️ IMPORTANTE: Use SEMPRE o ano ${ano} ao resolver datas. "Amanhã" = próximo dia de ${ano}, "sexta" = próxima sexta-feira de ${ano}. NUNCA retorne datas de anos anteriores. Para datas relativas como "amanhã", "sexta", etc., retorne em formato relativo (ex: "amanhã", "sexta") e NÃO em formato ISO.

## SEU PAPEL

Você é um classificador de intenções E consultor criativo. Sua função é:
1. Identificar o que o usuário quer fazer (criar, consultar, conversar, pedir opinião)
2. Extrair entidades relevantes da mensagem
3. Responder com JSON estruturado
4. Para general_chat: gerar response_text com expertise real de marketing (use os dados da LA Music acima)

### REGRAS DE CLASSIFICAÇÃO

- **Perguntas sobre eventos/reuniões/agenda/compromissos/calendário** → SEMPRE classifique como query_calendar (o sistema vai buscar no banco com filtro de data correto). NUNCA responda sobre agenda/calendário como general_chat, mesmo que os eventos estejam visíveis no contexto.
- **Perguntas sobre cards/tarefas/kanban** → SEMPRE classifique como query_cards
- **Pedidos para criar algo** → Classifique como create_card / create_calendar / create_reminder
- **Pedidos para alterar/adiar evento** → SEMPRE classifique como update_calendar
- **Pedidos para cancelar/excluir evento** → SEMPRE classifique como cancel_calendar
- **Saudações, conversa livre, agradecimentos, pedidos de opinião, brainstorm, ideias** → general_chat
- Na DÚVIDA entre general_chat e query_*, prefira query_* (é melhor consultar o banco do que inventar)
- ⚠️ REGRA ABSOLUTA: Consultas sobre "agenda de hoje", "compromissos de amanhã", "o que tem essa semana", "meus eventos", "minhas reuniões" → SEMPRE query_calendar. O contexto de calendário no prompt é apenas para referência de update/cancel, NUNCA para responder consultas.

## INTENÇÕES POSSÍVEIS

1. **create_card** — Criar card no Kanban
   Gatilhos: "cria um card", "adiciona tarefa", "novo card", "preciso fazer", "bota no kanban"
   Entidades: title, priority, content_type, platforms, brand, column, description

2. **create_calendar** — Criar item no calendário
   Gatilhos: "agenda pra", "marca pra", "reunião dia", "gravação dia", "entrega dia", "tenho uma reunião"
   Entidades: title, date, time, duration_minutes, calendar_type, platforms, content_type, location, participants

3. **create_reminder** — Criar lembrete
   Gatilhos: "me lembra", "lembrete pra", "não deixa eu esquecer"
   Entidades: reminder_text, reminder_date, reminder_time, reminder_recurrence
   
   **RECORRÊNCIA em lembretes:**
   - Se o usuário diz "toda segunda", "todo dia", "diariamente" → reminder_recurrence = "weekly" (ou "daily")
   - "toda segunda-feira" / "toda terça" / "toda sexta" → reminder_recurrence = "weekly", reminder_date = dia da semana mencionado
   - "todo dia" / "diariamente" / "todos os dias" → reminder_recurrence = "daily"
   - "dias úteis" / "de segunda a sexta" → reminder_recurrence = "weekdays"
   - "todo mês" / "mensalmente" / "todo dia 15" → reminder_recurrence = "monthly"
   - Se NÃO mencionar recorrência → reminder_recurrence = null (lembrete único)
   - Se não ficou claro se é único ou recorrente, deixe reminder_recurrence = null e o sistema vai perguntar

4. **query_calendar** — Consultar agenda NO BANCO DE DADOS
   Gatilhos: "o que tem hoje", "agenda da semana", "o que tem amanhã", "próximos eventos", "qual o dia da reunião com X?", "quando é a reunião?"
   Entidades: query_period, query_filter, query_title, query_participant
   
   **IMPORTANTE para query_calendar:**
   - Se o usuário pergunta sobre um evento ESPECÍFICO (ex: "reunião com o John", "entrega do vídeo"), extraia query_title e/ou query_participant. NÃO defina query_period.
   - Se o usuário pergunta sobre um PERÍODO (ex: "o que tem amanhã?", "agenda da semana"), extraia query_period. NÃO defina query_title/query_participant.
   - Se o usuário pergunta sobre SEUS PRÓPRIOS eventos ("e as minhas?", "meus eventos", "minhas reuniões", "minha agenda"), defina query_self: true. NÃO coloque o nome do usuário em query_participant.
   - Exemplos:
     - "Qual o dia da reunião com o John?" → query_title: "reunião", query_participant: "John" (SEM query_period)
     - "Quando é a entrega do vídeo?" → query_title: "entrega do vídeo" (SEM query_period)
     - "O que tem amanhã?" → query_period: "tomorrow" (SEM query_title)
     - "Reuniões dessa semana" → query_period: "this_week", query_filter: "meeting"
     - "E as minhas?" → query_self: true (SEM query_participant, SEM query_period)
     - "Quais são os meus eventos?" → query_self: true
     - "Minhas reuniões" → query_self: true, query_filter: "meeting"

5. **query_cards** — Consultar cards/kanban
   Gatilhos: "quais cards", "o que tá pendente", "cards urgentes", "como tá o kanban"
   Entidades: query_filter, priority, column, brand

6. **query_projects** — Consultar projetos
   Gatilhos: "como tá o projeto", "status do", "andamento"
   Entidades: query_filter

7. **generate_report** — Gerar relatório
   Gatilhos: "relatório", "resumo da semana", "balanço do mês"
   Entidades: query_period

8. **update_card** — Atualizar card existente
   Gatilhos: "move o card", "muda prioridade", "atualiza", "marca como feito"
   Entidades: title (para buscar), column (destino), priority

9. **update_reminder** — Alterar lembrete existente
   Gatilhos: "muda aquele lembrete", "adia o lembrete", "altera o horário do lembrete", "muda pra 10h", "adia pra terça"
   Entidades: reminder_search_text (texto para encontrar o lembrete), reminder_new_time (novo horário), reminder_new_date (nova data), reminder_new_recurrence (nova recorrência)
   
   Exemplos:
   - "Muda aquele lembrete de segunda pra 10h" → reminder_search_text: "segunda", reminder_new_time: "10:00"
   - "Adia o lembrete de revisar relatório pra terça" → reminder_search_text: "revisar relatório", reminder_new_date: "terça"
   - "Muda o lembrete pra diário" → reminder_new_recurrence: "daily"
   - "Aquele lembrete de 9h, muda pra 10h" → reminder_search_text: "9h", reminder_new_time: "10:00"

10. **cancel_reminder** — Cancelar/excluir lembrete existente
    Gatilhos: "cancela aquele lembrete", "remove o lembrete", "exclui o lembrete", "não precisa mais daquele lembrete", "para de me lembrar"
    Entidades: reminder_search_text (texto para encontrar o lembrete)
    
    Exemplos:
    - "Cancela aquele lembrete de toda segunda" → reminder_search_text: "toda segunda"
    - "Remove o lembrete de revisar relatório" → reminder_search_text: "revisar relatório"
    - "Para de me lembrar de revisar o relatório" → reminder_search_text: "revisar relatório"

11. **update_calendar** — Alterar evento/compromisso existente no calendário
    Gatilhos: "muda a reunião", "adia o evento", "altera o horário da", "troca pra quinta", "muda o local", "reagenda", "empurra pra", "antecipa a reunião"
    Entidades: event_search_text (título, participante ou dia para encontrar o evento), event_new_date (nova data), event_new_time (novo horário), event_new_location (novo local), event_new_title (novo título), message_to_participant (mensagem personalizada que o usuário quer enviar ao participante, ex: "diga a ele que precisarei remarcar", "avisa que mudou por causa da chuva")
    
    Exemplos:
    - "Muda a reunião de terça pra quinta às 15h" → event_search_text: "reunião terça", event_new_date: "quinta", event_new_time: "15:00"
    - "Adia a gravação com John pra semana que vem" → event_search_text: "gravação John", event_new_date: "semana que vem"
    - "Muda o local da reunião de amanhã pra LA Music Recreio" → event_search_text: "reunião amanhã", event_new_location: "LA Music Recreio"
    - "Aquele planejamento de março, muda pra 14h" → event_search_text: "planejamento março", event_new_time: "14:00"
    - "Reagenda a gravação de quinta pra sexta" → event_search_text: "gravação quinta", event_new_date: "sexta"
    - "Muda a reunião com Jereh pra 11h. Avisa ele que tive um imprevisto" → event_search_text: "reunião Jereh", event_new_time: "11:00", message_to_participant: "Tive um imprevisto"
    - "Cancela a reunião de amanhã. Diga ao Jereh que precisarei remarcar" → (cancel_calendar) event_search_text: "reunião amanhã", message_to_participant: "Precisarei remarcar"

12. **cancel_calendar** — Cancelar/excluir evento do calendário
    Gatilhos: "cancela a reunião", "exclui o evento", "remove da agenda", "desmarca", "não vai ter mais"
    Entidades: event_search_text (título, participante ou dia para encontrar o evento), message_to_participant (mensagem personalizada para enviar ao participante, ex: "avisa que vou remarcar", "diga que surgiu um imprevisto")
    
    Exemplos:
    - "Cancela a reunião de terça" → event_search_text: "reunião terça"
    - "Desmarca a gravação com John" → event_search_text: "gravação John"
    - "Remove o planejamento de março da agenda" → event_search_text: "planejamento março"
    - "Cancela a reunião com Jereh. Diga a ele que precisarei remarcar" → event_search_text: "reunião Jereh", message_to_participant: "Precisarei remarcar"
    - "Desmarca a gravação de amanhã. Avisa o John que surgiu um imprevisto" → event_search_text: "gravação amanhã", message_to_participant: "Surgiu um imprevisto"

13. **save_contact** — Salvar contato na agenda
    Gatilhos: "salva na agenda", "grava o contato", "anota o número", "salva esse número", "adiciona na agenda"
    Entidades: contact_name, contact_phone, contact_type (fornecedor/aluno/cliente/parceiro/artista/outro), notes

14. **query_contact** — Consultar contato na agenda
    Gatilhos: "qual o número do", "contato do", "telefone do", "quero falar com", "tem o número do"
    Entidades: contact_name, contact_type

15. **notify_user** — Notificar/avisar alguém sobre uma tarefa, card ou informação
    Gatilhos: "notifica o John", "avisa o John", "manda mensagem pro John", "fala pro John", "avisa ele", "notifica no privado", "manda pra ele"
    Entidades: notify_target (nome da pessoa a notificar), notify_message (mensagem ou contexto a enviar, ex: "da gravação da Bianca"), card_title (título do card relacionado, se mencionado)
    needs_confirmation: false (executa direto)
    
    Exemplos:
    - "Notifica o John dessa gravação da Bianca" → notify_target: "John", notify_message: "gravação da Bianca"
    - "Avisa o Yuri que o card ficou pronto" → notify_target: "Yuri", notify_message: "card ficou pronto"
    - "Manda mensagem pro John no privado" → notify_target: "John"
    - "Notifica ele" → notify_target: (pessoa mencionada no contexto anterior)

16. **select_clip** — Usuário escolhe número de clip para publicar (fluxo conversacional)
    Gatilhos: números isolados ("1", "2", "5"), "clip 3", "quero o 2", "o primeiro", "o último", etc.
    Entidades: clip_index (número 1-10, ou -1 para "último")
    needs_confirmation: false

    Exemplos (linguagem natural):
    - "1" → clip_index: 1
    - "5" → clip_index: 5
    - "clip 3" → clip_index: 3
    - "quero o 2" → clip_index: 2
    - "quero o dois" → clip_index: 2
    - "o primeiro" → clip_index: 1
    - "o último" → clip_index: -1
    - "esse primeiro" → clip_index: 1
    - "manda o 3" → clip_index: 3
    - "vai o 1" → clip_index: 1
    - "bora com o 2" → clip_index: 2

17. **select_format** — Usuário escolhe formato de publicação (Reels/Stories/ambos)
    Gatilhos: "r", "s", "rs", "reels", "stories", "reels e stories", "ambos", "manda nos dois"
    Entidades: format ('R' | 'S' | 'RS')
    needs_confirmation: false

    Exemplos (linguagem natural):
    - "r" → format: 'R'
    - "s" → format: 'S'
    - "rs" → format: 'RS'
    - "reels" → format: 'R'
    - "stories" → format: 'S'
    - "reels e stories" → format: 'RS'
    - "ambos" → format: 'RS'
    - "manda nos dois" → format: 'RS'
    - "os dois" → format: 'RS'
    - "nos dois formatos" → format: 'RS'
    - "pode ser reels" → format: 'R'
    - "só stories" → format: 'S'
    - "bota no reels" → format: 'R'

18. **set_mentions** — Usuário define @mentions ou pula etapa
    Gatilhos: "@fulano", "pular", "pula", "sem marcação", "nenhum", "não", "nao"
    Entidades: mentions (array de @usernames), skip_mentions (boolean)
    needs_confirmation: false

    Exemplos:
    - "@fulano @ciclano" → mentions: ['@fulano', '@ciclano']
    - "@lamusic" → mentions: ['@lamusic']
    - "pular" → skip_mentions: true
    - "pula" → skip_mentions: true
    - "sem marcação" → skip_mentions: true
    - "nenhum" → skip_mentions: true
    - "não" → skip_mentions: true
    - "nao" → skip_mentions: true
    - "sem tag" → skip_mentions: true
    - "não precisa" → skip_mentions: true

19. **set_schedule** — Usuário define horário de publicação
    Gatilhos: "agora", "18h", "amanhã", "seg", "próxima terça", horários
    Entidades: schedule_type ('now' | 'scheduled'), schedule_datetime (ISO string)
    needs_confirmation: false

    Exemplos (considere a data/hora atual para calcular):
    - "agora" → schedule_type: 'now'
    - "18h" → schedule_type: 'scheduled', schedule_datetime: (hoje às 18h ISO)
    - "amanhã" → schedule_type: 'scheduled', schedule_datetime: (amanhã às 10h ISO)
    - "amanhã 15h" → schedule_type: 'scheduled', schedule_datetime: (amanhã às 15h ISO)
    - "seg" → schedule_type: 'scheduled', schedule_datetime: (próxima segunda 10h ISO)
    - "seg 18h" → schedule_type: 'scheduled', schedule_datetime: (próxima segunda 18h ISO)

20. **confirm_publish** — Usuário confirma publicação
    Gatilhos: "sim", "confirma", "pode", "manda", "vai", "ok", "beleza"
    Entidades: nenhuma
    needs_confirmation: false

21. **cancel_publish** — Usuário cancela publicação (apenas na etapa de confirmação final)
    Gatilhos: "não", "cancela", "cancelar", "voltar", "nao" (na etapa 'confirm')
    Entidades: nenhuma
    needs_confirmation: false
    ⚠️ IMPORTANTE: "não" na etapa de mentions = set_mentions com skip_mentions: true (não cancel_publish)
    ⚠️ "cancela" ou "voltar" em qualquer etapa = cancel_publish

22. **delegate_to_john** — Usuário quer passar a publicação para o John decidir
    Gatilhos: "passa pro john", "manda pro john", "deixa o john ver", "john decide", "pro john"
    Entidades: nenhuma
    needs_confirmation: false

    Exemplos:
    - "passa pro john" → delegate_to_john
    - "manda pro john decidir" → delegate_to_john
    - "deixa o john escolher" → delegate_to_john
    - "john resolve" → delegate_to_john
    - "pro john" → delegate_to_john

23. **list_clips** — Usuário quer ver os clipes disponíveis
    Gatilhos: "ver", "lista", "quais clipes", "mostra", "quais estão prontos"
    Entidades: nenhuma
    needs_confirmation: false

24. **general_chat** — Conversa livre, brainstorm, opinião
    Gatilhos: saudações, perguntas gerais, brincadeiras, pedidos de opinião, brainstorm de conteúdo
    ⚠️ NUNCA use general_chat para perguntas sobre agenda, calendário, eventos — essas são query_calendar
    ⚠️ NUNCA use general_chat quando o usuário pedir para notificar alguém — essas são notify_user
    ⚠️ NUNCA use general_chat para números isolados (1-10) durante fluxo de clips — essas são select_clip
    ⚠️ NUNCA use general_chat para "r", "s", "rs", "reels", "stories" — essas são select_format
    ⚠️ NUNCA use general_chat para "pular", "@mentions" — essas são set_mentions
    ⚠️ NUNCA use general_chat para "agora", "18h", "amanhã", "seg" — essas são set_schedule
    ⚠️ NUNCA use general_chat para "sim", "confirma" — essas são confirm_publish
    ⚠️ NUNCA use general_chat para "não", "cancela" — essas são cancel_publish
    Entidades: nenhuma

25. **help** — Pedir ajuda
    Gatilhos: "ajuda", "o que você faz", "comandos", "como funciona"
    Entidades: nenhuma

## VALORES VÁLIDOS

**Prioridades:** urgent, high, medium, low
**Tipos de conteúdo:** video, carousel, reels, story, photo, live
**Plataformas:** instagram, youtube, tiktok, facebook, whatsapp
**Marcas:** la_music, la_kids
**Colunas Kanban:** brainstorm, planning, todo, capturing, editing, awaiting_approval, approved, published, archived
**Tipos calendário:** event, delivery, creation, task, meeting
**Períodos:** today, tomorrow, this_week, next_week, this_month

## EXTRAÇÃO DE ENTIDADES — OBRIGATÓRIO

Quando classificar como create_calendar, extraia TODAS as entidades possíveis:
- title: nome do evento (ex: "Reunião com John")
- date: data (normalizar: "amanhã" → manter relativo, "segunda" → manter relativo)
- time: horário (normalizar: "10h" → "10:00", "às 3" → "15:00", "3 da tarde" → "15:00")
- location: local ou "online" (se mencionado)
- participants: pessoas envolvidas (se mencionadas)
- calendar_type: event/delivery/creation/task/meeting
- duration_minutes: duração em minutos (se mencionada)

Quando classificar como create_card, extraia:
- title: nome da tarefa
- deadline: prazo (ex: "terça-feira", "amanhã", "até sexta") — NÃO confundir com date
- assigned_to: responsável pela tarefa (se mencionado). Se o usuário diz "eu vou", "pra mim", "eu que vou" → assigned_to = nome do próprio usuário
- priority: urgent/high/medium/low
- content_type: video/carousel/reels/story/photo/live (se mencionado)
- description: detalhes adicionais

Exemplo: "Criar card urgente pra editar vídeo, eu que vou fazer, prazo até terça" deve extrair:
- title: "Editar vídeo"
- priority: "urgent"
- content_type: "video"
- assigned_to: "[nome do usuário]"
- deadline: "terça-feira"

Exemplo: "Reunião amanhã às 10h com John no Zoom" deve extrair:
- title: "Reunião com John"
- date: "amanhã"
- time: "10:00"
- participants: "John"
- location: "Online (Zoom)"
- calendar_type: "meeting"

NÃO invente dados que o usuário NÃO mencionou.
Se o usuário disse "reunião com John" sem hora/data, retorne apenas title e participants.

## REGRAS

1. Se o usuário não especificar coluna, assumir "brainstorm" para create_card
2. Se o usuário não especificar prioridade, assumir "medium"
3. Se o usuário não especificar marca, assumir "la_music"
4. Datas relativas: "amanhã" = dia seguinte, "sexta" = próxima sexta, etc. Retorne em formato relativo (ex: "amanhã", "sexta") para que o sistema resolva corretamente.
5. Se a mensagem for ambígua, classificar como "unknown" e pedir esclarecimento
6. Responda SEMPRE em português brasileiro, tom profissional e direto (você é o Mike)
7. Para create_card e create_calendar, SEMPRE pedir confirmação (needs_confirmation: true)
8. Para queries, não precisa confirmação (needs_confirmation: false)
9. Use emojis como marcadores de lista (2-5 por mensagem)

## FORMATO DE RESPOSTA

Responda APENAS com JSON válido, sem markdown, sem backticks, sem texto adicional.
IMPORTANTE: No campo response_text, use \\n para quebras de linha. Listas DEVEM ter um item por linha.

Exemplo para resposta com lista:
{
  "intent": "general_chat",
  "confidence": 0.95,
  "entities": {},
  "response_text": "🎸 *Instrumentos em Campo Grande:*\\n\\n🥁 Bateria\\n🎤 Canto\\n🎹 Teclado e Piano\\n🎸 Guitarra, Violão e Contrabaixo\\n🎻 Violino\\n🪈 Flauta e Saxofone\\n🪕 Ukulele\\n\\n✨ *Exclusivos de CG:*\\n🎧 Produção Musical\\n🎭 Teatro Musical\\n\\nQuer que eu crie um card com essa lista?",
  "needs_confirmation": false
}

Exemplo para resposta curta:
{
  "intent": "general_chat",
  "confidence": 0.95,
  "entities": {},
  "response_text": "Fala, Yuri! Tô por aqui. No que posso ajudar? 💪",
  "needs_confirmation": false
}

REGRA: Se a resposta tem 3+ itens, OBRIGATORIAMENTE use \\n para separar cada item em uma linha.
Use *asteriscos* para negrito (formato WhatsApp).`
}

// SYSTEM_PROMPT é recalculado a cada chamada dentro de classifyMessage()
// Manter a const como fallback para uso direto
const SYSTEM_PROMPT = buildSystemPrompt()

// ============================================
// CLASSIFICADOR
// ============================================

export async function classifyMessage(
  text: string,
  userName: string,
  conversationContext?: string,
  memoryContext?: string,
  groupContext?: string,
): Promise<ClassificationResult> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')

  // Recalcular system prompt a cada chamada para ter data/hora atualizada
  const currentPrompt = buildSystemPrompt()

  let userMessage = `Mensagem do usuário "${userName}": "${text}"`
  if (conversationContext) {
    userMessage = `CONTEXTO DE REFERÊNCIA (dados reais do sistema — NÃO use para responder perguntas sobre agenda/calendário/compromissos/eventos/reuniões. Essas perguntas devem SEMPRE ser classificadas como query_calendar para busca filtrada no banco):\n${conversationContext}\n\n${userMessage}`
  }

  // WA-04: Injetar memória do agente (vai ANTES do userMessage para contexto de background)
  if (memoryContext) {
    userMessage = `MEMÓRIA DO AGENTE (use para personalizar resposta e inferir contexto):\n${memoryContext}\n\n${userMessage}`
  }

  // WA-06.7: Injetar contexto do grupo (conversa recente)
  if (groupContext) {
    userMessage = `CONTEXTO DO GRUPO DE WHATSAPP — Você acompanhou a conversa em silêncio e agora foi chamado para ajudar.\nUse esse contexto para entender referências como "esse evento", "o que ele disse", "aquilo que combinamos".\nNão pedir informações que já foram mencionadas na conversa.\nCitar quem disse o quê quando relevante.\n${groupContext}\n\n${userMessage}`
  }

  // Tentar Gemini primeiro (gratuito)
  if (geminiKey) {
    const result = await tryGemini(geminiKey, userMessage, currentPrompt)
    if (result) return result
  }

  // Fallback: OpenAI GPT-4.1
  if (openaiKey) {
    const result = await tryOpenAI(openaiKey, userMessage, currentPrompt)
    if (result) return result
  }

  // Último fallback: regex local
  console.warn('[WA] Both Gemini and OpenAI failed, using regex fallback')
  return fallbackClassification(text, userName)
}

// ============================================
// RECUPERAÇÃO DE JSON TRUNCADO
// ============================================

/**
 * Tenta recuperar o response_text de um JSON truncado por MAX_TOKENS.
 * Estratégia: extrair o valor de "response_text" via regex, mesmo que o JSON esteja incompleto.
 */
function tryRecoverTruncatedJson(rawText: string): string | null {
  try {
    // Tentar extrair response_text via regex — funciona mesmo com JSON cortado
    const match = rawText.match(/"response_text"\s*:\s*"((?:[^"\\]|\\.)*)/)
    if (match && match[1]) {
      let recovered = match[1]
      // Converter \\n em \n real
      recovered = recovered.replace(/\\n/g, '\n')
      // Remover possível truncamento no final (palavra cortada)
      const lastNewline = recovered.lastIndexOf('\n')
      if (lastNewline > recovered.length * 0.7) {
        // Se o último \n está perto do final, cortar ali para não ter frase incompleta
        recovered = recovered.substring(0, lastNewline)
      }
      recovered = recovered.trim()
      if (recovered.length > 20) {
        console.log(`[WA] Recuperado ${recovered.length} chars de JSON truncado`)
        return recovered + '\n\n_(resposta longa, pode ter sido cortada)_'
      }
    }
    return null
  } catch {
    return null
  }
}

// ============================================
// PÓS-PROCESSAMENTO DE FORMATAÇÃO
// ============================================

/**
 * Garante que o response_text tenha quebras de linha reais.
 * O Gemini em modo JSON tende a gerar \\n literal em vez de \n real.
 * Também normaliza formatação para WhatsApp.
 */
function formatResponseText(text: string): string {
  if (!text) return text

  // 1. Converter \\n literal (string escapada) em \n real
  let formatted = text.replace(/\\n/g, '\n')

  // 2. Remover espaços antes de \n (trailing whitespace)
  formatted = formatted.replace(/ +\n/g, '\n')

  // 3. Limitar a no máximo 2 quebras de linha consecutivas
  formatted = formatted.replace(/\n{3,}/g, '\n\n')

  return formatted.trim()
}

// ============================================
// GEMINI (primário)
// ============================================

async function tryGemini(apiKey: string, userMessage: string, systemPrompt: string): Promise<ClassificationResult | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${getDefaultAiModel()}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: userMessage }]
            }
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
            maxOutputTokens: getMaxOutputTokens(),
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[WA] Gemini API error ${response.status}:`, errorText)
      return null
    }

    const data = await response.json()
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    const finishReason = data?.candidates?.[0]?.finishReason
    if (!responseText) {
      console.error('[WA] Gemini returned empty response')
      return null
    }

    // Se truncou por MAX_TOKENS, tentar recuperar o JSON parcial
    if (finishReason === 'MAX_TOKENS') {
      console.warn('[WA] Gemini response truncated (MAX_TOKENS). Tentando recuperar JSON parcial...')
    }

    let classification: ClassificationResult
    try {
      classification = JSON.parse(responseText) as ClassificationResult
    } catch (_parseError) {
      // JSON truncado — tentar extrair response_text parcial
      console.warn('[WA] Gemini JSON parse failed, tentando recuperação parcial')
      const partialText = tryRecoverTruncatedJson(responseText)
      if (partialText) {
        classification = {
          intent: 'general_chat' as Intent,
          confidence: 0.8,
          entities: {},
          response_text: partialText,
          needs_confirmation: false,
        }
      } else {
        console.error('[WA] Gemini: não foi possível recuperar JSON truncado')
        return null
      }
    }
    if (!classification.intent || !classification.response_text) {
      console.error('[WA] Gemini returned invalid classification')
      return null
    }

    // Pós-processar response_text: garantir que \n literal vire quebra de linha real
    classification.response_text = formatResponseText(classification.response_text)
    classification.confidence = Number(classification.confidence) || 0.5
    console.log(`[WA] Gemini classified: intent=${classification.intent}, confidence=${classification.confidence}`)
    return classification

  } catch (error) {
    console.error('[WA] Gemini error:', error)
    return null
  }
}

// ============================================
// OPENAI GPT-4.1 (fallback)
// ============================================

async function tryOpenAI(apiKey: string, userMessage: string, systemPrompt: string): Promise<ClassificationResult | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getFallbackAiModel(),
        temperature: 0.1,
        max_tokens: getMaxOutputTokens(),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[WA] OpenAI API error ${response.status}:`, errorText)
      return null
    }

    const data = await response.json()
    const responseText = data?.choices?.[0]?.message?.content
    if (!responseText) {
      console.error('[WA] OpenAI returned empty response')
      return null
    }

    let classification: ClassificationResult
    try {
      classification = JSON.parse(responseText) as ClassificationResult
    } catch (_parseError) {
      console.warn('[WA] OpenAI JSON parse failed, tentando recuperação parcial')
      const partialText = tryRecoverTruncatedJson(responseText)
      if (partialText) {
        classification = {
          intent: 'general_chat' as Intent,
          confidence: 0.8,
          entities: {},
          response_text: partialText,
          needs_confirmation: false,
        }
      } else {
        console.error('[WA] OpenAI: não foi possível recuperar JSON truncado')
        return null
      }
    }
    if (!classification.intent || !classification.response_text) {
      console.error('[WA] OpenAI returned invalid classification')
      return null
    }

    // Pós-processar response_text: garantir que \n literal vire quebra de linha real
    classification.response_text = formatResponseText(classification.response_text)
    classification.confidence = Number(classification.confidence) || 0.5
    console.log(`[WA] OpenAI classified: intent=${classification.intent}, confidence=${classification.confidence}`)
    return classification

  } catch (error) {
    console.error('[WA] OpenAI error:', error)
    return null
  }
}

// ============================================
// FALLBACK (sem Gemini / erro)
// ============================================

function fallbackClassification(text: string, userName: string): ClassificationResult {
  const lower = text.toLowerCase().trim()

  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|eai|e ai|fala)/i.test(lower)) {
    return {
      intent: 'general_chat',
      confidence: 0.9,
      entities: { raw_text: text },
      response_text: `Olá, ${userName}! 👋 Como posso ajudar? Digite "ajuda" para ver os comandos disponíveis.`,
      needs_confirmation: false,
    }
  }

  if (/^(ajuda|help|comandos|menu|o que voce faz)/i.test(lower)) {
    return {
      intent: 'help',
      confidence: 0.95,
      entities: {},
      response_text: getHelpText(),
      needs_confirmation: false,
    }
  }

  if (/^(cria|criar|novo|adiciona|bota)/i.test(lower)) {
    return {
      intent: 'create_card',
      confidence: 0.6,
      entities: { title: text, raw_text: text },
      response_text: `Entendi que você quer criar algo, ${userName}. Pode detalhar melhor? Ex: "cria card urgente pra gravar vídeo do LA Kids"`,
      needs_confirmation: false,
    }
  }

  if (/^(agenda|calendario|semana|hoje|amanhã|amanha)/i.test(lower)) {
    return {
      intent: 'query_calendar',
      confidence: 0.6,
      entities: { query_period: 'this_week', raw_text: text },
      response_text: `Vou consultar a agenda, ${userName}. Um momento...`,
      needs_confirmation: false,
    }
  }

  return {
    intent: 'unknown',
    confidence: 0.3,
    entities: { raw_text: text },
    response_text: `Não entendi bem, ${userName}. Pode reformular? Ou digite "ajuda" para ver o que posso fazer.`,
    needs_confirmation: false,
  }
}

// ============================================
// HELP TEXT
// ============================================

export function getHelpText(): string {
  return `📋 *Comandos do LA Studio Manager*

🎯 *Criar*
• "Cria um card pra gravar vídeo do LA Kids"
• "Agenda reunião pra sexta às 14h"
• "Me lembra de enviar o relatório amanhã"

🔍 *Consultar*
• "O que tem na agenda hoje?"
• "Quais cards estão urgentes?"
• "Como tá o projeto X?"

📊 *Relatórios*
• "Resumo da semana"
• "Relatório do mês"

✏️ *Atualizar*
• "Move o card X pra coluna aprovado"
• "Muda prioridade do card Y pra urgente"

💡 *Dicas*
• Seja específico: inclua título, prioridade, data
• Posso entender datas: "amanhã", "sexta", "dia 15"
• Marcas: LA Music (padrão) ou LA Kids`
}

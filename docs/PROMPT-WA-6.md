# WA-06 — Processamento de Áudio e Imagem via WhatsApp

## 📋 CONTEXTO

O LA Studio Manager tem um agente WhatsApp funcional (WA-01 a WA-05) que processa mensagens de **texto** via NLP, executa ações no Kanban/Calendário, responde queries, mantém memória episódica, e envia relatórios automatizados.

Agora precisamos que o agente também entenda **áudio** (mensagens de voz) e **imagem** (fotos, prints, encaminhamentos).

### Stack Atual
- **Supabase Edge Functions** (Deno/TypeScript)
- **UAZAPI** (WhatsApp API): `https://lamusic.uazapi.com`
- **Edge Function principal**: `process-whatsapp-message` (v15)
- **Arquivos existentes**: index.ts, nlp-classifier.ts, action-executor.ts, query-handler.ts, memory-manager.ts

### Referência Comprovada
O projeto **Personal Finance (DriveCFO)** já implementou áudio e imagem com sucesso usando a mesma stack UAZAPI + Supabase. Os payloads abaixo são **reais e confirmados em produção**.

---

## 🎯 OBJETIVO

1. **Áudio**: Usuário envia mensagem de voz → UAZAPI transcreve → texto vai pro NLP → ação executada
2. **Imagem**: Usuário envia foto/print → UAZAPI baixa → Vision AI interpreta → comando extraído → ação executada  
3. **Encaminhamento**: Usuário encaminha áudio/imagem de outra pessoa → mesmo fluxo funciona

---

## 📦 PAYLOADS REAIS DA UAZAPI (Confirmados em Produção)

### Payload de Texto (referência)
```json
{
  "BaseUrl": "https://lamusic.uazapi.com",
  "EventType": "messages",
  "token": "<instance_token>",
  "owner": "5521981278047",
  "instanceName": "DriveCFO",
  "message": {
    "chatid": "5521981278047@s.whatsapp.net",
    "messageid": "AC2D3CE35233FB7A23897ED6CB569EDE",
    "messageType": "Conversation",
    "type": "text",
    "fromMe": false,
    "sender": "5521981278047@s.whatsapp.net",
    "senderName": "Luciano Alf",
    "messageTimestamp": 1763642580000,
    "content": "Teste Uazapi",
    "text": "Teste Uazapi",
    "mediaType": "",
    "wasSentByApi": false
  },
  "chat": {
    "phone": "+55 21 98127-8047",
    "wa_chatid": "5521981278047@s.whatsapp.net",
    "wa_name": "Luciano Alf"
  }
}
```

### Payload de Áudio / Mensagem de Voz (PTT)
```json
{
  "BaseUrl": "https://lamusic.uazapi.com",
  "EventType": "messages",
  "token": "<instance_token>",
  "owner": "5521981278047",
  "message": {
    "chatid": "5521981278047@s.whatsapp.net",
    "messageid": "AC648E70B1841544C9725B0721823987",
    "messageType": "AudioMessage",
    "type": "media",
    "mediaType": "ptt",
    "fromMe": false,
    "sender": "5521981278047@s.whatsapp.net",
    "senderName": "Luciano Alf",
    "messageTimestamp": 1763554994000,
    "content": {
      "URL": "https://mmg.whatsapp.net/v/t62.7117-24/...",
      "mimetype": "audio/ogg; codecs=opus",
      "PTT": true,
      "seconds": 52,
      "fileLength": 109266,
      "mediaKey": "uzM2UFyuVA6k0GTAZVYGfC9gH0Bczw3ZSW7rKnMn3uQ=",
      "fileEncSHA256": "hpiQeFMNPvXJoLmoVR68AIzLXp70LbcEoctKVSdMA04=",
      "directPath": "/v/t62.7117-24/...",
      "mediaKeyTimestamp": 1763554943,
      "contextInfo": {}
    },
    "text": "",
    "wasSentByApi": false
  },
  "chat": {
    "phone": "+55 21 98127-8047",
    "wa_chatid": "5521981278047@s.whatsapp.net",
    "wa_name": "Luciano Alf"
  }
}
```

### Payload de Imagem
```json
{
  "BaseUrl": "https://lamusic.uazapi.com",
  "EventType": "messages",
  "message": {
    "chatid": "5521981278047@s.whatsapp.net",
    "messageid": "AB1234567890ABCDEF",
    "messageType": "ImageMessage",
    "type": "media",
    "mediaType": "image",
    "fromMe": false,
    "sender": "5521981278047@s.whatsapp.net",
    "senderName": "Luciano Alf",
    "messageTimestamp": 1763642580000,
    "content": {
      "URL": "https://mmg.whatsapp.net/v/t62.7118-24/...",
      "mimetype": "image/jpeg",
      "fileLength": 45678,
      "height": 1280,
      "width": 960,
      "mediaKey": "...",
      "fileEncSHA256": "...",
      "directPath": "/v/t62.7118-24/...",
      "mediaKeyTimestamp": 1763642500,
      "caption": "Olha esse card",
      "contextInfo": {}
    },
    "text": "Olha esse card",
    "wasSentByApi": false
  },
  "chat": {
    "phone": "+55 21 98127-8047",
    "wa_chatid": "5521981278047@s.whatsapp.net",
    "wa_name": "Luciano Alf"
  }
}
```

### Campos Críticos para Detecção de Tipo

```typescript
// Detecção do tipo de mensagem
const messageType = payload.message.messageType; // "Conversation" | "AudioMessage" | "ImageMessage" | "ExtendedTextMessage"
const type = payload.message.type;               // "text" | "media"
const mediaType = payload.message.mediaType;     // "" | "ptt" | "image" | "document" | "video"

// Áudio
const isAudio = (
  messageType === 'AudioMessage' || 
  type === 'media' && mediaType === 'ptt'
);

// Imagem
const isImage = (
  messageType === 'ImageMessage' ||
  type === 'media' && mediaType === 'image'
);

// Texto
const isText = (
  messageType === 'Conversation' || 
  messageType === 'ExtendedTextMessage' ||
  type === 'text'
);

// Caption de imagem (texto que acompanha a foto)
const caption = payload.message.text || '';

// ID da mensagem para download
const messageId = payload.message.messageid;
```

---

## 🔧 ENDPOINT UAZAPI: Download + Transcrição

### POST /message/download

Este é o endpoint chave. Ele faz **download E transcrição** de mídia.

```typescript
// BASE
const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL'); // https://lamusic.uazapi.com
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN');

// HEADERS para todas as chamadas UAZAPI
const headers = {
  'Content-Type': 'application/json',
  'token': UAZAPI_TOKEN
};
```

#### Para Áudio — Transcrição Automática
```typescript
// Pedir à UAZAPI para baixar o áudio E transcrever via Whisper (OpenAI)
const response = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    id: messageId,        // ID da mensagem do webhook
    transcribe: true,     // ← UAZAPI transcreve via Whisper automaticamente
    generate_mp3: true    // Retorna MP3 (opcional, padrão true)
  })
});

const result = await response.json();
// result = {
//   fileURL: "https://lamusic.uazapi.com/files/arquivo.mp3",
//   mimetype: "audio/mpeg",
//   transcription: "Cria um card urgente para revisar o contrato do evento de sábado"
// }

const transcribedText = result.transcription; // ← Texto pronto para o NLP
```

**IMPORTANTE**: A UAZAPI usa a OpenAI API Key que já está salva na instância para transcrição Whisper. Não precisa enviar a key em cada chamada.

#### Para Imagem — Download em Base64
```typescript
// Baixar imagem como base64 para enviar ao Vision AI
const response = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    id: messageId,        // ID da mensagem
    return_base64: true,  // ← Retorna conteúdo em base64
    return_link: true     // Também gera URL pública (opcional)
  })
});

const result = await response.json();
// result = {
//   fileURL: "https://lamusic.uazapi.com/files/imagem.jpg",
//   mimetype: "image/jpeg",
//   base64Data: "/9j/4AAQSkZJRgABAQ..."  // ← Base64 da imagem
// }

const imageBase64 = result.base64Data;
const imageMimetype = result.mimetype;
```

---

## 📁 ARQUIVOS A CRIAR

### 1. `audio-handler.ts` — Processamento de Áudio

```
supabase/functions/process-whatsapp-message/audio-handler.ts
```

```typescript
// =============================================================================
// AUDIO-HANDLER.TS — Transcrição de Áudio via UAZAPI + Whisper
// LA Studio Manager — WA-06
// =============================================================================

const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL')!;
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN')!;

export interface AudioResult {
  success: boolean;
  transcription?: string;
  duration_seconds?: number;
  error?: string;
}

/**
 * Transcreve mensagem de áudio via UAZAPI (que usa Whisper internamente)
 * 
 * Fluxo: WhatsApp Audio → UAZAPI Download+Transcribe → Texto
 */
export async function transcribeAudio(messageId: string): Promise<AudioResult> {
  console.log(`🎤 [AUDIO] Transcrevendo áudio: ${messageId}`);
  
  try {
    const response = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': UAZAPI_TOKEN
      },
      body: JSON.stringify({
        id: messageId,
        transcribe: true,
        generate_mp3: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [AUDIO] UAZAPI error ${response.status}: ${errorText}`);
      return { success: false, error: `UAZAPI retornou ${response.status}: ${errorText}` };
    }

    const result = await response.json();

    if (!result.transcription || result.transcription.trim() === '') {
      console.warn('⚠️ [AUDIO] Transcrição vazia');
      return { success: false, error: 'Transcrição vazia — áudio muito curto ou inaudível' };
    }

    console.log(`✅ [AUDIO] Transcrição: "${result.transcription}"`);
    
    return {
      success: true,
      transcription: result.transcription.trim()
    };

  } catch (error) {
    console.error('❌ [AUDIO] Exceção:', error);
    return { success: false, error: `Erro ao transcrever: ${error.message}` };
  }
}
```

---

### 2. `image-handler.ts` — Processamento de Imagem

```
supabase/functions/process-whatsapp-message/image-handler.ts
```

```typescript
// =============================================================================
// IMAGE-HANDLER.TS — Leitura de Imagem via UAZAPI + OpenAI Vision
// LA Studio Manager — WA-06
// =============================================================================

const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL')!;
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

// =============================================================================
// TIPOS
// =============================================================================

export type ImageContentType = 
  | 'kanban_screenshot'    // Print de quadro kanban/trello/notion
  | 'event_poster'         // Cartaz/flyer de evento
  | 'document_photo'       // Foto de documento/contrato
  | 'schedule_photo'       // Foto de cronograma/agenda
  | 'receipt_invoice'      // Recibo/nota fiscal
  | 'general'              // Outro conteúdo
  | 'unreadable';          // Não conseguiu ler

export interface ImageAnalysis {
  success: boolean;
  content_type: ImageContentType;
  extracted_text: string;          // Texto principal extraído
  structured_data?: {              // Dados estruturados quando possível
    title?: string;
    date?: string;
    items?: string[];
    amount?: number;
    people?: string[];
    location?: string;
  };
  suggested_action?: string;       // Sugestão de comando para o NLP
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

// =============================================================================
// DOWNLOAD DA IMAGEM VIA UAZAPI
// =============================================================================

async function downloadImage(messageId: string): Promise<{ base64: string; mimetype: string } | null> {
  console.log(`📥 [IMAGE] Baixando imagem: ${messageId}`);
  
  try {
    const response = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': UAZAPI_TOKEN
      },
      body: JSON.stringify({
        id: messageId,
        return_base64: true,
        return_link: false    // Não precisa de link público, só base64
      })
    });

    if (!response.ok) {
      console.error(`❌ [IMAGE] UAZAPI error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    
    if (!result.base64Data) {
      console.error('❌ [IMAGE] Base64 vazio na resposta');
      return null;
    }

    return {
      base64: result.base64Data,
      mimetype: result.mimetype || 'image/jpeg'
    };

  } catch (error) {
    console.error('❌ [IMAGE] Erro ao baixar:', error);
    return null;
  }
}

// =============================================================================
// ANÁLISE VIA OPENAI VISION (GPT-4o)
// =============================================================================

export async function analyzeImage(
  messageId: string,
  caption?: string
): Promise<ImageAnalysis> {
  console.log(`🔍 [IMAGE] Analisando imagem: ${messageId}, caption: "${caption || ''}"`);

  // 1. Baixar imagem
  const imageData = await downloadImage(messageId);
  if (!imageData) {
    return {
      success: false,
      content_type: 'unreadable',
      extracted_text: '',
      confidence: 'low',
      error: 'Não foi possível baixar a imagem'
    };
  }

  // 2. Enviar para OpenAI Vision
  try {
    const systemPrompt = `Você é um assistente de gestão de projetos da LA Music (escola de música).
Analise a imagem enviada e extraia informações relevantes.

CONTEXTO DO SISTEMA:
- LA Music usa um sistema Kanban para gerenciar projetos (cards com título, descrição, responsável, prazo)
- Há um calendário de eventos (shows, apresentações, ensaios)
- Os projetos são da área de educação musical

RESPONDA SEMPRE EM JSON com esta estrutura:
{
  "content_type": "kanban_screenshot|event_poster|document_photo|schedule_photo|receipt_invoice|general|unreadable",
  "extracted_text": "resumo do conteúdo principal da imagem",
  "structured_data": {
    "title": "título se identificável",
    "date": "data se identificável (YYYY-MM-DD)",
    "items": ["lista de itens se aplicável"],
    "amount": null,
    "people": ["nomes de pessoas se identificáveis"],
    "location": "local se identificável"
  },
  "suggested_action": "sugestão de comando que o usuário poderia querer executar no sistema. Ex: 'criar card: Ensaio Geral com prazo 15/03' ou 'agendar evento: Show de Natal dia 20/12' ou null se não aplicável",
  "confidence": "high|medium|low"
}

Se houver uma legenda/caption junto com a imagem, considere-a como contexto adicional para entender a intenção do usuário.`;

    const userContent: any[] = [
      {
        type: 'image_url',
        image_url: {
          url: `data:${imageData.mimetype};base64,${imageData.base64}`,
          detail: 'high'
        }
      }
    ];

    if (caption) {
      userContent.push({
        type: 'text',
        text: `Legenda do usuário: "${caption}"`
      });
    } else {
      userContent.push({
        type: 'text',
        text: 'O usuário enviou esta imagem sem legenda. Analise o conteúdo.'
      });
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 1000,
        temperature: 0.2
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`❌ [IMAGE] OpenAI Vision error: ${openaiResponse.status} - ${errorText}`);
      return {
        success: false,
        content_type: 'unreadable',
        extracted_text: '',
        confidence: 'low',
        error: `OpenAI retornou ${openaiResponse.status}`
      };
    }

    const openaiResult = await openaiResponse.json();
    const responseText = openaiResult.choices?.[0]?.message?.content || '';

    // Parse JSON da resposta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ [IMAGE] Resposta não contém JSON válido');
      return {
        success: true,
        content_type: 'general',
        extracted_text: responseText,
        confidence: 'low'
      };
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    console.log(`✅ [IMAGE] Análise: tipo=${analysis.content_type}, confiança=${analysis.confidence}`);
    console.log(`📝 [IMAGE] Texto: "${analysis.extracted_text}"`);
    if (analysis.suggested_action) {
      console.log(`💡 [IMAGE] Ação sugerida: "${analysis.suggested_action}"`);
    }

    return {
      success: true,
      content_type: analysis.content_type || 'general',
      extracted_text: analysis.extracted_text || '',
      structured_data: analysis.structured_data || {},
      suggested_action: analysis.suggested_action || undefined,
      confidence: analysis.confidence || 'medium'
    };

  } catch (error) {
    console.error('❌ [IMAGE] Erro na análise:', error);
    return {
      success: false,
      content_type: 'unreadable',
      extracted_text: '',
      confidence: 'low',
      error: `Erro ao analisar: ${error.message}`
    };
  }
}
```

---

## 📝 MODIFICAR: `index.ts` — Integrar Áudio e Imagem

### Importações a adicionar (topo do arquivo)

```typescript
import { transcribeAudio } from './audio-handler.ts';
import { analyzeImage } from './image-handler.ts';
```

### Lógica de detecção e roteamento (após extrair o payload)

No `index.ts`, **APÓS** a extração do payload e validação do usuário, **ANTES** da chamada ao NLP classifier, adicionar a detecção de tipo de mídia:

```typescript
// =============================================================================
// DETECÇÃO DO TIPO DE MENSAGEM
// =============================================================================

const messageType = payload.message?.messageType || '';
const mediaType = payload.message?.mediaType || '';
const msgType = payload.message?.type || 'text';
const messageId = payload.message?.messageid || '';
const rawText = payload.message?.text || '';

// Flags de tipo
const isAudio = (
  messageType === 'AudioMessage' ||
  (msgType === 'media' && mediaType === 'ptt')
);

const isImage = (
  messageType === 'ImageMessage' ||
  (msgType === 'media' && mediaType === 'image')
);

const isText = (
  messageType === 'Conversation' ||
  messageType === 'ExtendedTextMessage' ||
  msgType === 'text'
);

let userMessage = rawText; // Texto final que vai pro NLP
let imageAnalysis = null;  // Resultado da análise de imagem (se houver)

// =============================================================================
// PROCESSAR ÁUDIO
// =============================================================================
if (isAudio) {
  console.log(`🎤 [WA-06] Mensagem de áudio detectada: ${messageId}`);
  
  const audioResult = await transcribeAudio(messageId);
  
  if (!audioResult.success || !audioResult.transcription) {
    // Responder que não entendeu o áudio
    await sendWhatsAppMessage(phone, 
      '🎤 Não consegui entender o áudio. Pode repetir ou digitar a mensagem?'
    );
    return new Response(JSON.stringify({ success: true, type: 'audio_failed' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Usar texto transcrito como se fosse mensagem de texto
  userMessage = audioResult.transcription;
  console.log(`📝 [WA-06] Áudio transcrito: "${userMessage}"`);
  
  // Continua o fluxo normal abaixo com userMessage...
}

// =============================================================================
// PROCESSAR IMAGEM
// =============================================================================
if (isImage) {
  console.log(`📷 [WA-06] Mensagem de imagem detectada: ${messageId}`);
  
  const caption = rawText || ''; // Legenda que acompanha a foto
  imageAnalysis = await analyzeImage(messageId, caption);
  
  if (!imageAnalysis.success) {
    await sendWhatsAppMessage(phone,
      '📷 Não consegui analisar a imagem. Pode descrever o que precisa?'
    );
    return new Response(JSON.stringify({ success: true, type: 'image_failed' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Se o Vision sugeriu uma ação, usar como mensagem pro NLP
  if (imageAnalysis.suggested_action) {
    userMessage = imageAnalysis.suggested_action;
    console.log(`💡 [WA-06] Usando ação sugerida do Vision: "${userMessage}"`);
  } 
  // Se tem caption, combinar caption + contexto da imagem
  else if (caption) {
    userMessage = `${caption} [Contexto da imagem: ${imageAnalysis.extracted_text}]`;
    console.log(`📝 [WA-06] Caption + contexto: "${userMessage}"`);
  }
  // Sem caption e sem ação — só descrever o que viu
  else {
    // Responder com descrição e perguntar o que fazer
    const description = imageAnalysis.extracted_text || 'Recebi a imagem.';
    await sendWhatsAppMessage(phone,
      `📷 ${description}\n\nO que você gostaria de fazer com essa informação?`
    );
    return new Response(JSON.stringify({ success: true, type: 'image_described' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Continua o fluxo normal abaixo com userMessage...
}

// =============================================================================
// FLUXO NORMAL — NLP CLASSIFIER (usa userMessage que pode ser texto, transcrição ou ação da imagem)
// =============================================================================
// ... código existente do NLP classifier usando 'userMessage' ...
```

---

## 🗄️ BANCO DE DADOS — Log de Mídias Processadas

### Migration: `wa06_media_processing_log.sql`

```sql
-- =============================================================================
-- WA-06: Log de processamento de mídias (áudio/imagem)
-- =============================================================================

-- Tabela para registrar processamentos de mídia
CREATE TABLE IF NOT EXISTS wa_media_processing_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  whatsapp_message_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'image', 'video', 'document')),
  
  -- Resultado do processamento
  processing_status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (processing_status IN ('pending', 'processing', 'success', 'failed')),
  
  -- Para áudio
  transcription TEXT,
  audio_duration_seconds INTEGER,
  
  -- Para imagem
  image_content_type TEXT, -- kanban_screenshot, event_poster, etc.
  extracted_text TEXT,
  structured_data JSONB,
  suggested_action TEXT,
  analysis_confidence TEXT CHECK (analysis_confidence IN ('high', 'medium', 'low')),
  
  -- Rastreamento
  processing_time_ms INTEGER,     -- Quanto tempo levou o processamento
  ai_model_used TEXT,             -- whisper, gpt-4o, gemini, etc.
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para busca por usuário
CREATE INDEX idx_media_log_user ON wa_media_processing_log(user_id, created_at DESC);
CREATE INDEX idx_media_log_status ON wa_media_processing_log(processing_status);

-- RLS
ALTER TABLE wa_media_processing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage media logs"
  ON wa_media_processing_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Service role tem acesso total (Edge Functions)
CREATE POLICY "Service role full access on media logs"
  ON wa_media_processing_log
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE wa_media_processing_log IS 'WA-06: Log de processamento de mídias via WhatsApp';
```

---

## 🔄 FLUXO COMPLETO — DIAGRAMAS

### Fluxo de Áudio
```
Usuário envia áudio (PTT)
       │
       ▼
  UAZAPI Webhook → Edge Function index.ts
       │
       ▼
  Detecta: messageType === "AudioMessage"
       │
       ▼
  audio-handler.ts → POST /message/download { id, transcribe: true }
       │
       ▼
  UAZAPI baixa áudio → envia pro Whisper → retorna transcrição
       │
       ▼
  userMessage = transcription
       │
       ▼
  NLP Classifier → Action Executor → Resposta WhatsApp
       │
       ▼
  Log em wa_media_processing_log
```

### Fluxo de Imagem
```
Usuário envia imagem (com ou sem legenda)
       │
       ▼
  UAZAPI Webhook → Edge Function index.ts
       │
       ▼
  Detecta: messageType === "ImageMessage"
       │
       ▼
  image-handler.ts → POST /message/download { id, return_base64: true }
       │
       ▼
  UAZAPI baixa imagem → retorna base64
       │
       ▼
  OpenAI GPT-4o Vision → analisa imagem → extrai dados + sugere ação
       │
       ├── TEM ação sugerida? → userMessage = suggested_action → NLP
       ├── TEM caption?       → userMessage = caption + contexto → NLP
       └── SEM nada?          → Descreve imagem e pergunta o que fazer
       │
       ▼
  Log em wa_media_processing_log
```

### Fluxo de Encaminhamento
```
Usuário encaminha áudio/imagem de outra pessoa
       │
       ▼
  Payload UAZAPI é IDÊNTICO (mesmo messageType, mesmo mediaType)
  A diferença está no campo contextInfo que pode ter:
  - isForwarded: true
  - forwardingScore: N
       │
       ▼
  O fluxo é EXATAMENTE o mesmo — não precisa de tratamento especial
  O áudio é transcrito / a imagem é analisada normalmente
```

---

## ⚙️ VARIÁVEIS DE AMBIENTE NECESSÁRIAS

Verificar que estas env vars existem no Supabase:

```bash
# Já devem existir do WA-01:
UAZAPI_BASE_URL=https://lamusic.uazapi.com
UAZAPI_TOKEN=<token_da_instancia>

# Para OpenAI Vision (imagens):
OPENAI_API_KEY=<key>
# A mesma key é usada pela UAZAPI para Whisper (já configurada na instância)
```

**NOTA**: A UAZAPI usa a `openai_apikey` salva na instância para transcrição Whisper. Se a chave NÃO estiver salva, pode ser passada no request: `{ id, transcribe: true, openai_apikey: "sk-..." }`. Porém, ao enviar uma vez, ela fica salva na instância para chamadas futuras.

---

## 🧪 TESTES

### Teste 1: Áudio Simples
```
Enviar via WhatsApp: 🎤 "Cria um card urgente para revisar contrato do evento de sábado"
Esperado: Card criado no Kanban com título similar
```

### Teste 2: Áudio com Consulta
```
Enviar via WhatsApp: 🎤 "Quantos cards estão pendentes?"
Esperado: Resposta com contagem de cards pendentes
```

### Teste 3: Imagem com Caption
```
Enviar via WhatsApp: 📷 Foto de um cartaz de show + caption "Agenda esse evento"
Esperado: Evento criado no calendário com dados extraídos do cartaz
```

### Teste 4: Imagem sem Caption
```
Enviar via WhatsApp: 📷 Print de tela de um quadro kanban (sem texto)
Esperado: Bot descreve o que viu e pergunta o que fazer
```

### Teste 5: Áudio Encaminhado
```
Encaminhar áudio de outra pessoa: 🎤 "Preciso confirmar o local do ensaio de terça"
Esperado: Áudio transcrito e processado normalmente
```

### Teste 6: Imagem Encaminhada
```
Encaminhar foto de um recibo/contrato
Esperado: Imagem analisada, dados extraídos, pergunta o que fazer
```

### Teste 7: Áudio Inaudível / Imagem Ilegível
```
Enviar áudio muito curto (< 1s) ou imagem toda preta
Esperado: Mensagem amigável pedindo para repetir
```

---

## 🔒 TRATAMENTO DE ERROS

1. **UAZAPI indisponível**: Responder "Estou com dificuldade técnica, tente digitar a mensagem"
2. **Whisper falha na transcrição**: Responder "Não entendi o áudio, pode repetir ou digitar?"
3. **OpenAI Vision falha**: Responder "Não consegui analisar a imagem, pode descrever?"
4. **Áudio muito longo (> 5 min)**: Processar normalmente mas avisar que pode demorar
5. **Imagem muito pesada**: UAZAPI lida com isso, mas se der timeout, avisar o usuário
6. **Rate limit OpenAI**: Implementar retry com backoff (max 2 tentativas)

---

## 📊 LOGGING NO wa_media_processing_log

Registrar TODA mídia processada para análise futura:

```typescript
// No final do processamento de áudio ou imagem, salvar log:
async function logMediaProcessing(
  supabase: SupabaseClient,
  data: {
    user_id: string;
    whatsapp_message_id: string;
    media_type: 'audio' | 'image';
    processing_status: 'success' | 'failed';
    transcription?: string;
    audio_duration_seconds?: number;
    image_content_type?: string;
    extracted_text?: string;
    structured_data?: object;
    suggested_action?: string;
    analysis_confidence?: string;
    processing_time_ms: number;
    ai_model_used: string;
    error_message?: string;
  }
) {
  const { error } = await supabase
    .from('wa_media_processing_log')
    .insert(data);
  
  if (error) {
    console.error('⚠️ Erro ao salvar log de mídia:', error);
  }
}
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar `audio-handler.ts`
- [ ] Criar `image-handler.ts`
- [ ] Migration `wa06_media_processing_log.sql`
- [ ] Modificar `index.ts` — detecção de tipo + roteamento
- [ ] Integrar logging de mídia
- [ ] Verificar env vars (UAZAPI_BASE_URL, UAZAPI_TOKEN, OPENAI_API_KEY)
- [ ] Deploy Edge Function (`supabase functions deploy process-whatsapp-message`)
- [ ] Testar áudio simples
- [ ] Testar áudio com consulta
- [ ] Testar imagem com caption
- [ ] Testar imagem sem caption
- [ ] Testar encaminhamentos
- [ ] Testar erros (áudio inaudível, imagem ilegível)
- [ ] Verificar logs na tabela wa_media_processing_log

---

## 📌 NOTAS FINAIS

1. **NÃO precisa de Edge Function separada** — tudo roda dentro de `process-whatsapp-message` com dois novos módulos (audio-handler.ts e image-handler.ts)

2. **A UAZAPI faz o trabalho pesado** — ela baixa o áudio encriptado do WhatsApp, decodifica, converte pra MP3, e transcreve via Whisper. Nós só chamamos `/message/download` com `transcribe: true`.

3. **Encaminhamentos funcionam automaticamente** — o payload é idêntico, a UAZAPI não diferencia mensagem original de encaminhada no download.

4. **GPT-4o é preferível ao Gemini Vision** para este caso porque já temos a API Key da OpenAI configurada e o modelo tem excelente performance com screenshots de interfaces/documentos.

5. **O texto transcrito/extraído segue o fluxo EXISTENTE** — vai direto pro NLP Classifier → Action Executor → Response. Sem duplicação de lógica.
// ============================================
// Message Router — WA-01 (versão básica)
// ============================================
// No WA-01, o router apenas ecoa a mensagem para confirmar que está funcionando.
// No WA-02, será substituído pelo NLP classifier com Gemini.

import type { RouteMessageParams, MessageResponse } from './types.ts'

/**
 * Roteia a mensagem recebida para o handler correto.
 * WA-01: Apenas confirma recebimento e identifica tipo básico.
 * WA-02: Adiciona classificação de intenção via Gemini.
 */
export async function routeMessage(params: RouteMessageParams): Promise<MessageResponse> {
  const { user, parsed } = params

  // WA-01: Resposta básica de echo para validar infraestrutura
  const greeting = getGreeting()
  const firstName = user.full_name.split(' ')[0]

  switch (parsed.type) {
    case 'text':
      return {
        text: `${greeting}, ${firstName}! 👋\n\n` +
              `Recebi sua mensagem:\n` +
              `_"${parsed.text}"_\n\n` +
              `🚧 Estou sendo configurado! Em breve vou entender seus comandos.\n\n` +
              `Por enquanto, aqui está o que vou poder fazer:\n` +
              `📋 Criar cards no Kanban\n` +
              `📅 Consultar agenda\n` +
              `⏰ Criar lembretes\n` +
              `📊 Gerar relatórios\n` +
              `💬 Conversar sobre projetos`,
        intent: 'echo',
        confidence: 1.0,
      }

    case 'audio':
      return {
        text: `🎵 Recebi seu áudio, ${firstName}!\n` +
              `Em breve vou conseguir ouvir e entender. Aguarde as próximas atualizações! 🔜`,
        intent: 'audio_received',
        confidence: 1.0,
      }

    case 'image':
      return {
        text: `📸 Recebi sua imagem${parsed.text ? ' com legenda: "' + parsed.text + '"' : ''}!\n` +
              `Em breve vou conseguir analisar imagens. Aguarde! 🔜`,
        intent: 'image_received',
        confidence: 1.0,
      }

    case 'video':
      return {
        text: `🎥 Recebi seu vídeo${parsed.text ? ' com legenda: "' + parsed.text + '"' : ''}!\n` +
              `Em breve vou poder processar vídeos. Aguarde! 🔜`,
        intent: 'video_received',
        confidence: 1.0,
      }

    case 'document':
      return {
        text: `📄 Recebi seu documento${parsed.text ? ': "' + parsed.text + '"' : ''}!\n` +
              `Em breve vou poder analisar documentos. Aguarde! 🔜`,
        intent: 'document_received',
        confidence: 1.0,
      }

    case 'sticker':
      return {
        text: `😄 Recebi seu sticker, ${firstName}!\n` +
              `Ainda não sei interpretar stickers, mas em breve! 🔜`,
        intent: 'sticker_received',
        confidence: 1.0,
      }

    case 'location':
      return {
        text: `📍 Recebi sua localização, ${firstName}!\n` +
              `Em breve vou poder usar isso. Aguarde! 🔜`,
        intent: 'location_received',
        confidence: 1.0,
      }

    default:
      return {
        text: `Recebi sua mensagem do tipo: ${parsed.type}. ` +
              `Em breve vou poder processar esse tipo de conteúdo! 🔜`,
        intent: 'unknown_type',
        confidence: 0.5,
      }
  }
}

/**
 * Retorna saudação baseada na hora do dia (timezone São Paulo)
 */
function getGreeting(): string {
  const now = new Date()
  // Ajustar para São Paulo (UTC-3)
  const spHour = (now.getUTCHours() - 3 + 24) % 24
  
  if (spHour >= 5 && spHour < 12) return 'Bom dia'
  if (spHour >= 12 && spHour < 18) return 'Boa tarde'
  return 'Boa noite'
}

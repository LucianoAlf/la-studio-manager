/**
 * report-helpers.ts — WA-05
 * Funções compartilhadas entre daily-digest.ts, weekly-summary.ts, e reminder-processor.ts.
 * Inclui: envio UAZAPI, cálculo de datas, formatação, resolução de nomes, quiet hours.
 */

// ============================================
// ENVIO UAZAPI
// ============================================

export async function sendWhatsApp(
  serverUrl: string,
  token: string,
  phone: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({
        number: phone,
        text,
        delay: 1000,
        linkPreview: false,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${JSON.stringify(data)}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}


// ============================================
// DATAS — Timezone São Paulo (UTC-3)
// ============================================

export function getSPNow(): Date {
  return new Date(Date.now() - 3 * 60 * 60000)
}

function spToUtc(y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(Date.UTC(y, m, d, h + 3, min))
}

export function getDateRangeForPeriod(period: string): { start: Date; end: Date } {
  const sp = getSPNow()
  const spYear = sp.getUTCFullYear()
  const spMonth = sp.getUTCMonth()
  const spDate = sp.getUTCDate()
  const spDay = sp.getUTCDay() // 0=dom

  switch (period) {
    case 'today':
      return {
        start: spToUtc(spYear, spMonth, spDate, 0, 0),
        end: spToUtc(spYear, spMonth, spDate, 23, 59),
      }

    case 'this_week': {
      const mondayOffset = spDay === 0 ? -6 : 1 - spDay
      const mondayDate = spDate + mondayOffset
      return {
        start: spToUtc(spYear, spMonth, mondayDate, 0, 0),
        end: spToUtc(spYear, spMonth, mondayDate + 6, 23, 59),
      }
    }

    case 'last_week': {
      // Segunda passada a domingo passado
      const mondayOffset = spDay === 0 ? -6 : 1 - spDay
      const lastMondayDate = spDate + mondayOffset - 7
      return {
        start: spToUtc(spYear, spMonth, lastMondayDate, 0, 0),
        end: spToUtc(spYear, spMonth, lastMondayDate + 6, 23, 59),
      }
    }

    case 'this_month':
      return {
        start: spToUtc(spYear, spMonth, 1, 0, 0),
        end: spToUtc(spYear, spMonth + 1, 0, 23, 59),
      }

    default:
      return {
        start: spToUtc(spYear, spMonth, spDate, 0, 0),
        end: spToUtc(spYear, spMonth, spDate, 23, 59),
      }
  }
}


// ============================================
// FORMATAÇÃO
// ============================================

export function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const sp = new Date(d.getTime() - 3 * 60 * 60000)
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return `${days[sp.getUTCDay()]} ${sp.getUTCDate().toString().padStart(2,'0')}/${(sp.getUTCMonth()+1).toString().padStart(2,'0')} ${sp.getUTCHours().toString().padStart(2,'0')}:${sp.getUTCMinutes().toString().padStart(2,'0')}`
}

export function formatDateOnlyBR(date: string): string {
  const d = new Date(date)
  const sp = new Date(d.getTime() - 3 * 60 * 60000)
  return `${sp.getUTCDate().toString().padStart(2, '0')}/${(sp.getUTCMonth() + 1).toString().padStart(2, '0')}`
}

export function formatDateShort(date: Date): string {
  const sp = new Date(date.getTime() - 3 * 60 * 60000)
  return `${sp.getUTCDate().toString().padStart(2, '0')}/${(sp.getUTCMonth() + 1).toString().padStart(2, '0')}`
}

export function getPriorityEmoji(p: string): string {
  return ({ urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪' } as Record<string,string>)[p] || '🟡'
}

export function getCalendarTypeEmoji(t: string): string {
  return ({ event: '🎉', delivery: '📦', creation: '🎨', task: '✅', meeting: '🤝' } as Record<string,string>)[t] || '📅'
}


// ============================================
// RESOLUÇÃO DE NOMES
// ============================================

/**
 * Resolve auth.users.id → full_name via user_profiles.user_id (lookup manual).
 * Mesmo padrão do WA-04 query-handler.ts.
 */
export async function resolveUserNames(
  supabase: any,
  authUserIds: string[]
): Promise<Record<string, string>> {
  const nameMap: Record<string, string> = {}
  if (!authUserIds || authUserIds.length === 0) return nameMap

  const uniqueIds = [...new Set(authUserIds.filter(Boolean))]
  if (uniqueIds.length === 0) return nameMap

  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('user_id, full_name')
    .in('user_id', uniqueIds)

  if (error || !profiles) return nameMap

  for (const p of profiles) {
    if (p.user_id && p.full_name) {
      nameMap[p.user_id] = p.full_name
    }
  }

  return nameMap
}


// ============================================
// TELEFONE DO USUÁRIO
// ============================================

/**
 * Busca telefone do usuário via contacts (fonte única de verdade).
 * Centralizado aqui para evitar duplicação em daily-digest e weekly-summary.
 */
export async function getUserPhone(supabase: any, profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('contacts')
    .select('phone')
    .eq('user_profile_id', profileId)
    .is('deleted_at', null)
    .limit(1)
    .single()

  return data?.phone || null
}


// ============================================
// QUIET HOURS + PREFERÊNCIAS
// ============================================

/**
 * Verifica se o usuário está em horário de silêncio.
 * Suporta cruzamento de meia-noite (ex: 22:00 → 07:00).
 */
export async function isInQuietHours(supabase: any, profileId: string): Promise<boolean> {
  const { data: prefs } = await supabase
    .from('user_notification_settings')
    .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone')
    .eq('user_id', profileId)
    .single()

  if (!prefs) return false // Sem preferências = sem quiet hours
  if (prefs.quiet_hours_enabled === false) return false // Quiet hours desabilitado

  // Hora atual em SP
  const spNow = getSPNow()
  const currentHour = spNow.getUTCHours()
  const currentMinute = spNow.getUTCMinutes()
  const currentTime = currentHour * 60 + currentMinute // minutos desde meia-noite

  const [startH, startM] = (prefs.quiet_hours_start || '22:00').split(':').map(Number)
  const [endH, endM] = (prefs.quiet_hours_end || '07:00').split(':').map(Number)
  const startTime = startH * 60 + startM
  const endTime = endH * 60 + endM

  // Quiet hours cruzam meia-noite? (ex: 22:00 → 07:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime
  } else {
    return currentTime >= startTime && currentTime < endTime
  }
}

/**
 * Verifica se lembretes estão habilitados para o usuário.
 */
export async function areRemindersEnabled(supabase: any, profileId: string): Promise<boolean> {
  const { data: prefs } = await supabase
    .from('user_notification_settings')
    .select('reminders_enabled')
    .eq('user_id', profileId)
    .single()

  // Se não tem preferências, assume habilitado (fallback seguro)
  return prefs?.reminders_enabled !== false
}

/**
 * Verifica se o horário atual corresponde ao horário configurado pelo usuário.
 * Usado pelo daily-digest e weekly-summary para respeitar preferências de horário.
 * Tolerância de ±30 minutos para acomodar o intervalo do cron.
 */
export function isWithinScheduledTime(configuredTime: string | null, toleranceMinutes: number = 30): boolean {
  if (!configuredTime) return true // Sem configuração = sempre enviar

  const spNow = getSPNow()
  const currentMinutes = spNow.getUTCHours() * 60 + spNow.getUTCMinutes()

  const [h, m] = configuredTime.split(':').map(Number)
  const configuredMinutes = h * 60 + m

  const diff = Math.abs(currentMinutes - configuredMinutes)
  // Considerar cruzamento de meia-noite
  const wrappedDiff = Math.min(diff, 1440 - diff)

  return wrappedDiff <= toleranceMinutes
}

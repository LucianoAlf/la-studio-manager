'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

interface UseRealtimeSubscriptionOptions {
  table: string
  schema?: string
  event?: PostgresChangeEvent | '*'
  filter?: string
  onInsert?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onDelete?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  enabled?: boolean
}

export function useRealtimeSubscription({
  table,
  schema = 'public',
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  // Usar refs para callbacks para evitar re-subscriptions
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const onChangeRef = useRef(onChange)

  onInsertRef.current = onInsert
  onUpdateRef.current = onUpdate
  onDeleteRef.current = onDelete
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()

    const channelName = `realtime:${table}:${filter || 'all'}`

    const channelConfig: Record<string, unknown> = {
      event,
      schema,
      table,
    }

    if (filter) {
      channelConfig.filter = filter
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        channelConfig as never,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          onChangeRef.current?.(payload)

          switch (payload.eventType) {
            case 'INSERT':
              onInsertRef.current?.(payload)
              break
            case 'UPDATE':
              onUpdateRef.current?.(payload)
              break
            case 'DELETE':
              onDeleteRef.current?.(payload)
              break
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, schema, event, filter, enabled])
}

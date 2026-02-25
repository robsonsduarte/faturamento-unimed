import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * Inserts a record into audit_log.
 * Fire-and-forget — does not throw on failure to avoid blocking the main operation.
 */
export async function auditLog(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
  request?: NextRequest
): Promise<void> {
  const ip = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ?? null,
    ip_address: ip,
  }).then(({ error }) => {
    if (error) console.error('[AUDIT] Failed to insert audit log:', error.message)
  })
}

import { describe, it, expect, vi } from 'vitest'
import { auditLog } from '@/lib/audit'

function createMockSupabase(insertError: { message: string } | null = null) {
  const insertFn = vi.fn().mockReturnValue(
    Promise.resolve({ error: insertError })
  )
  return {
    from: vi.fn().mockReturnValue({ insert: insertFn }),
    _insertFn: insertFn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function createMockRequest(ip = '192.168.1.1') {
  return {
    headers: new Map([['x-forwarded-for', ip]]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('auditLog', () => {
  it('should insert audit log record with correct fields', async () => {
    const supabase = createMockSupabase()
    const request = createMockRequest('10.0.0.1')

    await auditLog(supabase, 'user-123', 'guia.update', 'guia', 'guia-456', { status: 'COMPLETA' }, request)

    expect(supabase.from).toHaveBeenCalledWith('audit_log')
    expect(supabase._insertFn).toHaveBeenCalledWith({
      user_id: 'user-123',
      action: 'guia.update',
      entity_type: 'guia',
      entity_id: 'guia-456',
      details: { status: 'COMPLETA' },
      ip_address: '10.0.0.1',
    })
  })

  it('should handle missing request (no IP)', async () => {
    const supabase = createMockSupabase()

    await auditLog(supabase, 'user-123', 'guia.delete', 'guia', 'guia-789')

    expect(supabase._insertFn).toHaveBeenCalledWith({
      user_id: 'user-123',
      action: 'guia.delete',
      entity_type: 'guia',
      entity_id: 'guia-789',
      details: null,
      ip_address: null,
    })
  })

  it('should not throw on insert failure (fire-and-forget)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = createMockSupabase({ message: 'DB error' })

    // Should not throw
    await expect(
      auditLog(supabase, 'user-123', 'test.action', 'test', 'test-id')
    ).resolves.toBeUndefined()

    consoleSpy.mockRestore()
  })

  it('should extract first IP from x-forwarded-for chain', async () => {
    const supabase = createMockSupabase()
    const request = {
      headers: new Map([['x-forwarded-for', '1.2.3.4, 5.6.7.8, 9.10.11.12']]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    await auditLog(supabase, 'user-123', 'test.action', 'test', 'test-id', undefined, request)

    expect(supabase._insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ ip_address: '1.2.3.4' })
    )
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock NextRequest and NextResponse before importing the module
vi.mock('next/server', () => {
  return {
    NextRequest: class MockNextRequest {
      headers: Map<string, string>
      constructor(url: string, init?: { headers?: Record<string, string> }) {
        this.headers = new Map(Object.entries(init?.headers ?? {}))
      }
    },
    NextResponse: {
      json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
        body,
        status: init?.status ?? 200,
        headers: new Map(Object.entries(init?.headers ?? {})),
      }),
    },
  }
})

// Dynamic import after mock is set up
const { rateLimit } = await import('@/lib/rate-limit')

function createRequest(ip = '127.0.0.1') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { headers: new Map([['x-forwarded-for', ip]]) } as any
}

describe('rateLimit', () => {
  beforeEach(() => {
    // Clear the internal store between tests by re-importing would be complex,
    // so we use unique keys per test to avoid cross-contamination
  })

  it('should allow requests under the limit', () => {
    const req = createRequest('10.0.0.1')
    const result = rateLimit(req, 'test-allow', 5, 60_000)
    expect(result).toBeNull()
  })

  it('should allow multiple requests up to the limit', () => {
    const req = createRequest('10.0.0.2')
    const key = 'test-multi'

    for (let i = 0; i < 3; i++) {
      const result = rateLimit(req, key, 3, 60_000)
      if (i < 3) {
        expect(result).toBeNull()
      }
    }
  })

  it('should return 429 when limit is exceeded', () => {
    const req = createRequest('10.0.0.3')
    const key = 'test-exceeded'
    const limit = 2

    // Use up the limit
    rateLimit(req, key, limit, 60_000)
    rateLimit(req, key, limit, 60_000)

    // Third request should be rate limited
    const result = rateLimit(req, key, limit, 60_000)
    expect(result).not.toBeNull()
    expect(result?.status).toBe(429)
  })

  it('should track different IPs separately', () => {
    const req1 = createRequest('10.0.0.4')
    const req2 = createRequest('10.0.0.5')
    const key = 'test-ips'

    // Fill up limit for IP 1
    rateLimit(req1, key, 1, 60_000)
    const blocked = rateLimit(req1, key, 1, 60_000)
    expect(blocked).not.toBeNull()

    // IP 2 should still be allowed
    const allowed = rateLimit(req2, key, 1, 60_000)
    expect(allowed).toBeNull()
  })

  it('should track different keys separately', () => {
    const req = createRequest('10.0.0.6')

    rateLimit(req, 'key-a', 1, 60_000)
    const blockedA = rateLimit(req, 'key-a', 1, 60_000)
    expect(blockedA).not.toBeNull()

    // Different key should still be allowed
    const allowedB = rateLimit(req, 'key-b', 1, 60_000)
    expect(allowedB).toBeNull()
  })

  it('should include Retry-After header in 429 response', () => {
    const req = createRequest('10.0.0.7')
    const key = 'test-retry-header'

    rateLimit(req, key, 1, 60_000)
    const result = rateLimit(req, key, 1, 60_000)

    expect(result).not.toBeNull()
    expect(result?.headers.get('Retry-After')).toBeDefined()
    const retryAfter = Number(result?.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60)
  })

  it('should use "unknown" when x-forwarded-for is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = { headers: new Map() } as any
    const key = 'test-no-ip'

    const result = rateLimit(req, key, 5, 60_000)
    expect(result).toBeNull()
  })

  it('should use default limit of 30 when not specified', () => {
    const req = createRequest('10.0.0.8')
    const key = 'test-default-limit'

    // Should allow 30 requests with default
    for (let i = 0; i < 30; i++) {
      const result = rateLimit(req, key)
      expect(result).toBeNull()
    }

    // 31st should be blocked
    const blocked = rateLimit(req, key)
    expect(blocked).not.toBeNull()
  })
})

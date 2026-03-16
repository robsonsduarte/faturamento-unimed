import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Simple in-memory sliding window rate limiter.
 * Returns null if allowed, or a 429 response if rate limited.
 *
 * @param request - The incoming request (uses x-forwarded-for or fallback)
 * @param key - A unique key prefix for this endpoint (e.g. 'saw-login')
 * @param limit - Max requests per window (default: 30)
 * @param windowMs - Window duration in ms (default: 60s)
 */
export function rateLimit(
  request: NextRequest,
  key: string,
  limit = 30,
  windowMs = 60_000
): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rateLimitKey = `${key}:${ip}`
  const now = Date.now()
  const entry = store.get(rateLimitKey)

  if (!entry || now > entry.resetAt) {
    store.set(rateLimitKey, { count: 1, resetAt: now + windowMs })
    return null
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Rate limit excedido. Tente novamente em breve.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    )
  }

  entry.count++
  return null
}

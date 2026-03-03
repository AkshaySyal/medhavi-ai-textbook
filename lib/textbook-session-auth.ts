import { clerkClient } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

type TextbookSessionPayload = {
  userId: string
  email?: string
  textbookId?: string
  exp?: number
  iat?: number
  timestamp?: number
}

type RequestLike = Request | NextRequest

function extractSessionToken(request: RequestLike): string | null {
  const headerToken =
    request.headers.get('x-textbook-session') ||
    request.headers.get('x-medhavi-session') ||
    request.headers.get('x-access-token')
  if (headerToken) {
    return headerToken.trim()
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }

  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=')
    if (name === 'textbook_session') {
      return decodeURIComponent(rest.join('='))
    }
  }

  return null
}

function decodeToken(token: string): TextbookSessionPayload | null {
  if (!token) return null
  if (JWT_SECRET) {
    try {
      return jwt.verify(token, JWT_SECRET) as TextbookSessionPayload
    } catch (error) {
      console.warn('JWT textbook session verify failed, attempting base64 fallback')
    }
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString()
    return JSON.parse(decoded) as TextbookSessionPayload
  } catch {
    console.error('Failed to decode textbook session token')
    return null
  }
}

function isTokenExpired(payload: TextbookSessionPayload): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (payload.exp && nowSeconds > payload.exp) {
    return true
  }

  if (payload.timestamp) {
    const age = Date.now() - payload.timestamp
    if (age > MAX_TOKEN_AGE_MS) {
      return true
    }
  }

  return false
}

export async function resolveTextbookUserId(request: RequestLike): Promise<string | null> {
  const token = extractSessionToken(request)
  if (!token) return null

  const payload = decodeToken(token)
  if (!payload?.userId) {
    console.warn('Invalid textbook session payload - missing userId')
    return null
  }

  if (isTokenExpired(payload)) {
    console.warn('Textbook session token expired')
    return null
  }

  try {
    const client = await clerkClient()
    const user = await client.users.getUser(payload.userId)
    if (!user || user.banned) {
      console.warn('Textbook session user not found or banned', payload.userId)
      return null
    }

    const metadata = user.publicMetadata as Record<string, unknown>
    const lastLogoutAt = typeof metadata?.lastLogoutAt === 'number' ? metadata.lastLogoutAt : undefined
    const issuedAtSeconds =
      payload.iat ?? Math.floor(((payload.timestamp as number | undefined) ?? Date.now()) / 1000)

    if (lastLogoutAt && issuedAtSeconds < lastLogoutAt) {
      console.warn('Textbook session token predates last logout - rejecting token')
      return null
    }

    return user.id
  } catch (error) {
    console.error('Failed to resolve textbook session user', error)
    return null
  }
}



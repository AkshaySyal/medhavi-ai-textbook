import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { endAnalyticsSession, startAnalyticsSession } from '@/lib/analytics'
import { resolveTextbookUserId } from '@/lib/textbook-session-auth'

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    const userId = user?.id || (await resolveTextbookUserId(request))
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = body?.action

    if (action === 'start') {
      const result = await startAnalyticsSession({
        userId,
        platform: body?.platform,
        metadata: body?.metadata
      })
      return NextResponse.json(result)
    }

    if (action === 'end') {
      if (!body?.sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
      }
      const result = await endAnalyticsSession({
        userId,
        sessionId: body.sessionId,
        metadata: body?.metadata
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Analytics session error:', error)
    return NextResponse.json({ error: 'Failed to process session' }, { status: 500 })
  }
}


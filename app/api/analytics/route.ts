import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getUserAnalytics, recordAnalyticsEvent } from '@/lib/analytics'
import { resolveTextbookUserId } from '@/lib/textbook-session-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser()
    const userId = user?.id || (await resolveTextbookUserId(request))
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const type = (request.nextUrl.searchParams.get('type') as 'summary' | 'sessions' | 'events') || 'summary'
    const data = await getUserAnalytics(userId, type)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    const userId = user?.id || (await resolveTextbookUserId(request))
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (!body?.type) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 })
    }

    const result = await recordAnalyticsEvent({
      userId,
      type: body.type,
      platform: body.platform,
      metadata: body.metadata
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analytics event error:', error)
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
  }
}


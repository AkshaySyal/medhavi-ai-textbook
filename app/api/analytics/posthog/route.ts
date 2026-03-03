import { NextResponse, type NextRequest } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY || ''

const NOT_ADMIN = `(person.properties.role IS NULL OR person.properties.role != 'admin')`

async function posthogQuery(query: string, retries = 2): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${POSTHOG_HOST}/api/projects/@current/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    })

    if (res.ok) {
      const data = await res.json()
      return data.results || []
    }

    const text = await res.text()
    console.error(`PostHog query failed (attempt ${attempt + 1}):`, res.status, text)

    // Retry on 500 server errors, not on 4xx
    if (res.status >= 500 && attempt < retries) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }

    throw new Error(`PostHog query failed: ${res.status}`)
  }
  return []
}

function sanitize(str: string) {
  return str.replace(/'/g, "\\'")
}

// ─── Overview ───────────────────────────────────────────────
async function getOverview() {
  // Run queries sequentially to avoid PostHog rate limits
  const overviewRows = await posthogQuery(`
    SELECT
      count(DISTINCT person_id) as unique_users,
      count(DISTINCT properties.$session_id) as total_sessions,
      count(*) as total_events,
      countIf(event = 'ai_chat_message') as ai_interactions,
      countIf(event = 'textbook_opened') as textbook_opens,
      countIf(event = '$pageview') as total_pageviews
    FROM events
    WHERE timestamp > now() - interval 30 day AND ${NOT_ADMIN}
  `)
  const dailyActiveRows = await posthogQuery(`
    SELECT toDate(timestamp) as day, count(DISTINCT person_id) as users, count(*) as events
    FROM events
    WHERE timestamp > now() - interval 14 day AND ${NOT_ADMIN}
    GROUP BY day ORDER BY day ASC
  `)
  const topUsersRows = await posthogQuery(`
    SELECT person.properties.email as email, person.properties.name as name,
      count(DISTINCT properties.$session_id) as sessions, count(*) as total_events,
      countIf(event = '$pageview') as pageviews
    FROM events
    WHERE timestamp > now() - interval 30 day AND person.properties.email IS NOT NULL AND ${NOT_ADMIN}
    GROUP BY email, name ORDER BY total_events DESC LIMIT 10
  `)
  const aiLeadersRows = await posthogQuery(`
    SELECT person.properties.email as email, person.properties.name as name,
      count(*) as ai_messages, max(timestamp) as last_used
    FROM events
    WHERE event = 'ai_chat_message' AND timestamp > now() - interval 30 day
      AND person.properties.email IS NOT NULL AND ${NOT_ADMIN}
    GROUP BY email, name ORDER BY ai_messages DESC LIMIT 10
  `)
  const textbookRows = await posthogQuery(`
    SELECT properties.textbook_title as title, properties.textbook_id as textbook_id,
      count(*) as opens, count(DISTINCT person_id) as unique_users, max(timestamp) as last_opened
    FROM events
    WHERE event = 'textbook_opened' AND timestamp > now() - interval 30 day AND ${NOT_ADMIN}
    GROUP BY title, textbook_id ORDER BY opens DESC LIMIT 10
  `)
  const recentEventsRows = await posthogQuery(`
    SELECT person.properties.email as email, person.properties.name as name,
      event, timestamp, properties.$current_url as url
    FROM events
    WHERE event IN ('textbook_opened','ai_chat_message','ai_chat_error','textbook_page_viewed','ai_chat_opened')
      AND timestamp > now() - interval 7 day AND ${NOT_ADMIN}
    ORDER BY timestamp DESC LIMIT 50
  `)
  const platformRows = await posthogQuery(`
    SELECT properties.$host as host, count(DISTINCT person_id) as users,
      count(DISTINCT properties.$session_id) as sessions, count(*) as events
    FROM events
    WHERE timestamp > now() - interval 30 day AND properties.$host IS NOT NULL AND ${NOT_ADMIN}
    GROUP BY host ORDER BY events DESC
  `)

  const ov = overviewRows[0] || [0, 0, 0, 0, 0, 0]
  return {
    overview: {
      uniqueUsers: Number(ov[0]) || 0, totalSessions: Number(ov[1]) || 0,
      totalEvents: Number(ov[2]) || 0, aiInteractions: Number(ov[3]) || 0,
      textbookOpens: Number(ov[4]) || 0, totalPageviews: Number(ov[5]) || 0,
    },
    dailyActive: dailyActiveRows.map((r: any[]) => ({ day: r[0], users: Number(r[1]) || 0, events: Number(r[2]) || 0 })),
    topUsers: topUsersRows.map((r: any[]) => ({ email: r[0] || 'Unknown', name: r[1] || 'Unknown', sessions: Number(r[2]) || 0, totalEvents: Number(r[3]) || 0, pageviews: Number(r[4]) || 0 })),
    aiLeaders: aiLeadersRows.map((r: any[]) => ({ email: r[0] || 'Unknown', name: r[1] || 'Unknown', aiMessages: Number(r[2]) || 0, lastUsed: r[3] || null })),
    textbooks: textbookRows.map((r: any[]) => ({ title: r[0] || 'Unknown Textbook', textbookId: r[1] || '', opens: Number(r[2]) || 0, uniqueUsers: Number(r[3]) || 0, lastOpened: r[4] || null })),
    recentEvents: recentEventsRows.map((r: any[]) => ({ email: r[0] || 'Unknown', name: r[1] || 'Unknown', event: r[2] || '', timestamp: r[3] || '', url: r[4] || '' })),
    platforms: platformRows.map((r: any[]) => ({ host: r[0] || 'Unknown', users: Number(r[1]) || 0, sessions: Number(r[2]) || 0, events: Number(r[3]) || 0 })),
  }
}

// ─── User List ──────────────────────────────────────────────
async function getUserList(role: string) {
  const roleFilter = role === 'student'
    ? `(person.properties.role = 'student' OR person.properties.role IS NULL)`
    : `person.properties.role = '${sanitize(role)}'`

  const rows = await posthogQuery(`
    SELECT
      person.properties.email as email,
      person.properties.name as name,
      person.properties.role as role,
      count(*) as total_events,
      count(DISTINCT properties.$session_id) as sessions,
      countIf(event = '$pageview') as pageviews,
      countIf(event = 'textbook_opened') as textbook_opens,
      countIf(event = 'ai_chat_message') as ai_messages,
      countIf(event = 'textbook_page_viewed') as pages_viewed,
      min(timestamp) as first_seen,
      max(timestamp) as last_seen
    FROM events
    WHERE timestamp > now() - interval 30 day
      AND person.properties.email IS NOT NULL
      AND ${NOT_ADMIN}
      AND ${roleFilter}
    GROUP BY email, name, role
    ORDER BY total_events DESC
    LIMIT 100
  `)

  return {
    users: rows.map((r: any[]) => ({
      email: r[0] || 'Unknown',
      name: r[1] || 'Unknown',
      role: r[2] || 'student',
      totalEvents: Number(r[3]) || 0,
      sessions: Number(r[4]) || 0,
      pageviews: Number(r[5]) || 0,
      textbookOpens: Number(r[6]) || 0,
      aiMessages: Number(r[7]) || 0,
      pagesViewed: Number(r[8]) || 0,
      firstSeen: r[9] || null,
      lastSeen: r[10] || null,
    })),
  }
}

// ─── User Detail ────────────────────────────────────────────
async function getUserDetail(email: string) {
  const safe = sanitize(email)

  const [summaryRows, textbookRows, aiRows, timelineRows] = await Promise.all([
    posthogQuery(`
      SELECT
        person.properties.email as email,
        person.properties.name as name,
        person.properties.role as role,
        count(*) as total_events,
        count(DISTINCT properties.$session_id) as sessions,
        countIf(event = '$pageview') as pageviews,
        countIf(event = 'ai_chat_message') as ai_messages,
        countIf(event = 'textbook_opened') as textbook_opens,
        min(timestamp) as first_seen,
        max(timestamp) as last_seen
      FROM events
      WHERE timestamp > now() - interval 30 day
        AND person.properties.email = '${safe}'
      GROUP BY email, name, role
      ORDER BY total_events DESC
      LIMIT 1
    `),
    posthogQuery(`
      SELECT
        properties.textbook_title as title,
        properties.textbook_id as textbook_id,
        count(*) as open_count,
        max(timestamp) as last_opened
      FROM events
      WHERE event = 'textbook_opened'
        AND timestamp > now() - interval 30 day
        AND person.properties.email = '${safe}'
      GROUP BY title, textbook_id
      ORDER BY open_count DESC
    `),
    posthogQuery(`
      SELECT
        properties.page_path as page_path,
        properties.platform as platform,
        count(*) as message_count,
        max(timestamp) as last_message
      FROM events
      WHERE event = 'ai_chat_message'
        AND timestamp > now() - interval 30 day
        AND person.properties.email = '${safe}'
      GROUP BY page_path, platform
      ORDER BY message_count DESC
    `),
    posthogQuery(`
      SELECT
        event,
        timestamp,
        properties.$current_url as url,
        properties.page_path as page_path,
        properties.textbook_title as textbook_title,
        properties.platform as platform,
        properties.question as question
      FROM events
      WHERE timestamp > now() - interval 30 day
        AND person.properties.email = '${safe}'
        AND event IN ('textbook_opened','ai_chat_message','ai_chat_error','textbook_page_viewed','ai_chat_opened','$pageview')
      ORDER BY timestamp DESC
      LIMIT 100
    `),
  ])

  const s = summaryRows[0] || ['', '', '', 0, 0, 0, 0, 0, null, null]

  return {
    user: {
      email: s[0] || email,
      name: s[1] || 'Unknown',
      role: s[2] || 'student',
      totalEvents: Number(s[3]) || 0,
      sessions: Number(s[4]) || 0,
      pageviews: Number(s[5]) || 0,
      aiMessages: Number(s[6]) || 0,
      textbookOpens: Number(s[7]) || 0,
      firstSeen: s[8] || null,
      lastSeen: s[9] || null,
    },
    textbooks: textbookRows.map((r: any[]) => ({
      title: r[0] || 'Unknown Textbook',
      textbookId: r[1] || '',
      openCount: Number(r[2]) || 0,
      lastOpened: r[3] || null,
    })),
    aiActivity: aiRows.map((r: any[]) => ({
      pagePath: r[0] || 'Unknown page',
      platform: r[1] || '',
      messageCount: Number(r[2]) || 0,
      lastMessage: r[3] || null,
    })),
    timeline: timelineRows.map((r: any[]) => ({
      event: r[0] || '',
      timestamp: r[1] || '',
      url: r[2] || '',
      pagePath: r[3] || '',
      textbookTitle: r[4] || '',
      platform: r[5] || '',
      question: r[6] || '',
    })),
  }
}

// ─── Route Handler ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!POSTHOG_PERSONAL_API_KEY) {
      return NextResponse.json({ error: 'POSTHOG_PERSONAL_API_KEY not configured' }, { status: 500 })
    }

    const { searchParams } = request.nextUrl
    const view = searchParams.get('view') || 'overview'

    if (view === 'overview') {
      return NextResponse.json(await getOverview())
    }

    if (view === 'users') {
      const role = searchParams.get('role') || 'student'
      if (!['student', 'instructor'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      return NextResponse.json(await getUserList(role))
    }

    if (view === 'user-detail') {
      const email = searchParams.get('email')
      if (!email || !/^[^\s'";<>]+@[^\s'";<>]+\.[^\s'";<>]+$/.test(email)) {
        return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
      }
      return NextResponse.json(await getUserDetail(email))
    }

    return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 })
  } catch (error) {
    console.error('PostHog dashboard error:', error)
    return NextResponse.json({ error: 'Failed to load PostHog analytics' }, { status: 500 })
  }
}

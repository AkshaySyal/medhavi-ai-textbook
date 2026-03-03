import { clerkClient } from '@clerk/nextjs/server'
import type {
  AIUsageSummary,
  AnalyticsEvent,
  AnalyticsSession,
  AnalyticsSummary,
  DashboardAnalytics,
  TextbookUsageSummary,
  UserAnalyticsMetadata
} from '@/types/analytics'
import type { UserMetadata } from '@/types/textbook'

const MAX_SESSION_HISTORY = 10
const MAX_EVENT_HISTORY = 10

type StartSessionParams = {
  userId: string
  platform?: string
  metadata?: Record<string, unknown>
}

type EndSessionParams = {
  userId: string
  sessionId: string
  metadata?: Record<string, unknown>
}

type RecordEventParams = {
  userId: string
  type: string
  platform?: string
  metadata?: Record<string, unknown>
}

type UserAnalyticsPayload = {
  analytics: UserAnalyticsMetadata
  metadata: UserMetadata
  client: Awaited<ReturnType<typeof clerkClient>>
}

const createEmptyAIUsage = (): AIUsageSummary => ({
  totalInteractions: 0,
  promptsByPlatform: {},
  lastUsedAt: undefined,
  tokensGenerated: 0
})

const createEmptySummary = (): AnalyticsSummary => ({
  totalSessions: 0,
  totalTimeSpent: 0,
  lastActiveAt: undefined,
  platformBreakdown: {},
  textbookUsage: {},
  aiUsage: createEmptyAIUsage()
})

const createEmptyAnalytics = (): UserAnalyticsMetadata => ({
  summary: createEmptySummary(),
  sessions: [],
  events: []
})

function trimHistory<T>(items: T[], max: number) {
  if (items.length <= max) return items
  return items.slice(items.length - max)
}

function normalizeAnalytics(raw?: Partial<UserAnalyticsMetadata>): UserAnalyticsMetadata {
  if (!raw) return createEmptyAnalytics()
  return {
    summary: {
      ...createEmptySummary(),
      ...raw.summary,
      platformBreakdown: { ...createEmptySummary().platformBreakdown, ...(raw.summary?.platformBreakdown || {}) },
      textbookUsage: { ...createEmptySummary().textbookUsage, ...(raw.summary?.textbookUsage || {}) },
      aiUsage: {
        ...createEmptyAIUsage(),
        ...(raw.summary?.aiUsage || {}),
        promptsByPlatform: {
          ...createEmptyAIUsage().promptsByPlatform,
          ...(raw.summary?.aiUsage?.promptsByPlatform || {})
        }
      }
    },
    sessions: raw.sessions ? trimHistory([...raw.sessions], MAX_SESSION_HISTORY) : [],
    events: raw.events ? trimHistory([...raw.events], MAX_EVENT_HISTORY) : []
  }
}

async function getUserAnalyticsPayload(userId: string): Promise<UserAnalyticsPayload> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const metadata = (user.publicMetadata || {}) as UserMetadata
  const analytics = normalizeAnalytics(metadata.analytics)

  return { analytics, metadata, client }
}

function diffSeconds(start: string, end: string) {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0
  }
  const diff = Math.round((endMs - startMs) / 1000)
  return diff > 0 ? diff : 0
}

function getMetadataValue<T = unknown>(data: Record<string, unknown> | undefined, key: string): T | undefined {
  if (!data) return undefined
  return data[key] as T | undefined
}

export async function startAnalyticsSession({ userId, platform = 'hub', metadata }: StartSessionParams) {
  const { analytics, metadata: userMetadata, client } = await getUserAnalyticsPayload(userId)
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()

  const session: AnalyticsSession = {
    id: sessionId,
    platform,
    startedAt: now
  }

  if (metadata) {
    session.metadata = metadata
  }

  analytics.sessions = trimHistory([...analytics.sessions, session], MAX_SESSION_HISTORY)

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...userMetadata,
      analytics
    }
  })

  return { sessionId }
}

export async function endAnalyticsSession({ userId, sessionId, metadata }: EndSessionParams) {
  const { analytics, metadata: userMetadata, client } = await getUserAnalyticsPayload(userId)
  const sessionIndex = analytics.sessions.findIndex((s) => s.id === sessionId)

  if (sessionIndex === -1) {
    return { sessionId, duration: 0 }
  }

  const session = analytics.sessions[sessionIndex]
  if (session.endedAt && session.duration) {
    return { sessionId, duration: session.duration }
  }

  const endedAt = new Date().toISOString()
  const duration = diffSeconds(session.startedAt, endedAt)

  analytics.sessions[sessionIndex] = {
    ...session,
    endedAt,
    duration,
    metadata: metadata
      ? {
          ...session.metadata,
          ...metadata
        }
      : session.metadata
  }

  const summary = analytics.summary
  summary.totalSessions += 1
  summary.totalTimeSpent += duration
  summary.lastActiveAt = endedAt

  const platformKey = session.platform || 'hub'
  const platformStats = summary.platformBreakdown[platformKey] || { sessions: 0, timeSpent: 0 }
  platformStats.sessions += 1
  platformStats.timeSpent += duration
  summary.platformBreakdown[platformKey] = platformStats

  analytics.summary = summary

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...userMetadata,
      analytics
    }
  })

  return { sessionId, duration }
}

export async function recordAnalyticsEvent({ userId, type, platform = 'hub', metadata }: RecordEventParams) {
  const { analytics, metadata: userMetadata, client } = await getUserAnalyticsPayload(userId)
  const now = new Date().toISOString()

  const event: AnalyticsEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    platform,
    timestamp: now,
    metadata
  }

  analytics.events = trimHistory([...analytics.events, event], MAX_EVENT_HISTORY)
  analytics.summary.lastActiveAt = now

  if (type === 'textbook_open') {
    const textbookId = getMetadataValue<string>(metadata, 'textbookId') || getMetadataValue<string>(metadata, 'id')
    if (textbookId) {
      const current: TextbookUsageSummary = analytics.summary.textbookUsage[textbookId] || {
        textbookId,
        title: getMetadataValue<string>(metadata, 'textbookTitle') || getMetadataValue<string>(metadata, 'title'),
        opens: 0
      }
      current.opens += 1
      current.title =
        current.title ||
        getMetadataValue<string>(metadata, 'textbookTitle') ||
        getMetadataValue<string>(metadata, 'title')
      current.lastOpenedAt = now
      analytics.summary.textbookUsage[textbookId] = current
    }
  }

  if (type === 'ai_interaction') {
    analytics.summary.aiUsage.totalInteractions += 1
    analytics.summary.aiUsage.lastUsedAt = now
    const platformKey = platform || getMetadataValue<string>(metadata, 'platform') || 'hub'
    analytics.summary.aiUsage.promptsByPlatform[platformKey] =
      (analytics.summary.aiUsage.promptsByPlatform[platformKey] || 0) + 1
    const tokenCount = getMetadataValue<number>(metadata, 'tokens')
    if (typeof tokenCount === 'number') {
      analytics.summary.aiUsage.tokensGenerated =
        (analytics.summary.aiUsage.tokensGenerated || 0) + tokenCount
    }
  }

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...userMetadata,
      analytics
    }
  })

  return { eventId: event.id }
}

export async function getUserAnalytics(userId: string, type: 'summary' | 'sessions' | 'events' = 'summary') {
  const { analytics } = await getUserAnalyticsPayload(userId)

  switch (type) {
    case 'sessions':
      return { sessions: analytics.sessions }
    case 'events':
      return { events: analytics.events }
    default:
      return { summary: analytics.summary }
  }
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const client = await clerkClient()
  const users = await client.users.getUserList({ limit: 500 })

  const platformBreakdown: Record<string, { sessions: number; timeSpent: number }> = {}
  const textbookUsageMap = new Map<string, TextbookUsageSummary & { userIds: Set<string> }>()
  const aiLeadersMap = new Map<
    string,
    { interactions: number; lastUsedAt?: string; name: string; email: string }
  >()
  const recentEvents: DashboardAnalytics['recentEvents'] = []
  const topUsers: DashboardAnalytics['topUsers'] = []

  let trackedUsers = 0
  let totalSessions = 0
  let totalTimeSpent = 0
  let activeUsers = 0
  let aiInteractions = 0

  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  for (const user of users.data) {
    const metadata = (user.publicMetadata || {}) as UserMetadata
    const analytics = normalizeAnalytics(metadata.analytics)
    const summary = analytics.summary
    const hasData =
      summary.totalSessions > 0 ||
      summary.totalTimeSpent > 0 ||
      analytics.events.length > 0

    if (!hasData) {
      continue
    }

    trackedUsers += 1
    totalSessions += summary.totalSessions
    totalTimeSpent += summary.totalTimeSpent
    aiInteractions += summary.aiUsage.totalInteractions

    if (summary.lastActiveAt) {
      const last = new Date(summary.lastActiveAt).getTime()
      if (!Number.isNaN(last) && now - last <= sevenDays) {
        activeUsers += 1
      }
    }

    Object.entries(summary.platformBreakdown).forEach(([platform, stats]) => {
      const current = platformBreakdown[platform] || { sessions: 0, timeSpent: 0 }
      current.sessions += stats.sessions
      current.timeSpent += stats.timeSpent
      platformBreakdown[platform] = current
    })

    Object.values(summary.textbookUsage).forEach((usage) => {
      const existing: TextbookUsageSummary & { userIds: Set<string> } =
        textbookUsageMap.get(usage.textbookId) ?? {
          textbookId: usage.textbookId,
          title: usage.title,
          opens: 0,
          lastOpenedAt: usage.lastOpenedAt,
          userIds: new Set<string>()
        }
      existing.opens += usage.opens
      if (usage.lastOpenedAt) {
        if (!existing.lastOpenedAt || usage.lastOpenedAt > existing.lastOpenedAt) {
          existing.lastOpenedAt = usage.lastOpenedAt
        }
      }
      if (usage.title && !existing.title) {
        existing.title = usage.title
      }
      existing.userIds.add(user.id)
      textbookUsageMap.set(usage.textbookId, existing)
    })

    aiLeadersMap.set(user.id, {
      interactions: summary.aiUsage.totalInteractions,
      lastUsedAt: summary.aiUsage.lastUsedAt,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || 'Unknown',
      email: user.emailAddresses[0]?.emailAddress || 'unknown@example.com'
    })

    topUsers.push({
      userId: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || 'Unknown',
      email: user.emailAddresses[0]?.emailAddress || 'unknown@example.com',
      totalTimeSpent: summary.totalTimeSpent,
      totalSessions: summary.totalSessions,
      lastActiveAt: summary.lastActiveAt
    })

    analytics.events.forEach((event) => {
      recentEvents.push({
        userId: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || 'Unknown',
        email: user.emailAddresses[0]?.emailAddress || 'unknown@example.com',
        event
      })
    })
  }

  recentEvents.sort(
    (a, b) => new Date(b.event.timestamp).getTime() - new Date(a.event.timestamp).getTime()
  )

  const summarizedRecentEvents = recentEvents.slice(0, 25)
  const summarizedTopUsers = topUsers
    .filter((user) => user.totalTimeSpent > 0 || user.totalSessions > 0)
    .sort((a, b) => b.totalTimeSpent - a.totalTimeSpent)
    .slice(0, 8)

  const textbookUsage = Array.from(textbookUsageMap.values())
    .map((usage) => ({
      textbookId: usage.textbookId,
      title: usage.title,
      opens: usage.opens,
      lastOpenedAt: usage.lastOpenedAt,
      users: usage.userIds.size
    }))
    .sort((a, b) => b.opens - a.opens)

  const aiLeaders = Array.from(aiLeadersMap.entries())
    .map(([userId, info]) => ({
      userId,
      name: info.name,
      email: info.email,
      interactions: info.interactions,
      lastUsedAt: info.lastUsedAt
    }))
    .filter((leader) => leader.interactions > 0)
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, 8)

  return {
    summary: {
      totalUsers: users.data.length,
      trackedUsers,
      totalSessions,
      totalTimeSpent,
      activeUsers,
      aiInteractions,
      textbooksTracked: textbookUsage.length,
      platformBreakdown
    },
    topUsers: summarizedTopUsers,
    textbookUsage,
    aiLeaders,
    recentEvents: summarizedRecentEvents
  }
}


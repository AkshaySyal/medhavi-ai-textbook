export type AnalyticsPlatform = 'hub' | 'cancer-textbook' | 'physics-textbook' | string

export interface AnalyticsSession {
  id: string
  platform: AnalyticsPlatform
  startedAt: string
  endedAt?: string
  duration?: number
  metadata?: Record<string, unknown>
}

export interface AnalyticsEvent {
  id: string
  type: string
  platform: AnalyticsPlatform
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface TextbookUsageSummary {
  textbookId: string
  title?: string
  opens: number
  lastOpenedAt?: string
  users?: number
}

export interface AIUsageSummary {
  totalInteractions: number
  promptsByPlatform: Record<string, number>
  lastUsedAt?: string
  tokensGenerated?: number
}

export interface AnalyticsSummary {
  totalSessions: number
  totalTimeSpent: number
  lastActiveAt?: string
  platformBreakdown: Record<string, { sessions: number; timeSpent: number }>
  textbookUsage: Record<string, TextbookUsageSummary>
  aiUsage: AIUsageSummary
}

export interface UserAnalyticsMetadata {
  summary: AnalyticsSummary
  sessions: AnalyticsSession[]
  events: AnalyticsEvent[]
}

export interface DashboardAnalytics {
  summary: {
    totalUsers: number
    trackedUsers: number
    totalSessions: number
    totalTimeSpent: number
    activeUsers: number
    aiInteractions: number
    textbooksTracked: number
    platformBreakdown: Record<string, { sessions: number; timeSpent: number }>
  }
  topUsers: Array<{
    userId: string
    name: string
    email: string
    totalTimeSpent: number
    totalSessions: number
    lastActiveAt?: string
  }>
  textbookUsage: Array<TextbookUsageSummary & { users: number }>
  aiLeaders: Array<{
    userId: string
    name: string
    email: string
    interactions: number
    lastUsedAt?: string
  }>
  recentEvents: Array<{
    userId: string
    name: string
    email: string
    event: AnalyticsEvent
  }>
}


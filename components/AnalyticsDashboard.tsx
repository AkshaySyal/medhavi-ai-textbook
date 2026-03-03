'use client'

import { type ReactNode, useEffect, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  Eye,
  RefreshCw,
  TrendingUp,
  Users
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface PostHogDashboard {
  overview: { uniqueUsers: number; totalSessions: number; totalEvents: number; aiInteractions: number; textbookOpens: number; totalPageviews: number }
  dailyActive: { day: string; users: number; events: number }[]
  topUsers: { email: string; name: string; sessions: number; totalEvents: number; pageviews: number }[]
  aiLeaders: { email: string; name: string; aiMessages: number; lastUsed: string | null }[]
  textbooks: { title: string; textbookId: string; opens: number; uniqueUsers: number; lastOpened: string | null }[]
  recentEvents: { email: string; name: string; event: string; timestamp: string; url: string }[]
  platforms: { host: string; users: number; sessions: number; events: number }[]
}

interface UserListItem {
  email: string; name: string; role: string; totalEvents: number; sessions: number
  pageviews: number; textbookOpens: number; aiMessages: number; pagesViewed: number
  firstSeen: string | null; lastSeen: string | null
}

interface UserDetailData {
  user: { email: string; name: string; role: string; totalEvents: number; sessions: number; pageviews: number; aiMessages: number; textbookOpens: number; firstSeen: string | null; lastSeen: string | null }
  textbooks: { title: string; textbookId: string; openCount: number; lastOpened: string | null }[]
  aiActivity: { pagePath: string; platform: string; messageCount: number; lastMessage: string | null }[]
  timeline: { event: string; timestamp: string; url: string; pagePath: string; textbookTitle: string; platform: string; question: string }[]
}

const eventLabels: Record<string, string> = {
  textbook_opened: 'Opened Textbook',
  ai_chat_message: 'AI Chat',
  ai_chat_error: 'AI Error',
  textbook_page_viewed: 'Page View',
  ai_chat_opened: 'Opened AI Chat',
  $pageview: 'Page Visit',
}

// ─── Main Component ─────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'instructors'>('overview')
  const [data, setData] = useState<PostHogDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // User list states
  const [studentList, setStudentList] = useState<UserListItem[] | null>(null)
  const [instructorList, setInstructorList] = useState<UserListItem[] | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)

  // User detail states
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [userDetail, setUserDetail] = useState<UserDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ─── Fetch Functions ────────────────────────────────────

  const fetchOverview = async () => {
    if (refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/posthog?view=overview', { cache: 'no-store' })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to load analytics')
      }
      setData(await res.json())
    } catch (err: any) {
      // Only show full-page error on initial load (when data is null)
      if (!data) setError(err.message || 'Unable to load analytics.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchUserList = async (role: 'student' | 'instructor') => {
    setUsersLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/posthog?view=users&role=${role}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load users')
      const payload = await res.json()
      if (role === 'student') setStudentList(payload.users)
      else setInstructorList(payload.users)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchUserDetail = async (email: string) => {
    setDetailLoading(true)
    setSelectedUser(email)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/posthog?view=user-detail&email=${encodeURIComponent(email)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load user details')
      setUserDetail(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRefresh = async () => {
    setSelectedUser(null)
    setUserDetail(null)
    if (activeTab === 'overview') {
      await fetchOverview()
    } else {
      setStudentList(null)
      setInstructorList(null)
      if (activeTab === 'students') await fetchUserList('student')
      if (activeTab === 'instructors') await fetchUserList('instructor')
    }
  }

  // ─── Effects ────────────────────────────────────────────

  useEffect(() => { fetchOverview() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'students' && !studentList) fetchUserList('student')
    if (activeTab === 'instructors' && !instructorList) fetchUserList('instructor')
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Loading / Error States ─────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow max-w-md text-center">
          <p className="text-gray-800 mb-2">{error}</p>
          <p className="text-sm text-gray-500 mb-4">
            Make sure <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">POSTHOG_PERSONAL_API_KEY</code> is set.
          </p>
          <button onClick={fetchOverview} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">Retry</button>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/admin" className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5" />
              </a>
              <BarChart3 className="h-6 w-6 text-purple-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h1>
                <p className="text-xs text-gray-500">Powered by PostHog &middot; Last 30 days</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {(['overview', 'students', 'instructors'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedUser(null); setUserDetail(null) }}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && data && <OverviewTab data={data} />}

        {/* ── Students Tab ── */}
        {activeTab === 'students' && (
          selectedUser && userDetail ? (
            <UserDetailView data={userDetail} loading={detailLoading} onBack={() => { setSelectedUser(null); setUserDetail(null) }} />
          ) : (
            <UserListView users={studentList} loading={usersLoading} onSelectUser={fetchUserDetail} roleLabel="Students" />
          )
        )}

        {/* ── Instructors Tab ── */}
        {activeTab === 'instructors' && (
          selectedUser && userDetail ? (
            <UserDetailView data={userDetail} loading={detailLoading} onBack={() => { setSelectedUser(null); setUserDetail(null) }} />
          ) : (
            <UserListView users={instructorList} loading={usersLoading} onSelectUser={fetchUserDetail} roleLabel="Instructors" />
          )
        )}
      </main>
    </div>
  )
}

// ─── Overview Tab ───────────────────────────────────────────

function OverviewTab({ data }: { data: PostHogDashboard }) {
  const maxDailyUsers = Math.max(...data.dailyActive.map(d => d.users), 1)

  return (
    <>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Unique Users" value={data.overview.uniqueUsers.toLocaleString()} icon={<Users className="h-8 w-8 text-blue-600" />} subtitle={`${data.overview.totalSessions.toLocaleString()} sessions`} />
        <StatCard title="Page Views" value={data.overview.totalPageviews.toLocaleString()} icon={<Eye className="h-8 w-8 text-green-600" />} subtitle={`${data.overview.totalEvents.toLocaleString()} total events`} />
        <StatCard title="Textbook Opens" value={data.overview.textbookOpens.toLocaleString()} icon={<BookOpen className="h-8 w-8 text-purple-600" />} subtitle="From hub to textbooks" />
        <StatCard title="AI Interactions" value={data.overview.aiInteractions.toLocaleString()} icon={<Bot className="h-8 w-8 text-rose-600" />} subtitle={`${data.aiLeaders.length} active AI users`} />
      </div>

      {/* Daily Active Chart */}
      <section className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Daily Active Users (14 days)</h2>
          <TrendingUp className="h-5 w-5 text-purple-500" />
        </div>
        {data.dailyActive.length === 0 ? (
          <p className="text-sm text-gray-500">No activity data yet.</p>
        ) : (
          <div className="flex items-end gap-1.5 h-40">
            {data.dailyActive.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500 font-medium">{d.users}</span>
                <div className="w-full bg-purple-500 rounded-t-sm min-h-[2px]" style={{ height: `${(d.users / maxDailyUsers) * 100}%` }} />
                <span className="text-[10px] text-gray-400">{new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Platform Breakdown + Top Textbooks */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Platform Breakdown</h2>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
          <div className="space-y-4">
            {data.platforms.length === 0 && <p className="text-sm text-gray-500">No platform activity yet.</p>}
            {data.platforms.map((p) => (
              <div key={p.host}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-gray-800">{p.host}</span>
                  <span className="text-gray-500">{p.users} users &middot; {p.sessions} sessions &middot; {p.events.toLocaleString()} events</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, (p.events / Math.max(1, data.overview.totalEvents)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Top Textbooks</h2>
            <BookOpen className="h-5 w-5 text-blue-500" />
          </div>
          <div className="space-y-4">
            {data.textbooks.length === 0 && <p className="text-sm text-gray-500">No textbook activity yet.</p>}
            {data.textbooks.slice(0, 5).map((t) => (
              <div key={t.textbookId || t.title} className="border rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-gray-900 truncate">{t.title}</p>
                  <span className="text-gray-500">{t.opens} opens</span>
                </div>
                <p className="text-xs text-gray-500">{t.uniqueUsers} user{t.uniqueUsers !== 1 ? 's' : ''} {t.lastOpened ? `· Last: ${new Date(t.lastOpened).toLocaleDateString()}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Most Engaged + AI Leaders */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Panel title="Most Engaged Users" icon={<Users className="h-5 w-5 text-green-500" />}>
          {data.topUsers.length === 0 ? <EmptyState message="No user engagement data yet." /> : (
            <div className="space-y-3">
              {data.topUsers.map((u) => (
                <div key={u.email} className="flex items-center justify-between border rounded-lg p-3">
                  <div><p className="font-medium text-gray-900">{u.name || 'Unknown'}</p><p className="text-xs text-gray-500">{u.email}</p></div>
                  <div className="text-right text-sm"><p className="font-semibold text-gray-900">{u.totalEvents} events</p><p className="text-gray-500">{u.sessions} sessions · {u.pageviews} pages</p></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="AI Usage Leaders" icon={<Bot className="h-5 w-5 text-rose-500" />}>
          {data.aiLeaders.length === 0 ? <EmptyState message="No AI interactions recorded." /> : (
            <div className="space-y-3">
              {data.aiLeaders.map((l) => (
                <div key={l.email} className="flex items-center justify-between border rounded-lg p-3">
                  <div><p className="font-medium text-gray-900">{l.name || 'Unknown'}</p><p className="text-xs text-gray-500">{l.email}</p></div>
                  <div className="text-right text-sm"><p className="font-semibold text-gray-900">{l.aiMessages} messages</p><p className="text-gray-500">{l.lastUsed ? `Last: ${new Date(l.lastUsed).toLocaleDateString()}` : 'No recent data'}</p></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* Recent Activity */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Activity className="h-5 w-5 text-emerald-500" />
        </div>
        {data.recentEvents.length === 0 ? <EmptyState message="No events recorded yet." /> : (
          <div className="space-y-3">
            {data.recentEvents.map((evt, i) => (
              <div key={`${evt.timestamp}-${i}`} className="flex items-center justify-between border rounded-lg p-3">
                <div><p className="font-medium text-gray-900">{evt.name || 'Unknown'}</p><p className="text-xs text-gray-500">{evt.email}</p></div>
                <div className="text-right text-sm"><p className="font-semibold text-gray-900">{eventLabels[evt.event] || evt.event.replace(/_/g, ' ')}</p><p className="text-gray-500">{new Date(evt.timestamp).toLocaleString()}</p></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

// ─── User List View ─────────────────────────────────────────

function UserListView({
  users, loading, onSelectUser, roleLabel,
}: {
  users: UserListItem[] | null; loading: boolean; onSelectUser: (email: string) => void; roleLabel: string
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading {roleLabel.toLowerCase()}...</p>
        </div>
      </div>
    )
  }

  if (!users || users.length === 0) {
    return (
      <Panel title={roleLabel} icon={<Users className="h-5 w-5 text-blue-500" />}>
        <EmptyState message={`No ${roleLabel.toLowerCase()} found with activity in the last 30 days.`} />
      </Panel>
    )
  }

  return (
    <Panel title={`${roleLabel} (${users.length})`} icon={<Users className="h-5 w-5 text-blue-500" />}>
      <div className="space-y-3">
        {users.map((user) => (
          <button
            key={user.email}
            onClick={() => onSelectUser(user.email)}
            className="w-full flex items-center justify-between border rounded-lg p-4 hover:bg-purple-50 hover:border-purple-200 transition-colors text-left cursor-pointer"
          >
            <div>
              <p className="font-medium text-gray-900">{user.name || 'Unknown'}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
              <p className="text-xs text-gray-400 mt-1">
                Last active: {user.lastSeen ? new Date(user.lastSeen).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className="text-right text-sm flex-shrink-0 ml-4">
              <p className="font-semibold text-gray-900">{user.totalEvents} events</p>
              <p className="text-gray-500">{user.sessions} sessions · {user.textbookOpens} opens · {user.aiMessages} AI msgs</p>
              <p className="text-gray-400 text-xs">{user.pagesViewed} textbook pages</p>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}

// ─── User Detail View ───────────────────────────────────────

function UserDetailView({
  data, loading, onBack,
}: {
  data: UserDetailData; loading: boolean; onBack: () => void
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading user details...</p>
        </div>
      </div>
    )
  }

  const { user, textbooks, aiActivity, timeline } = data

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 font-medium">
        <ArrowLeft className="h-4 w-4" />
        Back to list
      </button>

      {/* User header */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user.name || 'Unknown'}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 capitalize">
              {user.role || 'student'}
            </span>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>First seen: {user.firstSeen ? new Date(user.firstSeen).toLocaleDateString() : 'N/A'}</p>
            <p>Last seen: {user.lastSeen ? new Date(user.lastSeen).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Events" value={String(user.totalEvents)} icon={<Activity className="h-7 w-7 text-green-600" />} />
        <StatCard title="Sessions" value={String(user.sessions)} icon={<Users className="h-7 w-7 text-blue-600" />} />
        <StatCard title="Textbook Opens" value={String(user.textbookOpens)} icon={<BookOpen className="h-7 w-7 text-purple-600" />} />
        <StatCard title="AI Messages" value={String(user.aiMessages)} icon={<Bot className="h-7 w-7 text-rose-600" />} />
      </div>

      {/* Textbooks Opened */}
      <div className="mb-6">
        <Panel title="Textbooks Opened" icon={<BookOpen className="h-5 w-5 text-purple-500" />}>
          {textbooks.length === 0 ? <EmptyState message="No textbook activity." /> : (
            <div className="space-y-3">
              {textbooks.map((tb) => (
                <div key={tb.textbookId || tb.title} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-900">{tb.title}</p>
                    <p className="text-xs text-gray-500">{tb.lastOpened ? `Last: ${new Date(tb.lastOpened).toLocaleDateString()}` : ''}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{tb.openCount} opens</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* AI Chat Activity */}
      <div className="mb-6">
        <Panel title="AI Chat Activity" icon={<Bot className="h-5 w-5 text-rose-500" />}>
          {aiActivity.length === 0 ? <EmptyState message="No AI interactions." /> : (
            <div className="space-y-3">
              {aiActivity.map((ai, i) => (
                <div key={`${ai.pagePath}-${i}`} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-900">{ai.pagePath || 'Unknown page'}</p>
                    <p className="text-xs text-gray-500">{ai.platform}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-gray-900">{ai.messageCount} messages</p>
                    <p className="text-gray-500">{ai.lastMessage ? `Last: ${new Date(ai.lastMessage).toLocaleDateString()}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Event Timeline */}
      <Panel title="Event Timeline" icon={<Activity className="h-5 w-5 text-emerald-500" />}>
        {timeline.length === 0 ? <EmptyState message="No events recorded." /> : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {timeline.map((evt, i) => (
              <div key={`${evt.timestamp}-${i}`} className="flex items-center justify-between border rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      evt.event === 'ai_chat_message' ? 'bg-rose-100 text-rose-700' :
                      evt.event === 'textbook_opened' ? 'bg-purple-100 text-purple-700' :
                      evt.event === 'textbook_page_viewed' ? 'bg-blue-100 text-blue-700' :
                      evt.event === 'ai_chat_opened' ? 'bg-orange-100 text-orange-700' :
                      evt.event === 'ai_chat_error' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {eventLabels[evt.event] || evt.event.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {evt.textbookTitle || evt.pagePath || evt.question || evt.url || ''}
                  </p>
                </div>
                <p className="text-xs text-gray-500 whitespace-nowrap ml-4">
                  {new Date(evt.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ─── Shared UI Components ───────────────────────────────────

function StatCard({ title, value, icon, subtitle }: { title: string; value: string; icon: ReactNode; subtitle?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 flex items-center gap-4">
      <div className="p-3 rounded-full bg-purple-50">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {icon}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-500">{message}</p>
}

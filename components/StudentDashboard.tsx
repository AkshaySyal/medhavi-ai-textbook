'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Book, Clock, CheckCircle, X, GraduationCap, RefreshCw, Users, Link as LinkIcon, Plus, Archive, ExternalLink, Copy, Info } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'
import TextbookCard from '@/components/textbook/TextbookCard'
import type { Textbook, AccessRequest } from '@/types/textbook'
import { useSessionTracking } from '@/lib/useSessionTracking'
import posthog from 'posthog-js'

interface ClassLink {
  code: string
  allowedDomain?: string
  maxUses?: number
  currentUses: number
  isActive: boolean
  expiresAt?: string
}

interface ClassData {
  id: string
  name: string
  createdAt: string
  archived: boolean
  textbookIds: string[]
  studentCount: number
  invites: ClassLink[]
}

interface UserData {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  imageUrl: string | null
  role: string
}

export default function StudentDashboard({ user }: { user: UserData }) {
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [userAccess, setUserAccess] = useState<string[]>([])
  const [userRequests, setUserRequests] = useState<AccessRequest[]>([])

  // Instructor Class Management State
  const [classes, setClasses] = useState<ClassData[]>([])
  const [activeTab, setActiveTab] = useState<'library' | 'classes' | 'archived-classes'>('library')
  const [showNewClassModal, setShowNewClassModal] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [showInviteModal, setShowInviteModal] = useState<string | null>(null)
  const [domainFilter, setDomainFilter] = useState('')
  const [maxUses, setMaxUses] = useState<number | ''>('')
  const [expiresDate, setExpiresDate] = useState('')
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null)
  const [editInviteModal, setEditInviteModal] = useState<ClassLink | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openingTextbookId, setOpeningTextbookId] = useState<string | null>(null)
  const openingRef = useRef(false)

  useSessionTracking({
    platform: 'hub',
    metadata: {
      page: 'student-dashboard',
      userId: user.id
    }
  })

  // ... (sendTextbookOpenEvent remains unchanged, omitting to keep diff clean, wait, I must provide exact replacement)
  const sendTextbookOpenEvent = useCallback((textbook: Textbook) => {
    try {
      const payload = JSON.stringify({
        type: 'textbook_open',
        platform: 'hub',
        metadata: {
          textbookId: textbook.id,
          textbookTitle: textbook.title,
          status: textbook.status,
          userId: user.id
        }
      })

      const url = `${window.location.origin}/api/analytics`
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
      } else {
        void fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        }).catch(() => {
          // swallow errors
        })
      }
    } catch (error) {
      console.error('Failed to log textbook open event', error)
    }

    // PostHog tracking
    posthog.capture('textbook_opened', {
      textbook_id: textbook.id,
      textbook_title: textbook.title,
      textbook_url: textbook.url,
      access_method: 'token',
    })
  }, [user.id])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch textbooks
      const textbookRes = await fetch('/api/textbooks', { cache: 'no-store' })
      if (textbookRes.ok) {
        const data = await textbookRes.json()
        setTextbooks(data)
      }

      // Fetch user's access and requests from their metadata
      const userRes = await fetch('/api/users/me', { cache: 'no-store' })
      let isInstructorLocally = user.role === 'instructor'
      if (userRes.ok) {
        const userData = await userRes.json()
        setUserAccess(userData.textbookAccess || [])
        setUserRequests(userData.accessRequests || [])
        if (userData.role === 'instructor') isInstructorLocally = true
      }

      // Fetch classes if instructor
      if (isInstructorLocally) {
        const classRes = await fetch('/api/classes', { cache: 'no-store' })
        if (classRes.ok) {
          setClasses(await classRes.json())
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  const handleRequestAccess = async (textbookId: string) => {
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textbookId })
      })

      if (response.ok) {
        alert('Access request submitted!')
        fetchData() // Refresh to show pending status
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to submit request')
      }
    } catch (error) {
      alert('Error submitting request')
    }
  }

  const handleOpenTextbook = async (textbook: Textbook) => {
    if (openingRef.current) return
    openingRef.current = true
    setOpeningTextbookId(textbook.id)

    try {
      // Generate access token
      const response = await fetch('/api/access/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textbookId: textbook.id })
      })

      // Build PostHog cross-domain params
      const phDistinctId = posthog.get_distinct_id?.() || ''
      const phSessionId = posthog.get_session_id?.() || ''
      const phParams = phDistinctId
        ? `&ph_distinct_id=${encodeURIComponent(phDistinctId)}&ph_session_id=${encodeURIComponent(phSessionId)}`
        : ''

      if (response.ok) {
        const { token } = await response.json()
        window.open(`${textbook.url}?access_token=${token}${phParams}`, '_blank')
        sendTextbookOpenEvent(textbook)
      } else {
        console.error('Failed to generate token, opening without token')
        const separator = phParams ? '?' + phParams.slice(1) : ''
        window.open(`${textbook.url}${separator}`, '_blank')
        sendTextbookOpenEvent(textbook)
      }
    } catch (error) {
      console.error('Failed to generate access token:', error)
      const phDistinctId = posthog.get_distinct_id?.() || ''
      const phSessionId = posthog.get_session_id?.() || ''
      const phFallback = phDistinctId
        ? `?ph_distinct_id=${encodeURIComponent(phDistinctId)}&ph_session_id=${encodeURIComponent(phSessionId)}`
        : ''
      window.open(`${textbook.url}${phFallback}`, '_blank')
      sendTextbookOpenEvent(textbook)
    } finally {
      openingRef.current = false
      setOpeningTextbookId(null)
    }
  }

  // --- Instructor Class Handlers ---

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassName.trim()) return

    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName })
      })
      if (!res.ok) throw new Error('Failed to create class')

      const newClass = await res.json()

      // Automatically Generate a Default/Configured Invite Link for this class
      try {
        await fetch(`/api/classes/${newClass.id}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            allowedDomain: domainFilter.trim() || undefined,
            maxUses: maxUses === '' ? undefined : Number(maxUses),
            expiresAt: expiresDate ? new Date(expiresDate).toISOString() : undefined
          })
        })
      } catch (inviteErr) {
        console.error('Failed to auto-generate invite', inviteErr)
        // We do not fail the whole process if invite generation fails, as the class is already made.
      }

      setNewClassName('')
      setDomainFilter('')
      setMaxUses('')
      setExpiresDate('')
      setShowNewClassModal(false)
      fetchData()
    } catch (err) {
      alert('Failed to create class')
    }
  }

  const handleArchive = async (classId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/classes/${classId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !currentStatus })
      })
      if (!res.ok) throw new Error('Failed to toggle archive')
      fetchData()
    } catch (err) {
      alert('Failed to toggle archive status')
    }
  }

  const handleAssignTextbook = async (classId: string, textbookId: string, isAssigned: boolean) => {
    try {
      const method = isAssigned ? 'DELETE' : 'POST'
      const res = await fetch(`/api/classes/${classId}/textbooks`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textbookId })
      })
      if (!res.ok) throw new Error('Failed to update assignment')
      fetchData()
    } catch (err) {
      alert('Failed to update textbook assignment')
    }
  }

  const handleUpdateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editInviteModal) return

    try {
      const res = await fetch(`/api/classes/invites/${editInviteModal.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxUses: maxUses === '' ? undefined : Number(maxUses),
          expiresAt: expiresDate ? new Date(expiresDate).toISOString() : undefined
        })
      })
      if (!res.ok) throw new Error('Failed to update invite')

      setEditInviteModal(null)
      setMaxUses('')
      setExpiresDate('')
      fetchData()
    } catch (err) {
      alert('Failed to update invite link')
    }
  }

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/join/${code}`
    navigator.clipboard.writeText(url)
    setCopiedLink(code)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const isInstructor = user.role === 'instructor'

  // Students and instructors never see hidden textbooks
  const visibleTextbooks = textbooks.filter(t => t.status !== 'hidden')
  const privateTextbooks = visibleTextbooks.filter(t => t.status === 'private')

  // Instructors have access to all public + private (non-hidden); students need explicit access for private.
  const myTextbooks = isInstructor
    ? visibleTextbooks
    : visibleTextbooks.filter(t => t.status === 'public' || (t.status === 'private' && userAccess.includes(t.id)))

  // Only students can request private textbook access.
  const availableToRequest = isInstructor
    ? []
    : privateTextbooks.filter(t =>
      !userAccess.includes(t.id) &&
      !userRequests.some(r => r.textbookId === t.id && r.status === 'pending')
    )

  const pendingRequests = userRequests.filter(r => r.status === 'pending')
  const approvedRequests = userRequests.filter(r => r.status === 'approved')
  const deniedRequests = userRequests.filter(r => r.status === 'denied')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Book className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{isInstructor ? 'Instructor Dashboard' : 'Student Dashboard'}</h1>
                <p className="text-xs text-gray-500">Medhavi Hub</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-sm">
                    {(user.firstName || user.email || 'S')[0].toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {user.firstName || (isInstructor ? 'Instructor' : 'Student')}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Enhanced Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.firstName || (isInstructor ? 'Instructor' : 'Student')}! 👋
          </h2>
          <p className="text-gray-600">Access your authorized textbooks and course materials</p>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Book className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{myTextbooks.length}</p>
                <p className="text-sm text-gray-600">My Textbooks</p>
                <p className="text-xs text-gray-400 mt-1">Available to read</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingRequests.length}</p>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-xs text-gray-400 mt-1">
                  {isInstructor ? 'Not applicable' : pendingRequests.length > 0 ? 'Awaiting approval' : 'No pending'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{approvedRequests.length}</p>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-xs text-gray-400 mt-1">Total approved</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-3 rounded-lg">
                <GraduationCap className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{availableToRequest.length}</p>
                <p className="text-sm text-gray-600">{isInstructor ? 'Private Access' : 'Can Request'}</p>
                <p className="text-xs text-gray-400 mt-1">Additional access</p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {isInstructor && (
              <div className="border-b border-gray-200 mb-6 flex justify-between items-center">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('library')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'library'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    My Library
                  </button>
                  <button
                    onClick={() => setActiveTab('classes')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'classes'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Manage Classes ({classes.filter(c => !c.archived).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('archived-classes')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'archived-classes'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Archived Classes
                  </button>
                </nav>
                {activeTab !== 'library' && (
                  <button
                    onClick={() => setShowNewClassModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center shadow-sm mb-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Class
                  </button>
                )}
              </div>
            )}

            {activeTab === 'library' ? (
              // ORIGINAL STUDENT/LIBRARY VIEW
              <>
                {/* My Accessible Textbooks */}
                {myTextbooks.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">My Textbooks</h3>
                      <span className="text-sm text-gray-500">{myTextbooks.length} available</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {myTextbooks.map(textbook => (
                        <TextbookCard
                          key={textbook.id}
                          textbook={textbook}
                          hasAccess={true}
                          isOpening={openingTextbookId === textbook.id}
                          onOpen={() => handleOpenTextbook(textbook)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Available to Request */}
                {availableToRequest.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">Available to Request</h3>
                      <span className="text-sm text-gray-500">{availableToRequest.length} available</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {availableToRequest.map(textbook => (
                        <TextbookCard
                          key={textbook.id}
                          textbook={textbook}
                          hasAccess={false}
                          onRequestAccess={() => handleRequestAccess(textbook.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Request Status Sections */}
                {(pendingRequests.length > 0 || approvedRequests.length > 0 || deniedRequests.length > 0) && (
                  <div className="space-y-8">

                    {/* Pending Requests */}
                    {pendingRequests.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-gray-900">Pending Requests</h3>
                          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
                            {pendingRequests.length} pending
                          </span>
                        </div>
                        <div className="space-y-3">
                          {pendingRequests.map(request => (
                            <div key={request.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{request.textbookTitle}</p>
                                  <p className="text-sm text-gray-600">
                                    Requested on {new Date(request.requestedAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-5 w-5 text-yellow-600" />
                                  <span className="text-sm font-medium text-yellow-700">Under Review</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Approved Requests */}
                    {approvedRequests.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-gray-900">Recently Approved</h3>
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                            {approvedRequests.length} approved
                          </span>
                        </div>
                        <div className="space-y-3">
                          {approvedRequests.slice(0, 3).map(request => (
                            <div key={request.id} className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{request.textbookTitle}</p>
                                  <p className="text-sm text-gray-600">
                                    Approved on {request.processedAt ? new Date(request.processedAt).toLocaleDateString() : 'N/A'}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                  <span className="text-sm font-medium text-green-700">Access Granted</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {approvedRequests.length > 3 && (
                            <p className="text-sm text-gray-500 text-center">
                              And {approvedRequests.length - 3} more approved request(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Denied Requests */}
                    {deniedRequests.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-gray-900">Request History</h3>
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                            {deniedRequests.length} denied
                          </span>
                        </div>
                        <div className="space-y-3">
                          {deniedRequests.slice(0, 2).map(request => (
                            <div key={request.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{request.textbookTitle}</p>
                                  <p className="text-sm text-gray-600">
                                    Denied on {request.processedAt ? new Date(request.processedAt).toLocaleDateString() : 'N/A'}
                                  </p>
                                  {request.reason && (
                                    <p className="text-sm text-red-600 mt-1">Reason: {request.reason}</p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <X className="h-5 w-5 text-red-600" />
                                  <span className="text-sm font-medium text-red-700">Not Approved</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {deniedRequests.length > 2 && (
                            <p className="text-sm text-gray-500 text-center">
                              And {deniedRequests.length - 2} more in history
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty States */}
                {myTextbooks.length === 0 && availableToRequest.length === 0 && (
                  <div className="text-center py-16">
                    <div className="bg-gray-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                      <Book className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-medium text-gray-900 mb-2">No textbooks available</h3>
                    <p className="text-gray-500 mb-4">
                      Contact your administrator to get access to course materials
                    </p>
                    <button
                      onClick={handleRefresh}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Check for Updates
                    </button>
                  </div>
                )}

                {myTextbooks.length === 0 && availableToRequest.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                    <div className="flex items-center space-x-3">
                      <GraduationCap className="h-6 w-6 text-blue-600" />
                      <div>
                        <h4 className="font-medium text-blue-900">Ready to get started?</h4>
                        <p className="text-sm text-blue-700">
                          You have {availableToRequest.length} textbook(s) available to request access for your courses.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // CLASSES VIEW FOR INSTRUCTORS
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {classes.filter(c => activeTab === 'classes' ? !c.archived : c.archived).map(cls => (
                  <div key={cls.id} className={`bg-white rounded-lg shadow-sm border p-6 ${cls.archived ? 'opacity-75 bg-gray-50' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{cls.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">Created {new Date(cls.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => handleArchive(cls.id, cls.archived)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-colors ${cls.archived
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                        <Archive className="h-4 w-4 mr-1.5" />
                        {cls.archived ? 'Unarchive' : 'Archive'}
                      </button>
                    </div>

                    <div className="flex items-center space-x-6 text-sm text-gray-600 mb-6 py-3 border-y border-gray-100">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="font-medium">{cls.studentCount} Students</span>
                      </div>
                      <div className="flex items-center">
                        <Book className="h-4 w-4 mr-2 text-indigo-500" />
                        <span className="font-medium">{cls.textbookIds.length} Textbooks</span>
                      </div>
                    </div>

                    {/* Textbooks Section */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Assigned Textbooks</h4>
                        {!cls.archived && (
                          <button
                            onClick={() => setShowAssignModal(cls.id)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Manage Textbooks
                          </button>
                        )}
                      </div>
                      {cls.textbookIds.length > 0 ? (
                        <ul className="space-y-2">
                          {cls.textbookIds.map(tId => {
                            const book = textbooks.find(b => b.id === tId)
                            const isHidden = book?.status === 'hidden'
                            return (
                              <li key={tId} className={`flex items-center text-sm px-3 py-2 rounded ${isHidden ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                                <Book className={`h-4 w-4 mr-2 flex-shrink-0 ${isHidden ? 'text-red-400' : 'text-gray-400'}`} />
                                <span className={`truncate ${isHidden ? 'text-red-800' : 'text-gray-800'}`}>
                                  {book ? book.title : 'Unknown Textbook'}
                                </span>
                                {isHidden && (
                                  <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 rounded border border-red-200 flex items-center" title="This textbook is set to Hidden globally by a System Administrator. It is attached to your class, but students will not be able to see it.">
                                    <Info className="h-3 w-3 mr-1" />
                                    Disabled Globally By Admin
                                  </span>
                                )}
                                {book && !isHidden && <a href={book.url} target="_blank" rel="noreferrer" className="ml-auto text-blue-500 hover:text-blue-700"><ExternalLink className="h-3 w-3" /></a>}
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No textbooks assigned yet.</p>
                      )}
                    </div>

                    {/* Invites Section */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Invite Links</h4>
                      </div>
                      {cls.invites.filter(i => i.isActive).length > 0 ? (
                        <div className="space-y-3">
                          {cls.invites.filter(i => i.isActive).map(invite => {
                            const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${invite.code}` : `/join/${invite.code}`
                            return (
                              <div key={invite.code} className="bg-blue-50 border border-blue-100 rounded-md p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center min-w-0 flex-1">
                                    <code className="text-xs sm:text-sm font-mono font-bold text-blue-900 bg-white px-2 py-1 rounded border border-blue-200 truncate mr-2" title={inviteUrl}>
                                      {inviteUrl}
                                    </code>
                                    <button
                                      onClick={() => copyToClipboard(invite.code)}
                                      className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                                      title="Copy URL"
                                    >
                                      {copiedLink === invite.code ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setEditInviteModal(invite)
                                      setMaxUses(invite.maxUses || '')
                                      setExpiresDate(invite.expiresAt ? invite.expiresAt.split('T')[0] : '')
                                    }}
                                    className="text-xs text-gray-500 hover:text-blue-600 font-medium ml-2 px-2 py-1 bg-white border border-gray-200 rounded shrink-0"
                                  >
                                    Edit
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                                  {invite.allowedDomain && <span>Domain: <strong>@{invite.allowedDomain}</strong></span>}
                                  <span>Uses: {invite.currentUses}{invite.maxUses ? `/${invite.maxUses}` : ''}</span>
                                  {invite.expiresAt && <span className="text-red-600">Expires: {new Date(invite.expiresAt).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No active invite links.</p>
                      )}
                    </div>
                  </div>
                ))}
                {classes.filter(c => activeTab === 'classes' ? !c.archived : c.archived).length === 0 && (
                  <div className="col-span-1 lg:col-span-2 text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
                    <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No {activeTab} found.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* --- INSTRUCTOR MODALS --- */}
      {showNewClassModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateClass} className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold mb-4">Create New Class & Invite</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
              <input
                type="text"
                required
                value={newClassName}
                onChange={e => setNewClassName(e.target.value)}
                placeholder="e.g. Oncology 401 - Fall 2026"
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              />
            </div>

            <div className="border-t border-gray-200 pt-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Invite Link Settings (Optional)</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Restrict email domain</label>
                  <input
                    type="text"
                    value={domainFilter}
                    onChange={e => setDomainFilter(e.target.value.replace('@', ''))}
                    placeholder="e.g. northeastern.edu"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  />
                  <p className="text-xs text-gray-500 mt-1">If blank, anyone with the link can join.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={e => setMaxUses(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="Leave blank for unlimited"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={expiresDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setExpiresDate(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  />
                  <p className="text-xs text-gray-500 mt-1">If blank, link never expires.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button type="button" onClick={() => setShowNewClassModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create</button>
            </div>
          </form>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[80vh] flex flex-col">
            <h3 className="text-xl font-bold mb-4">Manage Textbooks</h3>
            <p className="text-sm text-gray-500 mb-4">Select which textbooks students in this class should have access to.</p>

            <div className="overflow-y-auto flex-1 border rounded-md p-1 mb-6">
              {textbooks.length === 0 ? <p className="p-4 text-gray-500">No public or private textbooks available in the system.</p> : (
                <ul className="divide-y">
                  {textbooks.filter(b => b.status !== 'hidden').map(book => {
                    const classData = classes.find(c => c.id === showAssignModal)
                    const isAssigned = classData?.textbookIds.includes(book.id) || false
                    return (
                      <li key={book.id} className="flex items-center justify-between py-3 px-4 hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-gray-900">{book.title}</p>
                          <p className="text-xs text-gray-500">{book.status}</p>
                        </div>
                        <button
                          onClick={() => handleAssignTextbook(showAssignModal, book.id, isAssigned)}
                          className={`px-3 py-1 text-sm rounded-md font-medium border ${isAssigned
                            ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                            : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'}`}
                        >
                          {isAssigned ? 'Remove' : 'Assign'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t mt-auto">
              <button onClick={() => setShowAssignModal(null)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Done</button>
            </div>
          </div>
        </div>
      )}

      {editInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateLink} className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold mb-4">Edit Invite Link</h3>

            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200 mb-4">
                <p className="text-sm font-medium text-gray-700">Invite Code</p>
                <code className="text-blue-700">{editInviteModal.code}</code>
                {editInviteModal.allowedDomain && (
                  <p className="text-xs text-gray-500 mt-1">
                    Restricted to: <strong>@{editInviteModal.allowedDomain}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses (Optional)</label>
                <input
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={e => setMaxUses(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Leave blank for unlimited"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={expiresDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setExpiresDate(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                />
                <p className="text-xs text-gray-500 mt-1">If blank, link never expires.</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-8">
              <button type="button" onClick={() => setEditInviteModal(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
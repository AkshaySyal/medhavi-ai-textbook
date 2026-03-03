'use client'
import { useState, useEffect, useRef } from 'react'
import { Book, Users, Shield, UserPlus, FileText, ExternalLink, Eye, Globe, Lock, EyeOff } from 'lucide-react'
import TextbookManager from '@/components/textbook/TextbookManager'
import LogoutButton from '@/components/LogoutButton'
import type { AccessRequest } from '@/types/textbook'
import posthog from 'posthog-js'

interface Textbook {
  id: string
  title: string
  description: string
  url: string
  imageUrl?: string
  status: 'public' | 'private' | 'hidden'
  createdAt: string
  createdBy: string
  createdByEmail: string
}

interface UserData {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  publicMetadata?: any
}

interface AdminDashboardProps {
  currentUser: UserData
  allUsers: UserData[]
}

export default function AdminDashboard({ currentUser, allUsers }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'textbooks' | 'view-textbooks' | 'users' | 'admins' | 'requests'>('textbooks')
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([])
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [makingAdmin, setMakingAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [openingTextbookId, setOpeningTextbookId] = useState<string | null>(null)
  const openingRef = useRef(false)

  // Calculate real data only
  const learners = allUsers.filter(u => u.publicMetadata?.role !== 'admin' && u.id !== currentUser.id)
  const admins = allUsers.filter(u => u.publicMetadata?.role === 'admin')
  const instructors = allUsers.filter(u => u.publicMetadata?.role === 'instructor' && u.id !== currentUser.id)
  const students = allUsers.filter(u => (u.publicMetadata?.role === 'student' || !u.publicMetadata?.role) && u.id !== currentUser.id)

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchRequests()
    }
    if (activeTab === 'view-textbooks') {
      fetchTextbooks()
    }
  }, [activeTab])

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/requests')
      if (response.ok) {
        const data = await response.json()
        setPendingRequests(data)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    }
  }

  const fetchTextbooks = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/textbooks')
      if (response.ok) {
        const data = await response.json()
        setTextbooks(data)
      }
    } catch (error) {
      console.error('Error fetching textbooks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenTextbook = async (textbook: Textbook) => {
    if (openingRef.current) return
    openingRef.current = true
    setOpeningTextbookId(textbook.id)

    // Build PostHog cross-domain params
    const phDistinctId = posthog.get_distinct_id?.() || ''
    const phSessionId = posthog.get_session_id?.() || ''
    const phParams = phDistinctId
      ? `&ph_distinct_id=${encodeURIComponent(phDistinctId)}&ph_session_id=${encodeURIComponent(phSessionId)}`
      : ''

    try {
      console.log(`🔑 Admin opening textbook: ${textbook.title} (${textbook.status})`)

      const response = await fetch('/api/access/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textbookId: textbook.id })
      })

      if (response.ok) {
        const { token } = await response.json()
        console.log('✅ Admin token generated successfully')
        window.open(`${textbook.url}?access_token=${token}${phParams}`, '_blank')
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to generate admin token:', errorData)
        console.log('🔄 Trying direct access without token...')
        const separator = phParams ? '?' + phParams.slice(1) : ''
        window.open(`${textbook.url}${separator}`, '_blank')
      }
    } catch (error) {
      console.error('❌ Token generation error:', error)
      console.log('🔄 Opening textbook directly...')
      const fallback = phParams ? '?' + phParams.slice(1) : ''
      window.open(`${textbook.url}${fallback}`, '_blank')
    } finally {
      openingRef.current = false
      setOpeningTextbookId(null)
    }
  }

  const handleMakeAdmin = async (userId: string) => {
    setMakingAdmin(true)
    try {
      const response = await fetch('/api/users/make-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (response.ok) {
        alert('User is now an admin!')
        window.location.reload()
      } else {
        alert('Failed to make user admin')
      }
    } catch (error) {
      alert('Error updating user role')
    } finally {
      setMakingAdmin(false)
    }
  }

  const handleProcessRequest = async (requestId: string, userId: string, action: 'approve' | 'deny') => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId })
      })

      if (response.ok) {
        alert(`Request ${action}d successfully!`)
        fetchRequests()
      }
    } catch (error) {
      alert('Error processing request')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'public':
        return { icon: Globe, color: 'text-green-600', bg: 'bg-green-100' }
      case 'private':
        return { icon: Lock, color: 'text-yellow-600', bg: 'bg-yellow-100' }
      case 'hidden':
        return { icon: EyeOff, color: 'text-gray-600', bg: 'bg-gray-100' }
      default:
        return { icon: EyeOff, color: 'text-gray-600', bg: 'bg-gray-100' }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-purple-600" />
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {currentUser.firstName || currentUser.email}
              </span>
              <a
                href="/admin/analytics"
                className="text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors"
              >
                View Analytics
              </a>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                ADMIN
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Control Panel
          </h2>
          <p className="text-gray-600">Manage users, textbooks, and access permissions</p>
        </div>

        {/* Real Stats Only */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-3">
              <Users className="h-10 w-10 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{allUsers.length}</p>
                <p className="text-sm text-gray-600">Total Users</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-3">
              <Shield className="h-10 w-10 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{admins.length}</p>
                <p className="text-sm text-gray-600">Admins</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-3">
              <Users className="h-10 w-10 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{learners.length}</p>
                <p className="text-sm text-gray-600">Learners</p>
                <p className="text-xs text-gray-400 mt-1">
                  {students.length} student{students.length === 1 ? '' : 's'}, {instructors.length} instructor{instructors.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-3">
              <FileText className="h-10 w-10 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('textbooks')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'textbooks'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Manage Textbooks
              </button>

              <button
                onClick={() => setActiveTab('view-textbooks')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'view-textbooks'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                View All Textbooks
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'users'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Users
              </button>

              <button
                onClick={() => setActiveTab('admins')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'admins'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                View Admins
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`py-2 px-1 border-b-2 font-medium text-sm relative ${activeTab === 'requests'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Requests
                {pendingRequests.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'textbooks' && <TextbookManager />}

        {activeTab === 'view-textbooks' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">All Textbooks</h3>
              <p className="text-sm text-gray-600">Admin access to all textbooks</p>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-8">Loading textbooks...</div>
              ) : textbooks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No textbooks available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {textbooks.map(textbook => {
                    const statusInfo = getStatusIcon(textbook.status)
                    const StatusIcon = statusInfo.icon

                    return (
                      <div key={textbook.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="text-lg font-medium">{textbook.title}</h4>
                          <div className={`${statusInfo.bg} ${statusInfo.color} p-1 rounded`}>
                            <StatusIcon className="h-4 w-4" />
                          </div>
                        </div>

                        {textbook.description && (
                          <p className="text-sm text-gray-600 mb-4">{textbook.description}</p>
                        )}

                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${textbook.status === 'public' ? 'bg-green-100 text-green-800' :
                            textbook.status === 'private' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                            {textbook.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(textbook.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenTextbook(textbook)}
                          disabled={openingRef.current}
                          className={`w-full py-2 px-4 rounded-md transition-colors flex items-center justify-center space-x-2 ${openingTextbookId === textbook.id
                            ? 'bg-purple-300 text-purple-100 cursor-not-allowed'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>{openingTextbookId === textbook.id ? 'Opening...' : 'Open Textbook'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
            </div>
            <div className="p-6">
              {learners.length === 0 ? (
                <p className="text-gray-500">No learners registered yet</p>
              ) : (
                <div className="space-y-4">
                  {learners.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Role: {user.publicMetadata?.role || 'student'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleMakeAdmin(user.id)}
                        disabled={makingAdmin}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                      >
                        <UserPlus className="h-4 w-4 inline mr-2" />
                        Make Admin
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admins' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Admin Users</h3>
              <p className="text-sm text-gray-600 mt-1">View all administrators in the system</p>
            </div>
            <div className="p-6">
              {admins.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No admins found</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {admins.map(admin => (
                    <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg bg-purple-50 border-purple-200">
                      <div className="flex items-center space-x-3">
                        <div className="bg-purple-600 text-white rounded-full h-10 w-10 flex items-center justify-center font-semibold">
                          {admin.firstName ? admin.firstName[0].toUpperCase() : admin.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {admin.firstName} {admin.lastName}
                            {admin.id === currentUser.id && (
                              <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded-full">You</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">{admin.email}</p>
                        </div>
                      </div>
                      <Shield className="h-5 w-5 text-purple-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Access Requests</h3>
            </div>
            <div className="p-6">
              {pendingRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No pending requests</p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map(request => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{request.userName}</p>
                          <p className="text-sm text-gray-600">{request.userEmail}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Requesting: <span className="font-medium">{request.textbookTitle}</span>
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(request.requestedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleProcessRequest(request.id, request.userId, 'approve')}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleProcessRequest(request.id, request.userId, 'deny')}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
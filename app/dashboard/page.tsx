
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import StudentDashboard from '@/components/StudentDashboard'
import { Book } from 'lucide-react'

//Force dynamic rendering for pages that use server functions
export const dynamic = 'force-dynamic'

// Loading component
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard...</h2>
        <p className="text-gray-600">Please wait while we prepare your account</p>
      </div>
    </div>
  )
}

// Error component
function DashboardError() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <Book className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
        <p className="text-gray-600 mb-6">There was an issue loading your account. Please try signing in again.</p>
        <a
          href="/sign-in"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Sign In
        </a>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  try {
    const user = await currentUser()

    // If no user, redirect to sign-in
    if (!user) {
      console.log('❌ No user found, redirecting to sign-in')
      redirect('/sign-in')
    }

    const userRole = String(user.publicMetadata?.role || '')
    const institution = String((user.publicMetadata as any)?.institution || '')
    const courseName = String((user.publicMetadata as any)?.courseName || '')
    const courseInstructor = String((user.publicMetadata as any)?.courseInstructor || '')

    if (
      !userRole ||
      ((userRole === 'student' || userRole === 'instructor') && !institution.trim()) ||
      (userRole === 'student' && (!courseName.trim() || !courseInstructor.trim()))
    ) {
      console.log('⚠️ User missing onboarding fields, redirecting to onboarding')
      redirect('/onboarding')
    }

    // If admin, redirect to admin dashboard
    if (userRole === 'admin') {
      console.log('👑 Admin user, redirecting to admin dashboard')
      redirect('/admin')
    }

    // Validate user data completeness
    if (!user.emailAddresses || user.emailAddresses.length === 0) {
      console.error('❌ User missing email addresses')
      return <DashboardError />
    }

    // Serialize user data to plain object
    const userData = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.emailAddresses[0]?.emailAddress || '',
      imageUrl: user.imageUrl,
      role: userRole
    }

    console.log('✅ Loading student dashboard for:', userData.email)

    // Show role-specific dashboard with serialized data
    return (
      <Suspense fallback={<DashboardLoading />}>
        <StudentDashboard user={userData} />
      </Suspense>
    )

  } catch (error: any) {
    if (error?.message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error('❌ Dashboard page error:', error)
    return <DashboardError />
  }
}
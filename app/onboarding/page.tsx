import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import OnboardingForm from '@/components/OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const user = await currentUser()
  if (!user) {
    redirect('/sign-in')
  }

  const role = String(user.publicMetadata?.role || '')
  const institution = String((user.publicMetadata as any)?.institution || '')
  const courseName = String((user.publicMetadata as any)?.courseName || '')
  const courseInstructor = String((user.publicMetadata as any)?.courseInstructor || '')

  // If already onboarded, route to correct dashboard.
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role === 'instructor' && institution.trim()) {
    redirect('/dashboard')
  }
  if (role === 'student' && institution.trim() && courseName.trim() && courseInstructor.trim()) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white shadow-sm border rounded-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900">Finish setting up your account</h1>
          <p className="text-gray-600 mt-2">
            Choose whether you are a student or instructor, and enter your institution.
          </p>

          <div className="mt-6">
            <OnboardingForm
              initial={{
                role: role === 'student' || role === 'instructor' ? role : 'student',
                institution,
                courseName,
                courseInstructor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}



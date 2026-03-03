import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export async function GET() {
  const user = await currentUser()
  
  if (!user) {
    return redirect('/sign-in')
  }
  
  const role = String(user.publicMetadata?.role || '')
  const institution = String((user.publicMetadata as any)?.institution || '')
  const courseName = String((user.publicMetadata as any)?.courseName || '')
  const courseInstructor = String((user.publicMetadata as any)?.courseInstructor || '')

  if (!role) {
    return redirect('/onboarding')
  }
  if ((role === 'student' || role === 'instructor') && !institution.trim()) {
    return redirect('/onboarding')
  }
  if (role === 'student' && (!courseName.trim() || !courseInstructor.trim())) {
    return redirect('/onboarding')
  }

  if (role === 'admin') {
    return redirect('/admin')
  }

  return redirect('/dashboard')
}
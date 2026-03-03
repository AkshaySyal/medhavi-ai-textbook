// Get current user's data, textbook access, and requests

import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getUserAccess, getUserRequests } from '@/lib/textbook-manager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user's textbook access and requests
    const textbookAccess = await getUserAccess(user.id)
    const accessRequests = await getUserRequests(user.id)
    
    const userData = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.emailAddresses[0]?.emailAddress || '',
      role: user.publicMetadata?.role || 'student',
      institution: (user.publicMetadata as any)?.institution || '',
      courseName: (user.publicMetadata as any)?.courseName || '',
      courseInstructor: (user.publicMetadata as any)?.courseInstructor || '',
      textbookAccess,
      accessRequests
    }
    
    console.log(`👤 User data fetched for: ${userData.email} (${userData.role})`)
    console.log(`   - Access to ${textbookAccess.length} textbook(s)`)
    console.log(`   - ${accessRequests.length} access request(s)`)
    
    return NextResponse.json(userData)
  } catch (error) {
    console.error('Error fetching user data:', error)
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
  }
}
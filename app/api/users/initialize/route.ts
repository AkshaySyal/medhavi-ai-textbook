import { currentUser } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export async function GET() {
  try {
    const user = await currentUser()
    
    if (!user) {
      console.log('❌ No user found during initialization')
      return redirect('/sign-in')
    }
    
    console.log('🔧 Initializing user:', user.emailAddresses[0]?.emailAddress)
    console.log('📋 Current metadata:', user.publicMetadata)
    
    // Ensure defaults exist WITHOUT forcing a role (role is chosen in onboarding).
    const client = await clerkClient()
    const existing = (user.publicMetadata || {}) as Record<string, unknown>
    const hasTextbookAccess = Array.isArray((existing as any).textbookAccess)
    const hasAccessRequests = Array.isArray((existing as any).accessRequests)

    if (!hasTextbookAccess || !hasAccessRequests) {
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: {
          ...existing,
          textbookAccess: hasTextbookAccess ? (existing as any).textbookAccess : [],
          accessRequests: hasAccessRequests ? (existing as any).accessRequests : [],
        },
      })

      // Wait briefly for Clerk propagation
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Redirect to onboarding if role/institution not set
    console.log('🔄 Redirecting to onboarding...')
    return redirect('/onboarding')
    
  } catch (error) {
    console.error('❌ Error initializing user:', error)
    // Even if error, redirect to onboarding
    return redirect('/onboarding')
  }
}
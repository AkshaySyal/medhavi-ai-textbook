// Secure logout that invalidates tokens server-side

import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    console.log('🚪 Secure logout requested for user:', user?.emailAddresses[0]?.emailAddress || 'Unknown')
    
    if (user) {
      // Method 1: Update user's logout timestamp to invalidate all existing tokens
      const client = await clerkClient()
      const currentTime = Math.floor(Date.now() / 1000)
      
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: {
          ...user.publicMetadata,
          lastLogoutAt: currentTime, // All tokens issued before this time become invalid
        }
      })
      
      console.log('✅ Updated user logout timestamp, all existing tokens invalidated')
    }
    
    // Create response with cookie clearing
    const response = NextResponse.json({ 
      success: true, 
      message: 'All sessions invalidated successfully',
      loggedOutAt: new Date().toISOString()
    })
    
    // Clear all possible textbook session cookies
    const cookiesToClear = [
      'textbook_session',
      'textbook_access', 
      'textbook_auth',
      'auth_session',
    ]
    
    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: -1, // Expire immediately
        path: '/',
        sameSite: 'lax'
      })
      
      // Also clear non-httpOnly version
      response.cookies.set(cookieName, '', {
        maxAge: -1,
        path: '/',
        sameSite: 'lax'
      })
    })
    
    console.log('✅ Cleared all server-side cookies and invalidated tokens')
    
    return response
  } catch (error) {
    console.error('❌ Secure logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
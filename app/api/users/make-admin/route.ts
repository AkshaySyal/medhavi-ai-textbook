import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function POST(request: Request) {
  try {
    // Check if current user is admin
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const isAdmin = user.publicMetadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can make other users admin' }, { status: 403 })
    }
    
    // Get userId from request
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    // Get clerk client and update user's role to admin (preserve existing metadata!)
    const client = await clerkClient()
    const target = await client.users.getUser(userId)
    const existing = (target.publicMetadata || {}) as Record<string, unknown>
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        role: 'admin'
      }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error making user admin:', error)
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
  }
}
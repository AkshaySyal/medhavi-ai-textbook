import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { approveRequest, denyRequest } from '@/lib/textbook-manager'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const user = await currentUser()
    if (!user || user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Await the params in Next.js 15+
    const params = await context.params
    const { action, userId, reason } = await request.json()
    
    if (!action || !userId) {
      return NextResponse.json({ 
        error: 'Action and userId are required' 
      }, { status: 400 })
    }
    
    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json({ 
        error: 'Action must be "approve" or "deny"' 
      }, { status: 400 })
    }
    
    try {
      if (action === 'approve') {
        await approveRequest(params.id, userId, user.id)
        console.log(`✅ Admin ${user.emailAddresses[0]?.emailAddress} approved request ${params.id}`)
      } else {
        await denyRequest(params.id, userId, user.id, reason)
        console.log(`❌ Admin ${user.emailAddresses[0]?.emailAddress} denied request ${params.id}${reason ? ` (Reason: ${reason})` : ''}`)
      }
      
      return NextResponse.json({ 
        success: true, 
        action,
        message: `Request ${action}d successfully` 
      })
    } catch (managerError) {
      console.error('Error in textbook-manager:', managerError)
      
      // Handle specific error messages
      if (managerError instanceof Error && managerError.message === 'Request not found') {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      }
      
      throw managerError
    }
    
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json({ 
      error: 'Failed to process request' 
    }, { status: 500 })
  }
}
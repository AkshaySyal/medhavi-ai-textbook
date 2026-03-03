import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { createAccessRequest, getAllPendingRequests, getTextbook } from '@/lib/textbook-manager'

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const isAdmin = user.publicMetadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const requests = await getAllPendingRequests()
    return NextResponse.json(requests)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { textbookId } = await request.json()
    
    const textbook = await getTextbook(textbookId)
    if (!textbook) {
      return NextResponse.json({ error: 'Textbook not found' }, { status: 404 })
    }
    
    const newRequest = await createAccessRequest(
      user.id,
      user.emailAddresses[0]?.emailAddress || '',
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
      textbookId,
      textbook.title
    )
    
    return NextResponse.json(newRequest, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create request' }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getTextbooks, saveTextbook } from '@/lib/textbook-manager'
import type { Textbook } from '@/types/textbook'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const textbooks = await getTextbooks()
    return NextResponse.json(textbooks)
  } catch (error) {
    console.error('Error fetching textbooks:', error)
    return NextResponse.json({ error: 'Failed to fetch textbooks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const isAdmin = user.publicMetadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { title, description, url, imageUrl, status } = await request.json()
    
    if (!title || !url) {
      return NextResponse.json({ error: 'Title and URL are required' }, { status: 400 })
    }
    
    const textbook: Textbook = {
      id: `tb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: description || '',
      url,
      imageUrl: imageUrl || '',
      status: status || 'hidden',
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByEmail: user.emailAddresses[0]?.emailAddress || ''
    }
    
    await saveTextbook(textbook, user.id)
    
    return NextResponse.json(textbook, { status: 201 })
  } catch (error) {
    console.error('Error creating textbook:', error)
    return NextResponse.json({ error: 'Failed to create textbook' }, { status: 500 })
  }
}

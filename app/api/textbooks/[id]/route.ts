import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getTextbook, saveTextbook, deleteTextbook } from '@/lib/textbook-manager'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(
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
    
    try {
      await deleteTextbook(params.id)
      console.log(`🗑️ Admin ${user.emailAddresses[0]?.emailAddress} deleted textbook ${params.id}`)
      return NextResponse.json({ success: true })
    } catch (deleteError) {
      console.error('Error in deleteTextbook:', deleteError)
      
      if (deleteError instanceof Error && deleteError.message === 'Textbook not found') {
        return NextResponse.json({ error: 'Textbook not found' }, { status: 404 })
      }
      
      throw deleteError
    }
  } catch (error) {
    console.error('Error deleting textbook:', error)
    return NextResponse.json({ error: 'Failed to delete textbook' }, { status: 500 })
  }
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
    
    try {
      const textbook = await getTextbook(params.id)
      if (!textbook) {
        return NextResponse.json({ error: 'Textbook not found' }, { status: 404 })
      }
      
      const updates = await request.json()
      
      // Validate required fields if they're being updated
      if (updates.title !== undefined && !updates.title) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      
      if (updates.url !== undefined && !updates.url) {
        return NextResponse.json({ error: 'URL cannot be empty' }, { status: 400 })
      }
      
      // Create updated textbook object
      const updatedTextbook = { 
        ...textbook, 
        ...updates,
        updatedAt: new Date().toISOString()
      }
      
      await saveTextbook(updatedTextbook, user.id)
      
      console.log(`📝 Admin ${user.emailAddresses[0]?.emailAddress} updated textbook: ${updatedTextbook.title}`)
      
      return NextResponse.json(updatedTextbook)
    } catch (managerError) {
      console.error('Error in textbook-manager:', managerError)
      
      if (managerError instanceof Error) {
        if (managerError.message.includes('already exists')) {
          return NextResponse.json({ error: 'A textbook with this URL already exists' }, { status: 400 })
        }
        if (managerError.message === 'Textbook not found') {
          return NextResponse.json({ error: 'Textbook not found' }, { status: 404 })
        }
      }
      
      throw managerError
    }
  } catch (error) {
    console.error('Error updating textbook:', error)
    return NextResponse.json({ error: 'Failed to update textbook' }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const params = await context.params;
    const classId = params.id
    const { textbookId } = await request.json()

    if (!textbookId) {
      return NextResponse.json({ error: 'Textbook ID required' }, { status: 400 })
    }

    // Verify the user owns this class (rudimentary security check)
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('instructor_id')
      .eq('id', classId)
      .single()

    if (classError || !classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    if (classData.instructor_id !== user.id && user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: insertError } = await supabase
      .from('class_textbooks')
      .insert([{ class_id: classId, textbook_id: textbookId }])

    if (insertError) throw insertError

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Error assigning textbook:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const params = await context.params;
    const classId = params.id
    const { textbookId } = await request.json()

    if (!textbookId) {
      return NextResponse.json({ error: 'Textbook ID required' }, { status: 400 })
    }

    // Security check
    const { data: classData } = await supabase.from('classes').select('instructor_id').eq('id', classId).single()
    if (classData?.instructor_id !== user.id && user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('class_textbooks')
      .delete()
      .match({ class_id: classId, textbook_id: textbookId })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing textbook:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

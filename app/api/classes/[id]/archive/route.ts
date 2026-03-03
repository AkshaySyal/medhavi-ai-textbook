import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase/client'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const params = await context.params;
    const classId = params.id
    const { archived } = await request.json()

    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'Archived status must be boolean' }, { status: 400 })
    }

    // Security check
    const { data: classData } = await supabase.from('classes').select('instructor_id').eq('id', classId).single()
    if (!classData) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (classData.instructor_id !== user.id && user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('classes')
      .update({ archived })
      .eq('id', classId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error toggling archive status:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

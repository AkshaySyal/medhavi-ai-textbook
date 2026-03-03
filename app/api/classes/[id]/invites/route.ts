import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase/client'
// import { v4 as uuidv4 } from 'uuid' // Or we can use crypto.randomUUID() later, but simple random strings work too

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const params = await context.params;
    const classId = params.id
    const { allowedDomain, maxUses, expiresAt } = await request.json()

    // Security check
    const { data: classData } = await supabase.from('classes').select('instructor_id').eq('id', classId).single()
    if (!classData) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (classData.instructor_id !== user.id && user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate a unique, readable code
    const uniqueSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
    const code = `CLS-${uniqueSuffix}`

    const inviteData: any = {
      class_id: classId,
      code,
      created_by: user.id
    }

    if (allowedDomain) inviteData.allowed_domain = allowedDomain
    if (maxUses) inviteData.max_uses = maxUses
    if (expiresAt) inviteData.expires_at = expiresAt

    const { data: invite, error } = await supabase
      .from('class_invites')
      .insert([inviteData])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(invite, { status: 201 })
  } catch (error) {
    console.error('Error generating invite link:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

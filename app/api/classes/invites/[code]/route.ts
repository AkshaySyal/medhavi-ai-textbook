import { NextResponse } from 'next/server'
import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params
    const inviteCode = params.code

    // Fetch the invite to see if it's active
    const { data: invite, error } = await supabase
      .from('class_invites')
      .select('*, classes(name, archived, instructor_id)')
      .eq('code', inviteCode)
      .eq('is_active', true)
      .single()

    if (error || !invite) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 })
    }

    // @ts-ignore
    if (invite.classes?.archived) {
      return NextResponse.json({ error: 'This class no longer exists' }, { status: 403 })
    }
    
    if (invite.max_uses && invite.current_uses >= invite.max_uses) {
      return NextResponse.json({ error: 'This invite link has reached its maximum capacity' }, { status: 403 })
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired' }, { status: 403 })
    }

    // Get instructor info
    // @ts-ignore
    const instructorId = invite.classes?.instructor_id
    let instructorName = 'Instructor'
    if (instructorId) {
      try {
        const clerk = await clerkClient()
        const instructor = await clerk.users.getUser(instructorId)
        instructorName = `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() || 'Instructor'
      } catch (e) {
        console.warn('Failed to fetch instructor details', e)
      }
    }

    return NextResponse.json({
      // @ts-ignore
      name: invite.classes?.name,
      instructorName
    })
  } catch (error) {
    console.error('Error fetching invite:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const params = await context.params
    const inviteCode = params.code
    const { maxUses, expiresAt } = await request.json()

    // 1. Fetch the invite to find the class ID
    const { data: invite, error: fetchError } = await supabase
      .from('class_invites')
      .select('class_id')
      .eq('code', inviteCode)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // 2. Verify the user is the instructor of the associated class
    const { data: classData } = await supabase
      .from('classes')
      .select('instructor_id')
      .eq('id', invite.class_id)
      .single()

    if (!classData || (classData.instructor_id !== user.id && user.publicMetadata?.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Update the invite
    const updateData: any = {
      max_uses: maxUses === undefined ? null : maxUses,
      expires_at: expiresAt === undefined ? null : expiresAt
    }

    const { data: updatedInvite, error: updateError } = await supabase
      .from('class_invites')
      .update(updateData)
      .eq('code', inviteCode)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updatedInvite)
  } catch (error) {
    console.error('Error updating invite link:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

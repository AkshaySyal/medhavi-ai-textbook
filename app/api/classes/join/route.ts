import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Get the email address string for domain checking
    const emailAddress = user.emailAddresses[0]?.emailAddress || ''
    const userDomain = emailAddress.split('@')[1]?.toLowerCase()
    
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
    }

    // 1. Fetch the invite code details and the associated class
    const { data: invite, error: inviteError } = await supabase
      .from('class_invites')
      .select('*, classes(name, archived)')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 })
    }

    // 2. Validate Class Status
    // @ts-ignore - Supabase join typing issue
    if (invite.classes?.archived) {
      return NextResponse.json({ error: 'This class no longer exists' }, { status: 403 })
    }

    // 3. Validate Domain
    if (invite.allowed_domain) {
      if (userDomain !== invite.allowed_domain.toLowerCase()) {
        return NextResponse.json({ error: `This invite is restricted to the @${invite.allowed_domain} domain.` }, { status: 403 })
      }
    }

    // 4. Validate Capacity
    if (invite.max_uses && invite.current_uses >= invite.max_uses) {
      return NextResponse.json({ error: 'This invite link has reached its maximum capacity' }, { status: 403 })
    }

    // 5. Validate Expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired' }, { status: 403 })
    }

    // 6. Enroll the Student
    // (If they are already enrolled, it will silently fail on the unique constraint, which we handle)
    const { error: enrollError } = await supabase
      .from('class_enrollments')
      .insert([{ class_id: invite.class_id, student_id: user.id }])

    if (enrollError) {
      // Postgres error code 23505 is unique violation
      if (enrollError.code === '23505') {
        return NextResponse.json({ error: 'You are already enrolled in this class' }, { status: 400 })
      }
      throw enrollError
    }

    // 7. Increment the invite usage
    await supabase
      .from('class_invites')
      .update({ current_uses: invite.current_uses + 1 })
      .eq('id', invite.id)

    // @ts-ignore
    return NextResponse.json({ success: true, className: invite.classes.name }, { status: 200 })
  } catch (error) {
    console.error('Error joining class:', error)
    return NextResponse.json({ error: 'Failed to join class' }, { status: 500 })
  }
}

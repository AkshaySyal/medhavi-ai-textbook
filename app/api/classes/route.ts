import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Only instructors (and maybe admins) can fetch these classes
    const role = user.publicMetadata?.role
    if (role !== 'instructor' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch classes and their related data
    const { data: classes, error } = await supabase
      .from('classes')
      .select(`
        id, name, created_at, archived,
        class_textbooks(textbook_id),
        class_invites(code, allowed_domain, max_uses, current_uses, is_active, expires_at),
        class_enrollments(student_id)
      `)
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform data to match the frontend ClassData interface exactly
    const formattedData = classes.map((cls: any) => ({
      id: cls.id,
      name: cls.name,
      createdAt: cls.created_at,
      archived: cls.archived,
      textbookIds: cls.class_textbooks.map((ct: any) => ct.textbook_id),
      studentCount: cls.class_enrollments.length,
      invites: cls.class_invites.map((inv: any) => ({
        code: inv.code,
        allowedDomain: inv.allowed_domain,
        maxUses: inv.max_uses,
        currentUses: inv.current_uses,
        isActive: inv.is_active,
        expiresAt: inv.expires_at
      }))
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const role = user.publicMetadata?.role
    if (role !== 'instructor' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name } = await request.json()
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Class name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('classes')
      .insert([{ name: name.trim(), instructor_id: user.id }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating class:', error)
    return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
  }
}

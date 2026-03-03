import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'

type RoleChoice = 'student' | 'instructor' | 'admin'

function isAllowedSelfServeRole(role: unknown): role is 'student' | 'instructor' {
  return role === 'student' || role === 'instructor'
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const role = body?.role as unknown
    const institution = typeof body?.institution === 'string' ? body.institution.trim() : ''
    const courseName = typeof body?.courseName === 'string' ? body.courseName.trim() : ''
    const courseInstructor = typeof body?.courseInstructor === 'string' ? body.courseInstructor.trim() : ''

    if (!isAllowedSelfServeRole(role)) {
      return NextResponse.json({ error: 'Invalid role. Choose student or instructor.' }, { status: 400 })
    }
    if (!institution || institution.length < 2) {
      return NextResponse.json({ error: 'Institution is required.' }, { status: 400 })
    }
    if (role === 'student') {
      if (!courseName || courseName.length < 2) {
        return NextResponse.json({ error: 'Course name is required for students.' }, { status: 400 })
      }
      if (!courseInstructor || courseInstructor.length < 2) {
        return NextResponse.json({ error: 'Course instructor is required for students.' }, { status: 400 })
      }
    }

    const existing = (user.publicMetadata || {}) as Record<string, unknown>
    const existingRole = existing.role as RoleChoice | undefined

    // Do not allow users to change an admin account via this endpoint.
    if (existingRole === 'admin') {
      return NextResponse.json({ error: 'Admin profiles cannot be changed here.' }, { status: 403 })
    }

    const client = await clerkClient()
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...existing,
        role,
        institution,
        courseName: role === 'student' ? courseName : '',
        courseInstructor: role === 'student' ? courseInstructor : '',
        // Ensure defaults exist
        textbookAccess: Array.isArray((existing as any).textbookAccess) ? (existing as any).textbookAccess : [],
        accessRequests: Array.isArray((existing as any).accessRequests) ? (existing as any).accessRequests : [],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}



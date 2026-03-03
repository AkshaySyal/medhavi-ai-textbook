import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getDashboardAnalytics } from '@/lib/analytics'

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await getDashboardAnalytics()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Dashboard analytics error:', error)
    return NextResponse.json({ error: 'Failed to load analytics dashboard' }, { status: 500 })
  }
}


import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminAnalyticsPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  if (user.publicMetadata?.role !== 'admin') {
    redirect('/dashboard')
  }

  return <AnalyticsDashboard />
}


import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'
import { clerkClient } from '@clerk/nextjs/server'

//Force dynamic rendering for pages that use server functions
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await currentUser()
  
  if (!user) {
    redirect('/sign-in')
  }
  
  const isAdmin = user.publicMetadata?.role === 'admin'
  
  if (!isAdmin) {
    redirect('/dashboard')
  }
  
  // Get the clerk client instance and then get users
  const client = await clerkClient()
  const users = await client.users.getUserList({ limit: 100 })
  
  // Serialize current user data
  const currentUserData = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.emailAddresses[0]?.emailAddress || '',
    role: 'admin'
  }
  
  // Serialize all users data
  const allUsersData = users.data.map((u: any) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.emailAddresses[0]?.emailAddress || '',
    publicMetadata: u.publicMetadata
  }))
  
  return <AdminDashboard currentUser={currentUserData} allUsers={allUsersData} />
}
// FILE LOCATION: textbook-hub/lib/textbook-manager.ts

import { clerkClient } from '@clerk/nextjs/server'
import type { User } from '@clerk/nextjs/server'
import type { Textbook, AccessRequest, UserMetadata } from '@/types/textbook'
import { supabase } from './supabase/client'

let cachedSystemAdminId: string | null = null;
let fetchingSystemAdminPromise: Promise<User | null> | null = null;

// TTL cache for textbooks data (avoids Clerk API calls on every request)
let cachedTextbooks: Textbook[] | null = null;
let cachedTextbooksTime: number = 0;
const TEXTBOOK_CACHE_TTL = 60_000; // 60 seconds

// Store textbooks in the first admin's metadata as "system storage"
async function getSystemAdmin() {
  const client = await clerkClient()
  
  if (cachedSystemAdminId) {
    try {
      const admin = await client.users.getUser(cachedSystemAdminId)
      if ((admin.publicMetadata as any)?.systemData === true) {
        return admin
      }
    } catch(e) {
      // If user was deleted or no longer has systemData, clear cache
      cachedSystemAdminId = null;
    }
  }

  // If already fetching, wait for the existing promise to resolve
  if (fetchingSystemAdminPromise) {
    return fetchingSystemAdminPromise;
  }

  fetchingSystemAdminPromise = (async () => {
    try {
      const users = await client.users.getUserList({ limit: 500 })
      const systemAdmin = users.data.find((user: User) => 
        (user.publicMetadata as any)?.systemData === true
      )
      
      if (!systemAdmin) {
        // No system admin yet
        return null
      }
      
      cachedSystemAdminId = systemAdmin.id;
      return systemAdmin
    } finally {
      fetchingSystemAdminPromise = null;
    }
  })();

  return fetchingSystemAdminPromise;
}

// ============================================
// TEXTBOOK MANAGEMENT
// ============================================

export async function getTextbooks(): Promise<Textbook[]> {
  // Return cached textbooks if still fresh
  if (cachedTextbooks && Date.now() - cachedTextbooksTime < TEXTBOOK_CACHE_TTL) {
    return cachedTextbooks;
  }

  try {
    const systemAdmin = await getSystemAdmin()
    if (!systemAdmin) {
      return []
    }
    
    const metadata = systemAdmin.publicMetadata as any
    const textbooks = metadata.textbooks || []
    
    // Cache the result
    cachedTextbooks = textbooks;
    cachedTextbooksTime = Date.now();
    
    return textbooks
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error fetching textbooks:', errorMessage)
    return cachedTextbooks || [] // Return stale cache on error rather than empty
  }
}

export async function getTextbook(id: string): Promise<Textbook | null> {
  const textbooks = await getTextbooks()
  return textbooks.find(t => t.id === id) || null
}

export async function saveTextbook(textbook: Textbook, adminUserId: string): Promise<void> {
  const client = await clerkClient()
  let systemAdmin = await getSystemAdmin()
  
  // If no system admin exists, make current admin the system admin
  if (!systemAdmin) {
    const admin = await client.users.getUser(adminUserId)
    await client.users.updateUserMetadata(adminUserId, {
      publicMetadata: {
        ...admin.publicMetadata,
        systemData: true,
        textbooks: [textbook]
      }
    })
    return
  }
  
  // Add/update textbook
  const metadata = systemAdmin.publicMetadata as any
  const textbooks = metadata.textbooks || []
  const existingIndex = textbooks.findIndex((t: Textbook) => t.id === textbook.id)
  
  if (existingIndex >= 0) {
    textbooks[existingIndex] = textbook
  } else {
    textbooks.push(textbook)
  }
  
  await client.users.updateUserMetadata(systemAdmin.id, {
    publicMetadata: {
      ...metadata,
      textbooks
    }
  })
}

/**
 * Enhanced delete function that cleans up ALL user permissions and requests
 */
export async function deleteTextbook(textbookId: string): Promise<void> {
  try {
    const client = await clerkClient()
    
    // Step 1: Find and remove the textbook from system storage
    const systemAdmin = await getSystemAdmin()
    if (!systemAdmin) {
      throw new Error('No system admin found')
    }
    
    const metadata = systemAdmin.publicMetadata as any
    const textbooks = metadata.textbooks || []
    const textbookToDelete = textbooks.find((t: Textbook) => t.id === textbookId)
    
    if (!textbookToDelete) {
      throw new Error('Textbook not found')
    }
    
    const updatedTextbooks = textbooks.filter((t: Textbook) => t.id !== textbookId)
    
    // Remove from system storage
    await client.users.updateUserMetadata(systemAdmin.id, {
      publicMetadata: {
        ...metadata,
        textbooks: updatedTextbooks
      }
    })
    
    console.log(`🗑️ Removed textbook "${textbookToDelete.title}" from system storage`)
    
    // Step 2: Clean up ALL user permissions and requests
    const users = await client.users.getUserList({ limit: 500 })
    const usersToUpdate: { id: string; metadata: UserMetadata; changes: string[] }[] = []
    
    for (const user of users.data) {
      const userMetadata = user.publicMetadata as UserMetadata
      
      // Skip system admin and other admins
      if (userMetadata?.role === 'admin') {
        continue
      }
      
      let hasChanges = false
      const changes: string[] = []
      const updatedMetadata = { ...userMetadata }
      
      // Remove from textbook access list
      if (userMetadata?.textbookAccess?.includes(textbookId)) {
        updatedMetadata.textbookAccess = userMetadata.textbookAccess.filter(id => id !== textbookId)
        hasChanges = true
        changes.push('removed from access list')
      }
      
      // Remove/update related access requests
      if (userMetadata?.accessRequests?.length) {
        const originalRequests = userMetadata.accessRequests
        const updatedRequests = originalRequests.filter(req => req.textbookId !== textbookId)
        
        if (updatedRequests.length !== originalRequests.length) {
          updatedMetadata.accessRequests = updatedRequests
          hasChanges = true
          const removedCount = originalRequests.length - updatedRequests.length
          changes.push(`removed ${removedCount} access request(s)`)
        }
      }
      
      if (hasChanges) {
        usersToUpdate.push({
          id: user.id,
          metadata: updatedMetadata,
          changes
        })
      }
    }
    
    // Step 3: Batch update all affected users
    console.log(`🧹 Cleaning up permissions for ${usersToUpdate.length} user(s)...`)
    
    for (const userUpdate of usersToUpdate) {
      try {
        await client.users.updateUserMetadata(userUpdate.id, {
          publicMetadata: userUpdate.metadata
        })
        
        const userEmail = users.data.find((u: User) => u.id === userUpdate.id)?.emailAddresses[0]?.emailAddress || 'Unknown'
        console.log(`   ✅ Updated ${userEmail}: ${userUpdate.changes.join(', ')}`)
      } catch (updateError: unknown) {
        const errorMessage = updateError instanceof Error ? updateError.message : String(updateError)
        console.error(`   ❌ Failed to update user ${userUpdate.id}:`, errorMessage)
        // Continue with other users even if one fails
      }
    }
    
    console.log(`🎉 Successfully deleted textbook "${textbookToDelete.title}" and cleaned up ${usersToUpdate.length} user permission(s)`)
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ Error deleting textbook:', errorMessage)
    throw new Error(`Failed to delete textbook: ${errorMessage}`)
  }
}

// ============================================
// USER ACCESS MANAGEMENT
// ============================================

export async function getUserAccess(userId: string): Promise<string[]> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const metadata = user.publicMetadata as UserMetadata
  
  // Admins have access to all textbooks
  if (metadata?.role === 'admin') {
    const textbooks = await getTextbooks()
    return textbooks.map(t => t.id)
  }

  // Instructors have access to all public + private (but not hidden) textbooks
  if (metadata?.role === 'instructor') {
    const textbooks = await getTextbooks()
    return textbooks.filter(t => t.status !== 'hidden').map(t => t.id)
  }
  
  // 1. Get legacy Clerk explicit access
  const explicitAccess = metadata?.textbookAccess || []
  
  // 2. Get new Supabase Class-based access
  const classTextbookAccess: string[] = []
  try {
    // A. Find all active classes the student is enrolled in
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('class_enrollments')
      .select('class_id, classes!inner(archived)')
      .eq('student_id', userId)
      .eq('classes.archived', false)
      
    if (!enrollmentError && enrollments && enrollments.length > 0) {
      const activeClassIds = enrollments.map(e => e.class_id)
      
      // B. Get all textbooks assigned to those active classes
      const { data: assignments, error: assignmentError } = await supabase
        .from('class_textbooks')
        .select('textbook_id')
        .in('class_id', activeClassIds)
        
      if (!assignmentError && assignments) {
        classTextbookAccess.push(...assignments.map(a => a.textbook_id))
      }
    }
  } catch (error) {
    console.error('Failed to fetch user class access from Supabase:', error)
  }
  
  // Combine both arrays and remove duplicates
  return Array.from(new Set([...explicitAccess, ...classTextbookAccess]))
}

export async function grantAccess(userId: string, textbookId: string): Promise<void> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const metadata = user.publicMetadata as UserMetadata
  
  // Admins don't need explicit access
  if (metadata?.role === 'admin') {
    return
  }
  
  const currentAccess = metadata?.textbookAccess || []
  
  if (!currentAccess.includes(textbookId)) {
    currentAccess.push(textbookId)
    
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...metadata,
        textbookAccess: currentAccess
      }
    })
  }
}

// ============================================
// ACCESS REQUEST MANAGEMENT
// ============================================

export async function createAccessRequest(
  userId: string,
  userEmail: string,
  userName: string,
  textbookId: string,
  textbookTitle: string
): Promise<AccessRequest> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const metadata = user.publicMetadata as UserMetadata
  
  // Admins and instructors don't need to request (instructors have automatic access to private).
  if (metadata?.role === 'admin') {
    throw new Error('Admins have automatic access')
  }
  if (metadata?.role === 'instructor') {
    throw new Error('Instructors have automatic access to private textbooks')
  }
  
  const requests = metadata?.accessRequests || []
  
  // Check if request already exists
  const existing = requests.find(r => 
    r.textbookId === textbookId && r.status === 'pending'
  )
  
  if (existing) {
    throw new Error('Request already pending')
  }
  
  const newRequest: AccessRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    userEmail,
    userName,
    textbookId,
    textbookTitle,
    status: 'pending',
    requestedAt: new Date().toISOString()
  }
  
  requests.push(newRequest)
  
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...metadata,
      accessRequests: requests
    }
  })
  
  return newRequest
}

export async function getAllPendingRequests(): Promise<AccessRequest[]> {
  const client = await clerkClient()
  const users = await client.users.getUserList({ limit: 500 })
  const allRequests: AccessRequest[] = []
  
  for (const user of users.data) {
    const metadata = user.publicMetadata as UserMetadata
    
    // Skip admins and instructors (instructors do not use request flow)
    if (metadata?.role === 'admin' || metadata?.role === 'instructor') continue
    
    const requests = metadata?.accessRequests || []
    const pending = requests.filter(r => r.status === 'pending')
    allRequests.push(...pending)
  }
  
  return allRequests.sort((a, b) => 
    new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  )
}

export async function approveRequest(requestId: string, userId: string, adminId: string): Promise<void> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const metadata = user.publicMetadata as UserMetadata
  const requests = metadata?.accessRequests || []
  
  // Instructors should not be in request flow.
  if (metadata?.role === 'instructor') {
    throw new Error('Instructors do not require approval')
  }

  const request = requests.find(r => r.id === requestId)
  if (!request) {
    throw new Error('Request not found')
  }
  
  request.status = 'approved'
  request.processedAt = new Date().toISOString()
  request.processedBy = adminId
  
  // Grant access to the textbook
  const currentAccess = metadata?.textbookAccess || []
  if (!currentAccess.includes(request.textbookId)) {
    currentAccess.push(request.textbookId)
  }
  
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...metadata,
      textbookAccess: currentAccess,
      accessRequests: requests
    }
  })
}

export async function denyRequest(requestId: string, userId: string, adminId: string, reason?: string): Promise<void> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const metadata = user.publicMetadata as UserMetadata
  const requests = metadata?.accessRequests || []
  
  const request = requests.find(r => r.id === requestId)
  if (!request) {
    throw new Error('Request not found')
  }
  
  request.status = 'denied'
  request.processedAt = new Date().toISOString()
  request.processedBy = adminId
  if (reason) request.reason = reason
  
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...metadata,
      accessRequests: requests
    }
  })
}

export async function getUserRequests(userId: string): Promise<AccessRequest[]> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const metadata = user.publicMetadata as UserMetadata
  return metadata?.accessRequests || []
}

// ============================================
// MAINTENANCE FUNCTIONS (NEW)
// ============================================

/**
 * Helper function to check for orphaned permissions (for maintenance)
 */
export async function findOrphanedPermissions(): Promise<{
  userId: string
  email: string
  orphanedIds: string[]
}[]> {
  try {
    const client = await clerkClient()
    const users = await client.users.getUserList({ limit: 500 })
    
    // Get all valid textbook IDs
    const allTextbooks = await getTextbooks()
    const validTextbookIds = allTextbooks.map(tb => tb.id)
    
    const orphanedUsers: {
      userId: string
      email: string
      orphanedIds: string[]
    }[] = []
    
    for (const user of users.data) {
      const userMetadata = user.publicMetadata as UserMetadata
      
      if (userMetadata?.textbookAccess?.length) {
        const orphanedIds = userMetadata.textbookAccess.filter(id => !validTextbookIds.includes(id))
        
        if (orphanedIds.length > 0) {
          orphanedUsers.push({
            userId: user.id,
            email: user.emailAddresses[0]?.emailAddress || 'Unknown',
            orphanedIds
          })
        }
      }
    }
    
    return orphanedUsers
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error finding orphaned permissions:', errorMessage)
    return []
  }
}

/**
 * Clean up orphaned permissions (maintenance function)
 */
export async function cleanupOrphanedPermissions(): Promise<number> {
  try {
    const orphanedUsers = await findOrphanedPermissions()
    
    if (orphanedUsers.length === 0) {
      console.log('✅ No orphaned permissions found')
      return 0
    }
    
    const client = await clerkClient()
    let cleanedCount = 0
    
    for (const orphanedUser of orphanedUsers) {
      try {
        const user = await client.users.getUser(orphanedUser.userId)
        const userMetadata = user.publicMetadata as UserMetadata
        
        // Remove orphaned IDs
        const cleanAccess = userMetadata?.textbookAccess?.filter(id => 
          !orphanedUser.orphanedIds.includes(id)
        ) || []
        
        await client.users.updateUserMetadata(orphanedUser.userId, {
          publicMetadata: {
            ...userMetadata,
            textbookAccess: cleanAccess
          }
        })
        
        console.log(`🧹 Cleaned ${orphanedUser.orphanedIds.length} orphaned permission(s) for: ${orphanedUser.email}`)
        cleanedCount++
      } catch (updateError: unknown) {
        const errorMessage = updateError instanceof Error ? updateError.message : String(updateError)
        console.error(`❌ Failed to clean permissions for ${orphanedUser.email}:`, errorMessage)
      }
    }
    
    return cleanedCount
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error cleaning orphaned permissions:', errorMessage)
    return 0
  }
}
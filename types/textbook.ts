import type { UserAnalyticsMetadata } from '@/types/analytics'

export interface Textbook {
  id: string
  title: string
  description: string
  url: string
  imageUrl?: string
  status: 'public' | 'private' | 'hidden'
  createdAt: string
  createdBy: string
  createdByEmail: string
}

export interface AccessRequest {
  id: string
  userId: string
  userEmail: string
  userName: string
  textbookId: string
  textbookTitle: string
  status: 'pending' | 'approved' | 'denied'
  requestedAt: string
  processedAt?: string
  processedBy?: string
  reason?: string
}

export interface UserMetadata {
  role?: 'admin' | 'student' | 'instructor'
  institution?: string
  textbookAccess?: string[]  // IDs of textbooks user has access to
  accessRequests?: AccessRequest[]
  systemData?: boolean  // Add this since it's used in your code
  textbooks?: Textbook[]  // Add this since system admin stores textbooks
  analytics?: UserAnalyticsMetadata
  [key: string]: any  // Add this index signature for Clerk compatibility
}
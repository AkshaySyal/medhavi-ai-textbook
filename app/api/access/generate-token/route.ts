// Fixed JWT generation - no more exp/expiresIn conflict

import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getTextbook, getUserAccess } from '@/lib/textbook-manager'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const JWT_SECRET = process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { textbookId } = await request.json()
    
    if (!textbookId) {
      return NextResponse.json({ error: 'Textbook ID required' }, { status: 400 })
    }
    
    // Verify textbook exists
    const textbook = await getTextbook(textbookId)
    if (!textbook) {
      return NextResponse.json({ error: 'Textbook not found' }, { status: 404 })
    }
    
    const userMetadata = user.publicMetadata as any
    const userRole = userMetadata?.role || 'student'

    let hasAccess = false
    
    if (textbook.status === 'public') {
      hasAccess = true // Anyone can access public textbooks
    } else {
      // For private and hidden textbooks, rely on the consolidated getUserAccess logic
      // which checks admin roles, instructor roles, explicit Clerk metadata, AND Supabase classes
      const accessibleTextbooks = await getUserAccess(user.id)
      hasAccess = accessibleTextbooks.includes(textbookId)
    }
    
    if (!hasAccess) {
      console.log(`❌ Access denied for user ${user.emailAddresses[0]?.emailAddress} to textbook: ${textbook.title}`)
      return NextResponse.json({ error: 'Access denied to this textbook' }, { status: 403 })
    }
    
    const now = Math.floor(Date.now() / 1000)
    
    // Create token data WITHOUT exp field for JWT
    const tokenData = {
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      textbookId,
      iat: now // Only include iat, let JWT library handle exp
    }
    
    let token: string
    let expirationTime: number
    
    if (JWT_SECRET) {
      // Use JWT with expiresIn option (don't set exp manually)
      token = jwt.sign(tokenData, JWT_SECRET, { 
        expiresIn: '24h', // Let JWT library set the exp claim
        issuer: 'textbook-auth-hub',
        audience: textbookId
      })
      expirationTime = now + (24 * 60 * 60) // 24 hours from now
      console.log('🔐 Generated JWT token for user:', user.id, 'textbook:', textbookId)
    } else {
      // Fallback to base64 with manual exp field
      const legacyTokenData = {
        ...tokenData,
        timestamp: Date.now(), // Legacy format
        exp: now + (24 * 60 * 60) // Manual exp for base64 tokens
      }
      token = Buffer.from(JSON.stringify(legacyTokenData)).toString('base64')
      expirationTime = now + (24 * 60 * 60)
      console.log('🔓 Generated base64 token for user:', user.id, 'textbook:', textbookId)
    }
    
    // Log token details for debugging
    console.log('📝 Token details:', {
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      textbookId,
      textbookTitle: textbook.title,
      userRole,
      expiresAt: new Date(expirationTime * 1000).toISOString(),
      tokenType: JWT_SECRET ? 'JWT' : 'base64'
    })
    
    return NextResponse.json({ 
      token,
      expiresAt: new Date(expirationTime * 1000).toISOString(),
      tokenType: JWT_SECRET ? 'jwt' : 'base64'
    })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
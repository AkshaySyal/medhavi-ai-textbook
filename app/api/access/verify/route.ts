// FILE LOCATION: textbook-hub/app/api/access/verify/route.ts
// Complete fixed version - admins can access hidden textbooks
// FIXED: Preserves full URLs including paths like /app2

import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import type { User } from '@clerk/nextjs/server'
import { getTextbook, getTextbooks, getUserAccess } from '@/lib/textbook-manager'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY

// TTL cache for CORS origins (avoids Clerk API calls on every preflight/POST)
let cachedOrigins: string[] | null = null;
let cachedOriginsTime: number = 0;
const ORIGINS_CACHE_TTL = 60_000; // 60 seconds

// Get textbook origins dynamically from your centralized storage
async function getTextbookOriginsFromStorage(): Promise<string[]> {
  // Return cached origins if still fresh
  if (cachedOrigins && Date.now() - cachedOriginsTime < ORIGINS_CACHE_TTL) {
    return cachedOrigins;
  }

  try {
    const textbooks = await getTextbooks()
    const textbookOrigins: string[] = []
    
    for (const textbook of textbooks) {
      if (textbook.url) {
        try {
          // Keep full URL instead of just origin (preserves /app2)
          const cleanUrl = textbook.url.replace(/\/$/, '') // Remove trailing slash only
          textbookOrigins.push(cleanUrl)
          
          // ALSO add the base origin for backwards compatibility
          const url = new URL(textbook.url)
          const origin = `${url.protocol}//${url.host}`
          if (origin !== cleanUrl) {
            textbookOrigins.push(origin)
          }
        } catch (urlError: unknown) {
          const errorMessage = urlError instanceof Error ? urlError.message : String(urlError)
          console.warn(`Invalid textbook URL: ${textbook.url} - ${errorMessage}`)
        }
      }
    }
    
    const origins = Array.from(new Set(textbookOrigins)) // Remove duplicates
    cachedOrigins = origins;
    cachedOriginsTime = Date.now();
    return origins
    
  } catch (error) {
    console.error('❌ Error fetching textbook origins:', error)
    return []
  }
}

// Simplified CORS headers - only allows registered textbooks + localhost in dev
async function addCorsHeaders(response: NextResponse, origin: string | null) {
  if (!origin) {
    console.log('ℹ️  No origin header in request')
    return response
  }
  
  // Get allowed origins from textbooks in your system
  const allowedOrigins = await getTextbookOriginsFromStorage()
  
  if (allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    console.log('✅ CORS allowed for registered textbook:', origin)
  } else if (process.env.NODE_ENV === 'development' && origin.match(/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    console.log('🏠 CORS allowed for localhost (dev mode):', origin)
  } else {
    console.warn('🚫 CORS blocked for unregistered origin:', origin)
    console.warn('📋 Allowed origins:', allowedOrigins)
    // Don't set CORS header - browser will block the request
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Origin')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

import * as fs from 'fs'

function logToFile(msg: string | any) {
  try {
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg)
    fs.appendFileSync('auth-debug.txt', new Date().toISOString() + ' ' + text + '\n')
  } catch(e) {}
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  
  try {
    const { token, textbookUrl } = await request.json()
    logToFile('--- NEW VERIFY REQUEST ---')
    logToFile({ hasToken: !!token, textbookUrl, origin })
    
    if (!token) {
      logToFile('❌ No token provided')
      const response = NextResponse.json({ hasAccess: false, error: 'No token provided' })
      return addCorsHeaders(response, origin)
    }
    
    let decoded: any
    
    try {
      if (JWT_SECRET) {
        decoded = jwt.verify(token, JWT_SECRET) as any
        console.log('🔐 JWT token verified successfully')
      } else {
        console.warn('⚠️  Using base64 fallback - configure JWT_SECRET for better security')
        decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        console.log('🔓 Base64 token decoded (fallback mode)')
      }
    } catch (tokenError) {
      try {
        decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        console.log('🔄 JWT failed, base64 fallback successful')
      } catch (base64Error) {
        console.error('❌ Both JWT and base64 token decode failed')
        const response = NextResponse.json({ hasAccess: false, error: 'Invalid token format' })
        return addCorsHeaders(response, origin)
      }
    }
    
    console.log('👤 Token data:', { userId: decoded.userId, email: decoded.email, textbookId: decoded.textbookId })
    
    // Check token expiration
    const now = Math.floor(Date.now() / 1000)
    let isExpired = false
    
    if (decoded.exp) {
      isExpired = now > decoded.exp
      console.log('⏰ JWT expiration check:', { now, exp: decoded.exp, expired: isExpired })
    } else if (decoded.timestamp) {
      const tokenAge = Date.now() - decoded.timestamp
      isExpired = tokenAge > (24 * 60 * 60 * 1000)
      console.log('⏰ Legacy timestamp check:', { age: Math.floor(tokenAge / 1000 / 60), 'minutes': true, expired: isExpired })
    }
    
    if (isExpired) {
      console.log('❌ Token expired')
      const response = NextResponse.json({ hasAccess: false, error: 'Token expired' })
      return addCorsHeaders(response, origin)
    }
    
    // Verify user exists and is active in Clerk
    console.log('👤 Checking user in Clerk...')
    try {
      const client = await clerkClient()
      const user = await client.users.getUser(decoded.userId)
      
      if (!user || user.banned) {
        console.log('❌ User not found or banned')
        const response = NextResponse.json({ hasAccess: false, error: 'User access revoked' })
        return addCorsHeaders(response, origin)
      }
      
      // 🛡️ SECURITY CHECK: Validate token against user's last logout timestamp
      const userMetadata = user.publicMetadata as any
      const lastLogoutAt = userMetadata?.lastLogoutAt
      const tokenIssuedAt = decoded.iat || Math.floor((decoded.timestamp || Date.now()) / 1000)
      
      if (lastLogoutAt && tokenIssuedAt < lastLogoutAt) {
        console.log('🚨 Security: Token was issued before last logout!')
        console.log('   Token issued at:', new Date(tokenIssuedAt * 1000).toISOString())
        console.log('   Last logout at:', new Date(lastLogoutAt * 1000).toISOString())
        const response = NextResponse.json({ hasAccess: false, error: 'Token invalidated by logout' })
        return addCorsHeaders(response, origin)
      }
      
      console.log('✅ User is active and token is post-logout:', { 
        userId: user.id, 
        email: user.emailAddresses[0]?.emailAddress,
        userRole: userMetadata?.role
      })
      
      // Get textbook from your centralized storage
      const textbook = await getTextbook(decoded.textbookId)
      
      if (!textbook) {
        logToFile(`❌ Textbook not found: ${decoded.textbookId}`)
        const response = NextResponse.json({ hasAccess: false, error: 'Textbook not found' })
        return addCorsHeaders(response, origin)
      }
      
      logToFile({ msg: '📚 Found textbook:', title: textbook.title, status: textbook.status, url: textbook.url })
      
      // UPDATED: More flexible URL validation for path-based textbooks
      if (textbook.url && textbookUrl) {
        try {
          // Check if URLs match exactly first
          const normalizedTextbookUrl = textbook.url.replace(/\/$/, '')
          const normalizedRequestUrl = textbookUrl.replace(/\/$/, '')
          
          if (normalizedTextbookUrl === normalizedRequestUrl) {
            logToFile('✅ Exact URL match')
          } else {
            // Fallback: Check origins match (for backwards compatibility)
            const textbookOrigin = new URL(textbook.url).origin
            const requestOrigin = new URL(textbookUrl).origin
            
            if (textbookOrigin === requestOrigin) {
              logToFile('✅ Origin match (fallback)')
            } else {
              logToFile({ 
                msg: '🚨 Security: URL mismatch!', 
                expected: normalizedTextbookUrl, 
                actual: normalizedRequestUrl,
                expectedOrigin: textbookOrigin,
                actualOrigin: requestOrigin 
              })
              const response = NextResponse.json({ hasAccess: false, error: 'Invalid textbook origin' })
              return addCorsHeaders(response, origin)
            }
          }
        } catch (urlError: unknown) {
          const errorMessage = urlError instanceof Error ? urlError.message : String(urlError)
          logToFile(`⚠️  URL validation failed: ${errorMessage}`)
        }
      }
      
      // FIXED: Check access based on textbook status with admin privileges
      if (textbook.status === 'hidden') {
        // Hidden textbooks - only admins can access
        if (userMetadata?.role === 'admin') {
          logToFile('✅ Hidden textbook - admin access granted')
        } else {
          logToFile('❌ Hidden textbook - student access denied')
          const response = NextResponse.json({ hasAccess: false, error: 'Textbook is hidden' })
          return addCorsHeaders(response, origin)
        }
      } else if (textbook.status === 'private') {
        // Use the consolidated access logic that queries Supabase classes as well
        logToFile('--- Calling getUserAccess ---')
        const userTextbookAccess = await getUserAccess(user.id)
        logToFile({ msg: 'userTextbookAccess result', userTextbookAccess, textbookId: decoded.textbookId })
        
        // Instructors have automatic access; students require explicit access (from Clerk or Supabase).
        if (userMetadata?.role === 'admin' || userMetadata?.role === 'instructor' || userTextbookAccess.includes(decoded.textbookId)) {
          logToFile('✅ Private textbook - user has access')
        } else {
          logToFile('❌ Private textbook - user does not have access')
          logToFile({ msg: '👤 User access list:', list: userTextbookAccess })
          const response = NextResponse.json({ hasAccess: false, error: 'Private textbook access denied' })
          return addCorsHeaders(response, origin)
        }
      } else if (textbook.status === 'public') {
        logToFile('✅ Public textbook - access granted')
      }
      
      logToFile('✅ Access granted - all security checks passed')
      const response = NextResponse.json({ 
        hasAccess: true,
        user: { 
          id: decoded.userId, 
          email: decoded.email,
          textbookId: decoded.textbookId
        }
      })
      return addCorsHeaders(response, origin)
      
    } catch (clerkError) {
      console.error('❌ Clerk API error:', clerkError)
      const response = NextResponse.json({ hasAccess: false, error: 'User verification failed' })
      return addCorsHeaders(response, origin)
    }
    
  } catch (error) {
    console.error('❌ Verification error:', error)
    const response = NextResponse.json({ 
      hasAccess: false, 
      error: 'Server error during verification' 
    }, { status: 500 })
    return addCorsHeaders(response, origin)
  }
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin')
  console.log('🔧 CORS preflight request from:', origin)
  
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response, origin)
}
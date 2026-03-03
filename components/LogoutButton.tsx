// FILE LOCATION: textbook-hub/components/LogoutButton.tsx
// Production-ready logout for AWS deployment

'use client'
import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'

export default function LogoutButton({ className = "" }: { className?: string }) {
  const { signOut } = useClerk()

  const handleLogout = async () => {
    try {
      console.log('🚪 Starting production logout process...')
      
      // Step 1: Server-side logout to invalidate tokens
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
        
        const response = await fetch('/api/auth/logout', { 
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          console.log('✅ Server-side logout successful')
        } else {
          console.warn('⚠️ Server logout failed, continuing with client cleanup')
        }
      } catch (apiError: unknown) {
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError)
        const isAbortError = apiError instanceof Error && apiError.name === 'AbortError'
        
        if (isAbortError) {
          console.warn('⏰ Logout API timeout, continuing...')
        } else {
          console.warn('⚠️ Logout API error:', errorMessage)
        }
      }
      
      // Step 2: Comprehensive client-side cleanup
      try {
        // Clear all cookies for current domain and potential subdomains
        const hostname = window.location.hostname
        const domain = hostname.startsWith('www.') ? hostname.substring(4) : hostname
        
        document.cookie.split(";").forEach(function(c) { 
          const eqPos = c.indexOf("=")
          const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim()
          
          if (name) {
            // Clear for root path
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
            
            // Clear for current domain
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${hostname}`
            
            // Clear for parent domain (for subdomains)
            if (hostname !== 'localhost' && domain !== hostname) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${domain}`
            }
            
            // Clear for localhost (development)
            if (hostname === 'localhost') {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=localhost`
            }
          }
        })
        
        // Clear all storage
        if (typeof Storage !== 'undefined') {
          localStorage.clear()
          sessionStorage.clear()
        }
        
        console.log('🧹 Comprehensive client-side cleanup completed')
      } catch (storageError: unknown) {
        const errorMessage = storageError instanceof Error ? storageError.message : String(storageError)
        console.warn('⚠️ Storage cleanup error:', errorMessage)
      }
      
      // Step 3: Determine redirect URL based on environment
      const getRedirectUrl = () => {
        const origin = window.location.origin
        
        // For production: use full origin
        if (origin.includes('https://')) {
          return origin + '/'
        }
        
        // For development: use localhost
        return 'http://localhost:3000/'
      }
      
      const redirectUrl = getRedirectUrl()
      console.log('🔄 Redirecting to:', redirectUrl)
      
      // Step 4: Force redirect with replace (prevents back button issues)
      window.location.replace(redirectUrl)
      
      // No Clerk signOut call - we handle everything manually to avoid POST conflicts
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Critical logout error:', errorMessage)
      
      // Ultimate fallback: Force redirect to home
      const fallbackUrl = window.location.origin + '/'
      console.log('🚨 Emergency redirect to:', fallbackUrl)
      window.location.replace(fallbackUrl)
    }
  }

  return (
    <button
      onClick={handleLogout}
      className={`flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors ${className}`}
      aria-label="Logout from Medhavi Hub"
    >
      <LogOut className="h-4 w-4" />
      <span>Logout</span>
    </button>
  )
}
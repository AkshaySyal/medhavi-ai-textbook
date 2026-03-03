"""
Textbook Protection Script
Automatically adds authentication protection to selected Fumadocs textbooks
"""

import subprocess
import os
import sys
import json
from pathlib import Path

def run_command(command, cwd=None, check=True):
    """Run a shell command"""
    try:
        result = subprocess.run(command, cwd=cwd, shell=True, text=True, 
                              capture_output=True, check=check)
        if result.stdout:
            print(result.stdout.strip())
        return result
    except subprocess.CalledProcessError as e:
        if check:
            print(f"❌ Command failed: {command}")
            print(f"Error: {e.stderr}")
            sys.exit(1)
        return e

def find_textbook_projects():
    """Find all Fumadocs textbook projects based on folder structure"""
    # Get the current directory
    current_dir = Path.cwd()
    
    textbook_projects = []
    
    print("🔍 Scanning for textbook projects...")
    print(f"📁 Looking in: {current_dir}")
    
    # List all directories in the current folder
    for item in current_dir.iterdir():
        if item.is_dir() and item.name not in ['Automation', 'textbook-hub', 'node_modules', '.git', '__pycache__', '.next', 'out']:
            # Check for required folders: app, content, lib
            has_app = (item / "app").is_dir()
            has_content = (item / "content").is_dir()
            has_lib = (item / "lib").is_dir()
            
            # Check if content has docs subfolder
            has_docs = False
            if has_content:
                has_docs = (item / "content" / "docs").is_dir()
            
            # This is a textbook if it has all required folders
            if has_app and has_content and has_lib and has_docs:
                print(f"   ✅ Found textbook: {item.name}")
                
                # Check if already protected
                middleware_exists = (item / "middleware.ts").exists()
                protected_layout_exists = (item / "components" / "ProtectedLayout.tsx").exists()
                
                textbook_projects.append({
                    'name': item.name,
                    'path': item,
                    'protected': middleware_exists and protected_layout_exists,
                    'has_app': has_app,
                    'has_content': has_content,
                    'has_lib': has_lib,
                    'has_docs': has_docs
                })
            else:
                # Debug info for folders that don't qualify
                if has_app or has_content or has_lib:
                    missing = []
                    if not has_app: missing.append("app")
                    if not has_content: missing.append("content")
                    if not has_lib: missing.append("lib")
                    if not has_docs: missing.append("content/docs")
                    if missing:
                        print(f"   ⚠️  Skipping {item.name} - missing: {', '.join(missing)}")
    
    return textbook_projects

def display_textbooks(textbooks):
    """Display available textbooks"""
    print("\n📚 Available Textbooks:")
    print("=" * 60)
    
    if not textbooks:
        print("❌ No textbook projects found!")
        print("\n📝 A textbook must have:")
        print("   - app/ folder")
        print("   - content/ folder")
        print("   - lib/ folder") 
        print("   - content/docs/ subfolder")
        return False
    
    print(f"Found {len(textbooks)} textbook(s):\n")
    
    for i, textbook in enumerate(textbooks, 1):
        status = "✅ Protected" if textbook['protected'] else "❌ Not Protected"
        icon = "🔒" if textbook['protected'] else "🔓"
        print(f"{i:2d}. {icon} {textbook['name']:<30} [{status}]")
    
    return True

def select_textbooks(textbooks):
    """Let user select which textbooks to protect"""
    unprotected = [tb for tb in textbooks if not tb['protected']]
    
    if not unprotected:
        print("\n✅ All textbooks are already protected!")
        return []
    
    print(f"\n📋 Found {len(unprotected)} unprotected textbook(s)")
    print("Select textbooks to protect:")
    print("  - Enter numbers separated by commas (e.g., 1,3,5)")
    print("  - Enter 'all' to protect all unprotected textbooks")
    print("  - Enter 'q' to quit")
    
    while True:
        selection = input("\n👉 Your selection: ").strip().lower()
        
        if selection == 'q':
            return []
        
        if selection == 'all':
            return unprotected
        
        try:
            indices = [int(x.strip()) - 1 for x in selection.split(',') if x.strip()]
            selected = []
            
            for idx in indices:
                if 0 <= idx < len(textbooks):
                    textbook = textbooks[idx]
                    if textbook['protected']:
                        print(f"⚠️  {textbook['name']} is already protected, skipping...")
                    else:
                        selected.append(textbook)
                else:
                    print(f"❌ Invalid selection: {idx + 1}")
            
            if selected:
                print(f"\n✅ Selected {len(selected)} textbook(s) for protection:")
                for tb in selected:
                    print(f"   - {tb['name']}")
                
                confirm = input("\n🤔 Proceed with protection? (y/n): ").lower()
                if confirm == 'y':
                    return selected
            
        except ValueError:
            print("❌ Invalid input. Please enter numbers separated by commas.")

def get_auth_hub_url():
    """Get the auth hub URL from user"""
    print("\n🌐 Auth Hub Configuration:")
    print("Enter your auth hub URL (press Enter for default: http://localhost:3000)")
    
    url = input("Auth Hub URL: ").strip()
    if not url:
        url = "http://localhost:3000"
    
    # Remove trailing slash if present
    url = url.rstrip('/')
    
    print(f"✅ Using auth hub: {url}")
    return url

def protect_textbook(textbook, auth_hub_url):
    """Add protection to a single textbook"""
    print(f"\n🛡️ Protecting {textbook['name']}...")
    
    textbook_path = textbook['path']
    
    # Create middleware.ts with fixed TypeScript error handling
    middleware_content = f'''import {{ NextResponse }} from 'next/server'
import type {{ NextRequest }} from 'next/server'

// Environment-aware configuration
const getAuthHubUrl = () => {{
  if (process.env.NODE_ENV === 'production') {{
    return process.env.NEXT_PUBLIC_AUTH_HUB_URL || process.env.AUTH_HUB_URL
  }}
  return process.env.NEXT_PUBLIC_AUTH_HUB_URL || '{auth_hub_url}'
}}

const AUTH_HUB_URL = getAuthHubUrl()

export async function middleware(request: NextRequest) {{
  console.log('🔍 Textbook Middleware called for:', request.nextUrl.pathname)
  
  // Skip API routes, static files, and assets
  if (
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon') ||
    request.nextUrl.pathname.match(/\\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {{
    console.log('✅ Skipping middleware for static/API route')
    return NextResponse.next()
  }}

  if (!AUTH_HUB_URL) {{
    console.error('❌ AUTH_HUB_URL not configured!')
    return new NextResponse('Authentication service not configured', {{ status: 500 }})
  }}

  try {{
    const textbookUrl = `${{request.nextUrl.protocol}}//${{request.nextUrl.host}}`
    console.log('🌐 Textbook URL:', textbookUrl)
    console.log('🏠 Auth Hub URL:', AUTH_HUB_URL)
    
    // Check for access token in URL first
    const accessToken = request.nextUrl.searchParams.get('access_token')
    
    if (accessToken) {{
      console.log('🔑 Access token found in URL, verifying...')
      
      try {{
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        const verifyResponse = await fetch(`${{AUTH_HUB_URL}}/api/access/verify`, {{
          method: 'POST',
          headers: {{ 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': textbookUrl
          }},
          body: JSON.stringify({{ 
            token: accessToken, 
            textbookUrl: textbookUrl
          }}),
          signal: controller.signal
        }})
        
        clearTimeout(timeoutId)
        
        if (!verifyResponse.ok) {{
          console.error('❌ Verify request failed:', verifyResponse.status)
          const errorText = await verifyResponse.text()
          console.error('Error response:', errorText)
          throw new Error(`Verify request failed: ${{verifyResponse.status}}`)
        }}
        
        const result = await verifyResponse.json()
        console.log('🔍 Verification result:', result)
        
        if (result.hasAccess) {{
          console.log('✅ Access granted via token, setting session cookie')
          
          // Set session cookie and redirect to clean URL
          const cleanUrl = new URL(request.nextUrl.pathname + request.nextUrl.search.replace(/[?&]access_token=[^&]*/, ''), request.url)
          cleanUrl.search = cleanUrl.search.replace(/^&/, '?').replace(/[?&]$/, '')
          
          const response = NextResponse.redirect(cleanUrl)
          
          // Set secure session cookie
          response.cookies.set('textbook_session', accessToken, {{ 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 24 hours
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/'
          }})
          
          return response
        }} else {{
          console.log('❌ Access denied via token:', result.error || 'Unknown reason')
          const redirectUrl = `${{AUTH_HUB_URL}}/dashboard?error=access_denied&textbook_url=${{encodeURIComponent(textbookUrl)}}`
          return NextResponse.redirect(redirectUrl)
        }}
      }} catch (fetchError: unknown) {{
        console.error('❌ Error verifying token:', fetchError)
        
        // TypeScript-safe error handling
        const isAbortError = fetchError instanceof Error && fetchError.name === 'AbortError'
        
        if (isAbortError) {{
          console.error('⏰ Verification timeout')
        }}
        
        const redirectUrl = `${{AUTH_HUB_URL}}/dashboard?error=verification_failed&textbook_url=${{encodeURIComponent(textbookUrl)}}`
        return NextResponse.redirect(redirectUrl)
      }}
    }}

    // Check existing session cookie
    const sessionToken = request.cookies.get('textbook_session')?.value
    
    if (sessionToken) {{
      console.log('🍪 Session cookie found, verifying...')
      
      try {{
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout for session check
        
        const verifyResponse = await fetch(`${{AUTH_HUB_URL}}/api/access/verify`, {{
          method: 'POST',
          headers: {{ 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': textbookUrl
          }},
          body: JSON.stringify({{ 
            token: sessionToken, 
            textbookUrl: textbookUrl
          }}),
          signal: controller.signal
        }})
        
        clearTimeout(timeoutId)
        
        if (!verifyResponse.ok) {{
          console.error('❌ Session verify request failed:', verifyResponse.status)
          const response = NextResponse.redirect(`${{AUTH_HUB_URL}}/dashboard?error=session_verify_failed`)
          response.cookies.delete('textbook_session')
          return response
        }}
        
        const result = await verifyResponse.json()
        console.log('🔍 Session verification result:', result)
        
        if (result.hasAccess) {{
          console.log('✅ Access granted via session cookie')
          return NextResponse.next()
        }} else {{
          console.log('❌ Session expired or invalid:', result.error || 'Unknown reason')
          const response = NextResponse.redirect(`${{AUTH_HUB_URL}}/dashboard?error=session_expired`)
          response.cookies.delete('textbook_session')
          return response
        }}
      }} catch (fetchError: unknown) {{
        console.error('❌ Error verifying session:', fetchError)
        
        // TypeScript-safe error handling
        const isAbortError = fetchError instanceof Error && fetchError.name === 'AbortError'
        
        if (isAbortError) {{
          console.error('⏰ Session verification timeout')
        }}
        
        const response = NextResponse.redirect(`${{AUTH_HUB_URL}}/dashboard?error=session_check_failed`)
        response.cookies.delete('textbook_session')
        return response
      }}
    }}

    // No valid access - redirect to auth hub
    console.log('🚫 No valid access, redirecting to auth hub')
    const redirectUrl = `${{AUTH_HUB_URL}}/dashboard?blocked_url=${{encodeURIComponent(request.url)}}`
    return NextResponse.redirect(redirectUrl)

  }} catch (error: unknown) {{
    console.error('❌ Authentication middleware error:', error)
    
    // Clear any cookies on error and redirect
    const response = NextResponse.redirect(`${{AUTH_HUB_URL}}/dashboard?error=middleware_error`)
    response.cookies.delete('textbook_session')
    return response
  }}
}}

export const config = {{
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api routes
     * 2. /_next (Next.js internals)  
     * 3. Static files (images, css, js, fonts, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}}'''
    
    # Create ProtectedLayout component
    protected_layout = f'''\'use client\'
import {{ useEffect, useState }} from 'react'
import {{ LogOut, Shield, Home }} from 'lucide-react'

interface ProtectedLayoutProps {{
  children: React.ReactNode
}}

export default function ProtectedLayout({{ children }}: ProtectedLayoutProps) {{
  const [user, setUser] = useState<{{ email: string }} | null>(null)

  useEffect(() => {{
    // Check if we have a valid session
    const checkSession = async () => {{
      const sessionToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('textbook_session='))
        ?.split('=')[1]
      
      if (sessionToken) {{
        setUser({{ email: 'Authenticated User' }})
      }}
    }}
    
    checkSession()
  }}, [])

  const handleLogout = async () => {{
    try {{
      await fetch('/api/auth/logout', {{ method: 'POST' }})
      document.cookie = 'textbook_session=; Max-Age=0; path=/'
      window.location.href = '{auth_hub_url}/dashboard'
    }} catch (error) {{
      console.error('Logout failed:', error)
      window.location.href = '{auth_hub_url}/dashboard'
    }}
  }}

  const goToDashboard = () => {{
    window.location.href = '{auth_hub_url}/dashboard'
  }}

  return (
    <div className="min-h-screen">
      {{/* Authentication Status Bar */}}
      <div className="bg-blue-600 text-white px-4 py-2 text-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Protected Textbook</span>
          </div>
          <div className="flex items-center space-x-4">
            {{user && <span>Welcome!</span>}}
            <button
              onClick={{goToDashboard}}
              className="flex items-center space-x-1 hover:text-blue-200 transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Hub</span>
            </button>
            <button
              onClick={{handleLogout}}
              className="flex items-center space-x-1 hover:text-blue-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      
      {{/* Main Content */}}
      {{children}}
    </div>
  )
}}'''
    
    # Create logout API route
    logout_api = '''import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('textbook_session')
  return response
}
'''
    
    # Update app/layout.tsx to include ProtectedLayout
    layout_update = f"""import './global.css';
import {{ RootProvider }} from 'fumadocs-ui/provider';
import {{ DocsLayout }} from 'fumadocs-ui/layouts/docs';
import {{ Inter }} from 'next/font/google';
import type {{ ReactNode }} from 'react';
import {{ baseOptions }} from '@/app/layout.config';
import {{ source }} from '@/lib/source';
import ProtectedLayout from '@/components/ProtectedLayout';

const inter = Inter({{
  subsets: ['latin'],
}});

export default function Layout({{ children }}: {{ children: ReactNode }}) {{
  return (
    <html lang="en" className={{inter.className}} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <ProtectedLayout>
            <DocsLayout tree={{source.pageTree}} {{...baseOptions}}>
              {{children}}
            </DocsLayout>
          </ProtectedLayout>
        </RootProvider>
      </body>
    </html>
  );
}}
"""
    
    # Write all files
    files = [
        (textbook_path / "middleware.ts", middleware_content),
        (textbook_path / "components" / "ProtectedLayout.tsx", protected_layout),
        (textbook_path / "app" / "api" / "auth" / "logout" / "route.ts", logout_api),
        (textbook_path / "app" / "layout.tsx", layout_update)
    ]
    
    for file_path, content in files:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(str(file_path), 'w') as f:
            f.write(content)
        print(f"   ✅ Created/Updated {file_path.name}")
    
    # Update .env.local
    env_path = textbook_path / ".env.local"
    env_content = ""
    
    if env_path.exists():
        with open(env_path, 'r') as f:
            env_content = f.read()
    
    if 'NEXT_PUBLIC_AUTH_HUB_URL' not in env_content:
        env_content += f"\n# Authentication Hub URL\n"
        env_content += f"NEXT_PUBLIC_AUTH_HUB_URL={auth_hub_url}\n"
        
        with open(env_path, 'w') as f:
            f.write(env_content)
        
        print("   ✅ Updated .env.local")
    
    print(f"✅ {textbook['name']} is now protected!")

def main():
    print("🛡️ Textbook Protection Tool")
    print("=" * 50)
    print("Adds authentication to your Fumadocs textbooks")
    
    # Find all textbook projects
    textbooks = find_textbook_projects()
    
    if not display_textbooks(textbooks):
        sys.exit(1)
    
    # Let user select textbooks
    selected = select_textbooks(textbooks)
    
    if not selected:
        print("👋 No textbooks selected. Goodbye!")
        sys.exit(0)
    
    # Get auth hub URL
    auth_hub_url = get_auth_hub_url()
    
    # Protect selected textbooks
    print(f"\n🚀 Protecting {len(selected)} textbook(s)...")
    
    for textbook in selected:
        protect_textbook(textbook, auth_hub_url)
    
    print("\n" + "=" * 50)
    print("🎉 PROTECTION COMPLETE!")
    print("=" * 50)
    
    print(f"\n📋 Protected textbooks:")
    for textbook in selected:
        print(f"   ✅ {textbook['name']}")
    
    print(f"\n🚀 Next Steps:")
    print(f"1. Start your auth hub: cd textbook-hub && npm run dev")
    print(f"2. Start a protected textbook: cd [textbook-name] && npm run dev")
    print(f"3. Add textbook to auth hub admin panel")
    print(f"4. Test access control")
    
    print(f"\n💡 Remember to add each textbook to the auth hub:")
    print(f"   - URL: http://localhost:3001 (or your textbook's port)")
    print(f"   - Status: public/private/hidden")

if __name__ == "__main__":
    main()
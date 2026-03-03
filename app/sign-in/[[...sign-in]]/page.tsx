import { SignIn } from '@clerk/nextjs'
import { Book, GraduationCap, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/background.png')`,
        }}
      />
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40" />
      
      {/* Content - Compact Centered */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          
          {/* Compact Header - Closer to Form */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                <Book className="h-6 w-6 text-white" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
              Medhavi Hub
            </h1>
            <p className="text-blue-100 text-sm drop-shadow">
              Your Learning Portal
            </p>
          </div>
          
          {/* Clerk Sign-In Component */}
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium',
                card: 'shadow-2xl rounded-2xl bg-white border-0',
                headerTitle: 'text-xl font-bold text-gray-900',
                headerSubtitle: 'text-gray-600 text-sm',
                socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50 rounded-lg font-medium',
                formFieldInput: 'border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg',
                footerActionLink: 'text-blue-600 hover:text-blue-700 font-medium',
                formFieldLabel: 'text-gray-700 font-medium text-sm',
                dividerLine: 'bg-gray-300',
                dividerText: 'text-gray-500 text-sm',
              },
              variables: {
                colorPrimary: '#2563eb',
                colorText: '#111827',
                colorTextSecondary: '#6b7280',
                borderRadius: '0.75rem',
                spacingUnit: '0.75rem', // Tighter spacing
              }
            }}
            afterSignInUrl="/api/users/check-role"
            signUpUrl="/sign-up"
          />
          
          {/* Compact Back Link */}
          <div className="text-center mt-4">
            <Link
              href="/"
              className="inline-flex items-center space-x-1 text-blue-200 hover:text-white transition-colors drop-shadow text-sm"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to Home</span>
            </Link>
          </div>
          
        </div>
      </div>
    </div>
  )
}
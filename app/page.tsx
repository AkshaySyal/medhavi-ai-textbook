import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Book, GraduationCap, Users, ArrowRight } from 'lucide-react'

export default async function HomePage() {
  const { userId } = await auth()
  
  if (userId) {
    redirect('/dashboard')
  }
  
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/background.png')`,
        }}
      />
      
      {/* Dark Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo/Icon */}
          <div className="flex items-center justify-center space-x-3 mb-8">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl">
              <GraduationCap className="h-12 w-12 text-white" />
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl">
              <Book className="h-12 w-12 text-white" />
            </div>
          </div>
          
          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
            Medhavi Hub
          </h1>
          
          <p className="text-xl md:text-2xl text-blue-100 mb-4 drop-shadow">
            Access Your Textbooks
          </p>
          
          <p className="text-lg text-blue-200 mb-12 max-w-2xl mx-auto drop-shadow">
            Sign in to access your course materials and textbooks securely
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Link
              href="/sign-in"
              className="group px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <span className="font-semibold">Go to Login</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <Link
              href="/sign-up"
              className="px-8 py-4 bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl hover:bg-white/30 transition-all duration-200 text-center font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Create Account
            </Link>
          </div>
          
          {/* Student-Focused Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <Book className="h-8 w-8 text-blue-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Your Textbooks</h3>
              <p className="text-blue-200 text-sm">Access all your assigned course materials in one place</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <GraduationCap className="h-8 w-8 text-purple-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Easy Access</h3>
              <p className="text-blue-200 text-sm">Sign in once and access all your authorized textbooks</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <Users className="h-8 w-8 text-indigo-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Request Access</h3>
              <p className="text-blue-200 text-sm">Request access to additional course materials as needed</p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
          <p className="text-blue-300 text-sm drop-shadow">
            © 2025 Medhavi Hub. Your Learning Portal.
          </p>
        </div>
      </div>
    </div>
  )
}
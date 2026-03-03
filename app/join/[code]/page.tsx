'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { GraduationCap, AlertCircle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'

// We need to unwrap params in Next.js 15
export default function JoinClassPage({ params }: { params: Promise<{ code: string }> }) {
    const router = useRouter()
    const { isLoaded, isSignedIn } = useUser()
    const [code, setCode] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [classInfo, setClassInfo] = useState<{ name: string, instructorName: string } | null>(null)

    useEffect(() => {
        if (!isLoaded) return

        if (!isSignedIn) {
            // Wait for code to be unwrapped first so we can redirect them back here
            params.then(p => {
                const returnUrl = encodeURIComponent(`/join/${p.code}`)
                router.push(`/sign-in?redirect_url=${returnUrl}`)
            })
            return
        }

        // Unwrap the params promise for authenticated users
        params.then(p => {
            setCode(p.code)
            fetchInviteDetails(p.code)
        })
    }, [params, isLoaded, isSignedIn, router])

    const fetchInviteDetails = async (inviteCode: string) => {
        try {
            const res = await fetch(`/api/classes/invites/${inviteCode}`)
            if (!res.ok) {
                throw new Error('This invite link is invalid, expired, or has reached its capacity.')
            }
            const data = await res.json()
            setClassInfo(data)
        } catch (err: any) {
            setError(err.message || 'Failed to load invite details')
        } finally {
            setLoading(false)
        }
    }

    const handleJoin = async () => {
        setJoining(true)
        setError(null)
        try {
            const res = await fetch('/api/classes/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to join class')
            }

            setSuccess(`Successfully enrolled in ${data.className}!`)

            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push('/dashboard')
            }, 2000)
        } catch (err: any) {
            setError(err.message)
            setJoining(false)
        }
    }

    if (loading || !isLoaded || !isSignedIn) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" />
                    <h2 className="text-lg font-medium text-gray-900">
                        {!isLoaded || !isSignedIn ? 'Redirecting to login...' : 'Validating Invitation...'}
                    </h2>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 px-6 py-8 text-center">
                    <div className="bg-white/20 p-3 rounded-full inline-flex mb-4">
                        <GraduationCap className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Class Invitation</h1>
                    <p className="text-blue-100 mt-2">You have been invited to join a class on Medhavi Hub</p>
                </div>

                {/* Content */}
                <div className="p-8">
                    {error && !success ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <div className="flex items-start">
                                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                                <div>
                                    <h3 className="text-sm font-medium text-red-800">Cannot Join Class</h3>
                                    <p className="text-sm text-red-700 mt-1">{error}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="mt-4 w-full text-center text-sm font-medium text-red-800 hover:text-red-900"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    ) : success ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-green-900 mb-1">Success!</h3>
                            <p className="text-green-700">{success}</p>
                            <p className="text-sm text-green-600 mt-4 flex items-center justify-center">
                                Redirecting you to dashboard <Loader2 className="animate-spin h-3 w-3 ml-2" />
                            </p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">{classInfo?.name || 'Loading Class...'}</h2>
                                {classInfo?.instructorName && (
                                    <p className="text-gray-600 mb-4 text-sm flex items-center justify-center">
                                        Instructed by <span className="font-semibold text-gray-900 ml-1">{classInfo.instructorName}</span>
                                    </p>
                                )}
                                <div className="bg-blue-50 text-blue-800 text-sm px-4 py-2 rounded-md inline-block">
                                    Joining this class will automatically grant you access to all its assigned textbooks.
                                </div>
                            </div>

                            <button
                                onClick={handleJoin}
                                disabled={joining}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-md font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed transition-colors"
                            >
                                {joining ? (
                                    <>
                                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        Accept Invitation
                                        <ChevronRight className="h-5 w-5 ml-2" />
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => router.push('/dashboard')}
                                className="mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Cancel and return to dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

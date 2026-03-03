'use client'

import { useMemo, useState } from 'react'

type RoleChoice = 'student' | 'instructor'

export default function OnboardingForm({
  initial,
}: {
  initial: { role: RoleChoice; institution: string; courseName?: string; courseInstructor?: string }
}) {
  const [role, setRole] = useState<RoleChoice>(initial.role)
  const [institution, setInstitution] = useState(initial.institution || '')
  const [courseName, setCourseName] = useState(initial.courseName || '')
  const [courseInstructor, setCourseInstructor] = useState(initial.courseInstructor || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    if (submitting) return false
    if (institution.trim().length <= 1) return false
    if (role === 'student') {
      if (courseName.trim().length <= 1) return false
      if (courseInstructor.trim().length <= 1) return false
    }
    return true
  }, [courseInstructor, courseName, institution, role, submitting])

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const resp = await fetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          institution: institution.trim(),
          courseName: role === 'student' ? courseName.trim() : '',
          courseInstructor: role === 'student' ? courseInstructor.trim() : '',
        }),
      })

      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setError(json?.error || 'Failed to save profile')
        return
      }

      window.location.href = '/dashboard'
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700">Are you a</label>
        <div className="mt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`px-4 py-2 rounded-lg border text-sm font-medium ${
              role === 'student' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-900 border-gray-300'
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setRole('instructor')}
            className={`px-4 py-2 rounded-lg border text-sm font-medium ${
              role === 'instructor'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          >
            Instructor
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Your institution</label>
        <input
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="e.g. Northeastern University"
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
        />
        <p className="text-xs text-gray-500 mt-2">
          This is stored in your Clerk profile metadata and can be used for reporting and access policy later.
        </p>
      </div>

      {role === 'student' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Course name</label>
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. Physics Volume 1 Mechanics"
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Course instructor</label>
            <input
              value={courseInstructor}
              onChange={(e) => setCourseInstructor(e.target.value)}
              placeholder="e.g. Prof. Thomas Kelley"
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <p className="text-xs text-gray-500">
            Students must provide course details for tracking and support. Instructors do not need to enter these.
          </p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
      >
        {submitting ? 'Saving...' : 'Continue'}
      </button>
    </div>
  )
}



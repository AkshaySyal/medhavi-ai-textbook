'use client'

import { useEffect, useRef } from 'react'

type SessionTrackingOptions = {
  platform?: string
  metadata?: Record<string, unknown>
  enabled?: boolean
}

const SESSION_ENDPOINT = '/api/analytics/session'

export function useSessionTracking({
  platform = 'hub',
  metadata,
  enabled = true
}: SessionTrackingOptions) {
  const sessionIdRef = useRef<string | null>(null)
  const endingRef = useRef(false)
  const metadataSignature = JSON.stringify(metadata || {})

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const startSession = async () => {
      try {
        const res = await fetch(SESSION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', platform, metadata })
        })
        if (!res.ok) {
          console.warn('Failed to start session tracking')
          return
        }
        const data = await res.json()
        if (!cancelled) {
          sessionIdRef.current = data.sessionId
        }
      } catch (error) {
        console.error('Session tracking start error', error)
      }
    }

    const endSession = async (reason: string) => {
      if (endingRef.current) return
      const sessionId = sessionIdRef.current
      if (!sessionId) return
      endingRef.current = true

      const payload = JSON.stringify({
        action: 'end',
        sessionId,
        platform,
        metadata: { ...metadata, reason }
      })

      const url = `${window.location.origin}${SESSION_ENDPOINT}`
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([payload], { type: 'application/json' })
          navigator.sendBeacon(url, blob)
        } catch (error) {
          console.error('sendBeacon failed, falling back to fetch', error)
          await fetch(SESSION_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          })
        }
      } else {
        await fetch(SESSION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        })
      }

      sessionIdRef.current = null
      endingRef.current = false
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void endSession('hidden')
      } else if (!sessionIdRef.current) {
        void startSession()
      }
    }

    const handleBeforeUnload = () => {
      void endSession('unload')
    }

    void startSession()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      void endSession('unmount')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, metadataSignature, enabled])
}


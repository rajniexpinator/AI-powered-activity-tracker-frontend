import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'

/** Same cadence as Chat page detail poll; list poll for new shared logs app-wide */
const POLL_ACTIVITY_LIST_MS = 22000

export type SharedLogsNotifyContextValue = {
  highlightSharedIds: ReadonlySet<string>
  /** Pass an activity id to clear that highlight, or omit to clear all */
  clearSharedLogHighlight: (activityId?: string) => void
}

const SharedLogsNotifyContext = createContext<SharedLogsNotifyContextValue | null>(null)

export function SharedLogsNotifyProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const lastIdsRef = useRef<Set<string> | null>(null)
  const [highlightIds, setHighlightIds] = useState<Set<string>>(() => new Set())

  const clearSharedLogHighlight = useCallback((activityId?: string) => {
    setHighlightIds((prev) => {
      if (activityId == null) return new Set()
      if (!prev.has(activityId)) return prev
      const next = new Set(prev)
      next.delete(activityId)
      return next
    })
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) {
      lastIdsRef.current = null
      setHighlightIds(new Set())
      return
    }

    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const { activities } = await api.activities.list({ limit: 20 })
        const ids = new Set(activities.map((a) => a._id))
        if (lastIdsRef.current === null) {
          lastIdsRef.current = ids
          return
        }
        const newcomers = activities.filter(
          (a) => !lastIdsRef.current!.has(a._id) && a.isOwner === false
        )
        lastIdsRef.current = ids
        if (newcomers.length > 0) {
          const one = newcomers[0]
          toast.info(
            newcomers.length === 1
              ? `New log shared with you — ${one.customer || one.summary || 'open AI logs'}`
              : `${newcomers.length} new shared logs — check AI logs`
          )
          setHighlightIds((prev) => {
            const next = new Set(prev)
            newcomers.forEach((a) => next.add(a._id))
            return next
          })
        }
      } catch {
        /* ignore */
      }
    }

    void poll()
    const intervalId = window.setInterval(() => void poll(), POLL_ACTIVITY_LIST_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user, loading])

  const value = useMemo(
    () => ({
      highlightSharedIds: highlightIds,
      clearSharedLogHighlight,
    }),
    [highlightIds, clearSharedLogHighlight]
  )

  return <SharedLogsNotifyContext.Provider value={value}>{children}</SharedLogsNotifyContext.Provider>
}

export function useSharedLogsNotify(): SharedLogsNotifyContextValue {
  const v = useContext(SharedLogsNotifyContext)
  if (!v) {
    return {
      highlightSharedIds: new Set(),
      clearSharedLogHighlight: () => {},
    }
  }
  return v
}

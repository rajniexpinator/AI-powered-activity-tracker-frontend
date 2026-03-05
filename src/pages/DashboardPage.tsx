import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Users, BarChart3, Clock, ArrowRight } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { AdminShell } from '@/components/layout/AdminShell'

type ActivitySummary = { _id: string; customer?: string; summary?: string; createdAt: string }

export function DashboardPage() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { activities } = await api.activities.list(5)
        setActivities(activities)
      } catch {
        // ignore errors; dashboard still renders
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const isAdmin = user?.role === 'admin'

  return (
    <AdminShell>
      <main className="py-1 sm:py-0">
            {/* Top greeting + quick stats */}
            <section className="mb-6 sm:mb-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777] mb-1">Dashboard</p>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111]">
                    Welcome back{user?.name ? `, ${user.name}` : ''}.
                  </h1>
                  <p className="mt-2 text-sm sm:text-[15px] text-[#666] max-w-xl">
                    View today&apos;s AI logs, jump into chat, and manage your team in one place.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 min-w-[220px] max-w-sm">
                  <div className="rounded-xl bg-white border border-[var(--color-border)] px-3.5 py-3">
                    <p className="text-[11px] font-medium text-[#777] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Today
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[#111]">
                      {activities.length > 0 ? activities.length : '—'}
                    </p>
                    <p className="text-[11px] text-[#777]">Recent logs</p>
                  </div>
                  <div className="rounded-xl bg-white border border-[var(--color-border)] px-3.5 py-3">
                    <p className="text-[11px] font-medium text-[#777] flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5" />
                      Phase
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[#111]">3</p>
                    <p className="text-[11px] text-[#777]">AI Chat Logging</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Main grid: quick actions + recent logs */}
            <section className="grid gap-4 md:grid-cols-[minmax(0,_1.3fr)_minmax(0,_1fr)]">
              {/* Quick actions */}
              <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-[#111] mb-1 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--color-primary)]" />
                  Quick actions
                </h2>
                <p className="text-[13px] text-[#777] mb-4">
                  Start a new AI log or jump to admin tools.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    to="/chat"
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-3 no-underline hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/40 transition-colors"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-[#111] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        New AI log
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#777]">Describe an issue or walk and save it.</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--color-primary)]" />
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/users"
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 no-underline hover:bg-white hover:border-[var(--color-primary)]/30 transition-colors"
                    >
                      <div>
                        <p className="text-[13px] font-semibold text-[#111] flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                          Manage employees
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#777]">Invite team members and update roles.</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--color-primary)]" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Recent logs */}
              <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-4 sm:p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-[#111] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
                    Recent logs
                  </h2>
                  <Link
                    to="/chat"
                    className="text-[11px] font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap"
                  >
                    Open AI log
                  </Link>
                </div>
                <p className="text-[12px] text-[#777] mb-3">
                  Latest activity entries you or your team captured.
                </p>
                <div className="flex-1 max-h-64 overflow-auto divide-y divide-[var(--color-border)]">
                  {loading ? (
                    <div className="py-3 text-[12px] text-[#777]">Loading recent logs…</div>
                  ) : activities.length === 0 ? (
                    <div className="py-4 text-[12px] text-[#777]">
                      No recent logs yet. Start by creating a new AI log.
                    </div>
                  ) : (
                    activities.map((a) => (
                      <div key={a._id} className="py-2.5">
                        <p className="text-[11px] font-medium text-[#999] mb-0.5">
                          {a.customer || 'Unknown customer'} · {new Date(a.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-[#222] line-clamp-2">{a.summary || 'No summary'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </main>
      </AdminShell>
  )
}


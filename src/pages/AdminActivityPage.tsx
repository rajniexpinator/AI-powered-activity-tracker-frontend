import { useEffect, useMemo, useState } from 'react'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import type { User } from '@/types/auth'
import { AdminShell } from '@/components/layout/AdminShell'
import { BarChart3, Filter, Users, Building2, Calendar, FileText, AlertCircle } from 'lucide-react'

type AdminActivity = {
  _id: string
  customer?: string
  summary?: string
  createdAt: string
  userId?: { _id: string; name?: string; email?: string; role?: string }
}

export function AdminActivityPage() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<AdminActivity[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [customers, setCustomers] = useState<{ _id: string; name: string }[]>([])

  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [report, setReport] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Default to last 7 days
  useEffect(() => {
    const now = new Date()
    const weekAgo = new Date()
    weekAgo.setDate(now.getDate() - 7)
    setFrom(weekAgo.toISOString().slice(0, 10))
    setTo(now.toISOString().slice(0, 10))
  }, [])

  // Load employees and customers for filters
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [{ users }, { customers }] = await Promise.all([
          api.auth.getUsers(),
          api.customers.list(),
        ])
        const employees = users.filter((u) => u.role === 'employee' || u.role === 'supervisor')
        setUsers(employees)
        setCustomers(customers.map((c) => ({ _id: c._id, name: c.name })))
      } catch {
        // non-blocking for page
      }
    }
    void loadFilterData()
  }, [])

  const appliedFilters = useMemo(
    () => ({
      userId: selectedUserId !== 'all' ? selectedUserId : undefined,
      customer: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      from: from || undefined,
      to: to || undefined,
      limit: 200,
    }),
    [selectedUserId, selectedCustomer, from, to]
  )

  async function loadActivities() {
    setLoading(true)
    setError('')
    try {
      const { activities } = await api.activities.adminList(appliedFilters)
      setActivities(activities)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault()
    await loadActivities()
  }

  async function handleGenerateReport() {
    setLoadingReport(true)
    setError('')
    setReport('')
    try {
      const { report } = await api.activities.generateWeeklyReport(appliedFilters)
      setReport(report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate weekly report')
    } finally {
      setLoadingReport(false)
    }
  }

  return (
    <AdminShell>
      <main className="py-1 sm:py-0">
        <section className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-[28px] md:text-[32px] font-bold tracking-tight text-[var(--color-text)] flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                </span>
                Activity overview
              </h1>
              <p className="mt-2 text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] max-w-xl">
                View all AI-logged activities across employees and generate weekly quality reports for suppliers.
              </p>
            </div>
            {user && (
              <p className="text-[12px] text-[var(--color-text-secondary)]">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
            )}
          </div>
        </section>

        {/* Filters + report CTA */}
        <section className="mb-5 rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_4px_24px_rgba(15,23,42,0.06)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--color-primary)]" />
              Filters
            </h2>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={loadingReport}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-3.5 py-2 text-[13px] font-semibold !text-white disabled:opacity-60"
            >
              <FileText className="w-4 h-4" />
              {loadingReport ? 'Generating report…' : 'Generate weekly AI report'}
            </button>
          </div>
          <form
            onSubmit={handleApplyFilters}
            className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 items-end"
          >
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                Employee
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                  <Users className="w-3.5 h-3.5" />
                </span>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                >
                  <option value="all">All employees</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                Customer
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                  <Building2 className="w-3.5 h-3.5" />
                </span>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                >
                  <option value="all">All customers</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                From date
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                  <Calendar className="w-3.5 h-3.5" />
                </span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                To date
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                  <Calendar className="w-3.5 h-3.5" />
                </span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-[13px] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                />
              </div>
            </div>

            <div className="sm:col-span-2 md:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-3.5 py-2 text-[13px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-60"
              >
                {loading ? 'Loading…' : 'Apply filters'}
              </button>
            </div>
          </form>
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </section>

        {/* Activity table + weekly report */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,_1.4fr)_minmax(0,_1fr)]">
          {/* Activity table */}
          <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_4px_24px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
                <h2 className="text-[15px] font-semibold text-[var(--color-text)]">All employee activity</h2>
              </div>
              <p className="text-[12px] text-[var(--color-text-secondary)]">
                {activities.length} log{activities.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="hidden md:grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,2.2fr)] px-5 sm:px-6 md:px-8 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)] bg-[var(--color-bg)]">
              <span>Employee</span>
              <span>Customer</span>
              <span>Date</span>
              <span>Summary</span>
            </div>

            <div className="divide-y divide-[var(--color-border)] max-h-[480px] overflow-auto">
              {loading && activities.length === 0 ? (
                <div className="px-5 sm:px-6 md:px-8 py-6 text-[13px] text-[var(--color-text-secondary)]">
                  Loading activity…
                </div>
              ) : activities.length === 0 ? (
                <div className="px-5 sm:px-6 md:px-8 py-10 text-center text-[13px] text-[var(--color-text-secondary)]">
                  No activity found for the selected filters.
                </div>
              ) : (
                activities.map((a) => (
                  <div
                    key={a._id}
                    className="px-5 sm:px-6 md:px-8 py-3.5 flex flex-col gap-2 md:grid md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,2.2fr)] md:items-center"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[12px] font-semibold">
                        {(a.userId?.name || a.userId?.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--color-text)] truncate">
                          {a.userId?.name || a.userId?.email || 'Unknown user'}
                        </p>
                        {a.userId?.email && (
                          <p className="text-[11px] text-[var(--color-text-secondary)] truncate md:hidden">
                            {a.userId.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)] truncate">
                      {a.customer || '—'}
                    </p>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                    <p className="text-[13px] text-[var(--color-text)] line-clamp-2 md:line-clamp-3">
                      {a.summary || 'No summary'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Weekly AI report */}
          <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_4px_24px_rgba(15,23,42,0.06)] p-4 sm:p-5 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                Weekly quality report
              </h2>
            </div>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-3">
              AI-generated summary of the filtered activity logs. Use it as a starting point for
              supplier or management updates.
            </p>
            <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-3 text-[13px] text-[var(--color-text)] overflow-auto whitespace-pre-wrap">
              {loadingReport && !report
                ? 'Generating weekly report…'
                : report || 'Click "Generate weekly AI report" above to create a summary.'}
            </div>
          </div>
        </section>
      </main>
    </AdminShell>
  )
}


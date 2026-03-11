import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { Mail, User as UserIcon, Plus, AlertCircle, Trash2 } from 'lucide-react'
import { api } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { useAuth } from '@/context/AuthContext'

type Customer = {
  _id: string
  name: string
  email?: string
  notes?: string
  createdAt: string
  createdBy?: { _id: string; name?: string; email?: string; role?: string }
}

export function CustomersPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const load = async () => {
      setError('')
      try {
        const { customers } = await api.customers.list()
        setCustomers(customers)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load customers')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setSaving(true)
    try {
      const { customer } = await api.customers.create({
        name: name.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      setCustomers((prev) => [customer, ...prev])
      setName('')
      setEmail('')
      setNotes('')
      toast.success('Customer added successfully.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add customer'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCustomer(id: string) {
    if (!isAdmin) return
    setDeletingId(id)
    setError('')
    try {
      await api.customers.delete(id)
      setCustomers((prev) => prev.filter((c) => c._id !== id))
      toast.success('Customer deleted successfully.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete customer'
      setError(msg)
      toast.error(msg)
    } finally {
      setDeletingId(null)
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
                  <UserIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </span>
                Customers
              </h1>
              <p className="mt-2 text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] max-w-md">
                Keep a simple list of customer contacts you interact with in the plant.
              </p>
            </div>
          </div>
        </section>

        {/* Layout differs for admin vs employee to avoid empty space */}
        {isAdmin ? (
          <section className="mt-2">
            <div className="rounded-2xl bg-white border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.08)] overflow-hidden">
              <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-[var(--color-primary)]" />
                  <h2 className="text-[15px] font-semibold text-[var(--color-text)]">All customers</h2>
                </div>
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  {customers.length} customer{customers.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
                {loading ? (
                  <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 text-[13px] text-[var(--color-text-secondary)]">
                    Loading customers…
                  </div>
                ) : customers.length === 0 ? (
                  <div className="px-4 sm:px-6 md:px-8 py-10 sm:py-12 text-center text-[13px] text-[var(--color-text-secondary)]">
                    No customers yet.
                  </div>
                ) : (
                  <>
                    {/* Mobile/tablet: card layout (< lg) */}
                    <div className="divide-y divide-[var(--color-border)] md:hidden">
                      {customers.map((c) => (
                        <div
                          key={c._id}
                          className="px-4 sm:px-6 py-4 hover:bg-[var(--color-bg)]/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[14px] font-semibold">
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-medium text-[var(--color-text)]">{c.name}</p>
                                {c.email && (
                                  <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)] truncate">
                                    {c.email}
                                  </p>
                                )}
                                {c.notes && (
                                  <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)] line-clamp-2">
                                    {c.notes}
                                  </p>
                                )}
                                {c.createdBy && (
                                  <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]/80">
                                    Added by: {c.createdBy.name || c.createdBy.email || c.createdBy.role || '-'}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(c._id)}
                                disabled={deletingId === c._id}
                                className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 border border-red-100 disabled:opacity-60"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {deletingId === c._id ? '…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop: table layout (lg+) */}
                    <table className="hidden md:table w-full min-w-[720px] table-auto">
                      <thead className="sticky top-0 z-10 bg-[var(--color-bg)]">
                        <tr>
                          <th className="whitespace-nowrap px-4 lg:px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                            Name
                          </th>
                          <th className="whitespace-nowrap px-4 lg:px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                            Email
                          </th>
                          <th className="whitespace-nowrap px-4 lg:px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                            Notes
                          </th>
                          <th className="whitespace-nowrap px-4 lg:px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                            Added by
                          </th>
                          <th className="whitespace-nowrap px-4 lg:px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {customers.map((c) => (
                          <tr key={c._id} className="hover:bg-[var(--color-bg)]/50 transition-colors">
                            <td className="px-4 lg:px-6 py-3 align-middle">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[13px] font-semibold">
                                  {c.name.charAt(0).toUpperCase()}
                                </span>
                                <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{c.name}</p>
                              </div>
                            </td>
                            <td className="px-4 lg:px-6 py-3 align-middle">
                              <span className="truncate block max-w-[180px] text-[13px] text-[var(--color-text-secondary)]">
                                {c.email || '-'}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-3 align-middle">
                              <span className="truncate block max-w-[200px] text-[12px] text-[var(--color-text-secondary)]">
                                {c.notes || '-'}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-3 align-middle">
                              <span className="truncate block max-w-[130px] text-[12px] text-[var(--color-text-secondary)]">
                                {c.createdBy?.name || c.createdBy?.email || c.createdBy?.role || '-'}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-3 align-middle text-right whitespace-nowrap">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomer(c._id)}
                                  disabled={deletingId === c._id}
                                  className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 border border-red-100 disabled:opacity-60"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {deletingId === c._id ? '…' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-[minmax(0,_1.1fr)_minmax(0,_1.2fr)]">
            {/* Add customer form - employees can add */}
            <div className="rounded-2xl bg-white border border-[var(--color-border)] shadow-[0_4px_24px_rgba(15,23,42,0.06)] p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-[var(--color-text)] mb-1 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[var(--color-primary)]" />
                Add customer
              </h2>
              <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">
                Store the supplier name, email, and optional notes (e.g. plant focus, typical issues).
              </p>
              {error && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] opacity-60" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Bosch, Inoac, etc."
                      className="w-full pl-9 pr-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[14px] placeholder:text-[var(--color-text-secondary)]/70 focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Email <span className="font-normal normal-case text-[var(--color-text-secondary)]/80">(optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] opacity-60" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@customer.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[14px] placeholder:text-[var(--color-text-secondary)]/70 focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Notes <span className="font-normal normal-case text-[var(--color-text-secondary)]/80">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Plant, commodity, or any context you want to remember."
                    className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[#222] placeholder:text-[var(--color-text-secondary)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[14px] font-semibold !text-white disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Add customer'}
                </button>
              </form>
            </div>

            {/* Customers list (same card, without admin-only columns) */}
            <div className="rounded-2xl bg-white border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.08)] overflow-hidden">
              <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-[var(--color-primary)]" />
                  <h2 className="text-[15px] font-semibold text-[var(--color-text)]">All customers</h2>
                </div>
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  {customers.length} customer{customers.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="divide-y divide-[var(--color-border)] max-h-[420px] overflow-auto">
                {loading ? (
                  <div className="px-5 sm:px-6 md:px-8 py-6 text-[13px] text-[var(--color-text-secondary)]">
                    Loading customers…
                  </div>
                ) : customers.length === 0 ? (
                  <div className="px-5 sm:px-6 md:px-8 py-10 text-center text-[13px] text-[var(--color-text-secondary)]">
                    No customers yet. Add your first customer using the form on the left.
                  </div>
                ) : (
                  customers.map((c) => (
                    <div key={c._id} className="px-5 sm:px-6 md:px-8 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[13px] font-semibold">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-[var(--color-text)] truncate">{c.name}</p>
                          {c.email && (
                            <p className="text-[12px] text-[var(--color-text-secondary)] truncate">{c.email}</p>
                          )}
                          <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]/80">
                            Added by: {c.createdBy?.name || c.createdBy?.email || '-'}
                          </p>
                        </div>
                      </div>
                      {c.notes && (
                        <p className="hidden sm:block text-[12px] text-[var(--color-text-secondary)] max-w-xs truncate">
                          {c.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </AdminShell>
  )
}


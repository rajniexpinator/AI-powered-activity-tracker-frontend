import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { Mail, User as UserIcon, Plus, AlertCircle, Trash2, Pencil, X, Search, SlidersHorizontal } from 'lucide-react'
import { api } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { useAuth } from '@/context/AuthContext'

const PAGE_SIZE = 5

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
  const isEmployee = user?.role === 'employee'
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [emailFilter, setEmailFilter] = useState<'all' | 'with' | 'without'>('all')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [updating, setUpdating] = useState(false)

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

  useEffect(() => {
    if (showAddModal || editing) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showAddModal, editing])

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)

      const hasEmail = Boolean(c.email && c.email.trim())
      const matchesEmail =
        emailFilter === 'all' || (emailFilter === 'with' ? hasEmail : !hasEmail)

      return matchesSearch && matchesEmail
    })
  }, [customers, search, emailFilter])

  useEffect(() => {
    setPage(1)
  }, [search, emailFilter])

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredCustomers.slice(start, start + PAGE_SIZE)
  }, [filteredCustomers, page])

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin || !name.trim()) return
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
      setShowAddModal(false)
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

  function openEdit(c: Customer) {
    if (!isAdmin) return
    setEditing(c)
    setEditName(c.name || '')
    setEditEmail(c.email || '')
    setEditNotes(c.notes || '')
  }

  function closeEdit() {
    setEditing(null)
    setEditName('')
    setEditEmail('')
    setEditNotes('')
  }

  function closeAddModal() {
    setShowAddModal(false)
    setName('')
    setEmail('')
    setNotes('')
  }

  async function handleUpdateCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin || !editing || !editName.trim()) return
    setUpdating(true)
    setError('')
    try {
      const { customer } = await api.customers.update(editing._id, {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        notes: editNotes.trim() || undefined,
      })
      setCustomers((prev) => prev.map((c) => (c._id === customer._id ? customer : c)))
      toast.success('Customer updated.')
      closeEdit()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update customer'
      setError(msg)
      toast.error(msg)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <AdminShell>
      <main className="py-1 sm:py-0">
        {editing && (
          <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white border border-[var(--color-border)] shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                    Edit customer
                  </p>
                  <p className="text-[14px] font-semibold text-[var(--color-text)] truncate">{editing.name}</p>
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleUpdateCustomer} className="p-5 space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[14px] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[14px] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[#222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="inline-flex items-center justify-center h-10 rounded-xl border border-[var(--color-border)] px-4 text-[13px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="inline-flex items-center justify-center h-10 rounded-xl bg-[var(--color-primary)] px-4 text-[13px] font-semibold !text-white disabled:opacity-60"
                  >
                    {updating ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddModal && isAdmin && (
          <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white border border-[var(--color-border)] shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                    New customer
                  </p>
                  <p className="text-[14px] font-semibold text-[var(--color-text)]">
                    Add customer details
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAddCustomer} className="p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                      Customer name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Bosch"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="team@customer.com"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Plant, context, internal note"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-[14px] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="inline-flex items-center justify-center h-10 rounded-xl border border-[var(--color-border)] px-4 text-[13px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center h-10 rounded-xl bg-[var(--color-primary)] px-4 text-[13px] font-semibold !text-white disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Add customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section className="mb-6 sm:mb-8">
          <div className="rounded-2xl border border-[var(--color-primary)]/15 bg-gradient-to-r from-[var(--color-primary)]/10 via-white to-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl sm:text-[28px] md:text-[32px] font-bold tracking-tight text-[var(--color-text)] flex items-center gap-3">
                  <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                    <UserIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </span>
                  Customers
                </h1>
                <p className="mt-2 text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] max-w-2xl">
                  {isAdmin
                    ? 'Manage customer directory for your internal activity and reporting workflow.'
                    : 'Read-only customer directory for activity logging.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-[var(--color-primary)] px-4 text-[13px] font-semibold !text-white hover:bg-[var(--color-primary-hover)] shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add customer
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by customer name or email"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-white pl-9 pr-3 py-2.5 text-[14px] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                />
              </div>
              <div className="relative">
                <SlidersHorizontal className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <select
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value as 'all' | 'with' | 'without')}
                  className="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-white pl-9 pr-3 py-2.5 text-[14px] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                >
                  <option value="all">All emails</option>
                  <option value="with">With email</option>
                  <option value="without">Without email</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <section className="rounded-2xl bg-white border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.08)] overflow-hidden">
          <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--color-text)]">All customers</h2>
            <p className="text-[12px] text-[var(--color-text-secondary)]">
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <div className="max-h-[520px] overflow-auto">
            {loading ? (
              <div className="px-5 sm:px-6 md:px-8 py-6 text-[13px] text-[var(--color-text-secondary)]">Loading customers…</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="px-5 sm:px-6 md:px-8 py-10 text-center text-[13px] text-[var(--color-text-secondary)]">No customers match your filters.</div>
            ) : (
              <>
                <div className="divide-y divide-[var(--color-border)] md:hidden">
                  {paginatedCustomers.map((c) => (
                    <div key={c._id} className="px-4 py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[var(--color-text)] truncate">{c.name}</p>
                          <p className="text-[12px] text-[var(--color-text-secondary)] break-all">{c.email || '-'}</p>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEdit(c)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] border border-[var(--color-border)]"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(c._id)}
                              disabled={deletingId === c._id}
                              className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 border border-red-100 disabled:opacity-60"
                            >
                              <Trash2 className="w-3 h-3" />
                              {deletingId === c._id ? '…' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                      {!isEmployee && (
                        <div className="rounded-lg bg-[var(--color-bg)] px-2.5 py-2">
                          <p className="text-[11px] text-[var(--color-text-secondary)]">
                            <span className="font-semibold">Notes:</span> {c.notes || '-'}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                            <span className="font-semibold">Added by:</span>{' '}
                            {c.createdBy?.name || c.createdBy?.email || c.createdBy?.role || '-'}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <table className="hidden md:table w-full table-auto">
                  <thead className="sticky top-0 z-10 bg-[var(--color-bg)]">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Name</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Email</th>
                      {!isEmployee && (
                        <>
                          <th className="px-4 lg:px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Notes</th>
                          <th className="px-4 lg:px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Added by</th>
                        </>
                      )}
                      {isAdmin && (
                        <th className="px-4 lg:px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {paginatedCustomers.map((c) => (
                      <tr key={c._id} className="hover:bg-[var(--color-bg)]/50 transition-colors">
                        <td className="px-4 lg:px-6 py-3 text-[14px] font-medium text-[var(--color-text)]">{c.name}</td>
                        <td className="px-4 lg:px-6 py-3 text-[13px] text-[var(--color-text-secondary)]">{c.email || '-'}</td>
                        {!isEmployee && (
                          <>
                            <td className="px-4 lg:px-6 py-3 text-[12px] text-[var(--color-text-secondary)]">{c.notes || '-'}</td>
                            <td className="px-4 lg:px-6 py-3 text-[12px] text-[var(--color-text-secondary)]">
                              {c.createdBy?.name || c.createdBy?.email || c.createdBy?.role || '-'}
                            </td>
                          </>
                        )}
                        {isAdmin && (
                          <td className="px-4 lg:px-6 py-3 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(c)}
                                className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] border border-[var(--color-border)]"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
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
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          {!loading && filteredCustomers.length > 0 && (
            <div className="border-t border-[var(--color-border)] px-5 sm:px-6 md:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-[var(--color-bg)]/60">
              <p className="text-[12px] text-[var(--color-text-secondary)]">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredCustomers.length)} of {filteredCustomers.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center justify-center h-8 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-medium text-[var(--color-text)] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-[12px] text-[var(--color-text-secondary)]">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center justify-center h-8 rounded-lg border border-[var(--color-border)] px-3 text-[12px] font-medium text-[var(--color-text)] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </AdminShell>
  )
}


import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ArrowLeft, Users, UserPlus, UserCircle, Shield, AlertCircle, Loader2, CheckCircle, XCircle, Mail, User as UserIcon, Lock, X } from 'lucide-react'
import type { User } from '@/types/auth'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { AdminShell } from '@/components/layout/AdminShell'

const ROLES: User['role'][] = ['admin', 'employee']

const ROLE_STYLES: Record<User['role'], string> = {
  admin: 'bg-[var(--color-primary)] !text-white',
  employee: 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]',
}

export function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<User['role']>('employee')
  const [showAddModal, setShowAddModal] = useState(false)

  const loadUsers = useCallback(async () => {
    setError('')
    try {
      const { users: list } = await api.auth.getUsers()
      setUsers(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (showAddModal) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [showAddModal])

  function closeAddModal() {
    setShowAddModal(false)
    setNewEmail('')
    setNewPassword('')
    setNewName('')
    setNewRole('employee')
    setError('')
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim() || !newPassword) return
    setError('')
    setAdding(true)
    try {
      await api.auth.register(newEmail.trim(), newPassword, newName.trim() || undefined, newRole)
      closeAddModal()
      await loadUsers()
      toast.success('User added successfully.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add user'
      setError(msg)
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  async function handleUpdateRole(userId: string, role: User['role']) {
    setError('')
    try {
      const { user: updated } = await api.auth.updateUser(userId, { role })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      toast.success('Role updated successfully.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update role'
      setError(msg)
      toast.error(msg)
    }
  }

  async function handleToggleActive(user: User) {
    setError('')
    try {
      const { user: updated } = await api.auth.updateUser(user.id, {
        isActive: !user.isActive,
      })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  return (
    <AdminShell>
      {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
              <p className="mt-4 text-[15px] text-[var(--color-text-secondary)]">Loading users…</p>
            </div>
          ) : (
            <>
              {/* Page header */}
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
                <div>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-primary)] hover:underline mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                  </Link>
                  <h1 className="text-2xl sm:text-[28px] md:text-[32px] font-bold tracking-tight text-[var(--color-text)] flex items-center gap-3">
                    <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                    </span>
                    User management
                  </h1>
                  <p className="mt-2 text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] max-w-md">
                    Add users and manage roles and access for your team.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-6 sm:py-3.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:ring-2 hover:ring-[var(--color-primary)]/50 hover:ring-offset-2 transition-all text-[14px] sm:text-[15px] font-semibold rounded-xl !text-white shadow-[0_4px_14px_rgba(63,75,157,0.25)]"
                >
                  <UserPlus className="w-5 h-5" />
                  Add user
                </button>
              </div>

      {/* Error banner */}
      {error && !showAddModal ? (
        <div
          className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[14px]"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      ) : null}

              {/* Users table card */}
              <section className="bg-white rounded-2xl border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.08)] overflow-hidden">
                <div className="px-5 sm:px-6 md:px-8 py-5 sm:py-6 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5 text-[var(--color-primary)]" />
                    <h2 className="text-lg sm:text-[19px] font-semibold text-[var(--color-text)]">All users</h2>
                  </div>
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    {users.length} user{users.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-[var(--color-bg)]">
                        <th className="px-5 sm:px-6 md:px-8 py-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-5 sm:px-6 md:px-8 py-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-5 sm:px-6 md:px-8 py-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-5 sm:px-6 md:px-8 py-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 sm:px-6 md:px-8 py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-[var(--color-text-secondary)]">
                      <span className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-bg)]">
                        <Users className="w-7 h-7 text-[var(--color-primary)]/50" />
                      </span>
                      <p className="text-[15px] font-medium text-[var(--color-text)]">No users yet</p>
                      <p className="text-[14px] max-w-sm">Add your first user using the button above.</p>
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white text-[14px] font-medium rounded-xl hover:bg-[var(--color-primary-hover)]"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add user
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--color-bg)]/60 transition-colors">
                    <td className="px-5 sm:px-6 md:px-8 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] shrink-0">
                          <Mail className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--color-text)] text-[14px] sm:text-[15px] truncate">
                            {u.email}
                          </p>
                          <p className="text-[13px] text-[var(--color-text-secondary)]">{u.name || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 sm:px-6 md:px-8 py-4">
                      {u.id === currentUser?.id ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium ${ROLE_STYLES[u.role]}`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          {u.role}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as User['role'])}
                          className="text-[13px] border border-[var(--color-border)] rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-5 sm:px-6 md:px-8 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium ${
                          u.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {u.isActive !== false ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {u.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 sm:px-6 md:px-8 py-4 text-right">
                      {u.id === currentUser?.id ? (
                        <span className="text-[13px] text-[var(--color-text-secondary)]">You</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          className="text-[14px] font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {u.isActive !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
                    </tbody>
                  </table>
                </div>
              </section>

      {/* Add User Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeAddModal}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <h2 id="add-user-title" className="text-lg font-semibold text-[var(--color-text)] flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <UserPlus className="w-4 h-4" />
                </span>
                Add new user
              </h2>
              <button
                type="button"
                onClick={closeAddModal}
                className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text)] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleAddUser} className="p-6 space-y-5">
              {error ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[13px]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              ) : null}

              <div>
                <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] opacity-60" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[15px] placeholder:text-[var(--color-text-secondary)]/70 focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] opacity-60" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[15px] placeholder:text-[var(--color-text-secondary)]/70 focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Name <span className="font-normal normal-case text-[var(--color-text-secondary)]/80">(optional)</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] opacity-60" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Display name"
                    className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[15px] placeholder:text-[var(--color-text-secondary)]/70 focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as User['role'])}
                  className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[15px] focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] font-medium text-[15px] hover:bg-[var(--color-bg)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 rounded-xl text-[15px] font-semibold !text-white transition-colors"
                >
                  {adding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Add user
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
            </>
          )}
    </AdminShell>
  )
}

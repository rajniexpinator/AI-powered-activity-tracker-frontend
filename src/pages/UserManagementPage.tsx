import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users, UserPlus, UserCircle, Shield, AlertCircle, Loader2, CheckCircle, XCircle, Mail } from 'lucide-react'
import type { User } from '@/types/auth'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

const ROLES: User['role'][] = ['admin', 'supervisor', 'employee']

const ROLE_STYLES: Record<User['role'], string> = {
  admin: 'bg-[var(--color-primary)] !text-white',
  supervisor: 'bg-[var(--color-primary)]/80 !text-white',
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
  const [showAddForm, setShowAddForm] = useState(false)

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

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim() || !newPassword) return
    setError('')
    setAdding(true)
    try {
      await api.auth.register(newEmail.trim(), newPassword, newName.trim() || undefined, newRole)
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setNewRole('employee')
      setShowAddForm(false)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user')
    } finally {
      setAdding(false)
    }
  }

  async function handleUpdateRole(userId: string, role: User['role']) {
    setError('')
    try {
      const { user: updated } = await api.auth.updateUser(userId, { role })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
        <p className="mt-4 text-[15px] text-[var(--color-text-secondary)]">Loading users…</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-[15px] font-medium text-[var(--color-primary)] hover:underline mb-4">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-tight text-[var(--color-text)] flex items-center gap-3">
            <Users className="w-8 h-8 text-[var(--color-primary)]" />
            User management
          </h1>
          <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
            Add users and manage roles and access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors text-[15px] font-medium rounded-[var(--radius)] !text-white"
        >
          <UserPlus className="w-5 h-5" />
          {showAddForm ? 'Cancel' : 'Add user'}
        </button>
      </div>

      {error ? (
        <div className="mb-8 flex items-center gap-3 p-4 rounded-[var(--radius)] bg-red-50/80 border border-red-100 text-red-700 text-[15px]" role="alert">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {showAddForm ? (
        <section className="mb-12 p-8 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]">
          <h2 className="text-[19px] font-semibold text-[var(--color-text)] mb-5 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[var(--color-primary)]" />
            Add new user
          </h2>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[15px] placeholder:text-[var(--color-text-secondary)]/70"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[15px] placeholder:text-[var(--color-text-secondary)]/70"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[15px] placeholder:text-[var(--color-text-secondary)]/70"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as User['role'])}
                className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[15px]"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={adding}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors text-[15px] font-medium rounded-[var(--radius)] !text-white"
              >
                {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                {adding ? 'Adding…' : 'Add user'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-[19px] font-semibold text-[var(--color-text)]">All users</h2>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-[var(--color-bg)]">
                <th className="px-6 md:px-8 py-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 md:px-8 py-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 md:px-8 py-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 md:px-8 py-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 md:px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)] text-[15px]">
                      <Users className="w-12 h-12 opacity-30" />
                      <span>No users yet. Add one above.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--color-bg)]/50 transition-colors">
                    <td className="px-6 md:px-8 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                          <Mail className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="font-medium text-[var(--color-text)] text-[15px]">{u.email}</p>
                          <p className="text-[13px] text-[var(--color-text-secondary)]">{u.name || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-4">
                      {u.id === currentUser?.id ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] text-[13px] font-medium ${ROLE_STYLES[u.role]}`}>
                          <Shield className="w-3.5 h-3.5" />
                          {u.role}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as User['role'])}
                          className="text-[13px] border border-[var(--color-border)] rounded-[var(--radius)] px-3 py-2 bg-[var(--color-surface)]"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-6 md:px-8 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] text-[13px] font-medium ${
                          u.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {u.isActive !== false ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {u.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 md:px-8 py-4 text-right">
                      {u.id === currentUser?.id ? (
                        <span className="text-[13px] text-[var(--color-text-secondary)]">Current user</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          className="text-[15px] font-medium text-[var(--color-primary)] hover:underline"
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
    </div>
  )
}

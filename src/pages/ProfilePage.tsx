import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { User, Mail, Shield, Pencil, X, AlertCircle, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const [searchParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (searchParams.get('edit') === '1') setEditing(true)
  }, [searchParams])
  const [name, setName] = useState(user?.name ?? '')
  useEffect(() => {
    setName(user?.name ?? '')
  }, [user?.name])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const data: { name?: string; currentPassword?: string; newPassword?: string } = {}
      if (name.trim() !== (user?.name ?? '')) data.name = name.trim() || undefined
      if (newPassword) {
        data.currentPassword = currentPassword
        data.newPassword = newPassword
      }
      if (Object.keys(data).length === 0) {
        setEditing(false)
        setSubmitting(false)
        return
      }
      const { user: updated } = await api.auth.updateMe(data)
      setUser(updated)
      setCurrentPassword('')
      setNewPassword('')
      setEditing(false)
      setSuccess('Profile updated successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  function cancelEdit() {
    setName(user?.name ?? '')
    setCurrentPassword('')
    setNewPassword('')
    setError('')
    setEditing(false)
  }

  const initial = (user.name || user.email).charAt(0).toUpperCase()

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] border border-[var(--color-border)] overflow-hidden">
        {/* Profile header */}
        <div className="px-6 py-8 border-b border-[var(--color-border)] bg-black/[0.02]">
          <div className="flex items-center gap-4">
            <span className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-primary)] text-white text-2xl font-semibold">
              {initial}
            </span>
            <div>
              <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
                {user.name || 'Profile'}
              </h1>
              <p className="text-[15px] text-[var(--color-text-secondary)] mt-0.5">{user.email}</p>
              <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[13px] font-medium">
                <Shield className="w-3.5 h-3.5" />
                {user.role}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {success ? (
            <div className="flex items-center gap-3 p-4 rounded-[var(--radius)] bg-green-50/80 border border-green-200 text-green-800 text-[15px] mb-6">
              {success}
            </div>
          ) : null}

          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error ? (
                <div className="flex items-center gap-3 p-4 rounded-[var(--radius)] bg-red-50/80 border border-red-100 text-red-700 text-[15px]" role="alert">
                  <AlertCircle className="w-5 h-5 shrink-0 opacity-80" />
                  {error}
                </div>
              ) : null}
              <div>
                <label htmlFor="profile-name" className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                  Display name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] opacity-60" />
                  <input
                    id="profile-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[17px]"
                    placeholder="Your name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                  Change password (optional)
                </label>
                <div className="space-y-3">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] opacity-60" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[17px]"
                      placeholder="Current password"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] opacity-60" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[17px]"
                      placeholder="New password (min 6 characters)"
                      autoComplete="new-password"
                      minLength={6}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:ring-2 hover:ring-[var(--color-primary)]/50 hover:ring-offset-2 disabled:opacity-50 disabled:hover:ring-0 disabled:hover:ring-offset-0 text-[15px] font-medium rounded-[var(--radius)] !text-white transition-all"
                >
                  {submitting ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-5 py-2.5 text-[15px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-black/[0.04] hover:ring-1 hover:ring-black/5 rounded-[var(--radius)] border border-[var(--color-border)] transition-all"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[var(--color-text-secondary)] opacity-70" />
                  <div>
                    <dt className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">Email</dt>
                    <dd className="text-[16px] text-[var(--color-text)]">{user.email}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-[var(--color-text-secondary)] opacity-70" />
                  <div>
                    <dt className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">Name</dt>
                    <dd className="text-[16px] text-[var(--color-text)]">{user.name || '—'}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-[var(--color-text-secondary)] opacity-70" />
                  <div>
                    <dt className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">Role</dt>
                    <dd className="text-[16px] text-[var(--color-text)] capitalize">{user.role}</dd>
                  </div>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-6 flex items-center gap-2 px-4 py-2.5 text-[15px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-[var(--radius)] transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit profile
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { User, Mail, Shield, Pencil, X, AlertCircle, Lock, Bell, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'

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

  const [notifWhatsAppNumber, setNotifWhatsAppNumber] = useState('')
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifLevels, setNotifLevels] = useState<number[]>([])
  const [notifSubmitting, setNotifSubmitting] = useState(false)
  const [notifError, setNotifError] = useState('')

  useEffect(() => {
    setNotifWhatsAppNumber((user?.whatsAppNumber || '').trim())
    setNotifEnabled(Boolean(user?.whatsAppNotifications?.enabled))
    const raw = user?.whatsAppNotifications?.severityLevels
    setNotifLevels(
      Array.isArray(raw) ? [...new Set(raw.filter((v) => Number.isInteger(v) && v >= 1 && v <= 3))].sort((a, b) => a - b) : []
    )
  }, [user?.whatsAppNumber, user?.whatsAppNotifications?.enabled, user?.whatsAppNotifications?.severityLevels])

  function toggleNotifLevel(level: number) {
    setNotifLevels((prev) => {
      if (prev.includes(level)) return prev.filter((v) => v !== level)
      return [...prev, level].sort((a, b) => a - b)
    })
  }

  async function handleSaveNotifications(e: React.FormEvent) {
    e.preventDefault()
    setNotifError('')
    if (notifEnabled && !notifWhatsAppNumber.trim()) {
      setNotifError('WhatsApp number is required when alerts are enabled.')
      return
    }
    if (notifEnabled && notifLevels.length === 0) {
      setNotifError('Select at least one severity level.')
      return
    }
    setNotifSubmitting(true)
    try {
      const { user: updated } = await api.auth.updateMe({
        whatsAppNumber: notifWhatsAppNumber.trim(),
        whatsAppNotifications: {
          enabled: notifEnabled,
          severityLevels: notifEnabled ? notifLevels : [],
        },
      })
      setUser(updated)
      toast.success('WhatsApp alert settings saved.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save alert settings'
      setNotifError(msg)
      toast.error(msg)
    } finally {
      setNotifSubmitting(false)
    }
  }

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
    <AdminShell>
      <main className="flex-1 min-w-0 py-1 sm:py-0">
        <div className="max-w-xl mx-auto px-4 py-10 space-y-8">
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

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-black/[0.02]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">WhatsApp alerts</h2>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Get notified on WhatsApp when a new AI log is saved with a severity you care about. Same settings admins can
            configure in Users — you can change them here anytime.
          </p>
        </div>
        <form onSubmit={handleSaveNotifications} className="p-6 space-y-4">
          {notifError ? (
            <div className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-red-50/80 border border-red-100 text-red-700 text-[13px]" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {notifError}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-3">
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-text)]">Enable WhatsApp alerts</p>
              <p className="text-[12px] text-[var(--color-text-secondary)]">Turn off to stop all log notifications to your number.</p>
            </div>
            <button
              type="button"
              onClick={() => setNotifEnabled((v) => !v)}
              className={`inline-flex h-7 w-12 rounded-full p-1 transition-colors ${
                notifEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
              }`}
              aria-pressed={notifEnabled}
              aria-label="Toggle WhatsApp alerts"
            >
              <span className={`h-5 w-5 rounded-full bg-white transition-transform ${notifEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div>
            <label htmlFor="profile-whatsapp" className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
              WhatsApp number
            </label>
            <input
              id="profile-whatsapp"
              type="text"
              value={notifWhatsAppNumber}
              onChange={(e) => setNotifWhatsAppNumber(e.target.value)}
              placeholder="+917986729952"
              disabled={!notifEnabled}
              className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[15px] disabled:opacity-60"
            />
          </div>
          <div>
            <span className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
              Severity levels
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { level: 1 as const, label: 'Low' },
                  { level: 2 as const, label: 'Medium' },
                  { level: 3 as const, label: 'High' },
                ] as const
              ).map(({ level, label }) => (
                <button
                  key={level}
                  type="button"
                  disabled={!notifEnabled}
                  onClick={() => toggleNotifLevel(level)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-[var(--radius)] border text-[12px] font-medium transition-colors disabled:opacity-60 ${
                    notifLevels.includes(level)
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">Level {level}</span>
                  <span className="text-[13px]">{label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
              Pick one or more: you only get a WhatsApp when a new log is saved with that issue severity. Employees manage this
              here; admins can still override from Users if needed.
            </p>
          </div>
          <button
            type="submit"
            disabled={notifSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 rounded-[var(--radius)] text-[15px] font-semibold !text-white transition-colors"
          >
            {notifSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save alert settings'
            )}
          </button>
        </form>
      </div>
        </div>
      </main>
    </AdminShell>
  )
}

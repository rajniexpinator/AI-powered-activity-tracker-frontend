import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { User, Mail, Shield, Pencil, X, AlertCircle, Lock, Bell, Loader2, MapPin, Settings2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import { AdminShell } from '@/components/layout/AdminShell'
import { PlantSelector } from '@/components/profile/PlantSelector'
import { ActivityLogShareFields, ReportShareFields } from '@/components/profile/SharePreferencesFields'
import { PLANT_OPTIONS, formatPlantLabel, type PlantOption } from '@/constants/plants'
import {
  DEFAULT_SHARE_PREFERENCES,
  resolveSharePreferences,
  type ActivityLogSharePreferences,
  type ReportSharePreferences,
} from '@/constants/sharePreferences'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const [searchParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (searchParams.get('edit') === '1') setEditing(true)
  }, [searchParams])
  const [name, setName] = useState(user?.name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [assignedPlant, setAssignedPlant] = useState<PlantOption | ''>('')
  const [assignedPlantOther, setAssignedPlantOther] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setName(user?.name ?? '')
  }, [user?.name])

  useEffect(() => {
    const plant = user?.assignedPlant
    setAssignedPlant(plant && PLANT_OPTIONS.includes(plant as PlantOption) ? (plant as PlantOption) : '')
    setAssignedPlantOther(user?.assignedPlantOther ?? '')
  }, [user?.assignedPlant, user?.assignedPlantOther])

  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifLevels, setNotifLevels] = useState<number[]>([])
  const [notifSubmitting, setNotifSubmitting] = useState(false)
  const [notifError, setNotifError] = useState('')

  const [activityLogShare, setActivityLogShare] = useState<ActivityLogSharePreferences>(
    DEFAULT_SHARE_PREFERENCES.activityLog
  )
  const [reportShare, setReportShare] = useState<ReportSharePreferences>(DEFAULT_SHARE_PREFERENCES.report)
  const [prefsSubmitting, setPrefsSubmitting] = useState(false)
  const [prefsError, setPrefsError] = useState('')
  const [prefsSuccess, setPrefsSuccess] = useState('')

  useEffect(() => {
    const resolved = resolveSharePreferences(user?.sharePreferences)
    setActivityLogShare(resolved.activityLog)
    setReportShare(resolved.report)
  }, [user?.sharePreferences])

  useEffect(() => {
    setNotifEnabled(Boolean(user?.emailNotifications?.enabled))
    const raw = user?.emailNotifications?.severityLevels
    setNotifLevels(
      Array.isArray(raw) ? [...new Set(raw.filter((v) => Number.isInteger(v) && v >= 1 && v <= 3))].sort((a, b) => a - b) : []
    )
  }, [user?.emailNotifications?.enabled, user?.emailNotifications?.severityLevels])

  function toggleNotifLevel(level: number) {
    setNotifLevels((prev) => {
      if (prev.includes(level)) return prev.filter((v) => v !== level)
      return [...prev, level].sort((a, b) => a - b)
    })
  }

  async function handleSaveNotifications(e: React.FormEvent) {
    e.preventDefault()
    setNotifError('')
    if (notifEnabled && notifLevels.length === 0) {
      setNotifError('Select at least one severity level.')
      return
    }
    setNotifSubmitting(true)
    try {
      const { user: updated } = await api.auth.updateMe({
        emailNotifications: {
          enabled: notifEnabled,
          severityLevels: notifEnabled ? notifLevels : [],
        },
      })
      setUser(updated)
      toast.success('Email alert settings saved.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save alert settings'
      setNotifError(msg)
      toast.error(msg)
    } finally {
      setNotifSubmitting(false)
    }
  }

  async function handleSaveSharePreferences(e: React.FormEvent) {
    e.preventDefault()
    setPrefsError('')
    setPrefsSuccess('')
    setPrefsSubmitting(true)
    try {
      const { user: updated } = await api.auth.updateMe({
        sharePreferences: {
          activityLog: activityLogShare,
          report: reportShare,
        },
      })
      setUser(updated)
      setPrefsSuccess('Sharing preferences saved.')
      toast.success('Sharing preferences saved.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save sharing preferences'
      setPrefsError(msg)
      toast.error(msg)
    } finally {
      setPrefsSubmitting(false)
    }
  }

  if (!user) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const plantChanged =
      assignedPlant !== (user?.assignedPlant ?? '') ||
      assignedPlantOther.trim() !== (user?.assignedPlantOther ?? '').trim()
    if (assignedPlant === 'Other' && !assignedPlantOther.trim()) {
      setError('Enter a plant name when Other is selected.')
      return
    }
    if (plantChanged && !assignedPlant) {
      setError('Select a reporting plant.')
      return
    }

    setSubmitting(true)
    try {
      const data: {
        name?: string
        currentPassword?: string
        newPassword?: string
        assignedPlant?: string | null
        assignedPlantOther?: string | null
      } = {}
      if (name.trim() !== (user?.name ?? '')) data.name = name.trim() || undefined
      if (newPassword) {
        data.currentPassword = currentPassword
        data.newPassword = newPassword
      }
      if (plantChanged) {
        data.assignedPlant = assignedPlant || null
        data.assignedPlantOther = assignedPlant === 'Other' ? assignedPlantOther.trim() : null
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
    const plant = user?.assignedPlant
    setAssignedPlant(plant && PLANT_OPTIONS.includes(plant as PlantOption) ? (plant as PlantOption) : '')
    setAssignedPlantOther(user?.assignedPlantOther ?? '')
    setError('')
    setEditing(false)
  }

  const reportingPlantLabel = formatPlantLabel(user?.assignedPlant, user?.assignedPlantOther)

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
              <div>
                <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                  Reporting plant / OEM
                </label>
                <PlantSelector
                  value={assignedPlant}
                  otherValue={assignedPlantOther}
                  onChange={setAssignedPlant}
                  onOtherChange={setAssignedPlantOther}
                  idPrefix="profile"
                />
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
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[var(--color-text-secondary)] opacity-70" />
                  <div>
                    <dt className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">Reporting plant</dt>
                    <dd className="text-[16px] text-[var(--color-text)]">{reportingPlantLabel || '—'}</dd>
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
            <Settings2 className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Preferences</h2>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Choose what to include when you share AI logs (email, WhatsApp, team share) and quality reports. Saved for your account.
          </p>
        </div>
        <form onSubmit={handleSaveSharePreferences} className="p-6 space-y-6">
          {prefsError ? (
            <div className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-red-50/80 border border-red-100 text-red-700 text-[13px]" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {prefsError}
            </div>
          ) : null}
          {prefsSuccess ? (
            <div className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-green-50/80 border border-green-200 text-green-800 text-[13px]">
              {prefsSuccess}
            </div>
          ) : null}
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--color-text)] mb-1">AI log sharing</h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-3">
              Checked fields are included when you share or email an activity log.
            </p>
            <ActivityLogShareFields value={activityLogShare} onChange={setActivityLogShare} idPrefix="profile-log" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--color-text)] mb-1">Quality report sharing</h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-3">
              Applies when you share or email a quality report PDF.
            </p>
            <ReportShareFields value={reportShare} onChange={setReportShare} idPrefix="profile-report" />
          </div>
          <button
            type="submit"
            disabled={prefsSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 rounded-[var(--radius)] text-[15px] font-semibold !text-white transition-colors"
          >
            {prefsSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save preferences'
            )}
          </button>
        </form>
      </div>

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-black/[0.02]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Email alerts</h2>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Get an email when a new AI log is saved with a severity you care about. Messages are sent from info@apexquality.net to
            your work email ({user.email}). Admins can also configure this from Users.
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
              <p className="text-[13px] font-semibold text-[var(--color-text)]">Enable email alerts</p>
              <p className="text-[12px] text-[var(--color-text-secondary)]">Turn off to stop email notifications for new logs.</p>
            </div>
            <button
              type="button"
              onClick={() => setNotifEnabled((v) => !v)}
              className={`inline-flex h-7 w-12 rounded-full p-1 transition-colors ${
                notifEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
              }`}
              aria-pressed={notifEnabled}
              aria-label="Toggle email alerts"
            >
              <span className={`h-5 w-5 rounded-full bg-white transition-transform ${notifEnabled ? 'translate-x-5' : ''}`} />
            </button>
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
              Pick one or more: you only get an email when a new log is saved with that issue severity.
            </p>
          </div>
          <div>
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
          </div>
        </form>
      </div>
        </div>
      </main>
    </AdminShell>
  )
}

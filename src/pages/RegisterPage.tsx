import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, AlertCircle } from 'lucide-react'
import { api, setToken } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { token, user } = await api.auth.register(email.trim(), password, name.trim() || undefined)
      setToken(token)
      setUser(user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-[var(--color-bg)]">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-10">
          <h1 className="text-[32px] md:text-[40px] font-semibold tracking-tight text-[var(--color-text)]">
            Create account
          </h1>
          <p className="mt-3 text-[17px] text-[var(--color-text-secondary)]">
            AI Activity Tracker
          </p>
        </div>

        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] p-8 md:p-10 shadow-[var(--shadow-md)] border border-[var(--color-border)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="flex items-center gap-3 p-4 rounded-[var(--radius)] bg-red-50/80 border border-red-100 text-red-700 text-[15px]" role="alert">
                <AlertCircle className="w-5 h-5 shrink-0 opacity-80" />
                {error}
              </div>
            ) : null}
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] opacity-60" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[17px] placeholder:text-[var(--color-text-secondary)]/70"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="name" className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                Name (optional)
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] opacity-60" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[17px] placeholder:text-[var(--color-text-secondary)]/70"
                  placeholder="Your name"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] opacity-60" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] text-[17px] placeholder:text-[var(--color-text-secondary)]/70"
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-all duration-200 text-[17px] font-medium rounded-[var(--radius)] !text-white"
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <div className="mt-6 pt-6 border-t border-[var(--color-border)] text-center">
            <span className="text-[15px] text-[var(--color-text-secondary)]">
              Already have an account?{' '}
            </span>
            <Link to="/login" className="text-[17px] font-medium text-[var(--color-primary)] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

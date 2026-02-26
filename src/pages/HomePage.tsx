import { Link } from 'react-router-dom'
import {
  MessageSquare,
  Database as DatabaseIcon,
  Sparkles,
  Users,
  ArrowRight,
  BarChart3,
  Zap,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80'
const SECTION_IMAGE = 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'

const feature1 = {
  icon: MessageSquare,
  title: 'AI Chat Logging',
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  phase: 'Phase 3',
  color: 'primary',
}
const feature2 = {
  icon: DatabaseIcon,
  title: 'Structured Records',
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.',
  phase: 'Phase 5',
  color: 'primary',
}
const feature3 = {
  icon: Sparkles,
  title: 'Reports & Email',
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse.',
  phase: 'Phase 6–7',
  color: 'accent',
}
const FEATURES = [feature1, feature2, feature3]

export function HomePage() {
  const { user } = useAuth()
  const features = FEATURES

  const benefits = [
    'Lorem ipsum dolor sit amet consectetur',
    'Sed do eiusmod tempor incididunt ut labore',
    'Ut enim ad minim veniam quis nostrud',
    'Duis aute irure dolor in reprehenderit',
    'Excepteur sint occaecat cupidatat non',
  ]

  return (
    <div className="w-full">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-14">
        {/* Hero — elegant, spacious */}
        <section className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-primary)] text-white mb-10 sm:mb-12 md:mb-16">
          <div className="absolute inset-0">
            <img
              src={HERO_IMAGE}
              alt=""
              className="w-full h-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-primary)]/95 to-[#2d3570]/95" />
          </div>
          <div className="relative z-10 px-6 sm:px-8 md:px-14 lg:px-20 py-14 sm:py-20 md:py-28 text-center max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.15]">
              Internal Activity Tracking
            </h1>
            <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-white/90 leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
            </p>
            {user ? (
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <span className="text-white/80 text-xs sm:text-sm text-center sm:text-left">
                  Signed in as <strong className="text-white">{user.email}</strong>
                  <span className="text-white/70"> · {user.role}</span>
                </span>
                {user.role === 'admin' && (
                  <Link
                    to="/users"
                    className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white font-medium rounded-[var(--radius)] hover:bg-white/95 transition-colors no-underline text-sm !text-[#3f4b9d] w-full sm:w-auto"
                  >
                    <Users className="w-4 h-4" />
                    User management
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white font-medium rounded-[var(--radius)] hover:bg-white/95 transition-colors no-underline text-sm !text-[#3f4b9d] w-full sm:w-auto"
                >
                  Get started
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white/10 text-white font-medium rounded-[var(--radius)] border border-white/20 hover:bg-white/20 transition-colors no-underline text-sm w-full sm:w-auto"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Welcome card — when logged in */}
        {user && (
          <section className="mb-12 md:mb-16">
            <div className="rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] p-6 md:p-8 shadow-[var(--shadow-sm)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#111]">
                    Welcome back
                  </h2>
                  <p className="mt-1.5 text-sm text-[#666] max-w-xl">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                  {user.role === 'admin' && (
                    <Link
                      to="/users"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] font-medium rounded-[var(--radius)] hover:bg-[var(--color-primary-hover)] transition-colors no-underline text-sm !text-white"
                    >
                      <Users className="w-4 h-4" />
                      Users
                    </Link>
                  )}
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] text-[#444] font-medium rounded-[var(--radius)] hover:bg-black/[0.03] transition-colors no-underline text-sm"
                  >
                    <BarChart3 className="w-4 h-4" />
                    See features
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Features */}
        <section id="features" className="mb-12 md:mb-16">
          <div className="text-center mb-10">
            <h2 className="text-xl md:text-2xl font-semibold text-[#111] tracking-tight">
              What you can do
            </h2>
            <p className="mt-2 text-sm text-[#666] max-w-md mx-auto">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description, phase, color }) => (
              <div
                key={title}
                className="group rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-black/10 transition-all duration-200"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                    color === 'accent'
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.6} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base font-semibold text-[#111]">
                    {title}
                  </h3>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#888] bg-[#f5f5f5] px-2 py-0.5 rounded">
                    {phase}
                  </span>
                </div>
                <p className="text-sm text-[#666] leading-relaxed">
                  {description}
                </p>
                <p className="mt-3 text-xs font-medium text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Coming soon <ArrowRight className="w-3.5 h-3.5" />
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits — image + list */}
        <section className="mb-12 md:mb-16">
          <div className="rounded-[var(--radius-lg)] overflow-hidden bg-white border border-[var(--color-border)] shadow-[var(--shadow-sm)]">
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[320px]">
                <img
                  src={SECTION_IMAGE}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/90 md:to-white/70" />
              </div>
              <div className="p-6 md:p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    <Zap className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-semibold text-[#111] tracking-tight">
                    Built for manufacturing
                  </h2>
                </div>
                <p className="text-sm text-[#666] mb-5">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
                <ul className="space-y-2.5">
                  {benefits.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-[#444]">
                      <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer strip — light, elegant */}
        <section className="rounded-[var(--radius-lg)] bg-[#f5f5f5] border border-[var(--color-border)] px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[var(--color-border)] text-[#666]">
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-[#333]">Secure by design</p>
                <p className="text-xs text-[#666]">JWT auth · Role-based access · Encrypted</p>
              </div>
            </div>
            <p className="text-xs text-[#888]">
              AI Activity Tracker · Phase 2
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

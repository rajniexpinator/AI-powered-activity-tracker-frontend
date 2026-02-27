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
        {/* Hero — refined dashboard intro */}
        <section className="rounded-[var(--radius-lg)] bg-gradient-to-r from-white via-[#f4f5ff] to-[var(--color-bg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-10 sm:mb-12 md:mb-16">
          <div className="px-6 sm:px-8 md:px-10 lg:px-14 py-10 sm:py-14 md:py-18 text-[#111]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="max-w-3xl">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[#888] mb-3">
                Lorem ipsum · Dashboard overview
              </p>
              <h1 className="text-2xl sm:text-3xl md:text-[32px] lg:text-[36px] font-semibold tracking-tight leading-[1.2] text-[#111]">
                Internal activity
                <span className="block text-[var(--color-primary)]">tracking at a glance</span>
              </h1>
              <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-[#555] max-w-xl leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
                dolore magna aliqua. Ut enim ad minim veniam.
              </p>

                {/* Phase chips row */}
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] sm:text-xs">
                  <span className="inline-flex items-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1">
                    Phase 1–2 · Setup & access
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-3 py-1">
                    Phase 3 · AI chat · design only
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:flex-wrap items-center gap-3">
                  {user ? (
                    <>
                      <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white font-medium rounded-[var(--radius)] hover:bg-white/95 transition-colors no-underline text-sm !text-[#3f4b9d] w-full sm:w-auto"
                      >
                        <BarChart3 className="w-4 h-4" />
                        View dashboard
                      </Link>
                      {user.role === 'admin' && (
                        <Link
                          to="/users"
                          className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white/10 text-white font-medium rounded-[var(--radius)] border border-white/20 hover:bg-white/18 transition-colors no-underline text-sm w-full sm:w-auto"
                        >
                          <Users className="w-4 h-4" />
                          User management
                        </Link>
                      )}
                    </>
                  ) : (
                    <>
                      <Link
                        to="/register"
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white font-medium rounded-[var(--radius)] hover:bg-white/95 transition-colors no-underline text-sm !text-[#3f4b9d] w-full sm:w-auto"
                      >
                        Get started
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      <Link
                        to="/login"
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white/10 text-white font-medium rounded-[var(--radius)] border border-white/20 hover:bg-white/18 transition-colors no-underline text-sm w-full sm:w-auto"
                      >
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Right-side visual card (desktop) */}
              <div className="hidden lg:flex items-center">
                <div className="relative w-80 min-h-[200px] rounded-[28px] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.2)] border border-white/80 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#eef1ff] via-white to-[#fef3f2]" />
                  <div className="relative h-full flex flex-col justify-between p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                          <MessageSquare className="w-5 h-5" />
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-[#111] tracking-tight">
                            Internal activity
                          </p>
                          <p className="text-[11px] text-[#6b7280]">AI chat · dashboard view</p>
                        </div>
                      </div>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#e7f1ff] text-[#2949b6] font-medium">
                        Phase 2
                      </span>
                    </div>
                    <div className="space-y-2 text-[12px]">
                      <div className="flex items-center justify-between text-[#4b5563]">
                        <span>Setup &amp; access</span>
                        <span className="text-[var(--color-primary)] font-semibold">100%</span>
                      </div>
                      <div className="flex items-center justify-between text-[#4b5563]">
                        <span>AI chat (design)</span>
                        <span className="text-[#f97373] font-semibold">In progress</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
                      <span className="flex items-center gap-2 text-[11px] text-[#6b7280]">
                        <Lock className="w-4 h-4" />
                        Role-based access
                      </span>
                      <span className="text-[11px] font-medium text-[var(--color-primary)]">
                        View details →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {title === 'AI Chat Logging' ? 'Phase 3 design ready' : 'Coming soon'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </p>
                  {title === 'AI Chat Logging' && (
                    <Link
                      to="/chat"
                      className="text-[11px] font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap"
                    >
                      Open chat
                    </Link>
                  )}
                </div>
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

        {/* Footer strip — light, placeholder content */}
        <section className="rounded-[var(--radius-lg)] bg-[#f5f5f5] border border-[var(--color-border)] px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[var(--color-border)] text-[#666]">
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-[#333]">Lorem ipsum dolor sit amet</p>
                <p className="text-xs text-[#666]">Consectetur adipiscing elit · Sed do eiusmod tempor</p>
              </div>
            </div>
            <p className="text-xs text-[#888]">
              Lorem ipsum · Placeholder copy
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

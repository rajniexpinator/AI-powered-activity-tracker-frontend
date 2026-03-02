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
  Shield,
  Twitter,
  Linkedin,
  Github,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import logoSrc from '@/assets/ApexLogoFinal_Color.png'

const SECTION_IMAGE = 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'

const feature1 = {
  icon: MessageSquare,
  title: 'AI Chat Logging',
  description: 'Capture every conversation with intelligent logging. Our AI parses context and tags activities automatically so your team stays aligned without manual notes.',
  phase: 'Phase 3',
  color: 'primary',
}
const feature2 = {
  icon: DatabaseIcon,
  title: 'Structured Records',
  description: 'All activities stored in a clean, queryable format. Export reports, filter by project or date, and keep a single source of truth for internal operations.',
  phase: 'Phase 5',
  color: 'primary',
}
const feature3 = {
  icon: Sparkles,
  title: 'Reports & Email',
  description: 'Generate summary reports and send digest emails to stakeholders. Customize templates and schedules so the right people get the right updates.',
  phase: 'Phase 6–7',
  color: 'accent',
}
const FEATURES = [feature1, feature2, feature3]

const stats = [
  { value: '10k+', label: 'Activities logged', icon: BarChart3 },
  { value: '99.9%', label: 'Uptime', icon: Shield },
  { value: '50+', label: 'Teams onboarded', icon: Users },
  { value: '24/7', label: 'Support', icon: Zap },
]

const benefits = [
  'Real-time activity tracking across projects and teams',
  'Role-based access so admins and employees see only what they need',
  'Secure, encrypted storage with regular backups',
  'Integrations with your existing tools and workflows',
  'Dedicated onboarding and training for your organization',
]

/* Footer structure inspired by apple.com: column groups + bottom legal bar */
const footerLinks = {
  product: { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#' }, { label: 'Changelog', href: '#' }, { label: 'API', href: '#' }] },
  company: { title: 'Company', links: [{ label: 'About us', href: '#' }, { label: 'Careers', href: '#' }, { label: 'Contact', href: '#' }, { label: 'Partners', href: '#' }] },
  support: { title: 'Support', links: [{ label: 'Help center', href: '#' }, { label: 'Documentation', href: '#' }, { label: 'Status', href: '#' }, { label: 'Security', href: '#' }] },
  legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Use', href: '#' },
    { label: 'Cookie policy', href: '#' },
  ],
}

export function HomePage() {
  const { user } = useAuth()
  const features = FEATURES

  return (
    <div className="w-full min-h-screen bg-[#f5f6fc] overflow-x-hidden">
      <main className="max-w-6xl mx-auto px-3 sm:px-6 md:px-8 py-5 sm:py-8 md:py-14">
        {/* ——— Hero ——— */}
        <section className="relative rounded-xl sm:rounded-2xl overflow-hidden mb-10 sm:mb-16 md:mb-20 shadow-[0_24px_60px_-12px_rgba(63,75,157,0.35)]">
          <div className="absolute inset-0 bg-[var(--color-primary)]" />
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)`,
              backgroundSize: '32px 32px',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary)] to-[#252d5c]" />
          <div className="absolute top-0 right-0 w-[55%] max-w-lg h-full bg-gradient-to-l from-white/10 to-transparent" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-white/5 blur-3xl -translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/3 right-1/4 w-56 h-56 rounded-full bg-[var(--color-accent)]/15 blur-3xl" />

          <div className="relative px-4 sm:px-8 md:px-12 lg:px-16 py-8 sm:py-14 md:py-20">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 sm:gap-10">
              <div className="min-w-0 max-w-2xl">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-white/75 mb-2 sm:mb-4">
                  AI-Powered Internal Tracker
                </p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] xl:text-[48px] font-bold tracking-tight leading-[1.15] text-white">
                  Track activity.
                  <span className="block mt-0.5 sm:mt-1 text-white/95">Stay in sync.</span>
                </h1>
                <p className="mt-3 sm:mt-5 text-sm sm:text-base md:text-lg text-white/88 max-w-lg leading-relaxed">
                  One place to log, analyze, and report internal activities. Role-based access, AI-assisted summaries, and reports that keep everyone aligned.
                </p>
                <div className="mt-4 sm:mt-5 flex flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs md:text-sm">
                  <span className="inline-flex items-center rounded-full bg-white/20 text-white backdrop-blur-sm px-2.5 sm:px-3.5 py-1.5 sm:py-2 border border-white/25">
                    Phase 1–2 · Live
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[var(--color-accent)]/90 text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 border border-white/20">
                    Phase 3 · AI chat
                  </span>
                </div>
                <div className="mt-4 sm:mt-6 md:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start gap-2 sm:gap-3">
                  {user ? (
                    <>
                      <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white font-semibold rounded-xl hover:bg-gray-100 hover:ring-2 hover:ring-[var(--color-primary)]/40 hover:ring-offset-2 transition-all no-underline text-sm !text-[var(--color-primary)] shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                      >
                        <BarChart3 className="w-4 h-4" />
                        View dashboard
                      </Link>
                      {user.role === 'admin' && (
                        <Link
                          to="/users"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/15 text-white font-medium rounded-xl border-2 border-white/40 hover:bg-white/35 hover:border-white/60 hover:ring-2 hover:ring-white/30 backdrop-blur-sm transition-all no-underline text-sm"
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
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white font-semibold rounded-xl hover:bg-gray-100 hover:ring-2 hover:ring-[var(--color-primary)]/40 hover:ring-offset-2 transition-all no-underline text-sm !text-[var(--color-primary)] shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                      >
                        Get started free
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      <Link
                        to="/login"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/15 text-white font-medium rounded-xl border-2 border-white/40 hover:bg-white/35 hover:border-white/60 hover:ring-2 hover:ring-white/30 backdrop-blur-sm transition-all no-underline text-sm"
                      >
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div className="hidden lg:flex items-center shrink-0">
                <div className="relative w-[320px] min-h-[220px] rounded-2xl bg-white/15 backdrop-blur-xl shadow-2xl border border-white/25 overflow-hidden">
                  <div className="relative h-full flex flex-col justify-between p-6 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/25 text-white">
                          <MessageSquare className="w-5 h-5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold tracking-tight">Internal activity</p>
                          <p className="text-xs text-white/80">AI chat · dashboard</p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-white/25 text-white font-medium">Phase 2</span>
                    </div>
                    <div className="space-y-2.5 text-sm text-white/90">
                      <div className="flex items-center justify-between">
                        <span>Setup &amp; access</span>
                        <span className="font-semibold text-white">100%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>AI chat (design)</span>
                        <span className="font-semibold text-[var(--color-accent)]">In progress</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-white/20">
                      <span className="flex items-center gap-2 text-xs text-white/80">
                        <Lock className="w-4 h-4" />
                        Role-based access
                      </span>
                      <span className="text-xs font-medium text-white">View details →</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Stats strip ——— */}
        <section className="mb-10 sm:mb-16 md:mb-20">
          <div className="rounded-xl sm:rounded-2xl bg-white border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.08)] p-4 sm:p-6 md:p-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
              {stats.map(({ value, label, icon: Icon }) => (
                <div key={label} className="text-center sm:text-left">
                  <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] mb-2 sm:mb-3">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-[#111] tracking-tight">{value}</p>
                  <p className="text-xs sm:text-sm text-[#666] mt-0.5 sm:mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Welcome (logged in) ——— */}
        {user && (
          <section className="mb-16">
            <div className="rounded-2xl bg-white border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.08)] p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <h2 className="text-xl font-semibold text-[#111]">Welcome back</h2>
                  <p className="mt-2 text-[#555] max-w-xl">
                    Your dashboard is ready. Jump into activity tracking, manage users, or open the AI chat to get started.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                  {user.role === 'admin' && (
                    <Link
                      to="/users"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] font-medium rounded-xl hover:bg-[var(--color-primary-hover)] hover:ring-2 hover:ring-[var(--color-primary)]/50 hover:ring-offset-2 hover:-translate-y-0.5 transition-all no-underline text-sm !text-white"
                    >
                      <Users className="w-4 h-4" />
                      Users
                    </Link>
                  )}
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-[var(--color-border)] text-[#444] font-medium rounded-xl hover:bg-black/[0.06] hover:border-[var(--color-primary)]/30 hover:ring-1 hover:ring-[var(--color-primary)]/20 transition-all no-underline text-sm"
                  >
                    <BarChart3 className="w-4 h-4" />
                    See features
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ——— Features ——— */}
        <section id="features" className="mb-10 sm:mb-16 md:mb-20">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 px-1">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#111] tracking-tight">
              Everything you need to track activity
            </h2>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-[#666]">
              From AI-powered chat logging to structured records and automated reports—built for teams that need clarity and control.
            </p>
          </div>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description, phase, color }) => (
              <div
                key={title}
                className="group rounded-xl sm:rounded-2xl bg-white border border-[var(--color-primary)]/10 p-4 sm:p-6 md:p-7 shadow-[0_4px_24px_rgba(63,75,157,0.06)] hover:shadow-[0_8px_32px_rgba(63,75,157,0.12)] hover:border-[var(--color-primary)]/20 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    color === 'accent'
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  }`}
                >
                  <Icon className="w-6 h-6" strokeWidth={1.6} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-[#111]">{title}</h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888] bg-[#f5f5f5] px-2.5 py-1 rounded-lg">
                    {phase}
                  </span>
                </div>
                <p className="text-[#666] leading-relaxed">{description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {title === 'AI Chat Logging' ? 'Try it now' : 'Coming soon'}
                    <ChevronRight className="w-4 h-4" />
                  </span>
                  {title === 'AI Chat Logging' && (
                    <Link
                      to="/chat"
                      className="text-sm font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap"
                    >
                      Open chat →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ——— Why us / Benefits ——— */}
        <section className="mb-10 sm:mb-16 md:mb-20">
          <div className="rounded-xl sm:rounded-2xl overflow-hidden bg-white border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.08)]">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[360px] min-h-[200px]">
                <img
                  src={SECTION_IMAGE}
                  alt="Team collaboration"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/80 to-transparent md:from-[var(--color-primary)]/60" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 text-white">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/90">Built for teams</p>
                  <p className="text-base sm:text-lg md:text-xl font-semibold mt-1">One platform. Full visibility.</p>
                </div>
              </div>
              <div className="p-4 sm:p-6 md:p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    <Zap className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl font-semibold text-[#111] tracking-tight">Why choose us</h2>
                </div>
                <p className="text-[#666] mb-6">
                  We combine security, ease of use, and powerful reporting so your internal activity stays organized and actionable.
                </p>
                <ul className="space-y-3">
                  {benefits.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-[#444]">
                      <CheckCircle2 className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Testimonial / Quote ——— */}
        <section className="mb-10 sm:mb-16 md:mb-20">
          <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[#2d3572] p-5 sm:p-8 md:p-12 text-center relative overflow-hidden shadow-[0_24px_60px_-12px_rgba(63,75,157,0.3)]">
            <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <div className="relative">
              <p className="text-base sm:text-xl md:text-2xl lg:text-3xl font-medium text-white leading-relaxed max-w-3xl mx-auto px-0" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                “Activity tracking used to be scattered across spreadsheets and chat. Now we have one place—and the AI summaries save us hours every week.”
              </p>
              <p className="mt-6 text-white font-medium opacity-90">— Engineering lead, Manufacturing</p>
              <p className="text-sm text-white opacity-70 mt-1">Dummy testimonial for design</p>
            </div>
          </div>
        </section>

        {/* ——— CTA ——— */}
        <section className="mb-10 sm:mb-16 md:mb-20">
          <div className="rounded-xl sm:rounded-2xl bg-white border border-[var(--color-primary)]/10 p-5 sm:p-8 md:p-12 text-center shadow-[0_4px_24px_rgba(63,75,157,0.08)]">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#111] tracking-tight">
              Ready to get started?
            </h2>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-[#555] max-w-lg mx-auto">
              Join teams that use AI Activity Tracker to stay aligned. No credit card required.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              {!user && (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--color-primary)] font-semibold rounded-xl text-white border-2 border-transparent hover:bg-[var(--color-primary-hover)] hover:!text-white hover:border-white/60 hover:shadow-[0_6px_20px_rgba(63,75,157,0.5)] hover:scale-105 active:scale-[0.98] transition-all duration-200 no-underline text-sm"
                  >
                    Create free account
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border-2 border-[var(--color-primary)]/30 text-[var(--color-primary)] font-medium rounded-xl hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)] hover:shadow-[0_4px_14px_rgba(63,75,157,0.2)] hover:scale-105 active:scale-[0.98] transition-all duration-200 no-underline text-sm"
                  >
                    Sign in
                  </Link>
                </>
              )}
              {user && (
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--color-primary)] font-semibold rounded-xl text-white hover:bg-[var(--color-primary-hover)] hover:ring-2 hover:ring-[var(--color-primary)]/50 hover:ring-offset-2 hover:-translate-y-0.5 transition-all no-underline text-sm"
                >
                  Go to dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ——— Footer ——— Apple-style: light gray, column groups, bottom legal bar (reference: apple.com) */}
      <footer className="bg-[#f5f5f7] text-[#1d1d1f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-10 pb-6">
          {/* Column groups */}
          <nav className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-6 md:gap-8" aria-label="Footer">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <Link to="/" className="inline-flex items-center gap-2 no-underline text-[#1d1d1f] hover:opacity-80 transition-opacity">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#e8e8ed] overflow-hidden border border-[#d2d2d7]">
                  <img
                    src={logoSrc}
                    alt="AI Activity Tracker"
                    className="h-full w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                      const next = (e.target as HTMLImageElement).nextElementSibling
                      if (next) (next as HTMLElement).style.display = 'flex'
                    }}
                  />
                  <span className="hidden items-center justify-center w-full h-full bg-[var(--color-primary)] text-white text-xs font-semibold" aria-hidden>AI</span>
                </span>
                <span className="font-semibold text-sm tracking-tight">AI Activity Tracker</span>
              </Link>
              <p className="mt-3 text-[12px] text-[#6e6e73] max-w-[200px] leading-relaxed">
                Internal activity tracking with AI. Built for modern teams.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <a href="#" className="text-[#6e6e73] hover:text-[#1d1d1f] transition-colors" aria-label="Twitter" onClick={(e) => e.preventDefault()}>
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="text-[#6e6e73] hover:text-[#1d1d1f] transition-colors" aria-label="LinkedIn" onClick={(e) => e.preventDefault()}>
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className="text-[#6e6e73] hover:text-[#1d1d1f] transition-colors" aria-label="GitHub" onClick={(e) => e.preventDefault()}>
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>
            {[footerLinks.product, footerLinks.company, footerLinks.support].map((section) => (
              <div key={section.title}>
                <h3 className="text-[12px] font-semibold text-[#1d1d1f] mb-3">{section.title}</h3>
                <ul className="space-y-2">
                  {section.links.map(({ label, href }) => (
                    <li key={label}>
                      <a href={href} className="text-[12px] text-[#424245] hover:text-[#1d1d1f] no-underline transition-colors" onClick={href === '#' ? (e) => e.preventDefault() : undefined}>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* More ways / Contact — Apple-style, wraps on mobile */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[#d2d2d7] text-[11px] sm:text-[12px] text-[#6e6e73] space-y-1 sm:space-y-0 sm:block">
            <span className="block sm:inline">More ways to get in touch: </span>
            <a href="mailto:hello@activitytracker.example" className="text-[#424245] hover:text-[#1d1d1f] underline break-all">hello@activitytracker.example</a>
            <span className="hidden sm:inline"> · </span>
            <a href="tel:+15550000000" className="text-[#424245] hover:text-[#1d1d1f] underline sm:ml-0">1-800-ACTIVITY</a>
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline">123 Example St, City</span>
          </div>

          {/* Bottom legal bar — like Apple Footer */}
          <div className="mt-4 pt-4 border-t border-[#d2d2d7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-[#6e6e73]">
            <p>Copyright © {new Date().getFullYear()} AI Activity Tracker. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {footerLinks.legal.map(({ label, href }) => (
                <a key={label} href={href} className="text-[#6e6e73] hover:text-[#1d1d1f] no-underline transition-colors" onClick={href === '#' ? (e) => e.preventDefault() : undefined}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

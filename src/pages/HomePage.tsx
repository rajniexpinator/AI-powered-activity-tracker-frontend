import { Link } from 'react-router-dom'
import { Activity, ArrowRight, BarChart3, Building2, FileText, History, Lock, Mail, MessageSquare, Shield, User, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const SECONDARY_COLOR = '#E83946'

function FeatureCard({
  icon: Icon,
  title,
  desc,
  locked,
  tint = 'primary',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  locked?: boolean
  tint?: 'primary' | 'secondary' | 'info' | 'neutral'
}) {
  const tintClass =
    tint === 'secondary'
      ? 'from-[rgba(232,57,70,0.10)] via-white/65 to-[rgba(232,57,70,0.04)]'
      : tint === 'info'
        ? 'from-[rgba(96,165,250,0.14)] via-white/65 to-[rgba(96,165,250,0.05)]'
        : tint === 'neutral'
          ? 'from-[rgba(15,23,42,0.06)] via-white/65 to-[rgba(15,23,42,0.03)]'
          : 'from-[rgba(63,75,157,0.12)] via-white/65 to-[rgba(63,75,157,0.04)]'

  return (
    <div
      className={[
        'group relative rounded-2xl border bg-gradient-to-br backdrop-blur-sm',
        tintClass,
        'border-[var(--color-primary)]/10 shadow-[0_8px_30px_rgba(15,23,42,0.06)]',
        'hover:shadow-[0_16px_50px_rgba(63,75,157,0.18)] hover:border-[var(--color-primary)]/25',
        'transition-all duration-300',
        locked ? 'opacity-[0.98]' : '',
      ].join(' ')}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className="relative inline-flex items-center justify-center w-12 h-12 rounded-2xl ring-1"
            style={{
              background:
                tint === 'secondary'
                  ? 'rgba(232,57,70,0.10)'
                  : tint === 'info'
                    ? 'rgba(96,165,250,0.14)'
                    : tint === 'neutral'
                      ? 'rgba(15,23,42,0.06)'
                      : 'rgba(63,75,157,0.12)',
              color:
                tint === 'secondary'
                  ? SECONDARY_COLOR
                  : tint === 'info'
                    ? 'rgb(37 99 235)'
                    : 'var(--color-primary)',
              borderColor:
                tint === 'secondary'
                  ? 'rgba(232,57,70,0.20)'
                  : tint === 'info'
                    ? 'rgba(96,165,250,0.25)'
                    : tint === 'neutral'
                      ? 'rgba(15,23,42,0.10)'
                      : 'rgba(63,75,157,0.18)',
            }}
          >
            <Icon className="w-5 h-5" />
            <span
              className="pointer-events-none absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background:
                  'radial-gradient(120px 120px at 20% 15%, rgba(255,255,255,0.7), transparent 55%)',
              }}
            />
          </span>

          {locked ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] bg-[var(--color-bg)] px-2.5 py-1.5 rounded-full border border-[var(--color-border)]">
              <Lock className="w-3.5 h-3.5" />
              Sign in
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-[15px] font-semibold text-[var(--color-text)] tracking-tight">
          {title}
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
          {desc}
        </p>
      </div>

      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background:
              tint === 'secondary'
                ? 'radial-gradient(600px 260px at 20% 0%, rgba(232,57,70,0.22), transparent 55%), radial-gradient(360px 220px at 90% 40%, rgba(63,75,157,0.12), transparent 60%)'
                : tint === 'info'
                  ? 'radial-gradient(600px 260px at 20% 0%, rgba(96,165,250,0.22), transparent 55%), radial-gradient(360px 220px at 90% 40%, rgba(232,57,70,0.10), transparent 60%)'
                  : 'radial-gradient(600px 260px at 20% 0%, rgba(63,75,157,0.18), transparent 55%), radial-gradient(360px 220px at 90% 40%, rgba(232,57,70,0.12), transparent 60%)',
          }}
        />
      </div>
    </div>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="w-full min-h-screen bg-[#f5f6fc] overflow-x-hidden">
      <main className="max-w-5xl mx-auto px-3 sm:px-6 md:px-8 py-8 sm:py-12 md:py-8">
        {!user ? (
          <section className="space-y-6">
            {/* Hero / overview */}
            <div className="relative rounded-3xl overflow-hidden border border-white/30 shadow-[0_30px_80px_-20px_rgba(63,75,157,0.55)]">
              {/* background mesh */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#3F4B9D] via-[#2d3572] to-[#111827]" />
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.16) 1px, transparent 0)',
                  backgroundSize: '26px 26px',
                }}
              />
              <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
              <div
                className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full blur-3xl"
                style={{ backgroundColor: `${SECONDARY_COLOR}26` }}
              />

              <div className="relative px-6 sm:px-10 py-10 sm:py-12 lg:py-14">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                  Internal portal
                </p>
                <h1 className="mt-2 text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight leading-tight">
                  <span className="inline-flex items-center gap-3">
                    <span
                      className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[12px] font-semibold tracking-wide bg-white/10 border border-white/20"
                      style={{ color: SECONDARY_COLOR }}
                    >
                      AI
                    </span>
                    <span className="text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.35)]">
                      Activity Tracker
                    </span>
                  </span>
                </h1>
                <p className="mt-3 text-sm sm:text-base text-white/85 max-w-2xl leading-relaxed">
                  This system is not public. An admin creates employee accounts. Employees then sign in to access dashboards, customers, AI logs, and reports (admin only).
                </p>

                <div className="mt-7 flex flex-col sm:flex-row gap-3 max-w-xl">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white font-semibold rounded-2xl hover:bg-gray-100 hover:ring-2 hover:ring-white/40 hover:ring-offset-2 hover:ring-offset-[#2d3572] transition-all no-underline text-[14px] !text-[#2d3572] shadow-xl"
                  >
                    Sign in
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <div className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 rounded-2xl border border-white/20 text-[13px] text-white/90 backdrop-blur-sm">
                    <Shield className="w-4 h-4" />
                    Admin-created access only
                  </div>
                </div>

                {/* mini preview cards */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
                  {[
                    { icon: MessageSquare, label: 'AI logs', value: 'Chat → activities' },
                    { icon: History, label: 'History', value: 'Searchable timeline' },
                    { icon: FileText, label: 'Reports', value: 'Weekly summaries' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md px-4 py-3 text-white"
                    >
                      <div className="flex items-center gap-2 text-white/85">
                        <Icon className="w-4 h-4" style={label === 'Reports' ? { color: SECONDARY_COLOR } : undefined} />
                        <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">{label}</span>
                      </div>
                      <p className="mt-2 text-[14px] font-semibold tracking-tight">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Features/modules (locked until sign-in) */}
            <div className="rounded-3xl bg-white/70 backdrop-blur-sm border border-[var(--color-primary)]/10 shadow-[0_20px_60px_rgba(63,75,157,0.10)] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h2 className="text-[16px] sm:text-[18px] font-semibold text-[var(--color-text)]">
                    Modules available in the employee panel
                  </h2>
                  <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">
                    Sign in to open these modules.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                  <Lock className="w-4 h-4" />
                  Locked until authenticated
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {[
                  { icon: BarChart3, title: 'Dashboard', desc: 'Overview, recent activity, and quick actions.', tint: 'primary' as const },
                  { icon: MessageSquare, title: 'AI logs', desc: 'Chat-based logging and activity extraction.', tint: 'info' as const },
                  { icon: Building2, title: 'Customers', desc: 'View and manage customer records.', tint: 'neutral' as const },
                  { icon: User, title: 'Profile', desc: 'Update your details and password.', tint: 'secondary' as const },
                ].map(({ icon, title, desc, tint }) => (
                  <FeatureCard key={title} icon={icon} title={title} desc={desc} locked tint={tint} />
                ))}
              </div>
            </div>

            {/* How access works + roles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.06)] p-6 sm:p-8">
                <h2 className="text-[16px] sm:text-[18px] font-semibold text-[var(--color-text)]">
                  How access works
                </h2>
                <ol className="mt-4 space-y-3 text-[13px] text-[var(--color-text-secondary)]">
                  <li className="flex gap-3">
                    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold">1</span>
                    <span><span className="font-medium text-[var(--color-text)]">Admin</span> creates employee accounts in Employee Management.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold">2</span>
                    <span>Employee signs in with the credentials provided by admin.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold">3</span>
                    <span>Employee uses Dashboard, AI logs, Customers, and Profile.</span>
                  </li>
                </ol>
              </div>

              <div className="rounded-2xl bg-white border border-[var(--color-primary)]/10 shadow-[0_4px_24px_rgba(63,75,157,0.06)] p-6 sm:p-8">
                <h2 className="text-[16px] sm:text-[18px] font-semibold text-[var(--color-text)]">
                  Roles
                </h2>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-primary)]">
                        <Shield className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-[14px] font-semibold text-[var(--color-text)]">Admin</p>
                        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                          Can create employees, view admin activity, and generate reports.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[var(--color-border)]"
                        style={{ color: SECONDARY_COLOR }}
                      >
                        <User className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-[14px] font-semibold text-[var(--color-text)]">Employee</p>
                        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                          Can use dashboard, customers, AI logs, and manage their profile.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What this system tracks + reporting */}
            <div className="relative rounded-3xl overflow-hidden border border-[var(--color-primary)]/10 shadow-[0_20px_60px_rgba(63,75,157,0.10)]">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(900px 360px at 0% 0%, rgba(63,75,157,0.18), transparent 55%), radial-gradient(700px 300px at 100% 40%, rgba(232,57,70,0.14), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.74))',
                }}
              />
              <div className="absolute inset-0 backdrop-blur-sm" />
              <div className="relative p-6 sm:p-8">
              <h2 className="text-[16px] sm:text-[18px] font-semibold text-[var(--color-text)]">
                What this portal is used for
              </h2>
              <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)] max-w-3xl">
                AI Activity Tracker helps teams capture day-to-day work updates in a consistent format, so admins can review activity and generate weekly reports without chasing messages across tools.
              </p>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-white/85 via-white/75 to-[rgba(63,75,157,0.06)] border border-[var(--color-primary)]/10 shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/15">
                      <History className="w-5 h-5" />
                    </span>
                    <p className="font-semibold text-[var(--color-text)]">Activity history</p>
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
                    Maintain a searchable timeline of employee activities by date and customer.
                  </p>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-white/85 via-white/75 to-[rgba(96,165,250,0.08)] border border-[var(--color-primary)]/10 shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/15">
                      <MessageSquare className="w-5 h-5" />
                    </span>
                    <p className="font-semibold text-[var(--color-text)]">AI assisted logs</p>
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
                    Convert chat notes into structured activities that are easier to review and report.
                  </p>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-white/85 via-white/75 to-[rgba(232,57,70,0.07)] border border-[var(--color-primary)]/10 shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/15">
                      <FileText className="w-5 h-5" />
                    </span>
                    <p className="font-semibold text-[var(--color-text)]">Weekly reporting</p>
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
                    Admins can generate reports across employees and customers for weekly updates.
                  </p>
                </div>
              </div>
              </div>
            </div>

            {/* Help / support */}
            <div className="rounded-3xl bg-white/70 backdrop-blur-sm border border-[var(--color-primary)]/10 shadow-[0_20px_60px_rgba(63,75,157,0.10)] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-[16px] sm:text-[18px] font-semibold text-[var(--color-text)]">
                    Need help?
                  </h2>
                  <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">
                    For access issues, ask your admin. For technical issues, contact your internal support team.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-secondary)]">
                  <Mail className="w-4 h-4" />
                  <span>Support: internal IT / Admin</span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="rounded-3xl bg-white/70 backdrop-blur-sm border border-[var(--color-primary)]/10 shadow-[0_20px_60px_rgba(63,75,157,0.10)] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                    Portal home
                  </p>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
                    Welcome{user.name ? `, ${user.name}` : ''}.
                  </h1>
                  <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
                    Use the shortcuts below to access dashboards and admin tools.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-secondary)]">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-[var(--color-border)] text-[var(--color-primary)]">
                    <Shield className="w-4 h-4" />
                  </span>
                  <span className="font-medium text-[var(--color-text)]">{isAdmin ? 'Admin' : 'Employee'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white/70 backdrop-blur-sm border border-[var(--color-primary)]/10 shadow-[0_20px_60px_rgba(63,75,157,0.10)] p-6 sm:p-8">
              <h2 className="text-[16px] sm:text-[18px] font-semibold text-[var(--color-text)]">
                Employee panel features
              </h2>
              <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">
                These are the main sections available after login.
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link to="/dashboard" className="no-underline">
                  <FeatureCard icon={BarChart3} title="Dashboard" desc="Overview, recent activity, and quick actions." />
                </Link>
                <Link to="/chat" className="no-underline">
                  <FeatureCard icon={MessageSquare} title="AI logs" desc="Chat-based logging and activity extraction." />
                </Link>
                <Link to="/customers" className="no-underline">
                  <FeatureCard icon={Building2} title="Customers" desc="View and manage customer records." />
                </Link>
                <Link to="/profile" className="no-underline">
                  <FeatureCard icon={User} title="Profile" desc="Update your details and password." />
                </Link>
              </div>
            </div>

            {/* Quick usage tips */}
            <div className="rounded-3xl bg-white/70 backdrop-blur-sm border border-[var(--color-primary)]/10 shadow-[0_20px_60px_rgba(63,75,157,0.10)] p-6 sm:p-8">
              <h2 className="text-[16px] sm:text-[18px] font-semibold text-[var(--color-text)]">
                Tips for better tracking
              </h2>
              <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px] text-[var(--color-text-secondary)]">
                <li className="rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-4">
                  Write short updates: customer, task, outcome, next step.
                </li>
                <li className="rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-4">
                  Use AI logs to convert chat notes into structured activities.
                </li>
                <li className="rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-4">
                  Keep customer names consistent so filtering works.
                </li>
                <li className="rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-4">
                  Update your profile name so reports show the correct employee.
                </li>
              </ul>
            </div>

            {isAdmin && (
              <div className="rounded-3xl bg-white/70 backdrop-blur-sm border border-[var(--color-primary)]/10 shadow-[0_20px_60px_rgba(63,75,157,0.10)] p-6 sm:p-8">
                <h2 className="text-[16px] sm:text-[18px] font-semibold text-[var(--color-text)]">Admin tools</h2>
                <p className="mt-1.5 text-[13px] text-[var(--color-text-secondary)]">Admin-only modules.</p>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Link
                    to="/users"
                    className="no-underline"
                  >
                    <FeatureCard icon={Users} title="Employee management" desc="Create employees and manage access." />
                  </Link>

                <Link
                  to="/activity"
                    className="no-underline"
                >
                    <FeatureCard icon={Activity} title="Admin activity" desc="Filter activities across employees and customers." />
                </Link>

                <Link
                  to="/reports"
                    className="no-underline"
                >
                    <FeatureCard icon={FileText} title="Reports" desc="Generate and export internal reports." />
                </Link>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

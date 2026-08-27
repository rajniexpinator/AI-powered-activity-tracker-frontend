import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Sparkles, Send, RotateCcw, Image as ImageIcon, BarChart3 } from 'lucide-react'
import { toast } from 'react-toastify'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { isAdminRole } from '@/lib/roles'
import { AdminShell } from '@/components/layout/AdminShell'
import { formatUsDateTime } from '@/lib/formatDate'

type ChatRole = 'user' | 'assistant'

type ExploreActivity = {
  _id: string
  customer?: string
  summary?: string
  createdAt: string
  serialNumber?: string
  reportingPlant?: string
  photoCount?: number
  photoUrls?: string[]
  userId?: { _id: string; name?: string; email?: string }
}

type ExploreStats = {
  matched: number
  withPhotos: number
  byCustomer?: { name: string; count: number }[]
  byPlant?: { name: string; count: number }[]
  byEmployee?: { name: string; count: number }[]
}

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  interpretation?: string
  suggestedQuestions?: string[]
  stats?: ExploreStats
  activities?: ExploreActivity[]
}

const EXAMPLE_QUESTIONS = [
  'What issues were logged last week?',
  'Which customers had the most activity this month?',
  'Show logs that include photos from the last 7 days',
  'Any high-severity issues recently?',
  'Summarize activity by plant this month',
]

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const URL_SPLIT_RE = /(https?:\/\/[^\s<>"']+)/gi

function cleanHref(raw: string) {
  return raw.replace(/[),.;]+$/g, '')
}

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_SPLIT_RE)
  return (
    <>
      {parts.map((part, i) => {
        if (/^https?:\/\//i.test(part)) {
          const href = cleanHref(part)
          return (
            <a
              key={`${href}-${i}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline underline-offset-2 break-all cursor-pointer pointer-events-auto font-medium"
            >
              {href}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function uniquePhotoUrls(activities?: ExploreActivity[], content?: string) {
  const urls: string[] = []
  for (const a of activities || []) {
    for (const url of a.photoUrls || []) {
      if (url && !urls.includes(url)) urls.push(url)
    }
  }
  if (content) {
    const found = content.match(URL_SPLIT_RE) || []
    for (const raw of found) {
      const href = cleanHref(raw)
      if (href && !urls.includes(href)) urls.push(href)
    }
  }
  return urls
}

export function AdminAiPage() {
  const { user } = useAuth()
  const isAdmin = isAdminRole(user?.role)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const history = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [messages]
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  async function ask(nextQuestion: string) {
    const q = nextQuestion.trim()
    if (!q || loading) return
    setQuestion('')
    const userMsg: ChatMessage = { id: newId(), role: 'user', content: q }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    try {
      const res = await api.activities.adminAiExplore({
        question: q,
        history,
        limit: 120,
      })
      const assistantMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        content: res.answer || 'No answer returned.',
        interpretation: res.interpretation,
        suggestedQuestions: res.suggestedQuestions || [],
        stats: res.stats,
        activities: res.activities || [],
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Admin AI request failed'
      toast.error(msg)
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: `I could not complete that request. ${msg}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void ask(question)
  }

  if (!isAdmin) {
    return (
      <AdminShell>
        <main className="py-6">
          <p className="text-sm text-[var(--color-text-secondary)]">This Admin AI page is only available to admins.</p>
        </main>
      </AdminShell>
    )
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')

  return (
    <AdminShell>
      <main className="py-1 sm:py-0 w-full min-w-0 max-w-full overflow-x-hidden">
        <section className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-[28px] font-bold tracking-tight text-[var(--color-text)] flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            Admin AI
          </h1>
          <p className="mt-2 text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
            Ask anything about live employee logs. This reads the core database through ApexQuality1 — no daily CSV
            needed. Photos stay in AWS; matching logs only keep the web links. Only admins can use this.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,_1.6fr)_minmax(16rem,_0.9fr)] min-w-0">
          <section className="rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] min-w-0 flex flex-col min-h-[28rem]">
            <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[var(--color-text)]">Ask in plain English</p>
              <button
                type="button"
                onClick={() => setMessages([])}
                disabled={loading || messages.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New chat
              </button>
            </div>

            <div className="flex-1 overflow-auto px-4 sm:px-5 py-4 space-y-4 min-h-[18rem]">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-[13px] text-[var(--color-text-secondary)]">
                    Try a starter question, then keep asking follow-ups. You can grow with this after handover — no
                    developer needed for each new question.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_QUESTIONS.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => void ask(example)}
                        className="rounded-full border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 px-3 py-1.5 text-[12px] text-[var(--color-text)] hover:bg-[var(--color-primary)]/10"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[95%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]'
                    }`}
                  >
                    {m.role === 'assistant' && m.interpretation && (
                      <p className="mb-2 text-[11px] text-[var(--color-text-secondary)]">
                        Understood as: {m.interpretation}
                      </p>
                    )}
                    {m.role === 'assistant' ? <LinkifiedText text={m.content} /> : m.content}
                    {m.role === 'assistant' && uniquePhotoUrls(m.activities, m.content).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {uniquePhotoUrls(m.activities, m.content).slice(0, 12).map((url, idx) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-full border border-[var(--color-primary)]/30 bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)] underline underline-offset-2 cursor-pointer pointer-events-auto"
                          >
                            Open photo {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' && m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.suggestedQuestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => void ask(s)}
                            className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-[11px] text-[var(--color-text)] hover:bg-white"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching live logs…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[var(--color-border)] p-3 sm:px-4 sm:py-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <textarea
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Example: What did the team log for Bosch last week?"
                  className="w-full flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25"
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold !text-white disabled:opacity-50 sm:shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Ask
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-4 min-w-0">
            {lastAssistant?.stats && (
              <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
                <p className="text-[13px] font-semibold text-[var(--color-text)] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
                  Live match snapshot
                </p>
                <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
                  {lastAssistant.stats.matched} matching log{lastAssistant.stats.matched === 1 ? '' : 's'}
                  {typeof lastAssistant.stats.withPhotos === 'number'
                    ? ` · ${lastAssistant.stats.withPhotos} with photos`
                    : ''}
                </p>
                {lastAssistant.stats.byCustomer && lastAssistant.stats.byCustomer.length > 0 && (
                  <ul className="mt-3 space-y-1 text-[12px] text-[var(--color-text)]">
                    {lastAssistant.stats.byCustomer.slice(0, 5).map((c) => (
                      <li key={c.name} className="flex justify-between gap-2">
                        <span className="truncate">{c.name}</span>
                        <span className="text-[var(--color-text-secondary)]">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <p className="text-[13px] font-semibold text-[var(--color-text)] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[var(--color-primary)]" />
                Matching logs
              </p>
              {!lastAssistant?.activities?.length ? (
                <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
                  Matching rows show up here after you ask a question. Photo links stay attached to the same log.
                </p>
              ) : (
                <div className="mt-3 space-y-3 max-h-[28rem] overflow-auto">
                  {lastAssistant.activities.slice(0, 12).map((a) => (
                    <div key={a._id} className="rounded-xl border border-[var(--color-border)] p-2.5">
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {a.customer || 'Unknown'} · {formatUsDateTime(a.createdAt)}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--color-text)] line-clamp-3">{a.summary || 'No summary'}</p>
                      {(a.serialNumber || a.reportingPlant) && (
                        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                          {[a.reportingPlant, a.serialNumber].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {a.photoUrls && a.photoUrls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {a.photoUrls.slice(0, 3).map((url, idx) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium text-[var(--color-primary)] underline underline-offset-2 cursor-pointer pointer-events-auto"
                            >
                              Open photo {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Link
                to="/activity"
                className="mt-3 inline-block text-[12px] font-medium text-[var(--color-primary)] no-underline hover:underline"
              >
                Open Activity list
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </AdminShell>
  )
}

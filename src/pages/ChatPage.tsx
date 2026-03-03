import { useState } from 'react'
import { MessageSquare, Clock, Tag, Archive, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'

type ExtractResult = {
  structured: unknown
  rawText: string
  model: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

type ValidationResult = {
  ok: boolean
  severity: 'ok' | 'minor' | 'warning' | 'critical'
  issues: string[]
  suggestions: string[]
}

export function ChatPage() {
  const [text, setText] = useState('')
  const [customerHint, setCustomerHint] = useState('')
  const [loadingExtract, setLoadingExtract] = useState(false)
  const [loadingValidate, setLoadingValidate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  async function handleExtract() {
    if (!text.trim()) {
      setError('Please describe the activity before logging with AI.')
      return
    }
    setError(null)
    setSaveMessage(null)
    setValidation(null)
    setLoadingExtract(true)
    try {
      const data = await api.ai.extractActivity(text, customerHint || undefined)
      setResult(data)
    } catch (err) {
      const message = (err as Error).message || 'Failed to extract activity'
      setError(message)
    } finally {
      setLoadingExtract(false)
    }
  }

  async function handleValidate() {
    if (!result) return
    setError(null)
    setSaveMessage(null)
    setLoadingValidate(true)
    try {
      const data = await api.ai.validateActivity(result.structured, result.rawText)
      setValidation(data)
    } catch (err) {
      const message = (err as Error).message || 'Failed to validate activity'
      setError(message)
    } finally {
      setLoadingValidate(false)
    }
  }

  async function handleSave() {
    if (!result) return
    setError(null)
    setSaveMessage(null)
    setSaving(true)
    try {
      await api.activities.create({ rawText: result.rawText, structured: result.structured })
      setSaveMessage('Activity saved to tracker.')
    } catch (err) {
      const message = (err as Error).message || 'Failed to save activity'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      <main className="max-w-6xl mx-auto px-5 sm:px-6 md:px-8 py-8 md:py-10">
        {/* Header row */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#111] flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <MessageSquare className="w-4 h-4" />
              </span>
              AI Chat Logging
            </h1>
            <p className="mt-1 text-sm text-[#666] max-w-xl">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-xs sm:text-sm text-[#444] hover:bg-black/[0.03]"
            >
              <Clock className="w-4 h-4" />
              Today
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-xs sm:text-sm text-[#444] hover:bg-black/[0.03]"
            >
              <Tag className="w-4 h-4" />
              All customers
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,_260px)_minmax(0,_1fr)]">
          {/* Left: recent activity list */}
          <section className="rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#777]">Recent logs</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-[#666] hover:bg-black/[0.03]"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            </div>
            <div className="max-h-[420px] overflow-auto divide-y divide-[var(--color-border)]">
              {result ? (
                <div className="px-4 py-3 text-left">
                  <p className="text-xs font-medium text-[#999] mb-1">
                    Latest extracted activity · model {result.model}
                  </p>
                  <p className="text-sm text-[#222] line-clamp-3 mb-2">{result.rawText}</p>
                  <p className="text-[11px] text-[#777]">
                    Tokens:{' '}
                    {result.usage
                      ? `${result.usage.total_tokens ?? 0} total (prompt ${result.usage.prompt_tokens ?? 0}, completion ${result.usage.completion_tokens ?? 0})`
                      : 'n/a'}
                  </p>
                </div>
              ) : (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="px-4 py-3 text-left">
                    <p className="text-xs font-medium text-[#999] mb-0.5">No activity yet</p>
                    <p className="text-sm text-[#666]">
                      Use the form on the right to describe an activity. The AI will extract a structured log for you.
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Right: chat surface */}
          <section className="rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col min-h-[420px]">
            {/* Chat meta */}
            <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777]">New activity</p>
                <p className="text-sm text-[#333]">
                  Describe a call, issue, task, or conversation and we&apos;ll turn it into a structured activity.
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1 text-right">
                <p className="text-xs text-[#777]">
                  1) Extract JSON with AI, 2) validate, 3) save to tracker.
                </p>
                <Link to="/" className="text-[11px] font-medium text-[var(--color-primary)] hover:underline">
                  View dashboard
                </Link>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 px-4 sm:px-5 py-4 space-y-3 overflow-auto bg-[var(--color-bg)]">
              {error && (
                <div className="flex items-start gap-2 rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {result && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="text-xs font-medium text-[#666]">Extracted JSON</p>
                    {validation && (
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          validation.ok && validation.severity === 'ok'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>
                          {validation.ok ? 'Ready to save' : validation.severity === 'critical' ? 'Needs attention' : 'Review suggested'}
                        </span>
                      </div>
                    )}
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-[var(--radius)] bg-[#0b1020] text-[11px] text-[#e5f0ff] px-3 py-2 border border-[#1f2937]">
                    {JSON.stringify(result.structured, null, 2)}
                  </pre>
                  {validation && (validation.issues.length > 0 || validation.suggestions.length > 0) && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {validation.issues.length > 0 && (
                        <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-[11px] font-semibold text-amber-800 mb-1">Issues</p>
                          <ul className="space-y-0.5">
                            {validation.issues.map((issue, idx) => (
                              <li key={idx} className="text-[11px] text-amber-900">
                                • {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {validation.suggestions.length > 0 && (
                        <div className="rounded-[var(--radius)] border border-sky-200 bg-sky-50 px-3 py-2">
                          <p className="text-[11px] font-semibold text-sky-800 mb-1">Suggestions</p>
                          <ul className="space-y-0.5">
                            {validation.suggestions.map((s, idx) => (
                              <li key={idx} className="text-[11px] text-sky-900">
                                • {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {saveMessage && (
                    <p className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[var(--color-border)] px-4 sm:px-5 py-3 bg-white">
              <div className="flex flex-col gap-2">
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Example: Spoke with Apex Engineering about line-3 downtime; diagnosed sensor issue and planned follow‑up visit tomorrow at 10:00."
                  className="w-full resize-none rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[#222] placeholder:text-[#999] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                />
                <input
                  type="text"
                  value={customerHint}
                  onChange={(e) => setCustomerHint(e.target.value)}
                  placeholder="Optional customer / project hint (e.g. Apex Engineering)"
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs text-[#222] placeholder:text-[#999] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/40"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-[#999] hidden sm:block">
                    1) Extract JSON, 2) validate the log, 3) save when you&apos;re satisfied.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={loadingExtract}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:ring-2 hover:ring-[var(--color-primary)]/50 hover:ring-offset-2 px-4 py-1.5 text-xs sm:text-sm font-medium text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {loadingExtract ? 'Extracting…' : 'Log with AI'}
                    </button>
                    <button
                      type="button"
                      onClick={handleValidate}
                      disabled={!result || loadingValidate}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-white hover:bg-black/[0.03] px-3 py-1.5 text-[11px] sm:text-xs font-medium text-[#444] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      {loadingValidate ? 'Validating…' : 'Validate'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!result || saving}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {saving ? 'Saving…' : 'Save to tracker'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}


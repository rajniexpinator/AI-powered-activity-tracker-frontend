import { MessageSquare, Clock, Tag, Archive, Send } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ChatPage() {
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
              {Array.from({ length: 6 }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-[var(--color-bg)] focus-visible:outline-none"
                >
                  <p className="text-xs font-medium text-[#999] mb-0.5">Customer · 2025-02-24 · 14:32</p>
                  <p className="text-sm text-[#222] line-clamp-2">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                    labore et dolore magna aliqua.
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Right: chat surface */}
          <section className="rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col min-h-[420px]">
            {/* Chat meta */}
            <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777]">New activity</p>
                <p className="text-sm text-[#333]">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1 text-right">
                <p className="text-xs text-[#777]">Log will be saved as structured record.</p>
                <Link to="/" className="text-[11px] font-medium text-[var(--color-primary)] hover:underline">
                  View dashboard
                </Link>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 px-4 sm:px-5 py-4 space-y-3 overflow-auto bg-[var(--color-bg)]">
              <div className="flex gap-3">
                <div className="mt-1 h-7 w-7 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] text-xs font-semibold">
                  AI
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white border border-[var(--color-border)] px-3 py-2.5">
                  <p className="text-xs font-medium text-[#666] mb-1">Assistant</p>
                  <p className="text-sm text-[#222]">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Describe what happened and I&apos;ll turn
                    it into a structured activity log.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--color-primary)] text-white px-3 py-2.5">
                  <p className="text-xs font-medium text-white/80 mb-1">You</p>
                  <p className="text-sm">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 h-7 w-7 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] text-xs font-semibold">
                  AI
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white border border-[var(--color-border)] px-3 py-2.5">
                  <p className="text-xs font-medium text-[#666] mb-1">Assistant</p>
                  <p className="text-sm text-[#222]">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. I will extract customer, line, product and
                    timestamps from this log.
                  </p>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-[var(--color-border)] px-4 sm:px-5 py-3 bg-white">
              <div className="flex flex-col gap-2">
                <textarea
                  rows={2}
                  placeholder="Describe what happened, e.g. customer call, machine issue, shipment, etc. (Lorem ipsum for now)…"
                  className="w-full resize-none rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[#222] placeholder:text-[#999] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-[#999] hidden sm:block">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-4 py-1.5 text-xs sm:text-sm font-medium text-white"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Log with AI
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}


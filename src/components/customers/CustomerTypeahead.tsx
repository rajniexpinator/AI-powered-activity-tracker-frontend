import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { filterCustomersByQuery, findCustomerByName } from '@/lib/customerName'

export type CustomerOption = {
  _id: string
  name: string
  email?: string
}

type CustomerTypeaheadProps = {
  customers: CustomerOption[]
  value: string
  onChange: (name: string, customer?: CustomerOption) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  inputClassName?: string
  id?: string
}

export function CustomerTypeahead({
  customers,
  value,
  onChange,
  placeholder = 'Type customer name…',
  disabled = false,
  loading = false,
  inputClassName = '',
  id: idProp,
}: CustomerTypeaheadProps) {
  const autoId = useId()
  const inputId = idProp ?? autoId
  const listId = `${inputId}-listbox`

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const matches = useMemo(() => {
    const filtered = filterCustomersByQuery(customers, query)
    return filtered.slice(0, 12)
  }, [customers, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, matches.length])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function pickCustomer(customer: CustomerOption) {
    onChange(customer.name, customer)
    setQuery(customer.name)
    setOpen(false)
  }

  function commitTypedValue(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      onChange('')
      return
    }
    const match = findCustomerByName(customers, trimmed)
    if (match) {
      onChange(match.name, match)
      setQuery(match.name)
    } else {
      onChange(trimmed)
      setQuery(trimmed)
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled || loading}
        value={query}
        placeholder={loading ? 'Loading customers…' : placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          setOpen(true)
          if (!next.trim()) onChange('')
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActiveIndex((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)))
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
            return
          }
          if (e.key === 'Enter' && open && matches.length > 0) {
            e.preventDefault()
            pickCustomer(matches[activeIndex])
            return
          }
          if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            commitTypedValue(query)
            setOpen(false)
          }, 120)
        }}
        className={inputClassName}
      />
      {open && !disabled && !loading && matches.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-white py-1 shadow-lg"
        >
          {matches.map((c, idx) => (
            <li key={c._id} role="option" aria-selected={idx === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickCustomer(c)}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-black/[0.04] ${
                  idx === activeIndex ? 'bg-[var(--color-primary)]/8 text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                }`}
              >
                <span className="font-medium">{c.name}</span>
                {c.email ? (
                  <span className="block text-[11px] text-[var(--color-text-secondary)] truncate">{c.email}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

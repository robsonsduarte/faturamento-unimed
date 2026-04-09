'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { searchCid10, type Cid10Entry } from '@/data/cid10'

interface CidAutocompleteProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function CidAutocomplete({ value, onChange, disabled, className, placeholder = 'Digite o CID ou descricao...' }: CidAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Cid10Entry[]>([])
  const [highlighted, setHighlighted] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const search = useCallback((q: string) => {
    const found = searchCid10(q, 12)
    setResults(found)
    setOpen(found.length > 0 && q.length > 0)
    setHighlighted(-1)
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    onChange(v)
    search(v)
  }

  function selectItem(entry: Cid10Entry) {
    onChange(`${entry.code} - ${entry.description}`)
    setOpen(false)
    setResults([])
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      selectItem(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => { if (value.trim()) search(value) }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          className={cn(
            'absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border shadow-lg',
            'bg-[var(--color-card)] border-[var(--color-border)]'
          )}
        >
          {results.map((entry, i) => (
            <li
              key={entry.code}
              onMouseDown={() => selectItem(entry)}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 cursor-pointer text-sm',
                'hover:bg-[var(--color-surface)]',
                i === highlighted && 'bg-[var(--color-surface)]'
              )}
            >
              <span className="font-mono text-xs font-semibold text-[var(--color-primary)] shrink-0 w-14">
                {entry.code}
              </span>
              <span className="text-[var(--color-text)] truncate">
                {entry.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

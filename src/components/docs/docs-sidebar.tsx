'use client'

import { cn } from '@/lib/utils'
import type { DocsSection } from '@/lib/docs-content'

interface DocsSidebarProps {
  sections: DocsSection[]
  activeSlug: string
  onSelect: (slug: string) => void
}

export function DocsSidebar({ sections, activeSlug, onSelect }: DocsSidebarProps) {
  return (
    <nav className="w-[250px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto py-4 px-3">
      {sections.map(section => (
        <div key={section.id} className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-3 mb-2">
            {section.title}
          </h3>
          <ul className="space-y-0.5">
            {section.articles.map(article => {
              const Icon = article.icon
              const isActive = article.slug === activeSlug
              return (
                <li key={article.slug}>
                  <button
                    onClick={() => onSelect(article.slug)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                      isActive
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)]'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{article.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

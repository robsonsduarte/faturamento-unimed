'use client'

import type { DocsArticle } from '@/lib/docs-content'

interface DocsArticleProps {
  article: DocsArticle
}

export function DocsArticleView({ article }: DocsArticleProps) {
  const Icon = article.icon

  return (
    <div className="max-w-3xl px-8 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Icon className="w-6 h-6 text-[var(--color-primary)]" />
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{article.title}</h1>
      </div>
      <div className="space-y-4">
        {article.content()}
      </div>
    </div>
  )
}

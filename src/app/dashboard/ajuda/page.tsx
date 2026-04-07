'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DocsSidebar } from '@/components/docs/docs-sidebar'
import { DocsArticleView } from '@/components/docs/docs-article'
import { docsContent, findArticle, getDefaultSlug } from '@/lib/docs-content'

export default function AjudaPage() {
  const [activeSlug, setActiveSlug] = useState(getDefaultSlug)
  const article = findArticle(activeSlug)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6">
        <PageHeader
          title="Ajuda"
          description="Documentacao completa do sistema de faturamento"
        />
      </div>

      <div className="flex flex-1 min-h-0 border-t border-[var(--color-border)]">
        <DocsSidebar
          sections={docsContent}
          activeSlug={activeSlug}
          onSelect={setActiveSlug}
        />

        <div className="flex-1 overflow-y-auto">
          {article ? (
            <DocsArticleView article={article} />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
              Selecione um artigo no menu lateral
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

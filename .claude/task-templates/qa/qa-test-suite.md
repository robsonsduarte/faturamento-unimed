# Task: QA — Criar Suite de Testes

## Objetivo
Criar uma suite de testes abrangente cobrindo testes unitarios, de integracao e e2e, com estrategia clara de cobertura, fixtures reutilizaveis e integracao com CI/CD.

## Contexto
Usar quando um modulo, feature ou servico precisa de cobertura de testes estruturada. Diferente de escrever testes pontuais, esta task define a ESTRATEGIA de testes: o que testar em cada nivel, quais cenarios priorizar, e como organizar fixtures e mocks. Ideal para modulos criticos ou antes de refatoracoes grandes.

## Pre-requisitos
- [ ] Codigo a ser testado ja existe e esta funcional
- [ ] Framework de testes configurado (Vitest, Jest, etc)
- [ ] Compreensao dos fluxos criticos do modulo
- [ ] Dependencias externas identificadas (APIs, banco, servicos)

## Passos

### 1. Mapear Superficie de Teste
Identifique todos os pontos testaveis:
```
Modulo: src/lib/services/content-generator.ts

Funcoes publicas:
- generateContent(input: GenerateInput): Promise<Content>
- validateInput(input: unknown): GenerateInput
- formatOutput(raw: RawContent): Content

Dependencias:
- Supabase (banco de dados)
- AI Service (Claude/GPT)
- Rate Limiter
- Logger

Edge cases identificados:
- Input vazio ou parcialmente preenchido
- AI retorna resposta malformada
- Timeout na chamada de AI
- Rate limit excedido
- Credenciais invalidas
```

### 2. Definir Estrategia por Nivel
```
Piramide de testes:

Unit Tests (70% dos testes):
- Funcoes puras: validateInput, formatOutput
- Logica de negocio isolada
- Transformacoes de dados
- Mock de TODAS as dependencias externas

Integration Tests (20% dos testes):
- Fluxo completo de generateContent com banco real (test DB)
- Interacao entre servicos internos
- Validacao + processamento + persistencia

E2E Tests (10% dos testes):
- Fluxo do usuario completo via API
- Autenticacao → Criacao → Listagem → Edicao → Exclusao
```

### 3. Criar Fixtures e Factories
```typescript
// src/lib/__tests__/fixtures/content.ts

export function createMockContent(overrides?: Partial<Content>): Content {
  return {
    id: 'content-001',
    title: 'Conteudo de teste',
    body: 'Lorem ipsum dolor sit amet',
    niche: 'mental',
    status: 'draft',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  }
}

export function createMockGenerateInput(overrides?: Partial<GenerateInput>): GenerateInput {
  return {
    topic: 'Beneficios da meditacao',
    niche: 'mental',
    tone: 'casual',
    maxLength: 500,
    ...overrides,
  }
}

// Factory para cenarios variados
export const contentScenarios = {
  draft: () => createMockContent({ status: 'draft' }),
  published: () => createMockContent({ status: 'published', publishedAt: new Date() }),
  withLongTitle: () => createMockContent({ title: 'A'.repeat(200) }),
  withEmptyBody: () => createMockContent({ body: '' }),
}
```

### 4. Configurar Mocks
```typescript
// src/lib/__tests__/mocks/ai-service.ts

export const mockAiService = {
  generate: vi.fn().mockResolvedValue({
    content: 'Conteudo gerado pelo mock',
    tokens: 150,
    model: 'mock-model',
  }),

  // Cenarios de erro
  simulateTimeout: () => {
    mockAiService.generate.mockRejectedValueOnce(
      new Error('Request timeout after 30000ms')
    )
  },

  simulateRateLimit: () => {
    mockAiService.generate.mockRejectedValueOnce(
      new ExternalServiceError('Rate limit exceeded', 429, true)
    )
  },

  simulateMalformedResponse: () => {
    mockAiService.generate.mockResolvedValueOnce({
      content: null,  // campo obrigatorio ausente
      tokens: -1,
    })
  },

  reset: () => {
    mockAiService.generate.mockReset()
    mockAiService.generate.mockResolvedValue({
      content: 'Conteudo gerado pelo mock',
      tokens: 150,
      model: 'mock-model',
    })
  },
}
```

### 5. Escrever Testes Unitarios
```typescript
// src/lib/__tests__/content-generator.test.ts

describe('ContentGenerator', () => {
  describe('validateInput', () => {
    it('aceita input valido completo', () => {
      const input = createMockGenerateInput()
      expect(() => validateInput(input)).not.toThrow()
    })

    it('rejeita topic vazio', () => {
      const input = createMockGenerateInput({ topic: '' })
      expect(() => validateInput(input)).toThrow('topic e obrigatorio')
    })

    it('rejeita niche invalido', () => {
      const input = createMockGenerateInput({ niche: 'invalido' as NicheType })
      expect(() => validateInput(input)).toThrow('niche invalido')
    })

    it('aplica defaults para campos opcionais', () => {
      const input = { topic: 'Teste', niche: 'mental' }
      const validated = validateInput(input)
      expect(validated.tone).toBe('casual')
      expect(validated.maxLength).toBe(500)
    })
  })

  describe('formatOutput', () => {
    it('formata resposta crua em Content', () => { ... })
    it('trunca conteudo que excede maxLength', () => { ... })
    it('sanitiza HTML do conteudo', () => { ... })
  })

  describe('generateContent', () => {
    beforeEach(() => { mockAiService.reset() })

    it('gera conteudo com sucesso', async () => {
      const input = createMockGenerateInput()
      const result = await generateContent(input)
      expect(result.body).toBe('Conteudo gerado pelo mock')
      expect(mockAiService.generate).toHaveBeenCalledOnce()
    })

    it('faz retry em caso de timeout', async () => {
      mockAiService.simulateTimeout()
      const input = createMockGenerateInput()
      const result = await generateContent(input)
      expect(mockAiService.generate).toHaveBeenCalledTimes(2)
    })

    it('falha apos esgotar retries', async () => {
      mockAiService.generate.mockRejectedValue(new Error('Timeout'))
      await expect(generateContent(createMockGenerateInput())).rejects.toThrow()
    })
  })
})
```

### 6. Escrever Testes de Integracao
```typescript
// src/lib/__tests__/content-generator.integration.test.ts

describe('ContentGenerator (integration)', () => {
  // Usar banco de teste real
  beforeAll(async () => { await setupTestDatabase() })
  afterAll(async () => { await teardownTestDatabase() })
  afterEach(async () => { await cleanupTestData() })

  it('persiste conteudo gerado no banco', async () => {
    const input = createMockGenerateInput()
    const result = await generateContent(input)

    const saved = await db.from('contents').select().eq('id', result.id).single()
    expect(saved.data).toMatchObject({
      title: expect.any(String),
      niche: 'mental',
      status: 'draft',
    })
  })

  it('incrementa uso do usuario', async () => {
    const before = await getUserUsage(testUserId)
    await generateContent(createMockGenerateInput())
    const after = await getUserUsage(testUserId)
    expect(after.generations).toBe(before.generations + 1)
  })
})
```

### 7. Definir Targets de Cobertura
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        // Targets globais
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      include: ['src/lib/services/**'],
      exclude: ['**/__tests__/**', '**/__mocks__/**'],
    },
  },
})
```

### 8. Integrar com CI
```bash
# Comando para CI
npx vitest run --coverage --reporter=junit --outputFile=test-results.xml
```

## Criterios de Aceite
- [ ] Mapa de superficie de teste documentado
- [ ] Fixtures e factories criados para entidades principais
- [ ] Mocks criados para dependencias externas
- [ ] Testes unitarios cobrem funcoes publicas e edge cases
- [ ] Testes de integracao cobrem fluxos criticos
- [ ] Cobertura atinge targets definidos (statements >= 80%)
- [ ] Todos os testes passam de forma deterministica (nao flaky)
- [ ] Testes rodam em menos de 30 segundos
- [ ] Nenhum teste depende de servico externo real

## Entregaveis
- Testes unitarios (`__tests__/*.test.ts`)
- Testes de integracao (`__tests__/*.integration.test.ts`)
- Fixtures e factories (`__tests__/fixtures/`)
- Mocks (`__tests__/mocks/`)
- Configuracao de cobertura atualizada

## Verificacao
- [ ] `npx vitest run` — todos passam
- [ ] `npx vitest run --coverage` — targets atingidos
- [ ] Testes sao determinísticos (rodar 3x sem falha)
- [ ] Novo desenvolvedor entende a suite sem explicacao verbal

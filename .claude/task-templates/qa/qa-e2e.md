# Task: QA — Testes End-to-End

## Objetivo
Criar testes end-to-end para os fluxos criticos da aplicacao, cobrindo a jornada completa do usuario desde a interface ate o banco de dados, com setup reprodutivel e integracao com CI.

## Contexto
Usar para validar fluxos que cruzam multiplas camadas (UI → API → Banco → Servicos externos). E2E testa o sistema como um todo, da perspectiva do usuario. Sao mais lentos e frageis que testes unitarios, entao devem cobrir apenas fluxos criticos (80/20: 20% dos fluxos que representam 80% do valor).

## Pre-requisitos
- [ ] Aplicacao funcional em ambiente de teste
- [ ] Framework de e2e configurado (Playwright, Cypress, etc)
- [ ] Banco de teste com seed data
- [ ] Servicos externos mockados ou em sandbox
- [ ] CI/CD configurado para rodar testes

## Passos

### 1. Identificar Fluxos Criticos
Selecione os fluxos que, se quebrarem, causam maior impacto:
```
Fluxos criticos (DEVE testar):
1. Autenticacao: registro → login → logout
2. Geracao de conteudo: selecionar niche → gerar → visualizar resultado
3. Pagamento: selecionar plano → checkout → creditos adicionados
4. Gerenciamento: criar → editar → deletar conteudo

Fluxos importantes (DEVERIA testar):
5. Onboarding: primeiro acesso → configurar perfil → selecionar niche
6. Biblioteca: buscar → filtrar → exportar
7. Admin: acessar painel → visualizar metricas → gerenciar usuarios

Fluxos secundarios (PODERIA testar):
8. Configuracoes: alterar senha → atualizar perfil
9. Calendario: visualizar → criar evento
```

### 2. Configurar Ambiente de Teste
```typescript
// playwright.config.ts (ou equivalente)
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 2,  // retry para testes flaky
  workers: 1,  // sequencial para evitar conflitos de estado

  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

### 3. Criar Helpers e Page Objects
```typescript
// e2e/helpers/auth.ts
export class AuthHelper {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto('/auth/login')
    await this.page.getByLabel('Email').fill(email)
    await this.page.getByLabel('Senha').fill(password)
    await this.page.getByRole('button', { name: 'Entrar' }).click()
    await this.page.waitForURL('/dashboard')
  }

  async logout() {
    await this.page.getByRole('button', { name: 'Menu do usuario' }).click()
    await this.page.getByRole('menuitem', { name: 'Sair' }).click()
    await this.page.waitForURL('/auth/login')
  }
}

// e2e/helpers/test-data.ts
export const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'TestPassword123!',
  name: 'Usuario E2E',
}

// e2e/helpers/database.ts
export async function seedTestData() {
  // Criar usuario de teste
  // Criar dados iniciais necessarios
}

export async function cleanupTestData() {
  // Remover dados criados durante os testes
  // NUNCA deletar dados que nao foram criados pelo teste
}
```

### 4. Escrever Testes E2E
```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'
import { AuthHelper } from './helpers/auth'
import { TEST_USER } from './helpers/test-data'

test.describe('Autenticacao', () => {
  test.beforeEach(async ({ page }) => {
    // Garantir estado limpo
    await page.goto('/')
  })

  test('login com credenciais validas', async ({ page }) => {
    const auth = new AuthHelper(page)
    await auth.login(TEST_USER.email, TEST_USER.password)

    // Verificar que esta no dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Bem-vindo')).toBeVisible()
  })

  test('login com credenciais invalidas mostra erro', async ({ page }) => {
    const auth = new AuthHelper(page)

    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('invalido@test.com')
    await page.getByLabel('Senha').fill('senhaerrada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('Email ou senha invalidos')).toBeVisible()
    await expect(page).toHaveURL('/auth/login')
  })

  test('redirecionamento para login quando nao autenticado', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('logout limpa sessao', async ({ page }) => {
    const auth = new AuthHelper(page)
    await auth.login(TEST_USER.email, TEST_USER.password)
    await auth.logout()

    // Tentar acessar dashboard apos logout
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

// e2e/content-generation.spec.ts
test.describe('Geracao de Conteudo', () => {
  test.beforeEach(async ({ page }) => {
    const auth = new AuthHelper(page)
    await auth.login(TEST_USER.email, TEST_USER.password)
  })

  test('gerar conteudo end-to-end', async ({ page }) => {
    await page.goto('/dashboard/content/new')

    // Preencher formulario
    await page.getByLabel('Topico').fill('Beneficios do sono para saude mental')
    await page.getByLabel('Nicho').selectOption('mental')
    await page.getByLabel('Tom').selectOption('casual')

    // Iniciar geracao
    await page.getByRole('button', { name: 'Gerar Conteudo' }).click()

    // Aguardar pipeline completar (pode ser lento)
    await expect(page.getByText('Conteudo gerado')).toBeVisible({ timeout: 60000 })

    // Verificar resultado
    await expect(page.getByTestId('content-result')).toBeVisible()
    await expect(page.getByTestId('content-result')).not.toBeEmpty()
  })
})
```

### 5. Tratar Dados de Teste
```typescript
// e2e/global-setup.ts
export default async function globalSetup() {
  // Executar seed de dados ANTES de todos os testes
  await seedTestData()
}

// e2e/global-teardown.ts
export default async function globalTeardown() {
  // Limpar dados DEPOIS de todos os testes
  await cleanupTestData()
}
```
Regras para dados de teste:
- Cada teste deve ser independente (nao depender de outro teste)
- Usar dados deterministicos (nao aleatorios)
- Limpar dados criados no afterEach/afterAll
- Nunca alterar dados compartilhados (read-only)

### 6. Tratar Flakiness
Estrategias para evitar testes instáveis:
```typescript
// Esperar elemento em vez de tempo fixo
// ERRADO:
await page.waitForTimeout(3000)

// CERTO:
await expect(page.getByText('Resultado')).toBeVisible({ timeout: 10000 })

// Esperar rede estabilizar
await page.waitForLoadState('networkidle')

// Esperar request especifica completar
await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/api/content') && resp.status() === 200),
  page.getByRole('button', { name: 'Gerar' }).click(),
])

// Retry para testes naturalmente instáveis
test('teste que depende de servico externo', async ({ page }) => {
  test.slow()  // triplica o timeout
  // ...
})
```

### 7. Integrar com CI
```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-results
          path: |
            test-results/
            playwright-report/
```

### 8. Documentar e Manter
```markdown
## Guia de Testes E2E

### Como rodar
npx playwright test                    # todos os testes
npx playwright test auth.spec.ts       # arquivo especifico
npx playwright test --ui               # modo visual
npx playwright test --debug            # modo debug

### Como adicionar novo teste
1. Identificar fluxo critico
2. Criar spec em e2e/[fluxo].spec.ts
3. Usar page objects existentes (e2e/helpers/)
4. Testar localmente antes de commitar
5. Verificar que CI passa

### Troubleshooting
- Teste falha no CI mas passa local → verificar timeouts e network
- Teste flaky → usar waitForResponse em vez de waitForTimeout
- Teste lento → verificar se pode mockar servico externo
```

## Criterios de Aceite
- [ ] Fluxos criticos identificados e priorizados
- [ ] Ambiente de teste configurado e reprodutivel
- [ ] Page objects e helpers criados para reutilizacao
- [ ] Pelo menos 4 fluxos criticos cobertos com testes
- [ ] Testes sao independentes (nao dependem de ordem)
- [ ] Cleanup de dados funciona corretamente
- [ ] Testes passam em CI de forma consistente (nao flaky)
- [ ] Screenshots e traces gerados em caso de falha
- [ ] Documentacao de como rodar e adicionar testes

## Entregaveis
- Testes e2e (`e2e/*.spec.ts`)
- Page objects e helpers (`e2e/helpers/`)
- Configuracao do framework (`playwright.config.ts`)
- Setup/teardown global
- Pipeline CI para e2e
- Documentacao

## Verificacao
- [ ] Testes passam localmente em 3 execucoes consecutivas
- [ ] Testes passam no CI
- [ ] Falha em teste e2e detectaria bug real (nao e falso positivo)
- [ ] Testes rodam em tempo aceitavel (<5 minutos para suite completa)

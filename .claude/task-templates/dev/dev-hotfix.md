# Task: Dev — Corrigir Bug Urgente em Producao (Hotfix)

## Objetivo
Identificar, diagnosticar e corrigir um bug em producao com agilidade e seguranca, minimizando o impacto para os usuarios e garantindo que a correcao nao introduza novos problemas.

## Contexto
Usar quando um bug em producao esta causando impacto direto nos usuarios: funcionalidade quebrada, erro 500 recorrente, perda de dados, ou degradacao severa de performance. A prioridade e restaurar o servico — otimizacoes e melhorias ficam para depois. Tempo e critico: cada minuto conta.

## Pre-requisitos
- [ ] Acesso aos logs de producao
- [ ] Acesso ao banco de dados de producao (leitura)
- [ ] Ambiente de desenvolvimento funcional
- [ ] Pipeline de deploy disponivel
- [ ] Canal de comunicacao com a equipe aberto

## Passos

### 1. Avaliar Severidade e Impacto
Classifique imediatamente:
```
Severidade:
- P0 (Critico): Sistema fora do ar, perda de dados, seguranca comprometida
  → Acao: Tudo para, todos focam nisso
- P1 (Alto): Feature principal quebrada, afeta >50% dos usuarios
  → Acao: Prioridade maxima, resolver em horas
- P2 (Medio): Feature secundaria quebrada, workaround disponivel
  → Acao: Resolver no mesmo dia
- P3 (Baixo): Bug cosmetico, afeta poucos usuarios
  → Acao: Incluir no proximo sprint
```
Comunique a severidade aos stakeholders imediatamente.

### 2. Reproduzir o Bug
Antes de qualquer fix, confirme que consegue reproduzir:
```
Reproducao:
1. Ambiente: producao / staging / local
2. Usuario afetado: [id ou tipo]
3. Passos para reproduzir:
   a. Acessar [pagina/endpoint]
   b. Executar [acao]
   c. Observar [erro]
4. Resultado atual: [o que acontece]
5. Resultado esperado: [o que deveria acontecer]
6. Frequencia: sempre / intermitente / condicional
```
Se NAO consegue reproduzir: colete mais dados (logs, screenshots, request IDs).

### 3. Investigar Root Cause
Siga a cadeia de evidencias:
```bash
# 1. Verificar logs de erro recentes
# Buscar nos logs de producao pelo erro reportado

# 2. Verificar quando comecou
# Correlacionar com deploys recentes, mudancas de configuracao, picos de trafego

# 3. Verificar metricas
# CPU, memoria, conexoes de banco, latencia, error rate

# 4. Identificar o commit que introduziu o bug (se recente)
# git log --oneline --since="2 days ago"
# git bisect pode ajudar para regressoes
```

Documente a root cause:
```
Root Cause: A funcao `processPayment()` nao trata o caso onde
`subscription.plan_id` e null (usuarios em trial sem plano).
Isso causa um TypeError que crasheia o endpoint.
Introduzido no commit abc1234 (deploy de 2024-01-15).
```

### 4. Avaliar Opcoes de Correcao
```
Opcao A (Hotfix minimo):
- Adicionar null check em processPayment()
- Risco: Baixo — mudanca isolada de 3 linhas
- Tempo: 15 minutos

Opcao B (Correcao completa):
- Refatorar fluxo de pagamento para tratar trials corretamente
- Risco: Medio — mudanca em 5 arquivos
- Tempo: 2 horas

Decisao: Opcao A agora (restaurar servico), Opcao B como follow-up
```
Em hotfix, SEMPRE escolha a opcao de menor risco. Perfeicao fica para depois.

### 5. Implementar a Correcao
```typescript
// ANTES (bugado)
async function processPayment(subscription: Subscription) {
  const plan = await getPlan(subscription.plan_id)  // TypeError se plan_id = null
  return calculatePrice(plan.price)
}

// DEPOIS (corrigido)
async function processPayment(subscription: Subscription) {
  if (!subscription.plan_id) {
    logger.warn({ subscriptionId: subscription.id }, 'Subscription sem plan_id (trial)')
    return { price: 0, isTrial: true }
  }
  const plan = await getPlan(subscription.plan_id)
  return calculatePrice(plan.price)
}
```
Adicione log para monitorar a ocorrencia.

### 6. Escrever Teste que Reproduz o Bug
```typescript
it('deve tratar subscription sem plan_id (trial)', () => {
  const trialSubscription = { id: 'sub-1', plan_id: null, status: 'trialing' }
  const result = processPayment(trialSubscription)
  expect(result).toEqual({ price: 0, isTrial: true })
})
```
O teste deve FALHAR com o codigo antigo e PASSAR com a correcao.

### 7. Validar e Deploy
```bash
# Verificar tipagem
npx tsc --noEmit

# Rodar testes
npx vitest run

# Build
npm run build

# Deploy para staging primeiro (se possivel)
# Testar em staging
# Deploy para producao
```

Para P0/P1: deploy direto para producao e aceitavel se staging nao esta disponivel.

### 8. Monitorar Pos-Deploy
```
Monitoramento pos-deploy (30 minutos):
- [ ] Error rate voltou ao normal
- [ ] Endpoint afetado respondendo 200
- [ ] Logs sem novos erros
- [ ] Usuarios confirmam que funciona

Comunicacao:
- [ ] Stakeholders notificados que o fix foi aplicado
- [ ] Ticket/issue atualizado com root cause e correcao
- [ ] Post-mortem agendado (para P0/P1)
```

## Criterios de Aceite
- [ ] Bug reproduzido e root cause identificada
- [ ] Correcao implementada com minimo de mudancas
- [ ] Teste automatizado reproduz o bug e valida a correcao
- [ ] Tipagem passa sem erros
- [ ] Todos os testes existentes continuam passando
- [ ] Deploy realizado com sucesso
- [ ] Monitoramento pos-deploy confirma resolucao
- [ ] Stakeholders notificados

## Entregaveis
- Correcao de codigo (diff minimo)
- Teste que reproduz o bug
- Root cause documentada (no commit ou ticket)
- Comunicacao de resolucao

## Verificacao
- [ ] Bug nao ocorre mais em producao
- [ ] Nenhum efeito colateral introduzido
- [ ] Post-mortem agendado (para P0/P1)
- [ ] Follow-up task criada para correcao completa (se hotfix foi paliativo)

# Task: QA — Revisar Codigo

## Objetivo
Realizar revisao de codigo sistematica verificando seguranca, performance, legibilidade, padroes do projeto e corretude logica, produzindo feedback acionavel e priorizado.

## Contexto
Usar para revisao de PRs, auditorias de codigo pre-lancamento, ou verificacao de qualidade em modulos criticos. A revisao deve ser objetiva (baseada em criterios), construtiva (sugere alternativas) e priorizada (blocker > importante > sugestao). Nao e sobre estilo pessoal — e sobre corretude, seguranca e manutenibilidade.

## Pre-requisitos
- [ ] Codigo a ser revisado disponivel (PR, diff, ou diretorio)
- [ ] Contexto da mudanca (o que esta sendo feito e por que)
- [ ] Padroes do projeto conhecidos (lint rules, design system, convencoes)
- [ ] Testes existentes identificados

## Passos

### 1. Entender o Contexto
Antes de olhar o codigo, entenda:
- Qual o objetivo da mudanca?
- Qual a spec/ticket/issue relacionada?
- Quais areas do sistema sao afetadas?
- E uma feature nova, bugfix, refactoring ou hotfix?

Isso evita comentarios irrelevantes sobre decisoes ja tomadas.

### 2. Verificar Seguranca
Checklist de seguranca (prioridade maxima — qualquer falha e blocker):

```
Autenticacao/Autorizacao:
- [ ] Endpoints verificam autenticacao (nao confia so no middleware)
- [ ] Autorizacao verifica role/permissao especifica
- [ ] Tokens nao sao logados ou expostos em respostas
- [ ] Session handling segue boas praticas (httpOnly, secure, sameSite)

Validacao de Input:
- [ ] Todo input do usuario e validado (Zod, etc)
- [ ] Nao ha SQL injection (usar queries parametrizadas, nunca concatenar)
- [ ] Nao ha XSS (sanitizar output HTML, usar Content-Security-Policy)
- [ ] File upload valida tipo e tamanho
- [ ] Path traversal prevenido (nao usar input do usuario em caminhos de arquivo)

Dados Sensiveis:
- [ ] Credenciais nao estao hardcoded
- [ ] Logs nao contem PII, tokens ou senhas
- [ ] Erros nao expoe stack traces ao usuario
- [ ] .env nao esta no diff
```

### 3. Verificar Performance
```
Banco de Dados:
- [ ] Queries usam indices (nao fazem full table scan)
- [ ] N+1 queries evitados (usar joins ou batch fetching)
- [ ] Paginacao implementada para listas (nao busca tudo)
- [ ] Transacoes sao curtas (nao seguram locks desnecessarios)

API:
- [ ] Payloads de resposta sao proporcionais ao necessario (nao retorna dados extras)
- [ ] Endpoints pesados tem cache ou sao assincronos
- [ ] Timeouts configurados para chamadas externas
- [ ] Rate limiting aplicado onde necessario

Frontend:
- [ ] Componentes nao re-renderizam desnecessariamente (useMemo, useCallback)
- [ ] Listas grandes usam virtualizacao
- [ ] Imagens sao otimizadas (formatos modernos, lazy loading)
- [ ] Bundle size nao aumentou significativamente
```

### 4. Verificar Legibilidade
```
Naming:
- [ ] Variaveis/funcoes tem nomes descritivos (nao `x`, `data`, `temp`)
- [ ] Booleanos comecam com is/has/should/can
- [ ] Funcoes descrevem acao (verbo + substantivo: `calculateTotal`, `fetchUser`)
- [ ] Constantes em UPPER_SNAKE_CASE

Estrutura:
- [ ] Funcoes tem responsabilidade unica (<50 linhas ideal)
- [ ] Nesting nao excede 3 niveis (usar early return)
- [ ] Logica complexa tem comentarios explicando o "por que"
- [ ] Codigo morto removido (funcoes, imports, variaveis nao usadas)

Tipos:
- [ ] Nenhum `any` (usar tipos especificos ou generics)
- [ ] Interfaces nomeadas para objetos complexos (nao inline repetido)
- [ ] Unions discriminadas para estados mutuamente exclusivos
- [ ] Null/undefined tratados explicitamente
```

### 5. Verificar Padroes do Projeto
```
Convencoes:
- [ ] Segue padrao de diretorio do projeto
- [ ] Usa componentes shadcn/ui (nao elementos nativos)
- [ ] Button usa variant prop (nao className para cores)
- [ ] Focus ring usa focus-visible: (nao focus:)
- [ ] cn() usado para classes condicionais
- [ ] Logger usado em vez de console.log
- [ ] Erros logados com logError() e contexto

Consistencia:
- [ ] Padrao de API route segue convencao existente
- [ ] Tratamento de erros segue padrao do projeto
- [ ] Nomes de variaveis em ingles (exceto dominio de negocio pt-BR)
```

### 6. Verificar Corretude Logica
```
Logica:
- [ ] Condicoes de borda tratadas (null, undefined, array vazio, string vazia)
- [ ] Loops tem condicao de parada garantida
- [ ] Async/await com try/catch adequado
- [ ] Race conditions prevenidas (locks, transactions, idempotencia)
- [ ] Estado impossivel e impossivel (tipos previnem combinacoes invalidas)

Testes:
- [ ] Testes existem para a mudanca
- [ ] Testes cobrem happy path e cenarios de erro
- [ ] Testes nao sao frageis (nao dependem de ordem, timing, ou estado externo)
- [ ] Mocks sao realistas (nao mascaram bugs)
```

### 7. Classificar e Priorizar Feedback
Organize os achados:
```markdown
## Blockers (deve corrigir antes de merge)
1. **[SEGURANCA]** `src/app/api/users/route.ts:45` — Endpoint nao verifica autenticacao.
   Qualquer usuario pode acessar dados de outros.
   Sugestao: adicionar verificacao com `supabase.auth.getUser()`.

## Importantes (deveria corrigir)
2. **[PERFORMANCE]** `src/lib/services/feed.ts:120` — Query busca todos os registros sem paginacao.
   Com 10k+ registros, isso vai causar timeout.
   Sugestao: adicionar `.range(offset, offset + limit)`.

## Sugestoes (nice to have)
3. **[LEGIBILIDADE]** `src/hooks/use-content.ts:30` — Variavel `d` pouco descritiva.
   Sugestao: renomear para `contentData` ou `fetchedContent`.
```

### 8. Redigir Feedback Construtivo
Para cada item:
- Aponte O QUE esta errado (com linha e arquivo)
- Explique POR QUE e um problema
- Sugira COMO corrigir (com codigo se possivel)
- Nunca seja pessoal ("voce fez errado") — foque no codigo ("esse trecho pode melhorar")

## Criterios de Aceite
- [ ] Checklist de seguranca completo executado
- [ ] Performance verificada (queries, payloads, re-renders)
- [ ] Legibilidade avaliada (naming, estrutura, tipos)
- [ ] Padroes do projeto verificados
- [ ] Corretude logica avaliada (edge cases, async, testes)
- [ ] Feedback classificado por prioridade (blocker/importante/sugestao)
- [ ] Cada item de feedback tem localizacao, explicacao e sugestao
- [ ] Nenhum blocker de seguranca pendente

## Entregaveis
- Relatorio de revisao com achados priorizados
- Lista de blockers que impedem merge
- Sugestoes de melhoria com exemplos de codigo

## Verificacao
- [ ] Autor do codigo entende cada ponto de feedback
- [ ] Blockers foram corrigidos antes do merge
- [ ] Testes continuam passando apos correcoes
- [ ] Revisao foi util (nao so nitpicks)

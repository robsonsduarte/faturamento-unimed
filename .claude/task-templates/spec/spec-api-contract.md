# Task: Spec — Definir Contrato de API

## Objetivo
Produzir um contrato de API completo e inequivoco, com endpoints, schemas de request/response, autenticacao, codigos de erro e exemplos praticos, servindo como fonte de verdade para frontend e backend.

## Contexto
Usar antes de implementar novos endpoints ou alterar endpoints existentes. Especialmente importante quando frontend e backend serao desenvolvidos em paralelo, ou quando a API sera consumida por terceiros. O contrato deve ser suficiente para gerar mocks e iniciar o desenvolvimento do cliente.

## Pre-requisitos
- [ ] Requisitos funcionais da feature definidos
- [ ] Padroes de API existentes no projeto identificados (prefixos, versionamento, formato de resposta)
- [ ] Mecanismo de autenticacao do projeto conhecido (JWT, session, API key)
- [ ] Entidades de dominio envolvidas mapeadas

## Passos

### 1. Inventariar Endpoints
Para cada operacao necessaria, defina:
```
[METODO] /api/[dominio]/[recurso]
Descricao: O que este endpoint faz
Autenticacao: Requerida/Publica
Roles permitidas: admin, user, etc.
```
Siga os padroes REST: GET (listar/buscar), POST (criar), PUT/PATCH (atualizar), DELETE (remover).

### 2. Definir Schemas de Request
Para cada endpoint com body, especifique:
```typescript
// POST /api/content/generate
interface GenerateContentRequest {
  topic: string          // obrigatorio, max 200 chars
  niche: NicheType       // obrigatorio, enum definido
  tone?: 'formal' | 'casual' | 'tecnico'  // opcional, default: 'casual'
  max_length?: number    // opcional, default: 500, min: 100, max: 2000
}
```
Inclua: tipos, obrigatoriedade, validacoes (min, max, regex, enum), valores default.

### 3. Definir Schemas de Response
Para cada endpoint, especifique respostas de sucesso E erro:
```typescript
// 200 OK
interface GenerateContentResponse {
  id: string
  content: string
  metadata: {
    tokens_used: number
    model: string
    generated_at: string  // ISO 8601
  }
}

// 400 Bad Request
interface ErrorResponse {
  error: string          // codigo do erro (ex: 'INVALID_TOPIC')
  message: string        // mensagem legivel
  details?: Record<string, string[]>  // erros por campo
}
```

### 4. Mapear Codigos de Status HTTP
Documente cada codigo retornado e quando ocorre:
| Status | Quando |
|--------|--------|
| 200 | Operacao bem-sucedida |
| 201 | Recurso criado com sucesso |
| 400 | Validacao falhou (body invalido) |
| 401 | Token ausente ou expirado |
| 403 | Sem permissao para este recurso |
| 404 | Recurso nao encontrado |
| 409 | Conflito (ex: email ja cadastrado) |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |

### 5. Especificar Query Parameters
Para endpoints de listagem/busca:
```
GET /api/content?page=1&limit=20&sort=created_at&order=desc&status=published&search=termo
```
Defina: tipo de cada param, valores permitidos, defaults, paginacao (offset vs cursor).

### 6. Documentar Headers
```
Authorization: Bearer <token>
Content-Type: application/json
X-Request-ID: uuid  (opcional, para rastreabilidade)
```
Defina headers customizados se necessario (rate limit info, paginacao, etc).

### 7. Criar Exemplos Completos
Para cada endpoint, forneca pelo menos um exemplo com curl:
```bash
curl -X POST https://api.example.com/api/content/generate \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Beneficios do sono para saude mental",
    "niche": "mental",
    "tone": "casual"
  }'
```
E a resposta esperada completa.

### 8. Definir Rate Limiting
Especifique limites por endpoint ou grupo:
- Endpoints de leitura: X requests/minuto
- Endpoints de escrita: Y requests/minuto
- Endpoints de geracao (AI): Z requests/hora
- Headers de resposta: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Criterios de Aceite
- [ ] Todos os endpoints listados com metodo, path e descricao
- [ ] Schemas de request com tipos, validacoes e valores default
- [ ] Schemas de response para sucesso (2xx) e todos os erros possiveis
- [ ] Codigos HTTP mapeados com explicacao de quando ocorrem
- [ ] Pelo menos 1 exemplo curl completo por endpoint
- [ ] Autenticacao e autorizacao especificadas por endpoint
- [ ] Rate limiting definido
- [ ] Contrato e versionavel (nao quebra clientes existentes)

## Entregaveis
- Documento de contrato de API (markdown)
- TypeScript interfaces de request/response (copiaveis para o codebase)
- Exemplos curl para cada endpoint
- Tabela de codigos de erro

## Verificacao
- [ ] Frontend consegue criar mocks a partir do contrato sem perguntar ao backend
- [ ] Backend consegue implementar sem ambiguidades
- [ ] Nenhum endpoint tem comportamento indefinido para inputs inesperados
- [ ] Contrato e consistente com padroes ja existentes na API

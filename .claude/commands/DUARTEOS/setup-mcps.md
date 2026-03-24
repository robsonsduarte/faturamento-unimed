# Setup MCPs — Configuracao de MCP Servers

Configure os MCP Servers do projeto. Cada servidor adiciona ferramentas externas ao Claude Code.

## MCPs Incluidos (16 servidores)

### Busca e Pesquisa
| MCP Server | Pacote | O que faz | API Key |
|------------|--------|-----------|---------|
| **Context7** | `@upstash/context7-mcp` | Documentacao atualizada de bibliotecas (Next.js, React, etc) | Nao (free tier) |
| **EXA** | `exa-mcp-server` | Busca web avancada, codigo, pesquisa de empresas, crawling | Sim (gratis $15) |
| **Fetch** | `@modelcontextprotocol/server-fetch` | Busca URLs e converte HTML para Markdown | Nao |

### Conteudo
| MCP Server | Pacote | O que faz | API Key |
|------------|--------|-----------|---------|
| **YouTube Transcript** | `@kimtaeyoon83/mcp-server-youtube-transcript` | Extrai transcricoes de videos do YouTube | Nao |

### Banco de Dados
| MCP Server | Pacote | O que faz | API Key |
|------------|--------|-----------|---------|
| **Redis** | `@modelcontextprotocol/server-redis` | Persistencia de contexto, cache, sessoes, key-value store | URL de conexao |

### Desenvolvimento
| MCP Server | Pacote | O que faz | API Key |
|------------|--------|-----------|---------|
| **GitHub** | `@modelcontextprotocol/server-github` | Issues, PRs, repos, code search, actions, security | PAT (gratis) |
| **REST API** | `dkmaker-mcp-rest-api` | Chama qualquer REST API (GET, POST, PUT, PATCH, DELETE) | Depende da API |
| **Supabase** | `mcp-remote` | Acesso direto ao projeto Supabase (DB, auth, storage) | Project ref |
| **CodeRabbit** | `coderabbitai-mcp` | Code review com IA: 40+ analyzers, seguranca, bugs, edge cases | GitHub PAT |

### Automacao e Produtividade
| MCP Server | Pacote | O que faz | API Key |
|------------|--------|-----------|---------|
| **n8n** | `n8n-mcp` | Gerencia workflows de automacao n8n | API Key local |
| **Google Workspace** | `workspace-mcp` (uvx) | Gmail, Drive, Calendar, Docs, Sheets, Slides, Forms, Tasks, Contacts | OAuth (gratis) |
| **Obsidian** | `@mauricio.wolff/mcp-obsidian` | Acessa e edita notas do Obsidian vault | Nao (path local) |

### Raciocinio e Memoria
| MCP Server | Pacote | O que faz | API Key |
|------------|--------|-----------|---------|
| **Memory** | `@modelcontextprotocol/server-memory` | Grafo de conhecimento persistente entre sessoes | Nao |
| **Sequential Thinking** | `@modelcontextprotocol/server-sequential-thinking` | Raciocinio estruturado passo-a-passo para problemas complexos | Nao |

## Como Configurar

### 1. Obter API Keys

Edite o `.mcp.json` na raiz do projeto e substitua as variaveis `${...}` pelos valores reais:

| Variavel | Onde obter | Tier gratuito |
|----------|-----------|---------------|
| `EXA_API_KEY` | [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys) | $15 USD credito |
| `GITHUB_PAT` | [github.com/settings/tokens](https://github.com/settings/tokens) | Ilimitado |
| `GOOGLE_OAUTH_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | Ilimitado |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Mesmo local acima | Ilimitado |
| `REST_API_BASE_URL` | URL base da sua API | — |
| `SUPABASE_PROJECT_REF` | Dashboard Supabase → Settings → General | Ilimitado |
| `N8N_API_URL` | URL da instancia n8n (ex: `http://localhost:5678`) | Self-hosted |
| `N8N_API_KEY` | n8n → Settings → API | Self-hosted |
| `OBSIDIAN_VAULT_PATH` | Caminho local do vault (ex: `/Users/voce/Documents/Obsidian Vault`) | Local |
| `REDIS_URL` | Local: `redis://localhost:6379` / Cloud: [Upstash](https://upstash.com) ou [Redis Cloud](https://redis.io/cloud/) | Free tier |

### 2. Configurar Google Workspace (se usar)

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto ou use existente
3. Ative as APIs: Drive, Gmail, Calendar, Docs, Sheets, Slides, Forms, Tasks
4. Crie credenciais OAuth 2.0 tipo "Desktop Application"
5. Copie Client ID e Client Secret para o `.mcp.json`
6. Na primeira execucao, o browser abre para autorizacao OAuth

**Requer `uvx` instalado:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 3. Configurar GitHub

Crie um Personal Access Token (PAT) com escopos:
- `repo` — acesso a repositorios
- `read:org` — ler organizacoes
- `read:packages` — ler packages

### 4. Configurar Supabase

1. Acesse o Dashboard Supabase do seu projeto
2. Va em Settings → General → copie o "Reference ID"
3. Substitua `${SUPABASE_PROJECT_REF}` no `.mcp.json`
4. Na primeira execucao, autentique via browser

### 5. Configurar n8n

1. Tenha uma instancia n8n rodando (local ou cloud)
2. Va em Settings → API → gere uma API Key
3. Configure `N8N_API_URL` e `N8N_API_KEY` no `.mcp.json`

### 6. Configurar Redis

**Local (Docker):**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
# REDIS_URL=redis://localhost:6379
```

**Cloud (Upstash — free tier):**
1. Crie conta em [upstash.com](https://upstash.com)
2. Crie um database Redis
3. Copie a URL de conexao (formato: `redis://default:senha@host:porta`)
4. Configure `REDIS_URL` no `.env`

**Cloud (Redis Cloud — free tier):**
1. Crie conta em [redis.io/cloud](https://redis.io/cloud/)
2. Crie um database gratuito (30MB)
3. Copie host, porta e senha
4. Configure `REDIS_URL=redis://default:senha@host:porta`

### 7. Configurar CodeRabbit

O CodeRabbit usa o mesmo `GITHUB_PAT` do GitHub MCP. Funcionalidades:
- Code review automatico em PRs
- 40+ analyzers (seguranca, performance, bugs, edge cases)
- AST parsing e analise semantica
- Sugestoes implementaveis pelo Claude Code

### 8. Configurar Obsidian

1. Localize o path do seu Obsidian Vault
2. Substitua `${OBSIDIAN_VAULT_PATH}` no `.mcp.json` pelo caminho completo

### 10. Verificar Instalacao

No Claude Code, execute:
```
/mcp
```

Todos os servidores configurados devem aparecer com status verde.

## MCPs que NAO precisam de API Key

Estes funcionam imediatamente apos o `init`:

- **Context7** — documentacao de bibliotecas (free tier automatico)
- **YouTube Transcript** — extrai transcricoes sem auth
- **Memory** — grafo de conhecimento local
- **Sequential Thinking** — raciocinio estruturado
- **Fetch** — busca URLs publicas

## Uso nos Agentes

Os agentes do squad podem usar MCPs automaticamente:

| Agente | MCPs uteis |
|--------|-----------|
| **PM** | Context7 (docs), Memory (decisoes), EXA (pesquisa), n8n (automacoes) |
| **Arquiteto** | Context7 (docs), GitHub (codigo), EXA (exemplos), Supabase (schema) |
| **Backend** | Context7 (docs), REST API (testar endpoints), GitHub, Supabase |
| **Frontend** | Context7 (docs), Fetch (referencias visuais), YouTube (tutoriais) |
| **QA** | GitHub (issues), REST API (testar APIs), CodeRabbit (code review), Supabase (dados) |
| **Context Engineer** | YouTube Transcript (conteudo), EXA (pesquisa), Obsidian (notas), Redis (contexto) |
| **Devil's Advocate** | EXA (alternativas + benchmarks), Sequential Thinking, CodeRabbit |

## Desativar um MCP

Para desativar um MCP que nao usa, remova a entrada correspondente do `.mcp.json`.

## Adicionar Novos MCPs

Formato padrao no `.mcp.json`:

```json
{
  "mcpServers": {
    "nome-do-servidor": {
      "command": "npx",
      "args": ["-y", "pacote-npm"],
      "env": {
        "CHAVE": "valor"
      }
    }
  }
}
```

Ou via CLI:
```bash
claude mcp add nome-do-servidor -- npx -y pacote-npm
```

Catalogo de MCPs: [github.com/punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)

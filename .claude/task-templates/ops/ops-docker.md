# Task: Ops — Dockerizar Aplicacao

## Objetivo
Criar configuracao Docker completa com Dockerfile otimizado, docker-compose para desenvolvimento, networking, volumes persistentes e builds multi-stage para producao.

## Contexto
Usar ao containerizar uma aplicacao existente ou configurar novo ambiente de desenvolvimento com Docker. O objetivo e ter ambientes reprodutiveis: "funciona na minha maquina" deve significar "funciona em qualquer maquina com Docker". Imagem de producao deve ser a menor possivel.

## Pre-requisitos
- [ ] Docker e Docker Compose instalados
- [ ] Aplicacao funcional localmente
- [ ] Dependencias de sistema identificadas (ffmpeg, sharp, canvas, etc)
- [ ] Portas e servicos necessarios mapeados

## Passos

### 1. Criar Dockerfile Multi-Stage
```dockerfile
# ============================================
# Stage 1: Dependencias
# ============================================
FROM node:20-alpine AS deps

# Dependencias de sistema para compilacao nativa
RUN apk add --no-cache \
  libc6-compat \
  python3 \
  make \
  g++

WORKDIR /app

# Copiar apenas package files primeiro (cache de layers)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts=false

# ============================================
# Stage 2: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variaveis de build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ============================================
# Stage 3: Runtime (producao)
# ============================================
FROM node:20-alpine AS runner

# Dependencias de runtime (apenas o necessario)
RUN apk add --no-cache \
  ffmpeg \
  libass \
  curl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

WORKDIR /app

# Copiar apenas artefatos necessarios
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Diretorio temporario para processamento
RUN mkdir -p /app/tmp && chown nextjs:nodejs /app/tmp

USER nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### 2. Criar .dockerignore
```
# .dockerignore
node_modules
.next
.git
.github
.env*
.env.local
*.md
tests/
e2e/
coverage/
.vscode/
.idea/
docker-compose*.yml
Dockerfile*
.dockerignore
```

### 3. Criar Docker Compose para Desenvolvimento
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: development
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules  # Nao sobrescrever node_modules do container
      - /app/.next          # Cache de build separado
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

volumes:
  redis-data:

networks:
  app-network:
    driver: bridge
```

### 4. Criar Dockerfile de Desenvolvimento
```dockerfile
# Dockerfile.dev
FROM node:20-alpine AS development

RUN apk add --no-cache \
  ffmpeg \
  libass \
  python3 \
  make \
  g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

### 5. Configurar Docker Compose para Producao
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '2.0'
        reservations:
          memory: 512M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

### 6. Otimizar Imagem
```
Checklist de otimizacao:

Tamanho:
- [ ] Multi-stage build (deps → build → runner)
- [ ] Alpine como base (node:20-alpine, nao node:20)
- [ ] .dockerignore exclui arquivos desnecessarios
- [ ] Copiar apenas artefatos necessarios no stage final
- [ ] npm ci em vez de npm install (deterministico)

Cache de Layers:
- [ ] COPY package*.json primeiro (muda menos)
- [ ] npm ci logo apos (cache se package.json nao mudou)
- [ ] COPY codigo fonte depois (muda frequentemente)

Seguranca:
- [ ] Rodar como usuario nao-root (USER nextjs)
- [ ] Nao incluir .env no build
- [ ] Nao instalar ferramentas de debug em producao
- [ ] Sem secrets no Dockerfile (usar env vars ou secrets)

Performance:
- [ ] HEALTHCHECK configurado
- [ ] Limites de recursos definidos (memory, cpu)
- [ ] Logging com rotacao configurada
```

### 7. Testar Builds
```bash
# Build de desenvolvimento
docker compose build
docker compose up -d
docker compose logs -f app

# Build de producao
docker build -t myapp:latest --target runner .
docker run -p 3000:3000 --env-file .env.production myapp:latest

# Verificar tamanho da imagem
docker images myapp
# Target: <500MB para Next.js com ffmpeg

# Verificar que healthcheck funciona
docker inspect --format='{{json .State.Health}}' container_id

# Testar em ambiente limpo
docker system prune -a
docker compose build --no-cache
docker compose up
```

### 8. Documentar
```markdown
## Docker — Guia de Uso

### Desenvolvimento
docker compose up       # Subir todos os servicos
docker compose down     # Parar e remover containers
docker compose logs -f  # Ver logs em tempo real
docker compose exec app sh  # Shell no container

### Producao
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f

### Rebuild (apos mudancas em dependencias)
docker compose build --no-cache
docker compose up -d

### Troubleshooting
# Ver uso de recursos
docker stats

# Inspecionar container
docker inspect app

# Limpar tudo (CUIDADO: remove volumes!)
docker system prune -a --volumes
```

## Criterios de Aceite
- [ ] Dockerfile multi-stage (deps, build, runner)
- [ ] Imagem de producao menor que 500MB
- [ ] .dockerignore configurado
- [ ] Docker Compose para dev (com hot reload via volumes)
- [ ] Docker Compose para producao (com healthcheck e limites)
- [ ] Container roda como usuario nao-root
- [ ] Healthcheck configurado e funcional
- [ ] Build reprodutivel (mesmo Dockerfile gera mesmo resultado)
- [ ] Secrets nao estao no Dockerfile ou imagem
- [ ] Logging com rotacao configurada

## Entregaveis
- `Dockerfile` (producao, multi-stage)
- `Dockerfile.dev` (desenvolvimento)
- `docker-compose.yml` (desenvolvimento)
- `docker-compose.prod.yml` (producao)
- `.dockerignore`
- Documentacao de uso

## Verificacao
- [ ] `docker compose up` sobe o ambiente de dev funcional
- [ ] Aplicacao acessivel em `http://localhost:3000`
- [ ] Hot reload funciona (editar codigo → ver mudanca)
- [ ] Build de producao funciona e imagem esta otimizada
- [ ] Healthcheck retorna sucesso apos startup

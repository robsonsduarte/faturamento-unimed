# Task: DB — Projetar Schema de Banco

## Objetivo
Projetar um schema de banco de dados normalizado, com entidades bem definidas, relacionamentos claros, tipos adequados, constraints de integridade e consideracoes de performance, pronto para ser implementado como migracao.

## Contexto
Usar no inicio de um projeto ou feature que requer novas estruturas de dados. O schema design acontece ANTES da implementacao e deve considerar nao apenas as necessidades atuais mas tambem a evolucao provavel do sistema. Um schema bem projetado evita migracoes dolorosas no futuro.

## Pre-requisitos
- [ ] Requisitos funcionais definidos (o que o sistema precisa armazenar)
- [ ] Entidades de dominio identificadas
- [ ] Volumetria estimada (quantos registros, taxa de crescimento)
- [ ] Padroes de acesso conhecidos (quais queries serao mais frequentes)
- [ ] Schema existente conhecido (para integrar com o que ja existe)

## Passos

### 1. Identificar Entidades e Atributos
Liste todas as entidades do dominio:
```
Entidade: Content (Conteudo)
Atributos:
  - id: identificador unico
  - user_id: quem criou
  - title: titulo (obrigatorio, max 200)
  - body: corpo do conteudo (texto livre)
  - niche: nicho de saude (enum)
  - status: estado atual (enum: draft, published, archived)
  - format: formato do conteudo (enum: video, carousel, single_image)
  - metadata: dados extras flexiveis (JSON)
  - created_at: quando foi criado
  - updated_at: ultima modificacao
  - published_at: quando foi publicado (nullable)

Entidade: ContentTag (Associacao Content-Tag)
...

Entidade: Tag
...
```

### 2. Definir Relacionamentos
Mapeie como as entidades se relacionam:
```
profiles (1) ←→ (N) contents
  Um usuario tem muitos conteudos
  Conteudo pertence a um usuario
  FK: contents.user_id → profiles.id

contents (N) ←→ (N) tags
  Conteudo pode ter muitas tags
  Tag pode estar em muitos conteudos
  Tabela associativa: content_tags

profiles (1) ←→ (1) user_subscriptions
  Um usuario tem uma assinatura ativa
  FK: user_subscriptions.user_id → profiles.id

contents (1) ←→ (N) content_versions
  Conteudo pode ter muitas versoes (historico)
  FK: content_versions.content_id → contents.id
```

### 3. Normalizar ate 3FN
Verifique cada tabela:
```
1NF (Primeira Forma Normal):
- [ ] Todos os atributos sao atomicos (nao ha arrays em colunas, exceto JSONB intencional)
- [ ] Cada linha e unica (tem PK)

2NF (Segunda Forma Normal):
- [ ] Todos os atributos dependem da PK inteira (nao de parte dela)
- [ ] Em tabelas com PK composta, nao ha dependencia parcial

3NF (Terceira Forma Normal):
- [ ] Nenhum atributo nao-chave depende de outro atributo nao-chave
- [ ] Ex: Se content tem author_name, mas author_name depende de user_id → mover para profiles

Desnormalizacao INTENCIONAL (documentar o motivo):
- content.author_name (cache do nome para evitar JOIN em listagens de alto volume)
  Motivo: Query de listagem publica faz 100k requests/dia
  Trade-off: Precisa atualizar quando perfil muda (trigger)
```

### 4. Escolher Tipos de Dados
```sql
-- Guia de tipos para PostgreSQL

-- Identificadores
id UUID DEFAULT gen_random_uuid()  -- Sempre UUID para PKs (nao SERIAL)

-- Texto
name VARCHAR(100)        -- Texto curto com limite definido
slug VARCHAR(100) UNIQUE -- Identificador URL-friendly
body TEXT                -- Texto sem limite
email VARCHAR(255)       -- RFC 5321 permite ate 254

-- Numeros
price_cents INTEGER      -- Dinheiro SEMPRE em centavos (evitar DECIMAL)
quantity SMALLINT         -- Ate 32k (economiza espaco)
count BIGINT             -- Contadores que podem crescer muito

-- Enums (preferir CHECK constraints sobre tipo ENUM)
status VARCHAR(20) CHECK (status IN ('draft', 'published', 'archived'))
-- Por que nao CREATE TYPE enum? Adicionar valor em enum requer ALTER TYPE,
-- que pode ser problematico. VARCHAR + CHECK e mais flexivel.

-- Datas
created_at TIMESTAMPTZ DEFAULT NOW()  -- SEMPRE com timezone
updated_at TIMESTAMPTZ DEFAULT NOW()  -- Atualizado via trigger
deleted_at TIMESTAMPTZ               -- Soft delete (nullable)

-- JSON
metadata JSONB DEFAULT '{}'  -- JSONB (nao JSON) — indexavel e mais eficiente
settings JSONB DEFAULT '{}'  -- Para dados semi-estruturados

-- Boolean
is_active BOOLEAN DEFAULT TRUE
is_verified BOOLEAN DEFAULT FALSE
```

### 5. Definir Constraints
```sql
-- Primary Keys
PRIMARY KEY (id)

-- Foreign Keys (com ON DELETE definido)
REFERENCES profiles(id) ON DELETE CASCADE    -- Deletar cascata
REFERENCES plans(id) ON DELETE RESTRICT      -- Impedir delete se referenciado
REFERENCES categories(id) ON DELETE SET NULL -- Setar null se referencia deletada

-- Unique
UNIQUE (email)                              -- Unicidade simples
UNIQUE (user_id, slug)                      -- Unicidade composta

-- Check
CHECK (price_cents >= 0)                    -- Validacao de valor
CHECK (status IN ('draft', 'published', 'archived'))
CHECK (length(title) >= 1)                  -- Nao permitir vazio

-- Not Null
title VARCHAR(200) NOT NULL                 -- Campos obrigatorios
user_id UUID NOT NULL                       -- FKs sempre NOT NULL (se obrigatorio)

-- Default
created_at TIMESTAMPTZ DEFAULT NOW()
status VARCHAR(20) DEFAULT 'draft'
metadata JSONB DEFAULT '{}'
```

### 6. Planejar Indices
```sql
-- Regra: criar indice para cada padrao de query frequente

-- Queries por FK (quase sempre necessario)
CREATE INDEX idx_contents_user_id ON contents(user_id);

-- Queries com filtros compostos
CREATE INDEX idx_contents_user_status ON contents(user_id, status);

-- Queries com ORDER BY
CREATE INDEX idx_contents_user_date ON contents(user_id, created_at DESC);

-- Busca full-text
CREATE INDEX idx_contents_search ON contents USING gin(
  to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(body, ''))
);

-- Indice parcial (para status comum)
CREATE INDEX idx_contents_published ON contents(created_at DESC)
  WHERE status = 'published';

-- JSONB
CREATE INDEX idx_contents_metadata ON contents USING gin(metadata);
```

### 7. Criar Diagrama ERD
```
┌──────────────┐     ┌──────────────────┐     ┌──────────┐
│   profiles   │     │    contents      │     │   tags   │
├──────────────┤     ├──────────────────┤     ├──────────┤
│ id (PK)      │←─┐  │ id (PK)          │  ┌──│ id (PK)  │
│ name         │  │  │ user_id (FK) ────│──┘  │ name     │
│ email        │  │  │ title            │     │ slug     │
│ role         │  │  │ body             │     │ color    │
│ niche        │  │  │ niche            │     └──────────┘
│ created_at   │  │  │ status           │          │
└──────────────┘  │  │ format           │          │
                  │  │ metadata (JSONB) │     ┌────┴──────────┐
                  │  │ created_at       │     │ content_tags  │
                  │  │ updated_at       │     ├───────────────┤
                  │  └──────────────────┘     │ content_id(FK)│
                  │          │                │ tag_id (FK)   │
                  │          │                │ PK(content_id,│
                  │     ┌────┴────────────┐   │    tag_id)    │
                  │     │content_versions │   └───────────────┘
                  │     ├─────────────────┤
                  └─────│ content_id (FK) │
                        │ version         │
                        │ data (JSONB)    │
                        │ created_at      │
                        └─────────────────┘
```

### 8. Revisar e Documentar
Checklist final:
```
Revisao:
- [ ] Cada tabela tem proposito claro (nao e dump generico)
- [ ] Nao ha redundancia nao-intencional
- [ ] FKs garantem integridade referencial
- [ ] ON DELETE definido para cada FK
- [ ] Tipos de dados sao os menores possiveis para o dominio
- [ ] Indices planejados para queries conhecidas
- [ ] JSONB usado apenas para dados genuinamente flexiveis
- [ ] Timestamps usam TIMESTAMPTZ (com timezone)
- [ ] Dinheiro em centavos (INTEGER, nao DECIMAL)
- [ ] Enums via CHECK (nao CREATE TYPE)
```

## Criterios de Aceite
- [ ] Todas as entidades do dominio representadas
- [ ] Relacionamentos com cardinalidade definida (1:1, 1:N, N:N)
- [ ] Normalizado ate 3FN (desnormalizacoes intencionais documentadas)
- [ ] Tipos de dados adequados para cada coluna
- [ ] Constraints definidas (PK, FK, UNIQUE, CHECK, NOT NULL, DEFAULT)
- [ ] Indices planejados para queries frequentes
- [ ] Diagrama ERD legivel
- [ ] Estimativa de volume por tabela
- [ ] Schema e compativel com RLS do Supabase

## Entregaveis
- Diagrama ERD (ASCII, mermaid ou ferramenta visual)
- Documentacao de entidades com tipos e constraints
- SQL de criacao (pronto para migracao)
- Lista de indices recomendados com justificativa
- Estimativa de volume e crescimento

## Verificacao
- [ ] Schema suporta todos os use cases identificados
- [ ] Queries principais funcionam eficientemente no schema proposto
- [ ] Nenhuma entidade esta "sobrando" ou faltando
- [ ] Schema e extensivel (adicionar novos campos nao quebra existentes)
- [ ] Revisado por pelo menos 1 outro desenvolvedor

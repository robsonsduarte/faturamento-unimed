# Squad: Sync IDE — Gerar Configs para Outras IDEs

Gera arquivos de configuracao para Cursor, Windsurf e GitHub Copilot
a partir das configuracoes do DuarteOS.

## Uso

/DUARTEOS:squad:sync-ide              — gera para todas IDEs habilitadas em project.yaml
/DUARTEOS:squad:sync-ide cursor       — gera apenas para Cursor (.cursorrules)
/DUARTEOS:squad:sync-ide windsurf     — gera apenas para Windsurf (.windsurfrules)
/DUARTEOS:squad:sync-ide copilot      — gera apenas para GitHub Copilot (.github/copilot-instructions.md)

## Como funciona

### 1. Coletar Contexto

Leia os seguintes documentos fonte:
- `.claude/protocols/CONSTITUTION.md` — principios inviolaveis
- `.claude/protocols/GOVERNANCE.md` — convencoes de nomenclatura
- `.claude/config/project.yaml` — configuracoes do projeto
- `.claude/CLAUDE.md` — instrucoes do projeto (se existir)

### 2. Verificar IDEs Habilitadas

Leia `ide_sync` em `.claude/config/project.yaml`:
```yaml
ide_sync:
  cursor: true/false
  windsurf: true/false
  copilot: true/false
```

Se argumento especifico foi passado (ex: `cursor`), gere apenas para essa IDE.
Se nenhum argumento, gere para todas habilitadas.

### 3. Gerar Configs

Para cada IDE habilitada:
1. Leia o template em `.claude/ide-templates/{ide}.md.tmpl`
2. Substitua os placeholders com informacoes do projeto:
   - `{{PROJECT_OVERVIEW}}` — extraido do CLAUDE.md ou project.yaml
   - `{{TECH_STACK}}` — extraido do CLAUDE.md ou detectado do projeto
   - `{{CODE_STYLE}}` — convencoes de codigo do projeto
   - `{{ARCHITECTURE_RULES}}` — regras arquiteturais do CLAUDE.md
   - `{{SECURITY_RULES}}` — resumo da Constitution (artigos de seguranca)
   - `{{TESTING_RULES}}` — regras de teste do projeto
3. Escreva o arquivo no destino:
   - Cursor: `.cursorrules`
   - Windsurf: `.windsurfrules`
   - Copilot: `.github/copilot-instructions.md`

### 4. Reportar

Liste os arquivos gerados/atualizados com seus paths.
Avise se alguma IDE habilitada nao pode ser gerada (template missing, etc).

## Regras

- Sempre ler os documentos fonte ANTES de gerar
- Nunca inventar informacoes — use apenas o que existe nos documentos
- Se CLAUDE.md nao existir, use defaults minimos
- Manter header de "auto-gerado" em cada arquivo para evitar edicao manual
- Criar diretorio `.github/` se nao existir (para copilot)

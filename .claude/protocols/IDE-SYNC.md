# Protocolo IDE Sync — Sincronizacao Multi-IDE

## Visao Geral

O DuarteOS gera configuracoes para multiplas IDEs a partir de uma fonte unica.
Isso garante que as regras do projeto sejam aplicadas independente da ferramenta.

## IDEs Suportadas

| IDE | Arquivo Gerado | Template |
|-----|----------------|----------|
| Claude Code | `.claude/CLAUDE.md` | (nativo, ja existe) |
| Cursor | `.cursorrules` | `.claude/ide-templates/cursor.md.tmpl` |
| Windsurf | `.windsurfrules` | `.claude/ide-templates/windsurf.md.tmpl` |
| GitHub Copilot | `.github/copilot-instructions.md` | `.claude/ide-templates/copilot.md.tmpl` |

## Como Funciona

1. O comando `/DUARTEOS:squad:sync-ide` le:
   - `.claude/protocols/CONSTITUTION.md` — principios inviolaveis
   - `.claude/protocols/GOVERNANCE.md` — convencoes de nomenclatura
   - `.claude/config/project.yaml` — configuracoes do projeto
   - `.claude/CLAUDE.md` — instrucoes existentes (se houver)

2. Para cada IDE habilitada em `project.yaml` (secao `ide_sync`):
   - Le o template correspondente em `.claude/ide-templates/`
   - Sintetiza o conteudo adaptado ao formato da IDE
   - Gera o arquivo no local esperado pela IDE

3. Cada IDE tem formato e convencoes proprias:
   - **Cursor:** `.cursorrules` na raiz do projeto, Markdown livre
   - **Windsurf:** `.windsurfrules` na raiz, Markdown com secoes especificas
   - **Copilot:** `.github/copilot-instructions.md`, Markdown com guidelines

## Quando Usar

- Apos configurar o projeto com DuarteOS
- Apos alterar CLAUDE.md, constitution, ou project.yaml
- Quando novos membros da equipe usam IDEs diferentes
- Ao migrar entre ferramentas

## Limitacoes

- Os arquivos gerados sao sobrescritos a cada sync
- Customizacoes diretas nos arquivos IDE serao perdidas — edite os templates
- Nem todas as features do DuarteOS tem equivalente em outras IDEs

# IDE Templates — Sincronizacao Multi-IDE

Este diretorio contem templates para gerar configs de IDEs automaticamente.

## Templates Disponiveis

| Arquivo | IDE | Destino |
|---------|-----|---------|
| `cursor.md.tmpl` | Cursor | `.cursorrules` |
| `windsurf.md.tmpl` | Windsurf | `.windsurfrules` |
| `copilot.md.tmpl` | GitHub Copilot | `.github/copilot-instructions.md` |

## Como Usar

```bash
/DUARTEOS:squad:sync-ide              # gera para todas IDEs habilitadas
/DUARTEOS:squad:sync-ide cursor       # gera apenas para Cursor
```

## Habilitando IDEs

Em `.claude/config/project.yaml`:

```yaml
ide_sync:
  cursor: true
  windsurf: true
  copilot: true
```

## Customizando Templates

Edite os `.tmpl` files neste diretorio. Na proxima execucao de
`/DUARTEOS:squad:sync-ide`, os arquivos serao regenerados com suas customizacoes.

## Protocolo

Veja `.claude/protocols/IDE-SYNC.md` para detalhes completos.

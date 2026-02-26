# Protocolo de Configuracao — 4 Camadas

**Versao:** 1.0.0

## Visao Geral

O DuarteOS usa um sistema de configuracao em 4 camadas com prioridade crescente.
Cada camada pode sobrescrever valores da camada anterior.

## Camadas

| Layer | Arquivo | Proposito | Quem edita | Sobrescrito no update? |
|-------|---------|-----------|------------|----------------------|
| 0 — System | `.claude/config/system.yaml` | Defaults DuarteOS | Ninguem (sistema) | Sim |
| 1 — Project | `.claude/config/project.yaml` | Config do projeto | Time do projeto | Nao |
| 2 — User | `.claude/config/user.yaml` | Preferencias pessoais | Desenvolvedor individual | Nao (gitignored) |
| 3 — Session | Instrucoes na sessao | Overrides temporarios | Usuario na sessao | N/A (efemero) |

## Ordem de Merge

```
Session (Layer 3)     ← maior prioridade
  ↑ sobrescreve
User (Layer 2)
  ↑ sobrescreve
Project (Layer 1)
  ↑ sobrescreve
System (Layer 0)      ← menor prioridade (defaults)
```

**Regra:** Se uma chave nao existe na camada superior, o valor da camada inferior prevalece.

## Como Agentes Devem Usar

No inicio de cada sessao:

1. Ler `.claude/config/system.yaml` (defaults)
2. Ler `.claude/config/project.yaml` (sobrescreve system)
3. Ler `.claude/config/user.yaml` se existir (sobrescreve project)
4. Aplicar a configuracao resultante do merge
5. Se o usuario der instrucao contraria na sessao → obedecer (Layer 3)

## Chaves Disponiveis

```yaml
agents:
  default_model: "sonnet"          # modelo padrao para agentes
  greeting_style: "minimal"        # minimal | named | archetypal
  memory_enabled: true             # habilitar agent memory
  synapse_enabled: true            # habilitar synapse state tracking

quality:
  pre_commit_checks: true          # rodar checks antes do commit
  auto_lint: true                  # auto-lint apos editar
  security_gate: true              # bloquear comandos perigosos
  min_test_coverage: 0             # % minimo (0 = desabilitado)
  bundle_size_alert_kb: 0          # KB maximo (0 = desabilitado)

features:
  task_templates: true             # habilitar task templates
  squad_factory: true              # habilitar squad factory
  mind_clone: true                 # habilitar mind clone
  constitution_enforced: true      # enforcar constitution

naming:
  commit_style: "conventional"     # conventional | freeform

ide_sync:
  cursor: false                    # gerar .cursorrules
  windsurf: false                  # gerar .windsurfrules
  copilot: false                   # gerar copilot-instructions.md
```

## Exemplos

### Desabilitar auto-lint (project.yaml)
```yaml
quality:
  auto_lint: false
```

### Usar greeting archetypal (user.yaml)
```yaml
agents:
  greeting_style: "archetypal"
```

### Override de sessao
Usuario diz: "use modelo opus para esta sessao" → Layer 3, aplica imediatamente.

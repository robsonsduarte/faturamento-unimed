# Protocolo Quality Gates — Pipeline de Qualidade DuarteOS

## Visao Geral

O DuarteOS implementa um pipeline de 9 quality gates que verificam automaticamente
a qualidade do codigo em diferentes momentos do fluxo de trabalho do agente.
Os gates sao executados via hooks do Claude Code (PreToolUse, PostToolUse, Stop).

## Pipeline Completo

```
[1] Security ──→ [2] Auto-Lint ──→ [3] Architecture ──→ [4] Pre-Commit ──→ [5] Coverage
      │                │                   │                    │                │
   Pre-Bash       Post-Edit          Post-Edit            Pre-Bash          Pre-Bash
   (sempre)     (Write/Edit)       (Write/Edit)        (git commit)      (git commit)

──→ [6] Docs ──→ [7] Dependency ──→ [8] Bundle Size ──→ [9] Session Memory
        │               │                  │                    │
     Pre-Bash        Pre-Bash          Post-Bash             Stop
   (git commit)    (git commit)     (npm run build)       (sempre)
```

## Gates Detalhados

---

### Gate 1: Security — `security-gate.sh`

**Trigger:** PreToolUse (Bash) — executa em TODOS os comandos Bash
**O que verifica:** Padroes perigosos como `rm -rf /`, `DROP DATABASE`, fork bombs, etc.
**Criterio:** Bloqueia (exit 1) se detectar padrao perigoso. Avisa sobre `sudo`.
**Desabilitar:** Remover o hook do `settings.json` (nao recomendado).

---

### Gate 2: Auto-Lint — `post-edit-lint.sh`

**Trigger:** PostToolUse (Write, Edit) — apos cada edicao de arquivo
**O que verifica:** Executa o linter do projeto (ESLint, Biome ou Prettier) com auto-fix.
**Criterio:** Aplica correcoes automaticamente. Reporta erros nao-corrigiveis.
**Desabilitar:** Remover o hook do `settings.json`.

---

### Gate 3: Architecture Review — `architecture-review.sh`

**Trigger:** PostToolUse (Write, Edit) — apos criacao de novos arquivos
**O que verifica:** Se arquivos novos estao em diretorios reconhecidos do projeto.
**Criterio:** Apenas aviso (exit 0 sempre). Alerta se arquivo criado em local inesperado.
**Desabilitar:** Remover o hook do `settings.json`.

---

### Gate 4: Pre-Commit — `pre-commit-check.sh`

**Trigger:** PreToolUse (Bash) — apenas em comandos `git commit`
**O que verifica:** TypeScript (`tsc --noEmit`), ESLint, e testes (`npm test`).
**Criterio:** Bloqueia (exit 1) se qualquer verificacao falhar.
**Desabilitar:** Remover o hook do `settings.json`.

---

### Gate 5: Test Coverage — `test-coverage-gate.sh`

**Trigger:** PreToolUse (Bash) — apenas em comandos `git commit`
**O que verifica:** Cobertura de testes via Vitest ou Jest.
**Criterio:** Bloqueia (exit 1) se cobertura abaixo do threshold configurado.
**Configuracao:** `min_test_coverage` em `.claude/config/project.yaml` (default: 0 = desabilitado).
**Desabilitar:** Definir `min_test_coverage: 0` no project.yaml.

---

### Gate 6: Docs — `docs-gate.sh`

**Trigger:** PreToolUse (Bash) — apenas em comandos `git commit`
**O que verifica:** Se arquivos de API foram modificados sem atualizar documentacao.
**Criterio:** Apenas aviso (exit 0 sempre). Lembra de atualizar docs.
**Desabilitar:** Remover o hook do `settings.json`.

---

### Gate 7: Dependency Audit — `dependency-audit.sh`

**Trigger:** PreToolUse (Bash) — apenas em comandos `git commit`
**O que verifica:** Vulnerabilidades em dependencias quando package.json foi alterado.
**Criterio:** Bloqueia (exit 1) apenas se vulnerabilidades HIGH ou CRITICAL encontradas.
**Desabilitar:** Remover o hook do `settings.json`.

---

### Gate 8: Bundle Size — `bundle-size-gate.sh`

**Trigger:** PostToolUse (Bash) — apenas apos `npm run build` ou `next build`
**O que verifica:** Tamanho total do diretorio `.next/` apos build.
**Criterio:** Apenas aviso (exit 0 sempre). Alerta se exceder threshold.
**Configuracao:** `bundle_size_alert_kb` em `.claude/config/project.yaml` (default: 0 = desabilitado).
**Desabilitar:** Definir `bundle_size_alert_kb: 0` no project.yaml.

---

### Gate 9: Session Memory — `session-memory.sh`

**Trigger:** Stop — ao encerrar sessao do Claude Code
**O que verifica:** Nada. Apenas registra timestamp de encerramento no session-context.md.
**Criterio:** Sempre passa (exit 0).
**Desabilitar:** Remover o hook do `settings.json`.

---

## Configuracao

### Habilitando Gates via `settings.json`

Todos os gates sao configurados em `.claude/settings.json` na secao `hooks`.
O script `duarteos init` configura automaticamente todos os gates habilitados.

### Parametros via `project.yaml`

Alguns gates leem configuracoes de `.claude/config/project.yaml`:

```yaml
quality_gates:
  min_test_coverage: 80        # Gate 5: % minimo de cobertura (0 = desabilitado)
  bundle_size_alert_kb: 512000 # Gate 8: tamanho maximo em KB (0 = desabilitado)
```

### Comportamento por Tipo

| Tipo | Gates | Comportamento |
|------|-------|---------------|
| **Bloqueante** | 1, 4, 5, 7 | exit 1 = impede a acao |
| **Aviso** | 2, 3, 6, 8 | exit 0 sempre, apenas informa |
| **Passivo** | 9 | Registra informacao, sem verificacao |

### Ordem de Execucao

Quando multiplos gates sao acionados pelo mesmo evento (ex: `git commit` aciona gates 4, 5, 6, 7),
eles executam na ordem definida no array de hooks do `settings.json`.
Se qualquer gate bloqueante falhar, os subsequentes nao executam.

## Integracao com OMEGA

Os thresholds de qualidade sao agora enforced pelo protocolo OMEGA (`.claude/protocols/OMEGA.md`). Consulte OMEGA.md para o sistema completo de scoring por evidencia, circuit breaker e escalacao.

**Nota:** Os thresholds canonicos de qualidade por tipo de task vivem no OMEGA.md (Research >=80, Planning >=85, Implementation >=90, Validation/Mind Clone >=95). A tabela de gates acima e mantida por compatibilidade — ela cobre quality gates de pipeline (hooks), enquanto OMEGA cobre quality gates de output (scoring por evidencia).

## Principios

1. **Defensivo:** Todo gate lida graciosamente com ferramentas ausentes
2. **Rapido:** Gates devem executar em segundos, nao minutos
3. **Configuravel:** Thresholds ajustaveis, gates removiveis
4. **Informativo:** Mensagens claras sobre o que falhou e como corrigir
5. **Nao-invasivo:** Gates de aviso nunca bloqueiam o fluxo

# {{PROJECT_NAME}} — Instrucoes do Projeto

## Modo de Operacao: YOLO

Este projeto opera em **YOLO mode** — execucao autonoma com guardrails minimos.

### Auto-Approve (executar sem perguntar)

- Ler qualquer arquivo
- Editar/criar arquivos no projeto (versionados pelo git)
- Rodar testes, builds, linters, formatters
- Commits locais (git add, git commit)
- Criar branches (git checkout -b, git branch)
- Instalar dependencias do projeto (npm/bun/yarn install)
- Deletar arquivos em /tmp/ ou /temp/
- Operacoes de busca (grep, find, glob)
- Copiar, mover, renomear arquivos dentro do projeto
- Qualquer operacao reversivel via git

### Confirmar Antes (pedir autorizacao explicita)

- Deletar arquivos ou diretorios fora de /tmp/ e /temp/
- Alterar arquivos nao versionados de forma irreversivel
- `git push` (qualquer variante, especialmente --force)
- `git reset --hard`
- Criar, fechar ou comentar em PRs e Issues (gh pr create, gh issue, etc.)
- Enviar mensagens externas (email, Slack, webhooks)
- Modificar .env, credentials, tokens ou secrets
- Instalar ou remover pacotes globais do sistema (brew, apt, etc.)
- Qualquer operacao destrutiva no SO (rm -rf fora do projeto, kill, etc.)

### Bloqueado (nunca executar)

- `rm -rf /` ou qualquer variante que apague raiz do sistema
- `rm -rf ~` ou qualquer variante que apague home do usuario
- `sudo rm` em diretorios do sistema
- Qualquer comando que possa corromper o SO

## Stack & Convencoes

- **Linguagem:** TypeScript (strict, zero `any`)
- **Commits:** Conventional Commits (feat:, fix:, docs:, chore:, refactor:)
- **Idioma:** Comunicacao sempre em portugues. Codigo e identificadores em ingles.
- **Principio:** Ler antes de editar. Planejar antes de executar. Simplicidade > sofisticacao.

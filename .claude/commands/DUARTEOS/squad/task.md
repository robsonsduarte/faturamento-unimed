# Squad: Task Template

Executa uma task baseada em template pre-definido.

## Uso

/DUARTEOS:squad:task [template-name] [contexto adicional]

## Como funciona

1. Leia `.claude/task-templates/README.md` para ver templates disponiveis
2. Identifique o template solicitado (por nome exato ou busca parcial)
3. Leia o template em `.claude/task-templates/{category}/{template-name}.md`
4. Adapte os campos ao contexto fornecido pelo usuario
5. Execute os passos sequencialmente
6. Valide cada criterio de aceite ao final
7. Liste os entregaveis produzidos

## Exemplos

- `/DUARTEOS:squad:task spec-feature` — Especificar uma nova feature
- `/DUARTEOS:squad:task dev-api-endpoint criar endpoint de upload` — Implementar endpoint
- `/DUARTEOS:squad:task qa-code-review src/lib/services/` — Revisar codigo de um diretorio
- `/DUARTEOS:squad:task db-migration adicionar tabela de notificacoes` — Criar migracao
- `/DUARTEOS:squad:task sec-owasp-audit` — Auditoria de seguranca completa

## Regras

- Sempre ler o template COMPLETO antes de iniciar
- Seguir a ordem dos passos (nao pular etapas)
- Marcar todos os criterios de aceite antes de declarar feito
- Se algum pre-requisito nao for atendido, avisar o usuario antes de prosseguir
- Registrar entregaveis com paths concretos dos arquivos criados/modificados

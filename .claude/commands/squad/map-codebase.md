# Squad: Mapear Codebase

Mapeamento completo do codebase pelo Arquiteto usando o motor GSD.

**Agente lider:** Arquiteto (Executor Estrutural)
**Motor:** GSD `gsd-codebase-mapper` (4 agentes paralelos)

## Descricao

Spawna 4 agentes especializados em paralelo que produzem 7 documentos estruturados sobre o codebase existente:

| Agente | Output |
|--------|--------|
| Tech Agent | `STACK.md` (tecnologias, versoes) + `INTEGRATIONS.md` (APIs externas) |
| Architecture Agent | `ARCHITECTURE.md` (padroes, fronteiras) + `STRUCTURE.md` (organizacao) |
| Quality Agent | `CONVENTIONS.md` (como o codigo e escrito) + `TESTING.md` (padroes de teste) |
| Concerns Agent | `CONCERNS.md` (divida tecnica, riscos) |

## Quando usar

- Antes de iniciar uma refatoracao grande
- Quando um novo membro precisa entender o projeto
- Quando a documentacao de arquitetura esta desatualizada
- Como Fase 0 (Discovery) do fluxo do Squad

## Como funciona

1. Voce e o Arquiteto. Sua lente cognitiva e: sistemas, trade-offs, estrutura
2. Invoque o GSD para fazer o mapeamento: execute `/gsd:map-codebase`
3. Apos o GSD gerar os 7 documentos em `.planning/codebase/`, REVISE cada um com a perspectiva do projeto
4. Complemente com conhecimento especifico do projeto que o GSD nao capturou
5. Apresente um resumo executivo ao usuario

## Output esperado

`.planning/codebase/` com 7 arquivos .md + resumo executivo

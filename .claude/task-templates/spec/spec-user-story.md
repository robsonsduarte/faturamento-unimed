# Task: Spec — Escrever User Stories

## Objetivo
Produzir user stories bem estruturadas com personas claras, criterios de aceite em formato BDD (Dado/Quando/Entao) e priorizacao, prontas para serem puxadas para desenvolvimento.

## Contexto
Usar quando uma feature ja tem direcao definida mas precisa ser decomposta em unidades de trabalho centradas no usuario. Cada user story deve ser independente, negociavel, valiosa, estimavel, pequena e testavel (INVEST). Ideal para alimentar sprints ou backlogs.

## Pre-requisitos
- [ ] Feature ou epico ja definido em alto nivel
- [ ] Personas do produto identificadas
- [ ] Acesso ao produto atual para entender fluxos existentes
- [ ] Compreensao das restricoes tecnicas relevantes

## Passos

### 1. Identificar Personas Envolvidas
Liste cada persona que interage com a feature:
```
Persona: Profissional de Saude (usuario principal)
- Perfil: Medico, nutricionista ou psicologo com consultorio proprio
- Objetivo: Criar conteudo para redes sociais de forma rapida
- Dor: Nao tem tempo para produzir conteudo consistente
- Contexto de uso: Entre consultas, no celular ou notebook
```
Repita para cada persona (admin, usuario final, moderador, etc).

### 2. Mapear Jornada do Usuario
Descreva o fluxo completo que a persona percorre:
1. Ponto de entrada (como chega na feature)
2. Acoes principais (o que faz)
3. Pontos de decisao (onde escolhe caminhos)
4. Conclusao (resultado final esperado)
5. Pos-conclusao (o que acontece depois)

### 3. Decompor em User Stories
Para cada interacao significativa, crie uma story:
```markdown
### US-001: Selecionar nicho de saude

**Como** profissional de saude
**Eu quero** selecionar meu nicho de atuacao (neurologia, nutricao, etc)
**Para que** o conteudo gerado seja relevante para minha especialidade

**Criterios de Aceite:**
- Dado que estou na tela de geracao de conteudo
  Quando clico no seletor de nicho
  Entao vejo os 6 nichos de saude disponiveis com icone e descricao

- Dado que selecionei "Neurologia"
  Quando confirmo a selecao
  Entao o sistema armazena minha preferencia e pre-seleciona nas proximas vezes

- Dado que nunca selecionei um nicho
  Quando acesso a geracao de conteudo pela primeira vez
  Entao sou obrigado a escolher antes de prosseguir

**Tamanho:** P (Pequeno)
**Prioridade:** Must Have
**Dependencias:** Nenhuma
```

### 4. Aplicar Criterio INVEST
Para cada story, valide:
- **I**ndependente: pode ser implementada sem depender de outra story?
- **N**egociavel: o escopo pode ser ajustado sem perder o valor?
- **V**aliosa: entrega valor perceptivel ao usuario?
- **E**stimavel: a equipe consegue estimar o esforco?
- **S**mall (Pequena): cabe em um sprint/iteracao?
- **T**estavel: criterios de aceite sao verificaveis?

Se falhar em algum criterio, quebre a story ou reformule.

### 5. Priorizar com MoSCoW
Classifique cada story:
- **Must Have:** Sem isso a feature nao funciona. Bloqueia lancamento.
- **Should Have:** Importante, mas a feature funciona sem. Inclui se possivel.
- **Could Have:** Desejavel, melhora a experiencia. Inclui se sobrar tempo.
- **Won't Have (this time):** Reconhecido como valioso mas explicitamente fora desta iteracao.

### 6. Definir Dependencias e Ordem
Crie um grafo simples de dependencias:
```
US-001 (Selecionar nicho) → US-002 (Gerar conteudo) → US-003 (Editar conteudo)
                                                      → US-004 (Salvar rascunho)
US-005 (Ver historico) — independente
```
Identifique o caminho critico (sequencia mais longa de dependencias).

### 7. Adicionar Notas Tecnicas
Para stories com implicacoes tecnicas nao obvias, adicione:
```
**Notas tecnicas:**
- Requer novo endpoint: POST /api/content/generate
- Migracao de banco: adicionar coluna `preferred_niche` em `profiles`
- Integracao com servico de AI (considerar timeout de 30s)
```

## Criterios de Aceite
- [ ] Todas as stories seguem o formato Como/Eu quero/Para que
- [ ] Cada story tem pelo menos 2 criterios de aceite em formato Dado/Quando/Entao
- [ ] Stories atendem ao criterio INVEST
- [ ] Priorizacao MoSCoW aplicada a todas as stories
- [ ] Dependencias entre stories mapeadas
- [ ] Pelo menos 80% das stories sao estimaveis sem pesquisa adicional
- [ ] Nenhuma story e grande demais (mais de 1 sprint de trabalho)

## Entregaveis
- Lista de user stories formatadas (markdown)
- Mapa de dependencias entre stories
- Tabela resumo: ID, titulo, prioridade, tamanho, dependencias

## Verificacao
- [ ] Product owner valida que as stories refletem a intencao da feature
- [ ] Desenvolvedor confirma que stories sao implementaveis
- [ ] QA confirma que criterios de aceite sao testaveis
- [ ] Nenhuma story tem escopo ambiguo ou criterio subjetivo

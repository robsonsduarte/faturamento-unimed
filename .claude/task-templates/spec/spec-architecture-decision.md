# Task: Spec — Registrar Decisao Arquitetural (ADR)

## Objetivo
Produzir um Architecture Decision Record (ADR) que documenta o contexto, opcoes avaliadas, decisao tomada e consequencias esperadas, servindo como registro historico que explica POR QUE a arquitetura e como e.

## Contexto
Usar quando uma decisao tecnica significativa precisa ser tomada e documentada: escolha de tecnologia, padrao de comunicacao entre servicos, estrategia de banco de dados, abordagem de autenticacao, etc. ADRs sao imutaveis apos aprovados — se a decisao mudar, um novo ADR e criado referenciando o anterior.

## Pre-requisitos
- [ ] Problema ou necessidade tecnica claramente identificado
- [ ] Pelo menos 2 opcoes alternativas avaliadas
- [ ] Compreensao das restricoes (tempo, custo, equipe, tecnologia existente)
- [ ] Stakeholders tecnicos identificados para revisao

## Passos

### 1. Atribuir Identificador e Titulo
```markdown
# ADR-[NUMERO]: [Titulo Conciso da Decisao]
- **Status:** Proposto | Aceito | Depreciado | Substituido por ADR-XX
- **Data:** YYYY-MM-DD
- **Autores:** [nomes]
- **Revisores:** [nomes]
```
Use numeracao sequencial. Titulos devem ser acoes: "Usar PostgreSQL como banco principal" e nao "Banco de dados".

### 2. Descrever o Contexto
Explique a situacao que motivou a decisao:
- Qual problema estamos enfrentando?
- Quais forcas estao em jogo? (performance, custo, prazo, experiencia do time)
- Quais restricoes existem? (compatibilidade, regulatorio, orçamento)
- Qual e a urgencia da decisao?

Exemplo:
> O sistema atualmente usa chamadas HTTP sincronas entre servicos. Com o aumento de carga
> (3x nos ultimos 6 meses), estamos vendo timeouts frequentes e cascading failures.
> Precisamos de um mecanismo de comunicacao assincrona para desacoplar servicos criticos.
> Restricao: a equipe tem experiencia com Redis mas nao com RabbitMQ/Kafka.

### 3. Listar Opcoes Avaliadas
Para cada opcao, documente de forma estruturada:
```markdown
### Opcao A: Redis Pub/Sub + Bull Queue
**Descricao:** Usar Redis como message broker com Bull para gestao de filas.
**Pros:**
- Equipe ja tem experiencia com Redis
- Infraestrutura ja existe (Redis usado para cache)
- Setup simples, menos componentes novos
**Contras:**
- Redis Pub/Sub nao garante entrega (at-most-once)
- Sem replay de mensagens
- Limitado para volumes muito altos (>100k msg/s)
**Custo:** Baixo (infra existente)
**Esforco:** 2-3 dias de implementacao
```

Repita para cada opcao (minimo 2, idealmente 3).

### 4. Definir Criterios de Avaliacao
Crie uma matriz de decisao:
| Criterio | Peso | Opcao A | Opcao B | Opcao C |
|----------|------|---------|---------|---------|
| Experiencia do time | 30% | 5 | 2 | 3 |
| Garantia de entrega | 25% | 3 | 5 | 5 |
| Custo operacional | 20% | 5 | 3 | 2 |
| Complexidade de setup | 15% | 5 | 3 | 2 |
| Escalabilidade | 10% | 3 | 5 | 5 |
| **Total ponderado** | | **4.2** | **3.4** | **3.2** |

### 5. Registrar a Decisao
Seja direto e inequivoco:
```markdown
## Decisao
Adotaremos **Redis Pub/Sub + Bull Queue** (Opcao A) para comunicacao assincrona entre servicos.

Para os casos onde garantia de entrega e critica (pagamentos, geracao de conteudo),
usaremos Bull Queue com persistencia em Redis, que oferece retry automatico e dead letter queue.

Para eventos de baixa criticidade (analytics, logs), usaremos Redis Pub/Sub simples.
```

### 6. Documentar Consequencias
Separe em positivas, negativas e neutras:
```markdown
## Consequencias

### Positivas
- Equipe pode comecar a implementar imediatamente (sem curva de aprendizado)
- Sem custo adicional de infraestrutura
- Bull Queue Dashboard para monitoramento de filas

### Negativas
- Sem replay de mensagens — se consumidor estiver offline, mensagens Pub/Sub sao perdidas
- Limite pratico de ~50k mensagens/segundo (suficiente para proximo ano)
- Redis e single-point-of-failure (mitigado com Redis Sentinel)

### Neutras
- Precisaremos migrar para Kafka/RabbitMQ se o volume crescer 10x
- Padrao de pub/sub sera diferente do padrao de fila — dois patterns no codebase
```

### 7. Definir Plano de Implementacao
```markdown
## Implementacao
1. Adicionar Bull como dependencia e configurar conexao Redis
2. Criar abstracoes: `QueueService` (filas persistentes) e `EventBus` (pub/sub)
3. Migrar primeiro use case: notificacoes (baixo risco, alto volume)
4. Monitorar por 2 semanas
5. Migrar demais use cases gradualmente

**Timeline:** 2 sprints
**Reversibilidade:** Alta — abstrações permitem trocar implementacao sem afetar consumidores
```

### 8. Registrar Revisao e Aprovacao
```markdown
## Revisao
- [x] Revisado por: [nome] em [data] — Aprovado
- [x] Revisado por: [nome] em [data] — Aprovado com ressalva: monitorar latencia p99
- **Status atualizado para:** Aceito em [data]
```

## Criterios de Aceite
- [ ] ADR tem identificador unico e titulo descritivo
- [ ] Contexto explica o problema e as forcas em jogo
- [ ] Pelo menos 2 opcoes avaliadas com pros/contras
- [ ] Criterios de avaliacao definidos e ponderados
- [ ] Decisao e inequivoca (nao ambigua)
- [ ] Consequencias positivas E negativas documentadas
- [ ] Plano de implementacao com timeline
- [ ] Reversibilidade da decisao avaliada
- [ ] Revisado por pelo menos 1 outro tecnico

## Entregaveis
- ADR formatado em markdown (arquivo `adr/ADR-XXX-titulo.md`)
- Matriz de decisao com pontuacao
- Plano de implementacao resumido

## Verificacao
- [ ] Um desenvolvedor novo consegue ler o ADR e entender por que a decisao foi tomada
- [ ] As consequencias negativas tem mitigacoes ou sao riscos aceitos conscientemente
- [ ] O ADR referencia ADRs anteriores relacionados (se existirem)
- [ ] O status do ADR esta correto (Proposto → Aceito)

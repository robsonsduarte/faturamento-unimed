# Conselho de IA — Advisory Board

Conselho de especialistas em Arquitetura de IA, modelos, estrategia ML e decisoes tecnicas envolvendo inteligencia artificial. Reune os maiores nomes da area para analise coletiva, debate de perspectivas e recomendacao consolidada.

**Tipo:** Conselho — Advisory Board Multi-Especialista
**Dominio:** Arquitetura de IA, modelos, estrategia ML, decisoes tecnicas envolvendo inteligencia artificial
**Membros:** 5 especialistas

## Mecanismo do Conselho

### Protocolo de Sessao

1. **Convocacao** — Spawne os membros em PARALELO via Agent tool (`subagent_type: "general-purpose"`)
2. **Briefing** — Cada membro recebe a demanda + instrucao para analisar sob SUA perspectiva unica
3. **Analise** — Cada membro contribui: diagnostico, recomendacoes, riscos que so ele ve
4. **Sintese** — Consolidar em: Consensos, Divergencias, Recomendacao Final

### Como Spawnar Membros

Para CADA membro, use a **Agent tool** com este template:

```
Agent tool → subagent_type: "general-purpose"
prompt: "Leia o arquivo `.claude/commands/DUARTEOS/AI/{nome}.md` e INCORPORE completamente essa persona. Depois, analise a seguinte demanda sob sua perspectiva unica:

DEMANDA: {{$ARGUMENTS}}

Contribua com:
1. **Diagnostico** (sob seu framework mental especifico)
2. **Recomendacoes concretas** (max 3, acionaveis)
3. **Riscos que so voce ve** (pela sua experiencia unica)
4. **Frase-sintese** da sua posicao (1 frase)

Seja direto e especifico. NAO repita generalidades. Use seus frameworks mentais reais."
```

### Regras do Conselho

1. **SEMPRE** spawne membros em PARALELO (todos na mesma mensagem Agent tool)
2. **Cada membro deve usar frameworks DIFERENTES** — nao repetir analise
3. **A sintese DEVE identificar consensos E divergencias** — unanimidade falsa e proibida
4. Se todos concordam → confianca ALTA. Se divergem → apresentar ambos os lados com argumentos
5. **Limite pratico:** para demandas focadas, spawne 3-5 membros mais relevantes. Para revisoes amplas, spawne todos.

## Membros do Conselho

| Membro | Skill | Especialidade unica | Quando priorizar |
|--------|-------|---------------------|------------------|
| Yann LeCun | `/DUARTEOS:AI:yann-lecun` | CNNs, Self-Supervised Learning, World Models, critico de LLMs | Decisoes sobre arquitetura de modelos, debates sobre limites de LLMs, abordagens de self-supervised learning, visao computacional |
| Andrew Ng | `/DUARTEOS:AI:andrew-ng` | ML aplicado, educacao em IA, MLOps, democratizacao | Implementacao pratica de ML, pipelines de dados, MLOps, viabilidade de projetos de IA, custos vs beneficios |
| Geoffrey Hinton | `/DUARTEOS:AI:geoffrey-hinton` | Backpropagation, Boltzmann Machines, riscos existenciais de IA | Fundamentos teoricos de deep learning, riscos de seguranca de IA, decisoes com implicacoes eticas de longo prazo |
| Yoshua Bengio | `/DUARTEOS:AI:yoshua-bengio` | Representacoes profundas, atencao, causalidade, IA responsavel | Mecanismos de atencao, raciocinio causal, IA responsavel, representacoes latentes, generalizacao |
| Demis Hassabis | `/DUARTEOS:AI:demis-hassabis` | AlphaFold, AGI, reinforcement learning, neurociencia computacional | Reinforcement learning, problemas de otimizacao complexa, intersecao IA-ciencia, estrategia de longo prazo rumo a AGI |

## Formato de Entrega

```markdown
## Sintese do Conselho de IA

**Demanda analisada:** [resumo da demanda]

### Consensos (todos concordam)
- [ponto 1]
- [ponto 2]

### Divergencias (opinioes divididas)
| Posicao A | Defendida por | Posicao B | Defendida por |
|-----------|--------------|-----------|--------------|
| ... | ... | ... | ... |

### Recomendacao do Conselho
[Posicao consolidada com nivel de confianca: ALTA / MEDIA / BAIXA]
[Justificativa em 2-3 frases]

### Votos Individuais
| Membro | Posicao-chave | Frase-sintese |
|--------|---------------|---------------|
| ... | ... | ... |
```
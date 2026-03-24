# Conselho de Business — Advisory Board

Conselho de especialistas em modelo de negocio, pricing, growth, vendas, SaaS, infoprodutos e estrategia empresarial. Reune os maiores nomes da area para analise coletiva, debate de perspectivas e recomendacao consolidada.

**Tipo:** Conselho — Advisory Board Multi-Especialista
**Dominio:** Modelo de negocio, pricing, growth, vendas, SaaS, infoprodutos, estrategia empresarial
**Membros:** 6 especialistas

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
prompt: "Leia o arquivo `.claude/commands/DUARTEOS/Business/[nome].md` e INCORPORE completamente essa persona. Depois, analise a seguinte demanda sob sua perspectiva unica:

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
| Bill Gates | `/DUARTEOS:Business:bill-gates` | Plataformas, ecossistemas, filantropia, visao de longo prazo | Estrategia de plataforma, ecossistemas de parceiros, visao de longo prazo, escala global |
| Thiago Finch | `/DUARTEOS:Business:thiago-finch` | Negocios digitais BR, escala de infoprodutos, lifestyle | Lancamentos digitais, infoprodutos, escala no mercado brasileiro, monetizacao de audiencia |
| Vinicius Greco | `/DUARTEOS:Business:vinicius-greco` | SaaS BR, recorrencia, metricas, growth | Modelo SaaS, metricas de recorrencia (MRR/ARR/churn), growth loops, pricing de assinatura |
| Guilherme Bifi | `/DUARTEOS:Business:guilherme-bifi` | Vendas B2B, processos comerciais, outbound | Estrategia de vendas, processos comerciais, outbound, pipeline B2B, ciclo de venda complexo |
| Pedro Valerio Lopez | `/DUARTEOS:Business:pedro-valerio-lopez` | Empreendedorismo digital, mentoria, estrategia | Estrategia de negocio digital, posicionamento, mentoria, decisoes de direcionamento |
| Daiane Cavalcante | `/DUARTEOS:Business:daiane-cavalcante` | Negocios digitais femininos, comunidade, lideranca | Construcao de comunidade, lideranca, negocios com proposito, diversificacao de receita |

## Formato de Entrega

```markdown
## Sintese do Conselho de Business

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

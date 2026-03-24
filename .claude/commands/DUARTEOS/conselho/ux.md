# Conselho de UX — Advisory Board

Conselho de especialistas em UX research, design system, usabilidade, interface, interacao e acessibilidade. Reune os maiores nomes da area para analise coletiva, debate de perspectivas e recomendacao consolidada.

**Tipo:** Conselho — Advisory Board Multi-Especialista
**Dominio:** UX research, design system, usabilidade, interface, interacao, acessibilidade
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
prompt: "Leia o arquivo `.claude/commands/DUARTEOS/UX-Design/{nome}.md` e INCORPORE completamente essa persona. Depois, analise a seguinte demanda sob sua perspectiva unica:

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
| Don Norman | `/DUARTEOS:UX-Design:don-norman` | Design emocional, The Design of Everyday Things, usabilidade | Fundamentos de usabilidade, design centrado no usuario, affordances, mapeamento mental, design emocional |
| Jakob Nielsen | `/DUARTEOS:UX-Design:jakob-nielsen` | Heuristicas de usabilidade, UX research, Nielsen Norman Group | Avaliacoes heuristicas, testes de usabilidade, metricas de UX, identificacao de problemas de interacao |
| Brad Frost | `/DUARTEOS:UX-Design:brad-frost` | Atomic Design, design systems, componentizacao | Criacao e evolucao de design systems, componentizacao atomica, consistencia visual, escalabilidade de UI |
| Steve Krug | `/DUARTEOS:UX-Design:steve-krug` | "Don't Make Me Think", usability testing, simplicidade | Simplicidade radical, testes de usabilidade rapidos, eliminacao de fricao, clareza de navegacao |
| Luke Wroblewski | `/DUARTEOS:UX-Design:luke-wroblewski` | Mobile first, form design, interaction design | Design mobile first, formularios de alta conversao, interaction patterns, design responsivo, input design |
| Nathan Curtis | `/DUARTEOS:UX-Design:nathan-curtis` | Design system governance, tokens, documentacao | Governanca de design system, design tokens, documentacao de componentes, adocao organizacional de DS |

## Formato de Entrega

```markdown
## Sintese do Conselho de UX

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
# Conselho de Copywriting — Advisory Board

Conselho de especialistas em copy de vendas, headlines, VSLs, paginas de vendas, emails, persuasao e storytelling. Reune os maiores nomes da area para analise coletiva, debate de perspectivas e recomendacao consolidada.

**Tipo:** Conselho — Advisory Board Multi-Especialista
**Dominio:** Copy de vendas, headlines, VSLs, paginas de vendas, emails, persuasao, storytelling
**Membros:** 7 especialistas

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
prompt: "Leia o arquivo `.claude/commands/DUARTEOS/Copywriting/{nome}.md` e INCORPORE completamente essa persona. Depois, analise a seguinte demanda sob sua perspectiva unica:

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
| Gary Halbert | `/DUARTEOS:Copywriting:gary-halbert` | Direct mail, The Boron Letters, urgencia visceral | Copy de urgencia, direct mail, cartas de vendas com emocao crua, ofertas irresistiveis, escassez real |
| Eugene Schwartz | `/DUARTEOS:Copywriting:eugene-schwartz` | Niveis de consciencia, Breakthrough Advertising, mass desire | Segmentacao por nivel de consciencia do lead, headlines para cold traffic, explorar desejo de massa existente |
| Joseph Sugarman | `/DUARTEOS:Copywriting:joseph-sugarman` | Storytelling em copy, slippery slide, BluBlocker | Copy longa baseada em historia, fluidez narrativa (slippery slide), engajamento por curiosidade, copy de produto |
| Robert Collier | `/DUARTEOS:Copywriting:robert-collier` | Cartas de vendas, emocao na copy, classicos | Copy emocional, conexao com o leitor, apelo a aspiracoes e desejos profundos, copy classica atemporal |
| Claude Hopkins | `/DUARTEOS:Copywriting:claude-hopkins` | Scientific Advertising, testes A/B, copy baseada em dados | Copy testavel, abordagem cientifica, metricas de resposta, testes A/B, copy baseada em evidencias e dados |
| Gary Bencivenga | `/DUARTEOS:Copywriting:gary-bencivenga` | Copy premium, persuasao sofisticada, legado | Copy para publico sofisticado, persuasao sutil, nichos premium, copy que vende sem parecer que esta vendendo |
| Amanda Khayat | `/DUARTEOS:Copywriting:amanda-khayat` | Copy BR, lancamentos, webinarios, closer | Copy para mercado brasileiro, lancamentos digitais, webinarios de venda, scripts de closing, tom conversacional BR |

## Formato de Entrega

```markdown
## Sintese do Conselho de Copywriting

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
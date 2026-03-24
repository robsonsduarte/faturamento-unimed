# Conselho de Saude — Advisory Board

Conselho de especialistas em Saude, abrangendo medicina, odontologia, fonoaudiologia, psicologia, educacao fisica, nutricao e fisioterapia. Reune profissionais de destaque de cada area para analise coletiva multidisciplinar, debate de perspectivas clinicas e recomendacao consolidada.

**Tipo:** Conselho — Advisory Board Multi-Especialista
**Dominio:** Saude multidisciplinar — medicina, odontologia, fonoaudiologia, psicologia, educacao fisica, nutricao, fisioterapia
**Membros:** 7 especialistas

## Mecanismo do Conselho

### Protocolo de Sessao

1. **Convocacao** — Spawne os membros em PARALELO via Agent tool (`subagent_type: "general-purpose"`)
2. **Briefing** — Cada membro recebe a demanda + instrucao para analisar sob SUA perspectiva unica de saude
3. **Analise** — Cada membro contribui: diagnostico, recomendacoes, riscos que so ele ve
4. **Sintese** — Consolidar em: Consensos, Divergencias, Recomendacao Final

### Como Spawnar Membros

Para CADA membro, use a **Agent tool** com este template:

```
Agent tool → subagent_type: "general-purpose"
prompt: "Leia o arquivo `.claude/commands/DUARTEOS/Saude/{nome}.md` e INCORPORE completamente essa persona. Depois, analise a seguinte demanda sob sua perspectiva unica:

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
| Drauzio Varella | `/DUARTEOS:Saude:drauzio-varella` | Oncologia, saude publica, SUS, medicina preventiva, comunicacao cientifica | Questoes de saude publica, prevencao, acesso ao SUS, combate a desinformacao medica |
| Claudio Miyake | `/DUARTEOS:Saude:claudio-miyake` | Ortodontia, saude bucal coletiva, regulamentacao profissional, politica de saude | Saude bucal, regulamentacao de profissionais de saude, etica profissional, fluoretacao |
| Juliana Trentini | `/DUARTEOS:Saude:juliana-trentini` | Fonoaudiologia pediatrica, aquisicao de linguagem, estimulacao da fala | Desenvolvimento infantil, marcos da fala, estimulacao precoce, comunicacao pais-filhos |
| Vera Iaconelli | `/DUARTEOS:Saude:vera-iaconelli` | Psicanalise, parentalidade, psicologia perinatal, saude mental coletiva | Saude mental, parentalidade, genero, sofrimento psiquico, vinculo social |
| Marcio Atalla | `/DUARTEOS:Saude:marcio-atalla` | Educacao fisica, saude preventiva, longevidade, combate ao sedentarismo | Exercicio como medicina, sedentarismo, mudanca comportamental, saude corporativa |
| Patricia Leite | `/DUARTEOS:Saude:patricia-leite` | Nutricao clinica e esportiva, emagrecimento saudavel, doencas cronicas | Alimentacao, emagrecimento, diabetes, hipertensao, suplementacao, desmistificacao de dietas |
| Raquel Castanharo | `/DUARTEOS:Saude:raquel-castanharo` | Fisioterapia esportiva, biomecanica da corrida, prevencao de lesoes | Lesoes musculoesqueleticas, reabilitacao, corrida, fortalecimento, retorno ao esporte |

## Formato de Entrega

```markdown
## Sintese do Conselho de Saude

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
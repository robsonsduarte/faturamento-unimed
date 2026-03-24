# Conselho Juridico Digital — Advisory Board

Conselho de especialistas em Direito Digital, abrangendo protecao de dados/LGPD, propriedade intelectual, direito do consumidor digital, direito empresarial de startups, tributacao digital, direito trabalhista digital e contratos digitais. Reune os maiores juristas do Brasil na interseccao direito + tecnologia para analise coletiva, debate de perspectivas e recomendacao consolidada.

**Tipo:** Conselho — Advisory Board Multi-Especialista
**Dominio:** Direito Digital multidisciplinar — LGPD, propriedade intelectual, consumidor digital, startups, tributacao digital, trabalhista digital, contratos digitais
**Membros:** 7 especialistas

## Mecanismo do Conselho

### Protocolo de Sessao

1. **Convocacao** — Spawne os membros em PARALELO via Agent tool (`subagent_type: "general-purpose"`)
2. **Briefing** — Cada membro recebe a demanda + instrucao para analisar sob SUA perspectiva unica de direito digital
3. **Analise** — Cada membro contribui: diagnostico, recomendacoes, riscos que so ele ve
4. **Sintese** — Consolidar em: Consensos, Divergencias, Recomendacao Final

### Como Spawnar Membros

Para CADA membro, use a **Agent tool** com este template:

```
Agent tool → subagent_type: "general-purpose"
prompt: "Leia o arquivo `.claude/commands/DUARTEOS/Juridico/{nome}.md` e INCORPORE completamente essa persona. Depois, analise a seguinte demanda sob sua perspectiva unica:

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
| Patricia Peck Pinheiro | `/DUARTEOS:Juridico:patricia-peck` | LGPD, privacidade, ciberseguranca, compliance digital, governanca de dados | Protecao de dados, LGPD, compliance, crimes digitais, regulacao de IA, ciberseguranca |
| Ronaldo Lemos | `/DUARTEOS:Juridico:ronaldo-lemos` | Propriedade intelectual digital, direitos autorais, regulacao de internet, Marco Civil | PI digital, direitos autorais, regulacao de plataformas, Creative Commons, cultura livre |
| Guilherme Magalhaes Martins | `/DUARTEOS:Juridico:guilherme-martins` | Direito do consumidor digital, contratos eletronicos de consumo, responsabilidade de plataformas | Relacoes de consumo online, e-commerce, marketplace, CDC digital, responsabilidade de plataformas |
| Erik Fontenele Nybo | `/DUARTEOS:Juridico:erik-nybo` | Direito de startups, venture capital, vesting, legal design, Marco Legal das Startups | Constituicao de startups, contratos SaaS, cap table, rodadas de investimento, M&A tech |
| Ivson Coelho | `/DUARTEOS:Juridico:ivson-coelho` | Tributacao da economia digital, infoprodutos, SaaS, reforma tributaria | Tributacao de infoprodutos, SaaS, marketplace, ICMS vs ISS, criadores de conteudo |
| Ricardo Calcini | `/DUARTEOS:Juridico:ricardo-calcini` | Teletrabalho, plataformas digitais, LGPD trabalhista, gig economy | Trabalho remoto, pejotizacao, plataformas (Uber/iFood), monitoramento, compliance trabalhista |
| Jose Luiz de Moura Faleiros Junior | `/DUARTEOS:Juridico:jose-faleiros-junior` | Contratos algoritmicos, smart contracts, termos de uso, licenciamento de software | Contratos digitais, termos de uso, SLAs, assinatura digital, smart contracts, bens digitais |

## Formato de Entrega

```markdown
## Sintese do Conselho Juridico Digital

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
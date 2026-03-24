# Conselho de Tech — Advisory Board

Conselho de especialistas em produto tech, escala de plataformas, decisoes de produto e inovacao tecnologica. Reune os maiores nomes da area para analise coletiva, debate de perspectivas e recomendacao consolidada.

**Tipo:** Conselho — Advisory Board Multi-Especialista
**Dominio:** Produto tech, escala de plataformas, decisoes de produto, inovacao tecnologica
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
prompt: "Leia o arquivo `.claude/commands/DUARTEOS/Tech/[nome].md` e INCORPORE completamente essa persona. Depois, analise a seguinte demanda sob sua perspectiva unica:

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
| Larry Page | `/DUARTEOS:Tech:larry-page` | Search, moonshots, organizacao de informacao, Alphabet | Decisoes de arquitetura de informacao, buscas, projetos ambiciosos de longo prazo, organizacao de dados em escala |
| Mark Zuckerberg | `/DUARTEOS:Tech:mark-zuckerberg` | Redes sociais, plataformas, metaverso, escala de produto | Estrategia de plataforma, efeitos de rede, escala massiva de usuarios, pivots estrategicos |
| Evan Spiegel | `/DUARTEOS:Tech:evan-spiegel` | Efemero, camera-first, Gen-Z, inovacao em UX mobile | Produtos mobile-first, UX inovadora, audiencia jovem, features efemeras ou experimentais |
| Jan Koum | `/DUARTEOS:Tech:jan-koum` | Simplicidade radical, privacidade, messaging, escala com equipe minima | Simplificacao de produto, privacidade como feature, escalar com equipe enxuta, messaging |
| Dustin Moskovitz | `/DUARTEOS:Tech:dustin-moskovitz` | Produtividade, project management, work OS, Asana | Ferramentas de produtividade, workflows, project management, SaaS B2B, operacoes internas |

## Formato de Entrega

```markdown
## Sintese do Conselho de Tech

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

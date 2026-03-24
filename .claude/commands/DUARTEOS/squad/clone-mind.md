# Squad: DNA Mental — Clone de Especialista (DEPRECADO)

**DEPRECADO desde v6.0** — Este comando foi substituido pelo pipeline MMOS v2.

## Redirecionamento

Use os novos comandos:

- **Criar clone:** `/DUARTEOS:mmos:mind-clone {nome}`
- **Atualizar clone:** `/DUARTEOS:mmos:mind-update {nome} {fonte}`
- **Dossie tematico:** `/DUARTEOS:squad:dossie {tema}`

## Por que foi deprecado?

O pipeline v1 (5 fases, 5 camadas DNA, validacao 90%) foi substituido pelo MMOS Engine v2:
- 6 fases reais (Coleta, Extracao, Inferencia, Mapeamento, Perfil, Recomendacao)
- 6 camadas DNA (inclui Paradoxos Produtivos)
- 5 autoridades integradas (Allen, Forte, Deming, Kahneman, Gawande)
- Formula de fidelidade composta: F = L*0.20 + B*0.30 + C*0.15 + K*0.20 + V*0.15
- Fidelidade-alvo >= 95%
- Gates Gawande DO-CONFIRM entre cada fase
- Integracao OMEGA v2 + Synapse v3

Protocolo completo: `.claude/protocols/MMOS-PIPELINE.md`

## Argumentos

$ARGUMENTS — redireciona automaticamente

Se este comando for invocado, informe o usuario:

```
Este comando foi DEPRECADO. Use os novos comandos MMOS v2:

  /DUARTEOS:mmos:mind-clone {nome}     — Criar clone do zero (pipeline 6 fases)
  /DUARTEOS:mmos:mind-update {nome}    — Atualizar clone existente

O pipeline antigo (5 fases, 5 camadas) foi substituido pelo MMOS Engine v2
com 6 fases, 6 camadas DNA, 5 autoridades e fidelidade >= 95%.
```

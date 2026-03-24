# Squad: Dossie Tematico — Compilador de Conhecimento

Compile um dossie completo sobre um tema, consolidando a perspectiva de todos os mind clones relevantes do DuarteOS.

**Modo:** Pipeline com spawn paralelo
**Nivel:** Intermediario — usa mind clones existentes

## Argumentos

$ARGUMENTS — tema do dossie (obrigatorio)

Se $ARGUMENTS estiver vazio, pergunte: "Qual tema quer compilar? (ex: 'trafego pago', 'onboarding', 'precificacao SaaS')"

## Descricao

Diferente dos Conselhos (que deliberam ao vivo sobre uma demanda especifica), o Dossie e um **documento de referencia permanente** que:

1. Identifica QUAIS mind clones tem algo a dizer sobre o tema
2. Consulta CADA um sob sua perspectiva unica
3. Consolida tudo em documento estruturado com consensos, divergencias e frameworks combinados
4. Salva no Synapse para consulta futura e incrementacao continua

Um dossie sobre "trafego pago" consultaria: Pedro Sobral (trafego), Dan Kennedy (marketing direto), David Ogilvy (branding), Diego Carmona (automacao), Tiago Tessmann (Google Ads), Stefan Georgi (copy de ads), Patricia Peck (aspectos legais de ads), Ivson Coelho (tributacao de ads)...

## Pipeline de 4 Fases

---

### FASE 1: MAPEAMENTO (Identificar experts relevantes)

**Objetivo:** Mapear quais mind clones tem expertise no tema.
**Artefato:** Lista de experts com relevancia estimada

#### Procedimento

1. Liste TODOS os mind clones disponiveis (59 atualmente) por categoria:
   - Copywriting (7), Marketing (9), UX-Design (6), AI (5), Tech (5), Business (6), Content (4), Product (3), Saude (7), Juridico (7)

2. Para CADA mind clone, avalie: "Este expert tem algo relevante a dizer sobre '{tema}'?"
   - Se SIM: classifique a relevancia (ALTA / MEDIA / BAIXA)
   - Se NAO: descarte

3. Selecione os experts com relevancia ALTA e MEDIA (maximo 10 para eficiencia)

4. Se encontrar MENOS de 3 experts relevantes:
   - Informe ao usuario
   - Sugira temas adjacentes que teriam mais cobertura
   - Pergunte se quer prosseguir mesmo assim

5. Apresente a lista ao usuario para aprovacao antes de spawnar:
   ```
   Experts identificados para dossie "{tema}":

   ALTA relevancia:
   - Pedro Sobral (Marketing) — especialista direto em trafego
   - Dan Kennedy (Marketing) — fundamentos de marketing direto

   MEDIA relevancia:
   - Stefan Georgi (Copywriting) — copy para ads
   - Ivson Coelho (Juridico) — tributacao de trafego pago

   Spawnar esses {N} experts? [sim/ajustar]
   ```

**NAO avance para Fase 2 sem aprovacao do usuario.**

---

### FASE 2: CONSULTA PARALELA (Extrair perspectivas)

**Objetivo:** Consultar cada expert sob sua perspectiva unica.

#### Procedimento

1. Spawne TODOS os experts selecionados em PARALELO via Agent tool:

```
Para CADA expert, use:

Agent tool → subagent_type: "general-purpose"
prompt: "Leia o arquivo `.claude/commands/DUARTEOS/{Categoria}/{nome}.md` e INCORPORE completamente essa persona.

Depois, compile TUDO que voce sabe/pensa sobre o tema: '{tema}'

Organize sua contribuicao em:

1. **Sua perspectiva central** sobre {tema} (2-3 frases — a essencia da sua visao)
2. **Frameworks aplicaveis** — quais dos seus frameworks se aplicam a {tema}? Descreva passo-a-passo.
3. **Heuristicas e regras de bolso** — que atalhos mentais usa quando lida com {tema}?
4. **Erros comuns que ve** — o que a maioria erra sobre {tema}?
5. **Conselho #1** — se pudesse dar UMA recomendacao sobre {tema}, qual seria?
6. **Conexoes com outros temas** — como {tema} se conecta a outras areas?

Seja ESPECIFICO e USE seus frameworks reais. NAO de conselhos genericos."
```

2. Colete todas as respostas

---

### FASE 3: COMPILACAO (Sintetizar dossie)

**Objetivo:** Consolidar todas as perspectivas em documento estruturado.

#### Procedimento

1. Analise TODAS as contribuicoes dos experts

2. Identifique:
   - **Consensos:** pontos onde 2+ experts concordam
   - **Divergencias:** pontos onde experts discordam (com argumentos de cada lado)
   - **Frameworks complementares:** como os frameworks de diferentes experts se combinam
   - **Insights unicos:** perspectivas que so um expert trouxe (de sua especialidade unica)
   - **Erros comuns convergentes:** erros que multiplos experts identificaram

3. Compile o dossie em formato YAML:

```yaml
# Dossie Tematico: {Tema}
# Synapse Dossier — Conhecimento Consolidado
# Compilado em: {data}
# Experts consultados: {N}

tema: "{tema}"
slug: "{tema-normalizado}"
descricao: "{descricao do escopo}"

fontes:
  - mind_clone: "{nome}"
    categoria: "{categoria}"
    relevancia: "{alta/media}"
    perspectiva_central: "{2-3 frases}"
    frameworks_aplicados:
      - name: "{framework}"
        aplicacao: "{como aplica ao tema}"
    heuristicas:
      - "{regra de bolso}"
    erros_comuns:
      - "{erro que identifica}"
    conselho_principal: "{recomendacao #1}"
    conexoes:
      - "{tema relacionado}"

consensos:
  - ponto: "{algo que concordam}"
    defendido_por: ["{expert1}", "{expert2}"]
    forca: "{forte/moderado}"

divergencias:
  - tema_especifico: "{sobre o que divergem}"
    posicao_a:
      visao: "{visao A}"
      defendida_por: ["{expert1}"]
      argumento: "{por que}"
    posicao_b:
      visao: "{visao B}"
      defendida_por: ["{expert2}"]
      argumento: "{por que}"

frameworks_combinados:
  - name: "{framework sintese}"
    contribuidores: ["{expert1}", "{expert2}"]
    steps:
      - "{passo 1} (de {expert1})"
      - "{passo 2} (de {expert2})"

insights_unicos:
  - expert: "{nome}"
    insight: "{perspectiva unica}"
    valor: "{por que isso e valioso}"

recomendacao_consolidada: |
  {Sintese em 3-5 frases: o que o dossie conclui sobre o tema,
   integrando os consensos e reconhecendo as divergencias}

stats:
  experts_consultados: {N}
  consensos_identificados: {N}
  divergencias_identificadas: {N}
  frameworks_combinados: {N}
  compilado_em: "{data}"
  versao: 1
```

4. Salve em `.claude/synapse/dossiers/{tema-normalizado}.yaml`

5. Atualize o indice `.claude/synapse/dossiers/_index.yaml`:
```yaml
dossiers:
  - slug: "{tema}"
    tema: "{Tema}"
    experts: {N}
    compilado: "{data}"
    versao: 1
```

---

### FASE 4: APRESENTACAO (Output legivel)

**Objetivo:** Apresentar o dossie ao usuario em formato legivel.

#### Procedimento

1. Renderize o dossie YAML em markdown legivel:

```markdown
## Dossie: {Tema}

**Experts consultados:** {lista com categorias}
**Compilado em:** {data}

### Visao Geral
{recomendacao_consolidada}

### Consensos
{lista formatada}

### Divergencias
{tabela posicao A vs posicao B}

### Frameworks Combinados
{lista com steps}

### Insights Unicos
{lista por expert}

### Erros Comuns
{lista consolidada}

---
*Dossie salvo em `.claude/synapse/dossiers/{tema}.yaml` — use `--update` para incrementar com novas fontes.*
```

## Modo Incremental

```
/DUARTEOS:squad:dossie --update "trafego pago"
```

Ao usar `--update`:
1. Leia o dossie existente de `.claude/synapse/dossiers/{tema}.yaml`
2. Identifique se ha NOVOS mind clones que nao foram consultados
3. Consulte APENAS os novos
4. MERGE: adicione novos insights sem remover os existentes
5. Reavalie consensos e divergencias com os novos dados
6. Incremente versao

## Exemplos

```
/DUARTEOS:squad:dossie trafego pago
/DUARTEOS:squad:dossie precificacao de SaaS
/DUARTEOS:squad:dossie onboarding de clientes
/DUARTEOS:squad:dossie protecao de dados para startups
/DUARTEOS:squad:dossie --update trafego pago
```

## Regras Criticas

1. **SEMPRE** pedir aprovacao da lista de experts antes de spawnar (Fase 1)
2. **SEMPRE** spawnar experts em PARALELO para eficiencia
3. **Maximo 10 experts** por dossie (para manter qualidade > quantidade)
4. **NUNCA inventar** — se um expert nao tem opiniao sobre o tema, nao force
5. **Preservar divergencias** — desacordo entre experts e INFORMACAO VALIOSA, nao erro
6. **Dossie e documento vivo** — pode ser incrementado com `--update`
7. **YAML no Synapse** e a fonte de verdade; markdown e apenas apresentacao

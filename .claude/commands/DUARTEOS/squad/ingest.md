# Squad: Ingest — Ingestao Local de Conteudo

Ingere material na "caixa" do projeto (pasta `inbox/`) e processa usando o pipeline de mind cloning.

**Principio:** A IA so processa conteudo LOCAL — nunca pesquisa na internet durante ingestao.
**Inspirado em:** Mega Brain Pipeline (Thiago Finch) — adaptado para DuarteOS sem overhead.

## Argumentos

$ARGUMENTS — caminho do arquivo, URL do YouTube, ou flag de operacao

Se $ARGUMENTS estiver vazio, executar modo SCAN (listar pendentes).

## Sintaxe

```
/DUARTEOS:squad:ingest                              # Scan: listar pendentes no inbox
/DUARTEOS:squad:ingest /path/to/file.txt            # Ingerir arquivo local
/DUARTEOS:squad:ingest --scan                       # Mesmo que sem argumentos
/DUARTEOS:squad:ingest --process                    # Processar proximo pendente
/DUARTEOS:squad:ingest --process-all                # Processar todos pendentes
/DUARTEOS:squad:ingest --organize                   # Auto-organizar inbox (dry-run)
/DUARTEOS:squad:ingest --organize --execute         # Executar auto-organizacao
```

## Estrutura do Inbox

```
inbox/
  {autor-slug}/                    # Pasta por autor (lowercase, hifens)
    {tipo}/                        # PODCASTS, COURSES, ARTICLES, TRANSCRIPTS, etc
      {arquivo}.txt                # Conteudo bruto
  processed/                       # Arquivos ja processados (movidos aqui)
    {autor-slug}/
      {arquivo}.txt
  README.md                        # Instrucoes de uso do inbox
```

## Execucao

### Modo SCAN (padrao — sem argumentos ou --scan)

```
1. ESCANEAR inbox/ recursivamente por .txt, .md, .pdf
2. IGNORAR inbox/processed/ e inbox/README.md
3. PARA cada arquivo encontrado:
   - Detectar autor pelo nome da pasta pai
   - Detectar tipo de conteudo pela sub-pasta
   - Contar palavras
   - Verificar se ja foi processado (existe em processed/)
4. GERAR relatorio:
```

Output:
```
═══════════════════════════════════════════════════════════════
                     INBOX STATUS
                     {data atual}
═══════════════════════════════════════════════════════════════

PENDENTES: {N} arquivo(s)

  1. {autor}/{tipo}/{arquivo}.txt
     ~{palavras} palavras | adicionado: {data relativa}
     Processar: /DUARTEOS:squad:ingest --process

  2. {autor}/{tipo}/{arquivo}.txt
     ~{palavras} palavras | adicionado: {data relativa}

───────────────────────────────────────────────────────────────

POR AUTOR:
  {autor-1}: {N} arquivo(s)
  {autor-2}: {N} arquivo(s)

ACOES RAPIDAS:
  Processar proximo:  /DUARTEOS:squad:ingest --process
  Processar todos:    /DUARTEOS:squad:ingest --process-all
  Organizar inbox:    /DUARTEOS:squad:ingest --organize

═══════════════════════════════════════════════════════════════
```

### Modo INGEST (arquivo ou texto fornecido)

```
1. IDENTIFICAR tipo de entrada:
   - Se caminho local: ler arquivo diretamente
   - Se texto bruto (entre aspas): salvar como .txt

2. DETECTAR autor:
   - Se --author "Nome" fornecido: usar esse
   - Se caminho contem nome reconhecivel: detectar automaticamente
   - Se nao conseguir detectar: perguntar ao usuario

3. DETECTAR tipo de conteudo:
   - Se --type TIPO fornecido: usar esse
   - Inferir por keywords no nome: podcast, course, article, transcript, etc
   - Default: GENERAL

4. ORGANIZAR no inbox:
   - Criar pasta inbox/{autor-slug}/{tipo}/ se nao existir
   - Copiar/mover arquivo para destino
   - Padronizar nome (lowercase, hifens, sem caracteres especiais)

5. GERAR relatorio de ingestao
```

### Modo PROCESS (--process ou --process-all)

```
1. IDENTIFICAR arquivo(s) a processar:
   - --process: pegar o mais antigo pendente
   - --process-all: pegar todos pendentes (com confirmacao)
   - --author "Nome": filtrar por autor

2. PARA cada arquivo:
   a. LER conteudo integralmente (so local, NUNCA internet)
   b. DETECTAR autor canonico (ver secao Canonicalizacao)
   c. EXTRAIR insights nas 5 camadas DNA:
      - Filosofia: crencas, principios, visao de mundo
      - Frameworks: modelos mentais, passos-a-passo
      - Heuristicas: regras de bolso, padroes de decisao
      - Metodologias: processos repetiveis, sistemas
      - Dilemas: trade-offs, tensoes, evolucao de posicao
   d. VERIFICAR se mind clone ja existe em .claude/synapse/minds/{autor}.yaml
      - Se SIM: executar /DUARTEOS:squad:clone-mind --update "{autor}" inbox/{path}
      - Se NAO: executar /DUARTEOS:squad:clone-mind "{Autor Nome}"
        com as fontes coletadas do inbox como base
   e. MOVER arquivo para inbox/processed/{autor-slug}/
   f. REGISTRAR ingestao em .claude/synapse/ingestion/

3. GERAR relatorio final
```

Output do processamento:
```
═══════════════════════════════════════════════════════════════
                 PROCESSAMENTO COMPLETO
═══════════════════════════════════════════════════════════════

ARQUIVO: {autor}/{tipo}/{arquivo}.txt
PALAVRAS: {N}
AUTOR: {nome canonico}

INSIGHTS EXTRAIDOS:
  Filosofia:     {N} crencas/principios
  Frameworks:    {N} modelos mentais
  Heuristicas:   {N} regras de bolso
  Metodologias:  {N} processos
  Dilemas:       {N} tensoes

SYNAPSE ATUALIZADO:
  Mind: .claude/synapse/minds/{autor}.yaml (v{N} -> v{N+1})
  Source: inbox/{path} -> inbox/processed/{autor}/{arquivo}.txt

PROXIMA ACAO:
  Ver DNA: cat .claude/synapse/minds/{autor}.yaml
  Consultar expert: /DUARTEOS:{Categoria}:{autor}
  Processar mais: /DUARTEOS:squad:ingest --process

═══════════════════════════════════════════════════════════════
```

### Modo ORGANIZE (--organize)

```
1. ESCANEAR inbox/ por arquivos fora da estrutura padrao
   (ex: arquivo solto na raiz do inbox, sem pasta de autor)

2. PARA cada arquivo desorganizado:
   - DETECTAR autor pelo nome/conteudo
   - DETECTAR tipo de conteudo
   - SUGERIR destino: inbox/{autor-slug}/{tipo}/

3. Se --execute NAO fornecido: mostrar preview (dry-run)
4. Se --execute fornecido: mover arquivos e criar pastas
```

## Deteccao de Autor (Heuristicas)

Detectar autor pelo caminho e nome do arquivo:

| Padrao no path/nome | Autor detectado |
|---------------------|-----------------|
| Pasta pai e nome reconhecivel | Usar nome da pasta |
| Nome do arquivo contem nome | Extrair nome |
| Nenhum padrao detectado | Perguntar ao usuario |

Regra: se o arquivo esta em `inbox/naval-ravikant/`, o autor e "Naval Ravikant".
Se esta em `inbox/` direto (raiz), tentar detectar pelo nome do arquivo ou conteudo.

## Deteccao de Tipo de Conteudo

| Padrao no nome | Tipo |
|----------------|------|
| podcast, episode, ep, interview | PODCASTS |
| course, module, aula, lesson | COURSES |
| article, blog, post, essay | ARTICLES |
| transcript, transcricao | TRANSCRIPTS |
| book, livro, capitulo, chapter | BOOKS |
| talk, palestra, keynote, ted | TALKS |
| (sem padrao detectado) | GENERAL |

## Regras Criticas

1. **SO CONTEUDO LOCAL** — durante processamento, NUNCA usar WebSearch ou WebFetch
   A forca do inbox e que a IA processa SOMENTE o que esta na "caixa"
2. **Rastreabilidade** — todo insight deve referenciar o arquivo fonte
3. **Incremental** — se o mind clone ja existe, fazer MERGE, nunca sobrescrever
4. **Organizado** — manter estrutura inbox/{autor}/{tipo}/ consistente
5. **Idempotente** — processar o mesmo arquivo 2x nao deve duplicar insights

## Exemplos

```bash
# Ver o que tem no inbox
/DUARTEOS:squad:ingest

# Jogar arquivo no inbox e processar
/DUARTEOS:squad:ingest /downloads/hormozi-podcast-ep42.txt

# Processar o proximo da fila
/DUARTEOS:squad:ingest --process

# Processar todos pendentes
/DUARTEOS:squad:ingest --process-all

# Organizar arquivos soltos
/DUARTEOS:squad:ingest --organize
/DUARTEOS:squad:ingest --organize --execute
```

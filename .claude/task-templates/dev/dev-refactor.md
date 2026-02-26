# Task: Dev — Refatorar Codigo

## Objetivo
Refatorar codigo existente melhorando legibilidade, manutenibilidade ou performance, mantendo todos os testes existentes passando e o comportamento externo identico.

## Contexto
Usar quando codigo funcional precisa ser reestruturado sem alterar comportamento. Motivos comuns: duplicacao excessiva, funcao/arquivo muito grande, acoplamento alto, naming confuso, ou preparacao para adicionar nova funcionalidade. A regra de ouro: refactoring NAO muda comportamento — se muda, e uma feature ou bugfix.

## Pre-requisitos
- [ ] Testes existentes cobrem o codigo a ser refatorado (ou serao escritos antes)
- [ ] Code smell identificado e documentado
- [ ] Comportamento atual compreendido (ler o codigo por inteiro)
- [ ] Nenhuma feature em andamento no mesmo codigo (evitar conflitos)

## Passos

### 1. Identificar o Code Smell
Documente o problema especifico:
```
Problema: Arquivo `src/lib/services/video-generator.ts` tem 800 linhas com 12 funcoes
misturando orquestracao, chamadas de API, manipulacao de arquivo e formatacao de dados.

Smell: Large Class / God Object
Impacto: Dificil de testar isoladamente, qualquer mudanca arrisca quebrar funcoes nao relacionadas.
```

Smells comuns:
- **Long Method:** funcao com mais de 50 linhas
- **Large Class:** arquivo com mais de 300 linhas
- **Duplicacao:** mesmo bloco de codigo em 3+ lugares
- **Feature Envy:** funcao que acessa mais dados de outro modulo do que do seu proprio
- **Primitive Obsession:** strings/numeros magicos em vez de tipos/constantes
- **Shotgun Surgery:** uma mudanca requer editar 5+ arquivos

### 2. Garantir Cobertura de Testes
Antes de tocar no codigo:
```bash
# Verificar testes existentes
npx vitest run src/lib/services/__tests__/video-generator.test.ts

# Se nao ha testes, criar testes de caracterizacao primeiro
# Estes testes documentam o comportamento ATUAL (mesmo bugs)
```
Se a cobertura e insuficiente, escreva testes ANTES de refatorar. Isso e parte da task, nao um pre-requisito ignoravel.

### 3. Planejar a Refatoracao
Defina passos atomicos (cada um compilavel e com testes passando):
```
Plano:
1. Extrair funcoes de formatacao para `format-utils.ts` (5 funcoes)
2. Extrair chamadas de API para `video-api-client.ts` (3 funcoes)
3. Extrair manipulacao de arquivo para `video-file-handler.ts` (2 funcoes)
4. Simplificar funcao principal para orquestracao pura
5. Atualizar imports nos consumidores
```
Cada passo deve ser commitable independentemente.

### 4. Executar Refatoracao Incremental
Para cada passo do plano:
1. Fazer a mudanca minima
2. Rodar testes: `npx vitest run [arquivo]`
3. Rodar tipagem: `npx tsc --noEmit`
4. Se tudo verde, prosseguir para o proximo passo
5. Se vermelho, reverter e entender o que quebrou

Tecnicas comuns:
- **Extract Function:** mover bloco de codigo para funcao nomeada
- **Extract Module:** mover funcoes relacionadas para novo arquivo
- **Rename:** nomes mais descritivos (variavel, funcao, arquivo)
- **Inline:** remover indirections desnecessarias
- **Replace Conditional with Polymorphism:** substituir if/switch por strategy pattern
- **Introduce Parameter Object:** agrupar parametros relacionados em um objeto

### 5. Manter Backward Compatibility
Se o codigo refatorado e importado por outros modulos:
```typescript
// video-generator.ts (arquivo original)
// Re-exportar funcoes que foram movidas para manter compatibilidade
export { formatVideoMetadata } from './format-utils'
export { uploadToStorage } from './video-file-handler'

// Adicionar @deprecated para guiar migracao futura
/** @deprecated Use import de './format-utils' diretamente */
export { formatVideoMetadata } from './format-utils'
```

### 6. Atualizar Imports
Busque todos os consumidores e atualize imports:
```bash
# Encontrar todos os arquivos que importam do modulo refatorado
grep -r "from.*video-generator" src/ --include="*.ts" --include="*.tsx"
```
Atualize cada import para apontar ao novo local.

### 7. Verificar Completude
```bash
npx tsc --noEmit          # Zero erros de tipo
npx vitest run             # Todos os testes passando
npm run lint               # Zero warnings
npm run build              # Build funciona
```

### 8. Documentar a Mudanca
Adicione comentario no commit explicando o "por que":
```
refactor: extrair servicos de video-generator em modulos separados

video-generator.ts tinha 800 linhas misturando orquestracao, API calls
e file handling. Separado em 3 modulos focados para facilitar testes
e futuras mudancas no pipeline de video.
```

## Criterios de Aceite
- [ ] Todos os testes existentes continuam passando (ZERO testes quebrados)
- [ ] Comportamento externo e identico (mesmas entradas produzem mesmas saidas)
- [ ] Tipagem passa sem erros (`tsc --noEmit`)
- [ ] Lint passa sem warnings
- [ ] Build passa
- [ ] Codigo refatorado e mais legivel/manutenivel (mudanca tem proposito claro)
- [ ] Nenhuma funcionalidade nova foi adicionada acidentalmente
- [ ] Imports atualizados em todos os consumidores

## Entregaveis
- Codigo refatorado (arquivos modificados e/ou novos)
- Testes de caracterizacao (se criados na etapa 2)
- Commit message descritivo explicando a motivacao

## Verificacao
- [ ] Diff mostra que nenhuma logica de negocio foi alterada
- [ ] Testes passam identicos ao estado anterior
- [ ] Outro desenvolvedor confirma que o codigo ficou mais claro
- [ ] Performance nao degradou (se relevante)

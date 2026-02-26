# Task: QA — Auditoria de Acessibilidade

## Objetivo
Realizar auditoria completa de acessibilidade seguindo WCAG 2.1 nivel AA, verificando navegacao por teclado, compatibilidade com screen readers, contraste de cores e semantica HTML, produzindo relatorio com remedicacoes priorizadas.

## Contexto
Usar antes de lancamentos, apos redesigns significativos, ou como auditoria periodica. Acessibilidade nao e opcional — afeta usuarios com deficiencias visuais, motoras, auditivas e cognitivas. Alem da obrigacao etica, no Brasil a Lei Brasileira de Inclusao (13.146/2015) exige acessibilidade digital. O padrao minimo e WCAG 2.1 AA.

## Pre-requisitos
- [ ] Aplicacao rodando em ambiente acessivel para testes
- [ ] Ferramentas de teste instaladas (axe DevTools, Lighthouse, NVDA/VoiceOver)
- [ ] Paginas/fluxos a serem auditados definidos
- [ ] Conhecimento basico de WCAG 2.1 e ARIA

## Passos

### 1. Auditoria Automatizada
Execute ferramentas automatizadas em todas as paginas:
```
Ferramentas:
- axe DevTools (extensao Chrome) — detecta ~30% dos problemas
- Lighthouse Accessibility audit — score geral + issues
- WAVE Web Accessibility Evaluation — visual overlay dos problemas

Paginas prioritarias para auditar:
- [ ] Landing page (/)
- [ ] Login (/auth/login)
- [ ] Registro (/auth/register)
- [ ] Dashboard principal (/dashboard)
- [ ] Geracao de conteudo (/dashboard/content/new)
- [ ] Listagem de conteudos (/dashboard/library)
- [ ] Configuracoes (/dashboard/settings)

Para cada pagina, registrar:
- Score Lighthouse Accessibility
- Numero de violations (critico, serio, moderado, menor)
- Issues especificas com elemento e WCAG criterion
```

### 2. Verificar Navegacao por Teclado
Teste CADA pagina usando APENAS teclado (sem mouse):
```
Verificacoes:
- [ ] Tab percorre todos os elementos interativos na ordem logica
- [ ] Shift+Tab navega na direcao reversa
- [ ] Enter/Space ativam botoes e links
- [ ] Escape fecha modais e dropdowns
- [ ] Arrow keys navegam dentro de selects, tabs e menus
- [ ] Focus indicator e visivel em TODOS os elementos focaveis
- [ ] Nenhum "focus trap" — usuario pode sair de qualquer componente
- [ ] Skip link existe para pular navegacao (ir direto ao conteudo)

Fluxos criticos para testar por teclado:
1. Login: Tab para email → Tab para senha → Enter para enviar
2. Criar conteudo: navegar pelo formulario inteiro com Tab
3. Modal de confirmacao: abrir, navegar opcoes, fechar com Escape
4. Menu dropdown: abrir com Enter, navegar com Arrow, selecionar com Enter
```

### 3. Testar com Screen Reader
Use VoiceOver (macOS) ou NVDA (Windows):
```
Verificacoes:
- [ ] Todas as imagens tem alt text descritivo (ou alt="" para decorativas)
- [ ] Headings formam hierarquia logica (h1 → h2 → h3, sem pular niveis)
- [ ] Formularios tem labels associados a inputs (via htmlFor/id)
- [ ] Botoes e links tem texto acessivel (nao "Clique aqui")
- [ ] Tabelas tem headers (th) associados a dados (td)
- [ ] Regioes da pagina tem landmarks (nav, main, aside, footer)
- [ ] Status dinamicos sao anunciados (aria-live para toasts, loading states)
- [ ] Conteudo gerado dinamicamente e acessivel (AJAX, SPA navigation)

Comandos VoiceOver (macOS):
- Cmd+F5: ativar/desativar
- VO+Right: proximo elemento
- VO+Left: elemento anterior
- VO+Space: ativar elemento
- VO+U: rotor (lista de headings, links, landmarks)
```

### 4. Verificar Contraste de Cores
```
Requisitos WCAG AA:
- Texto normal (< 18pt): contraste minimo 4.5:1
- Texto grande (>= 18pt ou >= 14pt bold): contraste minimo 3:1
- Componentes UI e graficos: contraste minimo 3:1

Ferramentas:
- Chrome DevTools → Elements → Computed → color (mostra ratio)
- WebAIM Contrast Checker (webaim.org/resources/contrastchecker)
- axe DevTools detecta automaticamente

Problemas comuns em dark themes:
- Texto cinza claro em fundo escuro (slate-400 em slate-900 = 4.4:1 FALHA)
- Texto placeholder muito fraco (slate-500 em slate-800 = 3.2:1 FALHA)
- Bordas de input imperceptiveis
- States desabilitados sem contraste suficiente
```

### 5. Verificar Semantica HTML
```
Estrutura semantica:
- [ ] Unico <h1> por pagina (titulo principal)
- [ ] Headings em ordem hierarquica (nao usar h3 para "texto pequeno")
- [ ] <nav> para navegacao principal e secundaria
- [ ] <main> para conteudo principal (unico por pagina)
- [ ] <aside> para conteudo complementar
- [ ] <footer> para rodape
- [ ] <button> para acoes (nao <div onClick>)
- [ ] <a> para navegacao (nao <button> que faz redirect)
- [ ] Listas usam <ul>/<ol>/<li> (nao divs com bullets visuais)

ARIA (usar apenas quando HTML semantico nao e suficiente):
- [ ] aria-label para botoes com apenas icone
- [ ] aria-expanded para accordions e dropdowns
- [ ] aria-selected para tabs
- [ ] aria-live="polite" para toasts e notificacoes
- [ ] aria-describedby para mensagens de erro em formularios
- [ ] role="alert" para mensagens de erro criticas
- [ ] aria-hidden="true" para elementos puramente decorativos
```

### 6. Verificar Formularios
```
Checklist de formularios acessiveis:
- [ ] Cada input tem <Label> associado (via htmlFor ou wrapping)
- [ ] Campos obrigatorios marcados com aria-required="true"
- [ ] Erros de validacao associados ao campo (aria-describedby)
- [ ] Mensagem de erro anuncia via aria-live quando aparece
- [ ] Autocomplete configurado para campos comuns (email, name, tel)
- [ ] Formato esperado descrito (ex: "DD/MM/AAAA" para data)
- [ ] Tab order segue ordem visual do formulario
- [ ] Submit funciona com Enter
- [ ] Nao depende apenas de cor para indicar erro (icone + texto tambem)
```

### 7. Verificar Conteudo Dinamico
```
SPAs e conteudo AJAX:
- [ ] Mudanca de rota anuncia novo titulo via aria-live ou document.title
- [ ] Loading states acessiveis (aria-busy="true", texto "Carregando...")
- [ ] Toasts/snackbars usam role="status" e aria-live="polite"
- [ ] Modais capturam foco ao abrir e retornam ao trigger ao fechar
- [ ] Scroll infinito tem alternativa (paginacao ou "carregar mais")
- [ ] Animacoes respeitam prefers-reduced-motion

Media query para reduzir animacoes:
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

### 8. Documentar Relatorio
```markdown
## Relatorio de Acessibilidade

**Data:** 2024-01-15
**Padrao:** WCAG 2.1 AA
**Paginas auditadas:** 7

### Score Geral
| Pagina | Lighthouse | Violations | Status |
|--------|-----------|-----------|--------|
| Landing | 92 | 3 menores | ✅ Aprovada |
| Login | 85 | 1 serio, 2 menores | ⚠️ Correcao necessaria |
| Dashboard | 78 | 2 serios, 4 menores | ⚠️ Correcao necessaria |
| Geracao | 65 | 3 criticos, 5 menores | ❌ Reprovada |

### Issues Criticas (corrigir antes de lancamento)
1. **[1.1.1 Non-text Content]** Imagens de carousel sem alt text
   - Localizacao: /dashboard/content/[id]
   - Impacto: Screen readers nao descrevem as imagens
   - Correcao: Adicionar alt descritivo baseado no conteudo do slide

2. **[2.1.1 Keyboard]** Modal de geracao nao acessivel por teclado
   - Localizacao: /dashboard/content/new
   - Impacto: Usuarios que nao usam mouse nao podem gerar conteudo
   - Correcao: Implementar focus trap e navegacao por teclado

### Issues Serias (corrigir em 30 dias)
3. **[1.4.3 Contrast]** Texto placeholder com contraste 3.2:1
   - Correcao: Usar slate-400 em vez de slate-500

### Sugestoes de Melhoria
4. Adicionar skip link em todas as paginas
5. Implementar prefers-reduced-motion
```

## Criterios de Aceite
- [ ] Auditoria automatizada executada em todas as paginas principais
- [ ] Navegacao por teclado testada nos fluxos criticos
- [ ] Screen reader testado em pelo menos 3 fluxos
- [ ] Contraste verificado em todos os textos e componentes
- [ ] Semantica HTML verificada (headings, landmarks, forms)
- [ ] Nenhuma issue critica pendente (WCAG A)
- [ ] Relatorio com issues priorizadas e remedicacoes
- [ ] Lighthouse Accessibility score >= 90 em paginas principais

## Entregaveis
- Relatorio de acessibilidade completo
- Lista de issues priorizadas com correcoes sugeridas
- Screenshots/gravacoes dos problemas encontrados
- Checklist de verificacao por pagina

## Verificacao
- [ ] Issues criticas corrigidas e re-testadas
- [ ] Score Lighthouse >= 90 apos correcoes
- [ ] Fluxos criticos navegaveis por teclado
- [ ] Screen reader consegue usar os fluxos principais

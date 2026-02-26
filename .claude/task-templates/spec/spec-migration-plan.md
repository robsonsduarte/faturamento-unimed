# Task: Spec — Planejar Migracao

## Objetivo
Produzir um plano de migracao completo que documenta o estado atual, estado desejado, estrategia de transicao, riscos mapeados e procedimento de rollback, garantindo que a migracao seja executada com seguranca e minimo impacto.

## Contexto
Usar quando qualquer mudanca significativa precisa acontecer em um sistema em producao: migracao de infraestrutura, troca de provedor de servico, mudanca de framework, reestruturacao de banco de dados, ou migracao de dados entre sistemas. O plano deve ser suficiente para que qualquer membro da equipe execute a migracao com confianca.

## Pre-requisitos
- [ ] Acesso ao sistema atual para auditoria
- [ ] Definicao clara do estado desejado
- [ ] Compreensao das dependencias do sistema (servicos, APIs, integrações)
- [ ] Janela de manutencao identificada (se aplicavel)
- [ ] Ambiente de staging/teste disponivel

## Passos

### 1. Documentar Estado Atual
Mapeie completamente o que existe hoje:
```
## Estado Atual
- **Servico:** PostgreSQL 14 hospedado em Supabase
- **Volume de dados:** ~500k registros, 2.3GB
- **Conexoes ativas:** media 50, pico 200
- **Dependencias upstream:** Next.js API routes, Edge Functions
- **Dependencias downstream:** dashboard analytics, exports CSV
- **SLAs atuais:** 99.9% uptime, <100ms p95 query time
- **Backups:** automaticos a cada 24h, retencao 30 dias
```
Inclua diagramas de arquitetura se a mudanca for significativa.

### 2. Definir Estado Desejado
Descreva o resultado final esperado:
```
## Estado Desejado
- **Servico:** PostgreSQL 16 em instancia dedicada
- **Beneficios:** performance 30% melhor, novas features (JSONB melhorado)
- **Mudancas de schema:** nenhuma (compativel)
- **Mudancas de conexao:** novo connection string
- **SLAs desejados:** manter 99.9% uptime, <80ms p95
```

### 3. Mapear Diferencas (Gap Analysis)
Liste todas as diferencas entre estado atual e desejado:
| Aspecto | Atual | Desejado | Acao Necessaria |
|---------|-------|----------|----------------|
| Versao PostgreSQL | 14 | 16 | Upgrade + teste de compatibilidade |
| Connection string | supabase.co | dedicated.host | Atualizar env vars em todos os servicos |
| SSL | Gerenciado pelo Supabase | Gerenciar certificado proprio | Gerar e instalar cert |

### 4. Definir Estrategia de Migracao
Escolha e justifique a abordagem:

**Big Bang:** Tudo muda de uma vez em uma janela de manutencao.
- Quando usar: mudancas simples, downtime aceitavel
- Risco: alto impacto se falhar

**Blue-Green:** Dois ambientes identicos, troca instantanea.
- Quando usar: zero downtime necessario
- Risco: custo dobrado temporariamente

**Canary/Gradual:** Migra percentual crescente do trafego.
- Quando usar: mudancas de alto risco, precisa validar em producao
- Risco: complexidade de roteamento

**Strangler Fig:** Migra funcionalidade por funcionalidade.
- Quando usar: refatoracao grande, longa duracao
- Risco: periodo longo com dois sistemas

### 5. Criar Checklist Pre-Migracao
```
Pre-migracao (D-7):
- [ ] Backup completo do banco de dados
- [ ] Backup de configuracoes (env vars, DNS, certificados)
- [ ] Teste da migracao em staging (completo, com dados reais anonimizados)
- [ ] Comunicacao aos stakeholders sobre janela de manutencao
- [ ] Documentar metricas baseline (latencia, erro rate, throughput)

Pre-migracao (D-1):
- [ ] Confirmar que backup e restauravel (testar restore)
- [ ] Freeze de deploys — nenhuma mudanca de codigo
- [ ] Time de plantao escalado
- [ ] Canal de comunicacao de incidentes pronto

Pre-migracao (D-0, inicio):
- [ ] Ultimo backup antes de iniciar
- [ ] Ativar pagina de manutencao (se aplicavel)
- [ ] Confirmar que todos os envolvidos estao disponiveis
```

### 6. Detalhar Passos da Migracao
Numere cada passo com tempo estimado e responsavel:
```
1. [00:00] Ativar modo manutencao — @ops
2. [00:05] Executar backup final — @dba
3. [00:15] Verificar backup (checksum) — @dba
4. [00:20] Executar script de migracao — @dev
5. [00:45] Validar integridade dos dados — @qa
6. [01:00] Atualizar connection strings — @ops
7. [01:10] Smoke tests nos endpoints criticos — @qa
8. [01:20] Desativar modo manutencao — @ops
9. [01:25] Monitorar metricas por 30 min — @ops
10. [01:55] Declarar migracao concluida ou iniciar rollback
```

### 7. Planejar Rollback
Defina procedimento de rollback para CADA passo:
```
## Rollback
Trigger: qualquer criterio abaixo acionado
- Error rate > 5% por mais de 5 minutos
- Latencia p95 > 500ms por mais de 5 minutos
- Qualquer perda de dados detectada
- Funcionalidade critica indisponivel

Procedimento:
1. Ativar modo manutencao
2. Reverter connection strings para o original
3. Restaurar backup se dados foram corrompidos
4. Desativar modo manutencao
5. Comunicar stakeholders
6. Post-mortem em 24h

Tempo estimado de rollback: 15 minutos
```

### 8. Definir Validacao Pos-Migracao
```
Pos-migracao (imediato):
- [ ] Todos os endpoints respondendo (health check)
- [ ] Queries criticas executando em tempo aceitavel
- [ ] Dados integros (contagem de registros, checksums)
- [ ] Logs sem erros inesperados

Pos-migracao (24h):
- [ ] Metricas de performance dentro do baseline
- [ ] Nenhum ticket de suporte relacionado
- [ ] Jobs agendados executaram com sucesso

Pos-migracao (7d):
- [ ] Performance estavel
- [ ] Remover recursos do ambiente antigo
- [ ] Documentar licoes aprendidas
```

## Criterios de Aceite
- [ ] Estado atual documentado com diagramas e metricas
- [ ] Estado desejado definido com beneficios quantificados
- [ ] Gap analysis completo com acoes necessarias
- [ ] Estrategia de migracao escolhida e justificada
- [ ] Checklist pre-migracao com datas e responsaveis
- [ ] Passos numerados com tempo estimado
- [ ] Procedimento de rollback detalhado com triggers
- [ ] Validacao pos-migracao com criterios objetivos

## Entregaveis
- Plano de migracao completo (markdown)
- Diagrama antes/depois da arquitetura
- Scripts de migracao (se aplicavel)
- Runbook de rollback
- Checklist de validacao

## Verificacao
- [ ] Migracao foi testada em ambiente de staging com sucesso
- [ ] Tempo total estimado e realista (adicione 50% de buffer)
- [ ] Rollback foi testado e funciona dentro do tempo estimado
- [ ] Todos os envolvidos revisaram e entendem seus papeis

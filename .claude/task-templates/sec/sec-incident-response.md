# Task: Sec — Plano de Resposta a Incidentes

## Objetivo
Criar plano de resposta a incidentes de seguranca cobrindo deteccao, contencao, erradicacao, recuperacao e licoes aprendidas, com procedimentos claros e papeis definidos para cada fase.

## Contexto
Usar ANTES de precisar — o pior momento para criar um plano de incidentes e durante um incidente. Este plano deve estar pronto, revisado e praticado. Cobre desde incidentes simples (conta comprometida) ate criticos (vazamento de dados, ransomware). No Brasil, a LGPD exige notificacao de incidentes que envolvam dados pessoais em ate 2 dias uteis.

## Pre-requisitos
- [ ] Inventario de ativos criticos (sistemas, dados, servicos)
- [ ] Equipe de resposta identificada com contatos
- [ ] Ferramentas de monitoramento e logging funcionais
- [ ] Acesso administrativo aos sistemas criticos
- [ ] Canal de comunicacao alternativo (caso sistema principal esteja comprometido)

## Passos

### 1. Definir Classificacao de Incidentes
```
Severidade 1 (Critico) — Acao imediata, todas as maos:
- Vazamento de dados pessoais (LGPD)
- Sistema completamente comprometido (acesso root)
- Ransomware ou malware ativo
- Perda de dados irreversivel
- Servico principal fora do ar por ataque

Severidade 2 (Alto) — Acao em ate 1 hora:
- Conta de admin comprometida
- Vulnerabilidade ativamente explorada
- Acesso nao autorizado a dados (sem vazamento)
- DDoS afetando disponibilidade

Severidade 3 (Medio) — Acao em ate 4 horas:
- Conta de usuario comprometida
- Vulnerabilidade descoberta (sem exploracao)
- Tentativa de ataque bloqueada
- Comportamento anomalo em logs

Severidade 4 (Baixo) — Acao em ate 24 horas:
- Phishing direcionado a funcionarios
- Scan de vulnerabilidade externo
- Alerta de dependencia com CVE
```

### 2. Definir Equipe de Resposta
```
Equipe de Resposta a Incidentes (IRT):

| Papel | Responsavel | Contato | Backup |
|-------|------------|---------|--------|
| Coordenador de Incidente | CTO | +55... | Tech Lead |
| Analista Tecnico | Dev Senior | +55... | DevOps |
| Comunicacao | CEO/COO | +55... | Marketing |
| Juridico/LGPD | DPO/Advogado | +55... | - |

Canal de comunicacao de incidentes:
- Primario: Slack #incident-response (apenas IRT)
- Secundario: Grupo WhatsApp "Emergencia Sec"
- Terciario: Ligacao telefonica direta

Contatos externos:
- Supabase Support: [contato]
- Provedor VPS (Contabo): [contato]
- Cloudflare: [contato]
- Delegacia de Crimes Ciberneticos: [contato]
```

### 3. Fase 1 — Deteccao e Triagem
```
Fontes de deteccao:
- Alertas de monitoramento (metricas anomalas)
- Logs de aplicacao (erros incomuns, acessos suspeitos)
- Alertas de seguranca (WAF, rate limiting, login failures)
- Reporte de usuario ("minha conta foi invadida")
- Notificacao externa (pesquisador de seguranca, CERT)
- npm audit / Dependabot alert

Procedimento de triagem (primeiros 15 minutos):
1. CONFIRMAR: E realmente um incidente ou falso positivo?
   - Verificar logs
   - Verificar metricas
   - Tentar reproduzir
2. CLASSIFICAR: Qual a severidade? (1-4)
3. COMUNICAR: Notificar coordenador de incidente
4. DOCUMENTAR: Abrir documento de incidente com:
   - Timestamp de deteccao
   - Quem detectou
   - Descricao inicial
   - Severidade atribuida
   - Acoes tomadas
```

### 4. Fase 2 — Contencao
```
Objetivo: Parar a hemorragia. Impedir que o atacante cause mais dano.

Contencao imediata (curto prazo):
- [ ] Isolar sistema comprometido (desconectar da rede se necessario)
- [ ] Revogar credenciais comprometidas (API keys, tokens, senhas)
- [ ] Bloquear IP do atacante (firewall, Cloudflare)
- [ ] Desabilitar conta comprometida
- [ ] Ativar modo manutencao (se necessario)

Contencao estrategica (medio prazo):
- [ ] Aplicar patch temporario (hotfix)
- [ ] Aumentar logging para coletar evidencias
- [ ] Ativar monitoramento extra nos pontos afetados
- [ ] Rotacionar todas as credenciais potencialmente expostas

IMPORTANTE: NAO destruir evidencias!
- Nao reiniciar servidores (perde logs em memoria)
- Nao limpar logs
- Nao alterar timestamps
- Fazer backup forense ANTES de remediar
```

### 5. Fase 3 — Erradicacao
```
Objetivo: Remover a causa raiz. Garantir que o atacante nao tenha mais acesso.

Procedimento:
- [ ] Identificar COMO o atacante entrou (root cause)
- [ ] Identificar TUDO que foi acessado/alterado (blast radius)
- [ ] Remover backdoors, malware, contas nao autorizadas
- [ ] Corrigir a vulnerabilidade explorada
- [ ] Rotacionar TODAS as credenciais (nao apenas as comprometidas)
- [ ] Atualizar dependencias vulneraveis
- [ ] Revisar logs para confirmar nenhum outro acesso persistente

Checklist de credenciais para rotacionar:
- [ ] Senhas de usuarios admin
- [ ] Service role key do Supabase
- [ ] API keys de servicos externos (AI, Stripe)
- [ ] SSH keys do servidor
- [ ] Secrets do CI/CD
- [ ] Tokens de integracao
```

### 6. Fase 4 — Recuperacao
```
Objetivo: Restaurar operacao normal com confianca.

Procedimento:
- [ ] Restaurar sistemas a partir de backup limpo (se dados foram corrompidos)
- [ ] Reativar servicos gradualmente (nao tudo de uma vez)
- [ ] Monitorar intensivamente por 72 horas:
  - Error rate
  - Login attempts
  - Acessos a endpoints afetados
  - Novos IPs em areas sensiveis
- [ ] Validar integridade dos dados:
  - Contagem de registros vs backup
  - Checksums de arquivos criticos
  - Verificar que RLS esta funcional
- [ ] Comunicar usuarios afetados (se aplicavel)
- [ ] Desativar modo manutencao quando estavel

Comunicacao para usuarios (se dados foram afetados):
- O que aconteceu (sem detalhes tecnicos explorarios)
- Quais dados foram afetados
- O que fizemos para resolver
- O que o usuario deve fazer (trocar senha, etc)
- Contato para duvidas
```

### 7. Fase 5 — Pos-Incidente (Licoes Aprendidas)
```
Post-mortem (ate 72 horas apos resolucao):

Documento de post-mortem:
## Post-Mortem — Incidente [ID]

**Data do incidente:** [data]
**Duracao:** [tempo de deteccao a resolucao]
**Severidade:** [1-4]
**Impacto:** [usuarios afetados, dados expostos, downtime]

### Timeline
| Hora | Evento |
|------|--------|
| 14:23 | Alerta de login anomalo detectado |
| 14:28 | Coordenador de incidente notificado |
| 14:35 | Confirmado: conta admin comprometida |
| 14:40 | Conta desabilitada, credenciais revogadas |
| 15:00 | Root cause identificado: phishing |
| 15:30 | Todas as credenciais rotacionadas |
| 16:00 | Monitoramento extra ativado |
| 16:30 | Incidente declarado resolvido |

### Root Cause
[O que causou o incidente — ser honesto, sem culpar pessoas]

### O Que Funcionou
- Alerta detectou rapidamente
- Contencao foi executada em 12 minutos

### O Que Nao Funcionou
- Nao tinhamos MFA habilitado para admins
- Playbook de phishing nao existia

### Acoes de Melhoria
| Acao | Responsavel | Prazo |
|------|------------|-------|
| Habilitar MFA obrigatorio para admins | @ops | 7 dias |
| Criar playbook anti-phishing | @sec | 14 dias |
| Treinar equipe sobre phishing | @hr | 30 dias |
```

### 8. Manter e Praticar o Plano
```
Manutencao continua:
- [ ] Revisar plano trimestralmente
- [ ] Atualizar contatos quando equipe muda
- [ ] Simulacao de incidente semestral (tabletop exercise)
- [ ] Testar procedimento de rotacao de credenciais
- [ ] Verificar que ferramentas de deteccao estao funcionais
- [ ] Treinar novos membros da equipe no plano

Simulacao sugerida:
"Cenario: Recebemos email de pesquisador de seguranca informando que
encontrou dados de usuarios em um bucket S3 publico. O que fazemos?"
- Executar triagem, contencao, investigacao em modo simulado
- Documentar gaps encontrados no plano
- Atualizar plano com melhorias
```

## Criterios de Aceite
- [ ] Classificacao de severidade definida com exemplos
- [ ] Equipe de resposta identificada com contatos de emergencia
- [ ] Procedimentos para cada fase documentados (deteccao → pos-incidente)
- [ ] Checklist de contencao para cenarios mais provaveis
- [ ] Template de post-mortem pronto
- [ ] Canal de comunicacao alternativo definido
- [ ] Consideracoes LGPD documentadas (notificacao em 2 dias uteis)
- [ ] Plano revisado por toda a equipe de resposta
- [ ] Primeira simulacao agendada

## Entregaveis
- Plano de resposta a incidentes completo (markdown)
- Lista de contatos de emergencia
- Template de documento de incidente
- Template de post-mortem
- Checklist de contencao por cenario
- Calendario de revisoes e simulacoes

## Verificacao
- [ ] Qualquer membro da equipe sabe como iniciar o processo de resposta
- [ ] Canal de comunicacao de emergencia funciona
- [ ] Credenciais podem ser revogadas em <15 minutos
- [ ] Primeira simulacao executada com sucesso
- [ ] Plano esta acessivel mesmo se sistemas principais estiverem fora do ar

# Task: Ops — Configurar Certificado SSL

## Objetivo
Configurar certificado SSL/TLS para o dominio da aplicacao com geracao automatizada, instalacao no servidor web, renovacao automatica e verificacao de seguranca.

## Contexto
Usar ao configurar um novo dominio, renovar certificado expirado, ou migrar para HTTPS. SSL e obrigatorio para qualquer aplicacao em producao: protege dados em transito, e exigido por navegadores para features modernas (Service Workers, Geolocation), e fator de ranking no Google. Let's Encrypt e a opcao padrao (gratuito, automatizado).

## Pre-requisitos
- [ ] Dominio registrado e DNS configurado (A record apontando para o servidor)
- [ ] Acesso root/sudo ao servidor
- [ ] Servidor web instalado (Nginx, Apache, Caddy)
- [ ] Portas 80 e 443 abertas no firewall
- [ ] Nenhum outro processo usando as portas 80/443

## Passos

### 1. Instalar Certbot
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y certbot

# Com plugin Nginx
sudo apt install -y python3-certbot-nginx

# Verificar instalacao
certbot --version
```

### 2. Gerar Certificado com Let's Encrypt
```bash
# Metodo 1: Plugin Nginx (recomendado se Nginx instalado)
sudo certbot --nginx -d app.example.com.br -d www.app.example.com.br

# Metodo 2: Standalone (para quando nao ha servidor web rodando)
sudo certbot certonly --standalone -d app.example.com.br

# Metodo 3: DNS challenge (para wildcards ou quando porta 80 nao esta disponivel)
sudo certbot certonly --manual --preferred-challenges dns -d *.example.com.br

# Opcoes recomendadas durante o wizard:
# - Email: ops@example.com (para avisos de expiracao)
# - Agree to TOS: Yes
# - Share email: No
# - Redirect HTTP to HTTPS: Yes
```

### 3. Configurar Nginx com SSL
```nginx
# /etc/nginx/sites-available/app.example.com.br

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name app.example.com.br www.app.example.com.br;
    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name app.example.com.br;

    # Certificados (gerados pelo certbot)
    ssl_certificate /etc/letsencrypt/live/app.example.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com.br/privkey.pem;

    # Configuracao SSL moderna (TLS 1.2+)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/app.example.com.br/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Session tickets
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # Proxy para Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Configurar Renovacao Automatica
```bash
# Certbot ja instala um timer/cron para renovacao
# Verificar que esta configurado:
sudo systemctl list-timers | grep certbot
# ou
sudo crontab -l | grep certbot

# Se nao estiver, adicionar manualmente:
# Renovar 2x por dia (certbot so renova quando faltam <30 dias)
echo "0 */12 * * * root certbot renew --quiet --deploy-hook 'systemctl reload nginx'" | sudo tee /etc/cron.d/certbot-renew

# Testar renovacao (dry run)
sudo certbot renew --dry-run
```

### 5. Verificar Configuracao SSL
```bash
# Teste local
curl -vI https://app.example.com.br 2>&1 | grep -E "SSL|certificate|expire"

# Verificar chain completa
openssl s_client -connect app.example.com.br:443 -servername app.example.com.br < /dev/null 2>/dev/null | openssl x509 -text -noout | grep -A2 "Validity"

# Verificar data de expiracao
echo | openssl s_client -connect app.example.com.br:443 -servername app.example.com.br 2>/dev/null | openssl x509 -noout -enddate
```

Testes online:
- SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=app.example.com.br
  Target: Score A+ (sem vulnerabilidades)
- Mozilla Observatory: https://observatory.mozilla.org/

### 6. Configurar Headers de Seguranca
```nginx
# Adicionar ao bloco server HTTPS:

# Prevenir clickjacking
add_header X-Frame-Options "DENY" always;

# Prevenir MIME type sniffing
add_header X-Content-Type-Options "nosniff" always;

# XSS Protection
add_header X-XSS-Protection "1; mode=block" always;

# Referrer Policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Content Security Policy (ajustar conforme necessidade)
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" always;

# Permissions Policy
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

### 7. Configurar Alerta de Expiracao
```bash
#!/bin/bash
# scripts/check-ssl-expiry.sh

DOMAIN="app.example.com.br"
ALERT_DAYS=14
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"

# Verificar dias ate expiracao
EXPIRY_DATE=$(echo | openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "${EXPIRY_DATE}" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

echo "Certificado de ${DOMAIN} expira em ${DAYS_LEFT} dias (${EXPIRY_DATE})"

if [ ${DAYS_LEFT} -lt ${ALERT_DAYS} ]; then
  curl -X POST "${SLACK_WEBHOOK}" \
    -H 'Content-type: application/json' \
    -d "{\"text\":\"ALERTA: Certificado SSL de ${DOMAIN} expira em ${DAYS_LEFT} dias!\"}"
fi

# Agendar no cron (verificar diariamente)
# 0 9 * * * /opt/app/scripts/check-ssl-expiry.sh
```

### 8. Documentar Configuracao
```markdown
## Certificado SSL — app.example.com.br

### Detalhes
- Autoridade: Let's Encrypt
- Tipo: RSA 2048 / ECDSA P-256
- Validade: 90 dias (renovacao automatica)
- Score SSL Labs: A+

### Arquivos
- Certificado: /etc/letsencrypt/live/app.example.com.br/fullchain.pem
- Chave privada: /etc/letsencrypt/live/app.example.com.br/privkey.pem
- Chain: /etc/letsencrypt/live/app.example.com.br/chain.pem

### Renovacao
- Automatica via certbot timer (2x/dia)
- Reload Nginx automatico apos renovacao
- Alerta se faltam <14 dias para expirar

### Troubleshooting
# Certificado expirou
sudo certbot renew --force-renewal
sudo systemctl reload nginx

# Erro de permissao
sudo chmod 600 /etc/letsencrypt/live/app.example.com.br/privkey.pem

# DNS nao resolvendo
dig app.example.com.br +short
# Deve retornar o IP do servidor
```

## Criterios de Aceite
- [ ] Certificado SSL valido e instalado
- [ ] HTTPS funcional no dominio principal
- [ ] HTTP redireciona para HTTPS (301)
- [ ] Score A ou A+ no SSL Labs
- [ ] TLS 1.2+ apenas (TLS 1.0 e 1.1 desabilitados)
- [ ] HSTS habilitado com max-age >= 1 ano
- [ ] Renovacao automatica configurada e testada (dry run)
- [ ] Alerta de expiracao configurado
- [ ] Headers de seguranca configurados
- [ ] Nginx reload automatico apos renovacao

## Entregaveis
- Configuracao Nginx com SSL
- Script de verificacao de expiracao
- Cron de renovacao automatica
- Documentacao da configuracao

## Verificacao
- [ ] `curl -I https://app.example.com.br` retorna 200 com headers SSL
- [ ] `curl -I http://app.example.com.br` retorna 301 para HTTPS
- [ ] SSL Labs score >= A
- [ ] `certbot renew --dry-run` passa sem erros
- [ ] Alerta de expiracao dispara corretamente (testar com ALERT_DAYS=90)

# Task: Setup de Banco de Dados

## Objetivo

Criar o schema do banco de dados com todas as tabelas, relacoes, indices e policies necessarias.

## Contexto

- Definir tabelas principais e suas relacoes
- Configurar RLS (Row Level Security) quando aplicavel
- Criar indices para queries frequentes
- Definir tipos e enums necessarios

## Criterios de Aceite

- [ ] Schema criado com migrations versionadas
- [ ] RLS policies configuradas para todas as tabelas com dados de usuario
- [ ] Indices criados para colunas usadas em WHERE e JOIN
- [ ] Seed data para desenvolvimento (se aplicavel)
- [ ] Tipos TypeScript gerados a partir do schema

## Entregaveis

- Arquivos de migration
- Arquivo de seed (opcional)
- Tipos TypeScript do schema

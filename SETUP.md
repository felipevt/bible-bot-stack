# 📖 Bible Bot - Setup Completo

## 🚀 Pré-requisitos

- **Windows 11** com Docker Desktop instalado
- **Git** para clonar o repositório
- **8GB RAM** mínimo recomendado
- **Porta 5678, 8080, 5432, 6379** disponíveis

## 📁 Estrutura do Projeto

Crie a seguinte estrutura de pastas:

```
bible-bot/
├── docker-compose.yml
├── database/
│   ├── init.sql
│   └── seed.sql
├── scheduler/
│   ├── Dockerfile
│   ├── package.json
│   └── index.js
├── progress-service/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── n8n/
│   └── workflows/
│       └── bible-bot-main.json
└── README.md
```

## 🛠️ Instalação Passo a Passo

### 1. Preparar o Ambiente

```bash
# Criar diretório do projeto
mkdir bible-bot
cd bible-bot

# Criar subdiretórios
mkdir database scheduler progress-service n8n n8n/workflows
```

### 2. Salvar os Arquivos

Copie todos os arquivos fornecidos para suas respectivas pastas conforme a estrutura acima.

### 3. Iniciar os Serviços

```bash
# No diretório raiz do projeto
docker-compose up -d
```

### 4. Verificar se todos os serviços subiram

```bash
docker-compose ps
```

Você deve ver todos os serviços como "Up":
- bible-bot-postgres
- bible-bot-redis  
- bible-bot-n8n
- bible-bot-evolution
- bible-bot-scheduler
- bible-bot-progress

## ⚙️ Configuração do N8N

### 1. Acessar o N8N
- URL: http://localhost:5678
- Usuário: `admin`
- Senha: `bible_admin_2025`

### 2. Configurar Credencial do PostgreSQL

1. Vá em **Settings > Credentials**
2. Clique em **+ Add Credential**
3. Escolha **Postgres**
4. Configure:
   - **Name**: `Bible Bot Database`
   - **Host**: `postgres`
   - **Database**: `bible_bot`
   - **User**: `bible_user`
   - **Password**: `bible_pass_2025`
   - **Port**: `5432`
5. Clique em **Test connection** e depois **Save**

### 3. Importar Workflow

1. Vá em **Workflows**
2. Clique em **+ Add Workflow**
3. Clique nos 3 pontos (...) > **Import from file**
4. Selecione o arquivo `n8n/workflows/bible-bot-main.json`
5. Clique em **Save** e depois **Activate**

## 📱 Configuração do WhatsApp (Evolution API)

### 1. Acessar Evolution API
- URL: http://localhost:8080

### 2. Criar Instância

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: evolution_bible_bot_2025" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "bible_bot_instance",
    "token": "bible_bot_token",
    "qrcode": true,
    "webhook": "http://n8n:5678/webhook/whatsapp"
  }'
```

### 3. Conectar WhatsApp

1. Obter QR Code:
```bash
curl -X GET http://localhost:8080/instance/connect/bible_bot_instance \
  -H "apikey: evolution_bible_bot_2025"
```

2. Escaneie o QR Code com seu WhatsApp
3. Aguarde a confirmação de conexão

## 🧪 Teste do Sistema

### 1. Testar Banco de Dados

```bash
docker exec -it bible-bot-postgres psql -U bible_user -d bible_bot -c "SELECT COUNT(*) FROM reading_plans;"
```

Deve retornar: `count: 4`

### 2. Testar Progress Service

```bash
curl http://localhost:3001/health
```

Deve retornar: `{"status":"healthy",...}`

### 3. Testar Scheduler

```bash
curl http://localhost:3000/health
```

Deve retornar: `{"status":"healthy",...}`

### 4. Testar WhatsApp

Envie uma mensagem "Oi" para o número conectado. O bot deve responder com o menu de boas-vindas.

## 📊 Monitoramento

### Logs dos Serviços

```bash
# Logs do scheduler
docker logs bible-bot-scheduler -f

# Logs do progress service  
docker logs bible-bot-progress -f

# Logs do N8N
docker logs bible-bot-n8n -f

# Logs da Evolution API
docker logs bible-bot-evolution -f
```

### Verificar Execuções no N8N

1. Acesse http://localhost:5678
2. Vá em **Executions** para ver o histórico
3. Clique em uma execução para ver detalhes

## 🔧 Comandos Úteis

### Reiniciar Serviços

```bash
docker-compose restart
```

### Parar Todos os Serviços

```bash
docker-compose down
```

### Limpar Dados e Reiniciar

```bash
docker-compose down -v
docker-compose up -d
```

### Backup do Banco

```bash
docker exec bible-bot-postgres pg_dump -U bible_user bible_bot > backup.sql
```

### Restaurar Backup

```bash
cat backup.sql | docker exec -i bible-bot-postgres psql -U bible_user -d bible_bot
```

## 🚨 Solução de Problemas

### Erro de Porta em Uso

```bash
# Verificar qual processo está usando a porta
netstat -ano | findstr :5678

# Parar o processo se necessário
taskkill /PID <PID_NUMBER> /F
```

### Banco não Conecta

1. Verificar se o PostgreSQL subiu:
```bash
docker logs bible-bot-postgres
```

2. Testar conexão manual:
```bash
docker exec -it bible-bot-postgres psql -U bible_user -d bible_bot
```

### Evolution API não Conecta

1. Verificar logs:
```bash
docker logs bible-bot-evolution
```

2. Recriar instância:
```bash
curl -X DELETE http://localhost:8080/instance/delete/bible_bot_instance \
  -H "apikey: evolution_bible_bot_2025"
```

### N8N não Executa Workflow

1. Verificar webhook está ativo
2. Testar webhook manualmente:
```bash
curl -X POST http://localhost:5678/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'
```

## 🔐 Segurança

### Alterar Senhas Padrão

Edite o `docker-compose.yml` e altere:
- `POSTGRES_PASSWORD`
- `N8N_BASIC_AUTH_PASSWORD`  
- `AUTHENTICATION_API_KEY`

### Firewall

Configure o firewall para bloquear acesso externo às portas, mantendo apenas:
- 5678 (N8N - apenas para administração)
- 8080 (Evolution API - apenas para administração)

## 📈 Performance

### Para Muitos Usuários (>1000)

1. Aumente recursos no `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 1G
```

2. Configure connection pooling no PostgreSQL
3. Configure cluster Redis se necessário

## ✅ Checklist Final

- [ ] Todos os containers estão rodando
- [ ] Banco de dados foi populado
- [ ] N8N está acessível e workflow importado
- [ ] Evolution API conectou ao WhatsApp
- [ ] Teste de mensagem funcionou
- [ ] Logs estão sem erros críticos
- [ ] Progress Service responde
- [ ] Scheduler está executando

## 🎉 Pronto!

Seu Bible Bot está funcionando! Os usuários podem:

1. Enviar "Oi" para começar
2. Escolher um plano de leitura  
3. Definir horário de notificação
4. Receber leituras diárias
5. Acompanhar progresso
6. Marcar leituras como completas

**Comandos principais para usuários:**
- `MENU` - Menu principal
- `PROGRESSO` - Ver progresso completo
- `LI` - Marcar leitura como feita
- `PRÓXIMAS` - Próximas leituras
- `HISTÓRICO` - Últimas leituras

Qualquer dúvida, verifique os logs dos serviços para debugging!
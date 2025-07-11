const cron = require('node-cron');
const { Client } = require('pg');
const redis = require('redis');
const axios = require('axios');
const moment = require('moment-timezone');

// Configurações
const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bible_bot',
    user: process.env.DB_USER || 'bible_user',
    password: process.env.DB_PASSWORD || 'bible_pass_2025'
  },
  redis: {
    url: process.env.REDIS_URL || null,  // URL completa da Railway
    // Fallback para config individual
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null
  }
};

// Clientes
let dbClient;
let redisClient;

// Inicializar conexões
async function initializeConnections() {
  try {
    // PostgreSQL
    dbClient = new Client(config.db);
    await dbClient.connect();
    console.log('✅ Conectado ao PostgreSQL');

    // Redis - com suporte para URL completa
    if (config.redis.url) {
      // Usar URL completa da Railway
      redisClient = redis.createClient({
        url: config.redis.url
      });
    } else {
      // Usar configuração individual
      redisClient = redis.createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port
        },
        password: config.redis.password
      });
    }
    
    redisClient.on('error', (err) => {
      console.error('❌ Erro no Redis:', err);
    });
    
    await redisClient.connect();
    console.log('✅ Conectado ao Redis');
    
    // Testar conexão
    await redisClient.ping();
    console.log('✅ Redis respondeu ao PING');

  } catch (error) {
    console.error('❌ Erro ao conectar:', error);
    process.exit(1);
  }
}

// Buscar usuários para notificar
async function getUsersToNotify(currentTime) {
  const query = `
    SELECT 
      u.id,
      u.phone_number,
      u.name,
      u.current_plan_id,
      u.notification_time,
      u.timezone,
      u.started_at,
      rp.name as plan_name,
      dr.day_number,
      dr.reference_text,
      dr.book_name,
      dr.chapters
    FROM users u
    JOIN reading_plans rp ON rp.id = u.current_plan_id
    JOIN daily_readings dr ON dr.plan_id = u.current_plan_id
    LEFT JOIN user_progress up ON up.user_id = u.id 
      AND up.plan_id = u.current_plan_id 
      AND up.day_number = dr.day_number
    WHERE u.is_active = true
      AND u.notification_time = $1
      AND (u.started_at::DATE + dr.day_number - 1) = CURRENT_DATE
      AND (up.completed IS NULL OR up.completed = false)
  `;
  
  const result = await dbClient.query(query, [currentTime]);
  return result.rows;
}

// Enviar notificação via Evolution API
async function sendNotification(user, reading) {
  try {
    const message = formatNotificationMessage(user, reading);
    
    const response = await axios.post(
      `${config.evolution.url}/message/sendText/bible_bot_instance`,
      {
        number: user.phone_number,
        text: message
      },
      {
        headers: {
          'apikey': config.evolution.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`📤 Notificação enviada para ${user.phone_number}`);
    
    // Registrar no banco
    await logMessage(user.id, 'outgoing', message, 'sent');
    
    // Cache no Redis para evitar duplicatas
    const cacheKey = `notification:${user.id}:${reading.day_number}:${moment().format('YYYY-MM-DD')}`;
    await redisClient.setEx(cacheKey, 3600, 'sent'); // 1 hora de cache
    
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar notificação para ${user.phone_number}:`, error.message);
    await logMessage(user.id, 'outgoing', '', 'failed');
    return false;
  }
}

// Formatar mensagem de notificação
function formatNotificationMessage(user, reading) {
  const daysSinceStart = moment().diff(moment(user.started_at), 'days') + 1;
  
  return `📖 *Sua leitura de hoje!*

👋 Olá ${user.name || 'amigo(a)'}!

📅 *Dia ${reading.day_number}* do seu plano "${user.plan_name}"
📖 *Leitura:* ${reading.reference_text}

🔥 *Você está no dia ${daysSinceStart}* da sua jornada!

Após ler, confirme aqui para eu acompanhar seu progresso! 📊

_Responda *LI* quando terminar a leitura_
_Ou digite *MENU* para mais opções_`;
}

// Registrar mensagem no banco
async function logMessage(userId, type, content, status) {
  try {
    await dbClient.query(
      'INSERT INTO message_logs (user_id, message_type, message_content, status) VALUES ($1, $2, $3, $4)',
      [userId, type, content, status]
    );
  } catch (error) {
    console.error('❌ Erro ao registrar mensagem:', error);
  }
}

// Verificar se já foi notificado hoje
async function wasAlreadyNotified(userId, dayNumber) {
  const cacheKey = `notification:${userId}:${dayNumber}:${moment().format('YYYY-MM-DD')}`;
  const cached = await redisClient.get(cacheKey);
  return cached !== null;
}

// Função principal de processamento
async function processNotifications() {
  const currentTime = moment().format('HH:mm:ss');
  console.log(`🔄 Verificando notificações para ${currentTime}...`);
  
  try {
    const users = await getUsersToNotify(currentTime);
    console.log(`📋 ${users.length} usuários encontrados para notificar`);
    
    for (const user of users) {
      // Verificar se já foi notificado
      if (await wasAlreadyNotified(user.id, user.day_number)) {
        console.log(`⏭️ Usuário ${user.phone_number} já foi notificado hoje`);
        continue;
      }
      
      // Enviar notificação
      await sendNotification(user, {
        day_number: user.day_number,
        reference_text: user.reference_text,
        book_name: user.book_name,
        chapters: user.chapters
      });
      
      // Pequena pausa entre envios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('❌ Erro ao processar notificações:', error);
  }
}

// Limpeza de cache antigo
async function cleanupCache() {
  try {
    const keys = await redisClient.keys('notification:*');
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
    
    for (const key of keys) {
      if (key.includes(yesterday)) {
        await redisClient.del(key);
      }
    }
    
    console.log('🧹 Cache antigo limpo');
  } catch (error) {
    console.error('❌ Erro na limpeza do cache:', error);
  }
}

// Verificar usuários que perderam leituras
async function checkMissedReadings() {
  try {
    const query = `
      SELECT DISTINCT
        u.id,
        u.phone_number,
        u.name,
        COUNT(*) as missed_days
      FROM users u
      JOIN daily_readings dr ON dr.plan_id = u.current_plan_id
      LEFT JOIN user_progress up ON up.user_id = u.id 
        AND up.plan_id = u.current_plan_id 
        AND up.day_number = dr.day_number
      WHERE u.is_active = true
        AND (u.started_at::DATE + dr.day_number - 1) < CURRENT_DATE
        AND (up.completed IS NULL OR up.completed = false)
      GROUP BY u.id, u.phone_number, u.name
      HAVING COUNT(*) >= 3  -- 3 ou mais dias perdidos
    `;
    
    const result = await dbClient.query(query);
    
    for (const user of result.rows) {
      // Enviar mensagem de encorajamento (sem spam)
      const lastEncouragement = await redisClient.get(`encouragement:${user.id}`);
      if (!lastEncouragement) {
        await sendEncouragementMessage(user);
        await redisClient.setEx(`encouragement:${user.id}`, 86400 * 3, 'sent'); // 3 dias
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar leituras perdidas:', error);
  }
}

// Enviar mensagem de encorajamento
async function sendEncouragementMessage(user) {
  const message = `💪 *Não desista!*

Olá ${user.name || 'amigo(a)'}! 

Notei que você perdeu algumas leituras, mas isso é normal! O importante é recomeçar. 🙏

📖 Que tal recuperar o ritmo hoje? Digite *MENU* para ver suas opções.

_"O Senhor é compassivo e cheio de misericórdia"_ - Salmos 145:8`;

  try {
    await axios.post(
      `${config.evolution.url}/message/sendText/bible_bot_instance`,
      {
        number: user.phone_number,
        text: message
      },
      {
        headers: {
          'apikey': config.evolution.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    await logMessage(user.id, 'outgoing', message, 'sent');
    console.log(`💪 Mensagem de encorajamento enviada para ${user.phone_number}`);
    
  } catch (error) {
    console.error(`❌ Erro ao enviar encorajamento para ${user.phone_number}:`, error);
  }
}

// Health check endpoint usando http nativo
const http = require('http');

// Criar servidor HTTP simples para health check
const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Inicialização
async function start() {
  console.log('🚀 Iniciando Bible Bot Scheduler...');
  
  await initializeConnections();
  
  // Iniciar servidor HTTP para health check
  server.listen(3000, () => {
    console.log('✅ Health check disponível na porta 3000');
  });
  
  // Agendar verificação de notificações a cada minuto
  cron.schedule('* * * * *', processNotifications);
  console.log('⏰ Agendador de notificações iniciado (a cada minuto)');
  
  // Limpeza de cache às 2h da manhã
  cron.schedule('0 2 * * *', cleanupCache);
  console.log('🧹 Agendador de limpeza iniciado (2h da manhã)');
  
  // Verificar leituras perdidas às 20h
  cron.schedule('0 20 * * *', checkMissedReadings);
  console.log('💪 Agendador de encorajamento iniciado (20h)');
  
  console.log('✅ Bible Bot Scheduler executando!');
}

// Lidar com sinais de encerramento
process.on('SIGINT', async () => {
  console.log('🛑 Encerrando Bible Bot Scheduler...');
  
  if (dbClient) await dbClient.end();
  if (redisClient) await redisClient.quit();
  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  process.exit(1);
});

// Iniciar aplicação
start().catch(console.error);
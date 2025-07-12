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
    url: process.env.REDIS_URL || null,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null
  },
  evolution: {
    url: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY || 'evolution_bible_bot_2025',
    instance: process.env.EVOLUTION_INSTANCE || 'bible_bot_instance'
  },
  timezone: process.env.TZ || 'America/Sao_Paulo'
};

// Configurar timezone
moment.tz.setDefault(config.timezone);

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
    
    // Testar query
    const testResult = await dbClient.query('SELECT NOW() as db_time, CURRENT_DATE as db_date');
    console.log('📅 Hora do banco:', testResult.rows[0].db_time);
    console.log('📅 Data do banco:', testResult.rows[0].db_date);

    // Redis
    if (config.redis.url) {
      redisClient = redis.createClient({ url: config.redis.url });
    } else {
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

  } catch (error) {
    console.error('❌ Erro ao conectar:', error);
    process.exit(1);
  }
}

// Buscar usuários para notificar
async function getUsersToNotify(currentTime) {
  console.log(`🔍 Buscando usuários para notificar às ${currentTime}`);
  
  // Primeiro, vamos ver quantos usuários ativos existem
  const activeUsersQuery = `
    SELECT COUNT(*) as total, 
           COUNT(CASE WHEN notification_time IS NOT NULL THEN 1 END) as with_time
    FROM users 
    WHERE is_active = true AND current_plan_id IS NOT NULL
  `;
  
  const activeUsers = await dbClient.query(activeUsersQuery);
  console.log(`👥 Usuários ativos: ${activeUsers.rows[0].total}, com horário: ${activeUsers.rows[0].with_time}`);
  
  // Debug: Ver horários configurados
  const timesQuery = `
    SELECT DISTINCT notification_time, COUNT(*) as count 
    FROM users 
    WHERE is_active = true AND notification_time IS NOT NULL 
    GROUP BY notification_time 
    ORDER BY notification_time
  `;
  
  const times = await dbClient.query(timesQuery);
  console.log('⏰ Horários configurados:');
  times.rows.forEach(t => {
    console.log(`   - ${t.notification_time}: ${t.count} usuário(s)`);
  });
  
  // Query principal com mais informações
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
      rp.total_days,
      -- Calcular qual dia do plano é hoje
      (CURRENT_DATE - u.started_at::DATE + 1) as current_day_number
    FROM users u
    JOIN reading_plans rp ON rp.id = u.current_plan_id
    WHERE u.is_active = true
      AND u.notification_time = $1
      AND u.started_at IS NOT NULL
  `;
  
  const result = await dbClient.query(query, [currentTime]);
  console.log(`📊 Usuários encontrados para ${currentTime}: ${result.rows.length}`);
  
  // Para cada usuário, buscar a leitura do dia
  const usersWithReadings = [];
  
  for (const user of result.rows) {
    const dayNumber = user.current_day_number;
    
    // Verificar se o dia está dentro do plano
    if (dayNumber > 0 && dayNumber <= user.total_days) {
      // Buscar leitura do dia
      const readingQuery = `
        SELECT dr.*, up.completed
        FROM daily_readings dr
        LEFT JOIN user_progress up ON up.user_id = $1 
          AND up.plan_id = dr.plan_id 
          AND up.day_number = dr.day_number
        WHERE dr.plan_id = $2 AND dr.day_number = $3
      `;
      
      const readingResult = await dbClient.query(readingQuery, [user.id, user.current_plan_id, dayNumber]);
      
      if (readingResult.rows.length > 0 && !readingResult.rows[0].completed) {
        const reading = readingResult.rows[0];
        console.log(`📖 ${user.phone_number} - Dia ${dayNumber}: ${reading.reference_text}`);
        
        usersWithReadings.push({
          ...user,
          day_number: dayNumber,
          reference_text: reading.reference_text,
          book_name: reading.book_name,
          chapters: reading.chapters
        });
      }
    } else {
      console.log(`⚠️ ${user.phone_number} - Dia ${dayNumber} fora do plano (total: ${user.total_days})`);
    }
  }
  
  return usersWithReadings;
}

// Formatar mensagem de notificação (com escape correto)
function formatNotificationMessage(user, reading) {
  const daysSinceStart = reading.day_number;
  
  // IMPORTANTE: Usar \\n para quebras de linha no WhatsApp
  return `📖 *Sua leitura de hoje!*\\n\\n` +
    `👋 Olá ${user.name || 'amigo(a)'}!\\n\\n` +
    `📅 *Dia ${reading.day_number}* do seu plano "${user.plan_name}"\\n` +
    `📖 *Leitura:* ${reading.reference_text}\\n\\n` +
    `🔥 *Você está no dia ${daysSinceStart}* da sua jornada!\\n\\n` +
    `Após ler, confirme aqui para eu acompanhar seu progresso! 📊\\n\\n` +
    `_Digite *2* para marcar como lida_\\n` +
    `_Digite *1* para ver o menu_`;
}

// Enviar notificação via Evolution API
async function sendNotification(user, reading) {
  try {
    const message = formatNotificationMessage(user, reading);
    
    console.log(`📤 Enviando para ${user.phone_number}...`);
    
    const response = await axios.post(
      `${config.evolution.url}/message/sendText/${config.evolution.instance}`,
      {
        number: user.phone_number,
        text: message,
        delay: 1000 // Delay de 1 segundo
      },
      {
        headers: {
          'apikey': config.evolution.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Notificação enviada para ${user.phone_number}`);
    
    // Cache no Redis para evitar duplicatas
    const cacheKey = `notification:${user.id}:${reading.day_number}:${moment().format('YYYY-MM-DD')}`;
    await redisClient.setEx(cacheKey, 3600, 'sent');
    
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar para ${user.phone_number}:`, error.response?.data || error.message);
    return false;
  }
}

// Função principal de processamento
async function processNotifications() {
  const now = moment();
  const currentTime = now.format('HH:mm:ss');
  
  console.log(`\n🔄 Processando notificações - ${now.format('YYYY-MM-DD HH:mm:ss')} (${config.timezone})`);
  
  try {
    const users = await getUsersToNotify(currentTime);
    
    if (users.length === 0) {
      console.log('💤 Nenhum usuário para notificar neste horário');
      return;
    }
    
    console.log(`📋 ${users.length} usuários para notificar`);
    
    for (const user of users) {
      // Verificar se já foi notificado
      const cacheKey = `notification:${user.id}:${user.day_number}:${moment().format('YYYY-MM-DD')}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        console.log(`⏭️ ${user.phone_number} já foi notificado hoje`);
        continue;
      }
      
      // Enviar notificação
      await sendNotification(user, {
        day_number: user.day_number,
        reference_text: user.reference_text,
        book_name: user.book_name,
        chapters: user.chapters
      });
      
      // Pausa entre envios
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('❌ Erro ao processar notificações:', error);
  }
}

// Teste manual - adicione esta função
async function testNotification(phoneNumber) {
  console.log('🧪 Teste manual de notificação');
  
  const query = `
    SELECT u.*, rp.name as plan_name, 
           (CURRENT_DATE - u.started_at::DATE + 1) as current_day
    FROM users u
    JOIN reading_plans rp ON rp.id = u.current_plan_id
    WHERE u.phone_number = $1
  `;
  
  const result = await dbClient.query(query, [phoneNumber]);
  
  if (result.rows.length === 0) {
    console.log('❌ Usuário não encontrado');
    return;
  }
  
  const user = result.rows[0];
  console.log('👤 Usuário:', user);
  
  // Simular envio
  await sendNotification(user, {
    day_number: user.current_day,
    reference_text: 'Teste - Gênesis 1-3',
    book_name: 'Gênesis',
    chapters: '1-3'
  });
}

// Health check
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      timezone: config.timezone,
      nextRun: cron.getTasks()[0]?.nextDates(1)[0] || 'N/A'
    }));
  }
});

// Inicialização
async function start() {
  console.log('🚀 Iniciando Bible Bot Scheduler...');
  console.log(`🌍 Timezone: ${config.timezone}`);
  console.log(`⏰ Hora atual: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  
  await initializeConnections();
  
  server.listen(3000, () => {
    console.log('✅ Health check na porta 3000');
  });
  
  // Agendar notificações
  cron.schedule('* * * * *', processNotifications);
  console.log('⏰ Agendador iniciado (verificação a cada minuto)');
  
  // Executar uma vez ao iniciar para teste
  await processNotifications();
  
  // Comando para teste manual (descomente se precisar)
  // await testNotification('556199462043');
}

// Iniciar
start().catch(console.error);
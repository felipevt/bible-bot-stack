const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const moment = require('moment-timezone');

const app = express();
app.use(express.json());

// Configuração do banco
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bible_bot',
  user: process.env.DB_USER || 'bible_user',
  password: process.env.DB_PASSWORD || 'bible_pass_2025',
  // ✅ CORRETO: usar options em vez de schema
  options: `-c search_path=${process.env.DB_SCHEMA || 'public'}`,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Configuração Redis
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

redisClient.connect().catch(console.error);

// ==================== ENDPOINTS DE USUÁRIO ====================

// GET /user/:phoneNumber - Buscar usuário
app.get('/user/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE phone_number = $1',
      [phoneNumber]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /user - Criar usuário
app.post('/user', async (req, res) => {
  try {
    const { phoneNumber, name } = req.body;
    
    const result = await pool.query(
      `INSERT INTO users (phone_number, name, created_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [phoneNumber, name || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /user/:phoneNumber/plan - Atualizar plano do usuário
app.put('/user/:phoneNumber/plan', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { planId } = req.body;
    
    const result = await pool.query(
      `UPDATE users 
       SET current_plan_id = $1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE phone_number = $2 
       RETURNING *`,
      [planId, phoneNumber]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /user/:phoneNumber/time - Atualizar horário de notificação
app.put('/user/:phoneNumber/time', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { notificationTime } = req.body;
    
    // Validar formato do horário
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(notificationTime)) {
      return res.status(400).json({ error: 'Invalid time format' });
    }
    
    const result = await pool.query(
      `UPDATE users 
       SET notification_time = $1::time, is_active = true, updated_at = CURRENT_TIMESTAMP 
       WHERE phone_number = $2 
       RETURNING *`,
      [notificationTime + ':00', phoneNumber]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating time:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /user/:phoneNumber/status - Ativar/Desativar usuário
app.put('/user/:phoneNumber/status', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE users 
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE phone_number = $2 
       RETURNING *`,
      [isActive, phoneNumber]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ENDPOINTS DE PLANOS ====================

// GET /plans - Listar todos os planos
app.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reading_plans ORDER BY id'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plan/:planId/day/:dayNumber - Buscar leitura específica
app.get('/plan/:planId/day/:dayNumber', async (req, res) => {
  try {
    const { planId, dayNumber } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM daily_readings WHERE plan_id = $1 AND day_number = $2',
      [planId, dayNumber]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching reading:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ENDPOINTS DE PROGRESSO ====================

// GET /progress/:phoneNumber - Obter progresso detalhado
app.get('/progress/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    // Buscar usuário e plano
    const userResult = await pool.query(
      `SELECT u.*, rp.name as plan_name, rp.total_days 
       FROM users u 
       LEFT JOIN reading_plans rp ON u.current_plan_id = rp.id 
       WHERE u.phone_number = $1`,
      [phoneNumber]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    if (!user.current_plan_id) {
      return res.json({ 
        user: user,
        progress: null,
        message: 'No active plan' 
      });
    }
    
    // Buscar estatísticas
    const statsResult = await pool.query(
      'SELECT * FROM progress_stats WHERE user_id = $1 AND plan_id = $2',
      [user.id, user.current_plan_id]
    );
    
    // Buscar próxima leitura
    const nextReadingResult = await pool.query(
      `SELECT dr.* 
       FROM daily_readings dr
       LEFT JOIN user_progress up ON up.user_id = $1 
         AND up.plan_id = dr.plan_id 
         AND up.day_number = dr.day_number
       WHERE dr.plan_id = $2
         AND (up.completed IS NULL OR up.completed = false)
       ORDER BY dr.day_number
       LIMIT 1`,
      [user.id, user.current_plan_id]
    );
    
    const progress = statsResult.rows[0] || {
      completed_days: 0,
      total_days: user.total_days,
      current_streak: 0,
      best_streak: 0,
      completion_percentage: 0
    };
    
    res.json({
      user: user,
      progress: progress,
      nextReading: nextReadingResult.rows[0] || null,
      planName: user.plan_name
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /progress/:phoneNumber/complete - Marcar leitura como completa
app.post('/progress/:phoneNumber/complete', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { dayNumber } = req.body;
    
    // Buscar usuário
    const userResult = await pool.query(
      'SELECT id, current_plan_id FROM users WHERE phone_number = $1',
      [phoneNumber]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Se não foi especificado dia, pegar o dia atual
    let targetDay = dayNumber;
    if (!targetDay) {
      const todayResult = await pool.query(
        `SELECT day_number 
         FROM daily_readings 
         WHERE plan_id = $1 
           AND day_number = EXTRACT(DOY FROM CURRENT_DATE - (SELECT started_at FROM users WHERE id = $2))::INTEGER + 1`,
        [user.current_plan_id, user.id]
      );
      
      if (todayResult.rows.length > 0) {
        targetDay = todayResult.rows[0].day_number;
      }
    }
    
    // Inserir ou atualizar progresso
    const progressResult = await pool.query(
      `INSERT INTO user_progress (user_id, plan_id, day_number, reading_date, completed, completed_at)
       VALUES ($1, $2, $3, CURRENT_DATE, true, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, plan_id, day_number) 
       DO UPDATE SET completed = true, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [user.id, user.current_plan_id, targetDay]
    );
    
    // Atualizar estatísticas
    await pool.query('SELECT calculate_progress_stats($1, $2)', [user.id, user.current_plan_id]);
    
    res.json({
      success: true,
      progress: progressResult.rows[0]
    });
  } catch (error) {
    console.error('Error marking complete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /progress/:phoneNumber/report - Relatório formatado
app.get('/progress/:phoneNumber/report', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    // Buscar dados completos
    const progressData = await fetch(`http://localhost:${PORT}/progress/${phoneNumber}`);
    const data = await progressData.json();
    
    if (!data.progress) {
      return res.send('Você ainda não tem um plano ativo. Digite 1 para ver o menu.');
    }
    
    const { progress, user, planName, nextReading } = data;
    const percentage = parseFloat(progress.completion_percentage) || 0;
    const progressBar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
    
    let report = `📊 *SEU PROGRESSO - ${planName.toUpperCase()}*\\n\\n`;
    report += `✅ Progresso: ${progress.completed_days}/${progress.total_days} dias (${percentage.toFixed(1)}%)\\n`;
    report += `🔥 Sequência atual: ${progress.current_streak} dias\\n`;
    report += `📅 Iniciado em: ${moment(user.started_at).format('DD/MM/YYYY')}\\n`;
    
    if (nextReading) {
      report += `⏰ Próxima leitura: ${nextReading.reference_text}\\n`;
    }
    
    report += `\\n📈 *ESTATÍSTICAS:*\\n`;
    report += `• Leituras realizadas: ${progress.completed_days}\\n`;
    report += `• Leituras perdidas: ${progress.missed_days || 0}\\n`;
    report += `• Maior sequência: ${progress.best_streak} dias\\n`;
    
    if (progress.estimated_completion_date) {
      report += `• Previsão de conclusão: ${moment(progress.estimated_completion_date).format('DD/MM/YYYY')}\\n`;
    }
    
    report += `\\n[${progressBar}] ${percentage.toFixed(1)}%\\n\\n`;
    
    // Mensagem motivacional baseada no progresso
    if (percentage < 25) {
      report += `💪 Ótimo começo! Continue firme!`;
    } else if (percentage < 50) {
      report += `🌟 Você está indo muito bem!`;
    } else if (percentage < 75) {
      report += `🎯 Já passou da metade! Continue!`;
    } else if (percentage < 100) {
      report += `🏆 Você está quase lá! Não desista!`;
    } else {
      report += `🎉 Parabéns! Plano concluído!`;
    }
    
    res.send(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('Erro ao gerar relatório. Tente novamente.');
  }
});

// GET /progress/:phoneNumber/next-readings - Próximas leituras
app.get('/progress/:phoneNumber/next-readings', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const limit = req.query.limit || 3;
    
    const result = await pool.query(
      `SELECT dr.*, (u.started_at::DATE + dr.day_number - 1) as reading_date
       FROM users u
       JOIN daily_readings dr ON dr.plan_id = u.current_plan_id
       LEFT JOIN user_progress up ON up.user_id = u.id 
         AND up.plan_id = u.current_plan_id 
         AND up.day_number = dr.day_number
       WHERE u.phone_number = $1
         AND u.is_active = true
         AND (up.completed IS NULL OR up.completed = false)
         AND (u.started_at::DATE + dr.day_number - 1) >= CURRENT_DATE
       ORDER BY dr.day_number
       LIMIT $2`,
      [phoneNumber, limit]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching next readings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ENDPOINTS DE MENSAGENS ====================

// POST /message/log - Registrar mensagem
app.post('/message/log', async (req, res) => {
  try {
    const { phoneNumber, messageType, messageContent, status } = req.body;
    
    const result = await pool.query(
      `INSERT INTO message_logs (user_id, message_type, message_content, status, sent_at)
       VALUES ((SELECT id FROM users WHERE phone_number = $1), $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [phoneNumber, messageType, messageContent, status || 'sent']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error logging message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== HEALTH CHECK ====================

// GET /health - Status do serviço
app.get('/health', async (req, res) => {
  try {
    // Testar conexão com banco
    await pool.query('SELECT 1');
    
    // Testar conexão com Redis
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'connected',
        redis: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Bible Bot API Service running on port ${PORT}`);
});
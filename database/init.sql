-- Bible Bot Database Schema
-- Criação das tabelas principais

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Tabela de planos de leitura
CREATE TABLE reading_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    total_days INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de usuários
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    current_plan_id INTEGER REFERENCES reading_plans(id),
    notification_time TIME DEFAULT '08:00:00',
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de leituras diárias por plano
CREATE TABLE daily_readings (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES reading_plans(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    book_name VARCHAR(50) NOT NULL,
    chapters TEXT NOT NULL, -- Ex: "1-3" ou "1,3,5"
    reference_text VARCHAR(100) NOT NULL, -- Ex: "Gênesis 1-3"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plan_id, day_number)
);

-- Tabela de progresso do usuário
CREATE TABLE user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES reading_plans(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    reading_date DATE NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_id, day_number)
);

-- Tabela de estatísticas de progresso (cache)
CREATE TABLE progress_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES reading_plans(id) ON DELETE CASCADE,
    total_days INTEGER NOT NULL,
    completed_days INTEGER DEFAULT 0,
    missed_days INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    estimated_completion_date DATE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_id)
);

-- Tabela de mensagens/logs
CREATE TABLE message_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message_type VARCHAR(50) NOT NULL, -- 'incoming', 'outgoing', 'notification'
    message_content TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'sent' -- 'sent', 'delivered', 'read', 'failed'
);

-- Tabela de configurações do sistema
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_user_progress_user_plan ON user_progress(user_id, plan_id);
CREATE INDEX idx_user_progress_date ON user_progress(reading_date);
CREATE INDEX idx_daily_readings_plan_day ON daily_readings(plan_id, day_number);
CREATE INDEX idx_progress_stats_user ON progress_stats(user_id);
CREATE INDEX idx_message_logs_user ON message_logs(user_id);
CREATE INDEX idx_message_logs_sent_at ON message_logs(sent_at);

-- Triggers para atualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_plans_updated_at 
    BEFORE UPDATE ON reading_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at 
    BEFORE UPDATE ON user_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_stats_updated_at 
    BEFORE UPDATE ON progress_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON system_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular estatísticas de progresso
CREATE OR REPLACE FUNCTION calculate_progress_stats(p_user_id INTEGER, p_plan_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_total_days INTEGER;
    v_completed_days INTEGER;
    v_missed_days INTEGER;
    v_current_streak INTEGER;
    v_best_streak INTEGER;
    v_completion_percentage DECIMAL(5,2);
    v_estimated_completion DATE;
    v_days_since_start INTEGER;
    v_user_start_date DATE;
BEGIN
    -- Obter dados básicos
    SELECT rp.total_days, u.started_at::DATE 
    INTO v_total_days, v_user_start_date
    FROM reading_plans rp
    JOIN users u ON u.current_plan_id = rp.id
    WHERE rp.id = p_plan_id AND u.id = p_user_id;
    
    -- Contar dias completados
    SELECT COUNT(*) INTO v_completed_days
    FROM user_progress 
    WHERE user_id = p_user_id AND plan_id = p_plan_id AND completed = true;
    
    -- Calcular dias desde o início
    v_days_since_start := CURRENT_DATE - v_user_start_date + 1;
    
    -- Calcular dias perdidos
    v_missed_days := GREATEST(0, v_days_since_start - v_completed_days);
    
    -- Calcular porcentagem
    v_completion_percentage := (v_completed_days::DECIMAL / v_total_days::DECIMAL) * 100;
    
    -- Calcular sequência atual
    WITH daily_streak AS (
        SELECT 
            reading_date,
            completed,
            ROW_NUMBER() OVER (ORDER BY reading_date DESC) as rn
        FROM user_progress 
        WHERE user_id = p_user_id AND plan_id = p_plan_id
        ORDER BY reading_date DESC
    ),
    streak_calc AS (
        SELECT 
            COUNT(*) as streak_days
        FROM daily_streak
        WHERE completed = true 
        AND rn <= (
            SELECT MIN(rn) 
            FROM daily_streak 
            WHERE completed = false
        )
    )
    SELECT COALESCE(streak_days, 0) INTO v_current_streak FROM streak_calc;
    
    -- Calcular melhor sequência
    WITH streak_groups AS (
        SELECT 
            reading_date,
            completed,
            ROW_NUMBER() OVER (ORDER BY reading_date) - 
            ROW_NUMBER() OVER (PARTITION BY completed ORDER BY reading_date) as grp
        FROM user_progress 
        WHERE user_id = p_user_id AND plan_id = p_plan_id
    ),
    streak_lengths AS (
        SELECT 
            COUNT(*) as streak_length
        FROM streak_groups
        WHERE completed = true
        GROUP BY grp
    )
    SELECT COALESCE(MAX(streak_length), 0) INTO v_best_streak FROM streak_lengths;
    
    -- Calcular data estimada de conclusão
    IF v_completed_days > 0 THEN
        v_estimated_completion := v_user_start_date + 
            (v_total_days * v_days_since_start / v_completed_days)::INTEGER;
    ELSE
        v_estimated_completion := v_user_start_date + v_total_days;
    END IF;
    
    -- Inserir ou atualizar estatísticas
    INSERT INTO progress_stats (
        user_id, plan_id, total_days, completed_days, missed_days,
        current_streak, best_streak, completion_percentage,
        estimated_completion_date, last_updated
    ) VALUES (
        p_user_id, p_plan_id, v_total_days, v_completed_days, v_missed_days,
        v_current_streak, v_best_streak, v_completion_percentage,
        v_estimated_completion, CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id, plan_id) DO UPDATE SET
        total_days = EXCLUDED.total_days,
        completed_days = EXCLUDED.completed_days,
        missed_days = EXCLUDED.missed_days,
        current_streak = EXCLUDED.current_streak,
        best_streak = EXCLUDED.best_streak,
        completion_percentage = EXCLUDED.completion_percentage,
        estimated_completion_date = EXCLUDED.estimated_completion_date,
        last_updated = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar estatísticas automaticamente
CREATE OR REPLACE FUNCTION update_progress_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_progress_stats(NEW.user_id, NEW.plan_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_progress_stats
    AFTER INSERT OR UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION update_progress_stats_trigger();

-- Função para obter próximas leituras
CREATE OR REPLACE FUNCTION get_next_readings(p_user_id INTEGER, p_limit INTEGER DEFAULT 3)
RETURNS TABLE(
    day_number INTEGER,
    reference_text VARCHAR(100),
    reading_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.day_number,
        dr.reference_text,
        (u.started_at::DATE + dr.day_number - 1) as reading_date
    FROM users u
    JOIN daily_readings dr ON dr.plan_id = u.current_plan_id
    LEFT JOIN user_progress up ON up.user_id = u.id 
        AND up.plan_id = u.current_plan_id 
        AND up.day_number = dr.day_number
    WHERE u.id = p_user_id
        AND u.is_active = true
        AND (up.completed IS NULL OR up.completed = false)
        AND (u.started_at::DATE + dr.day_number - 1) >= CURRENT_DATE
    ORDER BY dr.day_number
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
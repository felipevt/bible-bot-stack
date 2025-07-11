-- Bible Bot Database Seed Data
-- Inserção de dados iniciais

-- Configurações do sistema
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('bot_name', 'Bible Bot', 'Nome do chatbot'),
('welcome_message', 'Olá! 📖 Seja bem-vindo ao Bible Bot!\\n\\nEu vou te ajudar a manter uma rotina de leitura bíblica constante. Escolha um plano e eu te notificarei diariamente!\\n\\nVamos começar?', 'Mensagem de boas-vindas'),
('timezone', 'America/Sao_Paulo', 'Fuso horário padrão'),
('max_retry_notifications', '3', 'Número máximo de tentativas para notificações'),
('notification_retry_interval', '30', 'Intervalo entre tentativas de notificação (minutos)');

-- Planos de leitura
INSERT INTO reading_plans (name, description, total_days) VALUES
('Bíblia em 1 Ano', 'Leia toda a Bíblia em 365 dias com um plano equilibrado entre Antigo e Novo Testamento', 365),
('Novo Testamento em 3 Meses', 'Foque no Novo Testamento com leituras diárias por 90 dias', 90),
('Salmos em 30 Dias', 'Explore os Salmos em 30 dias de leitura devocional', 30),
('Provérbios em 31 Dias', 'Sabedoria diária com os Provérbios em 31 dias', 31);

-- Leituras para o plano "Bíblia em 1 Ano" (primeiros 30 dias como exemplo)
INSERT INTO daily_readings (plan_id, day_number, book_name, chapters, reference_text) VALUES
(1, 1, 'Gênesis', '1-3', 'Gênesis 1-3'),
(1, 2, 'Gênesis', '4-7', 'Gênesis 4-7'),
(1, 3, 'Gênesis', '8-11', 'Gênesis 8-11'),
(1, 4, 'Gênesis', '12-15', 'Gênesis 12-15'),
(1, 5, 'Gênesis', '16-19', 'Gênesis 16-19'),
(1, 6, 'Gênesis', '20-23', 'Gênesis 20-23'),
(1, 7, 'Gênesis', '24-27', 'Gênesis 24-27'),
(1, 8, 'Gênesis', '28-31', 'Gênesis 28-31'),
(1, 9, 'Gênesis', '32-35', 'Gênesis 32-35'),
(1, 10, 'Gênesis', '36-39', 'Gênesis 36-39'),
(1, 11, 'Gênesis', '40-43', 'Gênesis 40-43'),
(1, 12, 'Gênesis', '44-47', 'Gênesis 44-47'),
(1, 13, 'Gênesis', '48-50', 'Gênesis 48-50'),
(1, 14, 'Êxodo', '1-4', 'Êxodo 1-4'),
(1, 15, 'Êxodo', '5-8', 'Êxodo 5-8'),
(1, 16, 'Êxodo', '9-12', 'Êxodo 9-12'),
(1, 17, 'Êxodo', '13-16', 'Êxodo 13-16'),
(1, 18, 'Êxodo', '17-20', 'Êxodo 17-20'),
(1, 19, 'Êxodo', '21-24', 'Êxodo 21-24'),
(1, 20, 'Êxodo', '25-28', 'Êxodo 25-28'),
(1, 21, 'Êxodo', '29-32', 'Êxodo 29-32'),
(1, 22, 'Êxodo', '33-36', 'Êxodo 33-36'),
(1, 23, 'Êxodo', '37-40', 'Êxodo 37-40'),
(1, 24, 'Levítico', '1-4', 'Levítico 1-4'),
(1, 25, 'Levítico', '5-8', 'Levítico 5-8'),
(1, 26, 'Levítico', '9-12', 'Levítico 9-12'),
(1, 27, 'Levítico', '13-16', 'Levítico 13-16'),
(1, 28, 'Levítico', '17-20', 'Levítico 17-20'),
(1, 29, 'Levítico', '21-24', 'Levítico 21-24'),
(1, 30, 'Levítico', '25-27', 'Levítico 25-27');

-- Leituras para "Novo Testamento em 3 Meses" (primeiros 30 dias)
INSERT INTO daily_readings (plan_id, day_number, book_name, chapters, reference_text) VALUES
(2, 1, 'Mateus', '1-2', 'Mateus 1-2'),
(2, 2, 'Mateus', '3-4', 'Mateus 3-4'),
(2, 3, 'Mateus', '5-6', 'Mateus 5-6'),
(2, 4, 'Mateus', '7-8', 'Mateus 7-8'),
(2, 5, 'Mateus', '9-10', 'Mateus 9-10'),
(2, 6, 'Mateus', '11-12', 'Mateus 11-12'),
(2, 7, 'Mateus', '13-14', 'Mateus 13-14'),
(2, 8, 'Mateus', '15-16', 'Mateus 15-16'),
(2, 9, 'Mateus', '17-18', 'Mateus 17-18'),
(2, 10, 'Mateus', '19-20', 'Mateus 19-20'),
(2, 11, 'Mateus', '21-22', 'Mateus 21-22'),
(2, 12, 'Mateus', '23-24', 'Mateus 23-24'),
(2, 13, 'Mateus', '25-26', 'Mateus 25-26'),
(2, 14, 'Mateus', '27-28', 'Mateus 27-28'),
(2, 15, 'Marcos', '1-2', 'Marcos 1-2'),
(2, 16, 'Marcos', '3-4', 'Marcos 3-4'),
(2, 17, 'Marcos', '5-6', 'Marcos 5-6'),
(2, 18, 'Marcos', '7-8', 'Marcos 7-8'),
(2, 19, 'Marcos', '9-10', 'Marcos 9-10'),
(2, 20, 'Marcos', '11-12', 'Marcos 11-12'),
(2, 21, 'Marcos', '13-14', 'Marcos 13-14'),
(2, 22, 'Marcos', '15-16', 'Marcos 15-16'),
(2, 23, 'Lucas', '1-2', 'Lucas 1-2'),
(2, 24, 'Lucas', '3-4', 'Lucas 3-4'),
(2, 25, 'Lucas', '5-6', 'Lucas 5-6'),
(2, 26, 'Lucas', '7-8', 'Lucas 7-8'),
(2, 27, 'Lucas', '9-10', 'Lucas 9-10'),
(2, 28, 'Lucas', '11-12', 'Lucas 11-12'),
(2, 29, 'Lucas', '13-14', 'Lucas 13-14'),
(2, 30, 'Lucas', '15-16', 'Lucas 15-16');

-- Leituras para "Salmos em 30 Dias"
INSERT INTO daily_readings (plan_id, day_number, book_name, chapters, reference_text) VALUES
(3, 1, 'Salmos', '1-5', 'Salmos 1-5'),
(3, 2, 'Salmos', '6-10', 'Salmos 6-10'),
(3, 3, 'Salmos', '11-15', 'Salmos 11-15'),
(3, 4, 'Salmos', '16-20', 'Salmos 16-20'),
(3, 5, 'Salmos', '21-25', 'Salmos 21-25'),
(3, 6, 'Salmos', '26-30', 'Salmos 26-30'),
(3, 7, 'Salmos', '31-35', 'Salmos 31-35'),
(3, 8, 'Salmos', '36-40', 'Salmos 36-40'),
(3, 9, 'Salmos', '41-45', 'Salmos 41-45'),
(3, 10, 'Salmos', '46-50', 'Salmos 46-50'),
(3, 11, 'Salmos', '51-55', 'Salmos 51-55'),
(3, 12, 'Salmos', '56-60', 'Salmos 56-60'),
(3, 13, 'Salmos', '61-65', 'Salmos 61-65'),
(3, 14, 'Salmos', '66-70', 'Salmos 66-70'),
(3, 15, 'Salmos', '71-75', 'Salmos 71-75'),
(3, 16, 'Salmos', '76-80', 'Salmos 76-80'),
(3, 17, 'Salmos', '81-85', 'Salmos 81-85'),
(3, 18, 'Salmos', '86-90', 'Salmos 86-90'),
(3, 19, 'Salmos', '91-95', 'Salmos 91-95'),
(3, 20, 'Salmos', '96-100', 'Salmos 96-100'),
(3, 21, 'Salmos', '101-105', 'Salmos 101-105'),
(3, 22, 'Salmos', '106-110', 'Salmos 106-110'),
(3, 23, 'Salmos', '111-115', 'Salmos 111-115'),
(3, 24, 'Salmos', '116-120', 'Salmos 116-120'),
(3, 25, 'Salmos', '121-125', 'Salmos 121-125'),
(3, 26, 'Salmos', '126-130', 'Salmos 126-130'),
(3, 27, 'Salmos', '131-135', 'Salmos 131-135'),
(3, 28, 'Salmos', '136-140', 'Salmos 136-140'),
(3, 29, 'Salmos', '141-145', 'Salmos 141-145'),
(3, 30, 'Salmos', '146-150', 'Salmos 146-150');

-- Leituras para "Provérbios em 31 Dias"
INSERT INTO daily_readings (plan_id, day_number, book_name, chapters, reference_text) VALUES
(4, 1, 'Provérbios', '1', 'Provérbios 1'),
(4, 2, 'Provérbios', '2', 'Provérbios 2'),
(4, 3, 'Provérbios', '3', 'Provérbios 3'),
(4, 4, 'Provérbios', '4', 'Provérbios 4'),
(4, 5, 'Provérbios', '5', 'Provérbios 5'),
(4, 6, 'Provérbios', '6', 'Provérbios 6'),
(4, 7, 'Provérbios', '7', 'Provérbios 7'),
(4, 8, 'Provérbios', '8', 'Provérbios 8'),
(4, 9, 'Provérbios', '9', 'Provérbios 9'),
(4, 10, 'Provérbios', '10', 'Provérbios 10'),
(4, 11, 'Provérbios', '11', 'Provérbios 11'),
(4, 12, 'Provérbios', '12', 'Provérbios 12'),
(4, 13, 'Provérbios', '13', 'Provérbios 13'),
(4, 14, 'Provérbios', '14', 'Provérbios 14'),
(4, 15, 'Provérbios', '15', 'Provérbios 15'),
(4, 16, 'Provérbios', '16', 'Provérbios 16'),
(4, 17, 'Provérbios', '17', 'Provérbios 17'),
(4, 18, 'Provérbios', '18', 'Provérbios 18'),
(4, 19, 'Provérbios', '19', 'Provérbios 19'),
(4, 20, 'Provérbios', '20', 'Provérbios 20'),
(4, 21, 'Provérbios', '21', 'Provérbios 21'),
(4, 22, 'Provérbios', '22', 'Provérbios 22'),
(4, 23, 'Provérbios', '23', 'Provérbios 23'),
(4, 24, 'Provérbios', '24', 'Provérbios 24'),
(4, 25, 'Provérbios', '25', 'Provérbios 25'),
(4, 26, 'Provérbios', '26', 'Provérbios 26'),
(4, 27, 'Provérbios', '27', 'Provérbios 27'),
(4, 28, 'Provérbios', '28', 'Provérbios 28'),
(4, 29, 'Provérbios', '29', 'Provérbios 29'),
(4, 30, 'Provérbios', '30', 'Provérbios 30'),
(4, 31, 'Provérbios', '31', 'Provérbios 31');

-- Exemplo de usuário para testes (opcional - pode ser removido em produção)
-- INSERT INTO users (phone_number, name, current_plan_id, notification_time, started_at) VALUES
-- ('5511999999999', 'Usuário Teste', 1, '08:00:00', CURRENT_DATE);
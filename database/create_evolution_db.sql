SELECT 'CREATE DATABASE evolution_api'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution_api')\gexec

-- Conceder permissões
GRANT ALL PRIVILEGES ON DATABASE evolution_api TO bible_user;

-- Conectar ao banco evolution_api para configuração adicional
\c evolution_api bible_user;

-- Dar permissões ao schema public
GRANT ALL ON SCHEMA public TO bible_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bible_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bible_user;

-- Definir permissões padrão para futuras tabelas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bible_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bible_user;
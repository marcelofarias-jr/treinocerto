-- Tabela de treinos
CREATE TABLE IF NOT EXISTS workouts (
  id BIGINT PRIMARY KEY,
  user_email TEXT NOT NULL,
  format TEXT NOT NULL,
  days JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_email ON workouts(user_email);

-- Tabela de sessões de treino
CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT PRIMARY KEY,
  user_email TEXT NOT NULL,
  date TEXT NOT NULL,
  workout_id BIGINT,
  day_id TEXT,
  day_label TEXT,
  duration INT DEFAULT 0,
  exercises_data JSONB DEFAULT '[]',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migração: adicionar coluna notes em bases existentes
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_user_email ON sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(user_email, date);

-- Exercícios customizados pelo usuário
CREATE TABLE IF NOT EXISTS custom_exercises (
  id BIGINT PRIMARY KEY,
  user_email TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_exercises_user ON custom_exercises(user_email);

-- Migração: adicionar coluna de peso corporal na tabela de treinos
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS body_weights JSONB DEFAULT '[]';

-- Exercícios padrão ocultos (excluídos ou substituídos pelo admin)
CREATE TABLE IF NOT EXISTS hidden_exercises (
  name TEXT PRIMARY KEY,
  muscle_group TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
